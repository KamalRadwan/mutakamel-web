import type { ScopeState } from '../../../../core/scope/scope';
import { ApiError, type TradeContext } from '../../shared/trade-api';
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

export const DOCUMENT_ACTION_PERMISSION_KEYS: readonly string[] = [
  'trade.quotations.read',
  'trade.quotations.create',
  'trade.quotations.update',
  'trade.quotations.send',
  'trade.quotations.accept',
  'trade.quotations.reject',
  'trade.quotations.cancel',
  'trade.quotations.convert',
  'trade.sales_orders.read',
  'trade.sales_orders.create',
  'trade.sales_orders.update',
  'trade.sales_orders.confirm',
  'trade.sales_orders.hold',
  'trade.sales_orders.cancel',
  'trade.purchase_orders.read',
  'trade.purchase_orders.create',
  'trade.purchase_orders.update',
  'trade.purchase_orders.submit',
  'trade.purchase_orders.approve',
  'trade.purchase_orders.confirm',
  'trade.purchase_orders.cancel',
  'trade.purchase_quotations.read',
  'trade.purchase_quotations.create',
  'trade.purchase_quotations.update',
  'trade.purchase_quotations.issue',
  'trade.purchase_quotations.cancel',
  'trade.purchase_quotations.convert',
];

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
  | { type: 'forbidden' }
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
  ctx?: TradeContext | ScopeState;
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
  if (err.status === 403 || err.code === 'TRADE.AUTH.TARGET_DENIED') {
    return { type: 'forbidden' };
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
  const { kind, action, detail, params, idempotencyKey, ctx } = input;
  const doc = detail as AnyDocumentDetail;

  try {
    switch (action) {
      case 'send': {
        const updated =
          ctx !== undefined
            ? await api.quotationAction(doc.id, doc.version, 'send', undefined, idempotencyKey, ctx)
            : await api.quotationAction(doc.id, doc.version, 'send', undefined, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.quotationSent',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'accept': {
        const updated =
          ctx !== undefined
            ? await api.quotationAction(doc.id, doc.version, 'accept', undefined, idempotencyKey, ctx)
            : await api.quotationAction(doc.id, doc.version, 'accept', undefined, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.quotationAccepted',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'reject': {
        const reason = toReason(params);
        const updated =
          ctx !== undefined
            ? await api.quotationAction(doc.id, doc.version, 'reject', reason, idempotencyKey, ctx)
            : await api.quotationAction(doc.id, doc.version, 'reject', reason, idempotencyKey);
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
            const updated =
              ctx !== undefined
                ? await api.quotationAction(doc.id, doc.version, 'cancel', reason, idempotencyKey, ctx)
                : await api.quotationAction(doc.id, doc.version, 'cancel', reason, idempotencyKey);
            return {
              type: 'done',
              toastKey: 'tdpg.toast.quotationCancelled',
              navigateTo: null,
              version: updated.version,
              detail: updated,
            };
          }
          case 'sales-order': {
            const updated =
              ctx !== undefined
                ? await api.salesOrderAction(doc.id, doc.version, 'cancel', reason, idempotencyKey, ctx)
                : await api.salesOrderAction(doc.id, doc.version, 'cancel', reason, idempotencyKey);
            return {
              type: 'done',
              toastKey: 'tdpg.toast.salesOrderCancelled',
              navigateTo: null,
              version: updated.version,
              detail: updated,
            };
          }
          case 'purchase-order': {
            const updated =
              ctx !== undefined
                ? await api.purchaseOrderAction(doc.id, doc.version, 'cancel', reason, idempotencyKey, ctx)
                : await api.purchaseOrderAction(doc.id, doc.version, 'cancel', reason, idempotencyKey);
            return {
              type: 'done',
              toastKey: 'tdpg.toast.purchaseOrderCancelled',
              navigateTo: null,
              version: updated.version,
              detail: updated,
            };
          }
          case 'purchase-quotation': {
            const updated =
              ctx !== undefined
                ? await api.cancelPurchaseQuotation(doc.id, doc.version, reason, idempotencyKey, ctx)
                : await api.cancelPurchaseQuotation(doc.id, doc.version, reason, idempotencyKey);
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
        const reason = toReason(params);
        const updated =
          ctx !== undefined
            ? await api.cancelPurchaseQuotation(doc.id, doc.version, reason, idempotencyKey, ctx)
            : await api.cancelPurchaseQuotation(doc.id, doc.version, reason, idempotencyKey);
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
        const order =
          ctx !== undefined
            ? await api.createSalesOrderFromQuotation(doc.id, doc.version, {}, idempotencyKey, ctx)
            : await api.createSalesOrderFromQuotation(doc.id, doc.version, {}, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.salesOrderCreated',
          navigateTo: `/trade/documents/sales-orders/${order.id}`,
          version: order.version,
          detail: order,
        };
      }

      case 'openSalesOrder': {
        const page = await api.listDocuments(
          'sales-order',
          {
            page: 1,
            limit: 100,
            partyId: doc.partyId,
          },
          ctx ?? { companyId: doc.companyId, branchId: doc.branchId },
        );
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
        const res =
          ctx !== undefined
            ? await api.confirmSalesOrder(doc.id, doc.version, params?.requestedDeadline, idempotencyKey, ctx)
            : await api.confirmSalesOrder(doc.id, doc.version, params?.requestedDeadline, idempotencyKey);
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
        const reason = toReason(params);
        const updated =
          ctx !== undefined
            ? await api.salesOrderAction(doc.id, doc.version, 'hold', reason, idempotencyKey, ctx)
            : await api.salesOrderAction(doc.id, doc.version, 'hold', reason, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.salesOrderHeld',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'releaseHold': {
        const reason = toReason(params);
        const updated =
          ctx !== undefined
            ? await api.salesOrderAction(doc.id, doc.version, 'release-hold', reason, idempotencyKey, ctx)
            : await api.salesOrderAction(doc.id, doc.version, 'release-hold', reason, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.salesOrderHoldReleased',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'submit': {
        const updated =
          ctx !== undefined
            ? await api.purchaseOrderAction(doc.id, doc.version, 'submit', undefined, idempotencyKey, ctx)
            : await api.purchaseOrderAction(doc.id, doc.version, 'submit', undefined, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.purchaseOrderSubmitted',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'withdraw': {
        const updated =
          ctx !== undefined
            ? await api.purchaseOrderAction(doc.id, doc.version, 'withdraw', undefined, idempotencyKey, ctx)
            : await api.purchaseOrderAction(doc.id, doc.version, 'withdraw', undefined, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.purchaseOrderWithdrawn',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'approve': {
        const updated =
          ctx !== undefined
            ? await api.purchaseOrderAction(doc.id, doc.version, 'approve', undefined, idempotencyKey, ctx)
            : await api.purchaseOrderAction(doc.id, doc.version, 'approve', undefined, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.purchaseOrderApproved',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'poReject': {
        const reason = toReason(params);
        const updated =
          ctx !== undefined
            ? await api.purchaseOrderAction(doc.id, doc.version, 'reject', reason, idempotencyKey, ctx)
            : await api.purchaseOrderAction(doc.id, doc.version, 'reject', reason, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.purchaseOrderRejected',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'poConfirm': {
        const updated =
          ctx !== undefined
            ? await api.purchaseOrderAction(doc.id, doc.version, 'confirm', undefined, idempotencyKey, ctx)
            : await api.purchaseOrderAction(doc.id, doc.version, 'confirm', undefined, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.purchaseOrderConfirmed',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'retryDelivery': {
        const updated =
          ctx !== undefined
            ? await api.retryPurchaseDelivery(doc.id, doc.version, idempotencyKey, ctx)
            : await api.retryPurchaseDelivery(doc.id, doc.version, idempotencyKey);
        return {
          type: 'done',
          toastKey: 'tdpg.toast.deliveryRetried',
          navigateTo: null,
          version: updated.version,
          detail: updated,
        };
      }

      case 'issue': {
        const updated =
          ctx !== undefined
            ? await api.issuePurchaseQuotation(doc.id, doc.version, idempotencyKey, ctx)
            : await api.issuePurchaseQuotation(doc.id, doc.version, idempotencyKey);
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
        const body = { receivingNodeId: params?.receivingNodeId ?? '' };
        const order =
          ctx !== undefined
            ? await api.createPurchaseOrderFromPurchaseQuotation(doc.id, doc.version, body, idempotencyKey, ctx)
            : await api.createPurchaseOrderFromPurchaseQuotation(doc.id, doc.version, body, idempotencyKey);
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
        if (ctx !== undefined) {
          await api.deleteDocument(kind, doc.id, doc.version, idempotencyKey, ctx);
        } else {
          await api.deleteDocument(kind, doc.id, doc.version, idempotencyKey);
        }
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
