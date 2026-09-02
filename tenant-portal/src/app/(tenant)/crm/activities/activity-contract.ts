// Wire contract for the CRM activities module — activities, tasks, calendar
// events and reminders.
//
// These are FOUR routes off ONE controller
// (crm-app/src/crm/activities/activities.controller.ts), one DTO file
// (dto/activity.dto.ts), one query file (common/dto/crm-list-query.dto.ts) and
// one permission family (`crm.activities.read|create|update`, scoped). The
// tasks, calendar and reminders screens import the narrow types and builders
// they need from here rather than restating them — the one cross-screen import
// docs/architecture/file-architecture.md#dependency-direction permits, because
// it is literally the same backend resource.
//
// Nothing on this page is semantically documented in docs/api/*.md: the
// activities family is one of the route-level-only groups listed in
// docs/api/README.md#coverage, so the controller, the DTOs and the service's
// SQL projections are the contract.

export const ACTIVITIES_PATH = "/api/tenant/crm/v1/activities";
export const TASKS_PATH = "/api/tenant/crm/v1/tasks";
export const CALENDAR_EVENTS_PATH = "/api/tenant/crm/v1/calendar/events";
export const REMINDERS_PATH = "/api/tenant/crm/v1/reminders";

export const ACTIVITY_SUBJECT_MAX_LENGTH = 180;
export const ACTIVITY_TEXT_MAX_LENGTH = 2000;
export const ACTIVITY_LOCATION_MAX_LENGTH = 180;

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const CRM_ACTIVITY_TYPES = [
  "CALL",
  "MEETING",
  "EMAIL",
  "VISIT",
  "NOTE",
  "FOLLOW_UP",
  "OTHER",
] as const;
export type CrmActivityType = (typeof CRM_ACTIVITY_TYPES)[number];

const CRM_ACTIVITY_DIRECTIONS = [
  "INBOUND",
  "OUTBOUND",
  "INTERNAL",
] as const;
type CrmActivityDirection = (typeof CRM_ACTIVITY_DIRECTIONS)[number];

const CRM_ACTIVITY_STATUSES = ["OPEN", "DONE"] as const;
type CrmActivityStatus = (typeof CRM_ACTIVITY_STATUSES)[number];

export const CRM_TASK_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
] as const;
export type CrmTaskStatus = (typeof CRM_TASK_STATUSES)[number];

export const CRM_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type CrmPriority = (typeof CRM_PRIORITIES)[number];

export const CRM_REMINDER_TARGET_TYPES = ["TASK", "CALENDAR_EVENT"] as const;
export type CrmReminderTargetType = (typeof CRM_REMINDER_TARGET_TYPES)[number];

export const CRM_REMINDER_CHANNELS = ["IN_APP", "EMAIL", "SMS"] as const;
export type CrmReminderChannel = (typeof CRM_REMINDER_CHANNELS)[number];

export const CRM_REMINDER_STATUSES = ["PENDING", "SENT", "CANCELLED"] as const;
export type CrmReminderStatus = (typeof CRM_REMINDER_STATUSES)[number];

/** `@IsIn` on the activity DTO — a constrained list, not an exported enum. */
const ACTIVITY_SOURCE_TYPES = [
  "LEAD",
  "CUSTOMER_PROFILE",
  "PARTY",
  "OPPORTUNITY",
] as const;
type ActivitySourceType = (typeof ACTIVITY_SOURCE_TYPES)[number];

/** Tasks and calendar events additionally accept `ACTIVITY`. */
const WORK_SOURCE_TYPES = [
  ...ACTIVITY_SOURCE_TYPES,
  "ACTIVITY",
] as const;
type WorkSourceType = (typeof WORK_SOURCE_TYPES)[number];

/**
 * The flat page every CRM list answers with.
 *
 * `PaginatedResult<T>` from `@mutakamel/database`:
 * `{ items, total, page, limit, totalPages, hasNext, hasPrev }`. There is no
 * `meta` wrapper — no CRM service or interceptor produces one — and no `data`
 * envelope. docs/api/README.md's `{ items, meta }` example does not match any
 * crm-app response.
 */
