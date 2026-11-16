"use client";

import { useCallback, useRef, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { axiosClient } from "@/lib/api/axiosClient";
import { createWriteAttempt, runIdempotentWrite, type AppliedUnreadable, type WriteAttempt } from "@/lib/api/idempotent-write";
import { OPPORTUNITIES_PATH, parseOpportunityDetailResponse } from "../opportunity-contract";
import { buildCreateOpportunityRequest, type OpportunityForm } from "../opportunity-write-contract";
import type { CrmFormErrors } from "../../shared/hooks/useCrmCreateForm";
import { parseCrmTags } from "../../shared/tag-contract";

interface CreateOpportunityAmbiguity {
  attempt: WriteAttempt;
  error: NormalizedApiError;
  replay: () => Promise<void>;
}

interface OpportunityTagRecovery {
  opportunityId: string;
  tagIds: string[];
  attempt: WriteAttempt;
  status: "failed" | "uncertain";
  error: NormalizedApiError;
  keepOpenAfterSuccess?: boolean;
}

interface SubmissionOptions {
  branchId: string | null;
  form: OpportunityForm;
  allErrors: CrmFormErrors;
  revealAll: () => void;
  resetDraft: (placement?: Pick<OpportunityForm, "pipelineId" | "stageId">) => void;
  setOpen: (open: boolean) => void;
  onCreated: (id: string) => void;
  onReconcile: () => void;
}

/** An unresolved create owns its immutable payload and command key across both views. */
export function useOpportunityCreateSubmission({ branchId, form, allErrors, revealAll, resetDraft, setOpen, onCreated, onReconcile }: SubmissionOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [appliedUnreadable, setAppliedUnreadable] = useState<AppliedUnreadable | null>(null);
  const [ambiguity, setAmbiguity] = useState<CreateOpportunityAmbiguity | null>(null);
  const [tagRecovery, setTagRecovery] = useState<OpportunityTagRecovery | null>(null);
  const [isRetryingTags, setIsRetryingTags] = useState(false);
  const activeAttempt = useRef<WriteAttempt | null>(null);
  const unreadableReceipt = useRef(false);
  const sending = useRef(false);
  const hasActiveAttempt = useCallback(() => activeAttempt.current !== null, []);
  const clearError = useCallback(() => { setError(null); setAmbiguity(null); }, []);

  const submit = useCallback(async (options?: { keepOpenAfterSuccess?: boolean }): Promise<boolean> => {
    if (activeAttempt.current || sending.current || tagRecovery) return false;
    revealAll();
    if (!branchId || Object.keys(allErrors).length > 0) return false;
    let body;
    try {
      body = buildCreateOpportunityRequest(form, branchId);
    } catch (caught) {
      setError({ status: 422, code: caught instanceof Error ? caught.message : undefined });
      return false;
    }
    const attempt = createWriteAttempt();
    const selectedTagIds = [...(form.tagIds ?? [])];
    const placement = { pipelineId: form.pipelineId, stageId: form.stageId };
    activeAttempt.current = attempt;
    let unresolved = false;

    const send = async (): Promise<boolean> => {
      if (sending.current || unreadableReceipt.current || activeAttempt.current !== attempt) return false;
      sending.current = true;
      setIsSubmitting(true);
      setError(null);
      try {
        const outcome = await runIdempotentWrite({ attempt, method: "post", path: OPPORTUNITIES_PATH, body, parse: parseOpportunityDetailResponse, config: { maxResponseBytes: 512 * 1024 } });
        if (outcome.kind === "success") {
          if (selectedTagIds.length > 0) {
            const tagAttempt = createWriteAttempt();
            let recovery: OpportunityTagRecovery | null = null;
            try {
              const tags = await runIdempotentWrite({ attempt: tagAttempt, method: "post", path: `${OPPORTUNITIES_PATH}/${encodeURIComponent(outcome.value.id)}/tags`, body: { tagIds: selectedTagIds }, parse: (payload) => payload });
              if (tags.kind !== "success") recovery = { opportunityId: outcome.value.id, tagIds: selectedTagIds, attempt: tagAttempt, status: tags.kind === "failed" && tags.error.status !== 409 ? "failed" : "uncertain", error: tags.error, keepOpenAfterSuccess: options?.keepOpenAfterSuccess === true };
            } catch (caught) {
              recovery = { opportunityId: outcome.value.id, tagIds: selectedTagIds, attempt: tagAttempt, status: "uncertain", error: normalizeApiError(caught), keepOpenAfterSuccess: options?.keepOpenAfterSuccess === true };
            }
            if (recovery) {
              setTagRecovery(recovery);
              activeAttempt.current = null;
              setAmbiguity(null);
              resetDraft(placement);
              setOpen(true);
              onReconcile();
              return true;
            }
          }
          activeAttempt.current = null;
          setAmbiguity(null);
          resetDraft(options?.keepOpenAfterSuccess ? placement : undefined);
          if (options?.keepOpenAfterSuccess) onReconcile();
          else { setOpen(false); onCreated(outcome.value.id); }
          return true;
        }
        if (outcome.kind === "applied_unreadable") {
          unreadableReceipt.current = true;
          setAmbiguity(null);
          setOpen(true);
          resetDraft();
          setAppliedUnreadable({ attempt, error: outcome.error });
          onReconcile();
          return true;
        }
        if (outcome.kind === "ambiguous") unresolved = true;
        if (unresolved) setAmbiguity({ attempt, error: outcome.error, replay: async () => { await send(); } });
        else activeAttempt.current = null;
        if (outcome.kind === "failed") setError(outcome.error);
        return false;
      } catch (caught) {
        unresolved = true;
        setAmbiguity({ attempt, error: normalizeApiError(caught), replay: async () => { await send(); } });
        return false;
      } finally {
        sending.current = false;
        setIsSubmitting(false);
      }
    };
    return send();
  }, [branchId, form, allErrors, revealAll, resetDraft, setOpen, onCreated, onReconcile, tagRecovery]);

  const retryTagAttachment = useCallback(async () => {
    if (!tagRecovery || sending.current) return;
    sending.current = true;
    setIsRetryingTags(true);
    let attempt = tagRecovery.status === "uncertain" ? tagRecovery.attempt : createWriteAttempt();
    let tagIds = tagRecovery.tagIds;
    const completed = () => {
      setTagRecovery(null);
      if (!tagRecovery.keepOpenAfterSuccess) { setOpen(false); onCreated(tagRecovery.opportunityId); }
    };
    try {
      // Tag POST is not replayable: first read which parts of the desired
      // relation already exist, then attach only still-missing tags.
      if (tagRecovery.status === "uncertain") {
        const response = await axiosClient.get<unknown>(`${OPPORTUNITIES_PATH}/${encodeURIComponent(tagRecovery.opportunityId)}/tags`, { cache: "no-store", maxResponseBytes: 512 * 1024 });
        if (!Array.isArray(response.data)) throw new Error("Invalid opportunity tags response");
        const attached = new Set(parseCrmTags(response.data).map(({ id }) => id));
        tagIds = tagIds.filter((id) => !attached.has(id));
        if (tagIds.length === 0) { completed(); return; }
        if (tagIds.length !== tagRecovery.tagIds.length) attempt = createWriteAttempt();
      }
      const outcome = await runIdempotentWrite({ attempt, method: "post", path: `${OPPORTUNITIES_PATH}/${encodeURIComponent(tagRecovery.opportunityId)}/tags`, body: { tagIds }, parse: (payload) => payload });
      if (outcome.kind === "success") completed();
      else setTagRecovery({ ...tagRecovery, tagIds, attempt, status: outcome.kind === "failed" && outcome.error.status !== 409 ? "failed" : "uncertain", error: outcome.error });
    } catch (caught) {
      setTagRecovery({ ...tagRecovery, attempt, status: "uncertain", error: normalizeApiError(caught) });
    } finally {
      onReconcile();
      sending.current = false;
      setIsRetryingTags(false);
    }
  }, [onCreated, onReconcile, setOpen, tagRecovery]);

  return { isSubmitting, error, ambiguity, appliedUnreadable, tagRecovery, isRetryingTags, retryTagAttachment, submit, hasActiveAttempt, clearError, dismissAppliedUnreadable: () => {
    unreadableReceipt.current = false; activeAttempt.current = null; setAppliedUnreadable(null); setOpen(false);
  } };
}
