import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../shared/trade-api';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import type {
  PurchaseOrderDetail,
  PurchaseQuotationDetail,
  QuotationDetail,
  SalesOrderDetail,
} from '../shared/document.model';
import {
  cancelPurchaseQuotation,
  confirmSalesOrder,
  convertPurchaseQuotation,
  convertQuotation,
  createPurchaseOrder,
  createPurchaseOrderFromPurchaseQuotation,
  createPurchaseQuotation,
  createQuotation,
  createQuotationRevision,
  createSalesOrder,
  createSalesOrderFromQuotation,
  deleteDocument,
  issuePurchaseQuotation,
  previewOrderPricing,
  purchaseOrderAction,
  quotationAction,
  replaceOrderLines,
  retryPurchaseDelivery,
  salesOrderAction,
  updatePurchaseOrder,
  updatePurchaseQuotation,
  updateQuotation,
  updateSalesOrder,
} from '../shared/documents.api';

const KEY = '019a0000-0000-7000-8000-000000000099';
const CTX = {
  companyId: '019a0000-0000-7000-8000-000000000001',
  branchId: '019a0000-0000-7000-8000-000000000002',
};

const financial = {
  subtotal: '30.015', taxableBase: '30.015', discountTotal: '0', chargeTotal: '0',
  taxTotal: '4.2021', lineTotal: '34.2171', inclusiveTax: false,
  taxSnapshot: { category: 'STANDARD' as const, rateBps: 1400, taxableBase: '30.015', taxAmount: '4.2021', currencyCode: 'EGP' },
};
const wireFinancial = { discountTotal: '0', chargeTotal: '0', taxTotal: '4.2021', lineTotal: '34.2171', taxSnapshot: financial.taxSnapshot };
const totals = { subtotal: '30.015', discountTotal: '0', chargeTotal: '0', taxTotal: '4.2021', roundingTotal: '0.0029', grandTotal: '34.22', amountPaid: '0', amountDue: '34.22' };
const line = { clientLineId: 'cl-1', itemId: 'itm-1', uomId: 'uom-1', quantity: '3' };
const orderBody = { lines: [{ ...line, financial }], totals, termSelections: {} };
const wireOrder = { lines: [{ ...line, financial: wireFinancial }], totals, termSelections: {} };
const reason = { reasonCode: 'OTHER', reasonNote: 'Stopped' };

interface WriteCase {
  name: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body: unknown;
  create?: boolean;
  call: () => Promise<unknown>;
}

