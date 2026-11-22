// Follows crm-app dashboards/dashboard-sales-targets.controller.ts (working-calendars routes),
// dto/dashboard-working-calendar.dto.ts and governance/calendar/working-calendar.service.ts.
// Order: Gateway → ValidationPipe (400 CRM_VALIDATION_FAILED, path-keyed) → service body checks (422)
// → branch grant (403 BRANCH_PERMISSION_DENIED) → zone constancy (422) → revision (409).
import {
  ApiError,
  FAKE_NOW,
  fakeDelay,
  isUuidV7,
} from '../../../../shared/widgets/dashboard/analytics-api';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { FAKE_BRANCHES } from '../../../../shared/widgets/dashboard/fake/fake-org';
import {
  CALENDAR_YEAR_PATTERN,
  CalendarWindow,
  CalendarWindowInput,
  DEFAULT_TIME_ZONE,
  DEFAULT_WEEKDAY_MASK,
  DEFAULT_WORKDAY_END_MINUTE,
  DEFAULT_WORKDAY_START_MINUTE,
  MAX_CALENDAR_WINDOWS,
  MAX_WINDOW_LABEL_LENGTH,
  MAX_WINDOW_LAYER,
  PublishWorkingCalendarRequest,
  WorkingCalendar,
  buildWorkingDaysForYear,
  dayOfYearIndex,
  daysInYear,
  isValidIanaTimeZone,
  windowsOverlap,
} from './calendars.model';

const CAIRO_BRANCH_ID = FAKE_BRANCHES[0].id;
const ALEX_BRANCH_ID = FAKE_BRANCHES[1].id;

/** Active branches the fake actor can reach; any other valid id fails the branch grant (403). */
const BRANCH_IDS = new Set(FAKE_BRANCHES.map((branch) => branch.id.toLowerCase()));

/** SALES_TARGET_MAX_REVISION; expectedRevision is @Max(SALES_TARGET_MAX_REVISION - 1). */
const MAX_REVISION = 2_147_483_647;

/** The permission keys WorkingCalendarService accepts in the branch (any of them). */
const READ_KEYS = ['crm.sla.manage', 'crm.targets.read'];
const PUBLISH_KEYS = ['crm.sla.manage', 'crm.targets.manage'];

function buildEgyptWorkingDays(year: number): string {
  const base = buildWorkingDaysForYear(year, DEFAULT_WEEKDAY_MASK).split('');
  const holidays: [number, number][] = [
    [0, 7], // Jan 7
    [3, 25], // Apr 25
    [5, 30], // Jun 30
    [9, 6], // Oct 6
  ];
  for (const [monthIndex, day] of holidays) {
    const idx = dayOfYearIndex(year, monthIndex, day);
    if (idx >= 0 && idx < base.length) {
      base[idx] = '0';
    }
  }
  return base.join('');
}

function storeKey(branchId: string, year: number): string {
  return `${branchId}:${year}`;
}

/** Head revision per branch and year (the backend keeps every revision; only the head is read). */
const calendars = new Map<string, WorkingCalendar>([
  [
    storeKey(CAIRO_BRANCH_ID, 2026),
    {
      branchId: CAIRO_BRANCH_ID,
      calendarYear: 2026,
      revision: 2,
      workingDays: buildEgyptWorkingDays(2026),
      publishedAt: '2026-01-05T08:00:00.000Z',
      workdayStartMinute: DEFAULT_WORKDAY_START_MINUTE,
      workdayEndMinute: DEFAULT_WORKDAY_END_MINUTE,
      timeZone: DEFAULT_TIME_ZONE,
      windows: [
        {
          windowNo: 1,
          layer: 1,
          validFrom: '2026-02-18',
          validTo: '2026-03-19',
          weekdayMask: DEFAULT_WEEKDAY_MASK,
          startMinute: 9 * 60,
          endMinute: 14 * 60 + 30,
          label: 'Ramadan hours',
        },
      ],
    },
  ],
  [
    storeKey(ALEX_BRANCH_ID, 2026),
    {
      branchId: ALEX_BRANCH_ID,
      calendarYear: 2026,
      revision: 1,
      workingDays: buildEgyptWorkingDays(2026),
      publishedAt: '2026-01-10T09:30:00.000Z',
      workdayStartMinute: DEFAULT_WORKDAY_START_MINUTE,
      workdayEndMinute: DEFAULT_WORKDAY_END_MINUTE,
      timeZone: DEFAULT_TIME_ZONE,
      windows: [],
    },
  ],
]);

type Details = Record<string, string[]>;

function addError(details: Details, path: string, constraint: string): void {
  (details[path] ??= []).push(constraint);
}

function throwIfInvalid(details: Details): void {
  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', details);
  }
}

