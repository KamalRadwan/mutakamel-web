import {
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';

export type DateRangePreset =
  | 'MAXIMUM'
  | 'TODAY'
  | 'YESTERDAY'
  | 'TODAY_YESTERDAY'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_YEAR'
  | 'LAST_YEAR'
  | 'Q1'
  | 'Q2'
  | 'Q3'
  | 'Q4';

export interface DateRangeValue {
  from: string;
  to: string;
  preset: DateRangePreset | null;
}

export const DATE_RANGE_PRESETS: readonly DateRangePreset[] = [
  'MAXIMUM',
  'TODAY',
  'YESTERDAY',
  'TODAY_YESTERDAY',
  'THIS_MONTH',
  'LAST_MONTH',
  'THIS_YEAR',
  'LAST_YEAR',
  'Q1',
  'Q2',
  'Q3',
  'Q4',
];

export const DEFAULT_FROM_TIME = '00:00';
export const DEFAULT_TO_TIME = '23:59';
export const MAXIMUM_START_DATE = new Date(2020, 0, 1);

export function parseLocalDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
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

export function parseLocalDateTime(
  value: string | null | undefined,
  fallbackTime: string,
): { date: Date; time: string } | null {
  const date = parseLocalDate(value);
  if (!date || !value) return null;
  const timeMatch = /T(\d{2}):(\d{2})/.exec(value.trim());
  if (!timeMatch) return { date, time: fallbackTime };
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return { date, time: fallbackTime };
  }
  return { date, time: `${timeMatch[1]}:${timeMatch[2]}` };
}

export function formatLocalDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Localized display date, the same format ui-date-field shows (en "Nov 21, 2026", ar "21 نوفمبر 2026"). */
export function formatDisplayDate(date: Date, lang: 'ar' | 'en'): string {
  return new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatLocalDateTime(date: Date, time: string): string {
  return `${formatLocalDate(date)}T${time}`;
}

export function countRangeDays(from: Date, to: Date): number {
  return Math.abs(differenceInCalendarDays(to, from)) + 1;
}

export function presetRange(preset: DateRangePreset, today: Date): DateRangeValue {
  const anchor = startOfDay(today);
  const year = anchor.getFullYear();
  let fromDate: Date;
  let toDate: Date;

  switch (preset) {
    case 'MAXIMUM':
      fromDate = startOfDay(MAXIMUM_START_DATE);
      toDate = anchor;
      break;
    case 'TODAY':
      fromDate = anchor;
      toDate = anchor;
      break;
    case 'YESTERDAY': {
      const yesterday = subDays(anchor, 1);
      fromDate = yesterday;
      toDate = yesterday;
      break;
    }
    case 'TODAY_YESTERDAY':
      fromDate = subDays(anchor, 1);
      toDate = anchor;
      break;
    case 'THIS_MONTH':
      fromDate = startOfMonth(anchor);
      toDate = anchor;
      break;
    case 'LAST_MONTH': {
      const prevMonth = subMonths(anchor, 1);
      fromDate = startOfMonth(prevMonth);
      toDate = endOfMonth(prevMonth);
      break;
    }
    case 'THIS_YEAR':
      fromDate = startOfYear(anchor);
      toDate = anchor;
      break;
    case 'LAST_YEAR': {
      const prevYear = subYears(anchor, 1);
      fromDate = startOfYear(prevYear);
      toDate = endOfYear(prevYear);
      break;
    }
    case 'Q1': {
      const q = new Date(year, 0, 1);
      fromDate = startOfQuarter(q);
      toDate = endOfQuarter(q);
      break;
    }
    case 'Q2': {
      const q = new Date(year, 3, 1);
      fromDate = startOfQuarter(q);
      toDate = endOfQuarter(q);
      break;
    }
    case 'Q3': {
      const q = new Date(year, 6, 1);
      fromDate = startOfQuarter(q);
      toDate = endOfQuarter(q);
      break;
    }
    case 'Q4': {
      const q = new Date(year, 9, 1);
      fromDate = startOfQuarter(q);
      toDate = endOfQuarter(q);
      break;
    }
  }

  return {
    from: formatLocalDateTime(fromDate, DEFAULT_FROM_TIME),
    to: formatLocalDateTime(toDate, DEFAULT_TO_TIME),
    preset,
  };
}
