import { fakeId } from '../../shared/trade-api';
import { lineEvidence, rateBpsFromPercent, totalsEvidence } from '../shared/document-evidence';
import type {
  ConvertPurchaseQuotationBody,
  ConvertPurchaseQuotationLineInput,
  ConvertQuotationBody,
  ConvertQuotationLineInput,
  CreatePurchaseOrderBody,
  CreatePurchaseOrderLineInput,
  CreatePurchaseQuotationBody,
  CreatePurchaseQuotationLineInput,
  CreateQuotationBody,
  CreateQuotationRevisionBody,
  CreateQuotationRevisionLineInput,
  CreateSalesOrderBody,
  CreateSalesOrderLineInput,
  ReplaceOrderLinesBody,
  ReplaceOrderLinesLineInput,
  UpdatePurchaseOrderBody,
  UpdatePurchaseQuotationBody,
  UpdateQuotationBody,
  UpdateSalesOrderBody,
} from '../shared/documents.api';
import type {
  DocumentKind,
  EditableLine,
  ItemTaxDefault,
  LineEvidence,
  LineTaxInput,
  OrderPreview,
  PricingIntent,
  PurchaseOrderDetail,
  PurchaseQuotationDetail,
  QuotationDetail,
  QuotationRevision,
  SalesOrderDetail,
  TaxCategory,
  TermSelections,
  TermsSnapshot,
  TotalsEvidence,
} from '../shared/document.model';

export type PageMode =
  | 'new'
  | 'edit'
  | 'readonly'
  | 'convert-quotation'
  | 'convert-purchase-quotation';

export interface DocumentDraft {
  header: Record<string, unknown>;
  lines: EditableLine[];
  pricing: PricingIntent | null;
  termSelections: TermSelections;
  notes: string;
  validUntil: string | null;
}

export interface QuotationChangeKind {
  header: boolean;
  revision: boolean;
}

export interface OrderChangeKind {
  header: boolean;
  lines: boolean;
}

export interface OrderBodyOptions {
  expectedPricingFingerprint?: string | null;
  preview?: OrderPreview | null;
  currencyDecimalPlaces?: number;
}

export interface ConvertBodyOptions {
  loaded?: DocumentDraft;
  currencyDecimalPlaces?: number;
  preview?: OrderPreview | null;
  includeTermSelections?: boolean;
}

const CURRENCY_DECIMALS: Readonly<Record<string, number>> = {
  EGP: 2,
  USD: 2,
  SAR: 2,
  AED: 2,
  KWD: 3,
  BHD: 3,
  OMR: 3,
  JOD: 3,
  TND: 3,
  JPY: 0,
  KRW: 0,
};

export function currencyDecimalPlacesOf(currencyCode: string): number {
  return CURRENCY_DECIMALS[currencyCode.toUpperCase()] ?? 2;
}

export function emptyTermSelections(): TermSelections {
  return {
    paymentTermId: null,
    deliveryTermId: null,
    warrantyTermId: null,
    clauseIds: [],
  };
}

export function cloneTermSelections(sel: TermSelections): TermSelections {
  return {
    paymentTermId: sel.paymentTermId ?? null,
    deliveryTermId: sel.deliveryTermId ?? null,
    warrantyTermId: sel.warrantyTermId ?? null,
    clauseIds: [...(sel.clauseIds ?? [])],
  };
}

