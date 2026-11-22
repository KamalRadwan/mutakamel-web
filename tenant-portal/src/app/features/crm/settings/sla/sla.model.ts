export type SlaPolicyKind = 'FIRST_RESPONSE' | 'FOLLOW_UP_CADENCE' | 'NEXT_STEP';
export type SlaAppliesToRecord = 'LEAD' | 'OPPORTUNITY';
export type SlaClockKind = 'WORKING_MINUTES' | 'CALENDAR_MINUTES';
export type SlaQualifyingTouchBy = 'OWNER' | 'ANYONE';
export type SlaActivityDirection = 'INBOUND' | 'OUTBOUND' | 'INTERNAL' | 'NONE';
export type SlaTouchSource = 'CRM_ACTIVITY' | 'CORE_ACTIVITY';
export type SlaPolicyState = 'ACTIVE' | 'RETIRED';
export type SlaStartEvent = 'ASSIGNMENT' | 'STAGE_ENTRY';
export type SlaQualifyingFact = 'TOUCH' | 'PLANNED_ACTIVITY';
export type SlaClockMissingReason = 'CALENDAR_UNAVAILABLE' | 'CALENDAR_HOURS_MISSING' | 'DEADLINE_BEYOND_HORIZON';
export type SlaTargetUnit = 'minutes' | 'hours' | 'days';

/** Request qualifiers: each list null or omitted = any value; a sent list holds 1 to 32 values (ArrayMinSize(1)). */
export interface SlaQualifying {
  activityTypes?: string[] | null;
  directions?: SlaActivityDirection[] | null;
  touchSources?: SlaTouchSource[] | null;
}

/** Response qualifiers (`SlaPolicyView.qualifying`): every key present, null = any value, lists sorted. */
export interface SlaPolicyQualifying {
  activityTypes: string[] | null;
  directions: SlaActivityDirection[] | null;
  touchSources: SlaTouchSource[] | null;
}

/** Body of POST crm/sla/policies (`PublishSlaPolicyDto`, crm-app governance/sla/sla.dto.ts). */
export interface PublishSlaPolicy {
  policyKind: SlaPolicyKind;
  appliesToRecord: SlaAppliesToRecord;
  branchId?: string | null;
  clockKind: SlaClockKind;
  targetMinutes?: number | null;
  requiredTouchCount?: number | null;
  compliancePct?: number | null;
  qualifyingTouchBy?: SlaQualifyingTouchBy;
  qualifying?: SlaQualifying;
  nameEn: string;
  nameAr: string;
  /** ISO-8601 instant; omitted = the publish instant. Never before it, and after the previous version's start. */
  effectiveFrom?: string;
  state: SlaPolicyState;
  /** The lineage head the editor saw; null for the first version. Must be sent (undefined = 422 shape invalid). */
  expectedSupersedesPolicyId: string | null;
}

/** One policy version (`SlaPolicyView`, crm-app governance/sla/sla-policy.service.ts). Versions are immutable. */
export interface SlaPolicy {
  id: string;
  policyKind: SlaPolicyKind;
  appliesToRecord: SlaAppliesToRecord;
  branchId: string | null;
  versionNumber: number;
  /** The version's own state; a superseded version keeps it (a RETIRED version carries no target). */
  state: SlaPolicyState;
  /** ISO-8601 instants. */
  effectiveFrom: string;
  effectiveTo: string | null;
  startEvent: SlaStartEvent;
  qualifyingFact: SlaQualifyingFact;
  clockKind: SlaClockKind;
  targetMinutes: number | null;
  requiredTouchCount: number | null;
  compliancePct: number | null;
  qualifyingTouchBy: SlaQualifyingTouchBy;
  qualifying: SlaPolicyQualifying;
  nameEn: string;
  nameAr: string;
  supersedesPolicyId: string | null;
  nextPolicyId: string | null;
  publishedByUserId: string;
  publishedAt: string;
}

/** Query of GET crm/sla/policies (`ListSlaPoliciesQueryDto`); the list is ordered by id, newest first. */
export interface ListSlaPoliciesQuery {
  kind?: SlaPolicyKind;
  record?: SlaAppliesToRecord;
  branchId?: string | 'tenant';
  state?: SlaPolicyState;
  cursor?: string;
  /** 1 to 100, default 25. */
  limit?: number;
}

/** Body of POST crm/sla/clock/preview (`SlaClockPreviewDto`): ISO-8601 instants; send minutes, `to`, or both. */
export interface PreviewSlaClockRequest {
  branchId: string;
  from: string;
  minutes?: number;
  to?: string;
}