function present(value: unknown): boolean {
  return value !== undefined && value !== null;
}

/** DashboardWorkingCalendarParamsDto: branchId @IsUUID('7'), year @Matches(2000-2100) @Length(4, 4). */
function validateParams(branchId: string, year: number, details: Details): void {
  if (!isUuidV7(branchId)) addError(details, 'branchId', 'is_uuid');
  const rawYear = String(year);
  if (!CALENDAR_YEAR_PATTERN.test(rawYear)) addError(details, 'year', 'matches');
  if (rawYear.length !== 4) addError(details, 'year', 'is_length');
}

/** PublishDashboardWorkingCalendarDto and WorkingCalendarWindowDto (raw values, no implicit conversion). */
function validateBody(body: PublishWorkingCalendarRequest, details: Details): void {
  const raw = body as unknown as Record<string, unknown>;
  const revision = raw['expectedRevision'];
  if (!Number.isInteger(revision)) addError(details, 'expectedRevision', 'is_int');
  if (typeof revision !== 'number' || !(revision >= 0)) addError(details, 'expectedRevision', 'min');
  if (typeof revision !== 'number' || !(revision <= MAX_REVISION - 1)) addError(details, 'expectedRevision', 'max');

  const workingDays = raw['workingDays'];
  if (typeof workingDays !== 'string' || !/^[01]{365,366}$/u.test(workingDays)) {
    addError(details, 'workingDays', 'matches');
  }
  for (const key of ['workdayStartMinute', 'workdayEndMinute']) {
    if (present(raw[key]) && !Number.isInteger(raw[key])) addError(details, key, 'is_int');
  }
  const timeZone = raw['timeZone'];
  if (present(timeZone)) {
    if (typeof timeZone !== 'string') addError(details, 'timeZone', 'is_string');
    if (typeof timeZone !== 'string' || timeZone.length > 64) addError(details, 'timeZone', 'max_length');
  }

  const windows = raw['windows'];
  if (!present(windows)) return;
  if (!Array.isArray(windows)) {
    addError(details, 'windows', 'is_array');
    return;
  }
  if (windows.length > MAX_CALENDAR_WINDOWS) addError(details, 'windows', 'array_max_size');
  windows.forEach((item: unknown, index: number) => {
    const win = (item ?? {}) as Record<string, unknown>;
    const path = `windows.${index}`;
    for (const key of ['layer', 'weekdayMask', 'startMinute', 'endMinute']) {
      if (!Number.isInteger(win[key])) addError(details, `${path}.${key}`, 'is_int');
    }
    for (const key of ['validFrom', 'validTo']) {
      if (typeof win[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(win[key] as string)) {
        addError(details, `${path}.${key}`, 'matches');
      }
    }
    const label = win['label'];
    if (present(label)) {
      if (typeof label !== 'string') addError(details, `${path}.label`, 'is_string');
      if (typeof label !== 'string' || label.length > MAX_WINDOW_LABEL_LENGTH) {
        addError(details, `${path}.label`, 'max_length');
      }
    }
  });
}

function calendarInvalid(): never {
  throw new ApiError(422, 'CRM_WORKING_CALENDAR_INVALID');
}

function hoursInvalid(): never {
  throw new ApiError(422, 'CRM_CALENDAR_HOURS_INVALID');
}

function zoneInvalid(): never {
  throw new ApiError(422, 'CRM_CALENDAR_TIME_ZONE_INVALID');
}

function assertCalendarYear(year: number): void {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) calendarInvalid();
}

function validMinutes(start: number, end: number): boolean {
  return Number.isInteger(start) && Number.isInteger(end) && start >= 0 && start <= 1439 && end >= 1 && end <= 1440 && start < end;
}

type Hours = { start: number; end: number; zone: string } | null;

/** hoursOf: all three or none; minute ranges; a region zone (no trimming). */
function hoursOf(body: PublishWorkingCalendarRequest): Hours {
  const given = [body.workdayStartMinute, body.workdayEndMinute, body.timeZone].filter(present).length;
  if (given === 0) return null;
  if (given !== 3) hoursInvalid();
  if (!validMinutes(body.workdayStartMinute!, body.workdayEndMinute!)) hoursInvalid();
  if (!isValidIanaTimeZone(body.timeZone)) zoneInvalid();
  return { start: body.workdayStartMinute!, end: body.workdayEndMinute!, zone: body.timeZone! };
}

function isoDate(value: string, year: number): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) calendarInvalid();
  if (parsed.getUTCFullYear() !== year) calendarInvalid();
  return value;
}

