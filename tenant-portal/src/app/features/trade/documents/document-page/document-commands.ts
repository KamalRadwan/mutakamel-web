import { ApiError } from '../../shared/trade-api';
import { KIND_CONFIG } from '../shared/document-kinds';
import {
  cancelPurchaseQuotation,
  confirmSalesOrder,
  createPurchaseOrderFromPurchaseQuotation,
  createSalesOrderFromQuotation,
  deleteDocument,
  issuePurchaseQuotation,
  listDocuments,
  purchaseOrderAction,
  quotationAction,
  retryPurchaseDelivery,
  salesOrderAction,
  type ReasonInput,
} from '../shared/documents.api';
import type {
  AnyDocumentDetail,
  DocumentKind,
  PurchaseQuotationDetail,
} from '../shared/document.model';

export type DocAction =
  | 'send'
  | 'accept'
  | 'reject'
  | 'cancel'
  | 'convert'
  | 'openSalesOrder'
  | 'createSalesOrderDirect'
  | 'confirm'
  | 'hold'
  | 'releaseHold'
  | 'submit'
  | 'withdraw'
  | 'approve'
  | 'poReject'
  | 'poConfirm'
  | 'retryDelivery'
  | 'issue'
  | 'createPurchaseOrder'
  | 'convertToPurchaseOrder'
  | 'createPurchaseOrderDirect'
  | 'openPurchaseOrder'
  | 'pqCancel'
  | 'deleteDraft'
  | 'print';

// later from the session permissions
export const TRADE_DOCUMENT_PERMS: ReadonlySet<string> = new Set([
  'trade.quotations.read',
  'trade.quotations.create',
  'trade.quotations.update',
  'trade.quotations.delete',
  'trade.quotations.send',
  'trade.quotations.accept',
  'trade.quotations.reject',
  'trade.quotations.cancel',
  'trade.quotations.convert',
  'trade.sales_orders.read',
  'trade.sales_orders.create',
  'trade.sales_orders.update',
  'trade.sales_orders.delete',
  'trade.sales_orders.confirm',
  'trade.sales_orders.hold',
  'trade.sales_orders.cancel',
  'trade.purchase_orders.read',
  'trade.purchase_orders.create',
  'trade.purchase_orders.update',
  'trade.purchase_orders.delete',
  'trade.purchase_orders.submit',
  'trade.purchase_orders.approve',
  'trade.purchase_orders.confirm',
  'trade.purchase_orders.cancel',
  'trade.purchase_quotations.read',
  'trade.purchase_quotations.create',
  'trade.purchase_quotations.update',
  'trade.purchase_quotations.delete',
  'trade.purchase_quotations.issue',
  'trade.purchase_quotations.cancel',
]);

export type CommandOutcome =
  | {
      type: 'done';
      toastKey: string | null;
      navigateTo: string | null;
      toastParams?: Record<string, string | number>;
      infoToastKey?: string | null;
      infoToastParams?: Record<string, string | number>;
      version?: number;
      detail?: unknown;
    }
  | { type: 'conflict' }
  | { type: 'error'; code: string; details?: Record<string, unknown> };

export interface RunCommandParams {
  reasonCode?: string;
  reasonNote?: string | null;
  requestedDeadline?: string;
  receivingNodeId?: string;
}

export interface RunCommandInput {
  kind: DocumentKind;
  action: DocAction;
  detail: unknown;
  params?: RunCommandParams;
  /**
   * The x-idempotency-key of this user action. The caller keeps it for a retry of the same action on the
   * same version and parameters (DocumentRequestKeys), and starts a new one for the next action.
   */
  idempotencyKey: string;
}

export interface DocumentCommandApi {
  quotationAction: typeof quotationAction;
  salesOrderAction: typeof salesOrderAction;
  confirmSalesOrder: typeof confirmSalesOrder;
  purchaseOrderAction: typeof purchaseOrderAction;
  retryPurchaseDelivery: typeof retryPurchaseDelivery;
  issuePurchaseQuotation: typeof issuePurchaseQuotation;
  cancelPurchaseQuotation: typeof cancelPurchaseQuotation;
  createSalesOrderFromQuotation: typeof createSalesOrderFromQuotation;
  createPurchaseOrderFromPurchaseQuotation: typeof createPurchaseOrderFromPurchaseQuotation;
  deleteDocument: typeof deleteDocument;
  listDocuments: typeof listDocuments;
}

