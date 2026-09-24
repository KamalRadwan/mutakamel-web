"use client";

import { useId, type ReactNode } from "react";
import { Ban, Check, MoreHorizontal, Pencil } from "lucide-react";
import { cn } from "../../lib/cn";
import { iconSize } from "../../lib/icons";
import { Badge, type BadgeProps } from "../../primitives/Badge";
import { Button } from "../../primitives/Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../primitives/DropdownMenu";
import { Skeleton } from "../../primitives/Skeleton";
import { EmptyState } from "../empty-state/EmptyState";

export interface ActivityListItem {
  id: string;
  subject: string;
  dueAt: string;
}

/** API-free activity cards shared by dialogs and record side panels. */
export interface ActivityListProps<T extends ActivityListItem> {
  activities: T[];
  isLoading: boolean;
  error: string | null;
  density?: "standard" | "compact";
  /** List-wide switches for the row menu. A per-row predicate, when given, answers instead. */
  canEdit?: boolean;
  canComplete?: boolean;
  canDiscard?: boolean;
  /**
   * Whether the actor may act on THIS row — an assignee-or-creator rule the
   * list-wide switches cannot express. Each takes precedence over its switch.
   */
  canEditItem?: (activity: T) => boolean;
  canCompleteItem?: (activity: T) => boolean;
  canDiscardItem?: (activity: T) => boolean;
  /**
   * Makes each row's subject and schedule one activation surface that opens
   * the activity. The priority badge and the actions menu stay outside it, so
   * no control is ever nested inside another.
   */
  onOpen?: (activity: T) => void;
  editingId: string | null;
  pendingId: string | null;
  /** A menu entry exists only when both its handler and its permission do. */
  onEdit?: (activity: T) => void;
  onComplete?: (activity: T) => void;
  onDiscard?: (activity: T) => void;
  labels: { empty: string; edit: string; markDone: string; discard: string };
  describe: (activity: T) => {
    type: string;
    priority: string;
    priorityTone: BadgeProps["tone"];
    due: ReactNode;
    actions: string;
  };
}

export function ActivityList<T extends ActivityListItem>(props: ActivityListProps<T>) {
  const { activities, isLoading, error, labels, density = "standard" } = props;
  if (isLoading) return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={`activity-skeleton-${index}`} className="h-14 rounded-sm" />
      ))}
    </div>
  );
  if (error) return <p role="alert" className="text-xs text-destructive">{error}</p>;
  if (activities.length === 0) return <EmptyState title={labels.empty} className={density === "compact" ? "py-4" : "py-8"} />;

  return (
    <ul className={cn("flex flex-col", density === "compact" ? "gap-1" : "gap-1.5")}>
      {activities.map((activity) => (
        <ActivityListRow key={activity.id} {...props} activity={activity} />
      ))}
    </ul>
  );
}

function allows<T>(
  handler: ((activity: T) => void) | undefined,
  perRow: ((activity: T) => boolean) | undefined,
  listWide: boolean | undefined,
  activity: T,
): boolean {
  return handler !== undefined && (perRow ? perRow(activity) : listWide === true);
}

function ActivityListRow<T extends ActivityListItem>({
  activity, density = "standard", canEdit, canComplete, canDiscard, canEditItem, canCompleteItem, canDiscardItem,
  onOpen, editingId, pendingId, onEdit, onComplete, onDiscard, labels, describe,
}: ActivityListProps<T> & { activity: T }) {
  const id = useId();
  const row = describe(activity);
  const edit = allows(onEdit, canEditItem, canEdit, activity);
  const complete = allows(onComplete, canCompleteItem, canComplete, activity);
  const discard = allows(onDiscard, canDiscardItem, canDiscard, activity);
  // Phrasing content only: when the row opens, all of it sits inside a button.
  const content = (
    <>
      <span id={`${id}-subject`} className={cn("min-w-0 break-words font-medium text-foreground", density === "compact" ? "text-xs" : "text-sm")}>
        {activity.subject}
      </span>
      <span id={`${id}-schedule`} className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>{row.type}</span><span aria-hidden="true">·</span>
        <time dateTime={activity.dueAt}>{row.due}</time>
      </span>
    </>
  );

  return (
    <li className={cn(
      "flex items-start gap-2 rounded-sm border border-border bg-card",
      density === "compact" ? "p-1.5" : "p-2",
      activity.id === editingId && "border-info bg-info-subtle",
    )}>
      {onOpen ? (
        // Named by the subject and described by the schedule, so a screen
        // reader hears the activity first rather than one run-on string.
        <Button
          variant="ghost"
          onClick={() => onOpen(activity)}
          aria-labelledby={`${id}-subject`}
          aria-describedby={`${id}-schedule`}
          className="-mx-1 -my-0.5 h-auto min-w-0 flex-1 flex-col items-start justify-start gap-1 px-1 py-0.5 text-start font-normal whitespace-normal"
        >
          {content}
        </Button>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-1">{content}</div>
      )}
      <div className="flex shrink-0 items-center gap-1">
        <Badge tone={row.priorityTone}>{row.priority}</Badge>
        {(edit || complete || discard) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs" disabled={pendingId !== null} aria-label={row.actions}>
                <MoreHorizontal className={iconSize({ size: "sm" })} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {edit && <DropdownMenuItem onSelect={() => onEdit?.(activity)}>
                <Pencil className={iconSize({ size: "sm" })} aria-hidden="true" />{labels.edit}
              </DropdownMenuItem>}
              {complete && <DropdownMenuItem onSelect={() => onComplete?.(activity)}>
                <Check className={iconSize({ size: "sm" })} aria-hidden="true" />{labels.markDone}
              </DropdownMenuItem>}
              {discard && <DropdownMenuItem onSelect={() => onDiscard?.(activity)}>
                <Ban className={cn(iconSize({ size: "sm" }), "text-destructive")} aria-hidden="true" />{labels.discard}
              </DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );
}
