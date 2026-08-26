"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type { SettingsLoadState } from "../hooks/useSettings";

interface SettingsResourceBoundaryProps {
  state: SettingsLoadState;
  error?: NormalizedApiError | null;
  lang: "ar" | "en";
  onRetry: () => void;
  children: ReactNode;
}

export function SettingsResourceBoundary({
  state,
  error,
  lang,
  onRetry,
  children,
}: SettingsResourceBoundaryProps) {
  if (state === "READY") return <>{children}</>;
  if (state === "LOADING") {
    return (
      <div
        role="status"
        className="flex min-h-40 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
      >
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        {lang === "ar" ? "جارٍ تحميل الإعدادات…" : "Loading settings…"}
      </div>
    );
  }

  const forbidden = state === "FORBIDDEN";
  const unavailable = state === "UNAVAILABLE";
  const Icon = forbidden ? ShieldAlert : AlertTriangle;
  const title = forbidden
    ? lang === "ar"
      ? "لا تملك صلاحية قراءة هذه الإعدادات"
      : "Settings read permission required"
    : unavailable
      ? lang === "ar"
        ? "خدمة الإعدادات غير متاحة حالياً"
        : "Settings service is unavailable"
      : lang === "ar"
        ? "تعذر تحميل الإعدادات"
        : "Settings could not be loaded";
  const detail = forbidden
    ? "admin.settings.read"
    : lang === "ar"
      ? "لم نعرض بيانات فارغة بدلاً من فشل التحميل. يمكنك إعادة المحاولة."
      : "The load failure is not being shown as empty data. You can retry safely.";

  return (
    <section
      role="alert"
      className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900 dark:bg-rose-950/25"
    >
      <Icon className="size-8 text-rose-600 dark:text-rose-300" aria-hidden="true" />
      <h2 className="mt-3 text-base font-semibold text-rose-950 dark:text-rose-100">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-rose-800 dark:text-rose-200">
        {detail}
      </p>
      {error?.errorCode ? (
        <code dir="ltr" className="mt-2 text-xs text-rose-700 dark:text-rose-300">
          {error.errorCode}
          {error.correlationId ? ` · ${error.correlationId}` : ""}
        </code>
      ) : null}
      {!forbidden ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white hover:bg-rose-600"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {lang === "ar" ? "إعادة المحاولة" : "Retry"}
        </button>
      ) : null}
    </section>
  );
}
