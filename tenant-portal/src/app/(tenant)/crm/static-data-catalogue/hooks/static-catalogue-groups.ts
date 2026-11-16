import type { Language } from "@/i18n/I18nContext";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { formatBytes } from "@/lib/format/number";
import type { CrmStaticData } from "./static-catalogue-contract";

export interface StaticCatalogueRule {
  key: string;
  stage: string;
  status: string;
  tone: "positive" | "negative" | "caution" | "neutral";
}

export interface StaticCatalogueGroup {
  id: string;
  key: string;
  label: string;
  technicalValues: string[];
  kind: "enum" | "permission" | "owner" | "event" | "attachment" | "rule";
  entriesCount: number;
  values: string[];
  sizeLabel?: string;
  rules?: StaticCatalogueRule[];
}

// Presentation order only: groups and their values still come from the response.
const GROUP_ORDER = [
  "profileTypes", "customerStatuses", "leadStatuses", "leadStageFlags", "opportunityStatuses",
  "opportunityStageFlags", "customFieldOwnerTypes", "customFieldTypes", "fieldRequirementOperations",
  "attachmentPolicy", "opportunityStatusByStageFlag", "activityTypes", "activityStatuses",
  "permissions", "ownerTypeOptions", "eventOptions", "rejectedAttachmentFamilies",
  "leadConversionCopiesCustomFieldOwnerType",
];

export function buildStaticCatalogueGroups(
  data: CrmStaticData, lang: Language, untranslatedNote: string, copy: Dictionary["crmStaticCatalogue"],
): StaticCatalogueGroup[] {
  const group = (id: string, kind: StaticCatalogueGroup["kind"], values: string[], technicalValues: string[]): StaticCatalogueGroup => ({
    id, key: id, label: copy.groups[id] ?? copy.otherGroup, kind, values,
    entriesCount: values.length, technicalValues,
  });
  const fromOptions = (id: string, kind: StaticCatalogueGroup["kind"], items: CrmStaticData["permissionOptions"]) =>
    group(id, kind, items.map((item) => item.label[lang]), items.map((item) => item.value));
  const optionLabel = (items: CrmStaticData["permissionOptions"] | undefined, value: string) =>
    items?.find((item) => item.value === value)?.label[lang] ?? copy.unavailableValue;
  const tones: Record<string, StaticCatalogueRule["tone"]> = { WON: "positive", LOST: "negative", ON_HOLD: "caution" };
  const rules = Object.entries(data.derivedRules.opportunityStatusByStageFlag).map(([flag, status]) => ({
    key: flag,
    stage: flag === "default" ? copy.otherStages : optionLabel(data.enumOptions.opportunityStageFlags, flag),
    status: optionLabel(data.enumOptions.opportunityStatuses, status), tone: tones[status] ?? "neutral",
  }));
  const permissions = fromOptions("permissions", "permission", data.permissionOptions);
  // Identical permission labels are the server's untranslated fallback, not an Arabic translation.
  permissions.values = data.permissionOptions.map((item) => item.label.ar === item.label.en
    ? `${item.label[lang]} — ${untranslatedNote}` : item.label[lang]);
  const attachment = fromOptions("attachmentPolicy", "attachment", data.attachmentPolicy.familyLabels);
  attachment.sizeLabel = formatBytes(data.attachmentPolicy.maxSizeBytes, lang);
  attachment.technicalValues.push(String(data.attachmentPolicy.maxSizeBytes));
  const derived = group("opportunityStatusByStageFlag", "rule", rules.map((rule) => `${rule.stage} → ${rule.status}`),
    Object.entries(data.derivedRules.opportunityStatusByStageFlag).map(([flag, status]) => `${flag} → ${status}`));
  derived.rules = rules;
  const result = [
    ...Object.entries(data.enumOptions).map(([key, items]) => fromOptions(key, "enum", items)), permissions,
    fromOptions("ownerTypeOptions", "owner", data.ownerTypeOptions), fromOptions("eventOptions", "event", data.eventOptions),
    attachment, fromOptions("rejectedAttachmentFamilies", "attachment", data.attachmentPolicy.rejectedFamilyLabels), derived,
    group("leadConversionCopiesCustomFieldOwnerType", "rule", [optionLabel(data.enumOptions.customFieldOwnerTypes,
      data.derivedRules.leadConversionCopiesCustomFieldOwnerType)], [data.derivedRules.leadConversionCopiesCustomFieldOwnerType]),
  ];
  const rank = (key: string) => { const index = GROUP_ORDER.indexOf(key); return index < 0 ? GROUP_ORDER.length : index; };
  return result.sort((a, b) => rank(a.key) - rank(b.key));
}

export function filterStaticCatalogueGroups(groups: StaticCatalogueGroup[], search: string, lang: Language) {
  const query = search.trim().toLocaleLowerCase(lang);
  return query ? groups.filter((item) => [item.key, item.label, ...item.values, ...item.technicalValues,
    item.sizeLabel ?? ""].some((value) => value.toLocaleLowerCase(lang).includes(query))) : groups;
}
