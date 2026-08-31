"use client";

import type { ReactNode } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { WorkspaceCard } from "../WorkspaceCard";
import { MoveToMenu, type MoveToTarget } from "./MoveToMenu";

export interface BoardCardProps {
  draggableId: string;
  index: number;
  isDragDisabled?: boolean;
  onActivate?: () => void;
  isSelected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  selectLabel?: string;
  // The single-pointer alternative to dragging. An empty list means "no
  // permitted destination", and the menu renders nothing rather than an empty
  // popover.
  moveTargets?: MoveToTarget[];
  onMoveTo?: (columnId: string) => void;
  moveToLabel?: string;
  // Per-card controls from the screen — a delete button, for instance. They
  // render beside the "Move to…" trigger, OUTSIDE the activation surface, so
  // no interactive element is ever nested inside a role="button".
  actions?: ReactNode;
  children: ReactNode;
}

// One card object shared with the card view — see WorkspaceCard. The board
// adds three things to it:
//
// 1. provided.dragHandleProps goes on the ACTIVATION SURFACE, not the outer
//    card, so the checkbox and the "Move to…" trigger sit outside the drag
//    handle and can never start a drag.
// 2. @hello-pangea/dnd's own keyboard sensor (space to lift, arrows to move,
//    space to drop) comes for free as long as dragHandleProps stays attached;
//    never strip it. WorkspaceCard therefore leaves Space to the lift and
//    activates on Enter only.
// 3. role="button" and the tab stop come from WorkspaceCard rather than from
//    dragHandleProps, which is null whenever dragging is disabled.
export function BoardCard({
  draggableId,
  index,
  isDragDisabled,
  onActivate,
  isSelected,
  onSelectedChange,
  selectLabel,
  moveTargets,
  onMoveTo,
  moveToLabel,
  actions,
  children,
}: BoardCardProps) {
  const canMove = onMoveTo !== undefined && moveToLabel !== undefined && (moveTargets?.length ?? 0) > 0;

  return (
    <Draggable draggableId={draggableId} index={index} isDragDisabled={isDragDisabled}>
      {(provided, snapshot) => (
        <WorkspaceCard
          density="compact"
          containerRef={provided.innerRef}
          containerProps={provided.draggableProps}
          handleProps={provided.dragHandleProps}
          onActivate={onActivate}
          activateOnSpace={false}
          isSelected={isSelected}
          onSelectedChange={onSelectedChange}
          selectLabel={selectLabel}
          isElevated={snapshot.isDragging}
          actions={
            actions || canMove ? (
              <div className="flex items-center gap-0.5">
                {actions}
                {canMove && <MoveToMenu targets={moveTargets ?? []} onMove={onMoveTo} label={moveToLabel} />}
              </div>
            ) : undefined
          }
        >
          {children}
        </WorkspaceCard>
      )}
    </Draggable>
  );
}
