import type { ReactNode } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { Badge } from "../../primitives/Badge";
import { cn } from "../../lib/cn";
import type { BoardColumnDef } from "./types";

const OUTCOME_BORDER: Record<NonNullable<BoardColumnDef["outcomeRole"]>, string> = {
  positive: "border-t-positive-500",
  negative: "border-t-negative-500",
  caution: "border-t-caution-500",
};

export interface BoardColumnProps {
  column: BoardColumnDef;
  emptyLabel: string;
  children: ReactNode;
}

// Fixed 280px width — the row scrolls horizontally, never the page. A 2px
// top border in the mapped outcome role only when the stage carries one;
// intermediate stages get no color at all — stage is conveyed by column
// position and label, never a hue. See docs/design/DESIGN-SYSTEM.md#board-view.
export function BoardColumn({ column, emptyLabel, children }: BoardColumnProps) {
  return (
    <div
      className={cn(
        "flex w-70 shrink-0 flex-col rounded-md border border-border bg-card",
        column.outcomeRole ? cn("border-t-2", OUTCOME_BORDER[column.outcomeRole]) : "",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-medium text-foreground">{column.label}</span>
          <Badge tone="neutral">{column.count}</Badge>
          {column.overdueCount !== undefined && column.overdueCount > 0 && (
            <span className="size-1.5 shrink-0 rounded-full bg-caution-500" aria-hidden="true" />
          )}
        </div>
        {column.amountLabel && (
          <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
            {column.amountLabel}
          </span>
        )}
      </div>

      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex flex-1 flex-col gap-1.5 overflow-y-auto p-1.5",
              snapshot.isDraggingOver && "bg-accent",
            )}
          >
            {/* Empty column shows a dashed drop zone — never blank space,
                which reads as broken. Still rendered (not swapped out) while
                dragging over an empty column, so it stays a valid drop
                target for the placeholder below. */}
            {column.count === 0 && (
              <div className="flex min-h-16 flex-1 items-center justify-center rounded-sm border border-dashed border-ink-300 text-2xs text-muted-foreground">
                {emptyLabel}
              </div>
            )}
            {children}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
