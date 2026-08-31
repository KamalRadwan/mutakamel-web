"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast, useWorkspaceState } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { createParty, deleteParty, fetchParties, updateParty } from "../directory-api";
import {
  PARTY_MANAGE_PERMISSION,
  PARTY_READ_PERMISSION,
  PARTY_SORT_FIELDS,
  buildCreatePartyRequest,
  type Party,
  type PartyFilters,
  type PartyFormValues,
  type PartySortField,
  type PartyStatus,
} from "../directory-contract";

const PARTY_PAGE_SIZE = 25;

function isSortField(value: string): value is PartySortField {
  return (PARTY_SORT_FIELDS as readonly string[]).includes(value);
}

/**
 * The parties workspace: one list, three views, five permissions.
 *
 * Only `directory.party.*` is checked here — a caller may hold it while
 * lacking `directory.address.manage`, so each child section on the detail
 * screen gates itself rather than inheriting a page-level decision.
 */
export function useDirectoryParties() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const { user } = useTenantAuth();
  const permissions = user?.permissions ?? [];
  const canRead = permissions.includes(PARTY_READ_PERMISSION);
  const canManage = permissions.includes(PARTY_MANAGE_PERMISSION);

  const [items, setItems] = useState<Party[]>([]);
  const [total, setTotal] = useState(0);
  const [serverPage, setServerPage] = useState(1);
  const [sortField, setSortField] = useState<PartySortField>("displayName");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
  const [search, setSearch] = useState("");
  const [serverSearch, setServerSearch] = useState("");
  const [filters, setFilters] = useState<PartyFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Party | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const workspace = useWorkspaceState("core-directory", {
    defaultView: "table",
    defaultSort: { id: "displayName", direction: "asc" },
    onPageChange: setServerPage,
    onSortChange: (sort) => {
      if (isSortField(sort.id)) setSortField(sort.id);
      setSortDir(sort.direction === "desc" ? "DESC" : "ASC");
      setServerPage(1);
    },
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setServerPage(1);
      setServerSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!canRead) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setQueryError(null);
      try {
        const page = await fetchParties({
          page: serverPage,
          search: serverSearch,
          sortBy: sortField,
          sortDir,
          filters,
          signal,
        });
        setItems(page.items);
        setTotal(page.total);
        setHasLoaded(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [canRead, serverPage, serverSearch, sortField, sortDir, filters],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load, reloadToken]);

  const reportFailure = useCallback(
    (error: unknown, title: string): void => {
      const normalized = normalizeApiError(error);
      // 403 already raised a toast inside the transport.
      if (normalized.status === 403) return;
      if (toast.outcomeFromApi(normalized)) return;
      toast.errorFromApi(title, normalized);
    },
    [toast],
  );

  const create = useCallback(
    async (values: PartyFormValues): Promise<boolean> => {
      if (!canManage || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        await createParty(buildCreatePartyRequest(values));
        setIsCreateOpen(false);
        toast.success(t.coreOperations.directory.savedTitle, t.coreOperations.directory.partyCreated);
        setReloadToken((token) => token + 1);
        return true;
      } catch (error) {
        if (error instanceof Error && error.message === "PARTY_FORM_DISPLAY_NAME") {
          setFormError(t.coreOperations.directory.displayNameRequired);
          return false;
        }
        reportFailure(error, t.coreOperations.directory.partyCreateFailed);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, isSubmitting, toast, t, reportFailure],
  );

  const remove = useCallback(async (): Promise<void> => {
    if (!canManage || !deleting || pendingId) return;
    setPendingId(deleting.id);
    try {
      await deleteParty(deleting.id);
      toast.success(t.coreOperations.directory.savedTitle, t.coreOperations.directory.partyDeleted);
      setReloadToken((token) => token + 1);
    } catch (error) {
      reportFailure(error, t.coreOperations.directory.partyDeleteFailed);
    } finally {
      setPendingId(null);
      setDeleting(null);
    }
  }, [canManage, deleting, pendingId, toast, t, reportFailure]);

  /**
   * The board's grouping axis is `status`, so a card move is a real
   * `PATCH /parties/:id` — the row reverts and a toast explains when it fails
   * (state 8 in docs/design/states.md).
   */
  const moveStatus = useCallback(
    async (partyId: string, status: PartyStatus): Promise<void> => {
      if (!canManage) return;
      const previous = items;
      setItems((current) =>
        current.map((party) => (party.id === partyId ? { ...party, status } : party)),
      );
      setPendingId(partyId);
      try {
        await updateParty(partyId, { status });
        toast.success(t.coreOperations.directory.savedTitle, t.coreOperations.directory.partyStatusChanged);
      } catch (error) {
        setItems(previous);
        reportFailure(error, t.coreOperations.directory.partyStatusFailed);
      } finally {
        setPendingId(null);
      }
    },
    [canManage, items, toast, t, reportFailure],
  );

  const pageInfo = useMemo(
    () => ({ page: serverPage, limit: PARTY_PAGE_SIZE, total }),
    [serverPage, total],
  );

  const openParty = useCallback(
    (party: Party) => router.push(`${TENANT_ROUTES.coreDirectory}/${party.id}`),
    [router],
  );

  return {
    t,
    lang,
    canRead,
    canManage,
    workspace,
    items,
    pageInfo,
    search,
    filters,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    isSubmitting,
    pendingId,
    queryError,
    formError,
    isCreateOpen,
    deleting,
    setSearch,
    setFilters: (next: PartyFilters) => {
      setServerPage(1);
      setFilters(next);
    },
    openCreate: () => {
      setFormError(null);
      setIsCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setFormError(null);
      setIsCreateOpen(false);
    },
    openDelete: (party: Party) => setDeleting(party),
    closeDelete: () => {
      if (pendingId) return;
      setDeleting(null);
    },
    create,
    remove,
    moveStatus,
    openParty,
    reload: () => setReloadToken((token) => token + 1),
  };
}