export function createEmptyLine(): EditableLine {
  return {
    clientLineId: fakeId(),
    itemId: null,
    itemLabel: '',
    description: '',
    uomId: null,
    quantity: '1',
    unitPrice: null,
    discount: null,
    discountTotal: '0',
    chargeTotal: '0',
    tax: null,
    taxLocked: false,
    expectedDate: null,
    receivingNodeId: null,
    maxDiscountAmount: null,
    maxDiscountPercent: null,
    locked: false,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractTermSelections(snapshot: TermsSnapshot | null | undefined): TermSelections {
  const result = emptyTermSelections();
  if (!isPlainRecord(snapshot)) {
    return result;
  }

  const selections = snapshot['selections'];
  if (!Array.isArray(selections)) {
    return result;
  }

  const clauseSet = new Set<string>();
  for (const entry of selections) {
    if (!isPlainRecord(entry)) continue;
    const type = entry['type'];
    const id = entry['id'];
    if (typeof type !== 'string' || typeof id !== 'string' || !id) continue;

    if (type === 'PAYMENT') {
      result.paymentTermId = id;
    } else if (type === 'DELIVERY') {
      result.deliveryTermId = id;
    } else if (type === 'WARRANTY') {
      result.warrantyTermId = id;
    } else if (!clauseSet.has(id)) {
      clauseSet.add(id);
      result.clauseIds.push(id);
    }
  }

  return result;
}

export function extractNotes(snapshot: TermsSnapshot | null | undefined): string {
  if (!isPlainRecord(snapshot)) {
    return '';
  }

  const direct = snapshot['notes'];
  if (typeof direct === 'string') {
    return direct;
  }

  const localized = snapshot['localized'];
  if (isPlainRecord(localized)) {
    const en = localized['en'];
    if (isPlainRecord(en) && typeof en['notes'] === 'string') {
      return en['notes'];
    }
    const ar = localized['ar'];
    if (isPlainRecord(ar) && typeof ar['notes'] === 'string') {
      return ar['notes'];
    }
  }

  return '';
}

function sortLines<T extends { printLineNumber?: number | null }>(lines: readonly T[]): T[] {
  return lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => {
      const aNum = a.line.printLineNumber ?? Number.MAX_SAFE_INTEGER;
      const bNum = b.line.printLineNumber ?? Number.MAX_SAFE_INTEGER;
      if (aNum !== bNum) return aNum - bNum;
      return a.index - b.index;
    })
    .map((entry) => entry.line);
}

function taxFromItemDefault(def: ItemTaxDefault | undefined): { tax: LineTaxInput | null; taxLocked: boolean } {
  if (!def) {
    return { tax: null, taxLocked: false };
  }
  const rateBps = rateBpsFromPercent(def.rate);
  const code = def.code.toUpperCase();
  const category: TaxCategory = code === 'EXEMPT' ? 'EXEMPT' : rateBps > 0 ? 'STANDARD' : 'ZERO';
  return {
    tax: {
      category,
      rateBps: category === 'STANDARD' ? rateBps : 0,
    },
    taxLocked: true,
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA).filter((k) => objA[k] !== undefined);
  const keysB = Object.keys(objB).filter((k) => objB[k] !== undefined);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key) || objB[key] === undefined) {
      return false;
    }
    if (!deepEqual(objA[key], objB[key])) {
      return false;
    }
  }
  return true;
}

function headerStr(header: Record<string, unknown>, key: string): string {
  const val = header[key];
  return typeof val === 'string' ? val.trim() : '';
}

function headerNullable(header: Record<string, unknown>, key: string): string | null {
  const s = headerStr(header, key);
  return s.length > 0 ? s : null;
}

function supplierPartyIdOf(header: Record<string, unknown>): string {
  return headerStr(header, 'supplierPartyId') || headerStr(header, 'partyId');
}

function resolveRevision(q: QuotationDetail, preferAccepted: boolean): QuotationRevision | null {
  const targetId = preferAccepted
    ? (q.acceptedRevisionId ?? q.currentRevisionId)
    : q.currentRevisionId;
  if (targetId) {
    const matched = q.revisions.find((r) => r.id === targetId);
    if (matched) return matched;
  }
  return q.revisions.length > 0 ? q.revisions[q.revisions.length - 1] : null;
}

function clonePricing(pricing: PricingIntent | null | undefined): PricingIntent {
  if (!pricing) return { mode: 'NONE' };
  const copy: PricingIntent = { mode: pricing.mode };
  if (pricing.scope !== undefined) copy.scope = pricing.scope;
  if (pricing.type !== undefined) copy.type = pricing.type;
  if (pricing.value !== undefined) copy.value = pricing.value;
  if (pricing.reasonCode !== undefined) copy.reasonCode = pricing.reasonCode;
  if (pricing.reasonNote !== undefined) copy.reasonNote = pricing.reasonNote;
  return copy;
}

export function emptyDraft(kind: DocumentKind): DocumentDraft {
  switch (kind) {
    case 'quotation':
      return {
        header: {
          partyId: null,
          crmCustomerProfileId: null,
          contactPartyId: null,
          currencyCode: '',
          draftReference: '',
          sourceCrmOpportunityId: null,
        },
        lines: [createEmptyLine()],
        pricing: { mode: 'NONE' },
        termSelections: emptyTermSelections(),
        notes: '',
        validUntil: null,
      };
    case 'sales-order':
      return {
        header: {
          partyId: null,
          contactPartyId: null,
          currencyCode: '',
          draftReference: '',
        },
        lines: [],
        pricing: null,
        termSelections: emptyTermSelections(),
        notes: '',
        validUntil: null,
      };
    case 'purchase-order':
      return {
        header: {
          supplierPartyId: null,
          supplierAccountId: null,
          contactPartyId: null,
          currencyCode: '',
          receivingNodeId: null,
          draftReference: '',
        },
        lines: [],
        pricing: null,
        termSelections: emptyTermSelections(),
        notes: '',
        validUntil: null,
      };
    case 'purchase-quotation':
      return {
        header: {
          supplierPartyId: null,
          currencyCode: '',
          reference: '',
        },
        lines: [],
        pricing: null,
        termSelections: emptyTermSelections(),
        notes: '',
        validUntil: null,
      };
  }
}

