import type { CorePage } from '../../../core/api/core-page';

export const ACTIVITY_TYPES = ['TODO', 'CALL', 'MEETING', 'EMAIL', 'VISIT', 'FOLLOW_UP', 'OTHER'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_STATUSES = ['PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const ACTIVITY_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type ActivityPriority = (typeof ACTIVITY_PRIORITIES)[number];

export type ActivityDirection = 'INBOUND' | 'OUTBOUND' | 'INTERNAL';
export type TargetApp = 'CRM' | 'CORE' | 'TRADE';
export type DueState = 'OVERDUE' | 'TODAY' | 'UPCOMING';

export const ACTIVITY_TARGET_TYPES: Record<TargetApp, readonly string[]> = {
  CRM: ['LEAD', 'CUSTOMER_PROFILE', 'PARTY', 'OPPORTUNITY'],
  CORE: ['PARTY'],
  TRADE: ['QUOTATION', 'SALES_ORDER'],
};

export interface ActivityTarget {
  id: string;
  role: 'PRIMARY' | 'CONTEXT';
  targetApp: TargetApp;
  targetType: string;
  targetId: string;
  label: string;
  route: string;
  targetVersion: string | null;
  unavailableAt: string | null;
}

export interface Activity {
  id: string;
  type: ActivityType;
  subject: string;
  description: string | null;
  direction: ActivityDirection | null;
  priority: ActivityPriority;
  status: ActivityStatus;
  dueAt: string;
  endsAt: string | null;
  reminderOffsetMinutes: number | null;
  reminderSentAt: string | null;
  location: string | null;
  meetingUrl: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  outcome: string | null;
  assigneeUserId: string;
  assigneeName: string | null;
  createdByUserId: string;
  createdByName: string | null;
  branchId: string;
  companyId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  targets: ActivityTarget[];
}

/**
 * `GET tenant/activities`: the handler returns ActivityPageDto { items, total, page, limit, totalPages, hasNext },
 * and Core's global ResponseEnvelopeInterceptor turns a paged result into `data: items` plus
 * `meta { page, limit, total, totalPages, hasNext, hasPrev }`. The api returns that `{ data, meta }` part.
 */
export type ActivityPage = CorePage<Activity>;

export interface ActivityStatusSummary {
  status: ActivityStatus;
  total: number;
  overdue: number;
  today: number;
  upcoming: number;
}

export interface ActivitySummary {
  overdue: number;
  today: number;
  upcoming: number;
  completedToday: number;
  byStatus: ActivityStatusSummary[];
}

export interface ActivityScopeFilter {
  branchId?: string;
  assigneeUserId?: string;
  targetApp?: TargetApp;
  targetType?: string;
  targetId?: string;
  types?: ActivityType[];
  priorities?: ActivityPriority[];
  dueFrom?: string;
  dueTo?: string;
  search?: string;
}

export type ActivityTargetSelector =
  | { targetApp: TargetApp; targetType: string; targetId: string }
  | { app: TargetApp; type: string; id: string };

export type ActivitySummaryScope = ActivityScopeFilter & {
  app?: TargetApp;
  type?: string;
  id?: string;
};

export interface ActivityListParams extends ActivityScopeFilter {
  statuses?: ActivityStatus[];
  overdue?: boolean;
  sortBy?: 'dueAt';
  sortDir?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export interface ActivityCalendarParams extends ActivityScopeFilter {
  statuses?: ActivityStatus[];
  overdue?: boolean;
  from: string;
  to: string;
}

export interface ActivityCalendarResponse {
  items: Activity[];
  truncated: boolean;
}

export interface ActivityTargetsParams {
  targetApp: TargetApp;
  targetType: string;
  branchId?: string;
  search?: string;
}

export interface ActivityTargetOption {
  targetApp: TargetApp;
  targetType: string;
  targetId: string;
  label: string;
  branchId: string;
}

export interface ActivityTypeDefinition {
  key: ActivityType;
  label: string;
  icon: string;
  defaultPriority: ActivityPriority;
}

export interface ActivityAssigneesParams {
  targetApp: TargetApp;
  targetType: string;
  targetId: string;
  search?: string;
}

export interface Assignee {
  id: string;
  name: string;
}

export interface CreateActivity {
  target: { app: TargetApp; type: string; id: string };
  type: ActivityType;
  subject: string;
  description?: string | null;
  direction?: ActivityDirection | null;
  priority?: ActivityPriority;
  dueAt: string;
  endsAt?: string | null;
  reminderOffsetMinutes?: number | null;
  location?: string | null;
  meetingUrl?: string | null;
  status?: 'PLANNED' | 'IN_PROGRESS' | 'DONE';
  outcome?: string | null;
  assigneeUserId?: string;
}

export type UpdateActivity = Partial<Omit<CreateActivity, 'target' | 'status' | 'outcome'>>;

export type ActivityErrorCode =
  | 'ACTIVITY_INVALID'
  | 'ACTIVITY_VERSION_CONFLICT'
  | 'ACTIVITY_TERMINAL'
  | 'ACTIVITY_NOT_FOUND'
  | 'ACTIVITY_ACCESS_DENIED'
  | 'ACTIVITY_VERSION_REQUIRED'
  | 'ACTIVITY_IDEMPOTENCY_KEY_INVALID'
  | 'ACTIVITY_IDEMPOTENCY_MISMATCH'
  | 'ACTIVITY_IDEMPOTENCY_IN_FLIGHT'
  | 'ACTIVITY_TARGET_RESOLVER_UNAVAILABLE'
  | 'CORE_VALIDATION_FAILED'
  | 'MISSING_REQUIRED_PERMISSIONS'
  | 'ACCESS_POLICY_BLOCKED'
  | 'ACCESS_POLICY_UNAVAILABLE';

/**
 * HTTP status per code, as thrown by core-app `tenant/activities` (activity.errors.ts,
 * activity-idempotency.service.ts, main.ts `coreValidationException`).
 */
export const ACTIVITY_ERROR_STATUS: Record<ActivityErrorCode, number> = {
  CORE_VALIDATION_FAILED: 400,
  MISSING_REQUIRED_PERMISSIONS: 403,
  ACCESS_POLICY_BLOCKED: 403,
  ACCESS_POLICY_UNAVAILABLE: 503,
  ACTIVITY_ACCESS_DENIED: 403,
  ACTIVITY_NOT_FOUND: 404,
  ACTIVITY_VERSION_CONFLICT: 409,
  ACTIVITY_TERMINAL: 409,
  ACTIVITY_IDEMPOTENCY_IN_FLIGHT: 409,
  ACTIVITY_INVALID: 422,
  ACTIVITY_IDEMPOTENCY_KEY_INVALID: 422,
  ACTIVITY_IDEMPOTENCY_MISMATCH: 422,
  ACTIVITY_VERSION_REQUIRED: 428,
  ACTIVITY_TARGET_RESOLVER_UNAVAILABLE: 503,
};

/**
 * Error envelope `{ statusCode, errorCode, message, details }`.
 * `details` is set only for `CORE_VALIDATION_FAILED` (class-validator, keyed by DTO property path,
 * e.g. `subject`, `target.id`). `ACTIVITY_INVALID` carries a message only, no field.
 * `field` is the first `details` key, kept for callers that read a single field.
 */
export class ActivityError extends Error {
  readonly status: number;
  readonly field: string | undefined;

  constructor(
    readonly code: ActivityErrorCode,
    field?: string,
    readonly details?: Readonly<Record<string, readonly string[]>>,
  ) {
    super(code);
    this.name = 'ActivityError';
    this.status = ACTIVITY_ERROR_STATUS[code];
    this.field = field ?? (details ? Object.keys(details)[0] : undefined);
  }
}

/** `CORE_VALIDATION_FAILED` (400) for one DTO property. */
export function activityValidationError(field: string, message: string): ActivityError {
  return new ActivityError('CORE_VALIDATION_FAILED', field, { [field]: [message] });
}

export const TYPE_LOOK: Record<ActivityType, { icon: string; tile: string; chip: string; chipActive: string }> = {
  TODO: {
    icon: 'tablerSquareCheck',
    tile: 'bg-icon-orange',
    chip: 'border-icon-orange text-icon-orange',
    chipActive: 'bg-icon-orange border-icon-orange text-on-icon',
  },
  CALL: {
    icon: 'tablerPhone',
    tile: 'bg-icon-green',
    chip: 'border-icon-green text-icon-green',
    chipActive: 'bg-icon-green border-icon-green text-on-icon',
  },
  MEETING: {
    icon: 'tablerUsers',
    tile: 'bg-icon-violet',
    chip: 'border-icon-violet text-icon-violet',
    chipActive: 'bg-icon-violet border-icon-violet text-on-icon',
  },
  EMAIL: {
    icon: 'tablerMail',
    tile: 'bg-icon-blue',
    chip: 'border-icon-blue text-icon-blue',
    chipActive: 'bg-icon-blue border-icon-blue text-on-icon',
  },
  VISIT: {
    icon: 'tablerMap2',
    tile: 'bg-icon-teal',
    chip: 'border-icon-teal text-icon-teal',
    chipActive: 'bg-icon-teal border-icon-teal text-on-icon',
  },
  FOLLOW_UP: {
    icon: 'tablerAlarm',
    tile: 'bg-icon-orange',
    chip: 'border-icon-orange text-icon-orange',
    chipActive: 'bg-icon-orange border-icon-orange text-on-icon',
  },
  OTHER: {
    icon: 'tablerCircleDot',
    tile: 'bg-icon-gray',
    chip: 'border-icon-gray text-icon-gray',
    chipActive: 'bg-icon-gray border-icon-gray text-on-icon',
  },
};

export const TYPE_FIELDS: Record<
  ActivityType,
  { end: boolean; location: boolean; meetingUrl: boolean; direction: boolean; defaultMinutes: number | null }
> = {
  TODO: { end: true, location: false, meetingUrl: false, direction: false, defaultMinutes: null },
  FOLLOW_UP: { end: true, location: false, meetingUrl: false, direction: false, defaultMinutes: null },
  OTHER: { end: true, location: false, meetingUrl: false, direction: false, defaultMinutes: null },
  EMAIL: { end: true, location: false, meetingUrl: false, direction: true, defaultMinutes: null },
  CALL: { end: true, location: false, meetingUrl: true, direction: true, defaultMinutes: 30 },
  MEETING: { end: true, location: true, meetingUrl: true, direction: false, defaultMinutes: 60 },
  VISIT: { end: true, location: true, meetingUrl: false, direction: false, defaultMinutes: 60 },
};

export const LIMITS = {
  subject: 180,
  description: 4000,
  location: 180,
  meetingUrl: 2048,
  outcome: 2000,
  maxDays: 14,
  reminderMax: 40320,
};

export const MEETING_URL = /^https?:\/\/\S+$/;

export function isOpen(a: Pick<Activity, 'status'>): boolean {
  return a.status === 'PLANNED' || a.status === 'IN_PROGRESS';
}

export function dueState(a: Pick<Activity, 'status' | 'dueAt' | 'endsAt'>, now = new Date()): DueState | null {
  if (!isOpen(a)) return null;
  const effectiveEnd = new Date(a.endsAt ?? a.dueAt);
  if (effectiveEnd.getTime() < now.getTime()) return 'OVERDUE';
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (new Date(a.dueAt).getTime() < nextMidnight.getTime()) return 'TODAY';
  return 'UPCOMING';
}
