"use client";

import { useId, type ReactNode } from "react";
import { Ban, Check, MoreHorizontal, Pencil, X } from "lucide-react";
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
  selectedId?: string | null;
  editingId: string | null;
  pendingId: string | null;
  /** Renders direct Done / Edit / Cancel quick action pills at the bottom of each card. */
  inlineQuickActions?: boolean;
  /** Optional custom empty state node rendered when activities is empty. */
  emptySlot?: ReactNode;
  /** A menu entry exists only when both its handler and its permission do. */
  onEdit?: (activity: T) => void;
  onComplete?: (activity: T) => void;
  onDiscard?: (activity: T) => void;
  labels: { empty: string; edit: string; markDone: string; doneShort?: string; discard: string };
  describe: (activity: T) => {
    type: string;
    typeIcon?: ReactNode;
    typeBadgeClassName?: string;
    accentClassName?: string;
    dueStateLabel?: string;
    dueStateClassName?: string;
    stateBadge?: ReactNode;
    statusLabel?: string;
    assignee?: string | null;
    priority: string;
    priorityTone: BadgeProps["tone"];
    due: ReactNode;
    actions: string;
  };
}

export function ActivityList<T extends ActivityListItem>(props: ActivityListProps<T>) {
  const { activities, isLoading, error, labels, density = "standard", emptySlot } = props;
  if (isLoading) return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={`activity-skeleton-${index}`} className="h-16 rounded-md" />
      ))}
    </div>
  );
  if (error) return <p role="alert" className="text-xs text-destructive">{error}</p>;
  if (activities.length === 0) {
    if (emptySlot) return <>{emptySlot}</>;
    return <EmptyState title={labels.empty} className={density === "compact" ? "py-4" : "py-8"} />;
  }

  return (
    <ul className={cn("flex flex-col", density === "compact" ? "gap-2.5" : "gap-3")}>
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
  onOpen, selectedId, editingId, pendingId, inlineQuickActions, onEdit, onComplete, onDiscard, labels, describe,
}: ActivityListProps<T> & { activity: T }) {
  const id = useId();
  const row = describe(activity);
  const edit = allows(onEdit, canEditItem, canEdit, activity);
  const complete = allows(onComplete, canCompleteItem, canComplete, activity);
  const discard = allows(onDiscard, canDiscardItem, canDiscard, activity);
  const isEditing = activity.id === editingId;
  const isSelected = activity.id === selectedId;
  const disabled = pendingId !== null;

  if (inlineQuickActions) {
    const railHeaderContent = (
      <span className="flex min-w-0 flex-1 items-start gap-2.5">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md border",
            row.typeBadgeClassName ?? "border-transparent bg-muted text-foreground",
          )}
        >
          {row.typeIcon}
          <span className="sr-only">{row.type}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            id={`${id}-subject`}
            className="min-w-0 break-words text-xs font-semibold leading-snug text-foreground"
          >
            {activity.subject}
          </span>
          <span id={`${id}-schedule`} className="flex flex-wrap items-center gap-1 text-2xs font-medium text-muted-foreground">
            <time dateTime={activity.dueAt}>{row.due}</time>
          </span>
        </span>
      </span>
    );

    return (
      <li
        className={cn(
          "flex flex-col gap-2.5 rounded-lg border border-border bg-card p-3 transition-all",
          row.accentClassName && cn("border-s-4", row.accentClassName),
          isSelected && !isEditing && "border-primary bg-selected/60 ring-2 ring-ring/20",
          isEditing && "border-warning bg-warning-subtle/40 ring-2 ring-warning/25",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          {onOpen ? (
            <Button
              variant="ghost"
              onClick={() => onOpen(activity)}
              aria-labelledby={`${id}-subject`}
              aria-describedby={`${id}-schedule`}
              className="-mx-1 -my-0.5 h-auto min-w-0 flex-1 items-start justify-start px-1 py-0.5 text-start font-normal whitespace-normal"
            >
              {railHeaderContent}
            </Button>
          ) : (
            <div className="flex min-w-0 flex-1">{railHeaderContent}</div>
          )}
          {row.dueStateLabel && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-2xs font-semibold",
                row.dueStateClassName ?? "border-border bg-muted text-muted-foreground",
              )}
            >
              {row.dueStateLabel}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-1.5 border-t border-dashed border-border pt-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Badge tone={row.priorityTone} className="rounded-md px-1.5 py-0.5 text-2xs font-semibold normal-case tracking-normal">
              {row.priority}
            </Badge>
            {row.stateBadge ?? (
              <span className="truncate text-2xs font-medium text-muted-foreground">
                {row.statusLabel ?? row.assignee}
              </span>
            )}
          </div>

          {(edit || complete || discard) && (
            <div className="ms-auto flex shrink-0 items-center gap-1">
              {complete && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={disabled}
                  aria-label={labels.markDone}
                  onClick={() => onComplete?.(activity)}
                  className="h-6 gap-1 rounded-md border-success/35 bg-success-subtle px-2 text-2xs font-semibold text-success-subtle-foreground hover:bg-success-subtle/80"
                >
                  <Check className={iconSize({ size: "xs" })} aria-hidden="true" />
                  <span>{labels.doneShort ?? labels.markDone}</span>
                </Button>
              )}
              {edit && (
                <Button
                  type="button"
                  variant={isEditing ? "secondary" : "outline"}
                  size="xs"
                  disabled={disabled}
                  aria-label={labels.edit}
                  onClick={() => onEdit?.(activity)}
                  className={cn(
                    "h-6 gap-1 rounded-md px-2 text-2xs font-semibold",
                    isEditing
                      ? "border-warning/40 bg-warning-subtle text-warning-subtle-foreground"
                      : "border-info/30 bg-info-subtle text-info-subtle-foreground hover:bg-info-subtle/80",
                  )}
                >
                  <Pencil className={iconSize({ size: "xs" })} aria-hidden="true" />
                  <span>{labels.edit}</span>
                </Button>
              )}
              {discard && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={disabled}
                  aria-label={labels.discard}
                  onClick={() => onDiscard?.(activity)}
                  className="size-6 rounded-md border-destructive/30 bg-destructive-subtle p-0 text-destructive-subtle-foreground hover:bg-destructive-subtle/80"
                >
                  <X className={iconSize({ size: "xs" })} aria-hidden="true" />
                </Button>
              )}
            </div>
          )}
        </div>
      </li>
    );
  }

  // Phrasing content only: when the row opens, all of it sits inside a button.
  const content = (
    <>
      <span className="flex w-full flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-2xs font-semibold",
            row.typeBadgeClassName ?? "border-border bg-muted text-foreground",
          )}
        >
          {row.typeIcon}
          <span>{row.type}</span>
        </span>
        {row.dueStateLabel && (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-1.5 py-0.5 text-2xs font-medium",
              row.dueStateClassName ?? "border-border bg-muted text-muted-foreground",
            )}
          >
            {row.dueStateLabel}
          </span>
        )}
        {row.stateBadge}
      </span>
      <span id={`${id}-subject`} className={cn("min-w-0 break-words font-semibold text-foreground", density === "compact" ? "text-xs" : "text-sm")}>
        {activity.subject}
      </span>
      <span id={`${id}-schedule`} className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <time dateTime={activity.dueAt}>{row.due}</time>
        {row.assignee && (
          <>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-foreground/80">{row.assignee}</span>
          </>
        )}
      </span>
    </>
  );

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-md border border-border bg-card transition-colors",
        row.accentClassName && cn("border-s-4", row.accentClassName),
        density === "compact" ? "p-2.5" : "p-3",
        isSelected && !isEditing && "border-primary bg-selected/60 ring-2 ring-ring/20",
        isEditing && "border-warning bg-warning-subtle/40 ring-2 ring-warning/25",
      )}
    >
      <div className="flex items-start gap-2">
        {onOpen ? (
          // Named by the subject and described by the schedule, so a screen
          // reader hears the activity first rather than one run-on string.
          <Button
            variant="ghost"
            onClick={() => onOpen(activity)}
            aria-labelledby={`${id}-subject`}
            aria-describedby={`${id}-schedule`}
            className="-mx-1 -my-0.5 h-auto min-w-0 flex-1 flex-col items-start justify-start gap-1.5 px-1 py-0.5 text-start font-normal whitespace-normal"
          >
            {content}
          </Button>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">{content}</div>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <Badge tone={row.priorityTone}>{row.priority}</Badge>
          {(edit || complete || discard) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="xs" disabled={disabled} aria-label={row.actions}>
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
      </div>
    </li>
  );
}

