"use client";

import { CircleCheck, CircleX, Clock, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/Button";

// UI states, NOT a wire enum. No tenant-facing 202 job route in
// docs/api/ or the Core controllers publishes a status enum the browser can
// read — see docs/build/OPEN-QUESTIONS.md (Q15). The consuming screen maps its
// own proven wire values onto these five; nothing here may be sent to a
// server or compared against a response without that mapping.
export type AsyncJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "ARTIFACT_EXPIRED";

export interface AsyncJobStateLabels {
  queued: string;
  running: string;
  succeeded: string;
  failed: string;
  artifactExpired: string;
  download: string;
  retry: string;
  cancel: string;
}

export interface AsyncJobStateProps {
  status: AsyncJobStatus;
  /** The job, named for a human — already translated. */
  operation: string;
  /** The failure reason, the expiry moment, or whatever the status needs to say. */
  detail?: string;
  /** Only meaningful on SUCCEEDED. */
  onDownload?: () => void;
  /** Offered on FAILED and ARTIFACT_EXPIRED — a re-run, not a poll. */
  onRetry?: () => void;
  /** Offered while QUEUED or RUNNING, when the route supports it. */
  onCancel?: () => void;
  busy?: boolean;
  className?: string;
  labels: AsyncJobStateLabels;
}

interface StatusPresentation {
  label: (labels: AsyncJobStateLabels) => string;
  icon: LucideIcon | null;
  surface: string;
  text: string;
  iconTone: string;
}

const PRESENTATION: Record<AsyncJobStatus, StatusPresentation> = {
  QUEUED: {
    label: (labels) => labels.queued,
    icon: null,
    surface: "border-border bg-muted",
    text: "text-foreground",
    iconTone: "",
  },
  RUNNING: {
    label: (labels) => labels.running,
    icon: null,
    surface: "border-border bg-muted",
    text: "text-foreground",
    iconTone: "",
  },
  SUCCEEDED: {
    label: (labels) => labels.succeeded,
    icon: CircleCheck,
    surface: "border-positive-200 bg-positive-100 dark:border-positive-800 dark:bg-positive-950",
    text: "text-positive-800 dark:text-positive-300",
    iconTone: "text-positive-700 dark:text-positive-400",
  },
  FAILED: {
    label: (labels) => labels.failed,
    icon: CircleX,
    surface: "border-negative-200 bg-negative-100 dark:border-negative-800 dark:bg-negative-950",
    text: "text-negative-800 dark:text-negative-300",
    iconTone: "text-negative-700 dark:text-negative-400",
  },
  ARTIFACT_EXPIRED: {
    label: (labels) => labels.artifactExpired,
    icon: Clock,
    surface: "border-caution-200 bg-caution-100 dark:border-caution-800 dark:bg-caution-950",
    text: "text-caution-800 dark:text-caution-300",
    iconTone: "text-caution-700 dark:text-caution-400",
  },
};

const PENDING: ReadonlySet<AsyncJobStatus> = new Set<AsyncJobStatus>(["QUEUED", "RUNNING"]);

// A 202 is not completion — it is a job the user now has to be told about.
// The in-flight affordance is the pending dot, not a progress bar: the server
// reports no percentage, and a bar that fills on a timer is a fabricated
// success signal (docs/design/anti-patterns.md#13-fake-data-and-fake-success).
export function AsyncJobState({
  status,
  operation,
  detail,
  onDownload,
  onRetry,
  onCancel,
  busy,
  className,
  labels,
}: AsyncJobStateProps) {
  const presentation = PRESENTATION[status];
  const Icon = presentation.icon;
  const pending = PENDING.has(status);

  return (
    <section
      role="status"
      aria-busy={pending || undefined}
      className={cn(
        "flex flex-col gap-2 rounded-sm border p-3",
        presentation.surface,
        className,
      )}
    >
      <div className="flex items-start gap-2">
        {pending ? (
          <span
            className="dot-pending mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-400"
            aria-hidden="true"
          />
        ) : (
          Icon && <Icon className={cn("mt-0.5 size-4 shrink-0", presentation.iconTone)} aria-hidden="true" />
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className={cn("text-sm font-medium", presentation.text)}>
            {presentation.label(labels)}
          </p>
          <p className={cn("text-xs", presentation.text)}>{operation}</p>
          {detail && <p className={cn("text-xs", presentation.text)}>{detail}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {status === "SUCCEEDED" && onDownload && (
          <Button variant="outline" size="sm" onClick={onDownload} loading={busy}>
            {labels.download}
          </Button>
        )}
        {(status === "FAILED" || status === "ARTIFACT_EXPIRED") && onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} loading={busy}>
            {labels.retry}
          </Button>
        )}
        {pending && onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            {labels.cancel}
          </Button>
        )}
      </div>
    </section>
  );
}
