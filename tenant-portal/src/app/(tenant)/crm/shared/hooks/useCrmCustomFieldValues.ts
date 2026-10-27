"use client";

import { useCallback, useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  CRM_CUSTOM_FIELDS_READ_PATH,
  buildCrmCustomFieldValuesPath,
  definitionsForOwnerType,
  parseCrmCustomFieldDefinitions,
  parseCrmCustomFieldValues,
  type CrmCustomFieldDefinition,
  type CrmCustomFieldValue,
  type CrmCustomFieldValueOwnerType,
} from "../custom-fields-contract";

const CUSTOM_FIELDS_RESPONSE_LIMIT_BYTES = 512 * 1024;

export interface CrmCustomFieldEntry {
  definition: CrmCustomFieldDefinition;
  value: CrmCustomFieldValue | null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * The definitions and stored values for one CRM record's custom-fields rail.
 *
 * Two independent sources under `allSettled`. A tenant that defines no custom
 * fields is the common case, and a values call that 403s on
 * `crm.custom_fields.read` must not blank a detail screen that loaded fine —
 * so `error` is set only when the **definitions** could not be read, and the
 * caller hides the card whenever there is nothing to show. Editors must also
 * require `valuesLoaded`: a failed values read is not an empty saved value.
 */
export function useCrmCustomFieldValues(
  branchId: string | null,
  ownerType: CrmCustomFieldValueOwnerType,
  ownerId: string | null,
) {
  const [entries, setEntries] = useState<CrmCustomFieldEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [valuesError, setValuesError] = useState<NormalizedApiError | null>(null);
  const [loadedValuesKey, setLoadedValuesKey] = useState<string | null>(null);
  const valuesKey = JSON.stringify([branchId, ownerType, ownerId]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoadedValuesKey(null);
      setValuesError(null);
      if (!isUUIDv7(branchId) || !isUUIDv7(ownerId)) {
        setEntries([]);
        setError(null);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const [definitionsSettled, valuesSettled] = await Promise.allSettled([
          axiosClient.get<unknown>(CRM_CUSTOM_FIELDS_READ_PATH, {
            signal,
            cache: "no-store",
            maxResponseBytes: CUSTOM_FIELDS_RESPONSE_LIMIT_BYTES,
          }),
          axiosClient.get<unknown>(
            buildCrmCustomFieldValuesPath({ branchId, ownerType, ownerId }),
            {
              signal,
              cache: "no-store",
              maxResponseBytes: CUSTOM_FIELDS_RESPONSE_LIMIT_BYTES,
            },
          ),
        ]);
        if (signal?.aborted) return;
        if (
          [definitionsSettled, valuesSettled].some(
            (settled) =>
              settled.status === "rejected" && isAbortError(settled.reason),
          )
        ) {
          return;
        }
        if (definitionsSettled.status === "rejected") {
          throw definitionsSettled.reason;
        }

        const definitions = definitionsForOwnerType(
          parseCrmCustomFieldDefinitions(definitionsSettled.value.data),
          ownerType,
        );
        let values: CrmCustomFieldValue[];
        try {
          if (valuesSettled.status === "rejected") throw valuesSettled.reason;
          values = parseCrmCustomFieldValues(valuesSettled.value.data, {
            ownerType,
            ownerId,
          });
          setLoadedValuesKey(valuesKey);
        } catch (caught) {
          setValuesError(normalizeApiError(caught));
          values = [];
        }
        const valueByDefinition = new Map(
          values.map((value) => [value.fieldDefinitionId, value]),
        );
        setEntries(
          definitions.map((definition) => ({
            definition,
            value: valueByDefinition.get(definition.id) ?? null,
          })),
        );
      } catch (caught) {
        if (isAbortError(caught)) return;
        setEntries([]);
        setError(normalizeApiError(caught));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [branchId, ownerId, ownerType, valuesKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  return {
    entries,
    isLoading,
    error,
    valuesError,
    valuesLoaded: loadedValuesKey === valuesKey,
    reload: () => void load(),
  };
}
