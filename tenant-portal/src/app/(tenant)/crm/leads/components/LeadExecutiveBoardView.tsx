"use client";

import { DragDropContext } from "@hello-pangea/dnd";
import { EmptyState, ErrorState, Skeleton } from "@/design-system";
import { LeadBoardColumn } from "./lead-board/LeadBoardColumn";
import { LeadBoardQuickDropDock } from "./lead-board/LeadBoardQuickDropDock";
import type { LeadExecutiveBoardViewProps } from "./lead-board/lead-board-types";
import { useLeadBoard } from "./lead-board/useLeadBoard";

export function LeadExecutiveBoardView(props: LeadExecutiveBoardViewProps) {
  const board = useLeadBoard(props);
  const { t, branchId, isLoading, stages, error, items, onRetry } = board;
  if (!branchId) return <EmptyState title={t.crmLeads.selectBranchFirst} />;
  if (isLoading && stages.length === 0) {
    return (
      <div className="flex h-full items-stretch gap-3 overflow-x-auto px-5 pt-[13px] pb-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-full min-w-[235px] flex-[1_1_0] rounded-column" />
        ))}
      </div>
    );
  }
  if (error && items.length === 0) {
    return <ErrorState title={t.crmLeads.loadFailed} onRetry={onRetry} retryLabel={t.common.retry} />;
  }
  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col">
      <DragDropContext onDragStart={board.handleDragStart} onDragUpdate={board.handleDragUpdate} onDragEnd={board.handleDragEnd}>
        <div className="flex h-full min-h-0 flex-1 items-stretch gap-3 overflow-x-auto px-5 pt-[13px] pb-5">
          {stages.map((stage) => <LeadBoardColumn key={stage.id} stage={stage} board={board} />)}
        </div>
      </DragDropContext>
      <LeadBoardQuickDropDock board={board} />
    </div>
  );
}