export interface CrmPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CrmActivity {
  id: string;
  branchId: string;
  type: CrmActivityType;
  subject: string;
  sourceType: ActivitySourceType;
  sourceId: string;
  direction: CrmActivityDirection | null;
  status: CrmActivityStatus;
  description: string | null;
  outcome: string | null;
  activityAt: string | null;
  completedAt: string | null;
  ownerUserId: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

/**
 * The TASK LIST projection, which is narrower than `CrmTaskEntity`.
 *
 * `listScopedTasks` selects id, branchId, sourceType, sourceId, title, dueAt,
 * status and the timestamps — and **nothing else**. `description`,
 * `assigneeUserId` and `priority` are writable on create and update but are
 * never returned by the list, so no screen may render or pre-fill them from
 * it. Recorded as Q50 in docs/build/OPEN-QUESTIONS.md.
 */
export interface CrmTask {
  id: string;
  branchId: string;
  sourceType: WorkSourceType | null;
  sourceId: string | null;
  title: string;
  status: CrmTaskStatus;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The event list projection: no `description`, `location` or `attendees`. */
export interface CrmCalendarEvent {
  id: string;
  branchId: string;
  sourceType: WorkSourceType | null;
  sourceId: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

/** The reminder list projection: no `channel`. */
export interface CrmReminder {
  id: string;
  branchId: string;
  targetType: CrmReminderTargetType;
  targetId: string;
  remindAt: string;
  status: CrmReminderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  branchId: string;
  title: string;
  sourceType: WorkSourceType;
  sourceId: string;
  status: CrmTaskStatus;
  description: string;
  priority: CrmPriority | "";
  dueAt: Date | null;
}

export interface UpdateTaskInput {
  title: string;
  status: CrmTaskStatus;
  dueAt: Date | null;
}

export interface CreateCalendarEventInput {
  branchId: string;
  title: string;
  sourceType: WorkSourceType;
  sourceId: string;
  description: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
}

export interface UpdateCalendarEventInput {
  title: string;
  startsAt: Date;
  endsAt: Date;
}

export interface CreateReminderInput {
  branchId: string;
  targetType: CrmReminderTargetType;
  targetId: string;
  channel: CrmReminderChannel;
  remindAt: Date;
}

/**
 * Joins a `DatePicker` day with an `HH:mm` time input into one instant.
 *
 * Calendar events and reminders are `@IsDate()` moments, not days: an event
 * whose start and end are both midnight fails `endsAt > startsAt`, and a
 * reminder at midnight today is already in the past. `DatePicker` yields a day,
 * so the time half is a separate control and the two are combined here rather
 * than in two screens' markup.
 */
export function combineDateAndTime(
  day: Date | undefined,
  time: string,
): Date | null {
  if (!day) return null;
  const match = /^(\d{2}):(\d{2})$/u.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const combined = new Date(day);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

/** The `HH:mm` half of an instant, in the viewer's own zone. */
export function timeOfDay(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
}

export function taskPath(id: string): string {
  return `${TASKS_PATH}/${encodeUuid(id)}`;
}

export function calendarEventPath(id: string): string {
  return `${CALENDAR_EVENTS_PATH}/${encodeUuid(id)}`;
}

export function reminderCancelPath(id: string): string {
  return `${REMINDERS_PATH}/${encodeUuid(id)}/cancel`;
}

/**
 * Every list in this family is a `BranchListQueryDto`: `branchId` is
 * `@IsUUID('7')` and NOT optional, so a missing one is a 422 rather than an
 * empty list (S2).
 *
 * `sortBy`/`sortDir` are accepted by the shared DTO but **ignored** by three
 * of the four services: tasks order by `created_at DESC`, events by
 * `starts_at DESC` and reminders by `remind_at DESC`, all hardcoded. Only the
 * activities list reads `sortDir`. No sortable column is offered where the
 * server would not honour it.
 */
export function buildListQuery(
  branchId: string,
  page: number,
  limit: number,
  extra: Record<string, string> = {},
): string {
  if (!UUID_V7_PATTERN.test(branchId)) {
    throw new Error("A valid branch is required for this CRM list.");
  }
  const params = new URLSearchParams({
    branchId,
    page: String(page),
    limit: String(limit),
  });
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function buildCreateTaskRequest(
  input: CreateTaskInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    branchId: input.branchId,
    title: requiredText(input.title, ACTIVITY_SUBJECT_MAX_LENGTH),
    sourceType: input.sourceType,
    sourceId: requiredUuid(input.sourceId),
    status: input.status,
  };
  const description = input.description.trim();
  if (description) {
    body.description = boundedText(description, ACTIVITY_TEXT_MAX_LENGTH);
  }
  if (input.priority) body.priority = input.priority;
  // @Type(() => Date) @IsDate() — an ISO string transforms cleanly, and it is
  // what the transport can carry.
  if (input.dueAt) body.dueAt = input.dueAt.toISOString();
  return body;
}

/**
 * `PATCH /tasks/:id`.
 *
 * Only `title`, `status` and `dueAt` are offered, and only when changed: the
 * task LIST does not return `description`, `priority` or `assigneeUserId`, so
 * a form built from it cannot show their current values, and sending a blank
 * one would silently clear a field the user never saw. The service merges
 * `{...task, ...dto}`, so omitting them preserves them exactly.
 */
export function buildUpdateTaskRequest(
  input: UpdateTaskInput,
  task: CrmTask,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const title = requiredText(input.title, ACTIVITY_SUBJECT_MAX_LENGTH);
  if (title !== task.title) body.title = title;
  if (input.status !== task.status) body.status = input.status;
  const dueAt = input.dueAt ? input.dueAt.toISOString() : null;
  const currentDueAt = task.dueAt ? new Date(task.dueAt).toISOString() : null;
  // Clearing the picker sends `dueAt: null` — defect D8. Dropping the key made
  // Clear look like it worked and left the old date on the record.
  // `UpdateTaskDto.dueAt` is `@IsOptional() @Type(() => Date) @IsDate()`:
  // class-transformer 0.5.1 returns null untouched for a Date target,
  // `@IsOptional()` skips validation for null as well as undefined, and
  // `ActivitiesService.updateTask` spreads the DTO over the entity, so the null
  // reaches the nullable `due_at` column.
  if (dueAt !== currentDueAt) body.dueAt = dueAt;
  return body;
}

export function buildCreateEventRequest(
  input: CreateCalendarEventInput,
): Record<string, unknown> {
  assertEventWindow(input.startsAt, input.endsAt);
  const body: Record<string, unknown> = {
    branchId: input.branchId,
    title: requiredText(input.title, ACTIVITY_SUBJECT_MAX_LENGTH),
    sourceType: input.sourceType,
    sourceId: requiredUuid(input.sourceId),
    startsAt: input.startsAt.toISOString(),
    endsAt: input.endsAt.toISOString(),
  };
  const description = input.description.trim();
  if (description) {
    body.description = boundedText(description, ACTIVITY_TEXT_MAX_LENGTH);
  }
  const location = input.location.trim();
  if (location) {
    body.location = boundedText(location, ACTIVITY_LOCATION_MAX_LENGTH);
  }
  // `attendees` is deliberately never sent. The DTO types it `unknown[]` with
  // no declared item shape, so any structure this client invented would be a
  // guess. Recorded as Q51 in docs/build/OPEN-QUESTIONS.md.
  return body;
}

export function buildUpdateEventRequest(
  input: UpdateCalendarEventInput,
  event: CrmCalendarEvent,
): Record<string, unknown> {
  assertEventWindow(input.startsAt, input.endsAt);
  const body: Record<string, unknown> = {};
  const title = requiredText(input.title, ACTIVITY_SUBJECT_MAX_LENGTH);
  if (title !== event.title) body.title = title;
  const startsAt = input.startsAt.toISOString();
  const endsAt = input.endsAt.toISOString();
  if (startsAt !== new Date(event.startsAt).toISOString()) {
    body.startsAt = startsAt;
  }
  if (endsAt !== new Date(event.endsAt).toISOString()) body.endsAt = endsAt;
  return body;
}

export function buildCreateReminderRequest(
  input: CreateReminderInput,
): Record<string, unknown> {
  // The service rejects a past instant with 422 CRM_REMINDER_TIME_INVALID —
  // `remindAt.getTime() <= Date.now()`. Saying so here costs no round trip.
  if (input.remindAt.getTime() <= Date.now()) {
    throw new Error("CRM_REMINDER_TIME_INVALID");
  }
  return {
    branchId: input.branchId,
    targetType: input.targetType,
    targetId: requiredUuid(input.targetId),
    channel: input.channel,
    remindAt: input.remindAt.toISOString(),
  };
}

export function parseActivitiesPage(payload: unknown): CrmPage<CrmActivity> {
  return parsePage(payload, parseActivity);
}

export function parseTasksPage(payload: unknown): CrmPage<CrmTask> {
  return parsePage(payload, parseTask);
}

export function parseEventsPage(payload: unknown): CrmPage<CrmCalendarEvent> {
  return parsePage(payload, parseCalendarEvent);
}

export function parseRemindersPage(payload: unknown): CrmPage<CrmReminder> {
  return parsePage(payload, parseReminder);
}

function parseTask(payload: unknown): CrmTask {
  const source = requireRecord(payload);
  if (
    !isUuid(source.id) ||
    !isUuid(source.branchId) ||
    !isText(source.title) ||
    !isMember(CRM_TASK_STATUSES, source.status) ||
    !isNullableSourceType(source.sourceType) ||
    !isNullableUuid(source.sourceId) ||
    !isNullableTimestamp(source.dueAt) ||
    !isTimestamp(source.createdAt) ||
    !isTimestamp(source.updatedAt)
  ) {
    invalidResponse();
  }
  return {
    id: source.id as string,
    branchId: source.branchId as string,
    sourceType: (source.sourceType as WorkSourceType | null) ?? null,
    sourceId: (source.sourceId as string | null) ?? null,
    title: source.title as string,
    status: source.status,
    dueAt: (source.dueAt as string | null) ?? null,
    createdAt: source.createdAt as string,
    updatedAt: source.updatedAt as string,
  };
}

function parseCalendarEvent(payload: unknown): CrmCalendarEvent {
  const source = requireRecord(payload);
  if (
    !isUuid(source.id) ||
    !isUuid(source.branchId) ||
    !isText(source.title) ||
    !isNullableSourceType(source.sourceType) ||
    !isNullableUuid(source.sourceId) ||
    !isTimestamp(source.startsAt) ||
    !isTimestamp(source.endsAt) ||
    !isTimestamp(source.createdAt) ||
    !isTimestamp(source.updatedAt)
  ) {
    invalidResponse();
  }
  return {
    id: source.id as string,
    branchId: source.branchId as string,
    sourceType: (source.sourceType as WorkSourceType | null) ?? null,
    sourceId: (source.sourceId as string | null) ?? null,
    title: source.title as string,
    startsAt: source.startsAt as string,
    endsAt: source.endsAt as string,
    createdAt: source.createdAt as string,
    updatedAt: source.updatedAt as string,
  };
}

function parseReminder(payload: unknown): CrmReminder {
  const source = requireRecord(payload);
  if (
    !isUuid(source.id) ||
    !isUuid(source.branchId) ||
    !isMember(CRM_REMINDER_TARGET_TYPES, source.targetType) ||
    !isUuid(source.targetId) ||
    !isTimestamp(source.remindAt) ||
    !isMember(CRM_REMINDER_STATUSES, source.status) ||
    !isTimestamp(source.createdAt) ||
    !isTimestamp(source.updatedAt)
  ) {
    invalidResponse();
  }
  return {
    id: source.id as string,
    branchId: source.branchId as string,
    targetType: source.targetType,
    targetId: source.targetId as string,
    remindAt: source.remindAt as string,
    status: source.status,
    createdAt: source.createdAt as string,
    updatedAt: source.updatedAt as string,
  };
}

function parseActivity(payload: unknown): CrmActivity {
  const source = requireRecord(payload);
  if (
    !isUuid(source.id) ||
    !isUuid(source.branchId) ||
    !isMember(CRM_ACTIVITY_TYPES, source.type) ||
    !isText(source.subject) ||
    !isMember(ACTIVITY_SOURCE_TYPES, source.sourceType) ||
    !isUuid(source.sourceId) ||
    !isMember(CRM_ACTIVITY_STATUSES, source.status) ||
    !isNullableMember(CRM_ACTIVITY_DIRECTIONS, source.direction) ||
    !isNullableText(source.description) ||
    !isNullableText(source.outcome) ||
    !isNullableTimestamp(source.activityAt) ||
    !isNullableTimestamp(source.completedAt) ||
    !isNullableUuid(source.ownerUserId) ||
    !isNullableUuid(source.createdByUserId) ||
    !isTimestamp(source.createdAt)
  ) {
    invalidResponse();
  }
  return {
    id: source.id as string,
    branchId: source.branchId as string,
    type: source.type,
    subject: source.subject as string,
    sourceType: source.sourceType,
    sourceId: source.sourceId as string,
    direction: (source.direction as CrmActivityDirection | null) ?? null,
    status: source.status,
    description: (source.description as string | null) ?? null,
    outcome: (source.outcome as string | null) ?? null,
    activityAt: (source.activityAt as string | null) ?? null,
    completedAt: (source.completedAt as string | null) ?? null,
    ownerUserId: (source.ownerUserId as string | null) ?? null,
    createdByUserId: (source.createdByUserId as string | null) ?? null,
    createdAt: source.createdAt as string,
  };
}

function parsePage<T>(
  payload: unknown,
  parseItem: (entry: unknown) => T,
): CrmPage<T> {
  const source = requireRecord(payload);
  if (
    !Array.isArray(source.items) ||
    !Number.isSafeInteger(source.total) ||
    (source.total as number) < 0 ||
    !Number.isSafeInteger(source.page) ||
    (source.page as number) < 1 ||
    !Number.isSafeInteger(source.limit) ||
    (source.limit as number) < 1
  ) {
    invalidResponse();
  }
  return {
    items: source.items.map(parseItem),
    total: source.total as number,
    page: source.page as number,
    limit: source.limit as number,
  };
}

function assertEventWindow(startsAt: Date, endsAt: Date): void {
  // CRM_EVENT_TIME_INVALID: the service requires endsAt > startsAt on both
  // create and update.
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new Error("CRM_EVENT_TIME_INVALID");
  }
}

function requiredText(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) {
    throw new Error("CRM_TEXT_INVALID");
  }
  return trimmed;
}

function boundedText(value: string, max: number): string {
  if (value.length > max) throw new Error("CRM_TEXT_INVALID");
  return value;
}

function requiredUuid(value: string): string {
  if (!UUID_V7_PATTERN.test(value)) throw new Error("CRM_SOURCE_INVALID");
  return value;
}

function isUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_V7_PATTERN.test(value);
}

function isNullableUuid(value: unknown): boolean {
  return value === null || value === undefined || isUuid(value);
}

function isText(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

function isNullableText(value: unknown): boolean {
  return value === null || value === undefined || typeof value === "string";
}

function isTimestamp(value: unknown): boolean {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isNullableTimestamp(value: unknown): boolean {
  return value === null || value === undefined || isTimestamp(value);
}

function isMember<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function isNullableMember<const T extends readonly string[]>(
  values: T,
  value: unknown,
): boolean {
  return value === null || value === undefined || isMember(values, value);
}

function isNullableSourceType(value: unknown): boolean {
  return value === null || value === undefined || isMember(WORK_SOURCE_TYPES, value);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalidResponse();
  }
  return value as Record<string, unknown>;
}

function encodeUuid(id: string): string {
  if (!isUuid(id)) invalidResponse();
  return encodeURIComponent(id);
}

function invalidResponse(): never {
  throw new Error("Invalid CRM activities response.");
}
