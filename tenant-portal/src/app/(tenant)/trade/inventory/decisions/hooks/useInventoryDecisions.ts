"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "../../../trade-api";
import { parseTradeArray } from "../../../trade-advanced-validation";
import { hasTradePermission, useTradeScope } from "../../../trade-advanced-scope";
import { INVENTORY_READ_PERMISSION, invalidResponse } from "../../inventory-contract";
import {
  inventoryDecisionsListPath,
  parseInventoryDecision,
  type InventoryDecision,
  type InventoryPolicyKind,
} from "../../inventory-governance-contract";

const LIST_RESPONSE_LIMIT_BYTES = 200_000;

/**
 * `GET /inventory/decisions` is the only decision **list** in Trade.
 * `GET /decisions/:id` on Policy Studio is by id only, so a receipt outside
 * inventory can be reached only from a response that already carries its id.
 */
export function useInventoryDecisions() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const scope = useTradeScope("COMPANY", branchId);

  const [items, setItems] = useState<InventoryDecision[]>([]);
  const [policyKind, setPolicyKind] = useState<InventoryPolicyKind | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);

  const canRead = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    INVENTORY_READ_PERMISSION,
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
        const response = await tradeGet(inventoryDecisionsListPath(policyKind), {
          signal,
          headers: scope.headers,
          maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
        });
        setItems(parseTradeArray(response.data, parseInventoryDecision, invalidResponse));
        setHasLoaded(true);
      } catch (error) {
        if (isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [scope.isResolved, scope.headers, policyKind],
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
    policyKind,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    queryError,
    setPolicyKind,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
