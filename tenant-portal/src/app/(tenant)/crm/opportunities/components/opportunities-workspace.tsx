"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import {
  Button,
  CardView,
  DegradedBanner,
  EmptyState,
  ErrorState,
  PageHeader,
  Select,
  Skeleton,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StageBar,
  TableView,
  PageActions,
  ViewSwitcher,
  useWorkspaceState,
  type MoveToTarget,
  type SortState,
  type WorkspaceViewLabels,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { CreateOpportunityModal } from "./CreateOpportunityModal";
import { useCrmCreateCustomFields } from "../../shared/hooks/useCrmCreateCustomFields";
import { useCrmFieldMessages } from "../../shared/hooks/useCrmFieldMessages";
import { DeleteOpportunityDialog } from "./DeleteOpportunityDialog";
import { useOpportunityColumns } from "./useOpportunityColumns";
import { OpportunityBoardColumn } from "./OpportunityBoardColumn";
import { OpportunityCardTile } from "./OpportunityCardTile";
import { OpportunitySearchBar } from "./OpportunitySearchBar";
import { TerminalMoveDialog } from "./TerminalMoveDialog";
import { useDeleteOpportunity } from "../hooks/useDeleteOpportunity";
import { useOpportunityCards } from "../hooks/useOpportunityCards";
import { type OpportunityListItem, useOpportunitiesList } from "../hooks/useOpportunitiesList";
import { useCreateOpportunity } from "../hooks/useCreateOpportunity";
import { usePipelineWorkspace } from "../hooks/usePipelineWorkspace";

// Only an outcome stage takes a hue — the same rule the board's columns
// follow: position and label carry the stage, colour carries the outcome.
const STAGE_BAR_TONE: Record<string, "positive" | "negative" | undefined> = {
  WON: "positive",
  LOST: "negative",
};

