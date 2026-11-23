import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../shared/trade-api';
import { TRADE_FAKE_DB } from '../../shared/trade-foundation.fake';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeFoundationFixtures } from '../../shared/testing/trade-foundation-fixtures';
import { KIND_CONFIG } from './document-kinds';
import { TERMS_NOTES_MAX_LENGTH, type DocumentKind, type TermsSnapshot } from './document.model';
import {
  fakeCancelPurchaseQuotation,
  fakeConvertPurchaseQuotation,
  fakeConvertQuotation,
  fakeCreatePurchaseOrder,
  fakeCreatePurchaseOrderFromPurchaseQuotation,
  fakeCreatePurchaseQuotation,
  fakeCreateQuotation,
  fakeCreateQuotationRevision,
  fakeCreateSalesOrder,
  fakeDeleteDocument,
  fakeGetDocument,
  fakeGetOpportunity,
  fakeIssuePurchaseQuotation,
  fakeListDocuments,
  fakeListReceivingNodes,
  fakePreviewOrderPricing,
  fakeQuotationAction,
  fakeRenderPdf,
  fakeReplaceOrderLines,
  fakeSalesOrderAction,
  fakeSetPrintDefaultAssignment,
  fakeUpdatePurchaseOrder,
  fakeUpdatePurchaseQuotation,
  fakeUpdateSalesOrder,
  validateDiscountReason,
} from './documents.fake';

let disposeFoundationFixtures: () => void;
beforeEach(() => {
  disposeFoundationFixtures = bindTradeHttpForTest(new TradeFoundationFixtures());
});
afterEach(() => disposeFoundationFixtures());

async function resolveFake<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(2000);
  return promise;
}

describe('documents.fake P7 delta', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem('lang');
    document.documentElement.lang = 'en';
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem('lang');
  });

  it('seeds a CLOSED sales order that can be printed but cannot be placed on hold', async () => {
    const page = await resolveFake(fakeListDocuments('sales-order', { page: 1, limit: 50 }));
    const closed = page.items.find((row) => row.lifecycleStatus === 'CLOSED');
    expect(closed).toBeDefined();

    const detail = await resolveFake(fakeGetDocument('sales-order', closed!.id));
    expect(detail.lifecycleStatus).toBe('CLOSED');

    const job = await resolveFake(
      fakeRenderPdf('sales-order', closed!.id, {
        purpose: KIND_CONFIG['sales-order'].printPurpose,
        templateVersionId: 'tpl-so-default',
        sourceVersion: detail.version,
      }),
    );
    expect(job.renderJobId).toBeTruthy();

    const holdErr = expect(
      fakeSalesOrderAction(closed!.id, detail.version, 'hold', { reasonCode: 'CREDIT_REVIEW' }),
    ).rejects.toMatchObject({ status: 409, code: 'TRADE.SALES_ORDER.HOLD_TRANSITION_INVALID' });
    await vi.advanceTimersByTimeAsync(350);
    await holdErr;
  });

  it('omits sourceCrmOpportunity from quotation details and resolves opportunities via fakeGetOpportunity', async () => {
    const detail = await resolveFake(fakeGetDocument('quotation', 'qt-01'));
    expect(detail.sourceCrmOpportunityId).toBe('opp-01-1');
    expect('sourceCrmOpportunity' in detail).toBe(false);

    const resolved = await resolveFake(fakeGetOpportunity('opp-01-1'));
    expect(resolved).not.toBeNull();
    expect(resolved!.id).toBe('opp-01-1');
    expect(resolved!.name.length).toBeGreaterThan(0);

    const missing = await resolveFake(fakeGetOpportunity('opp-does-not-exist'));
    expect(missing).toBeNull();
  });

  it('rejects cancelling a DRAFT purchase quotation and rejects deleting a DRAFT PO created from a PQ with 409', async () => {
    const nodes = await resolveFake(fakeListReceivingNodes());
    const pq = await resolveFake(
      fakeCreatePurchaseQuotation({
        supplierPartyId: 'pty-gulfsteel',
        currencyCode: 'EGP',
        validUntil: '2026-12-31',
        lines: [
          {
            clientLineId: 'cl-fake-pq-1',
            itemId: 'item-49',
            uomId: 'uom-pcs',
            quantity: '2',
          },
        ],
      }),
    );
    expect(pq.lifecycleStatus).toBe('DRAFT');

    const cancelDraftErr = expect(
      fakeCancelPurchaseQuotation(pq.id, pq.version, { reasonCode: 'SUPPLIER_CHANGED' }),
    ).rejects.toMatchObject({ status: 409, code: 'TRADE.PURCHASE_QUOTATION.CANCEL_NOT_ALLOWED' });
    await vi.advanceTimersByTimeAsync(350);
    await cancelDraftErr;

    const issued = await resolveFake(fakeIssuePurchaseQuotation(pq.id, pq.version));
    expect(issued.lifecycleStatus).toBe('ISSUED');

    const po = await resolveFake(
      fakeCreatePurchaseOrderFromPurchaseQuotation(issued.id, issued.version, {
        receivingNodeId: nodes[0].id,
      }),
    );
    expect(po.lifecycleStatus).toBe('DRAFT');
    expect(po.sourcePurchaseQuotationId).toBe(issued.id);

    const deleteErr = expect(
      fakeDeleteDocument('purchase-order', po.id, po.version),
    ).rejects.toBeInstanceOf(ApiError);
    const deleteCodeErr = expect(
      fakeDeleteDocument('purchase-order', po.id, po.version),
    ).rejects.toMatchObject({ status: 409, code: 'TRADE.DOCUMENT.DELETE_NOT_ALLOWED' });
    await vi.advanceTimersByTimeAsync(350);
    await deleteErr;
    await deleteCodeErr;
  });
});