const writeCases: WriteCase[] = [
  { name: 'createQuotation', method: 'POST', path: '/quotations', body: { partyId: 'pty-1', currencyCode: 'EGP' }, create: true, call: () => createQuotation({ partyId: 'pty-1', currencyCode: 'EGP' }, KEY, CTX) },
  { name: 'updateQuotation', method: 'PATCH', path: '/quotations/doc', body: { draftReference: 'REF' }, call: () => updateQuotation('doc', 7, { draftReference: 'REF' }, KEY, CTX) },
  { name: 'createQuotationRevision', method: 'POST', path: '/quotations/doc/revisions', body: { validUntil: '2026-12-31', lines: [line], pricing: { mode: 'NONE' }, termSelections: { paymentTermId: 'pay' } }, call: () => createQuotationRevision('doc', 7, { validUntil: '2026-12-31', lines: [line], pricing: { mode: 'NONE' }, termSelections: { paymentTermId: 'pay', deliveryTermId: undefined } }, KEY, CTX) },
  ...(['send', 'accept', 'reject', 'cancel'] as const).map((action): WriteCase => ({ name: `quotationAction:${action}`, method: 'POST', path: `/quotations/doc/${action}`, body: action === 'send' || action === 'accept' ? undefined : reason, call: () => quotationAction('doc', 7, action, reason, KEY, CTX) })),
  { name: 'convertQuotation', method: 'POST', path: '/quotations/doc/convert-to-sales-order', body: { lines: [{ clientLineId: 'cl-1', financial: wireFinancial }], totals }, call: () => convertQuotation('doc', 7, { lines: [{ clientLineId: 'cl-1', financial }], totals }, KEY, CTX) },
  { name: 'createSalesOrderFromQuotation', method: 'POST', path: '/quotations/doc/create-sales-order', body: {}, call: () => createSalesOrderFromQuotation('doc', 7, {}, KEY, CTX) },
  { name: 'createSalesOrder', method: 'POST', path: '/sales-orders', body: { partyId: 'pty-1', currencyCode: 'EGP', ...wireOrder }, create: true, call: () => createSalesOrder({ partyId: 'pty-1', currencyCode: 'EGP', ...orderBody }, KEY, CTX) },
  { name: 'updateSalesOrder', method: 'PATCH', path: '/sales-orders/doc', body: { draftReference: 'REF' }, call: () => updateSalesOrder('doc', 7, { draftReference: 'REF' }, KEY, CTX) },
  { name: 'confirmSalesOrder', method: 'POST', path: '/sales-orders/doc/confirm', body: {}, call: () => confirmSalesOrder('doc', 7, undefined, KEY, CTX) },
  ...(['hold', 'release-hold', 'cancel'] as const).map((action): WriteCase => ({ name: `salesOrderAction:${action}`, method: 'POST', path: `/sales-orders/doc/${action}`, body: reason, call: () => salesOrderAction('doc', 7, action, reason, KEY, CTX) })),
  { name: 'createPurchaseOrder', method: 'POST', path: '/purchase-orders', body: { supplierPartyId: 'sup', supplierAccountId: 'acc', receivingNodeId: 'node', currencyCode: 'EGP', ...wireOrder }, create: true, call: () => createPurchaseOrder({ supplierPartyId: 'sup', supplierAccountId: 'acc', receivingNodeId: 'node', currencyCode: 'EGP', ...orderBody }, KEY, CTX) },
  { name: 'updatePurchaseOrder', method: 'PATCH', path: '/purchase-orders/doc', body: { receivingNodeId: 'node' }, call: () => updatePurchaseOrder('doc', 7, { receivingNodeId: 'node' }, KEY, CTX) },
  ...(['submit', 'withdraw', 'approve', 'reject', 'confirm', 'cancel'] as const).map((action): WriteCase => ({ name: `purchaseOrderAction:${action}`, method: 'POST', path: `/purchase-orders/doc/${action}`, body: reason, call: () => purchaseOrderAction('doc', 7, action, reason, KEY, CTX) })),
  { name: 'retryPurchaseDelivery', method: 'POST', path: '/purchase-orders/doc/delivery/retry', body: undefined, call: () => retryPurchaseDelivery('doc', 7, KEY, CTX) },
  { name: 'createPurchaseQuotation', method: 'POST', path: '/purchase-quotations', body: { supplierPartyId: 'sup', currencyCode: 'EGP', validUntil: '2026-12-31', lines: [line] }, create: true, call: () => createPurchaseQuotation({ supplierPartyId: 'sup', currencyCode: 'EGP', validUntil: '2026-12-31', lines: [line] }, KEY, CTX) },
  { name: 'updatePurchaseQuotation', method: 'PATCH', path: '/purchase-quotations/doc', body: { notes: '' }, call: () => updatePurchaseQuotation('doc', 7, { notes: '' }, KEY, CTX) },
  { name: 'issuePurchaseQuotation', method: 'POST', path: '/purchase-quotations/doc/issue', body: undefined, call: () => issuePurchaseQuotation('doc', 7, KEY, CTX) },
  { name: 'cancelPurchaseQuotation', method: 'POST', path: '/purchase-quotations/doc/cancel', body: reason, call: () => cancelPurchaseQuotation('doc', 7, reason, KEY, CTX) },
  { name: 'convertPurchaseQuotation', method: 'POST', path: '/purchase-quotations/doc/convert-to-purchase-order', body: { supplierAccountId: 'acc', receivingNodeId: 'node', lines: [{ clientLineId: 'cl-1', financial: wireFinancial }], totals }, call: () => convertPurchaseQuotation('doc', 7, { supplierAccountId: 'acc', receivingNodeId: 'node', lines: [{ clientLineId: 'cl-1', financial }], totals }, KEY, CTX) },
  { name: 'createPurchaseOrderFromPurchaseQuotation', method: 'POST', path: '/purchase-quotations/doc/create-purchase-order', body: { receivingNodeId: 'node' }, call: () => createPurchaseOrderFromPurchaseQuotation('doc', 7, { receivingNodeId: 'node' }, KEY, CTX) },
  ...(['quotation', 'sales-order', 'purchase-order', 'purchase-quotation'] as const).map((kind): WriteCase => ({ name: `deleteDocument:${kind}`, method: 'DELETE', path: `/${kind === 'quotation' ? 'quotations' : kind === 'sales-order' ? 'sales-orders' : kind === 'purchase-order' ? 'purchase-orders' : 'purchase-quotations'}/doc`, body: undefined, call: () => deleteDocument(kind, 'doc', 7, KEY, CTX) })),
  ...(['sales-order', 'purchase-order'] as const).map((kind): WriteCase => ({ name: `replaceOrderLines:${kind}`, method: 'PUT', path: `/${kind === 'sales-order' ? 'sales-orders' : 'purchase-orders'}/doc/lines`, body: wireOrder, call: () => replaceOrderLines(kind, 'doc', 7, orderBody, KEY, CTX) })),
];

