import type { TermSelections, TermType } from '../../shared/terms/terms.model';

export type { TermSelections };

export type DocumentKind = 'quotation' | 'sales-order' | 'purchase-order' | 'purchase-quotation';

export type Dec = string;

export interface PartySnapshot {
  id: string;
  displayName: string;
}

export interface NamedSnapshot {
  id: string;
  name: string;
}

// pending backend run documents-reason-history: no detail response returns reasonHistory yet.
export interface ReasonHistoryEntry {
  action: string;
  reasonCode: string;
  reasonNote: string | null;
  actorUserId: string;
  at: string;
}

export interface DocumentTerms {
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyTerms?: string;
  notes?: string;
}

export interface TermsSnapshotClause {
  title: string;
  body: string;
}

export interface TermsSnapshotLocale {
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyTerms?: string;
  body?: string;
  notes?: string;
  clauses?: TermsSnapshotClause[];
}

export interface TermsSnapshotSelection {
  type: TermType | (string & {});
  id: string;
  code: string;
  version: number;
}

export interface TermsSnapshotV2 {
  schemaVersion: 2;
  paymentTerms?: string;
  paymentTermCode?: string;
  dueDays?: number;
  deliveryTerms?: string;
  incotermCode?: string;
  warrantyTerms?: string;
  body?: string;
  notes?: string;
  clauses?: TermsSnapshotClause[];
  localized?: {
    en: TermsSnapshotLocale;
    ar: TermsSnapshotLocale;
  };
  selections?: TermsSnapshotSelection[];
}

export type TermsSnapshot = TermsSnapshotV2 | Record<string, unknown>;