async function settleFake<T>(promise: Promise<T>): Promise<T> {
  let settled = false;
  const tracked = promise.then(
    (val) => {
      settled = true;
      return val;
    },
    (err) => {
      settled = true;
      throw err;
    },
  );
  tracked.catch(() => {});
  for (let i = 0; i < 20 && !settled; i += 1) {
    await vi.advanceTimersByTimeAsync(350);
  }
  return tracked;
}

async function expectNotes422(promise: Promise<unknown>): Promise<void> {
  let caught: unknown = null;
  try {
    await settleFake(promise);
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(ApiError);
  expect(caught).toMatchObject({
    status: 400,
    code: 'TRADE.VALIDATION_FAILED',
    details: {
      message: [{ property: 'notes', constraints: { maxLength: 'TRADE.TERMS.NOTE_TOO_LONG' } }],
    },
  });
}

function snapshotNotes(snapshot: TermsSnapshot | null | undefined): string | undefined {
  if (!snapshot || typeof snapshot !== 'object') return undefined;
  const raw = (snapshot as Record<string, unknown>)['notes'];
  return typeof raw === 'string' ? raw : undefined;
}

function assertSnapshotNotesWithinLimit(snapshot: TermsSnapshot | null | undefined): void {
  if (!snapshot || typeof snapshot !== 'object') return;
  const rec = snapshot as Record<string, unknown>;
  if (typeof rec['notes'] === 'string') {
    expect(rec['notes'].length).toBeLessThanOrEqual(TERMS_NOTES_MAX_LENGTH);
  }
  const localized = rec['localized'];
  if (localized && typeof localized === 'object') {
    for (const localeKey of ['en', 'ar'] as const) {
      const loc = (localized as Record<string, unknown>)[localeKey];
      if (loc && typeof loc === 'object') {
        const locNotes = (loc as Record<string, unknown>)['notes'];
        if (typeof locNotes === 'string') {
          expect(locNotes.length).toBeLessThanOrEqual(TERMS_NOTES_MAX_LENGTH);
        }
      }
    }
  }
}

describe('documents.fake P8 terms notes ≤ 800', () => {
  const NOTE_800 = 'n'.repeat(TERMS_NOTES_MAX_LENGTH);
  const NOTE_801 = 'n'.repeat(TERMS_NOTES_MAX_LENGTH + 1);
  const SALES_TERMS = {
    paymentTermId: 'term-c1-payment-net30',
    clauseIds: [] as string[],
  };
  const PURCHASE_TERMS = {
    paymentTermId: 'term-c1-payment-sup60',
    clauseIds: [] as string[],
  };

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem('lang');
    document.documentElement.lang = 'en';
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem('lang');
  });

  it('keeps every fake seed terms and document note within 800 characters', async () => {
    expect(TERMS_NOTES_MAX_LENGTH).toBe(800);
    const kinds: readonly DocumentKind[] = ['quotation', 'sales-order', 'purchase-order', 'purchase-quotation'];

    for (const kind of kinds) {
      const page = await settleFake(fakeListDocuments(kind, { page: 1, limit: 100 }));
      expect(page.total).toBeLessThanOrEqual(page.limit);
      const details = await settleFake(Promise.all(page.items.map((item) => fakeGetDocument(kind, item.id))));
      for (const detail of details) {
        if ('revisions' in detail) {
          for (const rev of detail.revisions) {
            assertSnapshotNotesWithinLimit(rev.termsSnapshot);
          }
        }
        if ('termsSnapshot' in detail) {
          assertSnapshotNotesWithinLimit(detail.termsSnapshot);
        }
        if ('notes' in detail && typeof detail.notes === 'string') {
          expect(detail.notes.length).toBeLessThanOrEqual(TERMS_NOTES_MAX_LENGTH);
        }
      }
    }
  });

  it('rejects 801-character terms notes with 422 and accepts 800 on quotation revisions', async () => {
    const qt = await settleFake(fakeCreateQuotation({ partyId: 'pty-alnoor', currencyCode: 'EGP' }));
    const revBase = {
      validUntil: '2099-12-31',
      lines: [{ clientLineId: 'cl-qt-p8', itemId: 'item-49', uomId: 'uom-pcs', quantity: '1' }],
      pricing: { mode: 'NONE' as const },
      termSelections: SALES_TERMS,
    };

    await expectNotes422(fakeCreateQuotationRevision(qt.id, qt.version, { ...revBase, notes: NOTE_801 }));

    const createdRev = await settleFake(
      fakeCreateQuotationRevision(qt.id, qt.version, { ...revBase, notes: NOTE_800 }),
    );
    expect(snapshotNotes(createdRev.termsSnapshot)).toBe(NOTE_800);
  });

  it('rejects 801-character terms notes with 422 and accepts 800 on sales order create, update, PUT-lines and quotation convert', async () => {
    const preview = await settleFake(
      fakePreviewOrderPricing('sales-order', {
        partyId: 'pty-alnoor',
        currencyCode: 'EGP',
        lines: [{ clientLineId: 'cl-so-p8', itemId: 'item-49', uomId: 'uom-pcs', quantity: '1' }],
      }),
    );
    const soLines = [
      {
        clientLineId: 'cl-so-p8',
        itemId: 'item-49',
        uomId: 'uom-pcs',
        quantity: '1',
        unitPrice: preview.lines[0].unitPrice,
        financial: preview.lines[0].financial,
      },
    ];

    await expectNotes422(
      fakeCreateSalesOrder({
        partyId: 'pty-alnoor',
        currencyCode: 'EGP',
        lines: soLines,
        totals: preview.totals,
        expectedPricingFingerprint: preview.fingerprint,
        termSelections: SALES_TERMS,
        notes: NOTE_801,
      }),
    );

    const so = await settleFake(
      fakeCreateSalesOrder({
        partyId: 'pty-alnoor',
        currencyCode: 'EGP',
        lines: soLines,
        totals: preview.totals,
        expectedPricingFingerprint: preview.fingerprint,
        termSelections: SALES_TERMS,
        notes: NOTE_800,
      }),
    );
    expect(snapshotNotes(so.termsSnapshot)).toBe(NOTE_800);

    await expectNotes422(fakeUpdateSalesOrder(so.id, so.version, { termSelections: SALES_TERMS, notes: NOTE_801 }));
    const so2 = await settleFake(
      fakeUpdateSalesOrder(so.id, so.version, { termSelections: SALES_TERMS, notes: NOTE_800 }),
    );
    expect(snapshotNotes(so2.termsSnapshot)).toBe(NOTE_800);

    await expectNotes422(
      fakeReplaceOrderLines('sales-order', so2.id, so2.version, {
        lines: soLines,
        totals: preview.totals,
        expectedPricingFingerprint: preview.fingerprint,
        termSelections: SALES_TERMS,
        notes: NOTE_801,
      }),
    );
    const so3 = await settleFake(
      fakeReplaceOrderLines('sales-order', so2.id, so2.version, {
        lines: soLines,
        totals: preview.totals,
        expectedPricingFingerprint: preview.fingerprint,
        termSelections: SALES_TERMS,
        notes: NOTE_800,
      }),
    );
    expect(snapshotNotes(so3.termsSnapshot)).toBe(NOTE_800);

    const qt = await settleFake(fakeCreateQuotation({ partyId: 'pty-alnoor', currencyCode: 'EGP' }));
    const rev = await settleFake(
      fakeCreateQuotationRevision(qt.id, qt.version, {
        validUntil: '2099-12-31',
        lines: [{ clientLineId: 'cl-qconv-p8', itemId: 'item-49', uomId: 'uom-pcs', quantity: '1' }],
        pricing: { mode: 'NONE' },
        termSelections: SALES_TERMS,
        notes: NOTE_800,
      }),
    );
    const sent = await settleFake(fakeQuotationAction(qt.id, rev.quotation.version, 'send'));
    const accepted = await settleFake(fakeQuotationAction(qt.id, sent.version, 'accept'));
    const convPreview = await settleFake(
      fakePreviewOrderPricing('sales-order', {
        partyId: 'pty-alnoor',
        currencyCode: 'EGP',
        sourceQuotationId: accepted.id,
        lines: [
          {
            clientLineId: 'cl-qconv-p8',
            itemId: 'item-49',
            uomId: 'uom-pcs',
            quantity: '1',
            unitPrice: accepted.currentLines[0].unitPrice,
            discountTotal: accepted.currentLines[0].discountTotal,
            chargeTotal: '0',
          },
        ],
      }),
    );
    const convLines = [{ clientLineId: 'cl-qconv-p8', financial: convPreview.lines[0].financial }];

    await expectNotes422(
      fakeConvertQuotation(accepted.id, accepted.version, {
        lines: convLines,
        totals: convPreview.totals,
        notes: NOTE_801,
      }),
    );
    await expectNotes422(
      fakeConvertQuotation(accepted.id, accepted.version, {
        lines: convLines,
        totals: convPreview.totals,
        termSelections: SALES_TERMS,
        notes: NOTE_801,
      }),
    );

    const convertedSo = await settleFake(
      fakeConvertQuotation(accepted.id, accepted.version, {
        lines: convLines,
        totals: convPreview.totals,
        termSelections: SALES_TERMS,
        notes: NOTE_800,
      }),
    );
    expect(snapshotNotes(convertedSo.termsSnapshot)).toBe(NOTE_800);
  });

  it('rejects 801-character terms notes with 422 and accepts 800 on purchase order and purchase quotation endpoints', async () => {
    const poPreview = await settleFake(
      fakePreviewOrderPricing('purchase-order', {
        partyId: 'pty-gulfsteel',
        currencyCode: 'EGP',
        lines: [{ clientLineId: 'cl-po-p8', itemId: 'item-49', uomId: 'uom-pcs', quantity: '1' }],
      }),
    );
    const poLines = [
      {
        clientLineId: 'cl-po-p8',
        itemId: 'item-49',
        uomId: 'uom-pcs',
        quantity: '1',
        unitPrice: poPreview.lines[0].unitPrice,
        financial: poPreview.lines[0].financial,
      },
    ];

    await expectNotes422(
      fakeCreatePurchaseOrder({
        supplierPartyId: 'pty-gulfsteel',
        supplierAccountId: 'sup-acc-gulf-egp',
        currencyCode: 'EGP',
        receivingNodeId: 'node-wh-01',
        lines: poLines,
        totals: poPreview.totals,
        expectedPricingFingerprint: poPreview.fingerprint,
        termSelections: PURCHASE_TERMS,
        notes: NOTE_801,
      }),
    );

    const po = await settleFake(
      fakeCreatePurchaseOrder({
        supplierPartyId: 'pty-gulfsteel',
        supplierAccountId: 'sup-acc-gulf-egp',
        currencyCode: 'EGP',
        receivingNodeId: 'node-wh-01',
        lines: poLines,
        totals: poPreview.totals,
        expectedPricingFingerprint: poPreview.fingerprint,
        termSelections: PURCHASE_TERMS,
        notes: NOTE_800,
      }),
    );
    expect(snapshotNotes(po.termsSnapshot)).toBe(NOTE_800);

    await expectNotes422(fakeUpdatePurchaseOrder(po.id, po.version, { termSelections: PURCHASE_TERMS, notes: NOTE_801 }));
    const po2 = await settleFake(
      fakeUpdatePurchaseOrder(po.id, po.version, { termSelections: PURCHASE_TERMS, notes: NOTE_800 }),
    );
    expect(snapshotNotes(po2.termsSnapshot)).toBe(NOTE_800);

    await expectNotes422(
      fakeReplaceOrderLines('purchase-order', po2.id, po2.version, {
        lines: poLines,
        totals: poPreview.totals,
        expectedPricingFingerprint: poPreview.fingerprint,
        termSelections: PURCHASE_TERMS,
        notes: NOTE_801,
      }),
    );
    const po3 = await settleFake(
      fakeReplaceOrderLines('purchase-order', po2.id, po2.version, {
        lines: poLines,
        totals: poPreview.totals,
        expectedPricingFingerprint: poPreview.fingerprint,
        termSelections: PURCHASE_TERMS,
        notes: NOTE_800,
      }),
    );
    expect(snapshotNotes(po3.termsSnapshot)).toBe(NOTE_800);

    await expectNotes422(
      fakeCreatePurchaseQuotation({
        supplierPartyId: 'pty-gulfsteel',
        currencyCode: 'EGP',
        validUntil: '2099-12-31',
        lines: [{ clientLineId: 'cl-pq-p8', itemId: 'item-49', uomId: 'uom-pcs', quantity: '1' }],
        termSelections: PURCHASE_TERMS,
        notes: NOTE_801,
      }),
    );

    const pq = await settleFake(
      fakeCreatePurchaseQuotation({
        supplierPartyId: 'pty-gulfsteel',
        currencyCode: 'EGP',
        validUntil: '2099-12-31',
        lines: [{ clientLineId: 'cl-pq-p8', itemId: 'item-49', uomId: 'uom-pcs', quantity: '1' }],
        termSelections: PURCHASE_TERMS,
        notes: NOTE_800,
      }),
    );
    expect(pq.notes).toBe(NOTE_800);
    expect(snapshotNotes(pq.termsSnapshot)).toBe(NOTE_800);

    await expectNotes422(
      fakeUpdatePurchaseQuotation(pq.id, pq.version, { termSelections: PURCHASE_TERMS, notes: NOTE_801 }),
    );
    const pq2 = await settleFake(
      fakeUpdatePurchaseQuotation(pq.id, pq.version, { termSelections: PURCHASE_TERMS, notes: NOTE_800 }),
    );
    expect(pq2.notes).toBe(NOTE_800);
    expect(snapshotNotes(pq2.termsSnapshot)).toBe(NOTE_800);

    const issuedPq = await settleFake(fakeIssuePurchaseQuotation(pq2.id, pq2.version));
    const pqConvPreview = await settleFake(
      fakePreviewOrderPricing('purchase-order', {
        partyId: 'pty-gulfsteel',
        currencyCode: 'EGP',
        sourcePurchaseQuotationId: issuedPq.id,
        lines: [{ clientLineId: 'cl-pq-p8', itemId: 'item-49', uomId: 'uom-pcs', quantity: '1' }],
      }),
    );
    const pqConvLines = [{ clientLineId: 'cl-pq-p8', financial: pqConvPreview.lines[0].financial }];

    await expectNotes422(
      fakeConvertPurchaseQuotation(issuedPq.id, issuedPq.version, {
        supplierAccountId: 'sup-acc-gulf-egp',
        receivingNodeId: 'node-wh-01',
        lines: pqConvLines,
        totals: pqConvPreview.totals,
        notes: NOTE_801,
      }),
    );
    await expectNotes422(
      fakeConvertPurchaseQuotation(issuedPq.id, issuedPq.version, {
        supplierAccountId: 'sup-acc-gulf-egp',
        receivingNodeId: 'node-wh-01',
        lines: pqConvLines,
        totals: pqConvPreview.totals,
        termSelections: PURCHASE_TERMS,
        notes: NOTE_801,
      }),
    );

    const convertedPo = await settleFake(
      fakeConvertPurchaseQuotation(issuedPq.id, issuedPq.version, {
        supplierAccountId: 'sup-acc-gulf-egp',
        receivingNodeId: 'node-wh-01',
        lines: pqConvLines,
        totals: pqConvPreview.totals,
        termSelections: PURCHASE_TERMS,
        notes: NOTE_800,
      }),
    );
    expect(snapshotNotes(convertedPo.termsSnapshot)).toBe(NOTE_800);
  });
});

