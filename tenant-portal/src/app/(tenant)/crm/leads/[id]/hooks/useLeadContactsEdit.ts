"use client";

import { useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { leadPath, parseLeadDetailResponse, type LeadDetail } from "../../lead-contract";
import {
  buildLeadContactsRequest,
  LEAD_CONTACT_EDIT_LIMITS,
  toLeadContactsForm,
  validateLeadContactsForm,
  type LeadContactPersonField,
  type LeadContactsForm,
} from "../lead-contacts-edit-contract";

export function useLeadContactsEdit(
  lead: LeadDetail,
  onSaved: (lead: LeadDetail) => void,
  onReconcile: () => void,
  canEdit: boolean,
) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState<LeadContactsForm | null>(null);
  const [baseline, setBaseline] = useState<LeadContactsForm | null>(null);
  const [editLead, setEditLead] = useState(lead);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [reconciliation, setReconciliation] = useState({ lead, pending: false });
  const inFlight = useRef(false);
  if (reconciliation.lead !== lead) setReconciliation({ lead, pending: false });

  const clearError = () => { setError(null); setErrors({}); };
  const startEdit = () => {
    if (!canEdit || reconciliation.pending || inFlight.current || (lead.leadProfileType === "CORPORATE" && lead.contacts.length === 0)) return;
    setBaseline(toLeadContactsForm(lead));
    setEditLead(lead);
    setForm(toLeadContactsForm(lead));
    clearError();
  };
  const cancel = () => {
    if (inFlight.current) return;
    setForm(null);
    setBaseline(null);
    clearError();
  };
  const change = (update: (current: LeadContactsForm) => LeadContactsForm) => {
    if (!canEdit || inFlight.current) return;
    setForm((current) => current ? update(current) : null);
    clearError();
  };
  const setField = (field: LeadContactPersonField, value: string) => change((current) => ({ ...current, [field]: value }));
  const setPhone = (index: number, value: string) => change((current) => ({ ...current, phones: current.phones.map((phone, i) => i === index ? value : phone) }));
  const addPhone = () => change((current) => current.phones.length < LEAD_CONTACT_EDIT_LIMITS.phones ? { ...current, phones: [...current.phones, ""] } : current);
  const removePhone = (index: number) => change((current) => ({ ...current, phones: current.phones.length === 1 ? [""] : current.phones.filter((_, i) => i !== index) }));
  const setJobTitle = (partyId: string, value: string) => change((current) => ({ ...current, contacts: current.contacts.map((contact) => contact.partyId === partyId ? { ...contact, jobTitle: value } : contact) }));
  const setPrimary = (partyId: string) => change((current) => current.contacts.some((contact) => contact.partyId === partyId) ? { ...current, contacts: current.contacts.map((contact) => ({ ...contact, isPrimary: contact.partyId === partyId })) } : current);

  const save = async () => {
    if (!canEdit || !form || !baseline || inFlight.current) return;
    const fieldErrors = validateLeadContactsForm(lead, form, {
      ...t.crmLeads.create.errors,
      url: t.crmShared.fieldUrl,
      invalid: t.crmShared.errorValidation,
      conflict: t.crmShared.errorConflict,
    });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;
    const body = buildLeadContactsRequest(editLead, form, baseline);
    if (Object.keys(body).length === 0) { cancel(); return; }
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const outcome = await runIdempotentWrite({ attempt: createWriteAttempt(), method: "patch", path: leadPath(lead.id), body: { ...body, expectedUpdatedAt: editLead.updatedAt }, parse: parseLeadDetailResponse });
      if (outcome.kind === "success") {
        onSaved(outcome.value);
        setForm(null);
        setBaseline(null);
      } else {
        setError(outcome.error);
        const conflict = outcome.error.code === "CRM.LEAD.CONCURRENT_UPDATE" || outcome.error.status === 409;
        // The discarded form and the reload both remove the inline error.
        if (conflict) toast.warning(t.crmShared.refusals["CRM.LEAD.CONCURRENT_UPDATE"], undefined, 0, { label: t.crmLeadDetail.reloadLead, onClick: onReconcile });
        if (outcome.kind === "ambiguous" || outcome.kind === "applied_unreadable" || conflict) {
          setForm(null);
          setBaseline(null);
          setReconciliation((current) => ({ ...current, pending: true }));
          onReconcile();
        }
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  const isDirty = Boolean(form && baseline && Object.keys(buildLeadContactsRequest(lead, form, baseline)).length > 0);
  return { form, isDirty, errors, saving, error, startEdit, cancel, save, clearError, setField, setPhone, addPhone, removePhone, setJobTitle, setPrimary };
}

export type LeadContactsEdit = ReturnType<typeof useLeadContactsEdit>;
