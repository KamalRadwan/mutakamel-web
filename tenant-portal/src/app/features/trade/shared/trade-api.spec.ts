import { describe, expect, it } from 'vitest';
import arShared from '../../../../../public/i18n/trade-shared/ar.json';
import enShared from '../../../../../public/i18n/trade-shared/en.json';
import { ApiError as CoreApiError } from '../../../core/api/api-errors';
import { ApiError, assertBodyBooleans, contextHeaders, errorKey, ifMatch, scopeFor, toTradeError } from './trade-api';

describe('tradeApi', () => {
  it('scopeFor builds headers per mode', () => {
    const ctx = { companyId: 'company-a', branchId: 'branch-a' };
    expect(scopeFor(ctx, 'NONE')).toBeUndefined();
    expect(scopeFor({}, 'NONE')).toBeUndefined();
    expect(scopeFor(ctx, 'COMPANY')).toEqual({ companyId: 'company-a' });
    expect(scopeFor(ctx, 'BRANCH')).toEqual(ctx);
    expect(scopeFor(ctx, 'OPTIONAL')).toEqual(ctx);
    expect(scopeFor({}, 'OPTIONAL')).toEqual({});
    expect(scopeFor({ companyId: 'company-a' }, 'OPTIONAL')).toEqual({ companyId: 'company-a' });
    expect(scopeFor({ branchId: 'branch-a' }, 'OPTIONAL')).toEqual({ branchId: 'branch-a' });
    expect(scopeFor({ companyId: '', branchId: '' }, 'OPTIONAL')).toEqual({});
  });

  it('scopeFor rejects a missing required id', () => {
    for (const mode of ['COMPANY', 'BRANCH'] as const) {
      for (const ctx of [{}, { branchId: 'branch-a' }, { companyId: '', branchId: 'branch-a' }]) {
        expect(() => scopeFor(ctx, mode)).toThrowError(expect.objectContaining({ status: 400, code: 'TRADE.SCOPE.REQUIRED' }));
      }
    }
    expect(() => scopeFor({ companyId: 'company-a' }, 'BRANCH')).toThrow(ApiError);
  });

  it('toTradeError normalises details', () => {
    const source = new CoreApiError(422, 'TRADE.VALIDATION_FAILED', {
      text: 'Required', strings: ['One', 'Two'], mixed: [1, null, true, { id: 1 }],
      number: 7, bool: false, object: { expected: 'one' }, empty: null,
    }, { correlationId: 'corr-one' });
    expect(toTradeError(source)).toBeInstanceOf(ApiError);
    expect(toTradeError(source)).toMatchObject({ status: 422, code: source.code, correlationId: 'corr-one', details: {
      text: ['Required'], strings: ['One', 'Two'], mixed: ['1', 'null', 'true', '[object Object]'],
      number: ['7'], bool: ['false'], object: ['{"expected":"one"}'], empty: ['null'],
    } });
    for (const details of [undefined, null, [], 'invalid']) {
      expect((toTradeError(new CoreApiError(500, 'ERROR', details as never)) as ApiError).details).toBeUndefined();
    }
  });

  it('toTradeError preserves non-core errors and existing constructor calls', () => {
    const error = new ApiError(409, 'CONFLICT', { version: ['Stale'] });
    for (const value of [error, new Error('offline'), null, undefined, 'aborted']) {
      expect(toTradeError(value)).toBe(value);
    }
    expect(error.correlationId).toBeUndefined();
    expect(new ApiError(403, 'DENIED', undefined, { correlationId: 'corr' }).correlationId).toBe('corr');
  });
});

