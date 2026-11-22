import { describe, expect, it } from 'vitest';
import { formatMoneyDisplay } from './money-format';

describe('formatMoneyDisplay', () => {
  it('formats brief reference examples (plain integer when rounded fraction is zero, else 2 decimals)', () => {
    expect(formatMoneyDisplay('250000.00000000', 'en')).toBe('250,000');
    expect(formatMoneyDisplay('12.345', 'en')).toBe('12.35');
    expect(formatMoneyDisplay('0.004', 'en')).toBe('0');
  });

  it('handles rounding boundaries and trailing decimal formatting', () => {
    expect(formatMoneyDisplay('0.005', 'en')).toBe('0.01');
    expect(formatMoneyDisplay('12.30000000', 'en')).toBe('12.30');
    expect(formatMoneyDisplay('1.995', 'en')).toBe('2');
    expect(formatMoneyDisplay('1.994', 'en')).toBe('1.99');
    expect(formatMoneyDisplay('0', 'en')).toBe('0');
    expect(formatMoneyDisplay('.5', 'en')).toBe('0.50');
    expect(formatMoneyDisplay('00042.500', 'en')).toBe('42.50');
  });

  it('handles negative values without producing -0', () => {
    expect(formatMoneyDisplay('-250000.00000000', 'en')).toBe('-250,000');
    expect(formatMoneyDisplay('-12.345', 'en')).toBe('-12.35');
    expect(formatMoneyDisplay('-0.004', 'en')).toBe('0');
    expect(formatMoneyDisplay('-0.005', 'en')).toBe('-0.01');
    expect(formatMoneyDisplay('-1.999', 'en')).toBe('-2');
  });

  it('preserves full precision for 16-digit integers beyond Number.MAX_SAFE_INTEGER', () => {
    expect(formatMoneyDisplay('9999999999999999', 'en')).toBe('9,999,999,999,999,999');
    expect(formatMoneyDisplay('9999999999999999.00000000', 'en')).toBe('9,999,999,999,999,999');
    expect(formatMoneyDisplay('9999999999999999.99499999', 'en')).toBe('9,999,999,999,999,999.99');
    expect(formatMoneyDisplay('9999999999999999.99500000', 'en')).toBe('10,000,000,000,000,000');
    expect(formatMoneyDisplay('-9007199254740999.125', 'en')).toBe('-9,007,199,254,740,999.13');
    expect(formatMoneyDisplay('1234567890123456.78499999', 'en')).toBe('1,234,567,890,123,456.78');
  });

  it('uses locale grouping with Western digits', () => {
    expect(formatMoneyDisplay('250000.00000000', 'ar')).toBe('250,000');
    expect(formatMoneyDisplay('12.345', 'ar')).toBe('12.35');
    expect(formatMoneyDisplay('12345.678', 'de-DE')).toBe('12.345,68');
  });

  it('returns empty string for empty or invalid inputs', () => {
    expect(formatMoneyDisplay(null, 'en')).toBe('');
    expect(formatMoneyDisplay(undefined, 'en')).toBe('');
    expect(formatMoneyDisplay('   ', 'en')).toBe('');
    expect(formatMoneyDisplay('abc', 'en')).toBe('');
  });
});

describe('formatMoneyDisplay normalisation', () => {
  it('accepts Arabic-Indic digits, Arabic separators and grouped input', () => {
    expect(formatMoneyDisplay('١٢٬٥٠٠٫٥', 'ar')).toBe('12,500.50');
    expect(formatMoneyDisplay('1,250,000.004', 'en')).toBe('1,250,000');
    expect(formatMoneyDisplay('-٠٫٠٠٥', 'ar')).toBe('-0.01');
  });

  it('falls back to English separators for an empty or invalid locale', () => {
    expect(formatMoneyDisplay('1234.5', '')).toBe('1,234.50');
    expect(formatMoneyDisplay('1234.5', 'not a locale!')).toBe('1,234.50');
  });
});
