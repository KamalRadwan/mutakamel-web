"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type { SettingsLoadState } from "../hooks/useSettings";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";

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
  const copy = (lang === "ar" ? ar : en).settings.boundary;

  if (state === "READY") return <>{children}</>;
  if (state === "LOADING") {
    return (
      <div
        role="status"
        className="flex min-h-40 items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground"
      >
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        {copy.loading}
      </div>
    );
  }

  const forbidden = state === "FORBIDDEN";
  const unavailable = state === "UNAVAILABLE";
  const Icon = forbidden ? ShieldAlert : AlertTriangle;
  const title = forbidden
    ? copy.forbiddenTitle
    : unavailable
      ? copy.unavailableTitle
      : copy.errorTitle;
  const detail = forbidden ? "admin.settings.read" : copy.errorDetail;

  return (
    <section
      role="alert"
      className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-danger-200 bg-danger-50 p-6 text-center dark:border-danger-900 dark:bg-danger-950/25"
    >
      <Icon className="size-8 text-danger-600 dark:text-danger-300" aria-hidden="true" />
      <h2 className="mt-3 text-base font-semibold text-danger-950 dark:text-danger-100">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-danger-800 dark:text-danger-200">
        {detail}
      </p>
      {error?.errorCode ? (
        <code dir="ltr" className="mt-2 text-xs text-danger-700 dark:text-danger-300">
          {error.errorCode}
          {error.correlationId ? ` · ${error.correlationId}` : ""}
        </code>
      ) : null}
      {!forbidden ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-danger-700 px-4 text-sm font-semibold text-white hover:bg-danger-600"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {copy.retry}
        </button>
      ) : null}
    </section>
  );
}
