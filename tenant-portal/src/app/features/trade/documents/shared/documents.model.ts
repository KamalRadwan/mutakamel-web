import type { PrintPurpose } from './document-kinds';
import type {
  Dec,
  DocumentTerms,
  LineDiscountInput,
  LineEvidence,
  LineTaxInput,
  ListQuery,
  PricingIntent,
  PrintLocale,
  QuotationRevision,
  QuotationStatus,
  QuotationTotals,
  TermSelections,
  TotalsEvidence,
} from './document.model';

export type DocumentStatusCountFilters = Omit<ListQuery, 'page' | 'limit' | 'status' | 'sort' | 'order'>;

export interface DocumentStatusCounts {
  total: number;
  byStatus: Record<string, number>;
}

export interface ReasonInput {
  reasonCode: string;
  reasonNote?: string | null;
}

export interface SupplierAccountOption {
  id: string;
  /** Always null: neither the commercial account nor the Core party has a code column. */
  code: string | null;
  /** The account's credit currency; null when it has none. */
  currencyCode: string | null;
}

export interface SupplierOption {
  partyId: string;
  displayName: string;
  accounts: SupplierAccountOption[];
}

export interface ReceivingNodeOption {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE';
}

export interface BulkPrintArtifact {
  downloadUrl: string;
  downloadExpiresAt: string;
}

export interface QuotationPricingPreviewLineInput {
  clientLineId: string;
  itemId: string;
  uomId: string;
  quantity: Dec;
  priceBookId?: string;
  discount?: LineDiscountInput | null;
}

export interface QuotationPricingPreviewLine {
  clientLineId: string;
  unitPrice: Dec;
  discountTotal: Dec;
  lineTotal: Dec;
  maxDiscountAmount: Dec;
  maxDiscountPercent: Dec;
}

export interface QuotationPricingPreview {
  currencyDecimalPlaces: number;
  lines: QuotationPricingPreviewLine[];
  totals: QuotationTotals;
  fingerprint: string;
}

export interface OrderPricingPreviewLineInput {
  clientLineId: string;
  itemId: string;
  uomId: string;
  quantity: Dec;
  unitPrice?: Dec | null;
  discountTotal?: Dec | null;
  chargeTotal?: Dec | null;
  tax?: LineTaxInput | null;
}

export interface OrderPricingPreviewBody {
  partyId?: string | null;
  currencyCode: string;
  lines: OrderPricingPreviewLineInput[];
  sourceQuotationId?: string | null;
  sourcePurchaseQuotationId?: string | null;
}

export interface CreateQuotationBody {
  partyId: string;
  crmCustomerProfileId?: string | null;
  contactPartyId?: string | null;
  currencyCode: string;
  draftReference?: string | null;
  sourceCrmOpportunityId?: string | null;
  extensionValues?: Record<string, unknown>;
}

export interface UpdateQuotationBody {
  contactPartyId?: string | null;
  draftReference?: string | null;
  sourceCrmOpportunityId?: string | null;
}

export interface CreateQuotationRevisionLineInput {
  clientLineId: string;
  itemId: string;
  uomId: string;
  quantity: Dec;
  priceBookId?: string;
  discount?: LineDiscountInput | null;
}

export interface CreateQuotationRevisionBody {
  validUntil: string;
  lines: CreateQuotationRevisionLineInput[];
  pricing: PricingIntent;
  expectedPricingFingerprint?: string;
  termSelections?: TermSelections;
  notes?: string;
  terms?: DocumentTerms;
}

export type CreateQuotationRevisionResult = QuotationRevision & {
  quotation: {
    id: string;
    version: number;
    lifecycleStatus: QuotationStatus;
    currentRevisionId: string;
  };
};

export type QuotationActionKind = 'send' | 'accept' | 'reject' | 'cancel';

export interface ConvertQuotationLineInput {
  clientLineId: string;
  chargeTotal?: Dec;
  tax?: LineTaxInput | null;
  financial: LineEvidence;
}

export interface ConvertQuotationBody {
  draftReference?: string | null;
  contactPartyId?: string | null;
  lines: ConvertQuotationLineInput[];
  totals: TotalsEvidence;
  termSelections?: TermSelections;
  notes?: string;
  terms?: DocumentTerms;
}

/** Strict DTO: a requested deadline belongs to the confirmation attempt only (confirmSalesOrder). */
export interface DirectSalesOrderFromQuotationBody {
  draftReference?: string | null;
}

