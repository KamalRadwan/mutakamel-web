import type { ReasonKind } from '../../shared/trade-foundation.model';
import type {
  DeliveryInfo,
  DocumentKind,
  PurchaseOrderDetail,
  PurchaseQuotationDetail,
  QuotationCurrentRevisionSummary,
  QuotationDetail,
  QuotationRevision,
  SalesOrderDetail,
} from '../shared/document.model';

export type DocAction =
  | 'send'
  | 'accept'
  | 'reject'
  | 'cancel'
  | 'convert'
  | 'createSalesOrderDirect'
  | 'openSalesOrder'
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
  | 'convertToPurchaseOrder'
  | 'createPurchaseOrderDirect'
  | 'openPurchaseOrder'
  | 'pqCancel'
  | 'deleteDraft'
  | 'print';

export interface ResolvedAction {
  action: DocAction;
  primary: boolean;
  danger: boolean;
  needsReason: ReasonKind | null;
  needsConfirm: boolean;
  disabledReasonKey: string | null;
  icon: string;
  labelKey: string;
  placement: 'bar' | 'menu';
}

export interface ResolveActionsContext {
  dirty: boolean;
  isNew: boolean;
  currentUserId: string;
  perms: ReadonlySet<string>;
  now: Date;
}

export const NON_RETRYABLE_DELIVERY_ERROR = 'TRADE.PURCHASE_ORDER.DELIVERY_EMAIL_FAILED';

export function canRetryDelivery(delivery: DeliveryInfo | null | undefined): boolean {
  return delivery?.status === 'FAILED' && delivery.lastErrorCode !== NON_RETRYABLE_DELIVERY_ERROR;
}

export const ACTION_ICONS: Readonly<Record<DocAction, string>> = {
  send: 'tablerSend',
  accept: 'tablerCircleCheck',
  reject: 'tablerCircleX',
  cancel: 'tablerBan',
  convert: 'tablerTransform',
  createSalesOrderDirect: 'tablerBolt',
  openSalesOrder: 'tablerExternalLink',
  confirm: 'tablerChecks',
  hold: 'tablerPlayerPause',
  releaseHold: 'tablerPlayerPlay',
  submit: 'tablerSend',
  withdraw: 'tablerArrowBackUp',
  approve: 'tablerCircleCheck',
  poReject: 'tablerCircleX',
  poConfirm: 'tablerChecks',
  retryDelivery: 'tablerRefresh',
  issue: 'tablerRubberStamp',
  convertToPurchaseOrder: 'tablerTransform',
  createPurchaseOrderDirect: 'tablerBolt',
  openPurchaseOrder: 'tablerExternalLink',
  pqCancel: 'tablerBan',
  deleteDraft: 'tablerTrash',
  print: 'tablerPrinter',
};

const READ_PERM_BY_KIND: Readonly<Record<DocumentKind, string>> = {
  quotation: 'trade.quotations.read',
  'sales-order': 'trade.sales_orders.read',
  'purchase-order': 'trade.purchase_orders.read',
  'purchase-quotation': 'trade.purchase_quotations.read',
};

const DELETE_PERM_BY_KIND: Readonly<Record<DocumentKind, string>> = {
  quotation: 'trade.quotations.delete',
  'sales-order': 'trade.sales_orders.delete',
  'purchase-order': 'trade.purchase_orders.delete',
  'purchase-quotation': 'trade.purchase_quotations.delete',
};

const ACTION_PERMS: Readonly<Partial<Record<DocAction, readonly string[]>>> = {
  send: ['trade.quotations.send'],
  accept: ['trade.quotations.accept'],
  reject: ['trade.quotations.reject'],
  convert: ['trade.quotations.convert', 'trade.sales_orders.create'],
  createSalesOrderDirect: ['trade.quotations.convert', 'trade.sales_orders.create'],
  openSalesOrder: ['trade.sales_orders.read'],
  confirm: ['trade.sales_orders.confirm'],
  hold: ['trade.sales_orders.hold'],
  releaseHold: ['trade.sales_orders.hold'],
  submit: ['trade.purchase_orders.submit'],
  withdraw: ['trade.purchase_orders.submit'],
  approve: ['trade.purchase_orders.approve'],
  poReject: ['trade.purchase_orders.approve'],
  poConfirm: ['trade.purchase_orders.confirm'],
  retryDelivery: ['trade.purchase_orders.confirm'],
  issue: ['trade.purchase_quotations.issue'],
  convertToPurchaseOrder: ['trade.purchase_orders.create'],
  createPurchaseOrderDirect: ['trade.purchase_orders.create'],
  openPurchaseOrder: ['trade.purchase_orders.read'],
  pqCancel: ['trade.purchase_quotations.cancel'],
};

