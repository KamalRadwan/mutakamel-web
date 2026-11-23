import {
  computed,
  inject,
  resource,
  signal,
  type ResourceRef,
  type ResourceStatus,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import type { CoreQuery } from '../../../../core/api/core-http';
import { LanguageState } from '../../../../core/i18n/language';
import { ScopeState } from '../../../../core/scope/scope';
import { registerFakeBulkModuleLoader } from '../../../../shared/bulk-jobs/bulk-jobs.fake';
import { termSelectionsBody } from '../../shared/terms/terms.model';
import { crmHttp } from '../../../crm/shared/crm-http';
import {
  ifMatch,
  newIdempotencyKey,
  scopeFor,
  toTradeError,
  tradeContext,
  type TradeContext,
} from '../../shared/trade-api';
import { tradeCore, tradeHttp } from '../../shared/trade-http';
import { add, mul, sub } from './decimal';
import { KIND_CONFIG } from './document-kinds';
import type {
  Dec,
  DocumentByKind,
  DocumentDetailByKind,
  DocumentKind,
  LineEvidence,
  ListQuery,
  OrderPreview,
  OrderPreviewLine,
  OrderPreviewTaxDefault,
  Page,
  PricingIntent,
  PrintTemplateOption,
  PurchaseOrderDetail,
  PurchaseQuotationDetail,
  QuotationDetail,
  RenderJob,
  SalesOrder,
  SalesOrderDetail,
  SourceCrmOpportunity,
  TaxSnapshot,
  TermSelections,
  TermsSnapshot,
  TermsSnapshotV2,
  TotalsEvidence,
} from './document.model';
import {
  FAKE_CURRENT_USER_ID,
  fakeFindSalesOrderByQuotation,
  setDocumentInvalidationListener,
  type BulkPrintArtifact,
  type ConfirmSalesOrderResult,
  type ConvertPurchaseQuotationBody,
  type ConvertPurchaseQuotationLineInput,
  type ConvertQuotationBody,
  type ConvertQuotationLineInput,
  type CreatePurchaseOrderBody,
  type CreatePurchaseOrderLineInput,
  type CreatePurchaseQuotationBody,
  type CreatePurchaseQuotationLineInput,
  type CreateQuotationBody,
  type CreateQuotationRevisionBody,
  type CreateQuotationRevisionLineInput,
  type CreateQuotationRevisionResult,
  type CreateSalesOrderBody,
  type CreateSalesOrderLineInput,
  type DirectPurchaseOrderFromPurchaseQuotationBody,
  type DirectSalesOrderFromQuotationBody,
  type DocumentStatusCountFilters,
  type DocumentStatusCounts,
  type OrderPricingPreviewBody,
  type OrderPricingPreviewLineInput,
  type PurchaseOrderActionKind,
  type QuotationActionKind,
  type QuotationPricingPreview,
  type QuotationPricingPreviewLine,
  type QuotationPricingPreviewLineInput,
  type ReasonInput,
  type ReceivingNodeOption,
  type RenderPdfBody,
  type ReplaceOrderLinesBody,
  type ReplaceOrderLinesLineInput,
  type SalesOrderActionKind,
  type SupplierAccountOption,
  type SupplierOption,
  type UpdatePurchaseOrderBody,
  type UpdatePurchaseQuotationBody,
  type UpdateQuotationBody,
  type UpdateSalesOrderBody,
} from './documents.fake';

export interface DiscountPolicyLimit {
  id?: string;
  version?: number;
  maxPercent: Dec;
  allowFreeItems: boolean;
  reasonRequired: boolean;
}

export interface QuotationPricingPreviewBody {
  partyId?: string | null;
  crmCustomerProfileId?: string | null;
  currencyCode: string;
  lines: QuotationPricingPreviewLineInput[];
  pricing?: PricingIntent;
}

export interface DiscountPolicy {
  hasApplyPermission: boolean;
  canApply: boolean;
  canManage: boolean;
  configured: boolean;
  limit: DiscountPolicyLimit | null;
}

export type CustomerCommercialAccountStatus = 'NONE' | 'ACTIVE' | 'BLOCKED';
export type CustomerEligibilitySource = 'COMMERCIAL_ACCOUNT' | 'CRM_CUSTOMER' | 'ELIGIBLE_FALLBACK';

export interface CustomerOption {
  partyId: string;
  displayName: string;
  crmCustomerProfileId: string | null;
  crmStatus: string | null;
  commercialAccountStatus: CustomerCommercialAccountStatus;
  /** Derived convenience field: null when commercialAccountStatus === 'NONE'. */
  accountStatus: 'ACTIVE' | 'BLOCKED' | null;
  eligibilitySource: CustomerEligibilitySource;
  denialCode: string | null;
}

export interface CustomerOptionPage {
  items: CustomerOption[];
  nextCursor: string | null;
}

export type ContactRelationshipType = 'CONTACT_PERSON' | 'BILLING_CONTACT' | 'LEGAL_CONTACT';

export interface ContactOption {
  partyId: string;
  displayName: string;
  relationshipType: ContactRelationshipType | (string & {});
  relationshipLabel: string | null;
  isPrimary: boolean;
  email: string | null;
  mobile: string | null;
  phone: string | null;
}

export interface ContactOptionPage {
  partyType: 'ORGANIZATION' | 'PERSON';
  items: ContactOption[];
  nextCursor: string | null;
}

export interface ListContactOptionsParams {
  search?: string;
  cursor?: string;
  limit?: number;
}

export { FAKE_CURRENT_USER_ID };
export type {
  BulkPrintArtifact,
  ConfirmSalesOrderResult,
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
  CreateQuotationRevisionResult,
  CreateSalesOrderBody,
  CreateSalesOrderLineInput,
  DirectPurchaseOrderFromPurchaseQuotationBody,
  DirectSalesOrderFromQuotationBody,
  DocumentStatusCountFilters,
  DocumentStatusCounts,
  OrderPricingPreviewBody,
  OrderPricingPreviewLineInput,
  PurchaseOrderActionKind,
  QuotationActionKind,
  QuotationPricingPreview,
  QuotationPricingPreviewLine,
  QuotationPricingPreviewLineInput,
  ReasonInput,
  ReceivingNodeOption,
  RenderPdfBody,
  ReplaceOrderLinesBody,
  ReplaceOrderLinesLineInput,
  SalesOrderActionKind,
  SupplierAccountOption,
  SupplierOption,
  UpdatePurchaseOrderBody,
  UpdatePurchaseQuotationBody,
  UpdateQuotationBody,
  UpdateSalesOrderBody,
};

// Large fake bulk modules stay out of the initial bundle and load on first bulk action for these segments.
const loadDocumentsBulkModules = () => import('./documents-bulk.fake-module');
for (const segment of ['quotations', 'sales-orders', 'purchase-orders', 'purchase-quotations'] as const) {
  registerFakeBulkModuleLoader('trading', `trading.${segment}`, loadDocumentsBulkModules);
}

// ---------------------------------------------------------------------------
// Query keys & reactive cache invalidation (Angular resource() adapter;
// @tanstack/angular-query is not present in package.json)
// ---------------------------------------------------------------------------

export interface DocumentQueryResult<T> {
  data: Signal<T | undefined>;
  value: Signal<T | undefined>;
  isPending: Signal<boolean>;
  isLoading: Signal<boolean>;
  isFetching: Signal<boolean>;
  isError: Signal<boolean>;
  error: Signal<unknown>;
  status: Signal<ResourceStatus>;
  refetch: () => Promise<void>;
  reload: () => boolean;
}

const kindVersions: Record<DocumentKind, WritableSignal<number>> = {
  quotation: signal(0),
  'sales-order': signal(0),
  'purchase-order': signal(0),
  'purchase-quotation': signal(0),
};
const discountPolicyVersion = signal(0);

export function documentListQueryKey(kind: DocumentKind, query: ListQuery): readonly ['trade-documents', DocumentKind, 'list', ListQuery] {
  return ['trade-documents', kind, 'list', query] as const;
}

export function documentDetailQueryKey(kind: DocumentKind, id: string | null): readonly ['trade-documents', DocumentKind, string | null] {
  return ['trade-documents', kind, id] as const;
}

export function documentCountsQueryKey(
  kind: DocumentKind,
  filters: DocumentStatusCountFilters,
): readonly ['trade-documents', DocumentKind, 'counts', DocumentStatusCountFilters] {
  return ['trade-documents', kind, 'counts', filters] as const;
}

export const DISCOUNT_POLICY_QUERY_KEY = ['trade-documents', 'discount-policy'] as const;

export function invalidateDocumentQueries(kind?: DocumentKind): void {
  if (kind) {
    kindVersions[kind].update((n) => n + 1);
    return;
  }
  kindVersions.quotation.update((n) => n + 1);
  kindVersions['sales-order'].update((n) => n + 1);
  kindVersions['purchase-order'].update((n) => n + 1);
  kindVersions['purchase-quotation'].update((n) => n + 1);
}

setDocumentInvalidationListener((kind) => invalidateDocumentQueries(kind));

function resolveInput<T>(val: T | Signal<T>): T {
  return typeof val === 'function' ? (val as Signal<T>)() : val;
}

function toQueryResult<T>(res: ResourceRef<T | undefined>, onRefetch: () => void): DocumentQueryResult<T> {
  const data = computed<T | undefined>(() => (res.hasValue() ? res.value() : undefined));
  const isFetching = res.isLoading;
  const isPending = computed(() => res.status() === 'loading' || (res.isLoading() && !res.hasValue()));
  const isError = computed(() => res.status() === 'error');
  const reload = () => res.reload();
  const refetch = async () => {
    onRefetch();
    res.reload();
  };

  return {
    data,
    value: data,
    isPending,
    isLoading: isPending,
    isFetching,
    isError,
    error: res.error,
    status: res.status,
    refetch,
    reload,
  };
}

/** Reactive query for ['trade-documents', kind, 'list', query]. Must be called inside an injection context. */
export function injectDocumentList<K extends DocumentKind>(
  kind: K | Signal<K>,
  query: Signal<ListQuery>,
  enabled?: Signal<boolean>,
): DocumentQueryResult<Page<DocumentByKind[K]>> {
  const lang = inject(LanguageState, { optional: true });
  const scope = inject(ScopeState, { optional: true });

  const res = resource({
    params: () => {
      if (enabled && !enabled()) return undefined;
      const companyId = scope?.company()?.id;
      const branchId = scope?.branch()?.id;
      if (!companyId || !branchId) return undefined;
      const k = resolveInput(kind);
      return {
        kind: k,
        query: query(),
        rev: kindVersions[k](),
        lang: lang?.current(),
        companyId,
        branchId,
      };
    },
    loader: ({ params }) =>
      listDocuments(params.kind, params.query, {
        companyId: params.companyId,
        branchId: params.branchId,
      }),
  });

  return toQueryResult(res, () => invalidateDocumentQueries(resolveInput(kind)));
}

/** Reactive query for ['trade-documents', kind, id]. Returns idle when id() is null. */
export function injectDocument<K extends DocumentKind>(
  kind: K | Signal<K>,
  id: Signal<string | null>,
  enabled?: Signal<boolean>,
): DocumentQueryResult<DocumentDetailByKind[K]> {
  const lang = inject(LanguageState, { optional: true });
  const scope = inject(ScopeState, { optional: true });

  const res = resource({
    params: () => {
      if (enabled && !enabled()) return undefined;
      const docId = id();
      const companyId = scope?.company()?.id;
      const branchId = scope?.branch()?.id;
      if (!docId || !companyId || !branchId) return undefined;
      const k = resolveInput(kind);
      return {
        kind: k,
        id: docId,
        rev: kindVersions[k](),
        lang: lang?.current() ?? 'en',
        companyId,
        branchId,
      };
    },
    loader: ({ params }) =>
      getDocument(
        params.kind,
        params.id,
        { companyId: params.companyId, branchId: params.branchId },
        params.lang,
      ),
  });

  return toQueryResult(res, () => invalidateDocumentQueries(resolveInput(kind)));
}

/** Reactive query for quotation discount policy. Must be called inside an injection context. */
export function injectDiscountPolicy(enabled?: Signal<boolean>): DocumentQueryResult<DiscountPolicy> {
  const scope = inject(ScopeState, { optional: true });

  const res = resource({
    params: () => {
      if (enabled && !enabled()) return undefined;
      const companyId = scope?.company()?.id;
      const branchId = scope?.branch()?.id;
      if (!companyId || !branchId) return undefined;
      return {
        rev: discountPolicyVersion(),
        companyId,
        branchId,
      };
    },
    loader: ({ params }) =>
      getDiscountPolicy({ companyId: params.companyId, branchId: params.branchId }),
  });

  return toQueryResult(res, () => discountPolicyVersion.update((n) => n + 1));
}

/** Reactive query for ['trade-documents', kind, 'counts', filters]. Must be called inside an injection context. */
export function injectStatusCounts(
  kind: DocumentKind | Signal<DocumentKind>,
  filters: Signal<DocumentStatusCountFilters>,
  enabled?: Signal<boolean>,
): DocumentQueryResult<DocumentStatusCounts> {
  const scope = inject(ScopeState, { optional: true });

  const res = resource({
    params: () => {
      if (enabled && !enabled()) return undefined;
      const companyId = scope?.company()?.id;
      const branchId = scope?.branch()?.id;
      if (!companyId || !branchId) return undefined;
      const k = resolveInput(kind);
      return {
        kind: k,
        filters: filters(),
        rev: kindVersions[k](),
        companyId,
        branchId,
      };
    },
    loader: ({ params }) =>
      statusCounts(params.kind, params.filters, {
        companyId: params.companyId,
        branchId: params.branchId,
      }),
  });

  return toQueryResult(res, () => invalidateDocumentQueries(resolveInput(kind)));
}

// ---------------------------------------------------------------------------
// Wire mapping & sanitation helpers
// ---------------------------------------------------------------------------

interface WireCustomerOption {
  partyId: string;
  displayName: string;
  crmCustomerProfileId?: string | null;
  crmStatus?: string | null;
  commercialAccountStatus?: CustomerCommercialAccountStatus | string;
  eligibilitySource?: CustomerEligibilitySource;
  denialCode?: string | null;
}

interface WireOrderPreviewLine {
  clientLineId: string;
  unitPrice: Dec;
  taxDefault?: OrderPreviewTaxDefault | null;
  financial: {
    subtotal?: Dec;
    taxableBase?: Dec;
    discountTotal: Dec;
    chargeTotal: Dec;
    taxTotal: Dec;
    lineTotal: Dec;
    taxSnapshot: TaxSnapshot;
    inclusiveTax?: boolean;
  };
}

interface WireOrderPreview {
  currencyDecimalPlaces: number;
  lines: WireOrderPreviewLine[];
  totals: OrderPreview['totals'];
  fingerprint: string;
}

interface WireReceivingNode {
  id: string;
  code: string;
  name: string;
}

function toContext(ctx?: TradeContext | ScopeState): TradeContext {
  if (!ctx) return {};
  if ('company' in ctx) {
    return tradeContext(ctx, 'BRANCH');
  }
  return ctx;
}

function segmentOf(kind: DocumentKind): string {
  return KIND_CONFIG[kind].segment;
}

function compactQuery(
  entries: Record<string, string | number | boolean | null | undefined>,
): CoreQuery | undefined {
  const out: CoreQuery = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined && value !== null && value !== '') {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function compactBody(
  entries: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined && value !== null && value !== '') {
      out[key] = value;
    }
  }
  return out;
}

