"use client";

import { Ban, MoreHorizontal } from "lucide-react";
import {
  Button,
  CARD_COLORS,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cardColorFill,
  cn,
  iconSize,
  type CardColor,
} from "@/design-system";

// Twelve swatches, "none" first — the one that clears the colour is the one a
// user reaches for after a mistake, so it leads rather than trails.
const SWATCH_CHOICES: readonly (CardColor | null)[] = [null, ...CARD_COLORS];

export interface LeadCardMoveTarget {
  id: string;
  label: string;
}

export interface LeadCardMenuLabels {
  trigger: string;
  open: string;
  delete: string;
  moveTo: string;
  cardColor: string;
  colorNone: string;
  colorNames: Record<CardColor, string>;
  /** Appended to the chosen swatch's name — the ring alone is not a name. */
  selected: string;
}

export interface LeadCardMenuProps {
  cardColor: CardColor | null;
  onOpen: () => void;
  /** Omitted when the user may not delete this lead. */
  onDelete?: () => void;
  /** Omitted when the user may not update this lead. */
  onColorChange?: (next: CardColor | null) => void;
  /** The stages this lead may move to — never the one it is already in. */
  moveTargets?: readonly LeadCardMoveTarget[];
  onMove?: (stageId: string) => void;
  labels: LeadCardMenuLabels;
}

/**
 * The card's overflow menu: open it, move it, delete it, colour it.
 *
 * It replaces three separate affordances the card used to carry — a selection
 * checkbox, a "Move to…" trigger and a bin icon — and it sits in
 * `WorkspaceCard`'s `actions` slot, outside the drag handle, so opening it can
 * neither start a drag nor open the lead behind it.
 *
 * **Move to… is here because it is not decoration.** WCAG 2.2 AA
 * `dragging-alternative` requires a single-pointer path to every drag, and
 * dragging a card between stage columns is the board's whole point. Taking the
 * arrow off the card face was the ask; taking the capability away from anyone
 * who cannot drag was not, and it would leave them unable to move a lead at
 * all. It costs one item in a menu that was already open.
 *
 * The swatches are menu items in a grid rather than a row each: twelve rows
 * would push Delete off the top of a short screen, and a swatch is recognised
 * by its colour, not read. Each still carries its colour NAME, because a
 * private filing colour is precisely the kind whose meaning cannot be seen.
 */
export function LeadCardMenu({
  cardColor,
  onOpen,
  onDelete,
  onColorChange,
  moveTargets,
  onMove,
  labels,
}: LeadCardMenuProps) {
  const canMove = Boolean(onMove) && (moveTargets?.length ?? 0) > 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" aria-label={labels.trigger}>
          <MoreHorizontal className={iconSize({ size: "sm" })} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onOpen}>{labels.open}</DropdownMenuItem>

        {canMove && onMove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{labels.moveTo}</DropdownMenuLabel>
            {moveTargets?.map((target) => (
              <DropdownMenuItem key={target.id} onSelect={() => onMove(target.id)}>
                {target.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {onDelete && (
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            {labels.delete}
          </DropdownMenuItem>
        )}

        {onColorChange && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{labels.cardColor}</DropdownMenuLabel>
            <div className="grid grid-cols-6 gap-1 p-1">
              {SWATCH_CHOICES.map((color) => {
                const name = color === null ? labels.colorNone : labels.colorNames[color];
                const isCurrent = color === cardColor;

                return (
                  <DropdownMenuItem
                    key={color ?? "NONE"}
                    // Radix types ahead on an item's text, and a swatch has
                    // none — without this the whole grid is unreachable by
                    // keystroke and the menu's typeahead skips twelve items.
                    textValue={name}
                    aria-label={isCurrent ? `${name} — ${labels.selected}` : name}
                    onSelect={() => onColorChange(color)}
                    className="size-7 justify-center p-0"
                  >
                    {/* A ring, not a tick inside the swatch: a tick has to
                        contrast with all eleven fills at once and cannot. */}
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-xs",
                        color === null ? "border border-input" : cardColorFill(color),
                        isCurrent && "ring-2 ring-ring ring-offset-2 ring-offset-popover",
                      )}
                    >
                      {color === null && (
                        <Ban className="size-3 text-muted-foreground" aria-hidden="true" />
                      )}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
