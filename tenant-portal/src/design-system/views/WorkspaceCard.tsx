"use client";

import { type HTMLAttributes, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type Ref, useRef } from "react";
import { Card } from "../primitives/Card";
import { Checkbox } from "../primitives/Checkbox";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";

// Pointer travel, in CSS pixels, past which a gesture was a drag and not a
// click. Below it the pointer never really left the card and the user meant to
// open it. Without this a one-pixel wobble on a board card fired onClick in
// the middle of a drag — V5 in docs/build/MASTER-PLAN.md#05-the-three-views--board--card--table.
const DRAG_THRESHOLD_PX = 5;

export interface WorkspaceCardProps {
  children: ReactNode;
  onActivate?: () => void;
  // The board reserves Space for @hello-pangea/dnd's keyboard lift, so it
  // opts out and keeps Enter only. Everywhere else a role="button" surface
  // must answer both keys.
  activateOnSpace?: boolean;
  isSelected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  selectLabel?: string;
  // Per-card controls that must NOT open the card and must not start a drag —
  // the board's "Move to…" menu lives here. Rendered outside the activation
  // surface, so neither is nested inside a role="button".
  actions?: ReactNode;
  density?: "compact" | "default";
  isElevated?: boolean;
  className?: string;
  // The board passes @hello-pangea/dnd's provided.innerRef and
  // provided.draggableProps here, and provided.dragHandleProps as
  // handleProps, which makes the activation surface the drag handle. The
  // checkbox and the actions then sit outside the handle and cannot start a
  // drag at all.
  containerRef?: Ref<HTMLDivElement>;
  containerProps?: HTMLAttributes<HTMLDivElement>;
  handleProps?: HTMLAttributes<HTMLDivElement> | null;
}

// The one card object in the product. Board cards and card-view cards are the
// same surface at two densities: one Card primitive, one radius (rounded-md,
// from Card itself — the board used to disagree at rounded-sm), one shared
// focusRing, one selection affordance, one click/drag disambiguation. See
// docs/design/views.md#the-card-object.
export function WorkspaceCard({
  children,
  onActivate,
  activateOnSpace = true,
  isSelected,
  onSelectedChange,
  selectLabel,
  actions,
  density = "default",
  isElevated,
  className,
  containerRef,
  containerProps,
  handleProps,
}: WorkspaceCardProps) {
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);
  const isInteractive = Boolean(onActivate) || Boolean(handleProps);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerOrigin.current = { x: event.clientX, y: event.clientY };
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!onActivate) return;
    const origin = pointerOrigin.current;
    pointerOrigin.current = null;
    if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > DRAG_THRESHOLD_PX) {
      return;
    }
    onActivate();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onActivate) return;
    if (event.key === "Enter" || (activateOnSpace && event.key === " ")) {
      event.preventDefault();
      onActivate();
    }
  }

  return (
    <Card
      ref={containerRef}
      {...containerProps}
      className={cn(
        "flex items-start gap-2",
        density === "compact" ? "p-2" : "p-3",
        isSelected && "border-primary",
        isElevated && "shadow-overlay",
        className,
      )}
    >
      {onSelectedChange && (
        <Checkbox
          checked={isSelected ?? false}
          onCheckedChange={(next) => onSelectedChange(next === true)}
          aria-label={selectLabel}
          className="mt-0.5 shrink-0"
        />
      )}

      {/* role="button" is set here rather than inherited from
          provided.dragHandleProps, which is null the moment dragging is
          disabled — that is how board cards lost both their role and their
          tab stop for any user without the update capability (V5). */}
      <div
        {...handleProps}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "min-w-0 flex-1 rounded-xs text-start",
          // B8: a role="button" div gets no pointer cursor from Preflight, and a
          // clickable card that looks unclickable is the case that rule names.
          isInteractive && "cursor-pointer",
          focusRing,
        )}
      >
        {children}
      </div>

      {actions && <div className="shrink-0">{actions}</div>}
    </Card>
  );
}