/** validWindows: each window in order, then the overlap check across all of them. */
function validWindows(windows: readonly CalendarWindowInput[] | undefined, year: number, hours: Hours): CalendarWindow[] {
  if (!windows?.length) return [];
  if (!hours) hoursInvalid();
  if (windows.length > MAX_CALENDAR_WINDOWS) calendarInvalid();
  const checked: CalendarWindow[] = windows.map((win, index) => {
    const label = win.label === undefined || win.label === null ? null : win.label.trim();
    if (!Number.isInteger(win.layer) || win.layer < 1 || win.layer > MAX_WINDOW_LAYER) calendarInvalid();
    if (!Number.isInteger(win.weekdayMask) || win.weekdayMask < 1 || win.weekdayMask > 127) calendarInvalid();
    if (!validMinutes(win.startMinute, win.endMinute)) hoursInvalid();
    if (label === '') calendarInvalid();
    const validFrom = isoDate(win.validFrom, year);
    const validTo = isoDate(win.validTo, year);
    if (validFrom > validTo) calendarInvalid();
    return {
      windowNo: index + 1,
      layer: win.layer,
      validFrom,
      validTo,
      weekdayMask: win.weekdayMask,
      startMinute: win.startMinute,
      endMinute: win.endMinute,
      label,
    };
  });
  checked.forEach((a, i) =>
    checked.slice(i + 1).forEach((b) => {
      if (windowsOverlap(a, b)) throw new ApiError(422, 'CRM_CALENDAR_WINDOW_OVERLAP');
    }),
  );
  return checked;
}

/** assertBranchGrant: an active branch and any of the keys in it, else 403 BRANCH_PERMISSION_DENIED. */
function assertBranchGrant(branchId: string, keys: readonly string[]): void {
  if (!BRANCH_IDS.has(branchId) || !keys.some((key) => can(key))) {
    throw new ApiError(403, 'BRANCH_PERMISSION_DENIED');
  }
}

function emptyView(branchId: string, calendarYear: number): WorkingCalendar {
  return {
    branchId,
    calendarYear,
    revision: 0,
    workingDays: null,
    publishedAt: null,
    workdayStartMinute: null,
    workdayEndMinute: null,
    timeZone: null,
    windows: [],
  };
}

export async function fakeGetCalendar(branchId: string, year: number): Promise<WorkingCalendar> {
  await fakeDelay();
  const details: Details = {};
  validateParams(branchId, year, details);
  throwIfInvalid(details);
  assertCalendarYear(year);
  const id = branchId.toLowerCase();
  assertBranchGrant(id, READ_KEYS);
  const existing = calendars.get(storeKey(id, year));
  return existing ? structuredClone(existing) : emptyView(id, year);
}

export async function fakePublishCalendar(
  branchId: string,
  year: number,
  body: PublishWorkingCalendarRequest,
): Promise<WorkingCalendar> {
  await fakeDelay();
  const details: Details = {};
  validateParams(branchId, year, details);
  validateBody(body, details);
  throwIfInvalid(details);

  assertCalendarYear(year);
  const id = branchId.toLowerCase();
  if (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 0 || body.expectedRevision >= MAX_REVISION) {
    calendarInvalid();
  }
  if (/[^01]/u.test(body.workingDays) || body.workingDays.length !== daysInYear(year)) calendarInvalid();
  const given = hoursOf(body);
  const checkedWindows = validWindows(body.windows, year, given);

  assertBranchGrant(id, PUBLISH_KEYS);
  const key = storeKey(id, year);
  const head = calendars.get(key);
  let hours = given;
  let windows = checkedWindows;
  if (!hours) {
    // A day-only publish keeps the head's hours and zone, and its windows when none are sent.
    if (head?.timeZone && head.workdayStartMinute !== null && head.workdayEndMinute !== null) {
      hours = { start: head.workdayStartMinute, end: head.workdayEndMinute, zone: head.timeZone };
      if (body.windows === undefined) windows = structuredClone(head.windows);
    }
  } else {
    // The zone is constant for every calendar of the branch, in any year.
    for (const calendar of calendars.values()) {
      if (calendar.branchId === id && calendar.timeZone !== null && calendar.timeZone !== hours.zone) zoneInvalid();
    }
  }

  const currentRevision = head?.revision ?? 0;
  if (body.expectedRevision !== currentRevision) {
    throw new ApiError(409, 'CRM_WORKING_CALENDAR_REVISION_CONFLICT');
  }

  const saved: WorkingCalendar = {
    branchId: id,
    calendarYear: year,
    revision: currentRevision + 1,
    workingDays: body.workingDays,
    publishedAt: FAKE_NOW,
    workdayStartMinute: hours?.start ?? null,
    workdayEndMinute: hours?.end ?? null,
    timeZone: hours?.zone ?? null,
    windows,
  };
  calendars.set(key, saved);
  return structuredClone(saved);
}
