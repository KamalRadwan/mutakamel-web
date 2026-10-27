"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  createWriteAttempt,
  runIdempotentWrite,
  type AppliedUnreadable,
  type WriteAttempt,
} from "@/lib/api/idempotent-write";
import {
  CRM_CUSTOM_FIELDS_PATH,
  parseCrmCustomFieldsResponse,
  type CustomFieldItem,
} from "../../../custom-fields/custom-field-contract";
import {
  buildCrmCustomFieldValuesPath,
  parseCrmCustomFieldValues,
} from "../../../shared/custom-fields-contract";
import {
  opportunityPath,
  parseOpportunityDetailResponse,
  type OpportunityDetail,
} from "../../opportunity-contract";
import {
  OPPORTUNITY_NOTHING_TO_SEND,
  buildUpdateOpportunityRequest,
  toOpportunityForm,
  type OpportunityForm,
} from "../../opportunity-write-contract";

export interface OpportunityEditAmbiguity {
  attempt: WriteAttempt;
  error: NormalizedApiError;
  replay: () => Promise<void>;
}

/**
 * `PATCH /opportunities/:id` — MASTER-PLAN 8.11 (edit half).
 *
 * Sends changed keys only. Pipeline and stage are absent from the form on
 * purpose: `UpdateOpportunityDto` carries neither, and both have their own
 * routes that derive `status` from the destination stage's flag.
 *
 * No `If-Match`: crm-app has no ETag or `If-Match` handling anywhere
 * (verified by grep across `crm-app/src`), so a 409 here is a domain conflict
 * such as a blacklisted customer, not a version mismatch.
 */
