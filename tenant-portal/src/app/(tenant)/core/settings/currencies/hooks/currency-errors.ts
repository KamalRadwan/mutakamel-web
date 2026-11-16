import { describeApiOutcome, formatApiErrorMessage } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  CURRENCY_CODE_INVALID_CODE,
  CURRENCY_CODE_TAKEN_CODE,
  CURRENCY_COMPANY_IN_USE_CODE,
  CURRENCY_DECIMAL_PLACES_IMMUTABLE_CODE,
  CURRENCY_DEFAULT_DELETE_CODE,
  CURRENCY_INACTIVE_DEFAULT_CODE,
  CURRENCY_IN_USE_CODE,
  CURRENCY_NOT_FOUND_CODE,
  CURRENCY_PRECISION_MISMATCH_CODE,
  CURRENCY_RATE_REQUIRED_CODE,
  CURRENCY_REBASE_OUT_OF_RANGE_CODE,
  CURRENCY_REBASE_PRECISION_LOSS_CODE,
  INVALID_CURRENCIES_RESPONSE_MESSAGE,
  type Currency,
} from "../currency-contract";

const INVALID_CURRENCIES_RESPONSE_CODE = "INVALID_CURRENCIES_RESPONSE";

/**
 * Preserves contract-validation failures distinctly from status-0 transport
 * failures so an unreadable 200 payload never tells the user they are offline.
 */
export function normalizeCurrencyQueryError(error: unknown): NormalizedApiError {
  const normalized = normalizeApiError(error);
  if (error instanceof Error && error.message === INVALID_CURRENCIES_RESPONSE_MESSAGE) {
    return {
      ...normalized,
      status: 502,
      code: INVALID_CURRENCIES_RESPONSE_CODE,
    };
  }
  return normalized;
}

interface CurrencyQueryErrorCopy {
  title: string;
  description: string | undefined;
  retryable: boolean;
}

/**
 * Turns a list-load failure into localized ErrorState copy without leaking raw
 * server or transport English strings while preserving `correlationId`.
 */
export function describeCurrencyQueryError(
  error: NormalizedApiError,
  t: Dictionary,
): CurrencyQueryErrorCopy {
  const outcome = describeApiOutcome(error, t);
  if (outcome) {
    return {
      title: outcome.title,
      description: formatApiErrorMessage(
        {
          status: error.status,
          message: outcome.description,
          correlationId: error.correlationId,
        },
        t,
      ),
      retryable: outcome.retryable,
    };
  }

  const coreErrors = t.coreIdentity.errors as Record<string, string | undefined>;
  const mappedCodeMessage =
    error.code && error.code !== INVALID_CURRENCIES_RESPONSE_CODE
      ? coreErrors[error.code]
      : undefined;

  const message =
    error.code === "REQUEST_TIMED_OUT"
      ? t.errors.requestTimedOut
      : error.status === 0
        ? t.coreIdentity.errors.OFFLINE
        : mappedCodeMessage ?? t.coreIdentity.errors.UNKNOWN;

  return {
    title: t.coreSettings.currencyLoadFailed,
    description: formatApiErrorMessage(
      {
        status: error.status,
        message,
        correlationId: error.correlationId,
      },
      t,
    ),
    retryable: true,
  };
}

/** One localized message per documented rejection — never raw wire English. */
export function currencyMutationMessage(
  code: string | undefined,
  t: Dictionary,
): string | undefined {
  switch (code) {
    case CURRENCY_DECIMAL_PLACES_IMMUTABLE_CODE:
      return t.coreSettings.currencyDecimalPlacesImmutable;
    case CURRENCY_PRECISION_MISMATCH_CODE:
      return t.coreSettings.currencyPrecisionMismatch;
    case CURRENCY_REBASE_OUT_OF_RANGE_CODE:
      return t.coreSettings.currencyRebaseOutOfRange;
    case CURRENCY_REBASE_PRECISION_LOSS_CODE:
      return t.coreSettings.currencyRebasePrecisionLoss;
    case CURRENCY_NOT_FOUND_CODE:
      return t.coreSettings.currencyNotFound;
    case CURRENCY_CODE_TAKEN_CODE:
      return t.coreSettings.currencyCodeTaken;
    case CURRENCY_CODE_INVALID_CODE:
      return t.coreSettings.currencyCodeInvalid;
    case CURRENCY_RATE_REQUIRED_CODE:
      return t.coreSettings.currencyRateRequired;
    case CURRENCY_DEFAULT_DELETE_CODE:
      return t.coreSettings.currencyDefaultProtected;
    case CURRENCY_IN_USE_CODE:
      return t.coreSettings.currencyInUse;
    case CURRENCY_COMPANY_IN_USE_CODE:
      return t.coreSettings.currencyCompanyInUse;
    case CURRENCY_INACTIVE_DEFAULT_CODE:
      return t.coreSettings.currencyInactiveDefault;
    case "REQUEST_TIMED_OUT":
      return t.errors.writeTimedOut;
    default: {
      if (!code) return undefined;
      const coreErrors = t.coreIdentity.errors as Record<string, string | undefined>;
      return coreErrors[code];
    }
  }
}

