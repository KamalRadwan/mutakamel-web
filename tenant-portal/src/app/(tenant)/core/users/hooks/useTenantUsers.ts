"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRealtimeResync, type PageInfo, type SortState } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { can } from "@/lib/auth/permission-scope";
import type { CorePageMeta } from "../../contracts/core-page";
import {
  fetchTenantUsers,
  TENANT_USER_SORT_FIELDS,
  type TenantUser,
  type TenantUserFilters,
  type UserStatus,
} from "../../contracts/user-contract";
import {
  allowedUserActions,
  canInviteWithPlacement,
  canOpenUserInvite,
} from "../user-permissions";
import { useUserListMutations } from "./useUserListMutations";

const INITIAL_META: CorePageMeta = {
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
};

export function useTenantUsers() {
  const { t } = useI18n();
  const { user: actor } = useTenantAuth();
  const canRead = can(actor, "users.user.read");
  const canInvite = canOpenUserInvite(actor);
  const canInvitePlacement = canInviteWithPlacement(actor);
  const canReadBilling = can(actor, "tenant.billing.read");

  const [rows, setRows] = useState<TenantUser[]>([]);
  const [meta, setMeta] = useState<CorePageMeta>(INITIAL_META);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [searchQuery, setSearchQueryState] = useState("");
  const [filters, setFiltersState] = useState<TenantUserFilters>({});
  const [sort, setSortState] = useState<SortState>({
    id: "createdAt",
    direction: "desc",
  });
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  useRealtimeResync(reload);

  useEffect(() => {
    const controller = new AbortController();
    let recoveringPage = false;
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!canRead) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setQueryError(null);
      const sortBy = TENANT_USER_SORT_FIELDS.find((field) => field === sort.id);
      const sortDir = sort.direction === "asc" ? "ASC" : "DESC";
      fetchTenantUsers({
        page,
        search: searchQuery,
        filters,
        sortBy,
        sortDir,
        signal: controller.signal,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          const validMaxPage = Math.max(1, result.totalPages);
          if (page > validMaxPage) {
            recoveringPage = true;
            setPage(validMaxPage);
            return;
          }
          const { items, ...pageMeta } = result;
          setRows(items);
          setMeta(pageMeta);
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          setRows([]);
          setQueryError(normalizeApiError(cause));
        })
        .finally(() => {
          if (!controller.signal.aborted && !recoveringPage) {
            setIsLoading(false);
          }
        });
    });
    return () => controller.abort();
  }, [canRead, filters, page, reloadToken, searchQuery, sort]);

  const setSearchQuery = useCallback((value: string) => {
    setSearchQueryState(value);
    setPage(1);
  }, []);

  const setFilters = useCallback((next: TenantUserFilters) => {
    setFiltersState(next);
    setPage(1);
  }, []);

  const setStatusFilter = useCallback((value: UserStatus | undefined) => {
    setFiltersState((current) => ({ ...current, status: value }));
    setPage(1);
  }, []);

  const setSort = useCallback((next: SortState) => {
    setSortState(next);
    setPage(1);
  }, []);

  const mutations = useUserListMutations({ actor, rows, setRows, reload });

  const resolveActions = useCallback(
    (target: TenantUser) => allowedUserActions(target, actor),
    [actor],
  );

  const pageInfo = useMemo<PageInfo>(
    () => ({ page: meta.page, limit: meta.limit, total: meta.total }),
    [meta.limit, meta.page, meta.total],
  );

  return {
    t,
    rows,
    pageInfo,
    isLoading,
    queryError,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    statusFilter: filters.status,
    setStatusFilter,
    sort,
    setSort,
    setPage,
    reload,
    canInvite,
    canInvitePlacement,
    canReadBilling,
    resolveActions,
    ...mutations,
  };
}
