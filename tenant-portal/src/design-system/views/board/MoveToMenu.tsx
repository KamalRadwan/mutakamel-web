"use client";

import { CornerUpRight } from "lucide-react";
import { Button } from "../../primitives/Button";
import { cn } from "../../lib/cn";
import { iconSize, mirrorInRtl } from "../../lib/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../../primitives/DropdownMenu";

export interface MoveToTarget {
  id: string;
  label: string;
  isDisabled?: boolean;
}

export interface MoveToMenuProps {
  targets: MoveToTarget[];
  onMove: (columnId: string) => void;
  label: string;
}

// WCAG 2.2 AA `dragging-alternative` requires a single-pointer alternative to
// every drag operation. The keyboard sensor @hello-pangea/dnd provides covers
// only half of it: a user with a tremor, a motor impairment or a switch device
// cannot complete a sustained press-move-release, and moving a card between
// columns is the only thing a board is for — without this menu the board is
// completely unusable to them. This is a conformance requirement, not a
// convenience. See docs/design/views.md#every-card-carries-a-move-to-action--not-optional.
//
// One control, no new endpoint, no new state: the menu calls the board's own
// move path, so the capability gate and the terminal-move confirmation both
// apply exactly as they do to a drag.
export function MoveToMenu({ targets, onMove, label }: MoveToMenuProps) {
  if (targets.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" aria-label={label}>
          <CornerUpRight className={cn(iconSize({ size: "sm" }), mirrorInRtl)} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {targets.map((target) => (
          <DropdownMenuItem
            key={target.id}
            disabled={target.isDisabled}
            onSelect={() => onMove(target.id)}
          >
            {target.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
