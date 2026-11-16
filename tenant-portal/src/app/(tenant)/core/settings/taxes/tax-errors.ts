import { describeApiOutcome } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { formatTemplate } from "@/lib/format/template";
import { companyLabel, type CompanyOption } from "../company-options";
import {
  COMPANY_INVALID_CODE,
  INVALID_TAXES_RESPONSE_MESSAGE,
  TAX_CODE_TAKEN_CODE,
  TAX_NOT_FOUND_CODE,
} from "./tax-contract";

const INVALID_TAXES_RESPONSE_CODE = "INVALID_TAXES_RESPONSE";

/**
 * Keeps an unreadable 200 payload distinct from status-0 transport drops so a
 * malformed response never tells the user they are offline.
 */
export function normalizeTaxQueryError(error: unknown): NormalizedApiError {
  const normalized = normalizeApiError(error);
  if (error instanceof Error && error.message === INVALID_TAXES_RESPONSE_MESSAGE) {
    return {
      ...normalized,
      status: 502,
      code: INVALID_TAXES_RESPONSE_CODE,
    };
  }
  return normalized;
}

export function formatTaxQueryFailure(
  error: NormalizedApiError,
  t: Dictionary,
): { title: string; description?: string; retryable: boolean } {
  const outcome = describeApiOutcome(error, t);
  if (outcome) {
    return {
      title: outcome.title,
      description: withCorrelation(outcome.description, error, t),
      retryable: outcome.retryable,
    };
  }

  const mappedCode =
    error.code && error.code !== INVALID_TAXES_RESPONSE_CODE
      ? coreIdentityError(error.code, t)
      : undefined;
  const message = isTimeoutCode(error.code)
    ? t.errors.requestTimedOut
    : error.status === 0
      ? t.coreIdentity.errors.OFFLINE
      : mappedCode ?? t.coreIdentity.errors.UNKNOWN;

  return {
    title: t.coreSettings.taxLoadFailed,
    description: withCorrelation(message, error, t),
    retryable: true,
  };
}