describe('documents.fake discount reason (DOCUMENT_DISCOUNT, reasonCode + reasonNote)', () => {
  function errorOf(fn: () => void): ApiError | null {
    try {
      fn();
      return null;
    } catch (err) {
      return err as ApiError;
    }
  }

  it('accepts an active DOCUMENT_DISCOUNT code with no note', () => {
    expect(errorOf(() => validateDiscountReason({ reasonCode: 'LOYAL_CUSTOMER' }))).toBeNull();
  });

  it('keeps TRADE.QUOTE.DISCOUNT_REASON_REQUIRED for a missing reason when the policy requires one', () => {
    expect(errorOf(() => validateDiscountReason({}))).toMatchObject({
      status: 422,
      code: 'TRADE.QUOTE.DISCOUNT_REASON_REQUIRED',
    });
    expect(errorOf(() => validateDiscountReason({ reasonCode: '  ' }))?.code).toBe('TRADE.QUOTE.DISCOUNT_REASON_REQUIRED');
  });

  it('rejects free text or a reason id as 400 TRADE.VALIDATION_FAILED (code-body convention)', () => {
    expect(errorOf(() => validateDiscountReason({ reasonCode: 'VIP client' }))).toMatchObject({
      status: 400,
      code: 'TRADE.VALIDATION_FAILED',
    });
    expect(errorOf(() => validateDiscountReason({ reasonCode: 'rsn-document_discount-other' }))?.code).toBe(
      'TRADE.VALIDATION_FAILED',
    );
  });

  it('rejects a note longer than 500 as 400 TRADE.VALIDATION_FAILED', () => {
    const err = errorOf(() => validateDiscountReason({ reasonCode: 'LOYAL_CUSTOMER', reasonNote: 'x'.repeat(501) }));
    expect(err).toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });
    expect(errorOf(() => validateDiscountReason({ reasonCode: 'LOYAL_CUSTOMER', reasonNote: 'x'.repeat(500) }))).toBeNull();
  });

  it('applies the TRADE.REASON.* rules for kind DOCUMENT_DISCOUNT', () => {
    expect(errorOf(() => validateDiscountReason({ reasonCode: 'NO_SUCH_CODE' }))).toMatchObject({
      status: 422,
      code: 'TRADE.REASON.NOT_FOUND',
    });
    expect(errorOf(() => validateDiscountReason({ reasonCode: 'CREDIT_REVIEW' }))).toMatchObject({
      status: 422,
      code: 'TRADE.REASON.KIND_INVALID',
    });
    expect(errorOf(() => validateDiscountReason({ reasonCode: 'OTHER' }))).toMatchObject({
      status: 422,
      code: 'TRADE.REASON.NOTE_REQUIRED',
    });
    expect(errorOf(() => validateDiscountReason({ reasonCode: 'OTHER', reasonNote: 'Matched a competitor' }))).toBeNull();

    const row = TRADE_FAKE_DB.reasons.find((r) => r.kind === 'DOCUMENT_DISCOUNT' && r.code === 'VOLUME')!;
    row.isActive = false;
    try {
      expect(errorOf(() => validateDiscountReason({ reasonCode: 'VOLUME' }))).toMatchObject({
        status: 422,
        code: 'TRADE.REASON.INACTIVE',
      });
    } finally {
      row.isActive = true;
    }
  });
});

