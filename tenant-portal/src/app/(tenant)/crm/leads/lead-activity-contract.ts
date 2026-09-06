// The board card's activity dialog, on the wire.
//
//   GET  /api/tenant/core/v1/activities
//          ?targetApp=CRM&targetType=LEAD&targetId=<lead>&status=PLANNED
//   POST /api/tenant/core/v1/activities   -> 201
//
// Activities belong to **Core**, not CRM. `/api/tenant/crm/v1/activities` is
// deliberately not used here: every write path there files a DONE row — it is
// a log of what happened — while this dialog schedules what is going to
// happen, and PLANNED work lives on Core's resource.
//
// The three filter names are the controller's own
// (core-app/src/tenant/activities/activities.controller.ts documents
// `targetType` with `LEAD` as its example, beside `targetApp` and `targetId`),
// and docs/generated/tenant-api-routes.md carries the canonical paths.
//
// `core.tenant.activities.create` is `idempotent: true` in the Gateway
// contract, so the POST is refused without an `x-idempotency-key` and the key
// must be a UUIDv7. It is minted once per Save press and reused across every
// retry of that press — ../shared/crm-write.ts, rule 1. A fresh key per retry
// files a second activity on the lead.
//
// A narrow contract of its own rather than an import from
// `app/(tenant)/core/activities/`: file-architecture.md#dependency-direction
// allows a screen a named type from a sibling that owns the same resource and
// nothing wider, and the Core screen's contract carries the version/ETag,
// complete/cancel and assignee machinery this dialog has no use for.