export interface DocumentHeaderCore {
  id: string;
  version: number;
  companyId: string;
  branchId: string;
  partyId: string;
  currencyCode: string;
  businessDate: string;
  lifecycleStatus: string;
  documentNumber: string | null;
  partySnapshot: PartySnapshot;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentHeaderBase extends DocumentHeaderCore {
  contactPartyId: string | null;
  draftReference: string | null;
  grandTotal: Dec;
  extensionValues: Record<string, unknown>;
}

export type TaxCategory = 'STANDARD' | 'ZERO' | 'EXEMPT';

export interface LineTaxInput {
  category: TaxCategory;
  rateBps: number;
}

export interface TaxSnapshot {
  category: TaxCategory;
  rateBps: number;
  taxableBase: Dec;
  taxAmount: Dec;
  currencyCode: string;
}

export interface ItemTaxDefault {
  taxId: string;
  code: string;
  name: string;
  rate: Dec;
  isInclusive: boolean;
}

export interface TotalsEvidence {
  subtotal: Dec;
  discountTotal: Dec;
  chargeTotal: Dec;
  taxTotal: Dec;
  roundingTotal: Dec;
  grandTotal: Dec;
  amountPaid: Dec;
  amountDue: Dec;
}

export interface TotalsSnapshot extends TotalsEvidence {
  currencyDecimalPlaces?: number;
}

export interface LineEvidence {
  subtotal: Dec;
  taxableBase: Dec;
  discountTotal: Dec;
  chargeTotal: Dec;
  taxTotal: Dec;
  lineTotal: Dec;
  taxSnapshot: TaxSnapshot;
  inclusiveTax: boolean;
}

export interface QuotationTotals {
  subtotal: Dec;
  discountTotal: Dec;
  grandTotal: Dec;
}

export type PricingMode = 'NONE' | 'PROMOTIONS' | 'DISCOUNT';
export type DiscountScope = 'LINE' | 'DOCUMENT';
export type DiscountType = 'PERCENT' | 'AMOUNT';

export interface LineDiscountInput {
  type: DiscountType;
  value: Dec;
}

// contract pending backend item documents-discount-reason
export interface PricingIntent {
  mode: PricingMode;
  scope?: DiscountScope;
  type?: DiscountType;
  value?: Dec;
  /** Reason code (kind DOCUMENT_DISCOUNT), code-body convention; replaces the old free-text `reason`. */
  reasonCode?: string;
  /** Optional note, at most 500; required when the picked reason requires a note. */
  reasonNote?: string;
}

export interface EditableLine {
  clientLineId: string;
  itemId: string | null;
  itemLabel: string;
  description: string;
  uomId: string | null;
  quantity: Dec;
  unitPrice: Dec | null;
  discount: LineDiscountInput | null;
  discountTotal: Dec;
  chargeTotal: Dec;
  tax: LineTaxInput | null;
  taxLocked: boolean;
  expectedDate: string | null;
  receivingNodeId: string | null;
  maxDiscountAmount: Dec | null;
  maxDiscountPercent: Dec | null;
  locked: boolean;
}

export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'CONVERTED' | 'EXPIRED';
export type QuotationRevisionStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

export interface SourceCrmOpportunity {
  id: string;
  name: string;
  stageName: string;
  status: string;
}

export interface QuotationCurrentRevisionSummary {
  id: string;
  revisionNumber: number;
  status: QuotationRevisionStatus;
  validUntil: string;
  priceLockExpiresAt: string | null;
}

export interface Quotation extends DocumentHeaderBase {
  lifecycleStatus: QuotationStatus;
  currentRevisionId: string | null;
  acceptedRevisionId: string | null;
  crmCustomerProfileId: string | null;
  approvalStatus: 'NOT_REQUIRED';
  sourceCrmOpportunityId: string | null;
  currentRevision?: QuotationCurrentRevisionSummary | null;
}

export interface QuotationRevision {
  id: string;
  version: number;
  quotationId: string;
  revisionNumber: number;
  status: QuotationRevisionStatus;
  validUntil: string;
  subtotal: Dec;
  discountTotal: Dec;
  grandTotal: Dec;
  pricingMode: PricingMode;
  discountSnapshot: {
    pricing: PricingIntent;
    currencyDecimalPlaces: number;
  };
  termsSnapshot: TermsSnapshot;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  priceLockExpiresAt: string | null;
  createdAt: string;
}

export interface QuotationLine {
  id: string;
  clientLineId: string;
  printLineNumber: number;
  descriptionSnapshot: string;
  quantity: Dec;
  uomId: string;
  unitPrice: Dec;
  discountTotal: Dec;
  lineTotal: Dec;
  discountSnapshot: {
    itemId: string;
    maxDiscountAmount: Dec;
    maxDiscountPercent: Dec;
    discount: LineDiscountInput | null;
  };
  taxSnapshot: {
    sku: string;
    uomCode: string;
    itemDisplayName: string;
    itemTaxDefault?: ItemTaxDefault;
  };
  /** Display-only ("SKU · name"). Phase 5 resolves from the snapshot or item lookup. */
  itemLabel: string;
}

export type QuotationDetail = Quotation & {
  revisions: QuotationRevision[];
  currentLines: QuotationLine[];
  reasonHistory: ReasonHistoryEntry[];
};

export type SalesOrderStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | 'CLOSED';
export type ConfirmationStatus = 'NOT_STARTED' | 'COMPLETED' | 'CANCELLED';
export type HoldStatus = 'NONE' | 'HELD';

export interface SalesOrder extends DocumentHeaderBase {
  lifecycleStatus: SalesOrderStatus;
  confirmationStatus: ConfirmationStatus;
  holdStatus: HoldStatus;
  fulfillmentStatus: string;
  billingStatus: string;
  sourceQuotationId: string | null;
  sourceQuotationRevisionId: string | null;
  termsSnapshot: TermsSnapshot | null;
  totalsSnapshot: TotalsSnapshot | null;
}

export interface SalesOrderLine {
  id: string;
  clientLineId: string;
  itemCompanyProfileId: string;
  /** Optional item identifiers/names resolved when backend TR-D15 provides them. */
  itemId?: string | null;
  itemCode?: string | null;
  itemLocalizedNames?: { en?: string; ar?: string } | null;
  printLineNumber: number | null;
  descriptionSnapshot: string | null;
  uomId: string;
  uomCode?: string | null;
  uomLocalizedNames?: { en?: string; ar?: string } | null;
  uomLabel: string;
  orderedQuantity: Dec;
  allocatedQuantity: Dec;
  fulfilledQuantity: Dec;
  invoicedQuantity: Dec;
  cancelledQuantity: Dec;
  unitPrice: Dec;
  discountTotal: Dec | null;
  chargeTotal: Dec | null;
  taxTotal: Dec | null;
  lineTotal: Dec;
  taxSnapshot: TaxSnapshot | null;
  /** Display-only ("SKU · name"). Empty string when the backend omits item labels (D-1). */
  itemLabel: string;
}

export type SalesOrderDetail = SalesOrder & {
  lines: SalesOrderLine[];
  reasonHistory: ReasonHistoryEntry[];
};

export type PurchaseOrderStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | 'CLOSED';
export type ApprovalStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
export type DispatchStatus = 'NOT_REQUESTED' | 'REQUESTED' | 'SENT' | 'FAILED';
export type DeliveryStatus = 'PDF_REQUESTED' | 'EMAIL_REQUESTED' | 'COMPLETED' | 'FAILED';

export interface DeliveryInfo {
  status: DeliveryStatus;
  attemptCount: number;
  lastErrorCode: string | null;
  nextAttemptAt: string | null;
}

export interface PurchaseOrder extends DocumentHeaderBase {
  lifecycleStatus: PurchaseOrderStatus;
  approvalStatus: ApprovalStatus;
  supplierAccountId: string | null;
  receivingNodeId: string | null;
  dispatchStatus: DispatchStatus;
  fulfillmentStatus: string;
  billingStatus: string;
  termsSnapshot: TermsSnapshot | null;
  totalsSnapshot: TotalsSnapshot | null;
  sourcePurchaseQuotationId: string | null;
  createdBy: string | null;
}

export interface PurchaseOrderLine {
  id: string;
  clientLineId: string;
  itemCompanyProfileId: string;
  /** Optional item identifiers/names resolved when backend TR-D15 provides them. */
  itemId?: string | null;
  itemCode?: string | null;
  itemLocalizedNames?: { en?: string; ar?: string } | null;
  printLineNumber: number | null;
  descriptionSnapshot: string | null;
  uomId: string;
  uomCode?: string | null;
  uomLocalizedNames?: { en?: string; ar?: string } | null;
  uomLabel: string;
  orderedQuantity: Dec;
  receivedQuantity: Dec;
  cancelledQuantity: Dec;
  unitPrice: Dec;
  discountTotal?: Dec | null;
  chargeTotal: Dec | null;
  taxTotal: Dec | null;
  lineTotal: Dec;
  taxSnapshot: TaxSnapshot | null;
  expectedDate: string | null;
  receivingNodeId: string | null;
  /** Display-only ("SKU · name"). Empty string when the backend omits item labels (D-1). */
  itemLabel: string;
}

export type PurchaseOrderDetail = PurchaseOrder & {
  lines: PurchaseOrderLine[];
  approvalReady: boolean;
  delivery: DeliveryInfo | null;
  reasonHistory: ReasonHistoryEntry[];
};

export type PurchaseQuotationStatus = 'DRAFT' | 'ISSUED' | 'CONVERTED' | 'CANCELLED';

/**
 * The backend returns the purchase quotation entity as stored: it has no grandTotal (the total is
 * totalsSnapshot.grandTotal), draftReference, contactPartyId or extensionValues.
 */
export interface PurchaseQuotation extends DocumentHeaderCore {
  contactPartyId?: never;
  draftReference?: never;
  grandTotal?: never;
  extensionValues?: never;
  lifecycleStatus: PurchaseQuotationStatus;
  reference: string | null;
  notes: string | null;
  validUntil: string | null;
  finalizedAt: string | null;
  convertedPurchaseOrderId: string | null;
  termsSnapshot: TermsSnapshot | null;
  totalsSnapshot: TotalsSnapshot | null;
}

export interface PurchaseQuotationLine {
  id: string;
  clientLineId: string;
  itemCompanyProfileId: string;
  itemId: string;
  printLineNumber?: number | null;
  quantity: Dec;
  uomId: string;
  uomLabel: string;
  unitPrice: Dec;
  lineTotal: Dec;
  descriptionSnapshot: string | null;
  /** Display-only ("SKU · name"). Phase 5 resolves from the snapshot or item lookup. */
  itemLabel: string;
}

export type PurchaseQuotationDetail = PurchaseQuotation & {
  lines: PurchaseQuotationLine[];
  reasonHistory: ReasonHistoryEntry[];
};

export type RenderJobStatus = 'PENDING' | 'RETRYING' | 'COMPLETED' | 'FAILED';

export interface RenderJob {
  renderJobId: string;
  status: RenderJobStatus;
  attemptCount: number;
  failure?: {
    code: string;
    terminal: boolean;
  };
  statusUrl: string;
  artifact?: {
    downloadUrl: string;
    downloadExpiresAt: string;
    pageCount: number;
    sizeBytes: number;
  };
}

export type PrintLocale = 'ar-EG' | 'en-US';

export interface PrintTemplateOption {
  templateId: string;
  versionId: string;
  name: string;
  locale: PrintLocale;
  versionNumber: number;
}

export type SortOrder = 'asc' | 'desc';

export interface ListQuery {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  partyId?: string;
  currencyCode?: string;
  crmOpportunityId?: string;
  businessDateFrom?: string;
  businessDateTo?: string;
  sort?: string;
  order?: SortOrder;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface OrderPreviewTaxDefault {
  taxId: string;
  code: string;
  rateBps: number;
  category: TaxCategory;
  isInclusive: boolean;
}

export interface OrderPreviewLine {
  clientLineId: string;
  unitPrice: Dec;
  taxDefault: OrderPreviewTaxDefault | null;
  financial: LineEvidence;
}

export interface OrderPreview {
  currencyDecimalPlaces: number;
  lines: OrderPreviewLine[];
  totals: TotalsEvidence;
  fingerprint: string;
}

export type AnyDocument = Quotation | SalesOrder | PurchaseOrder | PurchaseQuotation;

/** A purchase quotation keeps its total only in totalsSnapshot. */
export function documentGrandTotal(row: AnyDocument): Dec | null {
  if (row.grandTotal !== undefined) return row.grandTotal;
  return 'totalsSnapshot' in row ? (row.totalsSnapshot?.grandTotal ?? null) : null;
}
export type AnyDocumentDetail = QuotationDetail | SalesOrderDetail | PurchaseOrderDetail | PurchaseQuotationDetail;

export interface DocumentByKind {
  quotation: Quotation;
  'sales-order': SalesOrder;
  'purchase-order': PurchaseOrder;
  'purchase-quotation': PurchaseQuotation;
}

export interface DocumentDetailByKind {
  quotation: QuotationDetail;
  'sales-order': SalesOrderDetail;
  'purchase-order': PurchaseOrderDetail;
  'purchase-quotation': PurchaseQuotationDetail;
}

/** Terms notes limit, counted in Unicode code points like the backend (terms.dto.ts). */
export const TERMS_NOTES_MAX_LENGTH = 800;
