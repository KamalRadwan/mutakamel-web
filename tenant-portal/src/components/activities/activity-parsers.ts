// Runtime validators for every activity response — docs/architecture/data-layer.md.
//
// Two rules shape them. An enum-valued field is read as a string, never
// narrowed: a status or type added by a newer Core renders its labelled
// fallback instead of failing the screen. And a field this build expects but
// an older Core does not send yet (`endsAt`, `assigneeName`, …) reads as null
// rather than as a broken response; a WRONG type is still a broken response.

import { isUUIDv7 } from "@/lib/uuid";
import {
  ACTIVITY_CALENDAR_CAP,
  ACTIVITY_DESCRIPTION_MAX,
  ACTIVITY_LOCATION_MAX,
  ACTIVITY_MEETING_URL_MAX,
  ACTIVITY_OUTCOME_MAX,
  ACTIVITY_SUBJECT_MAX,
  activityTextLength,
  type Activity,
  type ActivityAssignee,
  type ActivityCalendarWindow,
  type ActivityPage,
  type ActivityStatusSummary,
  type ActivitySummary,
  type ActivityTarget,
  type ActivityTargetOption,
} from "./activity-contract";

/** `GET activities/targets` answers at most 20 rows, already authorised and ordered by label. */
const TARGET_OPTIONS_MAX = 20;
/** `listAssignees` stops at `LIMIT 100`. */
const ASSIGNEES_MAX = 100;
/** `activity_targets.label` and a tenant user's joined first + last name. */
const TARGET_LABEL_MAX = 400;
const PERSON_NAME_MAX = 240;
const ENUM_MAX = 40;

function invalid(): never {
  throw new Error("Invalid activities response.");
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function uuid(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (!isUUIDv7(value)) invalid();
  return value;
}

function text(source: Record<string, unknown>, key: string, max: number): string {
  const value = source[key];
  if (typeof value !== "string" || value.length === 0 || activityTextLength(value) > max) invalid();
  return value;
}

function optionalText(source: Record<string, unknown>, key: string, max: number): string | null {
  const value = source[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || activityTextLength(value) > max) invalid();
  return value;
}

function timestamp(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) invalid();
  return value;
}

function optionalTimestamp(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return value === undefined || value === null ? null : timestamp(source, key);
}

function count(source: Record<string, unknown>, key: string, minimum = 0): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) invalid();
  return value;
}

function parseTarget(value: unknown): ActivityTarget {
  const row = record(value);
  if (!row) invalid();
  return {
    id: uuid(row, "id"),
    role: text(row, "role", ENUM_MAX),
    targetApp: text(row, "targetApp", ENUM_MAX),
    targetType: text(row, "targetType", ENUM_MAX),
    targetId: uuid(row, "targetId"),
    label: text(row, "label", TARGET_LABEL_MAX),
    unavailableAt: optionalTimestamp(row, "unavailableAt"),
  };
}

export function parseActivity(value: unknown): Activity {
  const row = record(value);
  if (!row || !Array.isArray(row.targets)) invalid();
  return {
    id: uuid(row, "id"),
    type: text(row, "type", ENUM_MAX),
    subject: text(row, "subject", ACTIVITY_SUBJECT_MAX),
    description: optionalText(row, "description", ACTIVITY_DESCRIPTION_MAX),
    direction: optionalText(row, "direction", ENUM_MAX),
    priority: text(row, "priority", ENUM_MAX),
    status: text(row, "status", ENUM_MAX),
    dueAt: timestamp(row, "dueAt"),
    endsAt: optionalTimestamp(row, "endsAt"),
    location: optionalText(row, "location", ACTIVITY_LOCATION_MAX),
    meetingUrl: optionalText(row, "meetingUrl", ACTIVITY_MEETING_URL_MAX),
    completedAt: optionalTimestamp(row, "completedAt"),
    cancelledAt: optionalTimestamp(row, "cancelledAt"),
    outcome: optionalText(row, "outcome", ACTIVITY_OUTCOME_MAX),
    assigneeUserId: uuid(row, "assigneeUserId"),
    assigneeName: optionalText(row, "assigneeName", PERSON_NAME_MAX),
    createdByUserId: uuid(row, "createdByUserId"),
    createdByName: optionalText(row, "createdByName", PERSON_NAME_MAX),
    branchId: uuid(row, "branchId"),
    companyId: uuid(row, "companyId"),
    // A row without a positive version cannot be written back: `If-Match`
    // would carry nothing and Core answers 428.
    version: count(row, "version", 1),
    createdAt: timestamp(row, "createdAt"),
    updatedAt: timestamp(row, "updatedAt"),
    targets: row.targets.map(parseTarget),
  };
}

