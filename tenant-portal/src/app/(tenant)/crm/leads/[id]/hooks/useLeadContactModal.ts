"use client";

import { useEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { readCoreData, writeCoreData } from "@/lib/api/envelope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import { createWriteAttempt, isAmbiguousWriteFailure, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { leadPath, parseLeadDetailResponse, type LeadContact, type LeadDetail } from "../../lead-contract";
import { fetchLeadDetail } from "../../lead-requests";
import { CONTACT_DIRECTORY_PERMISSIONS, CONTACT_MODAL_LIMITS, ContactWriteResponseError, buildAddedContactLeadRequest, buildContactCoreWrites, buildSelectedContactLeadRequest, contactModalForm, contactPersonPath, emptyNewLeadContact, parseContactPerson, validateContactModal, validateContactWriteResponse, validateNewLeadContact, type ContactModalField, type ContactModalForm, type ContactPerson, type NewLeadContactDraft } from "../contact-modal-contract";
import type { UpdateLeadRequest } from "../../lead-write-contract";

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
  const [addingContact, setAddingContact] = useState(false);
  const [newContact, setNewContact] = useState(emptyNewLeadContact);
  const [newContactErrors, setNewContactErrors] = useState<Record<string, string>>({});
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<NormalizedApiError | null>(null);
  const [actionMustReload, setActionMustReload] = useState(false);
  const activeRead = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const canEditIdentity = hasDirectoryGrants && person !== null && !loading && !mustReload;
  const isDirty = form !== null && JSON.stringify(form) !== JSON.stringify(baseline);
  useEffect(() => () => activeRead.current?.abort(), []);

  const readPerson = async (partyId: string, signal: AbortSignal) => parseContactPerson(await readCoreData(contactPersonPath(partyId), { signal, cache: "no-store", maxResponseBytes: 512 * 1024 }), partyId);
  const readLead = async (signal?: AbortSignal) => (await fetchLeadDetail(lead.id, signal)).lead;
  const applyForm = (contact: LeadContact, loaded: ContactPerson | null) => {
    const next = contactModalForm(contact, loaded);
    setBaseline(next);
    setPerson(loaded);
    setForm(next);
    setError(null); setErrors({}); setFailure(null); setMustReload(false);
  };
  const openContact = async (contact: LeadContact) => {
    if (!canUpdate || inFlight.current || addingContact || actionMustReload || lead.status === "CONVERTED") return;
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

  const canAct = canUpdate && lead.leadProfileType === "CORPORATE" && lead.status !== "CONVERTED" && !form && !actionMustReload;
  const startAddingContact = () => {
    if (!canAct || inFlight.current) return;
    setNewContact({ ...emptyNewLeadContact(), isPrimary: lead.contacts.length === 0 });
    setNewContactErrors({}); setActionError(null); setAddingContact(true);
  };
  const clearNewContact = () => {
    setAddingContact(false); setNewContact(emptyNewLeadContact()); setNewContactErrors({});
  };
  const cancelAddingContact = () => {
    if (inFlight.current) return;
    clearNewContact();
  };
  const changeNewContact = (update: (current: NewLeadContactDraft) => NewLeadContactDraft) => {
    if (!canAct || inFlight.current || !addingContact) return;
    setNewContact(update); setNewContactErrors({}); setActionError(null);
  };
  const writeContacts = async (build: (fresh: LeadDetail) => UpdateLeadRequest) => {
    if (!canAct || inFlight.current) return;
    inFlight.current = true;
    setActionBusy(true); setActionError(null);
    let writing = false;
    try {
      const fresh = await readLead();
      if (fresh.status === "CONVERTED" || fresh.leadProfileType !== "CORPORATE") {
        onSaved(fresh);
        clearNewContact();
        return;
      }
      const body = build(fresh);
      if (!Object.keys(body).length) { onSaved(fresh); return; }
      writing = true;
      const outcome = await runIdempotentWrite({ attempt: createWriteAttempt(), method: "patch", path: leadPath(lead.id), body: { ...body, expectedUpdatedAt: fresh.updatedAt }, parse: parseLeadDetailResponse });
      if (outcome.kind === "success") {
        onSaved(outcome.value);
        clearNewContact();
      } else {
        setActionError(outcome.error);
        if (outcome.kind === "ambiguous" || outcome.kind === "applied_unreadable") {
          setActionMustReload(true);
          clearNewContact();
          onReconcile();
        }
      }
    } catch (caught) {
      setActionError(normalizeApiError(caught));
      if (writing && isAmbiguousWriteFailure(caught)) {
        setActionMustReload(true); clearNewContact(); onReconcile();
      }
    }
    finally { inFlight.current = false; setActionBusy(false); }
  };
  const setPrimaryContact = async (target: LeadContact) => {
    if (addingContact || target.isPrimary) return;
    await writeContacts((fresh) => {
      const selected = fresh.contacts.find((contact) => contact.partyId === target.partyId);
      if (!selected) throw new Error("Contact no longer belongs to this lead.");
      const before = contactModalForm(selected);
      return buildSelectedContactLeadRequest(fresh, { ...before, isPrimary: true }, before);
    });
  };
  const saveNewContact = async () => {
    if (!canAct || inFlight.current || !addingContact) return;
    const fieldErrors = validateNewLeadContact(newContact, { ...t.crmLeads.create.errors, url: t.crmShared.fieldUrl, invalid: t.crmShared.errorValidation });
    setNewContactErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    await writeContacts((fresh) => buildAddedContactLeadRequest(fresh, newContact));
  };
  const reloadContacts = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setActionBusy(true);
    try {
      onSaved(await readLead());
      setActionError(null); setActionMustReload(false);
    } catch (caught) { setActionError(normalizeApiError(caught)); }
    finally { inFlight.current = false; setActionBusy(false); }
  };

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
        const fresh = await readLead();
        crmBody = buildSelectedContactLeadRequest(fresh, form, baseline);
        stage = "write";
        const outcome = await runIdempotentWrite({ attempt: createWriteAttempt(), method: "patch", path: leadPath(lead.id), body: { ...crmBody, expectedUpdatedAt: fresh.updatedAt }, parse: parseLeadDetailResponse });
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
  return { open: form !== null, form, loading, saving, errors, error, failure, mustReload, canEditIdentity, isDirty, openContact, close, reload, save, setField, setPhone, addPhone, removePhone,
    addingContact, newContact, newContactErrors, actionBusy, actionError, actionMustReload, startAddingContact, cancelAddingContact, changeNewContact, setPrimaryContact, saveNewContact, reloadContacts };
}

export type LeadContactModal = ReturnType<typeof useLeadContactModal>;
