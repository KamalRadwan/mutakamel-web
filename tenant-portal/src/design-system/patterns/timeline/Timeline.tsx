"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { iconSize } from "../../lib/icons";
import { Button } from "../../primitives/Button";
import { Skeleton } from "../../primitives/Skeleton";
import { EmptyState } from "../empty-state/EmptyState";

/** Outcome, never type. See the note on `TimelineEvent.tone`. */
export type TimelineTone = "positive" | "caution" | "negative";

export interface TimelineEvent {
  id: string;
  /** Already translated. Never a raw wire enum — every value needs a `t.status.*` label. */
  title: string;
  description?: React.ReactNode;
  /** Already formatted — a `DateTime` node, not an ISO string. */
  timestamp: React.ReactNode;
  /** Who did it. Omitted for a system event. */
  actor?: string;
  /**
   * **Outcome only.** An event *type* never takes a hue — a "note added" and a
   * "stage changed" are categories, and colouring them is the hue-coded-control
   * anti-pattern arriving one row at a time. A delivery attempt that *failed*
   * is `negative` because failure is an outcome; "email sent" takes no tone.
   * See docs/design/tokens.md#non-outcome-values--never-a-hue and MASTER-PLAN 1.44.
   */
  tone?: TimelineTone;
  /** In progress — ink plus the pulsing dot, never a fifth hue. */
  pending?: boolean;
  /** Distinguishes categories where colour may not. Rendered inside the marker. */
  icon?: LucideIcon;
  /** A diff, a reason, a nested `AttachmentList`. */
  children?: React.ReactNode;
}

export interface TimelineProps {
  events: TimelineEvent[];
  /** Accessible name — "Audit history", "Delivery attempts", "Approval ladder". */
  label: string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Cursor paging for a long history. Omit when everything is already loaded. */
  onLoadMore?: () => void;
  loadMoreLabel?: string;
  isLoadingMore?: boolean;
  className?: string;
}

const MARKER_BY_TONE: Record<TimelineTone, string> = {
  positive: "border-positive-700 bg-positive-700 dark:border-positive-400 dark:bg-positive-400",
  caution: "border-caution-700 bg-caution-700 dark:border-caution-400 dark:bg-caution-400",
  negative: "border-destructive bg-destructive",
};

const NEUTRAL_MARKER = "border-border bg-muted";

/**
 * Audit history, stage history, delivery attempts, approval ladders.
 *
 * One rail, one marker per event, newest first — the caller supplies the
 * order; this pattern never sorts, because "newest first" and "oldest first"
 * are both correct depending on whether the reader is auditing or following a
 * process.
 */
export function Timeline({
  events,
  label,
  isLoading,
  emptyTitle,
  emptyDescription,
  onLoadMore,
  loadMoreLabel,
  isLoadingMore,
  className,
}: TimelineProps) {
  if (isLoading) {
    return (
      <div className={cn("flex flex-col gap-3", className)} aria-busy="true">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (events.length === 0 && emptyTitle) {
    return <EmptyState title={emptyTitle} description={emptyDescription} className={className} />;
  }

  return (
    <div className={className}>
      <ol aria-label={label} className="flex flex-col">
        {events.map((event, index) => {
          const Icon = event.icon;
          const isLast = index === events.length - 1;

          return (
            <li key={event.id} className="flex gap-3">
              {/* The rail and the marker are one column so the connector is a
                  border on a box that already exists, rather than an absolutely
                  positioned pseudo-element that has to be told which side it is
                  on in RTL. */}
              <div className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    event.tone ? MARKER_BY_TONE[event.tone] : NEUTRAL_MARKER,
                    // Motion carries "in progress" so no fifth hue has to —
                    // docs/design/motion.md#the-pending-dot.
                    event.pending && "dot-pending",
                  )}
                >
                  {Icon && <Icon className={cn(iconSize({ size: "xs" }), "text-background")} />}
                </span>
                {!isLast && <span aria-hidden="true" className="w-px flex-1 bg-border" />}
              </div>

              <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", isLast ? "pb-0" : "pb-4")}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-xs font-medium text-foreground">{event.title}</span>
                  <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                </div>
                {event.actor && <span className="text-xs text-muted-foreground">{event.actor}</span>}
                {event.description && (
                  <div className="text-xs text-muted-foreground">{event.description}</div>
                )}
                {event.children}
              </div>
            </li>
          );
        })}
      </ol>

      {onLoadMore && loadMoreLabel && (
        <Button
          variant="outline"
          size="sm"
          onClick={onLoadMore}
          loading={isLoadingMore}
          className="mt-3 cursor-pointer"
        >
          {loadMoreLabel}
        </Button>
      )}
    </div>
  );
}
