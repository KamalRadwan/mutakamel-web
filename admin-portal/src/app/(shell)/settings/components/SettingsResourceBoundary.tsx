"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { ErrorState } from "@/design-system";
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
        <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        {copy.loading}
      </div>
    );
  }

  const forbidden = state === "FORBIDDEN";
  const unavailable = state === "UNAVAILABLE";
  const title = forbidden
    ? copy.forbiddenTitle
    : unavailable
      ? copy.unavailableTitle
      : copy.errorTitle;
  const detail = forbidden ? "admin.settings.read" : copy.errorDetail;
  const displayError: NormalizedApiError = {
    isNormalized: true,
    httpStatus: error?.httpStatus ?? 0,
    errorCode: error?.errorCode ?? "",
    message: detail,
    correlationId: error?.correlationId,
  };

  return (
    <ErrorState
      title={title}
      error={displayError}
      onRetry={forbidden ? undefined : onRetry}
    />
  );
}
