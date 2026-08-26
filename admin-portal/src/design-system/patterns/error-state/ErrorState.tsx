"use client";

import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import { Button } from "../../primitives/Button";
import { CodeRef } from "../code-ref/CodeRef";
import { cn } from "../../lib/cn";

/**
 * A load failure with a retry affordance — never a toast (a toast can't
 * host "the data didn't load, try again"). errorCode/correlationId render
 * via CodeRef so the evidence an inline banner used to show isn't lost.
 */
export function ErrorState({
  title,
  error,
  onRetry,
  className,
}: {
  title?: string;
  error?: NormalizedApiError | null;
  onRetry?: () => void;
  className?: string;
}) {
  const { lang } = useI18n();
  const heading = title ?? (lang === "ar" ? "تعذر تحميل البيانات" : "Couldn't load this data");

  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}
    >
      <AlertTriangle className="mb-1 size-8 text-danger-500 dark:text-danger-400" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{heading}</p>
      {error?.message && <p className="max-w-sm text-sm text-muted-foreground">{error.message}</p>}
      {(error?.errorCode || error?.correlationId) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
          {error.errorCode && <CodeRef value={error.errorCode} />}
          {error.correlationId && <CodeRef value={error.correlationId} />}
        </div>
      )}
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-2">
          {lang === "ar" ? "إعادة المحاولة" : "Retry"}
        </Button>
      )}
    </div>
  );
}
