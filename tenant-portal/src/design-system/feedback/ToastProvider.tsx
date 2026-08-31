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
}

function resolveDuration(duration: number | undefined): number {
  if (duration === undefined) return 4000;
  return duration <= 0 ? Infinity : duration;
}

// axiosClient.ts (Tier 1, untouched) dispatches this CustomEvent for every
// non-public 403 — see dispatchForbiddenToast() in src/lib/api/axiosClient.ts.
// A feature catch block must not raise a second toast for the same 403; this
// listener is the transport's only surface for it.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const dir = useDirection();

  useEffect(() => {
    function handleGlobalToast(event: Event) {
      const detail = (event as CustomEvent<GlobalToastDetail>).detail;
      if (!detail) return;
      sonnerToast.custom(
        (id) => (
          <AppToast
            type={detail.type}
            title={detail.title}
            message={detail.message}
            onDismiss={() => sonnerToast.dismiss(id)}
          />
        ),
        { duration: resolveDuration(detail.duration) },
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
