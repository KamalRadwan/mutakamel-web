// Request builders for `PATCH /leads/:id` and `POST /leads/:id/convert`.
//
// `forbidNonWhitelisted: true` is on (crm-app/src/main.ts), so an undocumented
// key is a 400 rather than a silently-ignored field. Every key below is copied
// from `crm-app/src/crm/leads/dto/lead.dto.ts` and nothing else is sent.

import { isUUIDv7 } from "@/lib/uuid";
import type {
  CrmContactMethodType,
  CrmProfileType,
} from "./lead-contract";
import { CRM_CONTACT_METHOD_TYPES } from "./lead-contract";

/**
 * `UpdateLeadDto`, in full.
 *
 * Three absences are load-bearing and none of them is an oversight:
 *
 * - **no `stageId`** — a stage move is `POST /leads/:id/stage`, which derives
 *   lifecycle `status` from the destination stage's semantic flag;
 * - **no `status`** — same reason, it is derived and never set;
 * - **no `companyPhone`** — the update DTO takes the `companyPhones` array
 *   only, while `CreateLeadDto` takes both. Sending the singular here is a 400.
 */
export interface UpdateLeadRequest {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  honorificTitle?: string | null;
  primaryMobile?: string | null;
  email?: string | null;
  companyName?: string;
  acquisitionSourceId?: string | null;
  description?: string;
  interestSummary?: string;
  expectedNeed?: string;
}

export interface LeadEditForm {
  displayName: string;
  firstName: string;
  lastName: string;
  honorificTitle: string;
  primaryMobile: string;
  email: string;
  companyName: string;
  acquisitionSourceId: string;
  description: string;
  interestSummary: string;
  expectedNeed: string;
}

const NULLABLE_TEXT_FIELDS = [
  "honorificTitle",
  "primaryMobile",
  "email",
] as const;

/**
 * The changed fields only.
 *
 * A PATCH that resends every field would overwrite a value another user
 * changed between load and save, and `@IsNotEmpty()` on `displayName` and
 * `companyName` means an emptied box cannot be sent as `""` — it is simply
 * omitted, because those two have no documented way to be cleared. The three
 * fields the DTO types as `string | null` are cleared with an explicit `null`.
 */
export function buildUpdateLeadRequest(
  form: LeadEditForm,
  baseline: LeadEditForm,
): UpdateLeadRequest {
  const request: UpdateLeadRequest = {};
  const assign = <K extends keyof UpdateLeadRequest>(
    key: K,
    value: UpdateLeadRequest[K],
  ) => {
    request[key] = value;
  };

  for (const key of Object.keys(form) as Array<keyof LeadEditForm>) {
    const next = form[key].trim();
    if (next === baseline[key].trim()) continue;

    if (key === "acquisitionSourceId") {
      assign("acquisitionSourceId", next.length > 0 ? next : null);
      continue;
    }
    if ((NULLABLE_TEXT_FIELDS as readonly string[]).includes(key)) {
      assign(key as (typeof NULLABLE_TEXT_FIELDS)[number], next.length > 0 ? next : null);
      continue;
    }
    if (next.length === 0 && (key === "displayName" || key === "companyName")) {
      continue;
    }
    assign(key as "description" | "interestSummary" | "expectedNeed", next);
  }
  return request;
}

interface ConversionContactMethod {
  methodType: CrmContactMethodType;
  value: string;
  label?: string;
}

interface ConversionContact {
  fullName: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  email?: string;
  contactMethods?: ConversionContactMethod[];
}

interface ConversionOpportunity {
  pipelineId: string;
  stageId: string;
  title: string;
  importance?: number;
  amount?: number;
  currencyCode?: string;
  expectedCloseDate?: string;
  probabilityPercent?: number;
  description?: string;
}

export interface ConvertLeadRequest {
  profileType: CrmProfileType;
  displayName?: string;
  companyName?: string;
  primaryContact?: ConversionContact;
  createOpportunity?: boolean;
  opportunity?: ConversionOpportunity;
}

export interface LeadConversionForm {
  profileType: CrmProfileType;
  displayName: string;
  companyName: string;
  contactFullName: string;
  contactJobTitle: string;
  contactEmail: string;
  contactMethods: ConversionContactMethod[];
  createOpportunity: boolean;
  pipelineId: string;
  stageId: string;
  title: string;
  amount: string;
  currencyCode: string;
  expectedCloseDate: string;
}

/** `@ArrayMaxSize(20)` on `contactMethods`. Enforced here so the 422 never happens. */
const CONVERSION_CONTACT_METHODS_MAX = 20;

/**
 * A decimal with at most two places and an integer part small enough to survive
 * `Number()` exactly.
 *
 * 15 integer digits is the widest value below 2^53, so a string that matches
 * this converts without losing a unit. See `conversionAmount` for why a
 * conversion is unavoidable at all.
 */
