"use client";

import { useCallback, useMemo, useState } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import {
  createCrmWriteAttempt,
  runCrmWrite,
  type CrmWriteAttempt,
} from "../../shared/crm-write";
import {
  OPPORTUNITIES_PATH,
  parseOpportunityDetailResponse,
} from "../opportunity-contract";
import {
  EMPTY_OPPORTUNITY_FORM,
  buildCreateOpportunityRequest,
  isValidOpportunityAmount,
  type OpportunityForm,
} from "../opportunity-write-contract";
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
  onCreated: (opportunityId: string) => void,
) {
  const [form, setForm] = useState<OpportunityForm | null>(null);
  const [customerLabel, setCustomerLabel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [ambiguity, setAmbiguity] = useState<CreateOpportunityAmbiguity | null>(
    null,
  );

  const selectableStages = useMemo(() => {
    const pipeline = pipelines.find(({ id }) => id === form?.pipelineId);
    return (pipeline?.stages ?? []).filter(
      (stage) => !TERMINAL_STAGE_FLAGS.includes(stage.flag),
    );
  }, [form?.pipelineId, pipelines]);

  const isValid =
    form !== null &&
    form.customerProfileId.length > 0 &&
    form.pipelineId.length > 0 &&
    form.stageId.length > 0 &&
    form.title.trim().length > 0 &&
    isValidOpportunityAmount(form.amount);

  const openDrawer = useCallback(() => {
    setForm({ ...EMPTY_OPPORTUNITY_FORM });
    setCustomerLabel("");
    setError(null);
    setAmbiguity(null);
  }, []);

  const closeDrawer = useCallback(() => {
    setForm(null);
    setError(null);
  }, []);

  const setField = useCallback(
    <K extends keyof OpportunityForm>(key: K, value: OpportunityForm[K]) => {
      setForm((current) => (current ? { ...current, [key]: value } : current));
    },
    [],
  );

  const selectCustomer = useCallback((id: string, label: string) => {
    setCustomerLabel(label);
    setForm((current) =>
      current ? { ...current, customerProfileId: id } : current,
    );
  }, []);

  const submit = useCallback(async () => {
    if (!form || !branchId || !isValid || isSubmitting) return;
    let body;
    try {
      body = buildCreateOpportunityRequest(form, branchId);
    } catch (caught) {
      setError({
        status: 422,
        message: caught instanceof Error ? caught.message : undefined,
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
          setForm(null);
          onCreated(outcome.value.id);
          return;
        }
        if (outcome.kind === "ambiguous") {
          setAmbiguity({ attempt, error: outcome.error, replay: send });
          return;
        }
        setError(outcome.error);
      } finally {
        setIsSubmitting(false);
      }
    };

    await send();
  }, [branchId, form, isSubmitting, isValid, onCreated]);

  return {
    open: form !== null,
    form,
    customerLabel,
    selectableStages,
    isValid,
    isSubmitting,
    error,
    ambiguity,
    dismissAmbiguity: () => setAmbiguity(null),
    openDrawer,
    closeDrawer,
    setField,
    selectCustomer,
    submit,
  };
}