const CANCEL_PERM_BY_KIND: Readonly<Record<DocumentKind, string>> = {
  quotation: 'trade.quotations.cancel',
  'sales-order': 'trade.sales_orders.cancel',
  'purchase-order': 'trade.purchase_orders.cancel',
  'purchase-quotation': 'trade.purchase_quotations.cancel',
};

interface ActionSpec {
  action: DocAction;
  primary?: boolean;
  danger?: boolean;
  needsReason?: ReasonKind | null;
  needsConfirm?: boolean;
  stateDisabledReasonKey?: string | null;
  placement: 'bar' | 'menu';
}

function requiredPerms(kind: DocumentKind, action: DocAction): readonly string[] {
  if (action === 'print') return [READ_PERM_BY_KIND[kind]];
  if (action === 'deleteDraft') return [DELETE_PERM_BY_KIND[kind]];
  if (action === 'cancel') return [CANCEL_PERM_BY_KIND[kind]];
  return ACTION_PERMS[action] ?? [];
}

function makeAction(kind: DocumentKind, ctx: ResolveActionsContext, spec: ActionSpec): ResolvedAction {
  const hasPerm = requiredPerms(kind, spec.action).every((perm) => ctx.perms.has(perm));
  let disabledReasonKey: string | null = null;
  if (!hasPerm) {
    disabledReasonKey = 'tda.why.permission';
  } else if (ctx.dirty && spec.action !== 'print') {
    disabledReasonKey = 'tda.why.saveFirst';
  } else {
    disabledReasonKey = spec.stateDisabledReasonKey ?? null;
  }

  return {
    action: spec.action,
    primary: spec.primary ?? false,
    danger: spec.danger ?? false,
    needsReason: spec.needsReason ?? null,
    needsConfirm: spec.needsConfirm ?? false,
    disabledReasonKey,
    icon: ACTION_ICONS[spec.action],
    labelKey: `tda.actions.${spec.action}`,
    placement: spec.placement,
  };
}

function getCurrentRevision(
  q: QuotationDetail,
): QuotationRevision | QuotationCurrentRevisionSummary | { priceLockExpiresAt: string | null } | null {
  if (q.currentRevisionId) {
    if (Array.isArray(q.revisions)) {
      const matched = q.revisions.find((rev) => rev.id === q.currentRevisionId);
      if (matched) return matched;
    }
    if (q.currentRevision && q.currentRevision.id === q.currentRevisionId) {
      return q.currentRevision;
    }
    return { priceLockExpiresAt: q.currentRevision?.priceLockExpiresAt ?? null };
  }
  return q.currentRevision ?? null;
}

function resolveQuotation(q: QuotationDetail, ctx: ResolveActionsContext): ResolvedAction[] {
  const currentRev = getCurrentRevision(q);
  const build = (spec: ActionSpec) => makeAction('quotation', ctx, spec);

  switch (q.lifecycleStatus) {
    case 'DRAFT': {
      const actions: ResolvedAction[] = [
        build({
          action: 'send',
          primary: true,
          placement: 'bar',
          stateDisabledReasonKey: currentRev ? null : 'tda.why.noLines',
        }),
      ];
      if (q.documentNumber === null) {
        actions.push(
          build({
            action: 'deleteDraft',
            danger: true,
            needsConfirm: true,
            placement: 'menu',
          }),
        );
      }
      actions.push(
        build({
          action: 'cancel',
          danger: true,
          needsReason: 'DOCUMENT_CANCEL',
          placement: 'menu',
        }),
      );
      return actions;
    }

    case 'SENT': {
      const expiresAt = currentRev?.priceLockExpiresAt ?? null;
      const expiresMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
      const expired = Number.isFinite(expiresMs) && ctx.now.getTime() > expiresMs;
      return [
        build({
          action: 'accept',
          primary: true,
          placement: 'bar',
          stateDisabledReasonKey: expired ? 'tda.why.priceLockExpired' : null,
        }),
        build({
          action: 'reject',
          danger: true,
          needsReason: 'QUOTATION_REJECT',
          placement: 'bar',
        }),
        build({
          action: 'print',
          placement: 'bar',
        }),
        build({
          action: 'cancel',
          danger: true,
          needsReason: 'DOCUMENT_CANCEL',
          placement: 'menu',
        }),
      ];
    }

    case 'ACCEPTED':
      return [
        build({
          action: 'convert',
          primary: true,
          placement: 'bar',
        }),
        build({
          action: 'print',
          placement: 'bar',
        }),
        build({
          action: 'createSalesOrderDirect',
          needsConfirm: true,
          placement: 'menu',
        }),
      ];

    case 'CONVERTED':
      return [
        build({
          action: 'openSalesOrder',
          primary: true,
          placement: 'bar',
        }),
        build({
          action: 'print',
          placement: 'bar',
        }),
      ];

    case 'REJECTED':
      return [
        build({
          action: 'print',
          placement: 'bar',
        }),
      ];

    case 'EXPIRED':
    case 'CANCELLED':
      return [];
  }
}

