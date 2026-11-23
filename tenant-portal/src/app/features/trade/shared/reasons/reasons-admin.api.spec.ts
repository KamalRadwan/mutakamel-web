import { describe, expect, it } from 'vitest';
import { ApiError, newIdempotencyKey } from '../trade-api';
import { bindTradeHttpForTest } from '../trade-http';
import { TradeHttpStub } from '../testing/trade-http-testing';
import { REASON_KINDS } from './reason-kinds';
import {
  type AdminReasonCode,
  type ReasonCounts,
  countReasons,
  createReason,
  deleteReason,
  listReasonsAdmin,
  reasonErrorKey,
  updateReason,
} from './reasons-admin.api';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeReason(overrides: Partial<AdminReasonCode> = {}): AdminReasonCode {
  return {
    id: '01900000-0000-7000-8000-000000000001',
    kind: 'DOCUMENT_CANCEL',
    code: 'CUSTOMER_REQUEST',
    localizedNames: { en: 'Customer request', ar: 'طلب العميل' },
    requiresNote: false,
    isActive: true,
    sortOrder: 10,
    isSystem: false,
    version: 1,
    updatedAt: '2026-11-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeCounts(): ReasonCounts {
  const byKind = Object.fromEntries(REASON_KINDS.map((kind, i) => [kind, i + 1])) as Record<
    (typeof REASON_KINDS)[number],
    number
  >;
  const total = Object.values(byKind).reduce((sum, count) => sum + count, 0);
  return { total, byKind };
}

describe('reasons-admin.api', () => {
  it('countReasons calls GET /reason-codes/counts with includeInactive and OPTIONAL scope and unwraps counts', async () => {
    const counts = makeCounts();
    const stub = new TradeHttpStub({ 'GET /reason-codes/counts': counts });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const result = await countReasons();
      expect(result).toEqual(counts);
      expect(stub.recordedReads()[0]).toEqual({
        path: '/reason-codes/counts',
        query: { includeInactive: true },
        scope: {},
      });

      await countReasons(false, { companyId: 'comp-1', branchId: 'br-1' });
      expect(stub.recordedReads()[1]).toEqual({
        path: '/reason-codes/counts',
        query: { includeInactive: false },
        scope: { companyId: 'comp-1', branchId: 'br-1' },
      });
    } finally {
      dispose();
    }
  });

  it('listReasonsAdmin calls GET /reason-codes with kind, includeInactive and OPTIONAL scope and unwraps items', async () => {
    const row = makeReason({ kind: 'DOCUMENT_DISCOUNT' });
    const stub = new TradeHttpStub({ 'GET /reason-codes': { items: [row] } });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const items = await listReasonsAdmin('DOCUMENT_DISCOUNT', false, { companyId: 'comp-1' });
      expect(items).toEqual([row]);
      expect(stub.recordedReads()[0]).toEqual({
        path: '/reason-codes',
        query: { kind: 'DOCUMENT_DISCOUNT', includeInactive: false },
        scope: { companyId: 'comp-1' },
      });

      await listReasonsAdmin(undefined, true, {});
      expect(stub.recordedReads()[1]).toEqual({
        path: '/reason-codes',
        query: { includeInactive: true },
        scope: {},
      });
    } finally {
      dispose();
    }
  });

  it('listReasonsAdmin propagates TRADE.CONTEXT.MISSING_COMPANY and TRADE.REASON.KIND_INVALID details', async () => {
    const missingCompany = new ApiError(400, 'TRADE.CONTEXT.MISSING_COMPANY');
    const stub = new TradeHttpStub({ 'GET /reason-codes': missingCompany });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(listReasonsAdmin('DOCUMENT_CANCEL', false, {})).rejects.toBe(missingCompany);

      const badKind = new ApiError(422, 'TRADE.REASON.KIND_INVALID', { field: ['kind'] });
      stub.register('GET', '/reason-codes', badKind);
      await expect(listReasonsAdmin('DOCUMENT_CANCEL', false, {})).rejects.toMatchObject({
        status: 422,
        code: 'TRADE.REASON.KIND_INVALID',
        details: { field: ['kind'] },
      });
    } finally {
      dispose();
    }
  });

  it('createReason posts whitelisted body with x-idempotency-key and NONE scope (no scope headers)', async () => {
    const created = makeReason();
    const stub = new TradeHttpStub({ 'POST /reason-codes': created });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key = newIdempotencyKey();
      const extraInput = {
        kind: 'DOCUMENT_CANCEL' as const,
        code: 'CUSTOMER_REQUEST',
        localizedNames: { en: 'Customer request', ar: 'طلب العميل' },
        requiresNote: false,
        sortOrder: 10,
        isActive: true,
        uiOnlyField: 'must-not-be-sent',
      };
      const result = await createReason(extraInput, key);
      expect(result).toEqual(created);

      const writes = stub.recordedWrites();
      expect(writes).toHaveLength(1);
      expect(writes[0]).toEqual({
        method: 'POST',
        path: '/reason-codes',
        body: {
          kind: 'DOCUMENT_CANCEL',
          code: 'CUSTOMER_REQUEST',
          localizedNames: { en: 'Customer request', ar: 'طلب العميل' },
          requiresNote: false,
          sortOrder: 10,
          isActive: true,
        },
        key,
        ifMatch: undefined,
        scope: undefined,
        query: undefined,
      });
      expect(writes[0].key).toMatch(UUID_V7_REGEX);
    } finally {
      dispose();
    }
  });

  it('createReason rejects invalid keys/booleans locally and propagates field validation errors', async () => {
    const stub = new TradeHttpStub();
    const dispose = bindTradeHttpForTest(stub);
    try {
      const validInput = {
        kind: 'DOCUMENT_CANCEL' as const,
        code: 'CUSTOMER_REQUEST',
        localizedNames: { en: 'Customer request', ar: 'طلب العميل' },
      };

      await expect(createReason(validInput, '')).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.IDEMPOTENCY.KEY_MISSING',
      });
      await expect(createReason(validInput, 'not-a-uuid')).rejects.toMatchObject({
        status: 422,
        code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED',
      });
      await expect(
        createReason({ ...validInput, requiresNote: 'true' as unknown as boolean }, newIdempotencyKey()),
      ).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.VALIDATION_FAILED',
        details: { requiresNote: ['invalid'] },
      });
      expect(stub.recordedWrites()).toHaveLength(0);

      const patternError = new ApiError(400, 'TRADE.VALIDATION_FAILED', {
        code: ['code must match ^[A-Z][A-Z0-9_]{1,39}$'],
      });
      stub.register('POST', '/reason-codes', patternError);
      await expect(
        createReason({ ...validInput, code: 'bad' }, newIdempotencyKey()),
      ).rejects.toBe(patternError);
    } finally {
      dispose();
    }
  });

  it('updateReason patches whitelisted body with key, If-Match and NONE scope', async () => {
    const updated = makeReason({ version: 4, requiresNote: true });
    const stub = new TradeHttpStub({ 'PATCH /reason-codes/:id': updated });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key = newIdempotencyKey();
      const result = await updateReason(
        updated.id,
        3,
        {
          localizedNames: { en: 'Updated', ar: 'محدث' },
          requiresNote: true,
          isActive: true,
          sortOrder: 20,
          ignoredField: 'strip-me',
        } as never,
        key,
      );
      expect(result).toEqual(updated);
      expect(stub.recordedWrites()[0]).toEqual({
        method: 'PATCH',
        path: `/reason-codes/${updated.id}`,
        body: {
          localizedNames: { en: 'Updated', ar: 'محدث' },
          requiresNote: true,
          isActive: true,
          sortOrder: 20,
        },
        key,
        ifMatch: '"3"',
        scope: undefined,
        query: undefined,
      });
    } finally {
      dispose();
    }
  });

  it('deleteReason sends DELETE with key, If-Match, NONE scope and propagates SYSTEM_IMMUTABLE', async () => {
    const deleted = makeReason({ version: 2 });
    const stub = new TradeHttpStub({ 'DELETE /reason-codes/:id': deleted });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key = newIdempotencyKey();
      const result = await deleteReason(deleted.id, 1, key);
      expect(result).toEqual(deleted);
      expect(stub.recordedWrites()[0]).toEqual({
        method: 'DELETE',
        path: `/reason-codes/${deleted.id}`,
        body: undefined,
        key,
        ifMatch: '"1"',
        scope: undefined,
        query: undefined,
      });

      const systemError = new ApiError(409, 'TRADE.REASON.SYSTEM_IMMUTABLE', { field: ['isSystem'] });
      stub.register('DELETE', '/reason-codes/:id', systemError);
      await expect(deleteReason(deleted.id, 1, newIdempotencyKey())).rejects.toBe(systemError);
    } finally {
      dispose();
    }
  });

  it('reasonErrorKey maps S-5 missing company and all known reason/transport error codes', () => {
    expect(reasonErrorKey(new ApiError(400, 'TRADE.CONTEXT.MISSING_COMPANY'))).toBe(
      'tset.errors.TRADE_CONTEXT_MISSING_COMPANY',
    );
    expect(reasonErrorKey(new ApiError(400, 'TRADE.IDEMPOTENCY.KEY_MISSING'))).toBe(
      'tset.errors.TRADE_IDEMPOTENCY_KEY_MISSING',
    );
    expect(reasonErrorKey(new ApiError(409, 'TRADE.REASON.SYSTEM_IMMUTABLE'))).toBe(
      'tset.errors.TRADE_REASON_SYSTEM_IMMUTABLE',
    );
    expect(reasonErrorKey(new ApiError(409, 'TRADE.REASON.CODE_TAKEN'))).toBe(
      'tset.errors.TRADE_REASON_CODE_TAKEN',
    );
    expect(reasonErrorKey(new ApiError(422, 'TRADE.REASON.NOT_FOUND'))).toBe(
      'tset.errors.TRADE_REASON_NOT_FOUND',
    );
    expect(reasonErrorKey(new ApiError(500, 'TRADE.UNKNOWN.ERROR'))).toBe('tset.errors.generic');
    expect(reasonErrorKey(new Error('network'))).toBe('tset.errors.generic');
  });
});
