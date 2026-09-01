"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useRealtimeResync } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  createTenantRole,
  deleteTenantRole,
  fetchTenantRoles,
  type TenantRole,
  TENANT_ROLE_SORT_FIELDS,
  type TenantRoleSortField,
} from "../../contracts/role-contract";

export function useTenantRoles() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const permissions = user?.permissions ?? [];

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [serverSearch, setServerSearch] = useState("");
  const [isSystemFilter, setIsSystemFilter] = useState<boolean | undefined>(undefined);
  const [sort, setSortState] = useState<{ id: TenantRoleSortField; direction: "asc" | "desc" }>({
    id: "name",
    direction: "asc",
  });
  const [rows, setRows] = useState<TenantRole[]>([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, limit: 25, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<NormalizedApiError | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TenantRole | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setServerSearch(searchQuery.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    // Deferred past the effect body on purpose: a synchronous setState there
    // cascades an extra render (react-hooks/set-state-in-effect), and the abort
    // check means a torn-down screen never writes at all.
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      setQueryError(null);
      fetchTenantRoles({
        page,
        search: serverSearch,
        isSystem: isSystemFilter,
        sortBy: sort.id,
        sortDir: sort.direction === "asc" ? "ASC" : "DESC",
        signal: controller.signal,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          setRows(result.items);
          setPageInfo({ page: result.page, limit: result.limit, total: result.total });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setRows([]);
          setQueryError(normalizeApiError(error));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [isSystemFilter, page, serverSearch, reloadToken, sort]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const setSort = useCallback((next: { id: string; direction: "asc" | "desc" }) => {
    const field = TENANT_ROLE_SORT_FIELDS.find((allowed) => allowed === next.id);
    if (!field) return;
    setSortState({ id: field, direction: next.direction });
    setPage(1);
  }, []);

  // MASTER-PLAN 13.6: one line, and this list reconciles with the server on
  // an ALL-scoped resync, a realtime reconnect, and a return from offline.
  useRealtimeResync(reload);

  const handleCreate = useCallback(
    async (body: { name: string; description?: string }): Promise<boolean> => {
      setIsSubmitting(true);
      setMutationError(null);
      try {
        await createTenantRole(body);
        setIsCreateOpen(false);
        reload();
        return true;
      } catch (error) {
        setMutationError(normalizeApiError(error));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [reload],
  );

  const handleDelete = useCallback(async () => {
    const target = pendingDelete;
    if (!target) return;
    setIsSubmitting(true);
    setMutationError(null);
    try {
      await deleteTenantRole(target.id);
      setPendingDelete(null);
      reload();
    } catch (error) {
      setPendingDelete(null);
      setMutationError(normalizeApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  }, [pendingDelete, reload]);

  return useMemo(
    () => ({
      t,
      lang,
      canCreate: permissions.includes("roles.role.create"),
      canUpdate: permissions.includes("roles.role.update"),
      canDelete: permissions.includes("roles.role.delete"),
      rows,
      pageInfo,
      page,
      setPage,
      isLoading,
      queryError,
      searchQuery,
      setSearchQuery,
      isSystemFilter,
      setIsSystemFilter: (next: boolean | undefined) => {
        setPage(1);
        setIsSystemFilter(next);
      },
      reload,
      sort,
      setSort,
      isCreateOpen,
      openCreate: () => {
        setMutationError(null);
        setIsCreateOpen(true);
      },
      closeCreate: () => setIsCreateOpen(false),
      isSubmitting,
      mutationError,
      pendingDelete,
      requestDelete: setPendingDelete,
      cancelDelete: () => setPendingDelete(null),
      handleCreate,
      handleDelete,
    }),
    [
      handleCreate, handleDelete, isCreateOpen, isLoading, isSubmitting, isSystemFilter,
      lang, mutationError, page, pageInfo, pendingDelete, permissions, queryError,
      reload, rows, searchQuery, setSort, sort, t,
    ],
  );
}
