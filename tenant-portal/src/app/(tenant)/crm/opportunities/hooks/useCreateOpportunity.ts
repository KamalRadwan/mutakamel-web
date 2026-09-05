"use client";

import { useCallback, useMemo, useState } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import {
  createCrmWriteAttempt,
  runCrmWrite,
  type CrmAppliedUnreadable,
  type CrmWriteAttempt,
} from "../../shared/crm-write";
import {
  OPPORTUNITIES_PATH,
  parseOpportunityDetailResponse,
} from "../opportunity-contract";
import { useCrmCreateForm } from "../../shared/hooks/useCrmCreateForm";
import {
  EMPTY_OPPORTUNITY_FORM,
  buildCreateOpportunityRequest,
  type OpportunityForm,
} from "../opportunity-write-contract";
import {
  opportunitySectionErrorCount,
  validateCreateOpportunity,
  type OpportunityCreateMessages,
  type OpportunitySectionId,
} from "../opportunity-create-validation";
import type { OpportunityPipeline } from "./pipeline-types";

/** `WON` and `LOST` are terminal; a new opportunity never starts closed. */
const TERMINAL_STAGE_FLAGS = ["WON", "LOST"];

export interface CreateOpportunityAmbiguity {
  attempt: CrmWriteAttempt;
  error: NormalizedApiError;
  replay: () => Promise<void>;
}

/**
 * `POST /opportunities` — MASTER-PLAN 8.11 (create half).
 *
 * Until now the only route to a new opportunity was lead conversion. This is
 * the direct one, for a deal that arrives from an existing customer rather than
 * a lead — which is why `customerProfileId` is required and picked, never
 * typed.
 */
export function useCreateOpportunity(
  branchId: string | null,
  pipelines: OpportunityPipeline[],
  messages: OpportunityCreateMessages,
  requiredCustomFieldKeys: readonly string[],
  onCreated: (opportunityId: string) => void,
  /**
   * Re-read what the screen shows — defect D2. Called when a write applied but
   * its response body could not be parsed, and offered again as the panel's own
   * action, because refreshing is the only safe thing left to do.
   */
  onReconcile: () => void,
) {
  const [open, setOpen] = useState(false);
  const [customerLabel, setCustomerLabel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  // D2: the write applied and its receipt could not be read. Its own state,
  // because `error` invites a second Save and that is exactly what a
  // non-idempotent route cannot take.
  const [appliedUnreadable, setAppliedUnreadable] =
    useState<CrmAppliedUnreadable | null>(null);
  const [ambiguity, setAmbiguity] = useState<CreateOpportunityAmbiguity | null>(
    null,
  );

  const validate = useCallback(
    (candidate: OpportunityForm) =>
      validateCreateOpportunity(candidate, messages, requiredCustomFieldKeys),
    [messages, requiredCustomFieldKeys],
  );
  const createInitial = useCallback(() => ({ ...EMPTY_OPPORTUNITY_FORM }), []);
  const state = useCrmCreateForm({ createInitial, validate });
  const { form, setForm, errors, allErrors, revealAll, reset } = state;

  const selectableStages = useMemo(() => {
    const pipeline = pipelines.find(({ id }) => id === form.pipelineId);
    return (pipeline?.stages ?? []).filter(
      (stage) => !TERMINAL_STAGE_FLAGS.includes(stage.flag),
    );
  }, [form.pipelineId, pipelines]);

  const sectionErrorCount = useCallback(
    (section: OpportunitySectionId) => opportunitySectionErrorCount(errors, section),
    [errors],
  );

  const openModal = useCallback(() => {
    reset();
    setCustomerLabel("");
    setError(null);
    setAmbiguity(null);
    setOpen(true);
  }, [reset]);

  const closeModal = useCallback(() => {
    reset();
    setError(null);
    setOpen(false);
  }, [reset]);

  // A stage belongs to exactly one pipeline — `where: { id, pipelineId }` — so
  // a stage chosen under the old pipeline is `404 PIPELINE_STAGE_NOT_FOUND`
  // against the new one. It is cleared rather than left to be rejected.
  const selectPipeline = useCallback(
    (pipelineId: string) => {
      setForm((current) => ({ ...current, pipelineId, stageId: "" }));
    },
    [setForm],
  );

  const setCustomField = useCallback(
    (fieldKey: string, value: unknown) => {
      setForm((current) => ({
        ...current,
        customFields: { ...current.customFields, [fieldKey]: value },
      }));
    },
    [setForm],
  );

  const selectCustomer = useCallback(
    (id: string, label: string) => {
      setCustomerLabel(label);
      setForm((current) => ({ ...current, customerProfileId: id }));
    },
    [setForm],
  );

  const submit = useCallback(async () => {
    // Every field speaks now, including the ones never focused. Submit is not
    // disabled while the form is invalid: a disabled button gives a keyboard
    // user no way to ask what is wrong, so the press is what reveals it.
    revealAll();
    if (!branchId || isSubmitting || Object.keys(allErrors).length > 0) return;
    let body;
    try {
      body = buildCreateOpportunityRequest(form, branchId);
    } catch (caught) {
      // The builder throws a code, not prose — `useCrmErrorText` owns the words.
      setError({
        status: 422,
        code: caught instanceof Error ? caught.message : undefined,
      });
      return;
    }
    const attempt = createCrmWriteAttempt();

    const send = async (): Promise<void> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const outcome = await runCrmWrite({
          attempt,
          method: "post",
          path: OPPORTUNITIES_PATH,
          body,
          parse: parseOpportunityDetailResponse,
          config: { maxResponseBytes: 512 * 1024 },
        });
        if (outcome.kind === "success") {
          setAmbiguity(null);
          setOpen(false);
          reset();
          onCreated(outcome.value.id);
          return;
        }
        if (outcome.kind === "ambiguous") {
          setAmbiguity({ attempt, error: outcome.error, replay: send });
          return;
        }
        if (outcome.kind === "applied_unreadable") {
          // `POST /opportunities` is not idempotent across attempts: the deal
          // exists, and a second Save makes two. The form is cleared so there
          // is nothing left to press.
          setAmbiguity(null);
          setError(null);
          setOpen(false);
          reset();
          setAppliedUnreadable({ attempt, error: outcome.error });
          onReconcile();
          return;
        }
        setError(outcome.error);
      } finally {
        setIsSubmitting(false);
      }
    };

    await send();
  }, [allErrors, branchId, form, isSubmitting, onCreated, onReconcile, reset, revealAll]);

  return {
    ...state,
    open,
    customerLabel,
    selectableStages,
    sectionErrorCount,
    isSubmitting,
    error,
    ambiguity,
    dismissAmbiguity: () => setAmbiguity(null),
    appliedUnreadable,
    dismissAppliedUnreadable: () => setAppliedUnreadable(null),
    reconcile: onReconcile,
    openModal,
    closeModal,
    selectPipeline,
    setCustomField,
    selectCustomer,
    submit,
  };
}
