"use client";

import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/Button";

export interface BulkFailure {
  id: string;
  /** The record, named as the user knows it — not its UUID. */
  label: string;
  /** Why this one was refused. Comes from the server's per-item error. */
  reason: string;
}

export interface BulkResultPanelLabels {
  title: string;
  /** Already formatted by the caller, e.g. "38 of 50 succeeded". */
  summary: string;
  failuresHeading: string;
  retryFailed: string;
  dismiss: string;
}

export interface BulkResultPanelProps {
  succeededCount: number;
  failures: BulkFailure[];
  /** Re-runs the operation over the failed ids only. */
  onRetryFailed?: () => void;
  onDismiss: () => void;
  retrying?: boolean;
  className?: string;
  labels: BulkResultPanelLabels;
}

type ResultTone = "positive" | "caution" | "negative";

const TONE_SURFACE: Record<ResultTone, string> = {
  positive: "border-positive-200 bg-positive-100 dark:border-positive-800 dark:bg-positive-950",
  caution: "border-caution-200 bg-caution-100 dark:border-caution-800 dark:bg-caution-950",
  negative: "border-negative-200 bg-negative-100 dark:border-negative-800 dark:bg-negative-950",
};

const TONE_TEXT: Record<ResultTone, string> = {
  positive: "text-positive-800 dark:text-positive-300",
  caution: "text-caution-800 dark:text-caution-300",
  negative: "text-negative-800 dark:text-negative-300",
};

const TONE_ICON: Record<ResultTone, string> = {
  positive: "text-positive-700 dark:text-positive-400",
  caution: "text-caution-700 dark:text-caution-400",
  negative: "text-negative-700 dark:text-negative-400",
};

const TONE_GLYPH = {
  positive: CircleCheck,
  caution: CircleAlert,
  negative: CircleX,
} as const;

// Partial success is the normal outcome of a bulk write, and it is the one a
// toast destroys: "38 of 50 succeeded" is useless without the 12. This is
// in-body and persistent, and it lists every failure with its own reason.
//
// The three tones are the honest reading of the counts — a run where nothing
// succeeded is a failure, not a partial success, and rendering it in caution
// would soften a total loss.
//
// No useToast import — see docs/design/patterns.md#toast-api.
export function BulkResultPanel({
  succeededCount,
  failures,
  onRetryFailed,
  onDismiss,
  retrying,
  className,
  labels,
}: BulkResultPanelProps) {
  const tone: ResultTone =
    failures.length === 0 ? "positive" : succeededCount === 0 ? "negative" : "caution";
  const Glyph = TONE_GLYPH[tone];

  return (
    <section
      role="status"
      className={cn("flex flex-col gap-2.5 rounded-sm border p-3", TONE_SURFACE[tone], className)}
    >
      <div className="flex items-start gap-2">
        <Glyph className={cn("mt-0.5 size-4 shrink-0", TONE_ICON[tone])} aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className={cn("text-sm font-medium", TONE_TEXT[tone])}>{labels.title}</h2>
          <p className={cn("text-xs tabular-nums", TONE_TEXT[tone])}>{labels.summary}</p>
        </div>
      </div>

      {failures.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className={cn("text-xs font-medium", TONE_ICON[tone])}>
            {labels.failuresHeading}
          </h3>
          <ul className="max-h-48 overflow-auto rounded-sm border border-border bg-card">
            {failures.map((failure) => (
              <li
                key={failure.id}
                className="flex flex-col gap-0.5 border-b border-border px-2.5 py-1.5 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-2"
              >
                <span className="shrink-0 text-xs font-medium text-foreground">{failure.label}</span>
                <span className="min-w-0 text-xs text-muted-foreground">{failure.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {failures.length > 0 && onRetryFailed && (
          <Button variant="outline" size="sm" onClick={onRetryFailed} loading={retrying}>
            {labels.retryFailed}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDismiss} disabled={retrying}>
          {labels.dismiss}
        </Button>
      </div>
    </section>
  );
}