export function formatTaxCompanyOptionsFailure(
  error: NormalizedApiError,
  t: Dictionary,
): { title: string; description: string; retryable: boolean } {
  if (error.status === 403) {
    const permissionMessage = coreIdentityError(error.code, t) ?? t.errors.accessDeniedMessage;
    return {
      title: t.coreSettings.companyOptionsLoadFailed,
      description: withCorrelation(permissionMessage, error, t),
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

export function resolveTaxFormWriteError(options: {
  error: unknown;
  fallbackTitle: string;
  scopeCompanyId: string | null;
  companies: readonly CompanyOption[];
  t: Dictionary;
}): { message: string; shouldReload: boolean } {
  const { error, fallbackTitle, scopeCompanyId, companies, t } = options;
  const clientMessage = formMessage(error, t);
  if (clientMessage) return { message: clientMessage, shouldReload: false };

  const normalized = normalizeApiError(error);
  if (
    isInvalidTaxWritePayloadError(error, normalized)
  ) {
    return {
      message: withCorrelation(t.coreSettings.invalidResponseDescription, normalized, t),
      shouldReload: false,
    };
  }
  if (normalized.status === 403) {
    const scopedDenied = coreIdentityError(normalized.code, t) ?? t.errors.accessDeniedMessage;
    return {
      message: withCorrelation(scopedDenied, normalized, t),
      shouldReload: false,
    };
  }
  const outcome = describeApiOutcome(normalized, t);
  if (outcome) {
    return {
      message: withCorrelation(outcome.description, normalized, t),
      shouldReload: false,
    };
  }
  if (isTimeoutCode(normalized.code)) {
    return {
      message: withCorrelation(t.errors.writeTimedOut, normalized, t),
      shouldReload: false,
    };
  }
  if (normalized.code === TAX_CODE_TAKEN_CODE) {
    // A tax code is unique WITHIN its scope, so the conflict names the scope.
    return {
      message: withCorrelation(
        formatTemplate(t.coreSettings.taxCodeTaken, {
          company: companyLabel(
            companies,
            scopeCompanyId,
            t.coreSettings.taxTenantWide,
            t.coreSettings.unknownCompany,
          ),
        }),
        normalized,
        t,
      ),
      shouldReload: false,
    };
  }
  if (normalized.code === COMPANY_INVALID_CODE) {
    return {
      message: withCorrelation(t.coreSettings.taxCompanyInvalid, normalized, t),
      shouldReload: false,
    };
  }
  if (normalized.code === TAX_NOT_FOUND_CODE || normalized.status === 404) {
    return {
      message: withCorrelation(t.editDrawer.notFoundTitle, normalized, t),
      shouldReload: true,
    };
  }
  if (normalized.status === 0) {
    return {
      message: withCorrelation(t.coreIdentity.errors.OFFLINE, normalized, t),
      shouldReload: false,
    };
  }
  const mappedCode = coreIdentityError(normalized.code, t);
  return {
    message: withCorrelation(mappedCode ?? fallbackTitle, normalized, t),
    shouldReload: false,
  };
}

export function resolveTaxReactivateError(
  error: unknown,
  t: Dictionary,
): {
  normalized: NormalizedApiError;
  message: string | undefined;
  shouldReload: boolean;
  isInvalidResponse: boolean;
} {
  const normalized = normalizeApiError(error);
  if (isInvalidTaxWritePayloadError(error, normalized)) {
    return {
      normalized,
      message: withCorrelation(t.coreSettings.invalidResponseDescription, normalized, t),
      shouldReload: false,
      isInvalidResponse: true,
    };
  }
  if (normalized.code === COMPANY_INVALID_CODE) {
    return {
      normalized,
      message: withCorrelation(t.coreSettings.taxCompanyInvalid, normalized, t),
      shouldReload: false,
      isInvalidResponse: false,
    };
  }
  const shouldReload =
    normalized.code === TAX_NOT_FOUND_CODE || normalized.status === 404;
  return {
    normalized,
    message: resolveTaxDeactivateToastMessage(normalized, t),
    shouldReload,
    isInvalidResponse: false,
  };
}

export function resolveTaxDeactivateToastMessage(
  normalized: NormalizedApiError,
  t: Dictionary,
): string | undefined {
  if (normalized.code === TAX_NOT_FOUND_CODE || normalized.status === 404) {
    return withCorrelation(t.editDrawer.notFoundTitle, normalized, t);
  }
  if (isTimeoutCode(normalized.code)) {
    return withCorrelation(t.errors.writeTimedOut, normalized, t);
  }
  if (normalized.status === 0) {
    return withCorrelation(t.coreIdentity.errors.OFFLINE, normalized, t);
  }
  const mappedCode = coreIdentityError(normalized.code, t);
  if (mappedCode) return withCorrelation(mappedCode, normalized, t);
  return normalized.correlationId
    ? `${t.errors.reference}: ${normalized.correlationId}`
    : undefined;
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function isInvalidTaxWritePayloadError(
  error: unknown,
  normalized: NormalizedApiError,
): boolean {
  return (
    (error instanceof Error && error.message === INVALID_TAXES_RESPONSE_MESSAGE) ||
    normalized.code === "API_RESPONSE_TOO_LARGE"
  );
}

/** Client-side form stops, raised before any request leaves. */
function formMessage(error: unknown, t: Dictionary): string | null {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "TAX_FORM_CODE") return t.coreSettings.taxFormCode;
  if (reason === "TAX_FORM_NAME") return t.coreSettings.taxFormName;
  if (reason === "TAX_FORM_RATE") return t.coreSettings.taxFormRate;
  if (reason === "TAX_FORM_COMPANY") return t.coreSettings.taxFormCompany;
  if (reason === "TAX_FORM_STATUS") return t.crmShared.fieldRequired;
  return null;
}

function isTimeoutCode(code: string | undefined): boolean {
  return code === "CLIENT_REQUEST_TIMEOUT" || code === "REQUEST_TIMED_OUT";
}

function coreIdentityError(code: string | undefined, t: Dictionary): string | undefined {
  if (!code) return undefined;
  const coreErrors = t.coreIdentity.errors as Record<string, string | undefined>;
  return coreErrors[code];
}

function withCorrelation(message: string, error: NormalizedApiError, t: Dictionary): string {
  return error.correlationId
    ? `${message} — ${t.errors.reference}: ${error.correlationId}`
    : message;
}
