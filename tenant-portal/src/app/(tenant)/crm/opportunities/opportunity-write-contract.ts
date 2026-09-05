// Request builders for the opportunity writes — MASTER-PLAN 8.11 and 8.12.
//
// Keys copied from `crm-app/src/crm/opportunities/dto/opportunity.dto.ts`.
// `forbidNonWhitelisted` is on, so an extra key is a 400 rather than an
// ignored field.

import { isExactMoneyDecimal, toMoneyWireNumber } from "../shared/money";
import type { OpportunityDetail } from "./opportunity-contract";

export interface OpportunityForm {
  customerProfileId: string;
  pipelineId: string;
  stageId: string;
  title: string;
  importance: string;
  amount: string;
  currencyCode: string;
  description: string;
  expectedCloseDate: string;
  probabilityPercent: string;
  /**
   * Keyed by `fieldKey`. `saveCustomFieldValues` runs with
   * `CrmFieldRequirementOperationEnum.CREATE` here too, so a definition marked
   * required-on-create fails the whole write with `422 CUSTOM_FIELD_REQUIRED`.
   * `OPPORTUNITY` is the only owner type in scope — unlike a lead, which also
   * picks up `LEAD_AND_PARTY`.
   */
  customFields: Record<string, unknown>;
}

export const EMPTY_OPPORTUNITY_FORM: OpportunityForm = {
  customerProfileId: "",
  pipelineId: "",
  stageId: "",
  title: "",
  importance: "",
  amount: "",
  currencyCode: "",
  description: "",
  expectedCloseDate: "",
  probabilityPercent: "",
  customFields: {},
};

/**
 * `amount` is the one field on this form that becomes a JSON **number**, and
 * `../shared/money` owns the range where that conversion keeps every cent —
 * defect D3. Nothing converts it on the way in: it arrives as a decimal string
 * and renders through `Money`.
 */
export function isValidOpportunityAmount(value: string): boolean {
  return isExactMoneyDecimal(value);
}

/**
 * Refusals this builder raises instead of dropping a key.
 *
 * Every one of them is a value the user typed that the API has no
 * representation for. Omitting the key made the box look saved and left the old
 * value in place — defect D8. They are thrown as codes, and
 * `useCrmErrorText` turns each into a sentence.
 */
export const OPPORTUNITY_VALUE_OUT_OF_RANGE = "CRM_VALUE_OUT_OF_RANGE";
export const OPPORTUNITY_TITLE_REQUIRED = "CRM_OPPORTUNITY_TITLE_REQUIRED";
export const OPPORTUNITY_IMPORTANCE_REQUIRED = "CRM_OPPORTUNITY_IMPORTANCE_REQUIRED";
export const OPPORTUNITY_CURRENCY_INVALID = "CRM_OPPORTUNITY_CURRENCY_INVALID";
/**
 * `OpportunitiesService.amountValue` is `String(dto.amount)`, and it runs
 * whenever `amount` is not `undefined` — so a null reaches `numeric(18,2)` as
 * the literal text `"null"`. There is no way to empty this column through the
 * API, and pretending otherwise is worse than saying so.
 */
export const OPPORTUNITY_AMOUNT_NOT_CLEARABLE = "CRM_OPPORTUNITY_AMOUNT_NOT_CLEARABLE";
/** An edited form that produced nothing to send — never a silent close. */
export const OPPORTUNITY_NOTHING_TO_SEND = "CRM_OPPORTUNITY_NOTHING_TO_SEND";

function optionalInteger(
  value: string,
  min: number,
  max: number,
): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(OPPORTUNITY_VALUE_OUT_OF_RANGE);
  }
  return parsed;
}

export interface CreateOpportunityRequest {
  branchId: string;
  customerProfileId: string;
  pipelineId: string;
  stageId: string;
  title: string;
  importance?: number;
  amount?: number;
  currencyCode?: string;
  description?: string;
  expectedCloseDate?: string;
  probabilityPercent?: number;
  customFields?: Record<string, unknown>;
}

