import { describe, expect, it } from 'vitest';
import type {
  OrderPreview,
  PurchaseOrderDetail,
  PurchaseQuotationDetail,
  QuotationDetail,
  SalesOrderDetail,
  TermsSnapshotV2,
} from '../shared/document.model';
import {
  bodies,
  draftFromPurchaseQuotation,
  draftFromQuotation,
  emptyDraft,
  isDirty,
  orderChangeKind,
  quotationChangeKind,
  toDraft,
  undoDraft,
  type DocumentDraft,
} from './document-draft';

function makeSalesTermsSnapshot(notes?: string): TermsSnapshotV2 {
  return {
    schemaVersion: 2,
    paymentTerms: 'Net 30 days',
    paymentTermCode: 'NET30',
    deliveryTerms: 'Delivery to site',
    incotermCode: 'DAP',
    warrantyTerms: '12-month warranty',
    ...(notes ? { notes } : {}),
    clauses: [{ title: 'General', body: 'Standard general conditions' }],
    localized: {
      en: {
        paymentTerms: 'Net 30 days',
        deliveryTerms: 'Delivery to site',
        warrantyTerms: '12-month warranty',
        ...(notes ? { notes } : {}),
      },
      ar: {
        paymentTerms: 'صافي خلال 30 يومًا',
        deliveryTerms: 'التسليم في موقع العميل',
        warrantyTerms: 'ضمان 12 شهرًا',
        ...(notes ? { notes } : {}),
      },
    },
    selections: [
      { type: 'PAYMENT', id: 'term-c1-payment-net30', code: 'NET30', version: 1 },
      { type: 'DELIVERY', id: 'term-c1-delivery-site14', code: 'SITE14', version: 1 },
      { type: 'WARRANTY', id: 'term-c1-warranty-w12', code: 'W12', version: 1 },
      { type: 'GENERAL', id: 'term-c1-general-gen', code: 'GEN', version: 1 },
    ],
  };
}

function makeQuotationDetail(overrides: Partial<QuotationDetail> = {}): QuotationDetail {
  return {
    id: 'qt-01',
    version: 3,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'pty-alnoor',
    contactPartyId: 'cnt-alnoor-1',
    currencyCode: 'EGP',
    businessDate: '2026-11-20',
    lifecycleStatus: 'DRAFT',
    documentNumber: 'QT-2026-0001',
    draftReference: 'REF-QT-01',
    grandTotal: '1000',
    partySnapshot: { id: 'pty-alnoor', displayName: 'Al Noor Trading Co.' },
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T12:00:00.000Z',
    extensionValues: {},
    currentRevisionId: 'rev-2',
    acceptedRevisionId: null,
    crmCustomerProfileId: 'crm-cust-alnoor',
    approvalStatus: 'NOT_REQUIRED',
    sourceCrmOpportunityId: 'opp-01-1',
    currentRevision: {
      id: 'rev-2',
      revisionNumber: 2,
      status: 'DRAFT',
      validUntil: '2026-12-31',
      priceLockExpiresAt: null,
    },
    revisions: [
      {
        id: 'rev-1',
        version: 1,
        quotationId: 'qt-01',
        revisionNumber: 1,
        status: 'SENT',
        validUntil: '2026-12-15',
        subtotal: '500',
        discountTotal: '0',
        grandTotal: '500',
        pricingMode: 'NONE',
        discountSnapshot: { pricing: { mode: 'NONE' }, currencyDecimalPlaces: 2 },
        termsSnapshot: makeSalesTermsSnapshot('Old notes'),
        sentAt: '2026-11-19T10:00:00.000Z',
        acceptedAt: null,
        rejectedAt: null,
        priceLockExpiresAt: null,
        createdAt: '2026-11-19T09:00:00.000Z',
      },
      {
        id: 'rev-2',
        version: 1,
        quotationId: 'qt-01',
        revisionNumber: 2,
        status: 'DRAFT',
        validUntil: '2026-12-31',
        subtotal: '1000',
        discountTotal: '50',
        grandTotal: '950',
        pricingMode: 'DISCOUNT',
        discountSnapshot: {
          pricing: { mode: 'DISCOUNT', scope: 'LINE', reasonCode: 'LOYAL_CUSTOMER' },
          currencyDecimalPlaces: 2,
        },
        termsSnapshot: makeSalesTermsSnapshot('Handle with care'),
        sentAt: null,
        acceptedAt: null,
        rejectedAt: null,
        priceLockExpiresAt: null,
        createdAt: '2026-11-20T10:00:00.000Z',
      },
    ],
    // Deliberately out of order by printLineNumber to verify sorting.
    currentLines: [
      {
        id: 'ql-2',
        clientLineId: 'cl-qt-2',
        printLineNumber: 2,
        descriptionSnapshot: 'Item two',
        quantity: '3',
        uomId: 'uom-box',
        unitPrice: '100',
        discountTotal: '0',
        lineTotal: '300',
        discountSnapshot: {
          itemId: 'item-50',
          maxDiscountAmount: '30',
          maxDiscountPercent: '10',
          discount: null,
        },
        taxSnapshot: {
          sku: 'BX-12',
          uomCode: 'BOX',
          itemDisplayName: 'Item two',
          itemTaxDefault: {
            taxId: 'tax-exempt',
            code: 'EXEMPT',
            name: 'Exempt',
            rate: '0.000',
            isInclusive: false,
          },
        },
        itemLabel: 'BX-12 · Item two',
      },
      {
        id: 'ql-1',
        clientLineId: 'cl-qt-1',
        printLineNumber: 1,
        descriptionSnapshot: 'Item one',
        quantity: '2',
        uomId: 'uom-pcs',
        unitPrice: '500',
        discountTotal: '50',
        lineTotal: '950',
        discountSnapshot: {
          itemId: 'item-49',
          maxDiscountAmount: '100',
          maxDiscountPercent: '10',
          discount: { type: 'PERCENT', value: '5' },
        },
        taxSnapshot: {
          sku: 'ST-220',
          uomCode: 'PCS',
          itemDisplayName: 'Item one',
          itemTaxDefault: {
            taxId: 'tax-vat14',
            code: 'VAT14',
            name: 'VAT 14%',
            rate: '14.000',
            isInclusive: false,
          },
        },
        itemLabel: 'ST-220 · Item one',
      },
    ],
    reasonHistory: [],
    ...overrides,
  };
}

