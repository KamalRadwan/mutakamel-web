import type { ReactNode } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import type { NormalizedApiError } from "@/lib/api/errors";
import { Skeleton } from "../../primitives/Skeleton";
import { EmptyState } from "../../patterns/empty-state/EmptyState";
import { ErrorState } from "../../patterns/error-state/ErrorState";
import { BoardCard } from "./BoardCard";
import { BoardColumn } from "./BoardColumn";
import type { BoardColumnDef } from "./types";

export interface BoardCardMove {
  itemId: string;
  fromColumnId: string;
  toColumnId: string;
  toIndex: number;
}

export interface BoardViewProps<T> {
  columns: BoardColumnDef[];
  cardsByColumn: Record<string, T[]>;
  itemKey: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onCardClick?: (item: T) => void;
  canDrag?: (item: T) => boolean;
  // A terminal move (e.g. into WON/LOST/CONVERTED/DISQUALIFIED) is not
  // freely reversible — return false to leave the card in its original
  // column without calling onCardMove. Optional: most moves need no
  // confirmation.
  confirmMove?: (move: BoardCardMove) => boolean | Promise<boolean>;
  onCardMove: (move: BoardCardMove) => void;
  isLoading: boolean;
  error?: NormalizedApiError | null;
  onRetry?: () => void;
  emptyState?: ReactNode;
  emptyColumnLabel: string;
  errorTitle?: string;
  retryLabel?: string;
}

// Horizontally scrolling flex row of fixed-width columns — the row scrolls,
// the page does not. Generic and prop-driven: never fetches, never knows
// which entity it renders, never owns the mutation. Optimistic move and
// rollback both live in the caller's data — this view just renders whatever
// cardsByColumn it is given at any moment. See docs/design/views.md#board-view.
export function BoardView<T>({
  columns,
  cardsByColumn,
  itemKey,
  renderCard,
  onCardClick,
  canDrag,
  confirmMove,
  onCardMove,
  isLoading,
  error,
  onRetry,
  emptyState,
  emptyColumnLabel,
  errorTitle,
  retryLabel,
}: BoardViewProps<T>) {
  async function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const move: BoardCardMove = {
      itemId: draggableId,
      fromColumnId: source.droppableId,
      toColumnId: destination.droppableId,
      toIndex: destination.index,
    };

    if (confirmMove) {
      const allowed = await confirmMove(move);
      if (!allowed) return;
    }

    onCardMove(move);
  }

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={`board-column-skeleton-${index}`} className="h-64 w-70 shrink-0 rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState title={errorTitle ?? ""} onRetry={onRetry} retryLabel={retryLabel} />;
  }

  if (columns.length === 0) {
    return emptyState ?? <EmptyState title="" />;
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex h-full gap-2 overflow-x-auto pb-2">
        {columns.map((column) => (
          <BoardColumn key={column.id} column={column} emptyLabel={emptyColumnLabel}>
            {(cardsByColumn[column.id] ?? []).map((item, index) => {
              const id = itemKey(item);
              return (
                <BoardCard
                  key={id}
                  draggableId={id}
                  index={index}
                  isDragDisabled={canDrag ? !canDrag(item) : false}
                  onClick={onCardClick ? () => onCardClick(item) : undefined}
                >
                  {renderCard(item)}
                </BoardCard>
              );
            })}
          </BoardColumn>
        ))}
      </div>
    </DragDropContext>
  );
}
