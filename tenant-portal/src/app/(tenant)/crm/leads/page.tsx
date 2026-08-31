"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  BoardView,
  Button,
  type BoardColumnDef,
  CardView,
  DegradedBanner,
  EmptyState,
  FilterBar,
  PageHeader,
  PermissionGate,
  resolveStatusRole,
  TableView,
  ViewSwitcher,
  useWorkspaceState,
  type WorkspaceViewLabels,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { CreateLeadsModal } from "./components/CreateLeadsModal";
import { DeleteLeadsConfirmModal } from "./components/DeleteLeadsConfirmModal";
import { LeadCard } from "./components/LeadCard";
import { useLeadColumns } from "./components/useLeadColumns";
import { type LeadItem, useLeads } from "./hooks/useLeads";

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
    searchQuery,
    setSearchQuery,
    pageInfo,
    setPage,
    isCreateOpen,
    setIsCreateOpen,
    openCreate,
    selectedForDelete,
    setSelectedForDelete,
    handleCreate,
    handleDelete,
    moveLead,
    fetchLeads,
  } = useLeads();

  const applyPage = useCallback((next: number) => setPage(next), [setPage]);
  // Enter on a board card and a click on a card tile both open the record —
  // docs/design/detail-screens.md#routes. The table uses a real link in its
  // first column instead, so its address stays copyable.
  const openLead = useCallback(
    (lead: LeadItem) => router.push(`/crm/leads/${lead.id}`),
    [router],
  );
  const workspace = useWorkspaceState("leads", { defaultView: "board", onPageChange: applyPage });
  const { view, setView } = workspace;

  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.id, stage])), [stages]);
  const tableColumns = useLeadColumns({ stageById, canDelete: canDeleteLead, onDelete: setSelectedForDelete });

  const boardColumns: BoardColumnDef[] = stages.map((stage) => {
    const role = resolveStatusRole("LeadStageFlag", stage.flag);
    return {
      id: stage.id,
      label: localizedName(stage, lang),
      count: items.filter((item) => item.stageId === stage.id).length,
      outcomeRole: role === "positive" || role === "negative" || role === "caution" ? role : undefined,
    };
  });

  // A missing branch is a precondition, not a failure: the CRM list route
  // is a 422 without branchId, so nothing was asked. Say that instead of
  // rendering "no matching leads" over an unasked question.
  const branchEmptyState = branchId ? undefined : <EmptyState title={t.crmLeads.selectBranchFirst} />;

  // One label set, three views — the shared contract, so switching view can no
  // longer drop pagination or selection. See
  // docs/design/views.md#the-shared-contract.
  const viewLabels: WorkspaceViewLabels = {
    retry: t.common.retry,
    errorTitle: t.crmLeads.loadFailed,
    emptyTitle: t.crmLeads.empty,
    selectAll: t.views.selectAll,
    selectRow: t.views.selectItem,
    sortAscending: t.views.sortAscending,
    sortDescending: t.views.sortDescending,
    notSorted: t.views.notSorted,
    pagination: {
      previous: t.common.previousPage,
      next: t.common.nextPage,
      summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
    },
  };

  function renderDeleteAction(lead: LeadItem) {
    if (!canDeleteLead(lead)) return null;
    return (
      <Button
        variant="ghost"
        size="xs"
        onClick={() => setSelectedForDelete(lead)}
        aria-label={`${t.common.delete}: ${lead.leadName}`}
      >
        <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
      </Button>
    );
  }

  // A CRM route is reachable by direct URL even when the sidebar hides it, so
  // the 403 is reachable in-body and gets the mandated surface rather than a
  // load error — AGENTS.md, docs/design/states.md. Permission string and
  // scoping mirror CRM_ENTRY_ROUTES in src/lib/navigation/tenant-routes.ts.
  return (
    <PermissionGate require="crm.leads.read" scoped>
      <div className="flex h-full flex-col gap-4">
        <PageHeader
          title={t.crmLeads.title}
          description={t.crmLeads.subtitle}
          primaryAction={canCreate ? { label: t.crmLeads.addLead, onClick: openCreate } : undefined}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <FilterBar
            filters={[]}
            values={{}}
            onChange={() => undefined}
            onReset={() => undefined}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={t.crmLeads.search}
          />
          <div className="flex items-center gap-2">
            <TenantBranchSelect
              branchIds={branchIds}
              branchId={branchId}
              onChange={selectBranch}
              disabled={isLoading || isMovePending}
            />
            <ViewSwitcher
              value={view}
              onChange={setView}
              available={["board", "card", "table"]}
              labels={{ board: t.views.board, card: t.views.card, table: t.views.table }}
            />
          </div>
        </div>

        {degraded.stages && <DegradedBanner message={t.crmLeads.stagesUnavailable} />}
        {degraded.capabilities && <DegradedBanner message={t.crmLeads.capabilitiesUnavailable} />}

        {/* Write feedback only. A failed LOAD is handed to the view below, so
            the error state replaces the empty state instead of stacking with
            it — see docs/design/patterns.md#where-a-result-belongs. */}
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
              items={items}
              itemKey={(item) => item.id}
              renderCard={(item) => <LeadCard lead={item} stage={stageById.get(item.stageId)} />}
              renderActions={renderDeleteAction}
              canDrag={(item) =>
                !isMovePending && canUpdateLead(item) && stageById.get(item.stageId)?.flag !== TERMINAL_STAGE_FLAG
              }
              canMoveTo={(_item, columnId) => stageById.get(columnId)?.flag !== TERMINAL_STAGE_FLAG}
              onCardMove={(move) => {
                if (stageById.get(move.toColumnId)?.flag === TERMINAL_STAGE_FLAG) return;
                void moveLead(move.itemId, move.toColumnId);
              }}
              selection={workspace.selection}
              onActivate={openLead}
              isLoading={isLoading}
              error={loadError}
              onRetry={() => void fetchLeads()}
              page={pageInfo}
              onPageChange={workspace.setPage}
              emptyState={branchEmptyState}
              labels={{ ...viewLabels, emptyColumn: t.crmLeads.emptyColumn, moveTo: t.views.moveTo }}
            />
          )}
          {view === "card" && (
            <CardView
              items={items}
              itemKey={(item) => item.id}
              renderCard={(item) => <LeadCard lead={item} stage={stageById.get(item.stageId)} />}
              renderActions={renderDeleteAction}
              selection={workspace.selection}
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
              items={items}
              itemKey={(item) => item.id}
              selection={workspace.selection}
              isLoading={isLoading}
              error={loadError}
              onRetry={() => void fetchLeads()}
              page={pageInfo}
              onPageChange={workspace.setPage}
              sort={workspace.sort}
              emptyState={branchEmptyState}
              labels={viewLabels}
            />
          )}
        </div>

        <CreateLeadsModal
          key={isCreateOpen ? "open" : "closed"}
          isOpen={isCreateOpen}
          stages={stages}
          branchId={branchId}
          onSubmit={handleCreate}
          error={isCreateOpen ? error : null}
          onClose={() => setIsCreateOpen(false)}
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
