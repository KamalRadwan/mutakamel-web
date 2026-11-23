import { describe, expect, it } from 'vitest';
import { isDocumentRowPrintable } from '../document-list/document-row-menu';
import { statusBadge } from '../shared/document-status';
import type {
  PurchaseOrderDetail,
  PurchaseQuotationDetail,
  QuotationDetail,
  SalesOrderDetail,
} from '../shared/document.model';
import {
  ACTION_ICONS,
  NON_RETRYABLE_DELIVERY_ERROR,
  canRetryDelivery,
  resolveActions,
  type DocAction,
  type ResolveActionsContext,
  type ResolvedAction,
} from './document-actions';

const ALL_PERMS = new Set<string>([
  'trade.quotations.read',
  'trade.quotations.send',
  'trade.quotations.accept',
  'trade.quotations.reject',
  'trade.quotations.cancel',
  'trade.quotations.convert',
  'trade.quotations.delete',
  'trade.sales_orders.read',
  'trade.sales_orders.create',
  'trade.sales_orders.confirm',
  'trade.sales_orders.hold',
  'trade.sales_orders.cancel',
  'trade.sales_orders.delete',
  'trade.purchase_orders.read',
  'trade.purchase_orders.create',
  'trade.purchase_orders.submit',
  'trade.purchase_orders.approve',
  'trade.purchase_orders.confirm',
  'trade.purchase_orders.cancel',
  'trade.purchase_orders.delete',
  'trade.purchase_quotations.read',
  'trade.purchase_quotations.issue',
  'trade.purchase_quotations.cancel',
  'trade.purchase_quotations.delete',
]);

const NOW = new Date('2026-11-21T12:00:00.000Z');

function ctx(overrides: Partial<ResolveActionsContext> = {}): ResolveActionsContext {
  return {
    dirty: false,
    isNew: false,
    currentUserId: 'usr-approver',
    perms: ALL_PERMS,
    now: NOW,
    ...overrides,
  };
}

function makeQuotation(overrides: Partial<QuotationDetail> = {}): QuotationDetail {
  return {
    id: 'qt-1',
    version: 1,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'pty-1',
    contactPartyId: null,
    currencyCode: 'EGP',
    businessDate: '2026-11-21',
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    draftReference: 'REF-QT-1',
    grandTotal: '1000',
    partySnapshot: { id: 'pty-1', displayName: 'Customer' },
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    extensionValues: {},
    currentRevisionId: 'qrev-1',
    acceptedRevisionId: null,
    crmCustomerProfileId: null,
    approvalStatus: 'NOT_REQUIRED',
    sourceCrmOpportunityId: null,
    currentRevision: {
      id: 'qrev-1',
      revisionNumber: 1,
      status: 'DRAFT',
      validUntil: '2026-12-01',
      priceLockExpiresAt: null,
    },
    revisions: [
      {
        id: 'qrev-1',
        version: 1,
        quotationId: 'qt-1',
        revisionNumber: 1,
        status: 'DRAFT',
        validUntil: '2026-12-01',
        subtotal: '1000',
        discountTotal: '0',
        grandTotal: '1000',
        pricingMode: 'NONE',
        discountSnapshot: { pricing: { mode: 'NONE' }, currencyDecimalPlaces: 2 },
        termsSnapshot: {},
        sentAt: null,
        acceptedAt: null,
        rejectedAt: null,
        priceLockExpiresAt: null,
        createdAt: '2026-11-20T10:00:00.000Z',
      },
    ],
    currentLines: [],
    reasonHistory: [],
    ...overrides,
  };
}

function makeSalesOrder(overrides: Partial<SalesOrderDetail> = {}): SalesOrderDetail {
  return {
    id: 'so-1',
    version: 1,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'pty-1',
    contactPartyId: null,
    currencyCode: 'EGP',
    businessDate: '2026-11-21',
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    draftReference: 'REF-SO-1',
    grandTotal: '1000',
    partySnapshot: { id: 'pty-1', displayName: 'Customer' },
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
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
    ...overrides,
  };
}

