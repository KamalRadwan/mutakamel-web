import enGlobal from '../../../../public/i18n/en.json';
import arGlobal from '../../../../public/i18n/ar.json';
import {
  ApiError,
  correlationIdOf,
  errorMessage,
  fieldErrorsOf,
  isValidationError,
  sharedErrorKeyOf,
  writeErrorMessage,
  isRetryableWriteError,
} from './api-errors';

type Dict = Record<string, unknown>;

function lookup(dict: Dict, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Dict)[part] : undefined), dict);
  return typeof value === 'string' ? value : undefined;
}

/** A translate function over a dictionary that echoes the key when it is missing, like Transloco. */
function translator(dict: Dict): (key: string) => string {
  return (key) => lookup(dict, key) ?? key;
}

describe('ApiError', () => {
  it('keeps the three-argument form working', () => {
    const error = new ApiError(422, 'VALIDATION_ERROR', { field: 'name' });
    expect(error.status).toBe(422);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual({ field: 'name' });
    expect(error.correlationId).toBeUndefined();
    expect(error.message).toBe('VALIDATION_ERROR');
    expect(error.name).toBe('ApiError');
  });

  it('takes a correlation id through the options argument', () => {
    expect(new ApiError(500, 'COMMON.GENERIC.INTERNAL_ERROR', undefined, { correlationId: 'corr-1' }).correlationId).toBe('corr-1');
    expect(new ApiError(500, 'X', undefined, { correlationId: '' }).correlationId).toBeUndefined();
  });

  it('reads the service envelope with a top-level correlation id and no details on 5xx', () => {
    const error = ApiError.fromResponse(500, {
      success: false,
      statusCode: 500,
      errorCode: 'COMMON.GENERIC.INTERNAL_ERROR',
      message: 'Internal server error',
      correlationId: 'corr-500',
      path: '/api/v1/x',
    });
    expect(error.code).toBe('COMMON.GENERIC.INTERNAL_ERROR');
    expect(error.details).toBeUndefined();
    expect(error.correlationId).toBe('corr-500');
  });

  it('reads field-keyed validation details', () => {
    const error = ApiError.fromResponse(400, {
      errorCode: 'CORE_VALIDATION_FAILED',
      details: { 'address.city': ['Invalid value'] },
      correlationId: 'corr-400',
    });
    expect(error.details).toEqual({ 'address.city': ['Invalid value'] });
  });

  it('reads the gateway problem shape', () => {
    const error = ApiError.fromResponse(400, { type: 'https://errors.mutakamel.ai/gw/idem/missing', code: 'GW.IDEM.MISSING', correlationId: 'corr-gw' });
    expect(error.code).toBe('GW.IDEM.MISSING');
    expect(error.correlationId).toBe('corr-gw');
  });

  it('falls back to the shared status code when the body has none', () => {
    expect(ApiError.fromResponse(429, null).code).toBe('COMMON.GENERIC.RATE_LIMITED');
    expect(ApiError.fromResponse(503, 'Service Unavailable').code).toBe('COMMON.GENERIC.INTERNAL_ERROR');
  });
});

describe('correlationIdOf', () => {
  it('prefers the top-level field', () => {
    const error = new ApiError(409, 'X', { correlationId: 'nested' }, { correlationId: 'top' });
    expect(correlationIdOf(error)).toBe('top');
  });

  it('falls back to details.correlationId', () => {
    expect(correlationIdOf(new ApiError(409, 'X', { correlationId: 'nested' }))).toBe('nested');
  });

  it('returns null when absent or not an ApiError', () => {
    expect(correlationIdOf(new ApiError(409, 'X'))).toBeNull();
    expect(correlationIdOf(new Error('x'))).toBeNull();
    expect(correlationIdOf({ correlationId: 'plain' })).toBeNull();
  });
});

