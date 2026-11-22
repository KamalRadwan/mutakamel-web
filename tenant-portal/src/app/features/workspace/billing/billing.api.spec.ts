import { describe, expect, it } from 'vitest';
import { TranslocoService } from '@jsverse/transloco';
import { ApiError } from '../../../core/api/api-errors';
import { seatDowngradeDetails, seatDowngradeMessage } from './billing.api';

const DETAILS = { moduleKey: ['crm'], used: ['4'], target: ['2'], excess: ['2'] };

function translator(messages: Record<string, string>): TranslocoService {
  return {
    translate: (key: string, params?: Record<string, unknown>) =>
      (messages[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params?.[name] ?? '')),
  } as unknown as TranslocoService;
}

describe('seatDowngradeDetails', () => {
  it('reads the one-element decimal string arrays of SEAT_DOWNGRADE_FREE_UP_REQUIRED', () => {
    expect(seatDowngradeDetails(new ApiError(409, 'SEAT_DOWNGRADE_FREE_UP_REQUIRED', DETAILS))).toEqual({
      moduleKey: 'crm',
      used: 4,
      target: 2,
      excess: 2,
    });
  });

  it('returns null when a key is missing, scalar or not a count', () => {
    expect(seatDowngradeDetails(new ApiError(409, 'SEAT_DOWNGRADE_FREE_UP_REQUIRED'))).toBeNull();
    expect(
      seatDowngradeDetails(new ApiError(409, 'SEAT_DOWNGRADE_FREE_UP_REQUIRED', { moduleKey: 'crm', used: 4, target: 2, excess: 2 })),
    ).toBeNull();
    expect(seatDowngradeDetails(new ApiError(409, 'SEAT_DOWNGRADE_FREE_UP_REQUIRED', { ...DETAILS, excess: ['x'] }))).toBeNull();
  });
});

describe('seatDowngradeMessage', () => {
  const t = translator({
    'bill.errors.SEAT_DOWNGRADE_FREE_UP_REQUIRED': 'Free seats first.',
    'bill.errors.SEAT_DOWNGRADE_FREE_UP_REQUIRED_COUNTS': '{{used}} in use, free {{excess}} to reach {{target}}.',
  });

  it('puts the counts in the message when the details carry them', () => {
    expect(seatDowngradeMessage(new ApiError(409, 'SEAT_DOWNGRADE_FREE_UP_REQUIRED', DETAILS), t)).toBe(
      '4 in use, free 2 to reach 2.',
    );
  });

  it('uses the plain code message without details', () => {
    expect(seatDowngradeMessage(new ApiError(409, 'SEAT_DOWNGRADE_FREE_UP_REQUIRED'), t)).toBe('Free seats first.');
  });
});
