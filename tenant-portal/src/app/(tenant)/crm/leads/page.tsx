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
import { CreateLeadsModal } from "./components/CreateLeadsModal";
import { DeleteLeadsConfirmModal } from "./components/DeleteLeadsConfirmModal";
import { LeadBulkActionsBar } from "./components/LeadBulkActionsBar";
import { LeadExecutiveBoardView } from "./components/LeadExecutiveBoardView";
import { LeadExecutiveCardView } from "./components/LeadExecutiveCardView";
import { LeadExecutiveTableView } from "./components/LeadExecutiveTableView";
import { LeadKpiStrip, type LeadQuickFilterPreset } from "./components/LeadKpiStrip";
import { LeadQuickEditModal } from "./components/LeadQuickEditModal";
import { LeadStageFunnelBar } from "./components/LeadStageFunnelBar";
import { LeadSearchBar } from "./components/LeadSearchBar";
import { leadActivityState } from "./lead-card-contract";
import { leadPrimaryPhonePatch } from "./lead-phone-patch";
import {
  type CreateLeadRequest,
  type QuickCreateLeadDraft,
  emptyCreateLeadForm,
  emptyLeadContact,
} from "./lead-create-contract";
import { leadSearchValuesOf, leadSearchWithField } from "./lead-search-contract";
import {
  DEFAULT_LEADS_SORT,
  type LeadItem,
  useLeads,
} from "./hooks/useLeads";
import { useLeadBoard } from "./hooks/useLeadBoard";
import { useLeadDocumentCounts } from "./hooks/useLeadDocumentCounts";
import { useLeadKpis } from "./hooks/useLeadKpis";

// A lead in a CONVERTED stage is finished: the backend rejects the move and
// the board must not offer it as a destination either — see
// docs/api/crm-leads.md.
const TERMINAL_STAGE_FLAG = "CONVERTED";