function makePurchaseOrder(overrides: Partial<PurchaseOrderDetail> = {}): PurchaseOrderDetail {
  return {
    id: 'po-1',
    version: 1,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'pty-sup-1',
    contactPartyId: null,
    currencyCode: 'EGP',
    businessDate: '2026-11-21',
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    draftReference: 'REF-PO-1',
    grandTotal: '5000',
    partySnapshot: { id: 'pty-sup-1', displayName: 'Supplier' },
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    extensionValues: {},
    approvalStatus: 'NOT_REQUIRED',
    supplierAccountId: 'sup-acc-1',
    receivingNodeId: 'node-1',
    dispatchStatus: 'NOT_REQUESTED',
    fulfillmentStatus: 'NONE',
    billingStatus: 'NONE',
    termsSnapshot: null,
    totalsSnapshot: null,
    sourcePurchaseQuotationId: null,
    createdBy: 'usr-creator',
    lines: [],
    approvalReady: false,
    delivery: null,
    reasonHistory: [],
    ...overrides,
  };
}

function makePurchaseQuotation(overrides: Partial<PurchaseQuotationDetail> = {}): PurchaseQuotationDetail {
  return {
    id: 'pq-1',
    version: 1,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'pty-sup-1',
    currencyCode: 'EGP',
    businessDate: '2026-11-21',
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    partySnapshot: { id: 'pty-sup-1', displayName: 'Supplier' },
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    reference: 'SUP-REF-1',
    notes: null,
    validUntil: '2026-12-01',
    finalizedAt: null,
    convertedPurchaseOrderId: null,
    termsSnapshot: null,
    totalsSnapshot: null,
    lines: [],
    reasonHistory: [],
    ...overrides,
  };
}

function findAction(actions: readonly ResolvedAction[], name: DocAction): ResolvedAction {
  const found = actions.find((a) => a.action === name);
  if (!found) {
    throw new Error(`Expected action "${name}" in [${actions.map((a) => a.action).join(', ')}]`);
  }
  return found;
}

function assertInvariants(actions: readonly ResolvedAction[]): void {
  expect(actions.filter((a) => a.primary).length).toBeLessThanOrEqual(1);
  for (const a of actions) {
    expect(a.icon).toBe(ACTION_ICONS[a.action]);
    expect(a.labelKey).toBe(`tda.actions.${a.action}`);
    if (a.action === 'cancel' || a.action === 'pqCancel' || a.action === 'deleteDraft') {
      expect(a.placement).toBe('menu');
      expect(a.danger).toBe(true);
    }
  }
  // cancel is always the last menu item (P4)
  const cancelIdx = actions.findIndex((a) => a.action === 'cancel');
  if (cancelIdx !== -1) {
    expect(cancelIdx).toBe(actions.length - 1);
  }
}

