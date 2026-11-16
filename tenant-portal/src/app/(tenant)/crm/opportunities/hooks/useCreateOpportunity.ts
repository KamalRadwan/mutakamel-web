"use client";

import { useCallback, useMemo, useState } from "react";
import { useCrmCreateForm } from "../../shared/hooks/useCrmCreateForm";
import { EMPTY_OPPORTUNITY_FORM, type OpportunityForm } from "../opportunity-write-contract";
import { opportunitySectionErrorCount, validateCreateOpportunity, type OpportunityCreateMessages, type OpportunitySectionId } from "../opportunity-create-validation";
import type { OpportunityPipeline } from "./pipeline-types";
import { useOpportunityCreateSubmission } from "./useOpportunityCreateSubmission";

export { useOpportunityCurrencyOptions } from "./useOpportunityCurrencyOptions";

const isOpenStage = (stage: { flag: string; isActive?: boolean }) => stage.isActive !== false && stage.flag !== "WON" && stage.flag !== "LOST";
export type OpportunityCreateView = "fast" | "full";

function initialForm(placement?: Pick<OpportunityForm, "pipelineId" | "stageId">): OpportunityForm {
  return { ...EMPTY_OPPORTUNITY_FORM, importance: "0", probabilityPercent: "50", ...placement, customFields: {}, tagIds: [] };
}

/** Fast and Full are two presentations of the same draft and write attempt. */
export function useCreateOpportunity(
  branchId: string | null,
  pipelines: OpportunityPipeline[],
  messages: OpportunityCreateMessages,
  requiredCustomFieldKeys: readonly string[],
  onCreated: (id: string) => void,
  onReconcile: () => void,
) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<OpportunityCreateView>("fast");
  const [customerLabel, setCustomerLabel] = useState("");
  const validate = useCallback((candidate: OpportunityForm) => validateCreateOpportunity(candidate, messages, requiredCustomFieldKeys), [messages, requiredCustomFieldKeys]);
  const createInitial = useCallback(() => initialForm(), []);
  const state = useCrmCreateForm({ createInitial, validate });
  const { form, setForm, errors, initialize, reset } = state;
  const resetDraft = useCallback((placement?: Pick<OpportunityForm, "pipelineId" | "stageId">) => {
    initialize(initialForm(placement));
    setCustomerLabel("");
  }, [initialize]);
  const submission = useOpportunityCreateSubmission({ branchId, form, allErrors: state.allErrors, revealAll: state.revealAll, resetDraft, setOpen, onCreated, onReconcile });
  const { hasActiveAttempt, clearError } = submission;
  const selectableStages = useMemo(() => (pipelines.find(({ id }) => id === form.pipelineId)?.stages ?? []).filter(isOpenStage), [form.pipelineId, pipelines]);
  const sectionErrorCount = useCallback((section: OpportunitySectionId) => opportunitySectionErrorCount(errors, section), [errors]);

  const openModal = useCallback((initialStageId?: string | null, draft?: Partial<OpportunityForm>, defaultPipelineId?: string | null, nextView: OpportunityCreateView = "fast") => {
    if (hasActiveAttempt() || submission.tagRecovery) { setOpen(true); return; }
    const pipelineId = draft?.pipelineId || defaultPipelineId || pipelines.find((pipeline) => pipeline.isDefault)?.id || pipelines[0]?.id || "";
    const pipeline = pipelines.find(({ id }) => id === pipelineId);
    const stageId = draft?.stageId || initialStageId || pipeline?.stages.find(isOpenStage)?.id || "";
    initialize({ ...initialForm(), ...draft, pipelineId, stageId });
    setCustomerLabel("");
    clearError();
    setView(nextView);
    setOpen(true);
  }, [hasActiveAttempt, submission.tagRecovery, pipelines, initialize, clearError]);

  const closeModal = useCallback(() => {
    if (!hasActiveAttempt()) { reset(); clearError(); }
    setOpen(false);
  }, [hasActiveAttempt, reset, clearError]);
  const selectPipeline = useCallback((pipelineId: string) => {
    const stage = pipelines.find(({ id }) => id === pipelineId)?.stages.find(isOpenStage);
    setForm((current) => ({ ...current, pipelineId, stageId: stage?.id ?? "" }));
  }, [pipelines, setForm]);
  const selectCustomer = useCallback((id: string, label: string) => {
    setCustomerLabel(label);
    setForm((current) => current.customerProfileId === id ? current : { ...current, customerProfileId: id, contactPartyId: "", leadId: "" });
  }, [setForm]);
  const setCustomField = useCallback((key: string, value: unknown) => setForm((current) => ({ ...current, customFields: { ...current.customFields, [key]: value } })), [setForm]);
  const toggleTag = useCallback((id: string) => setForm((current) => ({ ...current, tagIds: current.tagIds?.includes(id) ? current.tagIds.filter((tag) => tag !== id) : [...(current.tagIds ?? []), id] })), [setForm]);

  return { ...state, ...submission, open, view, setView, customerLabel, selectableStages, sectionErrorCount, reconcile: onReconcile, openModal, closeModal, selectPipeline, selectCustomer, setCustomField, toggleTag };
}
