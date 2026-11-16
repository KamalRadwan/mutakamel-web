"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { hasPermission, useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  CRM_TAGS_PATH,
  crmTagPath,
  parseCrmTagCatalogue,
  readCrmTagError,
  type CrmTagCatalogueItem,
} from "../../shared/tag-contract";
import { CRM_TAG_CATALOGUE_LIMIT } from "../tag-limits";

// 500 tags × a 60-code-point name and two timestamps stays well under this.
const CATALOGUE_RESPONSE_LIMIT_BYTES = 512 * 1024;

/** What the create/edit modal is open on, or nothing. */
export type CrmTagFormTarget = { mode: "create" } | { mode: "edit"; tag: CrmTagCatalogueItem };

function byName(a: CrmTagCatalogueItem, b: CrmTagCatalogueItem): number {
  return a.name.localeCompare(b.name);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** The tag catalogue screen: list, search, and the delete flow. */
export function useCrmTags() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { canMutate } = useAccessMode();
  const canManage = canMutate && hasPermission(user?.permissions ?? [], "crm.tags.manage");
  const [items, setItems] = useState<CrmTagCatalogueItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<CrmTagFormTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CrmTagCatalogueItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [deleteLeadCount, setDeleteLeadCount] = useState<string>();
  const [needsReload, setNeedsReload] = useState(false);
  const loadGeneration = useRef(0);
  const loading = useRef(true);
  const deleting = useRef(false);
  const mustReload = useRef(false);
  const atCapacity = items.length >= CRM_TAG_CATALOGUE_LIMIT;
  const writesBlocked = !hasLoaded || isLoading || isDeleting || needsReload || queryError !== null;

  const load = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    const generation = ++loadGeneration.current;
    loading.current = true;
    setIsLoading(true);
    setQueryError(null);
    try {
      const response = await axiosClient.get<unknown>(CRM_TAGS_PATH, {
        signal,
        cache: "no-store",
        maxResponseBytes: CATALOGUE_RESPONSE_LIMIT_BYTES,
      });
      const catalogue = parseCrmTagCatalogue(response.data);
      if (signal?.aborted || generation !== loadGeneration.current) return false;
      setItems(catalogue);
      setHasLoaded(true);
      mustReload.current = false;
      setNeedsReload(false);
      return true;
    } catch (error) {
      if (isAbortError(error) || signal?.aborted || generation !== loadGeneration.current) return false;
      setQueryError(normalizeApiError(error));
      return false;
    } finally {
      if (!signal?.aborted && generation === loadGeneration.current) {
        loading.current = false;
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const generationTracker = loadGeneration;
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => { controller.abort(); generationTracker.current++; };
  }, [load]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return query ? items.filter(({ name }) => name.toLocaleLowerCase().includes(query)) : items;
  }, [items, searchQuery]);

  /**
   * A write whose outcome the list cannot trust — uncertain, or aimed at a tag
   * that no longer exists. The catalogue is re-read before anyone acts again.
   */
  const reloadAfter = useCallback(
    async (message: string | null) => {
      mustReload.current = true;
      setNeedsReload(true);
      const reloaded = await load();
      setNotice(message === null || reloaded ? message : t.crmTags.errors.uncertainReloadFailed);
    },
    [load, t],
  );

  const handleSaved = (saved: CrmTagCatalogueItem) => {
    setItems((current) => [...current.filter(({ id }) => id !== saved.id), saved].sort(byName));
    setFormTarget(null);
    toast.success(t.crmTags.saved);
  };

  const handleFormReload = (message: string) => {
    setFormTarget(null);
    void reloadAfter(message);
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget || !canManage || deleting.current || loading.current || mustReload.current || deleteBlocked || queryError) return;
    deleting.current = true;
    const deletedId = deleteTarget.id;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      // `DELETE /tags/:id` is not idempotent in the Gateway contract, so the
      // transport must neither replay it nor mint a key for it.
      await axiosClient.delete(crmTagPath(deletedId), {
        cache: "no-store",
        maxResponseBytes: 10_000,
        nonReplayable: true,
        skipAutoIdempotency: true,
      });
      setItems((current) => current.filter(({ id }) => id !== deletedId));
      setDeleteTarget(null);
      toast.success(t.crmTags.deleted);
    } catch (error) {
      const failure = readCrmTagError(error);
      if (failure === null || failure.status >= 500) {
        setDeleteTarget(null);
        await reloadAfter(t.crmTags.errors.uncertain);
      } else if (failure.code === "CRM_TAG_NOT_FOUND" || failure.status === 404) {
        setDeleteTarget(null);
        await reloadAfter(t.crmTags.errors.notFound);
      } else {
        const normalized = normalizeApiError(error);
        if (normalized.code === "CRM_TAG_DETACH_LIMIT_EXCEEDED") {
          setDeleteBlocked(true);
          setDeleteError(t.crmTags.errors.detachLimit);
          const details: unknown = error instanceof TenantApiClientError ? error.response.data.details : undefined;
          const count = details && typeof details === "object" && "count" in details ? details.count : undefined;
          setDeleteLeadCount(typeof count === "number" && Number.isSafeInteger(count) && count > 100
            ? formatNumber(count, lang) : undefined);
        } else {
          setDeleteError(failure.status === 403 ? t.crmTags.errors.forbidden : t.crmTags.errors.deleteFailed);
        }
      }
    } finally {
      deleting.current = false;
      setIsDeleting(false);
    }
  };

  return {
    catalogueCount: hasLoaded && !isLoading && !queryError ? formatNumber(items.length, lang) : undefined,
    catalogueCountLabel: hasLoaded && !isLoading && !queryError ? formatTemplate(
      searchQuery.trim() ? t.crmTags.matchCount : t.crmTags.catalogueCount,
      { count: formatNumber(filteredItems.length, lang), total: formatNumber(items.length, lang) },
    ) : undefined,
    items: filteredItems,
    allItems: items,
    hasLoaded,
    searchQuery,
    setSearchQuery,
    isLoading,
    queryError,
    notice,
    canManage,
    atCapacity,
    writesBlocked,
    needsReload,
    isFiltered: searchQuery.trim().length > 0,
    reload: () => {
      if (deleting.current) return;
      setNotice(null);
      void load();
    },
    formTarget,
    openCreate: () => {
      if (!canManage || writesBlocked || loading.current || mustReload.current || deleting.current || atCapacity) return;
      setNotice(null);
      setFormTarget({ mode: "create" });
    },
    openEdit: (tag: CrmTagCatalogueItem) => {
      if (!canManage || writesBlocked || loading.current || mustReload.current || deleting.current) return;
      setNotice(null);
      setFormTarget({ mode: "edit", tag });
    },
    closeForm: () => setFormTarget(null),
    handleSaved,
    handleFormReload,
    deleteTarget,
    deleteError,
    deleteBlocked,
    deleteLeadCount,
    isDeleting,
    selectForDelete: (tag: CrmTagCatalogueItem) => {
      if (!canManage || writesBlocked || loading.current || mustReload.current || deleting.current) return;
      setNotice(null);
      setDeleteError(null);
      setDeleteBlocked(false);
      setDeleteLeadCount(undefined);
      setDeleteTarget(tag);
    },
    closeDelete: () => {
      if (deleting.current) return;
      setDeleteError(null);
      setDeleteTarget(null);
    },
    handleDelete,
  };
}