describe('documents.fake backend b-commands and f-print alignment', () => {
  const SALES_TERMS = {
    paymentTermId: 'term-c1-payment-net30',
    clauseIds: [] as string[],
  };

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem('lang');
    document.documentElement.lang = 'en';
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem('lang');
  });

  async function soLinesFor(ids: string[]) {
    const preview = await settleFake(
      fakePreviewOrderPricing('sales-order', {
        partyId: 'pty-alnoor',
        currencyCode: 'EGP',
        lines: ids.map((clientLineId) => ({ clientLineId, itemId: 'item-49', uomId: 'uom-pcs', quantity: '1' })),
      }),
    );
    return {
      preview,
      lines: ids.map((clientLineId, index) => ({
        clientLineId,
        itemId: 'item-49',
        uomId: 'uom-pcs',
        quantity: '1',
        unitPrice: preview.lines[index].unitPrice,
        financial: preview.lines[index].financial,
      })),
    };
  }

  it('replaces SO lines in place and refuses a removed clientLineId with 400 TRADE.VALIDATION_FAILED', async () => {
    const two = await soLinesFor(['cl-keep', 'cl-drop']);
    const so = await settleFake(
      fakeCreateSalesOrder({
        partyId: 'pty-alnoor',
        currencyCode: 'EGP',
        lines: two.lines,
        totals: two.preview.totals,
        expectedPricingFingerprint: two.preview.fingerprint,
        termSelections: SALES_TERMS,
      }),
    );
    const keptRowId = so.lines.find((line) => line.clientLineId === 'cl-keep')?.id;

    const one = await soLinesFor(['cl-keep']);
    const trimmed = await settleFake(
      fakeReplaceOrderLines('sales-order', so.id, so.version, {
        lines: one.lines,
        totals: one.preview.totals,
        expectedPricingFingerprint: one.preview.fingerprint,
      }),
    );
    expect(trimmed.version).toBe(so.version + 1);
    expect(trimmed.lines.map((line) => line.clientLineId)).toEqual(['cl-keep']);
    expect(trimmed.lines[0].id).toBe(keptRowId);

    const reused = await soLinesFor(['cl-keep', 'cl-drop']);
    await expect(
      settleFake(
        fakeReplaceOrderLines('sales-order', trimmed.id, trimmed.version, {
          lines: reused.lines,
          totals: reused.preview.totals,
          expectedPricingFingerprint: reused.preview.fingerprint,
        }),
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: 'TRADE.VALIDATION_FAILED',
      details: { lines: ['invalid_client_line_id'] },
    });

    const fresh = await soLinesFor(['cl-keep', 'cl-new']);
    const grown = await settleFake(
      fakeReplaceOrderLines('sales-order', trimmed.id, trimmed.version, {
        lines: fresh.lines,
        totals: fresh.preview.totals,
        expectedPricingFingerprint: fresh.preview.fingerprint,
      }),
    );
    expect(grown.lines.map((line) => line.clientLineId)).toEqual(['cl-keep', 'cl-new']);
  });

  it('returns reason history newest first with the backend action names', async () => {
    const page = await settleFake(fakeListDocuments('sales-order', { page: 1, limit: 50 }));
    const draft = page.items.find((row) => row.lifecycleStatus === 'DRAFT' && row.holdStatus === 'NONE');
    expect(draft).toBeDefined();
    const held = await settleFake(
      fakeSalesOrderAction(draft!.id, draft!.version, 'hold', { reasonCode: 'CREDIT_REVIEW', reasonNote: null }),
    );
    const released = await settleFake(
      fakeSalesOrderAction(held.id, held.version, 'release-hold', { reasonCode: 'ISSUE_RESOLVED', reasonNote: null }),
    );
    expect(released.reasonHistory.slice(0, 2).map((entry) => entry.action)).toEqual(['RELEASE_HOLD', 'HOLD']);

    const pos = await settleFake(fakeListDocuments('purchase-order', { page: 1, limit: 50 }));
    const rejected = pos.items.find((row) => row.approvalStatus === 'REJECTED');
    const rejectedDetail = await settleFake(fakeGetDocument('purchase-order', rejected!.id));
    expect(rejectedDetail.reasonHistory[0].action).toBe('PO_REJECT');
  });

  it('renders a sales order PDF with the default assignment when no template is chosen', async () => {
    const page = await settleFake(fakeListDocuments('sales-order', { page: 1, limit: 50 }));
    const closed = page.items.find((row) => row.lifecycleStatus === 'CLOSED');
    const detail = await settleFake(fakeGetDocument('sales-order', closed!.id));
    const job = await settleFake(
      fakeRenderPdf('sales-order', detail.id, {
        purpose: KIND_CONFIG['sales-order'].printPurpose,
        sourceVersion: detail.version,
      }),
    );
    expect(job.status).toBe('PENDING');
  });
});

