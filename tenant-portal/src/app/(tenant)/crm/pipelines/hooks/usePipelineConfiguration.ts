"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import type { NormalizedApiError } from "@/lib/api/errors";
import { usePipelineAssignments } from "./usePipelineAssignments";
import { usePipelineDetail } from "./usePipelineDetail";
import { usePipelineFeedback } from "./usePipelineFeedback";
import { usePipelineEditor } from "./usePipelineEditor";

export function usePipelineConfiguration(pipelineId: string) {
  const { t } = useI18n();
  const detail = usePipelineDetail(pipelineId);
  const assignments = usePipelineAssignments(pipelineId, detail.canManage);
  const feedback = usePipelineFeedback();
  const { canMutate } = useAccessMode();
  const canManage = detail.canManage && canMutate && !detail.queryError && !detail.writeBlocked && !assignments.writeBlocked;
  const guard = useUnsavedChangesGuard(assignments.isDirty);
  const requestDiscard = guard.requestDiscard;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const editor = usePipelineEditor(detail, canManage, () => setIsEditOpen(false));
  const editUncertain = editor.uncertain;
  const [action, setAction] = useState<"reset" | "detach" | null>(null);
  const [detachStageId, setDetachStageId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<NormalizedApiError | null>(null);
  const [assignmentError, setAssignmentError] = useState<NormalizedApiError | null>(null);

  const openAction = (next: "reset" | "detach", stageId?: string) => {
    if (!canManage || editUncertain) return;
    setActionError(null);
    setDetachStageId(stageId ?? null);
    setAction(next);
  };
  const confirmAction = async () => {
    if (!canManage || actionError || detail.isSaving || detail.pendingStageId) return;
    const stage = detail.pipeline?.stages.find(({ id }) => id === detachStageId);
    if (action === "reset" && !detail.pipeline?.isDefault) return;
    if (action === "detach" && (!stage || ["NEW", "WON", "LOST"].includes(stage.flag))) return;
    const result = action === "reset" ? await detail.reset() : await detail.detachStage(detachStageId!);
    if (result.stale) return;
    if (feedback.report(result, action === "reset" ? t.crmPipelines.resetDone : t.crmPipelines.stageDetached)) {
      setAction(null);
      if (action === "reset") await assignments.reload();
    } else setActionError(result.error);
  };
  const saveAssignments = async () => {
    if (!canManage || (detail.pipeline?.isDefault && assignments.accessMode !== "ALL")) return;
    const result = await assignments.save();
    if (result.stale) return;
    if (feedback.report(result, t.crmPipelines.assignmentsSaved)) {
      setAssignmentError(null);
    } else setAssignmentError(result.error);
  };
  const attach = async (id: string) => {
    if (!canManage) return false;
    const result = await detail.attachStage(id);
    if (!feedback.report(result, t.crmPipelines.stageAttached)) return false;
    return true;
  };
  const move = async (id: string, direction: -1 | 1) => {
    if (!canManage) return;
    const result = await detail.moveStage(id, direction);
    feedback.report(result, t.crmPipelines.stagesReordered);
  };
  return {
    detail, assignments, canManage, guard, isEditOpen, setIsEditOpen: (open: boolean) => { if (!detail.isPending()) setIsEditOpen(open); }, editError: editor.error, editUncertain,
    readOnly: !detail.canManage || !canMutate, canManageAssignments: detail.canManage && canMutate,
    action, actionError, assignmentError, detachStageId, save: editor.save, confirmAction,
    attach, move, saveAssignments,
    openEdit: () => { if (canManage) requestDiscard(() => { assignments.revert(); editor.clear(); setIsEditOpen(true); }); },
    reconcileEdit: editor.reconcile,
    reconcileAssignments: async () => { if (await assignments.reconcile()) setAssignmentError(null); },
    recover: async () => {
      const detailLoaded = await detail.reload();
      const accessLoaded = await assignments.reconcile();
      if (detailLoaded && accessLoaded) { editor.clear(); setAssignmentError(null); }
    },
    openReset: () => requestDiscard(() => { assignments.revert(); openAction("reset"); }),
    openDetach: (id: string) => openAction("detach", id),
    closeAction: () => { if (!detail.isPending()) { setAction(null); setActionError(null); } },
    reloadAction: () => { setAction(null); setActionError(null); void detail.reload(); },
    reload: () => requestDiscard(() => { void detail.reload(); void assignments.reload(); }),
    describeFailure: feedback.describeFailure,
  };
}