describe('validation codes', () => {
  it.each(['VALIDATION_ERROR', 'CORE_VALIDATION_FAILED', 'CRM_VALIDATION_FAILED', 'TRADE.VALIDATION_FAILED', 'COMMON.GENERIC.VALIDATION_FAILED'])(
    '%s is a validation error mapped to the shared validation message',
    (code) => {
      expect(isValidationError(new ApiError(400, code))).toBe(true);
      expect(sharedErrorKeyOf(code)).toBe('validation');
    },
  );

  it('is false for other codes', () => {
    expect(isValidationError(new ApiError(400, 'INVALID_OPERATOR_VALUE'))).toBe(false);
    expect(isValidationError('CORE_VALIDATION_FAILED')).toBe(false);
  });

  it('extracts field messages from the real and fake shapes', () => {
    expect(fieldErrorsOf(new ApiError(400, 'TRADE.VALIDATION_FAILED', { 'lines.0.qty': ['Invalid value'], _: ['x'] }))).toEqual({
      'lines.0.qty': ['Invalid value'],
      _: ['x'],
    });
    expect(fieldErrorsOf(new ApiError(422, 'VALIDATION_ERROR', { field: 'name' }))).toEqual({ name: [] });
    expect(fieldErrorsOf(new ApiError(409, 'CONFLICT', { name: ['x'] }))).toEqual({});
    expect(fieldErrorsOf(new ApiError(400, 'CRM_VALIDATION_FAILED'))).toEqual({});
  });
});

describe('shared error map', () => {
  const cases: Array<[string, string]> = [
    ['IDEM_MISSING', 'idempotencyKey'],
    ['IDEM_BAD_VALUE', 'idempotencyKey'],
    ['GW.IDEM.MISSING', 'idempotencyKey'],
    ['GW.IDEM.BAD_VALUE', 'idempotencyKey'],
    ['INVALID_IDEMPOTENCY_KEY', 'idempotencyKey'],
    ['IDEMPOTENCY_REQUEST_PROCESSING', 'idempotency'],
    ['IDEMPOTENCY_BODY_MISMATCH', 'idempotencyMismatch'],
    ['COMMON.GENERIC.RATE_LIMITED', 'rateLimited'],
  ];

  it.each(cases)('%s maps to %s', (code, key) => {
    expect(sharedErrorKeyOf(code)).toBe(key);
  });

  it('every mapped key has an en and ar message in the global files', () => {
    for (const [code, key] of [...cases, ['CORE_VALIDATION_FAILED', 'validation'], ['X', 'generic'], ['X', 'session'], ['X', 'network']]) {
      expect(lookup(enGlobal as Dict, `apiErrors.${key}`), `${code} en`).toBeTruthy();
      expect(lookup(arGlobal as Dict, `apiErrors.${key}`), `${code} ar`).toBeTruthy();
    }
    expect(Object.keys((enGlobal as Dict)['apiErrors'] as Dict).sort()).toEqual(Object.keys((arGlobal as Dict)['apiErrors'] as Dict).sort());
  });
});

describe('errorMessage', () => {
  const en = translator(enGlobal as Dict);
  const ar = translator(arGlobal as Dict);

  it('uses the global messages when the settings scope is not loaded', () => {
    expect(errorMessage(new ApiError(429, 'COMMON.GENERIC.RATE_LIMITED'), 'crm.leads', en)).toBe('Too many requests. Wait a moment and try again.');
    expect(errorMessage(new ApiError(400, 'GW.IDEM.MISSING'), 'crm.leads', ar)).toBe('تعذّر إرسال الطلب بأمان. أعد تحميل الصفحة وحاول مرة أخرى.');
    expect(errorMessage(new ApiError(400, 'CRM_VALIDATION_FAILED'), 'crm.leads', en)).toBe('Check the highlighted fields.');
  });

  it('prefers a feature-scoped message, then the settings scope', () => {
    const dict = {
      crm: { leads: { errors: { IDEM_MISSING: 'Scoped' } } },
      settings: { errors: { rateLimited: 'Settings rate' } },
      ...(enGlobal as Dict),
    };
    const t = translator(dict);
    expect(errorMessage(new ApiError(400, 'IDEM_MISSING'), 'crm.leads', t)).toBe('Scoped');
    expect(errorMessage(new ApiError(429, 'RATE_LIMITED'), 'crm.leads', t)).toBe('Settings rate');
  });

  it('falls back by status', () => {
    expect(errorMessage(new ApiError(429, 'UNKNOWN_CODE'), 'x', en)).toBe('Too many requests. Wait a moment and try again.');
    expect(errorMessage(new ApiError(401, 'UNKNOWN_CODE'), 'x', en)).toBe('Your session has ended. Sign in again.');
    expect(errorMessage(new ApiError(500, 'UNKNOWN_CODE'), 'x', en)).toBe('Something went wrong. Try again.');
    expect(errorMessage(new Error('boom'), 'x', { translate: en })).toBe('Something went wrong. Try again.');
  });
});

