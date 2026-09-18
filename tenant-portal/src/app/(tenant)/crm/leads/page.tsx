"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BoardView,
  Button,
  CardView,
  DegradedBanner,
  EmptyState,
  PageHeader,
  PermissionGate,
  TableView,
  PageActions,
  ViewSwitcher,
  useWorkspaceState,
  StageBar,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { CreateLeadsModal } from "./components/CreateLeadsModal";
import { DeleteLeadsConfirmModal } from "./components/DeleteLeadsConfirmModal";
import {
  LeadActivityDialog,
  type LeadActivityTarget,
} from "./components/lead-activity/LeadActivityDialog";
import {
  LEAD_STAGE_BAR_TONE,
  useLeadBoardColumns,
  useLeadViewLabels,
} from "./components/lead-view-config";
import { LeadSearchBar } from "./components/LeadSearchBar";
import { leadSearchValuesOf, leadSearchWithField } from "./lead-search-contract";
import { useLeadCardSlots } from "./components/useLeadCardSlots";
import { useLeadColumns } from "./components/useLeadColumns";
import { type LeadItem, useLeads } from "./hooks/useLeads";
import { useLeadBoard } from "./hooks/useLeadBoard";
import { useLeadDocumentCounts } from "./hooks/useLeadDocumentCounts";

// A lead in a CONVERTED stage is finished: the backend rejects the move and
// the board must not offer it as a destination either — see
// docs/api/crm-leads.md.
const TERMINAL_STAGE_FLAG = "CONVERTED";