export function toDraft(kind: DocumentKind, detail: unknown): DocumentDraft {
  switch (kind) {
    case 'quotation': {
      const q = detail as QuotationDetail;
      const currentRev = resolveRevision(q, false);
      const lines: EditableLine[] = sortLines(q.currentLines).map((line) => ({
        clientLineId: line.clientLineId,
        itemId: line.discountSnapshot.itemId,
        itemLabel: line.itemLabel,
        description: line.descriptionSnapshot,
        uomId: line.uomId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discountSnapshot.discount ? { ...line.discountSnapshot.discount } : null,
        discountTotal: line.discountTotal,
        chargeTotal: '0',
        tax: null,
        taxLocked: false,
        expectedDate: null,
        receivingNodeId: null,
        maxDiscountAmount: line.discountSnapshot.maxDiscountAmount,
        maxDiscountPercent: line.discountSnapshot.maxDiscountPercent,
        locked: false,
      }));
      return {
        header: {
          partyId: q.partyId,
          crmCustomerProfileId: q.crmCustomerProfileId,
          contactPartyId: q.contactPartyId,
          currencyCode: q.currencyCode,
          draftReference: q.draftReference ?? '',
          sourceCrmOpportunityId: q.sourceCrmOpportunityId,
        },
        lines,
        pricing: clonePricing(currentRev?.discountSnapshot?.pricing),
        termSelections: extractTermSelections(currentRev?.termsSnapshot),
        notes: extractNotes(currentRev?.termsSnapshot),
        validUntil: currentRev?.validUntil ?? q.currentRevision?.validUntil ?? null,
      };
    }

    case 'sales-order': {
      const so = detail as SalesOrderDetail;
      const locked = so.sourceQuotationId !== null;
      const lines: EditableLine[] = sortLines(so.lines).map((line) => ({
        clientLineId: line.clientLineId,
        itemId: line.itemId ?? null,
        itemLabel: line.itemLabel,
        description: line.descriptionSnapshot ?? '',
        uomId: line.uomId,
        quantity: line.orderedQuantity,
        unitPrice: line.unitPrice,
        discount: null,
        discountTotal: line.discountTotal,
        chargeTotal: line.chargeTotal,
        tax: line.taxSnapshot
          ? { category: line.taxSnapshot.category, rateBps: line.taxSnapshot.rateBps }
          : null,
        taxLocked: false,
        expectedDate: null,
        receivingNodeId: null,
        maxDiscountAmount: null,
        maxDiscountPercent: null,
        locked,
      }));
      return {
        header: {
          partyId: so.partyId,
          contactPartyId: so.contactPartyId,
          currencyCode: so.currencyCode,
          draftReference: so.draftReference ?? '',
        },
        lines,
        pricing: null,
        termSelections: extractTermSelections(so.termsSnapshot),
        notes: extractNotes(so.termsSnapshot),
        validUntil: null,
      };
    }

    case 'purchase-order': {
      const po = detail as PurchaseOrderDetail;
      const locked = po.sourcePurchaseQuotationId !== null;
      const lines: EditableLine[] = sortLines(po.lines).map((line) => ({
        clientLineId: line.clientLineId,
        itemId: line.itemId ?? null,
        itemLabel: line.itemLabel,
        description: line.descriptionSnapshot ?? '',
        uomId: line.uomId,
        quantity: line.orderedQuantity,
        unitPrice: line.unitPrice,
        discount: null,
        discountTotal: '0',
        chargeTotal: line.chargeTotal,
        tax: line.taxSnapshot
          ? { category: line.taxSnapshot.category, rateBps: line.taxSnapshot.rateBps }
          : null,
        taxLocked: false,
        expectedDate: line.expectedDate,
        receivingNodeId: line.receivingNodeId,
        maxDiscountAmount: null,
        maxDiscountPercent: null,
        locked,
      }));
      return {
        header: {
          supplierPartyId: po.partyId,
          supplierAccountId: po.supplierAccountId,
          contactPartyId: po.contactPartyId,
          currencyCode: po.currencyCode,
          receivingNodeId: po.receivingNodeId,
          draftReference: po.draftReference ?? '',
        },
        lines,
        pricing: null,
        termSelections: extractTermSelections(po.termsSnapshot),
        notes: extractNotes(po.termsSnapshot),
        validUntil: null,
      };
    }

    case 'purchase-quotation': {
      const pq = detail as PurchaseQuotationDetail;
      const lines: EditableLine[] = sortLines(pq.lines).map((line) => ({
        clientLineId: line.clientLineId,
        itemId: line.itemId,
        itemLabel: line.itemLabel,
        description: line.descriptionSnapshot,
        uomId: line.uomId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: null,
        discountTotal: '0',
        chargeTotal: '0',
        tax: null,
        taxLocked: false,
        expectedDate: null,
        receivingNodeId: null,
        maxDiscountAmount: null,
        maxDiscountPercent: null,
        locked: false,
      }));
      return {
        header: {
          supplierPartyId: pq.partyId,
          currencyCode: pq.currencyCode,
          reference: pq.reference ?? '',
        },
        lines,
        pricing: null,
        termSelections: extractTermSelections(pq.termsSnapshot),
        notes: pq.notes ?? extractNotes(pq.termsSnapshot),
        validUntil: pq.validUntil,
      };
    }
  }
}

