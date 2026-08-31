"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "../../../trade-api";
import { hasTradePermission, useTradeScope } from "../../../trade-advanced-scope";
import {
  POLICY_READ_PERMISSION,
  decisionPath,
  parseDecisionReceipt,
  type DecisionReceipt,
} from "../../../policies/governance-contract";

const RECEIPT_RESPONSE_LIMIT_BYTES = 200_000;

/**
 * A decision receipt, by id only.
 *
 * There is **no list** for `/decisions` — the portal must already hold the id
 * from another response, which in practice means a pricing evaluation's
 * `decisionId`. `GET /inventory/decisions` is a separate, inventory-only list.
 *
 * The receipt is scope-pinned: `getDecision` compares `scopeTarget`,
 * `companyId` and `branchId` against the request context and answers **404**
 * when any differs, so a receipt read under the wrong branch reads as missing
 * rather than as forbidden.
 */
export function useDecisionReceipt(id: string) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const { branchId } = useTenantBranchSelection(user);
  const scope = useTradeScope("BRANCH", branchId);

  const [receipt, setReceipt] = useState<DecisionReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);

  const canRead = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    POLICY_READ_PERMISSION,
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const response = await tradeGet(decisionPath(id), {
          signal,
          headers: scope.headers,
          maxResponseBytes: RECEIPT_RESPONSE_LIMIT_BYTES,
        });
        setReceipt(parseDecisionReceipt(response.data));
      } catch (error) {
        if (isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [id, scope.headers],
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
    receipt,
    isLoading,
    queryError,
    isNotFound: queryError?.status === 404,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