describe('api-errors', () => {
  const en = translator(enGlobal as Dict);
  const ar = translator(arGlobal as Dict);

  it('maps Core idempotency mismatch codes', () => {
    for (const code of ['CORE.TEMPLATE.IDEMPOTENCY.MISMATCH', 'ACTIVITY_IDEMPOTENCY_MISMATCH']) {
      expect(sharedErrorKeyOf(code)).toBe('idempotencyMismatch');
      expect(errorMessage(new ApiError(409, code), 'ops', en)).toBe(enGlobal.apiErrors.idempotencyMismatch);
      expect(errorMessage(new ApiError(409, code), 'ops', ar)).toBe(arGlobal.apiErrors.idempotencyMismatch);
    }
  });

  it('maps Core in-flight codes', () => {
    for (const code of ['CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT', 'ACTIVITY_IDEMPOTENCY_IN_FLIGHT']) {
      expect(sharedErrorKeyOf(code)).toBe('idempotency');
      expect(errorMessage(new ApiError(409, code), 'ops', en)).toBe(enGlobal.apiErrors.idempotency);
      expect(errorMessage(new ApiError(409, code), 'ops', ar)).toBe(arGlobal.apiErrors.idempotency);
    }
  });

  it('rate limit message uses Retry-After when present', () => {
    for (const [dict, expected] of [[enGlobal, 'Too many requests. Try again in 17 s.'],
      [arGlobal, 'طلبات كثيرة جدًا. حاول مرة أخرى بعد 17 ثانية.']] as const) {
      const t = (key: string, params?: Record<string, unknown>) =>
        (lookup(dict as Dict, key) ?? key).replace('{{seconds}}', String(params?.['seconds']));
      expect(errorMessage(new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['17'] }), 'ops', t)).toBe(expected);
      for (const details of [undefined, {}, { retryAfterSeconds: [] }]) {
        expect(errorMessage(new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', details), 'ops', t)).toBe(dict.apiErrors.rateLimited);
      }
      expect(errorMessage(new ApiError(429, 'RATE_LIMITED', { retryAfterSeconds: ['17'] }), 'ops', t)).toBe(dict.apiErrors.rateLimited);
    }
  });

  it('maintenance is not a permission error', () => {
    for (const code of ['TENANT_MAINTENANCE_ACTIVE', 'TENANT_MAINTENANCE_RELEASE_REQUIRED']) {
      expect(sharedErrorKeyOf(code)).toBe('maintenance');
      expect(errorMessage(new ApiError(403, code), 'ops', en)).toBe(enGlobal.apiErrors.maintenance);
      expect(errorMessage(new ApiError(403, code), 'ops', ar)).toBe(arGlobal.apiErrors.maintenance);
    }
  });

  it('any 413 is too large', () => {
    for (const code of ['GW.BODY.TOO_LARGE', 'OTHER_CODE', 'COMMON.GENERIC.HTTP_ERROR', 'GENERIC', 'ASSET_NOT_FOUND', '']) {
      expect(errorMessage(new ApiError(413, code), 'ops', en)).toBe(enGlobal.apiErrors.tooLarge);
      expect(errorMessage(new ApiError(413, code), 'ops', ar)).toBe(arGlobal.apiErrors.tooLarge);
    }
  });

  it('access policy unavailable message', () => {
    expect(sharedErrorKeyOf('ACCESS_POLICY_UNAVAILABLE')).toBe('accessCheckUnavailable');
    expect(errorMessage(new ApiError(503, 'ACCESS_POLICY_UNAVAILABLE'), 'ops', en)).toBe(enGlobal.apiErrors.accessCheckUnavailable);
    expect(errorMessage(new ApiError(503, 'ACCESS_POLICY_UNAVAILABLE'), 'ops', ar)).toBe(arGlobal.apiErrors.accessCheckUnavailable);
  });

  it('scoped key still wins over the new shared keys', () => {
    const codes = [
      [409, 'CORE.TEMPLATE.IDEMPOTENCY.MISMATCH'], [409, 'ACTIVITY_IDEMPOTENCY_MISMATCH'],
      [409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT'], [409, 'ACTIVITY_IDEMPOTENCY_IN_FLIGHT'],
      [429, 'GW.RATE.LIMIT_EXCEEDED'], [403, 'TENANT_MAINTENANCE_ACTIVE'],
      [403, 'TENANT_MAINTENANCE_RELEASE_REQUIRED'], [413, 'GW.BODY.TOO_LARGE'], [503, 'ACCESS_POLICY_UNAVAILABLE'],
    ] as const;
    const scoped = Object.fromEntries(codes.map(([, code]) => [code, `Scoped ${code}`]));
    const t = (key: string) => key.startsWith('ops.errors.') ? scoped[key.slice('ops.errors.'.length)] ?? key : en(key);
    for (const [status, code] of codes) {
      expect(errorMessage(new ApiError(status, code, { retryAfterSeconds: ['17'] }), 'ops', t)).toBe(`Scoped ${code}`);
    }
  });

  it('writeErrorMessage keeps the SD-11 rule', () => {
    for (const code of ['GW.AUTH.SESSION_REVOKED', 'AUTH_MFA_INVALID_CHALLENGE', 'INVALID_CREDENTIALS']) {
      expect(writeErrorMessage(new ApiError(401, code), 'ops', en)).toBe(enGlobal.apiErrors.notSaved);
      expect(writeErrorMessage(new ApiError(401, code), 'ops', { translate: ar })).toBe(arGlobal.apiErrors.notSaved);
    }
    const conflict = new ApiError(409, 'CORE.TEMPLATE.IDEMPOTENCY.MISMATCH');
    expect(writeErrorMessage(conflict, 'ops', en)).toBe(errorMessage(conflict, 'ops', en));
    const settings = translator({ ...enGlobal, settings: { errors: { notSaved: 'Settings not saved' } } });
    expect(writeErrorMessage(new ApiError(401, 'X'), 'ops', settings)).toBe('Settings not saved');
  });

  it('isRetryableWriteError', () => {
    for (const [status, code] of [[0, 'NETWORK_ERROR'], [500, 'SERVER_ERROR'], [503, 'ACCESS_POLICY_UNAVAILABLE'],
      [409, 'GW.IDEM.IN_FLIGHT'], [409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT'], [409, 'ACTIVITY_IDEMPOTENCY_IN_FLIGHT'],
      [409, 'IDEMPOTENCY_IN_PROGRESS'], [409, 'IDEMPOTENCY_REQUEST_PROCESSING']] as const) {
      expect(isRetryableWriteError(new ApiError(status, code)), `${status} ${code}`).toBe(true);
    }
    for (const [status, code] of [[400, 'CORE_VALIDATION_FAILED'], [409, 'STALE_VERSION'], [422, 'VALIDATION_ERROR'],
      [401, 'GW.AUTH.SESSION_REVOKED'], [429, 'GW.RATE.LIMIT_EXCEEDED'], [409, 'CORE.TEMPLATE.IDEMPOTENCY.MISMATCH']] as const) {
      expect(isRetryableWriteError(new ApiError(status, code)), `${status} ${code}`).toBe(false);
    }
    expect(isRetryableWriteError(new Error('failure'))).toBe(false);
    expect(isRetryableWriteError({ status: 503, code: 'SERVER_ERROR' })).toBe(false);
  });
});
