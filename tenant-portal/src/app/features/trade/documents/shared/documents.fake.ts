import { FAKE_USER } from '../../../../core/auth/current-user.fake';
import { FAKE_COMPANIES } from '../../../../core/scope/scope.fake';
import { fakeGetTerm, fakeListTermOptions } from '../../shared/terms/terms.fake';
import type { TermDocumentType, TradeTerm } from '../../shared/terms/terms.model';
import { ApiError, fakeDelay, fakeId } from '../../shared/trade-api';
import { getItemSummary, itemName, toRow, toSummary } from '../../shared/trade-foundation.api';
import {
  TRADE_FAKE_DB,
  assertReasonCodeShape,
  assertReasonNoteShape,
  assertUsableReasonCode,
  bumpVersion,
  clone,
  fakeLang,
  nowIso,
} from '../../shared/trade-foundation.fake';
import type { ItemSummary, ReasonKind, TaxDefault } from '../../shared/trade-foundation.model';
import { add, cmp, isDecimal, isZero, mul, round, sub } from './decimal';
import { lineEvidence, quotationTotals, rateBpsFromPercent, totalsEvidence } from './document-evidence';
import { KIND_CONFIG, type PrintPurpose } from './document-kinds';
import type {
  AnyDocumentDetail,
  ApprovalStatus,
  Dec,
  DeliveryInfo,
  DispatchStatus,
  DocumentByKind,
  DocumentDetailByKind,
  DocumentKind,
  DocumentTerms,
  ItemTaxDefault,
  LineDiscountInput,
  LineEvidence,
  LineTaxInput,
  ListQuery,
  OrderPreview,
  OrderPreviewLine,
  OrderPreviewTaxDefault,
  Page,
  PartySnapshot,
  PricingIntent,
  PrintLocale,
  PrintTemplateOption,
  PurchaseOrder,
  PurchaseOrderDetail as PurchaseOrderResponse,
  PurchaseOrderLine,
  PurchaseQuotation,
  PurchaseQuotationDetail,
  PurchaseQuotationLine,
  Quotation,
  QuotationCurrentRevisionSummary,
  QuotationDetail,
  QuotationLine,
  QuotationRevision,
  QuotationStatus,
  QuotationTotals,
  ReasonHistoryEntry,
  RenderJob,
  SalesOrder,
  SalesOrderDetail,
  SalesOrderLine,
  SourceCrmOpportunity,
  TermSelections,
  TermsSnapshot,
  TermsSnapshotClause,
  TermsSnapshotLocale,
  TermsSnapshotSelection,
  TermsSnapshotV2,
  TotalsEvidence,
  TotalsSnapshot,
} from './document.model';
import { documentGrandTotal, TERMS_NOTES_MAX_LENGTH } from './document.model';

// Submission metadata belongs to the legacy fixture, not the API response.
type PurchaseOrderDetail = PurchaseOrderResponse & { submittedBy?: string | null; submittedAt?: string | null };

export const FAKE_CURRENT_USER_ID = FAKE_USER.email;

const MAX_LINES = 1000;
const MAX_DISCOUNT_PERCENT: Dec = '10';
const PO_APPROVAL_THRESHOLD: Dec = '100000';
const PRICE_LOCK_MS = 24 * 60 * 60 * 1000;
const RENDER_URL_TTL_MS = 300 * 1000;
const DAY_MS = 86_400_000;

const FX_FROM_EGP: Readonly<Record<string, Dec>> = {
  EGP: '1',
  USD: '0.02',
  SAR: '0.075',
  AED: '0.0735',
  KWD: '0.006',
  JPY: '3',
};

const CURRENCY_DECIMALS: Readonly<Record<string, number>> = {
  EGP: 2,
  USD: 2,
  SAR: 2,
  AED: 2,
  KWD: 3,
  JPY: 0,
};

const TERM_DOC_TYPE_BY_KIND: Readonly<Record<DocumentKind, TermDocumentType>> = {
  quotation: 'QUOTATION',
  'sales-order': 'SALES_ORDER',
  'purchase-order': 'PURCHASE_ORDER',
  'purchase-quotation': 'PURCHASE_QUOTATION',
};

const REASON_KIND_BY_ACTION: Readonly<Record<string, ReasonKind>> = {
  QUOTATION_REJECT: 'QUOTATION_REJECT',
  QUOTATION_CANCEL: 'DOCUMENT_CANCEL',
  SALES_ORDER_HOLD: 'DOCUMENT_HOLD',
  SALES_ORDER_RELEASE_HOLD: 'DOCUMENT_HOLD_RELEASE',
  SALES_ORDER_CANCEL: 'DOCUMENT_CANCEL',
  PURCHASE_ORDER_REJECT: 'PURCHASE_ORDER_REJECT',
  PURCHASE_ORDER_CANCEL: 'DOCUMENT_CANCEL',
  PURCHASE_QUOTATION_CANCEL: 'DOCUMENT_CANCEL',
};

export interface FakeCallOptions {
  skipDelay?: boolean;
  /** The caller's x-idempotency-key. The fake accepts it and ignores it. */
  idempotencyKey?: string;
}

export interface DiscountPolicy {
  hasApplyPermission: boolean;
  canApply: boolean;
  canManage: boolean;
  configured: boolean;
  limit: {
    maxPercent: Dec;
    allowFreeItems: boolean;
    reasonRequired: boolean;
  };
}

export type DocumentStatusCountFilters = Omit<ListQuery, 'page' | 'limit' | 'status' | 'sort' | 'order'>;

export interface DocumentStatusCounts {
  total: number;
  byStatus: Record<string, number>;
}

export interface ReasonInput {
  reasonCode: string;
  reasonNote?: string | null;
}

export interface CustomerOption {
  partyId: string;
  displayName: string;
  partyType: 'ORGANIZATION' | 'PERSON';
  crmCustomerProfileId: string | null;
  commercialAccountId: string | null;
  accountStatus: 'ACTIVE' | 'BLOCKED' | null;
  quotationSelectable: boolean;
}

export interface CustomerOptionPage {
  items: CustomerOption[];
  nextCursor: string | null;
}