function makeSalesOrderDetail(overrides: Partial<SalesOrderDetail> = {}): SalesOrderDetail {
  return {
    id: 'so-01',
    version: 2,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'pty-alnoor',
    contactPartyId: 'cnt-alnoor-1',
    currencyCode: 'USD',
    businessDate: '2026-11-20',
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    draftReference: 'REF-SO-01',
    grandTotal: '5407.9',
    partySnapshot: { id: 'pty-alnoor', displayName: 'Al Noor Trading Co.' },
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    extensionValues: {},
    confirmationStatus: 'NOT_STARTED',
    holdStatus: 'NONE',
    fulfillmentStatus: 'NONE',
    billingStatus: 'NONE',
    sourceQuotationId: null,
    sourceQuotationRevisionId: null,
    termsSnapshot: makeSalesTermsSnapshot('SO delivery note'),
    totalsSnapshot: {
      subtotal: '4980.5',
      discountTotal: '230',
      chargeTotal: '40',
      taxTotal: '617.4',
      roundingTotal: '0',
      grandTotal: '5407.9',
      amountPaid: '0',
      amountDue: '5407.9',
      currencyDecimalPlaces: 2,
    },
    lines: [
      {
        id: 'sol-2',
        clientLineId: 'cl-so-2',
        itemCompanyProfileId: 'cp-item-52',
        itemId: 'item-52',
        printLineNumber: 2,
        descriptionSnapshot: 'Laptop 14 inch',
        uomId: 'uom-pcs',
        uomLabel: 'PCS',
        orderedQuantity: '4',
        allocatedQuantity: '0',
        fulfilledQuantity: '0',
        invoicedQuantity: '0',
        cancelledQuantity: '0',
        unitPrice: '95.125',
        discountTotal: '0',
        chargeTotal: '0',
        taxTotal: '0',
        lineTotal: '380.5',
        taxSnapshot: {
          category: 'EXEMPT',
          rateBps: 0,
          taxableBase: '380.5',
          taxAmount: '0',
          currencyCode: 'USD',
        },
        itemLabel: 'LP-14 · Laptop 14 inch',
      },
      {
        id: 'sol-1',
        clientLineId: 'cl-so-1',
        itemCompanyProfileId: 'cp-item-49',
        itemId: 'item-49',
        printLineNumber: 1,
        descriptionSnapshot: 'Steel shelf',
        uomId: 'uom-pcs',
        uomLabel: 'PCS',
        orderedQuantity: '4',
        allocatedQuantity: '0',
        fulfilledQuantity: '0',
        invoicedQuantity: '0',
        cancelledQuantity: '0',
        unitPrice: '1150',
        discountTotal: '230',
        chargeTotal: '40',
        taxTotal: '617.4',
        lineTotal: '5027.4',
        taxSnapshot: {
          category: 'STANDARD',
          rateBps: 1400,
          taxableBase: '4410',
          taxAmount: '617.4',
          currencyCode: 'USD',
        },
        itemLabel: 'ST-220 · Steel shelf',
      },
    ],
    reasonHistory: [],
    ...overrides,
  };
}