function mapTermsSnapshot(raw: TermsSnapshot | null | undefined): TermsSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const isV2 = rec['schemaVersion'] === 2 || (rec['localized'] !== null && typeof rec['localized'] === 'object');
  if (!isV2) {
    return {
      ...rec,
      ...(Array.isArray(rec['clauses']) ? { clauses: rec['clauses'] } : {}),
    };
  }
  const snap = rec as Partial<TermsSnapshotV2>;
  const locEn = snap.localized?.en;
  const locAr = snap.localized?.ar;
  const normalized: TermsSnapshotV2 = {
    ...snap,
    schemaVersion: 2,
    clauses: Array.isArray(snap.clauses) ? snap.clauses : [],
    ...(snap.localized
      ? {
          localized: {
            en: { ...locEn, clauses: Array.isArray(locEn?.clauses) ? locEn.clauses : [] },
            ar: { ...locAr, clauses: Array.isArray(locAr?.clauses) ? locAr.clauses : [] },
          },
        }
      : {}),
  };
  return normalized;
}

function localizedLabel(
  names: { en?: string; ar?: string } | null | undefined,
  code: string | null | undefined,
  lang: 'en' | 'ar',
): string {
  const preferred = names ? (lang === 'ar' ? names.ar || names.en : names.en || names.ar) : undefined;
  const trimmedCode = code?.trim() || '';
  const trimmedName = preferred?.trim() || '';
  if (trimmedCode && trimmedName && trimmedCode !== trimmedName) {
    return `${trimmedCode} · ${trimmedName}`;
  }
  return trimmedName || trimmedCode;
}

