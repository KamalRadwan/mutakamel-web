"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { ExternalLink } from "lucide-react";
import {
  Badge,
  Button,
  CardView,
  type ColumnDef,
  DataTable,
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
  StatusBadge,
  ViewSwitcher,
  useWorkspaceView,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { formatDate } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { DeleteOpportunityDialog } from "./DeleteOpportunityDialog";
import { OpportunityBoardColumn } from "./OpportunityBoardColumn";
import { OpportunityCardTile } from "./OpportunityCardTile";
import { TerminalMoveDialog } from "./TerminalMoveDialog";
import { useDeleteOpportunity } from "../hooks/useDeleteOpportunity";
import { useOpportunityCards } from "../hooks/useOpportunityCards";
import { type OpportunityListItem, useOpportunitiesList } from "../hooks/useOpportunitiesList";
import { usePipelineWorkspace } from "../hooks/usePipelineWorkspace";

export function OpportunitiesWorkspace() {
  const { t, lang } = useI18n();
  const [view, setView] = useWorkspaceView("opportunities", "board");
  const [isMounted, setIsMounted] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<OpportunityListItem | null>(null);
  const { deleteOpportunity, isDeleting, error: deleteError, clearError } = useDeleteOpportunity();

  const {
    board,
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

  const cards = useOpportunityCards(view === "card" ? selectedPipelineId : null, view === "card" ? branchId : null);
  const list = useOpportunitiesList(view === "table" ? branchId : null, selectedPipelineId);

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

  async function handleDelete() {
    if (!selectedForDelete) return;
    if (await deleteOpportunity(selectedForDelete.id)) {
      setSelectedForDelete(null);
      list.reload();
    }
  }

  const tableColumns: ColumnDef<OpportunityListItem>[] = [
    { id: "title", header: t.crmOpportunities.title, cell: (item) => <span className="font-medium text-foreground">{item.title}</span> },
    {
      id: "customer",
      header: t.crmOpportunities.customer,
      cell: (item) => (
        <Link
          href={`/crm/customer-profiles/${encodeURIComponent(item.customerProfileId)}`}
          aria-label={t.crmOpportunities.viewCustomer}
          className="inline-flex items-center gap-1 text-brand-700 hover:underline dark:text-brand-300"
        >
          <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="max-w-32 truncate font-mono text-2xs">{item.customerProfileId}</span>
        </Link>
      ),
    },
    {
      id: "stage",
      header: t.crmOpportunities.stage,
      cell: (item) => {
        const stage = stageById.get(item.stageId);
        return <Badge tone="neutral">{stage ? (lang === "ar" ? stage.nameAr : stage.nameEn) : item.stageId}</Badge>;
      },
    },
    { id: "status", header: t.common.status, cell: (item) => <StatusBadge value={item.status} kind="OpportunityStatus" /> },
    {
      id: "owner",
      header: t.crmOpportunities.owner,
      cell: (item) =>
        item.ownerUserId ? (
          <span className="font-mono text-2xs">{item.ownerUserId}</span>
        ) : (
          <span className="text-muted-foreground">{t.crmOpportunities.notProvided}</span>
        ),
    },
    {
      id: "expectedClose",
      header: t.crmOpportunities.expectedClose,
      sortable: true,
      cell: (item) => (item.expectedCloseDate ? formatDate(item.expectedCloseDate, lang) : t.crmOpportunities.notProvided),
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (item) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearError();
            setSelectedForDelete(item);
          }}
          aria-label={`${t.common.delete}: ${item.title}`}
        >
          {t.common.delete}
        </Button>
      ),
    },
  ];

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
            />
          ))}
        </div>
      </DragDropContext>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader title={t.crmOpportunities.heading} description={t.crmOpportunities.subtitle} />

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
                  {lang === "ar" ? pipeline.nameAr : pipeline.nameEn}
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
              renderCard={(item) => <OpportunityCardTile item={item} />}
              itemKey={(item) => item.id}
              isLoading={cards.isLoading}
              error={cards.error}
              onRetry={() => void cards.reload()}
              errorTitle={t.crmOpportunities.loadFailed}
              retryLabel={t.common.retry}
              emptyState={pipelineEmptyState ?? <EmptyState title={t.crmOpportunities.empty} />}
            />
            {cards.hasMore && (
              <Button variant="outline" size="sm" className="self-center" onClick={() => void cards.loadMore()} disabled={cards.isLoadingMore}>
                {cards.isLoadingMore ? t.crmOpportunities.loadingMore : t.crmOpportunities.loadMore(cards.items.length, cards.totalCount)}
              </Button>
            )}
          </div>
        )}

        {view === "table" && (
          <DataTable
            columns={tableColumns}
            rows={list.items}
            isLoading={list.isLoading}
            error={list.error}
            onRetry={() => list.reload()}
            page={list.pageInfo}
            onPageChange={list.setPage}
            sort={list.sort}
            onSortChange={list.setSort}
            rowKey={(item) => item.id}
            emptyState={pipelineEmptyState}
            labels={{
              retry: t.common.retry,
              errorTitle: t.crmOpportunities.loadFailed,
              emptyTitle: t.crmOpportunities.empty,
              selectAll: t.common.actions,
              selectRow: t.common.actions,
              sortAscending: t.common.actions,
              sortDescending: t.common.actions,
              notSorted: t.common.actions,
              pagination: {
                previous: t.common.previousPage,
                next: t.common.nextPage,
                summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
              },
            }}
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
