"use client";

import { Droppable } from "@hello-pangea/dnd";
import { ChevronsLeft, Loader2, Plus } from "lucide-react";
import { Badge, Button, cn, iconSize, mirrorInRtl, type BoardColumnSegment } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { leadActivityState } from "../../lead-card-contract";
import type { LeadItem, LeadStage } from "../../hooks/useLeads";
import { LEAD_TERMINAL_STAGE_FLAG, type LeadBoardViewState } from "../../hooks/useLeadBoardView";
import type { LeadBoardViewProps } from "./LeadBoardView";
import { LeadBoardActivityFilter } from "./LeadBoardActivityFilter";
import { LeadBoardCard } from "./LeadBoardCard";
import { LeadBoardQuickAddCard } from "./LeadBoardQuickAddCard";

interface LeadBoardColumnProps {
  stage: LeadStage;
  label: string;
  /** Every loaded lead in the stage, before the activity filter. */
  leads: LeadItem[];
  total: number;
  segments: BoardColumnSegment[];
  outcomeClassName: string;
  moveTargets: (lead: LeadItem) => { id: string; label: string }[];
  board: LeadBoardViewState;
  view: LeadBoardViewProps;
}

/** One stage: header and filter, the droppable list, the quick-add card, paging. */
export function LeadBoardColumn({
  stage,
  label,
  leads,
  total,
  segments,
  outcomeClassName,
  moveTargets,
  board,
  view,
}: LeadBoardColumnProps) {
  const { t } = useI18n();
  const isTerminal = stage.flag === LEAD_TERMINAL_STAGE_FLAG;
  const filter = board.activityFilterOf(stage.id);
  const shown = leads.filter((lead) => !filter || leadActivityState(lead.nextActivity) === filter);
  const isQuickAddOpen = board.quickAddStageId === stage.id;
  const canQuickAdd = view.canCreate && !isTerminal && Boolean(view.branchId);
  const isLoadingMore = view.isLoadingMoreStage(stage.id);
  const addLabel = `${t.crmLeads.addLead}: ${label}`;
  const collapseLabel = `${t.views.collapseColumn}: ${label}`;

  return (
    <section
      aria-label={label}
      className={cn(
        "flex h-full min-h-0 w-70 shrink-0 flex-col rounded-md border border-border bg-card",
        outcomeClassName,
      )}
    >
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-border px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-xs font-medium text-foreground">{label}</span>
            <Badge tone="neutral">{total}</Badge>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {canQuickAdd && !isQuickAddOpen && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                aria-label={addLabel}
                title={addLabel}
                onClick={() => board.openQuickAdd(stage.id)}
              >
                <Plus className={iconSize({ size: "sm" })} aria-hidden="true" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-expanded
              aria-label={collapseLabel}
              title={collapseLabel}
              onClick={() => board.toggleCollapsed(stage.id)}
            >
              <ChevronsLeft className={cn(iconSize({ size: "sm" }), mirrorInRtl)} aria-hidden="true" />
            </Button>
          </div>
        </div>
        <LeadBoardActivityFilter
          stageLabel={label}
          segments={segments}
          value={filter}
          onChange={(next) => board.setActivityFilter(stage.id, next)}
        />
      </div>

      <Droppable droppableId={stage.id} isDropDisabled={view.isMovePending || isTerminal}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-1.5",
              snapshot.isDraggingOver && "bg-accent",
            )}
          >
            {isQuickAddOpen && view.branchId && (
              <LeadBoardQuickAddCard
                stageId={stage.id}
                stageLabel={label}
                branchId={view.branchId}
                onCancel={board.closeQuickAdd}
                onOpenFullModal={(draft) => {
                  board.closeQuickAdd();
                  view.onOpenCreateModal(stage.id, draft);
                }}
                onSubmit={async (payload, rating) => {
                  const created = await view.onQuickCreateLead(payload, rating);
                  if (created) board.closeQuickAdd();
                  return created;
                }}
              />
            )}
            {shown.length === 0 && !isQuickAddOpen && (
              <div className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-border text-2xs text-muted-foreground">
                <span>{t.crmLeads.emptyColumn}</span>
                {canQuickAdd && (
                  <Button type="button" variant="ghost" size="xs" onClick={() => board.openQuickAdd(stage.id)}>
                    <Plus className={iconSize({ size: "sm" })} aria-hidden="true" />
                    {t.crmLeadBoard.quickAdd.open}
                  </Button>
                )}
              </div>
            )}
            {shown.map((lead, index) => {
              const canUpdate = view.canUpdate(lead);
              const isExpanded = board.expandedLeadId === lead.id;
              return (
                <LeadBoardCard
                  key={lead.id}
                  lead={lead}
                  index={index}
                  now={board.now}
                  isExpanded={isExpanded}
                  isDragDisabled={view.isMovePending || !canUpdate || isTerminal || isExpanded}
                  canUpdate={canUpdate}
                  canDelete={view.canDelete(lead)}
                  moveTargets={moveTargets(lead)}
                  onToggleExpanded={() => board.toggleExpanded(lead.id)}
                  onOpen={() => view.onOpenLead(lead)}
                  onOpenActivities={() => view.onOpenActivities(lead)}
                  onDelete={() => view.onDeleteLead(lead)}
                  onMove={(toStageId) => view.onMoveStage(lead.id, toStageId, lead)}
                  onCardChange={(patch) => view.onCardChange(lead.id, patch, lead)}
                />
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {view.hasMoreStage(stage.id) && (
        <div className="shrink-0 border-t border-border p-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={isLoadingMore}
            onClick={() => view.onLoadMoreStage(stage.id)}
          >
            {isLoadingMore && (
              <Loader2 className={cn(iconSize({ size: "sm" }), "animate-spin")} aria-hidden="true" />
            )}
            {isLoadingMore ? t.crmLeads.loadingMore : t.crmLeads.loadMore(leads.length, total)}
          </Button>
        </div>
      )}
    </section>
  );
}
