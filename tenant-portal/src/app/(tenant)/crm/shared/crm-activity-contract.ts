// Core Activities wire contract for all CRM entities (Leads, Opportunities, Customer Profiles).
//
//   GET  /api/tenant/core/v1/activities
//          ?targetApp=CRM&targetType=<type>&targetId=<id>&status=PLANNED
//   POST /api/tenant/core/v1/activities   -> 201
//   POST /api/tenant/core/v1/activities/:id/complete -> 200
//   POST /api/tenant/core/v1/activities/:id/cancel   -> 200

import type { CorePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";

export const CRM_ACTIVITIES_PATH: CorePath = "/api/tenant/core/v1/activities";

export const CRM_ACTIVITY_READ_PERMISSION = "activities.read";
export const CRM_ACTIVITY_CREATE_PERMISSION = "activities.create";
export const CRM_ACTIVITY_UPDATE_PERMISSION = "activities.update";
export const CRM_ACTIVITY_COMPLETE_PERMISSION = "activities.complete";
export const CRM_ACTIVITY_CANCEL_PERMISSION = "activities.cancel";

export type CrmTargetType = "LEAD" | "OPPORTUNITY" | "CUSTOMER_PROFILE";

export function crmActivityPath(activityId: string): CorePath {
  if (!isUUIDv7(activityId)) invalid();
  return `${CRM_ACTIVITIES_PATH}/${activityId}` as CorePath;
}

export function crmActivityCompletePath(activityId: string): CorePath {
  return `${crmActivityPath(activityId)}/complete` as CorePath;
}

export function crmActivityCancelPath(activityId: string): CorePath {
  return `${crmActivityPath(activityId)}/cancel` as CorePath;
}

export const CRM_ACTIVITY_TYPES = [
  "TODO",
  "CALL",
  "MEETING",
  "EMAIL",
  "VISIT",
  "FOLLOW_UP",
  "OTHER",
] as const;

export const CRM_ACTIVITY_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export type CrmActivityType = (typeof CRM_ACTIVITY_TYPES)[number];
export type CrmActivityPriority = (typeof CRM_ACTIVITY_PRIORITIES)[number];

export const CRM_ACTIVITY_SUBJECT_MAX = 180;
export const CRM_ACTIVITY_DESCRIPTION_MAX = 4000;
export const CRM_ACTIVITY_PAGE_SIZE = 25;
export const CRM_ACTIVITY_RESPONSE_LIMIT_BYTES = 256 * 1024;

export interface CrmPlannedActivity {
  id: string;
  subject: string;
  type: string;
  priority: string;
  dueAt: string;
  description: string;
  version: number;
}

export interface CrmActivityForm {
  type: CrmActivityType;
  subject: string;
  dueAt: string;
  priority: CrmActivityPriority;
  description: string;
}

export const EMPTY_CRM_ACTIVITY_FORM: CrmActivityForm = {
  type: "TODO",
  subject: "",
  dueAt: "",
  priority: "NORMAL",
  description: "",
};

export type CrmActivityErrorCode = "required" | "maxLength" | "past";

export type CrmActivityErrors = Partial<
  Record<"subject" | "dueAt", CrmActivityErrorCode>
>;

export interface CrmActivityTarget {
  id: string;
  name: string;
  targetType: CrmTargetType;
}

function invalid(): never {
  throw new Error("Invalid activities response.");
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredText(row: Record<string, unknown>, key: string, max: number): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0 || value.length > max) invalid();
  return value;
}

export function crmPlannedActivitiesQuery(targetId: string, targetType: CrmTargetType, page = 1): string {
  if (!Number.isSafeInteger(page) || page < 1) throw new Error("Invalid activity page.");
  if (!isUUIDv7(targetId)) invalid();
  return new URLSearchParams({
    page: String(page),
    limit: String(CRM_ACTIVITY_PAGE_SIZE),
    targetApp: "CRM",
    targetType,
    targetId,
    status: "PLANNED",
    sortBy: "dueAt",
    sortDir: "ASC",
  }).toString();
}

