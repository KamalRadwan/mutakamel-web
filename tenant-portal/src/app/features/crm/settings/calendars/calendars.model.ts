export interface CalendarWindow {
  windowNo: number;
  layer: number;
  validFrom: string;
  validTo: string;
  weekdayMask: number; // 1..127, bit 0 = Sunday
  startMinute: number;
  endMinute: number;
  /** Trimmed text; the response sends null when there is none (WorkingCalendarWindowView.label). */
  label?: string | null;
}

export type CalendarWindowInput = Omit<CalendarWindow, 'windowNo'>;

/**
 * WorkingCalendarView (working-calendar.service.ts:32). Before the first publish the revision is 0 and
 * workingDays, the hours and the zone are null; a day-only revision can also carry null hours and zone.
 */
export interface WorkingCalendar {
  branchId: string;
  calendarYear: number;
  revision: number; // 0 when none
  workingDays: string | null; // '0'/'1' per day of the year, 365/366
  publishedAt: string | null;
  workdayStartMinute: number | null;
  workdayEndMinute: number | null;
  timeZone: string | null;
  windows: CalendarWindow[];
}

/**
 * PublishDashboardWorkingCalendarDto. The hours and zone go together or not at all; when all three are
 * omitted the head revision's hours and zone carry over, and its windows too when windows is omitted.
 */
export interface PublishWorkingCalendarRequest {
  expectedRevision: number;
  workingDays: string;
  workdayStartMinute?: number;
  workdayEndMinute?: number;
  timeZone?: string;
  windows?: CalendarWindowInput[];
}

export const CALENDAR_YEARS: readonly number[] = [2025, 2026, 2027];
export const WEEKDAY_INDICES: readonly number[] = [0, 1, 2, 3, 4, 5, 6]; // Sunday first

export const DEFAULT_WEEKDAY_MASK = 31; // Sun..Thu (bits 0..4)
export const DEFAULT_WORKDAY_START_MINUTE = 9 * 60; // 09:00
export const DEFAULT_WORKDAY_END_MINUTE = 17 * 60; // 17:00
export const DEFAULT_TIME_ZONE = 'Africa/Cairo';
/** WorkingCalendarWindowDto label @MaxLength(80). */
export const MAX_WINDOW_LABEL_LENGTH = 80;
/** WORKING_CALENDAR_MAX_LAYER: a window layer is 1 through 9. */
export const MAX_WINDOW_LAYER = 9;
/** WORKING_CALENDAR_MAX_WINDOWS: @ArrayMaxSize(64) on windows. */
export const MAX_CALENDAR_WINDOWS = 64;
/** DashboardWorkingCalendarParamsDto year pattern: 2000 through 2100. */
export const CALENDAR_YEAR_PATTERN = /^(?:20\d{2}|2100)$/u;
/** WORKING_CALENDAR_ZONE_PATTERN: an IANA region zone; UTC and Etc/ zones are rejected. */
export const CALENDAR_ZONE_PATTERN = /^[A-Z][A-Za-z_]+(\/[A-Za-z0-9_+-]+){1,2}$/u;

export const CALENDAR_TIME_ZONES: readonly string[] = [
  'Africa/Cairo',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Asia/Qatar',
  'Asia/Bahrain',
  'Asia/Amman',
  'Asia/Beirut',
  'Africa/Casablanca',
  'Europe/London',
];

const MS_PER_DAY = 86_400_000;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function dayOfYearIndex(year: number, monthIndex: number, day: number): number {
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, monthIndex, day);
  return Math.round((current - start) / MS_PER_DAY);
}

export function weekdayOf(year: number, monthIndex: number, day: number): number {
  return new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
}

export function isMaskDayActive(mask: number, weekday: number): boolean {
  return (mask & (1 << weekday)) !== 0;
}

export function toggleMaskDay(mask: number, weekday: number, active: boolean): number {
  const bit = 1 << weekday;
  return active ? mask | bit : mask & ~bit;
}

export function buildWorkingDaysForYear(year: number, weekdayMask: number): string {
  const total = daysInYear(year);
  const chars: string[] = new Array(total);
  const startMs = Date.UTC(year, 0, 1);
  for (let i = 0; i < total; i++) {
    const weekday = new Date(startMs + i * MS_PER_DAY).getUTCDay();
    chars[i] = isMaskDayActive(weekdayMask, weekday) ? '1' : '0';
  }
  return chars.join('');
}

export function inferWeekdayMask(year: number, workingDays: string): number {
  const counts = Array.from({ length: 7 }, () => ({ on: 0, total: 0 }));
  const startMs = Date.UTC(year, 0, 1);
  for (let i = 0; i < workingDays.length; i++) {
    const weekday = new Date(startMs + i * MS_PER_DAY).getUTCDay();
    counts[weekday].total++;
    if (workingDays[i] === '1') {
      counts[weekday].on++;
    }
  }
  let mask = 0;
  for (let day = 0; day < 7; day++) {
    if (counts[day].total > 0 && counts[day].on * 2 >= counts[day].total) {
      mask |= 1 << day;
    }
  }
  return mask;
}

export function countWorkingDays(workingDays: string): number {
  let count = 0;
  for (let i = 0; i < workingDays.length; i++) {
    if (workingDays[i] === '1') count++;
  }
  return count;
}

export function minutesToTime(minutes: number): string {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.trunc(minutes)));
  const hh = String(Math.floor(safe / 60)).padStart(2, '0');
  const mm = String(safe % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function timeToMinutes(time: string | null | undefined): number {
  if (!time) return NaN;
  const match = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!match) return NaN;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return NaN;
  return hh * 60 + mm;
}

/** assertRegionZone (working-calendar.service.ts:68): the zone pattern, no Etc/, and a zone Intl knows. No trimming. */
export function isValidIanaTimeZone(timeZone: string | null | undefined): boolean {
  if (typeof timeZone !== 'string') return false;
  if (!CALENDAR_ZONE_PATTERN.test(timeZone) || timeZone.startsWith('Etc/')) return false;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone.length > 0;
  } catch {
    return false;
  }
}

/**
 * validWindows overlap rule (working-calendar.service.ts:108): same layer, date ranges meet, the weekday masks
 * share a bit and the minutes meet. The backend does not check that a shared weekday falls inside the shared dates.
 */
export function windowsOverlap(a: CalendarWindowInput, b: CalendarWindowInput): boolean {
  return (
    a.layer === b.layer &&
    a.validFrom <= b.validTo &&
    b.validFrom <= a.validTo &&
    (a.weekdayMask & b.weekdayMask) !== 0 &&
    a.startMinute < b.endMinute &&
    b.startMinute < a.endMinute
  );
}

export function windowsOverlapInLayer(
  windows: readonly CalendarWindowInput[],
  candidate: CalendarWindowInput,
  ignoreIndex = -1,
): boolean {
  for (let i = 0; i < windows.length; i++) {
    if (i === ignoreIndex) continue;
    if (windowsOverlap(windows[i], candidate)) {
      return true;
    }
  }
  return false;
}