function makePurchaseOrderDetail(overrides: Partial<PurchaseOrderDetail> = {}): PurchaseOrderDetail {
  return {
    id: 'po-01',
    version: 1,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'pty-gulfsteel',
    contactPartyId: null,
    currencyCode: 'EGP',
    businessDate: '2026-11-20',
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    draftReference: 'REF-PO-01',
    grandTotal: '879510',
    partySnapshot: { id: 'pty-gulfsteel', displayName: 'Gulf Steel Supplies' },
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    extensionValues: {},
    approvalStatus: 'NOT_REQUIRED',
    supplierAccountId: 'sup-acc-gulf-egp',
    receivingNodeId: 'node-wh-01',
    dispatchStatus: 'NOT_REQUESTED',
    fulfillmentStatus: 'NONE',
    billingStatus: 'NONE',
    termsSnapshot: makeSalesTermsSnapshot('PO note'),
    totalsSnapshot: {
      subtotal: '771500',
      discountTotal: '0',
      chargeTotal: '0',
      taxTotal: '108010',
      roundingTotal: '0',
      grandTotal: '879510',
      amountPaid: '0',
      amountDue: '879510',
      currencyDecimalPlaces: 2,
    },
    sourcePurchaseQuotationId: null,
    createdBy: 'usr-1',
    submittedBy: null,
    submittedAt: null,
    approvalReady: false,
    delivery: null,
    lines: [
      {
        id: 'pol-1',
        clientLineId: 'cl-po-1',
        itemCompanyProfileId: 'cp-item-49',
        itemId: 'item-49',
        printLineNumber: 1,
        descriptionSnapshot: 'Steel shelf',
        uomId: 'uom-pcs',
        uomLabel: 'PCS',
        orderedQuantity: '50',
        receivedQuantity: '0',
        cancelledQuantity: '0',
        unitPrice: '15430',
        chargeTotal: '0',
        taxTotal: '108010',
        lineTotal: '879510',
        taxSnapshot: {
          category: 'STANDARD',
          rateBps: 1400,
          taxableBase: '771500',
          taxAmount: '108010',
          currencyCode: 'EGP',
        },
        expectedDate: '2026-12-01',
        receivingNodeId: 'node-wh-01',
        itemLabel: 'ST-220 · Steel shelf',
      },
    ],
    reasonHistory: [],
    ...overrides,
  };
}

