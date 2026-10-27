"use client";

import { GripVertical } from "lucide-react";
import { cn } from "@/design-system";
import { CUSTOMER_PROFILE_BOARD_STATUSES } from "../../hooks/useCustomerProfileBoard";
import type { CustomerProfileItem } from "../../hooks/useCustomerProfiles";
import { CustomerBoardCard } from "./CustomerBoardCard";
import type { useCustomerBoard } from "./useCustomerBoard";

export function CustomerBoardDraggableCard({ item, board }: {
  item: CustomerProfileItem; board: ReturnType<typeof useCustomerBoard>;
}) {
  const expanded = board.expandedCustomerId === item.id;
  const dragging = board.draggingItem?.id === item.id;
  return (
    <div draggable={board.canUpdate(item) && !expanded}
      onDragStart={expanded ? undefined : (event) => board.startDrag(item, event)} onDragEnd={board.endDrag}
      className={cn(board.canUpdate(item) && !expanded && "cursor-grab active:cursor-grabbing",
        dragging && "rotate-1 scale-[1.02] rounded-card ring-2 ring-primary")}>
      {dragging && (
        <div className="flex items-center gap-1 rounded-t-lg bg-primary px-3 py-1.5 text-caption text-primary-foreground">
          <GripVertical className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{board.t.crmCustomerProfiles.ui.board.dragging_customer} · {board.draggingFromLabel} → {board.draggingToLabel || board.draggingFromLabel}</span>
        </div>
      )}
      <CustomerBoardCard item={item} canUpdate={board.canUpdate(item)} canDelete={board.canDelete(item)}
        sources={board.sources ?? []} expanded={expanded}
        onToggleExpanded={() => board.setExpandedCustomerId(expanded ? null : item.id)}
        onOpen={() => board.onOpen(item)}
        onOpenQuickModal={board.onOpenQuickModal ? () => board.onOpenQuickModal?.(item) : undefined}
        onOpenActivities={board.onOpenActivities && item.status !== "BLACKLISTED" ? () => board.onOpenActivities?.(item) : undefined}
        onDelete={board.onDelete ? () => board.onDelete?.(item) : undefined}
        moveTargets={CUSTOMER_PROFILE_BOARD_STATUSES.filter((status) => status !== item.status)
          .map((status) => ({ id: status, label: board.statusTitle(status) }))}
        onMove={(status) => board.onCardMove({ itemId: item.id, fromColumnId: item.status, toColumnId: status, toIndex: 0 })}
        onCardChange={(patch) => board.onCardChange(item, patch)} />
    </div>
  );
}