export default function LeadsPage() {
  const { t } = useI18n();
  const router = useRouter();
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

  // Keep identity only: booking an activity reloads the lead's current data.
  const [activityLead, setActivityLead] = useState<ActivityTargetSelection | null>(null);
  const openActivities = useCallback(
    (lead: LeadItem) => setActivityLead({ app: "CRM", type: "LEAD", id: lead.id, label: lead.leadName }),
    [],
  );

  // Centered 360° Quick-Edit & Inspector Modal state (Screen 04 - zero <aside>)
  const [quickEditLead, setQuickEditLead] = useState<LeadItem | null>(null);
  const [kpiPreset, setKpiPreset] = useState<LeadQuickFilterPreset>("ALL");

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

  const board = useLeadBoard({
    enabled: view === "board",
    branchId,
    stages,
    search: appliedSearch,
    sort,
    revision: dataRevision,
  });
  const documentCounts = useLeadDocumentCounts(items, branchId, view === "card");
  const kpis = useLeadKpis({ branchId, search: appliedSearch, revision: dataRevision, enabled: Boolean(branchId) });

  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.id, stage])), [stages]);

  const filterByKpiPreset = useCallback(
    (list: readonly LeadItem[]): LeadItem[] => {
      if (kpiPreset === "ALL") return [...list];
      return list.filter((lead) => {
        const st = stageById.get(lead.stageId);
        if (kpiPreset === "NEW_STAGE") return st?.flag === "NEW";
        if (kpiPreset === "HOT_3_STAR") return lead.rating >= 3;
        if (kpiPreset === "OVERDUE_ACTIVITY") {
          return leadActivityState(lead.nextActivity) === "OVERDUE";
        }
        if (kpiPreset === "QUALIFIED") return st?.flag === "QUALIFIED";
        return true;
      });
    },
    [kpiPreset, stageById],
  );

  const visibleItems = useMemo(() => filterByKpiPreset(items), [filterByKpiPreset, items]);
  const visibleBoardItems = useMemo(
    () => filterByKpiPreset(board.items),
    [board.items, filterByKpiPreset],
  );
  const kpiSourceLeads = view === "board" ? board.items : items;

  const nonTerminalStages = useMemo(
    () => stages.filter((st) => st.flag !== TERMINAL_STAGE_FLAG),
    [stages],
  );

  const handleInColumnQuickCreate = useCallback(
    async (payload: CreateLeadRequest, rating?: number) => {
      const form = emptyCreateLeadForm("quick-col-contact-1");
      form.branchId = payload.branchId;
      form.stageId = payload.stageId ?? "";
      form.leadProfileType = payload.leadProfileType;
      form.acquisitionSourceId = payload.acquisitionSourceId ?? "";
      if (payload.leadProfileType === "CORPORATE") {
        form.existingCompanyPartyId = payload.existingCompanyPartyId ?? "";
        form.companyName = payload.companyName ?? "";
        form.companyPhones = payload.companyPhones?.length ? [...payload.companyPhones] : [""];
        const firstContact = payload.contacts?.[0];
        const c = emptyLeadContact("quick-col-contact-1");
        c.contactPartyId = firstContact?.contactPartyId ?? "";
        c.fullName = firstContact?.fullName ?? "";
        c.firstName = firstContact?.firstName ?? (payload.companyName ?? "");
        c.lastName = firstContact?.lastName ?? "";
        c.phones = firstContact?.phones?.length ? [...firstContact.phones] : [""];
        form.contacts = [c];
      } else {
        form.firstName = payload.firstName ?? "";
        form.lastName = payload.lastName ?? "";
        form.phones = payload.phones?.length ? [...payload.phones] : [""];
      }
      return handleCreate(form, rating);
    },
    [handleCreate],
  );

  const selectedStageFilter =
    search.mode === "basic" ? leadSearchValuesOf(search, "stage")[0] : undefined;

  const boardErrorMessage = board.error?.message ?? loadError?.message ?? null;
  const listErrorMessage = loadError?.message ?? null;

  return (
    <PermissionGate require="crm.leads.read" scoped>
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
                  leads={kpiSourceLeads}
                  stages={stages}
                  activePreset={kpiPreset}
                  onSelectPreset={setKpiPreset}
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
        {view !== "board" && workspace.selection.selectedIds.size > 0 && (
          <LeadBulkActionsBar
            selectedIds={workspace.selection.selectedIds}
            stages={nonTerminalStages}
            canUpdateAny={visibleItems.some((item) =>
              workspace.selection.selectedIds.has(item.id) && canUpdateLead(item),
            )}
            canDeleteAny={visibleItems.some((item) =>
              workspace.selection.selectedIds.has(item.id) && canDeleteLead(item),
            )}
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
            onBulkDelete={async () => {
              const ids = Array.from(workspace.selection.selectedIds);
              await bulkDeleteLeads(ids);
              workspace.selection.onSelectionChange(new Set());
            }}
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
          <ActivitiesWorkspaceLink type="LEAD" />
        </PageActions>

        {degraded.stages && <DegradedBanner message={t.crmLeads.stagesUnavailable} />}
        {degraded.capabilities && <DegradedBanner message={t.crmLeads.capabilitiesUnavailable} />}

        {/* Load errors belong to the view; this alert carries write feedback. */}
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300"
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
                  onBulkMoveStage={async (stageId) => {
                    const ids = Array.from(workspace.selection.selectedIds);
                    await bulkMoveStage(ids, stageId);
                    workspace.selection.onSelectionChange(new Set());
                  }}
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
          onMoveStage={async (lead, stageId) => {
            await moveLead(lead.id, stageId, lead);
            setQuickEditLead((prev) => (prev && prev.id === lead.id ? { ...prev, stageId } : prev));
          }}
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
          isOpen={isCreateOpen}
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
          request={activityLead ? { kind: "create", target: activityLead, agenda: true } : null}
          onClose={() => setActivityLead(null)}
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

