"use client";

import { Droppable } from "@hello-pangea/dnd";
import { Badge } from "../../primitives/Badge";
import { cn } from "../../lib/cn";
import { BoardCard, type BoardCardModel } from "./BoardCard";
import { ColumnSegmentBar } from "./ColumnSegmentBar";
import { VirtualColumnBody } from "./VirtualColumnBody";
import { VIRTUALIZE_ABOVE } from "./useColumnWindow";
import type { BoardColumnDef } from "./types";

const OUTCOME_BORDER: Record<NonNullable<BoardColumnDef["outcomeRole"]>, string> = {
  positive: "border-t-positive-500",
  negative: "border-t-negative-500",
  caution: "border-t-caution-500",
};

// The padding both bodies share, so a column does not visibly change inset
// when it crosses the threshold.
//
// It is ALL they share. The unwindowed body is a flex column and scrolls
// itself; react-window builds its own scroll container and sizes it in pixels,
// and handing that container `flex flex-col` would make its inner sizer — a
// div whose whole job is to be `height: <total>` — a flex item with
// `flex-shrink: 1`. It would collapse to the viewport height and the column
// would stop scrolling past its first window. jsdom has no layout and would
// never catch it.
const COLUMN_BODY_PADDING = "p-1.5";

// A plain overflow-y-auto element, deliberately NOT a Radix ScrollArea —
// task 2.17.
//
// `min-h-0` is not decoration. `flex-1` alone leaves a column flex item at
// `min-height: auto`, and the only reason that resolves to 0 here is the
// `overflow-y-auto` sitting beside it. Stating it makes the internal scroll
// independent of that coincidence: whatever else changes on this element, the
// body shrinks to the column and the CARDS scroll — never the row, and never
// the page.
const COLUMN_BODY_CLASS = `flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto ${COLUMN_BODY_PADDING}`;

export interface BoardColumnProps {
  column: BoardColumnDef;
  emptyLabel: string;
  // The cards this column renders RIGHT NOW, which is not the same as
  // column.count: the count is the server's total for the stage, and a column
  // whose first page has not arrived still needs the drop zone rather than a
  // blank body.
  cards: BoardCardModel[];
}

// Fixed 280px width — the row scrolls horizontally, never the page. A 2px
// top border in the mapped outcome role only when the stage carries one;
// intermediate stages get no color at all — stage is conveyed by column
// position and label, never a hue. See docs/design/DESIGN-SYSTEM.md#board-view.
//
// `h-full min-h-0` is what makes every column run to the bottom of the pane,
// so a stage holding one card lines up with the stage holding forty and the
// drop zone covers the whole column rather than the inch its cards occupy.
// The row's default `align-items: stretch` produced the same height, and that
// is exactly the problem: it is a default, invisible at this call site, and one
// `items-start` on the row away from silently collapsing every column back onto
// its content. Asked for here, it holds whatever the row does.
export function BoardColumn({ column, emptyLabel, cards }: BoardColumnProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-70 shrink-0 flex-col rounded-md border border-border bg-card",
        column.outcomeRole ? cn("border-t-2", OUTCOME_BORDER[column.outcomeRole]) : "",
      )}
    >
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-border px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
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

        {/* Inside the heading block, not floating above the column, so the
            bars across the row share one baseline whatever the labels wrap
            to. It is a picture of the CARDS THIS COLUMN CURRENTLY HOLDS —
            see ColumnSegmentBar and the caller that builds the segments. */}
        {column.segments && column.segmentsLabel && (
          <ColumnSegmentBar segments={column.segments} label={column.segmentsLabel} />
        )}
      </div>

      {/* Two bodies, one droppable id, chosen by card count. Windowing a short
          column would buy nothing and cost the empty column its drop zone and
          every card its place in find-in-page, so the threshold is a real
          switch and not a tuning knob. A column crossing it swaps droppable
          mode, which only happens when the DATA changes — never mid-drag,
          because counts move on drop. */}
      {cards.length > VIRTUALIZE_ABOVE ? (
        <VirtualColumnBody columnId={column.id} cards={cards} className={COLUMN_BODY_PADDING} />
      ) : (
        <StandardColumnBody columnId={column.id} cards={cards} emptyLabel={emptyLabel} />
      )}
    </div>
  );
}

function StandardColumnBody({
  columnId,
  cards,
  emptyLabel,
}: {
  columnId: string;
  cards: BoardCardModel[];
  emptyLabel: string;
}) {
  return (
    <Droppable droppableId={columnId}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={cn(COLUMN_BODY_CLASS, snapshot.isDraggingOver && "bg-accent")}
        >
          {/* Empty column shows a dashed drop zone — never blank space,
              which reads as broken. Still rendered (not swapped out) while
              dragging over an empty column, so it stays a valid drop
              target for the placeholder below. */}
          {cards.length === 0 && (
            <div className="flex min-h-16 flex-1 items-center justify-center rounded-sm border border-dashed border-ink-300 text-2xs text-muted-foreground">
              {emptyLabel}
            </div>
          )}
          {cards.map((card, index) => (
            <BoardCard key={card.id} card={card} index={index} />
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}
