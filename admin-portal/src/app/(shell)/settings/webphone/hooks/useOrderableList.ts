"use client";

import { useCallback, useState, type DragEvent } from "react";

/**
 * Pointer reordering for a keyed list, built on the HTML5 drag events.
 *
 * No drag-and-drop library is in this project's dependencies, and an ordered
 * list of at most a handful of rows does not justify adding one. The drag is
 * started from a handle rather than the row itself, so the text inputs inside
 * a row keep their own selection and caret behaviour.
 *
 * Dragging is a pointer gesture with no keyboard equivalent, so it is never
 * the only way to reorder: callers render move-earlier / move-later buttons
 * driven by the same `onMove`, and those are what a keyboard or screen-reader
 * operator uses.
 */
export interface OrderableList {
  /** The id currently being dragged, for styling the lifted row. */
  draggingId: string | null;
  /** The id currently under the pointer, for styling the drop target. */
  dropTargetId: string | null;
  /** Spread onto the row element; makes it a drop target. */
  rowProps: (id: string) => {
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDragEnter: (event: DragEvent<HTMLElement>) => void;
    onDragLeave: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
    onDragEnd: () => void;
  };
  /** Spread onto the drag handle; makes it the thing that starts the drag. */
  handleProps: (id: string) => {
    draggable: boolean;
    onDragStart: (event: DragEvent<HTMLElement>) => void;
    onDragEnd: () => void;
  };
  moveUp: (index: number) => void;
  moveDown: (index: number) => void;
}

export function useOrderableList({
  ids,
  onMove,
  disabled = false,
}: {
  ids: readonly string[];
  onMove: (from: number, to: number) => void;
  disabled?: boolean;
}): OrderableList {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const reset = useCallback(() => {
    setDraggingId(null);
    setDropTargetId(null);
  }, []);

  const move = useCallback(
    (from: number, to: number) => {
      if (disabled) return;
      if (from === to || from < 0 || to < 0 || to >= ids.length) return;
      onMove(from, to);
    },
    [disabled, ids.length, onMove],
  );

  const handleProps = useCallback(
    (id: string) => ({
      draggable: !disabled,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        if (disabled) return;
        setDraggingId(id);
        event.dataTransfer.effectAllowed = "move";
        // Some browsers cancel a drag that carries no payload at all.
        event.dataTransfer.setData("text/plain", id);
      },
      onDragEnd: reset,
    }),
    [disabled, reset],
  );

  const rowProps = useCallback(
    (id: string) => ({
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (disabled || !draggingId) return;
        // Without this the drop is refused and the gesture silently does
        // nothing, which reads to the operator as a broken control.
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      },
      onDragEnter: (event: DragEvent<HTMLElement>) => {
        if (disabled || !draggingId) return;
        event.preventDefault();
        setDropTargetId(id);
      },
      onDragLeave: () => {
        setDropTargetId((current) => (current === id ? null : current));
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (disabled || !draggingId) return;
        event.preventDefault();
        const from = ids.indexOf(draggingId);
        const to = ids.indexOf(id);
        reset();
        if (from !== -1 && to !== -1) move(from, to);
      },
      onDragEnd: reset,
    }),
    [disabled, draggingId, ids, move, reset],
  );

  return {
    draggingId,
    dropTargetId,
    rowProps,
    handleProps,
    moveUp: (index: number) => move(index, index - 1),
    moveDown: (index: number) => move(index, index + 1),
  };
}
