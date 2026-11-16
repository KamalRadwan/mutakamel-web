"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { createWriteAttempt, runIdempotentWrite, type AppliedUnreadable, type WriteAttempt } from "@/lib/api/idempotent-write";
import { useCrmFieldMessages } from "../../../shared/hooks/useCrmFieldMessages";
import type { CrmFormErrors } from "../../../shared/hooks/useCrmCreateForm";
import { opportunityPath, parseOpportunityDetailResponse, type OpportunityDetail } from "../../opportunity-contract";
import { validateUpdateOpportunity } from "../../opportunity-create-validation";
import { OPPORTUNITY_NOTHING_TO_SEND, buildUpdateOpportunityRequest, toOpportunityForm, type OpportunityForm } from "../../opportunity-write-contract";
import { useOpportunityEditCustomFields } from "./useOpportunityEditCustomFields";

export interface OpportunityEditAmbiguity { attempt: WriteAttempt; error: NormalizedApiError; replay: () => Promise<void> }
interface Snapshot { baseline: OpportunityForm; form: OpportunityForm }
function changed(snapshot: Snapshot | null): boolean {
  if (!snapshot) return false;
  return Object.entries(snapshot.form).some(([key, value]) => {
    const original = snapshot.baseline[key as keyof OpportunityForm];
    return typeof value === "string" && typeof original === "string"
      ? value.trim() !== original.trim() : JSON.stringify(value) !== JSON.stringify(original);
  });
}

