"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "./trade-api";
import { isTradeEntitlementRefusal, TRADE_ENTITLEMENT_CODES } from "./trade-scope";
import { useTradeScopeRequest } from "./useTradeScope";

// Whether this tenant is entitled to Trade at all.
//
// **Trade publishes no entitlement endpoint**, so this is a probe, not a
// lookup: `TradeSubscriptionGuard` runs on all 231 routes and refuses before
// the scope and permission guards, so the cheapest catalogue read answers the
// question for the whole module. The three refusal codes it can return are
// string literals inside that guard and are absent from `TRADE_ERROR_CODES`
// (docs/api/trade-foundation.md#codes-the-catalogue-does-not-contain), which is
// why they are named in `trade-scope.ts` rather than derived.
//
// It lives at the route-group root, beside `trade-api.ts`, because every Trade
// screen needs the same answer and there is no `hooks/` directory at this
// level to put it in.

const PROBE_PATH = "/api/tenant/trade/v1/items?page=1&limit=1" as const;
const PROBE_RESPONSE_LIMIT_BYTES = 40_000;

type TradeEntitlementStatus =
  | "checking"
  /** Trade answered. The module is provisioned and the feature is entitled. */
  | "entitled"
  /** 403 from `TradeSubscriptionGuard` — the tenant, not the actor. */
  | "unentitled"
  /** 403 `TRADE.AUTH.TARGET_DENIED` — the actor's grants, at this scope. */
  | "forbidden"
  /** Anything else, including the 503 the entitlement lookup itself raises. */
  | "failed";

export interface TradeEntitlement {
  status: TradeEntitlementStatus;
  /** The refusal code, so the screen can say which of the three it was. */
  code: string | null;
  error: NormalizedApiError | null;
  reload: () => void;
}

export function useTradeEntitlement(): TradeEntitlement {
  // Sent with the operating context rather than bare: the probe would
  // otherwise resolve to the TENANT target and a company-scoped grant would
  // read as a permission refusal on a tenant that is perfectly well entitled.
  const { headers } = useTradeScopeRequest("OPERATING_CONTEXT");
  const [status, setStatus] = useState<TradeEntitlementStatus>("checking");
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    // Deferred so the reset below is not a synchronous setState in an effect
    // body (`react-hooks/set-state-in-effect`).
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setStatus("checking");
      setCode(null);
      setError(null);
      void tradeGet(PROBE_PATH, {
        signal: controller.signal,
        headers,
        maxResponseBytes: PROBE_RESPONSE_LIMIT_BYTES,
      })
        .then(() => {
          if (!controller.signal.aborted) setStatus("entitled");
        })
        .catch((thrown: unknown) => {
          if (controller.signal.aborted) return;
          const normalized = normalizeApiError(thrown);
          setError(normalized);
          setCode(normalized.code ?? null);
          if (isTradeEntitlementRefusal(normalized.code)) {
            setStatus("unentitled");
            return;
          }
          if (normalized.status === 403) {
            setStatus("forbidden");
            return;
          }
          setStatus("failed");
        });
    });
    return () => controller.abort();
  }, [headers, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  return { status, code, error, reload };
}

/** The dictionary key for a refusal, so the reason is named rather than generic. */
export function tradeEntitlementReasonKey(
  code: string | null,
): "moduleDisabled" | "featureRequired" | "maintenanceActive" | "unknown" {
  if (code === TRADE_ENTITLEMENT_CODES.moduleDisabled) return "moduleDisabled";
  if (code === TRADE_ENTITLEMENT_CODES.featureRequired) return "featureRequired";
  if (code === TRADE_ENTITLEMENT_CODES.maintenanceActive) return "maintenanceActive";
  return "unknown";
}
