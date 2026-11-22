import type { Operator, RelativeDate, Value } from './query.model';

export const VALID_RELATIVE_DATES: readonly RelativeDate[] = [
  'today',
  'yesterday',
  'last7',
  'last30',
  'thisMonth',
  'lastMonth',
  'thisYear',
];

export interface DateRangeResult {
  gte?: string;
  lt?: string;
  isNull?: boolean;
}

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

interface DateTimeParts extends CalendarDate {
  hour: number;
  minute: number;
  second: number;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE_RE.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}

function parseCalendarDate(value: string): CalendarDate | null {
  const trimmed = value.trim();
  if (!isValidDateString(trimmed)) return null;
  const match = DATE_RE.exec(trimmed)!;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

export function formatCalendarDate(date: CalendarDate): string {
  return `${pad4(date.year)}-${pad2(date.month)}-${pad2(date.day)}`;
}

function zonedParts(instant: Date, timeZone: string): DateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const map: Record<string, number> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') {
      map[part.type] = Number(part.value);
    }
  }
  return {
    year: map['year'] ?? 1970,
    month: map['month'] ?? 1,
    day: map['day'] ?? 1,
    hour: (map['hour'] ?? 0) % 24,
    minute: map['minute'] ?? 0,
    second: map['second'] ?? 0,
  };
}

export function todayInTimeZone(now: Date, timeZone: string): CalendarDate {
  const parts = zonedParts(now, timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function calendarDateInTimeZone(iso: string, timeZone: string): string {
  const parts = zonedParts(new Date(iso), timeZone);
  return formatCalendarDate(parts);
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const parsed = parseCalendarDate(dateStr);
  if (!parsed) return dateStr;
  return formatCalendarDate(addDays(parsed, days));
}

function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${pad2(hours)}:${pad2(mins)}`;
}

function midnightIso(date: CalendarDate, timeZone: string): string {
  const utcGuess = Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0);
  const firstParts = zonedParts(new Date(utcGuess), timeZone);
  const firstLocalAsUtc = Date.UTC(
    firstParts.year,
    firstParts.month - 1,
    firstParts.day,
    firstParts.hour,
    firstParts.minute,
    firstParts.second,
  );
  const offset1 = firstLocalAsUtc - utcGuess;
  const targetUtc = utcGuess - offset1;

  const secondParts = zonedParts(new Date(targetUtc), timeZone);
  const secondLocalAsUtc = Date.UTC(
    secondParts.year,
    secondParts.month - 1,
    secondParts.day,
    secondParts.hour,
    secondParts.minute,
    secondParts.second,
  );
  const offset2 = secondLocalAsUtc - targetUtc;
  const offsetMinutes = Math.round(offset2 / 60000);

  return `${formatCalendarDate(date)}T00:00:00${formatOffset(offsetMinutes)}`;
}

export function resolveDate(
  op: Operator,
  value: Value | undefined,
  timeZone: string,
  now: Date = new Date(),
): DateRangeResult {
  if (op === 'isNull') return { isNull: true };
  if (op === 'isNotNull') return { isNull: false };

  if (op === 'on' && typeof value === 'string') {
    const day = parseCalendarDate(value);
    if (!day) return {};
    return { gte: midnightIso(day, timeZone), lt: midnightIso(addDays(day, 1), timeZone) };
  }

  if (op === 'before' && typeof value === 'string') {
    const day = parseCalendarDate(value);
    if (!day) return {};
    return { lt: midnightIso(day, timeZone) };
  }

  if (op === 'after' && typeof value === 'string') {
    const day = parseCalendarDate(value);
    if (!day) return {};
    return { gte: midnightIso(addDays(day, 1), timeZone) };
  }

  if (op === 'between' && Array.isArray(value) && value.length === 2) {
    const start = typeof value[0] === 'string' ? parseCalendarDate(value[0]) : null;
    const end = typeof value[1] === 'string' ? parseCalendarDate(value[1]) : null;
    if (!start || !end) return {};
    return { gte: midnightIso(start, timeZone), lt: midnightIso(addDays(end, 1), timeZone) };
  }

  if (op === 'relative' && typeof value === 'string') {
    const today = todayInTimeZone(now, timeZone);
    const tomorrow = addDays(today, 1);
    switch (value as RelativeDate) {
      case 'today':
        return { gte: midnightIso(today, timeZone), lt: midnightIso(tomorrow, timeZone) };
      case 'yesterday':
        return { gte: midnightIso(addDays(today, -1), timeZone), lt: midnightIso(today, timeZone) };
      case 'last7':
        return { gte: midnightIso(addDays(today, -6), timeZone), lt: midnightIso(tomorrow, timeZone) };
      case 'last30':
        return { gte: midnightIso(addDays(today, -29), timeZone), lt: midnightIso(tomorrow, timeZone) };
      case 'thisMonth':
        return {
          gte: midnightIso({ year: today.year, month: today.month, day: 1 }, timeZone),
          lt: midnightIso(tomorrow, timeZone),
        };
      case 'lastMonth': {
        const prevMonthStart: CalendarDate =
          today.month === 1
            ? { year: today.year - 1, month: 12, day: 1 }
            : { year: today.year, month: today.month - 1, day: 1 };
        const thisMonthStart: CalendarDate = { year: today.year, month: today.month, day: 1 };
        return {
          gte: midnightIso(prevMonthStart, timeZone),
          lt: midnightIso(thisMonthStart, timeZone),
        };
      }
      case 'thisYear':
        return {
          gte: midnightIso({ year: today.year, month: 1, day: 1 }, timeZone),
          lt: midnightIso(tomorrow, timeZone),
        };
      default:
        return {};
    }
  }

  return {};
}

export * from './query-edit';
