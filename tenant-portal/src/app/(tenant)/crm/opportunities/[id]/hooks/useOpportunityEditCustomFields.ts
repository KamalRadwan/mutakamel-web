"use client";

import { useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { CRM_CUSTOM_FIELDS_PATH, parseCrmCustomFieldsResponse, type CustomFieldItem } from "../../../custom-fields/custom-field-contract";
import { buildCrmCustomFieldValuesPath, parseCrmCustomFieldValues } from "../../../shared/custom-fields-contract";

export function useOpportunityEditCustomFields(branchId: string | undefined, ownerId: string | undefined, enabled: boolean) {
  const [definitions, setDefinitions] = useState<CustomFieldItem[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled || !branchId || !ownerId) return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) setLoading(true); });
    void (async () => {
      try {
        const config = { signal: controller.signal, cache: "no-store" as const, maxResponseBytes: 512 * 1024 };
        const [fieldsResponse, valuesResponse] = await Promise.all([
          axiosClient.get<unknown>(CRM_CUSTOM_FIELDS_PATH, config),
          axiosClient.get<unknown>(buildCrmCustomFieldValuesPath({ branchId, ownerType: "OPPORTUNITY", ownerId }), config),
        ]);
        if (controller.signal.aborted) return;
        const fields = parseCrmCustomFieldsResponse(fieldsResponse.data)
          .filter((field) => field.isActive && field.ownerType === "OPPORTUNITY")
          .sort((left, right) => left.sortOrder - right.sortOrder);
        const stored = parseCrmCustomFieldValues(valuesResponse.data, { ownerType: "OPPORTUNITY", ownerId });
        const byId = new Map(stored.map((value) => [value.fieldDefinitionId, value.value]));
        setDefinitions(fields);
        setValues(Object.fromEntries(fields.map((field) => [field.fieldKey, byId.get(field.id) ?? null])));
        setError(null);
      } catch (caught) {
        if (!controller.signal.aborted) setError(normalizeApiError(caught));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [enabled, branchId, ownerId, revision]);
  return { definitions, values, loading, error, reload: () => setRevision((current) => current + 1) };
}
