import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FAKE_BULK,
  fakeGetBulkJob,
  fakeListBulkJobItems,
  fakeSubmitBulkJob,
  resetBulkJobsFake,
} from '../../../../shared/bulk-jobs/bulk-jobs.fake';
import { type BulkJob, type BulkJobItem, type BulkJobSubmit, isBulkJobActive } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { newIdempotencyKey } from '../../shared/trade-api';
import { openBulkPrintArtifact } from '../document-bulk/documents-bulk.descriptor';
import type { DocumentKind } from './document.model';
import { DocumentSelection } from './document-selection';
import { FAKE_DOCUMENTS_BULK_PRINT, getBulkPrintArtifact } from './documents-bulk.fake-module';
import { fakeListDocuments } from './documents.fake';

const SEGMENT: Record<DocumentKind, string> = {
  quotation: 'quotations',
  'sales-order': 'sales-orders',
  'purchase-order': 'purchase-orders',
  'purchase-quotation': 'purchase-quotations',
};

function body(kind: DocumentKind, action: string, ids: string[], params: unknown = {}): BulkJobSubmit {
  return {
    module: `trading.${SEGMENT[kind]}`,
    action,
    scope: { companyId: 'c1', branchId: 'b1' },
    selection: { kind: 'IDS', ids },
    params,
  };
}

async function idsOf(kind: DocumentKind, status: string, count = 2): Promise<{ id: string; documentNumber: string | null }[]> {
  const page = await fakeListDocuments(kind, { page: 1, limit: 50, status });
  expect(page.items.length).toBeGreaterThanOrEqual(count);
  return page.items.slice(0, count).map((row) => ({ id: row.id, documentNumber: row.documentNumber }));
}

async function run(submit: BulkJobSubmit): Promise<{ job: BulkJob; items: BulkJobItem[] }> {
  const res = await fakeSubmitBulkJob('trading', submit, newIdempotencyKey());
  let job = await fakeGetBulkJob('trading', res.jobId);
  while (isBulkJobActive(job.status)) job = await fakeGetBulkJob('trading', res.jobId);
  const page = await fakeListBulkJobItems('trading', res.jobId, { page: 1, limit: 100 });
  return { job, items: page.items };
}

