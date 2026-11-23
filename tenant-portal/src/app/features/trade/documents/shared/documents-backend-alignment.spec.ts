import { describe, expect, it } from 'vitest';
import { getBulkPrintArtifact } from './documents-bulk.fake-module';
import { isRenderUnavailable } from '../document-print/print-dialog/print-dialog';
import { documentGrandTotal, type PurchaseQuotation } from './document.model';
import { fakeCreateSalesOrderFromQuotation, fakeGetDocument, fakeListDocuments } from './documents.fake';

describe('documents follow the existing backend', () => {
  it('lists purchase quotations as the backend entity: no grandTotal, draftReference, contactPartyId or extensionValues', async () => {
    const page = await fakeListDocuments('purchase-quotation', { page: 1, limit: 50 });
    expect(page.items.length).toBeGreaterThan(0);
    for (const row of page.items) {
      expect(row).not.toHaveProperty('grandTotal');
      expect(row).not.toHaveProperty('draftReference');
      expect(row).not.toHaveProperty('contactPartyId');
      expect(row).not.toHaveProperty('extensionValues');
      expect(documentGrandTotal(row)).toBe(row.totalsSnapshot?.grandTotal ?? null);
    }
  });

  it('sorts purchase quotations by the snapshot total, as the backend does', async () => {
    const page = await fakeListDocuments('purchase-quotation', { page: 1, limit: 50, sort: 'grandTotal', order: 'asc' });
    const totals = page.items.map((row: PurchaseQuotation) => Number(documentGrandTotal(row)));
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
  });

  it('returns itemCompanyProfileId on order and purchase quotation lines', async () => {
    const orders = await fakeListDocuments('sales-order', { page: 1, limit: 1 });
    const order = await fakeGetDocument('sales-order', orders.items[0].id);
    expect(order.lines.every((line) => typeof line.itemCompanyProfileId === 'string')).toBe(true);

    const quotes = await fakeListDocuments('purchase-quotation', { page: 1, limit: 1 });
    const quote = await fakeGetDocument('purchase-quotation', quotes.items[0].id);
    expect(quote.lines.every((line) => line.itemCompanyProfileId && line.itemId)).toBe(true);
  });

  it('rejects requestedDeadline on direct sales order creation (strict DTO)', async () => {
    const quotes = await fakeListDocuments('quotation', { page: 1, limit: 50, status: 'ACCEPTED' });
    const accepted = quotes.items[0];
    expect(accepted).toBeDefined();
    await expect(
      fakeCreateSalesOrderFromQuotation(accepted.id, accepted.version, { requestedDeadline: '2026-12-01T14:00:00Z' } as never),
    ).rejects.toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });
  });

  it('treats every 503 PDF code as retryable inline', () => {
    expect(isRenderUnavailable('TRADE.QUOTE.PDF_RENDER_UNAVAILABLE')).toBe(true);
    expect(isRenderUnavailable('TRADE.BUSINESS_DOCUMENT.PDF_BUNDLE_UNAVAILABLE')).toBe(true);
    expect(isRenderUnavailable('TRADE.BUSINESS_DOCUMENT.PDF_ARTIFACT_UNAVAILABLE')).toBe(true);
    expect(isRenderUnavailable('TRADE.BUSINESS_DOCUMENT.PDF_SOURCE_NOT_ELIGIBLE')).toBe(false);
  });

  it('fails a bulk print download for a job that does not exist (404 BULK_JOB_NOT_FOUND)', async () => {
    await expect(getBulkPrintArtifact('job-without-artifact')).rejects.toMatchObject({
      status: 404,
      code: 'BULK_JOB_NOT_FOUND',
    });
  });
});
