// How an activity reads on screen, and who may act on it — everything a
// surface derives from the wire shape without asking the server again.

import type { LucideIcon } from "lucide-react";
import { Circle, Clock, Mail, MapPin, Phone, Activity as ScheduledActivityGlyph, SquareCheck, Users } from "lucide-react";
import type { TenantUserProfile } from "@/context/AuthContext";
import { describeApiOutcome, formatApiErrorMessage, type BadgeProps } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { NormalizedApiError } from "@/lib/api/errors";
import { wireLabel } from "@/lib/format/wire-label";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { isUUIDv7 } from "@/lib/uuid";
import {
  ACTIVITY_TARGET_APPS,
  ACTIVITY_TARGET_TYPES,
  ACTIVITY_TYPES,
  OPEN_ACTIVITY_STATUSES,
  type Activity,
  type ActivityCreateStatus,
  type ActivityScope,
  type ActivityTarget,
  type ActivityTargetApp,
  type ActivityTargetSelection,
  type ActivityType,
} from "./activity-contract";

// The glyph Core's own catalogue names for each type (the `icon` of
// `GET activity-types`, docs/design/icons.md#activity-types), so a type looks
// the same wherever it is drawn. A type is a category: told apart by glyph and
// label, never by hue. `Activity` (the pulse line) stands for "scheduled
// activity" as a whole, which is why it only appears as the fallback for a
// type this build has never seen.
const ACTIVITY_TYPE_ICONS: Record<ActivityType, LucideIcon> = {
  TODO: SquareCheck,
  CALL: Phone,
  MEETING: Users,
  EMAIL: Mail,
  VISIT: MapPin,
  FOLLOW_UP: Clock,
  OTHER: Circle,
};

export function isKnownActivityType(type: string): type is ActivityType {
  return (ACTIVITY_TYPES as readonly string[]).includes(type);
}

export function activityTypeIcon(type: string): { icon: LucideIcon; isFallback: boolean } {
  return isKnownActivityType(type)
    ? { icon: ACTIVITY_TYPE_ICONS[type], isFallback: false }
    : { icon: ScheduledActivityGlyph, isFallback: true };
}

/** Which fields a type carries. Hidden fields are never sent on create and are cleared on edit. */
export interface ActivityTypeTraits {
  /** A call or a meeting STARTS; a task or an email is DUE. */
  startLabel: "start" | "due";
  hasEnd: boolean;
  hasLocation: boolean;
  hasMeetingUrl: boolean;
  hasDirection: boolean;
  /** The end a new activity of this type is given, in minutes after its start. */
  defaultMinutes: number | null;
}

const DUE_ONLY: ActivityTypeTraits = {
  startLabel: "due",
  hasEnd: false,
  hasLocation: false,
  hasMeetingUrl: false,
  hasDirection: false,
  defaultMinutes: null,
};

const ACTIVITY_TYPE_TRAITS: Record<ActivityType, ActivityTypeTraits> = {
  TODO: DUE_ONLY,
  FOLLOW_UP: DUE_ONLY,
  OTHER: DUE_ONLY,
  EMAIL: { ...DUE_ONLY, hasDirection: true },
  CALL: { startLabel: "start", hasEnd: true, hasLocation: false, hasMeetingUrl: true, hasDirection: true, defaultMinutes: 30 },
  MEETING: { startLabel: "start", hasEnd: true, hasLocation: true, hasMeetingUrl: true, hasDirection: false, defaultMinutes: 60 },
  VISIT: { startLabel: "start", hasEnd: true, hasLocation: true, hasMeetingUrl: false, hasDirection: false, defaultMinutes: 60 },
};

// A type from a newer Core shows every field it might hold: hiding one would
// make an edit of the subject silently clear a location this build cannot name.
const UNKNOWN_TYPE_TRAITS: ActivityTypeTraits = {
  startLabel: "start",
  hasEnd: true,
  hasLocation: true,
  hasMeetingUrl: true,
  hasDirection: true,
  defaultMinutes: null,
};

export function activityTypeTraits(type: string): ActivityTypeTraits {
  return isKnownActivityType(type) ? ACTIVITY_TYPE_TRAITS[type] : UNKNOWN_TYPE_TRAITS;
}

export function isOpenActivityStatus(status: string): boolean {
  return (OPEN_ACTIVITY_STATUSES as readonly string[]).includes(status);
}

export type ActivityDueState = "OVERDUE" | "TODAY" | "UPCOMING";

/**
 * Where an open activity stands against the clock — the summary endpoint's
 * buckets, applied to one row: overdue once its END (or its start, when it has
 * no end) has passed; due today when it starts before the viewer's midnight.
 * Terminal activities have no due state.
 */
export function activityDueState(
  activity: Pick<Activity, "status" | "dueAt" | "endsAt">,
  now: number = Date.now(),
): ActivityDueState | null {
  if (!isOpenActivityStatus(activity.status)) return null;
  const start = Date.parse(activity.dueAt);
  const end = activity.endsAt ? Date.parse(activity.endsAt) : start;
  if (end < now) return "OVERDUE";
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return start < midnight.getTime() ? "TODAY" : "UPCOMING";
}

/** Colour carries due state only: overdue is negative, due today is caution, upcoming says nothing. */
export const ACTIVITY_DUE_STATE_TONE: Record<ActivityDueState, NonNullable<BadgeProps["tone"]>> = {
  OVERDUE: "negative",
  TODAY: "caution",
  UPCOMING: "neutral",
};

/** Priority is the one category that is an attention signal — tokens.md `CrmPriorityEnum`. */
export function activityPriorityTone(priority: string): NonNullable<BadgeProps["tone"]> {
  return priority === "HIGH" || priority === "URGENT" ? "caution" : "neutral";
}

