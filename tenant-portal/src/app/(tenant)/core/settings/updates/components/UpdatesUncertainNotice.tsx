"use client";

import { CircleAlert } from "lucide-react";
import { Button, cn, proseMeasure } from "@/design-system";

interface UpdatesUncertainNoticeProps {
  title: string;
  description: string;
  hint?: string | null;
  errorDetail?: string | null;
  retryLabel: string;
  onRetry: () => void;
  isRetrying?: boolean;
  retryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  isSecondaryLoading?: boolean;
}

export function UpdatesUncertainNotice({
  title,
  description,
  hint,
  errorDetail,
  retryLabel,
  onRetry,
  isRetrying = false,
  retryDisabled = false,
  secondaryLabel,
  onSecondary,
  isSecondaryLoading = false,
}: UpdatesUncertainNoticeProps) {
  return (
    <section
      role="status"
      className="flex flex-col gap-2.5 rounded-md border border-border bg-warning-subtle p-3 text-warning-subtle-foreground"
    >
      <div className="flex items-start gap-2">
        <CircleAlert
          className="mt-0.5 size-4 shrink-0 text-warning-subtle-foreground"
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-sm font-medium">{title}</h2>
          <p className={cn("text-xs", proseMeasure)}>{description}</p>
          {errorDetail ? <p className={cn("text-xs font-medium", proseMeasure)}>{errorDetail}</p> : null}
          {hint ? <p className={cn("text-badge opacity-90", proseMeasure)}>{hint}</p> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          loading={isRetrying}
          disabled={retryDisabled || isRetrying}
        >
          {retryLabel}
        </Button>
        {onSecondary && secondaryLabel ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSecondary}
            loading={isSecondaryLoading}
            disabled={isRetrying || isSecondaryLoading}
          >
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
