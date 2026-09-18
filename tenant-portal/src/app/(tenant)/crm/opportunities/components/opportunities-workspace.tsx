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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StageBar,
  TableView,
  PageActions,
  ViewSwitcher,
  useWorkspaceState,
  resolveStatusRole,
  type BoardColumnDef,
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
import { DeleteOpportunityDialog, type OpportunityDeleteItem } from "./DeleteOpportunityDialog";
import { useOpportunityColumns } from "./useOpportunityColumns";
import { OpportunitySearchBar } from "./OpportunitySearchBar";
import { TerminalMoveDialog } from "./TerminalMoveDialog";
import { useDeleteOpportunity } from "../hooks/useDeleteOpportunity";
import { useOpportunitiesList } from "../hooks/useOpportunitiesList";
import { useOpportunityCards } from "../hooks/useOpportunityCards";
import { useOpportunityDocumentCounts } from "../hooks/useOpportunityDocumentCounts";
import { useCreateOpportunity } from "../hooks/useCreateOpportunity";
import { opportunityActivitySegments } from "../../shared/crm-activity-tone";
import { CrmActivityDialog } from "../../shared/components/CrmActivityDialog";
import { useOpportunityCardSlots } from "./useOpportunityCardSlots";
import { useOpportunityCardViewSlots } from "./useOpportunityCardViewSlots";
import {
  addOpportunityBasicFilter,
  EMPTY_OPPORTUNITY_BASIC_SEARCH,
  type OpportunityBasicSearch,
} from "../opportunity-basic-search-contract";
import {
  opportunitySearchWithBasic,
  opportunitySearchWithMode,
} from "../opportunity-search-contract";
import {
  opportunityCapabilityAllowsOwner,
  usePipelineWorkspace,
} from "../hooks/usePipelineWorkspace";
import { formatOpportunityAmountSummary } from "../hooks/pipeline-types";

const STAGE_BAR_TONE: Record<string, "positive" | "negative" | undefined> = {
  WON: "positive",
  LOST: "negative",
};

