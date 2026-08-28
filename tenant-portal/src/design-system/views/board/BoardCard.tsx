import type { ReactNode } from "react";
import { Draggable } from "@hello-pangea/dnd";

export interface BoardCardProps {
  draggableId: string;
  index: number;
  isDragDisabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

// Wraps a per-screen card renderer with the drag handle and focus/keyboard
// wiring — @hello-pangea/dnd's own keyboard sensor (space to lift, arrows to
// move, space to drop) comes for free as long as dragHandleProps stays
// attached; never strip it.
export function BoardCard({ draggableId, index, isDragDisabled, onClick, children }: BoardCardProps) {
  return (
    <Draggable draggableId={draggableId} index={index} isDragDisabled={isDragDisabled}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          onKeyDown={(event) => {
            if (onClick && event.key === "Enter") {
              event.preventDefault();
              onClick();
            }
          }}
          className={`rounded-sm border border-border bg-card p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            snapshot.isDragging ? "shadow-overlay" : ""
          }`}
        >
          {children}
        </div>
      )}
    </Draggable>
  );
}
