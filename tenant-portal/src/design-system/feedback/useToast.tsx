"use client";

import { toast as sonnerToast } from "sonner";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { AppToast, type AppToastType } from "./AppToast";
import { describeApiOutcome, formatApiErrorMessage } from "./format-api-error";

const DEFAULT_DURATION = 4000;

function resolveDuration(duration?: number): number {
  if (duration === undefined) return DEFAULT_DURATION;
  return duration <= 0 ? Infinity : duration;
}

function show(type: AppToastType, title: string, message: string | undefined, duration: number | undefined) {
  return sonnerToast.custom(
    (id) => <AppToast type={type} title={title} message={message} onDismiss={() => sonnerToast.dismiss(id)} />,
    { duration: resolveDuration(duration) },
  );
}

export interface UseToastResult {
  success: (title: string, message?: string, duration?: number) => void;
  error: (title: string, message?: string, duration?: number) => void;
  warning: (title: string, message?: string, duration?: number) => void;
  info: (title: string, message?: string, duration?: number) => void;
  // Appends errorCode + correlationId to the message so the evidence a user
  // report needs is never lost — docs/design/patterns.md#toast-api.
  errorFromApi: (title: string, error: NormalizedApiError, duration?: number) => void;
  /**
   * Raises the right surface for a rate-limit or idempotency outcome and
   * returns true; returns false for anything else so the caller can raise
   * its own, more specific message (S8, S9).
   */
  outcomeFromApi: (error: NormalizedApiError) => boolean;
}

export function useToast(): UseToastResult {
  const { t } = useI18n();

  return {
    success: (title, message, duration) => show("success", title, message, duration),
    error: (title, message, duration) => show("error", title, message, duration),
    warning: (title, message, duration) => show("warning", title, message, duration),
    info: (title, message, duration) => show("info", title, message, duration),
    errorFromApi: (title, error, duration) =>
      show("error", title, formatApiErrorMessage(error, t), duration),
    outcomeFromApi: (error) => {
      const outcome = describeApiOutcome(error, t);
      if (!outcome) return false;
      // The correlationId still rides along: a rate-limit surge and a broken
      // limiter look identical in a screenshot without it.
      const reference = error.correlationId
        ? `${outcome.description} — ${t.errors.reference}: ${error.correlationId}`
        : outcome.description;
      // A non-retryable outcome carries an instruction — "wait and refresh",
      // "reload and start over" — and a 4-second toast is not long enough to
      // read one. duration 0 makes it permanent and keyboard-dismissable,
      // the same treatment the ambiguous-outcome toast gets.
      show(outcome.tone, outcome.title, reference, outcome.retryable ? undefined : 0);
      return true;
    },
  };
}
