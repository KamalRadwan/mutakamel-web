import { describe, expect, it } from 'vitest';
import { formatAmount, formatUnitPrice, formatUsd, isGreater, isZero } from './money';

const MINUS = '−';

describe('isGreater', () => {
  it('returns true when the integer part is larger', () => {
    expect(isGreater('10.00', '9.99')).toBe(true);
  });

  it('returns false when both values are equal', () => {
    expect(isGreater('5.00', '5')).toBe(false);
  });

  it('returns false when the first value is smaller', () => {
    expect(isGreater('9.99', '10.00')).toBe(false);
  });

  it('compares fractions with different lengths by value, not by text', () => {
    expect(isGreater('1.5', '1.25')).toBe(true);
    expect(isGreater('1.25', '1.5')).toBe(false);
  });

  it('detects a tiny increase beyond double precision', () => {
    expect(isGreater('100000000000000000.0000000001', '100000000000000000')).toBe(true);
  });

  it('treats a negative value as smaller than a positive one', () => {
    expect(isGreater('0.01', '-5')).toBe(true);
    expect(isGreater('-5', '0.01')).toBe(false);
  });

  it('orders two negatives by magnitude', () => {
    expect(isGreater('-1', '-2')).toBe(true);
    expect(isGreater('-2', '-1')).toBe(false);
  });

  it('accepts the unicode minus sign', () => {
    expect(isGreater('0', `${MINUS}1`)).toBe(true);
  });

  it('ignores leading zeros', () => {
    expect(isGreater('007', '6')).toBe(true);
  });

  it('returns false when either value is unparseable', () => {
    expect(isGreater('abc', '1')).toBe(false);
    expect(isGreater('1', '')).toBe(false);
    expect(isGreater('1.2.3', '1')).toBe(false);
  });
});

describe('isZero', () => {
  it('treats null as zero', () => {
    expect(isZero(null)).toBe(true);
  });

  it('recognises zero with decimals and signs', () => {
    expect(isZero('0')).toBe(true);
    expect(isZero('0.000')).toBe(true);
    expect(isZero('-0.00')).toBe(true);
  });

  it('returns false for a non-zero amount', () => {
    expect(isZero('0.001')).toBe(false);
  });
});

describe('formatAmount', () => {
  it('returns a dash for null', () => {
    expect(formatAmount(null, 'USD')).toBe('—');
  });

  it('returns a dash for an unparseable value', () => {
    expect(formatAmount('nope', 'USD')).toBe('—');
  });

  it('groups thousands and shows two decimals', () => {
    expect(formatAmount('1234567.5', 'USD')).toBe('USD 1,234,567.50');
  });

  it('rounds half away from zero on the third decimal', () => {
    expect(formatAmount('1.005', 'USD')).toBe('USD 1.01');
    expect(formatAmount('1.004', 'USD')).toBe('USD 1');
  });

  it('carries the rounding into the integer part', () => {
    expect(formatAmount('9.995', 'USD')).toBe('USD 10');
    expect(formatAmount('999.995', 'USD')).toBe('USD 1,000');
  });

  it('uses the unicode minus for negatives', () => {
    expect(formatAmount('-12.5', 'USD')).toBe(`${MINUS}USD 12.50`);
  });

  it('adds a plus sign only when signed is requested', () => {
    expect(formatAmount('3', 'USD', { signed: true })).toBe('+USD 3');
    expect(formatAmount('3', 'USD')).toBe('USD 3');
  });

  it('drops the sign when a negative value rounds to zero', () => {
    expect(formatAmount('-0.001', 'USD')).toBe('USD 0');
    expect(formatAmount('0', 'USD', { signed: true })).toBe('USD 0');
  });
});

describe('formatUsd', () => {
  it('formats with the USD currency code', () => {
    expect(formatUsd('2')).toBe('USD 2');
  });
});

describe('formatUnitPrice', () => {
  it('keeps significant fraction digits beyond 2 decimals', () => {
    expect(formatUnitPrice('0.00125')).toBe('USD 0.00125');
  });

  it('drops trailing zeros beyond the significant decimals', () => {
    expect(formatUnitPrice('12.3450')).toBe('USD 12.345');
  });

  it('shows a plain integer when the stored fraction is all zeros', () => {
    expect(formatUnitPrice('12.0000')).toBe('USD 12');
  });

  it('applies the money rule when at most 2 significant decimals remain', () => {
    expect(formatUnitPrice('12.5000')).toBe('USD 12.50');
    expect(formatUnitPrice('1250.2500')).toBe('USD 1,250.25');
  });

  it('shows no fraction for an integer value', () => {
    expect(formatUnitPrice('1500')).toBe('USD 1,500');
  });

  it('groups thousands when keeping more than 2 decimals', () => {
    expect(formatUnitPrice('1234.5678')).toBe('USD 1,234.5678');
  });

  it('uses the given currency code', () => {
    expect(formatUnitPrice('2', 'EGP')).toBe('EGP 2');
  });

  it('uses the minus sign for a negative price', () => {
    expect(formatUnitPrice('-0.125')).toBe(`${MINUS}USD 0.125`);
    expect(formatUnitPrice('-3.5')).toBe(`${MINUS}USD 3.50`);
  });

  it('drops the minus sign for a negative zero', () => {
    expect(formatUnitPrice('-0.00')).toBe('USD 0');
  });

  it('returns a dash for null or an unparseable value', () => {
    expect(formatUnitPrice(null)).toBe('—');
    expect(formatUnitPrice('abc')).toBe('—');
  });
});
