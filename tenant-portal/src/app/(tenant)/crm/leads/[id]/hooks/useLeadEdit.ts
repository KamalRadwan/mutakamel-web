"use client";

import { useCallback, useMemo, useState } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import {
  createCrmWriteAttempt,
  runCrmWrite,
  type CrmWriteAttempt,
} from "../../../shared/crm-write";
import { leadPath, parseLeadDetailResponse, type LeadDetail } from "../../lead-contract";
import {
  buildUpdateLeadRequest,
  type LeadEditForm,
} from "../../lead-write-contract";

function toForm(lead: LeadDetail): LeadEditForm {
  return {
    displayName: lead.displayName,
    firstName: lead.firstName ?? "",
    lastName: lead.lastName ?? "",
    honorificTitle: lead.honorificTitle ?? "",
    primaryMobile: lead.primaryMobile ?? "",
    email: lead.email ?? "",
    companyName: lead.companyName ?? "",
    acquisitionSourceId: lead.acquisitionSourceId ?? "",
    description: lead.description ?? "",
    interestSummary: lead.interestSummary ?? "",
    expectedNeed: lead.expectedNeed ?? "",
  };
}

export interface LeadEditAmbiguity {
  attempt: CrmWriteAttempt;
  error: NormalizedApiError;
  replay: () => Promise<void>;
}

/**
 * The `PATCH /leads/:id` drawer state — MASTER-PLAN 8.3.
 *
 * The baseline is the record the server last returned, which is what makes the
 * PATCH a real patch: only changed keys are sent, so a field another user
 * edited between load and save is left alone rather than overwritten with a
 * stale value.
 *
 * There is no `If-Match` here, and that is verified rather than assumed:
 * `grep -rn 'If-Match\|ETag' crm-app/src` is empty. CRM has no optimistic
 * concurrency headers at all, so a 409 from this route is a domain conflict —
 * a converted lead, a name collision — and never a version mismatch.
 */
export function useLeadEdit(lead: LeadDetail | null, onSaved: (lead: LeadDetail) => void) {
  const baseline = useMemo(() => (lead ? toForm(lead) : null), [lead]);
  const [form, setForm] = useState<LeadEditForm | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [ambiguity, setAmbiguity] = useState<LeadEditAmbiguity | null>(null);

  const open = form !== null;
  const isDirty = useMemo(() => {
    if (!form || !baseline) return false;
    return (Object.keys(form) as Array<keyof LeadEditForm>).some(
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
    <K extends keyof LeadEditForm>(key: K, value: LeadEditForm[K]) => {
      setForm((current) => (current ? { ...current, [key]: value } : current));
    },
    [],
  );

  const revert = useCallback(() => {
    if (baseline) setForm({ ...baseline });
    setError(null);
  }, [baseline]);

  const submit = useCallback(async () => {
    if (!lead || !form || !baseline || isSubmitting) return;
    const body = buildUpdateLeadRequest(form, baseline);
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
          path: leadPath(lead.id),
          body,
          parse: parseLeadDetailResponse,
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
  }, [baseline, closeDrawer, form, isSubmitting, lead, onSaved]);

  return {
    open,
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