export default function LeadsPage() {
  const { t, lang } = useI18n();
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
    fetchLeads,
    dataRevision,
    refreshData,
  } = useLeads();

  // Keep identity only: booking an activity reloads the lead's current data.
  const [activityLead, setActivityLead] = useState<LeadActivityTarget | null>(null);

  // A column's add action seeds the editable stage; the header leaves it unset.
  const [createStageId, setCreateStageId] = useState<string | null>(null);
  const openCreateInStage = useCallback(
    (stageId: string | null) => {
      setCreateStageId(stageId);
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

  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.id, stage])), [stages]);
  const tableColumns = useLeadColumns({
    stageById,
    canUpdate: canUpdateLead,
    canDelete: canDeleteLead,
    onDelete: setSelectedForDelete,
    onRatingChange: (lead, rating) => void updateLeadCard(lead.id, { rating }, lead),
    onOpenActivities: (lead) => setActivityLead({ id: lead.id, name: lead.leadName }),
  });
  const cardSlots = useLeadCardSlots({
    canUpdate: canUpdateLead,
    canDelete: canDeleteLead,
    onOpen: openLead,
    onDelete: setSelectedForDelete,
    onCardChange: (leadId, patch, lead) => void updateLeadCard(leadId, patch, lead),
    onOpenActivities: (lead) => setActivityLead({ id: lead.id, name: lead.leadName }),
    documentCountsByParty: documentCounts.countsByParty,
    documentCountVisibility: documentCounts.visible,
    // The detail page's stage control provides the alternative to board dragging.
  });

  const boardColumns = useLeadBoardColumns(stages, board.items, board.totals);
  const viewLabels = useLeadViewLabels();

  // The API requires a branch; an unrequested list is not an empty search result.
  const branchEmptyState = branchId ? undefined : <EmptyState title={t.crmLeads.selectBranchFirst} />;

  return (
    <PermissionGate require="crm.leads.read" scoped>
      <div className="flex h-full flex-col gap-4">
        {/* Preserve the accessible heading; actions render in the shell's action bar. */}
        <PageHeader
          className="sr-only"
          title={t.crmLeads.title}
          primaryAction={
            canCreate
              ? { label: t.crmLeads.addLead, onClick: () => openCreateInStage(null) }
              : undefined
          }
          secondaryActions={
            <TenantBranchSelect
              branchIds={branchIds}
              branchId={branchId}
              onChange={selectBranch}
              disabled={isLoading || isMovePending}
            />
          }
        />

        {view !== "board" && stages.length > 0 && search.mode === "basic" && (
          <StageBar
            label={t.crmLeads.stage}
            allLabel={t.crmLeads.basicSearch.any}
            steps={stages.map((stage) => ({
              id: stage.id,
              label: localizedName(stage, lang),
              tone: LEAD_STAGE_BAR_TONE[stage.flag],
            }))}
            value={leadSearchValuesOf(search, "stage")}
            onChange={(stageId: string | undefined) =>
              setSearch(leadSearchWithField(search, "stage", stageId ?? ""))
            }
            disabled={!branchId}
          />
        )}

        <LeadSearchBar
          value={search}
          onChange={setSearch}
          onSubmit={submitSearch}
          stages={stages}
          resetKey={branchId ?? "no-branch"}
          disabled={!branchId}
        />

        <PageActions slot="view">
          <ViewSwitcher
            value={view}
            onChange={setView}
            available={["board", "card", "table"]}
            labels={{ board: t.views.board, card: t.views.card, table: t.views.table }}
          />
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

        <div className="min-h-0 flex-1">
          {view === "board" && (
            <BoardView
              columns={boardColumns}
              columnOf={(item) => item.stageId}
              items={board.items}
              itemKey={(item) => item.id}
              renderCard={cardSlots.renderCard}
              renderActions={cardSlots.renderActions}
              renderFooter={cardSlots.renderFooter}
              cardClassName={cardSlots.cardClassName}
              canDrag={(item) =>
                !isMovePending && canUpdateLead(item) && stageById.get(item.stageId)?.flag !== TERMINAL_STAGE_FLAG
              }
              canMoveTo={(_item, columnId) => stageById.get(columnId)?.flag !== TERMINAL_STAGE_FLAG}
              onCardMove={(move) => {
                if (stageById.get(move.toColumnId)?.flag === TERMINAL_STAGE_FLAG) return;
                const lead = board.items.find(({ id }) => id === move.itemId);
                void moveLead(move.itemId, move.toColumnId, lead);
              }}
              onActivate={openLead}
              onAddToColumn={canCreate ? openCreateInStage : undefined}
              isLoading={board.isLoading || (isLoading && stages.length === 0)}
              error={board.error ?? loadError}
              onRetry={() => void board.reload()}
              columnPage={(columnId) => ({
                hasMore: board.lanes[columnId]?.hasMore ?? false,
                isLoadingMore: board.loadingStageIds.has(columnId),
              })}
              onLoadMoreColumn={(columnId) => void board.loadMoreStage(columnId)}
              emptyState={branchEmptyState}
              labels={{
                ...viewLabels,
                emptyColumn: t.crmLeads.emptyColumn,
                collapseColumn: t.views.collapseColumn,
                expandColumn: t.views.expandColumn,
                addToColumn: t.crmLeads.addLead,
                loadMore: t.crmLeads.loadMore,
                loadingMore: t.crmLeads.loadingMore,
              }}
            />
          )}
          {view === "card" && (
            <CardView
              items={items}
              itemKey={(item) => item.id}
              renderCard={cardSlots.renderCard}
              renderActions={cardSlots.renderActions}
              renderFooter={cardSlots.renderCardViewFooter}
              cardClassName={cardSlots.cardClassName}
              density="compact"
              onActivate={openLead}
              isLoading={isLoading}
              error={loadError}
              onRetry={() => void fetchLeads()}
              page={pageInfo}
              onPageChange={workspace.setPage}
              sort={workspace.sort}
              emptyState={branchEmptyState}
              labels={{ ...viewLabels, sortBy: t.views.sortBy }}
            />
          )}
          {view === "table" && (
            <TableView
              columns={tableColumns}
              density="compact"
              items={items}
              itemKey={(item) => item.id}
              selection={workspace.selection}
              isLoading={isLoading}
              error={loadError}
              onRetry={() => void fetchLeads()}
              page={pageInfo}
              onPageChange={workspace.setPage}
              sort={workspace.sort}
              onSortChange={workspace.setSort}
              emptyState={branchEmptyState}
              labels={viewLabels}
            />
          )}
        </div>

        {/* Remount so opening a different column's modal seeds its stage again. */}
        <CreateLeadsModal
          key={isCreateOpen ? `create-open-${createStageId ?? "any"}` : "create-closed"}
          isOpen={isCreateOpen}
          stages={stages}
          branchId={branchId}
          initialStageId={createStageId ?? undefined}
          onSubmit={handleCreate}
          error={isCreateOpen ? error : null}
          onClose={() => setIsCreateOpen(false)}
        />

        {/* A different lead opens a clean form; activity changes reload server data. */}
        <LeadActivityDialog
          key={`activity-${activityLead?.id ?? "closed"}`}
          lead={activityLead}
          onClose={() => setActivityLead(null)}
          onCreated={() => void refreshData()}
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
