import { ApiError } from '../../shared/trade-api';
import { cmp, formatPercentCap, isDecimal } from '../shared/decimal';
import { TERMS_NOTES_MAX_LENGTH } from '../shared/document.model';
import {
  convertPurchaseQuotation,
  convertQuotation,
  createPurchaseOrder,
  createPurchaseQuotation,
  createQuotation,
  createQuotationRevision,
  createSalesOrder,
  replaceOrderLines,
  updatePurchaseOrder,
  updatePurchaseQuotation,
  updateQuotation,
  updateSalesOrder,
  type ReplaceOrderLinesBody,
} from '../shared/documents.api';
import type {
  DocumentKind,
  OrderPreview,
  PurchaseOrderDetail,
  PurchaseQuotationDetail,
  QuotationDetail,
  SalesOrderDetail,
} from '../shared/document.model';
import type { RequestKeySource } from '../shared/document-request-keys';
import {
  bodies,
  orderChangeKind,
  quotationChangeKind,
  type DocumentDraft,
  type PageMode,
} from './document-draft';

const MAX_LINES = 1000;

export type SaveOutcome =
  | { type: 'saved'; id: string; navigateTo: string | null; toastKey: string }
  | { type: 'cancelled' }
  | { type: 'conflict'; navigateTo?: string }
  | { type: 'pricingChanged'; navigateTo?: string }
  | {
      type: 'invalid';
      fieldErrors: Record<string, string>;
      lineErrors: Record<string, string>;
      lineErrorParams?: Record<string, Record<string, string>>;
      navigateTo?: string;
    }
  | { type: 'redirect'; url: string; toastKey: string }
  | { type: 'error'; code: string; details?: Record<string, unknown>; navigateTo?: string };

export interface SaveDocumentInput {
  kind: DocumentKind;
  mode: PageMode;
  draft: DocumentDraft;
  loaded: DocumentDraft;
  detail: unknown | null;
  sourceId: string | null;
  sourceVersion: number | null;
  fingerprint: string | null;
  confirm: (titleKey: string, textKey: string) => Promise<boolean>;
  orderPreview?: OrderPreview | null;
  discountReasonRequired?: boolean;
  /**
   * x-idempotency-keys of this save. The page keeps one source per save action, so a retry of the same
   * request (same id, version and body) reuses its key; a success resets it.
   */
  requestKeys: RequestKeySource;
}

export interface DraftValidationResult {
  valid: boolean;
  fieldErrors: Record<string, string>;
  lineErrors: Record<string, string>;
}

export interface DocumentSaveApi {
  createQuotation: typeof createQuotation;
  updateQuotation: typeof updateQuotation;
  createQuotationRevision: typeof createQuotationRevision;
  createSalesOrder: typeof createSalesOrder;
  updateSalesOrder: typeof updateSalesOrder;
  convertQuotation: typeof convertQuotation;
  createPurchaseOrder: typeof createPurchaseOrder;
  updatePurchaseOrder: typeof updatePurchaseOrder;
  convertPurchaseQuotation: typeof convertPurchaseQuotation;
  replaceOrderLines: (
    kind: 'sales-order' | 'purchase-order',
    id: string,
    version: number,
    body: ReplaceOrderLinesBody,
    idempotencyKey: string,
  ) => Promise<SalesOrderDetail | PurchaseOrderDetail>;
  createPurchaseQuotation: typeof createPurchaseQuotation;
  updatePurchaseQuotation: typeof updatePurchaseQuotation;
}

const DEFAULT_SAVE_API: DocumentSaveApi = {
  createQuotation,
  updateQuotation,
  createQuotationRevision,
  createSalesOrder,
  updateSalesOrder,
  convertQuotation,
  createPurchaseOrder,
  updatePurchaseOrder,
  convertPurchaseQuotation,
  replaceOrderLines,
  createPurchaseQuotation,
  updatePurchaseQuotation,
};

function nonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function detailValue(details: Record<string, unknown> | undefined, key: string): string | null {
  if (!details) return null;
  const raw = details[key];
  if (typeof raw === 'string' && raw.trim().length > 0) return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim().length > 0) {
    return raw[0];
  }
  return null;
}