export function draftFromQuotation(q: QuotationDetail): DocumentDraft {
  const acceptedRev = resolveRevision(q, true);
  const lines: EditableLine[] = sortLines(q.currentLines).map((line) => {
    const { tax, taxLocked } = taxFromItemDefault(line.taxSnapshot?.itemTaxDefault);
    return {
      clientLineId: line.clientLineId,
      itemId: line.discountSnapshot.itemId,
      itemLabel: line.itemLabel,
      description: line.descriptionSnapshot,
      uomId: line.uomId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: null,
      discountTotal: line.discountTotal,
      chargeTotal: '0',
      tax,
      taxLocked,
      expectedDate: null,
      receivingNodeId: null,
      maxDiscountAmount: null,
      maxDiscountPercent: null,
      locked: true,
    };
  });

  return {
    header: {
      partyId: q.partyId,
      contactPartyId: q.contactPartyId,
      currencyCode: q.currencyCode,
      draftReference: q.draftReference ?? '',
    },
    lines,
    pricing: null,
    termSelections: extractTermSelections(acceptedRev?.termsSnapshot),
    notes: extractNotes(acceptedRev?.termsSnapshot),
    validUntil: null,
  };
}

export function draftFromPurchaseQuotation(pq: PurchaseQuotationDetail): DocumentDraft {
  const lines: EditableLine[] = sortLines(pq.lines).map((line) => ({
    clientLineId: line.clientLineId,
    itemId: line.itemId,
    itemLabel: line.itemLabel,
    description: line.descriptionSnapshot,
    uomId: line.uomId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discount: null,
    discountTotal: '0',
    chargeTotal: '0',
    tax: null,
    taxLocked: false,
    expectedDate: null,
    receivingNodeId: null,
    maxDiscountAmount: null,
    maxDiscountPercent: null,
    locked: true,
  }));

  return {
    header: {
      supplierPartyId: pq.partyId,
      supplierAccountId: null,
      contactPartyId: null,
      currencyCode: pq.currencyCode,
      receivingNodeId: null,
      draftReference: pq.reference ?? '',
    },
    lines,
    pricing: null,
    termSelections: extractTermSelections(pq.termsSnapshot),
    notes: pq.notes ?? extractNotes(pq.termsSnapshot),
    validUntil: null,
  };
}

export function isDirty(a: DocumentDraft, b: DocumentDraft): boolean {
  return !deepEqual(a, b);
}

export function undoDraft(loaded: DocumentDraft): DocumentDraft {
  return structuredClone(loaded);
}

export function quotationChangeKind(oldDraft: DocumentDraft, nextDraft: DocumentDraft): QuotationChangeKind {
  const header =
    headerNullable(oldDraft.header, 'contactPartyId') !== headerNullable(nextDraft.header, 'contactPartyId') ||
    headerNullable(oldDraft.header, 'draftReference') !== headerNullable(nextDraft.header, 'draftReference') ||
    headerNullable(oldDraft.header, 'sourceCrmOpportunityId') !==
      headerNullable(nextDraft.header, 'sourceCrmOpportunityId');

  const revision =
    !deepEqual(oldDraft.lines, nextDraft.lines) ||
    (oldDraft.validUntil ?? null) !== (nextDraft.validUntil ?? null) ||
    !deepEqual(oldDraft.termSelections, nextDraft.termSelections) ||
    oldDraft.notes !== nextDraft.notes ||
    !deepEqual(oldDraft.pricing, nextDraft.pricing);

  return { header, revision };
}

export function orderChangeKind(
  kind: 'sales-order' | 'purchase-order',
  oldDraft: DocumentDraft,
  nextDraft: DocumentDraft,
): OrderChangeKind {
  const headerFieldsChanged =
    kind === 'sales-order'
      ? headerNullable(oldDraft.header, 'contactPartyId') !== headerNullable(nextDraft.header, 'contactPartyId') ||
        headerNullable(oldDraft.header, 'draftReference') !== headerNullable(nextDraft.header, 'draftReference')
      : headerNullable(oldDraft.header, 'supplierAccountId') !== headerNullable(nextDraft.header, 'supplierAccountId') ||
        headerNullable(oldDraft.header, 'receivingNodeId') !== headerNullable(nextDraft.header, 'receivingNodeId') ||
        headerNullable(oldDraft.header, 'contactPartyId') !== headerNullable(nextDraft.header, 'contactPartyId') ||
        headerNullable(oldDraft.header, 'draftReference') !== headerNullable(nextDraft.header, 'draftReference');

  const termsChanged =
    !deepEqual(oldDraft.termSelections, nextDraft.termSelections) || oldDraft.notes !== nextDraft.notes;
  const linesChanged = !deepEqual(oldDraft.lines, nextDraft.lines);

  return {
    header: headerFieldsChanged || (termsChanged && !linesChanged),
    lines: linesChanged,
  };
}

