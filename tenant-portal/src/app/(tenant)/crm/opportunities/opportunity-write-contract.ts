// Request builders for the opportunity writes — MASTER-PLAN 8.11 and 8.12.
//
// Keys copied from `crm-app/src/crm/opportunities/dto/opportunity.dto.ts`.
// `forbidNonWhitelisted` is on, so an extra key is a 400 rather than an
// ignored field.

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
};

/**
 * A decimal with at most two places whose integer part stays below 2^53.
 *
 * See `conversionAmount` in the lead write contract for why a conversion to
 * `number` is unavoidable on the way **out** and why it is exact under this
 * guard. Nothing ever converts the value on the way in — `amount` arrives as a
 * decimal string and renders through `Money`.
 */
const SAFE_DECIMAL = /^\d{1,15}(\.\d{1,2})?$/;

export function isValidOpportunityAmount(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || SAFE_DECIMAL.test(trimmed);
}

function optionalAmount(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (!SAFE_DECIMAL.test(trimmed)) {
    throw new Error("Opportunity amount must be a decimal with at most 2 places.");
  }
  return Number(trimmed);
}

function optionalInteger(
  value: string,
  min: number,
  max: number,
): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error("Value is outside the range this field accepts.");
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
  const amount = optionalAmount(form.amount);
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
export interface UpdateOpportunityRequest {
  title?: string;
  importance?: number;
  amount?: number;
  currencyCode?: string;
  description?: string;
  expectedCloseDate?: string;
  probabilityPercent?: number;
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
  };
}

const PATCHABLE_TEXT_FIELDS = ["title", "currencyCode", "description", "expectedCloseDate"] as const;
const PATCHABLE_NUMBER_FIELDS = [
  { key: "importance", min: 0, max: 3 },
  { key: "probabilityPercent", min: 0, max: 100 },
] as const;

/** Only the changed keys, so a concurrent edit to another field survives. */
export function buildUpdateOpportunityRequest(
  form: OpportunityForm,
  baseline: OpportunityForm,
): UpdateOpportunityRequest {
  const request: UpdateOpportunityRequest = {};

  for (const key of PATCHABLE_TEXT_FIELDS) {
    const next = form[key].trim();
    if (next === baseline[key].trim()) continue;
    // `@IsNotEmpty()` on `title` means an emptied box has no representation the
    // server accepts, so it is omitted rather than sent as "".
    if (key === "title" && next.length === 0) continue;
    if (key === "currencyCode") {
      const code = next.toUpperCase();
      if (code.length === 3) request.currencyCode = code;
      continue;
    }
    request[key] = next;
  }

  for (const { key, min, max } of PATCHABLE_NUMBER_FIELDS) {
    const next = form[key].trim();
    if (next === baseline[key].trim()) continue;
    const parsed = optionalInteger(next, min, max);
    if (parsed !== undefined) request[key] = parsed;
  }

  const amount = form.amount.trim();
  if (amount !== baseline.amount.trim()) {
    const parsed = optionalAmount(amount);
    if (parsed !== undefined) request.amount = parsed;
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