/** Backend 400 shape: message[] of { property, constraints } (terms.dto.ts). */
function isNotesTooLong(details: Record<string, unknown> | undefined): boolean {
  const message = details?.['message'];
  if (!Array.isArray(message)) return false;
  return message.some((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const { property, constraints } = entry as { property?: unknown; constraints?: Record<string, unknown> };
    return property === 'notes' && constraints?.['maxLength'] === 'TRADE.TERMS.NOTE_TOO_LONG';
  });
}

export function validateDraft(
  kind: DocumentKind,
  _mode: PageMode,
  draft: DocumentDraft,
  opts?: { discountReasonRequired?: boolean; validateRevision?: boolean },
): DraftValidationResult {
  const fieldErrors: Record<string, string> = {};
  const lineErrors: Record<string, string> = {};
  const validateRevision = opts?.validateRevision ?? true;

  switch (kind) {
    case 'quotation': {
      if (!nonEmptyString(draft.header['partyId'])) {
        fieldErrors['partyId'] = 'tdpg.validation.customerRequired';
      }
      if (!nonEmptyString(draft.header['currencyCode'])) {
        fieldErrors['currencyCode'] = 'tdpg.validation.currencyRequired';
      }
      if (validateRevision) {
        if (!nonEmptyString(draft.validUntil)) {
          fieldErrors['validUntil'] = 'tdpg.validation.validUntilRequired';
        }
        if (!nonEmptyString(draft.termSelections.paymentTermId)) {
          fieldErrors['paymentTermId'] = 'tdpg.validation.paymentTermsRequired';
        }
        if (draft.pricing?.mode === 'DISCOUNT') {
          if (opts?.discountReasonRequired && !nonEmptyString(draft.pricing.reasonCode)) {
            fieldErrors['pricingReason'] = 'tdpg.validation.discountReasonRequired';
          }
          if (draft.pricing.scope === 'DOCUMENT' && !isDecimal(draft.pricing.value ?? '')) {
            fieldErrors['pricingValue'] = 'tdpg.validation.discountValueInvalid';
          }
        }
      }
      break;
    }

    case 'sales-order': {
      if (!nonEmptyString(draft.header['partyId'])) {
        fieldErrors['partyId'] = 'tdpg.validation.customerRequired';
      }
      if (!nonEmptyString(draft.header['currencyCode'])) {
        fieldErrors['currencyCode'] = 'tdpg.validation.currencyRequired';
      }
      break;
    }

    case 'purchase-order': {
      const supplierId =
        nonEmptyString(draft.header['supplierPartyId']) || nonEmptyString(draft.header['partyId']);
      if (!supplierId) {
        fieldErrors['supplierPartyId'] = 'tdpg.validation.supplierRequired';
      }
      if (!nonEmptyString(draft.header['supplierAccountId'])) {
        fieldErrors['supplierAccountId'] = 'tdpg.validation.supplierAccountRequired';
      }
      if (!nonEmptyString(draft.header['currencyCode'])) {
        fieldErrors['currencyCode'] = 'tdpg.validation.currencyRequired';
      }
      if (!nonEmptyString(draft.header['receivingNodeId'])) {
        fieldErrors['receivingNodeId'] = 'tdpg.validation.receivingNodeRequired';
      }
      break;
    }

    case 'purchase-quotation': {
      const supplierId =
        nonEmptyString(draft.header['supplierPartyId']) || nonEmptyString(draft.header['partyId']);
      if (!supplierId) {
        fieldErrors['supplierPartyId'] = 'tdpg.validation.supplierRequired';
      }
      if (!nonEmptyString(draft.header['currencyCode'])) {
        fieldErrors['currencyCode'] = 'tdpg.validation.currencyRequired';
      }
      if (!nonEmptyString(draft.validUntil)) {
        fieldErrors['validUntil'] = 'tdpg.validation.validUntilRequired';
      }
      break;
    }
  }

  const checkLines = kind !== 'quotation' || validateRevision;
  if (checkLines && [...draft.notes].length > TERMS_NOTES_MAX_LENGTH) {
    fieldErrors['notes'] = 'tdpg.validation.notesMax';
  }
  if (checkLines) {
    if (draft.lines.length === 0) {
      fieldErrors['lines'] = 'tdpg.validation.linesRequired';
    } else if (draft.lines.length > MAX_LINES) {
      fieldErrors['lines'] = 'tdpg.validation.tooManyLines';
    }

    for (const line of draft.lines) {
      if (!line.itemId) {
        lineErrors[line.clientLineId] = 'tdpg.validation.lineItemRequired';
        continue;
      }
      if (!line.uomId) {
        lineErrors[line.clientLineId] = 'tdpg.validation.lineUnitRequired';
        continue;
      }
      if (!isDecimal(line.quantity, { positive: true })) {
        lineErrors[line.clientLineId] = 'tdpg.validation.lineQuantityInvalid';
        continue;
      }

      if (kind === 'sales-order' || kind === 'purchase-order') {
        if (!isDecimal(line.chargeTotal)) {
          lineErrors[line.clientLineId] = 'tdpg.validation.lineChargeInvalid';
          continue;
        }
        if (!line.tax) {
          lineErrors[line.clientLineId] = 'tdpg.validation.lineTaxRequired';
          continue;
        }
        if (
          line.tax.category === 'STANDARD' &&
          (!Number.isFinite(line.tax.rateBps) || line.tax.rateBps < 0 || line.tax.rateBps > 10000)
        ) {
          lineErrors[line.clientLineId] = 'tdpg.validation.lineTaxRateInvalid';
          continue;
        }
      }

      if (
        kind === 'quotation' &&
        draft.pricing?.mode === 'DISCOUNT' &&
        (draft.pricing.scope ?? 'LINE') === 'LINE' &&
        line.discount
      ) {
        if (!isDecimal(line.discount.value)) {
          lineErrors[line.clientLineId] = 'tdpg.validation.lineDiscountInvalid';
          continue;
        }
        if (
          line.discount.type === 'PERCENT' &&
          line.maxDiscountPercent !== null &&
          cmp(line.discount.value, line.maxDiscountPercent) > 0
        ) {
          lineErrors[line.clientLineId] = 'tdpg.validation.discountExceedsAllowed';
          continue;
        }
        if (
          line.discount.type === 'AMOUNT' &&
          line.maxDiscountAmount !== null &&
          cmp(line.discount.value, line.maxDiscountAmount) > 0
        ) {
          lineErrors[line.clientLineId] = 'tdpg.validation.discountExceedsAllowed';
        }
      }
    }
  }

  return {
    valid: Object.keys(fieldErrors).length === 0 && Object.keys(lineErrors).length === 0,
    fieldErrors,
    lineErrors,
  };
}