describe('document-actions resolver', () => {
  describe('general rules', () => {
    it('returns no actions when ctx.isNew is true or doc is null/undefined', () => {
      expect(resolveActions('quotation', makeQuotation(), ctx({ isNew: true }))).toEqual([]);
      expect(resolveActions('sales-order', makeSalesOrder(), ctx({ isNew: true }))).toEqual([]);
      expect(resolveActions('quotation', null, ctx())).toEqual([]);
      expect(resolveActions('purchase-order', undefined, ctx())).toEqual([]);
    });

    it('disables all lifecycle actions except print with tda.why.saveFirst when dirty', () => {
      const sentQuotation = makeQuotation({
        lifecycleStatus: 'SENT',
        documentNumber: 'QT-2026-0001',
        revisions: [
          {
            ...makeQuotation().revisions[0],
            status: 'SENT',
            priceLockExpiresAt: '2026-11-22T12:00:00.000Z',
          },
        ],
      });
      const actions = resolveActions('quotation', sentQuotation, ctx({ dirty: true }));
      assertInvariants(actions);

      expect(findAction(actions, 'accept').disabledReasonKey).toBe('tda.why.saveFirst');
      expect(findAction(actions, 'reject').disabledReasonKey).toBe('tda.why.saveFirst');
      expect(findAction(actions, 'cancel').disabledReasonKey).toBe('tda.why.saveFirst');
      expect(findAction(actions, 'print').disabledReasonKey).toBeNull();
    });

    it('disables actions with tda.why.permission when required permissions are missing', () => {
      const acceptedQuotation = makeQuotation({ lifecycleStatus: 'ACCEPTED', documentNumber: 'QT-2026-0002' });
      const onlyConvertPerm = new Set(ALL_PERMS);
      onlyConvertPerm.delete('trade.sales_orders.create');

      const partialActions = resolveActions('quotation', acceptedQuotation, ctx({ perms: onlyConvertPerm }));
      expect(findAction(partialActions, 'convert').disabledReasonKey).toBe('tda.why.permission');
      expect(findAction(partialActions, 'createSalesOrderDirect').disabledReasonKey).toBe('tda.why.permission');
      expect(findAction(partialActions, 'print').disabledReasonKey).toBeNull();

      const noPermsActions = resolveActions(
        'quotation',
        makeQuotation({ currentRevisionId: null, currentRevision: null, revisions: [] }),
        ctx({ dirty: true, perms: new Set() }),
      );
      expect(findAction(noPermsActions, 'send').disabledReasonKey).toBe('tda.why.permission');
      expect(findAction(noPermsActions, 'cancel').disabledReasonKey).toBe('tda.why.permission');
      expect(findAction(noPermsActions, 'deleteDraft').disabledReasonKey).toBe('tda.why.permission');
    });
  });

  describe('quotation', () => {
    it('DRAFT saved with revision and no documentNumber exposes send (primary), deleteDraft, and cancel last', () => {
      const actions = resolveActions('quotation', makeQuotation({ documentNumber: null }), ctx());
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['send', 'deleteDraft', 'cancel']);

      const send = findAction(actions, 'send');
      expect(send.primary).toBe(true);
      expect(send.placement).toBe('bar');
      expect(send.disabledReasonKey).toBeNull();

      const cancel = findAction(actions, 'cancel');
      expect(cancel.needsReason).toBe('DOCUMENT_CANCEL');

      const del = findAction(actions, 'deleteDraft');
      expect(del.needsConfirm).toBe(true);
    });

    it('DRAFT with non-null documentNumber omits deleteDraft (API v2 B2)', () => {
      const actions = resolveActions('quotation', makeQuotation({ documentNumber: 'QT-2026-0005' }), ctx());
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['send', 'cancel']);
    });

    it('DRAFT without a current revision disables send with tda.why.noLines', () => {
      const q = makeQuotation({ currentRevisionId: null, currentRevision: null, revisions: [] });
      const actions = resolveActions('quotation', q, ctx());
      assertInvariants(actions);
      expect(findAction(actions, 'send').disabledReasonKey).toBe('tda.why.noLines');
    });

    it('SENT with unexpired price lock enables accept (primary), reject, print, and cancel', () => {
      const q = makeQuotation({
        lifecycleStatus: 'SENT',
        documentNumber: 'QT-2026-0001',
        revisions: [
          {
            ...makeQuotation().revisions[0],
            status: 'SENT',
            priceLockExpiresAt: '2026-11-21T18:00:00.000Z',
          },
        ],
      });
      const actions = resolveActions('quotation', q, ctx());
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['accept', 'reject', 'print', 'cancel']);

      expect(findAction(actions, 'accept').primary).toBe(true);
      expect(findAction(actions, 'accept').disabledReasonKey).toBeNull();
      expect(findAction(actions, 'reject').needsReason).toBe('QUOTATION_REJECT');
      expect(findAction(actions, 'reject').danger).toBe(true);
      expect(findAction(actions, 'cancel').needsReason).toBe('DOCUMENT_CANCEL');
    });

    it('SENT with expired price lock disables accept with tda.why.priceLockExpired', () => {
      const q = makeQuotation({
        lifecycleStatus: 'SENT',
        documentNumber: 'QT-2026-0007',
        revisions: [
          {
            ...makeQuotation().revisions[0],
            status: 'SENT',
            priceLockExpiresAt: '2026-11-21T11:59:59.000Z',
          },
        ],
      });
      const actions = resolveActions('quotation', q, ctx());
      assertInvariants(actions);
      expect(findAction(actions, 'accept').disabledReasonKey).toBe('tda.why.priceLockExpired');
      expect(findAction(actions, 'reject').disabledReasonKey).toBeNull();
    });

    it('ACCEPTED exposes convert (primary), print, and menu createSalesOrderDirect (needsConfirm)', () => {
      const q = makeQuotation({ lifecycleStatus: 'ACCEPTED', documentNumber: 'QT-2026-0002' });
      const actions = resolveActions('quotation', q, ctx());
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['convert', 'print', 'createSalesOrderDirect']);

      expect(findAction(actions, 'convert').primary).toBe(true);
      expect(findAction(actions, 'convert').placement).toBe('bar');
      const direct = findAction(actions, 'createSalesOrderDirect');
      expect(direct.placement).toBe('menu');
      expect(direct.needsConfirm).toBe(true);
      expect(direct.icon).toBe('tablerBolt');
    });

    it('CONVERTED exposes openSalesOrder (primary) and print', () => {
      const q = makeQuotation({ lifecycleStatus: 'CONVERTED', documentNumber: 'QT-2026-0008' });
      const actions = resolveActions('quotation', q, ctx());
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['openSalesOrder', 'print']);
      expect(findAction(actions, 'openSalesOrder').primary).toBe(true);
    });

    it('REJECTED exposes print only', () => {
      const q = makeQuotation({ lifecycleStatus: 'REJECTED', documentNumber: 'QT-2026-0005' });
      const actions = resolveActions('quotation', q, ctx());
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['print']);
      expect(findAction(actions, 'print').primary).toBe(false);
    });

    it('EXPIRED and CANCELLED return no actions', () => {
      expect(resolveActions('quotation', makeQuotation({ lifecycleStatus: 'EXPIRED' }), ctx())).toEqual([]);
      expect(resolveActions('quotation', makeQuotation({ lifecycleStatus: 'CANCELLED' }), ctx())).toEqual([]);
    });
  });

  describe('sales order', () => {
    it('DRAFT + holdStatus NONE exposes confirm (primary, needsConfirm), hold, cancel, and deleteDraft', () => {
      const actions = resolveActions('sales-order', makeSalesOrder({ lifecycleStatus: 'DRAFT', holdStatus: 'NONE' }), ctx());
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['confirm', 'hold', 'deleteDraft', 'cancel']);

      const confirm = findAction(actions, 'confirm');
      expect(confirm.primary).toBe(true);
      expect(confirm.needsConfirm).toBe(true);
      expect(findAction(actions, 'hold').needsReason).toBe('DOCUMENT_HOLD');
      expect(findAction(actions, 'cancel').needsReason).toBe('DOCUMENT_CANCEL');
      expect(findAction(actions, 'deleteDraft').needsConfirm).toBe(true);
    });

    it('DRAFT + holdStatus HELD exposes releaseHold (primary, reason DOCUMENT_HOLD_RELEASE), cancel, and deleteDraft', () => {
      const actions = resolveActions('sales-order', makeSalesOrder({ lifecycleStatus: 'DRAFT', holdStatus: 'HELD' }), ctx());
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['releaseHold', 'deleteDraft', 'cancel']);

      const release = findAction(actions, 'releaseHold');
      expect(release.primary).toBe(true);
      expect(release.needsReason).toBe('DOCUMENT_HOLD_RELEASE');
      expect(findAction(actions, 'cancel').needsReason).toBe('DOCUMENT_CANCEL');
    });

    it('CONFIRMED + holdStatus NONE exposes hold, print, and cancel with no primary', () => {
      const actions = resolveActions(
        'sales-order',
        makeSalesOrder({ lifecycleStatus: 'CONFIRMED', holdStatus: 'NONE', documentNumber: 'SO-2026-0001' }),
        ctx(),
      );
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['hold', 'print', 'cancel']);
      expect(actions.some((a) => a.primary)).toBe(false);
      expect(findAction(actions, 'hold').needsReason).toBe('DOCUMENT_HOLD');
    });

    it('CONFIRMED + holdStatus HELD exposes releaseHold, print, and cancel', () => {
      const actions = resolveActions(
        'sales-order',
        makeSalesOrder({ lifecycleStatus: 'CONFIRMED', holdStatus: 'HELD', documentNumber: 'SO-2026-0004' }),
        ctx(),
      );
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['releaseHold', 'print', 'cancel']);
      expect(findAction(actions, 'releaseHold').needsReason).toBe('DOCUMENT_HOLD_RELEASE');
    });

    it('CANCELLED returns no actions', () => {
      expect(resolveActions('sales-order', makeSalesOrder({ lifecycleStatus: 'CANCELLED' }), ctx())).toEqual([]);
    });

    it('CLOSED exposes print only (bar, non-primary) and maps to the Closed ok chip', () => {
      const actions = resolveActions(
        'sales-order',
        makeSalesOrder({ lifecycleStatus: 'CLOSED', documentNumber: 'SO-2026-0017' }),
        ctx(),
      );
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['print']);
      expect(findAction(actions, 'print').placement).toBe('bar');
      expect(findAction(actions, 'print').primary).toBe(false);
      expect(statusBadge('sales-order', 'lifecycle', 'CLOSED')).toEqual({
        labelKey: 'td.status.CLOSED',
        tone: 'ok',
      });
      expect(isDocumentRowPrintable('sales-order', 'CLOSED')).toBe(true);
    });
  });

  describe('purchase order', () => {
    it('DRAFT + NOT_REQUIRED and not approvalReady exposes submit (primary), cancel, and deleteDraft', () => {
      const po = makePurchaseOrder({ approvalStatus: 'NOT_REQUIRED', approvalReady: false });
      const actions = resolveActions('purchase-order', po, ctx());
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['submit', 'deleteDraft', 'cancel']);
      expect(findAction(actions, 'submit').primary).toBe(true);
    });

    it('DRAFT + REJECTED or WITHDRAWN and not approvalReady exposes submit (primary), cancel, and deleteDraft', () => {
      for (const approvalStatus of ['REJECTED', 'WITHDRAWN'] as const) {
        const po = makePurchaseOrder({ approvalStatus, approvalReady: false });
        const actions = resolveActions('purchase-order', po, ctx());
        assertInvariants(actions);
        expect(actions.map((a) => a.action)).toEqual(['submit', 'deleteDraft', 'cancel']);
        expect(findAction(actions, 'submit').primary).toBe(true);
      }
    });

    it('DRAFT + PENDING enables approve (primary) and poReject for an independent user and omits deleteDraft', () => {
      const po = makePurchaseOrder({
        approvalStatus: 'PENDING',
        createdBy: 'usr-creator',
      });
      const actions = resolveActions('purchase-order', po, ctx({ currentUserId: 'usr-approver' }));
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['approve', 'poReject', 'withdraw', 'cancel']);

      const approve = findAction(actions, 'approve');
      expect(approve.primary).toBe(true);
      expect(approve.disabledReasonKey).toBeNull();

      const reject = findAction(actions, 'poReject');
      expect(reject.needsReason).toBe('PURCHASE_ORDER_REJECT');
      expect(reject.danger).toBe(true);
      expect(reject.disabledReasonKey).toBeNull();
    });

    it('DRAFT + PENDING enforces maker-checker for the known creator', () => {
      const po = makePurchaseOrder({
        approvalStatus: 'PENDING',
        createdBy: 'usr-creator',
      });
      const actions = resolveActions('purchase-order', po, ctx({ currentUserId: 'usr-creator' }));
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['approve', 'poReject', 'withdraw', 'cancel']);
      expect(findAction(actions, 'approve').disabledReasonKey).toBe('tda.why.makerChecker');
      expect(findAction(actions, 'poReject').disabledReasonKey).toBe('tda.why.makerChecker');
    });

    it('DRAFT + PENDING leaves unknown submitter authority to the server', () => {
      const po = makePurchaseOrder({
        approvalStatus: 'PENDING',
        createdBy: 'usr-creator',
      });
      const actions = resolveActions('purchase-order', po, ctx({ currentUserId: 'usr-submitter' }));
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['approve', 'poReject', 'withdraw', 'cancel']);

      expect(findAction(actions, 'approve').disabledReasonKey).toBeNull();
      expect(findAction(actions, 'poReject').disabledReasonKey).toBeNull();
      expect(findAction(actions, 'withdraw').disabledReasonKey).toBeNull();
      expect(findAction(actions, 'withdraw').placement).toBe('bar');
    });

    it('DRAFT + APPROVED and approvalReady exposes poConfirm (primary, needsConfirm), cancel, and deleteDraft', () => {
      const po = makePurchaseOrder({ approvalStatus: 'APPROVED', approvalReady: true });
      const actions = resolveActions('purchase-order', po, ctx());
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['poConfirm', 'deleteDraft', 'cancel']);

      const confirm = findAction(actions, 'poConfirm');
      expect(confirm.primary).toBe(true);
      expect(confirm.needsConfirm).toBe(true);
    });

    it('DRAFT + NOT_REQUIRED + approvalReady exposes poConfirm (primary, needsConfirm), cancel, and deleteDraft', () => {
      const po = makePurchaseOrder({ approvalStatus: 'NOT_REQUIRED', approvalReady: true });
      const actions = resolveActions('purchase-order', po, ctx());
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['poConfirm', 'deleteDraft', 'cancel']);
      expect(findAction(actions, 'poConfirm').primary).toBe(true);
    });

    it('CONFIRMED without failed delivery exposes print and cancel', () => {
      const po = makePurchaseOrder({
        lifecycleStatus: 'CONFIRMED',
        approvalStatus: 'APPROVED',
        approvalReady: true,
        dispatchStatus: 'SENT',
        delivery: { status: 'COMPLETED', attemptCount: 1, lastErrorCode: null, nextAttemptAt: null },
        documentNumber: 'PO-2026-0012',
      });
      const actions = resolveActions('purchase-order', po, ctx());
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['print', 'cancel']);
    });

    it('CONFIRMED with retryable failed delivery exposes retryDelivery, print, and cancel', () => {
      const po = makePurchaseOrder({
        lifecycleStatus: 'CONFIRMED',
        approvalStatus: 'APPROVED',
        approvalReady: true,
        dispatchStatus: 'FAILED',
        delivery: {
          status: 'FAILED',
          attemptCount: 1,
          lastErrorCode: 'TRADE.PURCHASE_ORDER.DELIVERY_PDF_FAILED',
          nextAttemptAt: null,
        },
        documentNumber: 'PO-2026-0004',
      });
      const actions = resolveActions('purchase-order', po, ctx());
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['retryDelivery', 'print', 'cancel']);
      expect(findAction(actions, 'retryDelivery').disabledReasonKey).toBeNull();
      expect(canRetryDelivery(po.delivery)).toBe(true);
    });

    it('CONFIRMED with DELIVERY_EMAIL_FAILED omits retryDelivery', () => {
      const po = makePurchaseOrder({
        lifecycleStatus: 'CONFIRMED',
        approvalStatus: 'APPROVED',
        approvalReady: true,
        dispatchStatus: 'FAILED',
        delivery: {
          status: 'FAILED',
          attemptCount: 1,
          lastErrorCode: NON_RETRYABLE_DELIVERY_ERROR,
          nextAttemptAt: null,
        },
        documentNumber: 'PO-2026-0005',
      });
      const actions = resolveActions('purchase-order', po, ctx());
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['print', 'cancel']);
      expect(canRetryDelivery(po.delivery)).toBe(false);
    });

    it('DRAFT with sourcePurchaseQuotationId omits deleteDraft while keeping cancel (submit and approvalReady)', () => {
      const fromPqSubmit = makePurchaseOrder({
        approvalStatus: 'NOT_REQUIRED',
        approvalReady: false,
        sourcePurchaseQuotationId: 'pq-07',
      });
      const submitActions = resolveActions('purchase-order', fromPqSubmit, ctx());
      assertInvariants(submitActions);
      expect(submitActions.map((a) => a.action)).toEqual(['submit', 'cancel']);
      expect(submitActions.some((a) => a.action === 'deleteDraft')).toBe(false);

      const fromPqConfirm = makePurchaseOrder({
        approvalStatus: 'APPROVED',
        approvalReady: true,
        sourcePurchaseQuotationId: 'pq-07',
      });
      const confirmActions = resolveActions('purchase-order', fromPqConfirm, ctx());
      assertInvariants(confirmActions);
      expect(confirmActions.map((a) => a.action)).toEqual(['poConfirm', 'cancel']);
      expect(confirmActions.some((a) => a.action === 'deleteDraft')).toBe(false);

      const standalone = makePurchaseOrder({
        approvalStatus: 'NOT_REQUIRED',
        approvalReady: false,
        sourcePurchaseQuotationId: null,
      });
      expect(resolveActions('purchase-order', standalone, ctx()).some((a) => a.action === 'deleteDraft')).toBe(true);
    });

    it('CANCELLED returns no actions', () => {
      expect(resolveActions('purchase-order', makePurchaseOrder({ lifecycleStatus: 'CANCELLED' }), ctx())).toEqual([]);
    });

    it('CLOSED exposes print only (bar, non-primary) and maps to the Closed ok chip', () => {
      const actions = resolveActions(
        'purchase-order',
        makePurchaseOrder({ lifecycleStatus: 'CLOSED', documentNumber: 'PO-2026-0099' }),
        ctx(),
      );
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['print']);
      expect(findAction(actions, 'print').placement).toBe('bar');
      expect(findAction(actions, 'print').primary).toBe(false);
      expect(statusBadge('purchase-order', 'lifecycle', 'CLOSED')).toEqual({
        labelKey: 'td.status.CLOSED',
        tone: 'ok',
      });
      expect(isDocumentRowPrintable('purchase-order', 'CLOSED')).toBe(true);
    });
  });

  describe('purchase quotation', () => {
    it('DRAFT exposes issue (primary, needsConfirm) and deleteDraft (no pqCancel)', () => {
      const actions = resolveActions('purchase-quotation', makePurchaseQuotation({ lifecycleStatus: 'DRAFT' }), ctx());
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['issue', 'deleteDraft']);
      expect(actions.some((a) => a.action === 'pqCancel')).toBe(false);

      const issue = findAction(actions, 'issue');
      expect(issue.primary).toBe(true);
      expect(issue.needsConfirm).toBe(true);
      expect(issue.icon).toBe('tablerRubberStamp');

      expect(findAction(actions, 'deleteDraft').needsConfirm).toBe(true);
    });

    it('ISSUED exposes convertToPurchaseOrder (primary), print, createPurchaseOrderDirect (menu), and pqCancel', () => {
      const pq = makePurchaseQuotation({
        lifecycleStatus: 'ISSUED',
        documentNumber: 'PQ-2026-0004',
      });
      const actions = resolveActions('purchase-quotation', pq, ctx());
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual([
        'convertToPurchaseOrder',
        'print',
        'createPurchaseOrderDirect',
        'pqCancel',
      ]);

      const convert = findAction(actions, 'convertToPurchaseOrder');
      expect(convert.primary).toBe(true);
      expect(convert.icon).toBe('tablerTransform');

      const direct = findAction(actions, 'createPurchaseOrderDirect');
      expect(direct.placement).toBe('menu');
      expect(direct.needsConfirm).toBe(true);
      expect(direct.icon).toBe('tablerBolt');

      const pqCancel = findAction(actions, 'pqCancel');
      expect(pqCancel.placement).toBe('menu');
      expect(pqCancel.danger).toBe(true);
      expect(pqCancel.needsReason).toBe('DOCUMENT_CANCEL');
    });

    it('CONVERTED exposes openPurchaseOrder (primary) only', () => {
      const pq = makePurchaseQuotation({
        lifecycleStatus: 'CONVERTED',
        documentNumber: 'PQ-2026-0007',
        convertedPurchaseOrderId: 'po-12',
      });
      const actions = resolveActions('purchase-quotation', pq, ctx());
      assertInvariants(actions);
      expect(actions.map((a) => a.action)).toEqual(['openPurchaseOrder']);
      expect(findAction(actions, 'openPurchaseOrder').primary).toBe(true);
    });

    it('CANCELLED returns no actions', () => {
      expect(
        resolveActions('purchase-quotation', makePurchaseQuotation({ lifecycleStatus: 'CANCELLED' }), ctx()),
      ).toEqual([]);
    });
  });
});
