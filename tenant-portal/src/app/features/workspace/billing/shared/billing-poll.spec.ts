import { describe, expect, it } from 'vitest';
import { operationPollDelay, PAYMENT_POLL } from './billing-poll';

describe('Billing polling', () => {
  it('operation poll delay backs off and honours retryAfter', () => {
    expect(operationPollDelay(0, null)).toBe(2_000);
    expect(operationPollDelay(29_999, 1)).toBe(2_000);
    expect(operationPollDelay(30_000, null)).toBe(5_000);
    expect(operationPollDelay(31_000, null)).toBe(5_000);
    expect(operationPollDelay(0, 20)).toBe(20_000);
    expect(operationPollDelay(31_000, 20)).toBe(20_000);
    expect(PAYMENT_POLL).toEqual({ intervalMs: 5_000, attempts: 60 });
  });
});