function makeQuotationDetail(): QuotationDetail {
  return {
    id: 'qt-1',
    version: 3,
    companyId: CTX.companyId,
    branchId: CTX.branchId,
    partyId: 'pty-1',
    contactPartyId: null,
    currencyCode: 'EGP',
    businessDate: '2026-11-23',
    lifecycleStatus: 'DRAFT',
    documentNumber: 'QT-1',
    draftReference: null,
    grandTotal: '100',
    partySnapshot: { id: 'pty-1', displayName: 'Customer' },
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
    extensionValues: {},
    currentRevisionId: 'rev-1',
    acceptedRevisionId: null,
    crmCustomerProfileId: null,
    approvalStatus: 'NOT_REQUIRED',
    sourceCrmOpportunityId: null,
    currentRevision: {
      id: 'rev-1',
      revisionNumber: 1,
      status: 'DRAFT',
      validUntil: '2026-12-31',
      priceLockExpiresAt: null,
    },
    revisions: [],
    currentLines: [],
    reasonHistory: [],
  };
}

function makeSalesOrderDetail(): SalesOrderDetail {
  return {
    id: 'so-1',
    version: 4,
    companyId: CTX.companyId,
    branchId: CTX.branchId,
    partyId: 'pty-1',
    contactPartyId: null,
    currencyCode: 'EGP',
    businessDate: '2026-11-23',
    lifecycleStatus: 'DRAFT',
    documentNumber: 'SO-1',
    draftReference: null,
    grandTotal: '100',
    partySnapshot: { id: 'pty-1', displayName: 'Customer' },
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
    extensionValues: {},
    confirmationStatus: 'NOT_STARTED',
    holdStatus: 'NONE',
    fulfillmentStatus: 'NONE',
    billingStatus: 'NONE',
    sourceQuotationId: null,
    sourceQuotationRevisionId: null,
    termsSnapshot: null,
    totalsSnapshot: null,
    lines: [],
    reasonHistory: [],
  };
}

function makePurchaseOrderDetail(): PurchaseOrderDetail {
  return {
    id: 'po-1',
    version: 2,
    companyId: CTX.companyId,
    branchId: CTX.branchId,
    partyId: 'sup-1',
    contactPartyId: null,
    currencyCode: 'EGP',
    businessDate: '2026-11-23',
    lifecycleStatus: 'DRAFT',
    documentNumber: 'PO-1',
    draftReference: null,
    grandTotal: '100',
    partySnapshot: { id: 'sup-1', displayName: 'Supplier' },
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
    extensionValues: {},
    approvalStatus: 'NOT_REQUIRED',
    dispatchStatus: 'NOT_REQUESTED',
    approvalReady: true,
    delivery: null,
    fulfillmentStatus: 'NONE',
    billingStatus: 'NONE',
    createdBy: null,
    receivingNodeId: 'node-1',
    supplierAccountId: 'sup-acc-1',
    sourcePurchaseQuotationId: null,
    termsSnapshot: null,
    totalsSnapshot: null,
    lines: [],
    reasonHistory: [],
  };
}

