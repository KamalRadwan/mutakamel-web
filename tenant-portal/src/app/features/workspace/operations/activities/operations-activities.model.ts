import { ParamMap } from '@angular/router';
import { Language } from '../../../../core/i18n/language';
import { DateRangeValue, presetRange } from '../../../../shared/ui/date-range/date-range';
import {
  ACTIVITY_PRIORITIES,
  ACTIVITY_STATUSES,
  ACTIVITY_TARGET_TYPES,
  ACTIVITY_TYPES,
  Activity,
  ActivityPriority,
  ActivityStatus,
  ActivityTarget,
  ActivityType,
  DueState,
  TargetApp,
} from '../../../../shared/widgets/activities/activities.model';

export const ACTIVITIES_VIEWS = ['list', 'board', 'calendar'] as const;
export type ActivitiesView = (typeof ACTIVITIES_VIEWS)[number];
export type ActivitiesShowScope = 'mine' | 'all';
export type ActivitiesSortDir = 'ASC' | 'DESC';

export const DEFAULT_LIST_STATUSES: readonly ActivityStatus[] = ['PLANNED', 'IN_PROGRESS'];
export const PAGE_SIZES: number[] = [20, 50, 100];
export const DEFAULT_PAGE_SIZE = 20;
export const SEARCH_MAX_LENGTH = 200;

export interface ActivitiesFilterState {
  show: ActivitiesShowScope;
  search: string;
  types: ActivityType[];
  priorities: ActivityPriority[];
  /** null = use view default (PLANNED + IN_PROGRESS in List; all in Calendar). [] = explicitly all statuses in List. */
  statusesExplicit: ActivityStatus[] | null;
  branchId: string | null;
  /** Encoded as "APP:TYPE", e.g. "CRM:LEAD", or null. Client-side filter on primary target. */
  recordType: string | null;
  dueRange: DateRangeValue | null;
  overdue: boolean;
  sortDir: ActivitiesSortDir;
}

export interface BoardLaneState {
  status: ActivityStatus;
  items: Activity[];
  total: number;
  page: number;
  hasNext: boolean;
  loadingMore: boolean;
  overdue: number;
  today: number;
  upcoming: number;
}

export interface RecordTypeOption {
  key: string;
  app: TargetApp;
  type: string;
}

export interface ParsedActivitiesUrl {
  view: ActivitiesView;
  filters: ActivitiesFilterState;
  page: number;
  pageSize: number;
  calendarMonth: Date;
}

export const TARGET_APP_ORDER: readonly TargetApp[] = ['CRM', 'CORE', 'TRADE'];

export const ALL_RECORD_TYPES: readonly RecordTypeOption[] = TARGET_APP_ORDER.flatMap((app) =>
  ACTIVITY_TARGET_TYPES[app].map((type) => ({
    key: `${app}:${type}`,
    app,
    type,
  })),
);

export const DUE_BADGE_CLASSES: Record<DueState, string> = {
  OVERDUE: 'bg-danger text-on-danger',
  TODAY: 'bg-warning text-on-warning',
  UPCOMING: 'bg-success text-on-success',
};

export const DUE_EDGE_CLASSES: Record<DueState, string> = {
  OVERDUE: 'bg-danger',
  TODAY: 'bg-warning',
  UPCOMING: 'bg-success',
};

export const PRIORITY_BADGE_CLASSES: Record<ActivityPriority, string> = {
  URGENT: 'bg-danger text-on-danger',
  HIGH: 'bg-warning text-on-warning',
  NORMAL: 'bg-brand-soft text-on-brand-soft',
  LOW: 'bg-neutral-soft text-on-neutral-soft',
};

export const PRIORITY_DOT_CLASSES: Record<ActivityPriority, string> = {
  LOW: 'bg-status-none',
  NORMAL: 'bg-icon-blue',
  HIGH: 'bg-warning',
  URGENT: 'bg-danger',
};

