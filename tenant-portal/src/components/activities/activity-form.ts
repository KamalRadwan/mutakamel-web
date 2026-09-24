// The activity form: its model, and the defaults and moves it makes as the
// user fills it in. What Core requires of it, and the request bodies it
// becomes, live beside it in activity-form-rules.ts.
//
// Dates are held as the viewer's LOCAL `yyyy-MM-dd` and `HH:mm` and turned
// into instants only here, with local Date constructors. Slicing an ISO string
// (`iso.slice(0, 16)`) reads the UTC clock and shifts every time by the
// viewer's offset — the defect this replaces in the old CRM dialog.

import {
  ACTIVITY_DONE_START_GRACE_MS,
  ACTIVITY_TARGET_APPS,
  type Activity,
  type ActivityCreateStatus,
  type ActivityTargetApp,
  type ActivityTargetSelection,
  type ActivityType,
} from "./activity-contract";
import { activityTypeTraits, isKnownActivityType, primaryActivityTarget } from "./activity-presentation";

export interface ActivityFormValues {
  /** A known type on create; an edit keeps whatever the server sent. */
  type: string;
  subject: string;
  target: ActivityTargetSelection | null;
  /** null = the default: the actor on create, the current assignee on edit. */
  assigneeUserId: string | null;
  assigneeLabel: string | null;
  /** Create only — after that a status changes through lifecycle actions. */
  status: ActivityCreateStatus;
  priority: string;
  /** "" = none. */
  direction: string;
  startDate: string;
  startTime: string;
  /** Both "" = no end. */
  endDate: string;
  endTime: string;
  location: string;
  meetingUrl: string;
  description: string;
  /** Create + DONE only. */
  outcome: string;
}

const MINUTE_MS = 60_000;

function isTargetApp(value: string): value is ActivityTargetApp {
  return (ACTIVITY_TARGET_APPS as readonly string[]).includes(value);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toLocalTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A `yyyy-MM-dd` as the local midnight a date picker holds. */
export function fromLocalDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toLocalDate(date) === value ? date : undefined;
}

/** A local date and clock time as one instant, or null when either half is missing or impossible. */
function combineLocal(dateValue: string, timeValue: string): Date | null {
  const day = fromLocalDate(dateValue);
  const time = /^(\d{2}):(\d{2})$/u.exec(timeValue);
  if (!day || !time || Number(time[1]) > 23 || Number(time[2]) > 59) return null;
  day.setHours(Number(time[1]), Number(time[2]), 0, 0);
  return day;
}

function withInstant<K extends "start" | "end">(key: K, date: Date): Record<`${K}Date` | `${K}Time`, string> {
  return { [`${key}Date`]: toLocalDate(date), [`${key}Time`]: toLocalTime(date) } as Record<`${K}Date` | `${K}Time`, string>;
}

/** The next local :00 or :30 strictly after now — where a new activity starts by default. */
function nextHalfHour(): Date {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() < 30 ? 30 : 60);
  return date;
}

/** The local :00 or :30 at or before now. */
function currentHalfHour(): Date {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() < 30 ? 0 : 30);
  return date;
}

/** The start as an instant, or null while the date or the time is missing or impossible. */
export function activityFormStart(values: ActivityFormValues): Date | null {
  return combineLocal(values.startDate, values.startTime);
}

export function activityFormEnd(values: ActivityFormValues): Date | null {
  return combineLocal(values.endDate, values.endTime);
}

function defaultEnd(type: string, start: Date): Pick<ActivityFormValues, "endDate" | "endTime"> {
  const minutes = activityTypeTraits(type).defaultMinutes;
  return minutes === null ? { endDate: "", endTime: "" } : withInstant("end", new Date(start.getTime() + minutes * MINUTE_MS));
}

/** Moves the start, carrying an existing end along so the duration survives. */
function moveStart(values: ActivityFormValues, next: Date): ActivityFormValues {
  const start = activityFormStart(values);
  const end = activityFormEnd(values);
  const moved = { ...values, ...withInstant("start", next) };
  return start && end ? { ...moved, ...withInstant("end", new Date(end.getTime() + next.getTime() - start.getTime())) } : moved;
}

