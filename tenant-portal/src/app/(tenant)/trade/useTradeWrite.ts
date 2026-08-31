"use client";

import { useCallback } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isTradeReplay, type TradeResult } from "./trade-api";
import {
  isTradeEntitlementRefusal,
  TRADE_CONCURRENCY_CODES,
  TRADE_CONTEXT_CODES,
  TRADE_ENTITLEMENT_CODES,
  TRADE_TARGET_DENIED_CODE,
} from "./trade-scope";

// One write path for every Trade screen. It exists because four of Trade's
// rules differ from Core's and each is easy to get wrong once per screen:
//
//   * `Idempotency-Replayed` is set by Trade itself with `"false"` on first
//     execution, so a replay must be recognised by value and rendered as
//     SUCCESS — never as a duplicate-key error;
//   * the transport already raises a toast for a 403, so a second one here
//     double-fires (docs/design/patterns.md#where-a-result-belongs);
//   * the rate-limit and idempotency outcomes each need their own sentence,
//     which `toast.outcomeFromApi` already owns;
//   * every scope, entitlement and concurrency refusal shares one vocabulary
//     across all five foundation screens.

export interface TradeWriteOutcome {
  ok: boolean;
  /** The write ran **once** and this is its stored result. Not a failure. */
  replayed: boolean;
  error: NormalizedApiError | null;
}

export interface TradeWriteOptions {
  failureTitle: string;
  /** A screen-specific sentence for a documented rejection code. */
  describe?: (error: NormalizedApiError) => string | undefined;
  /** The caller renders this refusal itself — a 409 that opens `ConflictDialog`. */
  isHandled?: (error: NormalizedApiError) => boolean;
}

type Dictionary = ReturnType<typeof useI18n>["t"];

/**
 * The refusals every Trade screen can hit, in one vocabulary.
 *
 * `TRADE.AUTH.TARGET_DENIED` is the interesting one: unlike Core's 403 it
 * carries **no `details.permissions`**, so the body never says which grant was
 * missing, and `TradePermissionsGuard` matches `scope_target` exactly — a
 * tenant-scoped grant does not satisfy a branch-scoped route. The message
 * therefore names the scope, which is the part the user can change.
 */
function tradeSharedMessage(
  error: NormalizedApiError,
  t: Dictionary,
): string | undefined {
  const code = error.code;
  if (isTradeEntitlementRefusal(code)) {
    if (code === TRADE_ENTITLEMENT_CODES.moduleDisabled) return t.trade.entitlement_moduleDisabled;
    if (code === TRADE_ENTITLEMENT_CODES.featureRequired) return t.trade.entitlement_featureRequired;
    return t.trade.entitlement_maintenanceActive;
  }
  if (code === TRADE_ENTITLEMENT_CODES.entitlementUnavailable) {
    return t.trade.entitlement_unavailable;
  }
  if (code === TRADE_TARGET_DENIED_CODE) return t.trade.errorTargetDenied;
  if (code === TRADE_CONTEXT_CODES.missingCompany) return t.trade.errorMissingCompany;
  if (code === TRADE_CONTEXT_CODES.missingBranch) return t.trade.errorMissingBranch;
  if (code === TRADE_CONTEXT_CODES.invalidId) return t.trade.errorInvalidScopeId;
  if (code === TRADE_CONTEXT_CODES.branchCompanyMismatch) return t.trade.errorBranchMismatch;
  if (code === TRADE_CONTEXT_CODES.scopeInactive) return t.trade.errorScopeInactive;
  if (code === TRADE_CONTEXT_CODES.executionTargetMismatch) return t.trade.errorChannelMismatch;
  if (code === TRADE_CONCURRENCY_CODES.ifMatchRequired) return t.trade.errorIfMatchRequired;
  if (code === TRADE_CONCURRENCY_CODES.staleVersion) return t.trade.errorStaleVersion;
  // `TRADE.IDEMPOTENCY.KEY_REQUIRED` is 400 at the controller and 422 inside
  // the domain service — the same code at two statuses, so this branches on
  // neither and says the one true thing about both.
  if (code === "TRADE.IDEMPOTENCY.KEY_REQUIRED") return t.trade.errorIdempotencyKey;
  if (code === "TRADE.IDEMPOTENCY.MISMATCH") return t.trade.errorIdempotencyMismatch;
  if (code === "TRADE.IDEMPOTENCY.IN_FLIGHT") return t.trade.errorIdempotencyInFlight;
  if (code === "TRADE.VALIDATION_FAILED") return t.trade.errorValidationFailed;
  return undefined;
}

export function useTradeWrite() {
  const toast = useToast();
  const { t } = useI18n();

  return useCallback(
    async (
      run: () => Promise<TradeResult>,
      { failureTitle, describe, isHandled }: TradeWriteOptions,
    ): Promise<TradeWriteOutcome> => {
      try {
        const result = await run();
        return { ok: true, replayed: isTradeReplay(result.headers), error: null };
      } catch (thrown) {
        const error = normalizeApiError(thrown);
        if (isHandled?.(error)) return { ok: false, replayed: false, error };
        // The transport toasts a 403 itself; a second here double-fires.
        if (error.status === 403) {
          const specific = tradeSharedMessage(error, t);
          if (specific && error.code !== TRADE_TARGET_DENIED_CODE) {
            toast.error(failureTitle, specific);
          }
          return { ok: false, replayed: false, error };
        }
        if (toast.outcomeFromApi(error)) return { ok: false, replayed: false, error };
        const message = describe?.(error) ?? tradeSharedMessage(error, t);
        if (message) toast.error(failureTitle, message);
        else toast.errorFromApi(failureTitle, error);
        return { ok: false, replayed: false, error };
      }
    },
    [toast, t],
  );
}
