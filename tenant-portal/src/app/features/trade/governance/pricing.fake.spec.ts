import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../shared/trade-api';
import { bindTradeHttpForTest } from '../shared/trade-http';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import * as api from './pricing.api';

const ctx = { companyId: 'company-1', branchId: 'branch-1' };
const opts = { ctx, ifMatch: 3 };
const entry = { itemId: 'item-1', uomId: 'uom-1', currencyCode: 'EGP', minimumQuantity: '1', unitPrice: '10' };

// The server owns lifecycle validation. Verify every linked function preserves its
// structured errors instead of exercising the retired in-browser fake backend.
const cases: { name: string; method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; call: () => Promise<unknown> }[] = [
  { name: 'listPriceBooks', method: 'GET', path: '/price-books', call: () => api.listPriceBooks({}, ctx) },
  { name: 'getKpis', method: 'GET', path: '/price-books/kpis', call: () => api.getKpis({}, ctx) },
  { name: 'getPriceBook', method: 'GET', path: '/price-books/book-1', call: () => api.getPriceBook('book-1', ctx) },
  { name: 'getPriceVersion', method: 'GET', path: '/price-book-versions/version-1', call: () => api.getPriceVersion('version-1', {}, ctx) },
  { name: 'listEntries', method: 'GET', path: '/price-book-versions/version-1/entries', call: () => api.listEntries('version-1', {}, ctx) },
  { name: 'getDiff', method: 'GET', path: '/price-book-versions/version-1/diff/version-2', call: () => api.getDiff('version-1', 'version-2', ctx) },
  { name: 'getReferenceData', method: 'GET', path: '/pricing/reference-data', call: () => api.getReferenceData(ctx) },
  { name: 'listCompanyDefaults', method: 'GET', path: '/configuration/company-default-price-books', call: () => api.listCompanyDefaults(ctx) },
  { name: 'createPriceBook', method: 'POST', path: '/price-books', call: () => api.createPriceBook({ code: 'RETAIL', purpose: 'SALES', currencyCode: 'EGP' }, opts) },
  { name: 'updatePriceBook', method: 'PATCH', path: '/price-books/book-1', call: () => api.updatePriceBook('book-1', { name: 'Retail' }, opts) },
  { name: 'createVersion', method: 'POST', path: '/price-books/book-1/versions', call: () => api.createVersion('book-1', { effectiveFrom: '2026-12-01T00:00:00Z', entries: [entry] }, opts) },
  { name: 'cloneVersion', method: 'POST', path: '/price-books/book-1/versions/clone', call: () => api.cloneVersion('book-1', { sourceMode: 'SEED_FROM_CATALOG', effectiveFrom: '2026-12-01T00:00:00Z' }, opts) },
  { name: 'updateVersion', method: 'PATCH', path: '/price-book-versions/version-1', call: () => api.updateVersion('version-1', { notes: 'Updated' }, opts) },
  { name: 'changeEntries', method: 'POST', path: '/price-book-versions/version-1/entries/changes', call: () => api.changeEntries('version-1', { upserts: [entry] }, opts) },
  { name: 'changePromotions', method: 'POST', path: '/price-book-versions/version-1/promotions/changes', call: () => api.changePromotions('version-1', { deletes: ['promo-1'] }, opts) },
  { name: 'deleteVersion', method: 'DELETE', path: '/price-book-versions/version-1', call: () => api.deleteVersion('version-1', opts) },
  { name: 'testVersion', method: 'POST', path: '/price-book-versions/version-1/test', call: () => api.testVersion('version-1', opts) },
  { name: 'publishVersion', method: 'POST', path: '/price-book-versions/version-1/publish', call: () => api.publishVersion('version-1', {}, opts) },
  { name: 'retireVersion', method: 'POST', path: '/price-book-versions/version-1/retire', call: () => api.retireVersion('version-1', { reasonCode: 'RETIRED' }, opts) },
  { name: 'upsertCompanyDefault', method: 'POST', path: '/configuration/company-default-price-books/SALES/EGP/upsert', call: () => api.upsertCompanyDefault('SALES', 'EGP', 'book-1', opts) },
  { name: 'deleteCompanyDefault', method: 'DELETE', path: '/configuration/company-default-price-books/SALES/EGP', call: () => api.deleteCompanyDefault('SALES', 'EGP', opts) },
  { name: 'evaluate', method: 'POST', path: '/pricing/evaluate', call: () => api.evaluate({ ...entry, purpose: 'SALES', quantity: '1' }, ctx) },
];

describe('pricing linked functions: structured server failures', () => {
  let stub: TradeHttpStub;
  let dispose: () => void;
  beforeEach(() => { stub = new TradeHttpStub(); dispose = bindTradeHttpForTest(stub); });
  afterEach(() => dispose());

  it.each(cases)('$name preserves field details and correlation id without retrying', async ({ method, path, call }) => {
    const error = new ApiError(422, 'TRADE.VALIDATION_FAILED', { unitPrice: ['invalid_decimal'] }, { correlationId: 'pricing-correlation' });
    stub.register(method, path, error);
    await expect(call()).rejects.toBe(error);
    const requests = method === 'GET' ? stub.recordedReads() : stub.recordedWrites();
    expect(requests).toHaveLength(1);
    expect(requests[0].path).toBe(path);
    expect(requests[0].scope).toEqual(method === 'GET' || path === '/pricing/evaluate' ? ctx : { companyId: ctx.companyId });
    expect(error.details).toEqual({ unitPrice: ['invalid_decimal'] });
    expect(error.correlationId).toBe('pricing-correlation');
  });
});
