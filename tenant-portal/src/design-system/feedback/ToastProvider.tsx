"use client";

import { useEffect } from "react";
import { Toaster, toast as sonnerToast } from "sonner";
import { useDirection } from "@/i18n/useLanguage";
import { AppToast, type AppToastType } from "./AppToast";

interface GlobalToastDetail {
  type: AppToastType;
  title: string;
  message?: string;
  duration?: number;
  dedupeKey?: string;
}

const DENIAL_TOAST_WINDOW_MS = 4000;

function resolveDuration(duration: number | undefined): number {
  if (duration === undefined) return 4000;
  return duration <= 0 ? Infinity : duration;
}

// The transport dispatches non-suppressed 403s with a code-based dedupe key.
// A feature catch block must not raise a second toast for the same 403; this
// listener is the transport's only surface for it.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const dir = useDirection();

  useEffect(() => {
    const recentToasts = new Map<string, number>();
    function handleGlobalToast(event: Event) {
      const detail = (event as CustomEvent<GlobalToastDetail>).detail;
      if (!detail) return;
      if (detail.dedupeKey) {
        const now = Date.now();
        for (const [key, shownAt] of recentToasts) {
          if (now - shownAt >= DENIAL_TOAST_WINDOW_MS) recentToasts.delete(key);
        }
        if (recentToasts.has(detail.dedupeKey)) return;
        recentToasts.set(detail.dedupeKey, now);
      }
      sonnerToast.custom(
        (id) => (
          <AppToast
            type={detail.type}
            title={detail.title}
            message={detail.message}
            onDismiss={() => sonnerToast.dismiss(id)}
          />
        ),
        { id: detail.dedupeKey, duration: resolveDuration(detail.duration) },
      );
    }

    window.addEventListener("global-toast", handleGlobalToast);
    return () => window.removeEventListener("global-toast", handleGlobalToast);
  }, []);

  return (
    <>
      {children}
      <Toaster
        position={dir === "rtl" ? "bottom-left" : "bottom-right"}
        dir={dir}
        toastOptions={{ unstyled: true, className: "w-full" }}
      />
    </>
  );
}
