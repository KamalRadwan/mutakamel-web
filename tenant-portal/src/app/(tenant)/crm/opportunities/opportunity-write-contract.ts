// Request builders for the opportunity writes — MASTER-PLAN 8.11 and 8.12.
//
// Keys copied from `crm-app/src/crm/opportunities/dto/opportunity.dto.ts`.
// `forbidNonWhitelisted` is on, so an extra key is a 400 rather than an
// ignored field.

import type { CardColor } from "@/design-system";
import { isUUIDv7 } from "@/lib/uuid";
import { isValidOpportunityCurrency, isValidOpportunityDate, opportunityAmountNumber, opportunityOptionalInteger } from "./opportunity-form-values";
import type { OpportunityDetail } from "./opportunity-contract";

export { isValidOpportunityAmount } from "./opportunity-form-values";

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
  ownerUserId?: string;
  contactPartyId?: string;
  leadId?: string;
  cardColor?: CardColor | null;
  expectedUpdatedAt?: string;
  tagIds?: string[];
  /** Active OPPORTUNITY values, keyed by fieldKey, with operation-specific requirements. */
  customFields: Record<string, unknown>;
}

export const EMPTY_OPPORTUNITY_FORM: OpportunityForm = {
  customerProfileId: "",
  pipelineId: "",
  stageId: "",
  title: "",
  importance: "0",
  amount: "",
  currencyCode: "",
  description: "",
  expectedCloseDate: "",
  probabilityPercent: "",
  ownerUserId: "",
  contactPartyId: "",
  leadId: "",
  tagIds: [],
  customFields: {},
};

// Refusals are localized by useCrmErrorText, never rendered as raw constants.
export const OPPORTUNITY_VALUE_OUT_OF_RANGE = "CRM_VALUE_OUT_OF_RANGE";
export const OPPORTUNITY_TITLE_REQUIRED = "CRM_OPPORTUNITY_TITLE_REQUIRED";
export const OPPORTUNITY_IMPORTANCE_REQUIRED = "CRM_OPPORTUNITY_IMPORTANCE_REQUIRED";
export const OPPORTUNITY_CURRENCY_INVALID = "CRM_OPPORTUNITY_CURRENCY_INVALID";
/** An edited form that produced nothing to send — never a silent close. */
export const OPPORTUNITY_NOTHING_TO_SEND = "CRM_OPPORTUNITY_NOTHING_TO_SEND";

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
  ownerUserId?: string;
  contactPartyId?: string;
  leadId?: string;
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
  const importance = opportunityOptionalInteger(form.importance, 0, 3);
  const amount = opportunityAmountNumber(form.amount, form.currencyCode);
  const probabilityPercent = opportunityOptionalInteger(form.probabilityPercent, 0, 100);
  const currencyCode = form.currencyCode.trim().toUpperCase();
  const description = form.description.trim();
  const expectedCloseDate = form.expectedCloseDate.trim();
  const ownerUserId = (form.ownerUserId ?? "").trim();
  if (!request.title || request.title.length > 180) throw new Error(OPPORTUNITY_TITLE_REQUIRED);
  if (description.length > 2000) throw new Error(OPPORTUNITY_VALUE_OUT_OF_RANGE);
  if (currencyCode && !isValidOpportunityCurrency(currencyCode)) throw new Error(OPPORTUNITY_CURRENCY_INVALID);
  if (expectedCloseDate && !isValidOpportunityDate(expectedCloseDate)) throw new Error(OPPORTUNITY_VALUE_OUT_OF_RANGE);

  if (importance !== undefined) request.importance = importance;
  if (amount !== undefined) request.amount = amount;
  if (probabilityPercent !== undefined) {
    request.probabilityPercent = probabilityPercent;
  }
  if (currencyCode) request.currencyCode = currencyCode;
  if (description.length > 0) request.description = description;
  if (expectedCloseDate.length > 0) request.expectedCloseDate = expectedCloseDate;
  for (const [key, value] of [["ownerUserId", ownerUserId], ["contactPartyId", form.contactPartyId], ["leadId", form.leadId]] as const) {
    if (!value?.trim()) continue;
    if (!isUUIDv7(value)) throw new Error(OPPORTUNITY_VALUE_OUT_OF_RANGE);
    request[key] = value;
  }

  const customFields = Object.entries(form.customFields).filter(([, value]) => {
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
  if (customFields.length > 0) request.customFields = Object.fromEntries(customFields);
  return request;
}

// Omission preserves; null clears only fields the DTO permits. Stage/pipeline
// have separate lifecycle commands; customer and source lead are immutable.
export interface UpdateOpportunityRequest {
  title?: string;
  importance?: number;
  amount?: number | null;
  currencyCode?: string | null;
  description?: string;
  expectedCloseDate?: string | null;
  probabilityPercent?: number | null;
  customFields?: Record<string, unknown>;
  ownerUserId?: string;
  contactPartyId?: string | null;
  cardColor?: CardColor | null;
  expectedUpdatedAt?: string;
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
    ownerUserId: item.ownerUserId ?? "",
    contactPartyId: item.contactPartyId ?? "",
    leadId: item.leadId ?? "",
    cardColor: item.cardColor,
    expectedUpdatedAt: item.updatedAt,
    // Values have their own read endpoint; the edit hook supplies the stored
    // baseline after loading both definitions and values.
    customFields: {},
  };
}