export function createActivityForm(options: {
  type?: ActivityType;
  start?: Date;
  target?: ActivityTargetSelection | null;
}): ActivityFormValues {
  const type = options.type ?? "TODO";
  const start = options.start ?? nextHalfHour();
  return {
    type,
    subject: "",
    target: options.target ?? null,
    assigneeUserId: null,
    assigneeLabel: null,
    status: "PLANNED",
    priority: "NORMAL",
    direction: "",
    ...withInstant("start", start),
    ...defaultEnd(type, start),
    location: "",
    meetingUrl: "",
    description: "",
    outcome: "",
  };
}

export function activityToForm(activity: Activity): ActivityFormValues {
  const target = primaryActivityTarget(activity);
  const end = activity.endsAt ? new Date(activity.endsAt) : null;
  return {
    type: activity.type,
    subject: activity.subject,
    // An app this build does not know cannot be sent back to the assignee
    // picker, so such a record is treated as having no usable target.
    target: target && isTargetApp(target.targetApp)
      ? { app: target.targetApp, type: target.targetType, id: target.targetId, label: target.label }
      : null,
    assigneeUserId: null,
    assigneeLabel: null,
    status: "PLANNED",
    priority: activity.priority,
    direction: activity.direction ?? "",
    ...withInstant("start", new Date(activity.dueAt)),
    ...(end ? withInstant("end", end) : { endDate: "", endTime: "" }),
    location: activity.location ?? "",
    meetingUrl: activity.meetingUrl ?? "",
    description: activity.description ?? "",
    outcome: "",
  };
}

/**
 * A new type, and on create the end it implies. An end is re-derived only
 * while it is still the one the previous type derived — a time the user chose
 * is theirs. Edit never invents an end the stored activity did not have.
 */
export function withActivityType(values: ActivityFormValues, type: string, deriveEnd: boolean): ActivityFormValues {
  const start = activityFormStart(values);
  if (!deriveEnd || !start) return { ...values, type };
  const end = activityFormEnd(values);
  const previous = activityTypeTraits(values.type).defaultMinutes;
  const derived = !end || (previous !== null && end.getTime() === start.getTime() + previous * MINUTE_MS);
  return derived ? { ...values, type, ...defaultEnd(type, start) } : { ...values, type };
}

export function withActivityStart(values: ActivityFormValues, patch: { startDate?: string; startTime?: string }): ActivityFormValues {
  const next = { ...values, ...patch };
  const start = activityFormStart(next);
  return start ? moveStart(values, start) : next;
}

/**
 * A new create status, moving a start that the status would refuse: a
 * scheduled activity cannot start in the past, a completed one cannot start in
 * the future. The start moves to the nearest half hour on the allowed side.
 */
export function withActivityStatus(values: ActivityFormValues, status: ActivityCreateStatus): ActivityFormValues {
  const next = { ...values, status };
  const start = activityFormStart(values);
  const now = Date.now();
  if (!start) return next;
  if (status === "PLANNED" && start.getTime() <= now) return moveStart(next, nextHalfHour());
  if (status === "DONE" && start.getTime() > now + ACTIVITY_DONE_START_GRACE_MS) return moveStart(next, currentHalfHour());
  return next;
}

/** "Save and add another": the type, record, assignee and status stay; everything else starts over. */
export function nextActivityForm(values: ActivityFormValues): ActivityFormValues {
  const fresh = createActivityForm({
    type: isKnownActivityType(values.type) ? values.type : undefined,
    target: values.target,
  });
  return withActivityStatus(
    { ...fresh, assigneeUserId: values.assigneeUserId, assigneeLabel: values.assigneeLabel },
    values.status,
  );
}

/**
 * Keeps the user's edits over a newer copy of the activity (after a 409):
 * a field the user did not touch takes the fresh value, a field they changed
 * keeps theirs, so the next save sends only their changes, against the new
 * version, without reverting anyone else's.
 */
export function rebaseActivityForm(
  values: ActivityFormValues,
  seed: ActivityFormValues,
  fresh: ActivityFormValues,
): ActivityFormValues {
  const keys = Object.keys(values) as (keyof ActivityFormValues)[];
  return Object.fromEntries(
    keys.map((key) => [key, JSON.stringify(values[key]) === JSON.stringify(seed[key]) ? fresh[key] : values[key]]),
  ) as unknown as ActivityFormValues;
}
