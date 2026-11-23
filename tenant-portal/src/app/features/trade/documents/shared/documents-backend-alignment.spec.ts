import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../shared/trade-api';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { isRenderUnavailable } from '../document-print/print-dialog/print-dialog';
import { documentGrandTotal } from './document.model';
import { createSalesOrderFromQuotation, getBulkPrintArtifact, getDocument, listDocuments } from './documents.api';

const CTX = { companyId: 'company-1', branchId: 'branch-1' };
const KEY = '019a0000-0000-7000-8000-000000000099';

describe('documents follow the existing backend', () => {
  let http: TradeHttpStub;
  let restore: () => void;

  beforeEach(() => {
    http = new TradeHttpStub();
    restore = bindTradeHttpForTest(http);
  });

  afterEach(() => restore());

  it('keeps purchase quotation totals in the server snapshot and delegates sorting to the backend', async () => {
    const row = {
      id: 'pq-1', lifecycleStatus: 'DRAFT', reference: 'Supplier quotation',
      totalsSnapshot: { grandTotal: '250.50' },
    };
    http.register('GET', '/purchase-quotations', { items: [row], total: 1, page: 1, limit: 50 });
    const page = await listDocuments('purchase-quotation', { page: 1, limit: 50, sort: 'grandTotal', order: 'asc' }, CTX);
    expect(page.items).toEqual([row]);
    for (const item of page.items) {
      expect(item).not.toHaveProperty('grandTotal');
      expect(item).not.toHaveProperty('draftReference');
      expect(item).not.toHaveProperty('contactPartyId');
      expect(item).not.toHaveProperty('extensionValues');
      expect(documentGrandTotal(item)).toBe('250.50');
    }
    expect(http.recordedReads()).toEqual([{
      path: '/purchase-quotations', scope: CTX,
      query: { page: 1, limit: 50, sort: 'grandTotal', order: 'asc' },
    }]);
  });

  it.each(['sales-order', 'purchase-quotation'] as const)('preserves the backend itemCompanyProfileId for %s', async (kind) => {
    const segment = kind === 'sales-order' ? 'sales-orders' : 'purchase-quotations';
    http.register('GET', `/${segment}/document-1`, {
      id: 'document-1', lines: [{ itemCompanyProfileId: 'profile-1', itemId: 'item-1' }],
    });
    const detail = await getDocument(kind, 'document-1', CTX);
    expect(detail.lines).toEqual([expect.objectContaining({ itemCompanyProfileId: 'profile-1', itemId: 'item-1' })]);
  });

  it('uses the direct conversion receipt and sends only the strict DTO fields', async () => {
    http.register('POST', '/quotations/quote-1/create-sales-order', {
      id: 'order-from-receipt', version: 1, sourceQuotationId: 'quote-1', lines: [],
    });
    const result = await createSalesOrderFromQuotation('quote-1', 3, { draftReference: '  Customer PO  ' }, KEY, CTX);
    expect(result.id).toBe('order-from-receipt');
    expect(result.sourceQuotationId).toBe('quote-1');
    expect(http.recordedWrites()).toEqual([{
      method: 'POST', path: '/quotations/quote-1/create-sales-order', body: { draftReference: 'Customer PO' },
      key: KEY, ifMatch: '"3"', scope: CTX, query: undefined,
    }]);
    expect(http.recordedReads()).toEqual([]);
  });

  it('treats every 503 PDF code as retryable inline', () => {
    expect(isRenderUnavailable('TRADE.QUOTE.PDF_RENDER_UNAVAILABLE')).toBe(true);
    expect(isRenderUnavailable('TRADE.BUSINESS_DOCUMENT.PDF_BUNDLE_UNAVAILABLE')).toBe(true);
    expect(isRenderUnavailable('TRADE.BUSINESS_DOCUMENT.PDF_ARTIFACT_UNAVAILABLE')).toBe(true);
    expect(isRenderUnavailable('TRADE.BUSINESS_DOCUMENT.PDF_SOURCE_NOT_ELIGIBLE')).toBe(false);
  });

  it('propagates the backend 404 for a missing bulk print artifact', async () => {
    http.register('GET', '/documents/bulk-prints/job-without-artifact/artifact', new ApiError(404, 'BULK_JOB_NOT_FOUND'));
    await expect(getBulkPrintArtifact('job-without-artifact', CTX)).rejects.toMatchObject({
      status: 404, code: 'BULK_JOB_NOT_FOUND',
    });
  });
});
