"use client";

import { useCallback, useMemo, useState } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import {
  createCrmWriteAttempt,
  runCrmWrite,
  type CrmWriteAttempt,
} from "../../../shared/crm-write";
import {
  opportunityPath,
  parseOpportunityDetailResponse,
  type OpportunityDetail,
} from "../../opportunity-contract";
import {
  buildUpdateOpportunityRequest,
  toOpportunityForm,
  type OpportunityForm,
} from "../../opportunity-write-contract";

export interface OpportunityEditAmbiguity {
  attempt: CrmWriteAttempt;
  error: NormalizedApiError;
  replay: () => Promise<void>;
}

/**
 * `PATCH /opportunities/:id` — MASTER-PLAN 8.11 (edit half).
 *
 * Sends changed keys only. Pipeline and stage are absent from the form on
 * purpose: `UpdateOpportunityDto` carries neither, and both have their own
 * routes that derive `status` from the destination stage's flag.
 *
 * No `If-Match`: crm-app has no ETag or `If-Match` handling anywhere
 * (verified by grep across `crm-app/src`), so a 409 here is a domain conflict
 * such as a blacklisted customer, not a version mismatch.
 */
export function useOpportunityEdit(
  item: OpportunityDetail | null,
  onSaved: (item: OpportunityDetail) => void,
) {
  const baseline = useMemo(
    () => (item ? toOpportunityForm(item) : null),
    [item],
  );
  const [form, setForm] = useState<OpportunityForm | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [ambiguity, setAmbiguity] = useState<OpportunityEditAmbiguity | null>(
    null,
  );

  const isDirty = useMemo(() => {
    if (!form || !baseline) return false;
    return (Object.keys(form) as Array<keyof OpportunityForm>).some(
      (key) => form[key].trim() !== baseline[key].trim(),
    );
  }, [baseline, form]);

  const openDrawer = useCallback(() => {
    if (baseline) setForm({ ...baseline });
    setError(null);
    setAmbiguity(null);
  }, [baseline]);

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

  const revert = useCallback(() => {
    if (baseline) setForm({ ...baseline });
    setError(null);
  }, [baseline]);

  const submit = useCallback(async () => {
    if (!item || !form || !baseline || isSubmitting) return;
    let body;
    try {
      body = buildUpdateOpportunityRequest(form, baseline);
    } catch (caught) {
      setError({
        status: 422,
        message: caught instanceof Error ? caught.message : undefined,
      });
      return;
    }
    if (Object.keys(body).length === 0) {
      closeDrawer();
      return;
    }
    const attempt = createCrmWriteAttempt();

    const send = async (): Promise<void> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const outcome = await runCrmWrite({
          attempt,
          method: "patch",
          path: opportunityPath(item.id),
          body,
          parse: parseOpportunityDetailResponse,
          config: { maxResponseBytes: 512 * 1024 },
        });
        if (outcome.kind === "success") {
          setAmbiguity(null);
          onSaved(outcome.value);
          setForm(null);
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
  }, [baseline, closeDrawer, form, isSubmitting, item, onSaved]);

  return {
    open: form !== null,
    form,
    isDirty,
    isSubmitting,
    error,
    ambiguity,
    dismissAmbiguity: () => setAmbiguity(null),
    openDrawer,
    closeDrawer,
    setField,
    revert,
    submit,
  };
}
