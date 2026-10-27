// What Core requires of the activity form, and the request bodies it becomes.
//
// The validation is a MIRROR of Core — CreateActivityDto / UpdateActivityDto
// and activity.rules.ts — never a second opinion: whatever it misses still
// comes back from the server and lands in the modal's error slot.

import type { Dictionary } from "@/i18n/dictionaries/ar";
import { formatTemplate } from "@/lib/format/template";
import {
  ACTIVITY_DESCRIPTION_MAX,
  ACTIVITY_DONE_START_GRACE_MS,
  ACTIVITY_LOCATION_MAX,
  ACTIVITY_MAX_DURATION_DAYS,
  ACTIVITY_MEETING_URL_MAX,
  ACTIVITY_OUTCOME_MAX,
  ACTIVITY_SUBJECT_MAX,
  activityTextLength,
  type Activity,
} from "./activity-contract";
import { activityFormEnd, activityFormStart, type ActivityFormValues } from "./activity-form";
import { activityTypeTraits } from "./activity-presentation";

export type ActivityFormField =
  | "subject" | "target" | "start" | "end" | "location" | "meetingUrl" | "description" | "outcome" | "reminderOffsetMinutes";

type ActivityValidationCode =
  | "required" | "maxLength" | "startInPast" | "doneInFuture" | "endBeforeStart" | "endTooLong"
  | "invalidUrl" | "targetRequired" | "invalidReminderOffset";

export type ActivityFormErrors = Partial<Record<ActivityFormField, ActivityValidationCode>>;

export interface ActivityValidationContext {
  mode: "create" | "edit";
  /** Edit: the values the form was opened with, and the activity's stored status. */
  seed?: ActivityFormValues;
  activityStatus?: string;
}

const MAX_DURATION_MS = ACTIVITY_MAX_DURATION_DAYS * 24 * 60 * 60_000;

const LENGTH_LIMITS: Partial<Record<ActivityFormField, number>> = {
  subject: ACTIVITY_SUBJECT_MAX,
  location: ACTIVITY_LOCATION_MAX,
  meetingUrl: ACTIVITY_MEETING_URL_MAX,
  description: ACTIVITY_DESCRIPTION_MAX,
  outcome: ACTIVITY_OUTCOME_MAX,
};

function startChanged(values: ActivityFormValues, seed: ActivityFormValues): boolean {
  return values.startDate !== seed.startDate || values.startTime !== seed.startTime;
}

/**
 * `@IsUrl({ protocols: ['http','https'], require_protocol: true })` plus the
 * table's `^https?://[^[:space:]]+$`, which — unlike `IsUrl` — is
 * case-sensitive about the scheme, so `HTTPS://` is refused here as it is there.
 */
export function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\/\S+$/u.test(value)) return false;
  try {
    // `require_tld` is on by default in class-validator, so a bare host is refused.
    return new URL(value).hostname.includes(".");
  } catch {
    return false;
  }
}

/** Field -> the first thing wrong with it. Runs against the current clock. */
export function validateActivityForm(values: ActivityFormValues, context: ActivityValidationContext): ActivityFormErrors {
  const errors: ActivityFormErrors = {};
  const traits = activityTypeTraits(values.type);
  const now = Date.now();
  const creating = context.mode === "create";

  const subject = values.subject.trim();
  if (!subject) errors.subject = "required";
  else if (activityTextLength(subject) > ACTIVITY_SUBJECT_MAX) errors.subject = "maxLength";

  if (creating && !values.target) errors.target = "targetRequired";
  if ((!creating || values.status !== "DONE") && values.reminderOffsetMinutes !== "" && (
    !/^\d+$/u.test(values.reminderOffsetMinutes)
    || !Number.isSafeInteger(Number(values.reminderOffsetMinutes))
    || Number(values.reminderOffsetMinutes) > 2147483647
  )) errors.reminderOffsetMinutes = "invalidReminderOffset";

  const start = activityFormStart(values);
  if (!start) errors.start = "required";
  else if (creating && values.status === "PLANNED" && start.getTime() <= now) errors.start = "startInPast";
  else if (creating && values.status === "DONE" && start.getTime() > now + ACTIVITY_DONE_START_GRACE_MS) {
    errors.start = "doneInFuture";
  } else if (
    !creating && context.activityStatus === "PLANNED" && context.seed
    && startChanged(values, context.seed) && start.getTime() <= now
  ) {
    // Core re-checks the start only when it moved, and only while the activity
    // is still scheduled — an overdue one can still have its title corrected.
    errors.start = "startInPast";
  }

  if (traits.hasEnd && (values.endDate || values.endTime)) {
    const end = activityFormEnd(values);
    if (!end) errors.end = "required";
    else if (start && end.getTime() <= start.getTime()) errors.end = "endBeforeStart";
    else if (start && end.getTime() - start.getTime() > MAX_DURATION_MS) errors.end = "endTooLong";
  }

  if (traits.hasLocation && activityTextLength(values.location.trim()) > ACTIVITY_LOCATION_MAX) errors.location = "maxLength";
  const meetingUrl = values.meetingUrl.trim();
  if (traits.hasMeetingUrl && meetingUrl) {
    if (activityTextLength(meetingUrl) > ACTIVITY_MEETING_URL_MAX) errors.meetingUrl = "maxLength";
    else if (!isHttpUrl(meetingUrl)) errors.meetingUrl = "invalidUrl";
  }
  if (activityTextLength(values.description.trim()) > ACTIVITY_DESCRIPTION_MAX) errors.description = "maxLength";
  if (creating && values.status === "DONE" && activityTextLength(values.outcome.trim()) > ACTIVITY_OUTCOME_MAX) {
    errors.outcome = "maxLength";
  }
  return errors;
}

