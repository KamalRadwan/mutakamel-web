"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  DegradedBanner,
  EmptyState,
  PageHeader,
  PermissionGate,
  PageActions,
  ViewSwitcher,
  useWorkspaceState,
} from "@/design-system";
import { ActivitiesWorkspaceLink } from "@/components/activities/ActivitiesWorkspaceLink";
import { ActivityModal } from "@/components/activities/ActivityModal";
import type { ActivityTargetSelection } from "@/components/activities/activity-contract";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { CrmScopeGate } from "../shared/components/CrmScopeGate";
import { useCrmErrorText } from "../shared/hooks/useCrmErrorText";
import { CreateLeadsModal } from "./components/CreateLeadsModal";
import { DeleteLeadsConfirmModal } from "./components/DeleteLeadsConfirmModal";
import { LeadBulkActionsBar } from "./components/LeadBulkActionsBar";
import { LeadExecutiveBoardView } from "./components/LeadExecutiveBoardView";
import { LeadExecutiveCardView } from "./components/LeadExecutiveCardView";
import { LeadExecutiveTableView } from "./components/LeadExecutiveTableView";
import { LeadKpiStrip } from "./components/LeadKpiStrip";
import { LeadQuickEditModal } from "./components/LeadQuickEditModal";
import { LeadStageFunnelBar } from "./components/LeadStageFunnelBar";
import { LeadSearchBar } from "./components/LeadSearchBar";
import { LeadSortMenu } from "./components/LeadSortMenu";
import { leadPrimaryPhonePatch } from "./lead-phone-patch";
import {
  type CreateLeadRequest,
  type QuickCreateLeadDraft,
} from "./lead-create-contract";
import { createLeadFormFromQuickRequest } from "./lead-quick-create-draft";
import { leadSearchValuesOf, leadSearchWithField } from "./lead-search-contract";
import {
  DEFAULT_LEADS_SORT,
  type LeadItem,
  useLeads,
} from "./hooks/useLeads";
import { useLeadDocumentCounts } from "./hooks/useLeadDocumentCounts";
import { useLeadKpis } from "./hooks/useLeadKpis";
import { useLeadBulkDelete } from "./hooks/useLeadCardWrites";
import { useLeadBulkOwnerOptions } from "./hooks/useLeadMutations";

// A lead in a CONVERTED stage is finished: the backend rejects the move and
// the board must not offer it as a destination either — see
// docs/api/crm-leads.md.
const TERMINAL_STAGE_FLAG = "CONVERTED";

