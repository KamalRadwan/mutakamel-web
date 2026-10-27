"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/design-system";
import { CUSTOMER_PROFILE_BOARD_STATUSES } from "../../hooks/useCustomerProfileBoard";
import type { useCustomerBoard } from "./useCustomerBoard";

export function CustomerBoardDropDock({ board }: { board: ReturnType<typeof useCustomerBoard> }) {
  const { draggingItem, t } = board;
  if (!draggingItem) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-(--z-overlay) mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 rounded-lg border border-line-card bg-card px-4 py-2.5 text-foreground shadow-card">
      <div className="flex items-center gap-2 text-caption font-semibold text-foreground-secondary">
        <Sparkles className="size-4" aria-hidden="true" />
        <span>{t.crmCustomerProfiles.ui.board.quick_drop_status}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {CUSTOMER_PROFILE_BOARD_STATUSES.map((status) => (
          <Button key={status} type="button" variant="outline" size="xs" disabled={status === draggingItem.status}
            onDragOver={(event) => board.dragOver(status, event)}
            onDrop={(event) => board.drop(status, event)} onClick={() => board.moveDraggedItem(status)}>
            {board.statusTitle(status)}
          </Button>
        ))}
      </div>
    </div>
  );
}