function mapSaveError(err: unknown): SaveOutcome {
  if (!(err instanceof ApiError)) {
    return { type: 'error', code: 'generic' };
  }

  const details = err.details as Record<string, unknown> | undefined;

  if (err.status === 409 && err.code === 'TRADE.CONCURRENCY.STALE_VERSION') {
    return { type: 'conflict' };
  }

  if (
    err.status === 409 &&
    (err.code === 'TRADE.QUOTE.PRICING_CHANGED' || err.code === 'TRADE.PRICE.PREVIEW_CHANGED')
  ) {
    return { type: 'pricingChanged' };
  }

  if (err.status === 409 && err.code === 'TRADE.QUOTE.ALREADY_CONVERTED') {
    const salesOrderId = detailValue(details, 'salesOrderId');
    if (salesOrderId) {
      return {
        type: 'redirect',
        url: `/trade/documents/sales-orders/${salesOrderId}`,
        toastKey: 'tdpg.toast.quotationAlreadyConverted',
      };
    }
  }

  if (err.status === 409 && err.code === 'TRADE.PURCHASE_QUOTATION.ALREADY_CONVERTED') {
    const purchaseOrderId = detailValue(details, 'purchaseOrderId');
    if (purchaseOrderId) {
      return {
        type: 'redirect',
        url: `/trade/documents/purchase-orders/${purchaseOrderId}`,
        toastKey: 'tdpg.toast.purchaseQuotationAlreadyConverted',
      };
    }
  }

  if (err.status === 422 && err.code === 'TRADE.QUOTE.DISCOUNT_EXCEEDS_ALLOWED') {
    const clientLineId = detailValue(details, 'clientLineId');
    const max = detailValue(details, 'maxDiscountPercent');
    if (clientLineId) {
      return {
        type: 'invalid',
        fieldErrors: {},
        lineErrors: {
          [clientLineId]: max ? 'tdlines.maxLimit' : 'td.errors.TRADE.QUOTE.DISCOUNT_EXCEEDS_ALLOWED',
        },
        ...(max ? { lineErrorParams: { [clientLineId]: { max: formatPercentCap(max) } } } : {}),
      };
    }
  }

  if (err.status === 422 && (err.code === 'TRADE.QUOTE.VALIDITY_INVALID' || err.code === 'VALIDITY_INVALID')) {
    return {
      type: 'invalid',
      fieldErrors: { validUntil: 'td.errors.TRADE.QUOTE.VALIDITY_INVALID' },
      lineErrors: {},
    };
  }

  if (err.status === 422 && err.code === 'TRADE.QUOTE.DISCOUNT_REASON_REQUIRED') {
    return {
      type: 'invalid',
      fieldErrors: { pricingReason: 'td.errors.TRADE.QUOTE.DISCOUNT_REASON_REQUIRED' },
      lineErrors: {},
    };
  }

  if (err.status === 422 && err.code.startsWith('TRADE.REASON.')) {
    return {
      type: 'invalid',
      fieldErrors: { pricingReason: `td.errors.${err.code}` },
      lineErrors: {},
    };
  }

  if (err.status === 422 && err.code === 'TRADE.TERMS.PAYMENT_REQUIRED') {
    return {
      type: 'invalid',
      fieldErrors: { paymentTermId: 'td.errors.TRADE.TERMS.PAYMENT_REQUIRED' },
      lineErrors: {},
    };
  }

  if (err.status === 422 && err.code === 'TRADE.VALIDATION_FAILED' && detailValue(details, 'notes')) {
    return {
      type: 'invalid',
      fieldErrors: { notes: 'tdpg.validation.notesMax' },
      lineErrors: {},
    };
  }

  if (err.status === 400 && err.code === 'TRADE.VALIDATION_FAILED' && isNotesTooLong(details)) {
    return {
      type: 'invalid',
      fieldErrors: { notes: 'tdpg.validation.notesMax' },
      lineErrors: {},
    };
  }

  if (err.status === 422 && err.code === 'TRADE.TAX.INCLUSIVE_NOT_SUPPORTED') {
    const clientLineId = detailValue(details, 'clientLineId');
    if (clientLineId) {
      return {
        type: 'invalid',
        fieldErrors: {},
        lineErrors: { [clientLineId]: 'td.errors.TRADE.TAX.INCLUSIVE_NOT_SUPPORTED' },
      };
    }
  }

  return {
    type: 'error',
    code: err.code,
    ...(details ? { details } : {}),
  };
}

