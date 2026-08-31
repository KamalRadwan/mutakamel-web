"use client";

import { toast as sonnerToast } from "sonner";
import { AppToast, type ToastType } from "./AppToast";

// duration <= 0 meant "permanent, no auto-dismiss timer" in the old
// ToastContext implementation; sonner's equivalent is Infinity. undefined
// matches the old default parameter (duration = 4000) explicitly, rather
// than omitting the key and trusting sonner to fall back to <Toaster
// duration={4000}> — verified live that passing { duration: undefined }
// to toast.custom() does NOT inherit the Toaster's configured default and
// the toast never auto-dismisses.
function resolveDuration(duration?: number): number {
  if (duration === undefined) return 4000;
  return duration > 0 ? duration : Infinity;
}

/**
 * Shared by useToast() (direct calls) and ToastProvider's "global-toast"
 * window-event listener (axiosClient.ts's dispatchForbiddenToast on every
 * non-public 403) — one rendering path for both.
 */
export function showAppToast(
  type: ToastType,
  title: string,
  message: string | undefined,
  duration: number | undefined,
  dismissLabel: string,
): void {
  sonnerToast.custom(
    (id) => (
      <AppToast
        type={type}
        title={title}
        message={message}
        dismissLabel={dismissLabel}
        onDismiss={() => sonnerToast.dismiss(id)}
      />
    ),
    { duration: resolveDuration(duration) },
  );
}

export interface GlobalToastEventDetail {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export const GLOBAL_TOAST_EVENT = "global-toast";
