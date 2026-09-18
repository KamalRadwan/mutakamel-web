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
  type MoveToTarget,
} from "@/design-system";

const SWATCH_CHOICES: readonly (CardColor | null)[] = [null, ...CARD_COLORS];

export interface CrmCardMenuLabels {
  trigger: string;
  open: string;
  delete: string;
  moveTo: string;
  cardColor: string;
  colorNone: string;
  colorNames: Record<CardColor, string>;
  selected: string;
}

export interface CrmCardMenuProps {
  cardColor: CardColor | null;
  onOpen: () => void;
  onDelete?: () => void;
  onColorChange?: (next: CardColor | null) => void;
  moveTargets?: readonly MoveToTarget[];
  onMove?: (targetId: string) => void;
  labels: CrmCardMenuLabels;
}

/** Shared accessible overflow menu for CRM cards with filing colours. */
export function CrmCardMenu({
  cardColor,
  onOpen,
  onDelete,
  onColorChange,
  moveTargets,
  onMove,
  labels,
}: CrmCardMenuProps) {
  const canMove = Boolean(onMove) && (moveTargets?.length ?? 0) > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" aria-label={labels.trigger}>
          <MoreHorizontal
            className={iconSize({ size: "sm" })}
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onOpen}>{labels.open}</DropdownMenuItem>

        {canMove && onMove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{labels.moveTo}</DropdownMenuLabel>
            {moveTargets?.map((target) => (
              <DropdownMenuItem
                key={target.id}
                onSelect={() => onMove(target.id)}
              >
                {target.label}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              {labels.delete}
            </DropdownMenuItem>
          </>
        )}

        {onColorChange && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{labels.cardColor}</DropdownMenuLabel>
            <div className="grid grid-cols-6 gap-1 p-1">
              {SWATCH_CHOICES.map((color) => {
                const name =
                  color === null ? labels.colorNone : labels.colorNames[color];
                const isCurrent = color === cardColor;
                return (
                  <DropdownMenuItem
                    key={color ?? "NONE"}
                    textValue={name}
                    aria-label={
                      isCurrent ? `${name} — ${labels.selected}` : name
                    }
                    onSelect={() => onColorChange(color)}
                    className="size-7 justify-center p-0"
                  >
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-xs",
                        color === null
                          ? "border border-input"
                          : cardColorFill(color),
                        isCurrent &&
                          "ring-2 ring-ring ring-offset-2 ring-offset-popover",
                      )}
                    >
                      {color === null && (
                        <Ban
                          className="size-3 text-muted-foreground"
                          aria-hidden="true"
                        />
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
