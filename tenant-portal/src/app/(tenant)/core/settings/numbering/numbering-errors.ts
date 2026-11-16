import { describeApiOutcome, formatApiErrorMessage } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { formatTemplate } from "@/lib/format/template";
import { companyLabel, type CompanyOption } from "../company-options";
import { NumberingResponseValidationError } from "./numbering-api";
import {
  COMPANY_INVALID_CODE,
  SEQUENCE_CODE_TAKEN_CODE,
  SEQUENCE_NOT_FOUND_CODE,
  SEQUENCE_VALUE_INVALID_CODE,
  type NumberingSequence,
} from "./numbering-contract";
import {
  numberingFormMessage,
  type NumberingFieldErrors,
} from "./numbering-form-validation";

export type NumberingQueryError =
  | { readonly kind: "invalidResponse" }
  | { readonly kind: "api"; readonly error: NormalizedApiError };

interface NumberingQueryFailureCopy {
  readonly title: string;
  readonly description: string;
  readonly retryable: boolean;
}

export interface ResolvedNumberingWriteError {
  readonly bannerError: string | null;
  readonly fieldErrors: NumberingFieldErrors;
  readonly notFound: boolean;
}

/**
 * Separates client contract/envelope validation failures from status-0 network
 * drops without attaching synthetic codes to `NormalizedApiError`.
 */
export function classifyNumberingQueryError(error: unknown): NumberingQueryError {
  if (error instanceof NumberingResponseValidationError) {
    return { kind: "invalidResponse" };
  }
  const normalized = normalizeApiError(error);
  if (normalized.code === "API_RESPONSE_TOO_LARGE") {
    return { kind: "invalidResponse" };
  }
  return { kind: "api", error: normalized };
}

export function isNumberingQueryNotFound(failure: NumberingQueryError | null): boolean {
  return (
    failure?.kind === "api" &&
    (failure.error.status === 404 || failure.error.code === SEQUENCE_NOT_FOUND_CODE)
  );
}

/**
 * Produces localized `ErrorState` copy for list-load failures without exposing
 * raw server/transport messages while preserving `correlationId` when present.
 */
export function describeNumberingQueryError(
  failure: NumberingQueryError,
  t: Dictionary,
): NumberingQueryFailureCopy {
  if (failure.kind === "invalidResponse") {
    return {
      title: t.coreSettings.numberingLoadFailed,
      description: t.coreSettings.invalidResponseDescription,
      retryable: true,
    };
  }

  const { error } = failure;
  if (error.status === 404 || error.code === SEQUENCE_NOT_FOUND_CODE) {
    return {
      title: t.editDrawer.notFoundTitle,
      description: withCorrelation(t.coreIdentity.errors.NOT_FOUND, error, t),
      retryable: false,
    };
  }

  const outcome = describeApiOutcome(error, t);
  if (outcome) {
    return {
      title: outcome.title,
      description: withCorrelation(outcome.description, error, t),
      retryable: outcome.retryable,
    };
  }

  const baseMessage = isTimeoutError(error)
    ? t.errors.requestTimedOut
    : error.status === 0
      ? t.coreIdentity.errors.OFFLINE
      : coreIdentityError(error.code, t) ?? t.coreIdentity.errors.UNKNOWN;

  return {
    title: t.coreSettings.numberingLoadFailed,
    description: withCorrelation(baseMessage, error, t),
    retryable: true,
  };
}

export function formatNumberingCompanyOptionsFailure(
  error: NormalizedApiError,
  t: Dictionary,
): NumberingQueryFailureCopy {
  if (error.status === 403) {
    const denied = coreIdentityError(error.code, t) ?? t.errors.accessDeniedMessage;
    return {
      title: t.coreSettings.companyOptionsLoadFailed,
      description: withCorrelation(denied, error, t),
      retryable: false,
    };
  }
  const outcome = describeApiOutcome(error, t);
  if (outcome) {
    return {
      title: t.coreSettings.companyOptionsLoadFailed,
      description: withCorrelation(outcome.description, error, t),
      retryable: outcome.retryable,
    };
  }
  return {
    title: t.coreSettings.companyOptionsLoadFailed,
    description: withCorrelation(t.coreSettings.companyOptionsLoadFailedDescription, error, t),
    retryable: true,
  };
}

