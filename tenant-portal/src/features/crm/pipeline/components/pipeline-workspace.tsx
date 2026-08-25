"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { PipelineSelectDropdown } from "@/components/layout/PipelineSelectDropdown";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { usePipelineWorkspace } from "../hooks/usePipelineWorkspace";
import { PipelineBoardView } from "./views/pipeline-board-view";
import { TerminalMoveModal } from "./shared/terminal-move-modal";

export function PipelineWorkspace() {
  const { lang } = useI18n();
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
    fetchPipelines,
    fetchBoardData,
    loadMoreStage,
    canUpdateOpportunity,
    moveCard,
    terminalMove,
    confirmTerminalMove,
    cancelTerminalMove,
    updateImportance,
  } = usePipelineWorkspace();

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-black/95">
      <div className="flex min-h-[45px] flex-none flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <TenantBranchSelect
          branchIds={branchIds}
          branchId={branchId}
          onChange={selectBranch}
          disabled={isLoading || isMutating || loadingStageId !== null}
        />
        <PipelineSelectDropdown
          pipelines={pipelines}
          selectedPipelineId={selectedPipelineId}
          onChange={setSelectedPipelineId}
          disabled={isLoading || isMutating || loadingStageId !== null}
        />
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {error ? (
          <div
            role="alert"
            className="m-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            <span className="flex min-w-0 items-center gap-2">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{error}</span>
            </span>
            <button
              type="button"
              className="shrink-0 font-semibold underline underline-offset-2"
              onClick={() => {
                if (selectedPipelineId) {
                  void fetchBoardData(selectedPipelineId);
                } else {
                  void fetchPipelines();
                }
              }}
            >
              {lang === "ar" ? "إعادة المحاولة" : "Retry"}
            </button>
          </div>
        ) : null}

        {isLoading && !board ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span>
              {lang === "ar" ? "جارٍ تحميل مسار المبيعات" : "Loading pipeline"}
            </span>
          </div>
        ) : board ? (
          <PipelineBoardView
            board={board}
            moveCard={moveCard}
            updateImportance={updateImportance}
            canUpdate={canUpdateOpportunity}
            isBusy={isMutating || loadingStageId !== null}
            loadMoreStage={loadMoreStage}
            loadingStageId={loadingStageId}
          />
        ) : null}
      </div>

      <TerminalMoveModal
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
    </div>
  );
}