function mapDocumentDetail<K extends DocumentKind>(
  kind: K,
  raw: DocumentDetailByKind[K],
  lang: 'en' | 'ar',
): DocumentDetailByKind[K] {
  const reasonHistory = Array.isArray(raw.reasonHistory) ? raw.reasonHistory : [];
  switch (kind) {
    case 'quotation': {
      const q = raw as QuotationDetail;
      const mapped: QuotationDetail = {
        ...q,
        reasonHistory,
        revisions: (q.revisions ?? []).map((rev) => ({
          ...rev,
          termsSnapshot: mapTermsSnapshot(rev.termsSnapshot) ?? rev.termsSnapshot,
        })),
        currentLines: q.currentLines ?? [],
      };
      return mapped as DocumentDetailByKind[K];
    }
    case 'sales-order': {
      const so = raw as SalesOrderDetail;
      const mapped: SalesOrderDetail = {
        ...so,
        reasonHistory,
        termsSnapshot: mapTermsSnapshot(so.termsSnapshot),
        lines: (so.lines ?? []).map((line) => ({
          ...line,
          itemId: line.itemId ?? null,
          itemLabel: line.itemLabel || localizedLabel(line.itemLocalizedNames, line.itemCode, lang),
          uomLabel: line.uomLabel || localizedLabel(line.uomLocalizedNames, line.uomCode, lang),
          discountTotal: line.discountTotal ?? '0',
          chargeTotal: line.chargeTotal ?? '0',
          taxTotal: line.taxTotal ?? '0',
        })),
      };
      return mapped as DocumentDetailByKind[K];
    }
    case 'purchase-order': {
      const po = raw as PurchaseOrderDetail;
      const mapped: PurchaseOrderDetail = {
        ...po,
        reasonHistory,
        termsSnapshot: mapTermsSnapshot(po.termsSnapshot),
        lines: (po.lines ?? []).map((line) => ({
          ...line,
          itemId: line.itemId ?? null,
          itemLabel: line.itemLabel || localizedLabel(line.itemLocalizedNames, line.itemCode, lang),
          uomLabel: line.uomLabel || localizedLabel(line.uomLocalizedNames, line.uomCode, lang),
          discountTotal: line.discountTotal ?? '0',
          chargeTotal: line.chargeTotal ?? '0',
          taxTotal: line.taxTotal ?? '0',
        })),
      };
      return mapped as DocumentDetailByKind[K];
    }
    case 'purchase-quotation': {
      const pq = raw as PurchaseQuotationDetail;
      const mapped: PurchaseQuotationDetail = {
        ...pq,
        reasonHistory,
        validUntil: pq.validUntil ?? null,
        termsSnapshot: mapTermsSnapshot(pq.termsSnapshot),
        lines: (pq.lines ?? []).map((line) => ({
          ...line,
          descriptionSnapshot: line.descriptionSnapshot ?? null,
        })),
      };
      return mapped as DocumentDetailByKind[K];
    }
  }
}

function mapCustomerOption(raw: WireCustomerOption): CustomerOption {
  const commercialAccountStatus: CustomerCommercialAccountStatus =
    raw.commercialAccountStatus === 'ACTIVE' || raw.commercialAccountStatus === 'BLOCKED'
      ? raw.commercialAccountStatus
      : 'NONE';
  return {
    partyId: raw.partyId,
    displayName: raw.displayName,
    crmCustomerProfileId: raw.crmCustomerProfileId ?? null,
    crmStatus: raw.crmStatus ?? null,
    commercialAccountStatus,
    accountStatus: commercialAccountStatus === 'NONE' ? null : commercialAccountStatus,
    eligibilitySource: raw.eligibilitySource ?? 'ELIGIBLE_FALLBACK',
    denialCode: raw.denialCode ?? null,
  };
}

function sanitizePricingIntent(pricing: PricingIntent): Record<string, unknown> {
  const clean: Record<string, unknown> = { mode: pricing.mode };
  if (pricing.scope) clean['scope'] = pricing.scope;
  if (pricing.type) clean['type'] = pricing.type;
  if (pricing.value !== undefined && pricing.value !== null && pricing.value !== '') {
    clean['value'] = pricing.value;
  }
  if (pricing.reasonCode?.trim()) clean['reasonCode'] = pricing.reasonCode.trim();
  if (pricing.reasonNote?.trim()) clean['reasonNote'] = pricing.reasonNote.trim();
  return clean;
}

function mapOrderPreview(body: OrderPricingPreviewBody, raw: WireOrderPreview): OrderPreview {
  const reqById = new Map(body.lines.map((line) => [line.clientLineId, line]));
  const lines: OrderPreviewLine[] = (raw.lines ?? []).map((line, index) => {
    const reqLine = reqById.get(line.clientLineId) ?? body.lines[index];
    // Matches backend order-evidence.builder.ts:28-34,42 (discountTotal, chargeTotal, taxTotal, lineTotal, taxSnapshot).
    const subtotal = line.financial.subtotal ?? mul(reqLine?.quantity ?? '0', line.unitPrice, 8);
    const taxableBase =
      line.financial.taxSnapshot?.taxableBase ??
      line.financial.taxableBase ??
      add(sub(subtotal, line.financial.discountTotal), line.financial.chargeTotal);
    const financial: LineEvidence = {
      subtotal,
      taxableBase,
      discountTotal: line.financial.discountTotal,
      chargeTotal: line.financial.chargeTotal,
      taxTotal: line.financial.taxTotal,
      lineTotal: line.financial.lineTotal,
      taxSnapshot: line.financial.taxSnapshot,
      // Backend orderTaxDefault (order-evidence.builder.ts:9) refuses inclusive taxes.
      inclusiveTax: false,
    };
    return {
      clientLineId: line.clientLineId,
      unitPrice: line.unitPrice,
      taxDefault: line.taxDefault ?? null,
      financial,
    };
  });

  return {
    currencyDecimalPlaces: raw.currencyDecimalPlaces,
    lines,
    totals: raw.totals,
    fingerprint: raw.fingerprint,
  };
}

function wireReasonBody(reason: ReasonInput): Record<string, string> {
  const note = reason.reasonNote?.trim();
  return {
    reasonCode: reason.reasonCode,
    ...(note ? { reasonNote: note } : {}),
  };
}

function wireLineFinancial(
  financial: LineEvidence,
  forceZeroDiscount = false,
): {
  discountTotal: Dec;
  chargeTotal: Dec;
  taxTotal: Dec;
  lineTotal: Dec;
  taxSnapshot: TaxSnapshot;
} {
  return {
    discountTotal: forceZeroDiscount ? '0' : financial.discountTotal,
    chargeTotal: financial.chargeTotal,
    taxTotal: financial.taxTotal,
    lineTotal: financial.lineTotal,
    taxSnapshot: financial.taxSnapshot,
  };
}

function wireTotalsEvidence(totals: TotalsEvidence): TotalsEvidence {
  return {
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    chargeTotal: totals.chargeTotal,
    taxTotal: totals.taxTotal,
    roundingTotal: totals.roundingTotal,
    grandTotal: totals.grandTotal,
    amountPaid: totals.amountPaid,
    amountDue: totals.amountDue,
  };
}

