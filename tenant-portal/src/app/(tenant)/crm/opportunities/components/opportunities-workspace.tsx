"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  DegradedBanner,
  EmptyState,
  ErrorState,
  PageActions,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  ViewSwitcher,
  useWorkspaceState,
  type SortState,
} from "@/design-system";
import { ActivitiesWorkspaceLink } from "@/components/activities/ActivitiesWorkspaceLink";
import { ActivityModal } from "@/components/activities/ActivityModal";
import type { ActivityTargetSelection } from "@/components/activities/activity-contract";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { useCrmCreateCustomFields } from "../../shared/hooks/useCrmCreateCustomFields";
import { useCrmFieldMessages } from "../../shared/hooks/useCrmFieldMessages";
import { CreateOpportunityModal } from "./CreateOpportunityModal";
import {
  DeleteOpportunityDialog,
  type OpportunityDeleteItem,
} from "./DeleteOpportunityDialog";
import { OpportunityBulkActionsBar } from "./OpportunityBulkActionsBar";
import {
  OpportunityExecutiveBoardView,
  type QuickCreateOpportunityDraft,
} from "./OpportunityExecutiveBoardView";
import { OpportunityExecutiveCardView } from "./OpportunityExecutiveCardView";
import { OpportunityExecutiveTableView } from "./OpportunityExecutiveTableView";
import {
  OpportunityQuickEditModal,
  type OpportunityQuickEditItem,
} from "./OpportunityQuickEditModal";
import { OpportunitySearchBar } from "./OpportunitySearchBar";
import { OpportunityStageFunnelBar } from "./OpportunityStageFunnelBar";
import { TerminalMoveDialog } from "./TerminalMoveDialog";
import { useCreateOpportunity } from "../hooks/useCreateOpportunity";
import { useDeleteOpportunity } from "../hooks/useDeleteOpportunity";
import { useOpportunitiesList } from "../hooks/useOpportunitiesList";
import { useOpportunityDocumentCounts } from "../hooks/useOpportunityDocumentCounts";
import {
  buildStageMoveRequest,
  opportunityCapabilityAllowsOwner,
  usePipelineWorkspace,
} from "../hooks/usePipelineWorkspace";
import {
  addOpportunityBasicFilter,
  EMPTY_OPPORTUNITY_BASIC_SEARCH,
  type OpportunityBasicSearch,
} from "../opportunity-basic-search-contract";
import { opportunityPath } from "../opportunity-contract";
import {
  opportunitySearchWithBasic,
  opportunitySearchWithMode,
} from "../opportunity-search-contract";