describe('errorKey', () => {
  it('maps a non-ApiError to the network key', () => {
    expect(errorKey(new Error('boom'))).toBe('tradeShared.errors.network');
    expect(errorKey(null)).toBe('tradeShared.errors.network');
  });

  it('normalises dotted codes to the underscore key when known', () => {
    expect(errorKey(new ApiError(422, 'TRADE.CATALOG.COMPANY_PROFILE_INVALID'))).toBe(
      'tradeShared.errors.TRADE_CATALOG_COMPANY_PROFILE_INVALID',
    );
    expect(errorKey(new ApiError(400, 'TRADE.VALIDATION_FAILED'))).toBe(
      'tradeShared.errors.TRADE_VALIDATION_FAILED',
    );
  });

  it('maps any TRADE.EXTENSION.* code to the extension key', () => {
    expect(errorKey(new ApiError(422, 'TRADE.EXTENSION.WHATEVER'))).toBe('tradeShared.errors.TRADE_EXTENSION');
  });

  it('falls back to permission for an unknown 403', () => {
    expect(errorKey(new ApiError(403, 'UNKNOWN'))).toBe('tradeShared.errors.permission');
  });

  it('falls back to notFound for an unknown 404', () => {
    expect(errorKey(new ApiError(404, 'UNKNOWN'))).toBe('tradeShared.errors.notFound');
  });

  it('falls back to generic for any other unknown status', () => {
    expect(errorKey(new ApiError(500, 'UNKNOWN'))).toBe('tradeShared.errors.generic');
  });

  it('prefers a known code over the status fallback', () => {
    expect(errorKey(new ApiError(404, 'TRADE.CATALOG.ITEM_NOT_FOUND'))).toBe(
      'tradeShared.errors.TRADE_CATALOG_ITEM_NOT_FOUND',
    );
  });

  it('resolves every Foundation error code to a key with en and ar text', () => {
    const enErrors: Readonly<Record<string, string>> = enShared.errors;
    const arErrors: Readonly<Record<string, string>> = arShared.errors;
    const foundationCodes = [
      ['TRADE.ENTITLEMENT.PUBLICATION_UNAVAILABLE', 503],
      ['TRADE.APPROVAL.REJECTED', 409],
      ['TRADE.CATALOG.ITEM_IMAGE_PRINT_BUDGET_EXCEEDED', 422],
      ['TRADE.AUTH.TARGET_INVALID', 422],
      ['TRADE.CATALOG.ITEM_REFERENCE_INVALID', 422],
      ['TRADE.CONTEXT.COMPANY_REQUIRED', 422],
      ['TRADE.DEPENDENCY.NUMBERING_UNAVAILABLE', 422],
      ['TRADE.ACCOUNT.BLOCKED', 409],
    ] as const;

    for (const [code, status] of foundationCodes) {
      const normalized = code.replaceAll('.', '_');
      expect(errorKey(new ApiError(status, code))).toBe(`tradeShared.errors.${normalized}`);
      expect(enErrors[normalized]?.trim().length).toBeGreaterThan(0);
      expect(arErrors[normalized]?.trim().length).toBeGreaterThan(0);
    }
    expect(Object.keys(enErrors).sort()).toEqual(Object.keys(arErrors).sort());
  });
});

describe('contextHeaders', () => {
  it('returns no headers for an empty context', () => {
    expect(contextHeaders({})).toEqual({});
  });

  it('sets only the company header when no branch is given', () => {
    expect(contextHeaders({ companyId: 'c1' })).toEqual({ 'x-mutakamel-company-id': 'c1' });
  });

  it('sets both company and branch headers', () => {
    expect(contextHeaders({ companyId: 'c1', branchId: 'b1' })).toEqual({
      'x-mutakamel-company-id': 'c1',
      'x-mutakamel-branch-id': 'b1',
    });
  });

  it('skips empty ids', () => {
    expect(contextHeaders({ companyId: '', branchId: '' })).toEqual({});
  });
});

describe('ifMatch', () => {
  it('wraps the version in double quotes', () => {
    expect(ifMatch(7)).toBe('"7"');
  });
});

describe('assertBodyBooleans (S1)', () => {
  it('accepts real booleans and omitted fields', () => {
    expect(() => assertBodyBooleans({ canSell: false }, ['canSell', 'trackInventory'])).not.toThrow();
  });

  it('rejects "true"/"false" strings in a body with 400 TRADE.VALIDATION_FAILED', () => {
    try {
      assertBodyBooleans({ canSell: 'false' }, ['canSell']);
      throw new Error('expected a throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(400);
      expect((error as ApiError).code).toBe('TRADE.VALIDATION_FAILED');
    }
  });
});