export interface CreateSalesOrderLineInput {
  clientLineId: string;
  itemId: string;
  uomId: string;
  quantity: Dec;
  unitPrice?: Dec;
  financial: LineEvidence;
}

export interface CreateSalesOrderBody {
  partyId: string;
  contactPartyId?: string | null;
  currencyCode: string;
  draftReference?: string | null;
  lines: CreateSalesOrderLineInput[];
  totals: TotalsEvidence;
  expectedPricingFingerprint?: string;
  termSelections?: TermSelections;
  notes?: string;
  terms?: DocumentTerms;
  extensionValues?: Record<string, unknown>;
}

export interface UpdateSalesOrderBody {
  contactPartyId?: string | null;
  draftReference?: string | null;
  termSelections?: TermSelections;
  notes?: string;
  terms?: DocumentTerms;
}

export interface ConfirmSalesOrderResult {
  statusCode: 200;
  orderId: string;
  version: number;
  lifecycleStatus: 'CONFIRMED';
  documentNumber: string;
  unallocatedLines: string[];
}

export type SalesOrderActionKind = 'hold' | 'release-hold' | 'cancel';

export interface CreatePurchaseOrderLineInput {
  clientLineId: string;
  itemId: string;
  uomId: string;
  quantity: Dec;
  unitPrice?: Dec;
  expectedDate?: string | null;
  receivingNodeId?: string | null;
  financial: LineEvidence;
}

export interface CreatePurchaseOrderBody {
  supplierPartyId: string;
  supplierAccountId: string;
  contactPartyId?: string | null;
  currencyCode: string;
  receivingNodeId: string;
  draftReference?: string | null;
  lines: CreatePurchaseOrderLineInput[];
  totals: TotalsEvidence;
  expectedPricingFingerprint?: string;
  termSelections?: TermSelections;
  notes?: string;
  terms?: DocumentTerms;
  extensionValues?: Record<string, unknown>;
}

export interface UpdatePurchaseOrderBody {
  supplierAccountId?: string;
  receivingNodeId?: string;
  contactPartyId?: string | null;
  draftReference?: string | null;
  termSelections?: TermSelections;
  notes?: string;
  terms?: DocumentTerms;
}

export type PurchaseOrderActionKind = 'submit' | 'withdraw' | 'approve' | 'reject' | 'confirm' | 'cancel';

export interface CreatePurchaseQuotationLineInput {
  clientLineId: string;
  itemId: string;
  uomId: string;
  quantity: Dec;
  description?: string;
}

export interface CreatePurchaseQuotationBody {
  supplierPartyId: string;
  currencyCode: string;
  validUntil: string;
  reference?: string | null;
  notes?: string | null;
  termSelections?: TermSelections;
  terms?: DocumentTerms;
  lines: CreatePurchaseQuotationLineInput[];
  extensionValues?: Record<string, unknown>;
}

export interface UpdatePurchaseQuotationBody {
  supplierPartyId?: string;
  currencyCode?: string;
  validUntil?: string;
  reference?: string | null;
  notes?: string | null;
  termSelections?: TermSelections;
  terms?: DocumentTerms;
  lines?: CreatePurchaseQuotationLineInput[];
}

export interface ConvertPurchaseQuotationLineInput {
  clientLineId: string;
  expectedDate?: string | null;
  receivingNodeId?: string | null;
  financial: LineEvidence;
}

export interface ConvertPurchaseQuotationBody {
  supplierAccountId: string;
  receivingNodeId: string;
  draftReference?: string | null;
  lines: ConvertPurchaseQuotationLineInput[];
  totals: TotalsEvidence;
  termSelections?: TermSelections;
  notes?: string;
}

export interface DirectPurchaseOrderFromPurchaseQuotationBody {
  supplierAccountId?: string;
  receivingNodeId: string;
  draftReference?: string | null;
}

export interface ReplaceOrderLinesLineInput {
  clientLineId: string;
  itemId: string;
  uomId: string;
  quantity: Dec;
  unitPrice?: Dec;
  expectedDate?: string | null;
  receivingNodeId?: string | null;
  financial: LineEvidence;
}

export interface ReplaceOrderLinesBody {
  lines: ReplaceOrderLinesLineInput[];
  totals: TotalsEvidence;
  expectedPricingFingerprint?: string;
  termSelections?: TermSelections;
  notes?: string;
  terms?: DocumentTerms;
}

export interface RenderPdfBody {
  purpose: PrintPurpose;
  revisionId?: string;
  sourceVersion?: number;
  templateVersionId?: string;
  locale?: PrintLocale;
  templateChoice?: 'BUILT_IN';
}