function resolveSalesOrder(so: SalesOrderDetail, ctx: ResolveActionsContext): ResolvedAction[] {
  const build = (spec: ActionSpec) => makeAction('sales-order', ctx, spec);

  switch (so.lifecycleStatus) {
    case 'DRAFT': {
      const actions: ResolvedAction[] = [];
      if (so.holdStatus === 'HELD') {
        actions.push(
          build({
            action: 'releaseHold',
            primary: true,
            needsReason: 'DOCUMENT_HOLD_RELEASE',
            placement: 'bar',
          }),
        );
      } else {
        actions.push(
          build({
            action: 'confirm',
            primary: true,
            needsConfirm: true,
            placement: 'bar',
          }),
          build({
            action: 'hold',
            needsReason: 'DOCUMENT_HOLD',
            placement: 'bar',
          }),
        );
      }
      // Backend deleteSalesOrder: DRAFT and confirmation NOT_STARTED only, else 409 DELETE_NOT_ALLOWED.
      if (so.confirmationStatus === 'NOT_STARTED') {
        actions.push(
          build({
            action: 'deleteDraft',
            danger: true,
            needsConfirm: true,
            placement: 'menu',
          }),
        );
      }
      actions.push(
        build({
          action: 'cancel',
          danger: true,
          needsReason: 'DOCUMENT_CANCEL',
          placement: 'menu',
        }),
      );
      return actions;
    }

    case 'CONFIRMED':
      return [
        build(
          so.holdStatus === 'HELD'
            ? {
                action: 'releaseHold',
                needsReason: 'DOCUMENT_HOLD_RELEASE',
                placement: 'bar',
              }
            : {
                action: 'hold',
                needsReason: 'DOCUMENT_HOLD',
                placement: 'bar',
              },
        ),
        build({
          action: 'print',
          placement: 'bar',
        }),
        build({
          action: 'cancel',
          danger: true,
          needsReason: 'DOCUMENT_CANCEL',
          placement: 'menu',
        }),
      ];

    case 'CLOSED':
      return [
        build({
          action: 'print',
          placement: 'bar',
        }),
      ];

    case 'CANCELLED':
      return [];
  }
}

