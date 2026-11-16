"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleX,
  History,
  PenLine,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { Avatar, AvatarFallback } from "../../primitives/Avatar";
import { Badge } from "../../primitives/Badge";
import { Button } from "../../primitives/Button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../primitives/Collapsible";
import { IdentifierText } from "../../primitives/IdentifierText";
import { Skeleton } from "../../primitives/Skeleton";
import { EmptyState } from "../empty-state/EmptyState";
import { HistoryDiffList } from "./HistoryDiffList";
import type { HistoryTone, HistoryTreeProps } from "./history-tree-types";

const MARKER_TONE_CLASS: Record<HistoryTone, string> = {
  positive: "border-border bg-success-subtle text-success-subtle-foreground",
  negative: "border-destructive bg-destructive-subtle text-destructive-subtle-foreground",
  neutral: "border-border bg-muted text-muted-foreground",
};

function defaultMarkerIcon(tone: HistoryTone) {
  if (tone === "negative") return CircleX;
  if (tone === "positive") return CircleCheck;
  return History;
}

/**
 * Canonical 3-Level Hierarchical History Tree (`@/design-system`):
 * - Level 1: `| Actor Name - Timestamp`
 * - Level 2: `  | Action Title + Optional #Reference Badge`
 * - Level 3: `    | ▸ Details of changes` (Collapsible field transitions)
 */
export function HistoryTree({
  items,
  label,
  detailsLabel,
  emptyDetailsLabel,
  openIds,
  onToggleItem,
  isLoading,
  emptyTitle,
  emptyDescription,
  onLoadMore,
  loadMoreLabel,
  isLoadingMore,
  density = "standard",
  className,
}: HistoryTreeProps) {
  if (isLoading) {
    return (
      <div className={cn("flex flex-col gap-3", className)} aria-busy="true">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (items.length === 0 && emptyTitle) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        className={cn(density === "compact" && "py-4", className)}
      />
    );
  }

  return (
    <div className={className}>
      <ol aria-label={label} className="flex flex-col">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isOpen = openIds.has(item.id);
          const tone: HistoryTone = item.tone ?? "neutral";
          const MarkerIcon = item.markerIcon ?? defaultMarkerIcon(tone);
          const ActionIcon = item.actionIcon ?? PenLine;
          const hasActor = item.actorName !== undefined && item.actorName !== null && item.actorName !== "";

          return (
            <li
              key={item.id}
              className={cn("flex", density === "compact" ? "gap-2.5" : "gap-3")}
            >
              <div className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    MARKER_TONE_CLASS[tone],
                  )}
                >
                  <MarkerIcon className="size-3" />
                </span>
                {!isLast && <span aria-hidden="true" className="w-px flex-1 bg-border" />}
              </div>

              <div
                className={cn(
                  "flex min-w-0 flex-1 flex-col gap-1.5",
                  isLast ? "pb-0" : density === "compact" ? "pb-3" : "pb-4",
                )}
              >
                {/* Level 1: Actor Name - Timestamp */}
                <div className="flex flex-wrap items-center gap-2">
                  {hasActor ? (
                    <>
                      {item.actorInitials ? (
                        <Avatar className="size-5">
                          <AvatarFallback className="text-xs">
                            {item.actorInitials}
                          </AvatarFallback>
                        </Avatar>
                      ) : null}
                      <span className="text-xs font-semibold text-foreground">
                        {item.actorName}
                      </span>
                      <span aria-hidden="true" className="text-xs text-muted-foreground">
                        -
                      </span>
                    </>
                  ) : null}
                  <span className="text-xs text-muted-foreground">{item.timestamp}</span>
                </div>

                {/* Level 2: Action Title + Optional Reference Badge */}
                <div className="ms-2.5 flex flex-col gap-1.5 border-s border-border ps-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-0.5 text-xs font-semibold text-foreground">
                      <ActionIcon
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span>{item.actionTitle}</span>
                    </span>
                    {item.referenceLabel ? (
                      item.referenceHref ? (
                        <Link href={item.referenceHref} className="inline-flex">
                          <Badge tone="brand" size="sm" className="hover:opacity-85">
                            <IdentifierText>{item.referenceLabel}</IdentifierText>
                          </Badge>
                        </Link>
                      ) : (
                        <Badge tone="neutral" size="sm">
                          <IdentifierText>{item.referenceLabel}</IdentifierText>
                        </Badge>
                      )
                    ) : null}
                    {item.badges}
                  </div>

                  {/* Level 3: Collapsible Details of changes */}
                  <Collapsible
                    open={isOpen}
                    onOpenChange={(next) => onToggleItem(item.id, next)}
                    className="ms-2 border-s border-border/70 ps-3"
                  >
                    <CollapsibleTrigger className="py-0.5 text-xs text-muted-foreground hover:text-foreground">
                      {isOpen ? (
                        <ChevronDown
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : (
                        <ChevronRight
                          className="size-3.5 shrink-0 text-muted-foreground rtl:-scale-x-100"
                          aria-hidden="true"
                        />
                      )}
                      <span>{detailsLabel}</span>
                      {item.changeCountLabel ? (
                        <Badge tone="neutral" size="default">
                          {item.changeCountLabel}
                        </Badge>
                      ) : null}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-1.5">
                      <div className="rounded-md border border-border bg-muted/30 p-2.5">
                        {item.details ?? (
                          <HistoryDiffList
                            rows={item.diffs ?? []}
                            emptyMessage={emptyDetailsLabel}
                            footer={item.detailsFooter}
                          />
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {onLoadMore && loadMoreLabel ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onLoadMore}
          loading={isLoadingMore}
          className="mt-3 cursor-pointer"
        >
          {loadMoreLabel}
        </Button>
      ) : null}
    </div>
  );
}