export function OpportunitiesWorkspace() {
  const { t, lang } = useI18n();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<OpportunityListItem | null>(null);
  const { deleteOpportunity, isDeleting, error: deleteError, clearError } = useDeleteOpportunity();

  const router = useRouter();
  const {
    board,
    capabilities,
    pipelines,
    branchIds,
    branchId,
    selectBranch,
    selectedPipelineId,
    setSelectedPipelineId,
    isLoading,
    isMutating,
    loadingStageId,
    error,
    loadError,
    capabilitiesUnavailable,
    hasNoPipelines,
    needsBranchSelection,
    fetchPipelines,
    canUpdateOpportunity,
    moveCard,
    terminalMove,
    confirmTerminalMove,
    cancelTerminalMove,
    updateImportance,
    loadMoreStage,
  } = usePipelineWorkspace();

  // applyPage and applySort are hoisted declarations reaching a `list` bound
  // further down: the view decides whether the list is fetched at all, and the
  // view comes from the hook these are passed to. They are only ever called
  // from an effect, long after this render has bound everything.
  function applyPage(next: number) {
    list.setPage(next);
  }
  function applySort(next: SortState) {
    list.setSort(next);
  }

  const workspace = useWorkspaceState("opportunities", {
    defaultView: "board",
    onPageChange: applyPage,
    onSortChange: applySort,
  });
  const { view, setView } = workspace;

  // The stage filter lives above both views, so switching card <-> table keeps
  // it, and it is stamped with the branch and pipeline it was picked in: a
  // stage id from another pipeline is a 404 from the cards route and an empty
  // list from the table. The scope mismatch — not a wrapped handler — is what
  // clears it, because usePipelineWorkspace re-selects the pipeline on its own
  // after a branch change, which no onChange of ours would ever see.
  const stageScope = `${branchId ?? ""}/${selectedPipelineId ?? ""}`;
  const [stageFilter, setStageFilter] = useState<{ scope: string; stageId: string } | null>(null);
  // Retired during render rather than in an effect: React re-runs this
  // component before committing, so returning to a pipeline cannot revive a
  // filter the bar has already stopped showing. The line below is what keeps
  // the stale pair off the wire in the meantime.
  if (stageFilter !== null && stageFilter.scope !== stageScope) setStageFilter(null);
  const stageId = stageFilter?.scope === stageScope ? stageFilter.stageId : null;

  function selectStage(nextStageId: string | undefined) {
    setStageFilter(nextStageId ? { scope: stageScope, stageId: nextStageId } : null);
    // A filter is a new result set. The card cursor and the table's fetch both
    // restart on their own, because the stage is part of their fetch key — but
    // the table's page NUMBER lives in the URL and would otherwise survive as
    // a page 3 that no longer means anything.
    if (workspace.page !== 1) workspace.setPage(1);
  }

  const cards = useOpportunityCards(
    view === "card" ? selectedPipelineId : null,
    view === "card" ? branchId : null,
    stageId,
  );
  const list = useOpportunitiesList(view === "table" ? branchId : null, selectedPipelineId, stageId);

  // A new opportunity opens on its own detail screen: the board is grouped by
  // stage and a freshly created deal is easy to lose in a long entry column.
  const openOpportunity = useCallback(
    (opportunityId: string) => router.push(`/crm/opportunities/${opportunityId}`),
    [router],
  );
  // The trailing argument is the D2 reconciliation: a create whose response
  // could not be read has still created the deal, so the list re-reads instead
  // of leaving a Save to press again.
  // Fetched with the screen rather than with the modal: the create hook needs
  // the required-field keys to build its validator, and the modal's open state
  // comes back OUT of that hook — gating the fetch on it would be a cycle.
  const customFields = useCrmCreateCustomFields("OPPORTUNITY", true);
  const fieldMessages = useCrmFieldMessages();
  const createMessages = useMemo(
    () => ({
      ...fieldMessages,
      amountInvalid: t.crmOpportunityDetail.create.amountInvalid,
      outOfRange: t.crmOpportunityDetail.create.outOfRange,
      currencyLength: t.crmOpportunityDetail.create.currencyLength,
    }),
    [fieldMessages, t],
  );
  const create = useCreateOpportunity(
    branchId,
    pipelines,
    createMessages,
    customFields.requiredFieldKeys,
    openOpportunity,
    () => list.reload(),
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsMounted(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPipeline = pipelines.find(({ id }) => id === selectedPipelineId) ?? null;
  const stageById = useMemo(
    () => new Map((selectedPipeline?.stages ?? []).map((stage) => [stage.id, stage])),
    [selectedPipeline],
  );

  function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    moveCard(draggableId, source.droppableId, destination.droppableId);
  }

  const tableColumns = useOpportunityColumns({
    stageById,
    onDelete: (item) => {
      clearError();
      setSelectedForDelete(item);
    },
  });

  async function handleDelete() {
    if (!selectedForDelete) return;
    if (await deleteOpportunity(selectedForDelete.id)) {
      setSelectedForDelete(null);
      list.reload();
    }
  }

  // Neither a failure nor "no results". A branch was never chosen, or nobody
  // has configured a pipeline for this tenant yet — the second is what the
  // hook used to report as "No accessible opportunity pipeline is
  // configured" in a red banner.
  // `h-full` on every one of these: the board pane keeps the height of its
  // area in each state, so the page does not jump as data arrives and an empty
  // pipeline does not render as a short strip floating under the filters.
  function resolvePipelineEmptyState() {
    if (needsBranchSelection) {
      return <EmptyState className="h-full" title={t.crmOpportunities.selectBranchFirst} />;
    }
    if (hasNoPipelines) {
      return (
        <EmptyState
          className="h-full"
          title={t.crmOpportunities.noPipelineTitle}
          description={t.crmOpportunities.noPipelineDescription}
        />
      );
    }
    return undefined;
  }

  const pipelineEmptyState = resolvePipelineEmptyState();

  // One label set, three views — the shared contract. See
  // docs/design/views.md#the-shared-contract.
  const viewLabels: WorkspaceViewLabels = {
    retry: t.common.retry,
    errorTitle: t.crmOpportunities.loadFailed,
    emptyTitle: t.crmOpportunities.empty,
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

  // The single-pointer alternative to dragging offers exactly the stages a
  // drag could reach: WON and LOST are drop-disabled on this board, so they
  // are not destinations here either.
  const moveTargets: MoveToTarget[] = (selectedPipeline?.stages ?? [])
    .filter((stage) => stage.flag !== "WON" && stage.flag !== "LOST")
    .map((stage) => ({ id: stage.id, label: localizedName(stage, lang) }));

  // The board is hand-composed rather than a BoardView, so it has to render
  // the same four states BoardView owns for the other panes. It previously
  // rendered nothing at all whenever `board` was null, which is every frame
  // before the first fetch resolves.
  function renderBoardPane() {
    if (loadError) {
      return (
        <ErrorState
          className="h-full"
          title={t.crmOpportunities.loadFailed}
          onRetry={() => void fetchPipelines()}
          retryLabel={t.common.retry}
        />
      );
    }
    // isMounted gates @hello-pangea/dnd, which cannot render server-side.
    if (!isMounted || isLoading) {
      return (
        <div className="flex h-full gap-2 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`board-column-skeleton-${index}`} className="h-full w-70 shrink-0 rounded-md" />
          ))}
        </div>
      );
    }
    if (pipelineEmptyState) return pipelineEmptyState;
    if (!board) return <EmptyState className="h-full" title={t.crmOpportunities.empty} />;

    return (
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex h-full gap-2 overflow-x-auto pb-2">
          {board.stages.map((lane) => (
            <OpportunityBoardColumn
              key={lane.stage.id}
              lane={lane}
              canUpdate={canUpdateOpportunity}
              isBusy={isMutating || loadingStageId !== null}
              onImportanceChange={(cardId, importance) => void updateImportance(cardId, importance)}
              onLoadMore={() => void loadMoreStage(lane.stage.id)}
              isLoadingMore={loadingStageId === lane.stage.id}
              moveTargets={moveTargets}
              onMoveCard={moveCard}
            />
          ))}
        </div>
      </DragDropContext>
    );
  }

  // `overflow-hidden` on the screen's own root, not on the CRM segment layout,
  // which is a pass-through: this board scrolls horizontally inside a pane the
  // height of <main>, so nothing here may spill and start the page scrolling
  // instead. `h-full` resolves against <main> — see app/(tenant)/crm/layout.tsx.
  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <PageHeader
        title={t.crmOpportunities.heading}
        description={t.crmOpportunities.subtitle}
        primaryAction={
          capabilities?.create
            ? { label: t.crmOpportunityDetail.createAction, onClick: create.openModal }
            : undefined
        }
        // Branch and pipeline both scope what this screen reads, so they go
        // where every other scoped screen puts its branch: with the actions.
        secondaryActions={
          <>
            <TenantBranchSelect branchIds={branchIds} branchId={branchId} onChange={selectBranch} disabled={isLoading || isMutating} />
            <Select value={selectedPipelineId ?? ""} onValueChange={setSelectedPipelineId} disabled={pipelines.length === 0 || isLoading}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={pipelines.length === 0 ? t.crmOpportunities.noPipeline : t.crmOpportunities.selectPipeline} />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {localizedName(pipeline, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      <PageActions slot="view">
        <ViewSwitcher
          value={view}
          onChange={setView}
          available={["board", "card", "table"]}
          labels={{ board: t.views.board, card: t.views.card, table: t.views.table }}
        />
      </PageActions>

      {capabilitiesUnavailable && <DegradedBanner message={t.crmOpportunities.capabilitiesUnavailable} />}
      {view === "card" && cards.loadMoreError && <DegradedBanner message={t.crmOpportunities.loadMoreFailed} />}

      {/* Write feedback only. Every LOAD failure is handed to the pane below
          so its error state replaces the empty state — see
          docs/design/patterns.md#where-a-result-belongs. */}
      {error && (
        <div role="alert" className="rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300">
          {error}
        </div>
      )}

      {/* Table only, and deliberately. Both of its modes read
          `GET /opportunities` / `POST /opportunities/search`, which return the
          raw entity the table renders. The board and the card view are stage
          PROJECTIONS on their own routes (`/pipelines/:id/board`, `/cards`) —
          they take a stage and a cursor, not a filter tree — so a search bar
          above them would be a control that changes nothing. */}
      {view === "table" && (
        <OpportunitySearchBar
          value={list.search}
          onChange={list.changeSearch}
          onSubmit={list.submitSearch}
          pipelines={pipelines}
          disabled={!branchId}
        />
      )}

      {/* The board shows its stages as columns; the card and table views have
          nowhere to put them, so the pipeline's shape comes back as a bar
          above them — and doubles as the stage filter, which both of their
          endpoints answer.
          Hidden while the table is in advanced mode: the search body carries no
          stage key at all, so the bar would keep highlighting a stage that
          stopped narrowing anything. The card's own `stage` condition is where
          that question lives there. */}
      {view !== "board" &&
        !(view === "table" && list.search.mode === "advanced") &&
        (selectedPipeline?.stages.length ?? 0) > 0 && (
          <StageBar
            label={t.crmOpportunities.stage}
            allLabel={t.crmOpportunities.allStages}
            steps={(selectedPipeline?.stages ?? []).map((stage) => ({
              id: stage.id,
              label: localizedName(stage, lang),
              tone: STAGE_BAR_TONE[stage.flag],
            }))}
            value={stageId ?? undefined}
            onChange={selectStage}
            disabled={!branchId}
          />
        )}

      <div className="min-h-0 flex-1">
        {view === "board" && renderBoardPane()}

        {view === "card" && (
          <div className="flex h-full flex-col gap-3 overflow-y-auto">
            <CardView
              items={cards.items}
              itemKey={(item) => item.id}
              renderCard={(item) => <OpportunityCardTile item={item} />}
              selection={workspace.selection}
              onActivate={(item) => openOpportunity(item.id)}
              isLoading={cards.isLoading}
              error={cards.error}
              onRetry={() => void cards.reload()}
              emptyState={pipelineEmptyState ?? <EmptyState title={t.crmOpportunities.empty} />}
              labels={{ ...viewLabels, sortBy: t.views.sortBy }}
            />
            {cards.hasMore && (
              <Button variant="outline" size="sm" className="self-center" onClick={() => void cards.loadMore()} disabled={cards.isLoadingMore}>
                {cards.isLoadingMore ? t.crmOpportunities.loadingMore : t.crmOpportunities.loadMore(cards.items.length, cards.totalCount)}
              </Button>
            )}
          </div>
        )}

        {view === "table" && (
          <TableView
            columns={tableColumns}
            items={list.items}
            itemKey={(item) => item.id}
            selection={workspace.selection}
            onActivate={(item) => openOpportunity(item.id)}
            isLoading={list.isLoading}
            error={list.error}
            onRetry={() => list.reload()}
            page={list.pageInfo}
            onPageChange={workspace.setPage}
            sort={workspace.sort ?? list.sort}
            onSortChange={workspace.setSort}
            emptyState={pipelineEmptyState}
            labels={viewLabels}
          />
        )}
      </div>

      <TerminalMoveDialog
        key={terminalMove ? `${terminalMove.cardId}:${terminalMove.destStageId}` : "closed"}
        isOpen={terminalMove !== null}
        onClose={cancelTerminalMove}
        opportunity={terminalMove?.opportunity ?? null}
        targetFlag={terminalMove?.targetFlag ?? "WON"}
        onConfirm={confirmTerminalMove}
        isSubmitting={isMutating}
        error={terminalMove ? error : null}
      />

      <CreateOpportunityModal
        create={create}
        pipelines={pipelines}
        branchId={branchId}
        customFields={customFields}
      />

      <DeleteOpportunityDialog
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={() => void handleDelete()}
        isDeleting={isDeleting}
        error={deleteError}
      />
    </div>
  );
}