export function OpportunitiesWorkspace() {
  const { t, lang } = useI18n();
  const [selectedForDelete, setSelectedForDelete] = useState<OpportunityDeleteItem | null>(null);
  const { deleteOpportunity, isDeleting, error: deleteError, clearError } = useDeleteOpportunity();

  const router = useRouter();
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

  const {
    actorUserId,
    board,
    capabilities,
    pipelines,
    branchIds,
    branchId,
    selectBranch: selectPipelineBranch,
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
    setBasicSearch: setBoardBasicSearch,
    canUpdateOpportunity,
    moveCard,
    terminalMove,
    confirmTerminalMove,
    cancelTerminalMove,
    updateImportance,
    loadMoreStage,
  } = usePipelineWorkspace(view === "board");

  const list = useOpportunitiesList(
    view === "table" ? branchId : null,
    selectedPipelineId,
    null,
    actorUserId,
  );
  const activeBasicSearch =
    list.search.mode === "basic"
      ? list.search.basic
      : EMPTY_OPPORTUNITY_BASIC_SEARCH;
  const requestedStageId = activeBasicSearch.filters.find(
    ({ field }) => field === "stage",
  )?.value ?? null;
  const requestedPipelineId = activeBasicSearch.filters.find(
    ({ field }) => field === "pipeline",
  )?.value ?? null;
  const stagePipeline = pipelines.find((pipeline) =>
    pipeline.stages.some((stage) => stage.id === requestedStageId),
  );
  const searchPipelineId = stagePipeline?.id ?? requestedPipelineId;
  const stageId = selectedPipelineId === stagePipeline?.id ? requestedStageId : null;

  useEffect(() => {
    if (
      list.search.mode === "basic" &&
      searchPipelineId &&
      searchPipelineId !== selectedPipelineId &&
      pipelines.some(({ id }) => id === searchPipelineId)
    ) {
      setSelectedPipelineId(searchPipelineId);
    }
  }, [list.search.mode, pipelines, searchPipelineId, selectedPipelineId, setSelectedPipelineId]);

  function selectStage(nextStageId: string | undefined) {
    if (list.search.mode !== "basic") return;
    let basic: OpportunityBasicSearch = {
      ...list.search.basic,
      filters: list.search.basic.filters.filter(({ field }) => field !== "stage"),
    };
    if (nextStageId) {
      basic = addOpportunityBasicFilter(basic, {
        field: "stage",
        value: nextStageId,
      });
      if (selectedPipelineId) {
        basic = addOpportunityBasicFilter(basic, {
          field: "pipeline",
          value: selectedPipelineId,
        });
      }
    }
    list.changeSearch(opportunitySearchWithBasic(list.search, basic));
    if (workspace.page !== 1) workspace.setPage(1);
  }

  function selectPipeline(nextPipelineId: string) {
    setSelectedPipelineId(nextPipelineId);
    if (list.search.mode !== "basic") return;
    const validStageIds = new Set(
      pipelines.find(({ id }) => id === nextPipelineId)?.stages.map(({ id }) => id) ?? [],
    );
    const withoutInvalidStage = {
      ...list.search.basic,
      filters: list.search.basic.filters.filter(
        (filter) => filter.field !== "stage" || validStageIds.has(filter.value),
      ),
    };
    const basic = addOpportunityBasicFilter(withoutInvalidStage, {
      field: "pipeline",
      value: nextPipelineId,
    });
    list.changeSearch(opportunitySearchWithBasic(list.search, basic));
  }

  function selectBranch(nextBranchId: string) {
    selectPipelineBranch(nextBranchId);
    if (list.search.mode !== "basic") return;
    const basic: OpportunityBasicSearch = {
      ...list.search.basic,
      filters: list.search.basic.filters.filter(
        ({ field }) => field !== "pipeline" && field !== "stage",
      ),
    };
    list.changeSearch(opportunitySearchWithBasic(list.search, basic));
  }
  const cards = useOpportunityCards(
    view === "card" ? selectedPipelineId : null,
    view === "card" ? branchId : null,
    stageId,
    activeBasicSearch,
    actorUserId,
  );
  const documentCounts = useOpportunityDocumentCounts(
    cards.items,
    branchId,
    view === "card",
  );

  useEffect(() => {
    if (list.search.mode === "basic") setBoardBasicSearch(list.search.basic);
  }, [list.search, setBoardBasicSearch]);

  function changeView(nextView: typeof view) {
    if (nextView !== "table" && list.search.mode === "advanced") {
      list.changeSearch(opportunitySearchWithMode(list.search, "basic"));
    }
    setView(nextView);
  }

  const openOpportunity = useCallback(
    (opportunityId: string) => router.push(`/crm/opportunities/${opportunityId}`),
    [router],
  );

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

  const selectedPipeline = pipelines.find(({ id }) => id === selectedPipelineId) ?? null;
  const stageById = useMemo(
    () => new Map((selectedPipeline?.stages ?? []).map((stage) => [stage.id, stage])),
    [selectedPipeline],
  );

  const [importances, setImportances] = useState<Record<string, number>>({});

  const tableColumns = useOpportunityColumns({
    stageById,
    canUpdate: (item) =>
      opportunityCapabilityAllowsOwner(capabilities?.update ?? null, item.ownerUserId),
    canDelete: () => Boolean(capabilities?.delete),
    onDelete: (item) => {
      clearError();
      setSelectedForDelete(item);
    },
    onImportanceChange: (item, nextImportance) => {
      setImportances((prev) => ({ ...prev, [item.id]: nextImportance }));
      void updateImportance(item.id, nextImportance, item).then(async (updated) => {
        if (updated) await list.reload();
        setImportances((current) => {
          const next = { ...current };
          delete next[item.id];
          return next;
        });
      });
    },
    onOpenActivities: (item) => {
      setActivityOpportunity({ id: item.id, name: item.title });
    },
    importances,
  });

  async function handleDelete() {
    if (!selectedForDelete) return;
    if (await deleteOpportunity(selectedForDelete.id)) {
      setSelectedForDelete(null);
      list.reload();
      void cards.reload();
      void fetchPipelines();
    }
  }

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

  const moveTargets: MoveToTarget[] = (selectedPipeline?.stages ?? []).map((stage) => ({
    id: stage.id,
    label: localizedName(stage, lang),
  }));

  const [activityOpportunity, setActivityOpportunity] = useState<{ id: string; name: string } | null>(null);
  const cardSlots = useOpportunityCardSlots({
    canUpdate: canUpdateOpportunity,
    canDelete: () => Boolean(capabilities?.delete),
    onOpen: (item) => openOpportunity(item.id),
    onDelete: (item) => {
      clearError();
      setSelectedForDelete({ id: item.id, title: item.title });
    },
    onImportanceChange: (opportunityId, importance) => {
      void updateImportance(opportunityId, importance);
    },
    onOpenActivities: (item) => setActivityOpportunity({ id: item.id, name: item.title }),
    moveTargets: (item) => moveTargets.filter((target) => target.id !== item.stageId),
    onMove: (item, targetStageId) => {
      moveCard(item.id, item.stageId, targetStageId);
    },
  });

  const cardViewSlots = useOpportunityCardViewSlots({
    stageById,
    canUpdate: (item) =>
      opportunityCapabilityAllowsOwner(capabilities?.update ?? null, item.ownerUserId),
    canDelete: (item) =>
      opportunityCapabilityAllowsOwner(capabilities?.delete ?? null, item.ownerUserId),
    onOpen: (item) => openOpportunity(item.id),
    onDelete: (item) => {
      clearError();
      setSelectedForDelete({ id: item.id, title: item.title });
    },
    onImportanceChange: (item, importance) => {
      void updateImportance(item.id, importance, item).then((updated) => {
        if (updated) void cards.reload();
      });
    },
    onOpenActivities: (item) =>
      setActivityOpportunity({ id: item.id, name: item.title }),
    documentCountsByParty: documentCounts.countsByParty,
    documentCountVisibility: documentCounts.visible,
  });

  const boardColumns: BoardColumnDef[] = useMemo(() => {
    if (!selectedPipeline) return [];
    return selectedPipeline.stages.map((stage) => {
      const lane = board?.stages.find((s) => s.stage.id === stage.id);
      const role = resolveStatusRole("OpportunityStageFlag", stage.flag);
      return {
        id: stage.id,
        label: localizedName(stage, lang),
        count: lane?.summary.totalCount ?? lane?.items.length ?? 0,
        amountLabel: lane
          ? formatOpportunityAmountSummary(lane.summary.amountsByCurrency)
          : undefined,
        outcomeRole:
          role === "positive" || role === "negative" || role === "caution" ? role : undefined,
        segments: lane
          ? opportunityActivitySegments(lane.activitySummary, t.crmLeads.card.activityStates)
          : undefined,
        segmentsLabel: t.crmLeads.card.activityBar,
      };
    });
  }, [selectedPipeline, board, lang, t]);

  const boardItems = useMemo(
    () => (board?.stages ?? []).flatMap((lane) => lane.items),
    [board],
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Preserve the accessible heading; actions render in the shell's action bar. */}
      <PageHeader
        className="sr-only"
        title={t.crmOpportunities.heading}
        primaryAction={
          capabilities?.create
            ? { label: t.crmOpportunityDetail.createAction, onClick: () => create.openModal() }
            : undefined
        }
        secondaryActions={
          <>
            <TenantBranchSelect branchIds={branchIds} branchId={branchId} onChange={selectBranch} disabled={isLoading || isMutating} />
            <Select value={selectedPipelineId ?? ""} onValueChange={selectPipeline} disabled={pipelines.length === 0 || isLoading}>
              <SelectTrigger size="sm" className="w-48">
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

      <OpportunitySearchBar
        value={list.search}
        onChange={list.changeSearch}
        onSubmit={list.submitSearch}
        pipelines={pipelines}
        resetKey={`${branchId ?? "no-branch"}:${selectedPipelineId ?? "no-pipeline"}`}
        advancedEnabled={view === "table"}
        disabled={!branchId}
      />

      <PageActions slot="view">
        <ViewSwitcher
          value={view}
          onChange={changeView}
          available={["board", "card", "table"]}
          labels={{ board: t.views.board, card: t.views.card, table: t.views.table }}
        />
      </PageActions>

      {capabilitiesUnavailable && <DegradedBanner message={t.crmOpportunities.capabilitiesUnavailable} />}
      {view === "card" && cards.loadMoreError && (
        <DegradedBanner message={t.crmOpportunities.loadMoreFailed} />
      )}

      {error && (
        <div role="alert" className="rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300">
          {error}
        </div>
      )}

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
        {view === "board" && (
          <BoardView
            columns={boardColumns}
            columnOf={(item) => item.stageId}
            items={boardItems}
            itemKey={(item) => item.id}
            renderCard={cardSlots.renderCard}
            renderActions={cardSlots.renderActions}
            renderFooter={cardSlots.renderFooter}
            canDrag={(item) =>
              !isMutating && canUpdateOpportunity(item) && item.stageFlag !== "WON" && item.stageFlag !== "LOST"
            }
            onCardMove={(move) => {
              moveCard(move.itemId, move.fromColumnId, move.toColumnId);
            }}
            onActivate={(item) => openOpportunity(item.id)}
            onAddToColumn={capabilities?.create ? (stageId) => create.openModal(stageId) : undefined}
            isLoading={isLoading}
            error={loadError}
            onRetry={() => void fetchPipelines()}
            columnPage={(columnId) => {
              const lane = board?.stages.find(({ stage }) => stage.id === columnId);
              return {
                hasMore: lane?.pageInfo.hasMore ?? false,
                isLoadingMore: loadingStageId === columnId,
              };
            }}
            onLoadMoreColumn={(columnId) => void loadMoreStage(columnId)}
            emptyState={pipelineEmptyState}
            labels={{
              ...viewLabels,
              emptyColumn: t.crmOpportunities.emptyColumn,
              collapseColumn: t.views.collapseColumn,
              expandColumn: t.views.expandColumn,
              addToColumn: t.crmOpportunityDetail.createAction,
              loadMore: t.crmOpportunities.loadMore,
              loadingMore: t.crmOpportunities.loadingMore,
            }}
          />
        )}

        {view === "card" && (
          <div className="flex h-full flex-col gap-3 overflow-y-auto">
            <CardView
              items={cards.items}
              itemKey={(item) => item.id}
              renderCard={cardViewSlots.renderCard}
              renderActions={cardViewSlots.renderActions}
              renderFooter={cardViewSlots.renderFooter}
              density="compact"
              onActivate={(item) => openOpportunity(item.id)}
              isLoading={cards.isLoading}
              error={cards.error}
              onRetry={() => void cards.reload()}
              emptyState={pipelineEmptyState ?? <EmptyState title={t.crmOpportunities.empty} />}
              labels={{ ...viewLabels, sortBy: t.views.sortBy }}
            />
            {cards.hasMore && (
              <Button
                variant="outline"
                size="sm"
                className="self-center"
                onClick={() => void cards.loadMore()}
                disabled={cards.isLoadingMore}
              >
                {cards.isLoadingMore
                  ? t.crmOpportunities.loadingMore
                  : t.crmOpportunities.loadMore(cards.items.length, cards.totalCount)}
              </Button>
            )}
          </div>
        )}

        {view === "table" && (
          <TableView
            columns={tableColumns}
            density="compact"
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

      <CrmActivityDialog
        key={`activity-${activityOpportunity?.id ?? "closed"}`}
        target={
          activityOpportunity
            ? {
                id: activityOpportunity.id,
                name: activityOpportunity.name,
                targetType: "OPPORTUNITY",
              }
            : null
        }
        onClose={() => setActivityOpportunity(null)}
        onCreated={() => {
          if (view === "board") void fetchPipelines();
          if (view === "card") void cards.reload();
          if (view === "table") void list.reload();
        }}
      />
    </div>
  );
}