function makePurchaseQuotationDetail(): PurchaseQuotationDetail {
  return {
    id: 'pq-1',
    version: 5,
    companyId: CTX.companyId,
    branchId: CTX.branchId,
    partyId: 'sup-1',
    currencyCode: 'EGP',
    businessDate: '2026-11-23',
    lifecycleStatus: 'DRAFT',
    documentNumber: 'PQ-1',
    partySnapshot: { id: 'sup-1', displayName: 'Supplier' },
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
    reference: null,
    notes: null,
    validUntil: null,
    finalizedAt: null,
    convertedPurchaseOrderId: null,
    termsSnapshot: null,
    totalsSnapshot: null,
    lines: [],
    reasonHistory: [],
  };
}

describe('documents.api (DC-2 writes, commands, conversions, and D-2 preview arithmetic)', () => {
  let stub: TradeHttpStub;
  let dispose: () => void;

  beforeEach(() => {
    stub = new TradeHttpStub();
    dispose = bindTradeHttpForTest(stub);
  });

  afterEach(() => {
    dispose();
  });

  it.each(writeCases)('$name sends the exact DTO, key, scope, version and unwraps data', async (entry) => {
    const response = { id: 'returned', version: 8 };
    stub.register(entry.method, entry.path, response);
    const result = await entry.call();
    const writes = stub.recordedWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ method: entry.method, path: entry.path, key: KEY, scope: CTX });
    expect(writes[0].body).toEqual(entry.body);
    expect(writes[0].ifMatch).toBe(entry.create ? undefined : '"7"');
    if (entry.method !== 'DELETE') expect(result).toMatchObject(response);
  });

  it.each(writeCases)('$name preserves server field errors', async (entry) => {
    const error = new ApiError(422, 'TRADE.QUOTE.TAX_DEFAULT_REQUIRED', { clientLineId: ['cl-1'] });
    stub.register(entry.method, entry.path, error);
    await expect(entry.call()).rejects.toBe(error);
  });

  it('links all 5 quotation write and conversion endpoints with BRANCH scope, key, If-Match and S-1 terms', async () => {
    const q = makeQuotationDetail();
    const so = makeSalesOrderDetail();
    stub.register('POST', '/quotations', q);
    stub.register('PATCH', '/quotations/qt-1', q);
    stub.register('POST', '/quotations/qt-1/revisions', { id: 'rev-2', revisionNumber: 2 });
    stub.register('POST', '/quotations/qt-1/send', q);
    stub.register('POST', '/quotations/qt-1/reject', q);
    stub.register('POST', '/quotations/qt-1/convert-to-sales-order', so);
    stub.register('POST', '/quotations/qt-1/create-sales-order', so);

    await createQuotation(
      {
        partyId: 'pty-1',
        currencyCode: 'EGP',
      },
      KEY,
      CTX,
    );

    await updateQuotation('qt-1', 3, { draftReference: 'REF-2' }, KEY, CTX);

    await createQuotationRevision(
      'qt-1',
      3,
      {
        validUntil: '2026-12-31',
        pricing: { mode: 'NONE' },
        lines: [{ clientLineId: 'cl-1', itemId: 'itm-1', uomId: 'uom-1', quantity: '2' }],
        termSelections: { paymentTermId: 'term-pay-1', deliveryTermId: undefined, clauseIds: [] },
      },
      KEY,
      CTX,
    );

    await quotationAction('qt-1', 3, 'send', undefined, KEY, CTX);
    await quotationAction('qt-1', 3, 'reject', { reasonCode: 'PRICE', reasonNote: '   ' }, KEY, CTX);

    await convertQuotation(
      'qt-1',
      3,
      {
        lines: [
          {
            clientLineId: 'cl-1',
            financial: { subtotal: '100', taxableBase: '100', discountTotal: '0', chargeTotal: '5', taxTotal: '14', lineTotal: '119', inclusiveTax: false, taxSnapshot: { category: 'STANDARD', rateBps: 1400, taxableBase: '100', taxAmount: '14', currencyCode: 'EGP' } },
          },
        ],
        totals: { subtotal: '100', discountTotal: '0', chargeTotal: '5', taxTotal: '14', grandTotal: '119', roundingTotal: '0', amountPaid: '0', amountDue: '119' },
        termSelections: { paymentTermId: 'term-pay-1', warrantyTermId: undefined, clauseIds: [] },
      },
      KEY,
      CTX,
    );

    await createSalesOrderFromQuotation('qt-1', 3, {}, KEY, CTX);

    const writes = stub.recordedWrites();
    expect(writes[0]).toMatchObject({
      method: 'POST',
      path: '/quotations',
      key: KEY,
      scope: CTX,
      body: {
        partyId: 'pty-1',
        currencyCode: 'EGP',
      },
    });
    expect(writes[1]).toMatchObject({
      method: 'PATCH',
      path: '/quotations/qt-1',
      key: KEY,
      ifMatch: '"3"',
      scope: CTX,
      body: { draftReference: 'REF-2' },
    });
    expect(writes[2]).toMatchObject({
      method: 'POST',
      path: '/quotations/qt-1/revisions',
      key: KEY,
      ifMatch: '"3"',
      scope: CTX,
      body: {
        validUntil: '2026-12-31',
        pricing: { mode: 'NONE' },
        lines: [{ clientLineId: 'cl-1', itemId: 'itm-1', uomId: 'uom-1', quantity: '2' }],
        termSelections: { paymentTermId: 'term-pay-1' },
      },
    });
    expect(writes[3]).toMatchObject({
      method: 'POST',
      path: '/quotations/qt-1/send',
      key: KEY,
      ifMatch: '"3"',
      scope: CTX,
      body: undefined,
    });
    expect(writes[4]).toMatchObject({
      method: 'POST',
      path: '/quotations/qt-1/reject',
      key: KEY,
      ifMatch: '"3"',
      scope: CTX,
      body: { reasonCode: 'PRICE' },
    });
    expect(writes[5]).toMatchObject({
      method: 'POST',
      path: '/quotations/qt-1/convert-to-sales-order',
      key: KEY,
      ifMatch: '"3"',
      scope: CTX,
      body: {
        lines: [
          {
            clientLineId: 'cl-1',
            financial: { discountTotal: '0', chargeTotal: '5', taxTotal: '14', lineTotal: '119' },
          },
        ],
        totals: { subtotal: '100', discountTotal: '0', chargeTotal: '5', taxTotal: '14', grandTotal: '119', roundingTotal: '0', amountPaid: '0', amountDue: '119' },
        termSelections: { paymentTermId: 'term-pay-1' },
      },
    });
    expect(writes[6]).toMatchObject({
      method: 'POST',
      path: '/quotations/qt-1/create-sales-order',
      key: KEY,
      ifMatch: '"3"',
      scope: CTX,
      body: {},
    });
  });

  it('links all sales-order write, replaceLines, confirm and action endpoints cleanly', async () => {
    const so = makeSalesOrderDetail();
    stub.register('POST', '/sales-orders', so);
    stub.register('PATCH', '/sales-orders/so-1', so);
    stub.register('PUT', '/sales-orders/so-1/lines', so);
    stub.register('POST', '/sales-orders/so-1/confirm', { ...so, unallocatedLines: [] });
    stub.register('POST', '/sales-orders/so-1/hold', so);

    await createSalesOrder(
      {
        partyId: 'pty-1',
        currencyCode: 'EGP',
        expectedPricingFingerprint: 'fp-1',
        lines: [
          {
            clientLineId: 'cl-1',
            itemId: 'itm-1',
            uomId: 'uom-1',
            quantity: '2',
            financial: { subtotal: '100', taxableBase: '100', discountTotal: '0', chargeTotal: '0', taxTotal: '14', lineTotal: '114', inclusiveTax: false, taxSnapshot: { category: 'STANDARD', rateBps: 1400, taxableBase: '100', taxAmount: '14', currencyCode: 'EGP' } },
          },
        ],
        totals: { subtotal: '100', discountTotal: '0', chargeTotal: '0', taxTotal: '14', grandTotal: '114', roundingTotal: '0', amountPaid: '0', amountDue: '114' },
        termSelections: { deliveryTermId: undefined, clauseIds: [] },
      },
      KEY,
      CTX,
    );

    await updateSalesOrder('so-1', 4, { draftReference: 'SO-REF' }, KEY, CTX);
    await replaceOrderLines(
      'sales-order',
      'so-1',
      4,
      {
        expectedPricingFingerprint: 'fp-1',
        lines: [
          {
            clientLineId: 'cl-1',
            itemId: 'itm-1',
            uomId: 'uom-1',
            quantity: '2',
            financial: { subtotal: '100', taxableBase: '100', discountTotal: '0', chargeTotal: '0', taxTotal: '14', lineTotal: '114', inclusiveTax: false, taxSnapshot: { category: 'STANDARD', rateBps: 1400, taxableBase: '100', taxAmount: '14', currencyCode: 'EGP' } },
          },
        ],
        totals: { subtotal: '100', discountTotal: '0', chargeTotal: '0', taxTotal: '14', grandTotal: '114', roundingTotal: '0', amountPaid: '0', amountDue: '114' },
      },
      KEY,
      CTX,
    );
    await confirmSalesOrder('so-1', 4, '2026-12-01T12:00:00.000Z', KEY, CTX);
    await salesOrderAction('so-1', 4, 'hold', { reasonCode: 'CREDIT', reasonNote: 'Hold check' }, KEY, CTX);

    const writes = stub.recordedWrites();
    expect(writes[0]).toMatchObject({ method: 'POST', path: '/sales-orders', key: KEY, scope: CTX });
    expect((writes[0].body as Record<string, unknown>)['requestedDeadline']).toBeUndefined();
    expect(writes[0].body).toMatchObject({ termSelections: {} });
    expect(writes[1]).toMatchObject({ method: 'PATCH', path: '/sales-orders/so-1', ifMatch: '"4"' });
    expect(writes[2]).toMatchObject({ method: 'PUT', path: '/sales-orders/so-1/lines', ifMatch: '"4"' });
    expect(writes[3]).toMatchObject({
      method: 'POST',
      path: '/sales-orders/so-1/confirm',
      ifMatch: '"4"',
      body: { requestedDeadline: '2026-12-01T12:00:00.000Z' },
    });
    expect(writes[4]).toMatchObject({
      method: 'POST',
      path: '/sales-orders/so-1/hold',
      ifMatch: '"4"',
      body: { reasonCode: 'CREDIT', reasonNote: 'Hold check' },
    });
  });

  it('links all purchase-order, purchase-quotation and delete endpoints cleanly', async () => {
    const po = makePurchaseOrderDetail();
    const pq = makePurchaseQuotationDetail();
    stub.register('POST', '/purchase-orders', po);
    stub.register('PATCH', '/purchase-orders/po-1', po);
    stub.register('PUT', '/purchase-orders/po-1/lines', po);
    stub.register('POST', '/purchase-orders/po-1/submit', po);
    stub.register('POST', '/purchase-orders/po-1/delivery/retry', po);
    stub.register('POST', '/purchase-quotations', pq);
    stub.register('PATCH', '/purchase-quotations/pq-1', pq);
    stub.register('POST', '/purchase-quotations/pq-1/issue', pq);
    stub.register('POST', '/purchase-quotations/pq-1/cancel', pq);
    stub.register('POST', '/purchase-quotations/pq-1/convert-to-purchase-order', po);
    stub.register('POST', '/purchase-quotations/pq-1/create-purchase-order', po);
    stub.register('DELETE', '/quotations/qt-1', undefined);
    stub.register('DELETE', '/sales-orders/so-1', undefined);
    stub.register('DELETE', '/purchase-orders/po-1', undefined);
    stub.register('DELETE', '/purchase-quotations/pq-1', undefined);

    await createPurchaseOrder(
      {
        supplierPartyId: 'sup-1',
        supplierAccountId: 'sup-acc-1',
        receivingNodeId: 'node-1',
        currencyCode: 'EGP',
        expectedPricingFingerprint: 'fp-po',
        lines: [
          {
            clientLineId: 'cl-1',
            itemId: 'itm-1',
            uomId: 'uom-1',
            quantity: '1',
            financial: { subtotal: '50', taxableBase: '50', discountTotal: '0', chargeTotal: '0', taxTotal: '0', lineTotal: '50', inclusiveTax: false, taxSnapshot: { category: 'STANDARD', rateBps: 1400, taxableBase: '50', taxAmount: '0', currencyCode: 'EGP' } },
          },
        ],
        totals: { subtotal: '50', discountTotal: '0', chargeTotal: '0', taxTotal: '0', grandTotal: '50', roundingTotal: '0', amountPaid: '0', amountDue: '50' },
      },
      KEY,
      CTX,
    );
    await updatePurchaseOrder('po-1', 2, { receivingNodeId: 'node-2' }, KEY, CTX);
    await replaceOrderLines(
      'purchase-order',
      'po-1',
      2,
      {
        expectedPricingFingerprint: 'fp-po',
        lines: [
          {
            clientLineId: 'cl-1',
            itemId: 'itm-1',
            uomId: 'uom-1',
            quantity: '1',
            financial: { subtotal: '50', taxableBase: '50', discountTotal: '0', chargeTotal: '0', taxTotal: '0', lineTotal: '50', inclusiveTax: false, taxSnapshot: { category: 'STANDARD', rateBps: 1400, taxableBase: '50', taxAmount: '0', currencyCode: 'EGP' } },
          },
        ],
        totals: { subtotal: '50', discountTotal: '0', chargeTotal: '0', taxTotal: '0', grandTotal: '50', roundingTotal: '0', amountPaid: '0', amountDue: '50' },
      },
      KEY,
      CTX,
    );
    await purchaseOrderAction('po-1', 2, 'submit', undefined, KEY, CTX);
    await retryPurchaseDelivery('po-1', 2, KEY, CTX);

    await createPurchaseQuotation(
      {
        supplierPartyId: 'sup-1',
        validUntil: '2026-12-31',
        currencyCode: 'EGP',
        lines: [{ clientLineId: 'cl-1', itemId: 'itm-1', uomId: 'uom-1', quantity: '1' }],
      },
      KEY,
      CTX,
    );
    await updatePurchaseQuotation('pq-1', 5, { reference: 'R-9', notes: '' }, KEY, CTX);
    await issuePurchaseQuotation('pq-1', 5, KEY, CTX);
    await cancelPurchaseQuotation('pq-1', 5, { reasonCode: 'OTHER', reasonNote: 'Stopped' }, KEY, CTX);
    await convertPurchaseQuotation(
      'pq-1',
      5,
      {
        supplierAccountId: 'sup-acc-1',
        receivingNodeId: 'node-1',
        lines: [
          {
            clientLineId: 'cl-1',
            financial: { subtotal: '50', taxableBase: '50', discountTotal: '0', chargeTotal: '0', taxTotal: '0', lineTotal: '50', inclusiveTax: false, taxSnapshot: { category: 'STANDARD', rateBps: 1400, taxableBase: '50', taxAmount: '0', currencyCode: 'EGP' } },
          },
        ],
        totals: { subtotal: '50', discountTotal: '0', chargeTotal: '0', taxTotal: '0', grandTotal: '50', roundingTotal: '0', amountPaid: '0', amountDue: '50' },
      },
      KEY,
      CTX,
    );
    await createPurchaseOrderFromPurchaseQuotation('pq-1', 5, { receivingNodeId: 'node-1' }, KEY, CTX);

    await deleteDocument('quotation', 'qt-1', 3, KEY, CTX);
    await deleteDocument('sales-order', 'so-1', 4, KEY, CTX);
    await deleteDocument('purchase-order', 'po-1', 2, KEY, CTX);
    await deleteDocument('purchase-quotation', 'pq-1', 5, KEY, CTX);

    const writes = stub.recordedWrites();
    expect(writes[0]).toMatchObject({ method: 'POST', path: '/purchase-orders' });
    expect((writes[0].body as Record<string, unknown>)['contactPartyId']).toBeUndefined();
    expect(writes[1]).toMatchObject({ method: 'PATCH', path: '/purchase-orders/po-1', ifMatch: '"2"' });
    expect(writes[2]).toMatchObject({ method: 'PUT', path: '/purchase-orders/po-1/lines', ifMatch: '"2"' });
    expect(writes[3]).toMatchObject({ method: 'POST', path: '/purchase-orders/po-1/submit', ifMatch: '"2"' });
    expect(writes[4]).toMatchObject({ method: 'POST', path: '/purchase-orders/po-1/delivery/retry', ifMatch: '"2"' });
    expect(writes[5]).toMatchObject({ method: 'POST', path: '/purchase-quotations' });
    expect(writes[6]).toMatchObject({
      method: 'PATCH',
      path: '/purchase-quotations/pq-1',
      ifMatch: '"5"',
      body: { reference: 'R-9', notes: '' },
    });
    expect(writes[7]).toMatchObject({ method: 'POST', path: '/purchase-quotations/pq-1/issue', ifMatch: '"5"' });
    expect(writes[8]).toMatchObject({ method: 'POST', path: '/purchase-quotations/pq-1/cancel', ifMatch: '"5"' });
    expect(writes[9]).toMatchObject({
      method: 'POST',
      path: '/purchase-quotations/pq-1/convert-to-purchase-order',
      ifMatch: '"5"',
    });
    expect(writes[10]).toMatchObject({
      method: 'POST',
      path: '/purchase-quotations/pq-1/create-purchase-order',
      ifMatch: '"5"',
      body: { receivingNodeId: 'node-1' },
    });
    expect(writes[11]).toMatchObject({ method: 'DELETE', path: '/quotations/qt-1', ifMatch: '"3"' });
    expect(writes[12]).toMatchObject({ method: 'DELETE', path: '/sales-orders/so-1', ifMatch: '"4"' });
    expect(writes[13]).toMatchObject({ method: 'DELETE', path: '/purchase-orders/po-1', ifMatch: '"2"' });
    expect(writes[14]).toMatchObject({ method: 'DELETE', path: '/purchase-quotations/pq-1', ifMatch: '"5"' });
  });

  it.each(['subtotal', 'taxableBase', 'inclusiveTax'] as const)('derives D-2 %s using the backend preview fixture', async (field) => {
    // Backend order-pricing-preview.service.spec.ts:10-25: quantity 3, price 10.005, VAT 14%.
    stub.register('POST', '/sales-orders/pricing-preview', {
      fingerprint: 'fp-1', currencyDecimalPlaces: 2,
      lines: [{ clientLineId: 'cl-1', unitPrice: '10.005', financial: {
        discountTotal: '0', chargeTotal: '0', taxTotal: '4.2021', lineTotal: '34.2171',
        taxSnapshot: { category: 'STANDARD', rateBps: 1400, taxableBase: '30.015', taxAmount: '4.2021', currencyCode: 'EGP' },
      } }],
      totals: { subtotal: '30.015', discountTotal: '0', chargeTotal: '0', taxTotal: '4.2021', roundingTotal: '0.0029', grandTotal: '34.22', amountPaid: '0', amountDue: '34.22' },
    });
    const preview = await previewOrderPricing('sales-order', {
      partyId: 'pty-1', currencyCode: 'EGP',
      lines: [{ clientLineId: 'cl-1', itemId: 'itm-1', uomId: 'uom-1', quantity: '3' }],
    }, CTX);
    expect(preview.lines[0].financial[field]).toBe(field === 'inclusiveTax' ? false : '30.015');
  });

  it.each([
    [403, 'TRADE.AUTH.TARGET_DENIED'],
    [409, 'TRADE.CONCURRENCY.STALE_VERSION'],
    [409, 'TRADE.QUOTE.PRICE_LOCKED'],
    [422, 'TRADE.CUSTOMER.INACTIVE'],
    [422, 'TRADE.INVENTORY.INSUFFICIENT_AVAILABILITY'],
    [422, 'TRADE.QUOTE.TAX_DEFAULT_REQUIRED'],
  ] as const)('preserves %i %s ApiError from tradeHttp write()', async (status, code) => {
    stub.register('POST', '/quotations/qt-1/send', new ApiError(status, code));

    await expect(quotationAction('qt-1', 1, 'send', undefined, KEY, CTX)).rejects.toMatchObject({
      status,
      code,
    });
  });
});
