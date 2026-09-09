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
/**
 * One per row action. The controller declares them separately —
 * `@RequirePermissions('activities.update' | '.complete' | '.cancel')` — so a
 * user who may reschedule need not be one who may cancel, and each control is
 * hidden on its own rather than the three sharing a gate.
 */
export const LEAD_ACTIVITY_UPDATE_PERMISSION = "activities.update";
export const LEAD_ACTIVITY_COMPLETE_PERMISSION = "activities.complete";
export const LEAD_ACTIVITY_CANCEL_PERMISSION = "activities.cancel";

/**
 * The row's own routes. Every one of the three takes `If-Match: <version>` and
 * a UUIDv7 `x-idempotency-key`; the version comes off the row this dialog is
 * already holding, so none of them costs a read first.
 */
export function leadActivityPath(activityId: string): CorePath {
  if (!isUUIDv7(activityId)) invalid();
  return `${LEAD_ACTIVITIES_PATH}/${activityId}` as CorePath;
}

export function leadActivityCompletePath(activityId: string): CorePath {
  return `${leadActivityPath(activityId)}/complete` as CorePath;
}

export function leadActivityCancelPath(activityId: string): CorePath {
  return `${leadActivityPath(activityId)}/cancel` as CorePath;
}

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

/** Read in bounded pages; the shared reader follows every remaining page. */
const LEAD_ACTIVITY_PAGE_SIZE = 25;

export const LEAD_ACTIVITY_RESPONSE_LIMIT_BYTES = 256 * 1024;

