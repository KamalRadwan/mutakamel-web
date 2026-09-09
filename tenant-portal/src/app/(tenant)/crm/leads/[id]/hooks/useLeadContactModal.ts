"use client";

import { useEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { readCoreData, readCrmBody, writeCoreData } from "@/lib/api/envelope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import { createCrmWriteAttempt, isAmbiguousWriteFailure, runCrmWrite } from "../../../shared/crm-write";
import { leadPath, parseLeadDetailResponse, type LeadContact, type LeadDetail } from "../../lead-contract";
import { CONTACT_DIRECTORY_PERMISSIONS, CONTACT_MODAL_LIMITS, ContactWriteResponseError, buildContactCoreWrites, buildSelectedContactLeadRequest, contactModalForm, contactPersonPath, parseContactPerson, validateContactModal, validateContactWriteResponse, type ContactModalField, type ContactModalForm, type ContactPerson } from "../contact-modal-contract";

export function useLeadContactModal(lead: LeadDetail, onSaved: (lead: LeadDetail) => void, onReconcile: () => void, canUpdate: boolean) {
  const { user } = useTenantAuth();
  const { t } = useI18n();
  const hasDirectoryGrants = CONTACT_DIRECTORY_PERMISSIONS.every((permission) => user?.permissions.includes(permission));
  const [form, setForm] = useState<ContactModalForm | null>(null);
  const [person, setPerson] = useState<ContactPerson | null>(null);
  const [baseline, setBaseline] = useState<ContactModalForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [failure, setFailure] = useState<"failed" | "partial" | "uncertain" | "refresh" | null>(null);
  const [mustReload, setMustReload] = useState(false);
  const activeRead = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const canEditIdentity = hasDirectoryGrants && person !== null && !loading && !mustReload;
  const isDirty = form !== null && JSON.stringify(form) !== JSON.stringify(baseline);
  useEffect(() => () => activeRead.current?.abort(), []);

  const readPerson = async (partyId: string, signal: AbortSignal) => parseContactPerson(await readCoreData(contactPersonPath(partyId), { signal, cache: "no-store", maxResponseBytes: 512 * 1024 }), partyId);
  const readLead = async (signal?: AbortSignal) => parseLeadDetailResponse(await readCrmBody(`/api/tenant/crm/v1/leads/${encodeURIComponent(lead.id)}`, { signal, cache: "no-store", maxResponseBytes: 512 * 1024 }));
  const applyForm = (contact: LeadContact, loaded: ContactPerson | null) => {
    const next = contactModalForm(contact, loaded);
    setBaseline(next);
    setPerson(loaded);
    setForm(next);
    setError(null); setErrors({}); setFailure(null); setMustReload(false);
  };
  const openContact = async (contact: LeadContact) => {
    if (!canUpdate || inFlight.current || lead.status === "CONVERTED") return;
    activeRead.current?.abort();
    const controller = new AbortController();
    activeRead.current = controller;
    applyForm(contact, null);
    setLoading(hasDirectoryGrants);
    if (!hasDirectoryGrants) return;
    try {
      const loaded = await readPerson(contact.partyId, controller.signal);
      if (!controller.signal.aborted) applyForm(contact, loaded);
    } catch (caught) {
      if (!controller.signal.aborted) { setError(normalizeApiError(caught)); setFailure("refresh"); setMustReload(true); }
    } finally { if (!controller.signal.aborted) setLoading(false); }
  };
  const close = () => {
    if (inFlight.current) return;
    activeRead.current?.abort();
    setLoading(false); setForm(null); setPerson(null); setBaseline(null);
    setError(null); setErrors({}); setFailure(null); setMustReload(false);
  };
  const reload = async () => {
    if (!form || inFlight.current) return;
    activeRead.current?.abort();
    const controller = new AbortController();
    activeRead.current = controller;
    setLoading(true);
    try {
      const [freshLead, freshPerson] = await Promise.all([readLead(controller.signal), hasDirectoryGrants ? readPerson(form.partyId, controller.signal) : Promise.resolve(null)]);
      if (controller.signal.aborted) return;
      const selected = freshLead.contacts.find((contact) => contact.partyId === form.partyId);
      if (!selected) throw new Error("Contact no longer belongs to this lead.");
      onSaved(freshLead);
      applyForm(selected, freshPerson);
    } catch (caught) {
      if (!controller.signal.aborted) { setError(normalizeApiError(caught)); setFailure("refresh"); setMustReload(true); }
    } finally { if (!controller.signal.aborted) setLoading(false); }
  };
  const change = (update: (current: ContactModalForm) => ContactModalForm) => {
    if (!canUpdate || inFlight.current || loading || mustReload) return;
    setForm((current) => current ? update(current) : null);
    setErrors({}); setError(null); setFailure(null);
  };
  const setField = <K extends ContactModalField>(field: K, value: ContactModalForm[K]) => {
    if (field !== "jobTitle" && field !== "isPrimary" && !canEditIdentity) return;
    change((current) => ({ ...current, [field]: value }));
  };
  const setPhone = (index: number, value: string) => { if (canEditIdentity) change((current) => ({ ...current, phones: current.phones.map((phone, i) => i === index ? { ...phone, value } : phone) })); };
  const addPhone = () => { if (canEditIdentity) change((current) => current.phones.length < CONTACT_MODAL_LIMITS.methods ? { ...current, phones: [...current.phones, { id: null, methodType: "MOBILE", value: "", isPrimary: false }] } : current); };
  const removePhone = (index: number) => { if (canEditIdentity) change((current) => ({ ...current, phones: current.phones.filter((_, i) => i !== index) })); };

  const save = async () => {
    if (!canUpdate || !form || !baseline || loading || mustReload || inFlight.current || lead.status === "CONVERTED") return;
    const fieldErrors = validateContactModal(form, canEditIdentity, { ...t.crmLeads.create.errors, url: t.crmShared.fieldUrl, invalid: t.crmShared.errorValidation });
    if (baseline.isPrimary && !form.isPrimary) fieldErrors.isPrimary = t.crmShared.errorValidation;
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    let coreWrites;
    let crmBody;
    try {
      coreWrites = buildContactCoreWrites(form, person);
      if (coreWrites.length && !canEditIdentity) { setError({ status: 403 }); setFailure("failed"); return; }
      crmBody = buildSelectedContactLeadRequest(lead, form, baseline);
    } catch (caught) { setError(normalizeApiError(caught)); setFailure("failed"); return; }
    if (!coreWrites.length && !Object.keys(crmBody).length) { close(); return; }
    inFlight.current = true;
    setSaving(true); setError(null); setFailure(null);
    let completed = 0;
    let stage: "write" | "read" | "preflight" = "write";
    try {
      for (const operation of coreWrites) {
        const receipt = await writeCoreData(operation.method, operation.path, operation.body, { nonReplayable: operation.method === "post", headers: { "x-idempotency-key": generateUUIDv7() }, maxResponseBytes: 512 * 1024 });
        completed++;
        validateContactWriteResponse(operation, receipt, form.partyId);
      }
      if (Object.keys(crmBody).length) {
        // The CRM endpoint replaces the complete list. Read it after Core
        // writes so this selected-person save preserves other current people.
        stage = "preflight";
        crmBody = buildSelectedContactLeadRequest(await readLead(), form, baseline);
        stage = "write";
        const outcome = await runCrmWrite({ attempt: createCrmWriteAttempt(), method: "patch", path: leadPath(lead.id), body: crmBody, parse: parseLeadDetailResponse });
        if (outcome.kind !== "success") {
          const uncertain = outcome.kind === "ambiguous" || outcome.kind === "applied_unreadable";
          setError(outcome.error); setFailure(uncertain ? "uncertain" : completed ? "partial" : "failed");
          setMustReload(uncertain || completed > 0);
          if (uncertain || completed) onReconcile();
          return;
        }
        completed++;
      }
      stage = "read";
      const fresh = await readLead();
      onSaved(fresh);
      setForm(null); setPerson(null); setBaseline(null);
    } catch (caught) {
      const uncertain = stage === "write" && (caught instanceof ContactWriteResponseError || isAmbiguousWriteFailure(caught));
      setError(normalizeApiError(caught));
      setFailure(stage === "read" ? "refresh" : uncertain ? "uncertain" : completed ? "partial" : stage === "preflight" ? "refresh" : "failed");
      const block = stage !== "write" || uncertain || completed > 0;
      setMustReload(block);
      if (block) onReconcile();
    } finally { inFlight.current = false; setSaving(false); }
  };
  return { open: form !== null, form, loading, saving, errors, error, failure, mustReload, canEditIdentity, isDirty, openContact, close, reload, save, setField, setPhone, addPhone, removePhone };
}

export type LeadContactModal = ReturnType<typeof useLeadContactModal>;
