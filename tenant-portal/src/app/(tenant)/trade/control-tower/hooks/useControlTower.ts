"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "../../trade-api";
import { hasTradePermission, useTradeScope } from "../../trade-advanced-scope";
import {
  CONTROL_TOWER_PAGE_SIZE,
  CONTROL_TOWER_READ_PERMISSION,
  controlTowerListPath,
  parseControlTowerExceptionsResponse,
  type ControlTowerException,
  type ExceptionSeverityFilter,
  type ExceptionStatus,
} from "../control-tower-contract";

const LIST_RESPONSE_LIMIT_BYTES = 600_000;

export function useControlTower() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const scope = useTradeScope("BRANCH", branchId);

  const [items, setItems] = useState<ControlTowerException[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ExceptionStatus | undefined>(undefined);
  const [severity, setSeverity] = useState<ExceptionSeverityFilter | undefined>(undefined);
  const [category, setCategory] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);

  const canRead = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    CONTROL_TOWER_READ_PERMISSION,
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const response = await tradeGet(
          controlTowerListPath(page, status, severity, category.trim() || undefined),
          {
            signal,
            headers: scope.headers,
            maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
          },
        );
        const parsed = parseControlTowerExceptionsResponse(response.data);
        setItems(parsed.items);
        setTotal(parsed.total);
        setHasLoaded(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [page, status, severity, category, scope.headers],
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
    canRead,
    branchIds,
    branchId,
    selectBranch,
    items,
    pageInfo: { page, limit: CONTROL_TOWER_PAGE_SIZE, total },
    status,
    severity,
    category,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    queryError,
    /**
     * A 403 here is an entitlement refusal as often as a permission one: the
     * controller needs `trade.analytics` AND one of seven domain features, so
     * a tenant with analytics alone is still refused.
     */
    isEntitlementRefusal: queryError?.status === 403,
    setPage,
    setStatus: (next: ExceptionStatus | undefined) => {
      setPage(1);
      setStatus(next);
    },
    setSeverity: (next: ExceptionSeverityFilter | undefined) => {
      setPage(1);
      setSeverity(next);
    },
    setCategory: (next: string) => {
      setPage(1);
      setCategory(next);
    },
    reload: () => load(),
  };
}
