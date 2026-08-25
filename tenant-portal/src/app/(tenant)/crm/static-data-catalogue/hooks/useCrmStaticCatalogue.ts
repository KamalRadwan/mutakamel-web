"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n, type Language } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";

export const CRM_STATIC_DATA_PATH = "/api/tenant/crm/v1/static-data";

interface StaticDataOption {
  value: string;
  label: { en: string; ar: string };
}

export interface CrmStaticData {
  enumOptions: Record<string, StaticDataOption[]>;
  permissionOptions: StaticDataOption[];
  ownerTypeOptions: StaticDataOption[];
  eventOptions: StaticDataOption[];
  attachmentPolicy: {
    maxSizeBytes: number;
    familyLabels: StaticDataOption[];
    rejectedFamilyLabels: StaticDataOption[];
  };
  derivedRules: {
    opportunityStatusByStageFlag: Record<string, string>;
    leadConversionCopiesCustomFieldOwnerType: string;
  };
}

export type StaticCatalogueGroupKind =
  | "enum"
  | "permission"
  | "owner"
  | "event"
  | "attachment"
  | "rule";

export interface StaticCatalogueGroup {
  id: string;
  key: string;
  kind: StaticCatalogueGroupKind;
  entriesCount: number;
  values: string[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function invalidResponse(): never {
  throw new Error("Invalid CRM static-data response.");
}

function options(value: unknown): StaticDataOption[] {
  if (!Array.isArray(value)) invalidResponse();
  return value.map((item) => {
    const source = record(item);
    const label = source && record(source.label);
    if (
      !source ||
      typeof source.value !== "string" ||
      !label ||
      typeof label.en !== "string" ||
      typeof label.ar !== "string"
    ) {
      invalidResponse();
    }
    return {
      value: source.value,
      label: { en: label.en, ar: label.ar },
    };
  });
}

function optionGroups(value: unknown): Record<string, StaticDataOption[]> {
  const source = record(value);
  if (!source) invalidResponse();
  return Object.fromEntries(
    Object.entries(source).map(([key, items]) => [key, options(items)]),
  );
}

function stringMap(value: unknown): Record<string, string> {
  const source = record(value);
  if (!source || Object.values(source).some((item) => typeof item !== "string")) {
    invalidResponse();
  }
  return source as Record<string, string>;
}

export function parseCrmStaticDataResponse(payload: unknown): CrmStaticData {
  const source = record(payload);
  const attachment = source && record(source.attachmentPolicy);
  const rules = source && record(source.derivedRules);
  if (
    !source ||
    !attachment ||
    !Number.isSafeInteger(attachment.maxSizeBytes) ||
    (attachment.maxSizeBytes as number) <= 0 ||
    !rules ||
    typeof rules.leadConversionCopiesCustomFieldOwnerType !== "string"
  ) {
    invalidResponse();
  }
  return {
    enumOptions: optionGroups(source.enumOptions),
    permissionOptions: options(source.permissionOptions),
    ownerTypeOptions: options(source.ownerTypeOptions),
    eventOptions: options(source.eventOptions),
    attachmentPolicy: {
      maxSizeBytes: attachment.maxSizeBytes as number,
      familyLabels: options(attachment.familyLabels),
      rejectedFamilyLabels: options(attachment.rejectedFamilyLabels),
    },
    derivedRules: {
      opportunityStatusByStageFlag: stringMap(
        rules.opportunityStatusByStageFlag,
      ),
      leadConversionCopiesCustomFieldOwnerType:
        rules.leadConversionCopiesCustomFieldOwnerType,
    },
  };
}

function labels(items: StaticDataOption[], lang: Language): string[] {
  return items.map((item) => `${item.label[lang]} (${item.value})`);
}

export function buildStaticCatalogueGroups(
  data: CrmStaticData,
  lang: Language,
): StaticCatalogueGroup[] {
  const group = (
    id: string,
    kind: StaticCatalogueGroupKind,
    values: string[],
  ): StaticCatalogueGroup => ({
    id,
    key: id,
    kind,
    entriesCount: values.length,
    values,
  });
  const enumGroups = Object.entries(data.enumOptions)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, items]) => group(key, "enum", labels(items, lang)));
  const attachmentFamilies = labels(
    data.attachmentPolicy.familyLabels,
    lang,
  );
  attachmentFamilies.push(
    `${data.attachmentPolicy.maxSizeBytes.toLocaleString()} bytes`,
  );

  return [
    ...enumGroups,
    group("permissions", "permission", labels(data.permissionOptions, lang)),
    group("ownerTypeOptions", "owner", labels(data.ownerTypeOptions, lang)),
    group("eventOptions", "event", labels(data.eventOptions, lang)),
    group("attachmentPolicy", "attachment", attachmentFamilies),
    group(
      "rejectedAttachmentFamilies",
      "attachment",
      labels(data.attachmentPolicy.rejectedFamilyLabels, lang),
    ),
    group(
      "opportunityStatusByStageFlag",
      "rule",
      Object.entries(data.derivedRules.opportunityStatusByStageFlag).map(
        ([flag, status]) => `${flag} → ${status}`,
      ),
    ),
    group("leadConversionCopiesCustomFieldOwnerType", "rule", [
      data.derivedRules.leadConversionCopiesCustomFieldOwnerType,
    ]),
  ];
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useCrmStaticCatalogue() {
  const { lang, t } = useI18n();
  const [catalogue, setCatalogue] = useState<CrmStaticData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axiosClient.get<unknown>(CRM_STATIC_DATA_PATH, {
        signal,
        cache: "no-store",
        maxResponseBytes: 2_000_000,
      });
      setCatalogue(parseCrmStaticDataResponse(response.data));
    } catch (caught) {
      if (isAbortError(caught)) return;
      setCatalogue(null);
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "Unable to load CRM static data.",
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

  const groups = useMemo(() => {
    if (!catalogue) return [];
    const query = searchQuery.trim().toLocaleLowerCase();
    return buildStaticCatalogueGroups(catalogue, lang).filter(
      (item) =>
        !query ||
        item.key.toLocaleLowerCase().includes(query) ||
        item.values.some((value) =>
          value.toLocaleLowerCase().includes(query),
        ),
    );
  }, [catalogue, lang, searchQuery]);

  return {
    t,
    lang,
    catalogue,
    groups,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    reload: () => load(),
  };
}
