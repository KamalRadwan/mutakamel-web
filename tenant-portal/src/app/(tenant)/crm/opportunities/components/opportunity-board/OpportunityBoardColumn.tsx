"use client";

import { Button, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { CrmBoardActivityBar } from "../../../shared/components/board/CrmBoardActivityBar";
import { CrmBoardCollapsedRail } from "../../../shared/components/board/CrmBoardCollapsedRail";
import { CrmBoardColumnHeader } from "../../../shared/components/board/CrmBoardColumnHeader";
import { CrmBoardEmptyStage } from "../../../shared/components/board/CrmBoardEmptyStage";
import { crmBoardColumnClass } from "../../../shared/components/board/board-classes";
import { formatOpportunityAmountSummary, type OpportunityStage } from "../../hooks/pipeline-types";
import { OpportunityBoardCard } from "./OpportunityBoardCard";
import { OpportunityBoardQuickAdd } from "./OpportunityBoardQuickAdd";
import { opportunityBoardActivityState } from "./opportunity-board-presentation";
import type { OpportunityExecutiveBoardViewProps } from "./opportunity-board-types";
import type { OpportunityBoardState } from "./hooks/useOpportunityBoard";

export function OpportunityBoardColumn({ stage, board, props }: {
  stage: OpportunityStage;
  board: OpportunityBoardState;
  props: OpportunityExecutiveBoardViewProps;
}) {
  const { t, lang } = useI18n();
  const lane = board.laneByStageId.get(stage.id);
  const items = lane?.items ?? [];
  const total = lane?.summary.totalCount ?? items.length;
  const title = localizedName(stage, lang);
  const terminal = stage.flag === "WON" || stage.flag === "LOST";
  const collapsed = board.isCollapsed(stage.id);
  const dropTarget = board.draggingItem !== null && board.dragOverStageId === stage.id && board.draggingItem.stageId !== stage.id;
  const activeFilter = board.columnActivityFilter[stage.id] ?? null;
  const visibleItems = activeFilter ? items.filter((item) => opportunityBoardActivityState(item) === activeFilter) : items;
  const amount = lane ? formatOpportunityAmountSummary(lane.summary.amountsByCurrency) : undefined;
  const quickAdd = board.canCreate && !terminal ? () => board.toggleQuickAdd(stage.id) : undefined;
  const emptyHint = stage.flag === "WON" || stage.flag === "LOST" ? stage.flag : "default";

  if (collapsed) return (
    <CrmBoardCollapsedRail
      title={title} count={total} countTone={stage.flag === "LOST" ? "danger" : "default"}
      onExpand={() => board.toggleCollapse(stage.id)} expandLabel={`${t.views.expandColumn}: ${title}`}
      onMouseEnter={() => board.startPeek(stage.id)} onMouseLeave={board.stopPeek}
      onDragOver={(event) => board.onDragOver(event, stage.id, true)}
      onDragLeave={(event) => board.onDragLeave(event, stage.id)}
      onDrop={(event) => board.onDrop(event, stage.id)} isDropTarget={dropTarget}
    />
  );

  return (
    <section aria-label={title} className={cn(crmBoardColumnClass, dropTarget && "ring-2 ring-primary")}
      onDragOver={(event) => board.onDragOver(event, stage.id, false)}
      onDragLeave={(event) => board.onDragLeave(event, stage.id)}
      onMouseLeave={board.stopPeek}
      onDrop={(event) => board.onDrop(event, stage.id)}>
      <CrmBoardColumnHeader
        title={title} count={total} countTone={stage.flag === "LOST" ? "danger" : "default"}
        onQuickAdd={quickAdd} quickAddLabel={`${t.crmOpportunityDetail.createAction}: ${title}`}
        onCollapse={() => board.toggleCollapse(stage.id)} collapseLabel={`${t.views.collapseColumn}: ${title}`}
        extra={amount && <div className="truncate text-caption font-medium tabular-nums text-foreground-secondary">{amount}</div>}
        activity={<CrmBoardActivityBar states={items.map(opportunityBoardActivityState)}
          labels={t.crmLeads.card.activityStates} activeState={activeFilter}
          onToggleState={(state) => board.toggleActivityFilter(stage.id, state)} ariaLabel={t.crmLeads.card.activityBar} />}
        filterPill={activeFilter && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-chip-active-line px-2 py-1 text-caption text-chip-active-fg">
            <span>{formatTemplate(t.crmOpportunities.filteredActivity, { activity: t.crmLeads.card.activityStates[activeFilter] })} ({formatNumber(visibleItems.length, lang)})</span>
            <Button type="button" variant="ghost" size="xs" onClick={() => board.clearActivityFilter(stage.id)}
              className="ms-auto h-auto p-0 text-caption underline">{t.crmOpportunities.clearFilter}</Button>
          </div>
        )}
      />
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5">
        {board.canCreate && !terminal && props.createCapability && board.quickAddStageId === stage.id && props.pipeline && (
          <OpportunityBoardQuickAdd pipeline={props.pipeline} stage={stage} branchId={props.branchId}
            createCapability={props.createCapability} onForbidden={props.onForbidden}
            onClose={board.closeQuickAdd} onCreated={board.created}
            onOpenFullForm={(draft) => { board.closeQuickAdd(); board.openFullCreate?.(stage.id, draft); }} />
        )}
        {visibleItems.length === 0 ? (
          <CrmBoardEmptyStage title={t.crmOpportunities.emptyStage.title}
            hint={t.crmOpportunities.emptyStage.hint[emptyHint]}
            icon={terminal ? "closed" : "inbox"} quickAddLabel={t.crmOpportunities.emptyStage.quickAdd} onQuickAdd={quickAdd} />
        ) : visibleItems.map((item) => (
          <OpportunityBoardCard key={item.id} item={item} stage={stage}
            isExpanded={board.expandedOpportunityId === item.id}
            canDrag={!props.isMutating && board.canUpdate(item) && board.expandedOpportunityId !== item.id}
            canUpdate={board.canUpdate(item)} canDelete={board.canDelete(item)}
            moveTargets={board.moveTargets.filter((target) => target.id !== item.stageId)}
            isDragging={board.draggingItem?.id === item.id}
            onDragStart={() => board.startDrag(item)} onDragEnd={board.clearDragState}
            onToggleExpand={() => board.toggleExpand(item.id)} onOpen={() => props.onOpen(item)}
            onOpenQuickModal={() => props.onOpenQuickModal?.(item)} onDelete={() => props.onDelete(item)}
            onOpenActivities={() => props.onOpenActivities(item)}
            onCardChange={(patch) => props.onCardChange(item.id, patch, item)}
            onMove={(target) => props.onMoveCard(item.id, item.stageId, target)} />
        ))}
        {lane?.pageInfo.hasMore && (
          <Button type="button" variant="outline" size="xs" className="w-full"
            disabled={props.loadingStageId === stage.id} onClick={() => props.onLoadMoreStage(stage.id)}>
            {props.loadingStageId === stage.id ? t.crmOpportunities.loadingMore : t.crmOpportunities.loadMore(items.length, total)}
          </Button>
        )}
      </div>
    </section>
  );
}
