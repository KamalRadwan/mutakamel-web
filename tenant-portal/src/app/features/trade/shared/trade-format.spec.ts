import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney, formatQty, formatUnitPrice } from './trade-format';

describe('formatMoney', () => {
  it('renders two decimals when the fraction is non-zero', () => {
    expect(formatMoney('EGP', '1234.5')).toBe('EGP 1,234.50');
  });

  it('renders an integer when the fraction rounds to zero', () => {
    expect(formatMoney('EGP', '1850.00000000')).toBe('EGP 1,850');
  });

  it('omits the currency prefix when currency is null or blank', () => {
    expect(formatMoney(null, '10.5')).toBe('10.50');
    expect(formatMoney('  ', '10.5')).toBe('10.50');
  });

  it('keeps the minus sign for negative amounts', () => {
    expect(formatMoney('EGP', '-1234.567')).toBe('EGP -1,234.57');
  });

  it('rounds half away from zero for positive and negative amounts', () => {
    expect(formatMoney(null, '0.005')).toBe('0.01');
    expect(formatMoney(null, '-0.005')).toBe('-0.01');
  });

  it('formats a tiny negative value that rounds to zero as 0 without a sign', () => {
    expect(formatMoney(null, '-0.004')).toBe('0');
  });

  it('carries the rounding through a run of nines', () => {
    expect(formatMoney(null, '999.995')).toBe('1,000');
  });

  it('keeps 17+ digit integers exact', () => {
    expect(formatMoney(null, '12345678901234567890.126')).toBe('12,345,678,901,234,567,890.13');
    expect(formatMoney(null, '99999999999999999999.999')).toBe('100,000,000,000,000,000,000');
  });

  it('accepts a leading dot and a leading plus sign', () => {
    expect(formatMoney(null, '.5')).toBe('0.50');
    expect(formatMoney(null, '+7')).toBe('7');
  });

  it('returns a dash for null, blank and non-numeric input', () => {
    expect(formatMoney('EGP', null)).toBe('—');
    expect(formatMoney('EGP', '   ')).toBe('—');
    expect(formatMoney('EGP', 'abc')).toBe('—');
    expect(formatMoney('EGP', '1,000')).toBe('—');
  });
});

describe('formatUnitPrice', () => {
  it('keeps precision beyond two decimals and trims trailing zeros', () => {
    expect(formatUnitPrice('EGP', '12.34567000')).toBe('EGP 12.34567');
  });

  it('pads to two decimals', () => {
    expect(formatUnitPrice('EGP', '1850')).toBe('EGP 1,850.00');
    expect(formatUnitPrice('EGP', '1850.5')).toBe('EGP 1,850.50');
  });

  it('keeps the sign for negative prices', () => {
    expect(formatUnitPrice(null, '-0.125')).toBe('-0.125');
  });

  it('drops the sign for a negative zero price', () => {
    expect(formatUnitPrice(null, '-0.000')).toBe('0.00');
  });

  it('returns a dash for missing or invalid input', () => {
    expect(formatUnitPrice('EGP', null)).toBe('—');
    expect(formatUnitPrice('EGP', 'x')).toBe('—');
  });
});

describe('formatQty', () => {
  it('trims trailing zeros and the decimal point', () => {
    expect(formatQty('5.00000000')).toBe('5');
    expect(formatQty('2.500')).toBe('2.5');
  });

  it('adds thousands separators', () => {
    expect(formatQty('1234567.25')).toBe('1,234,567.25');
  });

  it('rounds to eight decimals when more are supplied', () => {
    expect(formatQty('0.123456789')).toBe('0.12345679');
  });

  it('formats a negative quantity that rounds to zero without a sign', () => {
    expect(formatQty('-0.000000001')).toBe('0');
  });

  it('keeps the sign for negative quantities', () => {
    expect(formatQty('-3.5')).toBe('-3.5');
  });

  it('returns a dash for null, blank and invalid input', () => {
    expect(formatQty(null)).toBe('—');
    expect(formatQty('')).toBe('—');
    expect(formatQty('1e3')).toBe('—');
  });
});

describe('formatDate', () => {
  const iso = '2026-03-05T12:00:00Z';

  it('formats an English date', () => {
    expect(formatDate(iso, 'en')).toBe('Mar 5, 2026');
  });

  it('formats an Arabic date with Latin digits', () => {
    const text = formatDate(iso, 'ar');
    expect(text).toMatch(/5/);
    expect(text).toMatch(/2026/);
    expect(text).toMatch(/[؀-ۿ]/);
  });

  it('returns a dash for empty or unparsable input', () => {
    expect(formatDate('', 'en')).toBe('—');
    expect(formatDate('   ', 'ar')).toBe('—');
    expect(formatDate('not-a-date', 'en')).toBe('—');
  });
});

describe('formatMoney wrapper of the shared money rule', () => {
  it('matches formatMoneyNumber and trims the currency code', () => {
    expect(formatMoney(' USD ', '1000000.004')).toBe('USD 1,000,000');
    expect(formatMoney('USD', '-1000000.005')).toBe('USD -1,000,000.01');
    expect(formatMoney('USD', '')).toBe('—');
  });

  it('rounds money to 2 decimals while unit prices keep precision', () => {
    expect(formatMoney('EGP', '12.34567')).toBe('EGP 12.35');
    expect(formatUnitPrice('EGP', '12.34567')).toBe('EGP 12.34567');
  });
});