function wireNotes(notes: string | null | undefined, allowEmpty = false): string | undefined {
  if (notes === undefined) return undefined;
  if (notes === null) return allowEmpty ? '' : undefined;
  const trimmed = notes.trim();
  return allowEmpty ? trimmed : trimmed || undefined;
}

function mapCommandDetail<K extends DocumentKind>(
  kind: K,
  raw: DocumentDetailByKind[K],
  lang: 'en' | 'ar' = 'en',
): DocumentDetailByKind[K] {
  if (!raw || typeof raw !== 'object') return raw;
  if ('lines' in raw || 'revisions' in raw || 'currentLines' in raw) {
    return mapDocumentDetail(kind, raw, lang);
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Plain async reads & previews
// ---------------------------------------------------------------------------

/** GET /api/tenant/trade/v1/<segment>?page&limit&status&search&... */
export async function listDocuments<K extends DocumentKind>(
  kind: K,
  query: ListQuery,
  ctx?: TradeContext | ScopeState,
): Promise<Page<DocumentByKind[K]>> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  return tradeHttp().read<Page<DocumentByKind[K]>>(
    `/${segmentOf(kind)}`,
    compactQuery({
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search?.trim() || undefined,
      partyId: query.partyId,
      currencyCode: query.currencyCode,
      crmOpportunityId: query.crmOpportunityId,
      businessDateFrom: query.businessDateFrom,
      businessDateTo: query.businessDateTo,
      sort: query.sort,
      order: query.order,
    }),
    { scope },
  );
}

/** GET /api/tenant/trade/v1/<segment>/:id */
export async function getDocument<K extends DocumentKind>(
  kind: K,
  id: string,
  ctx?: TradeContext | ScopeState,
  lang: 'en' | 'ar' = 'en',
): Promise<DocumentDetailByKind[K]> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const raw = await tradeHttp().read<DocumentDetailByKind[K]>(
    `/${segmentOf(kind)}/${encodeURIComponent(id)}`,
    undefined,
    { scope },
  );
  return mapDocumentDetail(kind, raw, lang);
}

/** POST /api/tenant/trade/v1/<segment>/status-counts (filters in the body) */
export async function statusCounts(
  kind: DocumentKind,
  filters: DocumentStatusCountFilters = {},
  ctx?: TradeContext | ScopeState,
): Promise<DocumentStatusCounts> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const body = compactBody({
    partyId: filters.partyId,
    search: filters.search?.trim() || undefined,
    currencyCode: filters.currencyCode,
    crmOpportunityId: filters.crmOpportunityId,
    businessDateFrom: filters.businessDateFrom,
    businessDateTo: filters.businessDateTo,
  });
  const { data } = await tradeHttp().write<DocumentStatusCounts>(
    'POST',
    `/${segmentOf(kind)}/status-counts`,
    body,
    { key: newIdempotencyKey(), scope },
  );
  return data;
}

/** GET /api/tenant/trade/v1/quotations/discount-policy */
export async function getDiscountPolicy(ctx?: TradeContext | ScopeState): Promise<DiscountPolicy> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const raw = await tradeHttp().read<DiscountPolicy>('/quotations/discount-policy', undefined, { scope });
  return {
    hasApplyPermission: Boolean(raw.hasApplyPermission),
    canApply: Boolean(raw.canApply),
    canManage: Boolean(raw.canManage),
    configured: Boolean(raw.configured),
    limit: raw.limit ?? null,
  };
}

/** POST /api/tenant/trade/v1/quotations/pricing-preview */
export async function previewQuotationPricing(
  body: QuotationPricingPreviewBody,
  ctx?: TradeContext | ScopeState,
): Promise<QuotationPricingPreview> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const lines = body.lines.map((line) => ({
    clientLineId: line.clientLineId,
    itemId: line.itemId,
    uomId: line.uomId,
    quantity: line.quantity,
    ...(line.priceBookId ? { priceBookId: line.priceBookId } : {}),
    ...(line.discount
      ? { discount: { type: line.discount.type, value: line.discount.value } }
      : {}),
  }));
  const wireBody = {
    ...(body.partyId ? { partyId: body.partyId } : {}),
    ...(body.crmCustomerProfileId ? { crmCustomerProfileId: body.crmCustomerProfileId } : {}),
    currencyCode: body.currencyCode,
    lines,
    ...(body.pricing ? { pricing: sanitizePricingIntent(body.pricing) } : {}),
  };
  const { data } = await tradeHttp().write<QuotationPricingPreview>(
    'POST',
    '/quotations/pricing-preview',
    wireBody,
    { key: newIdempotencyKey(), scope },
  );
  return data;
}

/** POST /api/tenant/trade/v1/<sales-orders|purchase-orders>/pricing-preview */
export async function previewOrderPricing(
  kind: 'sales-order' | 'purchase-order',
  body: OrderPricingPreviewBody,
  ctx?: TradeContext | ScopeState,
): Promise<OrderPreview> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const lines = body.lines.map((line) => ({
    clientLineId: line.clientLineId,
    itemId: line.itemId,
    uomId: line.uomId,
    quantity: line.quantity,
    ...(line.chargeTotal != null && line.chargeTotal !== '' ? { chargeTotal: line.chargeTotal } : {}),
    ...(line.tax ? { tax: { category: line.tax.category, rateBps: line.tax.rateBps } } : {}),
  }));
  const wireBody = {
    ...(body.partyId ? { partyId: body.partyId } : {}),
    currencyCode: body.currencyCode,
    lines,
    ...(body.sourcePurchaseQuotationId
      ? { sourcePurchaseQuotationId: body.sourcePurchaseQuotationId }
      : {}),
  };
  const { data } = await tradeHttp().write<WireOrderPreview>(
    'POST',
    `/${segmentOf(kind)}/pricing-preview`,
    wireBody,
    { key: newIdempotencyKey(), scope },
  );
  return mapOrderPreview(body, data);
}

/** GET /api/tenant/trade/v1/quotations/customer-options?search&cursor */
export async function listCustomerOptions(
  search?: string,
  cursor?: string,
  ctx?: TradeContext | ScopeState,
): Promise<CustomerOptionPage> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const raw = await tradeHttp().read<{ items?: WireCustomerOption[]; nextCursor?: string | null }>(
    '/quotations/customer-options',
    compactQuery({
      search: search?.trim() || undefined,
      cursor,
    }),
    { scope },
  );
  return {
    items: (raw.items ?? []).map(mapCustomerOption),
    nextCursor: raw.nextCursor ?? null,
  };
}

/** GET /api/tenant/trade/v1/quotations/contact-options?partyId&search&cursor&limit */
export async function listContactOptions(
  partyId: string,
  opts?: ListContactOptionsParams,
  ctx?: TradeContext | ScopeState,
): Promise<ContactOptionPage> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const raw = await tradeHttp().read<{
    partyType?: 'ORGANIZATION' | 'PERSON';
    items?: ContactOption[];
    nextCursor?: string | null;
  }>(
    '/quotations/contact-options',
    compactQuery({
      partyId,
      search: opts?.search?.trim() || undefined,
      cursor: opts?.cursor,
      limit: opts?.limit,
    }),
    { scope },
  );
  return {
    partyType: raw.partyType === 'PERSON' ? 'PERSON' : 'ORGANIZATION',
    items: raw.items ?? [],
    nextCursor: raw.nextCursor ?? null,
  };
}

/** GET /api/tenant/trade/v1/purchase-orders/supplier-options?search */
export async function listSupplierOptions(
  search?: string,
  ctx?: TradeContext | ScopeState,
): Promise<SupplierOption[]> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const raw = await tradeHttp().read<{ items?: SupplierOption[] }>(
    '/purchase-orders/supplier-options',
    compactQuery({ search: search?.trim() || undefined }),
    { scope },
  );
  return raw.items ?? [];
}

export interface EmbeddedSourceCrmOpportunity {
  id: string;
  name?: string;
  stageId?: string;
  stageName?: { en: string; ar: string } | null;
  status?: string;
  revision?: number | null;
  available: boolean;
}

export function embeddedSourceOpportunityOf(detail: unknown): EmbeddedSourceCrmOpportunity | null {
  if (!detail || typeof detail !== 'object' || !('sourceCrmOpportunity' in detail)) return null;
  const raw = (detail as { sourceCrmOpportunity?: EmbeddedSourceCrmOpportunity | null }).sourceCrmOpportunity;
  return raw && typeof raw === 'object' && typeof raw.id === 'string' ? raw : null;
}