export interface ActivityTargetKind {
  app: ActivityTargetApp;
  type: string;
}

/** The record types a surface offers, in picker order. Every type is unique across apps. */
export function activityTargetKinds(scope: ActivityScope): ActivityTargetKind[] {
  const apps: readonly ActivityTargetApp[] = scope === "CRM" ? ["CRM"] : ACTIVITY_TARGET_APPS;
  return apps.flatMap((app) => ACTIVITY_TARGET_TYPES[app].map((type) => ({ app, type })));
}

export function primaryActivityTarget(activity: Activity): ActivityTarget | null {
  return activity.targets.find((target) => target.role === "PRIMARY") ?? activity.targets[0] ?? null;
}

// The portal's own detail routes. The server's `route` is never followed: it
// addresses another application's UI, and this portal only navigates to paths
// it built itself.
const TARGET_ROUTES: Readonly<Record<string, string>> = {
  LEAD: TENANT_ROUTES.crmLeads,
  CUSTOMER_PROFILE: TENANT_ROUTES.crmCustomerProfiles,
  OPPORTUNITY: TENANT_ROUTES.crmOpportunities,
};

export function activityTargetHref(targetType: string, targetId: string): string | null {
  const base = TARGET_ROUTES[targetType];
  return base && isUUIDv7(targetId) ? `${base}/${targetId}` : null;
}

/**
 * The Activities workspace, filtered to one record. CRM records open the CRM
 * workspace, others Core's. It opens on the table: a record's activities span
 * its whole history, and a calendar would show only this month of it.
 */
export function activitiesWorkspaceHref(target: ActivityTargetSelection): string {
  const base = target.app === "CRM" ? TENANT_ROUTES.crmActivities : TENANT_ROUTES.coreActivities;
  const query = new URLSearchParams({ targetApp: target.app, targetType: target.type, targetId: target.id, view: "table" });
  return `${base}?${query.toString()}`;
}

// Admission — advisory, the backend is authoritative. Two checks stand in
// front of a write. The route's guard wants the base key itself
// (`activities.update`), matched exactly: `.all` alone is refused there. Behind
// it, ActivityAuthorizerService.assertActivityPermission lets `.all` act
// branch-wide and the base key act only on activities the actor is assigned to
// or created. The tenant owner passes both.
type ActivityActor = Pick<TenantUserProfile, "id" | "isTenantOwner" | "permissions"> | null;
export type ActivityAction = "update" | "complete" | "cancel";

function holds(actor: ActivityActor, key: string): boolean {
  return actor !== null && (actor.isTenantOwner || actor.permissions.includes(key));
}

export function canCreateActivities(actor: ActivityActor): boolean {
  return holds(actor, "activities.create");
}

/**
 * Choosing someone else reads `GET activities/assignees`, whose guard wants
 * `activities.assign` itself — a scoped grant alone could not fill the picker.
 */
export function canAssignActivities(actor: ActivityActor): boolean {
  return holds(actor, "activities.assign");
}

/**
 * Filing a new activity as started or done: the create route's guard has
 * already admitted it, and the service accepts the action at either scope for
 * the activity's own creator.
 */
function holdsActivityPermission(actor: ActivityActor, action: ActivityAction): boolean {
  return holds(actor, `activities.${action}`) || holds(actor, `activities.${action}.all`);
}

export function canActOnActivity(actor: ActivityActor, action: ActivityAction, activity: Activity): boolean {
  if (actor === null || !isOpenActivityStatus(activity.status) || !holds(actor, `activities.${action}`)) return false;
  return holds(actor, `activities.${action}.all`)
    || activity.assigneeUserId === actor.id
    || activity.createdByUserId === actor.id;
}

/**
 * The statuses a new activity may be filed in. IN_PROGRESS also needs the
 * right to update, and DONE the right to complete — the creator is the actor,
 * so the base permission is enough for both.
 */
export function activityCreateStatuses(actor: ActivityActor): ActivityCreateStatus[] {
  const statuses: ActivityCreateStatus[] = ["PLANNED"];
  if (holdsActivityPermission(actor, "update")) statuses.push("IN_PROGRESS");
  if (holdsActivityPermission(actor, "complete")) statuses.push("DONE");
  return statuses;
}

type ActivityCopy = Dictionary["activities"];
type ActivityLabelGroup = "types" | "statuses" | "priorities" | "directions" | "targetTypes";

/** A wire value's label. An unknown one reads "Unknown (VALUE)" — never the bare code. */
export function activityLabel(copy: ActivityCopy, group: ActivityLabelGroup, value: string): string {
  return wireLabel(copy[group], value, copy.unknownValue, `activities.${group}`);
}

/** The create heading names its fixed or newly selected record without spending a second header line. */
export function activityCreateModalTitle(title: string, recordName?: string | null): string {
  return [title, recordName].filter(Boolean).join(" · ");
}

/**
 * A failed activity request, as one translated sentence for an in-body slot.
 *
 * Branches on the code, never the text: Core's messages are English. A 403
 * returns null because the transport has already raised its own toast, and a
 * second message about the same refusal is noise.
 */
export function activityErrorMessage(t: Dictionary, error: NormalizedApiError): string | null {
  if (error.status === 403) return null;
  const byCode: Readonly<Record<string, string | undefined>> = t.activities.errors;
  const translated = (error.code ? byCode[error.code] : undefined) ?? describeApiOutcome(error, t)?.description;
  if (!translated) return formatApiErrorMessage(error, t) ?? t.activities.errors.generic;
  return error.correlationId ? `${translated} — ${t.errors.reference}: ${error.correlationId}` : translated;
}
