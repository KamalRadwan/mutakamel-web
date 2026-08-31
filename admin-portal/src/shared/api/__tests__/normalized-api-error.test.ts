import { describe, it, expect } from 'vitest';
import {
  normalizeApiError,
  type NormalizedApiError,
} from '../normalized-api-error';
class MockAxiosError extends Error {
  isAxiosError = true;
  response: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(message: string, _code: string, _config: any, _request: any, response: unknown) {
    super(message);
    this.name = 'AxiosError';
    this.response = response;
  }
}

describe('normalized-api-error', () => {
  it('normalizes a CoreErrorResponse correctly', () => {
    const errorData = {
      success: false,
      statusCode: 422,
      errorCode: 'VALIDATION_FAILED',
      errorCategory: 'VALIDATION',
      message: 'Input is invalid',
      correlationId: 'corr-id',
      timestamp: '2026-08-02T12:00:00Z',
      path: '/api/test'
    };

    const axiosError = new MockAxiosError(
      'Request failed with status code 422',
      'ERR_BAD_REQUEST',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      {},
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: {} as any,
        headers: new Headers(),
        data: errorData
      }
    );

    const result = normalizeApiError(axiosError);
    expect(result.isNormalized).toBe(true);
    expect(result.httpStatus).toBe(422);
    expect(result.errorCode).toBe('VALIDATION_FAILED');
    expect(result.message).toBe('Input is invalid');
    expect(result.correlationId).toBe('corr-id');
  });

  it('normalizes a GatewayProblemDetails correctly', () => {
    const errorData = {
      type: 'https://errors.test',
      title: 'Conflict',
      status: 409,
      code: 'GW.CONFLICT',
      detail: 'Resource is locked',
      correlationId: 'gw-corr-id'
    };

    const axiosError = new MockAxiosError(
      'Request failed with status code 409',
      'ERR_BAD_REQUEST',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      {},
      {
        status: 409,
        statusText: 'Conflict',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: {} as any,
        headers: new Headers(),
        data: errorData
      }
    );

    const result = normalizeApiError(axiosError);
    expect(result.isNormalized).toBe(true);
    expect(result.httpStatus).toBe(409);
    expect(result.errorCode).toBe('GW.CONFLICT');
    expect(result.message).toBe('Conflict: Resource is locked');
    expect(result.correlationId).toBe('gw-corr-id');
  });

  it('handles unknown non-axios errors safely', () => {
    const result = normalizeApiError(new Error('Random JS crash'));
    expect(result.isNormalized).toBe(true);
    expect(result.httpStatus).toBe(500);
    expect(result.errorCode).toBe('UNKNOWN_ERROR');
    expect(result.message).toBe('Random JS crash');
  });

  it('retains correlation evidence from the native portal client error shape', () => {
    const nativeClientError = Object.assign(new Error('Connection failed'), {
      response: {
        status: 503,
        data: {
          type: 'https://errors.mutakamel.ai/upstream',
          title: 'Worker unavailable',
          status: 503,
          code: 'GATEWAY.UPSTREAM.UNAVAILABLE',
          detail: 'Backup service did not respond.',
          correlationId: '019f-native-client',
        },
      },
    });

    const result = normalizeApiError(nativeClientError);

    expect(result.httpStatus).toBe(503);
    expect(result.errorCode).toBe('GATEWAY.UPSTREAM.UNAVAILABLE');
    expect(result.correlationId).toBe('019f-native-client');
  });

  it('passes through an already-normalized error without losing evidence', () => {
    const normalized: NormalizedApiError = {
      isNormalized: true,
      httpStatus: 409,
      errorCode: 'BACKUP.RUN.CONFLICT',
      errorCategory: 'CONFLICT',
      message: 'A backup operation already owns this database server.',
      correlationId: '019f-normalized-pass-through',
    };

    const result = normalizeApiError(normalized);

    expect(result).toBe(normalized);
    expect(result.httpStatus).toBe(409);
    expect(result.errorCode).toBe('BACKUP.RUN.CONFLICT');
    expect(result.correlationId).toBe('019f-normalized-pass-through');
  });

  it('normalizes a string Nest validation error as a deterministic 400', () => {
    const error = Object.assign(new Error('Request failed'), {
      response: {
        status: 400,
        headers: new Headers({
          'x-correlation-id': '019f-worker-header',
        }),
        data: {
          statusCode: 400,
          message: ['databaseServerId must be a UUID', 'reason is required'],
          error: 'Bad Request',
        },
      },
    });

    const result = normalizeApiError(error);

    expect(result).toMatchObject({
      httpStatus: 400,
      errorCode: 'HTTP_400',
      errorCategory: 'VALIDATION',
      message: 'databaseServerId must be a UUID; reason is required',
      correlationId: '019f-worker-header',
    });
  });

  it('uses a Nest body statusCode and body correlation for a deterministic 404', () => {
    const result = normalizeApiError({
      response: {
        data: {
          statusCode: 404,
          message: 'Backup policy was not found.',
          error: 'Not Found',
          correlationId: '019f-worker-body',
        },
      },
    });

    expect(result).toMatchObject({
      httpStatus: 404,
      errorCode: 'HTTP_404',
      errorCategory: 'NOT_FOUND',
      message: 'Backup policy was not found.',
      correlationId: '019f-worker-body',
    });
  });

  it('extracts a validated nested Worker code and details for a deterministic 409', () => {
    const result = normalizeApiError({
      response: {
        status: 409,
        data: {
          statusCode: 409,
          message: {
            code: 'BACKUP.RUN.CONFLICT',
            message: 'Another backup run already owns this server.',
            details: {
              databaseServerId: ['A run is already active.'],
              ignored: { arbitrary: true },
            },
            correlationId: '019f-worker-nested',
          },
          error: 'Conflict',
        },
      },
    });

    expect(result).toMatchObject({
      httpStatus: 409,
      errorCode: 'BACKUP.RUN.CONFLICT',
      errorCategory: 'CONFLICT',
      message: 'Another backup run already owns this server.',
      details: {
        databaseServerId: ['A run is already active.'],
      },
      correlationId: '019f-worker-nested',
    });
    expect(result.details).not.toHaveProperty('ignored');
  });

  it('keeps a true network failure in the 500 UNKNOWN fallback', () => {
    const result = normalizeApiError(new TypeError('Failed to fetch'));

    expect(result).toMatchObject({
      httpStatus: 500,
      errorCode: 'UNKNOWN_ERROR',
      message: 'Failed to fetch',
    });
  });
});
