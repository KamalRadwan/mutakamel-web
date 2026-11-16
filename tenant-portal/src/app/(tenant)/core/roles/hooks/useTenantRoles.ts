"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCan, useRealtimeResync, type FilterDef, type FilterValues } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  createTenantRole,
  deleteTenantRole,
  fetchTenantRoles,
  TENANT_ROLE_SORT_FIELDS,
  type TenantRole,
  type TenantRoleSortField,
  updateTenantRole,
} from "../../contracts/role-contract";
import { useRoleBranchListController } from "./useRoleBranchListController";

export function useTenantRoles() {
  const { t, lang } = useI18n();
  const copy = t.coreIdentity.roles;
  const canCreate = useCan("roles.role.create", { tenantWide: true });
  const canUpdate = useCan("roles.role.update", { tenantWide: true });
  const canDelete = useCan("roles.role.delete", { tenantWide: true });
  const canReadUsers = useCan("users.user.read");

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [serverSearch, setServerSearch] = useState("");
  const [isSystemFilter, setIsSystemFilterState] = useState<boolean | undefined>(undefined);
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
  const [editingRole, setEditingRole] = useState<TenantRole | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<NormalizedApiError | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TenantRole | null>(null);
  const [blockedRole, setBlockedRole] = useState<TenantRole | null>(null);
  const [blockerError, setBlockerError] = useState<NormalizedApiError | null>(null);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  const branchController = useRoleBranchListController({
    canUpdate,
    lang,
    onReloadList: reload,
  });
  const { notifyRoleCreated } = branchController;

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed === serverSearch) return;
    const timeout = window.setTimeout(() => {
      setPage(1);
      setServerSearch(trimmed);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchQuery, serverSearch]);

  useEffect(() => {
    // Deferred past the effect body on purpose: a synchronous setState there
    // cascades an extra render (react-hooks/set-state-in-effect), and the abort
    // check means a torn-down screen never writes at all.
    const controller = new AbortController();
    let clamped = false;
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
          const maxPage = Math.max(1, result.totalPages);
          if (page > maxPage) {
            clamped = true;
            setPage(maxPage);
            return;
          }
          setRows(result.items);
          setPageInfo({ page: result.page, limit: result.limit, total: result.total });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setRows([]);
          setQueryError(normalizeApiError(error));
        })
        .finally(() => {
          if (!controller.signal.aborted && !clamped) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [isSystemFilter, page, reloadToken, serverSearch, sort]);

  const setIsSystemFilter = useCallback((next: boolean | undefined) => {
    setPage(1);
    setIsSystemFilterState(next);
  }, []);

  const filterDefs = useMemo<FilterDef[]>(
    () => [
      {
        id: "isSystem",
        kind: "select",
        label: copy.systemFilter,
        options: [
          { value: "true", label: copy.systemOnly },
          { value: "false", label: copy.customOnly },
        ],
        placeholder: copy.allRoles,
      },
    ],
    [copy.allRoles, copy.customOnly, copy.systemFilter, copy.systemOnly],
  );

  const filterValues = useMemo<FilterValues>(
    () =>
      isSystemFilter === undefined
        ? {}
        : { isSystem: { kind: "select", value: String(isSystemFilter) } },
    [isSystemFilter],
  );

  const handleFilterChange = useCallback(
    (next: FilterValues) => {
      const value = next.isSystem;
      if (value?.kind !== "select") {
        setIsSystemFilter(undefined);
        return;
      }
      setIsSystemFilter(
        value.value === "true" ? true : value.value === "false" ? false : undefined,
      );
    },
    [setIsSystemFilter],
  );

  const resetFilters = useCallback(() => setIsSystemFilter(undefined), [setIsSystemFilter]);

  const setSort = useCallback((next: { id: string; direction: "asc" | "desc" }) => {
    const field = TENANT_ROLE_SORT_FIELDS.find((allowed) => allowed === next.id);
    if (!field) return;
    setSortState({ id: field, direction: next.direction });
    setPage(1);
  }, []);

  useRealtimeResync(reload);

  const handleCreate = useCallback(
    async (body: { name: string; description?: string }): Promise<boolean> => {
      if (!canCreate) return false;
      setIsSubmitting(true);
      setMutationError(null);
      try {
        const created = await createTenantRole(body);
        setIsCreateOpen(false);
        reload();
        notifyRoleCreated(created);
        return true;
      } catch (error) {
        setMutationError(normalizeApiError(error));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canCreate, notifyRoleCreated, reload],
  );

  const handleUpdate = useCallback(
    async (body: { name?: string; description?: string }): Promise<boolean> => {
      if (!editingRole || editingRole.isSystem || !canUpdate) return false;
      setIsSubmitting(true);
      setMutationError(null);
      try {
        await updateTenantRole(editingRole.id, body);
        setEditingRole(null);
        reload();
        return true;
      } catch (error) {
        setMutationError(normalizeApiError(error));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canUpdate, editingRole, reload],
  );

  const handleDelete = useCallback(async () => {
    const target = pendingDelete;
    if (!target || target.isSystem || !canDelete) return;
    setIsSubmitting(true);
    setMutationError(null);
    try {
      await deleteTenantRole(target.id);
      setPendingDelete(null);
      reload();
    } catch (error) {
      const normalized = normalizeApiError(error);
      setPendingDelete(null);
      if (normalized.code === "ROLE_IN_USE") {
        setBlockedRole(target);
        setBlockerError(normalized);
      } else {
        setMutationError(normalized);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [canDelete, pendingDelete, reload]);

  const hasSystemRow = useMemo(() => rows.some((role) => role.isSystem), [rows]);
  const isModalOpen =
    isCreateOpen || editingRole !== null || branchController.branchModalTarget !== null;

  return {
    t,
    lang,
    canCreate,
    canUpdate,
    canDelete,
    canReadUsers,
    rows,
    hasSystemRow,
    pageInfo,
    page,
    setPage,
    isLoading,
    queryError,
    searchQuery,
    setSearchQuery,
    isSystemFilter,
    setIsSystemFilter,
    filterDefs,
    filterValues,
    handleFilterChange,
    resetFilters,
    reload,
    sort,
    setSort,
    isModalOpen,
    isCreateOpen,
    openCreate: () => { if (canCreate) { setMutationError(null); setIsCreateOpen(true); } },
    closeCreate: () => { setIsCreateOpen(false); setMutationError(null); },
    editingRole,
    startEdit: (role: TenantRole) => {
      if (canUpdate && !role.isSystem) { setMutationError(null); setEditingRole(role); }
    },
    closeEdit: () => { setEditingRole(null); setMutationError(null); },
    isSubmitting,
    mutationError,
    pendingDelete,
    requestDelete: (role: TenantRole) => {
      if (canDelete && !role.isSystem) { setMutationError(null); setPendingDelete(role); }
    },
    handleDeleteOpenChange: (open: boolean) => { if (!open) setPendingDelete(null); },
    blockedRole,
    blockerError,
    handleBlockerOpenChange: (open: boolean) => {
      if (!open) { setBlockedRole(null); setBlockerError(null); }
    },
    handleCreate,
    handleUpdate,
    handleDelete,
    confirmDelete: () => { void handleDelete(); },
    ...branchController,
  };
}
