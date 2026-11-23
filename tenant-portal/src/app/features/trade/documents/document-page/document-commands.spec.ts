import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../shared/trade-api';
import type {
  PurchaseOrderDetail,
  PurchaseQuotationDetail,
  QuotationDetail,
  SalesOrderDetail,
} from '../shared/document.model';
import { DocumentRequestKeys } from '../shared/document-request-keys';
import {
  runCommand as runCommandWithKey,
  type DocumentCommandApi,
  type RunCommandInput,
} from './document-commands';
import {
  draftFromPurchaseQuotation,
  draftFromQuotation,
  emptyDraft,
  toDraft,
  undoDraft,
  type DocumentDraft,
} from './document-draft';
import {
  saveDocument as saveDocumentWithKeys,
  validateDraft,
  type DocumentSaveApi,
  type SaveDocumentInput,
} from './document-save';

const KEY = '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

/** Every command in these tests runs as one user action with the key KEY. */
function runCommand(input: Omit<RunCommandInput, 'idempotencyKey'>, api: DocumentCommandApi) {
  return runCommandWithKey({ ...input, idempotencyKey: KEY }, api);
}

/** Every save in these tests is one user action with a fresh key source. */
function saveDocument(input: Omit<SaveDocumentInput, 'requestKeys'>, api: DocumentSaveApi) {
  return saveDocumentWithKeys({ ...input, requestKeys: new DocumentRequestKeys() }, api);
}

const ANY_KEY = expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

function makeQuotation(overrides: Partial<QuotationDetail> = {}): QuotationDetail {
  return {
    id: 'qt-10',
    version: 2,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'pty-alnoor',
    contactPartyId: 'cnt-alnoor-1',
    currencyCode: 'EGP',
    businessDate: '2026-11-20',
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    draftReference: 'REF-10',
    grandTotal: '1000',
    partySnapshot: { id: 'pty-alnoor', displayName: 'Al Noor' },
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    extensionValues: {},
    currentRevisionId: 'rev-1',
    acceptedRevisionId: null,
    crmCustomerProfileId: 'crm-cust-alnoor',
    approvalStatus: 'NOT_REQUIRED',
    sourceCrmOpportunityId: null,
    currentRevision: {
      id: 'rev-1',
      revisionNumber: 1,
      status: 'DRAFT',
      validUntil: '2026-12-31',
      priceLockExpiresAt: null,
    },
    revisions: [
      {
        id: 'rev-1',
        version: 1,
        quotationId: 'qt-10',
        revisionNumber: 1,
        status: 'DRAFT',
        validUntil: '2026-12-31',
        subtotal: '1000',
        discountTotal: '0',
        grandTotal: '1000',
        pricingMode: 'NONE',
        discountSnapshot: { pricing: { mode: 'NONE' }, currencyDecimalPlaces: 2 },
        termsSnapshot: {
          schemaVersion: 2,
          selections: [{ type: 'PAYMENT', id: 'term-c1-payment-net30', code: 'NET30', version: 1 }],
        },
        sentAt: null,
        acceptedAt: null,
        rejectedAt: null,
        priceLockExpiresAt: null,
        createdAt: '2026-11-20T10:00:00.000Z',
      },
    ],
    currentLines: [
      {
        id: 'ql-1',
        clientLineId: 'cl-1',
        printLineNumber: 1,
        descriptionSnapshot: 'Steel shelf',
        quantity: '2',
        uomId: 'uom-pcs',
        unitPrice: '500',
        discountTotal: '0',
        lineTotal: '1000',
        discountSnapshot: {
          itemId: 'item-49',
          maxDiscountAmount: '100',
          maxDiscountPercent: '10',
          discount: null,
        },
        taxSnapshot: {
          sku: 'ST-220',
          uomCode: 'PCS',
          itemDisplayName: 'Steel shelf',
          itemTaxDefault: {
            taxId: 'tax-vat14',
            code: 'VAT14',
            name: 'VAT 14%',
            rate: '14.000',
            isInclusive: false,
          },
        },
        itemLabel: 'ST-220 · Steel shelf',
      },
    ],
    reasonHistory: [],
    ...overrides,
  };
}

function makeSalesOrder(overrides: Partial<SalesOrderDetail> = {}): SalesOrderDetail {
  return {
    id: 'so-10',
    version: 1,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'pty-alnoor',
    contactPartyId: 'cnt-alnoor-1',
    currencyCode: 'EGP',
    businessDate: '2026-11-20',
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    draftReference: 'REF-SO-10',
    grandTotal: '1140',
    partySnapshot: { id: 'pty-alnoor', displayName: 'Al Noor' },
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    extensionValues: {},
    confirmationStatus: 'NOT_STARTED',
    holdStatus: 'NONE',
    fulfillmentStatus: 'NONE',
    billingStatus: 'NONE',
    sourceQuotationId: null,
    sourceQuotationRevisionId: null,
    termsSnapshot: {
      schemaVersion: 2,
      selections: [{ type: 'PAYMENT', id: 'term-c1-payment-net30', code: 'NET30', version: 1 }],
    },
    totalsSnapshot: {
      subtotal: '1000',
      discountTotal: '0',
      chargeTotal: '0',
      taxTotal: '140',
      roundingTotal: '0',
      grandTotal: '1140',
      amountPaid: '0',
      amountDue: '1140',
      currencyDecimalPlaces: 2,
    },
    lines: [
      {
        id: 'sol-1',
        clientLineId: 'cl-so-1',
        itemCompanyProfileId: 'cp-item-49',
        itemId: 'item-49',
        printLineNumber: 1,
        descriptionSnapshot: 'Steel shelf',
        uomId: 'uom-pcs',
        uomLabel: 'PCS',
        orderedQuantity: '2',
        allocatedQuantity: '0',
        fulfilledQuantity: '0',
        invoicedQuantity: '0',
        cancelledQuantity: '0',
        unitPrice: '500',
        discountTotal: '0',
        chargeTotal: '0',
        taxTotal: '140',
        lineTotal: '1140',
        taxSnapshot: {
          category: 'STANDARD',
          rateBps: 1400,
          taxableBase: '1000',
          taxAmount: '140',
          currencyCode: 'EGP',
        },
        itemLabel: 'ST-220 · Steel shelf',
      },
    ],
    reasonHistory: [],
    ...overrides,
  };
}

