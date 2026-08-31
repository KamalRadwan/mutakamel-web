"use client";

import { DetailSection, Skeleton, type DetailField } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { Language } from "@/i18n/useLanguage";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { formatDecimalString } from "@/lib/format/number";
import type {
  CrmCustomFieldDefinition,
  CrmCustomFieldValueOwnerType,
} from "../custom-fields-contract";
import {
  useCrmCustomFieldValues,
  type CrmCustomFieldEntry,
} from "../hooks/useCrmCustomFieldValues";

export interface CustomFieldsCardProps {
  branchId: string | null;
  ownerType: CrmCustomFieldValueOwnerType;
  ownerId: string | null;
}

/**
 * The tenant's custom fields for one record, read-only in the rail.
 *
 * The card **hides entirely** when the tenant defines none, per
 * docs/design/detail-screens.md: an empty "Custom fields" heading is noise on
 * the many tenants that define no fields. It also hides when the definitions
 * could not be read at all — a rail decoration must not turn a detail screen
 * into an error page, and the record itself is unaffected.
 *
 * Editing lives in the record's own drawer, where per-operation requirement
 * flags apply. A missing value keeps its label: "not recorded" and "no such
 * field" are different facts.
 */
export function CustomFieldsCard({
  branchId,
  ownerType,
  ownerId,
}: CustomFieldsCardProps) {
  const { t, lang } = useI18n();
  const { entries, isLoading, error } = useCrmCustomFieldValues(
    branchId,
    ownerType,
    ownerId,
  );

  if (isLoading) {
    return <Skeleton className="h-24 rounded-md" />;
  }
  if (error || entries.length === 0) return null;

  const fields: DetailField[] = entries.map((entry) => ({
    label: localizedName(entry.definition, lang),
    value: renderValue(entry, lang, t.crmShared.booleanYes, t.crmShared.booleanNo),
    wide: entry.definition.type === "TEXTAREA",
  }));

  return (
    <DetailSection
      title={t.crmShared.customFieldsTitle}
      fields={fields}
      columns={1}
      emptyValueLabel={t.detail.notRecorded}
    />
  );
}

/**
 * One stored value as text, by its definition's type.
 *
 * `NUMBER` goes through `formatDecimalString`, which formats the digits of a
 * string without a float round-trip — a custom field can hold an amount, and
 * `Number()` on a wire decimal loses precision silently.
 */
function renderValue(
  { definition, value }: CrmCustomFieldEntry,
  lang: Language,
  yes: string,
  no: string,
): string | null {
  const raw = value?.value;
  if (raw === null || raw === undefined || raw === "") return null;

  switch (definition.type) {
    case "BOOLEAN":
      return raw === true || raw === "true" ? yes : no;
    case "NUMBER":
      return typeof raw === "string" ? formatDecimalString(raw, lang) : String(raw);
    case "DATE":
      return typeof raw === "string" ? formatDate(raw, lang) : null;
    case "DATETIME":
      return typeof raw === "string" ? formatDateTime(raw, lang) : null;
    case "SELECT":
      return optionLabel(definition, raw, lang);
    case "MULTI_SELECT": {
      const keys = Array.isArray(raw) ? raw : [];
      const labels = keys
        .map((key) => optionLabel(definition, key, lang))
        .filter((label): label is string => label !== null);
      return labels.length > 0 ? labels.join(", ") : null;
    }
    default:
      return typeof raw === "string" ? raw : JSON.stringify(raw);
  }
}

/**
 * A stored option key rendered as its tenant-defined label.
 *
 * An unknown key renders **verbatim** rather than blank — the same honesty rule
 * `StatusBadge` applies to an unmapped wire value. A key with no matching
 * option means the definition changed after the value was stored, and hiding
 * that would make a data problem invisible.
 */
function optionLabel(
  definition: CrmCustomFieldDefinition,
  key: unknown,
  lang: Language,
): string | null {
  if (typeof key !== "string" || key.length === 0) return null;
  const option = definition.options.find((candidate) => candidate.key === key);
  return option ? localizedValue(option.nameAr, option.nameEn, lang) || key : key;
}
