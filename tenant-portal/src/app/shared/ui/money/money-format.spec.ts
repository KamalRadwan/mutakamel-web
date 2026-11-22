import { formatMoneyNumber, toMoneyString } from './money-format';
import { formatMoney } from '../../../features/trade/shared/trade-format';
import { formatMoneyDisplay } from '../../../features/crm/shared/record/fields/money-field/money-format';

describe('money rule', () => {
  const cases: [string, string][] = [
    ['12500', '12,500'],
    ['12500.00', '12,500'],
    ['12500.000000', '12,500'],
    ['12500.50', '12,500.50'],
    ['12500.5', '12,500.50'],
    ['12500.004', '12,500'],
    ['12500.005', '12,500.01'],
    ['1.995', '2'],
    ['0.5', '0.50'],
    ['.5', '0.50'],
    ['+7.1', '7.10'],
    ['-12.345', '-12.35'],
    ['-0.004', '0'],
    ['-0.005', '-0.01'],
    ['-1.999', '-2'],
    ['0', '0'],
    ['999.995', '1,000'],
    ['9999999999999999.99499999', '9,999,999,999,999,999.99'],
    ['9999999999999999.995', '10,000,000,000,000,000'],
    ['-9007199254740999.125', '-9,007,199,254,740,999.13'],
  ];

  it('formatMoneyNumber follows the rule', () => {
    for (const [input, expected] of cases) {
      expect(formatMoneyNumber(input)).toBe(expected);
    }
  });

  it('formatMoneyNumber returns null for empty or invalid input', () => {
    for (const input of [null, undefined, '', '  ', 'abc', '1.2.3']) {
      expect(formatMoneyNumber(input)).toBeNull();
    }
  });

  it('trade formatMoney prefixes the ISO code and matches the rule', () => {
    for (const [input, expected] of cases) {
      expect(formatMoney('EGP', input)).toBe(`EGP ${expected}`);
    }
    expect(formatMoney(null, '12500.50')).toBe('12,500.50');
    expect(formatMoney('EGP', null)).toBe('—');
  });

  it('CRM formatMoneyDisplay matches the rule and accepts Arabic digits', () => {
    for (const [input, expected] of cases) {
      expect(formatMoneyDisplay(input, 'en')).toBe(expected);
    }
    expect(formatMoneyDisplay('١٢٥٠٠٫٥٠', 'ar')).toBe('12,500.50');
    expect(formatMoneyDisplay('abc', 'en')).toBe('');
  });
});

describe('formatMoneyNumber separators', () => {
  it('uses the given group and decimal separators', () => {
    expect(formatMoneyNumber('1234567.891', { group: '.', decimal: ',' })).toBe('1.234.567,89');
    expect(formatMoneyNumber('1234567', { group: ' ' })).toBe('1 234 567');
  });

  it('trims surrounding whitespace and strips leading zeros', () => {
    expect(formatMoneyNumber('  0001200.10  ')).toBe('1,200.10');
    expect(formatMoneyNumber('5.')).toBe('5');
  });

  it('rejects signs alone, exponents and grouped input', () => {
    for (const input of ['-', '+', '1e3', '1,000', '--1', '١٢']) {
      expect(formatMoneyNumber(input)).toBeNull();
    }
  });
});

describe('toMoneyString', () => {
  it('returns a plain 2-decimal wire string', () => {
    expect(toMoneyString('1200000')).toBe('1200000.00');
    expect(toMoneyString('12.345')).toBe('12.35');
    expect(toMoneyString('-0.004')).toBe('0.00');
    expect(toMoneyString('-0.005')).toBe('-0.01');
    expect(toMoneyString(1200000.5)).toBe('1200000.50');
    expect(toMoneyString(0)).toBe('0.00');
  });

  it('returns null for null, undefined, invalid and non-finite input', () => {
    for (const input of [null, undefined, '', 'abc', Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(toMoneyString(input)).toBeNull();
    }
  });

  // Bug: numberToPlain's regex uses `d` / `.` instead of `\d` / `\.`, so exponent
  // notation is never expanded and these return null. Flip to `it` once fixed.
  it('expands numbers that String() renders in exponent notation', () => {
    expect(toMoneyString(1e21)).toBe('1000000000000000000000.00');
    expect(toMoneyString(1e-7)).toBe('0.00');
  });
});