/** Ordinary fields share one captured snapshot; lifecycle and record commands remain separate. */
export function useOpportunityEdit(item: OpportunityDetail | null, onReconcile: () => void, options: { continuous?: boolean } = {}) {
  const { t } = useI18n();
  const fieldMessages = useCrmFieldMessages();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [ambiguity, setAmbiguity] = useState<OpportunityEditAmbiguity | null>(null);
  const [appliedUnreadable, setAppliedUnreadable] = useState<AppliedUnreadable | null>(null);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [revealed, setRevealed] = useState(false);
  const sending = useRef(false);
  const hydratedItem = useRef<OpportunityDetail | null>(null);
  const isDirty = changed(snapshot);
  const custom = useOpportunityEditCustomFields(item?.branchId, item?.id, options.continuous === true || snapshot !== null);
  const form = snapshot?.form ?? null;

  useEffect(() => {
    if (!options.continuous || !item || isSubmitting || ambiguity || appliedUnreadable || hydratedItem.current === item) return;
    hydratedItem.current = item;
    queueMicrotask(() => setSnapshot((current) => {
      if (changed(current)) return current;
      if (current?.baseline.expectedUpdatedAt === item.updatedAt) return current;
      const next = { ...toOpportunityForm(item), customFields: custom.values };
      return { baseline: next, form: next };
    }));
  }, [item, options.continuous, isSubmitting, ambiguity, appliedUnreadable, custom.values]);

  useEffect(() => {
    queueMicrotask(() => setSnapshot((current) => {
      if (!current || JSON.stringify(current.form.customFields) !== JSON.stringify(current.baseline.customFields)) return current;
      return { baseline: { ...current.baseline, customFields: custom.values }, form: { ...current.form, customFields: custom.values } };
    }));
  }, [custom.values]);

  const requiredFieldKeys = useMemo(() => custom.definitions.filter((field) => field.requirements.some((requirement) =>
    requirement.isRequired && requirement.operation === "UPDATE" && (requirement.entityScope === null || requirement.entityScope === "OPPORTUNITY"),
  )).map((field) => field.fieldKey), [custom.definitions]);
  const allErrors = useMemo(() => form ? validateUpdateOpportunity(form, {
    ...fieldMessages, amountInvalid: t.crmShared.refusals.CRM_AMOUNT_SCALE_INVALID,
    outOfRange: t.crmOpportunityDetail.create.outOfRange, currencyLength: t.crmOpportunityDetail.create.currencyLength,
  }, requiredFieldKeys) : {}, [form, fieldMessages, t, requiredFieldKeys]);
  const errors: CrmFormErrors = revealed ? allErrors : Object.fromEntries(Object.entries(allErrors).filter(([key]) => touched.has(key)));
  const locked = isSubmitting || ambiguity !== null || appliedUnreadable !== null;
  const setField = useCallback(<K extends keyof OpportunityForm>(key: K, value: OpportunityForm[K]) => {
    if (sending.current || ambiguity || appliedUnreadable) return;
    if (key === "customFields" && (custom.loading || custom.error)) return;
    setSnapshot((current) => current ? { ...current, form: { ...current.form, [key]: value } } : current);
  }, [ambiguity, appliedUnreadable, custom.loading, custom.error]);
  const revert = useCallback(() => {
    if (locked) return;
    setSnapshot((current) => current ? { ...current, form: { ...current.baseline } } : current);
    setError(null); setRevealed(false); setTouched(new Set());
  }, [locked]);
  const openDrawer = useCallback(() => {
    if (!item || locked) return;
    const next = { ...toOpportunityForm(item), customFields: custom.values };
    setSnapshot({ baseline: next, form: next });
    setError(null); setRevealed(false); setTouched(new Set());
  }, [item, locked, custom.values]);
  const closeDrawer = useCallback(() => { if (!locked) { setSnapshot(null); setError(null); } }, [locked]);

  // PATCH is not Gateway-idempotent: an uncertain request is read back, never resent.
  const readLatest = useCallback(async (preserveDraft: boolean) => {
    if (!item || sending.current) return;
    sending.current = true; setIsSubmitting(true);
    try {
      const response = await axiosClient.get<unknown>(opportunityPath(item.id), { cache: "no-store", maxResponseBytes: 512 * 1024 });
      const latest = parseOpportunityDetailResponse(response.data);
      if (latest.id !== item.id) throw new Error("Opportunity reconciliation identity changed");
      if (!preserveDraft) setSnapshot(() => {
        const next = { ...toOpportunityForm(latest), customFields: custom.values };
        return { baseline: next, form: next };
      });
      setError(null); setAmbiguity(null); setAppliedUnreadable(null);
      custom.reload(); onReconcile();
    } catch (caught) { setError(normalizeApiError(caught)); }
    finally { sending.current = false; setIsSubmitting(false); }
  }, [item, custom, onReconcile]);
  const reconcile = useCallback(() => readLatest(ambiguity !== null), [readLatest, ambiguity]);

  const submit = useCallback(async () => {
    if (!item || !snapshot || sending.current || ambiguity || appliedUnreadable) return;
    setRevealed(true);
    if (Object.keys(allErrors).length > 0) return;
    let body;
    try { body = buildUpdateOpportunityRequest(snapshot.form, snapshot.baseline); }
    catch (caught) { setError({ status: 422, code: caught instanceof Error ? caught.message : undefined }); return; }
    if (Object.keys(body).length === 0) {
      if (isDirty) setError({ status: 422, code: OPPORTUNITY_NOTHING_TO_SEND });
      else if (!options.continuous) closeDrawer();
      return;
    }
    const attempt = createWriteAttempt();
    const send = async (): Promise<void> => {
      if (sending.current) return;
      sending.current = true; setIsSubmitting(true); setError(null);
      try {
        const outcome = await runIdempotentWrite({ attempt, method: "patch", path: opportunityPath(item.id), body, parse: parseOpportunityDetailResponse, config: { maxResponseBytes: 512 * 1024, nonReplayable: true } });
        if (outcome.kind === "success") {
          setAmbiguity(null);
          const next = { ...snapshot.form, expectedUpdatedAt: outcome.value.updatedAt };
          setSnapshot(options.continuous ? { baseline: next, form: next } : null);
          setRevealed(false); setTouched(new Set()); custom.reload(); onReconcile();
        } else if (outcome.kind === "ambiguous") setAmbiguity({ attempt, error: outcome.error, replay: () => readLatest(true) });
        else if (outcome.kind === "applied_unreadable") {
          setAmbiguity(null); setAppliedUnreadable({ attempt, error: outcome.error }); onReconcile();
        } else { setAmbiguity(null); setError(outcome.error); }
      } finally { sending.current = false; setIsSubmitting(false); }
    };
    await send();
  }, [item, snapshot, ambiguity, appliedUnreadable, allErrors, isDirty, options.continuous, closeDrawer, custom, onReconcile, readLatest]);
  return {
    open: form !== null, form, isDirty, isSubmitting, locked, error, errors, allErrors, requiredFieldKeys,
    definitions: custom.definitions, customFieldsLoading: custom.loading, customFieldsError: custom.error, retryCustomFields: custom.reload,
    setCustomField: (key: string, value: unknown) => {
      if (!form || !custom.definitions.some((field) => field.fieldKey === key)) return;
      setField("customFields", { ...form.customFields, [key]: value === "" ? null : value });
    },
    touch: (path: string) => setTouched((current) => new Set(current).add(path)),
    ambiguity, appliedUnreadable, dismissAmbiguity: reconcile, dismissAppliedUnreadable: reconcile, reconcile,
    stale: Boolean(item && snapshot?.baseline.expectedUpdatedAt && item.updatedAt !== snapshot.baseline.expectedUpdatedAt),
    openDrawer, closeDrawer, setField, revert, submit,
  };
}
