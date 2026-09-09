"use client";

import { useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { formatTemplate } from "@/lib/format/template";
import { createCrmWriteAttempt, runCrmWrite } from "../../../shared/crm-write";
import { leadPath, parseLeadDetailResponse, type LeadDetail } from "../../lead-contract";
import { LEAD_CREATE_LIMITS } from "../../lead-create-contract";
import { buildLeadDetailsRequest, toLeadDetailsForm, type LeadDetailsForm } from "../lead-details-edit-contract";

export function useLeadDetailsEdit(lead: LeadDetail, canEdit: boolean, onSaved: (lead: LeadDetail) => void, onReconcile: () => void, allowedOwnerIds: string[] | null) {
  const { user } = useTenantAuth();
  const { t } = useI18n();
  const [draft, setDraft] = useState<{ lead: LeadDetail; form: LeadDetailsForm; baseline: LeadDetailsForm } | null>(null);
  const [reconciliation, setReconciliation] = useState({ lead, pending: false });
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof LeadDetailsForm, string>>>({});
  const inFlight = useRef(false);
  // A refresh during a pending write must not unlock a later uncertain result.
  if (reconciliation.lead !== lead) setReconciliation({ lead, pending: false });
  const editable = canEdit && lead.status !== "CONVERTED" && !reconciliation.pending;
  // Clean fields follow fresh server props; only actual edits pin a baseline.
  const activeDraft = draft?.lead.id === lead.id && hasChanges(draft.form, draft.baseline) ? draft : null;
  const baseline = activeDraft?.baseline ?? toLeadDetailsForm(lead);
  const currentUserId = user && (allowedOwnerIds === null || allowedOwnerIds.includes(user.id)) ? user.id : "";
  const form = editable ? activeDraft?.form ?? { ...baseline, ownerUserId: baseline.ownerUserId || currentUserId } : null;
  const isDirty = form !== null && hasChanges(form, baseline);
  const cancel = () => {
    if (inFlight.current) return;
    setDraft(null);
    setError(null);
    setErrors({});
  };
  const change = (field: keyof LeadDetailsForm, value: string) => {
    if (!form || inFlight.current) return;
    setDraft((current) => {
      const previous = current?.lead.id === lead.id && (current.lead === lead || hasChanges(current.form, current.baseline)) ? current : null;
      return { lead, baseline: previous?.baseline ?? baseline, form: { ...(previous?.form ?? form), [field]: value } };
    });
    setError(null);
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const validate = (field: "interestSummary" | "expectedNeed" | "description") => {
    if (!form) return;
    setErrors((current) => ({ ...current, [field]: form[field].length > LEAD_CREATE_LIMITS[field] ? formatTemplate(t.crmLeads.create.errors.maxLength, { max: LEAD_CREATE_LIMITS[field] }) : undefined }));
  };
  const save = async () => {
    if (!editable || !form || inFlight.current) return;
    const invalidFields = (["interestSummary", "expectedNeed", "description"] as const).filter((field) => form[field].length > LEAD_CREATE_LIMITS[field]);
    if (invalidFields.length) { setErrors(Object.fromEntries(invalidFields.map((field) => [field, formatTemplate(t.crmLeads.create.errors.maxLength, { max: LEAD_CREATE_LIMITS[field] })]))); return; }
    const body = buildLeadDetailsRequest(form, baseline);
    if (Object.keys(body).length === 0) { cancel(); return; }
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const outcome = await runCrmWrite({ attempt: createCrmWriteAttempt(), method: "patch", path: leadPath(lead.id), body, parse: parseLeadDetailResponse });
      if (outcome.kind === "success") {
        onSaved(outcome.value);
        setDraft(null);
      } else {
        setError(outcome.error);
        if (outcome.kind === "ambiguous" || outcome.kind === "applied_unreadable") {
          setDraft(null);
          setReconciliation((current) => ({ ...current, pending: true }));
          onReconcile();
        }
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  return { form, saving, error, errors, editable, isDirty, cancel, change, validate, save, clearError: () => setError(null) };
}

function hasChanges(form: LeadDetailsForm, baseline: LeadDetailsForm): boolean {
  return Object.entries(form).some(([field, value]) => value !== baseline[field as keyof LeadDetailsForm]);
}
