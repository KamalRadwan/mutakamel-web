"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import { createCrmWriteAttempt, runCrmWrite, type CrmWriteAttempt } from "../../../shared/crm-write";
import { crmCapabilityAllowsOwner, type CrmActionCapability } from "../../../shared/crm-capabilities";
import { useCrmCreateCustomFields } from "../../../shared/hooks/useCrmCreateCustomFields";
import { leadConvertPath, type LeadDetail } from "../../lead-contract";
import { buildConvertLeadRequest, initialLeadConversion, parseLeadConversionResponse, type ConvertLeadRequest, type LeadConversionForm, type LeadConversionResult } from "../lead-conversion-contract";
import { validateLeadConversion } from "../lead-conversion-validation";
import { useLeadConversionOptions } from "./useLeadConversionOptions";

type PendingConversion = { attempt: CrmWriteAttempt; body: ConvertLeadRequest; leadId: string };

/** One immutable body/key per attempt; only a definite refusal permits editing a new intent. */
export function useLeadConvert(lead: LeadDetail | null, onConverted: () => void, canConvert: boolean, opportunityCapability: CrmActionCapability | null) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LeadConversionForm | null>(null);
  const [baseline, setBaseline] = useState<LeadConversionForm | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingConversion | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [ambiguous, setAmbiguous] = useState<NormalizedApiError | null>(null);
  const [appliedUnreadable, setAppliedUnreadable] = useState<NormalizedApiError | null>(null);
  const [result, setResult] = useState<LeadConversionResult | null>(null);
  const options = useLeadConversionOptions(lead?.branchId ?? null, open && Boolean(form?.createOpportunity), opportunityCapability);
  const customFields = useCrmCreateCustomFields("OPPORTUNITY", open && Boolean(form?.createOpportunity));
  const selectedPipeline = options.pipelines.find(({ id }) => id === form?.pipelineId);
  const selectableStages = (selectedPipeline?.stages ?? []).filter(({ isActive, flag }) => isActive && flag !== "WON" && flag !== "LOST");
  const unresolved = Boolean(ambiguous || appliedUnreadable);
  const locked = isSubmitting || unresolved || Boolean(result);

  function openModal() {
    if (inFlight.current) return;
    if (unresolved || result) { setOpen(true); return; }
    if (!lead || !canConvert) return;
    const next = initialLeadConversion(lead);
    setForm(next); setBaseline(next); setPending(null);
    setErrors({}); setError(null); setReviewing(false); setOpen(true);
  }
  function closeModal() {
    if (inFlight.current) return;
    setOpen(false);
    // Closing the surface must never discard evidence or enable a fresh retry.
    if (unresolved || result) return;
    setForm(null); setBaseline(null); setPending(null);
    setError(null); setErrors({}); setReviewing(false);
  }
  function setField<K extends keyof LeadConversionForm>(key: K, value: LeadConversionForm[K]) {
    if (locked || key === "profileType") return;
    setForm((current) => current ? { ...current, [key]: value, ...(key === "pipelineId" ? { stageId: "" } : {}) } : current);
    setPending(null); setError(null); setReviewing(false); setErrors({});
  }
  function addMethod() {
    if (form && form.contactMethods.length < 20) setField("contactMethods", [...form.contactMethods, { rowId: generateUUIDv7(), methodType: "MOBILE", value: "", label: "" }]);
  }
  function validate() {
    if (!form || !lead) return false;
    const labels = { required: t.crmShared.fieldRequired, invalid: t.crmLeadConvert.invalidValue,
      email: t.crmShared.fieldEmail, amount: t.crmLeadConvert.amountInvalid, duplicate: t.crmLeadConvert.duplicateMethod };
    const next = Object.fromEntries(Object.entries(validateLeadConversion(form, customFields.requiredFieldKeys)).map(([key, issue]) => [key, labels[issue]]));
    if (form.profileType !== lead.leadProfileType) next.profileType = t.crmLeadConvert.profileTypeFixed;
    if (form.createOpportunity) {
      if (!opportunityCapability) next.createOpportunity = t.crmLeadConvert.opportunityNotPermitted;
      if (options.loading || options.pipelinesFailed || !selectedPipeline) next.pipelineId = t.crmLeadConvert.pipelinesFailed;
      if (!selectableStages.some(({ id }) => id === form.stageId)) next.stageId = t.crmLeadConvert.stageHint;
      if (customFields.loading) next.createOpportunity = t.crmLeadConvert.referencesLoading;
      const owner = form.ownerUserId || lead.ownerUserId || options.actorId;
      if (!crmCapabilityAllowsOwner(opportunityCapability, owner)) next.ownerUserId = t.crmLeadConvert.ownerInvalid;
      if (form.ownerUserId && !options.ownerOptions.some(({ id }) => id === form.ownerUserId)) next.ownerUserId = t.crmLeadConvert.ownerInvalid;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  async function submit(replay = false) {
    if (!lead || !form || inFlight.current || appliedUnreadable || result || !canConvert) return;
    if (ambiguous && !replay) return;
    if (!ambiguous && !validate()) { setReviewing(false); return; }
    if (!replay && !reviewing) { setReviewing(true); return; }
    const intent = pending ?? { attempt: createCrmWriteAttempt(), body: buildConvertLeadRequest(form), leadId: lead.id };
    if (intent.leadId !== lead.id) return;
    setPending(intent); inFlight.current = true; setIsSubmitting(true); setError(null);
    try {
      const outcome = await runCrmWrite({
        attempt: intent.attempt, method: "post", path: leadConvertPath(intent.leadId), body: intent.body,
        parse: (payload) => parseLeadConversionResponse(payload, intent.leadId, intent.body.createOpportunity === true),
        config: { maxResponseBytes: 512 * 1024 },
      });
      if (outcome.kind === "success") { setAmbiguous(null); setResult(outcome.value); onConverted(); }
      else if (outcome.kind === "ambiguous") setAmbiguous(outcome.error);
      else if (outcome.kind === "applied_unreadable") { setAmbiguous(null); setAppliedUnreadable(outcome.error); onConverted(); }
      else { setAmbiguous(null); setError(outcome.error); if (outcome.error.status === 409) onConverted(); }
    } finally { inFlight.current = false; setIsSubmitting(false); }
  }
  return {
    open, form, reviewing, errors, options, customFields, selectableStages, lead,
    canCreateOpportunity: Boolean(opportunityCapability), canConvert, isSubmitting, locked,
    isDirty: !result && !unresolved && JSON.stringify(form) !== JSON.stringify(baseline),
    error, ambiguous, appliedUnreadable, result, attempt: pending?.attempt,
    hasReceipt: unresolved || Boolean(result), openModal, closeModal, setField, addMethod, validate,
    back: () => { if (!locked) setReviewing(false); },
    submit: () => submit(), retry: () => submit(true), reconcile: onConverted,
  };
}
