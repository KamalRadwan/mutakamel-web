"use client";

import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "../../primitives/Button";
import { CodeRef } from "../code-ref/CodeRef";
import { cn } from "../../lib/cn";

/**
 * Constraint-critical. AGENTS.md: "Persist only minimal, non-secret
 * attempt evidence until the operator resolves an ambiguous outcome." A
 * write whose result is unknown (timeout, 5xx, GW.IDEM.IN_FLIGHT) must
 * keep its idempotency key and retry-exact affordance visible in-body,
 * persistent, until the operator resolves it — never a toast, which would
 * destroy that evidence after a few seconds.
 *
 * This is presentational only: it renders whatever evidence and actions
 * the caller supplies (each feature's own hook owns the actual
 * retryExactMutation/reconcileUnknownMutation logic and the
 * usePersistedCommandAttempt-backed evidence).
 */
export function AmbiguousOutcomePanel({
  idempotencyKey,
  correlationId,
  message,
  onRetryExact,
  onReconcile,
  retrying,
  className,
}: {
  idempotencyKey?: string;
  correlationId?: string;
  message?: string;
  onRetryExact?: () => void;
  onReconcile?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const { lang } = useI18n();

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-2 rounded-md border border-warn-200 bg-warn-50 p-3 text-sm dark:border-warn-800/60 dark:bg-warn-950/30",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn-600 dark:text-warn-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-warn-900 dark:text-warn-200">
            {lang === "ar" ? "النتيجة غير مؤكدة" : "Outcome unconfirmed"}
          </p>
          <p className="mt-0.5 text-warn-800 dark:text-warn-300">
            {message ??
              (lang === "ar"
                ? "لم يتم تأكيد اكتمال هذا الإجراء. يُرجى إعادة المحاولة بنفس المفتاح أو التحقق من الحالة الفعلية قبل المتابعة."
                : "This action's completion could not be confirmed. Retry with the same key, or check the actual state before proceeding.")}
          </p>
        </div>
      </div>

      {(idempotencyKey || correlationId) && (
        <div className="flex flex-wrap items-center gap-1.5 ps-6">
          {idempotencyKey && <CodeRef value={idempotencyKey} />}
          {correlationId && <CodeRef value={correlationId} />}
        </div>
      )}

      {(onRetryExact || onReconcile) && (
        <div className="flex items-center gap-2 ps-6">
          {onRetryExact && (
            <Button type="button" variant="outline" size="sm" onClick={onRetryExact} loading={retrying}>
              {lang === "ar" ? "إعادة المحاولة بنفس المفتاح" : "Retry exact"}
            </Button>
          )}
          {onReconcile && (
            <Button type="button" variant="ghost" size="sm" onClick={onReconcile}>
              {lang === "ar" ? "تحقق من الحالة الفعلية" : "Check actual state"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
