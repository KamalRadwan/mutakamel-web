"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTradeBranchSelection } from "../../../trade-advanced-scope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "../../../trade-api";
import { isUuidV7, parseTradeOffsetPage } from "../../../trade-advanced-validation";
import { useInventoryPagination } from "../../hooks/useInventoryPagination";
import { hasTradePermission, useTradeScope } from "../../../trade-advanced-scope";
import { INVENTORY_READ_PERMISSION, invalidResponse } from "../../inventory-contract";
import {
  parseInventorySerial,
  serialsListPath,
  type InventorySerial,
  type SerialState,
} from "../../inventory-governance-contract";

const LIST_RESPONSE_LIMIT_BYTES = 120_000;

export function useInventorySerials() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTradeBranchSelection(user);
  const scope = useTradeScope("COMPANY", branchId);

  const [items, setItems] = useState<InventorySerial[]>([]);
  const [stateFilter, setStateFilter] = useState<SerialState | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [itemIdFilter, setItemIdFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);

  const canRead = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    INVENTORY_READ_PERMISSION,
  );

  const validItemId = isUuidV7(itemIdFilter.trim()) ? itemIdFilter.trim() : undefined;
  const { page, pagination, setPage, setTotal } = useInventoryPagination(
    JSON.stringify([scope.headers, stateFilter, search.trim(), validItemId]),
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!scope.isResolved) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setQueryError(null);
      try {
        // `serialKey` is an EXACT match filter on the query DTO, not a search:
        // there is no partial-match parameter anywhere on this route.
        const response = await tradeGet(
          serialsListPath(stateFilter, search.trim() || undefined, {
            itemId: validItemId,
          }, page),
          {
            signal,
            headers: scope.headers,
            maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
          },
        );
        if (signal?.aborted) return;
        const result = parseTradeOffsetPage(response.data, parseInventorySerial, invalidResponse);
        setItems(result.items);
        setTotal(result.total);
        setHasLoaded(true);
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [scope.isResolved, scope.headers, stateFilter, search, validItemId, page, setTotal],
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
    isScopeResolved: scope.isResolved,
    branchIds,
    branchId,
    selectBranch,
    items,
    pagination,
    setPage,
    stateFilter,
    search,
    itemIdFilter,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    queryError,
    setStateFilter,
    setSearch,
    setItemIdFilter,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

