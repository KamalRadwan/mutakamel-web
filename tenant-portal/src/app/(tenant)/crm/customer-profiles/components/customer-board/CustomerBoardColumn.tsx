"use client";

import { X } from "lucide-react";
import { Button, cn } from "@/design-system";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { crmActivityState } from "../../../shared/crm-activity-tone";
import { CrmActivityPill } from "../../../shared/components/board/CrmActivityPill";
import { CrmBoardActivityBar } from "../../../shared/components/board/CrmBoardActivityBar";
import { CrmBoardCollapsedRail } from "../../../shared/components/board/CrmBoardCollapsedRail";
import { CrmBoardColumnHeader } from "../../../shared/components/board/CrmBoardColumnHeader";
import { CrmBoardEmptyStage } from "../../../shared/components/board/CrmBoardEmptyStage";
import { crmBoardColumnClass } from "../../../shared/components/board/board-classes";
import { BLACKLISTED_STATUS } from "../../customer-profile-contract";
import type { CustomerProfileStatus } from "../../hooks/useCustomerProfiles";
import { CustomerBoardDraggableCard } from "./CustomerBoardDraggableCard";
import { CustomerBoardQuickAddCard } from "./CustomerBoardQuickAddCard";
import type { useCustomerBoard } from "./useCustomerBoard";

export function CustomerBoardColumn({ status, board }: {
  status: CustomerProfileStatus; board: ReturnType<typeof useCustomerBoard>;
}) {
  const { t, statusTitle, columnItems, draggingItem, dragOverStatus, branchId,
    statusTotals, lanes, loadingStatuses, onLoadMoreStatus, sources = [], canCreate,
    quickAddStatus, setQuickAddStatus, onOpenFullCreate, onRefreshBoard } = board;
  const title = statusTitle(status);
  const { allItems, visibleItems, activeState } = columnItems(status);
  const total = statusTotals.get(status) ?? allItems.length;
  const terminal = status === BLACKLISTED_STATUS;
  const canQuickAdd = Boolean(canCreate && branchId && !terminal);
  const quickAddOpen = canQuickAdd && quickAddStatus === status;
  const dropTarget = Boolean(draggingItem && draggingItem.status !== status && dragOverStatus === status);
  const activityLabels = t.crmLeads.card.activityStates;
  const emptyStage = t.crmCustomerProfiles.ui.board.emptyStage;
  const hint = terminal ? emptyStage.hint.BLACKLISTED : emptyStage.hint.default;
  const quickAddLabel = formatTemplate(t.crmCustomerProfiles.ui.board.quick_add_in_status, { statusTitle: title });

  if (board.isCollapsed(status)) {
    return (
      <CrmBoardCollapsedRail title={title} count={total} countTone={terminal ? "danger" : "default"}
        expandLabel={`${t.views.expandColumn}: ${title}`}
        onExpand={() => board.toggleCollapse(status)}
        onMouseEnter={() => board.peekColumn(status)} onMouseLeave={board.cancelPeek}
        onDragOver={(event) => board.dragOver(status, event)}
        onDragLeave={(event) => board.dragLeave(status, event)}
        onDrop={(event) => board.drop(status, event)} isDropTarget={dropTarget} />
    );
  }

  return (
    <section aria-label={title} className={cn(crmBoardColumnClass, dropTarget && "ring-2 ring-primary")}
      onDragOver={(event) => board.dragOver(status, event)}
      onDragLeave={(event) => board.dragLeave(status, event)}
      onDrop={(event) => board.drop(status, event)}>
      <CrmBoardColumnHeader title={title} count={total} countTone={terminal ? "danger" : "default"}
        quickAddLabel={quickAddLabel} collapseLabel={`${t.views.collapseColumn}: ${title}`}
        onQuickAdd={canQuickAdd && !quickAddOpen ? () => setQuickAddStatus(status) : undefined}
        onCollapse={() => board.toggleCollapse(status)}
        activity={<CrmBoardActivityBar states={allItems.map((item) => crmActivityState(item.nextActivity))}
          labels={activityLabels} activeState={activeState}
          onToggleState={(state) => board.toggleActivityFilter(status, state)}
          ariaLabel={formatTemplate(t.crmCustomerProfiles.ui.board.filter_tasks_by_status, { statusTitle: title })} />}
        extra={quickAddOpen ? <span className="text-caption text-muted-foreground">{t.crmCustomerProfiles.ui.board.quick_adding}</span> : undefined}
        filterPill={activeState ? (
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <CrmActivityPill state={activeState}
              label={`${activityLabels[activeState]} (${formatNumber(visibleItems.length, board.lang)})`} />
            <Button type="button" variant="ghost" size="xs" onClick={() => board.clearActivityFilter(status)}
              className="h-auto gap-0.5 p-0 text-caption text-muted-foreground">
              <X className="size-3" aria-hidden="true" />{t.crmCustomerProfiles.ui.board.clear}
            </Button>
          </div>
        ) : undefined} />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
        {quickAddOpen && branchId && (
          <CustomerBoardQuickAddCard status={status} statusTitle={title} branchId={branchId} sources={sources}
            onCancel={() => setQuickAddStatus(null)}
            onOpenFullModal={(draft) => { setQuickAddStatus(null); onOpenFullCreate?.(status, draft); }}
            onCreated={() => { setQuickAddStatus(null); onRefreshBoard?.(); }} />
        )}
        {visibleItems.length === 0 && !quickAddOpen && (
          <CrmBoardEmptyStage title={emptyStage.title} hint={hint} icon={terminal ? "closed" : "inbox"}
            quickAddLabel={emptyStage.quickAdd}
            onQuickAdd={canQuickAdd ? () => setQuickAddStatus(status) : undefined} />
        )}
        {visibleItems.map((item) => <CustomerBoardDraggableCard key={item.id} item={item} board={board} />)}
      </div>
      {lanes[status]?.hasMore && (
        <div className="shrink-0 border-t border-line-divider bg-surface-column-header p-2">
          <Button type="button" variant="ghost" size="xs" className="w-full" disabled={loadingStatuses.has(status)}
            onClick={() => onLoadMoreStatus(status)}>
            {loadingStatuses.has(status) ? t.crmLeads.loadingMore : t.crmLeads.loadMore(allItems.length, total)}
          </Button>
        </div>
      )}
    </section>
  );
}
