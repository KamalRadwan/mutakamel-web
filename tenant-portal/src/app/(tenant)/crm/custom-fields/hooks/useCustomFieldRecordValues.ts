"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantAuth } from "@/context/AuthContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { useTenantBranchLabels } from "@/hooks/useTenantBranchLabels";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useCrmRecordOptions, type CrmRecordSourceType } from "@/hooks/useCrmRecordOptions";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { CustomFieldItem } from "../custom-field-contract";
import { isBlankFieldValue, validateCustomFieldValue } from "../custom-field-values-contract";
import { useCustomFieldOwnerAccess } from "./useCustomFieldOwnerAccess";
import { useCustomFieldValues } from "./useCustomFieldValues";

function sameValue(left: unknown, right: unknown) {
  return (isBlankFieldValue(left) && isBlankFieldValue(right)) || JSON.stringify(left) === JSON.stringify(right);
}

export function useCustomFieldRecordValues(definitions: CustomFieldItem[], canManage: boolean, reloadDefinitions?: () => Promise<unknown>) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const branch = useTenantBranchSelection(user);
  const branchLabels = useTenantBranchLabels(!!branch.branchId);
  const [ownerType, setOwnerType] = useState<CrmRecordSourceType>("LEAD");
  const [owner, setOwner] = useState<{ id: string; label?: string; branchId: string | null } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const records = useCrmRecordOptions(ownerType, branch.branchId);
  const values = useCustomFieldValues(branch.branchId);
  const ownerId = owner?.branchId === branch.branchId ? owner?.id : undefined;
  const selection = useMemo(() => ({ ownerType, ownerId, branchId: branch.branchId }), [ownerType, ownerId, branch.branchId]);
  const currentSelection = useRef<typeof selection | null>(null);
  useEffect(() => { currentSelection.current = selection; return () => { currentSelection.current = null; }; }, [selection]);
  const access = useCustomFieldOwnerAccess({ ownerType, branchId: branch.branchId, ownerId, enabled: canManage });
  const canEdit = canManage && access.canEdit && values.hasLoaded && !values.isLoading && !values.loadError;
  const applicable = useMemo(() => definitions.filter((field) => field.isActive &&
    (field.ownerType === ownerType || (field.ownerType === "LEAD_AND_PARTY" && ownerType === "LEAD"))), [definitions, ownerType]);
  const isDirty = Object.keys(drafts).length > 0;
  const guard = useUnsavedChangesGuard(isDirty);
  const savedValue = (id: string) => values.values.find((entry) => entry.fieldDefinitionId === id)?.value;
  const valueFor = (id: string) => id in drafts ? drafts[id] : savedValue(id);
  const isRequired = (field: CustomFieldItem) => field.requirements.some((rule) =>
    rule.operation === "UPDATE" && rule.isRequired && (rule.entityScope === null || rule.entityScope === ownerType));
  const validation = (field: CustomFieldItem) => validateCustomFieldValue(field, valueFor(field.id), ownerType);

  function discardDrafts() { setDrafts({}); setErrors({}); setNotice(null); }
  function clearRecord() { setOwner(null); discardDrafts(); values.reset(); }
  function leave(action: () => void) {
    if (values.isSaving) return;
    guard.requestDiscard(() => { discardDrafts(); action(); });
  }
  function selectOwner(next: string | undefined) {
    if (next === ownerId) return;
    leave(() => {
      setOwner(next ? { id: next, branchId: branch.branchId,
        label: records.options.find((entry) => entry.value === next)?.label } : null);
      if (next) void values.load(ownerType, next); else values.reset();
    });
  }
  function change(id: string, value: unknown) {
    if (!canEdit || values.isSaving) return;
    setDrafts((current) => {
      const next = { ...current };
      if (sameValue(value, savedValue(id))) delete next[id]; else next[id] = value;
      return next;
    });
    setErrors((current) => { const next = { ...current }; delete next[id]; return next; });
  }
  async function save(field: CustomFieldItem) {
    if (!canEdit || !ownerId || values.isSaving || !(field.id in drafts)) return;
    const invalid = validation(field);
    if (invalid) { setErrors((current) => ({ ...current, [field.id]: t.crmCustomFields.valueValidation[invalid] })); return; }
    setNotice(null);
    const result = await values.save(field, ownerType, ownerId, drafts[field.id]);
    if (currentSelection.current !== selection) return;
    if (result.ok) {
      setDrafts((current) => { const next = { ...current }; delete next[field.id]; return next; });
      setErrors((current) => { const next = { ...current }; delete next[field.id]; return next; });
      toast.success(t.crmCustomFields.valueSaved);
    } else if (result.uncertain || result.confirmed) {
      setNotice(result.confirmed ? t.crmCustomFields.valueConfirmedReloadFailed :
        result.refreshFailed ? t.crmCustomFields.valueUncertainStale : t.crmCustomFields.valueUncertain);
      if (!result.refreshFailed) setDrafts((current) => { const next = { ...current }; delete next[field.id]; return next; });
    } else if (result.error) {
      const message = t.crmCustomFields.valueErrors[result.error.code ?? ""] ??
        (result.error.status === 403 ? t.crmCustomFields.valueErrors.CRM_SCOPED_PERMISSION_DENIED : t.crmCustomFields.valueSaveFailed);
      setErrors((current) => ({ ...current, [field.id]: message }));
      if (result.error.status === 403 || result.error.code === "LEAD_ALREADY_CONVERTED") access.retry();
    }
  }
  const branchIndex = branch.branchId ? branch.branchIds.indexOf(branch.branchId) : -1;
  const branchLabel = branch.branchId ? branchLabels.get(branch.branchId) ??
    formatTemplate(t.common.branchNameFallback, { number: formatNumber(branchIndex + 1, lang) }) : t.common.selectBranch;
  return { t, lang, ...branch, branchLabel, ownerType, ownerId, ownerLabel: ownerId ? owner?.label : undefined,
    records, values, applicable, notice, access, canEdit, isDirty, guard, leave, isRequired, valueFor, change,
    hasDraft: (id: string) => id in drafts,
    errorFor: (field: CustomFieldItem) => errors[field.id] ??
      (field.id in drafts && validation(field) ? t.crmCustomFields.valueValidation[validation(field) as string] : undefined),
    canSave: (field: CustomFieldItem) => canEdit && !values.isSaving && field.id in drafts && validation(field) === null,
    canClear: (field: CustomFieldItem) => canEdit && !values.isSaving && !isRequired(field) && !isBlankFieldValue(valueFor(field.id)),
    selectOwner,
    selectType: (next: CrmRecordSourceType) => { if (next !== ownerType) leave(() => { setOwnerType(next); clearRecord(); }); },
    changeBranch: (next: string) => { if (next !== branch.branchId) leave(() => { branch.selectBranch(next); clearRecord(); }); },
    reload: () => leave(() => {
      void reloadDefinitions?.();
      if (ownerId) { void values.load(ownerType, ownerId); access.retry(); }
    }),
    save,
  };
}

