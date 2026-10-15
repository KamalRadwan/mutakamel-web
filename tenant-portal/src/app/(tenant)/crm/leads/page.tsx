"use client";

import {
  Button,
  DegradedBanner,
  EmptyState,
  PageHeader,
  PermissionGate,
  PageActions,
  ViewSwitcher,
} from "@/design-system";
import { ActivitiesWorkspaceLink } from "@/components/activities/ActivitiesWorkspaceLink";
import { ActivityModal } from "@/components/activities/ActivityModal";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { CreateLeadsModal } from "./components/CreateLeadsModal";
import { DeleteLeadsConfirmModal } from "./components/DeleteLeadsConfirmModal";
import { LeadBulkActionsBar } from "./components/LeadBulkActionsBar";
import { LeadBoardView } from "./components/board/LeadBoardView";
import { LeadCardView } from "./components/card-view/LeadCardView";
import { LeadTableView } from "./components/table-view/LeadTableView";
import { LeadKpiStrip } from "./components/LeadKpiStrip";
import { LeadStageFunnelBar } from "./components/LeadStageFunnelBar";
import { LeadSearchBar } from "./components/LeadSearchBar";
import { useLeadsWorkspace } from "./hooks/useLeadsWorkspace";

export default function LeadsPage() {
  const { t } = useI18n();
  const {
    items,
    stages,
    branchIds,
    branchId,
    selectBranch,
    canCreate,
    canUpdateLead,
    canDeleteLead,
    isLoading,
    isDeleting,
    isMovePending,
    error,
    loadError,
    degraded,
    search,
    setSearch,
    submitSearch,
    pageInfo,
    isCreateOpen,
    selectedForDelete,
    setSelectedForDelete,
    handleCreate,
    handleDelete,
    moveLead,
    updateLeadCard,
    fetchLeads,
    refreshData,
    workspace,
    view,
    board,
    boardErrorMessage,
    documentCounts,
    kpis,
    bulk,
    create,
    activityLead,
    closeActivities,
    openActivities,
    openLead,
    stageFilter,
    filterStage,
    stageFlagFilter,
    filterStageFlag,
    saveInlinePhone,
  } = useLeadsWorkspace();

  return (
    <PermissionGate require="crm.leads.read" scoped>
      <div className="flex h-full flex-col gap-3">
        {/* Preserve the accessible heading; actions render in the shell's action bar. */}
        <PageHeader
          className="sr-only"
          title={t.crmLeads.title}
          primaryAction={
            canCreate
              ? { label: t.crmLeads.addLead, onClick: () => create.openInStage(null) }
              : undefined
          }
          secondaryActions={
            <div className="flex flex-wrap items-center gap-2">
              <LeadKpiStrip
                kpis={kpis}
                stageFlag={stageFlagFilter}
                onStageFlagChange={filterStageFlag}
                disabled={!branchId}
              />
              <TenantBranchSelect
                branchIds={branchIds}
                branchId={branchId}
                onChange={selectBranch}
                disabled={isLoading || isMovePending}
              />
            </div>
          }
        />

        <LeadSearchBar
          value={search}
          onChange={setSearch}
          onSubmit={submitSearch}
          stages={stages}
          resetKey={branchId ?? "no-branch"}
          disabled={!branchId}
        />

        {view !== "board" && stages.length > 0 && search.mode === "basic" && (
          <LeadStageFunnelBar
            stages={stages}
            kpis={kpis}
            value={stageFilter}
            onChange={filterStage}
            disabled={!branchId}
          />
        )}

        {view !== "board" && <LeadBulkActionsBar bulk={bulk} />}

        <PageActions slot="view">
          <ViewSwitcher
            value={view}
            onChange={workspace.setView}
            available={["board", "card", "table"]}
            labels={{ board: t.views.board, card: t.views.card, table: t.views.table }}
          />
          <ActivitiesWorkspaceLink type="LEAD" />
        </PageActions>

        {degraded.stages && <DegradedBanner message={t.crmLeads.stagesUnavailable} />}
        {degraded.capabilities && <DegradedBanner message={t.crmLeads.capabilitiesUnavailable} />}

        {/* Load errors belong to the view; this alert carries write feedback. */}
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-destructive/30 bg-destructive-subtle p-2.5 text-xs text-destructive"
          >
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void fetchLeads()}>
              {t.common.retry}
            </Button>
          </div>
        )}

        <div className="min-h-0 flex-1">
          {!branchId ? (
            <EmptyState title={t.crmLeads.selectBranchFirst} />
          ) : (
            <>
              {view === "board" && (
                <LeadBoardView
                  stages={stages}
                  items={board.items}
                  totals={board.totals}
                  branchId={branchId}
                  canCreate={canCreate}
                  canUpdate={canUpdateLead}
                  canDelete={canDeleteLead}
                  isMovePending={isMovePending}
                  isLoading={board.isLoading || (isLoading && stages.length === 0)}
                  error={boardErrorMessage}
                  onRetry={() => void board.reload()}
                  onOpenLead={openLead}
                  onOpenActivities={openActivities}
                  onDeleteLead={setSelectedForDelete}
                  onMoveStage={(leadId, toStageId, lead) => void moveLead(leadId, toStageId, lead)}
                  onCardChange={(leadId, patch, lead) => void updateLeadCard(leadId, patch, lead)}
                  onOpenCreateModal={create.openInStage}
                  onQuickCreateLead={create.quickCreate}
                  hasMoreStage={(stageId) => board.lanes[stageId]?.hasMore ?? false}
                  isLoadingMoreStage={(stageId) => board.loadingStageIds.has(stageId)}
                  onLoadMoreStage={(stageId) => void board.loadMoreStage(stageId)}
                />
              )}

              {view === "card" && (
                <LeadCardView
                  items={items}
                  stages={stages}
                  selection={workspace.selection}
                  canUpdate={canUpdateLead}
                  canDelete={canDeleteLead}
                  isLoading={isLoading}
                  error={loadError}
                  onRetry={() => void fetchLeads()}
                  page={pageInfo}
                  onPageChange={workspace.setPage}
                  sort={workspace.sort}
                  onSortChange={workspace.setSort}
                  documentCountsByParty={documentCounts.countsByParty}
                  documentCountVisibility={documentCounts.visible}
                  onOpenLead={openLead}
                  onOpenActivities={openActivities}
                  onDeleteLead={setSelectedForDelete}
                  onMoveStage={(lead, toStageId) => void moveLead(lead.id, toStageId, lead)}
                  onCardChange={(leadId, patch, lead) => void updateLeadCard(leadId, patch, lead)}
                />
              )}

              {view === "table" && (
                <LeadTableView
                  items={items}
                  stages={stages}
                  selection={workspace.selection}
                  canUpdate={canUpdateLead}
                  canDelete={canDeleteLead}
                  isLoading={isLoading}
                  error={loadError}
                  onRetry={() => void fetchLeads()}
                  page={pageInfo}
                  onPageChange={workspace.setPage}
                  sort={workspace.sort}
                  onSortChange={workspace.setSort}
                  onOpenActivities={openActivities}
                  onDeleteLead={setSelectedForDelete}
                  onMoveStage={(lead, stageId) => void moveLead(lead.id, stageId, lead)}
                  onCardChange={(leadId, patch, lead) => void updateLeadCard(leadId, patch, lead)}
                  onInlinePhoneSave={saveInlinePhone}
                />
              )}
            </>
          )}
        </div>

        {/* Mounted only while open, so its catalogues are read only for a create, and
            every opening starts from its own column's stage and quick-add draft. */}
        {isCreateOpen && (
          <CreateLeadsModal
            stages={stages}
            branchId={branchId}
            initialStageId={create.stageId ?? undefined}
            initialDraft={create.draft}
            onSubmit={handleCreate}
            error={error}
            onClose={create.close}
          />
        )}

        {/* A different lead opens a clean form; activity changes reload server data. */}
        <ActivityModal
          scope="CRM"
          branchId={branchId}
          request={activityLead ? { kind: "create", target: activityLead, agenda: true } : null}
          onClose={closeActivities}
          onChanged={() => void refreshData()}
        />

        <DeleteLeadsConfirmModal
          isOpen={selectedForDelete !== null}
          item={selectedForDelete}
          onClose={() => setSelectedForDelete(null)}
          onConfirm={() => void handleDelete()}
          isDeleting={isDeleting}
          error={selectedForDelete ? error : null}
        />
      </div>
    </PermissionGate>
  );
}