function buildOrderEvidence(
  lines: readonly EditableLine[],
  currencyCode: string,
  isPurchaseOrder: boolean,
  opts?: OrderBodyOptions,
): { lineFinancials: LineEvidence[]; totals: TotalsEvidence } {
  const preview = opts?.preview;
  if (preview && preview.lines.length === lines.length) {
    const byId = new Map(preview.lines.map((l) => [l.clientLineId, l]));
    if (lines.every((l) => byId.has(l.clientLineId))) {
      return {
        lineFinancials: lines.map((l) => byId.get(l.clientLineId)!.financial),
        totals: preview.totals,
      };
    }
  }

  const lineFinancials = lines.map((line) =>
    lineEvidence(
      {
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountTotal: isPurchaseOrder ? '0' : line.discountTotal,
        chargeTotal: line.chargeTotal,
        tax: line.tax,
      },
      currencyCode,
    ),
  );
  const dp = opts?.currencyDecimalPlaces ?? currencyDecimalPlacesOf(currencyCode);
  return {
    lineFinancials,
    totals: totalsEvidence(lineFinancials, dp),
  };
}

function sanitizePricing(pricing: PricingIntent | null): PricingIntent {
  if (!pricing || pricing.mode === 'NONE' || pricing.mode === 'PROMOTIONS') {
    return { mode: pricing?.mode ?? 'NONE' };
  }
  const scope = pricing.scope ?? 'LINE';
  const result: PricingIntent = {
    mode: 'DISCOUNT',
    scope,
  };
  if (scope === 'DOCUMENT') {
    if (pricing.type !== undefined) result.type = pricing.type;
    if (pricing.value !== undefined) result.value = pricing.value;
  }
  const reasonCode = pricing.reasonCode?.trim();
  if (reasonCode) {
    result.reasonCode = reasonCode;
    const reasonNote = pricing.reasonNote?.trim();
    if (reasonNote) result.reasonNote = reasonNote;
  }
  return result;
}

