"use client";

import { useRef } from "react";
import { ChevronsLeft, ChevronsRight, GripVertical } from "lucide-react";
import { formatTemplate } from "@/lib/format/template";
import { useDirection } from "@/i18n/useLanguage";
import { cn } from "../../lib/cn";
import { iconSize, mirrorInRtl } from "../../lib/icons";
import { Button } from "../../primitives/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../primitives/DropdownMenu";
import { MIN_COLUMN_WIDTH, RESIZE_STEP } from "./column-layout";

export interface ColumnLayoutLabels {
  /** Template, e.g. "Reorder {column}". */
  reorder: string;
  moveEarlier: string;
  moveLater: string;
  /** Template, e.g. "Resize {column}". */
  resize: string;
}

interface ColumnHeaderControlsProps {
  header: string;
  width: number;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  onMove: (delta: -1 | 1) => void;
  onResize: (width: number) => void;
  labels: ColumnLayoutLabels;
}

/**
 * Column resize and reorder, as controls rather than as a drag.
 *
 * **Drag is never the only path.** That is the same rule the board view is
 * being fixed for (MASTER-PLAN 2.7 / audit B3): a pointer-drag affordance with
 * no keyboard or single-pointer equivalent is a WCAG AA failure, and there is
 * no reason to ship a second one here. So reorder is a menu, and resize is a
 * `separator` that responds to a drag **and** to the arrow keys.
 *
 * Reorder is worded "earlier"/"later", not "left"/"right": the same column
 * moves the opposite way on screen in Arabic, and a physical word would be
 * wrong for half the users.
 */
export function ColumnHeaderControls({
  header,
  width,
  canMoveEarlier,
  canMoveLater,
  onMove,
  onResize,
  labels,
}: ColumnHeaderControlsProps) {
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const dir = useDirection();

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startWidth: width };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    // The handle sits at the column's inline END, so in RTL a drag towards
    // smaller clientX makes the column WIDER. Direction is computed, never
    // branched on language.
    const travel = (event.clientX - drag.startX) * (dir === "rtl" ? -1 : 1);
    onResize(drag.startWidth + travel);
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  return (
    <span className="inline-flex items-center">
      {(canMoveEarlier || canMoveLater) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              aria-label={formatTemplate(labels.reorder, { column: header })}
              className="cursor-pointer opacity-60 hover:opacity-100"
            >
              <GripVertical className={iconSize({ size: "xs" })} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem disabled={!canMoveEarlier} onSelect={() => onMove(-1)}>
              <ChevronsLeft className={cn(iconSize({ size: "md" }), mirrorInRtl)} aria-hidden="true" />
              {labels.moveEarlier}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canMoveLater} onSelect={() => onMove(1)}>
              <ChevronsRight className={cn(iconSize({ size: "md" }), mirrorInRtl)} aria-hidden="true" />
              {labels.moveLater}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* role=separator with aria-valuenow is the ARIA window-splitter pattern,
          which is exactly what a column resizer is. It is focusable, so the
          arrow keys work without any pointer at all. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={formatTemplate(labels.resize, { column: header })}
        aria-valuenow={width}
        aria-valuemin={MIN_COLUMN_WIDTH}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(event) => {
          const step =
            event.key === "ArrowLeft" ? -RESIZE_STEP : event.key === "ArrowRight" ? RESIZE_STEP : 0;
          if (step === 0) return;
          event.preventDefault();
          onResize(width + step * (dir === "rtl" ? -1 : 1));
        }}
        className={cn(
          "ms-1 h-4 w-1 shrink-0 cursor-col-resize rounded-full bg-border",
          "hover:bg-primary focus-visible:bg-primary focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring",
        )}
      />
    </span>
  );
}