/** Every `OpportunityForm` key the PATCH builder diffs, i.e. the string ones. */
type OpportunityTextField = Exclude<
  keyof OpportunityForm,
  "customFields" | "ownerUserId" | "tagIds" | "contactPartyId" | "leadId" | "cardColor" | "expectedUpdatedAt"
>;

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
    if (title.length === 0 || title.length > 180) throw new Error(OPPORTUNITY_TITLE_REQUIRED);
    request.title = title;
  }

  const description = changed("description");
  // `@IsString() @MaxLength(2000)` with no `@IsNotEmpty()`, so "" clears it.
  if (description !== null) {
    if (description.length > 2000) throw new Error(OPPORTUNITY_VALUE_OUT_OF_RANGE);
    request.description = description;
  }

  const currencyCode = changed("currencyCode");
  if (currencyCode !== null) {
    const code = currencyCode.toUpperCase();
    if (code.length === 0) {
      if (form.amount.trim()) throw new Error("OPPORTUNITY_AMOUNT_CURRENCY_REQUIRED");
      request.currencyCode = null;
      // The DTO requires this even when the stored amount is already empty.
      request.amount = null;
    } else if (isValidOpportunityCurrency(code)) request.currencyCode = code;
    else throw new Error(OPPORTUNITY_CURRENCY_INVALID);
  }

  const expectedCloseDate = changed("expectedCloseDate");
  if (expectedCloseDate !== null) {
    if (expectedCloseDate && !isValidOpportunityDate(expectedCloseDate)) throw new Error(OPPORTUNITY_VALUE_OUT_OF_RANGE);
    // "" is `@IsDateString()`'s 400. Clearing the picker sends null instead.
    request.expectedCloseDate =
      expectedCloseDate.length > 0 ? expectedCloseDate : null;
  }

  const importance = changed("importance");
  if (importance !== null) {
    // `smallint NOT NULL DEFAULT 0` — a null would be a constraint violation,
    // so an emptied star rating has no meaning to send.
    if (importance.length === 0) throw new Error(OPPORTUNITY_IMPORTANCE_REQUIRED);
    request.importance = opportunityOptionalInteger(importance, 0, 3);
  }

  const probabilityPercent = changed("probabilityPercent");
  if (probabilityPercent !== null) {
    request.probabilityPercent =
      probabilityPercent.length > 0
        ? opportunityOptionalInteger(probabilityPercent, 0, 100)
        : null;
  }

  const amount = changed("amount");
  if (amount !== null) {
    if (amount.length === 0) request.amount = null;
    else {
      if (!form.currencyCode.trim()) throw new Error("OPPORTUNITY_AMOUNT_CURRENCY_REQUIRED");
      request.amount = opportunityAmountNumber(amount, form.currencyCode);
    }
  } else if (currencyCode !== null && form.amount.trim()) {
    // A currency-only change still has to fit the retained amount's scale.
    opportunityAmountNumber(form.amount, form.currencyCode);
  }
  const owner = form.ownerUserId ?? "";
  if (owner !== (baseline.ownerUserId ?? "")) {
    if (!isUUIDv7(owner)) throw new Error(OPPORTUNITY_VALUE_OUT_OF_RANGE);
    request.ownerUserId = owner;
  }
  const contact = form.contactPartyId ?? "";
  if (contact !== (baseline.contactPartyId ?? "")) {
    if (contact && !isUUIDv7(contact)) throw new Error(OPPORTUNITY_VALUE_OUT_OF_RANGE);
    request.contactPartyId = contact || null;
  }
  if ((form.cardColor ?? null) !== (baseline.cardColor ?? null)) request.cardColor = form.cardColor ?? null;
  // Omitted keys retain their stored values; null explicitly clears a value.
  const customFields = Object.entries(form.customFields).filter(
    ([key, value]) =>
      value !== undefined &&
      JSON.stringify(value) !== JSON.stringify(baseline.customFields[key]),
  );
  if (customFields.length > 0) request.customFields = Object.fromEntries(customFields);
  if (Object.keys(request).length > 0 && baseline.expectedUpdatedAt) request.expectedUpdatedAt = baseline.expectedUpdatedAt;
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