export function parseActivityRow(value: unknown): CrmPlannedActivity {
  const parsed = record(value);
  if (!parsed || !isUUIDv7(parsed.id)) invalid();
  const rawVersion = parsed.version;
  if (typeof rawVersion !== "number" || !Number.isSafeInteger(rawVersion) || rawVersion < 1) invalid();

  const description = parsed.description;
  if (description !== undefined && description !== null && typeof description !== "string") invalid();

  return {
    id: parsed.id,
    subject: requiredText(parsed, "subject", CRM_ACTIVITY_SUBJECT_MAX),
    type: requiredText(parsed, "type", 64),
    priority: requiredText(parsed, "priority", 32),
    dueAt: requiredText(parsed, "dueAt", 64),
    description: typeof description === "string" ? description : "",
    version: rawVersion,
  };
}

export function parseCrmPlannedActivities(payload: unknown): CrmPlannedActivity[] {
  const body = record(payload);
  if (!body || !Array.isArray(body.items)) invalid();
  if (body.items.length > CRM_ACTIVITY_PAGE_SIZE) invalid();
  return body.items.map(parseActivityRow);
}

export function parseCrmPlannedActivitiesPage(payload: unknown, expectedPage: number) {
  const body = record(payload);
  if (
    !body ||
    body.page !== expectedPage ||
    body.limit !== CRM_ACTIVITY_PAGE_SIZE ||
    typeof body.total !== "number" ||
    !Number.isSafeInteger(body.total) ||
    body.total < 0 ||
    typeof body.totalPages !== "number" ||
    !Number.isSafeInteger(body.totalPages) ||
    body.totalPages !== Math.max(1, Math.ceil(body.total / CRM_ACTIVITY_PAGE_SIZE)) ||
    expectedPage > body.totalPages ||
    body.hasNext !== (expectedPage < body.totalPages)
  ) {
    invalid();
  }
  const items = parseCrmPlannedActivities(body);
  if (body.hasNext && items.length === 0) invalid();
  return { items, hasNext: body.hasNext === true };
}

export function parseCreatedCrmActivity(payload: unknown): CrmPlannedActivity {
  const envelope = record(payload);
  return parseActivityRow(envelope && "data" in envelope ? envelope.data : payload);
}

export function crmActivityToForm(activity: CrmPlannedActivity): CrmActivityForm {
  return {
    type: CRM_ACTIVITY_TYPES.includes(activity.type as CrmActivityType)
      ? (activity.type as CrmActivityType)
      : "TODO",
    subject: activity.subject,
    dueAt: activity.dueAt ? activity.dueAt.slice(0, 16) : "",
    priority: CRM_ACTIVITY_PRIORITIES.includes(activity.priority as CrmActivityPriority)
      ? (activity.priority as CrmActivityPriority)
      : "NORMAL",
    description: activity.description,
  };
}

export function validateCrmActivityForm(
  form: CrmActivityForm,
  options?: { allowPastDue?: boolean },
): CrmActivityErrors {
  const errors: CrmActivityErrors = {};
  const subject = form.subject.trim();
  if (!subject) errors.subject = "required";
  else if (subject.length > CRM_ACTIVITY_SUBJECT_MAX) errors.subject = "maxLength";

  const due = form.dueAt.trim();
  if (!due) errors.dueAt = "required";
  else if (!options?.allowPastDue && new Date(due).getTime() <= Date.now()) errors.dueAt = "past";

  return errors;
}

export function buildCrmActivityRequest(
  form: CrmActivityForm,
  targetId: string,
  targetType: CrmTargetType,
): Record<string, unknown> {
  const errors = validateCrmActivityForm(form);
  if (Object.keys(errors).length > 0) throw new Error("Invalid activity form.");
  if (!isUUIDv7(targetId)) invalid();

  const dueInstant = new Date(form.dueAt).toISOString();
  return {
    targetApp: "CRM",
    targetType,
    targetId,
    subject: form.subject.trim(),
    type: form.type,
    priority: form.priority,
    dueAt: dueInstant,
    description: form.description.trim() || undefined,
  };
}

export function buildCrmActivityUpdateRequest(
  activity: CrmPlannedActivity,
  form: CrmActivityForm,
): Record<string, unknown> {
  const allowPastDue = activity.dueAt.slice(0, 16) === form.dueAt;
  const errors = validateCrmActivityForm(form, { allowPastDue });
  if (Object.keys(errors).length > 0) throw new Error("Invalid activity form.");

  const dueInstant = new Date(form.dueAt).toISOString();
  return {
    subject: form.subject.trim(),
    type: form.type,
    priority: form.priority,
    dueAt: dueInstant,
    description: form.description.trim() || undefined,
  };
}
