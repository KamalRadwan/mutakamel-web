"use client";

import { useCallback } from "react";
import { describeApiOutcome, formatApiErrorMessage } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";

type TranslationDictionary = ReturnType<typeof useI18n>["t"];

type CoreErrorTextFn = {
  (error: NormalizedApiError): string;
  (error: NormalizedApiError | null | undefined): string | undefined;
};

function fallbackErrorByStatus(status: number, t: TranslationDictionary): string {
  if (status === 0) return t.coreIdentity.errors.OFFLINE;
  if (status === 504) return t.coreIdentity.errors.REQUEST_TIMEOUT;
  if (status === 403) return t.coreIdentity.errors.FORBIDDEN;
  if (status === 404) return t.coreIdentity.errors.NOT_FOUND;
  if (status === 409) return t.coreIdentity.errors.CONFLICT;
  if (status === 400 || status === 422) return t.coreIdentity.errors.VALIDATION_FAILED;
  return t.coreIdentity.errors.UNKNOWN;
}

/**
 * Turns one Core identity failure into the localized sentence a user can act on.
 *
 * Cross-cutting Gateway outcomes (429 rate limits, 503 limiter outage, 409/422
 * idempotency replay states) are checked first because none of them means the
 * user's form values were wrong. Domain codes from core-app come next, followed
 * by actionable HTTP-status fallbacks. Raw server or transport messages are
 * never displayed; correlationId stays attached for support diagnostics.
 */
export function resolveCoreErrorText(error: NormalizedApiError, t: TranslationDictionary): string;
export function resolveCoreErrorText(
  error: NormalizedApiError | null | undefined,
  t: TranslationDictionary,
): string | undefined;
export function resolveCoreErrorText(
  error: NormalizedApiError | null | undefined,
  t: TranslationDictionary,
): string | undefined {
  if (!error) return undefined;

  const outcome = describeApiOutcome(error, t);
  if (outcome) {
    const summary = `${outcome.title} — ${outcome.description}`;
    return (
      formatApiErrorMessage(
        {
          status: error.status,
          message: summary,
          correlationId: error.correlationId,
        },
        t,
      ) ?? summary
    );
  }

  const mapped =
    error.code === "CURRENT_PASSWORD_INVALID"
      ? t.mfa.errors.currentPassword
      : error.code === "CLIENT_REQUEST_TIMEOUT"
        ? t.coreIdentity.errors.REQUEST_TIMEOUT
        : error.code && Object.prototype.hasOwnProperty.call(t.coreIdentity.errors, error.code)
          ? t.coreIdentity.errors[error.code]
          : undefined;

  const message = mapped ?? fallbackErrorByStatus(error.status, t);

  return (
    formatApiErrorMessage(
      { status: error.status, message, correlationId: error.correlationId },
      t,
    ) ?? message
  );
}

export function useCoreErrorText(): CoreErrorTextFn {
  const { t } = useI18n();

  const describeError = useCallback(
    (error: NormalizedApiError | null | undefined) => resolveCoreErrorText(error, t),
    [t],
  );

  return describeError as CoreErrorTextFn;
}
