"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "../../../../trade-api";
import { hasTradePermission, useTradeScope } from "../../../../trade-advanced-scope";
import { INVENTORY_READ_PERMISSION } from "../../../inventory-contract";
import {
  inventoryDecisionPath,
  parseInventoryDecision,
  type InventoryDecision,
} from "../../../inventory-governance-contract";

const DECISION_RESPONSE_LIMIT_BYTES = 60_000;

export function useInventoryDecision(id: string) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const { branchId } = useTenantBranchSelection(user);
  const scope = useTradeScope("COMPANY", branchId);

  const [decision, setDecision] = useState<InventoryDecision | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
        const response = await tradeGet(inventoryDecisionPath(id), {
          signal,
          headers: scope.headers,
          maxResponseBytes: DECISION_RESPONSE_LIMIT_BYTES,
        });
        setDecision(parseInventoryDecision(response.data));
      } catch (error) {
        if (isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [id, scope.isResolved, scope.headers],
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
    decision,
    isLoading,
    queryError,
    isNotFound: queryError?.status === 404,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
