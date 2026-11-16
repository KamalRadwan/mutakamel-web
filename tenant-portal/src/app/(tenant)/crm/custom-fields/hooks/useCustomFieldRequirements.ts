"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/design-system";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { CRM_CUSTOM_FIELDS_PATH, CRM_FIELD_REQUIREMENT_OPERATIONS,
  type CrmFieldRequirementOperation, type CustomFieldItem } from "../custom-field-contract";

type RequirementFlags = Record<CrmFieldRequirementOperation, boolean>;
const readFlags = (field: CustomFieldItem): RequirementFlags => ({
  CREATE: requiredFor(field, "CREATE"), UPDATE: requiredFor(field, "UPDATE"), CONVERT: requiredFor(field, "CONVERT"),
});
function requiredFor(field: CustomFieldItem, operation: CrmFieldRequirementOperation) {
  return field.requirements.some((rule) => rule.operation === operation && rule.entityScope === null && rule.isRequired);
}

export function useCustomFieldRequirements(canManage: boolean, reload: () => Promise<CustomFieldItem[] | null>) {
  const { t } = useI18n();
  const toast = useToast();
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [field, setField] = useState<CustomFieldItem | null>(null);
  const [flags, setFlags] = useState<RequirementFlags>({ CREATE: false, UPDATE: false, CONVERT: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const baseline = field ? readFlags(field) : flags;
  const isDirty = CRM_FIELD_REQUIREMENT_OPERATIONS.some((operation) => flags[operation] !== baseline[operation]);
  const canChange = !!field?.isActive && canManage && !isSubmitting && !needsReload;

  async function refresh() {
    if (!mounted.current || !field || pending.current) return;
    pending.current = true;
    setIsSubmitting(true);
    const loaded = await reload();
    if (!mounted.current) { pending.current = false; return; }
    const current = loaded?.find((entry) => entry.id === field.id);
    if (!current) {
      setNeedsReload(true);
      setError(t.crmCustomFields.requirementsReloadFailed);
    } else {
      setField(current); setFlags(readFlags(current)); setNeedsReload(false); setError(null);
    }
    pending.current = false;
    setIsSubmitting(false);
  }

  async function save() {
    if (!mounted.current || !field || pending.current || !canChange || !isDirty) return;
    const changed = CRM_FIELD_REQUIREMENT_OPERATIONS.filter((operation) => flags[operation] !== baseline[operation]);
    if (field.ownerType === "OPPORTUNITY" && changed.includes("CONVERT")) return;
    pending.current = true;
    setIsSubmitting(true);
    setError(null);
    let completed = 0;
    try {
      // Each operation is a separate write; earlier successes cannot be rolled back here.
      for (const operation of changed) {
        const response = await axiosClient.post<unknown>(`${CRM_CUSTOM_FIELDS_PATH}/${field.id}/requirements`,
          { operation, isRequired: flags[operation] },
          { cache: "no-store", nonReplayable: true, skipAutoIdempotency: true, maxResponseBytes: 100_000 });
        // An actor/session remount must not continue this sequence in the old workspace.
        if (!mounted.current) return;
        const row = response.data;
        if (!row || typeof row !== "object" || !isUUIDv7((row as Record<string, unknown>).id) ||
          (row as Record<string, unknown>).fieldDefinitionId !== field.id ||
          (row as Record<string, unknown>).operation !== operation ||
          (row as Record<string, unknown>).isRequired !== flags[operation]) throw new Error("Invalid field-requirement response");
        completed += 1;
      }
      const loaded = await reload();
      if (!mounted.current) return;
      if (!loaded) { setNeedsReload(true); setError(t.crmCustomFields.requirementsReloadFailed); return; }
      setField(null);
      toast.success(t.crmCustomFields.requirementsSaved);
    } catch (caught) {
      if (!mounted.current) return;
      const outcome = normalizeApiError(caught);
      const uncertain = outcome.status === 0 || outcome.status >= 500;
      const loaded = await reload();
      if (!mounted.current) return;
      const current = loaded?.find((entry) => entry.id === field.id);
      if (current) { setField(current); setFlags(readFlags(current)); }
      else setNeedsReload(true);
      setError(!current ? t.crmCustomFields.requirementsReloadFailed :
        completed > 0 || uncertain ? t.crmCustomFields.requirementsPartial : t.crmCustomFields.requirementsFailed);
    } finally {
      pending.current = false;
      if (mounted.current) setIsSubmitting(false);
    }
  }

  return { field, flags, isDirty, canChange, isSubmitting, error, needsReload, save, refresh,
    change: (operation: CrmFieldRequirementOperation, value: boolean) => {
      if (!canChange || (operation === "CONVERT" && field?.ownerType === "OPPORTUNITY")) return;
      setFlags((current) => ({ ...current, [operation]: value }));
    },
    select: (next: CustomFieldItem) => {
      if (!canManage || pending.current) return;
      setField(next); setFlags(readFlags(next)); setError(null); setNeedsReload(false);
    },
    close: () => { if (!pending.current) { setField(null); setError(null); } },
  };
}
