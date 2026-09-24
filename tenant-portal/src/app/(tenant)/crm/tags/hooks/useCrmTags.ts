"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { hasPermission } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  CRM_TAGS_PATH,
  crmTagPath,
  parseCrmTagCatalogue,
  readCrmTagError,
  type CrmTagCatalogueItem,
} from "../../shared/tag-contract";

// 500 tags × a 60-code-point name and two timestamps stays well under this.
const CATALOGUE_RESPONSE_LIMIT_BYTES = 512 * 1024;

/** What the create/edit drawer is open on, or nothing. */
export type CrmTagFormTarget = { mode: "create" } | { mode: "edit"; tag: CrmTagCatalogueItem };

function byName(a: CrmTagCatalogueItem, b: CrmTagCatalogueItem): number {
  return a.name.localeCompare(b.name);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** The tag catalogue screen: list, search, and the delete flow. */
export function useCrmTags() {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const canManage = hasPermission(user?.permissions ?? [], "crm.tags.manage");
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

  const load = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    setIsLoading(true);
    setQueryError(null);
    try {
      const response = await axiosClient.get<unknown>(CRM_TAGS_PATH, {
        signal,
        cache: "no-store",
        maxResponseBytes: CATALOGUE_RESPONSE_LIMIT_BYTES,
      });
      setItems(parseCrmTagCatalogue(response.data));
      setHasLoaded(true);
      return true;
    } catch (error) {
      if (isAbortError(error)) return false;
      setQueryError(normalizeApiError(error));
      return false;
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
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
      const reloaded = await load();
      setNotice(message === null || reloaded ? message : t.crmTags.errors.uncertainReloadFailed);
    },
    [load, t],
  );

  const handleSaved = (saved: CrmTagCatalogueItem) => {
    setItems((current) => [...current.filter(({ id }) => id !== saved.id), saved].sort(byName));
    setFormTarget(null);
  };

  const handleFormReload = (message: string) => {
    setFormTarget(null);
    void reloadAfter(message);
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget || !canManage || isDeleting) return;
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
    } catch (error) {
      const failure = readCrmTagError(error);
      if (failure === null || failure.status >= 500) {
        setDeleteTarget(null);
        await reloadAfter(t.crmTags.errors.uncertain);
      } else if (failure.code === "CRM_TAG_NOT_FOUND" || failure.status === 404) {
        setDeleteTarget(null);
        await reloadAfter(t.crmTags.errors.notFound);
      } else {
        setDeleteError(failure.status === 403 ? t.crmTags.errors.forbidden : t.crmTags.errors.deleteFailed);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    items: filteredItems,
    allItems: items,
    hasLoaded,
    searchQuery,
    setSearchQuery,
    isLoading,
    queryError,
    notice,
    canManage,
    reload: () => {
      setNotice(null);
      void load();
    },
    formTarget,
    openCreate: () => {
      if (!canManage) return;
      setNotice(null);
      setFormTarget({ mode: "create" });
    },
    openEdit: (tag: CrmTagCatalogueItem) => {
      if (!canManage) return;
      setNotice(null);
      setFormTarget({ mode: "edit", tag });
    },
    closeForm: () => setFormTarget(null),
    handleSaved,
    handleFormReload,
    deleteTarget,
    deleteError,
    isDeleting,
    selectForDelete: (tag: CrmTagCatalogueItem) => {
      if (!canManage) return;
      setNotice(null);
      setDeleteError(null);
      setDeleteTarget(tag);
    },
    closeDelete: () => {
      if (isDeleting) return;
      setDeleteError(null);
      setDeleteTarget(null);
    },
    handleDelete,
  };
}