export default function LeadsPage() {
  const { t } = useI18n();
  const { canMutate } = useAccessMode();
  const errorText = useCrmErrorText();
  const router = useRouter();
  const {
    board,
    items,
    stages,
    branchIds,
    branchId,
    selectBranch,
    canCreate: capabilityCanCreate,
    canUpdateLead: capabilityCanUpdateLead,
    canDeleteLead: capabilityCanDeleteLead,
    isLoading,
    isDeleting,
    isMovePending,
    error,
    loadError,
    scopeDenied: listScopeDenied,
    degraded,
    search,
    appliedSearch,
    setSearch,
    submitSearch,
    pageInfo,
    setPage,
    setSort,
    sort,
    activeView,
    setActiveView,
    isCreateOpen,
    setIsCreateOpen,
    openCreate,
    selectedForDelete,
    setSelectedForDelete,
    handleCreate,
    handleDelete,
    moveLead,
    updateLeadCard,
    updateLeadInline,
    bulkMoveStage,
    bulkUpdateLeads,
    bulkDeleteLeads,
    fetchLeads,
    dataRevision,
    refreshData,
  } = useLeads();
  const canCreate = canMutate && capabilityCanCreate;
  const canUpdateLead = (lead: LeadItem) => canMutate && capabilityCanUpdateLead(lead);
  const canDeleteLead = (lead: LeadItem) => canMutate && capabilityCanDeleteLead(lead);

  // Keep identity only: booking an activity reloads the lead's current data.
  const [activityLead, setActivityLead] = useState<ActivityTargetSelection | null>(null);
  const openActivities = useCallback(
    (lead: LeadItem) => setActivityLead({ app: "CRM", type: "LEAD", id: lead.id, label: lead.leadName }),
    [],
  );

  // Centered 360° Quick-Edit & Inspector Modal state (Screen 04 - zero <aside>)
  const [quickEditLead, setQuickEditLead] = useState<LeadItem | null>(null);
  const kpiPreset = appliedSearch.kpiPreset ?? "ALL";

  // A column's add action seeds the editable stage (and any draft typed in the
  // quick-add card); the header leaves both unset.
  const [createStageId, setCreateStageId] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState<QuickCreateLeadDraft | null>(null);
  const openCreateInStage = useCallback(
    (stageId: string | null, draft?: QuickCreateLeadDraft) => {
      setCreateStageId(stageId);
      setCreateDraft(draft ?? null);
      openCreate();
    },
    [openCreate],
  );

  const applyPage = useCallback((next: number) => setPage(next), [setPage]);
  const openLead = useCallback(
    (lead: LeadItem) => router.push(`/crm/leads/${lead.id}`),
    [router],
  );
  const applySort = useCallback(
    (next: { id: string; direction: "asc" | "desc" }) => setSort(next),
    [setSort],
  );
  const workspace = useWorkspaceState("leads", {
    defaultView: "board",
    defaultSort: DEFAULT_LEADS_SORT,
    onPageChange: applyPage,
    onSortChange: applySort,
  });
  const { view, setView } = workspace;

  useEffect(() => {
    const next = view === "table" ? "list" : view;
    if (activeView !== next) setActiveView(next);
  }, [activeView, setActiveView, view]);

  const documentCounts = useLeadDocumentCounts(items, branchId, view === "card");
  // Pill counts describe the base search, so changing presets keeps the other counts usable.
  const kpis = useLeadKpis({ branchId, search: { ...appliedSearch, kpiPreset: "ALL" }, revision: dataRevision, enabled: Boolean(branchId) });

  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.id, stage])), [stages]);

  const visibleItems = items;
  const visibleBoardItems = board.items;
  const canUpdateSelected = visibleItems.some((item) =>
    workspace.selection.selectedIds.has(item.id) && canUpdateLead(item) &&
    stageById.get(item.stageId)?.flag !== TERMINAL_STAGE_FLAG,
  );
  const bulkOwners = useLeadBulkOwnerOptions(branchId, view !== "board" && canUpdateSelected);
  const bulkDelete = useLeadBulkDelete({
    scopeKey: JSON.stringify([branchId, workspace.page, pageInfo.page, search, appliedSearch, sort, kpiPreset]),
    items: visibleItems,
    selectedIds: workspace.selection.selectedIds,
    onSelectionChange: workspace.selection.onSelectionChange,
    canDeleteLead,
    deleteLeads: bulkDeleteLeads,
    disabled: isLoading || isDeleting,
  });

  const nonTerminalStages = useMemo(
    () => stages.filter((st) => st.flag !== TERMINAL_STAGE_FLAG),
    [stages],
  );

  const handleInColumnQuickCreate = useCallback(
    async (payload: CreateLeadRequest, rating?: number) => {
      return handleCreate(
        createLeadFormFromQuickRequest(payload, "quick-col-contact-1"),
        rating,
      );
    },
    [handleCreate],
  );

  const selectedStageFilter =
    search.mode === "basic" ? leadSearchValuesOf(search, "stage")[0] : undefined;

  const scopeDenied = view === "board" ? board.error?.status === 403 : listScopeDenied;
  const boardErrorMessage = errorText(board.error ?? loadError);
  const listErrorMessage = errorText(loadError);

  return (
    <PermissionGate require={["crm.leads.read", "crm.lead_stages.read"]} scoped>
      <div className="flex h-full flex-col gap-3">
        {/* Preserve the accessible heading; actions render in the shell's top action bar alongside KPI pills. */}
        <PageHeader
          className="sr-only"
          title={t.crmLeads.title}
          primaryAction={
            canCreate
              ? { label: t.crmLeads.addLead, onClick: () => openCreateInStage(null) }
              : undefined
          }
          secondaryActions={
            <div className="flex flex-wrap items-center gap-2">
              {branchId && (
                <LeadKpiStrip
                  kpis={kpis}
                  activePreset={kpiPreset}
                  onSelectPreset={(preset) => {
                    workspace.setPage(1);
                    setSearch({ ...search, kpiPreset: preset });
                  }}
                />
              )}
              <TenantBranchSelect
                branchIds={branchIds}
                branchId={branchId}
                onChange={selectBranch}
                disabled={isLoading || isMovePending}
              />
            </div>
          }
        />

        {/* Search & Filter Command Bar (Screen 01..08) */}
        <LeadSearchBar
          value={search}
          onChange={setSearch}
          onSubmit={submitSearch}
          stages={stages}
          resetKey={branchId ?? "no-branch"}
          disabled={!branchId}
        />

        {/* Full-Width Stage Funnel Ribbon for Card & Table Views (Screens 05, 06, 07) */}
        {view !== "board" && stages.length > 0 && search.mode === "basic" && (
          <LeadStageFunnelBar
            stages={stages}
            leads={items}
            selectedStageId={selectedStageFilter}
            onSelectStage={(stageId) =>
              setSearch(leadSearchWithField(search, "stage", stageId ?? ""))
            }
            disabled={!branchId}
          />
        )}

        {/* Floating Dark Bottom Bulk Action Command Bar (Screen 07) */}
        {canMutate && view !== "board" && workspace.selection.selectedIds.size > 0 && (
          <LeadBulkActionsBar
            selectedIds={workspace.selection.selectedIds}
            stages={nonTerminalStages}
            canUpdateAny={canUpdateSelected}
            owners={bulkOwners.owners}
            ownersLoading={bulkOwners.isLoading}
            ownersFailed={bulkOwners.failed}
            canDeleteAny={bulkDelete.eligibleCount > 0}
            deleteEligibleCount={bulkDelete.eligibleCount}
            isDeleting={isDeleting || isLoading}
            onBulkMoveStage={async (stageId) => {
              const ids = Array.from(workspace.selection.selectedIds);
              await bulkMoveStage(ids, stageId);
              workspace.selection.onSelectionChange(new Set());
            }}
            onBulkSetRating={async (rating) => {
              const ids = Array.from(workspace.selection.selectedIds);
              await bulkUpdateLeads(ids, { rating });
              workspace.selection.onSelectionChange(new Set());
            }}
            onBulkAssignOwner={async (ownerUserId) => {
              const ids = visibleItems.filter((item) => workspace.selection.selectedIds.has(item.id)).map((item) => item.id);
              if (await bulkUpdateLeads(ids, { ownerUserId })) {
                workspace.selection.onSelectionChange(new Set());
              }
            }}
            onBulkDelete={bulkDelete.request}
            onClearSelection={() => workspace.selection.onSelectionChange(new Set())}
          />
        )}

        <PageActions slot="view">
          <ViewSwitcher
            value={view}
            onChange={setView}
            available={["board", "card", "table"]}
            labels={{ board: t.views.board, card: t.views.card, table: t.views.table }}
          />
          <LeadSortMenu sort={workspace.sort ?? DEFAULT_LEADS_SORT} setSort={workspace.setSort} />
          <ActivitiesWorkspaceLink type="LEAD" />
        </PageActions>

        {!scopeDenied && degraded.stages && <DegradedBanner message={t.crmLeads.stagesUnavailable} />}
        {!scopeDenied && degraded.capabilities && <DegradedBanner message={t.crmLeads.capabilitiesUnavailable} />}

        {/* Load errors belong to the view; this alert carries write feedback. */}
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-destructive/30 bg-destructive-subtle p-2.5 text-xs text-destructive-subtle-foreground"
          >
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void fetchLeads()}>
              {t.common.retry}
            </Button>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col">
          {!branchId ? (
            <EmptyState title={t.crmLeads.selectBranchFirst} />
          ) : scopeDenied ? (
            <CrmScopeGate />
          ) : (
            <>
              {view === "board" && (
                <LeadExecutiveBoardView
                  stages={stages}
                  items={visibleBoardItems}
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
                  onOpenQuickModal={setQuickEditLead}
                  onOpenActivities={openActivities}
                  onDeleteLead={setSelectedForDelete}
                  onMoveStage={(leadId, toStageId, lead) => void moveLead(leadId, toStageId, lead)}
                  onCardChange={(leadId, patch, lead) => void updateLeadCard(leadId, patch, lead)}
                  onOpenCreateModal={(stageId, draft) => openCreateInStage(stageId, draft)}
                  onQuickCreateLead={handleInColumnQuickCreate}
                  hasMoreStage={(stageId) => board.lanes[stageId]?.hasMore ?? false}
                  isLoadingMoreStage={(stageId) => board.loadingStageIds.has(stageId)}
                  onLoadMoreStage={(stageId) => void board.loadMoreStage(stageId)}
                />
              )}

              {view === "card" && (
                <LeadExecutiveCardView
                  items={visibleItems}
                  stages={stages}
                  branchId={branchId}
                  selectedIds={workspace.selection.selectedIds}
                  onSelectionChange={workspace.selection.onSelectionChange}
                  canUpdate={canUpdateLead}
                  canDelete={canDeleteLead}
                  isLoading={isLoading}
                  error={listErrorMessage}
                  onRetry={() => void fetchLeads()}
                  page={pageInfo}
                  onPageChange={workspace.setPage}
                  sort={workspace.sort}
                  onSortChange={workspace.setSort}
                  documentCountsByParty={documentCounts.countsByParty}
                  onOpenLead={openLead}
                  onOpenQuickModal={setQuickEditLead}
                  onOpenActivities={openActivities}
                  onDeleteLead={setSelectedForDelete}
                  onMoveStage={(lead, toStageId) => void moveLead(lead.id, toStageId, lead)}
                  onCardChange={(leadId, patch, lead) => void updateLeadCard(leadId, patch, lead)}
                />
              )}

              {view === "table" && (
                <LeadExecutiveTableView
                  items={visibleItems}
                  stages={stages}
                  branchId={branchId}
                  selectedIds={workspace.selection.selectedIds}
                  onSelectionChange={workspace.selection.onSelectionChange}
                  canUpdate={canUpdateLead}
                  canDelete={canDeleteLead}
                  isLoading={isLoading}
                  error={listErrorMessage}
                  onRetry={() => void fetchLeads()}
                  page={pageInfo}
                  onPageChange={workspace.setPage}
                  sort={workspace.sort}
                  onSortChange={workspace.setSort}
                  onOpenQuickModal={setQuickEditLead}
                  onOpenActivities={openActivities}
                  onDeleteLead={setSelectedForDelete}
                  onMoveStage={(lead, stageId) => void moveLead(lead.id, stageId, lead)}
                  onCardChange={(leadId, patch, lead) => void updateLeadCard(leadId, patch, lead)}
                  onInlinePhoneSave={(lead, nextPhone) => {
                    const patch = leadPrimaryPhonePatch(lead, nextPhone);
                    if (Object.keys(patch).length > 0) void updateLeadInline(lead.id, patch, lead);
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* Centered 360° Quick-Edit & Inspector Modal (Screen 04 — zero <aside>) */}
        <LeadQuickEditModal
          lead={quickEditLead}
          leads={view === "board" ? visibleBoardItems : visibleItems}
          stages={stages}
          branchId={branchId}
          canUpdate={quickEditLead ? canUpdateLead(quickEditLead) : false}
          canDelete={quickEditLead ? canDeleteLead(quickEditLead) : false}
          onClose={() => setQuickEditLead(null)}
          onNavigateLead={setQuickEditLead}
          onMoveStage={(lead, stageId) => moveLead(lead.id, stageId, lead)}
          onOpenActivities={openActivities}
          onDeleteLead={setSelectedForDelete}
          onSave={(lead, patch) => updateLeadInline(lead.id, patch, lead)}
          onRefresh={() => void refreshData()}
        />

        {/* Remount so opening a different column's modal or quick-add draft seeds its state again. */}
        <CreateLeadsModal
          key={
            isCreateOpen
              ? `create-open-${createStageId ?? "any"}-${createDraft ? "draft" : "blank"}`
              : "create-closed"
          }
          isOpen={canCreate && isCreateOpen}
          stages={stages}
          branchId={branchId}
          initialStageId={createStageId ?? undefined}
          initialDraft={createDraft}
          onSubmit={handleCreate}
          error={isCreateOpen ? error : null}
          onClose={() => {
            setIsCreateOpen(false);
            setCreateDraft(null);
          }}
        />

        {/* A different lead opens a clean form; activity changes reload server data. */}
        <ActivityModal
          scope="CRM"
          branchId={branchId}
          request={canMutate && activityLead ? { kind: "create", target: activityLead, agenda: true } : null}
          onClose={() => setActivityLead(null)}
          onChanged={() => void refreshData()}
        />

        <DeleteLeadsConfirmModal
          isOpen={canMutate && selectedForDelete !== null}
          item={selectedForDelete}
          onClose={() => setSelectedForDelete(null)}
          onConfirm={() => void handleDelete()}
          isDeleting={isDeleting}
          error={selectedForDelete ? error : null}
        />
        <DeleteLeadsConfirmModal
          isOpen={canMutate && bulkDelete.isOpen}
          item={null}
          bulkCounts={{ eligible: bulkDelete.eligibleCount, selected: bulkDelete.selectedCount, skipped: bulkDelete.skippedCount }}
          onClose={bulkDelete.close}
          onConfirm={() => void bulkDelete.confirm()}
          isDeleting={isDeleting || bulkDelete.isPending}
          error={bulkDelete.isOpen ? error : null}
        />
      </div>
    </PermissionGate>
  );
}