function makePurchaseQuotationDetail(
  overrides: Partial<PurchaseQuotationDetail> = {},
): PurchaseQuotationDetail {
  return {
    id: 'pq-01',
    version: 2,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'pty-gulfsteel',
    currencyCode: 'EGP',
    businessDate: '2026-11-20',
    lifecycleStatus: 'ISSUED',
    documentNumber: 'PQ-2026-0001',
    partySnapshot: { id: 'pty-gulfsteel', displayName: 'Gulf Steel Supplies' },
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    reference: 'SUP-REF-01',
    notes: 'Include calibration certificate',
    validUntil: '2026-12-20',
    finalizedAt: '2026-11-20T11:00:00.000Z',
    convertedPurchaseOrderId: null,
    termsSnapshot: makeSalesTermsSnapshot(),
    totalsSnapshot: {
      subtotal: '3000',
      discountTotal: '0',
      chargeTotal: '0',
      taxTotal: '0',
      roundingTotal: '0',
      grandTotal: '3000',
      amountPaid: '0',
      amountDue: '3000',
      currencyDecimalPlaces: 2,
    },
    lines: [
      {
        id: 'pql-2',
        clientLineId: 'cl-pq-2',
        itemCompanyProfileId: 'cp-item-52',
        itemId: 'item-52',
        printLineNumber: 2,
        quantity: '2',
        uomId: 'uom-pcs',
        uomLabel: 'PCS',
        unitPrice: '500',
        lineTotal: '1000',
        descriptionSnapshot: 'Laptop 14',
        itemLabel: 'LP-14 · Laptop 14',
      },
      {
        id: 'pql-1',
        clientLineId: 'cl-pq-1',
        itemCompanyProfileId: 'cp-item-49',
        itemId: 'item-49',
        printLineNumber: 1,
        quantity: '2',
        uomId: 'uom-pcs',
        uomLabel: 'PCS',
        unitPrice: '1000',
        lineTotal: '2000',
        descriptionSnapshot: 'Steel shelf',
        itemLabel: 'ST-220 · Steel shelf',
      },
    ],
    reasonHistory: [],
    ...overrides,
  };
}

