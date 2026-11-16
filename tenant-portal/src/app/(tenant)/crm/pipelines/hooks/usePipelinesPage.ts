"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { CreatePipelineInput, Pipeline } from "../pipeline-contract";
import { useOpportunityStageCatalogue } from "../../shared/hooks/useOpportunityStageCatalogue";
import { usePipelineFeedback } from "./usePipelineFeedback";
import { usePipelines } from "./usePipelines";
import { isUncertainPipelineWrite } from "./pipeline-uncertainty";

export function usePipelinesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const list = usePipelines();
  const { canMutate } = useAccessMode();
  const feedback = usePipelineFeedback();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [createErrorCode, setCreateErrorCode] = useState<string>();
  const [createUncertain, setCreateUncertain] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Pipeline | null>(null);
  const [deleteError, setDeleteError] = useState<NormalizedApiError | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const catalogue = useOpportunityStageCatalogue(isCreateOpen);
  const canManage = list.canManage && canMutate && list.hasLoaded && !list.queryError && !list.writeBlocked;

  const create = async (input: CreatePipelineInput) => {
    if (!canManage || createUncertain) return;
    const result = await list.create(input);
    if (result.stale) return;
    setCreateErrorCode(result.error?.code);
    if (result.ok) {
      setIsCreateOpen(false);
      setCreateError(undefined);
      feedback.report(result, t.crmPipelines.created);
    } else {
      const uncertain = isUncertainPipelineWrite(result.error);
      setCreateUncertain(uncertain && !result.reconciled);
      setCreateError(uncertain ? t.crmPipelines.review.uncertainWrite : result.error ? feedback.describeFailure(result.error) : undefined);
      if (result.error) feedback.outcome(result.error);
    }
  };
  const remove = async () => {
    if (!canManage || !pendingDelete || deleteError || list.pendingId) return;
    const result = await list.remove(pendingDelete.id);
    if (result.stale) return;
    if (feedback.report(result, t.crmPipelines.deleted)) setPendingDelete(null);
    else setDeleteError(result.error);
  };
  const setDefault = async (pipeline: Pipeline) => {
    if (!canManage || pipeline.isDefault || !pipeline.isActive || pipeline.accessMode !== "ALL") return;
    void list.setDefault(pipeline.id).then((result) => feedback.report(result, t.crmPipelines.defaultChanged));
  };
  return {
    list, catalogue, canManage, isCreateOpen, setIsCreateOpen: (open: boolean) => { if (!list.isPending()) setIsCreateOpen(open); }, createError, createErrorCode, createUncertain, create,
    pendingDelete, deleteError, remove, setDefault, editingId,
    readOnly: !list.canManage || !canMutate,
    describeFailure: feedback.describeFailure,
    openCreate: () => { if (canManage) { setCreateError(undefined); setCreateErrorCode(undefined); setCreateUncertain(false); setIsCreateOpen(true); } },
    reconcileCreate: async () => { if (await list.reload()) { setCreateUncertain(false); setCreateError(undefined); setCreateErrorCode(undefined); } },
    openDelete: (pipeline: Pipeline) => { if (canManage) { setDeleteError(null); setPendingDelete(pipeline); } },
    closeDelete: () => { if (!list.isPending()) { setPendingDelete(null); setDeleteError(null); } },
    reloadDelete: () => { setPendingDelete(null); setDeleteError(null); void list.reload(); },
    openEdit: (pipeline: Pipeline) => { if (canManage && !list.isPending()) setEditingId(pipeline.id); },
    closeEdit: () => setEditingId(null),
    viewPipeline: (pipeline: Pipeline) => router.push(`/crm/pipelines/${pipeline.id}`),
    search: list.setSearchQuery,
    reload: () => void list.reload(),
  };
}
