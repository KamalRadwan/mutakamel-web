"use client";

import type { ReactNode } from "react";
import {
  Draggable,
  type DraggableProvided,
  type DraggableStateSnapshot,
} from "@hello-pangea/dnd";
import { WorkspaceCard } from "../WorkspaceCard";
import { MoveToMenu, type MoveToTarget } from "./MoveToMenu";

// Everything a card needs EXCEPT where it sits. The column owns the index,
// and a windowed column hands out an ABSOLUTE index that has nothing to do
// with the card's position inside the rendered window — see VirtualColumnBody.
//
// Splitting the model from the index is also what lets one card surface be
// rendered two ways without either re-deriving the other's props: in the list
// as a Draggable, and — while a drag is in flight over a virtual column — as
// @hello-pangea/dnd's portalled clone, which is a Draggable the LIBRARY
// constructs and hands back already provided.
export interface BoardCardModel {
  id: string;
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
  content: ReactNode;
}

export interface BoardCardSurfaceProps {
  card: BoardCardModel;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
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
//
// The clone a virtual column portals out of the list renders through here too,
// so what follows the pointer mid-drag is this surface and not a second,
// drifting copy of it — including the "Move to…" trigger, whose absence would
// make the clone a visibly different card.
export function BoardCardSurface({ card, provided, snapshot }: BoardCardSurfaceProps) {
  const { moveTargets, onMoveTo, moveToLabel, actions } = card;
  const canMove = onMoveTo !== undefined && moveToLabel !== undefined && (moveTargets?.length ?? 0) > 0;

  return (
    <WorkspaceCard
      density="compact"
      containerRef={provided.innerRef}
      containerProps={provided.draggableProps}
      handleProps={provided.dragHandleProps}
      onActivate={card.onActivate}
      activateOnSpace={false}
      isSelected={card.isSelected}
      onSelectedChange={card.onSelectedChange}
      selectLabel={card.selectLabel}
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
      {card.content}
    </WorkspaceCard>
  );
}

export interface BoardCardProps {
  card: BoardCardModel;
  // The ABSOLUTE position in the column, never the position within a rendered
  // window. @hello-pangea/dnd resolves a drop to this number, so a window
  // index here drops the card at the wrong place with no error anywhere — the
  // silent bug virtual-dnd.probe.test.tsx exists to catch.
  index: number;
}

export function BoardCard({ card, index }: BoardCardProps) {
  return (
    <Draggable draggableId={card.id} index={index} isDragDisabled={card.isDragDisabled}>
      {(provided, snapshot) => <BoardCardSurface card={card} provided={provided} snapshot={snapshot} />}
    </Draggable>
  );
}
