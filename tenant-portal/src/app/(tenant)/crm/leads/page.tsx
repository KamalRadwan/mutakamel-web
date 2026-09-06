"use client";

import { useCallback, useMemo, useState } from "react";
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
import { useLeadBoardColumns, useLeadViewLabels } from "./components/lead-view-config";
import { LeadSearchBar } from "./components/LeadSearchBar";
import { leadSearchValueOf, leadSearchWithField } from "./lead-search-contract";
import { useLeadCardSlots } from "./components/useLeadCardSlots";
import { useLeadColumns } from "./components/useLeadColumns";
import { type LeadItem, useLeads } from "./hooks/useLeads";

// A lead in a CONVERTED stage is finished: the backend rejects the move and
// the board must not offer it as a destination either — see
// docs/api/crm-leads.md.
const TERMINAL_STAGE_FLAG = "CONVERTED";

// Only an outcome stage takes a hue, which is the rule the board's columns
// follow too: position and label carry the stage, colour carries the outcome.
const STAGE_BAR_TONE: Record<string, "positive" | "negative" | undefined> = {
  CONVERTED: "positive",
  DISQUALIFIED: "negative",
};

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
    setSearch,
    submitSearch,
    pageInfo,
    setPage,
    setSort,
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
  } = useLeads();

  // The lead whose activities are open, as the two fields the dialog needs
  // rather than the whole row: booking an activity reloads the list, and a
  // `LeadItem` captured here would go on describing the version before it.
  const [activityLead, setActivityLead] = useState<LeadActivityTarget | null>(null);

  const applyPage = useCallback((next: number) => setPage(next), [setPage]);
  // Enter on a board card and a click on a card tile both open the record —
  // docs/design/detail-screens.md#routes. The table uses a real link in its
  // first column instead, so its address stays copyable.
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

  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.id, stage])), [stages]);
  const tableColumns = useLeadColumns({ stageById, canDelete: canDeleteLead, onDelete: setSelectedForDelete });
  const cardSlots = useLeadCardSlots({
    canUpdate: canUpdateLead,
    canDelete: canDeleteLead,
    onOpen: openLead,
    onDelete: setSelectedForDelete,
    onCardChange: (leadId, patch) => void updateLeadCard(leadId, patch),
    onOpenActivities: (lead) => setActivityLead({ id: lead.id, name: lead.leadName }),
    // The single-pointer alternative to dragging a card between columns, which
    // WCAG 2.2 AA requires and the board cannot do without: the arrow left the
    // card face, the capability did not. Gated by the SAME rule that gates
    // dragging below, so the two can never disagree about where a lead may go.
    moveTargets: (lead) =>
      !isMovePending && canUpdateLead(lead) && stageById.get(lead.stageId)?.flag !== TERMINAL_STAGE_FLAG
        ? stages
            .filter(
              (stage) => stage.id !== lead.stageId && stage.flag !== TERMINAL_STAGE_FLAG,
            )
            .map((stage) => ({ id: stage.id, label: localizedName(stage, lang) }))
        : [],
    onMove: (lead, stageId) => void moveLead(lead.id, stageId),
  });

  const boardColumns = useLeadBoardColumns(stages, items);
  const viewLabels = useLeadViewLabels();

  // A missing branch is a precondition, not a failure: the CRM list route
  // is a 422 without branchId, so nothing was asked. Say that instead of
  // rendering "no matching leads" over an unasked question.
  const branchEmptyState = branchId ? undefined : <EmptyState title={t.crmLeads.selectBranchFirst} />;

  // A CRM route is reachable by direct URL even when the sidebar hides it, so
  // the 403 is reachable in-body and gets the mandated surface rather than a
  // load error — AGENTS.md, docs/design/states.md. Permission string and
  // scoping mirror CRM_ENTRY_ROUTES in src/lib/navigation/tenant-routes.ts.
  return (
    <PermissionGate require="crm.leads.read" scoped>
      <div className="flex h-full flex-col gap-4">
        {/* `sr-only`, not deleted. The action bar above already says CRM ›
            Leads, so a second "Leads" in the body was the same sentence twice
            and cost the board a heading's worth of height. What it is NOT is
            surplus: the <h1> is this document's outline, and the bar's location
            is a <p> — docs/design/shell.md, "What does not move". Hidden
            visually, it still names the screen for a screen reader and for
            anything walking the heading tree.

            The header keeps its props: `primaryAction` and `secondaryActions`
            portal into the bar from inside PageHeader, and a portal's DOM lands
            in the bar's subtree, so hiding this block does not hide them. */}
        <PageHeader
          className="sr-only"
          title={t.crmLeads.title}
          primaryAction={canCreate ? { label: t.crmLeads.addLead, onClick: openCreate } : undefined}
          // The branch scopes every read on this screen, so it belongs with
          // the actions rather than beside the search box — which is where the
          // other two dozen branch-scoped screens already put it.
          secondaryActions={
            <TenantBranchSelect
              branchIds={branchIds}
              branchId={branchId}
              onChange={selectBranch}
              disabled={isLoading || isMovePending}
            />
          }
        />

        {/* Not a FilterBar: that pattern's chips carry operators this endpoint
            has none of, and its own 300ms debounce sat on top of the hook's
            250ms. It was called here with `filters={[]}` and no-op handlers — a
            bare search box. This asks the six equality filters instead, one or
            several AND-ed. Its basic row renders in the action bar; its
            advanced card renders here, which is the only place a multi-row
            panel can go. */}
        <LeadSearchBar
          value={search}
          onChange={setSearch}
          onSubmit={submitSearch}
          stages={stages}
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

        {/* The board shows its stages as columns; the other two views have
            nowhere to put them, so the pipeline's shape comes back as a bar
            above them. It is the stage filter as well as the picture: pressing
            a stage here writes the same condition the search bar's Stage field
            writes, and "all" removes it again.

            Basic mode only. In advanced mode the stage is one leaf of a tree
            the user is still composing, and a one-click bar would both edit
            that draft and run it — which is the single thing the card's Search
            button exists to prevent. */}
        {view !== "board" && stages.length > 0 && search.mode === "basic" && (
          <StageBar
            label={t.crmLeads.stage}
            allLabel={t.crmLeads.basicSearch.any}
            steps={stages.map((stage) => ({
              id: stage.id,
              label: localizedName(stage, lang),
              tone: STAGE_BAR_TONE[stage.flag],
            }))}
            value={leadSearchValueOf(search, "stage") || undefined}
            onChange={(stageId: string | undefined) =>
              setSearch(leadSearchWithField(search, "stage", stageId ?? ""))
            }
            disabled={!branchId}
          />
        )}

        <div className="min-h-0 flex-1">
          {view === "board" && (
            <BoardView
              columns={boardColumns}
              columnOf={(item) => item.stageId}
              items={items}
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
                void moveLead(move.itemId, move.toColumnId);
              }}
              onActivate={openLead}
              isLoading={isLoading}
              error={loadError}
              onRetry={() => void fetchLeads()}
              page={pageInfo}
              onPageChange={workspace.setPage}
              emptyState={branchEmptyState}
              // No `moveTo` and no `selection`: the redesigned card carries
              // one overflow menu and nothing else, so neither BoardView's own
              // "Move to…" trigger nor the selection checkbox is rendered on
              // it. The move itself is not lost — it is an item inside that
              // menu, which is what keeps the board's `dragging-alternative`
              // conformance. Bulk selection still lives in the card and table
              // views below.
              labels={{ ...viewLabels, emptyColumn: t.crmLeads.emptyColumn }}
            />
          )}
          {view === "card" && (
            <CardView
              items={items}
              itemKey={(item) => item.id}
              renderCard={cardSlots.renderCard}
              renderActions={cardSlots.renderActions}
              renderFooter={cardSlots.renderFooter}
              cardClassName={cardSlots.cardClassName}
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
              onSortChange={workspace.setSort}
              emptyState={branchEmptyState}
              labels={viewLabels}
            />
          )}
        </div>

        <CreateLeadsModal
          key={isCreateOpen ? "create-open" : "create-closed"}
          isOpen={isCreateOpen}
          stages={stages}
          branchId={branchId}
          onSubmit={handleCreate}
          error={isCreateOpen ? error : null}
          onClose={() => setIsCreateOpen(false)}
        />

        {/* Keyed by lead so a second card opens a clean form, and namespaced
            because the create modal above is a sibling: two "closed" keys in
            one parent is a duplicate-key warning, and React is entitled to
            treat the pair as one child. `fetchLeads` is what re-reads
            `nextActivity` — the server owns that bucket, so guessing the
            mark's new colour here would contradict the next load. */}
        <LeadActivityDialog
          key={`activity-${activityLead?.id ?? "closed"}`}
          lead={activityLead}
          onClose={() => setActivityLead(null)}
          onCreated={() => void fetchLeads()}
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