import type { CorePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";

export const LEAD_ACTIVITIES_PATH: CorePath = "/api/tenant/core/v1/activities";

/** `activities.read` gates the list half; `activities.create` gates the form half. */
export const LEAD_ACTIVITY_READ_PERMISSION = "activities.read";
export const LEAD_ACTIVITY_CREATE_PERMISSION = "activities.create";

/** `ACTIVITY_TYPES` in @mutakamel/core-app-common — `@IsIn` rejects anything else. */
export const LEAD_ACTIVITY_TYPES = [
  "TODO",
  "CALL",
  "MEETING",
  "EMAIL",
  "VISIT",
  "FOLLOW_UP",
  "OTHER",
] as const;

export const LEAD_ACTIVITY_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

// Reachable through `LeadActivityForm["type"]` and `["priority"]`, which is
// how the form component narrows a `<Select>`'s string. Naming them here keeps
// the two unions readable without adding an export nothing imports.
type LeadActivityType = (typeof LEAD_ACTIVITY_TYPES)[number];
type LeadActivityPriority = (typeof LEAD_ACTIVITY_PRIORITIES)[number];

/** `CreateActivityDto` — `@MaxLength(180)` and `@MaxLength(4000)`. */
export const LEAD_ACTIVITY_SUBJECT_MAX = 180;
export const LEAD_ACTIVITY_DESCRIPTION_MAX = 4000;

/**
 * How many planned activities the dialog asks for.
 *
 * One page and no pager: this half answers "what is already booked on this
 * lead", and a lead carrying more than twenty-five open activities is a
 * question for the activities screen, not for a card dialog.
 */
const LEAD_ACTIVITY_PAGE_SIZE = 25;

export const LEAD_ACTIVITY_RESPONSE_LIMIT_BYTES = 256 * 1024;

/** Only the fields this dialog draws. The row carries a dozen more. */
export interface LeadPlannedActivity {
  id: string;
  subject: string;
  type: string;
  priority: string;
  dueAt: string;
}

export interface LeadActivityForm {
  type: LeadActivityType;
  subject: string;
  /** `datetime-local` text in the viewer's own zone; an ISO instant on the wire. */
  dueAt: string;
  priority: LeadActivityPriority;
  description: string;
}

export const EMPTY_LEAD_ACTIVITY_FORM: LeadActivityForm = {
  type: "TODO",
  subject: "",
  dueAt: "",
  priority: "NORMAL",
  description: "",
};

/** One field's problem, as a key under `t.crmLeads.activities.errors`. */
type LeadActivityErrorCode = "required" | "maxLength" | "past";

export type LeadActivityErrors = Partial<
  Record<"subject" | "dueAt", LeadActivityErrorCode>
>;

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

/** This lead's open work, soonest first. */
export function leadPlannedActivitiesQuery(leadId: string): string {
  if (!isUUIDv7(leadId)) invalid();
  return new URLSearchParams({
    page: "1",
    limit: String(LEAD_ACTIVITY_PAGE_SIZE),
    // `ActivityListQueryDto` overrides `sortBy` to `@IsIn(['dueAt'])`; any
    // other column is a 422, so it is a constant rather than a caller's choice.
    sortBy: "dueAt",
    sortDir: "ASC",
    status: "PLANNED",
    targetApp: "CRM",
    targetType: "LEAD",
    targetId: leadId,
  }).toString();
}

function parseActivityRow(value: unknown): LeadPlannedActivity {
  const row = record(value);
  if (!row) invalid();
  const dueAt = row.dueAt;
  if (typeof dueAt !== "string" || Number.isNaN(new Date(dueAt).getTime())) invalid();
  return {
    id: requiredText(row, "id", 36),
    subject: requiredText(row, "subject", LEAD_ACTIVITY_SUBJECT_MAX),
    // Strings, not the two unions above: a type or a priority this build has
    // never heard of must not take the list down, and the dialog already falls
    // back to the raw key when the dictionary has no label for it.
    type: requiredText(row, "type", 32),
    priority: requiredText(row, "priority", 16),
    dueAt,
  };
}

/**
 * `ActivitiesService.list` answers `{ items, total, page, limit, totalPages,
 * hasNext }` inside Core's `data` envelope — no `hasPrev`, so the envelope
 * interceptor does not treat it as paginated and emits no `meta`. This half
 * needs the rows and nothing else, so only `items` is read.
 */
export function parseLeadPlannedActivities(payload: unknown): LeadPlannedActivity[] {
  const body = record(payload);
  if (!body || !Array.isArray(body.items)) invalid();
  if (body.items.length > LEAD_ACTIVITY_PAGE_SIZE) invalid();
  return body.items.map(parseActivityRow);
}

/**
 * The created row, read straight off Core's envelope.
 *
 * `runCrmWrite` hands its `parse` the raw response body, and a Core route
 * answers `{ success, data, correlationId }` — so the unwrap happens here
 * rather than through `writeCoreData`, which classifies no outcomes and would
 * cost the write the ambiguous/applied-unreadable distinction that
 * ../shared/crm-write.ts exists for.
 */
export function parseCreatedLeadActivity(payload: unknown): LeadPlannedActivity {
  const envelope = record(payload);
  return parseActivityRow(envelope && "data" in envelope ? envelope.data : payload);
}

/**
 * What the form got wrong, before a round trip spends a key on it.
 *
 * A MIRROR of the server, never a second opinion: `subject` is
 * `@IsNotEmpty() @MaxLength(180)` on `CreateActivityDto`, and the past-due
 * rule is `assertFutureDueAt` in `ActivitiesService.create`. Anything this
 * misses still arrives as the modal's error summary.
 */
export function validateLeadActivityForm(form: LeadActivityForm): LeadActivityErrors {
  const errors: LeadActivityErrors = {};

  const subject = form.subject.trim();
  if (subject.length === 0) errors.subject = "required";
  else if (subject.length > LEAD_ACTIVITY_SUBJECT_MAX) errors.subject = "maxLength";

  const dueAt = new Date(form.dueAt);
  if (!form.dueAt || Number.isNaN(dueAt.getTime())) errors.dueAt = "required";
  else if (dueAt.getTime() <= Date.now()) errors.dueAt = "past";

  return errors;
}

/**
 * `CreateActivityDto`. `target` is required and is what the service authorises
 * against — it resolves the lead, then checks `activities.create` in that
 * lead's own branch.
 *
 * `assigneeUserId` is deliberately absent. It is optional on the DTO and
 * `ActivitiesService.create` falls back to the acting user, which is the right
 * answer for an activity booked from a card: the person scheduling it is the
 * person doing it. Reassignment lives on the activities screen, which has the
 * eligible-assignee list this dialog would otherwise have to fetch.
 */
export function buildLeadActivityRequest(
  leadId: string,
  form: LeadActivityForm,
): Record<string, unknown> {
  if (!isUUIDv7(leadId)) invalid();
  const description = form.description.trim().slice(0, LEAD_ACTIVITY_DESCRIPTION_MAX);
  return {
    target: { app: "CRM", type: "LEAD", id: leadId },
    type: form.type,
    subject: form.subject.trim(),
    ...(description ? { description } : {}),
    priority: form.priority,
    dueAt: new Date(form.dueAt).toISOString(),
  };
}
