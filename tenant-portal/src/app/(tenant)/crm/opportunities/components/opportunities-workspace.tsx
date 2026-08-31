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
  TableView,
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
import { CreateOpportunityDrawer } from "./CreateOpportunityDrawer";
import { DeleteOpportunityDialog } from "./DeleteOpportunityDialog";
import { useOpportunityColumns } from "./useOpportunityColumns";
import { OpportunityBoardColumn } from "./OpportunityBoardColumn";
import { OpportunityCardTile } from "./OpportunityCardTile";
import { TerminalMoveDialog } from "./TerminalMoveDialog";
import { useDeleteOpportunity } from "../hooks/useDeleteOpportunity";
import { useOpportunityCards } from "../hooks/useOpportunityCards";
import { type OpportunityListItem, useOpportunitiesList } from "../hooks/useOpportunitiesList";
import { useCreateOpportunity } from "../hooks/useCreateOpportunity";
import { usePipelineWorkspace } from "../hooks/usePipelineWorkspace";

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

  const cards = useOpportunityCards(view === "card" ? selectedPipelineId : null, view === "card" ? branchId : null);
  const list = useOpportunitiesList(view === "table" ? branchId : null, selectedPipelineId);

  // A new opportunity opens on its own detail screen: the board is grouped by
  // stage and a freshly created deal is easy to lose in a long entry column.
  const openOpportunity = useCallback(
    (opportunityId: string) => router.push(`/crm/opportunities/${opportunityId}`),
    [router],
  );
  const create = useCreateOpportunity(branchId, pipelines, openOpportunity);

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
  function resolvePipelineEmptyState() {
    if (needsBranchSelection) {
      return <EmptyState title={t.crmOpportunities.selectBranchFirst} />;
    }
    if (hasNoPipelines) {
      return (
        <EmptyState
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
          title={t.crmOpportunities.loadFailed}
          onRetry={() => void fetchPipelines()}
          retryLabel={t.common.retry}
        />
      );
    }
    // isMounted gates @hello-pangea/dnd, which cannot render server-side.
    if (!isMounted || isLoading) {
      return (
        <div className="flex gap-2 overflow-x-auto">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`board-column-skeleton-${index}`} className="h-64 w-70 shrink-0 rounded-md" />
          ))}
        </div>
      );
    }
    if (pipelineEmptyState) return pipelineEmptyState;
    if (!board) return <EmptyState title={t.crmOpportunities.empty} />;

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

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title={t.crmOpportunities.heading}
        description={t.crmOpportunities.subtitle}
        primaryAction={
          capabilities?.create
            ? { label: t.crmOpportunityDetail.createAction, onClick: create.openDrawer }
            : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
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
        </div>
        <ViewSwitcher
          value={view}
          onChange={setView}
          available={["board", "card", "table"]}
          labels={{ board: t.views.board, card: t.views.card, table: t.views.table }}
        />
      </div>

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

      <CreateOpportunityDrawer create={create} pipelines={pipelines} branchId={branchId} />

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