export function OpportunitiesWorkspace() {
  const { t, lang } = useI18n();
  const [selectedForDelete, setSelectedForDelete] =
    useState<OpportunityDeleteItem | null>(null);
  const {
    deleteOpportunity,
    isDeleting,
    error: deleteError,
    clearError,
  } = useDeleteOpportunity();

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
    canDeleteOpportunity,
    moveCard,
    terminalMove,
    confirmTerminalMove,
    cancelTerminalMove,
    updateCard,
    loadMoreStage,
  } = usePipelineWorkspace(view === "board");

  const list = useOpportunitiesList(
    view === "table" || view === "card" ? branchId : null,
    selectedPipelineId,
    null,
    actorUserId,
  );

  const activeBasicSearch =
    list.search.mode === "basic"
      ? list.search.basic
      : EMPTY_OPPORTUNITY_BASIC_SEARCH;
  const requestedStageId =
    activeBasicSearch.filters.find(({ field }) => field === "stage")?.value ??
    null;
  const requestedPipelineId =
    activeBasicSearch.filters.find(({ field }) => field === "pipeline")
      ?.value ?? null;
  const stagePipeline = pipelines.find((pipeline) =>
    pipeline.stages.some((stage) => stage.id === requestedStageId),
  );
  const searchPipelineId = stagePipeline?.id ?? requestedPipelineId;
  const stageId =
    selectedPipelineId === stagePipeline?.id ? requestedStageId : null;

  useEffect(() => {
    if (
      list.search.mode === "basic" &&
      searchPipelineId &&
      searchPipelineId !== selectedPipelineId &&
      pipelines.some(({ id }) => id === searchPipelineId)
    ) {
      setSelectedPipelineId(searchPipelineId);
    }
  }, [
    list.search.mode,
    pipelines,
    searchPipelineId,
    selectedPipelineId,
    setSelectedPipelineId,
  ]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quickEditItem, setQuickEditItem] =
    useState<OpportunityQuickEditItem | null>(null);

  function selectStage(nextStageId: string | undefined) {
    if (list.search.mode !== "basic") return;
    let basic: OpportunityBasicSearch = {
      ...list.search.basic,
      filters: list.search.basic.filters.filter(
        ({ field }) => field !== "stage",
      ),
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
    setSelectedIds(new Set());
  }

  function selectPipeline(nextPipelineId: string) {
    setSelectedPipelineId(nextPipelineId);
    setSelectedIds(new Set());
    if (list.search.mode !== "basic") return;
    const validStageIds = new Set(
      pipelines
        .find(({ id }) => id === nextPipelineId)
        ?.stages.map(({ id }) => id) ?? [],
    );
    const withoutInvalidStage = {
      ...list.search.basic,
      filters: list.search.basic.filters.filter(
        (filter) =>
          filter.field !== "stage" || validStageIds.has(filter.value),
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
    setSelectedIds(new Set());
    if (list.search.mode !== "basic") return;
    const basic: OpportunityBasicSearch = {
      ...list.search.basic,
      filters: list.search.basic.filters.filter(
        ({ field }) => field !== "pipeline" && field !== "stage",
      ),
    };
    list.changeSearch(opportunitySearchWithBasic(list.search, basic));
  }

  const documentCounts = useOpportunityDocumentCounts(
    list.items,
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
    setSelectedIds(new Set());
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
    () => {
      void list.reload();
      void fetchPipelines();
    },
  );

  const selectedPipeline =
    pipelines.find(({ id }) => id === selectedPipelineId) ?? null;

  const canUpdateRow = useCallback(
    (item: { ownerUserId?: string | null }) =>
      opportunityCapabilityAllowsOwner(
        capabilities?.update ?? null,
        item.ownerUserId,
      ),
    [capabilities?.update],
  );

  const canDeleteRow = useCallback(
    (item: { ownerUserId?: string | null }) =>
      opportunityCapabilityAllowsOwner(
        capabilities?.delete ?? null,
        item.ownerUserId,
      ),
    [capabilities?.delete],
  );

  async function handleDelete() {
    if (!selectedForDelete) return;
    if (await deleteOpportunity(selectedForDelete.id)) {
      setSelectedForDelete(null);
      void list.reload();
      void fetchPipelines();
    }
  }

  const handleStageMoveItem = useCallback(
    async (
      item: { id: string; stageId: string; title: string },
      targetStageId: string,
    ) => {
      if (item.stageId === targetStageId) return;
      const targetStage = selectedPipeline?.stages.find(
        (s) => s.id === targetStageId,
      );
      if (!targetStage) return;

      // For board view or terminal moves, delegate to moveCard when item is on board
      if (
        view === "board" ||
        targetStage.flag === "WON" ||
        targetStage.flag === "LOST"
      ) {
        moveCard(item.id, item.stageId, targetStageId);
        return;
      }

      const attempt = createWriteAttempt();
      const outcome = await runIdempotentWrite({
        attempt,
        method: "post",
        path: `${opportunityPath(item.id)}/stage`,
        body: buildStageMoveRequest(targetStageId, targetStage.flag),
        parse: (payload) => payload,
      });
      if (
        outcome.kind === "success" ||
        outcome.kind === "applied_unreadable"
      ) {
        void list.reload();
        void fetchPipelines();
      }
    },
    [fetchPipelines, list, moveCard, selectedPipeline?.stages, view],
  );

  async function handleBulkMoveStage(targetStageId: string) {
    const targetStage = selectedPipeline?.stages.find(
      (s) => s.id === targetStageId,
    );
    if (!targetStage) return;
    const rows = list.items.filter(
      (i) => selectedIds.has(i.id) && canUpdateRow(i) && i.stageId !== targetStageId,
    );
    for (const row of rows) {
      const attempt = createWriteAttempt();
      await runIdempotentWrite({
        attempt,
        method: "post",
        path: `${opportunityPath(row.id)}/stage`,
        body: buildStageMoveRequest(targetStageId, targetStage.flag),
        parse: (payload) => payload,
      }).catch(() => undefined);
    }
    setSelectedIds(new Set());
    await list.reload();
    void fetchPipelines();
  }

  async function handleBulkSetImportance(importance: number) {
    const rows = list.items.filter(
      (i) => selectedIds.has(i.id) && canUpdateRow(i),
    );
    for (const row of rows) {
      await updateCard(row.id, { importance }, row);
    }
    setSelectedIds(new Set());
    await list.reload();
    void fetchPipelines();
  }

  async function handleBulkDelete() {
    const rows = list.items.filter(
      (i) => selectedIds.has(i.id) && canDeleteRow(i),
    );
    for (const row of rows) {
      await deleteOpportunity(row.id);
    }
    setSelectedIds(new Set());
    await list.reload();
    void fetchPipelines();
  }

  function resolvePipelineEmptyState() {
    if (needsBranchSelection) {
      return (
        <EmptyState
          className="h-full"
          title={t.crmOpportunities.selectBranchFirst}
        />
      );
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

  const [activityOpportunity, setActivityOpportunity] =
    useState<ActivityTargetSelection | null>(null);
  function openActivities(item: { id: string; title: string }) {
    setActivityOpportunity({
      app: "CRM",
      type: "OPPORTUNITY",
      id: item.id,
      label: item.title,
    });
  }

  const boardItems = useMemo(
    () => (board?.stages ?? []).flatMap((lane) => lane.items),
    [board],
  );

  const activeItemsForQuickModal: readonly OpportunityQuickEditItem[] =
    view === "board" ? boardItems : list.items;

  const listErrorText = list.error
    ? list.error.message || t.crmOpportunities.loadFailed
    : null;

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      {/* Preserve the accessible heading; actions render in the shell's action bar. */}
      <PageHeader
        className="sr-only"
        title={t.crmOpportunities.heading}
        primaryAction={
          capabilities?.create
            ? {
                label: t.crmOpportunityDetail.createAction,
                icon: <Plus className="size-4" aria-hidden="true" />,
                onClick: () =>
                  create.openModal(null, undefined, selectedPipelineId),
              }
            : undefined
        }
        secondaryActions={
          <>
            <TenantBranchSelect
              branchIds={branchIds}
              branchId={branchId}
              onChange={selectBranch}
              disabled={isLoading || isMutating}
            />
            <Select
              value={selectedPipelineId ?? ""}
              onValueChange={selectPipeline}
              disabled={pipelines.length === 0 || isLoading}
            >
              <SelectTrigger size="sm" className="w-48">
                <SelectValue
                  placeholder={
                    pipelines.length === 0
                      ? t.crmOpportunities.noPipeline
                      : t.crmOpportunities.selectPipeline
                  }
                />
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
          labels={{
            board: t.views.board,
            card: t.views.card,
            table: t.views.table,
          }}
        />
        <ActivitiesWorkspaceLink type="OPPORTUNITY" />
      </PageActions>

      {capabilitiesUnavailable && (
        <DegradedBanner message={t.crmOpportunities.capabilitiesUnavailable} />
      )}

      {error && (
        <div
          role="alert"
          className="rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300"
        >
          {error}
        </div>
      )}

      {/* Full-Width Executive Stage Funnel Bar for Card & Table Views */}
      {view !== "board" &&
        !(view === "table" && list.search.mode === "advanced") &&
        (selectedPipeline?.stages.length ?? 0) > 0 && (
          <OpportunityStageFunnelBar
            stages={selectedPipeline?.stages ?? []}
            items={list.items}
            boardLanes={board?.stages}
            totalCount={list.pageInfo.total}
            selectedStageId={stageId ?? undefined}
            onSelectStage={selectStage}
            disabled={!branchId}
          />
        )}

      <div className="min-h-0 flex-1">
        {view === "board" && (
          <>
            {pipelineEmptyState ? (
              pipelineEmptyState
            ) : isLoading ? (
              <div className="flex h-full gap-3 overflow-x-auto pb-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <Skeleton
                    key={`board-col-skel-${idx}`}
                    className="h-full w-80 shrink-0 rounded-xl"
                  />
                ))}
              </div>
            ) : loadError ? (
              <ErrorState
                title={t.crmOpportunities.loadFailed}
                onRetry={() => void fetchPipelines()}
                retryLabel={t.common.retry}
              />
            ) : (
              <OpportunityExecutiveBoardView
                pipeline={selectedPipeline}
                board={board}
                branchId={branchId}
                isLoading={isLoading}
                isMutating={isMutating}
                loadingStageId={loadingStageId}
                canCreate={Boolean(capabilities?.create)}
                canUpdate={canUpdateOpportunity}
                canDelete={canDeleteOpportunity}
                onOpen={(item) => openOpportunity(item.id)}
                onOpenQuickModal={(item) => setQuickEditItem(item)}
                onOpenFullCreate={(
                  initialStageId?: string,
                  draft?: QuickCreateOpportunityDraft,
                ) =>
                  create.openModal(
                    initialStageId ?? null,
                    draft,
                    selectedPipelineId,
                  )
                }
                onDelete={(item) => {
                  clearError();
                  setSelectedForDelete({ id: item.id, title: item.title });
                }}
                onOpenActivities={(item) => openActivities(item)}
                onCardChange={(opportunityId, patch, item) => {
                  void updateCard(opportunityId, patch, item);
                }}
                onMoveCard={(cardId, sourceStageId, destStageId) => {
                  moveCard(cardId, sourceStageId, destStageId);
                }}
                onLoadMoreStage={(colId) => void loadMoreStage(colId)}
                onRefreshBoard={() => void fetchPipelines()}
              />
            )}
          </>
        )}

        {view === "card" && (
          <>
            {pipelineEmptyState ? (
              pipelineEmptyState
            ) : (
              <OpportunityExecutiveCardView
                items={list.items}
                stages={selectedPipeline?.stages ?? []}
                branchId={branchId}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                canUpdate={canUpdateRow}
                canDelete={canDeleteRow}
                isLoading={list.isLoading}
                error={listErrorText}
                onRetry={() => void list.reload()}
                page={list.pageInfo}
                onPageChange={workspace.setPage}
                sort={workspace.sort ?? list.sort}
                onSortChange={workspace.setSort}
                documentCountsByParty={documentCounts.countsByParty}
                documentCountVisibility={documentCounts.visible}
                onOpenOpportunity={(item) => openOpportunity(item.id)}
                onOpenQuickModal={(item) => setQuickEditItem(item)}
                onOpenActivities={(item) => openActivities(item)}
                onDeleteOpportunity={(item) => {
                  clearError();
                  setSelectedForDelete({ id: item.id, title: item.title });
                }}
                onMoveStage={(item, targetStageId) =>
                  void handleStageMoveItem(item, targetStageId)
                }
                onCardChange={(opportunityId, patch, item) => {
                  void updateCard(opportunityId, patch, item).then((updated) => {
                    if (updated) void list.reload();
                  });
                }}
                onBulkMoveStage={handleBulkMoveStage}
              />
            )}
          </>
        )}

        {view === "table" && (
          <>
            {pipelineEmptyState ? (
              pipelineEmptyState
            ) : (
              <OpportunityExecutiveTableView
                items={list.items}
                stages={selectedPipeline?.stages ?? []}
                branchId={branchId}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                canUpdate={canUpdateRow}
                canDelete={canDeleteRow}
                isLoading={list.isLoading}
                error={listErrorText}
                onRetry={() => void list.reload()}
                page={list.pageInfo}
                onPageChange={workspace.setPage}
                sort={workspace.sort ?? list.sort}
                onSortChange={workspace.setSort}
                onOpenQuickModal={(item) => setQuickEditItem(item)}
                onOpenActivities={(item) => openActivities(item)}
                onDeleteOpportunity={(item) => {
                  clearError();
                  setSelectedForDelete({ id: item.id, title: item.title });
                }}
                onMoveStage={(item, targetStageId) =>
                  void handleStageMoveItem(item, targetStageId)
                }
                onCardChange={(opportunityId, patch, item) => {
                  void updateCard(opportunityId, patch, item).then((updated) => {
                    if (updated) void list.reload();
                  });
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Floating Dark Bulk Actions Command Bar */}
      {view !== "board" && (
        <OpportunityBulkActionsBar
          selectedIds={selectedIds}
          stages={selectedPipeline?.stages ?? []}
          canUpdateAny={list.items.some(
            (i) => selectedIds.has(i.id) && canUpdateRow(i),
          )}
          canDeleteAny={list.items.some(
            (i) => selectedIds.has(i.id) && canDeleteRow(i),
          )}
          onBulkMoveStage={handleBulkMoveStage}
          onBulkSetImportance={handleBulkSetImportance}
          onBulkDelete={handleBulkDelete}
          onClearSelection={() => setSelectedIds(new Set())}
          onOpenFirstSelectedModal={() => {
            const first = list.items.find((i) => selectedIds.has(i.id));
            if (first) setQuickEditItem(first);
          }}
          onOpenFirstSelectedActivities={() => {
            const first = list.items.find((i) => selectedIds.has(i.id));
            if (first) openActivities(first);
          }}
        />
      )}

      {/* Centered 360° Quick-Edit & Inspector Modal */}
      <OpportunityQuickEditModal
        item={quickEditItem}
        allItems={activeItemsForQuickModal}
        stages={selectedPipeline?.stages ?? []}
        branchId={branchId}
        canUpdate={canUpdateRow}
        canDelete={canDeleteRow}
        allowedOwnerIds={capabilities?.update?.ownerUserIds ?? null}
        onClose={() => setQuickEditItem(null)}
        onSelectOpportunity={(next) => setQuickEditItem(next)}
        onOpenActivities={(item) => openActivities(item)}
        onCardChange={(opportunityId, patch, item) => {
          void updateCard(opportunityId, patch, item).then((updated) => {
            if (updated) {
              void list.reload();
              void fetchPipelines();
            }
          });
        }}
        onMoveStage={(item, targetStageId) =>
          void handleStageMoveItem(item, targetStageId)
        }
        onDelete={(item) => {
          clearError();
          setSelectedForDelete({ id: item.id, title: item.title });
        }}
        onSaved={() => {
          void list.reload();
          void fetchPipelines();
        }}
      />

      <TerminalMoveDialog
        key={
          terminalMove
            ? `${terminalMove.cardId}:${terminalMove.destStageId}`
            : "closed"
        }
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

      <ActivityModal
        scope="CRM"
        branchId={branchId}
        request={
          activityOpportunity
            ? { kind: "create", target: activityOpportunity, agenda: true }
            : null
        }
        onClose={() => setActivityOpportunity(null)}
        onChanged={() => {
          if (view === "board") void fetchPipelines();
          if (view === "card" || view === "table") void list.reload();
        }}
      />
    </div>
  );
}
