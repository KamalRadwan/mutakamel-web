"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  CRM_CUSTOM_FIELDS_PATH,
  normalizeCrmCustomFieldKey,
  parseCrmCustomField,
  parseCrmCustomFieldsResponse,
  type CreateCustomFieldInput,
  type CustomFieldItem,
} from "../custom-field-contract";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isAmbiguousMutationError(error: unknown): boolean {
  return (
    !(error instanceof TenantApiClientError) || error.response.status >= 500
  );
}

async function readDefinitions(signal?: AbortSignal): Promise<CustomFieldItem[]> {
  const response = await axiosClient.get<unknown>(CRM_CUSTOM_FIELDS_PATH, {
    signal,
    cache: "no-store",
    maxResponseBytes: 10_000_000,
  });
  return parseCrmCustomFieldsResponse(response.data);
}

export function useCrmCustomFields() {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const canManage = user?.permissions.includes("crm.custom_fields.manage") ?? false;
  const [definitions, setDefinitions] = useState<CustomFieldItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  // The definitions fetch's own failure. Handed to DataTable so the error
  // state replaces the empty state rather than stacking with it.
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      setDefinitions(await readDefinitions(signal));
    } catch (caught) {
      if (isAbortError(caught)) return;
      setDefinitions([]);
      setError(normalizeApiError(caught));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const items = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return definitions;
    return definitions.filter((item) =>
      [item.fieldKey, item.nameAr, item.nameEn, item.ownerType, item.type].some(
        (value) => value.toLocaleLowerCase().includes(query),
      ),
    );
  }, [definitions, searchQuery]);

  const handleCreate = useCallback(
    async (input: CreateCustomFieldInput): Promise<boolean> => {
      if (!canManage) {
        setCreateError("You do not have permission to manage custom fields.");
        return false;
      }
      setIsCreating(true);
      setCreateError(null);
      const payload = {
        ...input,
        fieldKey: normalizeCrmCustomFieldKey(input.fieldKey),
        nameAr: input.nameAr.trim(),
        nameEn: input.nameEn.trim(),
      };

      try {
        const response = await axiosClient.post<unknown>(
          CRM_CUSTOM_FIELDS_PATH,
          payload,
          {
            nonReplayable: true,
            skipAutoIdempotency: true,
            maxResponseBytes: 250_000,
          },
        );
        const created = parseCrmCustomField(response.data);
        setDefinitions((current) =>
          [...current.filter((item) => item.id !== created.id), created].sort(
            (left, right) =>
              left.ownerType.localeCompare(right.ownerType) ||
              left.sortOrder - right.sortOrder ||
              left.fieldKey.localeCompare(right.fieldKey),
          ),
        );
        return true;
      } catch (caught) {
        if (isAmbiguousMutationError(caught)) {
          let reloaded = false;
          try {
            setDefinitions(await readDefinitions());
            reloaded = true;
          } catch {
            // Keep the last confirmed list. The non-idempotent POST is never replayed.
          }
          setIsCreateOpen(false);
          setCreateError(
            reloaded
              ? t.crmCustomFields.ambiguousCreateRefreshed
              : t.crmCustomFields.ambiguousCreateStale,
          );
        } else {
          setCreateError(
            errorMessage(caught, t.crmCustomFields.createFailed),
          );
        }
        return false;
      } finally {
        setIsCreating(false);
      }
    },
    [canManage, t],
  );

  const openCreate = () => {
    if (!canManage) return;
    setCreateError(null);
    setIsCreateOpen(true);
  };
  const closeCreate = () => {
    if (isCreating) return;
    setCreateError(null);
    setIsCreateOpen(false);
  };

  return {
    t,
    items,
    searchQuery,
    setSearchQuery,
    isLoading,
    isCreating,
    error,
    createError,
    canManage,
    isCreateOpen,
    openCreate,
    closeCreate,
    handleCreate,
    reload: () => load(),
  };
}
