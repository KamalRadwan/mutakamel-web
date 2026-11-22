import { formatMoneyNumber } from '../money/money-format';
import type { ChartContext, SeriesUnit } from './chart.model';

export const DASH = '—';

const MONTHS_SHORT_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const MONTHS_FULL_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
] as const;

const DURATION_UNITS = {
  en: { d: 'd', h: 'h', m: 'm' },
  ar: { d: 'ي', h: 'س', m: 'د' },
} as const;

const NUMBER_FORMATTERS = new Map<number, Intl.NumberFormat>();

interface ParsedDateParts {
  year: number;
  monthIndex: number;
  day: number;
  hour: number;
  minute: number;
}

function getNumberFormatter(decimals: number): Intl.NumberFormat {
  const safeDecimals = Math.max(0, Math.min(20, Math.trunc(decimals)));
  let fmt = NUMBER_FORMATTERS.get(safeDecimals);
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: safeDecimals,
      maximumFractionDigits: safeDecimals,
    });
    NUMBER_FORMATTERS.set(safeDecimals, fmt);
  }
  return fmt;
}

function resolveWord(
  t: ChartContext['t'] | undefined,
  key: string,
  fallback: string,
  params?: Record<string, unknown>,
): string {
  if (!t) return fallback;
  const translated = t(key, params);
  if (!translated || translated === key || translated === `chart.${key}`) return fallback;
  return translated;
}

function parseDateParts(input: string | number | Date | null | undefined): ParsedDateParts | null {
  if (input == null || input === '') return null;

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return {
      year: input.getUTCFullYear(),
      monthIndex: input.getUTCMonth(),
      day: input.getUTCDate(),
      hour: input.getUTCHours(),
      minute: input.getUTCMinutes(),
    };
  }

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return null;
    return {
      year: d.getUTCFullYear(),
      monthIndex: d.getUTCMonth(),
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
    };
  }

  const trimmed = input.trim();
  if (!trimmed) return null;

  const yearMonthMatch = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1]);
    const month = Number(yearMonthMatch[2]);
    if (month < 1 || month > 12) return null;
    return { year, monthIndex: month - 1, day: 1, hour: 0, minute: 0 };
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year, monthIndex: month - 1, day, hour: 0, minute: 0 };
  }

  const localOrOffsetMatch =
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:[+-]\d{2}:?\d{2})?$/.exec(
      trimmed,
    );
  if (localOrOffsetMatch) {
    const year = Number(localOrOffsetMatch[1]);
    const month = Number(localOrOffsetMatch[2]);
    const day = Number(localOrOffsetMatch[3]);
    const hour = Number(localOrOffsetMatch[4]);
    const minute = Number(localOrOffsetMatch[5]);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
    return { year, monthIndex: month - 1, day, hour, minute };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getUTCFullYear(),
    monthIndex: parsed.getUTCMonth(),
    day: parsed.getUTCDate(),
    hour: parsed.getUTCHours(),
    minute: parsed.getUTCMinutes(),
  };
}

function monthLabel(
  monthIndex: number,
  lang: 'ar' | 'en',
  style: 'short' | 'full',
  t?: ChartContext['t'],
): string {
  const fallback =
    lang === 'ar'
      ? MONTHS_FULL_AR[monthIndex] ?? ''
      : MONTHS_SHORT_EN[monthIndex] ?? '';
  const key = style === 'short' ? `monthsShort.${monthIndex}` : `months.${monthIndex}`;
  return resolveWord(t, key, fallback);
}

export function formatNumber(
  v: number | null | undefined,
  _lang: 'ar' | 'en' = 'en',
  decimals = 0,
): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  const factor = 10 ** Math.max(0, Math.trunc(decimals));
  const rounded = Math.round(v * factor) / factor;
  const normalized = Object.is(rounded, -0) || rounded === 0 ? 0 : rounded;
  return getNumberFormatter(decimals).format(normalized);
}

function numberToPlainDecimal(v: number): string {
  const raw = String(v);
  const match = /^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(raw);
  if (!match) return raw;
  const sign = match[1] === '-' ? '-' : '';
  const digits = match[2] + (match[3] ?? '');
  const exp = Number(match[4]) - (match[3]?.length ?? 0);
  if (exp >= 0) return `${sign}${digits}${'0'.repeat(exp)}`;
  const pos = digits.length + exp;
  if (pos > 0) return `${sign}${digits.slice(0, pos)}.${digits.slice(pos)}`;
  return `${sign}0.${'0'.repeat(-pos)}${digits}`;
}

export function formatMoney(v: number | null | undefined, currency: string): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  const code = (currency || '').trim().toUpperCase();
  const formatted = formatMoneyNumber(numberToPlainDecimal(v));
  if (formatted === null) return DASH;
  return code ? `${code} ${formatted}` : formatted;
}

