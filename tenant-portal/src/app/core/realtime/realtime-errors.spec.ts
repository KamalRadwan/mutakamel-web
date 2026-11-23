import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/api-errors';
import { RealtimeError, realtimeErrorMessage, realtimeFailure } from './realtime-errors';

describe('Realtime error mapping', () => {
  it('preserves admission retry/correlation metadata but never trusts auth retryability', () => {
    const failure = realtimeFailure({
      data: {
        contractVersion: 1,
        code: 'REALTIME.AUTH.INVALID_TOKEN',
        message: 'Secret diagnostic',
        retryable: true,
        retryAfterMs: 30_000,
        correlationId: '019aabbc-0000-7000-8000-000000000001',
      },
    });
    expect(failure.retryable).toBe(false);
    expect(failure.status).toBe(403);
    expect(new RealtimeError(failure).correlationId).toBe(failure.correlationId);
    expect(new RealtimeError(failure).details?.['retryAfterSeconds']).toEqual(['30']);
  });

  it('keeps ApiError semantics and maps unstructured transport failures to the shared network error', () => {
    expect(realtimeFailure(new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED')).retryable).toBe(true);
    expect(realtimeFailure(new ApiError(403, 'FORBIDDEN')).retryable).toBe(false);
    expect(realtimeFailure(new Error('Transport unavailable'))).toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
      retryable: true,
    });
  });

  it('uses existing i18n resolution and never displays the server message', () => {
    const failure = realtimeFailure({
      code: 'REALTIME.AUTH.ACCESS_REVOKED',
      message: 'Do not display',
      retryable: false,
      retryAfterMs: null,
    });
    const translate = (key: string) =>
      key === 'realtime.errors.REALTIME.AUTH.ACCESS_REVOKED' ? 'Access ended' : key;
    expect(realtimeErrorMessage(failure, translate)).toBe('Access ended');
    const shared = (key: string) => (key === 'apiErrors.permission' ? 'Permission denied' : key);
    expect(realtimeErrorMessage(failure, shared)).toBe('Permission denied');
  });
});