describe('document-draft', () => {
  describe('emptyDraft', () => {
    it('creates an initial draft per document kind with expected line count and pricing', () => {
      const qt = emptyDraft('quotation');
      expect(qt.lines).toHaveLength(1);
      expect(qt.lines[0].itemId).toBeNull();
      expect(qt.pricing).toEqual({ mode: 'NONE' });
      expect(qt.termSelections).toEqual({
        clauseIds: [],
      });

      const so = emptyDraft('sales-order');
      expect(so.lines).toHaveLength(0);
      expect(so.pricing).toBeNull();

      const po = emptyDraft('purchase-order');
      expect(po.lines).toHaveLength(0);
      expect(po.header['supplierPartyId']).toBeNull();
      expect(po.header['receivingNodeId']).toBeNull();

      const pq = emptyDraft('purchase-quotation');
      expect(pq.lines).toHaveLength(0);
      expect(pq.header['reference']).toBe('');
    });
  });

  describe('toDraft', () => {
    it('sorts lines by printLineNumber, extracts termSelections, notes, pricing and opportunity for quotation', () => {
      const detail = makeQuotationDetail();
      const draft = toDraft('quotation', detail);

      expect(draft.header['partyId']).toBe('pty-alnoor');
      expect(draft.header['sourceCrmOpportunityId']).toBe('opp-01-1');
      expect(draft.lines.map((l) => l.clientLineId)).toEqual(['cl-qt-1', 'cl-qt-2']);
      expect(draft.lines[0].discount).toEqual({ type: 'PERCENT', value: '5' });
      expect(draft.pricing).toEqual({ mode: 'DISCOUNT', scope: 'LINE', reasonCode: 'LOYAL_CUSTOMER' });
      expect(draft.validUntil).toBe('2026-12-31');
      expect(draft.notes).toBe('Handle with care');
      expect(draft.termSelections).toEqual({
        paymentTermId: 'term-c1-payment-net30',
        deliveryTermId: 'term-c1-delivery-site14',
        warrantyTermId: 'term-c1-warranty-w12',
        clauseIds: ['term-c1-general-gen'],
      });
    });

    it('preserves sourceCrmOpportunityId for quotations without an embedded sourceCrmOpportunity object', () => {
      const detail = makeQuotationDetail({ sourceCrmOpportunityId: 'opp-99-1' });
      expect('sourceCrmOpportunity' in detail).toBe(false);

      const draft = toDraft('quotation', detail);
      expect(draft.header['sourceCrmOpportunityId']).toBe('opp-99-1');
    });

    it('sorts sales-order and purchase-order lines and sets locked flag when converted from a source', () => {
      const unlockedSo = toDraft('sales-order', makeSalesOrderDetail());
      expect(unlockedSo.lines.map((l) => l.clientLineId)).toEqual(['cl-so-1', 'cl-so-2']);
      expect(unlockedSo.lines.every((l) => l.locked === false)).toBe(true);
      expect(unlockedSo.lines[0].tax).toEqual({ category: 'STANDARD', rateBps: 1400 });

      const convertedSo = toDraft('sales-order', makeSalesOrderDetail({ sourceQuotationId: 'qt-08' }));
      expect(convertedSo.lines.every((l) => l.locked === true)).toBe(true);

      const convertedPo = toDraft(
        'purchase-order',
        makePurchaseOrderDetail({ sourcePurchaseQuotationId: 'pq-07' }),
      );
      expect(convertedPo.header['supplierPartyId']).toBe('pty-gulfsteel');
      expect(convertedPo.lines[0].locked).toBe(true);
      expect(convertedPo.lines[0].expectedDate).toBe('2026-12-01');
    });

    it('maps purchase quotation lines sorted by printLineNumber and preserves notes and validUntil', () => {
      const pqDraft = toDraft('purchase-quotation', makePurchaseQuotationDetail());
      expect(pqDraft.lines.map((l) => l.clientLineId)).toEqual(['cl-pq-1', 'cl-pq-2']);
      expect(pqDraft.notes).toBe('Include calibration certificate');
      expect(pqDraft.validUntil).toBe('2026-12-20');
      expect(pqDraft.header['reference']).toBe('SUP-REF-01');
    });
  });

  describe('conversion prefill', () => {
    it('builds convert-quotation draft keeping clientLineId, locking lines and deriving tax defaults', () => {
      const q = makeQuotationDetail({
        lifecycleStatus: 'ACCEPTED',
        acceptedRevisionId: 'rev-2',
      });
      const draft = draftFromQuotation(q);

      expect(draft.header).toEqual({
        partyId: 'pty-alnoor',
        contactPartyId: 'cnt-alnoor-1',
        currencyCode: 'EGP',
        draftReference: 'REF-QT-01',
      });
      expect(draft.lines.map((l) => l.clientLineId)).toEqual(['cl-qt-1', 'cl-qt-2']);
      expect(draft.lines[0].locked).toBe(true);
      expect(draft.lines[0].tax).toEqual({ category: 'STANDARD', rateBps: 1400 });
      expect(draft.lines[0].taxLocked).toBe(true);
      expect(draft.lines[1].tax).toEqual({ category: 'EXEMPT', rateBps: 0 });
      expect(draft.lines[1].taxLocked).toBe(true);
      expect(draft.termSelections.paymentTermId).toBe('term-c1-payment-net30');
      expect(draft.notes).toBe('Handle with care');
    });

    it('builds convert-purchase-quotation draft with locked supplier prices and null account/warehouse', () => {
      const pq = makePurchaseQuotationDetail();
      const draft = draftFromPurchaseQuotation(pq);

      expect(draft.header).toEqual({
        supplierPartyId: 'pty-gulfsteel',
        supplierAccountId: null,
        contactPartyId: null,
        currencyCode: 'EGP',
        receivingNodeId: null,
        draftReference: 'SUP-REF-01',
      });
      expect(draft.lines.map((l) => l.clientLineId)).toEqual(['cl-pq-1', 'cl-pq-2']);
      expect(draft.lines[0].locked).toBe(true);
      expect(draft.lines[0].unitPrice).toBe('1000');
      expect(draft.lines[0].tax).toBeNull();
      expect(draft.notes).toBe('Include calibration certificate');
    });
  });

  describe('isDirty and undoDraft', () => {
    it('compares drafts structurally and restores an independent clone on undo', () => {
      const loaded = toDraft('quotation', makeQuotationDetail());
      const reorderedKeysCopy: DocumentDraft = {
        validUntil: loaded.validUntil,
        notes: loaded.notes,
        termSelections: {
          clauseIds: [...(loaded.termSelections.clauseIds ?? [])],
          warrantyTermId: loaded.termSelections.warrantyTermId,
          deliveryTermId: loaded.termSelections.deliveryTermId,
          paymentTermId: loaded.termSelections.paymentTermId,
        },
        pricing: loaded.pricing ? { ...loaded.pricing } : null,
        lines: loaded.lines.map((l) => ({ ...l })),
        header: {
          sourceCrmOpportunityId: loaded.header['sourceCrmOpportunityId'],
          draftReference: loaded.header['draftReference'],
          currencyCode: loaded.header['currencyCode'],
          contactPartyId: loaded.header['contactPartyId'],
          crmCustomerProfileId: loaded.header['crmCustomerProfileId'],
          partyId: loaded.header['partyId'],
        },
      };

      expect(isDirty(loaded, reorderedKeysCopy)).toBe(false);

      const edited = undoDraft(loaded);
      edited.lines[0].quantity = '99';
      expect(isDirty(loaded, edited)).toBe(true);

      const restored = undoDraft(loaded);
      expect(isDirty(loaded, restored)).toBe(false);
      expect(loaded.lines[0].quantity).toBe('2');
    });
  });

  describe('change classification', () => {
    it('classifies quotation header-only vs revision-only vs combined changes', () => {
      const base = toDraft('quotation', makeQuotationDetail());

      const oppCleared = undoDraft(base);
      oppCleared.header['sourceCrmOpportunityId'] = null;
      expect(quotationChangeKind(base, oppCleared)).toEqual({ header: true, revision: false });

      const termsChanged = undoDraft(base);
      termsChanged.termSelections.paymentTermId = 'term-c1-payment-cod';
      expect(quotationChangeKind(base, termsChanged)).toEqual({ header: false, revision: true });

      const both = undoDraft(base);
      both.header['draftReference'] = 'NEW-REF';
      both.validUntil = '2027-01-15';
      expect(quotationChangeKind(base, both)).toEqual({ header: true, revision: true });
    });

    it('routes sales-order and purchase-order term changes to header PATCH unless lines also changed', () => {
      const baseSo = toDraft('sales-order', makeSalesOrderDetail());

      const termsOnly = undoDraft(baseSo);
      termsOnly.notes = 'Updated terms note';
      expect(orderChangeKind('sales-order', baseSo, termsOnly)).toEqual({ header: true, lines: false });

      const linesAndTerms = undoDraft(baseSo);
      linesAndTerms.notes = 'Updated terms note';
      linesAndTerms.lines[0].chargeTotal = '100';
      expect(orderChangeKind('sales-order', baseSo, linesAndTerms)).toEqual({ header: false, lines: true });

      const headerAndLines = undoDraft(baseSo);
      headerAndLines.header['draftReference'] = 'CHANGED';
      headerAndLines.lines[0].quantity = '10';
      expect(orderChangeKind('sales-order', baseSo, headerAndLines)).toEqual({ header: true, lines: true });
    });
  });

  describe('bodies (API v2 DTOs without legacy terms)', () => {
    it('builds exact quotationCreate, quotationUpdate and quotationRevision bodies', () => {
      const draft = toDraft('quotation', makeQuotationDetail());
      const createBody = bodies.quotationCreate(draft);
      expect(createBody).toEqual({
        partyId: 'pty-alnoor',
        currencyCode: 'EGP',
        crmCustomerProfileId: 'crm-cust-alnoor',
        contactPartyId: 'cnt-alnoor-1',
        draftReference: 'REF-QT-01',
        sourceCrmOpportunityId: 'opp-01-1',
      });

      const updatedDraft = undoDraft(draft);
      updatedDraft.header['sourceCrmOpportunityId'] = null;
      const updateBody = bodies.quotationUpdate(draft, updatedDraft);
      expect(updateBody).toEqual({ sourceCrmOpportunityId: null });

      const revBody = bodies.quotationRevision(draft, 'fp_1234');
      expect(revBody).toEqual({
        validUntil: '2026-12-31',
        lines: [
          {
            clientLineId: 'cl-qt-1',
            itemId: 'item-49',
            uomId: 'uom-pcs',
            quantity: '2',
            discount: { type: 'PERCENT', value: '5' },
          },
          {
            clientLineId: 'cl-qt-2',
            itemId: 'item-50',
            uomId: 'uom-box',
            quantity: '3',
          },
        ],
        pricing: { mode: 'DISCOUNT', scope: 'LINE', reasonCode: 'LOYAL_CUSTOMER' },
        termSelections: draft.termSelections,
        expectedPricingFingerprint: 'fp_1234',
        notes: 'Handle with care',
      });
      expect((revBody as unknown as Record<string, unknown>)['terms']).toBeUndefined();

      // Non-LINE pricing modes must strip line discounts.
      const promoDraft = undoDraft(draft);
      promoDraft.pricing = { mode: 'PROMOTIONS' };
      const promoRev = bodies.quotationRevision(promoDraft);
      expect(promoRev.lines[0].discount).toBeUndefined();
      expect(promoRev.pricing).toEqual({ mode: 'PROMOTIONS' });
    });

    it('builds salesOrderCreate, salesOrderUpdate and replaceOrderLines using server preview when given', () => {
      const draft = toDraft('sales-order', makeSalesOrderDetail());
      const preview: OrderPreview = {
        currencyDecimalPlaces: 2,
        fingerprint: 'fp_so_1',
        lines: [
          {
            clientLineId: 'cl-so-1',
            unitPrice: '1150',
            taxDefault: null,
            financial: {
              subtotal: '4600',
              taxableBase: '4410',
              discountTotal: '230',
              chargeTotal: '40',
              taxTotal: '617.4',
              lineTotal: '5027.4',
              taxSnapshot: {
                category: 'STANDARD',
                rateBps: 1400,
                taxableBase: '4410',
                taxAmount: '617.4',
                currencyCode: 'USD',
              },
              inclusiveTax: false,
            },
          },
          {
            clientLineId: 'cl-so-2',
            unitPrice: '95.125',
            taxDefault: null,
            financial: {
              subtotal: '380.5',
              taxableBase: '380.5',
              discountTotal: '0',
              chargeTotal: '0',
              taxTotal: '0',
              lineTotal: '380.5',
              taxSnapshot: {
                category: 'EXEMPT',
                rateBps: 0,
                taxableBase: '380.5',
                taxAmount: '0',
                currencyCode: 'USD',
              },
              inclusiveTax: false,
            },
          },
        ],
        totals: {
          subtotal: '4980.5',
          discountTotal: '230',
          chargeTotal: '40',
          taxTotal: '617.4',
          roundingTotal: '0',
          grandTotal: '5407.9',
          amountPaid: '0',
          amountDue: '5407.9',
        },
      };

      const createBody = bodies.salesOrderCreate(draft, {
        expectedPricingFingerprint: 'fp_so_1',
        preview,
      });
      expect(createBody.totals).toEqual(preview.totals);
      expect(createBody.expectedPricingFingerprint).toBe('fp_so_1');
      expect(createBody.termSelections).toEqual(draft.termSelections);
      expect((createBody as unknown as Record<string, unknown>)['terms']).toBeUndefined();

      const updated = undoDraft(draft);
      updated.notes = 'Updated SO note';
      const patchBody = bodies.salesOrderUpdate(draft, updated);
      expect(patchBody).toEqual({
        termSelections: updated.termSelections,
        notes: 'Updated SO note',
      });
      expect((patchBody as unknown as Record<string, unknown>)['terms']).toBeUndefined();

      const putLines = bodies.replaceOrderLines('sales-order', draft, {
        expectedPricingFingerprint: 'fp_so_1',
        preview,
      });
      expect(putLines.lines).toHaveLength(2);
      expect(putLines.expectedPricingFingerprint).toBe('fp_so_1');
      expect((putLines.lines[0] as unknown as Record<string, unknown>)['expectedDate']).toBeUndefined();
      expect((putLines as unknown as Record<string, unknown>)['terms']).toBeUndefined();
    });

    it('builds convertQuotation omitting terms and passing unchanged terms to the server unless edited', () => {
      const q = makeQuotationDetail({ lifecycleStatus: 'ACCEPTED', acceptedRevisionId: 'rev-2' });
      const loaded = draftFromQuotation(q);
      const unchangedBody = bodies.convertQuotation(loaded, { loaded, currencyDecimalPlaces: 2 });

      expect(unchangedBody.lines).toHaveLength(2);
      expect((unchangedBody as unknown as Record<string, unknown>)['terms']).toBeUndefined();
      expect(unchangedBody.termSelections).toBeUndefined();

      const edited = undoDraft(loaded);
      edited.termSelections.warrantyTermId = 'term-c1-warranty-w24';
      const editedBody = bodies.convertQuotation(edited, { loaded, currencyDecimalPlaces: 2 });
      expect((editedBody as unknown as Record<string, unknown>)['terms']).toBeUndefined();
      expect(editedBody.termSelections?.warrantyTermId).toBe('term-c1-warranty-w24');
    });

    it('builds purchaseOrderCreate (forcing discountTotal 0), purchaseOrderUpdate and replaceOrderLines', () => {
      const draft = toDraft('purchase-order', makePurchaseOrderDetail());
      const poCreate = bodies.purchaseOrderCreate(draft, { expectedPricingFingerprint: 'fp_po_1' });

      expect(poCreate.supplierPartyId).toBe('pty-gulfsteel');
      expect(poCreate.supplierAccountId).toBe('sup-acc-gulf-egp');
      expect(poCreate.receivingNodeId).toBe('node-wh-01');
      expect(poCreate.lines[0].financial.discountTotal).toBe('0');
      expect(poCreate.lines[0].expectedDate).toBe('2026-12-01');
      expect(poCreate.totals.grandTotal).toBe('879510');
      expect((poCreate as unknown as Record<string, unknown>)['terms']).toBeUndefined();

      const edited = undoDraft(draft);
      edited.header['receivingNodeId'] = 'node-wh-02';
      expect(bodies.purchaseOrderUpdate(draft, edited)).toEqual({
        receivingNodeId: 'node-wh-02',
      });

      const poLines = bodies.replaceOrderLines('purchase-order', draft, {
        expectedPricingFingerprint: 'fp_po_1',
      });
      expect(poLines.lines[0].expectedDate).toBe('2026-12-01');
      expect(poLines.lines[0].receivingNodeId).toBe('node-wh-01');
      expect((poLines as unknown as Record<string, unknown>)['terms']).toBeUndefined();
    });

    it('builds convertPurchaseQuotation omitting terms and honoring edited optional header fields', () => {
      const pq = makePurchaseQuotationDetail();
      const loaded = draftFromPurchaseQuotation(pq);
      const edited = undoDraft(loaded);
      edited.header['supplierAccountId'] = 'sup-acc-gulf-egp';
      edited.header['receivingNodeId'] = 'node-wh-01';
      edited.lines[0].tax = { category: 'STANDARD', rateBps: 1400 };
      edited.lines[1].tax = { category: 'EXEMPT', rateBps: 0 };

      const body = bodies.convertPurchaseQuotation(edited, { loaded, currencyDecimalPlaces: 2 });
      expect(body.supplierAccountId).toBe('sup-acc-gulf-egp');
      expect(body.receivingNodeId).toBe('node-wh-01');
      expect(body.lines).toHaveLength(2);
      expect(body.lines[0].financial.discountTotal).toBe('0');
      expect((body as unknown as Record<string, unknown>)['terms']).toBeUndefined();
      expect(body.termSelections).toBeUndefined();
    });

    it('builds purchaseQuotationCreate and purchaseQuotationUpdate sending lines whenever lines, supplier or currency change', () => {
      const draft = toDraft('purchase-quotation', makePurchaseQuotationDetail());
      const createBody = bodies.purchaseQuotationCreate(draft);
      expect(createBody.supplierPartyId).toBe('pty-gulfsteel');
      expect(createBody.lines).toHaveLength(2);
      expect((createBody as unknown as Record<string, unknown>)['terms']).toBeUndefined();

      // Reference-only change omits lines.
      const refOnly = undoDraft(draft);
      refOnly.header['reference'] = 'SUP-REF-99';
      const refUpdate = bodies.purchaseQuotationUpdate(draft, refOnly);
      expect(refUpdate).toEqual({ reference: 'SUP-REF-99' });
      expect(refUpdate.lines).toBeUndefined();

      // Currency change MUST include lines so backend never raises REPRICING_REQUIRED.
      const currencyChanged = undoDraft(draft);
      currencyChanged.header['currencyCode'] = 'USD';
      const curUpdate = bodies.purchaseQuotationUpdate(draft, currencyChanged);
      expect(curUpdate.currencyCode).toBe('USD');
      expect(curUpdate.lines).toHaveLength(2);

      // Supplier change MUST also include lines.
      const supplierChanged = undoDraft(draft);
      supplierChanged.header['supplierPartyId'] = 'pty-09';
      const supUpdate = bodies.purchaseQuotationUpdate(draft, supplierChanged);
      expect(supUpdate.supplierPartyId).toBe('pty-09');
      expect(supUpdate.lines).toHaveLength(2);
    });
  });
});