interface WireTemplateAssignmentItem {
  assignmentId?: string;
  definitionId: string;
  versionId: string;
  versionNumber: number;
  documentType?: string;
  outputChannel?: string;
  adapterKey?: string;
  locale: string | null;
  priority?: number;
  isDefault?: boolean;
  status?: string;
  name?: string | null;
  definitionName?: string | null;
  templateName?: string | null;
}

interface WireTemplateAssignmentPage {
  items?: WireTemplateAssignmentItem[];
}

interface WireTemplateDefinitionItem {
  id?: string;
  templateId?: string;
  name?: string | null;
}

interface WireTemplateDefinitionPage {
  items?: WireTemplateDefinitionItem[];
}

interface WireCrmOpportunityRow {
  id: string;
  title?: string;
  name?: string;
  stageName?: string;
  status?: string;
}

interface WireCrmOpportunityPage {
  items?: WireCrmOpportunityRow[];
}

const PRINT_ASSIGNMENT_TARGET_BY_KIND: Readonly<
  Record<DocumentKind, { documentType: string; adapterKey: string }>
> = {
  quotation: { documentType: 'QUOTATION', adapterKey: 'TRADE_QUOTATION_PRINT_V1' },
  'sales-order': { documentType: 'SALES_ORDER', adapterKey: 'TRADE_SALES_ORDER_PRINT_V1' },
  'purchase-order': { documentType: 'PURCHASE_ORDER', adapterKey: 'TRADE_PURCHASE_ORDER_PRINT_V1' },
  'purchase-quotation': { documentType: 'PURCHASE_QUOTATION', adapterKey: 'TRADE_PURCHASE_QUOTATION_PRINT_V1' },
};

/** GET /api/tenant/crm/v1/opportunities?branchId&customerProfileId&status=IN_PROGRESS&page=1&limit=100 */
export async function listOpportunityOptions(
  customerProfileId: string,
  ctx?: TradeContext | ScopeState,
): Promise<SourceCrmOpportunity[]> {
  const profileId = customerProfileId?.trim();
  if (!profileId) return [];
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  let raw: WireCrmOpportunityPage;
  try {
    raw = await crmHttp().read<WireCrmOpportunityPage>(
      '/opportunities',
      compactQuery({
        branchId: scope?.branchId,
        customerProfileId: profileId,
        status: 'IN_PROGRESS',
        page: 1,
        limit: 100,
      }),
    );
  } catch (error) {
    throw toTradeError(error);
  }
  return (raw?.items ?? []).map((row) => ({
    id: row.id,
    name: (row.title ?? row.name ?? '').trim(),
    stageName: row.stageName?.trim() ?? '',
    status: row.status === 'WON' || row.status === 'LOST' ? row.status : 'IN_PROGRESS',
  }));
}

/** GET /api/tenant/trade/v1/inventory/nodes?status=ACTIVE (bare array, ordered by code) */
export async function listReceivingNodes(
  ctx?: TradeContext | ScopeState,
): Promise<ReceivingNodeOption[]> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const raw = await tradeHttp().read<WireReceivingNode[]>(
    '/inventory/nodes',
    { status: 'ACTIVE' },
    { scope },
  );
  return (raw ?? []).map((node) => ({
    id: node.id,
    code: node.code,
    name: node.name,
    status: 'ACTIVE' as const,
  }));
}

/** POST /api/tenant/trade/v1/pricing/evaluate */
export async function evaluatePrice(
  purpose: 'SALES' | 'PURCHASE',
  itemId: string,
  uomId: string,
  quantity: Dec,
  currencyCode: string,
  ctx?: TradeContext | ScopeState,
): Promise<{ unitPrice: Dec }> {
  const scope = scopeFor(toContext(ctx), 'OPTIONAL');
  const { data } = await tradeHttp().write<{ unitPrice: Dec }>(
    'POST',
    '/pricing/evaluate',
    { purpose, itemId, uomId, quantity, currencyCode },
    { key: newIdempotencyKey(), scope },
  );
  return { unitPrice: data.unitPrice };
}

/** GET /api/tenant/core/v1/templates/assignments (active PRINT assignments for documentType/adapterKey) */
export async function listPrintTemplates(
  kind: DocumentKind,
  ctx?: TradeContext | ScopeState,
): Promise<PrintTemplateOption[]> {
  const { documentType, adapterKey } = PRINT_ASSIGNMENT_TARGET_BY_KIND[kind];
  const scope = scopeFor(toContext(ctx), 'OPTIONAL');
  const scopeType = scope?.companyId && scope?.branchId
    ? 'BRANCH'
    : scope?.companyId
      ? 'COMPANY'
      : 'TENANT';

  const page = await tradeCore().read<WireTemplateAssignmentPage>(
    '/api/tenant/core/v1/templates/assignments',
    compactQuery({
      scopeType,
      companyId: scopeType !== 'TENANT' ? scope?.companyId : undefined,
      branchId: scopeType === 'BRANCH' ? scope?.branchId : undefined,
      documentType,
      outputChannel: 'PRINT',
      adapterKey,
      status: 'ACTIVE',
      limit: 100,
    }),
    scope ? { scope } : undefined,
  ).catch((error: unknown) => { throw toTradeError(error); });

  const active = (page?.items ?? []).filter((item) => !item.status || item.status === 'ACTIVE');
  if (active.length === 0) return [];

  const needsNameLookup = active.some(
    (item) => !(item.name?.trim() || item.definitionName?.trim() || item.templateName?.trim()),
  );
  const nameByDefId = new Map<string, string>();
  if (needsNameLookup) {
    try {
      const defs = await tradeCore().read<WireTemplateDefinitionPage>(
        '/api/tenant/core/v1/templates',
        compactQuery({
          assignmentScopeType: scopeType,
          assignmentCompanyId: scopeType !== 'TENANT' ? scope?.companyId : undefined,
          assignmentBranchId: scopeType === 'BRANCH' ? scope?.branchId : undefined,
          documentType,
          outputChannel: 'PRINT',
          limit: 100,
        }),
        scope ? { scope } : undefined,
      );
      for (const def of defs?.items ?? []) {
        const defId = def.templateId ?? def.id;
        const name = def.name?.trim();
        if (defId && name) {
          nameByDefId.set(defId, name);
        }
      }
    } catch {
      // Fall back to version-number label below without surfacing raw UUIDs.
    }
  }

  const sorted = [...active].sort((a, b) => {
    const defDiff = Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault));
    if (defDiff !== 0) return defDiff;
    const prioDiff = (b.priority ?? 0) - (a.priority ?? 0);
    if (prioDiff !== 0) return prioDiff;
    return (b.versionNumber ?? 0) - (a.versionNumber ?? 0);
  });

  const seenVersionIds = new Set<string>();
  const result: PrintTemplateOption[] = [];
  for (const item of sorted) {
    if (!item.versionId || seenVersionIds.has(item.versionId)) continue;
    seenVersionIds.add(item.versionId);
    const resolvedName =
      item.name?.trim() ||
      item.definitionName?.trim() ||
      item.templateName?.trim() ||
      nameByDefId.get(item.definitionId)?.trim() ||
      `#${item.versionNumber}`;
    result.push({
      templateId: item.definitionId,
      versionId: item.versionId,
      name: resolvedName,
      locale: item.locale && item.locale.toLowerCase().startsWith('ar') ? 'ar-EG' : 'en-US',
      versionNumber: item.versionNumber,
    });
  }
  return result;
}

/**
 * Fake-only lookup for openSalesOrder fallback.
 * Gap G1: real API has no `sourceQuotationId` filter; Phase 5 requests backend filter or uses convert receipt.
 */
export function findSalesOrderByQuotation(quotationId: string): Promise<SalesOrder | null> {
  return fakeFindSalesOrderByQuotation(quotationId);
}

/**
 * GET /api/tenant/trade/v1/documents/bulk-prints/:jobId/artifact (routeKey trading.documents.bulk-prints.artifact.get).
 * A safe read: no idempotency key. 404 BULK_JOB_NOT_FOUND, 409 TRADE.BULK_JOB.ARTIFACT_NOT_READY.
 */
