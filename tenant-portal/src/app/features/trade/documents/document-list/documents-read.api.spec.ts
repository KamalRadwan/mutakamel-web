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
  evaluatePrice,
  getDiscountPolicy,
  getDocument,
  listContactOptions,
  listCustomerOptions,
  listDocuments,
  listReceivingNodes,
  listSupplierOptions,
  previewOrderPricing,
  previewQuotationPricing,
  statusCounts,
  type CustomerOptionPage,
  type DiscountPolicy,
} from '../shared/documents.api';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CTX = { companyId: '019a0000-0000-7000-8000-000000000001', branchId: '019a0000-0000-7000-8000-000000000002' };

describe('documents.api (DC-1 read, statusCounts, previews, pickers)', () => {
  let stub: TradeHttpStub;
  let dispose: () => void;

  beforeEach(() => {
    stub = new TradeHttpStub();
    dispose = bindTradeHttpForTest(stub);
  });

  afterEach(() => {
    dispose();
  });

  describe('listDocuments', () => {
    it.each([
      ['quotation', '/quotations'],
      ['sales-order', '/sales-orders'],
      ['purchase-order', '/purchase-orders'],
      ['purchase-quotation', '/purchase-quotations'],
    ] as const)('calls GET %s for kind=%s with BRANCH scope and clean query', async (kind, path) => {
      stub.register('GET', path, { items: [], total: 0, page: 1, limit: 25 });

      const page = await listDocuments(
        kind,
        { page: 1, limit: 25, status: 'DRAFT', search: '  QT-01 ', sort: 'updatedAt', order: 'desc' },
        CTX,
      );

      expect(page).toEqual({ items: [], total: 0, page: 1, limit: 25 });
      expect(stub.recordedReads()).toEqual([
        {
          path,
          query: { page: 1, limit: 25, status: 'DRAFT', search: 'QT-01', sort: 'updatedAt', order: 'desc' },
          scope: CTX,
        },
      ]);
    });

    it('rejects with 400 TRADE.SCOPE.REQUIRED when branchId is missing', async () => {
      await expect(listDocuments('quotation', { page: 1, limit: 25 }, { companyId: CTX.companyId })).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.SCOPE.REQUIRED',
      });
      expect(stub.recordedReads()).toEqual([]);
    });
  });

  describe('getDocument', () => {
    it('encodes id, preserves version, and normalizes D-1, D-6, D-7, D-8, D-9, D-10 per kind', async () => {
      stub.register('GET', '/quotations/qt%2F1', {
        id: 'qt/1',
        version: 4,
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
        revisions: [
          {
            id: 'rev-1',
            version: 1,
            quotationId: 'qt/1',
            revisionNumber: 1,
            status: 'DRAFT',
            validUntil: '2026-12-31',
            subtotal: '100',
            discountTotal: '0',
            grandTotal: '100',
            pricingMode: 'NONE',
            discountSnapshot: { pricing: { mode: 'NONE' }, currencyDecimalPlaces: 2 },
            termsSnapshot: {
              schemaVersion: 2,
              dueDays: 30,
              localized: { en: { paymentTerms: 'Net 30' }, ar: { paymentTerms: 'صافي 30' } },
              selections: [{ type: 'PAYMENT', id: 'term-1', code: 'NET30', version: 1 }],
            },
            sentAt: null,
            acceptedAt: null,
            rejectedAt: null,
            priceLockExpiresAt: null,
            createdAt: '2026-11-23T00:00:00.000Z',
          },
        ],
        currentLines: [],
      } as unknown as QuotationDetail);

      const qt = await getDocument('quotation', 'qt/1', CTX);
      expect(qt.version).toBe(4);
      expect(qt.reasonHistory).toEqual([]);
      const v2 = qt.revisions[0].termsSnapshot as { dueDays?: number; localized?: { en: { clauses?: unknown[] }; ar: { clauses?: unknown[] } } };
      expect(v2.dueDays).toBe(30);
      expect(v2.localized?.en.clauses).toEqual([]);
      expect(v2.localized?.ar.clauses).toEqual([]);

      // Sales order D-1 (no itemLabel, optional itemLocalizedNames) + D-7 null line totals
      stub.register('GET', '/sales-orders/so-1', {
        id: 'so-1',
        version: 2,
        companyId: CTX.companyId,
        branchId: CTX.branchId,
        partyId: 'pty-1',
        contactPartyId: null,
        currencyCode: 'EGP',
        businessDate: '2026-11-23',
        lifecycleStatus: 'DRAFT',
        documentNumber: null,
        draftReference: null,
        grandTotal: '200',
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
        lines: [
          {
            id: 'sol-1',
            clientLineId: 'cl-1',
            itemCompanyProfileId: 'cp-secret-id',
            printLineNumber: 1,
            descriptionSnapshot: null,
            uomId: 'uom-1',
            uomLabel: '',
            orderedQuantity: '2',
            allocatedQuantity: '0',
            fulfilledQuantity: '0',
            invoicedQuantity: '0',
            cancelledQuantity: '0',
            unitPrice: '100',
            discountTotal: null,
            chargeTotal: null,
            taxTotal: null,
            lineTotal: '200',
            taxSnapshot: null,
            itemLabel: '',
          },
          {
            id: 'sol-2',
            clientLineId: 'cl-2',
            itemCompanyProfileId: 'cp-2',
            itemId: 'item-2',
            itemCode: 'SKU-2',
            itemLocalizedNames: { en: 'Widget', ar: 'أداة' },
            uomCode: 'PCS',
            uomLocalizedNames: { en: 'Piece', ar: 'قطعة' },
            printLineNumber: 2,
            descriptionSnapshot: null,
            uomId: 'uom-1',
            uomLabel: '',
            orderedQuantity: '1',
            allocatedQuantity: '0',
            fulfilledQuantity: '0',
            invoicedQuantity: '0',
            cancelledQuantity: '0',
            unitPrice: '50',
            discountTotal: null,
            chargeTotal: null,
            taxTotal: null,
            lineTotal: '50',
            taxSnapshot: null,
            itemLabel: '',
          },
        ],
      } as unknown as SalesOrderDetail);

      const so = await getDocument('sales-order', 'so-1', CTX, 'ar');
      expect(so.lines[0].itemLabel).toBe('');
      expect(so.lines[0].discountTotal).toBe('0');
      expect(so.lines[0].chargeTotal).toBe('0');
      expect(so.lines[0].taxTotal).toBe('0');
      expect(so.lines[1].itemLabel).toBe('SKU-2 · أداة');
      expect(so.lines[1].uomLabel).toBe('PCS · قطعة');

      // Purchase order D-6 nullable fields & no submittedBy/submittedAt + D-7
      stub.register('GET', '/purchase-orders/po-1', {
        id: 'po-1',
        version: 3,
        companyId: CTX.companyId,
        branchId: CTX.branchId,
        partyId: 'sup-1',
        contactPartyId: null,
        currencyCode: 'EGP',
        businessDate: '2026-11-23',
        lifecycleStatus: 'DRAFT',
        documentNumber: null,
        draftReference: null,
        grandTotal: '500',
        partySnapshot: { id: 'sup-1', displayName: 'Supplier' },
        createdAt: '2026-11-23T00:00:00.000Z',
        updatedAt: '2026-11-23T00:00:00.000Z',
        extensionValues: {},
        approvalStatus: 'NOT_REQUIRED',
        supplierAccountId: null,
        receivingNodeId: null,
        dispatchStatus: 'NOT_REQUESTED',
        fulfillmentStatus: 'NONE',
        billingStatus: 'NONE',
        termsSnapshot: null,
        totalsSnapshot: null,
        sourcePurchaseQuotationId: null,
        createdBy: null,
        approvalReady: false,
        delivery: null,
        lines: [
          {
            id: 'pol-1',
            clientLineId: 'cl-po-1',
            itemCompanyProfileId: 'cp-1',
            printLineNumber: 1,
            descriptionSnapshot: null,
            uomId: 'uom-1',
            uomLabel: '',
            orderedQuantity: '5',
            receivedQuantity: '0',
            cancelledQuantity: '0',
            unitPrice: '100',
            discountTotal: null,
            chargeTotal: null,
            taxTotal: null,
            lineTotal: '500',
            taxSnapshot: null,
            expectedDate: null,
            receivingNodeId: null,
            itemLabel: '',
          },
        ],
      } as unknown as PurchaseOrderDetail);

      const po = await getDocument('purchase-order', 'po-1', CTX);
      expect(po.supplierAccountId).toBeNull();
      expect(po.receivingNodeId).toBeNull();
      expect(po.createdBy).toBeNull();
      expect('submittedBy' in po).toBe(false);
      expect(po.lines[0].discountTotal).toBe('0');
      expect(po.lines[0].chargeTotal).toBe('0');

      // Purchase quotation D-8 nullable validUntil & descriptionSnapshot + D-10 missing currencyDecimalPlaces
      stub.register('GET', '/purchase-quotations/pq-1', {
        id: 'pq-1',
        version: 1,
        companyId: CTX.companyId,
        branchId: CTX.branchId,
        partyId: 'sup-1',
        currencyCode: 'EGP',
        businessDate: '2026-11-23',
        lifecycleStatus: 'DRAFT',
        documentNumber: null,
        partySnapshot: { id: 'sup-1', displayName: 'Supplier' },
        createdAt: '2026-11-23T00:00:00.000Z',
        updatedAt: '2026-11-23T00:00:00.000Z',
        reference: null,
        notes: null,
        validUntil: null,
        finalizedAt: null,
        convertedPurchaseOrderId: null,
        termsSnapshot: null,
        totalsSnapshot: {
          subtotal: '100',
          discountTotal: '0',
          chargeTotal: '0',
          taxTotal: '0',
          roundingTotal: '0',
          grandTotal: '100',
          amountPaid: '0',
          amountDue: '100',
        },
        lines: [
          {
            id: 'pql-1',
            clientLineId: 'cl-pq-1',
            itemCompanyProfileId: 'cp-1',
            itemId: 'item-1',
            quantity: '1',
            uomId: 'uom-1',
            uomLabel: 'PCS',
            unitPrice: '100',
            lineTotal: '100',
            descriptionSnapshot: null,
            itemLabel: 'Item',
          },
        ],
      } as unknown as PurchaseQuotationDetail);

      const pq = await getDocument('purchase-quotation', 'pq-1', CTX);
      expect(pq.validUntil).toBeNull();
      expect(pq.totalsSnapshot?.currencyDecimalPlaces).toBeUndefined();
      expect(pq.lines[0].descriptionSnapshot).toBeNull();
    });
  });

  describe('statusCounts', () => {
    it.each([
      ['quotation', '/quotations/status-counts'],
      ['sales-order', '/sales-orders/status-counts'],
      ['purchase-order', '/purchase-orders/status-counts'],
      ['purchase-quotation', '/purchase-quotations/status-counts'],
    ] as const)('sends POST %s with fresh x-idempotency-key and body filters only', async (kind, path) => {
      stub.register('POST', path, { total: 5, byStatus: { DRAFT: 3, SENT: 2 } });

      const counts = await statusCounts(kind, { search: '  Al Noor  ', currencyCode: 'EGP' }, CTX);

      expect(counts).toEqual({ total: 5, byStatus: { DRAFT: 3, SENT: 2 } });
      const writes = stub.recordedWrites();
      expect(writes).toHaveLength(1);
      expect(writes[0].method).toBe('POST');
      expect(writes[0].path).toBe(path);
      expect(writes[0].ifMatch).toBeUndefined();
      expect(writes[0].key).toMatch(UUID_V7_REGEX);
      expect(writes[0].scope).toEqual(CTX);
      expect(writes[0].body).toEqual({ search: 'Al Noor', currencyCode: 'EGP' });
    });
  });

  describe('getDiscountPolicy', () => {
    it('supports populated limit and limit: null (D-5)', async () => {
      stub.register('GET', '/quotations/discount-policy', {
        hasApplyPermission: true,
        canApply: true,
        canManage: false,
        configured: false,
        limit: null,
      } satisfies DiscountPolicy);

      const nullPolicy = await getDiscountPolicy(CTX);
      expect(nullPolicy.limit).toBeNull();
      expect(nullPolicy.canApply).toBe(true);

      stub.register('GET', '/quotations/discount-policy', {
        hasApplyPermission: true,
        canApply: true,
        canManage: true,
        configured: true,
        limit: { id: 'lim-1', version: 2, maxPercent: '15', allowFreeItems: false, reasonRequired: true },
      } satisfies DiscountPolicy);

      const activePolicy = await getDiscountPolicy(CTX);
      expect(activePolicy.limit?.maxPercent).toBe('15');
      expect(stub.recordedReads()).toEqual([
        { path: '/quotations/discount-policy', query: undefined, scope: CTX },
        { path: '/quotations/discount-policy', query: undefined, scope: CTX },
      ]);
    });
  });

  describe('previewQuotationPricing & previewOrderPricing', () => {
    it('sanitizes quotation pricing-preview DTO and sends fresh x-idempotency-key', async () => {
      stub.register('POST', '/quotations/pricing-preview', {
        currencyDecimalPlaces: 2,
        lines: [],
        totals: { subtotal: '200', discountTotal: '0', grandTotal: '200' },
        fingerprint: 'fp-qt',
      });

      await previewQuotationPricing(
        {
          partyId: 'pty-1',
          crmCustomerProfileId: null,
          currencyCode: 'EGP',
          lines: [{ clientLineId: 'cl-1', itemId: 'i-1', uomId: 'u-1', quantity: '2', discount: null }],
          pricing: { mode: 'DISCOUNT', scope: 'LINE', type: 'PERCENT', value: '', reasonCode: '', reasonNote: '  ' },
        },
        CTX,
      );

      const write = stub.recordedWrites()[0];
      expect(write.path).toBe('/quotations/pricing-preview');
      expect(write.key).toMatch(UUID_V7_REGEX);
      expect(write.body).toEqual({
        partyId: 'pty-1',
        currencyCode: 'EGP',
        lines: [{ clientLineId: 'cl-1', itemId: 'i-1', uomId: 'u-1', quantity: '2' }],
        pricing: { mode: 'DISCOUNT', scope: 'LINE', type: 'PERCENT' },
      });
    });

    it('sanitizes SO & PO pricing-preview DTOs and derives D-2 subtotal & taxableBase', async () => {
      stub.register('POST', '/sales-orders/pricing-preview', {
        currencyDecimalPlaces: 2,
        lines: [
          {
            clientLineId: 'cl-so-1',
            unitPrice: '50',
            taxDefault: null,
            financial: {
              discountTotal: '10',
              chargeTotal: '5',
              taxTotal: '13.3',
              lineTotal: '108.3',
              taxSnapshot: {
                category: 'STANDARD',
                rateBps: 1400,
                taxableBase: '95',
                taxAmount: '13.3',
                currencyCode: 'EGP',
              },
            },
          },
        ],
        totals: {
          subtotal: '100',
          discountTotal: '10',
          chargeTotal: '5',
          taxTotal: '13.3',
          roundingTotal: '0',
          grandTotal: '108.3',
          amountPaid: '0',
          amountDue: '108.3',
        },
        fingerprint: 'fp-so',
      });

      const soPreview = await previewOrderPricing(
        'sales-order',
        {
          partyId: 'pty-1',
          currencyCode: 'EGP',
          sourceQuotationId: 'qt-99',
          lines: [
            {
              clientLineId: 'cl-so-1',
              itemId: 'i-1',
              uomId: 'u-1',
              quantity: '2',
              unitPrice: '50',
              discountTotal: '10',
              chargeTotal: null,
              tax: null,
            },
          ],
        },
        CTX,
      );

      const write = stub.recordedWrites()[0];
      expect(write.path).toBe('/sales-orders/pricing-preview');
      expect(write.body).toEqual({
        partyId: 'pty-1',
        currencyCode: 'EGP',
        lines: [{ clientLineId: 'cl-so-1', itemId: 'i-1', uomId: 'u-1', quantity: '2' }],
      });
      expect(soPreview.lines[0].financial.subtotal).toBe('100');
      expect(soPreview.lines[0].financial.taxableBase).toBe('95');
      expect(soPreview.lines[0].financial.inclusiveTax).toBe(false);

      stub.register('POST', '/purchase-orders/pricing-preview', {
        currencyDecimalPlaces: 2,
        lines: [],
        totals: {
          subtotal: '0',
          discountTotal: '0',
          chargeTotal: '0',
          taxTotal: '0',
          roundingTotal: '0',
          grandTotal: '0',
          amountPaid: '0',
          amountDue: '0',
        },
        fingerprint: 'fp-po',
      });

      await previewOrderPricing(
        'purchase-order',
        {
          partyId: 'sup-1',
          currencyCode: 'USD',
          sourcePurchaseQuotationId: 'pq-1',
          lines: [{ clientLineId: 'cl-po-1', itemId: 'i-1', uomId: 'u-1', quantity: '1', chargeTotal: '0' }],
        },
        CTX,
      );
      expect(stub.recordedWrites()[1].path).toBe('/purchase-orders/pricing-preview');
      expect(stub.recordedWrites()[1].body).toEqual({
        partyId: 'sup-1',
        currencyCode: 'USD',
        sourcePurchaseQuotationId: 'pq-1',
        lines: [{ clientLineId: 'cl-po-1', itemId: 'i-1', uomId: 'u-1', quantity: '1', chargeTotal: '0' }],
      });
    });
  });

  describe('pickers & evaluatePrice', () => {
    it('maps D-3 customer-options wire shape in one mapper', async () => {
      stub.register('GET', '/quotations/customer-options', {
        items: [
          {
            partyId: 'pty-1',
            displayName: 'Eligible Customer',
            crmStatus: 'ACTIVE',
            commercialAccountStatus: 'NONE',
            eligibilitySource: 'CRM_CUSTOMER',
          },
          {
            partyId: 'pty-2',
            displayName: 'Blocked Customer',
            crmCustomerProfileId: 'crm-2',
            crmStatus: 'INACTIVE',
            commercialAccountStatus: 'BLOCKED',
            eligibilitySource: 'COMMERCIAL_ACCOUNT',
            denialCode: 'TRADE.QUOTE.COMMERCIAL_ACCOUNT_BLOCKED',
          },
        ],
      });

      const page: CustomerOptionPage = await listCustomerOptions('Elig', 'cur-1', CTX);
      expect(stub.recordedReads()[0]).toEqual({
        path: '/quotations/customer-options',
        query: { search: 'Elig', cursor: 'cur-1' },
        scope: CTX,
      });
      expect(page.nextCursor).toBeNull();
      expect(page.items[0]).toEqual({
        partyId: 'pty-1',
        displayName: 'Eligible Customer',
        crmCustomerProfileId: null,
        crmStatus: 'ACTIVE',
        commercialAccountStatus: 'NONE',
        accountStatus: null,
        eligibilitySource: 'CRM_CUSTOMER',
        denialCode: null,
      });
      expect(page.items[1].accountStatus).toBe('BLOCKED');
      expect(page.items[1].denialCode).toBe('TRADE.QUOTE.COMMERCIAL_ACCOUNT_BLOCKED');
    });

    it('calls Trade GET /quotations/contact-options for D-4 contact picker', async () => {
      stub.register('GET', '/quotations/contact-options', {
        partyType: 'ORGANIZATION',
        items: [
          {
            partyId: 'cnt-1',
            displayName: 'Sara Ali',
            relationshipType: 'BILLING_CONTACT',
            relationshipLabel: 'Billing',
            isPrimary: true,
            email: 'sara@example.com',
            mobile: null,
            phone: null,
          },
        ],
        nextCursor: 'next-c',
      });

      const page = await listContactOptions('pty-1', { search: 'Sara', limit: 25 }, CTX);
      expect(stub.recordedReads()[0]).toEqual({
        path: '/quotations/contact-options',
        query: { partyId: 'pty-1', search: 'Sara', limit: 25 },
        scope: CTX,
      });
      expect(page.partyType).toBe('ORGANIZATION');
      expect(page.items[0].partyId).toBe('cnt-1');
      expect(page.nextCursor).toBe('next-c');
    });

    it('unwraps supplier-options, receiving-nodes bare array, and evaluates price with OPTIONAL scope', async () => {
      stub.register('GET', '/purchase-orders/supplier-options', {
        items: [{ partyId: 'sup-1', displayName: 'Gulf Steel', accounts: [] }],
      });
      const suppliers = await listSupplierOptions('Gulf', CTX);
      expect(suppliers).toEqual([{ partyId: 'sup-1', displayName: 'Gulf Steel', accounts: [] }]);

      stub.register('GET', '/inventory/nodes', [
        { id: 'wh-1', code: 'MAIN', name: 'Main Warehouse' },
      ]);
      const nodes = await listReceivingNodes(CTX);
      expect(nodes).toEqual([{ id: 'wh-1', code: 'MAIN', name: 'Main Warehouse', status: 'ACTIVE' }]);
      expect(stub.recordedReads()).toEqual([
        { path: '/purchase-orders/supplier-options', query: { search: 'Gulf' }, scope: CTX },
        { path: '/inventory/nodes', query: { status: 'ACTIVE' }, scope: CTX },
      ]);

      stub.register('POST', '/pricing/evaluate', { unitPrice: '125.5' });
      const evalRes = await evaluatePrice('SALES', 'item-1', 'uom-1', '3', 'EGP', {
        companyId: CTX.companyId,
      });
      expect(evalRes).toEqual({ unitPrice: '125.5' });
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST', path: '/pricing/evaluate',
          body: { purpose: 'SALES', itemId: 'item-1', uomId: 'uom-1', quantity: '3', currencyCode: 'EGP' },
          scope: { companyId: CTX.companyId }, key: expect.stringMatching(UUID_V7_REGEX),
          ifMatch: undefined, query: undefined,
        },
      ]);
    });

    it('preserves ApiError status, code and details on failure', async () => {
      stub.register(
        'GET',
        '/quotations/q-missing',
        new ApiError(404, 'TRADE.QUOTE.NOT_FOUND', { id: ['not found'] }),
      );

      await expect(getDocument('quotation', 'q-missing', CTX)).rejects.toMatchObject({
        status: 404,
        code: 'TRADE.QUOTE.NOT_FOUND',
        details: { id: ['not found'] },
      });
    });
  });

  it.each([
    ['listDocuments', 'GET', '/quotations', () => listDocuments('quotation', { page: 1, limit: 25 }, CTX)],
    ['getDocument', 'GET', '/quotations/q-1', () => getDocument('quotation', 'q-1', CTX)],
    ['statusCounts', 'POST', '/quotations/status-counts', () => statusCounts('quotation', {}, CTX)],
    ['getDiscountPolicy', 'GET', '/quotations/discount-policy', () => getDiscountPolicy(CTX)],
    ['previewQuotationPricing', 'POST', '/quotations/pricing-preview', () => previewQuotationPricing({ partyId: 'pty-1', currencyCode: 'EGP', lines: [] }, CTX)],
    ['previewOrderPricing', 'POST', '/sales-orders/pricing-preview', () => previewOrderPricing('sales-order', { partyId: 'pty-1', currencyCode: 'EGP', lines: [] }, CTX)],
    ['listCustomerOptions', 'GET', '/quotations/customer-options', () => listCustomerOptions(undefined, undefined, CTX)],
    ['listContactOptions', 'GET', '/quotations/contact-options', () => listContactOptions('pty-1', undefined, CTX)],
    ['listSupplierOptions', 'GET', '/purchase-orders/supplier-options', () => listSupplierOptions(undefined, CTX)],
    ['listReceivingNodes', 'GET', '/inventory/nodes', () => listReceivingNodes(CTX)],
    ['evaluatePrice', 'POST', '/pricing/evaluate', () => evaluatePrice('SALES', 'i-1', 'u-1', '1', 'EGP', CTX)],
  ] as const)('%s preserves the API error and field details', async (_name, method, path, call) => {
    const error = new ApiError(422, 'TRADE.VALIDATION_FAILED', { partyId: ['invalid party'] });
    stub.register(method, path, error);
    await expect(call()).rejects.toBe(error);
    expect(error.details).toEqual({ partyId: ['invalid party'] });
  });
});
