"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { buildCreateNodeRequest, buildUpdateNodeRequest, parseBranchIdsPreview, type InventoryNodeDetail, type NodeFormValues } from "../../inventory-contract";
import { inventoryFormMessage } from "../../inventory-messages";

export function useNodeForm(initial: NodeFormValues, onSubmit: (values: NodeFormValues) => Promise<boolean>, original?: InventoryNodeDetail) {
  const { t } = useI18n();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof NodeFormValues, string>>>({});
  const [validationAttempt, setValidationAttempt] = useState(0);
  useEffect(() => { if (validationAttempt > 0) document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]')?.focus(); }, [validationAttempt]);
  const patch = (next: Partial<NodeFormValues>) => {
    setValues((current) => ({ ...current, ...next })); setError(null);
    setFieldErrors((current) => { const remaining = { ...current }; for (const key of Object.keys(next) as (keyof NodeFormValues)[]) delete remaining[key]; return remaining; });
  };
  const submit = async (confirmed = false) => {
    setError(null);
    const invalid: typeof fieldErrors = {};
    if (!original && !/^[A-Z0-9][A-Z0-9._-]{0,79}$/u.test(values.code.trim().toUpperCase())) invalid.code = t.tradeInventory.nodeCodeInvalid;
    if (!values.name.trim() || values.name.trim().length > 160) invalid.name = t.tradeInventory.formNameInvalid;
    const branches = parseBranchIdsPreview(values.branchIds);
    if (!branches.validIds.length || branches.validIds.length > 100 || branches.invalidEntries.length) invalid.branchIds = t.tradeInventory.formBranchesInvalid;
    try { if (!values.timezone.trim() || values.timezone.trim().length > 64) throw new RangeError(); new Intl.DateTimeFormat("en", { timeZone: values.timezone.trim() }); }
    catch { invalid.timezone = t.tradeInventory.formTimezoneInvalid; }
    setFieldErrors(invalid);
    if (Object.keys(invalid).length) { setError(Object.values(invalid)[0] ?? null); setValidationAttempt((current) => current + 1); return; }
    try {
      if (original) buildUpdateNodeRequest(original, values); else buildCreateNodeRequest(values);
      new Intl.DateTimeFormat("en", { timeZone: values.timezone.trim() });
    } catch (failure) {
      setError(failure instanceof RangeError ? t.tradeInventory.formTimezoneInvalid : inventoryFormMessage(failure, t));
      return;
    }
    if (original?.status === "ACTIVE" && values.status === "INACTIVE" && !confirmed) { setReviewOpen(true); return; }
    if (await onSubmit(values)) { setValues(initial); setReviewOpen(false); }
  };
  return { values, patch, error, fieldErrors, submit, reviewOpen, closeReview: () => setReviewOpen(false),
    reset: () => { setValues(initial); setError(null); setFieldErrors({}); }, isDirty: JSON.stringify(values) !== JSON.stringify(initial) };
}