describe('documents bulk fake follows the trade-app document bulk handlers', () => {
  const chunkMs = FAKE_BULK.chunkMs;
  beforeEach(() => {
    resetBulkJobsFake();
    FAKE_BULK.chunkMs = 0;
  });
  afterEach(() => {
    FAKE_BULK.chunkMs = chunkMs;
    Object.assign(FAKE_DOCUMENTS_BULK_PRINT, { pdfBytes: 48 * 1024, renderFailures: 0, renderFailureCode: null });
  });

  it('rejects params outside the strict schemas with 400 BULK_JOB_PARAMS_INVALID', async () => {
    const [doc] = await idsOf('quotation', 'SENT', 1);
    const invalid = [
      body('quotation', 'SEND', [doc.id], { note: 'x' }),
      body('quotation', 'CANCEL', [doc.id], { reasonCode: 'OTHER', reasonNote: null }),
      body('quotation', 'CANCEL', [doc.id], { reasonCode: 'OTHER', evidenceRef: 'x' }),
      body('quotation', 'PRINT', [doc.id], { templateChoice: 'CUSTOM' }),
      body('quotation', 'PRINT', [doc.id], { locale: 'english language' }),
      body('quotation', 'PRINT', [doc.id], null),
    ];
    for (const submit of invalid) {
      await expect(fakeSubmitBulkJob('trading', submit, newIdempotencyKey())).rejects.toMatchObject({
        status: 400,
        code: 'BULK_JOB_PARAMS_INVALID',
        details: { codes: ['custom'] },
      });
    }
  }, 20_000);

  it('rejects a QUERY selection with page or limit, and a status the module does not have', async () => {
    const query = (q: unknown): BulkJobSubmit => ({
      ...body('quotation', 'SEND', []),
      selection: { kind: 'QUERY', query: q, excludedIds: [] },
    });
    for (const q of [{ page: 1, limit: 25 }, { view: 'cards' }, { sort: 'partyName' }, { businessDateFrom: '2026-02-31' }]) {
      await expect(fakeSubmitBulkJob('trading', query(q), newIdempotencyKey())).rejects.toMatchObject({
        status: 400,
        code: 'BULK_JOB_PARAMS_INVALID',
      });
    }
    await expect(fakeSubmitBulkJob('trading', query({ status: 'ISSUED' }), newIdempotencyKey())).rejects.toMatchObject({
      status: 400,
      code: 'BULK_JOB_PARAMS_INVALID',
    });
  }, 20_000);

  it('rejects an action the handler does not register and a submit without a branch', async () => {
    const [doc] = await idsOf('quotation', 'SENT', 1);
    await expect(fakeSubmitBulkJob('trading', body('quotation', 'HOLD', [doc.id]), newIdempotencyKey())).rejects.toMatchObject({
      status: 400,
      code: 'BULK_JOB_MODULE_UNKNOWN',
    });
    const noBranch = { ...body('quotation', 'SEND', [doc.id]), scope: { companyId: 'c1' } };
    await expect(fakeSubmitBulkJob('trading', noBranch, newIdempotencyKey())).rejects.toMatchObject({
      status: 400,
      code: 'BULK_JOB_PARAMS_INVALID',
      details: { path: ['scope'] },
    });
  });

  it('checks the template choice after resolving, as prepare does', async () => {
    const [order] = await idsOf('sales-order', 'CONFIRMED', 1);
    await expect(
      fakeSubmitBulkJob('trading', body('sales-order', 'PRINT', [order.id], { templateChoice: 'BUILT_IN' }), newIdempotencyKey()),
    ).rejects.toMatchObject({
      status: 422,
      code: 'TRADE.BUSINESS_DOCUMENT.PDF_TEMPLATE_INCOMPATIBLE',
      details: { reason: ['template_choice_invalid'] },
    });
    const [quote] = await idsOf('quotation', 'SENT', 1);
    await expect(
      fakeSubmitBulkJob('trading', body('quotation', 'PRINT', [quote.id], { templateVersionId: 'tplv-missing' }), newIdempotencyKey()),
    ).rejects.toMatchObject({ status: 422, code: 'TRADE.QUOTE.PDF_TEMPLATE_INCOMPATIBLE' });
  }, 20_000);

  it('labels items with the document number and keeps every string param in the summary', async () => {
    const [order] = await idsOf('sales-order', 'CONFIRMED', 1);
    const { job, items } = await run(
      body('sales-order', 'HOLD', [order.id, 'missing-order'], { reasonCode: 'CREDIT_REVIEW', reasonNote: 'Overdue invoices' }),
    );
    expect(job.paramsSummary).toMatchObject({ reasonCode: 'CREDIT_REVIEW', reasonNote: 'Overdue invoices' });
    expect(items[0]).toMatchObject({ label: order.documentNumber ?? order.id, status: 'SUCCEEDED' });
    expect(items[1]).toMatchObject({ label: 'missing-order', status: 'FAILED', code: 'TRADE.SALES_ORDER.SOURCE_NOT_FOUND' });
  }, 20_000);

  it('skips state-transition refusals and keeps other failures failed', async () => {
    const [order] = await idsOf('sales-order', 'CONFIRMED', 1);
    await run(body('sales-order', 'CANCEL', [order.id], { reasonCode: 'CUSTOMER_REQUEST' }));
    const { job, items } = await run(body('sales-order', 'CANCEL', [order.id], { reasonCode: 'CUSTOMER_REQUEST' }));
    expect(items[0]).toMatchObject({ status: 'SKIPPED', code: 'TRADE.SALES_ORDER.CANCEL_NOT_ALLOWED' });
    expect(job.status).toBe('COMPLETED');
  }, 20_000);

  it('skips a purchase order SUBMIT whose state is not submittable', async () => {
    const [po] = await idsOf('purchase-order', 'CONFIRMED', 1);
    const { items } = await run(body('purchase-order', 'SUBMIT', [po.id]));
    expect(items[0]).toMatchObject({ status: 'SKIPPED', code: 'TRADE.PURCHASE_ORDER.APPROVAL_INVALID' });
  }, 20_000);

  it('completes PRINT items from the worker reply with the render job id or its failure code', async () => {
    const docs = await idsOf('quotation', 'SENT', 2);
    FAKE_DOCUMENTS_BULK_PRINT.renderFailures = 1;
    const { job, items } = await run(body('quotation', 'PRINT', docs.map((d) => d.id), { locale: 'ar-EG' }));
    expect(items[0]).toMatchObject({ status: 'FAILED', code: 'TRADE.BUSINESS_DOCUMENT.PDF_RENDER_FAILED' });
    expect(items[0].refId).toEqual(expect.any(String));
    expect(items[1]).toMatchObject({ status: 'SUCCEEDED', refId: expect.any(String) });
    expect(job.status).toBe('COMPLETED_WITH_ERRORS');
  }, 20_000);

  it('serves the ZIP only for a finished documents PRINT job with PDFs under 25 MiB', async () => {
    const docs = await idsOf('quotation', 'SENT', 2);

    const sendJob = await run(body('quotation', 'CANCEL', [docs[0].id], { reasonCode: 'OTHER', reasonNote: 'Test' }));
    await expect(getBulkPrintArtifact(sendJob.job.id)).rejects.toMatchObject({ status: 404, code: 'BULK_JOB_NOT_FOUND' });
    await expect(getBulkPrintArtifact('no-such-job')).rejects.toMatchObject({ status: 404, code: 'BULK_JOB_NOT_FOUND' });

    const printable = await idsOf('quotation', 'ACCEPTED', 1);
    FAKE_DOCUMENTS_BULK_PRINT.renderFailures = 1;
    const empty = await run(body('quotation', 'PRINT', [printable[0].id]));
    await expect(getBulkPrintArtifact(empty.job.id)).rejects.toMatchObject({
      status: 409,
      code: 'TRADE.BULK_JOB.ARTIFACT_NOT_READY',
    });

    FAKE_DOCUMENTS_BULK_PRINT.pdfBytes = 26 * 1024 * 1024;
    const tooLarge = await run(body('quotation', 'PRINT', [printable[0].id]));
    await expect(getBulkPrintArtifact(tooLarge.job.id)).rejects.toMatchObject({
      status: 409,
      code: 'TRADE.BULK_JOB.ARTIFACT_NOT_READY',
    });

    // Not ready is an expected state in the UI: a message, not a failure.
    await expect(openBulkPrintArtifact(tooLarge.job.id)).resolves.toEqual({
      ready: false,
      messageKey: 'td.errors.TRADE.BULK_JOB.ARTIFACT_NOT_READY',
    });

    FAKE_DOCUMENTS_BULK_PRINT.pdfBytes = 48 * 1024;
    const ok = await run(body('quotation', 'PRINT', [printable[0].id]));
    const before = Date.now();
    const artifact = await getBulkPrintArtifact(ok.job.id);
    expect(artifact.downloadUrl).toMatch(/^data:application\/zip/);
    const ttl = Date.parse(artifact.downloadExpiresAt) - before;
    expect(ttl).toBeGreaterThan(290_000);
    expect(ttl).toBeLessThanOrEqual(301_000);
  }, 30_000);
});

describe('document selection sends the bulk query schema', () => {
  it('drops page, limit and empty filters from a select-all QUERY', () => {
    const selection = new DocumentSelection();
    selection.selectAll();
    selection.toggle('q-1');
    expect(
      selection.toSelection({ page: 3, limit: 25, status: 'SENT', search: '', sort: 'businessDate', order: 'desc' }),
    ).toEqual({
      kind: 'QUERY',
      query: { status: 'SENT', sort: 'businessDate', order: 'desc' },
      excludedIds: ['q-1'],
    });
  });
});