/** Response of POST crm/sla/clock/preview (`SlaClockPreview`). */
export interface PreviewSlaClockResponse {
  branchId: string;
  /** ISO instants (`toISOString()`). */
  from: string;
  /** Null when the request sent minutes only. */
  to: string | null;
  /** Null when the request sent `to` only. */
  minutes: number | null;
  asOf: string;
  /** Null when only `to` was sent, or when the calendar cannot place it (see missingReason). */
  deadline: string | null;
  /** Null when only `minutes` was sent. */
  workingMinutes: number | null;
  missingReason: SlaClockMissingReason | null;
}

export const SLA_POLICY_KINDS: readonly SlaPolicyKind[] = [
  'FIRST_RESPONSE',
  'FOLLOW_UP_CADENCE',
  'NEXT_STEP',
];

export const SLA_APPLIES_TO_RECORDS: readonly SlaAppliesToRecord[] = ['LEAD', 'OPPORTUNITY'];

export const SLA_CLOCK_KINDS: readonly SlaClockKind[] = ['WORKING_MINUTES', 'CALENDAR_MINUTES'];

export const SLA_TOUCH_BY_OPTIONS: readonly SlaQualifyingTouchBy[] = ['OWNER', 'ANYONE'];

/** Touch activity types (`SLA_TOUCH_ACTIVITY_TYPES`: CRM activity types + Core activity types, sorted). */
export const SLA_ACTIVITY_TYPES: readonly string[] = [
  'CALL',
  'EMAIL',
  'FOLLOW_UP',
  'MEETING',
  'NOTE',
  'OTHER',
  'TODO',
  'VISIT',
];

/** Planned-activity types for OPPORTUNITY NEXT_STEP (`SLA_PLANNED_ACTIVITY_TYPES`: Core activity types, sorted). */
export const SLA_PLANNED_ACTIVITY_TYPES: readonly string[] = [
  'CALL',
  'EMAIL',
  'FOLLOW_UP',
  'MEETING',
  'OTHER',
  'TODO',
  'VISIT',
];

/**
 * The one record shape per kind and record (`slaPolicyShape`, sla-qualifier.registry.ts): every LEAD policy
 * starts at assignment and counts touches; OPPORTUNITY supports NEXT_STEP only (stage entry, planned activity).
 */
export function slaPolicyShape(
  kind: SlaPolicyKind,
  record: SlaAppliesToRecord,
): { startEvent: SlaStartEvent; qualifyingFact: SlaQualifyingFact } | null {
  if (record === 'LEAD') return { startEvent: 'ASSIGNMENT', qualifyingFact: 'TOUCH' };
  return kind === 'NEXT_STEP' ? { startEvent: 'STAGE_ENTRY', qualifyingFact: 'PLANNED_ACTIVITY' } : null;
}

/** The activity types a policy may filter by: planned-activity policies take Core types only. */
export function activityTypesFor(kind: SlaPolicyKind, record: SlaAppliesToRecord): readonly string[] {
  return slaPolicyShape(kind, record)?.qualifyingFact === 'PLANNED_ACTIVITY'
    ? SLA_PLANNED_ACTIVITY_TYPES
    : SLA_ACTIVITY_TYPES;
}

/** Planned-activity policies filter by activity type only (directions and touch sources must be omitted). */
export function filtersTouchesOnly(kind: SlaPolicyKind, record: SlaAppliesToRecord): boolean {
  return slaPolicyShape(kind, record)?.qualifyingFact !== 'PLANNED_ACTIVITY';
}

/** `SLA_TOUCH_DIRECTIONS`: CRM activity directions plus NONE. */
export const SLA_DIRECTIONS: readonly SlaActivityDirection[] = [
  'INBOUND',
  'OUTBOUND',
  'INTERNAL',
  'NONE',
];

export const SLA_TOUCH_SOURCES: readonly SlaTouchSource[] = ['CRM_ACTIVITY', 'CORE_ACTIVITY'];

export const SLA_STATES: readonly SlaPolicyState[] = ['ACTIVE', 'RETIRED'];

export const SLA_TARGET_UNITS: readonly SlaTargetUnit[] = ['minutes', 'hours', 'days'];

export const SLA_LIMITS = {
  maxNameLength: 120,
  maxWorkingMinutes: 100000,
  maxCalendarMinutes: 525600,
  minTouchCount: 1,
  maxTouchCount: 50,
  maxCompliancePct: 100,
  workingMinutesPerDay: 480,
  calendarMinutesPerDay: 1440,
  maxClockHorizonDays: 400,
  maxPreviewMinutes: 100000,
  maxQualifierValues: 32,
} as const;