export function useOpportunityEdit(
  item: OpportunityDetail | null,
  /**
   * Re-read the record from the server — defect D2. Used when a write applied
   * but its response body could not be parsed: there is no value to hand
   * `onSaved`, the record has nonetheless changed, and the one thing that must
   * NOT happen is a drawer left open with a Save the user presses again.
   */
  onReconcile: () => void,
) {
  const [customFieldsBaseline, setCustomFieldsBaseline] = useState<Record<string, unknown>>({});
  const [definitions, setDefinitions] = useState<CustomFieldItem[]>([]);
  const [customFieldsLoading, setCustomFieldsLoading] = useState(false);
  const [customFieldsError, setCustomFieldsError] = useState<NormalizedApiError | null>(null);
  const [customFieldsReload, setCustomFieldsReload] = useState(0);
  const baseline = useMemo(
    () => (item ? { ...toOpportunityForm(item), customFields: customFieldsBaseline } : null),
    [item, customFieldsBaseline],
  );
  const [form, setForm] = useState<OpportunityForm | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [ambiguity, setAmbiguity] = useState<OpportunityEditAmbiguity | null>(
    null,
  );
  // D2: the write applied and its receipt could not be read. Its own state,
  // because `error` invites a second Save.
  const [appliedUnreadable, setAppliedUnreadable] =
    useState<AppliedUnreadable | null>(null);

  const open = form !== null;
  const branchId = item?.branchId;
  const ownerId = item?.id;
  useEffect(() => {
    if (!open || !branchId || !ownerId) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setCustomFieldsLoading(true);
    });
    void (async () => {
      try {
        const config = {
          signal: controller.signal,
          cache: "no-store" as const,
          maxResponseBytes: 512 * 1024,
        };
        const [fieldsResponse, valuesResponse] = await Promise.all([
          axiosClient.get<unknown>(CRM_CUSTOM_FIELDS_PATH, config),
          axiosClient.get<unknown>(buildCrmCustomFieldValuesPath({
            branchId, ownerType: "OPPORTUNITY", ownerId,
          }), config),
        ]);
        if (controller.signal.aborted) return;
        const fields = parseCrmCustomFieldsResponse(fieldsResponse.data)
          .filter((field) => field.isActive && field.ownerType === "OPPORTUNITY")
          .sort((left, right) => left.sortOrder - right.sortOrder);
        const values = parseCrmCustomFieldValues(valuesResponse.data, { ownerType: "OPPORTUNITY", ownerId });
        const byId = new Map(values.map((value) => [value.fieldDefinitionId, value.value]));
        const stored = Object.fromEntries(
          fields.map((field) => [field.fieldKey, byId.get(field.id) ?? null]),
        );
        setDefinitions(fields);
        setCustomFieldsBaseline(stored);
        setForm((current) => current ? { ...current, customFields: { ...stored } } : current);
        setCustomFieldsError(null);
      } catch (caught) {
        if (!controller.signal.aborted) setCustomFieldsError(normalizeApiError(caught));
      } finally {
        if (!controller.signal.aborted) setCustomFieldsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [open, branchId, ownerId, customFieldsReload]);

  const isDirty = useMemo(() => {
    if (!form || !baseline) return false;
    return Object.entries(form).some(([key, value]) => {
      const original = baseline[key as keyof OpportunityForm];
      return typeof value === "string" && typeof original === "string"
        ? value.trim() !== original.trim()
        : JSON.stringify(value) !== JSON.stringify(original);
    });
  }, [baseline, form]);

  const openDrawer = useCallback(() => {
    if (baseline) setForm({ ...baseline, customFields: {} });
    setCustomFieldsBaseline({});
    setDefinitions([]);
    setCustomFieldsError(null);
    setCustomFieldsLoading(baseline !== null);
    setError(null);
    setAmbiguity(null);
    setAppliedUnreadable(null);
  }, [baseline]);

  const closeDrawer = useCallback(() => {
    setForm(null);
    setError(null);
  }, []);

  const setField = useCallback(
    <K extends keyof OpportunityForm>(key: K, value: OpportunityForm[K]) => {
      setForm((current) => (current ? { ...current, [key]: value } : current));
    },
    [],
  );

  const revert = useCallback(() => {
    if (baseline) setForm({ ...baseline });
    setError(null);
  }, [baseline]);

  const submit = useCallback(async () => {
    if (!item || !form || !baseline || isSubmitting) return;
    let body;
    try {
      body = buildUpdateOpportunityRequest(form, baseline);
    } catch (caught) {
      // The builder throws a code, not prose — `useCrmErrorText` owns the
      // words. Putting it in `message` printed the raw constant at the user.
      setError({
        status: 422,
        code: caught instanceof Error ? caught.message : undefined,
      });
      return;
    }
    if (Object.keys(body).length === 0) {
      // A dirty form that produces nothing to send is a change that went
      // nowhere — closing the drawer as if it saved is the D8 failure in its
      // purest form. An untouched form closes as before.
      if (isDirty) {
        setError({ status: 422, code: OPPORTUNITY_NOTHING_TO_SEND });
        return;
      }
      closeDrawer();
      return;
    }
    const attempt = createWriteAttempt();

    const send = async (): Promise<void> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const outcome = await runIdempotentWrite({
          attempt,
          method: "patch",
          path: opportunityPath(item.id),
          body,
          parse: parseOpportunityDetailResponse,
          config: { maxResponseBytes: 512 * 1024 },
        });
        if (outcome.kind === "success") {
          setAmbiguity(null);
          setForm(null);
          onReconcile();
          return;
        }
        if (outcome.kind === "ambiguous") {
          setAmbiguity({ attempt, error: outcome.error, replay: send });
          return;
        }
        if (outcome.kind === "applied_unreadable") {
          // The patch applied. The drawer closes so there is no Save to press
          // again, and the screen re-reads what the server now holds.
          setAmbiguity(null);
          setError(null);
          setForm(null);
          setAppliedUnreadable({ attempt, error: outcome.error });
          onReconcile();
          return;
        }
        setError(outcome.error);
      } finally {
        setIsSubmitting(false);
      }
    };

    await send();
  }, [
    baseline,
    closeDrawer,
    form,
    isDirty,
    isSubmitting,
    item,
    onReconcile,
  ]);

  const requiredFieldKeys = useMemo(() => definitions.filter((field) =>
    field.requirements.some((requirement) =>
      requirement.isRequired && requirement.operation === "UPDATE" &&
      (requirement.entityScope === null || requirement.entityScope === "OPPORTUNITY"),
    ),
  ).map((field) => field.fieldKey), [definitions]);

  return {
    open,
    requiredFieldKeys,
    definitions,
    customFieldsLoading,
    customFieldsError,
    retryCustomFields: () => setCustomFieldsReload((current) => current + 1),
    setCustomField: (key: string, value: unknown) => {
      if (customFieldsLoading || customFieldsError || isSubmitting || ambiguity || appliedUnreadable) return;
      if (!definitions.some((field) => field.fieldKey === key)) return;
      setForm((current) => current ? {
        ...current, customFields: { ...current.customFields, [key]: value === "" ? null : value },
      } : current);
    },
    form,
    isDirty,
    isSubmitting,
    error,
    ambiguity,
    dismissAmbiguity: () => setAmbiguity(null),
    appliedUnreadable,
    dismissAppliedUnreadable: () => setAppliedUnreadable(null),
    reconcile: onReconcile,
    openDrawer,
    closeDrawer,
    setField,
    revert,
    submit,
  };
}
