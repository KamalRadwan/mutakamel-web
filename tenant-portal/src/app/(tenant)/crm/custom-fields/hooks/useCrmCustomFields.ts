"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import { isUUIDv7 } from "@/lib/uuid";

export const CRM_CUSTOM_FIELDS_PATH = "/api/tenant/crm/v1/custom-fields";

export const CRM_CUSTOM_FIELD_OWNER_TYPES = [
  "LEAD",
  "PARTY",
  "CUSTOMER_PROFILE",
  "OPPORTUNITY",
] as const;

const CRM_CUSTOM_FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DATE",
  "DATETIME",
  "BOOLEAN",
  "SELECT",
  "MULTI_SELECT",
  "URL",
  "EMAIL",
  "PHONE",
] as const;

export const CRM_CUSTOM_FIELD_SIMPLE_CREATE_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DATE",
  "DATETIME",
  "BOOLEAN",
  "URL",
  "EMAIL",
  "PHONE",
] as const;

const CRM_CUSTOM_FIELD_RESPONSE_OWNER_TYPES = [
  ...CRM_CUSTOM_FIELD_OWNER_TYPES,
  "LEAD_AND_PARTY",
] as const;
const CRM_CUSTOM_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

type CrmCustomFieldOwnerType =
  (typeof CRM_CUSTOM_FIELD_RESPONSE_OWNER_TYPES)[number];
export type CrmCustomFieldCreateOwnerType =
  (typeof CRM_CUSTOM_FIELD_OWNER_TYPES)[number];
type CrmCustomFieldType = (typeof CRM_CUSTOM_FIELD_TYPES)[number];
export type CrmCustomFieldSimpleCreateType =
  (typeof CRM_CUSTOM_FIELD_SIMPLE_CREATE_TYPES)[number];

export interface CustomFieldItem {
  id: string;
  ownerType: CrmCustomFieldOwnerType;
  fieldKey: string;
  nameAr: string;
  nameEn: string;
  type: CrmCustomFieldType;
  optionsCount: number;
  isSearchable: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface CreateCustomFieldInput {
  ownerType: CrmCustomFieldCreateOwnerType;
  fieldKey: string;
  nameAr: string;
  nameEn: string;
  type: CrmCustomFieldSimpleCreateType;
  isSearchable: boolean;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function invalidResponse(): never {
  throw new Error("Invalid CRM custom-fields response.");
}

function isMember<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

export function parseCrmCustomField(payload: unknown): CustomFieldItem {
  const source = record(payload);
  if (
    !source ||
    !isUUIDv7(source.id) ||
    !isMember(CRM_CUSTOM_FIELD_RESPONSE_OWNER_TYPES, source.ownerType) ||
    typeof source.fieldKey !== "string" ||
    !isValidCrmCustomFieldKey(source.fieldKey) ||
    typeof source.nameAr !== "string" ||
    source.nameAr.length === 0 ||
    source.nameAr.length > 120 ||
    typeof source.nameEn !== "string" ||
    source.nameEn.length === 0 ||
    source.nameEn.length > 120 ||
    !isMember(CRM_CUSTOM_FIELD_TYPES, source.type) ||
    !Array.isArray(source.options) ||
    source.options.length > 100 ||
    typeof source.isSearchable !== "boolean" ||
    typeof source.isActive !== "boolean" ||
    !Number.isSafeInteger(source.sortOrder) ||
    (source.sortOrder as number) < 1
  ) {
    invalidResponse();
  }

  if (
    ((source.type === "SELECT" || source.type === "MULTI_SELECT") &&
      source.options.length === 0)
  ) {
    invalidResponse();
  }

  return {
    id: source.id,
    ownerType: source.ownerType,
    fieldKey: source.fieldKey,
    nameAr: source.nameAr,
    nameEn: source.nameEn,
    type: source.type,
    optionsCount: source.options.length,
    isSearchable: source.isSearchable,
    isActive: source.isActive,
    sortOrder: source.sortOrder as number,
  };
}

export function parseCrmCustomFieldsResponse(
  payload: unknown,
): CustomFieldItem[] {
  if (!Array.isArray(payload) || payload.length > 100) invalidResponse();
  const definitions = payload.map(parseCrmCustomField);
  const ids = new Set<string>();
  const identities = new Set<string>();
  for (const definition of definitions) {
    const identity = `${definition.ownerType}\u0000${definition.fieldKey}`;
    if (ids.has(definition.id) || identities.has(identity)) invalidResponse();
    ids.add(definition.id);
    identities.add(identity);
  }
  return definitions;
}

export function normalizeCrmCustomFieldKey(value: string): string {
  return value.trim().replace(/\s+/g, "_").toLowerCase();
}

export function isValidCrmCustomFieldKey(value: string): boolean {
  return CRM_CUSTOM_FIELD_KEY_PATTERN.test(value);
}

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
  const { lang, t } = useI18n();
  const { user } = useTenantAuth();
  const canManage = user?.permissions.includes("crm.custom_fields.manage") ?? false;
  const [definitions, setDefinitions] = useState<CustomFieldItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      setDefinitions(await readDefinitions(signal));
    } catch (caught) {
      if (isAbortError(caught)) return;
      setDefinitions([]);
      setError(
        errorMessage(caught, "Unable to load CRM custom-field definitions."),
      );
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
            lang === "ar"
              ? reloaded
                ? "نتيجة الإنشاء غير مؤكدة. حُدّثت القائمة؛ راجعها قبل المحاولة مجددًا."
                : "نتيجة الإنشاء غير مؤكدة وتعذر تحديث القائمة. أعد التحميل قبل المحاولة مجددًا."
              : reloaded
                ? "The creation result is uncertain. The catalogue was refreshed; review it before trying again."
                : "The creation result is uncertain and the catalogue could not be refreshed. Reload before trying again.",
          );
        } else {
          setCreateError(
            errorMessage(caught, "Unable to create the custom field."),
          );
        }
        return false;
      } finally {
        setIsCreating(false);
      }
    },
    [canManage, lang],
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
    lang,
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
