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
  switch (code) {
    case "TRADE.AUTH.CONTEXT_REQUIRED": return t.trade.errorRequestContextRequired;
    case "TRADE.AUTH.TARGET_INVALID": return t.tradeCommon.errorTargetDenied;
    case "TRADE.CONTEXT.EXECUTION_TARGET_INVALID": return t.trade.errorChannelMismatch;
    case "TRADE.CONTEXT.COMPANY_REQUIRED": return t.trade.errorMissingCompany;
    case "TRADE.CATALOG.CHANNEL_NOT_FOUND":
    case "TRADE.CATALOG.CHANNEL_BRANCH_NOT_FOUND":
    case "TRADE.CATALOG.CHANNEL_BRANCH_ALREADY_EXISTS": return t.trade.channelInvalid;
    case "TRADE.CATALOG.COMPANY_PROFILE_NOT_FOUND": return t.trade.companyProfileInvalid;
    case "TRADE.CATALOG.BRANCH_PROFILE_NOT_FOUND": return t.trade.branchMismatch;
    case "TRADE.CATALOG.CHANNEL_LISTING_NOT_FOUND": return t.trade.listingInvalid;
    case "TRADE.CATALOG.ITEM_IDENTITY_CONFLICT":
    case "TRADE.CATALOG.ITEM_REFERENCE_INVALID": return t.trade.itemIdentityInvalid;
  }
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
  if (code === "TRADE.IDEMPOTENCY.KEY_REQUIRED" || code === "TRADE.IDEMPOTENCY.KEY_MISSING") return t.trade.errorIdempotencyKey;
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
