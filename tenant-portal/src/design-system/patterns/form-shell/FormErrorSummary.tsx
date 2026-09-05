"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "../../lib/cn";
import { proseMeasure } from "../../lib/variants";

export interface FormErrorSummaryProps {
  /** Nothing renders when this is absent, so a call site needs no guard of its own. */
  error?: string;
  className?: string;
}

/**
 * The non-field error a form write came back with.
 *
 * `role="alert"` and not a focus target: this app moves focus to the first
 * invalid FIELD after a rejected submit — docs/design/patterns.md#focus-after-a-failed-submit —
 * so the summary is announced where it stands rather than competing for the
 * same focus move.
 *
 * It lives here rather than inside `FormDrawer` because `FormModal` needs the
 * identical surface, and two copies of a role-ramp block are two chances for
 * the negative surface to drift apart between a drawer and a dialog.
 */
export function FormErrorSummary({ error, className }: FormErrorSummaryProps) {
  if (!error) return null;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-sm border border-negative-200 bg-negative-100 p-2.5",
        "text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300",
        proseMeasure,
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 wrap-anywhere">{error}</span>
    </div>
  );
}