function resolvePurchaseOrder(po: PurchaseOrderDetail, ctx: ResolveActionsContext): ResolvedAction[] {
  const build = (spec: ActionSpec) => makeAction('purchase-order', ctx, spec);

  switch (po.lifecycleStatus) {
    case 'DRAFT': {
      if (po.approvalStatus === 'PENDING') {
        const isSubmitter = po.submittedBy !== null && ctx.currentUserId === po.submittedBy;
        const isMakerOrSubmitter = ctx.currentUserId === po.createdBy || isSubmitter;
        const makerReason = isMakerOrSubmitter ? 'tda.why.makerChecker' : null;
        const actions: ResolvedAction[] = [
          build({
            action: 'approve',
            primary: true,
            placement: 'bar',
            stateDisabledReasonKey: makerReason,
          }),
          build({
            action: 'poReject',
            danger: true,
            needsReason: 'PURCHASE_ORDER_REJECT',
            placement: 'bar',
            stateDisabledReasonKey: makerReason,
          }),
        ];
        if (isSubmitter) {
          actions.push(
            build({
              action: 'withdraw',
              placement: 'bar',
            }),
          );
        }
        actions.push(
          build({
            action: 'cancel',
            danger: true,
            needsReason: 'DOCUMENT_CANCEL',
            placement: 'menu',
          }),
        );
        return actions;
      }

      if (po.approvalReady) {
        const actions: ResolvedAction[] = [
          build({
            action: 'poConfirm',
            primary: true,
            needsConfirm: true,
            placement: 'bar',
          }),
        ];
        if (po.sourcePurchaseQuotationId === null) {
          actions.push(
            build({
              action: 'deleteDraft',
              danger: true,
              needsConfirm: true,
              placement: 'menu',
            }),
          );
        }
        actions.push(
          build({
            action: 'cancel',
            danger: true,
            needsReason: 'DOCUMENT_CANCEL',
            placement: 'menu',
          }),
        );
        return actions;
      }

      if (
        po.approvalStatus === 'NOT_REQUIRED' ||
        po.approvalStatus === 'REJECTED' ||
        po.approvalStatus === 'WITHDRAWN'
      ) {
        const actions: ResolvedAction[] = [
          build({
            action: 'submit',
            primary: true,
            placement: 'bar',
          }),
        ];
        if (po.sourcePurchaseQuotationId === null) {
          actions.push(
            build({
              action: 'deleteDraft',
              danger: true,
              needsConfirm: true,
              placement: 'menu',
            }),
          );
        }
        actions.push(
          build({
            action: 'cancel',
            danger: true,
            needsReason: 'DOCUMENT_CANCEL',
            placement: 'menu',
          }),
        );
        return actions;
      }

      return [];
    }

    case 'CONFIRMED': {
      const actions: ResolvedAction[] = [];
      if (canRetryDelivery(po.delivery)) {
        actions.push(
          build({
            action: 'retryDelivery',
            placement: 'bar',
          }),
        );
      }
      actions.push(
        build({
          action: 'print',
          placement: 'bar',
        }),
        build({
          action: 'cancel',
          danger: true,
          needsReason: 'DOCUMENT_CANCEL',
          placement: 'menu',
        }),
      );
      return actions;
    }

    case 'CLOSED':
      return [
        build({
          action: 'print',
          placement: 'bar',
        }),
      ];

    case 'CANCELLED':
      return [];
  }
}

function resolvePurchaseQuotation(pq: PurchaseQuotationDetail, ctx: ResolveActionsContext): ResolvedAction[] {
  const build = (spec: ActionSpec) => makeAction('purchase-quotation', ctx, spec);

  switch (pq.lifecycleStatus) {
    case 'DRAFT':
      return [
        build({
          action: 'issue',
          primary: true,
          needsConfirm: true,
          placement: 'bar',
        }),
        build({
          action: 'deleteDraft',
          danger: true,
          needsConfirm: true,
          placement: 'menu',
        }),
      ];

    case 'ISSUED':
      return [
        build({
          action: 'convertToPurchaseOrder',
          primary: true,
          placement: 'bar',
        }),
        build({
          action: 'print',
          placement: 'bar',
        }),
        build({
          action: 'createPurchaseOrderDirect',
          needsConfirm: true,
          placement: 'menu',
        }),
        build({
          action: 'pqCancel',
          danger: true,
          needsReason: 'DOCUMENT_CANCEL',
          placement: 'menu',
        }),
      ];

    case 'CONVERTED':
      return [
        build({
          action: 'openPurchaseOrder',
          primary: true,
          placement: 'bar',
        }),
      ];

    case 'CANCELLED':
      return [];
  }
}

export function resolveActions(kind: DocumentKind, doc: unknown, ctx: ResolveActionsContext): ResolvedAction[] {
  if (ctx.isNew || !doc || typeof doc !== 'object') {
    return [];
  }

  switch (kind) {
    case 'quotation':
      return resolveQuotation(doc as QuotationDetail, ctx);
    case 'sales-order':
      return resolveSalesOrder(doc as SalesOrderDetail, ctx);
    case 'purchase-order':
      return resolvePurchaseOrder(doc as PurchaseOrderDetail, ctx);
    case 'purchase-quotation':
      return resolvePurchaseQuotation(doc as PurchaseQuotationDetail, ctx);
  }
}
