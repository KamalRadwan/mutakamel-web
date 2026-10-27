"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n, type Language } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { formatBytes } from "@/lib/format/number";
import type { Dictionary } from "@/i18n/dictionaries/ar";

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

type StaticCatalogueGroupKind =
  | "enum"
  | "permission"
  | "owner"
  | "event"
  | "attachment"
  | "rule";

export interface StaticCatalogueGroup {
  id: string;
  key: string;
  label: string;
  technicalValues: string[];
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
  return items.map((item) => item.label[lang]);
}

/**
 * Permission labels, marked where the server has no Arabic for them.
 *
 * `permissionLabel` in crm-app returns the **identical** string for `en` and
 * `ar` whenever a permission has no dictionary entry, which is true of 78 of
 * the 98 CRM permissions — every scoped one. Rendering that unmarked would
 * present English as a translation. This does not translate anything; it
 * declines to assert a translation that does not exist. Q121.
 *
 * Scoped to permissions deliberately. Equality is only *evidence* of the
 * fallback here — elsewhere in this catalogue two identical strings are
 * legitimate, as `attachment_family.pdf` ("PDF" in both) shows.
 */
function permissionLabels(
  items: StaticDataOption[],
  lang: Language,
  untranslatedNote: string,
): string[] {
  return items.map((item) =>
    item.label.ar === item.label.en
      ? `${item.label[lang]} — ${untranslatedNote}`
      : item.label[lang],
  );
}

export function buildStaticCatalogueGroups(
  data: CrmStaticData,
  lang: Language,
  untranslatedNote: string,
  copy: Dictionary["crmStaticCatalogue"],
): StaticCatalogueGroup[] {
  const group = (
    id: string,
    kind: StaticCatalogueGroupKind,
    values: string[],
  ): StaticCatalogueGroup => ({
    id,
    key: id,
    label: copy.groups[id] ?? copy.otherGroup,
    technicalValues: [],
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
  // Was a locale-less Intl call with the English word "bytes" spliced on: an
  // English unit on an Arabic screen, and grouping separators that differed
  // between a developer's machine, a user's browser and CI. U10.
  attachmentFamilies.push(formatBytes(data.attachmentPolicy.maxSizeBytes, lang));

  const optionLabel = (items: StaticDataOption[] | undefined, value: string) =>
    items?.find((item) => item.value === value)?.label[lang] ?? copy.unavailableValue;
  const result = [
    ...enumGroups,
    group(
      "permissions",
      "permission",
      permissionLabels(data.permissionOptions, lang, untranslatedNote),
    ),
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
        ([flag, status]) => `${flag === "default" ? copy.otherStages : optionLabel(data.enumOptions.opportunityStageFlags, flag)} → ${optionLabel(data.enumOptions.opportunityStatuses, status)}`,
      ),
    ),
    group("leadConversionCopiesCustomFieldOwnerType", "rule", [
      optionLabel(data.enumOptions.customFieldOwnerTypes, data.derivedRules.leadConversionCopiesCustomFieldOwnerType),
    ]),
  ];
  const technicalValues: Record<string, string[]> = {
    ...Object.fromEntries(Object.entries(data.enumOptions).map(([key, items]) => [key, items.map((item) => item.value)])),
    permissions: data.permissionOptions.map((item) => item.value),
    ownerTypeOptions: data.ownerTypeOptions.map((item) => item.value),
    eventOptions: data.eventOptions.map((item) => item.value),
    attachmentPolicy: [...data.attachmentPolicy.familyLabels.map((item) => item.value), String(data.attachmentPolicy.maxSizeBytes)],
    rejectedAttachmentFamilies: data.attachmentPolicy.rejectedFamilyLabels.map((item) => item.value),
    opportunityStatusByStageFlag: Object.entries(data.derivedRules.opportunityStatusByStageFlag).map(([flag, status]) => `${flag} → ${status}`),
    leadConversionCopiesCustomFieldOwnerType: [data.derivedRules.leadConversionCopiesCustomFieldOwnerType],
  };
  return result.map((item) => ({ ...item, technicalValues: technicalValues[item.key] ?? [] }));
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useCrmStaticCatalogue() {
  const { lang, t } = useI18n();
  const [catalogue, setCatalogue] = useState<CrmStaticData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);

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
      // A failed REFRESH keeps the last catalogue that loaded. That is what
      // makes staleness a real, reachable state on this screen — and what
      // gives the degraded surface something true to say.
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

  const groups = useMemo(() => {
    if (!catalogue) return [];
    const query = searchQuery.trim().toLocaleLowerCase();
    return buildStaticCatalogueGroups(catalogue, lang, t.crmStaticCatalogue.untranslatedLabel, t.crmStaticCatalogue).filter(
      (item) =>
        !query ||
        item.key.toLocaleLowerCase().includes(query) ||
        item.label.toLocaleLowerCase().includes(query) ||
        item.values.some((value) =>
          value.toLocaleLowerCase().includes(query),
        ),
    );
  }, [catalogue, lang, searchQuery, t.crmStaticCatalogue]);

  return {
    t,
    lang,
    catalogue,
    groups,
    searchQuery,
    setSearchQuery,
    isLoading,
    // Nothing loaded at all — the table renders the error state.
    loadError: catalogue === null ? error : null,
    // Something loaded, and the newest attempt to refresh it did not. That
    // is partial/stale data, which is exactly what DegradedBanner is for.
    isStale: catalogue !== null && error !== null,
    reload: () => load(),
  };
}
