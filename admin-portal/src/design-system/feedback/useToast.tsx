"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import { showAppToast } from "./toast-bridge";
import { formatApiErrorMessage } from "./format-api-error";

/**
 * Byte-compatible replacement for the old ToastContext's useToast(): same
 * (title, message?, duration?) signature per method, rendered through
 * sonner instead of hand-rolled state. src/components/ui/ToastContext.tsx
 * re-exports this so none of the 149 existing call sites move.
 *
 * toast.saved() is deliberately not carried over — it had zero call sites.
 * errorFromApi() is new and additive: for a deterministic rejected write
 * (409/422, unambiguous — never an ambiguous outcome, which must stay
 * in-body per docs/design-system/toast-contract.md), it folds errorCode +
 * correlationId into the message so that evidence isn't lost.
 */
export interface AppToastApi {
  success: (title: string, message?: string, duration?: number) => void;
  error: (title: string, message?: string, duration?: number) => void;
  info: (title: string, message?: string, duration?: number) => void;
  warning: (title: string, message?: string, duration?: number) => void;
  errorFromApi: (title: string, error: NormalizedApiError, duration?: number) => void;
}

export function useToast(): AppToastApi {
  const { lang } = useI18n();
  const dismissLabel = lang === "ar" ? "إغلاق الإشعار" : "Dismiss notification";

  return useMemo(
    () => ({
      success: (title: string, message?: string, duration?: number) =>
        showAppToast("success", title, message, duration, dismissLabel),
      error: (title: string, message?: string, duration?: number) =>
        showAppToast("error", title, message, duration, dismissLabel),
      info: (title: string, message?: string, duration?: number) =>
        showAppToast("info", title, message, duration, dismissLabel),
      warning: (title: string, message?: string, duration?: number) =>
        showAppToast("warning", title, message, duration, dismissLabel),
      errorFromApi: (title: string, error: NormalizedApiError, duration?: number) =>
        showAppToast("error", title, formatApiErrorMessage(error), duration, dismissLabel),
    }),
    [dismissLabel],
  );
}