function attachCreatedQuotationNavigation(outcome: SaveOutcome, createdId: string): SaveOutcome {
  const navigateTo = `/trade/documents/quotations/${createdId}`;
  switch (outcome.type) {
    case 'saved':
    case 'cancelled':
    case 'redirect':
      return outcome;
    case 'error':
      return {
        ...outcome,
        navigateTo,
        details: { ...(outcome.details ?? {}), createdId },
      };
    case 'conflict':
    case 'pricingChanged':
    case 'invalid':
      return {
        ...outcome,
        navigateTo,
      };
  }
}

export async function saveDocument(
  input: SaveDocumentInput,
  api: DocumentSaveApi = DEFAULT_SAVE_API,
): Promise<SaveOutcome> {
  const { kind, mode, draft, loaded, detail, sourceId, sourceVersion, fingerprint, orderPreview } = input;
  const keyFor = (slot: string, ...request: unknown[]): string => input.requestKeys.for(slot, request);
  const validateRevision = kind === 'quotation' && mode === 'edit'
    ? quotationChangeKind(loaded, draft).revision
    : true;

  const validation = validateDraft(kind, mode, draft, {
    discountReasonRequired: input.discountReasonRequired,
    validateRevision,
  });
  if (!validation.valid) {
    return {
      type: 'invalid',
      fieldErrors: validation.fieldErrors,
      lineErrors: validation.lineErrors,
    };
  }

  try {
    switch (kind) {
      case 'quotation': {
        if (mode === 'new') {
          const createBody = bodies.quotationCreate(draft);
          const created = await api.createQuotation(createBody, keyFor('createQuotation', createBody));
          try {
            const revisionBody = bodies.quotationRevision(draft, fingerprint);
            await api.createQuotationRevision(
              created.id,
              created.version,
              revisionBody,
              keyFor('createQuotationRevision', created.id, created.version, revisionBody),
            );
            return {
              type: 'saved',
              id: created.id,
              navigateTo: `/trade/documents/quotations/${created.id}`,
              toastKey: 'tdpg.toast.quotationSaved',
            };
          } catch (revErr) {
            return attachCreatedQuotationNavigation(mapSaveError(revErr), created.id);
          }
        }

        const q = detail as QuotationDetail;
        let version = q.version;
        const { header, revision } = quotationChangeKind(loaded, draft);
        if (!header && !revision) {
          return {
            type: 'saved',
            id: q.id,
            navigateTo: null,
            toastKey: 'tdpg.toast.quotationSaved',
          };
        }

        if (revision && q.lifecycleStatus === 'SENT') {
          const confirmed = await input.confirm(
            'tdpg.confirm.newRevision.title',
            'tdpg.confirm.newRevision.text',
          );
          if (!confirmed) {
            return { type: 'cancelled' };
          }
        }

        if (header) {
          const updateBody = bodies.quotationUpdate(loaded, draft);
          const updated = await api.updateQuotation(
            q.id,
            version,
            updateBody,
            keyFor('updateQuotation', q.id, version, updateBody),
          );
          version = updated.version;
        }
        if (revision) {
          const revisionBody = bodies.quotationRevision(draft, fingerprint);
          await api.createQuotationRevision(
            q.id,
            version,
            revisionBody,
            keyFor('createQuotationRevision', q.id, version, revisionBody),
          );
        }
        return {
          type: 'saved',
          id: q.id,
          navigateTo: null,
          toastKey: 'tdpg.toast.quotationSaved',
        };
      }

      case 'sales-order': {
        if (mode === 'new') {
          const createBody = bodies.salesOrderCreate(draft, {
            expectedPricingFingerprint: fingerprint,
            preview: orderPreview,
          });
          const created = await api.createSalesOrder(createBody, keyFor('createSalesOrder', createBody));
          return {
            type: 'saved',
            id: created.id,
            navigateTo: `/trade/documents/sales-orders/${created.id}`,
            toastKey: 'tdpg.toast.salesOrderSaved',
          };
        }

        if (mode === 'convert-quotation') {
          const src = detail as QuotationDetail | null;
          const srcId = sourceId ?? src?.id ?? '';
          const srcVer = sourceVersion ?? src?.version ?? 0;
          const acceptedRev = src
            ? (src.revisions.find((r) => r.id === (src.acceptedRevisionId ?? src.currentRevisionId)) ?? null)
            : null;
          const dp = acceptedRev?.discountSnapshot?.currencyDecimalPlaces;
          const convertBody = bodies.convertQuotation(draft, {
            loaded,
            currencyDecimalPlaces: dp,
            preview: orderPreview,
          });
          const created = await api.convertQuotation(
            srcId,
            srcVer,
            convertBody,
            keyFor('convertQuotation', srcId, srcVer, convertBody),
          );
          return {
            type: 'saved',
            id: created.id,
            navigateTo: `/trade/documents/sales-orders/${created.id}`,
            toastKey: 'tdpg.toast.salesOrderCreated',
          };
        }

        const so = detail as SalesOrderDetail;
        let version = so.version;
        const { header, lines } = orderChangeKind('sales-order', loaded, draft);
        if (header) {
          const updateBody = bodies.salesOrderUpdate(loaded, draft, { includeTerms: !lines });
          const updated = await api.updateSalesOrder(
            so.id,
            version,
            updateBody,
            keyFor('updateSalesOrder', so.id, version, updateBody),
          );
          version = updated.version;
        }
        if (lines) {
          const linesBody = bodies.replaceOrderLines('sales-order', draft, {
            expectedPricingFingerprint: fingerprint,
            preview: orderPreview,
            currencyDecimalPlaces: so.totalsSnapshot?.currencyDecimalPlaces,
          });
          await api.replaceOrderLines(
            'sales-order',
            so.id,
            version,
            linesBody,
            keyFor('replaceOrderLines', 'sales-order', so.id, version, linesBody),
          );
        }
        return {
          type: 'saved',
          id: so.id,
          navigateTo: null,
          toastKey: 'tdpg.toast.salesOrderSaved',
        };
      }

      case 'purchase-order': {
        if (mode === 'new') {
          const createBody = bodies.purchaseOrderCreate(draft, {
            expectedPricingFingerprint: fingerprint,
            preview: orderPreview,
          });
          const created = await api.createPurchaseOrder(
            createBody,
            keyFor('createPurchaseOrder', createBody),
          );
          return {
            type: 'saved',
            id: created.id,
            navigateTo: `/trade/documents/purchase-orders/${created.id}`,
            toastKey: 'tdpg.toast.purchaseOrderSaved',
          };
        }

        if (mode === 'convert-purchase-quotation') {
          const src = detail as PurchaseQuotationDetail | null;
          const srcId = sourceId ?? src?.id ?? '';
          const srcVer = sourceVersion ?? src?.version ?? 0;
          const dp = src?.totalsSnapshot?.currencyDecimalPlaces;
          const convertBody = bodies.convertPurchaseQuotation(draft, {
            loaded,
            currencyDecimalPlaces: dp,
            preview: orderPreview,
          });
          const created = await api.convertPurchaseQuotation(
            srcId,
            srcVer,
            convertBody,
            keyFor('convertPurchaseQuotation', srcId, srcVer, convertBody),
          );
          return {
            type: 'saved',
            id: created.id,
            navigateTo: `/trade/documents/purchase-orders/${created.id}`,
            toastKey: 'tdpg.toast.purchaseOrderCreated',
          };
        }

        const po = detail as PurchaseOrderDetail;
        let version = po.version;
        const { header, lines } = orderChangeKind('purchase-order', loaded, draft);
        if (header) {
          const updateBody = bodies.purchaseOrderUpdate(loaded, draft, { includeTerms: !lines });
          const updated = await api.updatePurchaseOrder(
            po.id,
            version,
            updateBody,
            keyFor('updatePurchaseOrder', po.id, version, updateBody),
          );
          version = updated.version;
        }
        if (lines) {
          const linesBody = bodies.replaceOrderLines('purchase-order', draft, {
            expectedPricingFingerprint: fingerprint,
            preview: orderPreview,
            currencyDecimalPlaces: po.totalsSnapshot?.currencyDecimalPlaces,
          });
          await api.replaceOrderLines(
            'purchase-order',
            po.id,
            version,
            linesBody,
            keyFor('replaceOrderLines', 'purchase-order', po.id, version, linesBody),
          );
        }
        return {
          type: 'saved',
          id: po.id,
          navigateTo: null,
          toastKey: 'tdpg.toast.purchaseOrderSavedResubmit',
        };
      }

      case 'purchase-quotation': {
        if (mode === 'new') {
          const createBody = bodies.purchaseQuotationCreate(draft);
          const created = await api.createPurchaseQuotation(
            createBody,
            keyFor('createPurchaseQuotation', createBody),
          );
          return {
            type: 'saved',
            id: created.id,
            navigateTo: `/trade/documents/purchase-quotations/${created.id}`,
            toastKey: 'tdpg.toast.purchaseQuotationSaved',
          };
        }

        const pq = detail as PurchaseQuotationDetail;
        const updateBody = bodies.purchaseQuotationUpdate(loaded, draft);
        await api.updatePurchaseQuotation(
          pq.id,
          pq.version,
          updateBody,
          keyFor('updatePurchaseQuotation', pq.id, pq.version, updateBody),
        );
        return {
          type: 'saved',
          id: pq.id,
          navigateTo: null,
          toastKey: 'tdpg.toast.purchaseQuotationSaved',
        };
      }
    }
  } catch (err) {
    return mapSaveError(err);
  }
}