export function getBulkPrintArtifact(
  jobId: string,
  ctx?: TradeContext | ScopeState,
): Promise<BulkPrintArtifact> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  return tradeHttp().read<BulkPrintArtifact>(
    `/documents/bulk-prints/${encodeURIComponent(jobId)}/artifact`,
    undefined,
    { scope },
  );
}

// ---------------------------------------------------------------------------
// Commands. Each takes the caller's x-idempotency-key: one key per user action, the same key on a retry
// of that action (see document-request-keys.ts). Each invalidates the matching queries.
// ---------------------------------------------------------------------------

/** POST /api/tenant/trade/v1/quotations (headers: x-idempotency-key) */
export async function createQuotation(
  body: CreateQuotationBody,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<QuotationDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const wireBody: Record<string, unknown> = {
    partyId: body.partyId,
    currencyCode: body.currencyCode,
    ...(body.crmCustomerProfileId ? { crmCustomerProfileId: body.crmCustomerProfileId } : {}),
    ...(body.contactPartyId ? { contactPartyId: body.contactPartyId } : {}),
    ...(body.draftReference?.trim() ? { draftReference: body.draftReference.trim() } : {}),
    ...(body.sourceCrmOpportunityId ? { sourceCrmOpportunityId: body.sourceCrmOpportunityId } : {}),
    ...(body.extensionValues !== undefined ? { extensionValues: body.extensionValues } : {}),
  };
  const { data } = await tradeHttp().write<QuotationDetail>('POST', '/quotations', wireBody, {
    key: idempotencyKey,
    scope,
  });
  invalidateDocumentQueries('quotation');
  return mapCommandDetail('quotation', data);
}

