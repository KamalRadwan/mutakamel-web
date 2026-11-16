"use client";

import { toast as sonnerToast } from "sonner";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { AppToast, type AppToastType, type AppToastProps } from "./AppToast";
import { describeApiOutcome } from "./format-api-error";

const DEFAULT_DURATION = 4000;

function resolveDuration(duration?: number): number {
  if (duration === undefined) return DEFAULT_DURATION;
  return duration <= 0 ? Infinity : duration;
}

function show(type: AppToastType, title: string, message: string | undefined, duration: number | undefined,
  extras?: Pick<AppToastProps, "action" | "reference">) {
  return sonnerToast.custom(
    (id) => <AppToast type={type} title={title} message={message} {...extras} onDismiss={() => sonnerToast.dismiss(id)} />,
    { duration: resolveDuration(duration) },
  );
}

export interface UseToastResult {
  success: (title: string, message?: string, duration?: number) => void;
  error: (title: string, message?: string, duration?: number) => void;
  warning: (title: string, message?: string, duration?: number, action?: AppToastProps["action"]) => void;
  info: (title: string, message?: string, duration?: number) => void;
  // Preserves the server correlation reference for support.
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
  const referenceFor = (error: NormalizedApiError) => error.correlationId
    ? { label: t.errors.reference, value: error.correlationId }
    : undefined;

  return {
    success: (title, message, duration) => show("success", title, message, duration),
    error: (title, message, duration) => show("error", title, message, duration),
    warning: (title, message, duration, action) => show("warning", title, message, duration, { action }),
    info: (title, message, duration) => show("info", title, message, duration),
    errorFromApi: (title, error, duration) =>
      show("error", title, error.message, duration, { reference: referenceFor(error) }),
    outcomeFromApi: (error) => {
      const outcome = describeApiOutcome(error, t);
      if (!outcome) return false;
      // A non-retryable outcome carries an instruction — "wait and refresh",
      // "reload and start over" — and a 4-second toast is not long enough to
      // read one. duration 0 makes it permanent and keyboard-dismissable,
      // the same treatment the ambiguous-outcome toast gets.
      show(outcome.tone, outcome.title, outcome.description, outcome.retryable ? undefined : 0,
        { reference: referenceFor(error) });
      return true;
    },
  };
}
