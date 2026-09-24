"use client";

import {
  AmbiguousOutcomePanel,
  DegradedBanner,
  FilterBar,
  PageActions,
  PageHeader,
  PermissionGate,
  ViewSwitcher,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import type { ActivityScope } from "../activity-contract";
import { ActivityModal } from "../ActivityModal";
import { ActivityOutcomeDialog } from "../ActivityOutcomeDialog";
import type { ActivityCommandKind } from "../hooks/useActivityCommands";
import { activityFilterDefs, activityFilterUpdates, activityFilterValues } from "./activity-filter-defs";
import { ActivitiesEmptyState, type ActivitiesEmptyStateProps } from "./ActivitiesEmptyState";
import { ActivityBoardPane } from "./ActivityBoardPane";
import { ActivityCalendarPane } from "./ActivityCalendarPane";
import { ActivityKpiStrip } from "./ActivityKpiStrip";
import { ActivityRelatedChip } from "./ActivityRelatedChip";
import { ActivityTablePane } from "./ActivityTablePane";
import { ACTIVITY_VIEWS, useActivitiesWorkspace } from "./hooks/useActivitiesWorkspace";

export interface ActivitiesWorkspaceProps {
  /** `CRM` lists and books activities on CRM records only; `ALL` on every application's. */
  scope: ActivityScope;
}

/**
 * The Activities workspace — calendar, board and table over Core's activity
 * hub, with the KPI strip and the filters above them. One component serves
 * `/crm/activities` and `/core/activities`; see
 * docs/design/views.md#activities--the-time-based-workspace.
 */
export function ActivitiesWorkspace({ scope }: ActivitiesWorkspaceProps) {
  const { t } = useI18n();
  const copy = t.activities;
  const workspace = useActivitiesWorkspace(scope);
  const { view, query, writes, summary } = workspace;
  const { commands, outcome, modal } = writes;
  const ambiguous = commands.ambiguous;

  const summaryTotal = summary.data?.byStatus.reduce((sum, entry) => sum + entry.total, 0);
  const emptyState = (reason: ActivitiesEmptyStateProps["reason"], compact = false) => (
    <ActivitiesEmptyState
      reason={reason}
      compact={compact}
      className={compact ? undefined : "h-full"}
      onClearFilters={query.clearFilters}
      onCreate={writes.canCreate ? modal.openCreate : undefined}
    />
  );
  // Only the calendar can be empty for its period alone; "nothing yet" there
  // needs the summary to say there is nothing anywhere.
  const calendarEmpty = workspace.filtered ? "filtered" : summaryTotal === 0 ? "none" : "period";
  const listEmpty = workspace.filtered ? "filtered" : "none";

  const operations: Record<ActivityCommandKind, string> = {
    create: copy.form.submitCreate,
    update: copy.form.submitEdit,
    start: copy.actions.start,
    moveBack: copy.actions.moveBack,
    complete: copy.actions.markDone,
    cancel: copy.actions.cancelActivity,
  };

  return (
    <PermissionGate require="activities.read" scoped denied={workspace.denied}>
      <div className="flex h-full min-h-0 flex-col gap-4">
        {/* The accessible heading stays on the page; the actions render in the shell's action bar. */}
        <PageHeader
          className="sr-only"
          title={copy.title}
          primaryAction={writes.canCreate ? { label: copy.newActivity, onClick: modal.openCreate } : undefined}
          secondaryActions={
            <TenantBranchSelect
              allowAll
              branchIds={workspace.branch.branchIds}
              branchId={workspace.branch.branchId}
              onChange={workspace.branch.selectBranch}
              // Held only while a write is in flight, so a moved card's lanes
              // are not swapped out under it; an unknown outcome blocks writes, not reads.
              disabled={commands.pendingKind !== null}
            />
          }
        />

        <div className="flex flex-col gap-2">
          <FilterBar
            filters={activityFilterDefs(t, workspace.calendar.weekStartsOn, workspace.withDueRange)}
            values={activityFilterValues(query.filters, workspace.withDueRange)}
            onChange={(next) => query.applyFilters(activityFilterUpdates(next, workspace.withDueRange))}
            onReset={query.clearFilters}
            searchValue={query.filters.search}
            onSearchChange={query.setSearch}
            searchPlaceholder={copy.workspace.filters.search}
            filtersLabel={t.filters.label}
            clearAllLabel={copy.workspace.filters.clear}
            moreChipsLabel={t.filters.more}
            overflowChipsLabel={t.filters.overflow}
            removeChipLabel={t.filters.remove}
          />
          {query.filters.related && <ActivityRelatedChip related={query.filters.related} onRemove={query.clearRelated} />}
        </div>

        <PageActions slot="view">
          <ViewSwitcher
            value={view}
            onChange={workspace.setView}
            available={ACTIVITY_VIEWS}
            labels={{ calendar: t.views.calendar, board: t.views.board, table: t.views.table }}
          />
        </PageActions>

        {summary.error && <DegradedBanner message={copy.workspace.summaryUnavailable} />}
        <ActivityKpiStrip summary={summary.data} failed={summary.error !== null} />

        {ambiguous && (
          // The write may have applied. Its key is the only safe way forward,
          // so it stays on screen until the user retries or dismisses it.
          <AmbiguousOutcomePanel
            operation={operations[ambiguous.kind]}
            idempotencyKey={ambiguous.idempotencyKey}
            correlationId={ambiguous.correlationId}
            description={copy.ambiguous.description}
            onRetry={() => void writes.retryAmbiguous()}
            onDismiss={writes.dismissAmbiguous}
            retrying={commands.pendingKind !== null}
            labels={{
              title: copy.ambiguous.title,
              operation: copy.ambiguous.operation,
              idempotencyKey: copy.ambiguous.key,
              correlationId: copy.ambiguous.reference,
              retry: copy.ambiguous.retry,
              dismiss: t.common.dismiss,
            }}
          />
        )}

        {/* Every state of every view owns the rest of the pane's height. */}
        <div className="min-h-0 flex-1">
          {view === "calendar" && (
            <ActivityCalendarPane
              data={workspace.calendar.data}
              mode={query.calendar.mode}
              onModeChange={query.setCalendarMode}
              anchor={workspace.calendar.anchor}
              onAnchorChange={query.setCalendarAnchor}
              weekStartsOn={workspace.calendar.weekStartsOn}
              onOpen={writes.rowActions.view}
              onCreateAt={writes.canCreate ? modal.openCreateAt : undefined}
              emptyState={emptyState(calendarEmpty, true)}
            />
          )}
          {view === "board" && (
            <ActivityBoardPane
              board={workspace.board}
              statuses={workspace.statuses}
              summary={summary.data}
              overdueOnly={query.filters.overdue}
              moves={writes.moves}
              actions={writes.rowActions}
              actorId={writes.actorId}
              emptyState={emptyState(listEmpty)}
            />
          )}
          {view === "table" && (
            <ActivityTablePane
              table={workspace.table}
              sort={workspace.tableSort}
              onSortChange={workspace.setTableSort}
              onPageChange={workspace.setTablePage}
              actions={writes.rowActions}
              actorId={writes.actorId}
              emptyState={emptyState(listEmpty)}
            />
          )}
        </div>

        {/* One template modal and one outcome dialog for the whole workspace. */}
        <ActivityModal
          request={modal.request}
          scope={scope}
          branchId={workspace.branch.branchId}
          onClose={modal.close}
          onChanged={workspace.refresh}
        />
        <ActivityOutcomeDialog
          open={outcome.open}
          mode={outcome.mode}
          onClose={outcome.close}
          onConfirm={(text) => void outcome.confirm(text)}
          loading={outcome.loading}
          error={outcome.error}
        />
      </div>
    </PermissionGate>
  );
}
