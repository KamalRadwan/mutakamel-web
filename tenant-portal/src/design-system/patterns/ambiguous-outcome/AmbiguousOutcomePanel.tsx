"use client";

import { CircleAlert } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/Button";

export interface AmbiguousOutcomeLabels {
  title: string;
  operation: string;
  idempotencyKey: string;
  correlationId: string;
  retry: string;
  dismiss: string;
}

export interface AmbiguousOutcomePanelProps {
  /** The write that may or may not have applied — already translated. */
  operation: string;
  /** The key the original request carried. Retrying with it is what makes the retry safe. */
  idempotencyKey: string;
  description: string;
  /** Must replay the SAME idempotency key. A fresh key is a second write, not a retry. */
  onRetry: () => void;
  /** The user resolving the condition — the only thing that removes this panel. */
  onDismiss: () => void;
  correlationId?: string;
  retrying?: boolean;
  className?: string;
  labels: AmbiguousOutcomeLabels;
}

// A write that timed out, or failed after the request was already sent, may or
// may not have applied. Its idempotency key is the only way to retry safely,
// so that evidence must NOT live in a 4-second toast — it renders in-body and
// persists until the user resolves it. See
// docs/design/patterns.md#ambiguous-outcomes.
//
// This pattern deliberately does not import useToast: pairing an in-body
// feedback surface with a toast is the review smell that rule exists to catch.
export function AmbiguousOutcomePanel({
  operation,
  idempotencyKey,
  description,
  onRetry,
  onDismiss,
  correlationId,
  retrying,
  className,
  labels,
}: AmbiguousOutcomePanelProps) {
  return (
    <section
      role="status"
      className={cn(
        "flex flex-col gap-2.5 rounded-sm border border-caution-200 bg-caution-100 p-3",
        "dark:border-caution-800 dark:bg-caution-950",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <CircleAlert
          className="mt-0.5 size-4 shrink-0 text-caution-700 dark:text-caution-400"
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-sm font-medium text-caution-800 dark:text-caution-300">
            {labels.title}
          </h2>
          <p className="text-xs text-caution-800 dark:text-caution-300">{description}</p>
        </div>
      </div>

      <dl className="flex flex-col gap-1.5 text-xs">
        <Evidence label={labels.operation}>{operation}</Evidence>
        <Evidence label={labels.idempotencyKey} monospace>
          {idempotencyKey}
        </Evidence>
        {correlationId && (
          <Evidence label={labels.correlationId} monospace>
            {correlationId}
          </Evidence>
        )}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} loading={retrying}>
          {labels.retry}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss} disabled={retrying}>
          {labels.dismiss}
        </Button>
      </div>
    </section>
  );
}

function Evidence({
  label,
  monospace,
  children,
}: {
  label: string;
  monospace?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
      <dt className="shrink-0 text-caution-700 dark:text-caution-400">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-caution-900 dark:text-caution-200",
          // select-all so the key can be copied in one gesture — there is no
          // CopyButton primitive yet (MASTER-PLAN 1.14).
          monospace && "font-mono break-all select-all",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
