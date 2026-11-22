import { describe, expect, it } from 'vitest';
import { formatDisplayDate, presetRange } from './date-range-presets';

describe('date-range display date', () => {
  const date = new Date(2026, 10, 21);

  it('shows the English localized date', () => {
    expect(formatDisplayDate(date, 'en')).toBe('Nov 21, 2026');
  });

  it('shows the Arabic localized date with Latin digits', () => {
    expect(formatDisplayDate(date, 'ar')).toBe('21 نوفمبر 2026');
  });

  it('never shows the old dd/MM/yyyy form', () => {
    expect(formatDisplayDate(date, 'en')).not.toContain('21/11/2026');
    expect(formatDisplayDate(date, 'ar')).not.toContain('21/11/2026');
  });

  it('keeps emitted values in ISO local date-time form', () => {
    expect(presetRange('TODAY', date)).toEqual({ from: '2026-11-21T00:00', to: '2026-11-21T23:59', preset: 'TODAY' });
  });
});
