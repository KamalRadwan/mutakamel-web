import { describe, expect, it } from 'vitest';
import { ApiError, assertBodyBooleans, contextHeaders, errorKey, ifMatch } from './trade-api';

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
