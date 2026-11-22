import { Language } from '../../../../core/i18n/language';
import { ApiError } from '../billing.api';
import { formatBillingDate } from '../overview/overview-dates';

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function cachedFormatter(key: string, locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const cacheKey = `${locale}|${key}`;
  let formatter = formatterCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatterCache.set(cacheKey, formatter);
  }
  return formatter;
}

export function formatInvoiceDate(iso: string | null, language: Language): string {
  return formatBillingDate(iso, language);
}

export function formatInvoicePeriod(
  start: string | null,
  end: string | null,
  language: Language,
): string {
  if (!start && !end) return '—';
  if (!start || !end) return formatInvoiceDate(start ?? end, language);

  const startDate = new Date(start);
  const endDate = new Date(end);
  const arrow = language === 'ar' ? '←' : '→';

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${formatInvoiceDate(start, language)} ${arrow} ${formatInvoiceDate(end, language)}`;
  }

  const locale = `${language}-u-nu-latn`;
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const startLabel = cachedFormatter(sameYear ? 'dm' : 'dmy', locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(startDate);
  const endLabel = cachedFormatter('dmy', locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(endDate);

  return `${startLabel} ${arrow} ${endLabel}`;
}

export function formatClockTime(iso: string | null, language: Language): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return cachedFormatter('clock', `${language}-u-nu-latn`, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function apiErrorCodeOf(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null;
}
