"use client";

import { MoreHorizontal } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  iconSize,
  type MoveToTarget,
} from "@/design-system";

export interface CustomerProfileCardMenuLabels {
  trigger: string;
  open: string;
  delete: string;
  moveTo: string;
}

export interface CustomerProfileCardMenuProps {
  onOpen: () => void;
  onDelete?: () => void;
  moveTargets?: readonly MoveToTarget[];
  onMove?: (status: string) => void;
  labels: CustomerProfileCardMenuLabels;
}

export function CustomerProfileCardMenu({
  onOpen,
  onDelete,
  moveTargets,
  onMove,
  labels,
}: CustomerProfileCardMenuProps) {
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
