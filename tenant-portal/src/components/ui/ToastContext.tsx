"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
}

interface ToastContextValue {
  toast: {
    success: (title: string, message?: string, duration?: number) => void;
    error: (title: string, message?: string, duration?: number) => void;
    info: (title: string, message?: string, duration?: number) => void;
    warning: (title: string, message?: string, duration?: number) => void;
    saved: () => void;
  };
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, title: string, message?: string, duration = 4000) => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

    setToasts((current) => [...current.slice(-4), { id, type, title, message, duration }]);
    if (duration > 0) window.setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const toast = useMemo(() => ({
    success: (title: string, message?: string, duration?: number) => addToast("success", title, message, duration),
    error: (title: string, message?: string, duration?: number) => addToast("error", title, message, duration),
    info: (title: string, message?: string, duration?: number) => addToast("info", title, message, duration),
    warning: (title: string, message?: string, duration?: number) => addToast("warning", title, message, duration),
    saved: () => addToast(
      "success",
      lang === "ar" ? "تم الحفظ" : "Saved",
      lang === "ar" ? "تم حفظ التغييرات بنجاح." : "Your changes have been saved successfully.",
    ),
  }), [addToast, lang]);

  useEffect(() => {
    const handleGlobalToast = (event: Event) => {
      const detail = (event as CustomEvent<{
        type: ToastType;
        title: string;
        message?: string;
        duration?: number;
      }>).detail;
      if (detail) addToast(detail.type, detail.title, detail.message, detail.duration);
    };

    window.addEventListener("global-toast", handleGlobalToast);
    return () => window.removeEventListener("global-toast", handleGlobalToast);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className={`fixed top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2.5 pointer-events-none ${
          lang === "ar" ? "left-4" : "right-4"
        }`}
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role={item.type === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300 ${
              item.type === "success"
                ? "bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-100"
                : item.type === "error"
                  ? "bg-rose-50/95 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800/80 text-rose-900 dark:text-rose-100"
                  : item.type === "warning"
                    ? "bg-amber-50/95 dark:bg-amber-950/90 border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-100"
                    : "bg-blue-50/95 dark:bg-blue-950/90 border-blue-200 dark:border-blue-800/80 text-blue-900 dark:text-blue-100"
            }`}
          >
            <span className="mt-0.5 shrink-0" aria-hidden>
              {item.type === "success" && <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />}
              {item.type === "error" && <AlertCircle className="size-5 text-rose-600 dark:text-rose-400" />}
              {item.type === "warning" && <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />}
              {item.type === "info" && <Info className="size-5 text-blue-600 dark:text-blue-400" />}
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold leading-tight">{item.title}</h4>
              {item.message && <p className="mt-1 whitespace-pre-line text-xs leading-relaxed opacity-90">{item.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => removeToast(item.id)}
              aria-label={lang === "ar" ? "إغلاق الإشعار" : "Dismiss notification"}
              className="-m-2 grid size-11 shrink-0 place-items-center rounded-xl opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context.toast;
}
