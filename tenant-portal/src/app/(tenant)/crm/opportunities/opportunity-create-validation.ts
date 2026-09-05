// Client-side mirror of what `POST /opportunities` will reject, so the common
// rejections never cost a round trip and land on the field that caused them.

import {
  CrmErrorBag,
  sectionErrorCount,
  sectionOfErrorPath,
  type CrmFieldMessages,
} from "../shared/crm-form-validation";
import type { CrmFormErrors } from "../shared/hooks/useCrmCreateForm";
import { isValidOpportunityAmount, type OpportunityForm } from "./opportunity-write-contract";

export interface OpportunityCreateMessages extends CrmFieldMessages {
  /** `../shared/money`'s exact-decimal rule — the amount must survive as cents. */
  amountInvalid: string;
  /** `@IsInt() @Min(0) @Max(3)` and `@Min(0) @Max(100)`, with the bounds filled in. */
  outOfRange: string;
  currencyLength: string;
}

/** One `FormSection` id, and one key under `t.crmOpportunityDetail.create.sections`. */
export const OPPORTUNITY_SECTION_IDS = [
  "placement",
  "deal",
  "notes",
  "customFields",
] as const;

export type OpportunitySectionId = (typeof OPPORTUNITY_SECTION_IDS)[number];

const SECTION_BY_PREFIX: ReadonlyArray<readonly [string, OpportunitySectionId]> = [
  ["customerProfileId", "placement"],
  ["pipelineId", "placement"],
  ["stageId", "placement"],
  ["title", "deal"],
  ["amount", "deal"],
  ["currencyCode", "deal"],
  ["importance", "deal"],
  ["probabilityPercent", "deal"],
  ["expectedCloseDate", "deal"],
  ["description", "notes"],
  ["customFields", "customFields"],
];

export function sectionOfOpportunityError(key: string): OpportunitySectionId | null {
  return sectionOfErrorPath(SECTION_BY_PREFIX, key);
}

export function opportunitySectionErrorCount(
  errors: CrmFormErrors,
  section: OpportunitySectionId,
): number {
  return sectionErrorCount(SECTION_BY_PREFIX, errors, section);
}

function integerInRange(value: string, min: number, max: number): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max;
}

export function validateCreateOpportunity(
  form: OpportunityForm,
  messages: OpportunityCreateMessages,
  /** `fieldKey`s whose definition has a required CREATE requirement for OPPORTUNITY. */
  requiredCustomFieldKeys: readonly string[] = [],
): CrmFormErrors {
  const bag = new CrmErrorBag(messages);

  // The four the DTO marks non-optional. `branchId` is the fifth and comes from
  // the screen's branch selection, never from a field.
  bag.required("customerProfileId", form.customerProfileId);
  bag.required("pipelineId", form.pipelineId);
  bag.required("stageId", form.stageId);
  if (bag.required("title", form.title)) bag.maxLength("title", form.title, 180);

  // `@IsNumber({ maxDecimalPlaces: 2 })` on the wire, and `../shared/money`
  // owns the range where the string-to-number conversion keeps every cent.
  if (form.amount.trim().length > 0 && !isValidOpportunityAmount(form.amount)) {
    bag.set("amount", messages.amountInvalid);
  }

  // `@Length(3, 3)`. Not checked against any catalogue, because the server
  // checks against none either — `"AAA"` is stored as happily as `"SAR"`.
  const currencyCode = form.currencyCode.trim();
  if (currencyCode.length > 0 && currencyCode.length !== 3) {
    bag.set("currencyCode", messages.currencyLength);
  }

  if (!integerInRange(form.importance, 0, 3)) bag.set("importance", messages.outOfRange);
  if (!integerInRange(form.probabilityPercent, 0, 100)) {
    bag.set("probabilityPercent", messages.outOfRange);
  }

  bag.maxLength("description", form.description, 2000);

  // 422 CUSTOM_FIELD_REQUIRED — a requirement row with operation CREATE.
  for (const fieldKey of requiredCustomFieldKeys) {
    const value = form.customFields[fieldKey];
    const empty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim().length === 0) ||
      (Array.isArray(value) && value.length === 0);
    if (empty) bag.set(`customFields.${fieldKey}`, messages.required);
  }

  return bag.errors;
}