export function minutesPerDayForClock(clockKind: SlaClockKind): number {
  return clockKind === 'WORKING_MINUTES'
    ? SLA_LIMITS.workingMinutesPerDay
    : SLA_LIMITS.calendarMinutesPerDay;
}

export function maxMinutesForClock(clockKind: SlaClockKind): number {
  return clockKind === 'WORKING_MINUTES'
    ? SLA_LIMITS.maxWorkingMinutes
    : SLA_LIMITS.maxCalendarMinutes;
}

export function decomposeTargetMinutes(
  targetMinutes: number | null | undefined,
  clockKind: SlaClockKind,
): { value: number; unit: SlaTargetUnit } {
  if (targetMinutes == null || !Number.isFinite(targetMinutes) || targetMinutes <= 0) {
    return { value: 30, unit: 'minutes' };
  }
  const dayMinutes = minutesPerDayForClock(clockKind);
  if (targetMinutes % dayMinutes === 0) {
    return { value: targetMinutes / dayMinutes, unit: 'days' };
  }
  if (targetMinutes % 60 === 0) {
    return { value: targetMinutes / 60, unit: 'hours' };
  }
  return { value: targetMinutes, unit: 'minutes' };
}

export function composeTargetMinutes(
  value: number,
  unit: SlaTargetUnit,
  clockKind: SlaClockKind,
): number {
  if (!Number.isFinite(value)) return NaN;
  switch (unit) {
    case 'days':
      return Math.round(value * minutesPerDayForClock(clockKind));
    case 'hours':
      return Math.round(value * 60);
    case 'minutes':
    default:
      return Math.round(value);
  }
}

/** A qualifier list for the publish body: an empty selection means any value, sent as null (a sent list needs 1+ values). */
function qualifierList<T extends string>(values: readonly T[]): T[] | null {
  return values.length ? [...new Set(values)].sort() : null;
}

export interface SlaPolicyForm {
  policyKind: SlaPolicyKind;
  appliesToRecord: SlaAppliesToRecord;
  branchId: string | null;
  clockKind: SlaClockKind;
  targetMinutes: number | null;
  requiredTouchCount: number | null;
  compliancePct: number | null;
  qualifyingTouchBy: SlaQualifyingTouchBy;
  activityTypes: readonly string[];
  directions: readonly SlaActivityDirection[];
  touchSources: readonly SlaTouchSource[];
  nameEn: string;
  nameAr: string;
  /** Date-only (YYYY-MM-DD) from the date field. */
  effectiveFrom: string;
  state: SlaPolicyState;
  expectedSupersedesPolicyId: string | null;
}

/**
 * Builds the publish body the backend accepts (`checkPolicy`, sla-policy.service.ts):
 * - a RETIRED version carries no target, touches or compliance; only an active FOLLOW_UP_CADENCE counts touches;
 * - an OPPORTUNITY NEXT_STEP (planned activity) filters by activity type only, so directions and touch sources are null;
 * - an empty selection is null (any value), since a sent list needs at least one value;
 * - an effective date of today is omitted (= the publish instant: today 00:00Z is already backdated);
 *   a later date is sent as that day's 00:00Z instant.
 */
export function toPublishBody(form: SlaPolicyForm, todayIso: string): PublishSlaPolicy {
  const active = form.state === 'ACTIVE';
  const cadence = form.policyKind === 'FOLLOW_UP_CADENCE';
  const planned = !filtersTouchesOnly(form.policyKind, form.appliesToRecord);
  const allowedTypes = new Set(activityTypesFor(form.policyKind, form.appliesToRecord));
  const body: PublishSlaPolicy = {
    policyKind: form.policyKind,
    appliesToRecord: form.appliesToRecord,
    branchId: form.branchId,
    clockKind: form.clockKind,
    targetMinutes: active ? form.targetMinutes : null,
    requiredTouchCount: active && cadence ? form.requiredTouchCount : null,
    compliancePct: active && cadence ? form.compliancePct : null,
    qualifyingTouchBy: form.qualifyingTouchBy,
    qualifying: {
      activityTypes: qualifierList(form.activityTypes.filter((type) => allowedTypes.has(type))),
      directions: planned ? null : qualifierList(form.directions),
      touchSources: planned ? null : qualifierList(form.touchSources),
    },
    nameEn: form.nameEn.trim(),
    nameAr: form.nameAr.trim(),
    state: form.state,
    expectedSupersedesPolicyId: form.expectedSupersedesPolicyId,
  };
  const date = form.effectiveFrom.trim().slice(0, 10);
  if (date && date > todayIso) body.effectiveFrom = `${date}T00:00:00.000Z`;
  return body;
}

/** The date-only part of an ISO instant, for the date field. */
export function isoDateOnly(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}