export function currencyMutationFallbackError(
  error: NormalizedApiError,
  t: Dictionary,
): NormalizedApiError {
  return {
    ...error,
    message: error.status === 0 ? t.coreIdentity.errors.OFFLINE : t.coreIdentity.errors.UNKNOWN,
  };
}

export function currencyFormMessage(
  error: unknown,
  t: Dictionary,
  mode: "create" | "update",
): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "CURRENCY_FORM_CODE") return t.coreSettings.currencyFormCode;
  if (reason === "CURRENCY_FORM_NAME") return t.coreSettings.currencyFormName;
  if (reason === "CURRENCY_FORM_SYMBOL") return t.coreSettings.currencyFormSymbol;
  if (reason === "CURRENCY_FORM_RATE") return t.coreSettings.currencyFormRate;
  if (reason === "CURRENCY_FORM_DECIMALS") return t.coreSettings.currencyFormDecimals;
  return mode === "update"
    ? t.coreSettings.currencyUpdateFailed
    : t.coreSettings.currencyCreateFailed;
}

export type CurrencyBlockerKind = "deactivate" | "setDefault" | "reactivate";

export interface CurrencyActionBlocker {
  kind: CurrencyBlockerKind;
  currency: Currency;
  code: string;
  reason: string;
}

const DEACTIVATE_BLOCKER_CODES = new Set<string>([
  CURRENCY_DEFAULT_DELETE_CODE,
  CURRENCY_IN_USE_CODE,
  CURRENCY_COMPANY_IN_USE_CODE,
  CURRENCY_NOT_FOUND_CODE,
]);

const SET_DEFAULT_BLOCKER_CODES = new Set<string>([
  CURRENCY_INACTIVE_DEFAULT_CODE,
  CURRENCY_RATE_REQUIRED_CODE,
  CURRENCY_REBASE_OUT_OF_RANGE_CODE,
  CURRENCY_REBASE_PRECISION_LOSS_CODE,
  CURRENCY_NOT_FOUND_CODE,
]);

const REACTIVATE_BLOCKER_CODES = new Set<string>([
  CURRENCY_RATE_REQUIRED_CODE,
  CURRENCY_NOT_FOUND_CODE,
]);

function formatSafeMessage(
  status: number,
  message: string,
  correlationId: string | undefined,
  t: Dictionary,
): string {
  return formatApiErrorMessage({ status, message, correlationId }, t) ?? message;
}

/**
 * Maps documented domain refusals on row actions into centered blocker modal
 * state carrying the affected row and safe localized guidance (never raw wire text).
 */
export function resolveCurrencyActionBlocker(
  error: NormalizedApiError,
  kind: CurrencyBlockerKind,
  currency: Currency,
  t: Dictionary,
): CurrencyActionBlocker | null {
  const code = error.code;
  if (!code) return null;
  const allowed =
    kind === "deactivate"
      ? DEACTIVATE_BLOCKER_CODES
      : kind === "setDefault"
        ? SET_DEFAULT_BLOCKER_CODES
        : REACTIVATE_BLOCKER_CODES;
  if (!allowed.has(code)) return null;

  const localized = currencyMutationMessage(code, t);
  if (!localized) return null;
  return {
    kind,
    currency,
    code,
    reason: formatSafeMessage(error.status, localized, error.correlationId, t),
  };
}

/**
 * Normalizes both synchronous client form validation errors and server/contract
 * rejections into safe localized form text plus structured `errorCode` for T01's
 * inline field error resolver.
 */
export function resolveCurrencyFormFailure(
  error: unknown,
  t: Dictionary,
  mode: "create" | "update",
): { message: string; code: string | null } {
  if (error instanceof Error && /^CURRENCY_FORM_[A-Z_]+$/u.test(error.message)) {
    return { message: currencyFormMessage(error, t, mode), code: error.message };
  }

  const normalized = normalizeCurrencyQueryError(error);
  const outcome = describeApiOutcome(normalized, t);
  if (outcome) {
    const fallbackMessage =
      outcome.description ?? outcome.title ?? t.coreIdentity.errors.UNKNOWN;
    return {
      message: formatSafeMessage(
        normalized.status,
        fallbackMessage,
        normalized.correlationId,
        t,
      ),
      code: normalized.code ?? null,
    };
  }

  if (normalized.status === 403) {
    return {
      message: formatSafeMessage(
        403,
        t.permissionGate.description,
        normalized.correlationId,
        t,
      ),
      code: normalized.code ?? "FORBIDDEN",
    };
  }

  const specific = currencyMutationMessage(normalized.code, t);
  if (specific) {
    return {
      message: formatSafeMessage(normalized.status, specific, normalized.correlationId, t),
      code: normalized.code ?? null,
    };
  }

  const fallback = currencyMutationFallbackError(normalized, t);
  return {
    message: formatSafeMessage(
      fallback.status,
      fallback.message ?? t.coreIdentity.errors.UNKNOWN,
      fallback.correlationId,
      t,
    ),
    code: normalized.code ?? null,
  };
}
