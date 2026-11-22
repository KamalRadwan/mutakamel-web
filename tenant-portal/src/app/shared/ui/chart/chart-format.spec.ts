import { describe, expect, it } from 'vitest';
import { DASH, formatDuration, formatMoney, formatNumber, formatShortDate, formatValue, localIsoDate } from './chart-format';

describe('localIsoDate', () => {
  it('returns the local calendar date for a local-midnight tick', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 0, 0, 0).getTime())).toBe('2026-01-05');
  });

  it('keeps the local day for a late-evening local time', () => {
    expect(localIsoDate(new Date(2026, 11, 31, 23, 59, 59).getTime())).toBe('2026-12-31');
  });

  it('zero-pads single-digit months and days', () => {
    expect(localIsoDate(new Date(2026, 2, 9, 12).getTime())).toBe('2026-03-09');
  });
});

describe('formatValue', () => {
  it('returns a dash for null', () => {
    expect(formatValue(null, 'COUNT')).toBe(DASH);
  });

  it('returns a dash for a non-finite number', () => {
    expect(formatValue(Number.NaN, 'MONEY', 'EGP')).toBe(DASH);
  });

  it('formats an integer count with no decimals and grouping', () => {
    expect(formatValue(12345, 'COUNT')).toBe('12,345');
  });

  it('formats a fractional count with one decimal', () => {
    expect(formatValue(2.54, 'COUNT')).toBe('2.5');
  });

  it('formats money by the shared 2-decimal money rule with the currency code', () => {
    expect(formatValue(1234.5, 'MONEY', 'EGP')).toBe('EGP 1,234.50');
  });

  it('keeps the 2-decimal money rule for every currency', () => {
    expect(formatMoney(1, 'clf')).toBe('CLF 1');
  });

  it('formats money without a currency as a plain number by the money rule', () => {
    expect(formatValue(5, 'MONEY')).toBe('5');
  });

  it('formats percent with one decimal and a percent sign', () => {
    expect(formatValue(45.678, 'PERCENT')).toBe('45.7%');
  });

  it('formats ratio with two decimals', () => {
    expect(formatValue(1.256, 'RATIO')).toBe('1.26');
  });

  it('formats duration minutes into hours and minutes', () => {
    expect(formatValue(135, 'DURATION')).toBe('2 h 15 m');
  });
});

describe('formatNumber', () => {
  it('normalizes negative zero to zero', () => {
    expect(formatNumber(-0.0001, 'en', 2)).toBe('0.00');
  });
});

describe('formatDuration', () => {
  it('formats whole days without an hours part', () => {
    expect(formatDuration(1440)).toBe('1 d');
  });

  it('uses Arabic unit fallbacks', () => {
    expect(formatDuration(30, 'ar')).toBe('30 د');
  });
});

describe('formatShortDate', () => {
  it('formats a day in English as month then day', () => {
    expect(formatShortDate('2026-03-09', 'en', 'DAY')).toBe('Mar 9');
  });

  it('formats a month-year grain with the year', () => {
    expect(formatShortDate('2026-03', 'en', 'MONTH_YEAR')).toBe('Mar 2026');
  });

  it('formats a month grain with the month only', () => {
    expect(formatShortDate('2026-03', 'en', 'MONTH')).toBe('Mar');
  });

  it('formats a day in Arabic as day then full month', () => {
    expect(formatShortDate('2026-03-09', 'ar', 'DAY')).toBe('9 مارس');
  });

  it('returns the raw string when it cannot be parsed', () => {
    expect(formatShortDate('not-a-date')).toBe('not-a-date');
  });
});