/** PATCH /api/tenant/trade/v1/quotations/:id (headers: x-idempotency-key, If-Match: "<version>") */
export async function updateQuotation(
  id: string,
  version: number,
  body: UpdateQuotationBody,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<QuotationDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const wireBody: Record<string, unknown> = {
    ...(body.contactPartyId !== undefined ? { contactPartyId: body.contactPartyId } : {}),
    ...(body.draftReference !== undefined ? { draftReference: body.draftReference } : {}),
    ...(body.sourceCrmOpportunityId !== undefined
      ? { sourceCrmOpportunityId: body.sourceCrmOpportunityId }
      : {}),
  };
  const { data } = await tradeHttp().write<QuotationDetail>(
    'PATCH',
    `/quotations/${encodeURIComponent(id)}`,
    wireBody,
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries('quotation');
  return mapCommandDetail('quotation', data);
}

/** POST /api/tenant/trade/v1/quotations/:id/revisions (headers: x-idempotency-key, If-Match: "<version>") */
export async function createQuotationRevision(
  id: string,
  version: number,
  body: CreateQuotationRevisionBody,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<CreateQuotationRevisionResult> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const lines = body.lines.map((line) => ({
    clientLineId: line.clientLineId,
    itemId: line.itemId,
    uomId: line.uomId,
    quantity: line.quantity,
    ...(line.priceBookId ? { priceBookId: line.priceBookId } : {}),
    ...(line.discount ? { discount: { type: line.discount.type, value: line.discount.value } } : {}),
  }));
  const notes = wireNotes(body.notes);
  const wireBody: Record<string, unknown> = {
    validUntil: body.validUntil,
    lines,
    ...(body.pricing ? { pricing: sanitizePricingIntent(body.pricing) } : {}),
    ...(body.expectedPricingFingerprint
      ? { expectedPricingFingerprint: body.expectedPricingFingerprint }
      : {}),
    ...(body.termSelections !== undefined
      ? { termSelections: termSelectionsBody(body.termSelections) }
      : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
  const { data } = await tradeHttp().write<CreateQuotationRevisionResult>(
    'POST',
    `/quotations/${encodeURIComponent(id)}/revisions`,
    wireBody,
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries('quotation');
  return data;
}

/** POST /api/tenant/trade/v1/quotations/:id/<send|accept|reject|cancel> (headers: x-idempotency-key, If-Match: "<version>") */
export async function quotationAction(
  id: string,
  version: number,
  action: QuotationActionKind,
  reason: ReasonInput | undefined,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<QuotationDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const body =
    action === 'send' || action === 'accept' ? undefined : wireReasonBody(reason ?? { reasonCode: '' });
  const { data } = await tradeHttp().write<QuotationDetail>(
    'POST',
    `/quotations/${encodeURIComponent(id)}/${action}`,
    body,
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries('quotation');
  return mapCommandDetail('quotation', data);
}

/** POST /api/tenant/trade/v1/quotations/:id/convert-to-sales-order (gateway row trading.quotations.by-id.convert.to.sales.order.post; headers: x-idempotency-key, If-Match: "<version>") */
export async function convertQuotation(
  id: string,
  version: number,
  body: ConvertQuotationBody,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<SalesOrderDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const notes = wireNotes(body.notes);
  const wireBody: Record<string, unknown> = {
    lines: body.lines.map((line) => ({
      clientLineId: line.clientLineId,
      financial: wireLineFinancial(line.financial),
    })),
    totals: wireTotalsEvidence(body.totals),
    ...(body.termSelections !== undefined
      ? { termSelections: termSelectionsBody(body.termSelections) }
      : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
  const { data } = await tradeHttp().write<SalesOrderDetail>(
    'POST',
    `/quotations/${encodeURIComponent(id)}/convert-to-sales-order`,
    wireBody,
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries('quotation');
  invalidateDocumentQueries('sales-order');
  return mapCommandDetail('sales-order', data);
}

/** POST /api/tenant/trade/v1/quotations/:id/create-sales-order (headers: x-idempotency-key, If-Match: "<version>") */
export async function createSalesOrderFromQuotation(
  id: string,
  version: number,
  body: DirectSalesOrderFromQuotationBody,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<SalesOrderDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const wireBody: Record<string, unknown> = {
    ...(body.draftReference?.trim() ? { draftReference: body.draftReference.trim() } : {}),
  };
  const { data } = await tradeHttp().write<SalesOrderDetail>(
    'POST',
    `/quotations/${encodeURIComponent(id)}/create-sales-order`,
    wireBody,
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries('quotation');
  invalidateDocumentQueries('sales-order');
  return mapCommandDetail('sales-order', data);
}

/** POST /api/tenant/trade/v1/sales-orders (headers: x-idempotency-key) */
export async function createSalesOrder(
  body: CreateSalesOrderBody,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<SalesOrderDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const notes = wireNotes(body.notes);
  const wireBody: Record<string, unknown> = {
    partyId: body.partyId,
    ...(body.contactPartyId ? { contactPartyId: body.contactPartyId } : {}),
    currencyCode: body.currencyCode,
    ...(body.draftReference?.trim() ? { draftReference: body.draftReference.trim() } : {}),
    lines: body.lines.map((line) => ({
      clientLineId: line.clientLineId,
      itemId: line.itemId,
      uomId: line.uomId,
      quantity: line.quantity,
      financial: wireLineFinancial(line.financial),
    })),
    totals: wireTotalsEvidence(body.totals),
    ...(body.expectedPricingFingerprint
      ? { expectedPricingFingerprint: body.expectedPricingFingerprint }
      : {}),
    termSelections: termSelectionsBody(body.termSelections),
    ...(notes !== undefined ? { notes } : {}),
    ...(body.extensionValues !== undefined ? { extensionValues: body.extensionValues } : {}),
  };
  const { data } = await tradeHttp().write<SalesOrderDetail>('POST', '/sales-orders', wireBody, {
    key: idempotencyKey,
    scope,
  });
  invalidateDocumentQueries('sales-order');
  return mapCommandDetail('sales-order', data);
}

/** PATCH /api/tenant/trade/v1/sales-orders/:id (headers: x-idempotency-key, If-Match: "<version>") */
export async function updateSalesOrder(
  id: string,
  version: number,
  body: UpdateSalesOrderBody,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<SalesOrderDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const notes = wireNotes(body.notes, true);
  const wireBody: Record<string, unknown> = {
    ...(body.contactPartyId !== undefined ? { contactPartyId: body.contactPartyId } : {}),
    ...(body.draftReference !== undefined ? { draftReference: body.draftReference } : {}),
    ...(body.termSelections !== undefined
      ? { termSelections: termSelectionsBody(body.termSelections) }
      : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
  const { data } = await tradeHttp().write<SalesOrderDetail>(
    'PATCH',
    `/sales-orders/${encodeURIComponent(id)}`,
    wireBody,
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries('sales-order');
  return mapCommandDetail('sales-order', data);
}

/** POST /api/tenant/trade/v1/sales-orders/:id/confirm (headers: x-idempotency-key, If-Match: "<version>") */
export async function confirmSalesOrder(
  id: string,
  version: number,
  requestedDeadline: string | undefined,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<ConfirmSalesOrderResult> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const wireBody: Record<string, unknown> = {
    ...(requestedDeadline ? { requestedDeadline } : {}),
  };
  const { data } = await tradeHttp().write<ConfirmSalesOrderResult>(
    'POST',
    `/sales-orders/${encodeURIComponent(id)}/confirm`,
    wireBody,
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries('sales-order');
  const rawUnallocated = (data as { unallocatedLines?: unknown[] }).unallocatedLines;
  const unallocatedLines = Array.isArray(rawUnallocated)
    ? rawUnallocated
        .map((entry) => {
          if (typeof entry === 'string') return entry;
          if (entry && typeof entry === 'object') {
            const obj = entry as { clientLineId?: unknown; lineId?: unknown };
            return typeof obj.clientLineId === 'string'
              ? obj.clientLineId
              : typeof obj.lineId === 'string'
                ? obj.lineId
                : '';
          }
          return '';
        })
        .filter((s) => s.length > 0)
    : [];
  return {
    ...data,
    statusCode: 200,
    unallocatedLines,
  };
}

/** POST /api/tenant/trade/v1/sales-orders/:id/<hold|release-hold|cancel> (headers: x-idempotency-key, If-Match: "<version>") */
export async function salesOrderAction(
  id: string,
  version: number,
  action: SalesOrderActionKind,
  reason: ReasonInput,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<SalesOrderDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const { data } = await tradeHttp().write<SalesOrderDetail>(
    'POST',
    `/sales-orders/${encodeURIComponent(id)}/${action}`,
    wireReasonBody(reason),
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries('sales-order');
  return mapCommandDetail('sales-order', data);
}

/** POST /api/tenant/trade/v1/purchase-orders (headers: x-idempotency-key) */
export async function createPurchaseOrder(
  body: CreatePurchaseOrderBody,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<PurchaseOrderDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const notes = wireNotes(body.notes);
  const wireBody: Record<string, unknown> = {
    supplierPartyId: body.supplierPartyId,
    supplierAccountId: body.supplierAccountId,
    currencyCode: body.currencyCode,
    receivingNodeId: body.receivingNodeId,
    ...(body.draftReference?.trim() ? { draftReference: body.draftReference.trim() } : {}),
    lines: body.lines.map((line) => ({
      clientLineId: line.clientLineId,
      itemId: line.itemId,
      uomId: line.uomId,
      quantity: line.quantity,
      ...(line.expectedDate ? { expectedDate: line.expectedDate } : {}),
      ...(line.receivingNodeId ? { receivingNodeId: line.receivingNodeId } : {}),
      financial: wireLineFinancial(line.financial, true),
    })),
    totals: wireTotalsEvidence(body.totals),
    ...(body.expectedPricingFingerprint
      ? { expectedPricingFingerprint: body.expectedPricingFingerprint }
      : {}),
    termSelections: termSelectionsBody(body.termSelections),
    ...(notes !== undefined ? { notes } : {}),
    ...(body.extensionValues !== undefined ? { extensionValues: body.extensionValues } : {}),
  };
  const { data } = await tradeHttp().write<PurchaseOrderDetail>('POST', '/purchase-orders', wireBody, {
    key: idempotencyKey,
    scope,
  });
  invalidateDocumentQueries('purchase-order');
  return mapCommandDetail('purchase-order', data);
}

/** PATCH /api/tenant/trade/v1/purchase-orders/:id (headers: x-idempotency-key, If-Match: "<version>") */
export async function updatePurchaseOrder(
  id: string,
  version: number,
  body: UpdatePurchaseOrderBody,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<PurchaseOrderDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const notes = wireNotes(body.notes, true);
  const wireBody: Record<string, unknown> = {
    ...(body.receivingNodeId ? { receivingNodeId: body.receivingNodeId } : {}),
    ...(body.draftReference !== undefined ? { draftReference: body.draftReference } : {}),
    ...(body.termSelections !== undefined
      ? { termSelections: termSelectionsBody(body.termSelections) }
      : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
  const { data } = await tradeHttp().write<PurchaseOrderDetail>(
    'PATCH',
    `/purchase-orders/${encodeURIComponent(id)}`,
    wireBody,
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries('purchase-order');
  return mapCommandDetail('purchase-order', data);
}

/** POST /api/tenant/trade/v1/purchase-orders/:id/<submit|withdraw|approve|reject|confirm|cancel> (headers: x-idempotency-key, If-Match: "<version>") */
export async function purchaseOrderAction(
  id: string,
  version: number,
  action: PurchaseOrderActionKind,
  reason: ReasonInput | undefined,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<PurchaseOrderDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const { data } = await tradeHttp().write<PurchaseOrderDetail>(
    'POST',
    `/purchase-orders/${encodeURIComponent(id)}/${action}`,
    reason ? wireReasonBody(reason) : {},
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries('purchase-order');
  return mapCommandDetail('purchase-order', data);
}

/** POST /api/tenant/trade/v1/purchase-orders/:id/delivery/retry (headers: x-idempotency-key, If-Match: "<version>") */
export async function retryPurchaseDelivery(
  id: string,
  version: number,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<PurchaseOrderDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const { data } = await tradeHttp().write<PurchaseOrderDetail>(
    'POST',
    `/purchase-orders/${encodeURIComponent(id)}/delivery/retry`,
    undefined,
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries('purchase-order');
  return mapCommandDetail('purchase-order', data);
}

/** POST /api/tenant/trade/v1/purchase-quotations (headers: x-idempotency-key) */
export async function createPurchaseQuotation(
  body: CreatePurchaseQuotationBody,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<PurchaseQuotationDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const notes = wireNotes(body.notes);
  const wireBody: Record<string, unknown> = {
    supplierPartyId: body.supplierPartyId,
    currencyCode: body.currencyCode,
    validUntil: body.validUntil,
    ...(body.reference?.trim() ? { reference: body.reference.trim() } : {}),
    ...(body.termSelections !== undefined
      ? { termSelections: termSelectionsBody(body.termSelections) }
      : {}),
    ...(notes !== undefined ? { notes } : {}),
    lines: body.lines.map((line) => ({
      clientLineId: line.clientLineId,
      itemId: line.itemId,
      uomId: line.uomId,
      quantity: line.quantity,
    })),
  };
  const { data } = await tradeHttp().write<PurchaseQuotationDetail>(
    'POST',
    '/purchase-quotations',
    wireBody,
    {
      key: idempotencyKey,
      scope,
    },
  );
  invalidateDocumentQueries('purchase-quotation');
  return mapCommandDetail('purchase-quotation', data);
}

/** PATCH /api/tenant/trade/v1/purchase-quotations/:id (headers: x-idempotency-key, If-Match: "<version>") */
export async function updatePurchaseQuotation(
  id: string,
  version: number,
  body: UpdatePurchaseQuotationBody,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<PurchaseQuotationDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const notes = wireNotes(body.notes, true);
  const wireBody: Record<string, unknown> = {
    ...(body.supplierPartyId ? { supplierPartyId: body.supplierPartyId } : {}),
    ...(body.currencyCode ? { currencyCode: body.currencyCode } : {}),
    ...(body.validUntil ? { validUntil: body.validUntil } : {}),
    ...(body.reference !== undefined ? { reference: body.reference } : {}),
    ...(body.termSelections !== undefined
      ? { termSelections: termSelectionsBody(body.termSelections) }
      : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(body.lines !== undefined
      ? {
          lines: body.lines.map((line) => ({
            clientLineId: line.clientLineId,
            itemId: line.itemId,
            uomId: line.uomId,
            quantity: line.quantity,
          })),
        }
      : {}),
  };
  const { data } = await tradeHttp().write<PurchaseQuotationDetail>(
    'PATCH',
    `/purchase-quotations/${encodeURIComponent(id)}`,
    wireBody,
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries('purchase-quotation');
  return mapCommandDetail('purchase-quotation', data);
}

/** POST /api/tenant/trade/v1/purchase-quotations/:id/issue (headers: x-idempotency-key, If-Match: "<version>") */
export async function issuePurchaseQuotation(
  id: string,
  version: number,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<PurchaseQuotationDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const { data } = await tradeHttp().write<PurchaseQuotationDetail>(
    'POST',
    `/purchase-quotations/${encodeURIComponent(id)}/issue`,
    undefined,
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries('purchase-quotation');
  return mapCommandDetail('purchase-quotation', data);
}

/** POST /api/tenant/trade/v1/purchase-quotations/:id/cancel (headers: x-idempotency-key, If-Match: "<version>") */
export async function cancelPurchaseQuotation(
  id: string,
  version: number,
  reason: ReasonInput,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<PurchaseQuotationDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const { data } = await tradeHttp().write<PurchaseQuotationDetail>(
    'POST',
    `/purchase-quotations/${encodeURIComponent(id)}/cancel`,
    wireReasonBody(reason),
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries('purchase-quotation');
  return mapCommandDetail('purchase-quotation', data);
}

/** POST /api/tenant/trade/v1/purchase-quotations/:id/convert-to-purchase-order (headers: x-idempotency-key, If-Match: "<version>") */
export async function convertPurchaseQuotation(
  id: string,
  version: number,
  body: ConvertPurchaseQuotationBody,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<PurchaseOrderDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const notes = wireNotes(body.notes);
  const wireBody: Record<string, unknown> = {
    supplierAccountId: body.supplierAccountId,
    receivingNodeId: body.receivingNodeId,
    ...(body.draftReference?.trim() ? { draftReference: body.draftReference.trim() } : {}),
    lines: body.lines.map((line) => ({
      clientLineId: line.clientLineId,
      ...(line.expectedDate ? { expectedDate: line.expectedDate } : {}),
      ...(line.receivingNodeId ? { receivingNodeId: line.receivingNodeId } : {}),
      financial: wireLineFinancial(line.financial, true),
    })),
    totals: wireTotalsEvidence(body.totals),
    ...(body.termSelections !== undefined
      ? { termSelections: termSelectionsBody(body.termSelections) }
      : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
  const { data } = await tradeHttp().write<PurchaseOrderDetail>(
    'POST',
    `/purchase-quotations/${encodeURIComponent(id)}/convert-to-purchase-order`,
    wireBody,
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries('purchase-quotation');
  invalidateDocumentQueries('purchase-order');
  return mapCommandDetail('purchase-order', data);
}

/** POST /api/tenant/trade/v1/purchase-quotations/:id/create-purchase-order (headers: x-idempotency-key, If-Match: "<version>") */
export async function createPurchaseOrderFromPurchaseQuotation(
  id: string,
  version: number,
  body: DirectPurchaseOrderFromPurchaseQuotationBody,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<PurchaseOrderDetail> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const wireBody: Record<string, unknown> = {
    ...(body.supplierAccountId ? { supplierAccountId: body.supplierAccountId } : {}),
    receivingNodeId: body.receivingNodeId,
    ...(body.draftReference?.trim() ? { draftReference: body.draftReference.trim() } : {}),
  };
  const { data } = await tradeHttp().write<PurchaseOrderDetail>(
    'POST',
    `/purchase-quotations/${encodeURIComponent(id)}/create-purchase-order`,
    wireBody,
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries('purchase-quotation');
  invalidateDocumentQueries('purchase-order');
  return mapCommandDetail('purchase-order', data);
}

/** DELETE /api/tenant/trade/v1/<segment>/:id (headers: x-idempotency-key, If-Match: "<version>") */
export async function deleteDocument(
  kind: DocumentKind,
  id: string,
  version: number,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<void> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  await tradeHttp().write<unknown>(
    'DELETE',
    `/${segmentOf(kind)}/${encodeURIComponent(id)}`,
    undefined,
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries(kind);
}

/** PUT /api/tenant/trade/v1/<sales-orders|purchase-orders>/:id/lines (headers: x-idempotency-key, If-Match: "<version>") */
export async function replaceOrderLines<K extends 'sales-order' | 'purchase-order'>(
  kind: K,
  id: string,
  version: number,
  body: ReplaceOrderLinesBody,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<DocumentDetailByKind[K]> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const isPurchaseOrder = kind === 'purchase-order';
  const notes = wireNotes(body.notes);
  const wireBody: Record<string, unknown> = {
    lines: body.lines.map((line) => ({
      clientLineId: line.clientLineId,
      itemId: line.itemId,
      uomId: line.uomId,
      quantity: line.quantity,
      ...(isPurchaseOrder && line.expectedDate ? { expectedDate: line.expectedDate } : {}),
      ...(isPurchaseOrder && line.receivingNodeId ? { receivingNodeId: line.receivingNodeId } : {}),
      financial: wireLineFinancial(line.financial, isPurchaseOrder),
    })),
    totals: wireTotalsEvidence(body.totals),
    ...(body.expectedPricingFingerprint
      ? { expectedPricingFingerprint: body.expectedPricingFingerprint }
      : {}),
    ...(body.termSelections !== undefined
      ? { termSelections: termSelectionsBody(body.termSelections) }
      : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
  const { data } = await tradeHttp().write<DocumentDetailByKind[K]>(
    'PUT',
    `/${segmentOf(kind)}/${encodeURIComponent(id)}/lines`,
    wireBody,
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  invalidateDocumentQueries(kind);
  return mapCommandDetail(kind, data) as DocumentDetailByKind[K];
}

/** POST /api/tenant/trade/v1/<segment>/:id/render-pdf (202; headers: x-idempotency-key) */
export async function renderPdf(
  kind: DocumentKind,
  id: string,
  body: RenderPdfBody,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<RenderJob> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  const wireBody: Record<string, unknown> = kind === 'quotation'
    ? {
        revisionId: body.revisionId,
        purpose: body.purpose,
        ...(body.templateVersionId ? { templateVersionId: body.templateVersionId } : {}),
        ...(body.templateChoice ? { templateChoice: body.templateChoice } : {}),
        ...(body.locale ? { locale: body.locale } : {}),
      }
    : {
        sourceVersion: body.sourceVersion,
        purpose: body.purpose,
        ...(body.templateVersionId ? { templateVersionId: body.templateVersionId } : {}),
        ...(body.locale ? { locale: body.locale } : {}),
      };
  const { data } = await tradeHttp().write<RenderJob>(
    'POST',
    `/${segmentOf(kind)}/${encodeURIComponent(id)}/render-pdf`,
    wireBody,
    { key: idempotencyKey, scope },
  );
  return data;
}

/** GET /api/tenant/trade/v1/<segment>/:id/render-jobs/:jobId */
export function getRenderJob(
  kind: DocumentKind,
  id: string,
  jobId: string,
  ctx?: TradeContext | ScopeState,
): Promise<RenderJob> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  return tradeHttp().read<RenderJob>(
    `/${segmentOf(kind)}/${encodeURIComponent(id)}/render-jobs/${encodeURIComponent(jobId)}`,
    undefined,
    { scope },
  );
}

/** GET /api/tenant/trade/v1/<segment>/:id/render-jobs/:jobId/artifact (application/pdf binary stream) */
export function getRenderJobArtifact(
  kind: DocumentKind,
  id: string,
  jobId: string,
  ctx?: TradeContext | ScopeState,
): Promise<Blob> {
  const scope = scopeFor(toContext(ctx), 'BRANCH');
  return tradeHttp().readBlob(
    `/${segmentOf(kind)}/${encodeURIComponent(id)}/render-jobs/${encodeURIComponent(jobId)}/artifact`,
    undefined,
    { scope },
  );
}