export const STATUS_BADGE_CLASSES: Record<ActivityStatus, string> = {
  PLANNED: 'bg-brand-soft text-on-brand-soft',
  IN_PROGRESS: 'bg-neutral-soft text-text',
  DONE: 'bg-success text-on-success',
  CANCELLED: 'bg-neutral-soft text-text-muted',
};

export const STATUS_DOT_CLASSES: Record<ActivityStatus, string> = {
  PLANNED: 'bg-brand',
  IN_PROGRESS: 'bg-icon-violet',
  DONE: 'bg-success',
  CANCELLED: 'bg-status-none',
};

const AVATAR_TONES = [
  'bg-icon-blue',
  'bg-icon-navy',
  'bg-icon-teal',
  'bg-icon-green',
  'bg-icon-orange',
  'bg-icon-red',
  'bg-icon-violet',
  'bg-icon-gray',
] as const;

const FAKE_USER_ALIASES: Readonly<Record<string, string>> = {
  'u-owner': 'u1',
  'u-mona': 'u2',
  'u-omar': 'u3',
};

export function defaultFilterState(): ActivitiesFilterState {
  return {
    show: 'mine',
    search: '',
    types: [],
    priorities: [],
    statusesExplicit: null,
    branchId: null,
    recordType: null,
    dueRange: null,
    overdue: false,
    sortDir: 'ASC',
  };
}

export function primaryTargetOf(activity: Activity): ActivityTarget | null {
  return activity.targets.find((target) => target.role === 'PRIMARY') ?? activity.targets[0] ?? null;
}

export function matchesRecordType(activity: Activity, recordType: string | null): boolean {
  if (!recordType) return true;
  const primary = primaryTargetOf(activity);
  if (!primary) return false;
  return `${primary.targetApp}:${primary.targetType}` === recordType;
}

export function localDayBounds(now = new Date()): { dayStart: string; dayEnd: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return { dayStart: start.toISOString(), dayEnd: end.toISOString() };
}

export function todayDateRange(now = new Date()): DateRangeValue {
  return presetRange('TODAY', now);
}

function extractYmd(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match ? match[1] : null;
}

