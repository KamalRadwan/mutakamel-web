"use client";

import type { ReactNode } from "react";
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
  canEdit: boolean;
  canComplete: boolean;
  canDiscard: boolean;
  editingId: string | null;
  pendingId: string | null;
  onEdit: (activity: T) => void;
  onComplete: (activity: T) => void;
  onDiscard: (activity: T) => void;
  labels: { empty: string; edit: string; markDone: string; discard: string };
  describe: (activity: T) => {
    type: string;
    priority: string;
    priorityTone: BadgeProps["tone"];
    due: ReactNode;
    actions: string;
  };
}

export function ActivityList<T extends ActivityListItem>({
  activities, isLoading, error, canEdit, canComplete, canDiscard,
  editingId, pendingId, onEdit, onComplete, onDiscard, labels, describe, density = "standard",
}: ActivityListProps<T>) {
  if (isLoading) return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={`activity-skeleton-${index}`} className="h-14 rounded-sm" />
      ))}
    </div>
  );
  if (error) return <p role="alert" className="text-xs text-destructive">{error}</p>;
  if (activities.length === 0) return <EmptyState title={labels.empty} className={density === "compact" ? "py-4" : "py-8"} />;
  const hasActions = canEdit || canComplete || canDiscard;

  return (
    <ul className={cn("flex flex-col", density === "compact" ? "gap-1" : "gap-1.5")}>
      {activities.map((activity) => {
        const row = describe(activity);
        return (
          <li key={activity.id} className={cn(
            "flex flex-col gap-1 rounded-sm border border-border bg-card",
            density === "compact" ? "p-1.5" : "p-2",
            activity.id === editingId && "border-info bg-info-subtle",
          )}>
            <div className="flex items-start justify-between gap-2">
              <span className={cn("min-w-0 break-words font-medium text-foreground", density === "compact" ? "text-xs" : "text-sm")}>{activity.subject}</span>
              <div className="flex shrink-0 items-center gap-1">
                <Badge tone={row.priorityTone}>{row.priority}</Badge>
                {hasActions && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="xs" disabled={pendingId !== null} aria-label={row.actions}>
                        <MoreHorizontal className={iconSize({ size: "sm" })} aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEdit && <DropdownMenuItem onSelect={() => onEdit(activity)}>
                        <Pencil className={iconSize({ size: "sm" })} aria-hidden="true" />{labels.edit}
                      </DropdownMenuItem>}
                      {canComplete && <DropdownMenuItem onSelect={() => onComplete(activity)}>
                        <Check className={iconSize({ size: "sm" })} aria-hidden="true" />{labels.markDone}
                      </DropdownMenuItem>}
                      {canDiscard && <DropdownMenuItem onSelect={() => onDiscard(activity)}>
                        <Ban className={cn(iconSize({ size: "sm" }), "text-destructive")} aria-hidden="true" />{labels.discard}
                      </DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>{row.type}</span><span aria-hidden="true">·</span>
              <time dateTime={activity.dueAt}>{row.due}</time>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
