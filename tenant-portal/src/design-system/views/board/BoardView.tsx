"use client";

import { type ReactNode, useMemo } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { Skeleton } from "../../primitives/Skeleton";
import { EmptyState } from "../../patterns/empty-state/EmptyState";
import { ErrorState } from "../../patterns/error-state/ErrorState";
import { Pagination } from "../../patterns/pagination/Pagination";
import { cn } from "../../lib/cn";
import { useScrollRestoration } from "../useScrollRestoration";
import type { WorkspaceViewLabels, WorkspaceViewProps } from "../types";
import type { BoardCardModel } from "./BoardCard";
import { BoardColumn } from "./BoardColumn";
import type { MoveToTarget } from "./MoveToMenu";
import type { BoardColumnDef } from "./types";

export interface BoardCardMove {
  itemId: string;
  fromColumnId: string;
  toColumnId: string;
  toIndex: number;
}

export interface BoardViewLabels extends WorkspaceViewLabels {
  emptyColumn: string;
  // Omitting this removes the "Move to…" trigger from every card, and with it
  // the board's only single-pointer alternative to dragging (WCAG 2.2 AA
  // `dragging-alternative`). A screen that omits it owes its users that
  // alternative somewhere else.
  moveTo?: string;
}

// The board implements the shared contract minus sorting, and that omission is
// typed rather than silent: a board's order IS its grouping axis, so there is
// nothing for a sort control to act on. Sorting lives in the card and table
// views — see docs/design/views.md#the-shared-contract.
export interface BoardViewProps<T> extends Omit<WorkspaceViewProps<T>, "sort" | "onSortChange" | "labels"> {
  columns: BoardColumnDef[];
  // Which column an item belongs to. The board groups `items` itself instead
  // of taking a pre-grouped record, so all three views are driven by one list
  // and their prop sets cannot drift apart again (V1).
  columnOf: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  // Per-card controls that must not open the card — they render outside the
  // activation surface, beside the "Move to…" trigger.
  renderActions?: (item: T) => ReactNode;
  // A full-width strip below the card's header row, also outside the
  // activation surface: the place for a control that has to sit on its own
  // line and still not open the card.
  renderFooter?: (item: T) => ReactNode;
  // Per-card surface classes — a user-chosen card colour, and nothing that
  // changes the card's size.
  cardClassName?: (item: T) => string | undefined;
  canDrag?: (item: T) => boolean;
  // Which destinations "Move to…" may offer for an item. Defaults to every
  // column except the one it is already in. Gate it with the same rule that
  // gates dragging, so the two paths cannot disagree.
  canMoveTo?: (item: T, columnId: string) => boolean;
  // A terminal move (into WON/LOST/CONVERTED/DISQUALIFIED) is not freely
  // reversible — return false to leave the card where it was without calling
  // onCardMove. Applies identically to a drag and to a "Move to…" choice.
  confirmMove?: (move: BoardCardMove) => boolean | Promise<boolean>;
  onCardMove: (move: BoardCardMove) => void;
  labels: BoardViewLabels;
}