function makePurchaseOrder(overrides: Partial<PurchaseOrderDetail> = {}): PurchaseOrderDetail {
  return {
    id: 'po-10',
    version: 1,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'pty-gulfsteel',
    contactPartyId: null,
    currencyCode: 'EGP',
    businessDate: '2026-11-20',
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    draftReference: 'REF-PO-10',
    grandTotal: '1140',
    partySnapshot: { id: 'pty-gulfsteel', displayName: 'Gulf Steel' },
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    extensionValues: {},
    approvalStatus: 'NOT_REQUIRED',
    supplierAccountId: 'sup-acc-gulf-egp',
    receivingNodeId: 'node-wh-01',
    dispatchStatus: 'NOT_REQUESTED',
    fulfillmentStatus: 'NONE',
    billingStatus: 'NONE',
    termsSnapshot: {
      schemaVersion: 2,
      selections: [{ type: 'PAYMENT', id: 'term-c1-payment-sup60', code: 'SUP60', version: 1 }],
    },
    totalsSnapshot: {
      subtotal: '1000',
      discountTotal: '0',
      chargeTotal: '0',
      taxTotal: '140',
      roundingTotal: '0',
      grandTotal: '1140',
      amountPaid: '0',
      amountDue: '1140',
      currencyDecimalPlaces: 2,
    },
    sourcePurchaseQuotationId: null,
    createdBy: 'usr-1',
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
        orderedQuantity: '2',
        receivedQuantity: '0',
        cancelledQuantity: '0',
        unitPrice: '500',
        chargeTotal: '0',
        taxTotal: '140',
        lineTotal: '1140',
        taxSnapshot: {
          category: 'STANDARD',
          rateBps: 1400,
          taxableBase: '1000',
          taxAmount: '140',
          currencyCode: 'EGP',
        },
        expectedDate: null,
        receivingNodeId: 'node-wh-01',
        itemLabel: 'ST-220 · Steel shelf',
      },
    ],
    reasonHistory: [],
    ...overrides,
  };
}

function makePurchaseQuotation(
  overrides: Partial<PurchaseQuotationDetail> = {},
): PurchaseQuotationDetail {
  return {
    id: 'pq-10',
    version: 1,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'pty-gulfsteel',
    currencyCode: 'EGP',
    businessDate: '2026-11-20',
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    partySnapshot: { id: 'pty-gulfsteel', displayName: 'Gulf Steel' },
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    reference: 'SUP-REF-10',
    notes: null,
    validUntil: '2026-12-31',
    finalizedAt: null,
    convertedPurchaseOrderId: null,
    termsSnapshot: {
      schemaVersion: 2,
      selections: [{ type: 'PAYMENT', id: 'term-c1-payment-sup60', code: 'SUP60', version: 1 }],
    },
    totalsSnapshot: {
      subtotal: '1000',
      discountTotal: '0',
      chargeTotal: '0',
      taxTotal: '0',
      roundingTotal: '0',
      grandTotal: '1000',
      amountPaid: '0',
      amountDue: '1000',
      currencyDecimalPlaces: 2,
    },
    lines: [
      {
        id: 'pql-1',
        clientLineId: 'cl-pq-1',
        itemCompanyProfileId: 'cp-item-49',
        itemId: 'item-49',
        printLineNumber: 1,
        quantity: '2',
        uomId: 'uom-pcs',
        uomLabel: 'PCS',
        unitPrice: '500',
        lineTotal: '1000',
        descriptionSnapshot: 'Steel shelf',
        itemLabel: 'ST-220 · Steel shelf',
      },
    ],
    reasonHistory: [],
    ...overrides,
  };
}

function makeSaveApi(): DocumentSaveApi {
  return {
    createQuotation: vi.fn(),
    updateQuotation: vi.fn(),
    createQuotationRevision: vi.fn(),
    createSalesOrder: vi.fn(),
    updateSalesOrder: vi.fn(),
    convertQuotation: vi.fn(),
    createPurchaseOrder: vi.fn(),
    updatePurchaseOrder: vi.fn(),
    convertPurchaseQuotation: vi.fn(),
    replaceOrderLines: vi.fn(),
    createPurchaseQuotation: vi.fn(),
    updatePurchaseQuotation: vi.fn(),
  };
}

function makeCommandApi(): DocumentCommandApi {
  return {
    quotationAction: vi.fn(),
    salesOrderAction: vi.fn(),
    confirmSalesOrder: vi.fn(),
    purchaseOrderAction: vi.fn(),
    retryPurchaseDelivery: vi.fn(),
    issuePurchaseQuotation: vi.fn(),
    cancelPurchaseQuotation: vi.fn(),
    createSalesOrderFromQuotation: vi.fn(),
    createPurchaseOrderFromPurchaseQuotation: vi.fn(),
    deleteDocument: vi.fn(),
    listDocuments: vi.fn(),
  };
}