export function buildCreateOpportunityRequest(
  form: OpportunityForm,
  branchId: string,
): CreateOpportunityRequest {
  const request: CreateOpportunityRequest = {
    branchId,
    customerProfileId: form.customerProfileId,
    pipelineId: form.pipelineId,
    stageId: form.stageId,
    title: form.title.trim(),
  };
  const importance = optionalInteger(form.importance, 0, 3);
  const amount = toMoneyWireNumber(form.amount);
  const probabilityPercent = optionalInteger(form.probabilityPercent, 0, 100);
  const currencyCode = form.currencyCode.trim().toUpperCase();
  const description = form.description.trim();
  const expectedCloseDate = form.expectedCloseDate.trim();

  if (importance !== undefined) request.importance = importance;
  if (amount !== undefined) request.amount = amount;
  if (probabilityPercent !== undefined) {
    request.probabilityPercent = probabilityPercent;
  }
  if (currencyCode.length === 3) request.currencyCode = currencyCode;
  if (description.length > 0) request.description = description;
  if (expectedCloseDate.length > 0) request.expectedCloseDate = expectedCloseDate;

  const customFields = Object.entries(form.customFields).filter(([, value]) => {
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
  if (customFields.length > 0) request.customFields = Object.fromEntries(customFields);
  return request;
}

/**
 * `UpdateOpportunityDto`.
 *
 * **No `pipelineId` and no `stageId`.** A stage move is `POST /:id/stage` and a
 * pipeline change is `PUT /:id/pipeline`; sending either through the patch is a
 * 400, and both derive `status` server-side from the destination stage's flag.
 * `customerProfileId` is create-only for the same reason — an opportunity does
 * not change customer.
 */
/**
 * Three states per key, not two — defect D8:
 *
 *   absent   the box was not touched, and the stored value survives;
 *   `null`   the box was emptied, and the stored value is cleared;
 *   a value  the box was set.
 *
 * `null` is spelled out for exactly the three columns the API can empty.
 * `@IsOptional()` skips validation for `null` as well as `undefined`, and
 * `OpportunitiesService.update` keys its patch on `!== undefined`, so a null
 * reaches the (nullable) column. `title`, `importance` and `amount` are not in
 * that set and are refused rather than dropped.
 */
export interface UpdateOpportunityRequest {
  title?: string;
  importance?: number;
  amount?: number;
  currencyCode?: string | null;
  description?: string;
  expectedCloseDate?: string | null;
  probabilityPercent?: number | null;
}

export function toOpportunityForm(item: OpportunityDetail): OpportunityForm {
  return {
    customerProfileId: item.customerProfileId,
    pipelineId: item.pipelineId,
    stageId: item.stageId,
    title: item.title,
    importance: String(item.importance),
    // The decimal string goes into the text input verbatim. Formatting it here
    // would round-trip it through a locale and back, which is exactly the
    // precision loss the string form exists to prevent.
    amount: item.amount ?? "",
    currencyCode: item.currencyCode ?? "",
    description: item.description ?? "",
    expectedCloseDate: item.expectedCloseDate ?? "",
    probabilityPercent:
      item.probabilityPercent === null ? "" : String(item.probabilityPercent),
    // The edit drawer does not write custom fields — the detail screen's own
    // rail owns them — so the baseline is always empty here and the PATCH
    // builder never looks at it.
    customFields: {},
  };
}

/** Every `OpportunityForm` key the PATCH builder diffs, i.e. the string ones. */
type OpportunityTextField = Exclude<keyof OpportunityForm, "customFields">;

/** Only the changed keys, so a concurrent edit to another field survives. */
export function buildUpdateOpportunityRequest(
  form: OpportunityForm,
  baseline: OpportunityForm,
): UpdateOpportunityRequest {
  const request: UpdateOpportunityRequest = {};
  const changed = (key: OpportunityTextField): string | null =>
    form[key].trim() === baseline[key].trim() ? null : form[key].trim();

  const title = changed("title");
  if (title !== null) {
    // `@IsNotEmpty()`: there is no value that empties this column, so an
    // emptied box is a refusal the user is told about rather than a key that
    // quietly does not travel.
    if (title.length === 0) throw new Error(OPPORTUNITY_TITLE_REQUIRED);
    request.title = title;
  }

  const description = changed("description");
  // `@IsString() @MaxLength(2000)` with no `@IsNotEmpty()`, so "" clears it.
  if (description !== null) request.description = description;

  const currencyCode = changed("currencyCode");
  if (currencyCode !== null) {
    const code = currencyCode.toUpperCase();
    if (code.length === 0) request.currencyCode = null;
    else if (code.length === 3) request.currencyCode = code;
    else throw new Error(OPPORTUNITY_CURRENCY_INVALID);
  }

  const expectedCloseDate = changed("expectedCloseDate");
  if (expectedCloseDate !== null) {
    // "" is `@IsDateString()`'s 400. Clearing the picker sends null instead.
    request.expectedCloseDate =
      expectedCloseDate.length > 0 ? expectedCloseDate : null;
  }

  const importance = changed("importance");
  if (importance !== null) {
    // `smallint NOT NULL DEFAULT 0` — a null would be a constraint violation,
    // so an emptied star rating has no meaning to send.
    if (importance.length === 0) throw new Error(OPPORTUNITY_IMPORTANCE_REQUIRED);
    request.importance = optionalInteger(importance, 0, 3);
  }

  const probabilityPercent = changed("probabilityPercent");
  if (probabilityPercent !== null) {
    request.probabilityPercent =
      probabilityPercent.length > 0
        ? optionalInteger(probabilityPercent, 0, 100)
        : null;
  }

  const amount = changed("amount");
  if (amount !== null) {
    if (amount.length === 0) throw new Error(OPPORTUNITY_AMOUNT_NOT_CLEARABLE);
    request.amount = toMoneyWireNumber(amount);
  }
  return request;
}

/**
 * `TransferOpportunityPipelineDto` — MASTER-PLAN 8.12.
 *
 * `stageId` is optional: omitting it lands the opportunity in the target
 * pipeline's entry stage, which is the destructive part the confirmation
 * exists for.
 */
export interface TransferPipelineRequest {
  pipelineId: string;
  stageId?: string;
  reason?: string;
}

export function buildTransferPipelineRequest(input: {
  pipelineId: string;
  stageId: string;
  reason: string;
}): TransferPipelineRequest {
  const request: TransferPipelineRequest = { pipelineId: input.pipelineId };
  if (input.stageId.length > 0) request.stageId = input.stageId;
  const reason = input.reason.trim();
  if (reason.length > 0) request.reason = reason;
  return request;
}
