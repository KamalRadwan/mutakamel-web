"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRealtimeResync } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  createOrgNode,
  deleteOrgNode,
  fetchOrgNodes,
  ORG_NODE_SORT_FIELDS,
  readDeletionBlockers,
  updateOrgNode,
  type OrgLevel,
  type OrgNodeOf,
  type OrgNodeSortField,
  type OrgNodeStatus,
  type OrgHierarchyFilters,
} from "../../contracts/organization-contract";
import { ORG_LEVEL_CONFIG } from "../level-config";
import {
  buildCreateBody,
  buildUpdateBody,
  hasSavedCompanyCurrency,
  ORG_CURRENCY_PATTERN,
  type OrgNodeFormValues,
} from "../organization-payloads";
import {
  canManageOrgNode,
  canOpenOrgCreate,
  canSubmitOrgCreate,
} from "../organization-permissions";
import { useOrgLookupResolver } from "./useOrgLookupResolver";
import type { QuickViewTarget } from "./useQuickViewNode";

const ORG_NODE_NOT_EMPTY_CODE = "ORG_NODE_NOT_EMPTY";
const ORG_HQ_TRANSFER_REQUIRED_CODE = "ORG_HQ_TRANSFER_REQUIRED";

export function useOrganizationLevel<L extends OrgLevel>(level: L) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const config = ORG_LEVEL_CONFIG[level];
  const canCreate = canOpenOrgCreate(user, level);

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [serverSearch, setServerSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrgNodeStatus | undefined>(undefined);
  const [hierarchyFilters, setHierarchyFilters] = useState<OrgHierarchyFilters>({});
  const [sort, setSortState] = useState<{ id: OrgNodeSortField; direction: "asc" | "desc" }>({
    id: "name",
    direction: "asc",
  });
  const [rows, setRows] = useState<OrgNodeOf<L>[]>([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, limit: 25, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<NormalizedApiError | null>(null);
  const [editing, setEditing] = useState<OrgNodeOf<L> | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draftDepartmentId, setDraftDepartmentId] = useState("");
  const [quickViewTarget, setQuickViewTarget] = useState<QuickViewTarget | null>(null);

  const [pendingDelete, setPendingDelete] = useState<OrgNodeOf<L> | null>(null);
  const [blockedNode, setBlockedNode] = useState<OrgNodeOf<L> | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [hqTransferBlockedNode, setHqTransferBlockedNode] = useState<OrgNodeOf<L> | null>(null);
  const [hqTransferError, setHqTransferError] = useState<NormalizedApiError | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setServerSearch(searchQuery.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      setQueryError(null);
      fetchOrgNodes(level, {
        page,
        search: serverSearch,
        status: statusFilter,
        ...hierarchyFilters,
        sortBy: sort.id,
        sortDir: sort.direction === "asc" ? "ASC" : "DESC",
        signal: controller.signal,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          const validPage =
            typeof result.totalPages === "number"
              ? Math.max(1, result.totalPages)
              : Math.max(1, Math.ceil(result.total / Math.max(1, result.limit)));
          if (page > validPage) {
            setPage(validPage);
            return;
          }
          setRows(result.items as OrgNodeOf<L>[]);
          setPageInfo({ page: result.page, limit: result.limit, total: result.total });
          setIsLoading(false);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setRows([]);
          setQueryError(normalizeApiError(error));
          setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [level, page, hierarchyFilters, reloadToken, serverSearch, sort, statusFilter]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  useRealtimeResync(reload);

  const lookupTargets = useMemo(() => {
    const records: OrgNodeOf<L>[] = editing ? [...rows, editing] : rows;
    const rowDeptIds = records.flatMap((row) =>
      "departmentId" in row ? [row.departmentId] : [],
    );
    return {
      companyIds: records.flatMap((row) => ("companyId" in row ? [row.companyId] : [])),
      branchIds: records.flatMap((row) => ("branchId" in row ? [row.branchId] : [])),
      departmentIds: draftDepartmentId ? [...rowDeptIds, draftDepartmentId] : rowDeptIds,
      userIds: records.flatMap((row) =>
        "leadUserId" in row && row.leadUserId ? [row.leadUserId] : [],
      ),
    };
  }, [draftDepartmentId, editing, rows]);

  const lookups = useOrgLookupResolver(lookupTargets);

  const canManageRow = useCallback(
    (node: OrgNodeOf<L>) => canManageOrgNode(user, level, node, lookups),
    [level, lookups, user],
  );

  const canSubmitCreate = useCallback(
    (values: OrgNodeFormValues) => canSubmitOrgCreate(user, level, values, lookups),
    [level, lookups, user],
  );

  const runWrite = useCallback(
    async (allowed: boolean, work: () => Promise<void>): Promise<boolean> => {
      if (!allowed) return false;
      setIsSubmitting(true);
      setMutationError(null);
      try {
        await work();
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

  const handleCreate = useCallback(
    (values: OrgNodeFormValues) =>
      runWrite(canSubmitCreate(values), async () => {
        await createOrgNode(level, buildCreateBody(level, values));
        setIsCreateOpen(false);
      }),
    [canSubmitCreate, level, runWrite],
  );

  const handleUpdate = useCallback(
    (values: OrgNodeFormValues) => {
      const target = editing;
      if (!target || !canManageRow(target)) return Promise.resolve(false);
      if ("currencyCode" in target && hasSavedCompanyCurrency(target.currencyCode)) {
        const trimmed = values.currencyCode.trim().toUpperCase();
        if (!ORG_CURRENCY_PATTERN.test(trimmed)) return Promise.resolve(false);
      }
      return runWrite(true, async () => {
        await updateOrgNode(level, target.id, buildUpdateBody(level, values));
        setEditing(null);
      });
    },
    [canManageRow, editing, level, runWrite],
  );

  const handleDelete = useCallback(async () => {
    const target = pendingDelete;
    if (!target || !canManageRow(target)) return;
    setIsSubmitting(true);
    setMutationError(null);
    try {
      await deleteOrgNode(level, target.id);
      setPendingDelete(null);
      reload();
    } catch (error) {
      const normalized = normalizeApiError(error);
      const found = readDeletionBlockers(normalized);
      setPendingDelete(null);
      if (normalized.status === 409 && normalized.code === ORG_HQ_TRANSFER_REQUIRED_CODE) {
        setHqTransferError(normalized);
        setHqTransferBlockedNode(target);
      } else if (
        found.length > 0 ||
        (normalized.status === 409 && normalized.code === ORG_NODE_NOT_EMPTY_CODE)
      ) {
        setBlockers(found);
        setBlockedNode(target);
      } else {
        setMutationError(normalized);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [canManageRow, level, pendingDelete, reload]);

  const setSort = useCallback((next: { id: string; direction: "asc" | "desc" }) => {
    const field = ORG_NODE_SORT_FIELDS.find((allowed) => allowed === next.id);
    if (!field) return;
    setSortState({ id: field, direction: next.direction });
    setPage(1);
  }, []);

  const openQuickView = useCallback(
    (node: OrgNodeOf<L>) => setQuickViewTarget({ kind: "node", level, node }),
    [level],
  );

  return {
    t,
    lang,
    sort,
    setSort,
    config,
    canManage: canCreate,
    canCreate,
    canManageRow,
    canSubmitCreate,
    lookups,
    rows,
    pageInfo,
    isLoading,
    queryError,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    hierarchyFilters,
    setHierarchyFilters,
    page,
    setPage,
    reload,
    isSubmitting,
    mutationError,
    clearMutationError: () => setMutationError(null),
    isCreateOpen,
    openCreate: () => canCreate && setIsCreateOpen(true),
    closeCreate: () => setIsCreateOpen(false),
    setDraftDepartmentId,
    editing,
    startEdit: (node: OrgNodeOf<L>) => canManageRow(node) && setEditing(node),
    cancelEdit: () => setEditing(null),
    quickViewTarget,
    openQuickView,
    closeQuickView: () => setQuickViewTarget(null),
    pendingDelete,
    requestDelete: (node: OrgNodeOf<L>) => canManageRow(node) && setPendingDelete(node),
    cancelDelete: () => setPendingDelete(null),
    blockedNode,
    blockers,
    dismissBlockers: () => setBlockedNode(null),
    hqTransferBlockedNode,
    hqTransferError,
    dismissHqTransfer: () => {
      setHqTransferBlockedNode(null);
      setHqTransferError(null);
    },
    handleCreate,
    handleUpdate,
    handleDelete,
  };
}
