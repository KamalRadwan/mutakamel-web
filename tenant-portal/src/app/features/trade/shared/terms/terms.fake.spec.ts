import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError, newIdempotencyKey } from '../trade-api';
import { bindTradeHttpForTest } from '../trade-http';
import { TradeHttpStub } from '../testing/trade-http-testing';
import {
  countTerms,
  createTerm,
  deleteTerm,
  getTerm,
  listAllTerms,
  listTermOptions,
  listTerms,
  makeDefaultTerm,
  termErrorKey,
  updateTerm,
} from './terms.api';
import {
  INCOTERMS,
  TERM_LIMITS,
  TERM_SIDES,
  TERM_TYPES,
  termSelectionsBody,
  type TermCounts,
  type TermInput,
  type TermOptions,
  type TermPage,
  type TradeTerm,
} from './terms.model';

function sampleTerm(over: Partial<TradeTerm> = {}): TradeTerm {
  return {
    id: '019a0000-0000-7000-8000-000000000001',
    termType: 'PAYMENT',
    side: 'SALES',
    code: 'NET30',
    displayName: 'Net 30',
    localizedNames: { en: 'Net 30', ar: 'صافي 30 يومًا' },
    localizedTexts: { en: 'Pay in 30 days', ar: 'الدفع خلال 30 يومًا' },
    dueDays: 30,
    incotermCode: null,
    isDefault: false,
    isActive: true,
    sortOrder: 10,
    version: 1,
    updatedAt: '2026-11-23T00:00:00.000Z',
    ...over,
  };
}

function sampleInput(over: Partial<TermInput> = {}): TermInput {
  return {
    termType: 'GENERAL',
    side: 'BOTH',
    code: 'GEN1',
    localizedNames: { en: 'General term', ar: 'شرط عام' },
    localizedTexts: { en: 'General text', ar: 'نص عام' },
    sortOrder: 5,
    isActive: true,
    ...over,
  };
}