export const bodies = {
  quotationCreate(draft: DocumentDraft): CreateQuotationBody {
    const body: CreateQuotationBody = {
      partyId: headerStr(draft.header, 'partyId'),
      currencyCode: headerStr(draft.header, 'currencyCode'),
    };
    const crmCustomerProfileId = headerNullable(draft.header, 'crmCustomerProfileId');
    if (crmCustomerProfileId) body.crmCustomerProfileId = crmCustomerProfileId;
    const contactPartyId = headerNullable(draft.header, 'contactPartyId');
    if (contactPartyId) body.contactPartyId = contactPartyId;
    const draftReference = headerNullable(draft.header, 'draftReference');
    if (draftReference) body.draftReference = draftReference;
    const sourceCrmOpportunityId = headerNullable(draft.header, 'sourceCrmOpportunityId');
    if (sourceCrmOpportunityId) body.sourceCrmOpportunityId = sourceCrmOpportunityId;
    return body;
  },

  quotationUpdate(oldDraft: DocumentDraft, nextDraft: DocumentDraft): UpdateQuotationBody {
    const body: UpdateQuotationBody = {};
    const oldContact = headerNullable(oldDraft.header, 'contactPartyId');
    const nextContact = headerNullable(nextDraft.header, 'contactPartyId');
    if (oldContact !== nextContact) {
      body.contactPartyId = nextContact;
    }

    const oldRef = headerNullable(oldDraft.header, 'draftReference');
    const nextRef = headerNullable(nextDraft.header, 'draftReference');
    if (oldRef !== nextRef) {
      body.draftReference = nextRef;
    }

    const oldOpp = headerNullable(oldDraft.header, 'sourceCrmOpportunityId');
    const nextOpp = headerNullable(nextDraft.header, 'sourceCrmOpportunityId');
    if (oldOpp !== nextOpp) {
      body.sourceCrmOpportunityId = nextOpp;
    }
    return body;
  },

  quotationRevision(
    draft: DocumentDraft,
    expectedPricingFingerprint?: string | null,
  ): CreateQuotationRevisionBody {
    const pricing = sanitizePricing(draft.pricing);
    const includeLineDiscount = pricing.mode === 'DISCOUNT' && (pricing.scope ?? 'LINE') === 'LINE';
    const lines: CreateQuotationRevisionLineInput[] = draft.lines.map((line) => {
      const entry: CreateQuotationRevisionLineInput = {
        clientLineId: line.clientLineId,
        itemId: line.itemId ?? '',
        uomId: line.uomId ?? '',
        quantity: line.quantity,
      };
      if (includeLineDiscount && line.discount) {
        entry.discount = {
          type: line.discount.type,
          value: line.discount.value,
        };
      }
      return entry;
    });

    const body: CreateQuotationRevisionBody = {
      validUntil: draft.validUntil ?? '',
      lines,
      pricing,
      termSelections: cloneTermSelections(draft.termSelections),
    };
    if (expectedPricingFingerprint) {
      body.expectedPricingFingerprint = expectedPricingFingerprint;
    }
    const cleanNotes = draft.notes.trim();
    if (cleanNotes) {
      body.notes = cleanNotes;
    }
    return body;
  },

  salesOrderCreate(draft: DocumentDraft, opts?: OrderBodyOptions): CreateSalesOrderBody {
    const currencyCode = headerStr(draft.header, 'currencyCode');
    const { lineFinancials, totals } = buildOrderEvidence(draft.lines, currencyCode, false, opts);

    const lines: CreateSalesOrderLineInput[] = draft.lines.map((line, idx) => {
      const entry: CreateSalesOrderLineInput = {
        clientLineId: line.clientLineId,
        itemId: line.itemId ?? '',
        uomId: line.uomId ?? '',
        quantity: line.quantity,
        financial: lineFinancials[idx],
      };
      if (line.unitPrice !== null) {
        entry.unitPrice = line.unitPrice;
      }
      return entry;
    });

    const body: CreateSalesOrderBody = {
      partyId: headerStr(draft.header, 'partyId'),
      currencyCode,
      lines,
      totals,
      termSelections: cloneTermSelections(draft.termSelections),
    };
    const contactPartyId = headerNullable(draft.header, 'contactPartyId');
    if (contactPartyId) body.contactPartyId = contactPartyId;
    const draftReference = headerNullable(draft.header, 'draftReference');
    if (draftReference) body.draftReference = draftReference;
    if (opts?.expectedPricingFingerprint) {
      body.expectedPricingFingerprint = opts.expectedPricingFingerprint;
    }
    const cleanNotes = draft.notes.trim();
    if (cleanNotes) {
      body.notes = cleanNotes;
    }
    return body;
  },

  salesOrderUpdate(
    oldDraft: DocumentDraft,
    nextDraft: DocumentDraft,
    opts?: { includeTerms?: boolean },
  ): UpdateSalesOrderBody {
    const body: UpdateSalesOrderBody = {};
    const oldContact = headerNullable(oldDraft.header, 'contactPartyId');
    const nextContact = headerNullable(nextDraft.header, 'contactPartyId');
    if (oldContact !== nextContact) {
      body.contactPartyId = nextContact;
    }

    const oldRef = headerNullable(oldDraft.header, 'draftReference');
    const nextRef = headerNullable(nextDraft.header, 'draftReference');
    if (oldRef !== nextRef) {
      body.draftReference = nextRef;
    }

    const termsChanged =
      !deepEqual(oldDraft.termSelections, nextDraft.termSelections) || oldDraft.notes !== nextDraft.notes;
    if (opts?.includeTerms !== false && termsChanged) {
      body.termSelections = cloneTermSelections(nextDraft.termSelections);
      body.notes = nextDraft.notes.trim();
    }
    return body;
  },

  convertQuotation(draft: DocumentDraft, opts?: ConvertBodyOptions): ConvertQuotationBody {
    const currencyCode = headerStr(draft.header, 'currencyCode');
    const { lineFinancials, totals } = buildOrderEvidence(draft.lines, currencyCode, false, {
      currencyDecimalPlaces: opts?.currencyDecimalPlaces,
      preview: opts?.preview,
    });

    const lines: ConvertQuotationLineInput[] = draft.lines.map((line, idx) => {
      const entry: ConvertQuotationLineInput = {
        clientLineId: line.clientLineId,
        chargeTotal: line.chargeTotal,
        financial: lineFinancials[idx],
      };
      if (line.tax) {
        entry.tax = {
          category: line.tax.category,
          rateBps: line.tax.rateBps,
        };
      }
      return entry;
    });

    const body: ConvertQuotationBody = {
      lines,
      totals,
    };
    const contactPartyId = headerNullable(draft.header, 'contactPartyId');
    if (contactPartyId) body.contactPartyId = contactPartyId;
    const draftReference = headerNullable(draft.header, 'draftReference');
    if (draftReference) body.draftReference = draftReference;

    const termsChanged = opts?.loaded
      ? !deepEqual(opts.loaded.termSelections, draft.termSelections) || opts.loaded.notes !== draft.notes
      : false;
    if (opts?.includeTermSelections === true || termsChanged) {
      body.termSelections = cloneTermSelections(draft.termSelections);
      const cleanNotes = draft.notes.trim();
      if (cleanNotes) {
        body.notes = cleanNotes;
      }
    }
    return body;
  },

  purchaseOrderCreate(draft: DocumentDraft, opts?: OrderBodyOptions): CreatePurchaseOrderBody {
    const currencyCode = headerStr(draft.header, 'currencyCode');
    const { lineFinancials, totals } = buildOrderEvidence(draft.lines, currencyCode, true, opts);

    const lines: CreatePurchaseOrderLineInput[] = draft.lines.map((line, idx) => {
      const entry: CreatePurchaseOrderLineInput = {
        clientLineId: line.clientLineId,
        itemId: line.itemId ?? '',
        uomId: line.uomId ?? '',
        quantity: line.quantity,
        financial: lineFinancials[idx],
      };
      if (line.unitPrice !== null) {
        entry.unitPrice = line.unitPrice;
      }
      if (line.expectedDate) {
        entry.expectedDate = line.expectedDate;
      }
      if (line.receivingNodeId) {
        entry.receivingNodeId = line.receivingNodeId;
      }
      return entry;
    });

    const body: CreatePurchaseOrderBody = {
      supplierPartyId: supplierPartyIdOf(draft.header),
      supplierAccountId: headerStr(draft.header, 'supplierAccountId'),
      currencyCode,
      receivingNodeId: headerStr(draft.header, 'receivingNodeId'),
      lines,
      totals,
      termSelections: cloneTermSelections(draft.termSelections),
    };
    const contactPartyId = headerNullable(draft.header, 'contactPartyId');
    if (contactPartyId) body.contactPartyId = contactPartyId;
    const draftReference = headerNullable(draft.header, 'draftReference');
    if (draftReference) body.draftReference = draftReference;
    if (opts?.expectedPricingFingerprint) {
      body.expectedPricingFingerprint = opts.expectedPricingFingerprint;
    }
    const cleanNotes = draft.notes.trim();
    if (cleanNotes) {
      body.notes = cleanNotes;
    }
    return body;
  },

  purchaseOrderUpdate(
    oldDraft: DocumentDraft,
    nextDraft: DocumentDraft,
    opts?: { includeTerms?: boolean },
  ): UpdatePurchaseOrderBody {
    const body: UpdatePurchaseOrderBody = {};
    const oldAcc = headerNullable(oldDraft.header, 'supplierAccountId');
    const nextAcc = headerNullable(nextDraft.header, 'supplierAccountId');
    if (oldAcc !== nextAcc && nextAcc) {
      body.supplierAccountId = nextAcc;
    }

    const oldNode = headerNullable(oldDraft.header, 'receivingNodeId');
    const nextNode = headerNullable(nextDraft.header, 'receivingNodeId');
    if (oldNode !== nextNode && nextNode) {
      body.receivingNodeId = nextNode;
    }

    const oldContact = headerNullable(oldDraft.header, 'contactPartyId');
    const nextContact = headerNullable(nextDraft.header, 'contactPartyId');
    if (oldContact !== nextContact) {
      body.contactPartyId = nextContact;
    }

    const oldRef = headerNullable(oldDraft.header, 'draftReference');
    const nextRef = headerNullable(nextDraft.header, 'draftReference');
    if (oldRef !== nextRef) {
      body.draftReference = nextRef;
    }

    const termsChanged =
      !deepEqual(oldDraft.termSelections, nextDraft.termSelections) || oldDraft.notes !== nextDraft.notes;
    if (opts?.includeTerms !== false && termsChanged) {
      body.termSelections = cloneTermSelections(nextDraft.termSelections);
      body.notes = nextDraft.notes.trim();
    }
    return body;
  },

  replaceOrderLines(
    kind: 'sales-order' | 'purchase-order',
    draft: DocumentDraft,
    opts?: OrderBodyOptions,
  ): ReplaceOrderLinesBody {
    const currencyCode = headerStr(draft.header, 'currencyCode');
    const isPurchaseOrder = kind === 'purchase-order';
    const { lineFinancials, totals } = buildOrderEvidence(draft.lines, currencyCode, isPurchaseOrder, opts);

    const lines: ReplaceOrderLinesLineInput[] = draft.lines.map((line, idx) => {
      const entry: ReplaceOrderLinesLineInput = {
        clientLineId: line.clientLineId,
        itemId: line.itemId ?? '',
        uomId: line.uomId ?? '',
        quantity: line.quantity,
        financial: lineFinancials[idx],
      };
      if (line.unitPrice !== null) {
        entry.unitPrice = line.unitPrice;
      }
      if (isPurchaseOrder) {
        if (line.expectedDate !== undefined && line.expectedDate !== null) {
          entry.expectedDate = line.expectedDate;
        }
        if (line.receivingNodeId !== undefined && line.receivingNodeId !== null) {
          entry.receivingNodeId = line.receivingNodeId;
        }
      }
      return entry;
    });

    const body: ReplaceOrderLinesBody = {
      lines,
      totals,
      termSelections: cloneTermSelections(draft.termSelections),
    };
    if (opts?.expectedPricingFingerprint) {
      body.expectedPricingFingerprint = opts.expectedPricingFingerprint;
    }
    const cleanNotes = draft.notes.trim();
    if (cleanNotes) {
      body.notes = cleanNotes;
    }
    return body;
  },

  convertPurchaseQuotation(
    draft: DocumentDraft,
    opts?: ConvertBodyOptions,
  ): ConvertPurchaseQuotationBody {
    const currencyCode = headerStr(draft.header, 'currencyCode');
    const { lineFinancials, totals } = buildOrderEvidence(draft.lines, currencyCode, true, {
      currencyDecimalPlaces: opts?.currencyDecimalPlaces,
      preview: opts?.preview,
    });

    const lines: ConvertPurchaseQuotationLineInput[] = draft.lines.map((line, idx) => {
      const entry: ConvertPurchaseQuotationLineInput = {
        clientLineId: line.clientLineId,
        financial: lineFinancials[idx],
      };
      if (line.expectedDate) {
        entry.expectedDate = line.expectedDate;
      }
      if (line.receivingNodeId) {
        entry.receivingNodeId = line.receivingNodeId;
      }
      return entry;
    });

    const body: ConvertPurchaseQuotationBody = {
      supplierAccountId: headerStr(draft.header, 'supplierAccountId'),
      receivingNodeId: headerStr(draft.header, 'receivingNodeId'),
      lines,
      totals,
    };
    const draftReference = headerNullable(draft.header, 'draftReference');
    if (draftReference) {
      body.draftReference = draftReference;
    }

    const termsChanged = opts?.loaded
      ? !deepEqual(opts.loaded.termSelections, draft.termSelections) || opts.loaded.notes !== draft.notes
      : false;
    if (opts?.includeTermSelections === true || termsChanged) {
      body.termSelections = cloneTermSelections(draft.termSelections);
      const cleanNotes = draft.notes.trim();
      if (cleanNotes) {
        body.notes = cleanNotes;
      }
    }
    return body;
  },

  purchaseQuotationCreate(draft: DocumentDraft): CreatePurchaseQuotationBody {
    const lines: CreatePurchaseQuotationLineInput[] = draft.lines.map((line) => {
      const entry: CreatePurchaseQuotationLineInput = {
        clientLineId: line.clientLineId,
        itemId: line.itemId ?? '',
        uomId: line.uomId ?? '',
        quantity: line.quantity,
      };
      const description = line.description.trim();
      if (description) {
        entry.description = description;
      }
      return entry;
    });

    const body: CreatePurchaseQuotationBody = {
      supplierPartyId: supplierPartyIdOf(draft.header),
      currencyCode: headerStr(draft.header, 'currencyCode'),
      validUntil: draft.validUntil ?? '',
      termSelections: cloneTermSelections(draft.termSelections),
      lines,
    };
    const reference = headerNullable(draft.header, 'reference');
    if (reference) {
      body.reference = reference;
    }
    const cleanNotes = draft.notes.trim();
    if (cleanNotes) {
      body.notes = cleanNotes;
    }
    return body;
  },

  purchaseQuotationUpdate(
    oldDraft: DocumentDraft,
    nextDraft: DocumentDraft,
  ): UpdatePurchaseQuotationBody {
    const body: UpdatePurchaseQuotationBody = {};
    const oldSupplier = supplierPartyIdOf(oldDraft.header);
    const nextSupplier = supplierPartyIdOf(nextDraft.header);
    const supplierChanged = oldSupplier !== nextSupplier;
    if (supplierChanged && nextSupplier) {
      body.supplierPartyId = nextSupplier;
    }

    const oldCurrency = headerStr(oldDraft.header, 'currencyCode');
    const nextCurrency = headerStr(nextDraft.header, 'currencyCode');
    const currencyChanged = oldCurrency !== nextCurrency;
    if (currencyChanged && nextCurrency) {
      body.currencyCode = nextCurrency;
    }

    const oldValidUntil = oldDraft.validUntil ?? null;
    const nextValidUntil = nextDraft.validUntil ?? null;
    if (oldValidUntil !== nextValidUntil && nextValidUntil) {
      body.validUntil = nextValidUntil;
    }

    const oldRef = headerNullable(oldDraft.header, 'reference');
    const nextRef = headerNullable(nextDraft.header, 'reference');
    if (oldRef !== nextRef) {
      body.reference = nextRef;
    }

    const termsChanged =
      !deepEqual(oldDraft.termSelections, nextDraft.termSelections) || oldDraft.notes !== nextDraft.notes;
    if (termsChanged) {
      body.termSelections = cloneTermSelections(nextDraft.termSelections);
      body.notes = nextDraft.notes.trim() || null;
    }

    const linesChanged = !deepEqual(oldDraft.lines, nextDraft.lines);
    if (linesChanged || supplierChanged || currencyChanged) {
      body.lines = nextDraft.lines.map((line) => {
        const entry: CreatePurchaseQuotationLineInput = {
          clientLineId: line.clientLineId,
          itemId: line.itemId ?? '',
          uomId: line.uomId ?? '',
          quantity: line.quantity,
        };
        const description = line.description.trim();
        if (description) {
          entry.description = description;
        }
        return entry;
      });
    }

    return body;
  },
};