export function activityValidationMessage(
  copy: Dictionary["activities"],
  field: ActivityFormField,
  code: ActivityValidationCode | undefined,
): string | undefined {
  if (!code) return undefined;
  if (code === "maxLength") return formatTemplate(copy.validation.maxLength, { max: LENGTH_LIMITS[field] ?? 0 });
  if (code === "endTooLong") return formatTemplate(copy.validation.endTooLong, { days: ACTIVITY_MAX_DURATION_DAYS });
  return copy.validation[code];
}

/** `CreateActivityDto`. A field the type hides is absent, and so is every blank optional. */
export function buildCreateActivityBody(values: ActivityFormValues): Record<string, unknown> {
  const traits = activityTypeTraits(values.type);
  const start = activityFormStart(values);
  if (!values.target || !start) throw new Error("Invalid activity form.");
  const end = traits.hasEnd ? activityFormEnd(values) : null;
  const optional: Record<string, string | null> = {
    description: values.description.trim() || null,
    direction: traits.hasDirection ? values.direction || null : null,
    endsAt: end ? end.toISOString() : null,
    location: traits.hasLocation ? values.location.trim() || null : null,
    meetingUrl: traits.hasMeetingUrl ? values.meetingUrl.trim() || null : null,
    assigneeUserId: values.assigneeUserId,
    // PLANNED is the default; sending it would only widen the request.
    status: values.status === "PLANNED" ? null : values.status,
    outcome: values.status === "DONE" ? values.outcome.trim() || null : null,
  };
  return {
    target: { app: values.target.app, type: values.target.type, id: values.target.id },
    type: values.type,
    subject: values.subject.trim(),
    priority: values.priority,
    dueAt: start.toISOString(),
    ...(values.status !== "DONE" && values.reminderOffsetMinutes !== ""
      ? { reminderOffsetMinutes: Number(values.reminderOffsetMinutes) } : {}),
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== null)),
  };
}

/**
 * `UpdateActivityDto` — only what changed since the form opened. A cleared
 * optional is `null` (omitting it would mean "leave it alone"). Changing the
 * type clears what the new type does not carry; a value the type never showed
 * — one written by another client — is left alone, because the user was never
 * shown it to decide about.
 */
export function buildUpdateActivityBody(
  values: ActivityFormValues,
  seed: ActivityFormValues,
  activity: Activity,
): Record<string, unknown> {
  const traits = activityTypeTraits(values.type);
  const retyped = values.type !== seed.type;
  const body: Record<string, unknown> = {};
  const optional = (key: "direction" | "location" | "meetingUrl", shown: boolean, stored: string | null) => {
    const value = values[key].trim();
    if (!shown) {
      if (retyped && stored !== null) body[key] = null;
    } else if (value !== seed[key].trim()) {
      body[key] = value || null;
    }
  };

  if (values.type !== seed.type) body.type = values.type;
  if (values.subject.trim() !== seed.subject.trim()) body.subject = values.subject.trim();
  if (values.description.trim() !== seed.description.trim()) body.description = values.description.trim() || null;
  if (values.priority !== seed.priority) body.priority = values.priority;
  if (values.reminderOffsetMinutes !== seed.reminderOffsetMinutes) {
    body.reminderOffsetMinutes = values.reminderOffsetMinutes === "" ? null : Number(values.reminderOffsetMinutes);
  }
  const start = activityFormStart(values);
  if (start && startChanged(values, seed)) body.dueAt = start.toISOString();
  optional("direction", traits.hasDirection, activity.direction);
  optional("location", traits.hasLocation, activity.location);
  optional("meetingUrl", traits.hasMeetingUrl, activity.meetingUrl);
  if (!traits.hasEnd) {
    if (activity.endsAt !== null && retyped) body.endsAt = null;
    else if (activity.endsAt !== null && typeof body.dueAt === "string") {
      // An end this type never shows moves with the start, keeping its length:
      // left behind, it could fall before the new start, and Core would refuse
      // a window the user cannot see to fix.
      const shift = Date.parse(body.dueAt) - Date.parse(activity.dueAt);
      body.endsAt = new Date(Date.parse(activity.endsAt) + shift).toISOString();
    }
  } else if (values.endDate !== seed.endDate || values.endTime !== seed.endTime) {
    body.endsAt = activityFormEnd(values)?.toISOString() ?? null;
  }
  if (values.assigneeUserId && values.assigneeUserId !== activity.assigneeUserId) {
    body.assigneeUserId = values.assigneeUserId;
  }
  return body;
}
