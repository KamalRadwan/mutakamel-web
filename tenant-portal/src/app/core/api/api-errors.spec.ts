import enGlobal from '../../../../public/i18n/en.json';
import arGlobal from '../../../../public/i18n/ar.json';
import {
  ApiError,
  correlationIdOf,
  errorMessage,
  fieldErrorsOf,
  isValidationError,
  sharedErrorKeyOf,
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
