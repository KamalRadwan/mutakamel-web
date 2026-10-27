"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  ConfirmActionModal,
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
import { useAccessMode } from "@/hooks/useAccessMode";
import { useTenantAuth } from "@/context/AuthContext";
import { canCreateActivities } from "@/components/activities/activity-presentation";
import { ActivityModal } from "@/components/activities/ActivityModal";
import type { ActivityTargetSelection } from "@/components/activities/activity-contract";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { localizedName } from "@/lib/format/localized";
import { useCrmCreateCustomFields } from "../../shared/hooks/useCrmCreateCustomFields";
import { useCrmFieldMessages } from "../../shared/hooks/useCrmFieldMessages";
import { CrmScopeGate } from "../../shared/components/CrmScopeGate";
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
  const { canMutate } = useAccessMode();
  const { user } = useTenantAuth();
  const canOpenActivities = canMutate && canCreateActivities(user);
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
    funnelLanes,
    capabilities,
    refreshCapabilities,
    reopenMove,
    confirmReopenMove,
    cancelReopenMove,
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
    requestListStageMove,
    terminalMove,
    confirmTerminalMove,
    cancelTerminalMove,
    updateCard,
    loadMoreStage,
    initialPartyId,
  } = usePipelineWorkspace(view === "board", view !== "board");

  const list = useOpportunitiesList(
    view === "table" || view === "card" ? branchId : null,
    selectedPipelineId,
    null,
    actorUserId,
    initialPartyId,
  );

  const listErrorStatus = list.error?.status;
  useEffect(() => {
    if (listErrorStatus !== 403) return;
    let active = true;
    queueMicrotask(() => { if (active) void refreshCapabilities(); });
    return () => { active = false; };
  }, [listErrorStatus, refreshCapabilities]);

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
  const [stageMoveError, setStageMoveError] = useState<string | null>(null);
  const [bulkTerminalMove, setBulkTerminalMove] = useState<{
    ids: readonly string[];
    stageId: string;
    flag: "WON" | "LOST";
  } | null>(null);
  const [bulkReopenMove, setBulkReopenMove] = useState<{ ids: readonly string[]; stageId: string } | null>(null);
  const [isBulkMoving, setIsBulkMoving] = useState(false);
  const stageMoveInFlight = useRef(false);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<readonly string[] | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const bulkDeleteInFlight = useRef(false);
  const [bulkDeleteSummary, setBulkDeleteSummary] = useState<{
    deleted: number;
    failed: number;
    skipped: number;
  } | null>(null);
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
    setBulkReopenMove(null);
    setBulkTerminalMove(null);
    cancelReopenMove();
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
    setBulkReopenMove(null);
    setBulkTerminalMove(null);
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
      amountInvalid: t.crmShared.refusals.CRM_AMOUNT_SCALE_INVALID,
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
      canMutate && opportunityCapabilityAllowsOwner(
        capabilities?.update ?? null,
        item.ownerUserId,
      ),
    [canMutate, capabilities?.update],
  );

  const canDeleteRow = useCallback(
    (item: { ownerUserId?: string | null }) =>
      canMutate && opportunityCapabilityAllowsOwner(
        capabilities?.delete ?? null,
        item.ownerUserId,
      ),
    [canMutate, capabilities?.delete],
  );

  async function handleDelete() {
    if (!canMutate || !selectedForDelete) return;
    const candidate = [...list.items, ...(board?.stages.flatMap(({ items }) => items) ?? [])].find(({ id }) => id === selectedForDelete.id);
    if (!candidate || !canDeleteRow(candidate)) return;
    if (await deleteOpportunity(selectedForDelete.id)) {
      setSelectedForDelete(null);
      void list.reload();
      void fetchPipelines();
    } else {
      void refreshCapabilities();
    }
  }

  const handleStageMoveItem = useCallback(
    async (
      item: {
        id: string;
        stageId: string;
        title: string;
        ownerUserId?: string | null;
      },
      targetStageId: string,
    ) => {
      if (item.stageId === targetStageId || !canUpdateRow(item)) return;
      setStageMoveError(null);
      const targetStage = selectedPipeline?.stages.find(
        (s) => s.id === targetStageId,
      );
      if (!targetStage) return;

      if (view === "board") {
        moveCard(item.id, item.stageId, targetStageId);
        return;
      }
      const sourceStage = selectedPipeline?.stages.find(({ id }) => id === item.stageId);
      if (targetStage.flag === "WON" || targetStage.flag === "LOST" || sourceStage?.flag === "WON" || sourceStage?.flag === "LOST") {
        requestListStageMove(item, targetStageId, list.reload);
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
      } else {
        if (outcome.error.status === 403) void refreshCapabilities();
        setStageMoveError(
          outcome.kind === "ambiguous"
            ? t.crmOpportunities.stageMoveUncertain
            : t.crmOpportunities.moveFailed,
        );
        if (outcome.kind === "ambiguous") void list.reload();
      }
    },
    [
      fetchPipelines,
      refreshCapabilities,
      canUpdateRow,
      list,
      moveCard,
      requestListStageMove,
      selectedPipeline?.stages,
      view,
      t.crmOpportunities.moveFailed,
      t.crmOpportunities.stageMoveUncertain,
    ],
  );

  async function handleBulkMoveStage(targetStageId: string) {
    if (stageMoveInFlight.current || bulkTerminalMove || bulkReopenMove) return;
    const targetStage = selectedPipeline?.stages.find(
      (s) => s.id === targetStageId,
    );
    if (!targetStage) return;
    const rows = list.items.filter(
      (i) => selectedIds.has(i.id) && canUpdateRow(i) && i.stageId !== targetStageId,
    );
    if (rows.length === 0) return;
    setStageMoveError(null);
    if (targetStage.flag === "WON" || targetStage.flag === "LOST") {
      setBulkTerminalMove({
        ids: rows.map(({ id }) => id),
        stageId: targetStageId,
        flag: targetStage.flag,
      });
      return;
    }
    if (rows.some((row) => selectedPipeline?.stages.some((stage) => stage.id === row.stageId && (stage.flag === "WON" || stage.flag === "LOST")))) {
      setBulkReopenMove({ ids: rows.map(({ id }) => id), stageId: targetStageId });
      return;
    }
    await performBulkMove(rows.map(({ id }) => id), targetStageId);
  }

  async function performBulkMove(
    ids: readonly string[],
    targetStageId: string,
    reason?: string,
  ): Promise<boolean> {
    if (stageMoveInFlight.current) return false;
    const targetStage = selectedPipeline?.stages.find(({ id }) => id === targetStageId);
    if (!targetStage) return false;
    stageMoveInFlight.current = true;
    setIsBulkMoving(true);
    const movedIds = new Set<string>();
    let failed = 0;
    let uncertain = false;
    try {
      for (const id of ids) {
        const row = list.items.find((item) => item.id === id);
        if (!row || !canUpdateRow(row)) continue;
        const outcome = await runIdempotentWrite({
          attempt: createWriteAttempt(),
          method: "post",
          path: `${opportunityPath(id)}/stage`,
          body: buildStageMoveRequest(targetStageId, targetStage.flag, reason),
          parse: (payload) => payload,
        });
        if (outcome.kind === "success" || outcome.kind === "applied_unreadable") {
          movedIds.add(id);
        } else {
          if (outcome.error.status === 403) void refreshCapabilities();
          failed += 1;
          uncertain ||= outcome.kind === "ambiguous";
        }
      }
      setSelectedIds((current) => new Set([...current].filter((id) => !movedIds.has(id))));
      setStageMoveError(
        failed > 0
          ? uncertain
            ? t.crmOpportunities.stageMoveUncertain
            : t.crmOpportunities.moveFailed
          : null,
      );
      setBulkTerminalMove(null);
      setBulkReopenMove(null);
      await list.reload();
      void fetchPipelines();
      return failed === 0;
    } finally {
      stageMoveInFlight.current = false;
      setIsBulkMoving(false);
    }
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

  const deletableRows = list.items.filter(
    (item) => selectedIds.has(item.id) && canDeleteRow(item),
  );

  function requestBulkDelete() {
    if (bulkDeleteInFlight.current || deletableRows.length === 0) return;
    clearError();
    setBulkDeleteSummary(null);
    setBulkDeleteIds(deletableRows.map(({ id }) => id));
  }

  async function handleBulkDelete() {
    if (!bulkDeleteIds || bulkDeleteInFlight.current) return;
    bulkDeleteInFlight.current = true;
    setIsBulkDeleting(true);
    const deletedIds = new Set<string>();
    let failed = 0;
    // Recheck scope at confirmation; never expand the confirmed selection.
    const rows = list.items.filter(
      (item) => bulkDeleteIds.includes(item.id) && canDeleteRow(item),
    );
    const skipped = selectedIds.size - rows.length;
    try {
      for (const row of rows) {
        if (await deleteOpportunity(row.id)) deletedIds.add(row.id);
        else {
          failed += 1;
          void refreshCapabilities();
        }
      }
      setSelectedIds((current) => new Set(
        [...current].filter((id) => !deletedIds.has(id)),
      ));
      setBulkDeleteSummary({ deleted: deletedIds.size, failed, skipped });
      setBulkDeleteIds(null);
      clearError();
      await list.reload();
      void fetchPipelines();
    } finally {
      bulkDeleteInFlight.current = false;
      setIsBulkDeleting(false);
    }
  }

  const scopeDenied = loadError?.status === 403 ||
    (view !== "board" && list.error?.status === 403);

  function resolvePipelineEmptyState() {
    if (needsBranchSelection) {
      return (
        <EmptyState
          className="h-full"
          title={t.crmOpportunities.selectBranchFirst}
        />
      );
    }
    if (scopeDenied) {
      return <CrmScopeGate className="h-full" />;
    }
    if (loadError) {
      return (
        <ErrorState
          title={t.crmOpportunities.loadFailed}
          onRetry={() => void fetchPipelines()}
          retryLabel={t.common.retry}
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
    if (!canOpenActivities) return;
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
          canMutate && capabilities?.create
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
        resetKey={`${branchId ?? "no-branch"}:${selectedPipelineId ?? "no-pipeline"}:${initialPartyId || "no-party"}`}
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

      {capabilitiesUnavailable && !scopeDenied && (
        <DegradedBanner message={t.crmOpportunities.capabilitiesUnavailable} />
      )}

      {bulkDeleteSummary && (
        <div role={bulkDeleteSummary.failed > 0 ? "alert" : "status"}>
          {t.crmOpportunities.bulkDeleteSummary(
            bulkDeleteSummary.deleted,
            bulkDeleteSummary.failed,
            bulkDeleteSummary.skipped,
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-sm border border-destructive bg-destructive-subtle p-2.5 text-xs text-destructive-subtle-foreground"
        >
          {error}
        </div>
      )}

      {stageMoveError && <div role="alert">{stageMoveError}</div>}

      {/* Full-Width Executive Stage Funnel Bar for Card & Table Views */}
      {view !== "board" && !scopeDenied &&
        !(view === "table" && list.search.mode === "advanced") &&
        (selectedPipeline?.stages.length ?? 0) > 0 && (
          <OpportunityStageFunnelBar
            stages={selectedPipeline?.stages ?? []}
            boardLanes={funnelLanes}
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
                    className="h-full w-80 shrink-0 rounded-lg"
                  />
                ))}
              </div>
            ) : (
              <OpportunityExecutiveBoardView
                pipeline={selectedPipeline}
                board={board}
                branchId={branchId}
                isLoading={isLoading}
                isMutating={isMutating}
                loadingStageId={loadingStageId}
                canCreate={canMutate && Boolean(capabilities?.create)}
                createCapability={capabilities?.create ?? null}
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
                onForbidden={refreshCapabilities}
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
      {canMutate && view !== "board" && (
        <OpportunityBulkActionsBar
          selectedIds={selectedIds}
          stages={selectedPipeline?.stages ?? []}
          canUpdateAny={list.items.some(
            (i) => selectedIds.has(i.id) && canUpdateRow(i),
          )}
          deletableCount={deletableRows.length}
          isBulkDeleting={isBulkDeleting || isBulkMoving}
          onBulkMoveStage={handleBulkMoveStage}
          onBulkSetImportance={handleBulkSetImportance}
          onBulkDelete={requestBulkDelete}
          onClearSelection={() => setSelectedIds(new Set())}
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
          return updateCard(opportunityId, patch, item).then((updated) => {
            if (updated) {
              void list.reload();
              void fetchPipelines();
            }
            return updated;
          });
        }}
        onMoveStage={(item, targetStageId) =>
          void handleStageMoveItem(item, targetStageId)
        }
        onDelete={(item) => {
          clearError();
          setSelectedForDelete({ id: item.id, title: item.title });
        }}
        onForbidden={refreshCapabilities}
        onSaved={() => {
          void list.reload();
          void fetchPipelines();
        }}
      />

      <ConfirmActionModal
        open={canMutate && (reopenMove !== null || bulkReopenMove !== null)}
        onOpenChange={(open) => {
          if (!open && !isMutating && !stageMoveInFlight.current) {
            cancelReopenMove();
            setBulkReopenMove(null);
          }
        }}
        title={t.crmOpportunities.reopenTitle}
        description={t.crmOpportunities.reopenMessage}
        confirmLabel={t.crmOpportunities.reopenConfirm}
        cancelLabel={t.common.cancel}
        loading={isMutating || isBulkMoving}
        onConfirm={() => {
          if (bulkReopenMove) void performBulkMove(bulkReopenMove.ids, bulkReopenMove.stageId);
          else void confirmReopenMove();
        }}
      />

      <TerminalMoveDialog
        key={bulkTerminalMove ? `bulk:${bulkTerminalMove.stageId}` : "bulk-closed"}
        isOpen={canMutate && bulkTerminalMove !== null}
        onClose={() => {
          if (!stageMoveInFlight.current) setBulkTerminalMove(null);
        }}
        opportunity={bulkTerminalMove ? {
          title: t.crmOpportunities.bulkMoveSelection(bulkTerminalMove.ids.length),
        } : null}
        targetFlag={bulkTerminalMove?.flag ?? "WON"}
        onConfirm={(reason) => bulkTerminalMove
          ? performBulkMove(bulkTerminalMove.ids, bulkTerminalMove.stageId, reason)
          : Promise.resolve(false)}
        isSubmitting={isBulkMoving}
        error={null}
      />

      <TerminalMoveDialog
        key={
          terminalMove
            ? `${terminalMove.cardId}:${terminalMove.destStageId}`
            : "closed"
        }
        isOpen={canMutate && terminalMove !== null}
        onClose={cancelTerminalMove}
        opportunity={terminalMove?.opportunity ?? null}
        targetFlag={terminalMove?.targetFlag ?? "WON"}
        onConfirm={confirmTerminalMove}
        isSubmitting={isMutating}
        error={terminalMove ? error : null}
      />

      {canMutate && capabilities?.create && <CreateOpportunityModal
        create={create}
        createCapability={capabilities?.create ?? null}
        updateCapability={capabilities?.update ?? null}
        pipelines={pipelines}
        branchId={branchId}
        customFields={customFields}
      />}

      <ConfirmActionModal
        open={canMutate && bulkDeleteIds !== null}
        onOpenChange={(open) => {
          if (!open && !bulkDeleteInFlight.current) setBulkDeleteIds(null);
        }}
        title={t.crmOpportunities.bulkDeleteTitle}
        description={t.crmOpportunities.bulkDeleteMessage(bulkDeleteIds?.length ?? 0)}
        confirmLabel={isBulkDeleting ? t.crmOpportunities.deleting : t.common.delete}
        cancelLabel={t.common.cancel}
        onConfirm={() => void handleBulkDelete()}
        loading={isBulkDeleting}
      />

      <DeleteOpportunityDialog
        item={canMutate ? selectedForDelete : null}
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
            && canOpenActivities ? { kind: "create", target: activityOpportunity, agenda: true }
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
