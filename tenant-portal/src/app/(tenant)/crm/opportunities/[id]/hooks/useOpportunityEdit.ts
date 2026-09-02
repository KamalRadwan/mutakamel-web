"use client";

import { useCallback, useMemo, useState } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import {
  createCrmWriteAttempt,
  runCrmWrite,
  type CrmAppliedUnreadable,
  type CrmWriteAttempt,
} from "../../../shared/crm-write";
import {
  opportunityPath,
  parseOpportunityDetailResponse,
  type OpportunityDetail,
} from "../../opportunity-contract";
import {
  OPPORTUNITY_NOTHING_TO_SEND,
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
  /**
   * Re-read the record from the server — defect D2. Used when a write applied
   * but its response body could not be parsed: there is no value to hand
   * `onSaved`, the record has nonetheless changed, and the one thing that must
   * NOT happen is a drawer left open with a Save the user presses again.
   */
  onReconcile: () => void,
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
  // D2: the write applied and its receipt could not be read. Its own state,
  // because `error` invites a second Save.
  const [appliedUnreadable, setAppliedUnreadable] =
    useState<CrmAppliedUnreadable | null>(null);

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
      // The builder throws a code, not prose — `useCrmErrorText` owns the
      // words. Putting it in `message` printed the raw constant at the user.
      setError({
        status: 422,
        code: caught instanceof Error ? caught.message : undefined,
      });
      return;
    }
    if (Object.keys(body).length === 0) {
      // A dirty form that produces nothing to send is a change that went
      // nowhere — closing the drawer as if it saved is the D8 failure in its
      // purest form. An untouched form closes as before.
      if (isDirty) {
        setError({ status: 422, code: OPPORTUNITY_NOTHING_TO_SEND });
        return;
      }
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
        if (outcome.kind === "applied_unreadable") {
          // The patch applied. The drawer closes so there is no Save to press
          // again, and the screen re-reads what the server now holds.
          setAmbiguity(null);
          setError(null);
          setForm(null);
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
  }, [
    baseline,
    closeDrawer,
    form,
    isDirty,
    isSubmitting,
    item,
    onReconcile,
    onSaved,
  ]);

  return {
    open: form !== null,
    form,
    isDirty,
    isSubmitting,
    error,
    ambiguity,
    dismissAmbiguity: () => setAmbiguity(null),
    appliedUnreadable,
    dismissAppliedUnreadable: () => setAppliedUnreadable(null),
    reconcile: onReconcile,
    openDrawer,
    closeDrawer,
    setField,
    revert,
    submit,
  };
}