export interface ContactOption {
  contactPartyId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  role: string | null;
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

export interface QuotationPricingPreviewBody {
  partyId?: string | null;
  currencyCode: string;
  lines: QuotationPricingPreviewLineInput[];
  pricing?: PricingIntent;
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

export interface BulkResolvedDocument {
  entityId: string;
  label: string;
  data: Record<string, string | number | null>;
}

interface FakeCustomerSeed {
  partyId: string;
  en: string;
  ar: string;
  partyType: 'ORGANIZATION' | 'PERSON';
  crmCustomerProfileId: string;
  commercialAccountId: string;
  accountStatus: 'ACTIVE' | 'BLOCKED';
  quotationSelectable: boolean;
}

interface FakeContactSeed {
  contactPartyId: string;
  en: string;
  ar: string;
  email: string;
  phone: string;
  role: string;
}

interface FakeOpportunitySeed {
  id: string;
  en: string;
  ar: string;
  stageEn: string;
  stageAr: string;
  status: string;
}

interface FakeSupplierSeed {
  partyId: string;
  en: string;
  ar: string;
  /** Every seeded account has a credit currency; the wire type allows null. */
  accounts: (SupplierAccountOption & { currencyCode: string })[];
  deliveryFails?: boolean;
}

interface FakeNodeSeed {
  id: string;
  code: string;
  en: string;
  ar: string;
  status: 'ACTIVE';
}

interface StoredRenderJob {
  kind: DocumentKind;
  documentId: string;
  job: RenderJob;
}

// ---------------------------------------------------------------------------
// Invalidation hook (wired by documents.api.ts to avoid circular imports)
// ---------------------------------------------------------------------------

let invalidationListener: ((kind: DocumentKind) => void) | null = null;

export function setDocumentInvalidationListener(listener: ((kind: DocumentKind) => void) | null): void {
  invalidationListener = listener;
}

export function notifyDocumentKindMutated(kind: DocumentKind): void {
  invalidationListener?.(kind);
}

// ---------------------------------------------------------------------------
// Reference seeds
// ---------------------------------------------------------------------------

const DISCOUNT_POLICY: DiscountPolicy = {
  hasApplyPermission: true,
  canApply: true,
  canManage: false,
  configured: true,
  limit: {
    maxPercent: MAX_DISCOUNT_PERCENT,
    allowFreeItems: false,
    reasonRequired: true,
  },
};

const CUSTOMER_SEEDS: readonly FakeCustomerSeed[] = [
  {
    partyId: 'pty-alnoor',
    en: 'Al Noor Trading Co.',
    ar: 'شركة النور للتجارة',
    partyType: 'ORGANIZATION',
    crmCustomerProfileId: 'crm-cust-alnoor',
    commercialAccountId: 'acc-c1-c-alnoor',
    accountStatus: 'ACTIVE',
    quotationSelectable: true,
  },
  {
    partyId: 'pty-02',
    en: 'Delta Foods',
    ar: 'دلتا للأغذية',
    partyType: 'ORGANIZATION',
    crmCustomerProfileId: 'crm-cust-delta',
    commercialAccountId: 'acc-c1-c-02',
    accountStatus: 'ACTIVE',
    quotationSelectable: true,
  },
  {
    partyId: 'pty-mona',
    en: 'Mona Saeed',
    ar: 'منى سعيد',
    partyType: 'PERSON',
    crmCustomerProfileId: 'crm-cust-mona',
    commercialAccountId: 'acc-c1-c-mona',
    accountStatus: 'ACTIVE',
    quotationSelectable: true,
  },
  {
    partyId: 'pty-nilepharma',
    en: 'Nile Pharma',
    ar: 'النيل للأدوية',
    partyType: 'ORGANIZATION',
    crmCustomerProfileId: 'crm-cust-nilepharma',
    commercialAccountId: 'acc-c1-c-nilepharma',
    accountStatus: 'ACTIVE',
    quotationSelectable: true,
  },
  {
    partyId: 'pty-cairobuild',
    en: 'Cairo Build Group',
    ar: 'مجموعة القاهرة للبناء',
    partyType: 'ORGANIZATION',
    crmCustomerProfileId: 'crm-cust-cairobuild',
    commercialAccountId: 'acc-c1-c-cairobuild',
    accountStatus: 'ACTIVE',
    quotationSelectable: true,
  },
  {
    partyId: 'pty-horizonhotels',
    en: 'Horizon Hotels',
    ar: 'فنادق الأفق',
    partyType: 'ORGANIZATION',
    crmCustomerProfileId: 'crm-cust-horizon',
    commercialAccountId: 'acc-c1-c-horizon',
    accountStatus: 'ACTIVE',
    quotationSelectable: true,
  },
  {
    partyId: 'pty-07',
    en: 'Sinai Trading',
    ar: 'سيناء للتجارة',
    partyType: 'ORGANIZATION',
    crmCustomerProfileId: 'crm-cust-sinai',
    commercialAccountId: 'acc-c1-c-07',
    accountStatus: 'BLOCKED',
    quotationSelectable: false,
  },
];

const CONTACTS_BY_PARTY: Readonly<Record<string, readonly FakeContactSeed[]>> = {
  'pty-alnoor': [
    {
      contactPartyId: 'cnt-alnoor-1',
      en: 'Tarek Mansour',
      ar: 'طارق منصور',
      email: 't.mansour@alnoor.example',
      phone: '+201001112201',
      role: 'Procurement Manager',
    },
    {
      contactPartyId: 'cnt-alnoor-2',
      en: 'Heba Nassar',
      ar: 'هبة نصار',
      email: 'h.nassar@alnoor.example',
      phone: '+201001112202',
      role: 'Operations Coordinator',
    },
  ],
  'pty-02': [
    {
      contactPartyId: 'cnt-delta-1',
      en: 'Sherif Gamal',
      ar: 'شريف جمال',
      email: 's.gamal@deltafoods.example',
      phone: '+201002223301',
      role: 'Supply Lead',
    },
    {
      contactPartyId: 'cnt-delta-2',
      en: 'Nadia Adel',
      ar: 'نادية عادل',
      email: 'n.adel@deltafoods.example',
      phone: '+201002223302',
      role: 'Finance Officer',
    },
  ],
  'pty-mona': [],
  'pty-nilepharma': [
    {
      contactPartyId: 'cnt-nile-1',
      en: 'Dr. Amr Salah',
      ar: 'د. عمرو صلاح',
      email: 'a.salah@nilepharma.example',
      phone: '+201003334401',
      role: 'Facility Director',
    },
    {
      contactPartyId: 'cnt-nile-2',
      en: 'Salma Reda',
      ar: 'سلمى رضا',
      email: 's.reda@nilepharma.example',
      phone: '+201003334402',
      role: 'Purchasing Specialist',
    },
  ],
  'pty-cairobuild': [
    {
      contactPartyId: 'cnt-cairo-1',
      en: 'Eng. Karim Zaki',
      ar: 'م. كريم زكي',
      email: 'k.zaki@cairobuild.example',
      phone: '+201004445501',
      role: 'Site Procurement Head',
    },
    {
      contactPartyId: 'cnt-cairo-2',
      en: 'Rania Lotfy',
      ar: 'رانيا لطفي',
      email: 'r.lotfy@cairobuild.example',
      phone: '+201004445502',
      role: 'Contracts Lead',
    },
  ],
  'pty-horizonhotels': [
    {
      contactPartyId: 'cnt-horizon-1',
      en: 'Wael Farouk',
      ar: 'وائل فاروق',
      email: 'w.farouk@horizonhotels.example',
      phone: '+201005556601',
      role: 'General Supplies Manager',
    },
    {
      contactPartyId: 'cnt-horizon-2',
      en: 'Dalia Samir',
      ar: 'داليا سمير',
      email: 'd.samir@horizonhotels.example',
      phone: '+201005556602',
      role: 'Purchasing Supervisor',
    },
  ],
  'pty-07': [
    {
      contactPartyId: 'cnt-sinai-1',
      en: 'Mahmoud Ezz',
      ar: 'محمود عز',
      email: 'm.ezz@sinaitrading.example',
      phone: '+201006667701',
      role: 'Buyer',
    },
  ],
};

function buildOpportunitiesByCustomer(): Readonly<Record<string, readonly FakeOpportunitySeed[]>> {
  const result: Record<string, FakeOpportunitySeed[]> = {};
  const stages: readonly { en: string; ar: string }[] = [
    { en: 'Proposal', ar: 'تقديم العرض' },
    { en: 'Negotiation', ar: 'التفاوض' },
    { en: 'Qualification', ar: 'التأهيل' },
  ];
  const titles: readonly { en: string; ar: string }[] = [
    { en: 'Warehouse Expansion Supply', ar: 'توريد توسعة المستودع' },
    { en: 'Annual Equipment Renewal', ar: 'تجديد المعدات السنوي' },
    { en: 'New Branch Fit-out', ar: 'تجهيز الفرع الجديد' },
  ];

  CUSTOMER_SEEDS.forEach((cust, idx) => {
    const num = String(idx + 1).padStart(2, '0');
    result[cust.partyId] = titles.map((t, j) => ({
      id: `opp-${num}-${j + 1}`,
      en: `${t.en} — ${cust.en}`,
      ar: `${t.ar} — ${cust.ar}`,
      stageEn: stages[j].en,
      stageAr: stages[j].ar,
      status: 'IN_PROGRESS',
    }));
  });

  return result;
}

const OPPORTUNITIES_BY_CUSTOMER = buildOpportunitiesByCustomer();

// Supplier picker (coordinator 2026-11-22): accounts[].code is always null (no code column on accounts or Core parties)
// and currencyCode is the account's credit currency; the picker shows "<supplier name> · <currency>".
const SUPPLIER_SEEDS: readonly FakeSupplierSeed[] = [
  {
    partyId: 'pty-gulfsteel',
    en: 'Gulf Steel Supplies',
    ar: 'توريدات صلب الخليج',
    accounts: [
      { id: 'sup-acc-gulf-egp', code: null, currencyCode: 'EGP' },
      { id: 'sup-acc-gulf-usd', code: null, currencyCode: 'USD' },
    ],
  },
  {
    partyId: 'pty-02',
    en: 'Delta Foods',
    ar: 'دلتا للأغذية',
    accounts: [{ id: 'acc-c1-s-02', code: null, currencyCode: 'EGP' }],
  },
  {
    partyId: 'pty-09',
    en: 'Horizon Distribution',
    ar: 'الأفق للتوزيع',
    accounts: [
      { id: 'acc-c1-s-09', code: null, currencyCode: 'EGP' },
      { id: 'sup-acc-horizon-sar', code: null, currencyCode: 'SAR' },
    ],
  },
  {
    partyId: 'pty-10',
    en: 'Orient Paper Mills',
    ar: 'مصانع الشرق للورق',
    accounts: [{ id: 'acc-c1-s-10', code: null, currencyCode: 'EGP' }],
  },
  {
    partyId: 'pty-12',
    en: 'Fresh Valley Beverages',
    ar: 'الوادي الطازج للمشروبات',
    accounts: [{ id: 'acc-c1-s-12', code: null, currencyCode: 'EGP' }],
    deliveryFails: true,
  },
  {
    partyId: 'pty-cairobuild',
    en: 'Cairo Build Group',
    ar: 'مجموعة القاهرة للبناء',
    accounts: [{ id: 'sup-acc-cairo-egp', code: null, currencyCode: 'EGP' }],
  },
];

const RECEIVING_NODES: readonly FakeNodeSeed[] = [
  {
    id: 'node-wh-01',
    code: 'WH-01',
    en: 'WH-01 — Main Warehouse',
    ar: 'WH-01 — المستودع الرئيسي',
    status: 'ACTIVE',
  },
  {
    id: 'node-wh-02',
    code: 'WH-02',
    en: 'WH-02 — Alexandria',
    ar: 'WH-02 — مستودع الإسكندرية',
    status: 'ACTIVE',
  },
];

const PRINT_TEMPLATES_BY_KIND: Readonly<Record<DocumentKind, readonly PrintTemplateOption[]>> = {
  quotation: [
    {
      templateId: 'tpl-qt-en',
      versionId: 'tplv-qt-en-3',
      name: 'Standard Quotation (English)',
      locale: 'en-US',
      versionNumber: 3,
    },
    {
      templateId: 'tpl-qt-ar',
      versionId: 'tplv-qt-ar-2',
      name: 'عرض سعر قياسي (العربية)',
      locale: 'ar-EG',
      versionNumber: 2,
    },
  ],
  'sales-order': [
    {
      templateId: 'tpl-so-en',
      versionId: 'tplv-so-en-2',
      name: 'Standard Sales Order (English)',
      locale: 'en-US',
      versionNumber: 2,
    },
    {
      templateId: 'tpl-so-ar',
      versionId: 'tplv-so-ar-1',
      name: 'أمر بيع قياسي (العربية)',
      locale: 'ar-EG',
      versionNumber: 1,
    },
  ],
  'purchase-order': [
    {
      templateId: 'tpl-po-en',
      versionId: 'tplv-po-en-2',
      name: 'Standard Purchase Order (English)',
      locale: 'en-US',
      versionNumber: 2,
    },
    {
      templateId: 'tpl-po-ar',
      versionId: 'tplv-po-ar-1',
      name: 'أمر شراء قياسي (العربية)',
      locale: 'ar-EG',
      versionNumber: 1,
    },
  ],
  'purchase-quotation': [
    {
      templateId: 'tpl-pq-en',
      versionId: 'tplv-pq-en-1',
      name: 'Supplier Quotation Request (English)',
      locale: 'en-US',
      versionNumber: 1,
    },
    {
      templateId: 'tpl-pq-ar',
      versionId: 'tplv-pq-ar-1',
      name: 'طلب عرض سعر مورد (العربية)',
      locale: 'ar-EG',
      versionNumber: 1,
    },
  ],
};

// ---------------------------------------------------------------------------
// Minimal valid PDF & ZIP artifact generators (no Node Buffer globals)
// ---------------------------------------------------------------------------

function buildMinimalPdf(): { dataUrl: string; byteLength: number } {
  const header = '%PDF-1.4\n';
  const streamContent = 'BT\n/F1 16 Tf\n72 720 Td\n(Mutakamel Trade Document) Tj\nET\n';
  const bodies = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  const offsets: number[] = [];
  let pdf = header;
  for (const body of bodies) {
    offsets.push(pdf.length);
    pdf += body;
  }

  const xrefOffset = pdf.length;
  let xref = `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  const fullPdf = pdf + xref + trailer;

  return {
    dataUrl: `data:application/pdf;base64,${btoa(fullPdf)}`,
    byteLength: fullPdf.length,
  };
}

const VALID_PDF_ARTIFACT = buildMinimalPdf();

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function readActiveScope(): { companyId: string; branchId: string } {
  const fallbackCompany = FAKE_COMPANIES[0];
  const fallback = { companyId: fallbackCompany.id, branchId: fallbackCompany.branches[0].id };
  const read = (storage: Storage | undefined): { companyId: string; branchId: string } | null => {
    try {
      const raw = storage?.getItem('scope');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { companyId?: unknown; branchByCompany?: Record<string, unknown> };
      const companyId = typeof parsed?.companyId === 'string' ? parsed.companyId : null;
      const company = FAKE_COMPANIES.find((c) => c.id === companyId);
      if (!company) return null;
      const branchRaw = parsed?.branchByCompany?.[company.id];
      const branch =
        typeof branchRaw === 'string' ? company.branches.find((b) => b.id === branchRaw) : undefined;
      return {
        companyId: company.id,
        branchId: (branch ?? company.branches[0]).id,
      };
    } catch {
      return null;
    }
  };

  return (
    read(typeof sessionStorage !== 'undefined' ? sessionStorage : undefined) ??
    read(typeof localStorage !== 'undefined' ? localStorage : undefined) ??
    fallback
  );
}

async function maybeDelay(opts?: FakeCallOptions): Promise<void> {
  if (!opts?.skipDelay) {
    await fakeDelay();
  }
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftYmd(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * DAY_MS).toISOString().slice(0, 10);
}

function shiftIso(daysFromNow: number, extraHours = 0): string {
  return new Date(Date.now() + daysFromNow * DAY_MS + extraHours * 3_600_000).toISOString();
}

function currencyDecimals(currencyCode: string): number {
  return CURRENCY_DECIMALS[currencyCode] ?? 2;
}

function stableHash(payload: unknown): string {
  const text = JSON.stringify(payload);
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch ^ (i & 0xff);
    h2 = Math.imul(h2, 0x01000193);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `fp_${part1}${part2}`;
}

function uomCodeOf(uomId: string): string {
  const found = TRADE_FAKE_DB.uoms.find((u) => u.id === uomId);
  return found?.code ?? 'PCS';
}

function uomLabelOf(uomId: string): string {
  const found = TRADE_FAKE_DB.uoms.find((u) => u.id === uomId);
  if (!found) return uomId;
  const lang = fakeLang();
  const localized = found.localizedNames[lang] ?? found.displayName;
  return `${found.code} — ${localized}`;
}

function uomFactor(baseUomId: string, selectedUomId: string): Dec {
  if (selectedUomId === baseUomId) return '1';
  if (baseUomId === 'uom-pcs' && selectedUomId === 'uom-box') return '12';
  if (baseUomId === 'uom-pcs' && selectedUomId === 'uom-ctn') return '24';
  if (baseUomId === 'uom-pcs' && selectedUomId === 'uom-pack') return '6';
  if (baseUomId === 'uom-ton' && selectedUomId === 'uom-kg') return '0.001';
  return '1';
}

function seedItemSummary(itemId: string): ItemSummary {
  const fakeItem = TRADE_FAKE_DB.items.find((item) => item.id === itemId);
  if (!fakeItem) {
    throw new ApiError(404, 'TRADE.CATALOG.ITEM_NOT_FOUND');
  }
  const row = toRow(fakeItem, { companyId: 'c1', branchId: 'b1' });
  return toSummary(row, { companyId: 'c1' });
}

/** Backend lines carry the item company profile id; the fake reads it from the seeded profiles. */
function fakeItemProfileId(itemId: string): string {
  return TRADE_FAKE_DB.companyProfiles.find((profile) => profile.itemId === itemId)?.id ?? `cp-${itemId}`;
}

async function fetchItemSummary(itemId: string, companyId: string): Promise<ItemSummary> {
  try {
    const summary = await getItemSummary({ companyId }, itemId);
    if (summary.companyProfile) return summary;
  } catch (err) {
    if (err instanceof ApiError && err.code === 'TRADE.CATALOG.ITEM_NOT_FOUND') {
      throw err;
    }
  }
  return getItemSummary({ companyId: 'c1' }, itemId);
}

let svInstPendingBump = false;
let svInstPriceBumped = false;

function computeUnitPriceFromSummary(
  purpose: 'SALES' | 'PURCHASE',
  summary: ItemSummary,
  uomId: string,
  currencyCode: string,
): Dec {
  let baseEgp = summary.companyProfile?.salesPrice ?? '100';
  if (summary.id === 'item-51' && svInstPriceBumped) {
    baseEgp = add(baseEgp, '250');
  }
  const baseCurrency = summary.companyProfile?.currencyCode ?? 'EGP';
  const baseFx = FX_FROM_EGP[baseCurrency] ?? '1';
  const targetFx = FX_FROM_EGP[currencyCode] ?? '1';
  const factor = uomFactor(summary.baseUomId, uomId);

  let price = mul(baseEgp, factor, 8);
  if (purpose === 'PURCHASE') {
    price = mul(price, '0.68', 8);
  }
  if (baseCurrency !== currencyCode) {
    // Convert baseCurrency -> EGP -> targetCurrency via exact decimal ratio where EGP is base 1.
    const ratio = baseFx === '1' ? targetFx : mul(targetFx, inverseRate(baseFx), 8);
    price = mul(price, ratio, 8);
  }
  return round(price, 2);
}

function inverseRate(rate: Dec): Dec {
  if (rate === '0.075') return '13.33333333';
  if (rate === '0.02') return '50';
  return '1';
}

function itemLabelOf(summary: ItemSummary): string {
  const name = itemName(summary, fakeLang()) || summary.displayName;
  return `${summary.sku} · ${name}`;
}

function findCustomerSeed(partyId: string): FakeCustomerSeed | undefined {
  return CUSTOMER_SEEDS.find((c) => c.partyId === partyId);
}

function findSupplierSeed(partyId: string): FakeSupplierSeed | undefined {
  return SUPPLIER_SEEDS.find((s) => s.partyId === partyId);
}

function localizedPartyName(partyId: string, fallback: string): string {
  const lang = fakeLang();
  const cust = findCustomerSeed(partyId);
  if (cust) return lang === 'ar' ? cust.ar : cust.en;
  const sup = findSupplierSeed(partyId);
  if (sup) return lang === 'ar' ? sup.ar : sup.en;
  return fallback;
}

function partySearchText(partyId: string, currentDisplayName: string): string {
  const parts = [currentDisplayName];
  const cust = findCustomerSeed(partyId);
  if (cust) parts.push(cust.en, cust.ar);
  const sup = findSupplierSeed(partyId);
  if (sup) parts.push(sup.en, sup.ar);
  return parts.join(' ').toLowerCase();
}

function projectPartySnapshot(snapshot: PartySnapshot): PartySnapshot {
  return {
    id: snapshot.id,
    displayName: localizedPartyName(snapshot.id, snapshot.displayName),
  };
}

function projectQuotation<T extends Quotation>(q: T): T {
  const copy = clone(q);
  copy.partySnapshot = projectPartySnapshot(copy.partySnapshot);
  return copy;
}

/**
 * The store keeps reason history append-only, oldest first; reads return it newest first, at most 50, as trade-app
 * documentReasonHistory. Actions: QUOTATION CANCEL / REJECT, SALES_ORDER HOLD / RELEASE_HOLD / CANCEL,
 * PURCHASE_ORDER PO_REJECT / PO_CANCEL, PURCHASE_QUOTATION PQ_CANCEL.
 */
function projectReasonHistory(history: readonly ReasonHistoryEntry[]): ReasonHistoryEntry[] {
  return [...history].reverse().slice(0, 50);
}

function projectQuotationDetail(q: QuotationDetail): QuotationDetail {
  const copy = projectQuotation(q);
  copy.reasonHistory = projectReasonHistory(copy.reasonHistory);
  copy.currentLines = copy.currentLines.map((line) => {
    const fakeItem = TRADE_FAKE_DB.items.find((it) => it.id === line.discountSnapshot.itemId);
    if (!fakeItem) return line;
    const summary = seedItemSummary(fakeItem.id);
    return {
      ...line,
      itemLabel: itemLabelOf(summary),
    };
  });
  return copy;
}

function projectOrderDetail<T extends SalesOrderDetail | PurchaseOrderDetail>(order: T): T {
  const copy = clone(order);
  copy.reasonHistory = projectReasonHistory(copy.reasonHistory);
  copy.partySnapshot = projectPartySnapshot(copy.partySnapshot);
  copy.lines = copy.lines.map((line) => {
    const next = { ...line };
    if (next.itemId) {
      const fakeItem = TRADE_FAKE_DB.items.find((it) => it.id === next.itemId);
      if (fakeItem) {
        next.itemLabel = itemLabelOf(seedItemSummary(fakeItem.id));
      }
    }
    next.uomLabel = uomLabelOf(next.uomId);
    return next;
  }) as T['lines'];
  return copy;
}

function projectPurchaseQuotationDetail(pq: PurchaseQuotationDetail): PurchaseQuotationDetail {
  const copy = clone(pq);
  copy.reasonHistory = projectReasonHistory(copy.reasonHistory);
  copy.partySnapshot = projectPartySnapshot(copy.partySnapshot);
  copy.lines = copy.lines.map((line) => {
    const fakeItem = TRADE_FAKE_DB.items.find((it) => it.id === line.itemId);
    return {
      ...line,
      itemLabel: fakeItem ? itemLabelOf(seedItemSummary(fakeItem.id)) : line.itemLabel,
      uomLabel: uomLabelOf(line.uomId),
    };
  });
  return copy;
}

// ---------------------------------------------------------------------------
// Terms resolution (API v2)
// ---------------------------------------------------------------------------

function buildTermsSnapshotFromSelections(
  allTerms: readonly TradeTerm[],
  selections: TermSelections,
  notes: string | undefined,
  requirePayment: boolean,
): TermsSnapshotV2 {
  const byId = new Map(allTerms.map((t) => [t.id, t]));
  const pickTerm = (id: string | undefined): TradeTerm | null => (id ? (byId.get(id) ?? null) : null);

  const payment = pickTerm(selections.paymentTermId);
  if (requirePayment && !payment) {
    throw new ApiError(422, 'TRADE.TERMS.PAYMENT_REQUIRED');
  }
  const delivery = pickTerm(selections.deliveryTermId);
  const warranty = pickTerm(selections.warrantyTermId);

  const clauses: TradeTerm[] = [];
  for (const cid of selections.clauseIds ?? []) {
    const found = pickTerm(cid);
    if (found) clauses.push(found);
  }

  const cleanNotes = notes?.trim() || undefined;
  const lang = fakeLang();

  const buildLocale = (l: 'en' | 'ar'): TermsSnapshotLocale => {
    const locClauses: TermsSnapshotClause[] = clauses.map((c) => ({
      title: c.localizedNames[l] ?? c.displayName,
      body: c.localizedTexts[l] ?? '',
    }));
    return {
      ...(payment ? { paymentTerms: payment.localizedTexts[l] ?? payment.displayName } : {}),
      ...(delivery ? { deliveryTerms: delivery.localizedTexts[l] ?? delivery.displayName } : {}),
      ...(warranty ? { warrantyTerms: warranty.localizedTexts[l] ?? warranty.displayName } : {}),
      ...(cleanNotes ? { notes: cleanNotes } : {}),
      ...(locClauses.length > 0 ? { clauses: locClauses } : {}),
    };
  };

  const enLoc = buildLocale('en');
  const arLoc = buildLocale('ar');
  const activeLoc = lang === 'ar' ? arLoc : enLoc;

  const selectionEntries: TermsSnapshotSelection[] = [];
  if (payment) {
    selectionEntries.push({ type: 'PAYMENT', id: payment.id, code: payment.code, version: payment.version });
  }
  if (delivery) {
    selectionEntries.push({ type: 'DELIVERY', id: delivery.id, code: delivery.code, version: delivery.version });
  }
  if (warranty) {
    selectionEntries.push({ type: 'WARRANTY', id: warranty.id, code: warranty.code, version: warranty.version });
  }
  for (const clause of clauses) {
    selectionEntries.push({ type: clause.termType, id: clause.id, code: clause.code, version: clause.version });
  }

  return {
    schemaVersion: 2,
    ...(activeLoc.paymentTerms ? { paymentTerms: activeLoc.paymentTerms } : {}),
    ...(payment ? { paymentTermCode: payment.code } : {}),
    ...(activeLoc.deliveryTerms ? { deliveryTerms: activeLoc.deliveryTerms } : {}),
    ...(delivery?.incotermCode ? { incotermCode: delivery.incotermCode } : {}),
    ...(activeLoc.warrantyTerms ? { warrantyTerms: activeLoc.warrantyTerms } : {}),
    ...(cleanNotes ? { notes: cleanNotes } : {}),
    ...(activeLoc.clauses ? { clauses: activeLoc.clauses } : {}),
    localized: { en: enLoc, ar: arLoc },
    selections: selectionEntries,
  };
}

function legacyTermsToSnapshot(terms: DocumentTerms | undefined, requirePayment: boolean): TermsSnapshotV2 {
  const paymentTerms = terms?.paymentTerms?.trim() || undefined;
  const deliveryTerms = terms?.deliveryTerms?.trim() || undefined;
  const warrantyTerms = terms?.warrantyTerms?.trim() || undefined;
  const notes = terms?.notes?.trim() || undefined;
  if (requirePayment && !paymentTerms) {
    throw new ApiError(422, 'TRADE.TERMS.PAYMENT_REQUIRED');
  }
  return {
    schemaVersion: 2,
    ...(paymentTerms ? { paymentTerms } : {}),
    ...(deliveryTerms ? { deliveryTerms } : {}),
    ...(warrantyTerms ? { warrantyTerms } : {}),
    ...(notes ? { notes } : {}),
  };
}

function assertValidTermsNotes(notes: string | null | undefined): void {
  if (typeof notes === 'string' && [...notes].length > TERMS_NOTES_MAX_LENGTH) {
    // Same shape as the backend 400 (terms.dto.ts): message[] of { property, constraints }.
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', {
      message: [{ property: 'notes', constraints: { maxLength: 'TRADE.TERMS.NOTE_TOO_LONG' } }],
    } as unknown as Record<string, string[]>);
  }
}

async function resolveTermsSnapshot(
  companyId: string,
  kind: DocumentKind,
  input: {
    termSelections?: TermSelections;
    notes?: string;
    terms?: DocumentTerms;
  },
  requirePayment: boolean,
): Promise<TermsSnapshotV2> {
  assertValidTermsNotes(input.notes);
  assertValidTermsNotes(input.terms?.notes);
  if (input.termSelections) {
    const docType = TERM_DOC_TYPE_BY_KIND[kind];
    const opts = await fakeListTermOptions(companyId, docType);
    const activeTerms: TradeTerm[] = [
      ...opts.byType.PAYMENT,
      ...opts.byType.DELIVERY,
      ...opts.byType.WARRANTY,
      ...opts.byType.RETURNS,
      ...opts.byType.GENERAL,
    ];

    // Resolve any selected IDs that may have become inactive so snapshots still record safely if present.
    const byId = new Set(activeTerms.map((t) => t.id));
    const selectedIds = [
      input.termSelections.paymentTermId,
      input.termSelections.deliveryTermId,
      input.termSelections.warrantyTermId,
      ...(input.termSelections.clauseIds ?? []),
    ].filter((id): id is string => Boolean(id));

    for (const id of selectedIds) {
      if (!byId.has(id)) {
        try {
          const extra = await fakeGetTerm(companyId, id);
          activeTerms.push(extra);
          byId.add(id);
        } catch {
          // Unknown term id ignored here; missing required payment triggers TRADE.TERMS.PAYMENT_REQUIRED.
        }
      }
    }

    return buildTermsSnapshotFromSelections(activeTerms, input.termSelections, input.notes, requirePayment);
  }

  if (input.terms) {
    return legacyTermsToSnapshot(
      input.notes ? { ...input.terms, notes: input.notes } : input.terms,
      requirePayment,
    );
  }

  if (requirePayment) {
    throw new ApiError(422, 'TRADE.TERMS.PAYMENT_REQUIRED');
  }

  const cleanNotes = input.notes?.trim() || undefined;
  return {
    schemaVersion: 2,
    ...(cleanNotes ? { notes: cleanNotes } : {}),
  };
}

function seedTermsSnapshot(
  docType: 'SALES' | 'PURCHASE',
  notes?: string,
): TermsSnapshotV2 {
  const cleanNotes = notes?.trim() || undefined;
  if (docType === 'SALES') {
    return {
      schemaVersion: 2,
      paymentTerms: 'Full invoice payment is due within 30 calendar days from the invoice issue date.',
      paymentTermCode: 'NET30',
      deliveryTerms: 'Seller delivers the goods to the designated destination within 14 working days.',
      incotermCode: 'DAP',
      warrantyTerms: 'Covers manufacturing and material defects for 12 months from delivery.',
      ...(cleanNotes ? { notes: cleanNotes } : {}),
      clauses: [
        {
          title: 'Standard general conditions',
          body: 'This document is governed by the agreed commercial terms between the parties.',
        },
      ],
      localized: {
        en: {
          paymentTerms: 'Full invoice payment is due within 30 calendar days from the invoice issue date.',
          deliveryTerms: 'Seller delivers the goods to the designated destination within 14 working days.',
          warrantyTerms: 'Covers manufacturing and material defects for 12 months from delivery.',
          ...(cleanNotes ? { notes: cleanNotes } : {}),
          clauses: [
            {
              title: 'Standard general conditions',
              body: 'This document is governed by the agreed commercial terms between the parties.',
            },
          ],
        },
        ar: {
          paymentTerms: 'يستحق سداد كامل قيمة الفاتورة خلال 30 يومًا ميلاديًا من تاريخ إصدارها.',
          deliveryTerms: 'يتولى البائع تسليم البضاعة في الموقع المحدد خلال 14 يوم عمل.',
          warrantyTerms: 'يغطي الضمان عيوب التصنيع والمواد لمدة 12 شهرًا من تاريخ التسليم.',
          ...(cleanNotes ? { notes: cleanNotes } : {}),
          clauses: [
            {
              title: 'الشروط والأحكام العامة القياسية',
              body: 'يخضع هذا المستند للشروط التجارية المتفق عليها بين الطرفين.',
            },
          ],
        },
      },
      selections: [
        { type: 'PAYMENT', id: 'term-c1-payment-net30', code: 'NET30', version: 1 },
        { type: 'DELIVERY', id: 'term-c1-delivery-site14', code: 'SITE14', version: 1 },
        { type: 'WARRANTY', id: 'term-c1-warranty-w12', code: 'W12', version: 1 },
        { type: 'GENERAL', id: 'term-c1-general-gen', code: 'GEN', version: 1 },
      ],
    };
  }

  return {
    schemaVersion: 2,
    paymentTerms: 'Supplier invoices are settled within 60 calendar days from receipt and inspection.',
    paymentTermCode: 'SUP60',
    deliveryTerms: 'Supplier delivers goods cleared for import to the designated receiving warehouse.',
    incotermCode: 'DDP',
    ...(cleanNotes ? { notes: cleanNotes } : {}),
    clauses: [
      {
        title: 'Inspection on receipt',
        body: 'The receiving party must inspect quantities and visible condition upon delivery.',
      },
    ],
    localized: {
      en: {
        paymentTerms: 'Supplier invoices are settled within 60 calendar days from receipt and inspection.',
        deliveryTerms: 'Supplier delivers goods cleared for import to the designated receiving warehouse.',
        ...(cleanNotes ? { notes: cleanNotes } : {}),
        clauses: [
          {
            title: 'Inspection on receipt',
            body: 'The receiving party must inspect quantities and visible condition upon delivery.',
          },
        ],
      },
      ar: {
        paymentTerms: 'تُسوّى فواتير المورد خلال 60 يومًا ميلاديًا من تاريخ الاستلام والفحص.',
        deliveryTerms: 'يلتزم المورد بتسليم البضاعة إلى مستودع الاستلام المحدد.',
        ...(cleanNotes ? { notes: cleanNotes } : {}),
        clauses: [
          {
            title: 'الفحص عند الاستلام',
            body: 'يتعين على الجهة المستلمة فحص الكميات والحالة الظاهرية عند التسليم.',
          },
        ],
      },
    },
    selections: [
      { type: 'PAYMENT', id: 'term-c1-payment-sup60', code: 'SUP60', version: 1 },
      { type: 'DELIVERY', id: 'term-c1-delivery-supdel', code: 'SUPDEL', version: 1 },
      { type: 'GENERAL', id: 'term-c1-general-inspect', code: 'INSPECT', version: 1 },
    ],
  };
}

function hasNonEmptyTerms(snapshot: TermsSnapshot | null | undefined): boolean {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const rec = snapshot as Record<string, unknown>;
  const selections = rec['selections'];
  if (Array.isArray(selections) && selections.length > 0) return true;
  const hasStr = (key: string): boolean => typeof rec[key] === 'string' && rec[key].trim().length > 0;
  return hasStr('paymentTerms') || hasStr('deliveryTerms') || hasStr('warrantyTerms') || hasStr('notes');
}

function termsSnapshotsMatch(source: TermsSnapshot, provided: DocumentTerms): boolean {
  const src = source as Record<string, unknown>;
  const norm = (val: unknown): string => (typeof val === 'string' ? val.trim() : '');
  const pairs: readonly [string, string | undefined][] = [
    ['paymentTerms', provided.paymentTerms],
    ['deliveryTerms', provided.deliveryTerms],
    ['warrantyTerms', provided.warrantyTerms],
    ['notes', provided.notes],
  ];
  return pairs.every(([key, val]) => norm(src[key]) === norm(val));
}

// ---------------------------------------------------------------------------
// Reason validation (API v2)
// ---------------------------------------------------------------------------

function validateReasonInput(expectedKind: ReasonKind, input: ReasonInput | undefined): {
  reasonCode: string;
  reasonNote: string | null;
} {
  const code = input?.reasonCode?.trim() ?? '';
  if (!code) {
    throw new ApiError(422, 'TRADE.REASON.NOT_FOUND');
  }

  const reasons = TRADE_FAKE_DB.reasons ?? [];
  const matchSameKind = reasons.find((r) => r.kind === expectedKind && r.code === code);
  if (!matchSameKind) {
    const existsInOtherKind = reasons.some((r) => r.code === code);
    throw new ApiError(422, existsInOtherKind ? 'TRADE.REASON.KIND_INVALID' : 'TRADE.REASON.NOT_FOUND');
  }
  if (!matchSameKind.isActive) {
    throw new ApiError(422, 'TRADE.REASON.INACTIVE');
  }

  const noteRaw = input?.reasonNote ?? null;
  const trimmedNote = noteRaw !== null ? noteRaw.trim() : null;
  if (trimmedNote && trimmedNote.length > 500) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  if (matchSameKind.requiresNote && (!trimmedNote || trimmedNote.length === 0)) {
    throw new ApiError(422, 'TRADE.REASON.NOTE_REQUIRED');
  }

  return {
    reasonCode: matchSameKind.code,
    reasonNote: trimmedNote && trimmedNote.length > 0 ? trimmedNote : null,
  };
}

/**
 * Discount reason on the pricing intent (contract pending backend item documents-discount-reason):
 * DTO shape first (400 TRADE.VALIDATION_FAILED), then DISCOUNT_REASON_REQUIRED when the policy needs one,
 * then the TRADE.REASON.* rules for kind DOCUMENT_DISCOUNT.
 */
export function validateDiscountReason(pricing: Pick<PricingIntent, 'reasonCode' | 'reasonNote'>): void {
  assertReasonNoteShape(pricing.reasonNote);
  const code = pricing.reasonCode ?? '';
  if (!code.trim()) {
    if (DISCOUNT_POLICY.limit.reasonRequired) throw new ApiError(422, 'TRADE.QUOTE.DISCOUNT_REASON_REQUIRED');
    return;
  }
  assertReasonCodeShape(code);
  assertUsableReasonCode('DOCUMENT_DISCOUNT', code, pricing.reasonNote);
}

function appendReasonHistory(
  history: ReasonHistoryEntry[],
  action: string,
  expectedKind: ReasonKind,
  input: ReasonInput | undefined,
): void {
  const resolved = validateReasonInput(expectedKind, input);
  history.push({
    action,
    reasonCode: resolved.reasonCode,
    reasonNote: resolved.reasonNote,
    actorUserId: FAKE_CURRENT_USER_ID,
    at: nowIso(),
  });
}

// ---------------------------------------------------------------------------
// Order evidence & validation helpers
// ---------------------------------------------------------------------------

function assertValidVersion(currentVersion: number, expectedVersion: number): void {
  if (currentVersion !== expectedVersion) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }
}

function assertPositiveDecimal(value: Dec): void {
  if (!isDecimal(value, { positive: true })) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
}

function verifyFinancialEvidence(
  lines: readonly {
    clientLineId: string;
    quantity: Dec;
    unitPrice: Dec;
    taxDefault: TaxDefault | null;
    financial: LineEvidence;
  }[],
  totals: TotalsEvidence,
  currencyCode: string,
  isPurchaseOrder: boolean,
): void {
  const computedLines: LineEvidence[] = [];
  for (const line of lines) {
    if (line.taxDefault?.isInclusive) {
      throw new ApiError(422, 'TRADE.TAX.INCLUSIVE_NOT_SUPPORTED', {
        clientLineId: [line.clientLineId],
      });
    }
    if (isPurchaseOrder && !isZero(line.financial.discountTotal)) {
      throw new ApiError(422, 'TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE');
    }

    const expected = lineEvidence(
      {
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountTotal: isPurchaseOrder ? '0' : line.financial.discountTotal,
        chargeTotal: line.financial.chargeTotal,
        tax: {
          category: line.financial.taxSnapshot.category,
          rateBps: line.financial.taxSnapshot.rateBps,
        },
        taxDefault: line.taxDefault,
      },
      currencyCode,
    );

    const sameLine =
      cmp(expected.subtotal, line.financial.subtotal) === 0 &&
      cmp(expected.taxableBase, line.financial.taxableBase) === 0 &&
      cmp(expected.discountTotal, line.financial.discountTotal) === 0 &&
      cmp(expected.chargeTotal, line.financial.chargeTotal) === 0 &&
      cmp(expected.taxTotal, line.financial.taxTotal) === 0 &&
      cmp(expected.lineTotal, line.financial.lineTotal) === 0 &&
      expected.taxSnapshot.category === line.financial.taxSnapshot.category &&
      expected.taxSnapshot.rateBps === line.financial.taxSnapshot.rateBps &&
      cmp(expected.taxSnapshot.taxableBase, line.financial.taxSnapshot.taxableBase) === 0 &&
      cmp(expected.taxSnapshot.taxAmount, line.financial.taxSnapshot.taxAmount) === 0 &&
      expected.taxSnapshot.currencyCode === line.financial.taxSnapshot.currencyCode;

    if (!sameLine) {
      throw new ApiError(422, 'TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE');
    }
    computedLines.push(expected);
  }

  const expectedTotals = totalsEvidence(computedLines, currencyDecimals(currencyCode));
  const sameTotals =
    cmp(expectedTotals.subtotal, totals.subtotal) === 0 &&
    cmp(expectedTotals.discountTotal, totals.discountTotal) === 0 &&
    cmp(expectedTotals.chargeTotal, totals.chargeTotal) === 0 &&
    cmp(expectedTotals.taxTotal, totals.taxTotal) === 0 &&
    cmp(expectedTotals.roundingTotal, totals.roundingTotal) === 0 &&
    cmp(expectedTotals.grandTotal, totals.grandTotal) === 0 &&
    cmp(expectedTotals.amountPaid, totals.amountPaid) === 0 &&
    cmp(expectedTotals.amountDue, totals.amountDue) === 0;

  if (!sameTotals) {
    throw new ApiError(422, 'TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE');
  }
}

function toTotalsSnapshot(totals: TotalsEvidence, currencyCode: string): TotalsSnapshot {
  return {
    ...totals,
    currencyDecimalPlaces: currencyDecimals(currencyCode),
  };
}

function toItemTaxDefault(def: TaxDefault | null): ItemTaxDefault | undefined {
  if (!def) return undefined;
  return {
    taxId: def.taxId,
    code: def.code,
    name: def.name,
    rate: def.rate,
    isInclusive: def.isInclusive,
  };
}

function toOrderPreviewTaxDefault(def: TaxDefault | null): OrderPreviewTaxDefault | null {
  if (!def) return null;
  const rateBps = rateBpsFromPercent(def.rate);
  const code = def.code.toUpperCase();
  const category = code === 'EXEMPT' ? 'EXEMPT' : rateBps > 0 ? 'STANDARD' : 'ZERO';
  return {
    taxId: def.taxId,
    code: def.code,
    rateBps,
    category,
    isInclusive: def.isInclusive,
  };
}

// ---------------------------------------------------------------------------
// Seed builders
// ---------------------------------------------------------------------------

function makeQuotationLine(
  id: string,
  printLineNumber: number,
  itemId: string,
  quantity: Dec,
  currencyCode: string,
  discount: LineDiscountInput | null = null,
  uomOverride?: string,
): QuotationLine {
  const summary = seedItemSummary(itemId);
  const uomId = uomOverride ?? summary.defaultUomId ?? summary.baseUomId;
  const unitPrice = computeUnitPriceFromSummary('SALES', summary, uomId, currencyCode);
  const dp = currencyDecimals(currencyCode);
  const gross = mul(quantity, unitPrice, dp);
  const maxDiscountAmount = mul(gross, '0.10', dp);

  let discountTotal: Dec = '0';
  if (discount) {
    discountTotal =
      discount.type === 'PERCENT'
        ? mul(gross, mul(discount.value, '0.01', 8), dp)
        : round(discount.value, dp);
  }
  const lineTotal = sub(gross, discountTotal);

  return {
    id,
    clientLineId: `cl-${id}`,
    printLineNumber,
    descriptionSnapshot: itemName(summary, 'en'),
    quantity,
    uomId,
    unitPrice,
    discountTotal,
    lineTotal,
    discountSnapshot: {
      itemId: summary.id,
      maxDiscountAmount,
      maxDiscountPercent: MAX_DISCOUNT_PERCENT,
      discount,
    },
    taxSnapshot: {
      sku: summary.sku,
      uomCode: uomCodeOf(uomId),
      itemDisplayName: itemName(summary, 'en'),
      itemTaxDefault: toItemTaxDefault(summary.salesTaxDefault),
    },
    itemLabel: itemLabelOf(summary),
  };
}

function buildSeedQuotations(): QuotationDetail[] {
  const statuses: readonly QuotationStatus[] = [
    'DRAFT',
    'SENT',
    'ACCEPTED',
    'CONVERTED',
    'REJECTED',
    'EXPIRED',
    'CANCELLED',
  ];
  const currencies = ['EGP', 'USD', 'SAR'] as const;
  const selectableCustomers = CUSTOMER_SEEDS.filter((c) => c.quotationSelectable);
  const itemPool = ['item-49', 'item-50', 'item-51', 'item-52', 'item-55'] as const;
  const result: QuotationDetail[] = [];

  for (let i = 1; i <= 32; i += 1) {
    const nn = String(i).padStart(2, '0');
    const id = `qt-${nn}`;
    const customer = selectableCustomers[(i - 1) % selectableCustomers.length];
    const opps = OPPORTUNITIES_BY_CUSTOMER[customer.partyId] ?? [];

    let status: QuotationStatus = statuses[(i - 1) % statuses.length];
    let currencyCode: string = currencies[(i - 1) % currencies.length];
    let revCount = ((i - 1) % 4) + 1;
    let docNumber: string | null = `QT-2026-00${nn}`;
    let validUntil = shiftYmd(20 + i);
    let priceLockExpiresAt: string | null = null;
    let oppId: string | null = i % 3 === 1 ? (opps[0]?.id ?? null) : null;

    if (i === 1) {
      status = 'SENT';
      currencyCode = 'EGP';
      revCount = 3;
    } else if (i === 2) {
      status = 'ACCEPTED';
      currencyCode = 'USD';
      revCount = 2;
    } else if (i === 3) {
      status = 'ACCEPTED';
      currencyCode = 'EGP';
      revCount = 1;
    } else if (i === 4) {
      status = 'DRAFT';
      currencyCode = 'EGP';
      revCount = 1;
      docNumber = null;
    } else if (i === 5) {
      status = 'DRAFT';
      currencyCode = 'SAR';
      revCount = 2;
      docNumber = 'QT-2026-0005';
    } else if (i === 6) {
      status = 'DRAFT';
      currencyCode = 'EGP';
      revCount = 0;
      docNumber = null;
      oppId = null;
    } else if (i === 7) {
      status = 'SENT';
      currencyCode = 'USD';
      revCount = 2;
    } else if (i === 8) {
      status = 'CONVERTED';
      currencyCode = 'EGP';
      revCount = 4;
    } else if (i === 9) {
      status = 'CONVERTED';
      currencyCode = 'USD';
      revCount = 2;
    } else if (i === 10) {
      status = 'ACCEPTED';
      currencyCode = 'EGP';
      revCount = 1;
    } else if (status === 'DRAFT' && i % 2 === 0) {
      docNumber = null;
    }

    const cust =
      i === 1 || i === 2 || i === 8
        ? CUSTOMER_SEEDS[0]
        : i === 3
          ? CUSTOMER_SEEDS[3]
          : i === 4 || i === 9
            ? CUSTOMER_SEEDS[1]
            : i === 5 || i === 10
              ? CUSTOMER_SEEDS[4]
              : i === 6
                ? CUSTOMER_SEEDS[2]
                : i === 7
                  ? CUSTOMER_SEEDS[5]
                  : customer;

    const custContacts = CONTACTS_BY_PARTY[cust.partyId] ?? [];
    const createdAt = shiftIso(-(40 - i));
    const businessDate = createdAt.slice(0, 10);

    let lines: QuotationLine[] = [];
    if (i === 1) {
      lines = [
        makeQuotationLine(`ql-${nn}-1`, 1, 'item-49', '5', currencyCode, { type: 'PERCENT', value: '5' }),
        makeQuotationLine(`ql-${nn}-2`, 2, 'item-50', '3', currencyCode, null),
        makeQuotationLine(`ql-${nn}-3`, 3, 'item-51', '2', currencyCode, null),
      ];
    } else if (i === 2) {
      lines = [
        makeQuotationLine(`ql-${nn}-1`, 1, 'item-49', '4', currencyCode, { type: 'PERCENT', value: '5' }),
        makeQuotationLine(`ql-${nn}-2`, 2, 'item-52', '2', currencyCode, null),
      ];
    } else if (i === 3) {
      lines = [
        makeQuotationLine(`ql-${nn}-1`, 1, 'item-49', '2', currencyCode, null),
        makeQuotationLine(`ql-${nn}-2`, 2, 'item-53', '5', currencyCode, null),
      ];
    } else if (i === 6) {
      lines = [];
    } else if (i === 10) {
      lines = [makeQuotationLine(`ql-${nn}-1`, 1, 'item-54', '2', currencyCode, null, 'uom-ton')];
    } else {
      const a = itemPool[(i - 1) % itemPool.length];
      const b = itemPool[i % itemPool.length];
      lines = [
        makeQuotationLine(`ql-${nn}-1`, 1, a, String((i % 6) + 1), currencyCode, null),
        makeQuotationLine(`ql-${nn}-2`, 2, b, String((i % 4) + 2), currencyCode, null),
      ];
    }

    const qTotals = quotationTotals(lines);
    const revisions: QuotationRevision[] = [];
    for (let r = 1; r <= revCount; r += 1) {
      const isLast = r === revCount;
      const revStatus: QuotationRevision['status'] = !isLast
        ? 'SENT'
        : status === 'CONVERTED'
          ? 'ACCEPTED'
          : status;
      if (isLast && status === 'SENT') {
        priceLockExpiresAt = i === 7 ? shiftIso(0, -4) : shiftIso(0, 18);
      } else if (!isLast) {
        priceLockExpiresAt = null;
      }
      if (status === 'EXPIRED' && isLast) {
        validUntil = shiftYmd(-5);
      }

      const revSubtotal = isLast ? qTotals.subtotal : add(qTotals.subtotal, String(r * 100));
      const revDiscount = isLast ? qTotals.discountTotal : '0';
      const revGrand = sub(revSubtotal, revDiscount);

      revisions.push({
        id: `qrev-${nn}-${r}`,
        version: 1,
        quotationId: id,
        revisionNumber: r,
        status: revStatus,
        validUntil,
        subtotal: revSubtotal,
        discountTotal: revDiscount,
        grandTotal: revGrand,
        pricingMode: i === 1 || i === 2 ? 'DISCOUNT' : 'NONE',
        discountSnapshot: {
          pricing:
            i === 1 || i === 2
              ? { mode: 'DISCOUNT', scope: 'LINE', reasonCode: 'LOYAL_CUSTOMER' }
              : { mode: 'NONE' },
          currencyDecimalPlaces: currencyDecimals(currencyCode),
        },
        termsSnapshot: seedTermsSnapshot('SALES', i % 4 === 0 ? 'Standard delivery schedule applies.' : undefined),
        sentAt: revStatus !== 'DRAFT' ? shiftIso(-(38 - i)) : null,
        acceptedAt: revStatus === 'ACCEPTED' ? shiftIso(-(35 - i)) : null,
        rejectedAt: revStatus === 'REJECTED' ? shiftIso(-(35 - i)) : null,
        priceLockExpiresAt: isLast && status === 'SENT' ? priceLockExpiresAt : null,
        createdAt: shiftIso(-(40 - i) + r - 1),
      });
    }

    const lastRev = revisions[revisions.length - 1] ?? null;
    const reasonHistory: ReasonHistoryEntry[] = [];
    if (status === 'REJECTED') {
      reasonHistory.push({
        action: 'REJECT',
        reasonCode: 'PRICE_NOT_ACCEPTED',
        reasonNote: 'Customer requested revised unit pricing.',
        actorUserId: FAKE_CURRENT_USER_ID,
        at: shiftIso(-(30 - i)),
      });
    } else if (status === 'CANCELLED') {
      reasonHistory.push({
        action: 'CANCEL',
        reasonCode: 'CUSTOMER_REQUEST',
        reasonNote: 'Project postponed by customer.',
        actorUserId: FAKE_CURRENT_USER_ID,
        at: shiftIso(-(30 - i)),
      });
    }

    const summary: QuotationCurrentRevisionSummary | null = lastRev
      ? {
          id: lastRev.id,
          revisionNumber: lastRev.revisionNumber,
          status: lastRev.status,
          validUntil: lastRev.validUntil,
          priceLockExpiresAt: lastRev.priceLockExpiresAt,
        }
      : null;

    result.push({
      id,
      version: revCount + 1,
      companyId: 'c1',
      branchId: 'b1',
      partyId: cust.partyId,
      contactPartyId: custContacts[0]?.contactPartyId ?? null,
      currencyCode,
      businessDate,
      lifecycleStatus: status,
      documentNumber: docNumber,
      draftReference: `REF-QT-${nn}`,
      grandTotal: qTotals.grandTotal,
      partySnapshot: { id: cust.partyId, displayName: cust.en },
      createdAt,
      updatedAt: shiftIso(-(35 - i)),
      extensionValues: {},
      currentRevisionId: lastRev?.id ?? null,
      acceptedRevisionId: status === 'ACCEPTED' || status === 'CONVERTED' ? (lastRev?.id ?? null) : null,
      crmCustomerProfileId: cust.crmCustomerProfileId,
      approvalStatus: 'NOT_REQUIRED',
      sourceCrmOpportunityId: oppId,
      currentRevision: summary,
      revisions,
      currentLines: lines,
      reasonHistory,
    });
  }

  return result;
}

function makeOrderLineEvidence(
  itemId: string,
  uomId: string,
  quantity: Dec,
  unitPrice: Dec,
  discountTotal: Dec,
  chargeTotal: Dec,
  currencyCode: string,
  taxOverride?: LineTaxInput,
): { ev: LineEvidence; summary: ItemSummary } {
  const summary = seedItemSummary(itemId);
  const ev = lineEvidence(
    {
      quantity,
      unitPrice,
      discountTotal,
      chargeTotal,
      tax: taxOverride ?? null,
      taxDefault: taxOverride ? null : summary.salesTaxDefault,
    },
    currencyCode,
  );
  return { ev, summary };
}

function buildSeedSalesOrders(quotations: readonly QuotationDetail[]): SalesOrderDetail[] {
  const result: SalesOrderDetail[] = [];
  const selectableCustomers = CUSTOMER_SEEDS.filter((c) => c.quotationSelectable);
  const currencies = ['EGP', 'USD', 'SAR'] as const;
  const qt08 = quotations.find((q) => q.id === 'qt-08');
  const qt09 = quotations.find((q) => q.id === 'qt-09');

  for (let i = 1; i <= 17; i += 1) {
    const nn = String(i).padStart(2, '0');
    const id = `so-${nn}`;
    const cust = selectableCustomers[(i - 1) % selectableCustomers.length];
    const currencyCode = i === 2 ? 'USD' : currencies[(i - 1) % currencies.length];
    const createdAt = shiftIso(-(25 - i));
    const businessDate = createdAt.slice(0, 10);

    let lifecycleStatus: SalesOrder['lifecycleStatus'] = 'DRAFT';
    let holdStatus: SalesOrder['holdStatus'] = 'NONE';
    let confirmationStatus: SalesOrder['confirmationStatus'] = 'NOT_STARTED';
    let docNumber: string | null = null;
    let sourceQuotationId: string | null = null;
    let sourceQuotationRevisionId: string | null = null;
    let chosenCust = cust;
    let lines: SalesOrderLine[] = [];

    if (i === 1 && qt08) {
      chosenCust = findCustomerSeed(qt08.partyId) ?? cust;
      sourceQuotationId = qt08.id;
      sourceQuotationRevisionId = qt08.acceptedRevisionId;
      lines = qt08.currentLines.map((ql, idx) => {
        const { ev, summary } = makeOrderLineEvidence(
          ql.discountSnapshot.itemId,
          ql.uomId,
          ql.quantity,
          ql.unitPrice,
          ql.discountTotal,
          '0',
          qt08.currencyCode,
        );
        return {
          id: `sol-${nn}-${idx + 1}`,
          clientLineId: ql.clientLineId,
          itemId: summary.id,
          itemCompanyProfileId: fakeItemProfileId(summary.id),
          printLineNumber: idx + 1,
          descriptionSnapshot: ql.descriptionSnapshot,
          uomId: ql.uomId,
          uomLabel: uomLabelOf(ql.uomId),
          orderedQuantity: ql.quantity,
          allocatedQuantity: '0',
          fulfilledQuantity: '0',
          invoicedQuantity: '0',
          cancelledQuantity: '0',
          unitPrice: ql.unitPrice,
          discountTotal: ev.discountTotal,
          chargeTotal: ev.chargeTotal,
          taxTotal: ev.taxTotal,
          lineTotal: ev.lineTotal,
          taxSnapshot: ev.taxSnapshot,
          itemLabel: itemLabelOf(summary),
        };
      });
    } else if (i === 2 && qt09) {
      // Matches the mockup Sales Order math (5027.4 + 380.5 = USD 5407.9).
      chosenCust = findCustomerSeed(qt09.partyId) ?? cust;
      lifecycleStatus = 'CONFIRMED';
      confirmationStatus = 'COMPLETED';
      docNumber = 'SO-2026-0002';
      sourceQuotationId = qt09.id;
      sourceQuotationRevisionId = qt09.acceptedRevisionId;

      const l1 = makeOrderLineEvidence('item-49', 'uom-pcs', '4', '1150', '230', '40', 'USD', {
        category: 'STANDARD',
        rateBps: 1400,
      });
      const l2 = makeOrderLineEvidence('item-52', 'uom-pcs', '4', '95.125', '0', '0', 'USD', {
        category: 'EXEMPT',
        rateBps: 0,
      });
      lines = [
        {
          id: 'sol-02-1',
          clientLineId: 'cl-sol-02-1',
          itemId: 'item-49',
          itemCompanyProfileId: fakeItemProfileId('item-49'),
          printLineNumber: 1,
          descriptionSnapshot: 'Steel shelf 220 cm',
          uomId: 'uom-pcs',
          uomLabel: uomLabelOf('uom-pcs'),
          orderedQuantity: '4',
          allocatedQuantity: '4',
          fulfilledQuantity: '0',
          invoicedQuantity: '0',
          cancelledQuantity: '0',
          unitPrice: '1150',
          discountTotal: l1.ev.discountTotal,
          chargeTotal: l1.ev.chargeTotal,
          taxTotal: l1.ev.taxTotal,
          lineTotal: l1.ev.lineTotal,
          taxSnapshot: l1.ev.taxSnapshot,
          itemLabel: itemLabelOf(l1.summary),
        },
        {
          id: 'sol-02-2',
          clientLineId: 'cl-sol-02-2',
          itemId: 'item-52',
          itemCompanyProfileId: fakeItemProfileId('item-52'),
          printLineNumber: 2,
          descriptionSnapshot: 'Laptop 14 inch',
          uomId: 'uom-pcs',
          uomLabel: uomLabelOf('uom-pcs'),
          orderedQuantity: '4',
          allocatedQuantity: '4',
          fulfilledQuantity: '0',
          invoicedQuantity: '0',
          cancelledQuantity: '0',
          unitPrice: '95.125',
          discountTotal: l2.ev.discountTotal,
          chargeTotal: l2.ev.chargeTotal,
          taxTotal: l2.ev.taxTotal,
          lineTotal: l2.ev.lineTotal,
          taxSnapshot: l2.ev.taxSnapshot,
          itemLabel: itemLabelOf(l2.summary),
        },
      ];
    } else {
      if (i === 3) {
        lifecycleStatus = 'DRAFT';
        holdStatus = 'HELD';
      } else if (i === 4) {
        lifecycleStatus = 'CONFIRMED';
        confirmationStatus = 'COMPLETED';
        holdStatus = 'HELD';
        docNumber = `SO-2026-00${nn}`;
      } else if (i === 14 || i === 15 || i === 16) {
        lifecycleStatus = 'CANCELLED';
        confirmationStatus = 'CANCELLED';
        docNumber = i === 14 ? null : `SO-2026-00${nn}`;
      } else if (i === 17) {
        lifecycleStatus = 'CLOSED';
        confirmationStatus = 'COMPLETED';
        docNumber = `SO-2026-00${nn}`;
      } else if (i % 2 === 0) {
        lifecycleStatus = 'CONFIRMED';
        confirmationStatus = 'COMPLETED';
        docNumber = `SO-2026-00${nn}`;
      }

      const itemA = i % 2 === 0 ? 'item-49' : 'item-50';
      const itemB = i % 3 === 0 ? 'item-55' : 'item-52';
      const qtyA = String((i % 5) + 2);
      const qtyB = String((i % 3) + 1);
      const sA = seedItemSummary(itemA);
      const sB = seedItemSummary(itemB);
      const pA = computeUnitPriceFromSummary('SALES', sA, sA.defaultUomId, currencyCode);
      const pB = computeUnitPriceFromSummary('SALES', sB, sB.defaultUomId, currencyCode);
      const eA = makeOrderLineEvidence(itemA, sA.defaultUomId, qtyA, pA, '0', '25', currencyCode);
      const eB = makeOrderLineEvidence(itemB, sB.defaultUomId, qtyB, pB, '0', '0', currencyCode);
      lines = [
        {
          id: `sol-${nn}-1`,
          clientLineId: `cl-sol-${nn}-1`,
          itemId: itemA,
          itemCompanyProfileId: fakeItemProfileId(itemA),
          printLineNumber: 1,
          descriptionSnapshot: itemName(sA, 'en'),
          uomId: sA.defaultUomId,
          uomLabel: uomLabelOf(sA.defaultUomId),
          orderedQuantity: qtyA,
          allocatedQuantity: lifecycleStatus === 'CONFIRMED' || lifecycleStatus === 'CLOSED' ? qtyA : '0',
          fulfilledQuantity: lifecycleStatus === 'CLOSED' ? qtyA : '0',
          invoicedQuantity: lifecycleStatus === 'CLOSED' ? qtyA : '0',
          cancelledQuantity: lifecycleStatus === 'CANCELLED' ? qtyA : '0',
          unitPrice: pA,
          discountTotal: eA.ev.discountTotal,
          chargeTotal: eA.ev.chargeTotal,
          taxTotal: eA.ev.taxTotal,
          lineTotal: eA.ev.lineTotal,
          taxSnapshot: eA.ev.taxSnapshot,
          itemLabel: itemLabelOf(sA),
        },
        {
          id: `sol-${nn}-2`,
          clientLineId: `cl-sol-${nn}-2`,
          itemId: itemB,
          itemCompanyProfileId: fakeItemProfileId(itemB),
          printLineNumber: 2,
          descriptionSnapshot: itemName(sB, 'en'),
          uomId: sB.defaultUomId,
          uomLabel: uomLabelOf(sB.defaultUomId),
          orderedQuantity: qtyB,
          allocatedQuantity: lifecycleStatus === 'CONFIRMED' || lifecycleStatus === 'CLOSED' ? qtyB : '0',
          fulfilledQuantity: lifecycleStatus === 'CLOSED' ? qtyB : '0',
          invoicedQuantity: lifecycleStatus === 'CLOSED' ? qtyB : '0',
          cancelledQuantity: lifecycleStatus === 'CANCELLED' ? qtyB : '0',
          unitPrice: pB,
          discountTotal: eB.ev.discountTotal,
          chargeTotal: eB.ev.chargeTotal,
          taxTotal: eB.ev.taxTotal,
          lineTotal: eB.ev.lineTotal,
          taxSnapshot: eB.ev.taxSnapshot,
          itemLabel: itemLabelOf(sB),
        },
      ];
    }

    const orderCurrency = i === 1 && qt08 ? qt08.currencyCode : i === 2 ? 'USD' : currencyCode;
    const totals = toTotalsSnapshot(totalsEvidence(lines, currencyDecimals(orderCurrency)), orderCurrency);
    const contacts = CONTACTS_BY_PARTY[chosenCust.partyId] ?? [];
    const reasonHistory: ReasonHistoryEntry[] = [];
    if (holdStatus === 'HELD') {
      reasonHistory.push({
        action: 'HOLD',
        reasonCode: 'CREDIT_REVIEW',
        reasonNote: 'Awaiting finance credit limit clearance.',
        actorUserId: FAKE_CURRENT_USER_ID,
        at: shiftIso(-(20 - i)),
      });
    }
    if (lifecycleStatus === 'CANCELLED') {
      reasonHistory.push({
        action: 'CANCEL',
        reasonCode: 'CUSTOMER_REQUEST',
        reasonNote: 'Cancelled at customer request.',
        actorUserId: FAKE_CURRENT_USER_ID,
        at: shiftIso(-(18 - i)),
      });
    }

    result.push({
      id,
      version: lifecycleStatus === 'DRAFT' ? 1 : 2,
      companyId: 'c1',
      branchId: 'b1',
      partyId: chosenCust.partyId,
      contactPartyId: contacts[0]?.contactPartyId ?? null,
      currencyCode: orderCurrency,
      businessDate,
      lifecycleStatus,
      documentNumber: docNumber,
      draftReference: `REF-SO-${nn}`,
      grandTotal: totals.grandTotal,
      partySnapshot: { id: chosenCust.partyId, displayName: chosenCust.en },
      createdAt,
      updatedAt: shiftIso(-(22 - i)),
      extensionValues: {},
      confirmationStatus,
      holdStatus,
      fulfillmentStatus:
        lifecycleStatus === 'CLOSED' ? 'COMPLETED' : lifecycleStatus === 'CONFIRMED' ? 'NOT_STARTED' : 'NONE',
      billingStatus:
        lifecycleStatus === 'CLOSED' ? 'INVOICED' : lifecycleStatus === 'CONFIRMED' ? 'NOT_INVOICED' : 'NONE',
      sourceQuotationId,
      sourceQuotationRevisionId,
      termsSnapshot: seedTermsSnapshot('SALES'),
      totalsSnapshot: totals,
      lines,
      reasonHistory,
    });
  }

  return result;
}

function buildSeedPurchaseOrders(): PurchaseOrderDetail[] {
  const result: PurchaseOrderDetail[] = [];

  for (let i = 1; i <= 14; i += 1) {
    const nn = String(i).padStart(2, '0');
    const id = `po-${nn}`;
    const sup =
      i === 7
        ? SUPPLIER_SEEDS[4] // Fresh Valley Beverages (delivery fails on confirm)
        : SUPPLIER_SEEDS[(i - 1) % SUPPLIER_SEEDS.length];
    const account = sup.accounts[0];
    const currencyCode = i === 8 ? 'USD' : account.currencyCode;
    const node = RECEIVING_NODES[(i - 1) % RECEIVING_NODES.length];
    const createdAt = shiftIso(-(20 - i));
    const businessDate = createdAt.slice(0, 10);
    const expectedDate = shiftYmd(10 + i);

    let lifecycleStatus: PurchaseOrder['lifecycleStatus'] = 'DRAFT';
    let approvalStatus: ApprovalStatus = 'NOT_REQUIRED';
    let approvalReady = false;
    let dispatchStatus: DispatchStatus = 'NOT_REQUESTED';
    let delivery: DeliveryInfo | null = null;
    let docNumber: string | null = null;
    let createdBy = 'usr-2';
    let submittedBy: string | null = null;
    let submittedAt: string | null = null;
    let sourcePurchaseQuotationId: string | null = null;
    const reasonHistory: ReasonHistoryEntry[] = [];

    if (i === 1) {
      approvalStatus = 'PENDING';
      submittedBy = 'usr-3';
      submittedAt = shiftIso(-(19 - i));
    } else if (i === 2) {
      approvalStatus = 'PENDING';
      createdBy = 'usr-4';
      submittedBy = 'usr-2';
      submittedAt = shiftIso(-(19 - i));
    } else if (i === 3) {
      approvalStatus = 'APPROVED';
      approvalReady = true;
      submittedBy = 'usr-3';
      submittedAt = shiftIso(-(19 - i));
    } else if (i === 4) {
      lifecycleStatus = 'CONFIRMED';
      approvalStatus = 'APPROVED';
      approvalReady = true;
      dispatchStatus = 'FAILED';
      docNumber = 'PO-2026-0004';
      submittedBy = 'usr-3';
      submittedAt = shiftIso(-(18 - i));
      delivery = {
        status: 'FAILED',
        attemptCount: 1,
        lastErrorCode: 'TRADE.PURCHASE_ORDER.DELIVERY_PDF_FAILED',
        nextAttemptAt: null,
      };
    } else if (i === 5) {
      lifecycleStatus = 'CONFIRMED';
      approvalStatus = 'APPROVED';
      approvalReady = true;
      dispatchStatus = 'FAILED';
      docNumber = 'PO-2026-0005';
      submittedBy = 'usr-3';
      submittedAt = shiftIso(-(18 - i));
      delivery = {
        status: 'FAILED',
        attemptCount: 1,
        lastErrorCode: 'TRADE.PURCHASE_ORDER.DELIVERY_EMAIL_FAILED',
        nextAttemptAt: null,
      };
    } else if (i === 6) {
      approvalStatus = 'NOT_REQUIRED';
      approvalReady = false;
    } else if (i === 7) {
      approvalStatus = 'NOT_REQUIRED';
      approvalReady = false;
    } else if (i === 8) {
      approvalStatus = 'NOT_REQUIRED';
      approvalReady = true;
      submittedBy = 'usr-3';
      submittedAt = shiftIso(-(18 - i));
    } else if (i === 9) {
      approvalStatus = 'REJECTED';
      submittedBy = 'usr-3';
      submittedAt = shiftIso(-(18 - i));
      reasonHistory.push({
        action: 'PO_REJECT',
        reasonCode: 'BUDGET',
        reasonNote: 'Exceeds Q4 department budget.',
        actorUserId: 'usr-4',
        at: shiftIso(-(17 - i)),
      });
    } else if (i === 10) {
      approvalStatus = 'WITHDRAWN';
      submittedBy = FAKE_CURRENT_USER_ID;
      submittedAt = shiftIso(-(18 - i));
    } else if (i === 11) {
      approvalStatus = 'PENDING';
      submittedBy = FAKE_CURRENT_USER_ID;
      submittedAt = shiftIso(-(18 - i));
    } else if (i === 12) {
      lifecycleStatus = 'CONFIRMED';
      approvalStatus = 'APPROVED';
      approvalReady = true;
      dispatchStatus = 'SENT';
      docNumber = 'PO-2026-0012';
      submittedBy = 'usr-3';
      submittedAt = shiftIso(-(18 - i));
      sourcePurchaseQuotationId = 'pq-07';
      delivery = {
        status: 'COMPLETED',
        attemptCount: 1,
        lastErrorCode: null,
        nextAttemptAt: null,
      };
    } else if (i === 13) {
      lifecycleStatus = 'CONFIRMED';
      approvalStatus = 'NOT_REQUIRED';
      approvalReady = true;
      dispatchStatus = 'REQUESTED';
      docNumber = 'PO-2026-0013';
      submittedBy = 'usr-3';
      submittedAt = shiftIso(-(18 - i));
      delivery = {
        status: 'PDF_REQUESTED',
        attemptCount: 1,
        lastErrorCode: null,
        nextAttemptAt: null,
      };
    } else if (i === 14) {
      lifecycleStatus = 'CANCELLED';
      approvalStatus = 'WITHDRAWN';
      reasonHistory.push({
        action: 'PO_CANCEL',
        reasonCode: 'DATA_ERROR',
        reasonNote: 'Superseded by revised order.',
        actorUserId: FAKE_CURRENT_USER_ID,
        at: shiftIso(-(15 - i)),
      });
    }

    let lines: PurchaseOrderLine[] = [];
    if (i === 1 || i === 2 || i === 6) {
      // Matches mockup PO totals (879510 + 109440 = 988950 >= 100000).
      const s1 = seedItemSummary('item-49');
      const s2 = seedItemSummary('item-50');
      const ev1 = lineEvidence(
        {
          quantity: '50',
          unitPrice: '15430',
          discountTotal: '0',
          chargeTotal: '0',
          tax: { category: 'STANDARD', rateBps: 1400 },
        },
        currencyCode,
      );
      const ev2 = lineEvidence(
        {
          quantity: '200',
          unitPrice: '480',
          discountTotal: '0',
          chargeTotal: '0',
          tax: { category: 'STANDARD', rateBps: 1400 },
        },
        currencyCode,
      );
      lines = [
        {
          id: `pol-${nn}-1`,
          clientLineId: `cl-pol-${nn}-1`,
          itemId: 'item-49',
          itemCompanyProfileId: fakeItemProfileId('item-49'),
          printLineNumber: 1,
          descriptionSnapshot: itemName(s1, 'en'),
          uomId: 'uom-pcs',
          uomLabel: uomLabelOf('uom-pcs'),
          orderedQuantity: '50',
          receivedQuantity: '0',
          cancelledQuantity: '0',
          unitPrice: '15430',
          chargeTotal: ev1.chargeTotal,
          taxTotal: ev1.taxTotal,
          lineTotal: ev1.lineTotal,
          taxSnapshot: ev1.taxSnapshot,
          expectedDate,
          receivingNodeId: node.id,
          itemLabel: itemLabelOf(s1),
        },
        {
          id: `pol-${nn}-2`,
          clientLineId: `cl-pol-${nn}-2`,
          itemId: 'item-50',
          itemCompanyProfileId: fakeItemProfileId('item-50'),
          printLineNumber: 2,
          descriptionSnapshot: itemName(s2, 'en'),
          uomId: 'uom-pcs',
          uomLabel: uomLabelOf('uom-pcs'),
          orderedQuantity: '200',
          receivedQuantity: '0',
          cancelledQuantity: '0',
          unitPrice: '480',
          chargeTotal: ev2.chargeTotal,
          taxTotal: ev2.taxTotal,
          lineTotal: ev2.lineTotal,
          taxSnapshot: ev2.taxSnapshot,
          expectedDate,
          receivingNodeId: node.id,
          itemLabel: itemLabelOf(s2),
        },
      ];
    } else {
      const s1 = seedItemSummary('item-49');
      const s2 = seedItemSummary('item-55');
      const u1 = s1.defaultPurchaseUomId || s1.baseUomId;
      const u2 = s2.defaultPurchaseUomId || s2.baseUomId;
      const p1 = computeUnitPriceFromSummary('PURCHASE', s1, u1, currencyCode);
      const p2 = computeUnitPriceFromSummary('PURCHASE', s2, u2, currencyCode);
      const ev1 = lineEvidence(
        {
          quantity: '4',
          unitPrice: p1,
          discountTotal: '0',
          chargeTotal: '0',
          taxDefault: s1.purchaseTaxDefault,
        },
        currencyCode,
      );
      const ev2 = lineEvidence(
        {
          quantity: '3',
          unitPrice: p2,
          discountTotal: '0',
          chargeTotal: '0',
          taxDefault: s2.purchaseTaxDefault,
        },
        currencyCode,
      );
      lines = [
        {
          id: `pol-${nn}-1`,
          clientLineId: `cl-pol-${nn}-1`,
          itemId: s1.id,
          itemCompanyProfileId: fakeItemProfileId(s1.id),
          printLineNumber: 1,
          descriptionSnapshot: itemName(s1, 'en'),
          uomId: u1,
          uomLabel: uomLabelOf(u1),
          orderedQuantity: '4',
          receivedQuantity: '0',
          cancelledQuantity: lifecycleStatus === 'CANCELLED' ? '4' : '0',
          unitPrice: p1,
          chargeTotal: ev1.chargeTotal,
          taxTotal: ev1.taxTotal,
          lineTotal: ev1.lineTotal,
          taxSnapshot: ev1.taxSnapshot,
          expectedDate,
          receivingNodeId: node.id,
          itemLabel: itemLabelOf(s1),
        },
        {
          id: `pol-${nn}-2`,
          clientLineId: `cl-pol-${nn}-2`,
          itemId: s2.id,
          itemCompanyProfileId: fakeItemProfileId(s2.id),
          printLineNumber: 2,
          descriptionSnapshot: itemName(s2, 'en'),
          uomId: u2,
          uomLabel: uomLabelOf(u2),
          orderedQuantity: '3',
          receivedQuantity: '0',
          cancelledQuantity: lifecycleStatus === 'CANCELLED' ? '3' : '0',
          unitPrice: p2,
          chargeTotal: ev2.chargeTotal,
          taxTotal: ev2.taxTotal,
          lineTotal: ev2.lineTotal,
          taxSnapshot: ev2.taxSnapshot,
          expectedDate,
          receivingNodeId: node.id,
          itemLabel: itemLabelOf(s2),
        },
      ];
    }

    const totals = toTotalsSnapshot(totalsEvidence(lines, currencyDecimals(currencyCode)), currencyCode);

    result.push({
      id,
      version: lifecycleStatus === 'DRAFT' ? 1 : 2,
      companyId: 'c1',
      branchId: 'b1',
      partyId: sup.partyId,
      contactPartyId: null,
      currencyCode,
      businessDate,
      lifecycleStatus,
      documentNumber: docNumber,
      draftReference: `REF-PO-${nn}`,
      grandTotal: totals.grandTotal,
      partySnapshot: { id: sup.partyId, displayName: sup.en },
      createdAt,
      updatedAt: shiftIso(-(18 - i)),
      extensionValues: {},
      approvalStatus,
      supplierAccountId: account.id,
      receivingNodeId: node.id,
      dispatchStatus,
      fulfillmentStatus: lifecycleStatus === 'CONFIRMED' ? 'NOT_RECEIVED' : 'NONE',
      billingStatus: lifecycleStatus === 'CONFIRMED' ? 'NOT_BILLED' : 'NONE',
      termsSnapshot: seedTermsSnapshot('PURCHASE'),
      totalsSnapshot: totals,
      sourcePurchaseQuotationId,
      createdBy,
      submittedBy,
      submittedAt,
      lines,
      approvalReady,
      delivery,
      reasonHistory,
    });
  }

  return result;
}

function buildSeedPurchaseQuotations(): PurchaseQuotationDetail[] {
  const result: PurchaseQuotationDetail[] = [];

  for (let i = 1; i <= 10; i += 1) {
    const nn = String(i).padStart(2, '0');
    const id = `pq-${nn}`;
    const sup = SUPPLIER_SEEDS[(i - 1) % SUPPLIER_SEEDS.length];
    const currencyCode = i === 8 ? 'USD' : sup.accounts[0].currencyCode;
    const createdAt = shiftIso(-(16 - i));
    const businessDate = createdAt.slice(0, 10);
    const validUntil = shiftYmd(14 + i);

    let lifecycleStatus: PurchaseQuotation['lifecycleStatus'] = 'DRAFT';
    let docNumber: string | null = null;
    let finalizedAt: string | null = null;
    let convertedPurchaseOrderId: string | null = null;
    const reasonHistory: ReasonHistoryEntry[] = [];

    if (i >= 4 && i <= 6) {
      lifecycleStatus = 'ISSUED';
      docNumber = `PQ-2026-00${nn}`;
      finalizedAt = shiftIso(-(15 - i));
    } else if (i === 7) {
      lifecycleStatus = 'CONVERTED';
      docNumber = 'PQ-2026-0007';
      finalizedAt = shiftIso(-8);
      convertedPurchaseOrderId = 'po-12';
    } else if (i === 8) {
      lifecycleStatus = 'ISSUED';
      docNumber = 'PQ-2026-0008';
      finalizedAt = shiftIso(-7);
    } else if (i === 9 || i === 10) {
      lifecycleStatus = 'CANCELLED';
      docNumber = i === 10 ? `PQ-2026-00${nn}` : null;
      reasonHistory.push({
        action: 'PQ_CANCEL',
        reasonCode: 'OTHER',
        reasonNote: 'Supplier unable to meet requested lead time.',
        actorUserId: FAKE_CURRENT_USER_ID,
        at: shiftIso(-(12 - i)),
      });
    }

    const s1 = seedItemSummary('item-49');
    const s2 = seedItemSummary('item-52');
    const u1 = s1.defaultPurchaseUomId || s1.baseUomId;
    const u2 = s2.defaultPurchaseUomId || s2.baseUomId;
    const p1 = computeUnitPriceFromSummary('PURCHASE', s1, u1, currencyCode);
    const p2 = computeUnitPriceFromSummary('PURCHASE', s2, u2, currencyCode);
    const q1 = String(i + 2);
    const q2 = String((i % 3) + 1);
    const dp = currencyDecimals(currencyCode);
    const lt1 = round(mul(q1, p1, 8), dp);
    const lt2 = round(mul(q2, p2, 8), dp);

    const lines: PurchaseQuotationLine[] = [
      {
        id: `pql-${nn}-1`,
        clientLineId: `cl-pql-${nn}-1`,
        itemId: s1.id,
        itemCompanyProfileId: fakeItemProfileId(s1.id),
        printLineNumber: 1,
        quantity: q1,
        uomId: u1,
        uomLabel: uomLabelOf(u1),
        unitPrice: p1,
        lineTotal: lt1,
        descriptionSnapshot: itemName(s1, 'en'),
        itemLabel: itemLabelOf(s1),
      },
      {
        id: `pql-${nn}-2`,
        clientLineId: `cl-pql-${nn}-2`,
        itemId: s2.id,
        itemCompanyProfileId: fakeItemProfileId(s2.id),
        printLineNumber: 2,
        quantity: q2,
        uomId: u2,
        uomLabel: uomLabelOf(u2),
        unitPrice: p2,
        lineTotal: lt2,
        descriptionSnapshot: itemName(s2, 'en'),
        itemLabel: itemLabelOf(s2),
      },
    ];

    const sumLine = add(lt1, lt2);
    const totals: TotalsSnapshot = {
      subtotal: sumLine,
      discountTotal: '0',
      chargeTotal: '0',
      taxTotal: '0',
      roundingTotal: '0',
      grandTotal: round(sumLine, dp),
      amountPaid: '0',
      amountDue: round(sumLine, dp),
      currencyDecimalPlaces: dp,
    };

    result.push({
      id,
      version: lifecycleStatus === 'DRAFT' ? 1 : 2,
      companyId: 'c1',
      branchId: 'b1',
      partyId: sup.partyId,
      currencyCode,
      businessDate,
      lifecycleStatus,
      documentNumber: docNumber,
      partySnapshot: { id: sup.partyId, displayName: sup.en },
      createdAt,
      updatedAt: shiftIso(-(14 - i)),
      reference: `SUP-REF-${nn}`,
      notes: i % 2 === 0 ? 'FOB warehouse delivery included.' : null,
      validUntil,
      finalizedAt,
      convertedPurchaseOrderId,
      termsSnapshot: seedTermsSnapshot('PURCHASE'),
      totalsSnapshot: totals,
      lines,
      reasonHistory,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Module-level in-memory store
// ---------------------------------------------------------------------------

const seededQuotations = buildSeedQuotations();
const quotationsStore: QuotationDetail[] = seededQuotations;
const salesOrdersStore: SalesOrderDetail[] = buildSeedSalesOrders(seededQuotations);
const purchaseOrdersStore: PurchaseOrderDetail[] = buildSeedPurchaseOrders();
const purchaseQuotationsStore: PurchaseQuotationDetail[] = buildSeedPurchaseQuotations();

const renderJobsStore = new Map<string, StoredRenderJob>();

let nextQtSeq = 100;
let nextSoSeq = 100;
let nextPoSeq = 100;
let nextPqSeq = 100;

function nextDocumentNumber(kind: DocumentKind): string {
  switch (kind) {
    case 'quotation':
      nextQtSeq += 1;
      return `QT-2026-${String(nextQtSeq).padStart(4, '0')}`;
    case 'sales-order':
      nextSoSeq += 1;
      return `SO-2026-${String(nextSoSeq).padStart(4, '0')}`;
    case 'purchase-order':
      nextPoSeq += 1;
      return `PO-2026-${String(nextPoSeq).padStart(4, '0')}`;
    case 'purchase-quotation':
      nextPqSeq += 1;
      return `PQ-2026-${String(nextPqSeq).padStart(4, '0')}`;
  }
}

function findQuotation(id: string): QuotationDetail {
  const found = quotationsStore.find((q) => q.id === id);
  if (!found) throw new ApiError(404, 'TRADE.QUOTE.NOT_FOUND');
  return found;
}

function findSalesOrder(id: string): SalesOrderDetail {
  const found = salesOrdersStore.find((o) => o.id === id);
  if (!found) throw new ApiError(404, 'TRADE.SALES_ORDER.SOURCE_NOT_FOUND');
  return found;
}

function findPurchaseOrder(id: string): PurchaseOrderDetail {
  const found = purchaseOrdersStore.find((o) => o.id === id);
  if (!found) throw new ApiError(404, 'TRADE.PURCHASE_ORDER.NOT_FOUND');
  return found;
}

function findPurchaseQuotation(id: string): PurchaseQuotationDetail {
  const found = purchaseQuotationsStore.find((o) => o.id === id);
  if (!found) throw new ApiError(404, 'TRADE.PURCHASE_QUOTATION.NOT_FOUND');
  return found;
}

function listStoreForKind(kind: DocumentKind): AnyDocumentDetail[] {
  switch (kind) {
    case 'quotation':
      return quotationsStore;
    case 'sales-order':
      return salesOrdersStore;
    case 'purchase-order':
      return purchaseOrdersStore;
    case 'purchase-quotation':
      return purchaseQuotationsStore;
  }
}

function projectSummaryForKind<K extends DocumentKind>(kind: K, detail: AnyDocumentDetail): DocumentByKind[K] {
  if (kind === 'quotation') {
    const { revisions: _revs, currentLines: _lines, reasonHistory: _rh, ...header } = detail as QuotationDetail;
    return projectQuotation(header) as DocumentByKind[K];
  }
  if (kind === 'sales-order') {
    const { lines: _lines, reasonHistory: _rh, ...header } = detail as SalesOrderDetail;
    const copy = clone(header);
    copy.partySnapshot = projectPartySnapshot(copy.partySnapshot);
    return copy as DocumentByKind[K];
  }
  if (kind === 'purchase-order') {
    const {
      lines: _lines,
      approvalReady: _ar,
      delivery: _del,
      reasonHistory: _rh,
      ...header
    } = detail as PurchaseOrderDetail;
    const copy = clone(header);
    copy.partySnapshot = projectPartySnapshot(copy.partySnapshot);
    return copy as DocumentByKind[K];
  }
  const { lines: _lines, reasonHistory: _rh, ...header } = detail as PurchaseQuotationDetail;
  const copy = clone(header);
  copy.partySnapshot = projectPartySnapshot(copy.partySnapshot);
  return copy as DocumentByKind[K];
}

function projectDetailForKind<K extends DocumentKind>(kind: K, detail: AnyDocumentDetail): DocumentDetailByKind[K] {
  switch (kind) {
    case 'quotation':
      return projectQuotationDetail(detail as QuotationDetail) as DocumentDetailByKind[K];
    case 'sales-order':
      return projectOrderDetail(detail as SalesOrderDetail) as DocumentDetailByKind[K];
    case 'purchase-order':
      return projectOrderDetail(detail as PurchaseOrderDetail) as DocumentDetailByKind[K];
    case 'purchase-quotation':
      return projectPurchaseQuotationDetail(detail as PurchaseQuotationDetail) as DocumentDetailByKind[K];
  }
}

// ---------------------------------------------------------------------------
// List filtering, sorting, counting
// ---------------------------------------------------------------------------

function matchesListFilters(kind: DocumentKind, doc: AnyDocumentDetail, filters: DocumentStatusCountFilters): boolean {
  if (filters.partyId && doc.partyId !== filters.partyId) {
    return false;
  }
  if (filters.currencyCode && doc.currencyCode !== filters.currencyCode) {
    return false;
  }
  if (filters.crmOpportunityId) {
    if (kind !== 'quotation') return false;
    if ((doc as QuotationDetail).sourceCrmOpportunityId !== filters.crmOpportunityId) return false;
  }
  if (filters.businessDateFrom && doc.businessDate < filters.businessDateFrom) {
    return false;
  }
  if (filters.businessDateTo && doc.businessDate > filters.businessDateTo) {
    return false;
  }

  const needle = filters.search?.trim().toLowerCase() ?? '';
  if (needle) {
    const numMatch = doc.documentNumber?.toLowerCase().includes(needle) ?? false;
    const refMatch = doc.draftReference?.toLowerCase().includes(needle) ?? false;
    const pqRefMatch =
      kind === 'purchase-quotation' &&
      ((doc as PurchaseQuotationDetail).reference?.toLowerCase().includes(needle) ?? false);
    const partyMatch = partySearchText(doc.partyId, doc.partySnapshot.displayName).includes(needle);
    if (!numMatch && !refMatch && !pqRefMatch && !partyMatch) {
      return false;
    }
  }

  return true;
}

function filterAndSortDocuments<K extends DocumentKind>(
  kind: K,
  query: Omit<ListQuery, 'page' | 'limit'>,
): AnyDocumentDetail[] {
  const { status, sort, order, ...filters } = query;
  const matched = listStoreForKind(kind).filter((doc) => {
    if (status && status !== 'ALL' && doc.lifecycleStatus !== status) {
      return false;
    }
    return matchesListFilters(kind, doc, filters);
  });

  const dir = order === 'asc' ? 1 : -1;
  const sortField = sort || 'createdAt';

  return matched.slice().sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'documentNumber':
        comparison = (a.documentNumber ?? '').localeCompare(b.documentNumber ?? '');
        break;
      case 'businessDate':
        comparison = a.businessDate.localeCompare(b.businessDate);
        break;
      case 'grandTotal':
        comparison = cmp(documentGrandTotal(a) ?? '0', documentGrandTotal(b) ?? '0');
        break;
      case 'updatedAt':
        comparison = a.updatedAt.localeCompare(b.updatedAt);
        break;
      case 'partyName':
        comparison = localizedPartyName(a.partyId, a.partySnapshot.displayName).localeCompare(
          localizedPartyName(b.partyId, b.partySnapshot.displayName),
        );
        break;
      default:
        comparison = a.createdAt.localeCompare(b.createdAt);
        break;
    }
    if (comparison !== 0) return comparison * dir;
    return b.id.localeCompare(a.id);
  });
}

// ---------------------------------------------------------------------------
// List, counts, detail, delete (shared across all 4 kinds)
// ---------------------------------------------------------------------------

// GET /api/tenant/trade/v1/<segment>?page&limit&status&search&partyId&currencyCode&crmOpportunityId&businessDateFrom&businessDateTo&sort&order
export async function fakeListDocuments<K extends DocumentKind>(
  kind: K,
  query: ListQuery,
): Promise<Page<DocumentByKind[K]>> {
  await fakeDelay();
  const page = Number.isInteger(query.page) && query.page >= 1 ? query.page : 1;
  const limit = Number.isInteger(query.limit) && query.limit >= 1 && query.limit <= 100 ? query.limit : 25;

  const sorted = filterAndSortDocuments(kind, query);
  const start = (page - 1) * limit;
  const items = sorted.slice(start, start + limit).map((doc) => projectSummaryForKind(kind, doc));

  return {
    items,
    total: sorted.length,
    page,
    limit,
  };
}

// POST /api/tenant/trade/v1/<segment>/status-counts (body: search, partyId, currencyCode, crmOpportunityId, businessDateFrom, businessDateTo)
export async function fakeStatusCounts(
  kind: DocumentKind,
  filters: DocumentStatusCountFilters = {},
): Promise<DocumentStatusCounts> {
  await fakeDelay();
  const byStatus: Record<string, number> = {};
  for (const step of KIND_CONFIG[kind].statuses) {
    byStatus[step.value] = 0;
  }

  let total = 0;
  for (const doc of listStoreForKind(kind)) {
    if (!matchesListFilters(kind, doc, filters)) continue;
    total += 1;
    byStatus[doc.lifecycleStatus] = (byStatus[doc.lifecycleStatus] ?? 0) + 1;
  }

  return { total, byStatus };
}

// GET /api/tenant/trade/v1/<segment>/:id
export async function fakeGetDocument<K extends DocumentKind>(
  kind: K,
  id: string,
): Promise<DocumentDetailByKind[K]> {
  await fakeDelay();
  switch (kind) {
    case 'quotation':
      return projectDetailForKind(kind, findQuotation(id));
    case 'sales-order':
      return projectDetailForKind(kind, findSalesOrder(id));
    case 'purchase-order':
      return projectDetailForKind(kind, findPurchaseOrder(id));
    case 'purchase-quotation':
      return projectDetailForKind(kind, findPurchaseQuotation(id));
  }
}

// DELETE /api/tenant/trade/v1/<segment>/:id (If-Match, x-idempotency-key). Mirrors trade-app delete handlers: an
// unknown id gives the kind's own 404 (the find step); TRADE.DOCUMENT.NOT_FOUND is only the replay of a delete
// whose header is no longer in scope. A non-deletable document gives 409 TRADE.DOCUMENT.DELETE_NOT_ALLOWED.
export async function fakeDeleteDocument(
  kind: DocumentKind,
  id: string,
  expectedVersion: number,
  _idempotencyKey?: string,
): Promise<void> {
  await fakeDelay();
  const store = listStoreForKind(kind);
  const idx = store.findIndex((d) => d.id === id);
  if (idx === -1) {
    switch (kind) {
      case 'quotation':
        throw new ApiError(404, 'TRADE.QUOTE.NOT_FOUND');
      case 'sales-order':
        throw new ApiError(404, 'TRADE.SALES_ORDER.SOURCE_NOT_FOUND');
      case 'purchase-order':
        throw new ApiError(404, 'TRADE.PURCHASE_ORDER.NOT_FOUND');
      case 'purchase-quotation':
        throw new ApiError(404, 'TRADE.PURCHASE_QUOTATION.NOT_FOUND');
    }
  }

  const doc = store[idx];
  assertValidVersion(doc.version, expectedVersion);

  let deletable = false;
  switch (kind) {
    case 'quotation':
      deletable = doc.lifecycleStatus === 'DRAFT' && doc.documentNumber === null;
      break;
    case 'sales-order':
      deletable =
        doc.lifecycleStatus === 'DRAFT' &&
        (doc as SalesOrderDetail).confirmationStatus === 'NOT_STARTED';
      break;
    case 'purchase-order': {
      const po = doc as PurchaseOrderDetail;
      deletable =
        po.lifecycleStatus === 'DRAFT' &&
        po.approvalStatus !== 'PENDING' &&
        po.sourcePurchaseQuotationId === null;
      break;
    }
    case 'purchase-quotation':
      deletable = doc.lifecycleStatus === 'DRAFT';
      break;
  }

  if (!deletable) {
    throw new ApiError(409, 'TRADE.DOCUMENT.DELETE_NOT_ALLOWED');
  }

  store.splice(idx, 1);
}

// ---------------------------------------------------------------------------
// Pricing & discount policy
// ---------------------------------------------------------------------------

// GET /api/tenant/trade/v1/quotations/discount-policy
export async function fakeGetDiscountPolicy(): Promise<DiscountPolicy> {
  await fakeDelay();
  return clone(DISCOUNT_POLICY);
}

async function computeQuotationPreviewInternal(
  body: QuotationPricingPreviewBody,
  enforceLimits: boolean,
): Promise<QuotationPricingPreview> {
  const { companyId } = readActiveScope();
  const currencyCode = body.currencyCode;
  const dp = currencyDecimals(currencyCode);
  const pricing = body.pricing ?? { mode: 'NONE' };

  if (enforceLimits && pricing.mode === 'DISCOUNT') {
    validateDiscountReason(pricing);
  }

  const lineOutputs: QuotationPricingPreviewLine[] = [];
  const rawGrosses: Dec[] = [];
  let totalSubtotal: Dec = '0';

  for (const line of body.lines) {
    assertPositiveDecimal(line.quantity);
    const summary = await fetchItemSummary(line.itemId, companyId);
    const unitPrice = computeUnitPriceFromSummary('SALES', summary, line.uomId, currencyCode);
    const lineSubtotal = mul(line.quantity, unitPrice, dp);
    const maxDiscountPercent = DISCOUNT_POLICY.limit.maxPercent;
    const maxDiscountAmount = mul(lineSubtotal, mul(maxDiscountPercent, '0.01', 8), dp);

    rawGrosses.push(lineSubtotal);
    totalSubtotal = add(totalSubtotal, lineSubtotal);

    let discountTotal: Dec = '0';
    if (pricing.mode === 'PROMOTIONS') {
      discountTotal = cmp(line.quantity, '5') >= 0 ? mul(lineSubtotal, '0.05', dp) : '0';
    } else if (pricing.mode === 'DISCOUNT' && (pricing.scope ?? 'LINE') === 'LINE' && line.discount) {
      if (line.discount.type === 'PERCENT') {
        if (enforceLimits && cmp(line.discount.value, maxDiscountPercent) > 0) {
          throw new ApiError(422, 'TRADE.QUOTE.DISCOUNT_EXCEEDS_ALLOWED', {
            clientLineId: [line.clientLineId],
            maxDiscountPercent: [maxDiscountPercent],
          });
        }
        discountTotal = mul(lineSubtotal, mul(line.discount.value, '0.01', 8), dp);
      } else {
        if (enforceLimits && cmp(line.discount.value, maxDiscountAmount) > 0) {
          throw new ApiError(422, 'TRADE.QUOTE.DISCOUNT_EXCEEDS_ALLOWED', {
            clientLineId: [line.clientLineId],
            maxDiscountPercent: [maxDiscountPercent],
          });
        }
        discountTotal = round(line.discount.value, dp);
      }
    }

    lineOutputs.push({
      clientLineId: line.clientLineId,
      unitPrice,
      discountTotal,
      lineTotal: sub(lineSubtotal, discountTotal),
      maxDiscountAmount,
      maxDiscountPercent,
    });
  }

  if (pricing.mode === 'DISCOUNT' && pricing.scope === 'DOCUMENT' && lineOutputs.length > 0) {
    const maxDocDiscount = mul(totalSubtotal, mul(DISCOUNT_POLICY.limit.maxPercent, '0.01', 8), dp);
    const rawValue = pricing.value ?? '0';
    let docDiscount: Dec = '0';

    if (pricing.type === 'PERCENT') {
      if (enforceLimits && cmp(rawValue, DISCOUNT_POLICY.limit.maxPercent) > 0) {
        throw new ApiError(422, 'TRADE.QUOTE.DISCOUNT_EXCEEDS_ALLOWED', {
          clientLineId: [lineOutputs[0].clientLineId],
          maxDiscountPercent: [DISCOUNT_POLICY.limit.maxPercent],
        });
      }
      docDiscount = mul(totalSubtotal, mul(rawValue, '0.01', 8), dp);
    } else {
      if (enforceLimits && cmp(rawValue, maxDocDiscount) > 0) {
        throw new ApiError(422, 'TRADE.QUOTE.DISCOUNT_EXCEEDS_ALLOWED', {
          clientLineId: [lineOutputs[0].clientLineId],
          maxDiscountPercent: [DISCOUNT_POLICY.limit.maxPercent],
        });
      }
      docDiscount = round(rawValue, dp);
    }

    if (!isZero(totalSubtotal) && !isZero(docDiscount)) {
      let allocated: Dec = '0';
      for (let i = 0; i < lineOutputs.length; i += 1) {
        const isLast = i === lineOutputs.length - 1;
        const share = isLast
          ? sub(docDiscount, allocated)
          : round(mul(docDiscount, divRatio(rawGrosses[i], totalSubtotal), 8), dp);
        allocated = add(allocated, share);
        lineOutputs[i].discountTotal = share;
        lineOutputs[i].lineTotal = sub(rawGrosses[i], share);
      }
    }
  }

  const totals = quotationTotals(
    lineOutputs.map((l, idx) => ({
      quantity: body.lines[idx].quantity,
      unitPrice: l.unitPrice,
      discountTotal: l.discountTotal,
    })),
  );

  const fingerprint = stableHash({
    currencyCode,
    pricing,
    lines: lineOutputs.map((l, idx) => ({
      clientLineId: l.clientLineId,
      itemId: body.lines[idx].itemId,
      uomId: body.lines[idx].uomId,
      quantity: body.lines[idx].quantity,
      unitPrice: l.unitPrice,
      discountTotal: l.discountTotal,
    })),
    totals,
  });

  return {
    currencyDecimalPlaces: dp,
    lines: lineOutputs,
    totals,
    fingerprint,
  };
}

function divRatio(part: Dec, whole: Dec): Dec {
  if (isZero(whole)) return '0';
  // Scaled integer division in bigint to keep zero floating-point arithmetic.
  const scale = 10n ** 8n;
  const p = BigInt(mul(part, '100000000', 0));
  const w = BigInt(mul(whole, '100000000', 0));
  if (w === 0n) return '0';
  const ratioScaled = (p * scale) / w;
  const padded = ratioScaled.toString().padStart(9, '0');
  const split = padded.length - 8;
  return `${padded.slice(0, split)}.${padded.slice(split)}`;
}

// POST /api/tenant/trade/v1/quotations/pricing-preview
export async function fakePreviewQuotationPricing(
  body: QuotationPricingPreviewBody,
): Promise<QuotationPricingPreview> {
  await fakeDelay();
  const hasSvInst = body.lines.some((l) => l.itemId === 'item-51');
  if (hasSvInst && svInstPendingBump && !svInstPriceBumped) {
    svInstPriceBumped = true;
    svInstPendingBump = false;
  }

  const preview = await computeQuotationPreviewInternal(body, false);
  if (hasSvInst && !svInstPriceBumped) {
    svInstPendingBump = true;
  }
  return preview;
}

async function computeOrderPreviewInternal(
  kind: 'sales-order' | 'purchase-order',
  body: OrderPricingPreviewBody,
): Promise<OrderPreview> {
  const { companyId } = readActiveScope();
  const purpose = kind === 'sales-order' ? 'SALES' : 'PURCHASE';
  const dp = currencyDecimals(body.currencyCode);
  const sourceQt = body.sourceQuotationId ? quotationsStore.find((q) => q.id === body.sourceQuotationId) : undefined;
  const sourcePq = body.sourcePurchaseQuotationId
    ? purchaseQuotationsStore.find((pq) => pq.id === body.sourcePurchaseQuotationId)
    : undefined;

  const lines: OrderPreviewLine[] = [];
  const lineEvidences: LineEvidence[] = [];

  for (const line of body.lines) {
    assertPositiveDecimal(line.quantity);
    const summary = await fetchItemSummary(line.itemId, companyId);
    const rawTaxDefault = kind === 'sales-order' ? summary.salesTaxDefault : summary.purchaseTaxDefault;

    let unitPrice: Dec;
    if (line.unitPrice !== undefined && line.unitPrice !== null && isDecimal(line.unitPrice)) {
      unitPrice = line.unitPrice;
    } else if (sourceQt) {
      const matchedQl = sourceQt.currentLines.find(
        (ql) => ql.clientLineId === line.clientLineId || ql.discountSnapshot.itemId === line.itemId,
      );
      unitPrice = matchedQl
        ? matchedQl.unitPrice
        : computeUnitPriceFromSummary(purpose, summary, line.uomId, body.currencyCode);
    } else if (sourcePq) {
      const matchedPq = sourcePq.lines.find(
        (pql) => pql.clientLineId === line.clientLineId || pql.itemId === line.itemId,
      );
      unitPrice = matchedPq
        ? matchedPq.unitPrice
        : computeUnitPriceFromSummary(purpose, summary, line.uomId, body.currencyCode);
    } else {
      unitPrice = computeUnitPriceFromSummary(purpose, summary, line.uomId, body.currencyCode);
    }

    const discountTotal = kind === 'purchase-order' ? '0' : (line.discountTotal ?? '0');
    const chargeTotal = line.chargeTotal ?? '0';
    const financial = lineEvidence(
      {
        quantity: line.quantity,
        unitPrice,
        discountTotal,
        chargeTotal,
        tax: line.tax ?? null,
        taxDefault: rawTaxDefault,
      },
      body.currencyCode,
    );

    lineEvidences.push(financial);
    lines.push({
      clientLineId: line.clientLineId,
      unitPrice,
      taxDefault: toOrderPreviewTaxDefault(rawTaxDefault),
      financial,
    });
  }

  const totals = totalsEvidence(lineEvidences, dp);
  const fingerprint = stableHash({
    kind,
    currencyCode: body.currencyCode,
    lines: lines.map((l, idx) => ({
      clientLineId: l.clientLineId,
      itemId: body.lines[idx].itemId,
      uomId: body.lines[idx].uomId,
      quantity: body.lines[idx].quantity,
      unitPrice: l.unitPrice,
      discountTotal: l.financial.discountTotal,
      chargeTotal: l.financial.chargeTotal,
      tax: l.financial.taxSnapshot,
    })),
    totals,
  });

  return {
    currencyDecimalPlaces: dp,
    lines,
    totals,
    fingerprint,
  };
}

// POST /api/tenant/trade/v1/<sales-orders|purchase-orders>/pricing-preview
export async function fakePreviewOrderPricing(
  kind: 'sales-order' | 'purchase-order',
  body: OrderPricingPreviewBody,
): Promise<OrderPreview> {
  await fakeDelay();
  return computeOrderPreviewInternal(kind, body);
}

// ---------------------------------------------------------------------------
// Quotations
// ---------------------------------------------------------------------------

// POST /api/tenant/trade/v1/quotations (x-idempotency-key)
export async function fakeCreateQuotation(
  body: CreateQuotationBody,
  _idempotencyKey?: string,
): Promise<QuotationDetail> {
  await fakeDelay();
  const customer = findCustomerSeed(body.partyId);
  if (!customer) {
    throw new ApiError(422, 'TRADE.QUOTE.CUSTOMER_NOT_ELIGIBLE');
  }
  if (!customer.quotationSelectable || customer.accountStatus === 'BLOCKED') {
    throw new ApiError(422, 'TRADE.QUOTE.COMMERCIAL_ACCOUNT_BLOCKED');
  }

  const { companyId, branchId } = readActiveScope();
  const now = nowIso();
  const oppId = body.sourceCrmOpportunityId ?? null;
  const created: QuotationDetail = {
    id: fakeId(),
    version: 1,
    companyId,
    branchId,
    partyId: customer.partyId,
    contactPartyId: body.contactPartyId ?? null,
    currencyCode: body.currencyCode,
    businessDate: now.slice(0, 10),
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    draftReference: body.draftReference?.trim() || null,
    grandTotal: '0',
    partySnapshot: { id: customer.partyId, displayName: customer.en },
    createdAt: now,
    updatedAt: now,
    extensionValues: body.extensionValues ? clone(body.extensionValues) : {},
    currentRevisionId: null,
    acceptedRevisionId: null,
    crmCustomerProfileId: body.crmCustomerProfileId ?? customer.crmCustomerProfileId,
    approvalStatus: 'NOT_REQUIRED',
    sourceCrmOpportunityId: oppId,
    currentRevision: null,
    revisions: [],
    currentLines: [],
    reasonHistory: [],
  };

  quotationsStore.unshift(created);
  return projectQuotationDetail(created);
}

// PATCH /api/tenant/trade/v1/quotations/:id (If-Match, x-idempotency-key)
export async function fakeUpdateQuotation(
  id: string,
  expectedVersion: number,
  body: UpdateQuotationBody,
  _idempotencyKey?: string,
): Promise<QuotationDetail> {
  await fakeDelay();
  const quotation = findQuotation(id);
  assertValidVersion(quotation.version, expectedVersion);
  if (quotation.lifecycleStatus !== 'DRAFT') {
    throw new ApiError(409, 'TRADE.QUOTE.TRANSITION_NOT_ALLOWED');
  }

  if (body.contactPartyId !== undefined) {
    quotation.contactPartyId = body.contactPartyId;
  }
  if (body.draftReference !== undefined) {
    quotation.draftReference = body.draftReference?.trim() || null;
  }
  if (body.sourceCrmOpportunityId !== undefined) {
    quotation.sourceCrmOpportunityId = body.sourceCrmOpportunityId;
  }

  bumpVersion(quotation);
  return projectQuotationDetail(quotation);
}

// POST /api/tenant/trade/v1/quotations/:id/revisions (If-Match, x-idempotency-key)
export async function fakeCreateQuotationRevision(
  id: string,
  expectedVersion: number,
  body: CreateQuotationRevisionBody,
  _idempotencyKey?: string,
): Promise<CreateQuotationRevisionResult> {
  await fakeDelay();
  const quotation = findQuotation(id);
  assertValidVersion(quotation.version, expectedVersion);

  if (quotation.lifecycleStatus !== 'DRAFT' && quotation.lifecycleStatus !== 'SENT') {
    throw new ApiError(409, 'TRADE.QUOTE.TRANSITION_NOT_ALLOWED');
  }
  if (!body.validUntil || body.validUntil < todayYmd()) {
    throw new ApiError(422, 'TRADE.QUOTE.VALIDITY_INVALID');
  }
  if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > MAX_LINES) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  assertValidTermsNotes(body.notes);
  assertValidTermsNotes(body.terms?.notes);

  // Trigger the one-time SV-INST price change before comparing fingerprint.
  if (body.lines.some((l) => l.itemId === 'item-51') && svInstPendingBump && !svInstPriceBumped) {
    svInstPriceBumped = true;
    svInstPendingBump = false;
  }

  const preview = await computeQuotationPreviewInternal(
    {
      partyId: quotation.partyId,
      currencyCode: quotation.currencyCode,
      lines: body.lines,
      pricing: body.pricing,
    },
    true,
  );

  if (body.expectedPricingFingerprint && body.expectedPricingFingerprint !== preview.fingerprint) {
    throw new ApiError(409, 'TRADE.QUOTE.PRICING_CHANGED');
  }

  const termsSnapshot = await resolveTermsSnapshot(
    quotation.companyId,
    'quotation',
    {
      termSelections: body.termSelections,
      notes: body.notes,
      terms: body.terms,
    },
    true,
  );

  const nextRevisionNumber =
    quotation.revisions.length > 0
      ? Math.max(...quotation.revisions.map((r) => r.revisionNumber)) + 1
      : 1;
  const now = nowIso();
  const revId = fakeId();

  const newLines: QuotationLine[] = [];
  for (let idx = 0; idx < body.lines.length; idx += 1) {
    const input = body.lines[idx];
    const pLine = preview.lines[idx];
    const summary = await fetchItemSummary(input.itemId, quotation.companyId);
    newLines.push({
      id: fakeId(),
      clientLineId: input.clientLineId,
      printLineNumber: idx + 1,
      descriptionSnapshot: itemName(summary, 'en'),
      quantity: input.quantity,
      uomId: input.uomId,
      unitPrice: pLine.unitPrice,
      discountTotal: pLine.discountTotal,
      lineTotal: pLine.lineTotal,
      discountSnapshot: {
        itemId: summary.id,
        maxDiscountAmount: pLine.maxDiscountAmount,
        maxDiscountPercent: pLine.maxDiscountPercent,
        discount: input.discount ?? null,
      },
      taxSnapshot: {
        sku: summary.sku,
        uomCode: uomCodeOf(input.uomId),
        itemDisplayName: itemName(summary, 'en'),
        itemTaxDefault: toItemTaxDefault(summary.salesTaxDefault),
      },
      itemLabel: itemLabelOf(summary),
    });
  }

  const revision: QuotationRevision = {
    id: revId,
    version: 1,
    quotationId: quotation.id,
    revisionNumber: nextRevisionNumber,
    status: 'DRAFT',
    validUntil: body.validUntil,
    subtotal: preview.totals.subtotal,
    discountTotal: preview.totals.discountTotal,
    grandTotal: preview.totals.grandTotal,
    pricingMode: body.pricing.mode,
    discountSnapshot: {
      pricing: clone(body.pricing),
      currencyDecimalPlaces: preview.currencyDecimalPlaces,
    },
    termsSnapshot,
    sentAt: null,
    acceptedAt: null,
    rejectedAt: null,
    priceLockExpiresAt: null,
    createdAt: now,
  };

  quotation.revisions.push(revision);
  quotation.currentLines = newLines;
  quotation.currentRevisionId = revision.id;
  quotation.acceptedRevisionId = null;
  quotation.lifecycleStatus = 'DRAFT';
  quotation.grandTotal = revision.grandTotal;
  quotation.currentRevision = {
    id: revision.id,
    revisionNumber: revision.revisionNumber,
    status: revision.status,
    validUntil: revision.validUntil,
    priceLockExpiresAt: null,
  };
  bumpVersion(quotation);

  return clone({
    ...revision,
    quotation: {
      id: quotation.id,
      version: quotation.version,
      lifecycleStatus: quotation.lifecycleStatus,
      currentRevisionId: revision.id,
    },
  });
}

// POST /api/tenant/trade/v1/quotations/:id/<send|accept|reject|cancel> (If-Match, x-idempotency-key)
export async function fakeQuotationAction(
  id: string,
  expectedVersion: number,
  action: QuotationActionKind,
  reason?: ReasonInput,
  opts?: FakeCallOptions,
): Promise<QuotationDetail> {
  await maybeDelay(opts);
  const quotation = findQuotation(id);
  assertValidVersion(quotation.version, expectedVersion);

  const currentRev = quotation.currentRevisionId
    ? quotation.revisions.find((r) => r.id === quotation.currentRevisionId) ?? null
    : null;
  const now = nowIso();

  switch (action) {
    case 'send': {
      if (quotation.lifecycleStatus !== 'DRAFT' || !currentRev || quotation.currentLines.length === 0) {
        throw new ApiError(409, 'TRADE.QUOTE.TRANSITION_NOT_ALLOWED');
      }
      if (!quotation.documentNumber) {
        quotation.documentNumber = nextDocumentNumber('quotation');
      }
      const validEndMs = Date.parse(`${currentRev.validUntil}T23:59:59.999Z`);
      const lockCapMs = Date.now() + PRICE_LOCK_MS;
      const lockExpiry = new Date(Number.isFinite(validEndMs) ? Math.min(validEndMs, lockCapMs) : lockCapMs).toISOString();

      quotation.lifecycleStatus = 'SENT';
      currentRev.status = 'SENT';
      currentRev.sentAt = now;
      currentRev.priceLockExpiresAt = lockExpiry;
      quotation.currentRevision = {
        id: currentRev.id,
        revisionNumber: currentRev.revisionNumber,
        status: currentRev.status,
        validUntil: currentRev.validUntil,
        priceLockExpiresAt: lockExpiry,
      };
      bumpVersion(quotation);
      return projectQuotationDetail(quotation);
    }

    case 'accept': {
      if (quotation.lifecycleStatus !== 'SENT' || !currentRev) {
        throw new ApiError(409, 'TRADE.QUOTE.TRANSITION_NOT_ALLOWED');
      }
      if (currentRev.priceLockExpiresAt && Date.now() > Date.parse(currentRev.priceLockExpiresAt)) {
        throw new ApiError(409, 'TRADE.PRICE.LOCK_EXPIRED');
      }
      quotation.lifecycleStatus = 'ACCEPTED';
      quotation.acceptedRevisionId = currentRev.id;
      currentRev.status = 'ACCEPTED';
      currentRev.acceptedAt = now;
      quotation.currentRevision = {
        id: currentRev.id,
        revisionNumber: currentRev.revisionNumber,
        status: currentRev.status,
        validUntil: currentRev.validUntil,
        priceLockExpiresAt: currentRev.priceLockExpiresAt,
      };
      bumpVersion(quotation);
      return projectQuotationDetail(quotation);
    }

    case 'reject': {
      if (quotation.lifecycleStatus !== 'SENT' || !currentRev) {
        throw new ApiError(409, 'TRADE.QUOTE.TRANSITION_NOT_ALLOWED');
      }
      appendReasonHistory(quotation.reasonHistory, 'REJECT', REASON_KIND_BY_ACTION['QUOTATION_REJECT'], reason);
      quotation.lifecycleStatus = 'REJECTED';
      currentRev.status = 'REJECTED';
      currentRev.rejectedAt = now;
      quotation.currentRevision = {
        id: currentRev.id,
        revisionNumber: currentRev.revisionNumber,
        status: currentRev.status,
        validUntil: currentRev.validUntil,
        priceLockExpiresAt: currentRev.priceLockExpiresAt,
      };
      bumpVersion(quotation);
      return projectQuotationDetail(quotation);
    }

    case 'cancel': {
      if (quotation.lifecycleStatus !== 'DRAFT' && quotation.lifecycleStatus !== 'SENT') {
        throw new ApiError(409, 'TRADE.QUOTE.TRANSITION_NOT_ALLOWED');
      }
      appendReasonHistory(quotation.reasonHistory, 'CANCEL', REASON_KIND_BY_ACTION['QUOTATION_CANCEL'], reason);
      quotation.lifecycleStatus = 'CANCELLED';
      if (currentRev) {
        currentRev.status = 'CANCELLED';
        quotation.currentRevision = {
          id: currentRev.id,
          revisionNumber: currentRev.revisionNumber,
          status: currentRev.status,
          validUntil: currentRev.validUntil,
          priceLockExpiresAt: currentRev.priceLockExpiresAt,
        };
      }
      bumpVersion(quotation);
      return projectQuotationDetail(quotation);
    }
  }
}

// POST /api/tenant/trade/v1/quotations/:id/convert-to-sales-order (If-Match, x-idempotency-key)
export async function fakeConvertQuotation(
  id: string,
  expectedVersion: number,
  body: ConvertQuotationBody,
  _idempotencyKey?: string,
): Promise<SalesOrderDetail> {
  await fakeDelay();
  const quotation = findQuotation(id);
  assertValidVersion(quotation.version, expectedVersion);

  if (quotation.lifecycleStatus === 'CONVERTED') {
    const existing = salesOrdersStore.find((o) => o.sourceQuotationId === quotation.id);
    throw new ApiError(
      409,
      'TRADE.QUOTE.ALREADY_CONVERTED',
      existing ? { salesOrderId: [existing.id] } : undefined,
    );
  }
  if (quotation.lifecycleStatus !== 'ACCEPTED') {
    throw new ApiError(409, 'TRADE.QUOTE.TRANSITION_NOT_ALLOWED');
  }

  const acceptedRev =
    quotation.revisions.find((r) => r.id === (quotation.acceptedRevisionId ?? quotation.currentRevisionId)) ?? null;
  if (!acceptedRev || !hasNonEmptyTerms(acceptedRev.termsSnapshot)) {
    throw new ApiError(422, 'TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE');
  }
  assertValidTermsNotes(body.notes);
  assertValidTermsNotes(body.terms?.notes);

  let soTerms: TermsSnapshot;
  if (body.terms) {
    if (!termsSnapshotsMatch(acceptedRev.termsSnapshot, body.terms)) {
      throw new ApiError(422, 'TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE');
    }
    soTerms = clone(acceptedRev.termsSnapshot);
  } else if (body.termSelections) {
    const resolved = await resolveTermsSnapshot(
      quotation.companyId,
      'sales-order',
      { termSelections: body.termSelections, notes: body.notes },
      false,
    );
    soTerms = resolved;
  } else {
    soTerms = clone(acceptedRev.termsSnapshot);
  }

  if (body.lines.length !== quotation.currentLines.length) {
    throw new ApiError(422, 'TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE');
  }

  const qlByClientId = new Map(quotation.currentLines.map((ql) => [ql.clientLineId, ql]));
  const verifyEntries: {
    clientLineId: string;
    quantity: Dec;
    unitPrice: Dec;
    taxDefault: TaxDefault | null;
    financial: LineEvidence;
  }[] = [];
  const orderLines: SalesOrderLine[] = [];

  for (let idx = 0; idx < body.lines.length; idx += 1) {
    const input = body.lines[idx];
    const ql = qlByClientId.get(input.clientLineId);
    if (!ql) {
      throw new ApiError(422, 'TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE');
    }
    if (cmp(input.financial.discountTotal, ql.discountTotal) !== 0) {
      throw new ApiError(422, 'TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE');
    }

    const summary = await fetchItemSummary(ql.discountSnapshot.itemId, quotation.companyId);
    verifyEntries.push({
      clientLineId: input.clientLineId,
      quantity: ql.quantity,
      unitPrice: ql.unitPrice,
      taxDefault: summary.salesTaxDefault,
      financial: input.financial,
    });

    orderLines.push({
      id: fakeId(),
      clientLineId: ql.clientLineId,
      itemId: summary.id,
      itemCompanyProfileId: fakeItemProfileId(summary.id),
      printLineNumber: idx + 1,
      descriptionSnapshot: ql.descriptionSnapshot,
      uomId: ql.uomId,
      uomLabel: uomLabelOf(ql.uomId),
      orderedQuantity: ql.quantity,
      allocatedQuantity: '0',
      fulfilledQuantity: '0',
      invoicedQuantity: '0',
      cancelledQuantity: '0',
      unitPrice: ql.unitPrice,
      discountTotal: input.financial.discountTotal,
      chargeTotal: input.financial.chargeTotal,
      taxTotal: input.financial.taxTotal,
      lineTotal: input.financial.lineTotal,
      taxSnapshot: input.financial.taxSnapshot,
      itemLabel: itemLabelOf(summary),
    });
  }

  verifyFinancialEvidence(verifyEntries, body.totals, quotation.currencyCode, false);

  const now = nowIso();
  const createdOrder: SalesOrderDetail = {
    id: fakeId(),
    version: 1,
    companyId: quotation.companyId,
    branchId: quotation.branchId,
    partyId: quotation.partyId,
    contactPartyId: body.contactPartyId ?? quotation.contactPartyId,
    currencyCode: quotation.currencyCode,
    businessDate: now.slice(0, 10),
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    draftReference: body.draftReference !== undefined ? body.draftReference?.trim() || null : quotation.draftReference,
    grandTotal: body.totals.grandTotal,
    partySnapshot: clone(quotation.partySnapshot),
    createdAt: now,
    updatedAt: now,
    extensionValues: {},
    confirmationStatus: 'NOT_STARTED',
    holdStatus: 'NONE',
    fulfillmentStatus: 'NONE',
    billingStatus: 'NONE',
    sourceQuotationId: quotation.id,
    sourceQuotationRevisionId: acceptedRev.id,
    termsSnapshot: soTerms,
    totalsSnapshot: toTotalsSnapshot(body.totals, quotation.currencyCode),
    lines: orderLines,
    reasonHistory: [],
  };

  salesOrdersStore.unshift(createdOrder);
  quotation.lifecycleStatus = 'CONVERTED';
  bumpVersion(quotation);

  return projectOrderDetail(createdOrder);
}

// POST /api/tenant/trade/v1/quotations/:id/create-sales-order (If-Match, x-idempotency-key)
export async function fakeCreateSalesOrderFromQuotation(
  quotationId: string,
  expectedVersion: number,
  body: DirectSalesOrderFromQuotationBody = {},
  _idempotencyKey?: string,
): Promise<SalesOrderDetail> {
  await fakeDelay();
  if ('requestedDeadline' in body) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  const quotation = findQuotation(quotationId);
  assertValidVersion(quotation.version, expectedVersion);

  if (quotation.lifecycleStatus === 'CONVERTED') {
    const existing = salesOrdersStore.find((o) => o.sourceQuotationId === quotation.id);
    throw new ApiError(
      409,
      'TRADE.QUOTE.ALREADY_CONVERTED',
      existing ? { salesOrderId: [existing.id] } : undefined,
    );
  }
  if (quotation.lifecycleStatus !== 'ACCEPTED') {
    throw new ApiError(409, 'TRADE.QUOTE.TRANSITION_NOT_ALLOWED');
  }

  const acceptedRev =
    quotation.revisions.find((r) => r.id === (quotation.acceptedRevisionId ?? quotation.currentRevisionId)) ?? null;
  if (!acceptedRev || !hasNonEmptyTerms(acceptedRev.termsSnapshot)) {
    throw new ApiError(422, 'TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE');
  }

  const orderLines: SalesOrderLine[] = [];
  const lineEvidences: LineEvidence[] = [];

  for (let idx = 0; idx < quotation.currentLines.length; idx += 1) {
    const ql = quotation.currentLines[idx];
    const summary = await fetchItemSummary(ql.discountSnapshot.itemId, quotation.companyId);
    if (!summary.salesTaxDefault) {
      throw new ApiError(422, 'TRADE.QUOTE.TAX_DEFAULT_REQUIRED', {
        clientLineId: [ql.clientLineId],
      });
    }
    if (summary.salesTaxDefault.isInclusive) {
      throw new ApiError(422, 'TRADE.TAX.INCLUSIVE_NOT_SUPPORTED', {
        clientLineId: [ql.clientLineId],
      });
    }

    const ev = lineEvidence(
      {
        quantity: ql.quantity,
        unitPrice: ql.unitPrice,
        discountTotal: ql.discountTotal,
        chargeTotal: '0',
        taxDefault: summary.salesTaxDefault,
      },
      quotation.currencyCode,
    );

    lineEvidences.push(ev);
    orderLines.push({
      id: fakeId(),
      clientLineId: ql.clientLineId,
      itemId: summary.id,
      itemCompanyProfileId: fakeItemProfileId(summary.id),
      printLineNumber: idx + 1,
      descriptionSnapshot: ql.descriptionSnapshot,
      uomId: ql.uomId,
      uomLabel: uomLabelOf(ql.uomId),
      orderedQuantity: ql.quantity,
      allocatedQuantity: '0',
      fulfilledQuantity: '0',
      invoicedQuantity: '0',
      cancelledQuantity: '0',
      unitPrice: ql.unitPrice,
      discountTotal: ev.discountTotal,
      chargeTotal: ev.chargeTotal,
      taxTotal: ev.taxTotal,
      lineTotal: ev.lineTotal,
      taxSnapshot: ev.taxSnapshot,
      itemLabel: itemLabelOf(summary),
    });
  }

  const totals = totalsEvidence(lineEvidences, currencyDecimals(quotation.currencyCode));
  const now = nowIso();
  const createdOrder: SalesOrderDetail = {
    id: fakeId(),
    version: 1,
    companyId: quotation.companyId,
    branchId: quotation.branchId,
    partyId: quotation.partyId,
    contactPartyId: quotation.contactPartyId,
    currencyCode: quotation.currencyCode,
    businessDate: now.slice(0, 10),
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    draftReference: body.draftReference !== undefined ? body.draftReference?.trim() || null : quotation.draftReference,
    grandTotal: totals.grandTotal,
    partySnapshot: clone(quotation.partySnapshot),
    createdAt: now,
    updatedAt: now,
    extensionValues: {},
    confirmationStatus: 'NOT_STARTED',
    holdStatus: 'NONE',
    fulfillmentStatus: 'NONE',
    billingStatus: 'NONE',
    sourceQuotationId: quotation.id,
    sourceQuotationRevisionId: acceptedRev.id,
    termsSnapshot: clone(acceptedRev.termsSnapshot),
    totalsSnapshot: toTotalsSnapshot(totals, quotation.currencyCode),
    lines: orderLines,
    reasonHistory: [],
  };

  salesOrdersStore.unshift(createdOrder);
  quotation.lifecycleStatus = 'CONVERTED';
  bumpVersion(quotation);

  return projectOrderDetail(createdOrder);
}

// ---------------------------------------------------------------------------
// Sales Orders
// ---------------------------------------------------------------------------

// POST /api/tenant/trade/v1/sales-orders (x-idempotency-key)
export async function fakeCreateSalesOrder(
  body: CreateSalesOrderBody,
  _idempotencyKey?: string,
): Promise<SalesOrderDetail> {
  await fakeDelay();
  const customer = findCustomerSeed(body.partyId);
  if (!customer) {
    throw new ApiError(422, 'TRADE.SALES_ORDER.COMMERCIAL_ACCOUNT_REQUIRED');
  }
  if (!customer.quotationSelectable || customer.accountStatus === 'BLOCKED') {
    throw new ApiError(422, 'TRADE.QUOTE.COMMERCIAL_ACCOUNT_BLOCKED');
  }
  if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > MAX_LINES) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  assertValidTermsNotes(body.notes);
  assertValidTermsNotes(body.terms?.notes);

  const { companyId, branchId } = readActiveScope();
  const preview = await computeOrderPreviewInternal('sales-order', {
    partyId: body.partyId,
    currencyCode: body.currencyCode,
    lines: body.lines.map((l) => ({
      clientLineId: l.clientLineId,
      itemId: l.itemId,
      uomId: l.uomId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountTotal: l.financial.discountTotal,
      chargeTotal: l.financial.chargeTotal,
      tax: { category: l.financial.taxSnapshot.category, rateBps: l.financial.taxSnapshot.rateBps },
    })),
  });

  if (body.expectedPricingFingerprint && body.expectedPricingFingerprint !== preview.fingerprint) {
    throw new ApiError(409, 'TRADE.PRICE.PREVIEW_CHANGED');
  }

  const verifyEntries: {
    clientLineId: string;
    quantity: Dec;
    unitPrice: Dec;
    taxDefault: TaxDefault | null;
    financial: LineEvidence;
  }[] = [];
  const orderLines: SalesOrderLine[] = [];

  for (let idx = 0; idx < body.lines.length; idx += 1) {
    const input = body.lines[idx];
    assertPositiveDecimal(input.quantity);
    const summary = await fetchItemSummary(input.itemId, companyId);
    const unitPrice = input.unitPrice ?? preview.lines[idx].unitPrice;
    verifyEntries.push({
      clientLineId: input.clientLineId,
      quantity: input.quantity,
      unitPrice,
      taxDefault: summary.salesTaxDefault,
      financial: input.financial,
    });
    orderLines.push({
      id: fakeId(),
      clientLineId: input.clientLineId,
      itemId: summary.id,
      itemCompanyProfileId: fakeItemProfileId(summary.id),
      printLineNumber: idx + 1,
      descriptionSnapshot: itemName(summary, 'en'),
      uomId: input.uomId,
      uomLabel: uomLabelOf(input.uomId),
      orderedQuantity: input.quantity,
      allocatedQuantity: '0',
      fulfilledQuantity: '0',
      invoicedQuantity: '0',
      cancelledQuantity: '0',
      unitPrice,
      discountTotal: input.financial.discountTotal,
      chargeTotal: input.financial.chargeTotal,
      taxTotal: input.financial.taxTotal,
      lineTotal: input.financial.lineTotal,
      taxSnapshot: input.financial.taxSnapshot,
      itemLabel: itemLabelOf(summary),
    });
  }

  verifyFinancialEvidence(verifyEntries, body.totals, body.currencyCode, false);
  const termsSnapshot = await resolveTermsSnapshot(companyId, 'sales-order', body, false);
  const now = nowIso();

  const created: SalesOrderDetail = {
    id: fakeId(),
    version: 1,
    companyId,
    branchId,
    partyId: customer.partyId,
    contactPartyId: body.contactPartyId ?? null,
    currencyCode: body.currencyCode,
    businessDate: now.slice(0, 10),
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    draftReference: body.draftReference?.trim() || null,
    grandTotal: body.totals.grandTotal,
    partySnapshot: { id: customer.partyId, displayName: customer.en },
    createdAt: now,
    updatedAt: now,
    extensionValues: body.extensionValues ? clone(body.extensionValues) : {},
    confirmationStatus: 'NOT_STARTED',
    holdStatus: 'NONE',
    fulfillmentStatus: 'NONE',
    billingStatus: 'NONE',
    sourceQuotationId: null,
    sourceQuotationRevisionId: null,
    termsSnapshot,
    totalsSnapshot: toTotalsSnapshot(body.totals, body.currencyCode),
    lines: orderLines,
    reasonHistory: [],
  };

  salesOrdersStore.unshift(created);
  return projectOrderDetail(created);
}

// PATCH /api/tenant/trade/v1/sales-orders/:id (If-Match, x-idempotency-key)
export async function fakeUpdateSalesOrder(
  id: string,
  expectedVersion: number,
  body: UpdateSalesOrderBody,
  _idempotencyKey?: string,
): Promise<SalesOrderDetail> {
  await fakeDelay();
  const order = findSalesOrder(id);
  assertValidVersion(order.version, expectedVersion);
  if (order.lifecycleStatus !== 'DRAFT') {
    throw new ApiError(409, 'TRADE.SALES_ORDER.TRANSITION_NOT_ALLOWED');
  }
  assertValidTermsNotes(body.notes);
  assertValidTermsNotes(body.terms?.notes);

  if (body.contactPartyId !== undefined) {
    order.contactPartyId = body.contactPartyId;
  }
  if (body.draftReference !== undefined) {
    order.draftReference = body.draftReference?.trim() || null;
  }
  if (body.termSelections !== undefined || body.terms !== undefined || body.notes !== undefined) {
    order.termsSnapshot = await resolveTermsSnapshot(order.companyId, 'sales-order', body, false);
  }

  bumpVersion(order);
  return projectOrderDetail(order);
}

// POST /api/tenant/trade/v1/sales-orders/:id/confirm (If-Match, x-idempotency-key)
export async function fakeConfirmSalesOrder(
  id: string,
  expectedVersion: number,
  requestedDeadline?: string,
  _idempotencyKey?: string,
): Promise<ConfirmSalesOrderResult> {
  await fakeDelay();
  const order = findSalesOrder(id);
  assertValidVersion(order.version, expectedVersion);

  if (
    order.lifecycleStatus !== 'DRAFT' ||
    order.holdStatus !== 'NONE' ||
    order.confirmationStatus !== 'NOT_STARTED'
  ) {
    throw new ApiError(409, 'TRADE.SALES_ORDER.CONFIRM_NOT_ALLOWED');
  }

  if (!order.documentNumber) {
    order.documentNumber = nextDocumentNumber('sales-order');
  }
  if (requestedDeadline) {
    order.extensionValues = { ...order.extensionValues, requestedDeadline };
  }
  order.lifecycleStatus = 'CONFIRMED';
  order.confirmationStatus = 'COMPLETED';
  order.fulfillmentStatus = 'NOT_STARTED';
  order.billingStatus = 'NOT_INVOICED';
  bumpVersion(order);

  return {
    statusCode: 200,
    orderId: order.id,
    version: order.version,
    lifecycleStatus: 'CONFIRMED',
    documentNumber: order.documentNumber,
    unallocatedLines: [],
  };
}

// POST /api/tenant/trade/v1/sales-orders/:id/<hold|release-hold|cancel> (If-Match, x-idempotency-key)
export async function fakeSalesOrderAction(
  id: string,
  expectedVersion: number,
  action: SalesOrderActionKind,
  reason: ReasonInput,
  opts?: FakeCallOptions,
): Promise<SalesOrderDetail> {
  await maybeDelay(opts);
  const order = findSalesOrder(id);
  assertValidVersion(order.version, expectedVersion);

  switch (action) {
    case 'hold': {
      if ((order.lifecycleStatus !== 'DRAFT' && order.lifecycleStatus !== 'CONFIRMED') || order.holdStatus !== 'NONE') {
        throw new ApiError(409, 'TRADE.SALES_ORDER.HOLD_TRANSITION_INVALID');
      }
      appendReasonHistory(order.reasonHistory, 'HOLD', REASON_KIND_BY_ACTION['SALES_ORDER_HOLD'], reason);
      order.holdStatus = 'HELD';
      bumpVersion(order);
      return projectOrderDetail(order);
    }

    case 'release-hold': {
      if ((order.lifecycleStatus !== 'DRAFT' && order.lifecycleStatus !== 'CONFIRMED') || order.holdStatus !== 'HELD') {
        throw new ApiError(409, 'TRADE.SALES_ORDER.HOLD_TRANSITION_INVALID');
      }
      appendReasonHistory(
        order.reasonHistory,
        'RELEASE_HOLD',
        REASON_KIND_BY_ACTION['SALES_ORDER_RELEASE_HOLD'],
        reason,
      );
      order.holdStatus = 'NONE';
      bumpVersion(order);
      return projectOrderDetail(order);
    }

    case 'cancel': {
      if (order.lifecycleStatus !== 'DRAFT' && order.lifecycleStatus !== 'CONFIRMED') {
        throw new ApiError(409, 'TRADE.SALES_ORDER.CANCEL_NOT_ALLOWED');
      }
      appendReasonHistory(order.reasonHistory, 'CANCEL', REASON_KIND_BY_ACTION['SALES_ORDER_CANCEL'], reason);
      order.lifecycleStatus = 'CANCELLED';
      order.confirmationStatus = 'CANCELLED';
      bumpVersion(order);
      return projectOrderDetail(order);
    }
  }
}

// Fake-only lookup (gap G1: real API has no sourceQuotationId filter).
export async function fakeFindSalesOrderByQuotation(quotationId: string): Promise<SalesOrder | null> {
  await fakeDelay();
  const found = salesOrdersStore.find((o) => o.sourceQuotationId === quotationId);
  if (!found) return null;
  return projectSummaryForKind('sales-order', found);
}

// ---------------------------------------------------------------------------
// Purchase Orders
// ---------------------------------------------------------------------------

function schedulePurchaseOrderDispatch(po: PurchaseOrderDetail): void {
  const supplier = findSupplierSeed(po.partyId);
  const fails = supplier?.deliveryFails === true;

  setTimeout(() => {
    const live = purchaseOrdersStore.find((entry) => entry.id === po.id);
    if (!live || live.lifecycleStatus !== 'CONFIRMED') return;

    if (fails) {
      live.dispatchStatus = 'FAILED';
      live.delivery = {
        status: 'FAILED',
        attemptCount: live.delivery?.attemptCount ?? 1,
        lastErrorCode: 'TRADE.PURCHASE_ORDER.DELIVERY_PDF_FAILED',
        nextAttemptAt: null,
      };
    } else {
      live.dispatchStatus = 'SENT';
      live.delivery = {
        status: 'COMPLETED',
        attemptCount: live.delivery?.attemptCount ?? 1,
        lastErrorCode: null,
        nextAttemptAt: null,
      };
    }
    bumpVersion(live);
    notifyDocumentKindMutated('purchase-order');
  }, 3000);
}

// POST /api/tenant/trade/v1/purchase-orders (x-idempotency-key)
export async function fakeCreatePurchaseOrder(
  body: CreatePurchaseOrderBody,
  _idempotencyKey?: string,
): Promise<PurchaseOrderDetail> {
  await fakeDelay();
  const supplier = findSupplierSeed(body.supplierPartyId);
  if (!supplier) {
    throw new ApiError(422, 'TRADE.PURCHASE_ORDER.SUPPLIER_ACCOUNT_REQUIRED');
  }
  if (!body.supplierAccountId || !supplier.accounts.some((a) => a.id === body.supplierAccountId)) {
    throw new ApiError(422, 'TRADE.PURCHASE_ORDER.SUPPLIER_ACCOUNT_REQUIRED');
  }
  if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > MAX_LINES) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  assertValidTermsNotes(body.notes);
  assertValidTermsNotes(body.terms?.notes);

  const { companyId, branchId } = readActiveScope();
  const preview = await computeOrderPreviewInternal('purchase-order', {
    partyId: body.supplierPartyId,
    currencyCode: body.currencyCode,
    lines: body.lines.map((l) => ({
      clientLineId: l.clientLineId,
      itemId: l.itemId,
      uomId: l.uomId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountTotal: '0',
      chargeTotal: l.financial.chargeTotal,
      tax: { category: l.financial.taxSnapshot.category, rateBps: l.financial.taxSnapshot.rateBps },
    })),
  });

  if (body.expectedPricingFingerprint && body.expectedPricingFingerprint !== preview.fingerprint) {
    throw new ApiError(409, 'TRADE.PRICE.PREVIEW_CHANGED');
  }

  const verifyEntries: {
    clientLineId: string;
    quantity: Dec;
    unitPrice: Dec;
    taxDefault: TaxDefault | null;
    financial: LineEvidence;
  }[] = [];
  const orderLines: PurchaseOrderLine[] = [];

  for (let idx = 0; idx < body.lines.length; idx += 1) {
    const input = body.lines[idx];
    assertPositiveDecimal(input.quantity);
    const summary = await fetchItemSummary(input.itemId, companyId);
    const unitPrice = input.unitPrice ?? preview.lines[idx].unitPrice;
    verifyEntries.push({
      clientLineId: input.clientLineId,
      quantity: input.quantity,
      unitPrice,
      taxDefault: summary.purchaseTaxDefault,
      financial: input.financial,
    });
    orderLines.push({
      id: fakeId(),
      clientLineId: input.clientLineId,
      itemId: summary.id,
      itemCompanyProfileId: fakeItemProfileId(summary.id),
      printLineNumber: idx + 1,
      descriptionSnapshot: itemName(summary, 'en'),
      uomId: input.uomId,
      uomLabel: uomLabelOf(input.uomId),
      orderedQuantity: input.quantity,
      receivedQuantity: '0',
      cancelledQuantity: '0',
      unitPrice,
      chargeTotal: input.financial.chargeTotal,
      taxTotal: input.financial.taxTotal,
      lineTotal: input.financial.lineTotal,
      taxSnapshot: input.financial.taxSnapshot,
      expectedDate: input.expectedDate ?? null,
      receivingNodeId: input.receivingNodeId ?? body.receivingNodeId,
      itemLabel: itemLabelOf(summary),
    });
  }

  verifyFinancialEvidence(verifyEntries, body.totals, body.currencyCode, true);
  const termsSnapshot = await resolveTermsSnapshot(companyId, 'purchase-order', body, false);
  const now = nowIso();

  const created: PurchaseOrderDetail = {
    id: fakeId(),
    version: 1,
    companyId,
    branchId,
    partyId: supplier.partyId,
    contactPartyId: body.contactPartyId ?? null,
    currencyCode: body.currencyCode,
    businessDate: now.slice(0, 10),
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    draftReference: body.draftReference?.trim() || null,
    grandTotal: body.totals.grandTotal,
    partySnapshot: { id: supplier.partyId, displayName: supplier.en },
    createdAt: now,
    updatedAt: now,
    extensionValues: body.extensionValues ? clone(body.extensionValues) : {},
    approvalStatus: 'NOT_REQUIRED',
    supplierAccountId: body.supplierAccountId,
    receivingNodeId: body.receivingNodeId,
    dispatchStatus: 'NOT_REQUESTED',
    fulfillmentStatus: 'NONE',
    billingStatus: 'NONE',
    termsSnapshot,
    totalsSnapshot: toTotalsSnapshot(body.totals, body.currencyCode),
    sourcePurchaseQuotationId: null,
    createdBy: FAKE_CURRENT_USER_ID,
    submittedBy: null,
    submittedAt: null,
    lines: orderLines,
    approvalReady: false,
    delivery: null,
    reasonHistory: [],
  };

  purchaseOrdersStore.unshift(created);
  return projectOrderDetail(created);
}

// PATCH /api/tenant/trade/v1/purchase-orders/:id (If-Match, x-idempotency-key)
export async function fakeUpdatePurchaseOrder(
  id: string,
  expectedVersion: number,
  body: UpdatePurchaseOrderBody,
  _idempotencyKey?: string,
): Promise<PurchaseOrderDetail> {
  await fakeDelay();
  const po = findPurchaseOrder(id);
  assertValidVersion(po.version, expectedVersion);

  if (po.lifecycleStatus !== 'DRAFT') {
    throw new ApiError(409, 'TRADE.PURCHASE_ORDER.TRANSITION_NOT_ALLOWED');
  }
  if (po.approvalStatus === 'PENDING') {
    throw new ApiError(409, 'TRADE.PURCHASE_ORDER.APPROVAL_INVALID');
  }
  assertValidTermsNotes(body.notes);
  assertValidTermsNotes(body.terms?.notes);

  if (body.supplierAccountId !== undefined) {
    po.supplierAccountId = body.supplierAccountId;
  }
  if (body.receivingNodeId !== undefined) {
    po.receivingNodeId = body.receivingNodeId;
  }
  if (body.contactPartyId !== undefined) {
    po.contactPartyId = body.contactPartyId;
  }
  if (body.draftReference !== undefined) {
    po.draftReference = body.draftReference?.trim() || null;
  }
  if (body.termSelections !== undefined || body.terms !== undefined || body.notes !== undefined) {
    po.termsSnapshot = await resolveTermsSnapshot(po.companyId, 'purchase-order', body, false);
  }

  po.approvalStatus = 'NOT_REQUIRED';
  po.approvalReady = false;
  po.submittedBy = null;
  po.submittedAt = null;
  bumpVersion(po);
  return projectOrderDetail(po);
}

// POST /api/tenant/trade/v1/purchase-orders/:id/<submit|withdraw|approve|reject|confirm|cancel> (If-Match, x-idempotency-key)
export async function fakePurchaseOrderAction(
  id: string,
  expectedVersion: number,
  action: PurchaseOrderActionKind,
  reason?: ReasonInput,
  opts?: FakeCallOptions,
): Promise<PurchaseOrderDetail> {
  await maybeDelay(opts);
  const po = findPurchaseOrder(id);
  assertValidVersion(po.version, expectedVersion);

  switch (action) {
    case 'submit': {
      const canSubmitStatus =
        po.approvalStatus === 'NOT_REQUIRED' ||
        po.approvalStatus === 'REJECTED' ||
        po.approvalStatus === 'WITHDRAWN';
      if (po.lifecycleStatus !== 'DRAFT' || !canSubmitStatus || po.approvalReady) {
        throw new ApiError(409, 'TRADE.PURCHASE_ORDER.APPROVAL_INVALID');
      }
      po.submittedBy = FAKE_CURRENT_USER_ID;
      po.submittedAt = nowIso();
      if (cmp(po.grandTotal, PO_APPROVAL_THRESHOLD) >= 0) {
        po.approvalStatus = 'PENDING';
        po.approvalReady = false;
      } else {
        po.approvalStatus = 'NOT_REQUIRED';
        po.approvalReady = true;
      }
      bumpVersion(po);
      return projectOrderDetail(po);
    }

    case 'withdraw': {
      if (
        po.lifecycleStatus !== 'DRAFT' ||
        po.approvalStatus !== 'PENDING' ||
        po.submittedBy !== FAKE_CURRENT_USER_ID
      ) {
        throw new ApiError(409, 'TRADE.PURCHASE_ORDER.APPROVAL_INVALID');
      }
      po.approvalStatus = 'WITHDRAWN';
      po.approvalReady = false;
      bumpVersion(po);
      return projectOrderDetail(po);
    }

    case 'approve': {
      if (po.lifecycleStatus !== 'DRAFT' || po.approvalStatus !== 'PENDING') {
        throw new ApiError(409, 'TRADE.PURCHASE_ORDER.APPROVAL_INVALID');
      }
      if (FAKE_CURRENT_USER_ID === po.createdBy || FAKE_CURRENT_USER_ID === po.submittedBy) {
        throw new ApiError(409, 'TRADE.APPROVAL.MAKER_CHECKER_REQUIRED');
      }
      po.approvalStatus = 'APPROVED';
      po.approvalReady = true;
      bumpVersion(po);
      return projectOrderDetail(po);
    }

    case 'reject': {
      if (po.lifecycleStatus !== 'DRAFT' || po.approvalStatus !== 'PENDING') {
        throw new ApiError(409, 'TRADE.PURCHASE_ORDER.APPROVAL_INVALID');
      }
      if (FAKE_CURRENT_USER_ID === po.createdBy || FAKE_CURRENT_USER_ID === po.submittedBy) {
        throw new ApiError(409, 'TRADE.APPROVAL.MAKER_CHECKER_REQUIRED');
      }
      appendReasonHistory(po.reasonHistory, 'PO_REJECT', REASON_KIND_BY_ACTION['PURCHASE_ORDER_REJECT'], reason);
      po.approvalStatus = 'REJECTED';
      po.approvalReady = false;
      bumpVersion(po);
      return projectOrderDetail(po);
    }

    case 'confirm': {
      if (po.lifecycleStatus !== 'DRAFT' || !po.approvalReady) {
        throw new ApiError(409, 'TRADE.PURCHASE_ORDER.APPROVAL_INVALID');
      }
      if (!po.documentNumber) {
        po.documentNumber = nextDocumentNumber('purchase-order');
      }
      po.lifecycleStatus = 'CONFIRMED';
      po.fulfillmentStatus = 'NOT_RECEIVED';
      po.billingStatus = 'NOT_BILLED';
      po.dispatchStatus = 'REQUESTED';
      po.delivery = {
        status: 'PDF_REQUESTED',
        attemptCount: 1,
        lastErrorCode: null,
        nextAttemptAt: null,
      };
      bumpVersion(po);
      schedulePurchaseOrderDispatch(po);
      return projectOrderDetail(po);
    }

    case 'cancel': {
      if (po.lifecycleStatus !== 'DRAFT' && po.lifecycleStatus !== 'CONFIRMED') {
        throw new ApiError(409, 'TRADE.PURCHASE_ORDER.CANCEL_NOT_ALLOWED');
      }
      appendReasonHistory(po.reasonHistory, 'PO_CANCEL', REASON_KIND_BY_ACTION['PURCHASE_ORDER_CANCEL'], reason);
      po.lifecycleStatus = 'CANCELLED';
      bumpVersion(po);
      return projectOrderDetail(po);
    }
  }
}

// POST /api/tenant/trade/v1/purchase-orders/:id/delivery/retry (If-Match, x-idempotency-key)
export async function fakeRetryPurchaseDelivery(
  id: string,
  expectedVersion: number,
  _idempotencyKey?: string,
): Promise<PurchaseOrderDetail> {
  await fakeDelay();
  const po = findPurchaseOrder(id);
  assertValidVersion(po.version, expectedVersion);

  if (
    po.lifecycleStatus !== 'CONFIRMED' ||
    po.delivery?.status !== 'FAILED' ||
    po.delivery.lastErrorCode === 'TRADE.PURCHASE_ORDER.DELIVERY_EMAIL_FAILED'
  ) {
    throw new ApiError(409, 'TRADE.PURCHASE_ORDER.DELIVERY_RETRY_NOT_ALLOWED');
  }

  po.dispatchStatus = 'REQUESTED';
  po.delivery = {
    status: 'PDF_REQUESTED',
    attemptCount: po.delivery.attemptCount + 1,
    lastErrorCode: null,
    nextAttemptAt: null,
  };
  bumpVersion(po);

  setTimeout(() => {
    const live = purchaseOrdersStore.find((entry) => entry.id === po.id);
    if (!live || live.lifecycleStatus !== 'CONFIRMED') return;
    live.dispatchStatus = 'SENT';
    live.delivery = {
      status: 'COMPLETED',
      attemptCount: live.delivery?.attemptCount ?? 2,
      lastErrorCode: null,
      nextAttemptAt: null,
    };
    bumpVersion(live);
    notifyDocumentKindMutated('purchase-order');
  }, 3000);

  return projectOrderDetail(po);
}

// ---------------------------------------------------------------------------
// Replace order lines (API v2 B4: SO & PO while DRAFT)
// ---------------------------------------------------------------------------

/** clientLineIds removed by an earlier PUT lines, per order: the backend soft-deletes them and refuses their reuse. */
const removedClientLineIds = new Map<string, Set<string>>();

/** Backend assertReplacementIds: unique ids, none of them a deleted line's id, else 400 TRADE.VALIDATION_FAILED. */
function assertFreshClientLineIds(orderId: string, lines: readonly { clientLineId: string }[]): void {
  const ids = new Set(lines.map((line) => line.clientLineId));
  const removed = removedClientLineIds.get(orderId);
  if (ids.size !== lines.length || lines.some((line) => removed?.has(line.clientLineId))) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { lines: ['invalid_client_line_id'] });
  }
}

function recordRemovedClientLineIds(
  orderId: string,
  stored: readonly { clientLineId: string }[],
  next: readonly { clientLineId: string }[],
): void {
  const kept = new Set(next.map((line) => line.clientLineId));
  const removed = removedClientLineIds.get(orderId) ?? new Set<string>();
  for (const line of stored) {
    if (!kept.has(line.clientLineId)) removed.add(line.clientLineId);
  }
  removedClientLineIds.set(orderId, removed);
}

interface SourceLockedLine {
  clientLineId: string;
  itemId?: string | null;
  itemCompanyProfileId: string;
  uomId: string;
  orderedQuantity: Dec;
  discountTotal?: Dec | null;
}

/** Backend assertSourceOrderLines: same lines, item, unit, quantity and discount as the source copy, else 422. */
function assertSourceLinesUnchanged(
  stored: readonly SourceLockedLine[],
  input: ReplaceOrderLinesBody['lines'],
  code: string,
): void {
  const byId = new Map(stored.map((line) => [line.clientLineId, line]));
  const changed = input.some((line) => {
    const source = byId.get(line.clientLineId);
    if (!source) return true;
    const sameItem =
      source.itemId != null
        ? source.itemId === line.itemId
        : source.itemCompanyProfileId === fakeItemProfileId(line.itemId);
    return (
      !sameItem ||
      source.uomId !== line.uomId ||
      cmp(source.orderedQuantity, line.quantity) !== 0 ||
      cmp(source.discountTotal ?? '0', line.financial.discountTotal) !== 0
    );
  });
  if (stored.length !== input.length || changed) {
    throw new ApiError(422, code);
  }
}

// PUT /api/tenant/trade/v1/<sales-orders|purchase-orders>/:id/lines (If-Match, x-idempotency-key). In place, as
// trade-app replaceOrderLinesInPlace: kept clientLineIds update their rows, missing ones are soft-deleted (their ids
// can never come back), new ids insert. Lines copied from a source document are locked.
export async function fakeReplaceOrderLines<K extends 'sales-order' | 'purchase-order'>(
  kind: K,
  id: string,
  expectedVersion: number,
  body: ReplaceOrderLinesBody,
  _idempotencyKey?: string,
): Promise<DocumentDetailByKind[K]> {
  await fakeDelay();
  if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > MAX_LINES) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  if (kind === 'sales-order') {
    const so = findSalesOrder(id);
    assertValidVersion(so.version, expectedVersion);
    if (so.lifecycleStatus !== 'DRAFT') {
      throw new ApiError(409, 'TRADE.SALES_ORDER.TRANSITION_NOT_ALLOWED');
    }
    assertValidTermsNotes(body.notes);
    assertValidTermsNotes(body.terms?.notes);
    assertFreshClientLineIds(so.id, body.lines);

    if (so.sourceQuotationId !== null) {
      if (body.lines.length !== so.lines.length) {
        throw new ApiError(422, 'TRADE.SALES_ORDER.SOURCE_LINES_LOCKED');
      }
      const existingByClientId = new Map(so.lines.map((l) => [l.clientLineId, l]));
      for (const line of body.lines) {
        const orig = existingByClientId.get(line.clientLineId);
        if (
          !orig ||
          orig.itemId !== line.itemId ||
          orig.uomId !== line.uomId ||
          cmp(orig.orderedQuantity, line.quantity) !== 0 ||
          (line.unitPrice !== undefined && cmp(orig.unitPrice, line.unitPrice) !== 0) ||
          cmp(orig.discountTotal ?? '0', line.financial.discountTotal) !== 0
        ) {
          throw new ApiError(422, 'TRADE.SALES_ORDER.SOURCE_LINES_LOCKED');
        }
      }
    }

    const preview = await computeOrderPreviewInternal('sales-order', {
      partyId: so.partyId,
      currencyCode: so.currencyCode,
      sourceQuotationId: so.sourceQuotationId,
      lines: body.lines.map((l) => ({
        clientLineId: l.clientLineId,
        itemId: l.itemId,
        uomId: l.uomId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountTotal: l.financial.discountTotal,
        chargeTotal: l.financial.chargeTotal,
        tax: { category: l.financial.taxSnapshot.category, rateBps: l.financial.taxSnapshot.rateBps },
      })),
    });

    if (body.expectedPricingFingerprint && body.expectedPricingFingerprint !== preview.fingerprint) {
      throw new ApiError(409, 'TRADE.PRICE.PREVIEW_CHANGED');
    }

    const verifyEntries: {
      clientLineId: string;
      quantity: Dec;
      unitPrice: Dec;
      taxDefault: TaxDefault | null;
      financial: LineEvidence;
    }[] = [];
    const nextLines: SalesOrderLine[] = [];

    for (let idx = 0; idx < body.lines.length; idx += 1) {
      const input = body.lines[idx];
      assertPositiveDecimal(input.quantity);
      const summary = await fetchItemSummary(input.itemId, so.companyId);
      const unitPrice = input.unitPrice ?? preview.lines[idx].unitPrice;
      verifyEntries.push({
        clientLineId: input.clientLineId,
        quantity: input.quantity,
        unitPrice,
        taxDefault: summary.salesTaxDefault,
        financial: input.financial,
      });
      const existing = so.lines.find((l) => l.clientLineId === input.clientLineId);
      nextLines.push({
        id: existing?.id ?? fakeId(),
        clientLineId: input.clientLineId,
        itemId: summary.id,
        itemCompanyProfileId: fakeItemProfileId(summary.id),
        printLineNumber: idx + 1,
        descriptionSnapshot: existing?.descriptionSnapshot ?? itemName(summary, 'en'),
        uomId: input.uomId,
        uomLabel: uomLabelOf(input.uomId),
        orderedQuantity: input.quantity,
        allocatedQuantity: '0',
        fulfilledQuantity: '0',
        invoicedQuantity: '0',
        cancelledQuantity: '0',
        unitPrice,
        discountTotal: input.financial.discountTotal,
        chargeTotal: input.financial.chargeTotal,
        taxTotal: input.financial.taxTotal,
        lineTotal: input.financial.lineTotal,
        taxSnapshot: input.financial.taxSnapshot,
        itemLabel: itemLabelOf(summary),
      });
    }

    verifyFinancialEvidence(verifyEntries, body.totals, so.currencyCode, false);
    if (body.termSelections !== undefined || body.terms !== undefined || body.notes !== undefined) {
      so.termsSnapshot = await resolveTermsSnapshot(so.companyId, 'sales-order', body, false);
    }
    recordRemovedClientLineIds(so.id, so.lines, nextLines);
    so.lines = nextLines;
    so.totalsSnapshot = toTotalsSnapshot(body.totals, so.currencyCode);
    so.grandTotal = body.totals.grandTotal;
    bumpVersion(so);
    return projectOrderDetail(so) as DocumentDetailByKind[K];
  }

  const po = findPurchaseOrder(id);
  assertValidVersion(po.version, expectedVersion);
  if (po.lifecycleStatus !== 'DRAFT') {
    throw new ApiError(409, 'TRADE.PURCHASE_ORDER.TRANSITION_NOT_ALLOWED');
  }
  if (po.approvalStatus === 'PENDING') {
    throw new ApiError(409, 'TRADE.PURCHASE_ORDER.APPROVAL_INVALID');
  }
  assertValidTermsNotes(body.notes);
  assertValidTermsNotes(body.terms?.notes);
  assertFreshClientLineIds(po.id, body.lines);
  if (po.sourcePurchaseQuotationId !== null) {
    assertSourceLinesUnchanged(po.lines, body.lines, 'TRADE.PURCHASE_ORDER.SOURCE_LINES_LOCKED');
  }

  const preview = await computeOrderPreviewInternal('purchase-order', {
    partyId: po.partyId,
    currencyCode: po.currencyCode,
    sourcePurchaseQuotationId: po.sourcePurchaseQuotationId,
    lines: body.lines.map((l) => ({
      clientLineId: l.clientLineId,
      itemId: l.itemId,
      uomId: l.uomId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountTotal: '0',
      chargeTotal: l.financial.chargeTotal,
      tax: { category: l.financial.taxSnapshot.category, rateBps: l.financial.taxSnapshot.rateBps },
    })),
  });

  if (body.expectedPricingFingerprint && body.expectedPricingFingerprint !== preview.fingerprint) {
    throw new ApiError(409, 'TRADE.PRICE.PREVIEW_CHANGED');
  }

  const verifyEntries: {
    clientLineId: string;
    quantity: Dec;
    unitPrice: Dec;
    taxDefault: TaxDefault | null;
    financial: LineEvidence;
  }[] = [];
  const nextLines: PurchaseOrderLine[] = [];

  for (let idx = 0; idx < body.lines.length; idx += 1) {
    const input = body.lines[idx];
    assertPositiveDecimal(input.quantity);
    const summary = await fetchItemSummary(input.itemId, po.companyId);
    const unitPrice = input.unitPrice ?? preview.lines[idx].unitPrice;
    verifyEntries.push({
      clientLineId: input.clientLineId,
      quantity: input.quantity,
      unitPrice,
      taxDefault: summary.purchaseTaxDefault,
      financial: input.financial,
    });
    const existing = po.lines.find((l) => l.clientLineId === input.clientLineId);
    nextLines.push({
      id: existing?.id ?? fakeId(),
      clientLineId: input.clientLineId,
      itemId: summary.id,
      itemCompanyProfileId: fakeItemProfileId(summary.id),
      printLineNumber: idx + 1,
      descriptionSnapshot: existing?.descriptionSnapshot ?? itemName(summary, 'en'),
      uomId: input.uomId,
      uomLabel: uomLabelOf(input.uomId),
      orderedQuantity: input.quantity,
      receivedQuantity: '0',
      cancelledQuantity: '0',
      unitPrice,
      chargeTotal: input.financial.chargeTotal,
      taxTotal: input.financial.taxTotal,
      lineTotal: input.financial.lineTotal,
      taxSnapshot: input.financial.taxSnapshot,
      expectedDate: input.expectedDate ?? existing?.expectedDate ?? null,
      receivingNodeId: input.receivingNodeId ?? existing?.receivingNodeId ?? po.receivingNodeId,
      itemLabel: itemLabelOf(summary),
    });
  }

  verifyFinancialEvidence(verifyEntries, body.totals, po.currencyCode, true);
  if (body.termSelections !== undefined || body.terms !== undefined || body.notes !== undefined) {
    po.termsSnapshot = await resolveTermsSnapshot(po.companyId, 'purchase-order', body, false);
  }
  recordRemovedClientLineIds(po.id, po.lines, nextLines);
  po.lines = nextLines;
  po.totalsSnapshot = toTotalsSnapshot(body.totals, po.currencyCode);
  po.grandTotal = body.totals.grandTotal;
  po.approvalStatus = 'NOT_REQUIRED';
  po.approvalReady = false;
  po.submittedBy = null;
  po.submittedAt = null;
  bumpVersion(po);

  return projectOrderDetail(po) as DocumentDetailByKind[K];
}

// ---------------------------------------------------------------------------
// Purchase Quotations
// ---------------------------------------------------------------------------

async function buildPricedPurchaseQuotationLines(
  companyId: string,
  currencyCode: string,
  inputs: readonly CreatePurchaseQuotationLineInput[],
): Promise<{ lines: PurchaseQuotationLine[]; totals: TotalsSnapshot }> {
  const dp = currencyDecimals(currencyCode);
  const lines: PurchaseQuotationLine[] = [];
  let sumTotal: Dec = '0';

  for (let idx = 0; idx < inputs.length; idx += 1) {
    const input = inputs[idx];
    assertPositiveDecimal(input.quantity);
    const summary = await fetchItemSummary(input.itemId, companyId);
    const unitPrice = computeUnitPriceFromSummary('PURCHASE', summary, input.uomId, currencyCode);
    const lineTotal = round(mul(input.quantity, unitPrice, 8), dp);
    sumTotal = add(sumTotal, lineTotal);
    lines.push({
      id: fakeId(),
      clientLineId: input.clientLineId,
      itemId: summary.id,
      itemCompanyProfileId: fakeItemProfileId(summary.id),
      printLineNumber: idx + 1,
      quantity: input.quantity,
      uomId: input.uomId,
      uomLabel: uomLabelOf(input.uomId),
      unitPrice,
      lineTotal,
      descriptionSnapshot: input.description?.trim() || itemName(summary, 'en'),
      itemLabel: itemLabelOf(summary),
    });
  }

  const grandTotal = round(sumTotal, dp);
  const totals: TotalsSnapshot = {
    subtotal: sumTotal,
    discountTotal: '0',
    chargeTotal: '0',
    taxTotal: '0',
    roundingTotal: sub(grandTotal, sumTotal),
    grandTotal,
    amountPaid: '0',
    amountDue: grandTotal,
    currencyDecimalPlaces: dp,
  };

  return { lines, totals };
}

// POST /api/tenant/trade/v1/purchase-quotations (x-idempotency-key)
export async function fakeCreatePurchaseQuotation(
  body: CreatePurchaseQuotationBody,
  _idempotencyKey?: string,
): Promise<PurchaseQuotationDetail> {
  await fakeDelay();
  const supplier = findSupplierSeed(body.supplierPartyId);
  if (!supplier) {
    throw new ApiError(422, 'TRADE.PURCHASE_ORDER.SUPPLIER_ACCOUNT_REQUIRED');
  }
  if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > MAX_LINES) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  assertValidTermsNotes(body.notes);
  assertValidTermsNotes(body.terms?.notes);

  const { companyId, branchId } = readActiveScope();
  const { lines, totals } = await buildPricedPurchaseQuotationLines(companyId, body.currencyCode, body.lines);
  const termsSnapshot = await resolveTermsSnapshot(
    companyId,
    'purchase-quotation',
    { termSelections: body.termSelections, notes: body.notes ?? undefined, terms: body.terms },
    false,
  );
  const now = nowIso();

  const created: PurchaseQuotationDetail = {
    id: fakeId(),
    version: 1,
    companyId,
    branchId,
    partyId: supplier.partyId,
    currencyCode: body.currencyCode,
    businessDate: now.slice(0, 10),
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    partySnapshot: { id: supplier.partyId, displayName: supplier.en },
    createdAt: now,
    updatedAt: now,
    reference: body.reference?.trim() || null,
    notes: body.notes?.trim() || null,
    validUntil: body.validUntil,
    finalizedAt: null,
    convertedPurchaseOrderId: null,
    termsSnapshot,
    totalsSnapshot: totals,
    lines,
    reasonHistory: [],
  };

  purchaseQuotationsStore.unshift(created);
  return projectPurchaseQuotationDetail(created);
}

// PATCH /api/tenant/trade/v1/purchase-quotations/:id (If-Match, x-idempotency-key)
export async function fakeUpdatePurchaseQuotation(
  id: string,
  expectedVersion: number,
  body: UpdatePurchaseQuotationBody,
  _idempotencyKey?: string,
): Promise<PurchaseQuotationDetail> {
  await fakeDelay();
  const pq = findPurchaseQuotation(id);
  if (pq.lifecycleStatus === 'ISSUED') {
    throw new ApiError(409, 'TRADE.PURCHASE_QUOTATION.DRAFT_NOT_MUTABLE');
  }
  if (pq.lifecycleStatus !== 'DRAFT') {
    throw new ApiError(409, 'TRADE.PURCHASE_QUOTATION.TRANSITION_NOT_ALLOWED');
  }
  assertValidVersion(pq.version, expectedVersion);

  const supplierChanged = body.supplierPartyId !== undefined && body.supplierPartyId !== pq.partyId;
  const currencyChanged = body.currencyCode !== undefined && body.currencyCode !== pq.currencyCode;
  if ((supplierChanged || currencyChanged) && !body.lines) {
    throw new ApiError(422, 'TRADE.PURCHASE_QUOTATION.REPRICING_REQUIRED');
  }
  assertValidTermsNotes(body.notes);
  assertValidTermsNotes(body.terms?.notes);

  if (body.supplierPartyId !== undefined) {
    const sup = findSupplierSeed(body.supplierPartyId);
    if (!sup) {
      throw new ApiError(422, 'TRADE.PURCHASE_ORDER.SUPPLIER_ACCOUNT_REQUIRED');
    }
    pq.partyId = sup.partyId;
    pq.partySnapshot = { id: sup.partyId, displayName: sup.en };
  }
  if (body.currencyCode !== undefined) {
    pq.currencyCode = body.currencyCode;
  }
  if (body.validUntil !== undefined) {
    pq.validUntil = body.validUntil;
  }
  if (body.reference !== undefined) {
    pq.reference = body.reference?.trim() || null;
  }
  if (body.notes !== undefined) {
    pq.notes = body.notes?.trim() || null;
  }
  if (body.termSelections !== undefined || body.terms !== undefined || body.notes !== undefined) {
    pq.termsSnapshot = await resolveTermsSnapshot(
      pq.companyId,
      'purchase-quotation',
      { termSelections: body.termSelections, notes: body.notes ?? undefined, terms: body.terms },
      false,
    );
  }
  if (body.lines) {
    if (body.lines.length < 1 || body.lines.length > MAX_LINES) {
      throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
    }
    const repriced = await buildPricedPurchaseQuotationLines(pq.companyId, pq.currencyCode, body.lines);
    pq.lines = repriced.lines;
    pq.totalsSnapshot = repriced.totals;
  }

  bumpVersion(pq);
  return projectPurchaseQuotationDetail(pq);
}

// POST /api/tenant/trade/v1/purchase-quotations/:id/issue (If-Match, x-idempotency-key)
export async function fakeIssuePurchaseQuotation(
  id: string,
  expectedVersion: number,
  opts?: FakeCallOptions,
): Promise<PurchaseQuotationDetail> {
  await maybeDelay(opts);
  const pq = findPurchaseQuotation(id);
  // purchase-quotations.service.ts issue: any non-draft is 409 DRAFT_NOT_MUTABLE.
  if (pq.lifecycleStatus !== 'DRAFT') {
    throw new ApiError(409, 'TRADE.PURCHASE_QUOTATION.DRAFT_NOT_MUTABLE');
  }
  assertValidVersion(pq.version, expectedVersion);

  if (pq.lines.length === 0) {
    throw new ApiError(422, 'TRADE.VALIDATION_FAILED');
  }

  if (!pq.documentNumber) {
    pq.documentNumber = nextDocumentNumber('purchase-quotation');
  }
  pq.lifecycleStatus = 'ISSUED';
  pq.finalizedAt = nowIso();
  bumpVersion(pq);

  return projectPurchaseQuotationDetail(pq);
}

// POST /api/tenant/trade/v1/purchase-quotations/:id/cancel (If-Match, x-idempotency-key); pending backend run documents-pq-cancel
export async function fakeCancelPurchaseQuotation(
  id: string,
  expectedVersion: number,
  reason: ReasonInput,
  opts?: FakeCallOptions,
): Promise<PurchaseQuotationDetail> {
  await maybeDelay(opts);
  const pq = findPurchaseQuotation(id);
  assertValidVersion(pq.version, expectedVersion);

  // Backend purchase-quotations.service.ts cancel: ISSUED only, else 409 CANCEL_NOT_ALLOWED.
  if (pq.lifecycleStatus !== 'ISSUED') {
    throw new ApiError(409, 'TRADE.PURCHASE_QUOTATION.CANCEL_NOT_ALLOWED');
  }

  appendReasonHistory(pq.reasonHistory, 'PQ_CANCEL', REASON_KIND_BY_ACTION['PURCHASE_QUOTATION_CANCEL'], reason);
  pq.lifecycleStatus = 'CANCELLED';
  bumpVersion(pq);

  return projectPurchaseQuotationDetail(pq);
}

// POST /api/tenant/trade/v1/purchase-quotations/:id/convert-to-purchase-order (If-Match, x-idempotency-key)
export async function fakeConvertPurchaseQuotation(
  id: string,
  expectedVersion: number,
  body: ConvertPurchaseQuotationBody,
  _idempotencyKey?: string,
): Promise<PurchaseOrderDetail> {
  await fakeDelay();
  const pq = findPurchaseQuotation(id);
  assertValidVersion(pq.version, expectedVersion);

  if (pq.lifecycleStatus === 'CONVERTED') {
    throw new ApiError(
      409,
      'TRADE.PURCHASE_QUOTATION.ALREADY_CONVERTED',
      pq.convertedPurchaseOrderId ? { purchaseOrderId: [pq.convertedPurchaseOrderId] } : undefined,
    );
  }
  if (pq.lifecycleStatus !== 'ISSUED') {
    throw new ApiError(409, 'TRADE.PURCHASE_QUOTATION.TRANSITION_NOT_ALLOWED');
  }

  const supplier = findSupplierSeed(pq.partyId);
  if (!supplier || !body.supplierAccountId || !supplier.accounts.some((a) => a.id === body.supplierAccountId)) {
    throw new ApiError(422, 'TRADE.PURCHASE_ORDER.SUPPLIER_ACCOUNT_REQUIRED');
  }
  if (!body.receivingNodeId || body.lines.length !== pq.lines.length) {
    throw new ApiError(422, 'TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE');
  }
  assertValidTermsNotes(body.notes);

  const pqLineByClientId = new Map(pq.lines.map((l) => [l.clientLineId, l]));
  const verifyEntries: {
    clientLineId: string;
    quantity: Dec;
    unitPrice: Dec;
    taxDefault: TaxDefault | null;
    financial: LineEvidence;
  }[] = [];
  const orderLines: PurchaseOrderLine[] = [];

  for (let idx = 0; idx < body.lines.length; idx += 1) {
    const input = body.lines[idx];
    const pql = pqLineByClientId.get(input.clientLineId);
    if (!pql) {
      throw new ApiError(422, 'TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE');
    }
    const summary = await fetchItemSummary(pql.itemId, pq.companyId);
    verifyEntries.push({
      clientLineId: input.clientLineId,
      quantity: pql.quantity,
      unitPrice: pql.unitPrice,
      taxDefault: summary.purchaseTaxDefault,
      financial: input.financial,
    });
    orderLines.push({
      id: fakeId(),
      clientLineId: pql.clientLineId,
      itemId: summary.id,
      itemCompanyProfileId: fakeItemProfileId(summary.id),
      printLineNumber: idx + 1,
      descriptionSnapshot: pql.descriptionSnapshot,
      uomId: pql.uomId,
      uomLabel: uomLabelOf(pql.uomId),
      orderedQuantity: pql.quantity,
      receivedQuantity: '0',
      cancelledQuantity: '0',
      unitPrice: pql.unitPrice,
      chargeTotal: input.financial.chargeTotal,
      taxTotal: input.financial.taxTotal,
      lineTotal: input.financial.lineTotal,
      taxSnapshot: input.financial.taxSnapshot,
      expectedDate: input.expectedDate ?? null,
      receivingNodeId: input.receivingNodeId ?? body.receivingNodeId,
      itemLabel: itemLabelOf(summary),
    });
  }

  verifyFinancialEvidence(verifyEntries, body.totals, pq.currencyCode, true);

  const poTerms = body.termSelections
    ? await resolveTermsSnapshot(
        pq.companyId,
        'purchase-order',
        { termSelections: body.termSelections, notes: body.notes },
        false,
      )
    : clone(pq.termsSnapshot ?? seedTermsSnapshot('PURCHASE'));

  const now = nowIso();
  const createdOrder: PurchaseOrderDetail = {
    id: fakeId(),
    version: 1,
    companyId: pq.companyId,
    branchId: pq.branchId,
    partyId: pq.partyId,
    contactPartyId: null,
    currencyCode: pq.currencyCode,
    businessDate: now.slice(0, 10),
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    draftReference: body.draftReference !== undefined ? body.draftReference?.trim() || null : pq.reference ?? null,
    grandTotal: body.totals.grandTotal,
    partySnapshot: clone(pq.partySnapshot),
    createdAt: now,
    updatedAt: now,
    extensionValues: {},
    approvalStatus: 'NOT_REQUIRED',
    supplierAccountId: body.supplierAccountId,
    receivingNodeId: body.receivingNodeId,
    dispatchStatus: 'NOT_REQUESTED',
    fulfillmentStatus: 'NONE',
    billingStatus: 'NONE',
    termsSnapshot: poTerms,
    totalsSnapshot: toTotalsSnapshot(body.totals, pq.currencyCode),
    sourcePurchaseQuotationId: pq.id,
    createdBy: FAKE_CURRENT_USER_ID,
    submittedBy: null,
    submittedAt: null,
    lines: orderLines,
    approvalReady: false,
    delivery: null,
    reasonHistory: [],
  };

  purchaseOrdersStore.unshift(createdOrder);
  pq.lifecycleStatus = 'CONVERTED';
  pq.convertedPurchaseOrderId = createdOrder.id;
  bumpVersion(pq);

  return projectOrderDetail(createdOrder);
}

// POST /api/tenant/trade/v1/purchase-quotations/:id/create-purchase-order (If-Match, x-idempotency-key)
export async function fakeCreatePurchaseOrderFromPurchaseQuotation(
  purchaseQuotationId: string,
  expectedVersion: number,
  body: DirectPurchaseOrderFromPurchaseQuotationBody,
  _idempotencyKey?: string,
): Promise<PurchaseOrderDetail> {
  await fakeDelay();
  const pq = findPurchaseQuotation(purchaseQuotationId);
  assertValidVersion(pq.version, expectedVersion);

  if (pq.lifecycleStatus === 'CONVERTED') {
    throw new ApiError(
      409,
      'TRADE.PURCHASE_QUOTATION.ALREADY_CONVERTED',
      pq.convertedPurchaseOrderId ? { purchaseOrderId: [pq.convertedPurchaseOrderId] } : undefined,
    );
  }
  if (pq.lifecycleStatus !== 'ISSUED') {
    throw new ApiError(409, 'TRADE.PURCHASE_QUOTATION.TRANSITION_NOT_ALLOWED');
  }

  const supplier = findSupplierSeed(pq.partyId);
  const matchingAccount =
    (body.supplierAccountId
      ? supplier?.accounts.find((a) => a.id === body.supplierAccountId)
      : undefined) ??
    supplier?.accounts.find((a) => a.currencyCode === pq.currencyCode) ??
    supplier?.accounts[0];

  if (!matchingAccount) {
    throw new ApiError(422, 'TRADE.PURCHASE_ORDER.SUPPLIER_ACCOUNT_REQUIRED');
  }

  const receivingNodeId = body.receivingNodeId || RECEIVING_NODES[0].id;
  const orderLines: PurchaseOrderLine[] = [];
  const lineEvidences: LineEvidence[] = [];

  for (let idx = 0; idx < pq.lines.length; idx += 1) {
    const pql = pq.lines[idx];
    const summary = await fetchItemSummary(pql.itemId, pq.companyId);
    if (summary.purchaseTaxDefault?.isInclusive) {
      throw new ApiError(422, 'TRADE.TAX.INCLUSIVE_NOT_SUPPORTED', {
        clientLineId: [pql.clientLineId],
      });
    }

    const ev = lineEvidence(
      {
        quantity: pql.quantity,
        unitPrice: pql.unitPrice,
        discountTotal: '0',
        chargeTotal: '0',
        taxDefault: summary.purchaseTaxDefault,
      },
      pq.currencyCode,
    );

    lineEvidences.push(ev);
    orderLines.push({
      id: fakeId(),
      clientLineId: pql.clientLineId,
      itemId: summary.id,
      itemCompanyProfileId: fakeItemProfileId(summary.id),
      printLineNumber: idx + 1,
      descriptionSnapshot: pql.descriptionSnapshot,
      uomId: pql.uomId,
      uomLabel: uomLabelOf(pql.uomId),
      orderedQuantity: pql.quantity,
      receivedQuantity: '0',
      cancelledQuantity: '0',
      unitPrice: pql.unitPrice,
      chargeTotal: ev.chargeTotal,
      taxTotal: ev.taxTotal,
      lineTotal: ev.lineTotal,
      taxSnapshot: ev.taxSnapshot,
      expectedDate: null,
      receivingNodeId,
      itemLabel: itemLabelOf(summary),
    });
  }

  const totals = totalsEvidence(lineEvidences, currencyDecimals(pq.currencyCode));
  const now = nowIso();

  const createdOrder: PurchaseOrderDetail = {
    id: fakeId(),
    version: 1,
    companyId: pq.companyId,
    branchId: pq.branchId,
    partyId: pq.partyId,
    contactPartyId: null,
    currencyCode: pq.currencyCode,
    businessDate: now.slice(0, 10),
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    draftReference: body.draftReference !== undefined ? body.draftReference?.trim() || null : pq.reference ?? null,
    grandTotal: totals.grandTotal,
    partySnapshot: clone(pq.partySnapshot),
    createdAt: now,
    updatedAt: now,
    extensionValues: {},
    approvalStatus: 'NOT_REQUIRED',
    supplierAccountId: matchingAccount.id,
    receivingNodeId,
    dispatchStatus: 'NOT_REQUESTED',
    fulfillmentStatus: 'NONE',
    billingStatus: 'NONE',
    termsSnapshot: clone(pq.termsSnapshot ?? seedTermsSnapshot('PURCHASE')),
    totalsSnapshot: toTotalsSnapshot(totals, pq.currencyCode),
    sourcePurchaseQuotationId: pq.id,
    createdBy: FAKE_CURRENT_USER_ID,
    submittedBy: null,
    submittedAt: null,
    lines: orderLines,
    approvalReady: false,
    delivery: null,
    reasonHistory: [],
  };

  purchaseOrdersStore.unshift(createdOrder);
  pq.lifecycleStatus = 'CONVERTED';
  pq.convertedPurchaseOrderId = createdOrder.id;
  bumpVersion(pq);

  return projectOrderDetail(createdOrder);
}

// ---------------------------------------------------------------------------
// PDF render jobs & templates
// ---------------------------------------------------------------------------

function isDocumentPrintable(kind: DocumentKind, doc: AnyDocumentDetail): boolean {
  switch (kind) {
    case 'quotation':
      return (
        doc.lifecycleStatus === 'SENT' ||
        doc.lifecycleStatus === 'ACCEPTED' ||
        doc.lifecycleStatus === 'REJECTED' ||
        doc.lifecycleStatus === 'CONVERTED'
      );
    case 'sales-order':
    case 'purchase-order':
      return doc.lifecycleStatus === 'CONFIRMED' || doc.lifecycleStatus === 'CLOSED';
    case 'purchase-quotation':
      return doc.lifecycleStatus === 'ISSUED';
  }
}

// Test/demo hook: the next `count` quotation render requests fail as if the PDF worker were unreachable (503).
let pdfRenderUnavailableRemaining = 0;
export function fakeSimulatePdfRenderUnavailable(count = 1): void {
  pdfRenderUnavailableRemaining = Math.max(0, count);
}

// Which kinds have a published default template assignment in the fake tenant (all four by default).
const kindsWithoutDefaultAssignment = new Set<DocumentKind>();
// Test/demo hook: remove (or restore) the default template assignment of one document kind.
export function fakeSetPrintDefaultAssignment(kind: DocumentKind, assigned: boolean): void {
  if (assigned) kindsWithoutDefaultAssignment.delete(kind);
  else kindsWithoutDefaultAssignment.add(kind);
}

// POST /api/tenant/trade/v1/<segment>/:id/render-pdf (202, x-idempotency-key)
export async function fakeRenderPdf(
  kind: DocumentKind,
  id: string,
  body: RenderPdfBody,
  opts?: FakeCallOptions,
): Promise<RenderJob> {
  await maybeDelay(opts);
  const store = listStoreForKind(kind);
  const doc = store.find((d) => d.id === id);
  if (!doc) {
    switch (kind) {
      case 'quotation':
        throw new ApiError(404, 'TRADE.QUOTE.NOT_FOUND');
      case 'sales-order':
        throw new ApiError(404, 'TRADE.SALES_ORDER.SOURCE_NOT_FOUND');
      case 'purchase-order':
        throw new ApiError(404, 'TRADE.PURCHASE_ORDER.NOT_FOUND');
      case 'purchase-quotation':
        throw new ApiError(404, 'TRADE.PURCHASE_QUOTATION.NOT_FOUND');
    }
  }

  if (!isDocumentPrintable(kind, doc)) {
    throw new ApiError(
      409,
      kind === 'quotation'
        ? 'TRADE.QUOTE.PDF_REVISION_NOT_ELIGIBLE'
        : 'TRADE.BUSINESS_DOCUMENT.PDF_SOURCE_NOT_ELIGIBLE',
    );
  }

  // Without templateVersionId the backend uses the default assignment (business-document-pdf.service.ts
  // resolveTemplate). SO/PO/PQ with none fail 422 below; a quotation with none falls back to the built-in layout.
  if (!body.templateVersionId && kind !== 'quotation' && kindsWithoutDefaultAssignment.has(kind)) {
    throw new ApiError(422, 'TRADE.BUSINESS_DOCUMENT.PDF_TEMPLATE_INCOMPATIBLE', {
      reason: ['no_eligible_default_assignment'],
    });
  }

  if (kind === 'quotation' && pdfRenderUnavailableRemaining > 0) {
    pdfRenderUnavailableRemaining -= 1;
    throw new ApiError(503, 'TRADE.QUOTE.PDF_RENDER_UNAVAILABLE');
  }

  const jobId = fakeId();
  const segment = KIND_CONFIG[kind].segment;
  const statusUrl = `/api/tenant/trade/v1/${segment}/${id}/render-jobs/${jobId}`;
  const stored: StoredRenderJob = {
    kind,
    documentId: id,
    job: {
      renderJobId: jobId,
      status: 'PENDING',
      attemptCount: 1,
      statusUrl,
    },
  };
  renderJobsStore.set(jobId, stored);

  setTimeout(() => {
    const entry = renderJobsStore.get(jobId);
    if (!entry || entry.job.status !== 'PENDING') return;
    entry.job = {
      ...entry.job,
      status: 'RETRYING',
      attemptCount: 1,
    };
  }, 1500);

  setTimeout(() => {
    const entry = renderJobsStore.get(jobId);
    if (!entry || (entry.job.status !== 'PENDING' && entry.job.status !== 'RETRYING')) return;
    entry.job = {
      ...entry.job,
      status: 'COMPLETED',
      attemptCount: 1,
      artifact: {
        downloadUrl: VALID_PDF_ARTIFACT.dataUrl,
        downloadExpiresAt: new Date(Date.now() + RENDER_URL_TTL_MS).toISOString(),
        pageCount: 1,
        sizeBytes: VALID_PDF_ARTIFACT.byteLength,
      },
    };
  }, 3000);

  return clone(stored.job);
}

// GET /api/tenant/trade/v1/<segment>/:id/render-jobs/:jobId
export async function fakeGetRenderJob(kind: DocumentKind, id: string, jobId: string): Promise<RenderJob> {
  await fakeDelay(120);
  const stored = renderJobsStore.get(jobId);
  if (!stored || stored.kind !== kind || stored.documentId !== id) {
    throw new ApiError(404, 'TRADE.VALIDATION_FAILED');
  }
  return clone(stored.job);
}

// GET /api/tenant/trade/v1/templates/assignments?purpose=
export async function fakeListPrintTemplates(kind: DocumentKind): Promise<PrintTemplateOption[]> {
  await fakeDelay();
  return clone([...PRINT_TEMPLATES_BY_KIND[kind]]);
}

// ---------------------------------------------------------------------------
// Option lists
// ---------------------------------------------------------------------------

// GET /api/tenant/trade/v1/quotations/customer-options?search&cursor
export async function fakeListCustomerOptions(search?: string, cursor?: string): Promise<CustomerOptionPage> {
  await fakeDelay();
  const lang = fakeLang();
  const needle = search?.trim().toLowerCase() ?? '';
  const all = CUSTOMER_SEEDS.filter((c) => {
    if (!needle) return true;
    return c.en.toLowerCase().includes(needle) || c.ar.toLowerCase().includes(needle);
  }).map<CustomerOption>((c) => ({
    partyId: c.partyId,
    displayName: lang === 'ar' ? c.ar : c.en,
    partyType: c.partyType,
    crmCustomerProfileId: c.crmCustomerProfileId,
    commercialAccountId: c.commercialAccountId,
    accountStatus: c.accountStatus,
    quotationSelectable: c.quotationSelectable,
  }));

  const offset = cursor && /^\d+$/.test(cursor) ? Number(cursor) : 0;
  const pageSize = 25;
  const items = all.slice(offset, offset + pageSize);
  const nextCursor = offset + pageSize < all.length ? String(offset + pageSize) : null;
  return { items, nextCursor };
}

// GET /api/tenant/core/v1/parties/:partyId/contacts
export async function fakeListContactOptions(partyId: string): Promise<ContactOption[]> {
  await fakeDelay();
  const customer = findCustomerSeed(partyId);
  if (customer?.partyType === 'PERSON') {
    return [];
  }
  const lang = fakeLang();
  const contacts = CONTACTS_BY_PARTY[partyId] ?? [];
  return contacts.map((c) => ({
    contactPartyId: c.contactPartyId,
    displayName: lang === 'ar' ? c.ar : c.en,
    email: c.email,
    phone: c.phone,
    role: c.role,
  }));
}

// GET /api/tenant/trade/v1/purchase-orders/supplier-options?search (API v2 B8). Backend blocked (codex-b B8: no account code
// column); coordinator mapping: accounts[].code = null, accounts[].currencyCode = credit currency (nullable). The real
// response is { items: SupplierOption[] }.
export async function fakeListSupplierOptions(search?: string): Promise<SupplierOption[]> {
  await fakeDelay();
  const lang = fakeLang();
  const needle = search?.trim().toLowerCase() ?? '';
  return SUPPLIER_SEEDS.filter((s) => {
    if (!needle) return true;
    return s.en.toLowerCase().includes(needle) || s.ar.toLowerCase().includes(needle);
  }).map((s) => ({
    partyId: s.partyId,
    displayName: lang === 'ar' ? s.ar : s.en,
    accounts: clone(s.accounts),
  }));
}

// GET /api/tenant/crm/v1/opportunities?customerProfileId&status=IN_PROGRESS
export async function fakeListOpportunityOptions(customerPartyId: string): Promise<SourceCrmOpportunity[]> {
  await fakeDelay();
  if (!customerPartyId) return [];
  const cust =
    CUSTOMER_SEEDS.find(
      (c) => c.partyId === customerPartyId || c.crmCustomerProfileId === customerPartyId,
    ) ?? null;
  if (!cust) return [];
  const lang = fakeLang();
  const list = OPPORTUNITIES_BY_CUSTOMER[cust.partyId] ?? [];
  return list.map((o) => ({
    id: o.id,
    name: lang === 'ar' ? o.ar : o.en,
    stageName: lang === 'ar' ? o.stageAr : o.stageEn,
    status: o.status,
  }));
}

// GET /api/tenant/crm/v1/opportunities/:id (403/404 → null)
export async function fakeGetOpportunity(id: string): Promise<SourceCrmOpportunity | null> {
  await fakeDelay();
  const trimmed = id.trim();
  if (!trimmed) return null;
  const lang = fakeLang();
  for (const list of Object.values(OPPORTUNITIES_BY_CUSTOMER)) {
    const seed = list.find((o) => o.id === trimmed);
    if (seed) {
      return {
        id: seed.id,
        name: lang === 'ar' ? seed.ar : seed.en,
        stageName: lang === 'ar' ? seed.stageAr : seed.stageEn,
        status: seed.status,
      };
    }
  }
  return null;
}

// GET /api/tenant/trade/v1/inventory/nodes?status=ACTIVE (bare array, ordered by code)
export async function fakeListReceivingNodes(): Promise<ReceivingNodeOption[]> {
  await fakeDelay();
  const lang = fakeLang();
  return RECEIVING_NODES.slice()
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((node) => ({
      id: node.id,
      code: node.code,
      name: lang === 'ar' ? node.ar : node.en,
      status: node.status,
    }));
}

// POST /api/tenant/trade/v1/pricing/evaluate
export async function fakeEvaluatePrice(
  purpose: 'SALES' | 'PURCHASE',
  itemId: string,
  uomId: string,
  quantity: Dec,
  currencyCode: string,
): Promise<{ unitPrice: Dec }> {
  await fakeDelay();
  assertPositiveDecimal(quantity);
  const { companyId } = readActiveScope();
  const summary = await fetchItemSummary(itemId, companyId);
  return {
    unitPrice: computeUnitPriceFromSummary(purpose, summary, uomId, currencyCode),
  };
}

// ---------------------------------------------------------------------------
// Bulk print artifact & bulk module support helpers
// ---------------------------------------------------------------------------

function bulkLabelFor(doc: AnyDocumentDetail): string {
  // trade-documents-bulk.handler.ts resolve: (documentNumber ?? id).slice(0, 200).
  return (doc.documentNumber ?? doc.id).slice(0, 200);
}

function bulkDataFor(kind: DocumentKind, doc: AnyDocumentDetail): Record<string, string | number | null> {
  const currentRevisionId = kind === 'quotation' ? (doc as QuotationDetail).currentRevisionId : null;
  return {
    version: doc.version,
    lifecycleStatus: doc.lifecycleStatus,
    documentNumber: doc.documentNumber,
    currentRevisionId,
    approvalStatus: kind === 'purchase-order' ? (doc as PurchaseOrderDetail).approvalStatus : null,
    updatedAt: doc.updatedAt,
  };
}

export async function fakeSelectDocumentsForBulk(
  kind: DocumentKind,
  query: Partial<ListQuery>,
  limit: number,
): Promise<{ items: BulkResolvedDocument[]; truncated: boolean }> {
  const sorted = filterAndSortDocuments(kind, query);
  const truncated = sorted.length > limit;
  const slice = sorted.slice(0, limit).map((doc) => ({
    entityId: doc.id,
    label: bulkLabelFor(doc),
    data: bulkDataFor(kind, doc),
  }));
  return { items: slice, truncated };
}

export async function fakeGetDocumentForBulk(
  kind: DocumentKind,
  id: string,
): Promise<BulkResolvedDocument | null> {
  const doc = listStoreForKind(kind).find((d) => d.id === id);
  if (!doc) return null;
  return {
    entityId: doc.id,
    label: bulkLabelFor(doc),
    data: bulkDataFor(kind, doc),
  };
}

export async function fakeProjectCurrentDocuments(
  kind: DocumentKind,
  entityIds: readonly string[],
): Promise<Map<string, Record<string, string | number | null>>> {
  const byId = new Map(listStoreForKind(kind).map((doc) => [doc.id, doc]));
  const result = new Map<string, Record<string, string | number | null>>();
  for (const id of entityIds) {
    const found = byId.get(id);
    if (found) {
      result.set(id, bulkDataFor(kind, found));
    }
  }
  return result;
}

export function fakeValidateReasonForBulk(expectedKind: ReasonKind, input: ReasonInput | undefined): void {
  validateReasonInput(expectedKind, input);
}