describe('terms.api (TradeHttpStub)', () => {
  let stub: TradeHttpStub;
  let restoreHttp: () => void;

  beforeEach(() => {
    stub = new TradeHttpStub();
    restoreHttp = bindTradeHttpForTest(stub);
  });

  afterEach(() => {
    restoreHttp();
  });

  it('keeps backend-aligned enums and limits (Q-T1..Q-T6)', () => {
    expect(TERM_TYPES).toEqual(['PAYMENT', 'DELIVERY', 'WARRANTY', 'RETURNS', 'GENERAL']);
    expect(TERM_SIDES).toEqual(['SALES', 'PURCHASE', 'BOTH']);
    expect(INCOTERMS).toEqual(['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF']);
    expect(TERM_LIMITS.nameMax).toBe(120);
    expect(TERM_LIMITS.textMax).toBe(400);
    expect(TERM_LIMITS.maxClauses).toBe(4);
  });

  it('listTerms sends query names, OPTIONAL scope, and unwraps { items, total, page, limit }', async () => {
    const page: TermPage = { items: [sampleTerm()], total: 1, page: 2, limit: 10 };
    stub.register('GET', '/terms', page);

    const result = await listTerms(
      { type: 'PAYMENT', side: 'SALES', active: true, search: 'NET', page: 2, limit: 10 },
      { companyId: 'c1', branchId: 'b1' },
    );

    expect(result).toEqual(page);
    expect(stub.recordedReads()).toEqual([
      {
        path: '/terms',
        query: { type: 'PAYMENT', side: 'SALES', active: true, search: 'NET', page: 2, limit: 10 },
        scope: { companyId: 'c1', branchId: 'b1' },
      },
    ]);

    stub.reset();
    await listTerms();
    expect(stub.recordedReads()).toEqual([{ path: '/terms', query: undefined, scope: {} }]);
  });

  it('listAllTerms loops pages at maxLimit until all items are loaded', async () => {
    const first = sampleTerm({ id: 't1', code: 'T1' });
    stub.register('GET', '/terms', { items: [first], total: 1, page: 1, limit: 100 } satisfies TermPage);

    const items = await listAllTerms({ type: 'PAYMENT' }, { companyId: 'c1' });
    expect(items).toEqual([first]);
    expect(stub.recordedReads()).toEqual([
      { path: '/terms', query: { type: 'PAYMENT', page: 1, limit: 100 }, scope: { companyId: 'c1' } },
    ]);
  });

  it('countTerms sends active query, OPTIONAL scope, and unwraps { total, byType }', async () => {
    const counts: TermCounts = {
      total: 3,
      byType: { PAYMENT: 1, DELIVERY: 1, WARRANTY: 0, RETURNS: 0, GENERAL: 1 },
    };
    stub.register('GET', '/terms/counts', counts);

    await expect(countTerms({ active: true }, { companyId: 'c1' })).resolves.toEqual(counts);
    expect(stub.recordedReads()).toEqual([
      { path: '/terms/counts', query: { active: true }, scope: { companyId: 'c1' } },
    ]);
  });

  it('getTerm reads GET /terms/:id with OPTIONAL scope', async () => {
    const term = sampleTerm();
    stub.register('GET', `/terms/${term.id}`, term);

    await expect(getTerm(term.id, { companyId: 'c1', branchId: 'b1' })).resolves.toEqual(term);
    expect(stub.recordedReads()).toEqual([
      { path: `/terms/${term.id}`, query: undefined, scope: { companyId: 'c1', branchId: 'b1' } },
    ]);
  });

  it('createTerm requires COMPANY scope, sends x-idempotency-key, and preserves details on field error', async () => {
    await expect(createTerm(sampleInput(), newIdempotencyKey(), {})).rejects.toMatchObject({
      status: 400,
      code: 'TRADE.SCOPE.REQUIRED',
    });
    expect(stub.recordedWrites()).toEqual([]);

    await expect(createTerm(sampleInput(), '', { companyId: 'c1' })).rejects.toMatchObject({
      status: 400,
      code: 'TRADE.IDEMPOTENCY.KEY_MISSING',
    });
    expect(stub.recordedWrites()).toEqual([]);

    const key = newIdempotencyKey();
    const body = sampleInput({ code: 'CREATED1' });
    const created = sampleTerm({ code: 'CREATED1', termType: 'GENERAL', side: 'BOTH', dueDays: null });
    stub.register('POST', '/terms', created);

    await expect(createTerm(body, key, { companyId: 'c1', branchId: 'b1' })).resolves.toEqual(created);
    expect(stub.recordedWrites()).toEqual([
      {
        method: 'POST',
        path: '/terms',
        body,
        key,
        ifMatch: undefined,
        scope: { companyId: 'c1' },
        query: undefined,
      },
    ]);

    stub.register('POST', '/terms', new ApiError(409, 'TRADE.TERMS.CODE_TAKEN', { field: ['code'] }));
    await expect(createTerm(body, newIdempotencyKey(), { companyId: 'c1' })).rejects.toMatchObject({
      status: 409,
      code: 'TRADE.TERMS.CODE_TAKEN',
      details: { field: ['code'] },
    });
  });

  it('updateTerm sends key + If-Match and COMPANY scope, and surfaces 409 conflict', async () => {
    const term = sampleTerm({ id: 'term-1', sortOrder: 20, version: 4 });
    const key = newIdempotencyKey();
    stub.register('PATCH', '/terms/term-1', term);

    await expect(updateTerm('term-1', 3, { sortOrder: 20 }, { companyId: 'c1', branchId: 'b1' }, key)).resolves.toEqual(
      term,
    );
    expect(stub.recordedWrites()).toEqual([
      {
        method: 'PATCH',
        path: '/terms/term-1',
        body: { sortOrder: 20 },
        key,
        ifMatch: '"3"',
        scope: { companyId: 'c1' },
        query: undefined,
      },
    ]);

    stub.register('PATCH', '/terms/term-1', new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION'));
    await expect(updateTerm('term-1', 3, { sortOrder: 20 }, { companyId: 'c1' }, key)).rejects.toMatchObject({
      status: 409,
      code: 'TRADE.CONCURRENCY.STALE_VERSION',
    });
  });

  it('makeDefaultTerm sends POST /terms/:id/make-default with key + If-Match and COMPANY scope', async () => {
    const term = sampleTerm({ id: 'term-1', isDefault: true, version: 2 });
    const key = newIdempotencyKey();
    stub.register('POST', '/terms/term-1/make-default', term);

    await expect(makeDefaultTerm('term-1', 1, { companyId: 'c1', branchId: 'b1' }, key)).resolves.toEqual(term);
    expect(stub.recordedWrites()).toEqual([
      {
        method: 'POST',
        path: '/terms/term-1/make-default',
        body: undefined,
        key,
        ifMatch: '"1"',
        scope: { companyId: 'c1' },
        query: undefined,
      },
    ]);
  });

  it('deleteTerm sends DELETE /terms/:id with key + If-Match and COMPANY scope', async () => {
    const term = sampleTerm({ id: 'term-1', version: 5 });
    const key = newIdempotencyKey();
    stub.register('DELETE', '/terms/term-1', term);

    await expect(deleteTerm('term-1', 4, { companyId: 'c1', branchId: 'b1' }, key)).resolves.toEqual(term);
    expect(stub.recordedWrites()).toEqual([
      {
        method: 'DELETE',
        path: '/terms/term-1',
        body: undefined,
        key,
        ifMatch: '"4"',
        scope: { companyId: 'c1' },
        query: undefined,
      },
    ]);
  });

  it('listTermOptions sends documentType query with OPTIONAL scope', async () => {
    const options: TermOptions = {
      byType: { PAYMENT: [sampleTerm()], DELIVERY: [], WARRANTY: [], RETURNS: [], GENERAL: [] },
      defaults: { PAYMENT: '019a0000-0000-7000-8000-000000000001' },
    };
    stub.register('GET', '/terms/options', options);

    await expect(listTermOptions('QUOTATION', { companyId: 'c1', branchId: 'b1' })).resolves.toEqual(options);
    expect(stub.recordedReads()).toEqual([
      {
        path: '/terms/options',
        query: { documentType: 'QUOTATION' },
        scope: { companyId: 'c1', branchId: 'b1' },
      },
    ]);
  });

  it('termSelectionsBody omits null, undefined, and empty clause lists (S-1)', () => {
    expect(termSelectionsBody(null)).toEqual({});
    expect(
      termSelectionsBody({
        paymentTermId: null,
        deliveryTermId: '  ',
        warrantyTermId: undefined,
        clauseIds: [],
      }),
    ).toEqual({});
    expect(
      termSelectionsBody({
        paymentTermId: ' pay-1 ',
        deliveryTermId: null,
        warrantyTermId: 'war-1',
        clauseIds: [' cl-1 ', ''],
      }),
    ).toEqual({
      paymentTermId: 'pay-1',
      warrantyTermId: 'war-1',
      clauseIds: ['cl-1'],
    });
  });

  it('termErrorKey maps TRADE.CONTEXT.MISSING_COMPANY, TRADE.SCOPE.REQUIRED, and term codes (S-5)', () => {
    expect(termErrorKey(new ApiError(400, 'TRADE.CONTEXT.MISSING_COMPANY'))).toBe(
      'tset.errors.TRADE_CONTEXT_MISSING_COMPANY',
    );
    expect(termErrorKey(new ApiError(400, 'TRADE.SCOPE.REQUIRED'))).toBe('tset.errors.TRADE_SCOPE_REQUIRED');
    expect(termErrorKey(new ApiError(409, 'TRADE.TERMS.CODE_TAKEN'))).toBe('tset.errors.TRADE_TERMS_CODE_TAKEN');
    expect(termErrorKey(new Error('network'))).toBe('tset.errors.generic');
  });
});
