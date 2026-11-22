import { describe, expect, it } from 'vitest';
import { ApiError } from '../billing.api';
import { apiErrorCodeOf, formatCountdown, formatInvoicePeriod } from './invoice-dates';

describe('formatCountdown', () => {
  it('formats minutes and seconds with zero padding', () => {
    expect(formatCountdown(65_000)).toBe('01:05');
  });

  it('rounds partial seconds up', () => {
    expect(formatCountdown(1_001)).toBe('00:02');
  });

  it('clamps negative remaining time to zero', () => {
    expect(formatCountdown(-5_000)).toBe('00:00');
  });
});

describe('formatInvoicePeriod', () => {
  it('returns a dash when both dates are missing', () => {
    expect(formatInvoicePeriod(null, null, 'en')).toBe('—');
  });

  it('shows a single date when only one bound exists', () => {
    const one = formatInvoicePeriod('2026-03-01T12:00:00Z', null, 'en');
    expect(one).not.toContain('→');
    expect(one).toContain('2026');
  });

  it('uses a right arrow in English and a left arrow in Arabic', () => {
    expect(formatInvoicePeriod('2026-03-01T12:00:00Z', '2026-03-31T12:00:00Z', 'en')).toContain('→');
    expect(formatInvoicePeriod('2026-03-01T12:00:00Z', '2026-03-31T12:00:00Z', 'ar')).toContain('←');
  });

  it('omits the start year when both dates share a year', () => {
    const label = formatInvoicePeriod('2026-03-01T12:00:00Z', '2026-03-31T12:00:00Z', 'en');
    expect(label.split('→')[0]).not.toContain('2026');
  });

  it('shows both years when the period spans two years', () => {
    const label = formatInvoicePeriod('2025-12-15T12:00:00Z', '2026-01-15T12:00:00Z', 'en');
    expect(label.split('→')[0]).toContain('2025');
    expect(label.split('→')[1]).toContain('2026');
  });
});

describe('apiErrorCodeOf', () => {
  it('returns null for a non-ApiError', () => {
    expect(apiErrorCodeOf(new Error('x'))).toBeNull();
  });

  it('returns the code of an ApiError', () => {
    const err = Object.create(ApiError.prototype) as ApiError;
    Object.defineProperty(err, 'code', { value: 'TENANT_OWNER_REQUIRED' });
    expect(apiErrorCodeOf(err)).toBe('TENANT_OWNER_REQUIRED');
  });
});