export function resolveNumberingWriteError(options: {
  readonly mode: "create" | "edit";
  readonly error: unknown;
  readonly scopeCompanyId: string | null;
  readonly current?: NumberingSequence;
  readonly companies: readonly CompanyOption[];
  readonly t: Dictionary;
}): ResolvedNumberingWriteError {
  const { mode, error, scopeCompanyId, current, companies, t } = options;
  const clientField = resolveClientBuilderError(mode, error, t, current);
  if (clientField) return clientField;

  if (error instanceof NumberingResponseValidationError) {
    return { bannerError: t.coreSettings.invalidResponseDescription, fieldErrors: {}, notFound: false };
  }

  const normalized = normalizeApiError(error);
  if (normalized.code === "API_RESPONSE_TOO_LARGE") {
    return {
      bannerError: withCorrelation(t.coreSettings.invalidResponseDescription, normalized, t),
      fieldErrors: {},
      notFound: false,
    };
  }
  if (normalized.code === SEQUENCE_NOT_FOUND_CODE || normalized.status === 404) {
    return mode === "edit"
      ? { bannerError: null, fieldErrors: {}, notFound: true }
      : { bannerError: withCorrelation(t.coreIdentity.errors.NOT_FOUND, normalized, t), fieldErrors: {}, notFound: false };
  }
  if (normalized.status === 403) {
    const denied = coreIdentityError(normalized.code, t) ?? t.errors.accessDeniedMessage;
    return { bannerError: withCorrelation(denied, normalized, t), fieldErrors: {}, notFound: false };
  }
  const outcome = describeApiOutcome(normalized, t);
  if (outcome) {
    return {
      bannerError: withCorrelation(outcome.description, normalized, t),
      fieldErrors: {},
      notFound: false,
    };
  }
  if (normalized.code === SEQUENCE_CODE_TAKEN_CODE) {
    if (mode === "create") {
      const company = companyLabel(
        companies,
        scopeCompanyId,
        t.coreSettings.numberingTenantWide,
        t.coreSettings.unknownCompany,
      );
      return {
        bannerError: null,
        fieldErrors: { code: formatTemplate(t.coreSettings.numberingCodeTaken, { company }) },
        notFound: false,
      };
    }
    // Locked edit form: code cannot be changed, so a conflict stays a concise general banner.
    return {
      bannerError: withCorrelation(t.coreIdentity.errors.CONFLICT, normalized, t),
      fieldErrors: {},
      notFound: false,
    };
  }
  if (normalized.code === COMPANY_INVALID_CODE) {
    return mode === "create"
      ? { bannerError: null, fieldErrors: { companyId: t.coreSettings.numberingCompanyInvalid }, notFound: false }
      : {
          bannerError: withCorrelation(t.coreSettings.numberingCompanyInvalid, normalized, t),
          fieldErrors: {},
          notFound: false,
        };
  }
  if (normalized.code === SEQUENCE_VALUE_INVALID_CODE) {
    // Server locks the latest row and returns no new counter bound; never claim the
    // browser's stale `current.nextValue` is the authoritative server floor.
    const valueMessage =
      mode === "edit"
        ? withCorrelation(t.coreIdentity.errors.CONFLICT, normalized, t)
        : t.coreSettings.numberingFormValue;
    return { bannerError: null, fieldErrors: { startValue: valueMessage }, notFound: false };
  }
  if (mode === "edit" && normalized.status === 409) {
    return {
      bannerError: withCorrelation(
        coreIdentityError(normalized.code, t) ?? t.coreIdentity.errors.CONFLICT,
        normalized,
        t,
      ),
      fieldErrors: {},
      notFound: false,
    };
  }
  const sanitized = sanitizeNumberingWriteError(normalized, t);
  return {
    bannerError: withCorrelation(sanitized.message ?? t.coreIdentity.errors.UNKNOWN, normalized, t),
    fieldErrors: {},
    notFound: false,
  };
}

/** Replaces raw wire/transport messages on fallback mutation errors with localized copy. */
export function sanitizeNumberingWriteError(
  error: NormalizedApiError,
  t: Dictionary,
): NormalizedApiError {
  const message = isTimeoutError(error)
    ? t.errors.writeTimedOut
    : error.status === 0
      ? t.coreIdentity.errors.OFFLINE
      : coreIdentityError(error.code, t) ?? t.coreIdentity.errors.UNKNOWN;
  return { ...error, message };
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function resolveClientBuilderError(
  mode: "create" | "edit",
  error: unknown,
  t: Dictionary,
  current?: NumberingSequence,
): ResolvedNumberingWriteError | null {
  const message = numberingFormMessage(error, t, current);
  if (!message) return null;
  const reason = error instanceof Error ? error.message : "";
  if (reason === "NUMBERING_FORM_CODE") {
    return mode === "create"
      ? { bannerError: null, fieldErrors: { code: message }, notFound: false }
      : { bannerError: message, fieldErrors: {}, notFound: false };
  }
  if (reason === "NUMBERING_FORM_COMPANY") {
    return mode === "create"
      ? { bannerError: null, fieldErrors: { companyId: message }, notFound: false }
      : { bannerError: message, fieldErrors: {}, notFound: false };
  }
  if (reason === "NUMBERING_FORM_PREFIX") return { bannerError: null, fieldErrors: { prefix: message }, notFound: false };
  if (reason === "NUMBERING_FORM_PADDING") return { bannerError: null, fieldErrors: { padding: message }, notFound: false };
  return { bannerError: null, fieldErrors: { startValue: message }, notFound: false };
}

function withCorrelation(message: string, error: NormalizedApiError, t: Dictionary): string {
  return (
    formatApiErrorMessage(
      { status: error.status, message, correlationId: error.correlationId },
      t,
    ) ?? message
  );
}

function isTimeoutError(error: NormalizedApiError): boolean {
  return (
    error.code === "REQUEST_TIMED_OUT" ||
    error.code === "CLIENT_REQUEST_TIMEOUT" ||
    error.code === "REQUEST_TIMEOUT" ||
    error.status === 504
  );
}

function coreIdentityError(code: string | undefined, t: Dictionary): string | undefined {
  if (!code) return undefined;
  const dictionary = t.coreIdentity.errors as Record<string, string | undefined>;
  return dictionary[code];
}