// Horizontally scrolling flex row of fixed-width columns — the row scrolls,
// the page does not. Generic and prop-driven: never fetches, never reads the
// dictionary, never knows which entity it renders, never owns the mutation.
// Optimistic move and rollback live in the caller's data; this view renders
// whatever `items` it is handed at any moment. See docs/design/views.md#board-view.
export function BoardView<T>({
  columns,
  columnOf,
  items,
  itemKey,
  renderCard,
  renderActions,
  renderFooter,
  cardClassName,
  canDrag,
  canMoveTo,
  confirmMove,
  onCardMove,
  isLoading,
  error,
  onRetry,
  emptyState,
  page,
  onPageChange,
  selection,
  onActivate,
  labels,
  className,
}: BoardViewProps<T>) {
  const setScrollElement = useScrollRestoration("board");

  const grouped = useMemo(() => {
    const byColumn = new Map<string, T[]>(columns.map((column) => [column.id, []]));
    for (const item of items) {
      byColumn.get(columnOf(item))?.push(item);
    }
    return byColumn;
  }, [columns, columnOf, items]);

  async function commitMove(move: BoardCardMove) {
    if (confirmMove) {
      const allowed = await confirmMove(move);
      if (!allowed) return;
    }
    onCardMove(move);
  }

  function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    void commitMove({
      itemId: draggableId,
      fromColumnId: source.droppableId,
      toColumnId: destination.droppableId,
      toIndex: destination.index,
    });
  }

  function moveTargetsFor(item: T, fromColumnId: string): MoveToTarget[] {
    if (canDrag && !canDrag(item)) return [];
    return columns
      .filter((column) => column.id !== fromColumnId && (canMoveTo ? canMoveTo(item, column.id) : true))
      .map((column) => ({ id: column.id, label: column.label }));
  }

  function toggleSelected(id: string, isSelected: boolean) {
    if (!selection) return;
    const next = new Set(selection.selectedIds);
    if (isSelected) next.add(id);
    else next.delete(id);
    selection.onSelectionChange(next);
  }

  // Every card in a column, as data rather than as elements. A windowed
  // column decides for itself which of these reach the DOM, so the board must
  // not have already turned them into mounted <BoardCard>s — that is the whole
  // difference between a list of 200 cards and 200 rendered cards.
  function cardsFor(columnId: string): BoardCardModel[] {
    return (grouped.get(columnId) ?? []).map((item) => {
      const id = itemKey(item);
      return {
        id,
        isDragDisabled: canDrag ? !canDrag(item) : false,
        onActivate: onActivate ? () => onActivate(item) : undefined,
        isSelected: selection?.selectedIds.has(id) ?? false,
        onSelectedChange: selection ? (next: boolean) => toggleSelected(id, next) : undefined,
        selectLabel: labels.selectRow,
        moveTargets: moveTargetsFor(item, columnId),
        onMoveTo: (toColumnId: string) =>
          void commitMove({
            itemId: id,
            fromColumnId: columnId,
            toColumnId,
            toIndex: grouped.get(toColumnId)?.length ?? 0,
          }),
        moveToLabel: labels.moveTo,
        actions: renderActions?.(item),
        footer: renderFooter?.(item),
        className: cardClassName?.(item),
        content: renderCard(item),
      };
    });
  }

  // Every state owns the full height of the pane, not just the populated one.
  // A board that collapses to its content while loading makes the page jump as
  // the columns arrive, and an empty pipeline that renders as a short strip
  // reads as a broken screen rather than as a pipeline with nothing in it.
  if (isLoading) {
    return (
      <div className={cn("flex h-full gap-2 overflow-x-auto", className)}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={`board-column-skeleton-${index}`} className="h-full w-70 shrink-0 rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title={labels.errorTitle}
        onRetry={onRetry}
        retryLabel={labels.retry}
        className={cn("h-full", className)}
      />
    );
  }

  if (columns.length === 0) {
    return emptyState ?? <EmptyState title={labels.emptyTitle} className={cn("h-full", className)} />;
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-3", className)}>
      <DragDropContext onDragEnd={handleDragEnd}>
        {/* A column body windows itself above 50 cards — react-window, per D9,
            because that is the only pairing @hello-pangea/dnd's virtual mode
            is exercised against. The column owns that switch, not this row:
            the board hands each column a flat list of card models and stays
            out of how many of them reach the DOM. See BoardColumn and
            docs/design/views.md#virtualization. */}
        <div ref={setScrollElement} className="flex min-h-0 flex-1 gap-2 overflow-x-auto pb-2">
          {columns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              emptyLabel={labels.emptyColumn}
              cards={cardsFor(column.id)}
            />
          ))}
        </div>
      </DragDropContext>

      {page && onPageChange && (
        <Pagination page={page} onPageChange={onPageChange} labels={labels.pagination} />
      )}
    </div>
  );
}
