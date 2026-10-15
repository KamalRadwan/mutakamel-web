"use client";

import { DragDropContext } from "@hello-pangea/dnd";
import { EmptyState, ErrorState, Skeleton, resolveStatusRole } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { LeadCardPatch } from "../../lead-card-contract";
import type { CreateLeadRequest, QuickCreateLeadDraft } from "../../lead-create-contract";
import type { LeadItem, LeadStage } from "../../hooks/useLeads";
import { LEAD_TERMINAL_STAGE_FLAG, useLeadBoardView } from "../../hooks/useLeadBoardView";
import { leadActivitySegments } from "../lead-card/activity-tone";
import { LeadBoardCollapsedColumn } from "./LeadBoardCollapsedColumn";
import { LeadBoardColumn } from "./LeadBoardColumn";

export interface LeadBoardViewProps {
  stages: readonly LeadStage[];
  items: readonly LeadItem[];
  totals?: ReadonlyMap<string, number>;
  branchId: string | null;
  canCreate: boolean;
  canUpdate: (lead: LeadItem) => boolean;
  canDelete: (lead: LeadItem) => boolean;
  isMovePending: boolean;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenLead: (lead: LeadItem) => void;
  onOpenQuickModal?: (lead: LeadItem) => void;
  onOpenActivities: (lead: LeadItem) => void;
  onDeleteLead: (lead: LeadItem) => void;
  onMoveStage: (leadId: string, toStageId: string, lead?: LeadItem) => void;
  onCardChange: (leadId: string, patch: LeadCardPatch, lead: LeadItem) => void;
  onOpenCreateModal: (stageId: string | null, draft?: QuickCreateLeadDraft) => void;
  onQuickCreateLead: (payload: CreateLeadRequest, rating?: number) => Promise<boolean>;
  hasMoreStage: (stageId: string) => boolean;
  isLoadingMoreStage: (stageId: string) => boolean;
  onLoadMoreStage: (stageId: string) => void;
}

// Only an outcome stage takes a hue; position and label carry every other
// stage — docs/design/tokens.md. The `-vivid` steps, because a 2px rule is a
// non-text mark.
const OUTCOME_BORDER: Record<string, string> = {
  positive: "border-t-2 border-t-success-vivid",
  negative: "border-t-2 border-t-destructive-vivid",
  caution: "border-t-2 border-t-warning-vivid",
};

/**
 * The leads pipeline as stage columns. Cards move by drag or by "Move to…";
 * a column can be collapsed, filtered by activity, and given a lead in place.
 */
export function LeadBoardView(props: LeadBoardViewProps) {
  const { stages, items, totals, branchId, isLoading, error, onRetry } = props;
  const { t, lang } = useI18n();
  const board = useLeadBoardView(props);

  if (!branchId) return <EmptyState title={t.crmLeads.selectBranchFirst} className="h-full" />;

  if (isLoading && stages.length === 0) {
    return (
      <div className="flex h-full gap-2 overflow-x-auto">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={`lead-board-skeleton-${index}`} className="h-full w-70 shrink-0 rounded-md" />
        ))}
      </div>
    );
  }

  if (error && items.length === 0) {
    return <ErrorState title={t.crmLeads.loadFailed} onRetry={onRetry} retryLabel={t.common.retry} className="h-full" />;
  }

  const movableStages = stages.filter((stage) => stage.flag !== LEAD_TERMINAL_STAGE_FLAG);
  const moveTargets = (lead: LeadItem) => {
    const isFinished = stages.find(({ id }) => id === lead.stageId)?.flag === LEAD_TERMINAL_STAGE_FLAG;
    if (isFinished || props.isMovePending || !props.canUpdate(lead)) return [];
    return movableStages
      .filter(({ id }) => id !== lead.stageId)
      .map((stage) => ({ id: stage.id, label: localizedName(stage, lang) }));
  };

  return (
    <DragDropContext onDragStart={board.handleDragStart} onDragEnd={board.handleDragEnd}>
      <div className="flex h-full min-h-0 gap-2 overflow-x-auto pb-2">
        {stages.map((stage) => {
          const label = localizedName(stage, lang);
          const leads = items.filter((item) => item.stageId === stage.id);
          const total = totals?.get(stage.id) ?? leads.length;
          const outcomeClassName = OUTCOME_BORDER[resolveStatusRole("LeadStageFlag", stage.flag) ?? ""] ?? "";

          if (board.isCollapsed(stage.id)) {
            return (
              <LeadBoardCollapsedColumn
                key={stage.id}
                label={label}
                count={total}
                outcomeClassName={outcomeClassName}
                onExpand={() => board.toggleCollapsed(stage.id)}
                onPointerEnter={() => board.peekCollapsed(stage.id)}
                onPointerLeave={board.cancelPeek}
              />
            );
          }
          return (
            <LeadBoardColumn
              key={stage.id}
              stage={stage}
              label={label}
              leads={leads}
              total={total}
              segments={leadActivitySegments(leads, t.crmLeads.card.activityStates)}
              outcomeClassName={outcomeClassName}
              moveTargets={moveTargets}
              board={board}
              view={props}
            />
          );
        })}
      </div>
    </DragDropContext>
  );
}