const DEFAULT_COMMAND_API: DocumentCommandApi = {
  quotationAction,
  salesOrderAction,
  confirmSalesOrder,
  purchaseOrderAction,
  retryPurchaseDelivery,
  issuePurchaseQuotation,
  cancelPurchaseQuotation,
  createSalesOrderFromQuotation,
  createPurchaseOrderFromPurchaseQuotation,
  deleteDocument,
  listDocuments,
};

function toReason(params?: RunCommandParams): ReasonInput {
  const note = params?.reasonNote?.trim();
  return {
    reasonCode: params?.reasonCode ?? '',
    reasonNote: note && note.length > 0 ? note : null,
  };
}

function mapCommandError(err: unknown): CommandOutcome {
  if (!(err instanceof ApiError)) {
    return { type: 'error', code: 'generic' };
  }
  if (err.status === 409 && err.code === 'TRADE.CONCURRENCY.STALE_VERSION') {
    return { type: 'conflict' };
  }
  const details = err.details as Record<string, unknown> | undefined;
  return {
    type: 'error',
    code: err.code,
    ...(details ? { details } : {}),
  };
}

export async function runCommand(
  input: RunCommandInput,
  api: DocumentCommandApi = DEFAULT_COMMAND_API,
): Promise<CommandOutcome> {
  const { kind, action, detail, params, idempotencyKey } = input;
  const doc = detail as AnyDocumentDetail;

  try {
    switch (action) {
      case 'send': {
        const updated = await api.quotationAction(doc.id, doc.version, 'send', undefined, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.quotationSent',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'accept': {
        const updated = await api.quotationAction(doc.id, doc.version, 'accept', undefined, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.quotationAccepted',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'reject': {
        const updated = await api.quotationAction(doc.id, doc.version, 'reject', toReason(params), idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.quotationRejected',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'cancel': {
        const reason = toReason(params);
        switch (kind) {
          case 'quotation': {
            const updated = await api.quotationAction(doc.id, doc.version, 'cancel', reason, idempotencyKey);
            return {
              type: 'done',
              toastKey: 'tdpg.toast.quotationCancelled',
              navigateTo: null,
              version: updated.version,
              detail: updated,
            };
          }
          case 'sales-order': {
            const updated = await api.salesOrderAction(doc.id, doc.version, 'cancel', reason, idempotencyKey);
            return {
              type: 'done',
              toastKey: 'tdpg.toast.salesOrderCancelled',
              navigateTo: null,
              version: updated.version,
              detail: updated,
            };
          }
          case 'purchase-order': {
            const updated = await api.purchaseOrderAction(doc.id, doc.version, 'cancel', reason, idempotencyKey);
            return {
              type: 'done',
              toastKey: 'tdpg.toast.purchaseOrderCancelled',
              navigateTo: null,
              version: updated.version,
              detail: updated,
            };
          }
          case 'purchase-quotation': {
            const updated = await api.cancelPurchaseQuotation(doc.id, doc.version, reason, idempotencyKey);
            return {
              type: 'done',
              toastKey: 'tdpg.toast.purchaseQuotationCancelled',
              navigateTo: null,
              version: updated.version,
              detail: updated,
            };
          }
        }
      }

      case 'pqCancel': {
        const updated = await api.cancelPurchaseQuotation(doc.id, doc.version, toReason(params), idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.purchaseQuotationCancelled',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'convert':
        return {
          type: 'done',
          toastKey: null,
          navigateTo: `/trade/documents/sales-orders/new?fromQuotation=${encodeURIComponent(doc.id)}`,
        };

      case 'createSalesOrderDirect': {
        const order = await api.createSalesOrderFromQuotation(doc.id, doc.version, {}, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.salesOrderCreated',
          navigateTo: `/trade/documents/sales-orders/${order.id}`,
          version: order.version,
          detail: order,
        };
      }

      case 'openSalesOrder': {
        const page = await api.listDocuments('sales-order', {
          page: 1,
          limit: 100,
          partyId: doc.partyId,
        });
        const match = page.items.find((item) => item.sourceQuotationId === doc.id);
        return {
          type: 'done',
          toastKey: null,
          navigateTo: match
            ? `/trade/documents/sales-orders/${match.id}`
            : `/trade/documents/sales-orders?partyId=${encodeURIComponent(doc.partyId)}`,
        };
      }

      case 'confirm': {
        const res = await api.confirmSalesOrder(doc.id, doc.version, params?.requestedDeadline, idempotencyKey);
        const unallocatedCount = res.unallocatedLines.length;
        return {
          type: 'done',
          toastKey: 'tdpg.toast.salesOrderConfirmed',
          navigateTo: null,
          version: res.version,
          detail: res,
          ...(unallocatedCount > 0
            ? {
                infoToastKey: 'tdpg.toast.unallocatedLines',
                infoToastParams: { n: unallocatedCount },
              }
            : {}),
        };
      }

      case 'hold': {
        const updated = await api.salesOrderAction(doc.id, doc.version, 'hold', toReason(params), idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.salesOrderHeld',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'releaseHold': {
        const updated = await api.salesOrderAction(
          doc.id,
          doc.version,
          'release-hold',
          toReason(params),
          idempotencyKey,
        );
        return {
          type: 'done',
          toastKey: 'tdpg.toast.salesOrderHoldReleased',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'submit': {
        const updated = await api.purchaseOrderAction(doc.id, doc.version, 'submit', undefined, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.purchaseOrderSubmitted',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'withdraw': {
        const updated = await api.purchaseOrderAction(doc.id, doc.version, 'withdraw', undefined, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.purchaseOrderWithdrawn',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'approve': {
        const updated = await api.purchaseOrderAction(doc.id, doc.version, 'approve', undefined, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.purchaseOrderApproved',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'poReject': {
        const updated = await api.purchaseOrderAction(doc.id, doc.version, 'reject', toReason(params), idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.purchaseOrderRejected',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'poConfirm': {
        const updated = await api.purchaseOrderAction(doc.id, doc.version, 'confirm', undefined, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.purchaseOrderConfirmed',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'retryDelivery': {
        const updated = await api.retryPurchaseDelivery(doc.id, doc.version, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.deliveryRetried',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'issue': {
        const updated = await api.issuePurchaseQuotation(doc.id, doc.version, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.purchaseQuotationIssued',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'convertToPurchaseOrder':
      case 'createPurchaseOrder':
        return {
          type: 'done',
          toastKey: null,
          navigateTo: `/trade/documents/purchase-orders/new?fromPurchaseQuotation=${encodeURIComponent(doc.id)}`,
        };

      case 'createPurchaseOrderDirect': {
        const order = await api.createPurchaseOrderFromPurchaseQuotation(doc.id, doc.version, {
          receivingNodeId: params?.receivingNodeId ?? '',
        }, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.purchaseOrderCreated',
          navigateTo: `/trade/documents/purchase-orders/${order.id}`,
          version: order.version,
          detail: order,
        };
      }

      case 'openPurchaseOrder': {
        const pq = detail as PurchaseQuotationDetail;
        const convertedId = pq.convertedPurchaseOrderId;
        return {
          type: 'done',
          toastKey: null,
          navigateTo: convertedId
            ? `/trade/documents/purchase-orders/${convertedId}`
            : `/trade/documents/purchase-orders?partyId=${encodeURIComponent(doc.partyId)}`,
        };
      }

      case 'deleteDraft': {
        await api.deleteDocument(kind, doc.id, doc.version, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.draftDeleted',
          navigateTo: `/trade/documents/${KIND_CONFIG[kind].segment}`,
        };
      }

      case 'print':
        return {
          type: 'done',
          toastKey: null,
          navigateTo: null,
        };
    }
  } catch (err) {
    return mapCommandError(err);
  }
}