describe('documents.fake print default assignment', () => {
  const PRINTABLE: Record<DocumentKind, string[]> = {
    quotation: ['SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED'],
    'sales-order': ['CONFIRMED', 'CLOSED'],
    'purchase-order': ['CONFIRMED', 'CLOSED'],
    'purchase-quotation': ['ISSUED'],
  };

  async function printable(kind: DocumentKind) {
    const page = await resolveFake(fakeListDocuments(kind, { page: 1, limit: 50 }));
    const row = page.items.find((item) => PRINTABLE[kind].includes(item.lifecycleStatus));
    expect(row).toBeDefined();
    return resolveFake(fakeGetDocument(kind, row!.id));
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const kind of Object.keys(KIND_CONFIG) as DocumentKind[]) fakeSetPrintDefaultAssignment(kind, true);
  });

  it.each(['sales-order', 'purchase-order', 'purchase-quotation'] as const)(
    'prints a %s with the default assignment when no template is chosen',
    async (kind) => {
      const doc = await printable(kind);
      const job = await fakeRenderPdf(
        kind,
        doc.id,
        { purpose: KIND_CONFIG[kind].printPurpose, sourceVersion: doc.version, locale: 'en-US' },
        { skipDelay: true },
      );
      expect(job.status).toBe('PENDING');
    },
  );

  it.each(['sales-order', 'purchase-order', 'purchase-quotation'] as const)(
    'returns the backend 422 for a %s without a default assignment, but still prints a chosen template',
    async (kind) => {
      fakeSetPrintDefaultAssignment(kind, false);
      const doc = await printable(kind);
      const body = { purpose: KIND_CONFIG[kind].printPurpose, sourceVersion: doc.version };

      const error = await fakeRenderPdf(kind, doc.id, body, { skipDelay: true }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        status: 422,
        code: 'TRADE.BUSINESS_DOCUMENT.PDF_TEMPLATE_INCOMPATIBLE',
        details: { reason: ['no_eligible_default_assignment'] },
      });

      const job = await fakeRenderPdf(kind, doc.id, { ...body, templateVersionId: 'tplv-explicit' }, { skipDelay: true });
      expect(job.status).toBe('PENDING');
    },
  );

  it('falls back to the built-in layout for a quotation without a default assignment', async () => {
    fakeSetPrintDefaultAssignment('quotation', false);
    const doc = await printable('quotation');
    const job = await fakeRenderPdf(
      'quotation',
      doc.id,
      { purpose: KIND_CONFIG.quotation.printPurpose, revisionId: 'rev' },
      { skipDelay: true },
    );
    expect(job.status).toBe('PENDING');
  });
});