export function formatPercent(v: number | null | undefined, decimals = 1): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return `${formatNumber(v, 'en', decimals)}%`;
}

export function formatAxisNumber(v: number): string {
  if (!Number.isFinite(v)) return DASH;
  const rounded = Math.round(v);
  return formatNumber(rounded === 0 ? 0 : rounded, 'en', 0);
}

export function formatDuration(
  minutes: number | null | undefined,
  lang: 'ar' | 'en' = 'en',
  t?: ChartContext['t'],
): string {
  if (minutes == null || !Number.isFinite(minutes)) return DASH;
  const total = Math.max(0, Math.round(minutes));
  const units = DURATION_UNITS[lang];
  const dUnit = resolveWord(t, 'duration.d', units.d);
  const hUnit = resolveWord(t, 'duration.h', units.h);
  const mUnit = resolveWord(t, 'duration.m', units.m);

  if (total >= 1440) {
    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    return hours > 0
      ? `${formatNumber(days, lang)} ${dUnit} ${formatNumber(hours, lang)} ${hUnit}`
      : `${formatNumber(days, lang)} ${dUnit}`;
  }

  if (total >= 60) {
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return mins > 0
      ? `${formatNumber(hours, lang)} ${hUnit} ${formatNumber(mins, lang)} ${mUnit}`
      : `${formatNumber(hours, lang)} ${hUnit}`;
  }

  return `${formatNumber(total, lang)} ${mUnit}`;
}

export function formatValue(
  v: number | null | undefined,
  unit: SeriesUnit = 'COUNT',
  currency?: string,
  lang: 'ar' | 'en' = 'en',
  t?: ChartContext['t'],
): string {
  if (v == null || !Number.isFinite(v)) return DASH;

  switch (unit) {
    case 'MONEY':
      return formatMoney(v, currency ?? '');
    case 'PERCENT':
      return formatPercent(v, 1);
    case 'DURATION':
      return formatDuration(v, lang, t);
    case 'RATIO':
      return formatNumber(v, lang, 2);
    case 'SCORE':
    case 'COUNT':
    default:
      return formatNumber(v, lang, Number.isInteger(v) ? 0 : 1);
  }
}

export function formatDate(
  iso: string | number | Date | null | undefined,
  lang: 'ar' | 'en' = 'en',
  t?: ChartContext['t'],
): string {
  const parts = parseDateParts(iso);
  if (!parts) return typeof iso === 'string' && iso.trim() ? iso : DASH;

  if (lang === 'ar') {
    const month = monthLabel(parts.monthIndex, 'ar', 'full', t);
    return `${parts.day} ${month} ${parts.year}`;
  }

  const month = monthLabel(parts.monthIndex, 'en', 'short', t);
  return `${month} ${parts.day}, ${parts.year}`;
}

/** Local-calendar YYYY-MM-DD for an axis tick (ticks fall at local midnight; never use toISOString). */
export function localIsoDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatShortDate(
  iso: string | number | Date | null | undefined,
  lang: 'ar' | 'en' = 'en',
  grain: 'DAY' | 'MONTH' | 'MONTH_YEAR' = 'DAY',
  t?: ChartContext['t'],
): string {
  const parts = parseDateParts(iso);
  if (!parts) return typeof iso === 'string' && iso.trim() ? iso : DASH;

  const month = monthLabel(parts.monthIndex, lang, lang === 'ar' ? 'full' : 'short', t);
  switch (grain) {
    case 'MONTH':
      return month;
    case 'MONTH_YEAR':
      return `${month} ${parts.year}`;
    case 'DAY':
    default:
      return lang === 'ar' ? `${parts.day} ${month}` : `${month} ${parts.day}`;
  }
}

export function formatDateTime(
  iso: string | number | Date | null | undefined,
  lang: 'ar' | 'en' = 'en',
  t?: ChartContext['t'],
): string {
  const parts = parseDateParts(iso);
  if (!parts) return typeof iso === 'string' && iso.trim() ? iso : DASH;

  const hh = String(parts.hour).padStart(2, '0');
  const mm = String(parts.minute).padStart(2, '0');
  return `${formatDate(iso, lang, t)} ${hh}:${mm}`;
}

export function formatRateN(
  n: number,
  total: number,
  lang: 'ar' | 'en' = 'en',
  t?: ChartContext['t'],
): string {
  const nText = formatNumber(n, lang);
  const totalText = formatNumber(total, lang);
  const fallback = lang === 'ar' ? `${nText} من ${totalText}` : `${nText} of ${totalText}`;
  const translated = resolveWord(t, 'ofTotal', fallback, { n: nText, total: totalText });
  return translated.includes('{{') ? fallback : translated;
}
