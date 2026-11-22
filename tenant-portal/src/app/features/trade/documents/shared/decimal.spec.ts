import { describe, expect, it } from 'vitest';
import { add, cmp, isDecimal, isZero, mul, neg, round, sub } from './decimal';

describe('decimal', () => {
  it('satisfies the required core arithmetic and validation cases', () => {
    expect(mul('0.125', '3', 2)).toBe('0.38');
    expect(round('2.345', 2)).toBe('2.35');
    expect(round('-2.345', 2)).toBe('-2.35');
    expect(add('9999999999999999.99999999', '0')).toBe('9999999999999999.99999999');
    expect(sub('1', '1.5')).toBe('-0.5');
    expect(isDecimal('01')).toBe(false);
    expect(isDecimal('0', { positive: true })).toBe(false);
  });

  it('adds and subtracts with arbitrary 8-decimal precision and strips trailing zeros', () => {
    expect(add('1.50', '2.50')).toBe('4');
    expect(add('-1.5', '1.5')).toBe('0');
    expect(add('0.00000001', '0.00000002')).toBe('0.00000003');
    expect(sub('9999999999999999.99999999', '0.00000001')).toBe('9999999999999999.99999998');
    expect(sub('10.25', '10.2500')).toBe('0');
  });

  it('multiplies using default 8 decimals and custom decimal places without -0', () => {
    expect(mul('4', '95.125')).toBe('380.5');
    expect(mul('0.0001', '0.0001')).toBe('0.00000001');
    expect(mul('0.00005', '0.0001')).toBe('0.00000001');
    expect(mul('-0.125', '3', 2)).toBe('-0.38');
    expect(mul('-5', '0', 2)).toBe('0');
  });

  it('rounds half-up away from zero symmetrically and handles carries', () => {
    expect(round('2.34499999', 2)).toBe('2.34');
    expect(round('-2.34499999', 2)).toBe('-2.34');
    expect(round('9.995', 2)).toBe('10');
    expect(round('-9.995', 2)).toBe('-10');
    expect(round('100.5', 0)).toBe('101');
    expect(round('-100.5', 0)).toBe('-101');
    expect(round('-0.004', 2)).toBe('0');
  });

  it('compares, checks zero, and negates consistently', () => {
    expect(cmp('1.5', '1.500')).toBe(0);
    expect(cmp('-1.5', '-1.49999999')).toBe(-1);
    expect(cmp('0.00000001', '0')).toBe(1);
    expect(isZero('0')).toBe(true);
    expect(isZero('0.00000000')).toBe(true);
    expect(isZero('-0')).toBe(true);
    expect(isZero('0.00000001')).toBe(false);
    expect(neg('5.50')).toBe('-5.5');
    expect(neg('-5.50')).toBe('5.5');
    expect(neg('0')).toBe('0');
    expect(neg('-0.00')).toBe('0');
  });

  it('enforces backend decimal pattern rules in isDecimal', () => {
    expect(isDecimal('0')).toBe(true);
    expect(isDecimal('0.00000001')).toBe(true);
    expect(isDecimal('9999999999999999.99999999')).toBe(true);
    expect(isDecimal('10000000000000000')).toBe(false);
    expect(isDecimal('1.123456789')).toBe(false);
    expect(isDecimal('00')).toBe(false);
    expect(isDecimal('01.5')).toBe(false);
    expect(isDecimal('.5')).toBe(false);
    expect(isDecimal('5.')).toBe(false);
    expect(isDecimal('1e5')).toBe(false);
    expect(isDecimal('+1')).toBe(false);
    expect(isDecimal('')).toBe(false);
    expect(isDecimal(' 1')).toBe(false);
    expect(isDecimal('-1')).toBe(false);
    expect(isDecimal('-1', { signed: true })).toBe(true);
    expect(isDecimal('-01', { signed: true })).toBe(false);
    expect(isDecimal('-1', { signed: true, positive: true })).toBe(false);
    expect(isDecimal('0.00000001', { positive: true })).toBe(true);
  });
});
