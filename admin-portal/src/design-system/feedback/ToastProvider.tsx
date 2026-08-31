"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { useI18n } from "@/i18n/I18nContext";
import { GLOBAL_TOAST_EVENT, showAppToast, type GlobalToastEventDetail } from "./toast-bridge";

/**
 * Mounts sonner's toast viewport and bridges the transport layer's
 * "global-toast" window CustomEvent (axiosClient.ts's dispatchForbiddenToast,
 * fired on every non-public 403) into the same AppToast rendering path
 * useToast() uses — see docs/design-system/toast-contract.md.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { lang, dir } = useI18n();
  const dismissLabel = lang === "ar" ? "إغلاق الإشعار" : "Dismiss notification";

  useEffect(() => {
    const handleGlobalToast = (event: Event) => {
      const detail = (event as CustomEvent<GlobalToastEventDetail>).detail;
      showAppToast(detail.type, detail.title, detail.message, detail.duration, dismissLabel);
    };
    window.addEventListener(GLOBAL_TOAST_EVENT, handleGlobalToast);
    return () => window.removeEventListener(GLOBAL_TOAST_EVENT, handleGlobalToast);
  }, [dismissLabel]);

  return (
    <>
      {children}
      <Toaster
        position={dir === "rtl" ? "top-left" : "top-right"}
        duration={4000}
        visibleToasts={5}
        gap={10}
        // AppToast renders its own surface/border/icon — the sonner
        // chrome around it stays fully unstyled.
        toastOptions={{ unstyled: true, className: "flex" }}
      />
    </>
  );
}