function formatYmd(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalYmd(ymd: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function isTodayRange(range: DateRangeValue | null, now = new Date()): boolean {
  if (!range) return false;
  const todayYmd = formatYmd(now);
  return extractYmd(range.from) === todayYmd && extractYmd(range.to) === todayYmd;
}

export function dateRangeToApiBounds(range: DateRangeValue | null): { dueFrom?: string; dueTo?: string } {
  if (!range) return {};
  const fromYmd = extractYmd(range.from);
  const toYmd = extractYmd(range.to);
  if (!fromYmd) return {};

  const startDate = parseLocalYmd(fromYmd);
  const endDate = parseLocalYmd(toYmd ?? fromYmd);
  if (!startDate || !endDate) return {};

  const orderedStart = startDate.getTime() <= endDate.getTime() ? startDate : endDate;
  const orderedEnd = startDate.getTime() <= endDate.getTime() ? endDate : startDate;

  const dueFrom = new Date(
    orderedStart.getFullYear(),
    orderedStart.getMonth(),
    orderedStart.getDate(),
    0,
    0,
    0,
    0,
  );
  const dueTo = new Date(
    orderedEnd.getFullYear(),
    orderedEnd.getMonth(),
    orderedEnd.getDate() + 1,
    0,
    0,
    0,
    0,
  );

  return {
    dueFrom: dueFrom.toISOString(),
    dueTo: dueTo.toISOString(),
  };
}

export function isSameUser(userId: string | null | undefined, meId: string | null | undefined): boolean {
  if (!userId || !meId) return false;
  const a = FAKE_USER_ALIASES[userId] ?? userId;
  const b = FAKE_USER_ALIASES[meId] ?? meId;
  return a === b;
}

export type ActivityAction = 'complete' | 'cancel';

/** What canActOnActivity needs from the signed-in session. */
export interface ActivityActor {
  meId: string | null;
  isOwner: boolean;
  can(permission: string, scope?: { branchId?: string | null }): boolean;
}

/**
 * Complete and cancel pass Core's permission guard only with the base permission (`activities.complete`,
 * `activities.cancel`, at any scope; else 403 MISSING_REQUIRED_PERMISSIONS). The authorizer then needs
 * `<base>.all` at the activity branch, or the base permission there on an activity the user is assigned to or
 * created (activity-authorizer.service.ts `assertActivityPermission`; else 403 ACTIVITY_ACCESS_DENIED).
 */
export function canActOnActivity(
  actor: ActivityActor,
  action: ActivityAction,
  activity: Pick<Activity, 'branchId' | 'assigneeUserId' | 'createdByUserId'>,
): boolean {
  if (!actor.meId) return false;
  if (actor.isOwner) return true;
  const base = `activities.${action}`;
  if (!actor.can(base)) return false;
  if (actor.can(`${base}.all`, { branchId: activity.branchId })) return true;
  return (
    actor.can(base, { branchId: activity.branchId }) &&
    (isSameUser(activity.assigneeUserId, actor.meId) || isSameUser(activity.createdByUserId, actor.meId))
  );
}

export function userInitialsFromName(name: string | null | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function avatarToneFor(name: string | null | undefined): string {
  const source = name?.trim() || 'u';
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function formatActivityDate(iso: string, language: Language): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(`${language}-u-nu-latn`, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatActivityTime(iso: string, language: Language): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(`${language}-u-nu-latn`, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatActivityDateTime(iso: string, language: Language): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const dateText = formatActivityDate(iso, language);
  const timeText = formatActivityTime(iso, language);
  return timeText ? `${dateText} · ${timeText}` : dateText;
}

/**
 * 403 from the activities routes: MISSING_REQUIRED_PERMISSIONS (permission guard, `details.permissions`) or
 * ACTIVITY_ACCESS_DENIED (branch/record authorizer). Duck-typed on `status`, since the shared activities api
 * throws its own ActivityError.
 */
export function isForbiddenError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 403;
}

export function isDefaultListStatuses(statuses: readonly ActivityStatus[]): boolean {
  return (
    statuses.length === DEFAULT_LIST_STATUSES.length &&
    DEFAULT_LIST_STATUSES.every((status) => statuses.includes(status))
  );
}

export function parseMonthParam(raw: string | null, now = new Date()): Date {
  if (raw) {
    const match = /^(\d{4})-(\d{2})$/.exec(raw.trim());
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      if (year >= 1970 && year <= 2100 && month >= 1 && month <= 12) {
        return new Date(year, month - 1, 1);
      }
    }
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function formatMonthParam(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function parseEnumCsv<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return [];
  const allowedSet = new Set<string>(allowed);
  const result: T[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (allowedSet.has(trimmed) && !result.includes(trimmed as T)) {
      result.push(trimmed as T);
    }
  }
  return result;
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

function parseUrlDueRange(dueFromRaw: string | null, dueToRaw: string | null): DateRangeValue | null {
  if (!dueFromRaw && !dueToRaw) return null;
  const parsePart = (raw: string | null): string | null => {
    if (!raw) return null;
    const direct = parseLocalYmd(raw);
    if (direct) return formatYmd(direct);
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return formatYmd(parsed);
    return null;
  };
  const fromYmd = parsePart(dueFromRaw) ?? parsePart(dueToRaw);
  const toYmd = parsePart(dueToRaw) ?? fromYmd;
  if (!fromYmd || !toYmd) return null;
  const [start, end] = fromYmd <= toYmd ? [fromYmd, toYmd] : [toYmd, fromYmd];
  return {
    from: `${start}T00:00`,
    to: `${end}T23:59`,
    preset: isTodayRange({ from: `${start}T00:00`, to: `${end}T23:59`, preset: null }) ? 'TODAY' : null,
  };
}

export function parseUrlState(params: ParamMap): ParsedActivitiesUrl {
  const rawView = params.get('view');
  const view: ActivitiesView = ACTIVITIES_VIEWS.includes(rawView as ActivitiesView)
    ? (rawView as ActivitiesView)
    : 'list';

  const show: ActivitiesShowScope = params.get('show') === 'all' ? 'all' : 'mine';
  const search = (params.get('search') ?? '').slice(0, SEARCH_MAX_LENGTH);
  const types = parseEnumCsv(params.get('types'), ACTIVITY_TYPES);
  const priorities = parseEnumCsv(params.get('priorities'), ACTIVITY_PRIORITIES);

  const rawStatuses = params.get('statuses');
  let statusesExplicit: ActivityStatus[] | null = null;
  if (rawStatuses === 'all') {
    statusesExplicit = [];
  } else if (rawStatuses) {
    const parsed = parseEnumCsv(rawStatuses, ACTIVITY_STATUSES);
    if (parsed.length > 0) {
      if (view === 'list' && isDefaultListStatuses(parsed)) {
        statusesExplicit = null;
      } else if (view === 'calendar' && parsed.length === ACTIVITY_STATUSES.length) {
        statusesExplicit = null;
      } else {
        statusesExplicit = parsed;
      }
    }
  }

  const branchId = params.get('branchId')?.trim() || null;
  const rawRecordType = params.get('recordType')?.trim() || null;
  const recordType =
    rawRecordType && ALL_RECORD_TYPES.some((item) => item.key === rawRecordType) ? rawRecordType : null;

  const dueRange = parseUrlDueRange(params.get('dueFrom'), params.get('dueTo'));
  const overdue = params.get('overdue') === 'true';
  const sortDir: ActivitiesSortDir = params.get('sortDir') === 'DESC' ? 'DESC' : 'ASC';

  const page = parsePositiveInt(params.get('page'), 1);
  const rawSize = parsePositiveInt(params.get('limit'), DEFAULT_PAGE_SIZE);
  const pageSize = PAGE_SIZES.includes(rawSize) ? rawSize : DEFAULT_PAGE_SIZE;
  const calendarMonth = parseMonthParam(params.get('month'));

  return {
    view,
    filters: {
      show,
      search,
      types,
      priorities,
      statusesExplicit,
      branchId,
      recordType,
      dueRange,
      overdue,
      sortDir,
    },
    page,
    pageSize,
    calendarMonth,
  };
}

export function buildUrlParams(state: ParsedActivitiesUrl, now = new Date()): Record<string, string | null> {
  const { view, filters, page, pageSize, calendarMonth } = state;

  let statusesParam: string | null = null;
  if (filters.statusesExplicit !== null) {
    if (filters.statusesExplicit.length === 0) {
      statusesParam = view === 'list' ? 'all' : null;
    } else if (view === 'list' && isDefaultListStatuses(filters.statusesExplicit)) {
      statusesParam = null;
    } else if (view === 'calendar' && filters.statusesExplicit.length === ACTIVITY_STATUSES.length) {
      statusesParam = null;
    } else {
      statusesParam = filters.statusesExplicit.join(',');
    }
  }

  const dueFromYmd = extractYmd(filters.dueRange?.from);
  const dueToYmd = extractYmd(filters.dueRange?.to);
  const currentMonth = formatMonthParam(new Date(now.getFullYear(), now.getMonth(), 1));
  const selectedMonth = formatMonthParam(calendarMonth);

  return {
    view: view === 'list' ? null : view,
    show: filters.show === 'mine' ? null : filters.show,
    search: filters.search.trim() ? filters.search.trim() : null,
    types: filters.types.length > 0 ? filters.types.join(',') : null,
    priorities: filters.priorities.length > 0 ? filters.priorities.join(',') : null,
    statuses: statusesParam,
    branchId: filters.branchId || null,
    recordType: filters.recordType || null,
    dueFrom: dueFromYmd || null,
    dueTo: dueToYmd || null,
    overdue: filters.overdue ? 'true' : null,
    sortDir: filters.sortDir === 'ASC' ? null : filters.sortDir,
    page: view === 'list' && page > 1 ? String(page) : null,
    limit: view === 'list' && pageSize !== DEFAULT_PAGE_SIZE ? String(pageSize) : null,
    month: view === 'calendar' && selectedMonth !== currentMonth ? selectedMonth : null,
  };
}
