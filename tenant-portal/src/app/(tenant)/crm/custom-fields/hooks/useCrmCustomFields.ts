"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
import {
  CRM_CUSTOM_FIELDS_PATH,
  CRM_CUSTOM_FIELDS_LIMIT,
  normalizeCrmCustomFieldKey,
  parseCrmCustomField,
  parseCrmCustomFieldsResponse,
  type CreateCustomFieldInput,
  type CustomFieldItem,
} from "../custom-field-contract";
import { useCustomFieldEdit } from "./useCustomFieldEdit";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isAmbiguousMutationError(error: unknown): boolean {
  return (
    !(error instanceof TenantApiClientError) || error.response.status === 0 || error.response.status >= 500
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

function sortDefinitions(rows: CustomFieldItem[]) {
  return rows.sort((a, b) => a.ownerType.localeCompare(b.ownerType) || a.sortOrder - b.sortOrder || a.fieldKey.localeCompare(b.fieldKey));
}

export function useCrmCustomFields() {
  const { t } = useI18n();
  const crmErrorText = useCrmErrorText();
  const { user } = useTenantAuth();
  const access = useAccessMode();
  const canManage = (user?.permissions.includes("crm.custom_fields.manage") ?? false) && access.canMutate;
  const creating = useRef(false);
  const readGeneration = useRef(0);
  const reloadRequired = useRef(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [definitions, setDefinitions] = useState<CustomFieldItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  // The definitions fetch's own failure. Handed to DataTable so the error
  // state replaces the empty state rather than stacking with it.
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createKeyError, setCreateKeyError] = useState<string | null>(null);
  const invalidateReads = useCallback(() => { readGeneration.current += 1; }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    const generation = ++readGeneration.current;
    const current = () => generation === readGeneration.current && !signal?.aborted;
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await readDefinitions(signal);
      if (!current()) return null;
      setDefinitions(loaded);
      setHasLoaded(true);
      reloadRequired.current = false;
      setNeedsReload(false);
      return loaded;
    } catch (caught) {
      if (!current() || isAbortError(caught)) return null;
      const { status, code } = normalizeApiError(caught);
      setError({ status, code });
      return null;
    } finally {
      if (current()) setIsLoading(false);
    }
  }, []);

  const editor = useCustomFieldEdit(canManage && !needsReload && !error && !isLoading, (updated) => {
    setDefinitions((current) => sortDefinitions(current.map((field) => field.id === updated.id ? updated : field)));
  }, async () => (await load()) !== null);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => { controller.abort(); invalidateReads(); };
  }, [load, invalidateReads]);

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
      if (creating.current || reloadRequired.current || isLoading || error) return false;
      if (!canManage) {
        setCreateError(t.crmCustomFields.editForbidden);
        return false;
      }
      if (definitions.length >= CRM_CUSTOM_FIELDS_LIMIT) {
        setCreateError(t.crmCustomFields.limitReached);
        return false;
      }
      if (definitions.some((field) => field.fieldKey === normalizeCrmCustomFieldKey(input.fieldKey))) {
        setCreateKeyError(t.crmCustomFields.fieldKeyTaken);
        return false;
      }
      creating.current = true;
      setIsCreating(true);
      setCreateError(null);
      setCreateKeyError(null);
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
          sortDefinitions([...current.filter((item) => item.id !== created.id), created]),
        );
        return true;
      } catch (caught) {
        if (isAmbiguousMutationError(caught)) {
          // The catalogue-wide fence survives closing/reopening the create
          // surface. Only a validated authoritative read may clear it.
          reloadRequired.current = true;
          setNeedsReload(true);
          const reloaded = (await load()) !== null;
          setIsCreateOpen(false);
          setCreateError(
            reloaded
              ? t.crmCustomFields.ambiguousCreateRefreshed
              : t.crmCustomFields.ambiguousCreateStale,
          );
        } else {
          const { status, code } = normalizeApiError(caught);
          if (code === "CUSTOM_FIELD_KEY_TAKEN") setCreateKeyError(t.crmCustomFields.fieldKeyTaken);
          else setCreateError(code === "CUSTOM_FIELD_LIMIT_EXCEEDED" ? t.crmCustomFields.limitReached : crmErrorText({ status, code }) ?? t.crmCustomFields.createFailed);
        }
        return false;
      } finally {
        setIsCreating(false);
        creating.current = false;
      }
    },
    [canManage, crmErrorText, definitions, error, isLoading, load, t],
  );

  const openCreate = () => {
    if (!canManage || reloadRequired.current || definitions.length >= CRM_CUSTOM_FIELDS_LIMIT || isLoading || error) return;
    setCreateError(null);
    setCreateKeyError(null);
    setIsCreateOpen(true);
  };
  const closeCreate = () => {
    if (creating.current) return;
    setCreateError(null);
    setIsCreateOpen(false);
  };

  return {
    t,
    editor,
    items,
    searchQuery,
    setSearchQuery,
    isLoading,
    hasLoaded,
    isCreating,
    needsReload,
    error,
    createError,
    createKeyError,
    definitions,
    atCapacity: definitions.length >= CRM_CUSTOM_FIELDS_LIMIT,
    canManage,
    isCreateOpen,
    openCreate,
    closeCreate,
    handleCreate,
    reload: async () => {
      const loaded = await load();
      if (loaded && needsReload) setCreateError(t.crmCustomFields.ambiguousCreateRefreshed);
      return loaded;
    },
  };
}