const SAFE_DECIMAL = /^\d{1,15}(\.\d{1,2})?$/;

export function isValidConversionAmount(value: string): boolean {
  return value.trim().length === 0 || SAFE_DECIMAL.test(value.trim());
}

/**
 * The one place this app turns a decimal string into a number, and the reason
 * it is not a violation of "never `Number()` a decimal string".
 *
 * That rule protects values coming **off the wire**, where precision loss is
 * silent and unrecoverable. This is the opposite direction:
 * `ConvertLeadOpportunityDto.amount` is `@IsNumber({ maxDecimalPlaces: 2 })`,
 * so JSON must carry a number and there is no string form the backend accepts.
 * `SAFE_DECIMAL` bounds the input so the conversion is exact, and the value
 * that comes back is a decimal string again, rendered through `Money` and
 * never converted.
 */
function conversionAmount(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (!SAFE_DECIMAL.test(trimmed)) {
    throw new Error("Opportunity amount must be a decimal with at most 2 places.");
  }
  return Number(trimmed);
}

export function buildConvertLeadRequest(
  form: LeadConversionForm,
): ConvertLeadRequest {
  const request: ConvertLeadRequest = { profileType: form.profileType };

  const displayName = form.displayName.trim();
  const companyName = form.companyName.trim();
  if (displayName.length > 0) request.displayName = displayName;
  // `CORPORATE` is the only shape that carries a company name; sending one on
  // an individual conversion would create an organization the user did not ask
  // for.
  if (form.profileType === "CORPORATE" && companyName.length > 0) {
    request.companyName = companyName;
  }

  const contact = buildConversionContact(form);
  if (contact) request.primaryContact = contact;

  request.createOpportunity = form.createOpportunity;
  if (form.createOpportunity) {
    const opportunity: ConversionOpportunity = {
      pipelineId: form.pipelineId,
      stageId: form.stageId,
      title: form.title.trim(),
    };
    const amount = conversionAmount(form.amount);
    if (amount !== undefined) opportunity.amount = amount;
    const currencyCode = form.currencyCode.trim().toUpperCase();
    if (currencyCode.length === 3) opportunity.currencyCode = currencyCode;
    const expectedCloseDate = form.expectedCloseDate.trim();
    if (expectedCloseDate.length > 0) {
      opportunity.expectedCloseDate = expectedCloseDate;
    }
    request.opportunity = opportunity;
  }
  return request;
}

function buildConversionContact(
  form: LeadConversionForm,
): ConversionContact | undefined {
  const fullName = form.contactFullName.trim();
  if (fullName.length === 0) return undefined;

  const contact: ConversionContact = { fullName };
  const jobTitle = form.contactJobTitle.trim();
  const email = form.contactEmail.trim();
  if (jobTitle.length > 0) contact.jobTitle = jobTitle;
  if (email.length > 0) contact.email = email;

  const contactMethods = form.contactMethods
    .filter(
      (method) =>
        method.value.trim().length > 0 &&
        CRM_CONTACT_METHOD_TYPES.includes(method.methodType),
    )
    .slice(0, CONVERSION_CONTACT_METHODS_MAX)
    .map((method) => ({
      methodType: method.methodType,
      value: method.value.trim(),
      ...(method.label && method.label.trim().length > 0
        ? { label: method.label.trim() }
        : {}),
    }));
  if (contactMethods.length > 0) contact.contactMethods = contactMethods;
  return contact;
}

export interface LeadConversionResult {
  customerProfileId: string;
  opportunityId: string | null;
}

/**
 * `201 { lead, customerProfile, opportunity }`.
 *
 * Only the two new-record ids are kept: the success panel exists to hand the
 * user a link to each, and `detail-screens.md` is explicit that a toast is the
 * wrong surface because it takes the only reference to two freshly-created
 * records away with it after four seconds.
 *
 * `opportunity` is absent whenever `createOpportunity` was off, so a missing
 * one is a normal outcome rather than a malformed response.
 */
export function parseLeadConversionResponse(
  payload: unknown,
): LeadConversionResult {
  const result =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  const customerProfile =
    result && typeof result.customerProfile === "object" && result.customerProfile
      ? (result.customerProfile as Record<string, unknown>)
      : null;
  if (!customerProfile || !isUUIDv7(customerProfile.id)) {
    throw new Error("Invalid lead conversion response.");
  }
  const opportunity =
    result && typeof result.opportunity === "object" && result.opportunity
      ? (result.opportunity as Record<string, unknown>)
      : null;
  return {
    customerProfileId: customerProfile.id,
    opportunityId:
      opportunity && isUUIDv7(opportunity.id) ? opportunity.id : null,
  };
}