/**
 * `ActivitiesService.list` answers `{ items, total, page, limit, totalPages,
 * hasNext }` inside `data` — no `hasPrev`, so the envelope interceptor emits no
 * `meta`. Both flags are re-derived so the pager cannot disagree with the page
 * it is drawing.
 */
export function parseActivityPage(payload: unknown): ActivityPage {
  const body = record(payload);
  if (!body || !Array.isArray(body.items)) invalid();
  const page = count(body, "page", 1);
  const limit = count(body, "limit", 1);
  const total = count(body, "total");
  const totalPages = count(body, "totalPages", 1);
  if (body.items.length > limit || totalPages !== Math.max(1, Math.ceil(total / limit))) invalid();
  return {
    items: body.items.map(parseActivity),
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

function parseStatusSummary(value: unknown): ActivityStatusSummary {
  const row = record(value);
  if (!row) invalid();
  return {
    status: text(row, "status", ENUM_MAX),
    total: count(row, "total"),
    overdue: count(row, "overdue"),
    today: count(row, "today"),
    upcoming: count(row, "upcoming"),
  };
}

export function parseActivitySummary(payload: unknown): ActivitySummary {
  const body = record(payload);
  if (!body || !Array.isArray(body.byStatus)) invalid();
  const byStatus = body.byStatus.map(parseStatusSummary);
  if (new Set(byStatus.map((entry) => entry.status)).size !== byStatus.length) invalid();
  return {
    overdue: count(body, "overdue"),
    today: count(body, "today"),
    upcoming: count(body, "upcoming"),
    completedToday: count(body, "completedToday"),
    byStatus,
  };
}

export function parseActivityCalendarWindow(payload: unknown): ActivityCalendarWindow {
  const body = record(payload);
  if (!body || !Array.isArray(body.items) || typeof body.truncated !== "boolean") invalid();
  if (body.items.length > ACTIVITY_CALENDAR_CAP) invalid();
  return { items: body.items.map(parseActivity), truncated: body.truncated };
}

export function parseActivityTargetOptions(payload: unknown): ActivityTargetOption[] {
  if (!Array.isArray(payload) || payload.length > TARGET_OPTIONS_MAX) invalid();
  return payload.map((value) => {
    const row = record(value);
    if (!row) invalid();
    return {
      targetApp: text(row, "targetApp", ENUM_MAX),
      targetType: text(row, "targetType", ENUM_MAX),
      targetId: uuid(row, "targetId"),
      label: text(row, "label", TARGET_LABEL_MAX),
      branchId: uuid(row, "branchId"),
    };
  });
}

export function parseActivityAssignees(payload: unknown): ActivityAssignee[] {
  if (!Array.isArray(payload) || payload.length > ASSIGNEES_MAX) invalid();
  return payload.map((value) => {
    const row = record(value);
    if (!row) invalid();
    const id = uuid(row, "id");
    // `concat_ws` yields "" for a user with no names on file. The id is the
    // honest fallback — patterns.md "When the API gives you an id and no name".
    return { id, name: optionalText(row, "name", PERSON_NAME_MAX)?.trim() || id };
  });
}

/**
 * A write's answer, read straight off Core's envelope.
 *
 * `runIdempotentWrite` hands `parse` the raw body, so the unwrap happens here
 * rather than through `writeCoreData`, which classifies no outcomes and would
 * cost the write its ambiguous / applied-unreadable distinction.
 */
export function parseActivityWriteResponse(payload: unknown): Activity {
  return parseActivity(record(payload)?.data);
}