describe('document-save', () => {
  it('returns invalid field and line errors before calling any API', async () => {
    const api = makeSaveApi();
    const draft = emptyDraft('quotation');
    draft.pricing = { mode: 'DISCOUNT', scope: 'LINE', reasonCode: '' };
    const outcome = await saveDocument(
      {
        kind: 'quotation',
        mode: 'new',
        draft,
        loaded: emptyDraft('quotation'),
        detail: null,
        sourceId: null,
        sourceVersion: null,
        fingerprint: null,
        confirm: vi.fn().mockResolvedValue(true),
        discountReasonRequired: true,
      },
      api,
    );

    expect(outcome.type).toBe('invalid');
    if (outcome.type === 'invalid') {
      expect(outcome.fieldErrors['partyId']).toBe('tdpg.validation.customerRequired');
      expect(outcome.fieldErrors['currencyCode']).toBe('tdpg.validation.currencyRequired');
      expect(outcome.fieldErrors['validUntil']).toBe('tdpg.validation.validUntilRequired');
      expect(outcome.fieldErrors['paymentTermId']).toBe('tdpg.validation.paymentTermsRequired');
      expect(outcome.fieldErrors['pricingReason']).toBe('tdpg.validation.discountReasonRequired');
      expect(outcome.lineErrors[draft.lines[0].clientLineId]).toBe('tdpg.validation.lineItemRequired');
    }
    expect(api.createQuotation).not.toHaveBeenCalled();
  });

  it('validates terms notes <= 800 across all four kinds and maps 422 notes error', async () => {
    const okNote = 'n'.repeat(800);
    const badNote = 'n'.repeat(801);

    const qtDraft = toDraft('quotation', makeQuotation());
    qtDraft.notes = okNote;
    expect(validateDraft('quotation', 'edit', qtDraft).fieldErrors['notes']).toBeUndefined();
    qtDraft.notes = badNote;
    expect(validateDraft('quotation', 'edit', qtDraft).fieldErrors['notes']).toBe('tdpg.validation.notesMax');

    const soDraft = toDraft('sales-order', makeSalesOrder());
    soDraft.notes = okNote;
    expect(validateDraft('sales-order', 'edit', soDraft).fieldErrors['notes']).toBeUndefined();
    soDraft.notes = badNote;
    expect(validateDraft('sales-order', 'edit', soDraft).fieldErrors['notes']).toBe('tdpg.validation.notesMax');

    const poDraft = toDraft('purchase-order', makePurchaseOrder());
    poDraft.notes = okNote;
    expect(validateDraft('purchase-order', 'edit', poDraft).fieldErrors['notes']).toBeUndefined();
    poDraft.notes = badNote;
    expect(validateDraft('purchase-order', 'edit', poDraft).fieldErrors['notes']).toBe('tdpg.validation.notesMax');

    const pqDraft = toDraft('purchase-quotation', makePurchaseQuotation());
    pqDraft.notes = okNote;
    expect(validateDraft('purchase-quotation', 'edit', pqDraft).fieldErrors['notes']).toBeUndefined();
    pqDraft.notes = badNote;
    expect(validateDraft('purchase-quotation', 'edit', pqDraft).fieldErrors['notes']).toBe('tdpg.validation.notesMax');

    const saveApi = makeSaveApi();
    const validSo = toDraft('sales-order', makeSalesOrder());
    validSo.notes = okNote;
    vi.mocked(saveApi.createSalesOrder).mockRejectedValue(
      new ApiError(400, 'TRADE.VALIDATION_FAILED', {
        message: [{ property: 'notes', constraints: { maxLength: 'TRADE.TERMS.NOTE_TOO_LONG' } }],
      } as unknown as Record<string, string[]>),
    );
    const outcome = await saveDocument(
      {
        kind: 'sales-order',
        mode: 'new',
        draft: validSo,
        loaded: emptyDraft('sales-order'),
        detail: null,
        sourceId: null,
        sourceVersion: null,
        fingerprint: 'fp',
        confirm: vi.fn().mockResolvedValue(true),
      },
      saveApi,
    );
    expect(outcome).toEqual({
      type: 'invalid',
      fieldErrors: { notes: 'tdpg.validation.notesMax' },
      lineErrors: {},
    });
  });

  it('creates a new quotation then creates its first revision', async () => {
    const api = makeSaveApi();
    const q = makeQuotation();
    const draft = toDraft('quotation', q);
    vi.mocked(api.createQuotation).mockResolvedValue({ ...q, id: 'qt-new', version: 1 });
    vi.mocked(api.createQuotationRevision).mockResolvedValue({
      ...q.revisions[0],
      quotation: { id: 'qt-new', version: 2, lifecycleStatus: 'DRAFT', currentRevisionId: 'rev-1' },
    });

    const outcome = await saveDocument(
      {
        kind: 'quotation',
        mode: 'new',
        draft,
        loaded: emptyDraft('quotation'),
        detail: null,
        sourceId: null,
        sourceVersion: null,
        fingerprint: 'fp_1',
        confirm: vi.fn().mockResolvedValue(true),
      },
      api,
    );

    expect(api.createQuotation).toHaveBeenCalledTimes(1);
    expect(api.createQuotationRevision).toHaveBeenCalledWith('qt-new', 1, expect.objectContaining({
      expectedPricingFingerprint: 'fp_1',
    }), ANY_KEY);
    const createKey = vi.mocked(api.createQuotation).mock.calls[0][1];
    const revisionKey = vi.mocked(api.createQuotationRevision).mock.calls[0][3];
    expect(createKey).toEqual(ANY_KEY);
    expect(revisionKey).not.toBe(createKey);
    expect(outcome).toEqual({
      type: 'saved',
      id: 'qt-new',
      navigateTo: '/trade/documents/quotations/qt-new',
      toastKey: 'tdpg.toast.quotationSaved',
    });
  });

  it('stays on the new quotation URL when createQuotation succeeds and revision fails', async () => {
    const api = makeSaveApi();
    const q = makeQuotation();
    const draft = toDraft('quotation', q);
    vi.mocked(api.createQuotation).mockResolvedValue({ ...q, id: 'qt-new', version: 1 });
    vi.mocked(api.createQuotationRevision).mockRejectedValue(
      new ApiError(409, 'TRADE.QUOTE.PRICING_CHANGED'),
    );

    const outcome = await saveDocument(
      {
        kind: 'quotation',
        mode: 'new',
        draft,
        loaded: emptyDraft('quotation'),
        detail: null,
        sourceId: null,
        sourceVersion: null,
        fingerprint: 'fp_old',
        confirm: vi.fn().mockResolvedValue(true),
      },
      api,
    );

    expect(outcome).toEqual({
      type: 'pricingChanged',
      navigateTo: '/trade/documents/quotations/qt-new',
    });
  });

  it('asks confirmation before creating a new revision on a SENT quotation and chains updated version', async () => {
    const api = makeSaveApi();
    const sent = makeQuotation({ lifecycleStatus: 'SENT', version: 5 });
    const loaded = toDraft('quotation', sent);
    const edited = undoDraft(loaded);
    edited.lines[0].quantity = '4';

    const declineConfirm = vi.fn().mockResolvedValue(false);
    const declined = await saveDocument(
      {
        kind: 'quotation',
        mode: 'edit',
        draft: edited,
        loaded,
        detail: sent,
        sourceId: null,
        sourceVersion: null,
        fingerprint: 'fp_sent',
        confirm: declineConfirm,
      },
      api,
    );
    expect(declineConfirm).toHaveBeenCalledWith(
      'tdpg.confirm.newRevision.title',
      'tdpg.confirm.newRevision.text',
    );
    expect(declined).toEqual({ type: 'cancelled' });
    expect(api.createQuotationRevision).not.toHaveBeenCalled();

    const editedBoth = undoDraft(edited);
    editedBoth.header['draftReference'] = 'REF-UPDATED';
    vi.mocked(api.updateQuotation).mockResolvedValue({ ...sent, version: 6 });
    vi.mocked(api.createQuotationRevision).mockResolvedValue({
      ...sent.revisions[0],
      quotation: { id: sent.id, version: 7, lifecycleStatus: 'DRAFT', currentRevisionId: 'rev-2' },
    });

    const accepted = await saveDocument(
      {
        kind: 'quotation',
        mode: 'edit',
        draft: editedBoth,
        loaded,
        detail: sent,
        sourceId: null,
        sourceVersion: null,
        fingerprint: 'fp_sent',
        confirm: vi.fn().mockResolvedValue(true),
      },
      api,
    );
    expect(api.updateQuotation).toHaveBeenCalledWith('qt-10', 5, { draftReference: 'REF-UPDATED' }, ANY_KEY);
    expect(api.createQuotationRevision).toHaveBeenCalledWith('qt-10', 6, expect.any(Object), ANY_KEY);
    expect(accepted).toEqual({
      type: 'saved',
      id: 'qt-10',
      navigateTo: null,
      toastKey: 'tdpg.toast.quotationSaved',
    });
  });

  it('handles sales-order edit (header + PUT lines) and convert-quotation', async () => {
    const api = makeSaveApi();
    const so = makeSalesOrder({ version: 2 });
    const loaded = toDraft('sales-order', so);
    const edited = undoDraft(loaded);
    edited.header['draftReference'] = 'SO-NEW-REF';
    edited.lines[0].chargeTotal = '50';

    vi.mocked(api.updateSalesOrder).mockResolvedValue({ ...so, version: 3 });
    vi.mocked(api.replaceOrderLines).mockResolvedValue({ ...so, version: 4 });

    const editOutcome = await saveDocument(
      {
        kind: 'sales-order',
        mode: 'edit',
        draft: edited,
        loaded,
        detail: so,
        sourceId: null,
        sourceVersion: null,
        fingerprint: 'fp_so',
        confirm: vi.fn().mockResolvedValue(true),
      },
      api,
    );
    expect(api.updateSalesOrder).toHaveBeenCalledWith('so-10', 2, { draftReference: 'SO-NEW-REF' }, ANY_KEY);
    expect(api.replaceOrderLines).toHaveBeenCalledWith(
      'sales-order',
      'so-10',
      3,
      expect.objectContaining({ expectedPricingFingerprint: 'fp_so' }),
      ANY_KEY,
    );
    expect(editOutcome).toEqual({
      type: 'saved',
      id: 'so-10',
      navigateTo: null,
      toastKey: 'tdpg.toast.salesOrderSaved',
    });

    const acceptedQ = makeQuotation({ lifecycleStatus: 'ACCEPTED', acceptedRevisionId: 'rev-1', version: 4 });
    const convertDraft = draftFromQuotation(acceptedQ);
    vi.mocked(api.convertQuotation).mockResolvedValue({ ...so, id: 'so-converted' });
    const convOutcome = await saveDocument(
      {
        kind: 'sales-order',
        mode: 'convert-quotation',
        draft: convertDraft,
        loaded: convertDraft,
        detail: acceptedQ,
        sourceId: acceptedQ.id,
        sourceVersion: acceptedQ.version,
        fingerprint: null,
        confirm: vi.fn().mockResolvedValue(true),
      },
      api,
    );
    expect(convOutcome).toEqual({
      type: 'saved',
      id: 'so-converted',
      navigateTo: '/trade/documents/sales-orders/so-converted',
      toastKey: 'tdpg.toast.salesOrderCreated',
    });
  });

  it('handles purchase-order edit (resubmit toast) and convert-purchase-quotation', async () => {
    const api = makeSaveApi();
    const po = makePurchaseOrder({ version: 2 });
    const loaded = toDraft('purchase-order', po);
    const edited = undoDraft(loaded);
    edited.lines[0].chargeTotal = '25';
    vi.mocked(api.replaceOrderLines).mockResolvedValue({ ...po, version: 3 });

    const editOutcome = await saveDocument(
      {
        kind: 'purchase-order',
        mode: 'edit',
        draft: edited,
        loaded,
        detail: po,
        sourceId: null,
        sourceVersion: null,
        fingerprint: 'fp_po',
        confirm: vi.fn().mockResolvedValue(true),
      },
      api,
    );
    expect(api.updatePurchaseOrder).not.toHaveBeenCalled();
    expect(api.replaceOrderLines).toHaveBeenCalledWith(
      'purchase-order',
      'po-10',
      2,
      expect.objectContaining({ expectedPricingFingerprint: 'fp_po' }),
      ANY_KEY,
    );
    expect(editOutcome).toEqual({
      type: 'saved',
      id: 'po-10',
      navigateTo: null,
      toastKey: 'tdpg.toast.purchaseOrderSavedResubmit',
    });

    const pq = makePurchaseQuotation({ lifecycleStatus: 'ISSUED', version: 3 });
    const pqDraft = draftFromPurchaseQuotation(pq);
    pqDraft.header['supplierAccountId'] = 'sup-acc-gulf-egp';
    pqDraft.header['receivingNodeId'] = 'node-wh-01';
    pqDraft.lines[0].tax = { category: 'STANDARD', rateBps: 1400 };
    vi.mocked(api.convertPurchaseQuotation).mockResolvedValue({ ...po, id: 'po-from-pq' });

    const convOutcome = await saveDocument(
      {
        kind: 'purchase-order',
        mode: 'convert-purchase-quotation',
        draft: pqDraft,
        loaded: draftFromPurchaseQuotation(pq),
        detail: pq,
        sourceId: pq.id,
        sourceVersion: pq.version,
        fingerprint: null,
        confirm: vi.fn().mockResolvedValue(true),
      },
      api,
    );
    expect(convOutcome).toEqual({
      type: 'saved',
      id: 'po-from-pq',
      navigateTo: '/trade/documents/purchase-orders/po-from-pq',
      toastKey: 'tdpg.toast.purchaseOrderCreated',
    });
  });

  it('maps 409 and 422 API errors to exact SaveOutcome variants', async () => {
    const runWithError = async (err: unknown, mode: 'new' | 'edit' | 'convert-quotation' | 'convert-purchase-quotation' = 'new') => {
      const api = makeSaveApi();
      const q = makeQuotation({ lifecycleStatus: 'ACCEPTED', acceptedRevisionId: 'rev-1' });
      const pq = makePurchaseQuotation({ lifecycleStatus: 'ISSUED' });
      let draft: DocumentDraft;
      let loadedDraft: DocumentDraft | null = null;
      let kind: 'quotation' | 'sales-order' | 'purchase-order' | 'purchase-quotation' = 'quotation';
      if (mode === 'convert-quotation') {
        kind = 'sales-order';
        draft = draftFromQuotation(q);
        vi.mocked(api.convertQuotation).mockRejectedValue(err);
      } else if (mode === 'convert-purchase-quotation') {
        kind = 'purchase-order';
        draft = draftFromPurchaseQuotation(pq);
        draft.header['supplierAccountId'] = 'sup-acc-gulf-egp';
        draft.header['receivingNodeId'] = 'node-wh-01';
        draft.lines[0].tax = { category: 'STANDARD', rateBps: 1400 };
        vi.mocked(api.convertPurchaseQuotation).mockRejectedValue(err);
      } else if (mode === 'edit') {
        kind = 'sales-order';
        const so = makeSalesOrder();
        draft = toDraft('sales-order', so);
        loadedDraft = toDraft('sales-order', so);
        draft.header['draftReference'] = 'X';
        vi.mocked(api.updateSalesOrder).mockRejectedValue(err);
      } else {
        kind = 'sales-order';
        draft = toDraft('sales-order', makeSalesOrder());
        vi.mocked(api.createSalesOrder).mockRejectedValue(err);
      }

      return saveDocument(
        {
          kind,
          mode,
          draft,
          loaded: loadedDraft ?? draft,
          detail: mode === 'convert-quotation' ? q : mode === 'convert-purchase-quotation' ? pq : makeSalesOrder(),
          sourceId: mode === 'convert-quotation' ? q.id : pq.id,
          sourceVersion: 1,
          fingerprint: 'fp',
          confirm: vi.fn().mockResolvedValue(true),
        },
        api,
      );
    };

    expect(await runWithError(new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION'), 'edit')).toEqual({
      type: 'conflict',
    });

    expect(await runWithError(new ApiError(409, 'TRADE.PRICE.PREVIEW_CHANGED'), 'new')).toEqual({
      type: 'pricingChanged',
    });

    expect(
      await runWithError(
        new ApiError(409, 'TRADE.QUOTE.ALREADY_CONVERTED', { salesOrderId: ['so-88'] }),
        'convert-quotation',
      ),
    ).toEqual({
      type: 'redirect',
      url: '/trade/documents/sales-orders/so-88',
      toastKey: 'tdpg.toast.quotationAlreadyConverted',
    });

    expect(
      await runWithError(
        new ApiError(409, 'TRADE.PURCHASE_QUOTATION.ALREADY_CONVERTED', { purchaseOrderId: ['po-88'] }),
        'convert-purchase-quotation',
      ),
    ).toEqual({
      type: 'redirect',
      url: '/trade/documents/purchase-orders/po-88',
      toastKey: 'tdpg.toast.purchaseQuotationAlreadyConverted',
    });

    expect(
      await runWithError(
        new ApiError(422, 'TRADE.QUOTE.DISCOUNT_EXCEEDS_ALLOWED', {
          clientLineId: ['cl-so-1'],
          maxDiscountPercent: ['10'],
        }),
        'new',
      ),
    ).toEqual({
      type: 'invalid',
      fieldErrors: {},
      lineErrors: { 'cl-so-1': 'tdlines.maxLimit' },
      lineErrorParams: { 'cl-so-1': { max: '10' } },
    });

    expect(await runWithError(new ApiError(422, 'TRADE.QUOTE.VALIDITY_INVALID'), 'new')).toEqual({
      type: 'invalid',
      fieldErrors: { validUntil: 'td.errors.TRADE.QUOTE.VALIDITY_INVALID' },
      lineErrors: {},
    });

    expect(await runWithError(new ApiError(422, 'VALIDITY_INVALID'), 'new')).toEqual({
      type: 'invalid',
      fieldErrors: { validUntil: 'td.errors.TRADE.QUOTE.VALIDITY_INVALID' },
      lineErrors: {},
    });

    expect(
      await runWithError(new ApiError(422, 'TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE'), 'new'),
    ).toEqual({
      type: 'error',
      code: 'TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE',
    });

    expect(await runWithError(new Error('network down'), 'new')).toEqual({
      type: 'error',
      code: 'generic',
    });
  });

  it('maps 403 forbidden, TRADE.PRICE.*, discount family, customer eligibility, tax default, and inventory errors in saveDocument', async () => {
    const runSaveErr = async (
      err: unknown,
      opts?: { mode?: 'new' | 'edit'; scope?: 'LINE' | 'DOCUMENT' },
    ) => {
      const api = makeSaveApi();
      const so = makeSalesOrder();
      const draft = toDraft('sales-order', so);
      if (opts?.scope === 'DOCUMENT') {
        draft.pricing = { mode: 'DISCOUNT', scope: 'DOCUMENT', value: '10' };
      }
      vi.mocked(api.createSalesOrder).mockRejectedValue(err);
      return saveDocument(
        {
          kind: 'sales-order',
          mode: 'new',
          draft,
          loaded: draft,
          detail: so,
          sourceId: null,
          sourceVersion: null,
          fingerprint: 'fp',
          confirm: vi.fn().mockResolvedValue(true),
        },
        api,
      );
    };

    expect(await runSaveErr(new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'))).toEqual({ type: 'forbidden' });
    expect(await runSaveErr(new ApiError(409, 'TRADE.QUOTE.PRICE_LOCKED'))).toEqual({
      type: 'pricingChanged',
      toastKey: 'tdpg.toast.priceLockReload',
    });
    expect(await runSaveErr(new ApiError(422, 'TRADE.PRICE.PREVIEW_REQUIRED'))).toEqual({ type: 'pricingChanged' });
    expect(await runSaveErr(new ApiError(409, 'TRADE.PRICE.PREVIEW_EXPIRED'))).toEqual({ type: 'pricingChanged' });
    expect(await runSaveErr(new ApiError(422, 'TRADE.PRICE.PREVIEW_EMPTY'))).toEqual({ type: 'pricingChanged' });
    expect(await runSaveErr(new ApiError(422, 'TRADE.PRICE.COST_UNAVAILABLE'))).toEqual({
      type: 'costUnavailable',
      code: 'TRADE.PRICE.COST_UNAVAILABLE',
    });

    for (const code of ['LOCK_INVALID', 'LOCK_EXPIRED', 'LOCK_CONTEXT_MISMATCH', 'LOCK_DATA_INVALID']) {
      expect(await runSaveErr(new ApiError(409, `TRADE.PRICE.${code}`))).toEqual({
        type: 'pricingChanged', toastKey: 'tdpg.toast.priceLockReload',
      });
    }
    expect(await runSaveErr(new ApiError(409, 'TRADE.PRICE.PREVIEW_CHANGED'))).toEqual({ type: 'pricingChanged' });
    for (const code of ['CURRENCY_INACTIVE', 'FX_UNAVAILABLE']) {
      expect(await runSaveErr(new ApiError(422, `TRADE.PRICE.${code}`))).toEqual({
        type: 'invalid', fieldErrors: { currencyCode: `tdpg.errors.TRADE.PRICE.${code}` }, lineErrors: {},
      });
    }

    for (const pbCode of [
      'TRADE.PRICE.BOOK_REQUIRED',
      'TRADE.PRICE.BOOK_OVERRIDE_FORBIDDEN',
      'TRADE.PRICE.PRICE_BOOK_REQUIRED',
      'TRADE.PRICE.PRICE_BOOK_CURRENCY_MISMATCH',
      'TRADE.PRICE.PRICE_BOOK_NOT_FOUND',
      'TRADE.PRICE.PRICE_BOOK_INACTIVE',
    ] as const) {
      expect(await runSaveErr(new ApiError(422, pbCode))).toEqual({
        type: 'invalid',
        fieldErrors: { priceBookId: `tdpg.errors.${pbCode}` },
        lineErrors: {},
      });
    }

    for (const priceLineCode of [
      'TRADE.PRICE.MARGIN_GUARD',
      'TRADE.PRICE.OVERRIDE_REJECTED',
      'TRADE.PRICE.RULE_SELECTION_INVALID',
      'TRADE.PRICE.NOT_PRICED_IN_CURRENCY',
      'TRADE.PRICE.NOT_FOUND',
      'TRADE.PRICE.CATALOG_UNAVAILABLE',
      'TRADE.PRICE.NO_ACTIVE_VERSION',
      'TRADE.PRICE.CONFLICTING_ACTIVE_VERSIONS',
      'TRADE.PRICE.RULE_INACTIVE',
      'TRADE.PRICE.QUANTITY_MISMATCH',
      'TRADE.PRICE.INVALID_PRICING_TARGET',
      'TRADE.PRICE.MULTIPLE_RULES_MATCH',
    ] as const) {
      expect(await runSaveErr(new ApiError(422, priceLineCode, { lineIndex: ['0'] }))).toEqual({
        type: 'invalid',
        fieldErrors: {},
        lineErrors: { 'cl-so-1': `tdpg.errors.${priceLineCode}` },
      });
    }

    for (const discCode of [
      'TRADE.QUOTE.DISCOUNT_FREE_NOT_ALLOWED',
      'TRADE.QUOTE.DISCOUNT_INVALID',
      'TRADE.QUOTE.DISCOUNT_LIMIT_CONFLICT',
      'TRADE.QUOTE.DISCOUNT_LIMIT_INVALID',
      'TRADE.QUOTE.DISCOUNT_LIMIT_NOT_FOUND',
      'TRADE.QUOTE.DISCOUNT_LIMIT_REQUIRED',
      'TRADE.QUOTE.DISCOUNT_PERCENT_INVALID',
      'TRADE.QUOTE.DISCOUNT_AMOUNT_INVALID',
      'TRADE.QUOTE.DISCOUNT_NOT_POSITIVE',
      'TRADE.QUOTE.DISCOUNT_BELOW_COST',
      'TRADE.QUOTE.DISCOUNT_MARGIN_FLOOR',
    ] as const) {
      expect(await runSaveErr(new ApiError(422, discCode, { clientLineId: ['cl-so-1'] }))).toEqual({
        type: 'invalid',
        fieldErrors: {},
        lineErrors: { 'cl-so-1': `tdpg.errors.${discCode}` },
      });
      expect(await runSaveErr(new ApiError(422, discCode), { scope: 'DOCUMENT' })).toEqual({
        type: 'invalid',
        fieldErrors: { pricingValue: `tdpg.errors.${discCode}` },
        lineErrors: {},
      });
    }

    expect(await runSaveErr(new ApiError(422, 'TRADE.QUOTE.DISCOUNT_VALUE_REQUIRED'))).toEqual({
      type: 'invalid',
      fieldErrors: { pricingValue: 'tdpg.errors.TRADE.QUOTE.DISCOUNT_VALUE_REQUIRED' },
      lineErrors: {},
    });
    expect(await runSaveErr(new ApiError(422, 'TRADE.QUOTE.DISCOUNT_REASON_INVALID'))).toEqual({
      type: 'invalid',
      fieldErrors: { pricingReason: 'tdpg.errors.TRADE.QUOTE.DISCOUNT_REASON_INVALID' },
      lineErrors: {},
    });
    expect(await runSaveErr(new ApiError(422, 'TRADE.QUOTE.DISCOUNT_POLICY_FORBIDDEN'))).toEqual({
      type: 'error',
      code: 'TRADE.QUOTE.DISCOUNT_POLICY_FORBIDDEN',
    });
    expect(await runSaveErr(new ApiError(409, 'TRADE.QUOTE.DISCOUNT_RULE_CONFLICT'))).toEqual({
      type: 'error',
      code: 'TRADE.QUOTE.DISCOUNT_RULE_CONFLICT',
    });

    for (const custCode of [
      'TRADE.QUOTE.CUSTOMER_INVALID',
      'TRADE.QUOTE.CUSTOMER_AMBIGUOUS',
      'TRADE.QUOTE.CUSTOMER_ELIGIBILITY_UNAVAILABLE',
      'TRADE.SALES_ORDER.CUSTOMER_BLOCKED',
      'TRADE.CUSTOMER.NOT_FOUND',
      'TRADE.CUSTOMER.INACTIVE',
      'TRADE.CUSTOMER.ELIGIBLE_STATUS_REQUIRED',
    ] as const) {
      expect(await runSaveErr(new ApiError(422, custCode))).toEqual({
        type: 'invalid',
        fieldErrors: { partyId: `tdpg.errors.${custCode}` },
        lineErrors: {},
      });
    }

    expect(
      await runSaveErr(new ApiError(422, 'TRADE.QUOTE.TAX_DEFAULT_REQUIRED', { lineIndex: ['0'] })),
    ).toEqual({
      type: 'invalid',
      fieldErrors: {},
      lineErrors: { 'cl-so-1': 'tdpg.errors.TRADE.QUOTE.TAX_DEFAULT_REQUIRED' },
    });

    expect(
      await runSaveErr(new ApiError(422, 'TRADE.INVENTORY.INSUFFICIENT_AVAILABILITY', { clientLineId: ['cl-so-1'] })),
    ).toEqual({
      type: 'invalid',
      fieldErrors: {},
      lineErrors: { 'cl-so-1': 'tdpg.errors.TRADE.INVENTORY.INSUFFICIENT_AVAILABILITY' },
    });

    expect(
      await runSaveErr(new ApiError(422, 'TRADE.INVENTORY.OVER_RECEIPT', { clientLineId: ['cl-so-1'] })),
    ).toEqual({
      type: 'invalid',
      fieldErrors: {},
      lineErrors: { 'cl-so-1': 'tdpg.errors.TRADE.INVENTORY.OVER_RECEIPT' },
    });
  });

  it('forwards explicit ctx from SaveDocumentInput to API writes', async () => {
    const api = makeSaveApi();
    const q = makeQuotation();
    const loaded = toDraft('quotation', q);
    const edited = undoDraft(loaded);
    edited.header['draftReference'] = 'REF-UPDATED';
    const ctx = { companyId: 'c1', branchId: 'b1' };
    vi.mocked(api.updateQuotation).mockResolvedValue({ ...q, version: 3 });

    await saveDocumentWithKeys(
      {
        kind: 'quotation',
        mode: 'edit',
        draft: edited,
        loaded,
        detail: q,
        sourceId: null,
        sourceVersion: null,
        fingerprint: 'fp',
        confirm: vi.fn().mockResolvedValue(true),
        requestKeys: new DocumentRequestKeys(),
        ctx,
      },
      api,
    );
    expect(api.updateQuotation).toHaveBeenCalledWith(q.id, q.version, expect.any(Object), ANY_KEY, ctx);
  });
});

describe('document-commands', () => {
  it('runs quotation lifecycle, direct SO creation and openSalesOrder via listDocuments', async () => {
    const api = makeCommandApi();
    const q = makeQuotation({ version: 2 });
    const so = makeSalesOrder({ id: 'so-44', version: 1, sourceQuotationId: 'qt-10' });

    vi.mocked(api.quotationAction).mockResolvedValue({ ...q, lifecycleStatus: 'SENT', version: 3 });
    const sent = await runCommand({ kind: 'quotation', action: 'send', detail: q }, api);
    expect(sent).toEqual({
      type: 'done',
      toastKey: 'tdpg.toast.quotationSent',
      navigateTo: null,
      version: 3,
      detail: expect.objectContaining({ version: 3 }),
    });

    expect(api.quotationAction).toHaveBeenCalledWith('qt-10', 2, 'send', undefined, KEY);

    vi.mocked(api.quotationAction).mockResolvedValue({ ...q, lifecycleStatus: 'REJECTED', version: 4 });
    await runCommand(
      {
        kind: 'quotation',
        action: 'reject',
        detail: q,
        params: { reasonCode: 'PRICE_NOT_ACCEPTED', reasonNote: '  Too expensive  ' },
      },
      api,
    );
    expect(api.quotationAction).toHaveBeenLastCalledWith('qt-10', 2, 'reject', {
      reasonCode: 'PRICE_NOT_ACCEPTED',
      reasonNote: 'Too expensive',
    }, KEY);

    vi.mocked(api.createSalesOrderFromQuotation).mockResolvedValue(so);
    const directSo = await runCommand(
      { kind: 'quotation', action: 'createSalesOrderDirect', detail: q },
      api,
    );
    expect(api.createSalesOrderFromQuotation).toHaveBeenCalledWith('qt-10', 2, {}, KEY);
    expect(directSo).toEqual({
      type: 'done',
      toastKey: 'tdpg.toast.salesOrderCreated',
      navigateTo: '/trade/documents/sales-orders/so-44',
      version: 1,
      detail: so,
    });

    vi.mocked(api.listDocuments).mockResolvedValue({
      items: [so],
      total: 1,
      page: 1,
      limit: 100,
    });
    const openFound = await runCommand({ kind: 'quotation', action: 'openSalesOrder', detail: q }, api);
    expect(api.listDocuments).toHaveBeenCalledWith(
      'sales-order',
      {
        page: 1,
        limit: 100,
        partyId: 'pty-alnoor',
      },
      { companyId: 'c1', branchId: 'b1' },
    );
    expect(openFound).toEqual({
      type: 'done',
      toastKey: null,
      navigateTo: '/trade/documents/sales-orders/so-44',
    });

    vi.mocked(api.listDocuments).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 100,
    });
    const openFallback = await runCommand({ kind: 'quotation', action: 'openSalesOrder', detail: q }, api);
    expect(openFallback).toEqual({
      type: 'done',
      toastKey: null,
      navigateTo: '/trade/documents/sales-orders?partyId=pty-alnoor',
    });
  });

  it('runs sales order confirm (with and without unallocatedLines), hold, releaseHold and cancel', async () => {
    const api = makeCommandApi();
    const so = makeSalesOrder({ version: 2 });

    vi.mocked(api.confirmSalesOrder).mockResolvedValue({
      statusCode: 200,
      orderId: 'so-10',
      version: 3,
      lifecycleStatus: 'CONFIRMED',
      documentNumber: 'SO-2026-0010',
      unallocatedLines: ['cl-so-1', 'cl-so-2'],
    });
    const confirmedWithUnalloc = await runCommand(
      {
        kind: 'sales-order',
        action: 'confirm',
        detail: so,
        params: { requestedDeadline: '2026-12-01T14:00:00Z' },
      },
      api,
    );
    expect(api.confirmSalesOrder).toHaveBeenCalledWith('so-10', 2, '2026-12-01T14:00:00Z', KEY);
    expect(confirmedWithUnalloc).toEqual({
      type: 'done',
      toastKey: 'tdpg.toast.salesOrderConfirmed',
      navigateTo: null,
      version: 3,
      detail: expect.objectContaining({ documentNumber: 'SO-2026-0010' }),
      infoToastKey: 'tdpg.toast.unallocatedLines',
      infoToastParams: { n: 2 },
    });

    vi.mocked(api.salesOrderAction).mockResolvedValue({ ...so, holdStatus: 'HELD', version: 4 });
    const held = await runCommand(
      {
        kind: 'sales-order',
        action: 'hold',
        detail: so,
        params: { reasonCode: 'CREDIT_REVIEW', reasonNote: null },
      },
      api,
    );
    expect(api.salesOrderAction).toHaveBeenCalledWith('so-10', 2, 'hold', {
      reasonCode: 'CREDIT_REVIEW',
      reasonNote: null,
    }, KEY);
    expect(held).toMatchObject({ type: 'done', toastKey: 'tdpg.toast.salesOrderHeld', version: 4 });

    vi.mocked(api.salesOrderAction).mockResolvedValue({ ...so, holdStatus: 'NONE', version: 5 });
    const released = await runCommand(
      {
        kind: 'sales-order',
        action: 'releaseHold',
        detail: so,
        params: { reasonCode: 'ISSUE_RESOLVED', reasonNote: 'Cleared' },
      },
      api,
    );
    expect(api.salesOrderAction).toHaveBeenLastCalledWith('so-10', 2, 'release-hold', {
      reasonCode: 'ISSUE_RESOLVED',
      reasonNote: 'Cleared',
    }, KEY);
    expect(released).toMatchObject({ type: 'done', toastKey: 'tdpg.toast.salesOrderHoldReleased', version: 5 });
  });

  it('runs purchase order approval, confirm, cancel and retryDelivery', async () => {
    const api = makeCommandApi();
    const po = makePurchaseOrder({ version: 2 });

    vi.mocked(api.purchaseOrderAction).mockResolvedValue({ ...po, version: 3 });
    expect(await runCommand({ kind: 'purchase-order', action: 'submit', detail: po }, api)).toMatchObject({
      type: 'done',
      toastKey: 'tdpg.toast.purchaseOrderSubmitted',
      version: 3,
    });
    expect(await runCommand({ kind: 'purchase-order', action: 'withdraw', detail: po }, api)).toMatchObject({
      type: 'done',
      toastKey: 'tdpg.toast.purchaseOrderWithdrawn',
    });
    expect(await runCommand({ kind: 'purchase-order', action: 'approve', detail: po }, api)).toMatchObject({
      type: 'done',
      toastKey: 'tdpg.toast.purchaseOrderApproved',
    });

    await runCommand(
      {
        kind: 'purchase-order',
        action: 'poReject',
        detail: po,
        params: { reasonCode: 'BUDGET', reasonNote: 'Too high' },
      },
      api,
    );
    expect(api.purchaseOrderAction).toHaveBeenLastCalledWith('po-10', 2, 'reject', {
      reasonCode: 'BUDGET',
      reasonNote: 'Too high',
    }, KEY);

    expect(await runCommand({ kind: 'purchase-order', action: 'poConfirm', detail: po }, api)).toMatchObject({
      type: 'done',
      toastKey: 'tdpg.toast.purchaseOrderConfirmed',
    });

    await runCommand(
      {
        kind: 'purchase-order',
        action: 'cancel',
        detail: po,
        params: { reasonCode: 'DATA_ERROR', reasonNote: null },
      },
      api,
    );
    expect(api.purchaseOrderAction).toHaveBeenLastCalledWith('po-10', 2, 'cancel', {
      reasonCode: 'DATA_ERROR',
      reasonNote: null,
    }, KEY);

    vi.mocked(api.retryPurchaseDelivery).mockResolvedValue({ ...po, version: 4 });
    expect(
      await runCommand({ kind: 'purchase-order', action: 'retryDelivery', detail: po }, api),
    ).toMatchObject({
      type: 'done',
      toastKey: 'tdpg.toast.deliveryRetried',
      version: 4,
    });
    expect(api.retryPurchaseDelivery).toHaveBeenCalledWith('po-10', 2, KEY);
  });

  it('runs purchase quotation commands, deleteDraft across kinds, and print', async () => {
    const api = makeCommandApi();
    const pq = makePurchaseQuotation({ version: 1, convertedPurchaseOrderId: 'po-99' });
    const po = makePurchaseOrder({ id: 'po-from-pq', version: 1 });

    vi.mocked(api.issuePurchaseQuotation).mockResolvedValue({ ...pq, lifecycleStatus: 'ISSUED', version: 2 });
    expect(await runCommand({ kind: 'purchase-quotation', action: 'issue', detail: pq }, api)).toMatchObject({
      type: 'done',
      toastKey: 'tdpg.toast.purchaseQuotationIssued',
      version: 2,
    });

    expect(
      await runCommand({ kind: 'purchase-quotation', action: 'convertToPurchaseOrder', detail: pq }, api),
    ).toEqual({
      type: 'done',
      toastKey: null,
      navigateTo: '/trade/documents/purchase-orders/new?fromPurchaseQuotation=pq-10',
    });

    vi.mocked(api.createPurchaseOrderFromPurchaseQuotation).mockResolvedValue(po);
    const directPo = await runCommand(
      {
        kind: 'purchase-quotation',
        action: 'createPurchaseOrderDirect',
        detail: pq,
        params: { receivingNodeId: 'node-wh-02' },
      },
      api,
    );
    expect(api.createPurchaseOrderFromPurchaseQuotation).toHaveBeenCalledWith('pq-10', 1, {
      receivingNodeId: 'node-wh-02',
    }, KEY);
    expect(directPo).toEqual({
      type: 'done',
      toastKey: 'tdpg.toast.purchaseOrderCreated',
      navigateTo: '/trade/documents/purchase-orders/po-from-pq',
      version: 1,
      detail: po,
    });

    expect(
      await runCommand({ kind: 'purchase-quotation', action: 'openPurchaseOrder', detail: pq }, api),
    ).toEqual({
      type: 'done',
      toastKey: null,
      navigateTo: '/trade/documents/purchase-orders/po-99',
    });

    vi.mocked(api.cancelPurchaseQuotation).mockResolvedValue({
      ...pq,
      lifecycleStatus: 'CANCELLED',
      version: 2,
    });
    await runCommand(
      {
        kind: 'purchase-quotation',
        action: 'pqCancel',
        detail: pq,
        params: { reasonCode: 'OTHER', reasonNote: 'Vendor withdrew' },
      },
      api,
    );
    expect(api.cancelPurchaseQuotation).toHaveBeenCalledWith('pq-10', 1, {
      reasonCode: 'OTHER',
      reasonNote: 'Vendor withdrew',
    }, KEY);

    vi.mocked(api.deleteDocument).mockResolvedValue(undefined);
    expect(await runCommand({ kind: 'quotation', action: 'deleteDraft', detail: makeQuotation() }, api)).toEqual({
      type: 'done',
      toastKey: 'tdpg.toast.draftDeleted',
      navigateTo: '/trade/documents/quotations',
    });
    expect(await runCommand({ kind: 'purchase-order', action: 'deleteDraft', detail: po }, api)).toEqual({
      type: 'done',
      toastKey: 'tdpg.toast.draftDeleted',
      navigateTo: '/trade/documents/purchase-orders',
    });
    expect(api.deleteDocument).toHaveBeenLastCalledWith('purchase-order', 'po-from-pq', 1, KEY);

    expect(await runCommand({ kind: 'quotation', action: 'print', detail: makeQuotation() }, api)).toEqual({
      type: 'done',
      toastKey: null,
      navigateTo: null,
    });
  });

  it('maps 409 stale version, 409 price lock expired, 422 tax default required and generic errors', async () => {
    const api = makeCommandApi();
    const q = makeQuotation();

    vi.mocked(api.quotationAction).mockRejectedValueOnce(
      new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION'),
    );
    expect(await runCommand({ kind: 'quotation', action: 'send', detail: q }, api)).toEqual({
      type: 'conflict',
    });

    vi.mocked(api.quotationAction).mockRejectedValueOnce(new ApiError(409, 'TRADE.PRICE.LOCK_EXPIRED'));
    expect(await runCommand({ kind: 'quotation', action: 'accept', detail: q }, api)).toEqual({
      type: 'error',
      code: 'TRADE.PRICE.LOCK_EXPIRED',
    });

    vi.mocked(api.createSalesOrderFromQuotation).mockRejectedValueOnce(
      new ApiError(422, 'TRADE.QUOTE.TAX_DEFAULT_REQUIRED', { clientLineId: ['cl-1'] }),
    );
    expect(
      await runCommand({ kind: 'quotation', action: 'createSalesOrderDirect', detail: q }, api),
    ).toEqual({
      type: 'error',
      code: 'TRADE.QUOTE.TAX_DEFAULT_REQUIRED',
      details: { clientLineId: ['cl-1'] },
    });

    vi.mocked(api.deleteDocument).mockRejectedValueOnce(new Error('boom'));
    expect(await runCommand({ kind: 'quotation', action: 'deleteDraft', detail: q }, api)).toEqual({
      type: 'error',
      code: 'generic',
    });
  });

  it('maps 403 forbidden, TRADE.QUOTE.EXPIRED, SO/PO CONFIRM_NOT_ALLOWED, inventory/tax errors, and forwards ctx in runCommand', async () => {
    const api = makeCommandApi();
    const q = makeQuotation();
    const so = makeSalesOrder();
    const po = makePurchaseOrder();
    const ctx = { companyId: 'c1', branchId: 'b1' };

    vi.mocked(api.quotationAction).mockRejectedValueOnce(new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
    expect(await runCommand({ kind: 'quotation', action: 'send', detail: q, ctx }, api)).toEqual({
      type: 'forbidden',
    });
    expect(api.quotationAction).toHaveBeenCalledWith(q.id, q.version, 'send', undefined, KEY, ctx);

    vi.mocked(api.quotationAction).mockRejectedValueOnce(new ApiError(422, 'TRADE.QUOTE.EXPIRED'));
    expect(await runCommand({ kind: 'quotation', action: 'accept', detail: q }, api)).toEqual({
      type: 'error',
      code: 'TRADE.QUOTE.EXPIRED',
    });

    vi.mocked(api.confirmSalesOrder).mockRejectedValueOnce(
      new ApiError(409, 'TRADE.SALES_ORDER.CONFIRM_NOT_ALLOWED'),
    );
    expect(await runCommand({ kind: 'sales-order', action: 'confirm', detail: so }, api)).toEqual({
      type: 'error',
      code: 'TRADE.SALES_ORDER.CONFIRM_NOT_ALLOWED',
    });

    vi.mocked(api.purchaseOrderAction).mockRejectedValueOnce(
      new ApiError(409, 'TRADE.PO.CONFIRM_NOT_ALLOWED'),
    );
    expect(await runCommand({ kind: 'purchase-order', action: 'poConfirm', detail: po }, api)).toEqual({
      type: 'error',
      code: 'TRADE.PO.CONFIRM_NOT_ALLOWED',
    });

    vi.mocked(api.confirmSalesOrder).mockRejectedValueOnce(
      new ApiError(422, 'TRADE.INVENTORY.INSUFFICIENT_AVAILABILITY', { lineIndex: ['0'] }),
    );
    expect(await runCommand({ kind: 'sales-order', action: 'confirm', detail: so, ctx }, api)).toEqual({
      type: 'error',
      code: 'TRADE.INVENTORY.INSUFFICIENT_AVAILABILITY',
      details: { lineIndex: ['0'] },
    });
    expect(api.confirmSalesOrder).toHaveBeenLastCalledWith(so.id, so.version, undefined, KEY, ctx);

    vi.mocked(api.retryPurchaseDelivery).mockRejectedValueOnce(
      new ApiError(422, 'TRADE.INVENTORY.OVER_RECEIPT', { clientLineId: ['cl-po-1'] }),
    );
    expect(await runCommand({ kind: 'purchase-order', action: 'retryDelivery', detail: po }, api)).toEqual({
      type: 'error',
      code: 'TRADE.INVENTORY.OVER_RECEIPT',
      details: { clientLineId: ['cl-po-1'] },
    });
  });
});
