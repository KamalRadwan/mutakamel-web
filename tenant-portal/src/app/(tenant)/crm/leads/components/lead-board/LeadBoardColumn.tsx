"use client";

import { Droppable } from "@hello-pangea/dnd";
import { Button, cn } from "@/design-system";
import { localizedName } from "@/lib/format/localized";
import { leadActivityState } from "../../lead-card-contract";
import type { LeadStage } from "../../lead-list-contract";
import type { useLeadBoard } from "./useLeadBoard";
import { LeadBoardCollapsedRail } from "./LeadBoardCollapsedRail";
import { LeadBoardColumnHeader } from "./LeadBoardColumnHeader";
import { LeadBoardEmptyStage } from "./LeadBoardEmptyStage";
import { LeadBoardQuickAddCard } from "./LeadBoardQuickAddCard";
import { LeadBoardDropGuidance } from "./LeadBoardDropGuidance";
import { LeadBoardDraggableCard } from "./LeadBoardDraggableCard";

type Board = ReturnType<typeof useLeadBoard>;

export function LeadBoardColumn({ stage, board }: { stage: LeadStage; board: Board }) {
  const { t, lang, items, totals, columnActivityFilter, canCreate, quickAddStageId,
    draggingLeadId, dragDestinationStageId, isMovePending, branchId,
    sources, setQuickAddStageId, openQuickAddFullModal, submitQuickAdd,
    isColumnCollapsed, toggleCollapse, peekStage, cancelPeek,
    toggleColumnActivityFilter, clearColumnActivityFilter, hasMoreStage,
    isLoadingMoreStage, onLoadMoreStage } = board;
  const allStageLeads = items.filter((lead) => lead.stageId === stage.id);
  const activeActivityState = columnActivityFilter[stage.id] ?? null;
  const stageLeads = activeActivityState
    ? allStageLeads.filter((lead) => leadActivityState(lead.nextActivity) === activeActivityState)
    : allStageLeads;
  const totalCount = totals?.get(stage.id) ?? allStageLeads.length;
  const stageLabel = localizedName(stage, lang);
  const isTerminal = stage.flag === "CONVERTED";
  const isQuickAddOpen = canCreate && quickAddStageId === stage.id;
  const isDragTarget = draggingLeadId !== null && dragDestinationStageId === stage.id;
  if (isColumnCollapsed(stage.id)) {
    return <LeadBoardCollapsedRail stageLabel={stageLabel} stageFlag={stage.flag}
      totalCount={totalCount} isDragging={Boolean(draggingLeadId)}
      onExpand={() => toggleCollapse(stage.id)}
      onMouseEnter={() => peekStage(stage.id)} onMouseLeave={cancelPeek} />;
  }
  return (
    <div className={cn(
      "flex h-full min-h-0 flex-[1_1_0] min-w-[235px] flex-col overflow-hidden rounded-column border border-line-column bg-surface-column shadow-column",
      isDragTarget && !isTerminal && "ring-2 ring-primary",
    )}>
      <LeadBoardColumnHeader stageLabel={stageLabel} stageFlag={stage.flag} totalCount={totalCount}
        activityStates={allStageLeads.map((lead) => leadActivityState(lead.nextActivity))}
        activeActivityState={activeActivityState} isQuickAddOpen={isQuickAddOpen}
        onCollapse={() => toggleCollapse(stage.id)}
        onQuickAdd={canCreate ? () => setQuickAddStageId(stage.id) : undefined}
        onToggleActivityState={(state) => toggleColumnActivityFilter(stage.id, state)}
        onClearActivityFilter={() => clearColumnActivityFilter(stage.id)} />
      <Droppable droppableId={stage.id} isDropDisabled={isMovePending}>
        {(provided, snapshot) => (
          <div ref={provided.innerRef} {...provided.droppableProps}
            className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
            {isQuickAddOpen && branchId && (
              <LeadBoardQuickAddCard stage={stage} branchId={branchId} sources={sources}
                onCancel={() => setQuickAddStageId(null)}
                onOpenFullModal={(draft) => openQuickAddFullModal(stage.id, draft)}
                onSubmit={submitQuickAdd} />
            )}
            <LeadBoardDropGuidance stage={stage} board={board} isDraggingOver={snapshot.isDraggingOver} />
            {stageLeads.length === 0 && !isQuickAddOpen && !(draggingLeadId && isTerminal) && (
              <LeadBoardEmptyStage stageFlag={stage.flag}
                onQuickAdd={canCreate && !isTerminal ? () => setQuickAddStageId(stage.id) : undefined} />
            )}
            {stageLeads.map((lead, index) => (
              <LeadBoardDraggableCard key={lead.id} lead={lead} stage={stage} index={index} board={board} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      {hasMoreStage(stage.id) && (
        <div className="shrink-0 border-t border-line-divider bg-surface-column-header p-2">
          <Button variant="ghost" size="xs" className="w-full" disabled={isLoadingMoreStage(stage.id)}
            onClick={() => onLoadMoreStage(stage.id)}>
            {isLoadingMoreStage(stage.id) ? t.crmLeads.loadingMore : t.crmLeads.loadMore(stageLeads.length, totalCount)}
          </Button>
        </div>
      )}
    </div>
  );
}