/** Only the fields this dialog draws or writes back. The row carries a dozen more. */
export interface LeadPlannedActivity {
  id: string;
  subject: string;
  type: string;
  priority: string;
  dueAt: string;
  /** Not drawn in the list — it seeds the edit form, which is why it is read. */
  description: string;
  /**
   * The row's optimistic-lock counter, sent back as `If-Match` by all three
   * row actions. Reading it here is what lets Edit, Mark as done and Discard
   * act on a row the dialog already holds instead of re-fetching it, and it is
   * what turns a stale list into a 409 the user is told about rather than a
   * silent overwrite of somebody else's change.
   */
  version: number;
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
export function leadPlannedActivitiesQuery(leadId: string, page = 1): string {
  if (!Number.isSafeInteger(page) || page < 1) throw new Error("Invalid activity page.");
  if (!isUUIDv7(leadId)) invalid();
  return new URLSearchParams({
    page: String(page),
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
  // A row whose version is missing or not a positive integer cannot be written
  // back: `If-Match` would carry nothing and the server answers 428. Treating
  // it as a broken response is the honest failure — the alternative is a list
  // whose Edit and Discard controls are dead and say nothing about why.
  const version = row.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) invalid();
  // Nullable in the database and optional on the DTO. Empty string here, so
  // the edit form's textarea has something to hold either way.
  const description = row.description;
  if (description !== null && description !== undefined && typeof description !== "string") {
    invalid();
  }
  return {
    id: requiredText(row, "id", 36),
    subject: requiredText(row, "subject", LEAD_ACTIVITY_SUBJECT_MAX),
    // Strings, not the two unions above: a type or a priority this build has
    // never heard of must not take the list down, and the dialog already falls
    // back to the raw key when the dictionary has no label for it.
    type: requiredText(row, "type", 32),
    priority: requiredText(row, "priority", 16),
    dueAt,
    description: (description ?? "").slice(0, LEAD_ACTIVITY_DESCRIPTION_MAX),
    version,
  };
}

/**
 * `ActivitiesService.list` answers `{ items, total, page, limit, totalPages,
 * hasNext }` inside Core's `data` envelope — no `hasPrev`, so the envelope
 * interceptor does not treat it as paginated and emits no `meta`. This parser
 * validates the rows; the all-pages reader validates pagination separately.
 */
export function parseLeadPlannedActivities(payload: unknown): LeadPlannedActivity[] {
  const body = record(payload);
  if (!body || !Array.isArray(body.items)) invalid();
  if (body.items.length > LEAD_ACTIVITY_PAGE_SIZE) invalid();
  return body.items.map(parseActivityRow);
}

export function parseLeadPlannedActivitiesPage(payload: unknown, expectedPage: number) {
  const body = record(payload);
  if (!body || body.page !== expectedPage || body.limit !== LEAD_ACTIVITY_PAGE_SIZE ||
    typeof body.total !== "number" || !Number.isSafeInteger(body.total) || body.total < 0 ||
    typeof body.totalPages !== "number" || !Number.isSafeInteger(body.totalPages) ||
    body.totalPages !== Math.max(1, Math.ceil(body.total / LEAD_ACTIVITY_PAGE_SIZE)) ||
    expectedPage > body.totalPages || body.hasNext !== (expectedPage < body.totalPages)) invalid();
  const items = parseLeadPlannedActivities(body);
  if (body.hasNext && items.length === 0) invalid();
  return { items, hasNext: body.hasNext === true };
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
 *
 * `unchangedDueAt` is how the mirror stays exact on the edit path.
 * `ActivitiesService.update` re-checks the due date **only when it moved** —
 * `if (dto.dueAt.getTime() !== activity.dueAt.getTime()) assertFutureDueAt(…)`
 * — so an overdue activity can still have its subject corrected. Without this
 * the dialog would refuse a save the server would have accepted, which is a
 * second opinion and the thing this comment forbids.
 */
export function validateLeadActivityForm(
  form: LeadActivityForm,
  unchangedDueAt?: string,
): LeadActivityErrors {
  const errors: LeadActivityErrors = {};

  const subject = form.subject.trim();
  if (subject.length === 0) errors.subject = "required";
  else if (subject.length > LEAD_ACTIVITY_SUBJECT_MAX) errors.subject = "maxLength";

  const dueAt = new Date(form.dueAt);
  if (!form.dueAt || Number.isNaN(dueAt.getTime())) errors.dueAt = "required";
  else if (dueAt.getTime() <= Date.now()) {
    const original = unchangedDueAt ? new Date(unchangedDueAt).getTime() : Number.NaN;
    if (original !== dueAt.getTime()) errors.dueAt = "past";
  }

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

/**
 * `UpdateActivityDto` — the same five fields the form holds, and no `target`:
 * an activity does not change which lead it belongs to, and the DTO has no
 * field for it.
 *
 * The description is sent as `null` when cleared rather than omitted. Omitting
 * it means "leave it alone" on a PATCH, so a user who empties the box and
 * saves would watch the old text come back; `null` is what the DTO accepts for
 * "there is none".
 */
export function buildLeadActivityUpdateRequest(
  form: LeadActivityForm,
): Record<string, unknown> {
  const description = form.description.trim().slice(0, LEAD_ACTIVITY_DESCRIPTION_MAX);
  return {
    type: form.type,
    subject: form.subject.trim(),
    description: description || null,
    priority: form.priority,
    dueAt: new Date(form.dueAt).toISOString(),
  };
}

/** A `<input type="datetime-local">` value, in the reader's own zone. */
function toLocalDateTimeInput(iso: string): string {
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return "";
  // `toISOString` would be UTC and the box would show a different clock time
  // than the list beside it. Offsetting first keeps both on the reader's.
  const local = new Date(due.getTime() - due.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/**
 * A booked row, back into the form that edits it.
 *
 * `type` and `priority` are widened to `string` on the row on purpose (a value
 * this build has never heard of must not take the list down), so they are
 * narrowed here against the two catalogues and fall back to the form's own
 * defaults. A row typed `WEBINAR` by a newer server therefore opens as `TODO`
 * rather than putting a value in the select that the select cannot render.
 */
export function leadActivityToForm(activity: LeadPlannedActivity): LeadActivityForm {
  const type = LEAD_ACTIVITY_TYPES.find((candidate) => candidate === activity.type);
  const priority = LEAD_ACTIVITY_PRIORITIES.find(
    (candidate) => candidate === activity.priority,
  );
  return {
    type: type ?? EMPTY_LEAD_ACTIVITY_FORM.type,
    subject: activity.subject,
    dueAt: toLocalDateTimeInput(activity.dueAt),
    priority: priority ?? EMPTY_LEAD_ACTIVITY_FORM.priority,
    description: activity.description,
  };
}
