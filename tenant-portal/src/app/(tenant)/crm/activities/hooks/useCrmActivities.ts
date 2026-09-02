"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import {
  SCOPE_UNRESOLVED_ERROR,
  useOrganizationScopeHeaders,
} from "@/hooks/useOrganizationScope";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  ACTIVITIES_PATH,
  buildListQuery,
  parseActivitiesPage,
  type CrmActivity,
  type CrmActivityType,
} from "../activity-contract";

const PAGE_SIZE = 25;
const READ_CONFIG = { cache: "no-store", maxResponseBytes: 1_000_000 } as const;

export interface ActivityFilters {
  type: CrmActivityType | "";
  sourceType: string;
  sourceId: string;
  search: string;
}

const EMPTY_FILTERS: ActivityFilters = {
  type: "",
  sourceType: "",
  sourceId: "",
  search: "",
};

/**
 * `GET /activities` — the CRM activity log (task 8.20).
 *
 * Read-only by design. `POST /activities` requires a `sourceType`/`sourceId`
 * pair identifying the record being logged against, so logging an activity
 * belongs on that record's own screen, not on a cross-record log.
 */
export function useCrmActivities() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const scope = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const [items, setItems] = useState<CrmActivity[]>([]);
  const [pageInfo, setPageInfo] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
  });
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ActivityFilters>(EMPTY_FILTERS);
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Both or neither: listActivities answers 422 CRM_SOURCE_INVALID when only
  // one half of the source filter is present.
  const sourceFilter = useMemo(() => {
    const next: Record<string, string> = {};
    if (filters.sourceType && filters.sourceId) {
      next.sourceType = filters.sourceType;
      next.sourceId = filters.sourceId;
    }
    return next;
  }, [filters.sourceId, filters.sourceType]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!branchId || !scope.ready) {
        setItems([]);
        setHasLoaded(false);
        // D4: an unresolved organization scope is a gap on THIS side. Sending
        // the request without the headers made the Gateway answer 400 and the
        // screen report a server rejection for a client-side condition.
        setQueryError(branchId && !scope.ready ? SCOPE_UNRESOLVED_ERROR : null);
        return;
      }
      setIsLoading(true);
      setQueryError(null);
      try {
        const query = buildListQuery(branchId, page, PAGE_SIZE, {
          ...sourceFilter,
          type: filters.type,
          search: filters.search.trim(),
        });
        const response = await axiosClient.get<unknown>(
          `${ACTIVITIES_PATH}?${query}`,
          { ...READ_CONFIG, signal, headers: scope.headers },
        );
        const parsed = parseActivitiesPage(response.data);
        setItems(parsed.items);
        setPageInfo({
          page: parsed.page,
          limit: parsed.limit,
          total: parsed.total,
        });
        setHasLoaded(true);
      } catch (error) {
        if (isAbortError(error)) return;
        setItems([]);
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [branchId, filters.search, filters.type, page, scope, sourceFilter],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  return {
    t,
    lang,
    items,
    pageInfo,
    hasLoaded,
    isLoading,
    queryError,
    branchIds,
    branchId,
    selectBranch: (next: string) => {
      selectBranch(next);
      setPage(1);
    },
    filters,
    setFilter: <K extends keyof ActivityFilters>(
      key: K,
      value: ActivityFilters[K],
    ) => {
      setPage(1);
      setFilters((current) => ({ ...current, [key]: value }));
    },
    resetFilters: () => {
      setPage(1);
      setFilters(EMPTY_FILTERS);
    },
    setPage,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
