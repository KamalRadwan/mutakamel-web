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
import { LanguageState } from '../../../../core/i18n/language';
import { ScopeState } from '../../../../core/scope/scope';
import { registerFakeBulkModuleLoader } from '../../../../shared/bulk-jobs/bulk-jobs.fake';
import type {
  Dec,
  DocumentByKind,
  DocumentDetailByKind,
  DocumentKind,
  ListQuery,
  OrderPreview,
  Page,
  PrintTemplateOption,
  PurchaseOrderDetail,
  PurchaseQuotationDetail,
  QuotationDetail,
  RenderJob,
  SalesOrder,
  SalesOrderDetail,
  SourceCrmOpportunity,
} from './document.model';
import {
  FAKE_CURRENT_USER_ID,
  fakeCancelPurchaseQuotation,
  fakeConfirmSalesOrder,
  fakeConvertPurchaseQuotation,
  fakeConvertQuotation,
  fakeCreatePurchaseOrder,
  fakeCreatePurchaseOrderFromPurchaseQuotation,
  fakeCreatePurchaseQuotation,
  fakeCreateQuotation,
  fakeCreateQuotationRevision,
  fakeCreateSalesOrder,
  fakeCreateSalesOrderFromQuotation,
  fakeDeleteDocument,
  fakeEvaluatePrice,
  fakeFindSalesOrderByQuotation,
  fakeGetDiscountPolicy,
  fakeGetDocument,
  fakeGetOpportunity,
  fakeGetRenderJob,
  fakeIssuePurchaseQuotation,
  fakeListContactOptions,
  fakeListCustomerOptions,
  fakeListDocuments,
  fakeListOpportunityOptions,
  fakeListPrintTemplates,
  fakeListReceivingNodes,
  fakeListSupplierOptions,
  fakePreviewOrderPricing,
  fakePreviewQuotationPricing,
  fakePurchaseOrderAction,
  fakeQuotationAction,
  fakeRenderPdf,
  fakeReplaceOrderLines,
  fakeRetryPurchaseDelivery,
  fakeSalesOrderAction,
  fakeStatusCounts,
  fakeUpdatePurchaseOrder,
  fakeUpdatePurchaseQuotation,
  fakeUpdateQuotation,
  fakeUpdateSalesOrder,
  setDocumentInvalidationListener,
  type BulkPrintArtifact,
  type ConfirmSalesOrderResult,
  type ContactOption,
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
  type CustomerOption,
  type CustomerOptionPage,
  type DirectPurchaseOrderFromPurchaseQuotationBody,
  type DirectSalesOrderFromQuotationBody,
  type DiscountPolicy,
  type DocumentStatusCountFilters,
  type DocumentStatusCounts,
  type OrderPricingPreviewBody,
  type OrderPricingPreviewLineInput,
  type PurchaseOrderActionKind,
  type QuotationActionKind,
  type QuotationPricingPreview,
  type QuotationPricingPreviewBody,
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

export { FAKE_CURRENT_USER_ID };
export type {
  BulkPrintArtifact,
  ConfirmSalesOrderResult,
  ContactOption,
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
  CustomerOption,
  CustomerOptionPage,
  DirectPurchaseOrderFromPurchaseQuotationBody,
  DirectSalesOrderFromQuotationBody,
  DiscountPolicy,
  DocumentStatusCountFilters,
  DocumentStatusCounts,
  OrderPricingPreviewBody,
  OrderPricingPreviewLineInput,
  PurchaseOrderActionKind,
  QuotationActionKind,
  QuotationPricingPreview,
  QuotationPricingPreviewBody,
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
): DocumentQueryResult<Page<DocumentByKind[K]>> {
  const lang = inject(LanguageState, { optional: true });
  const scope = inject(ScopeState, { optional: true });

  const res = resource({
    params: () => {
      const k = resolveInput(kind);
      return {
        kind: k,
        query: query(),
        rev: kindVersions[k](),
        lang: lang?.current(),
        companyId: scope?.company().id,
      };
    },
    loader: ({ params }) => fakeListDocuments(params.kind, params.query),
  });

  return toQueryResult(res, () => invalidateDocumentQueries(resolveInput(kind)));
}

/** Reactive query for ['trade-documents', kind, id]. Returns idle when id() is null. */
export function injectDocument<K extends DocumentKind>(
  kind: K | Signal<K>,
  id: Signal<string | null>,
): DocumentQueryResult<DocumentDetailByKind[K]> {
  const lang = inject(LanguageState, { optional: true });
  const scope = inject(ScopeState, { optional: true });

  const res = resource({
    params: () => {
      const docId = id();
      if (!docId) return undefined;
      const k = resolveInput(kind);
      return {
        kind: k,
        id: docId,
        rev: kindVersions[k](),
        lang: lang?.current(),
        companyId: scope?.company().id,
      };
    },
    loader: ({ params }) => fakeGetDocument(params.kind, params.id),
  });

  return toQueryResult(res, () => invalidateDocumentQueries(resolveInput(kind)));
}

/** Reactive query for quotation discount policy. Must be called inside an injection context. */
export function injectDiscountPolicy(): DocumentQueryResult<DiscountPolicy> {
  const res = resource({
    params: () => ({ rev: discountPolicyVersion() }),
    loader: () => fakeGetDiscountPolicy(),
  });

  return toQueryResult(res, () => discountPolicyVersion.update((n) => n + 1));
}

/** Reactive query for ['trade-documents', kind, 'counts', filters]. Must be called inside an injection context. */
export function injectStatusCounts(
  kind: DocumentKind | Signal<DocumentKind>,
  filters: Signal<DocumentStatusCountFilters>,
): DocumentQueryResult<DocumentStatusCounts> {
  const scope = inject(ScopeState, { optional: true });

  const res = resource({
    params: () => {
      const k = resolveInput(kind);
      return {
        kind: k,
        filters: filters(),
        rev: kindVersions[k](),
        companyId: scope?.company().id,
      };
    },
    loader: ({ params }) => fakeStatusCounts(params.kind, params.filters),
  });

  return toQueryResult(res, () => invalidateDocumentQueries(resolveInput(kind)));
}

// ---------------------------------------------------------------------------
// Plain async reads & previews
// ---------------------------------------------------------------------------

/** GET /api/tenant/trade/v1/<segment>?page&limit&status&search&... */
export function listDocuments<K extends DocumentKind>(kind: K, query: ListQuery): Promise<Page<DocumentByKind[K]>> {
  return fakeListDocuments(kind, query);
}

/** GET /api/tenant/trade/v1/<segment>/:id */
export function getDocument<K extends DocumentKind>(kind: K, id: string): Promise<DocumentDetailByKind[K]> {
  return fakeGetDocument(kind, id);
}

/** POST /api/tenant/trade/v1/<segment>/status-counts (filters in the body) */
export function statusCounts(
  kind: DocumentKind,
  filters: DocumentStatusCountFilters = {},
): Promise<DocumentStatusCounts> {
  return fakeStatusCounts(kind, filters);
}

/** GET /api/tenant/trade/v1/quotations/discount-policy */
export function getDiscountPolicy(): Promise<DiscountPolicy> {
  return fakeGetDiscountPolicy();
}

/** POST /api/tenant/trade/v1/quotations/pricing-preview */
export function previewQuotationPricing(body: QuotationPricingPreviewBody): Promise<QuotationPricingPreview> {
  return fakePreviewQuotationPricing(body);
}

/** POST /api/tenant/trade/v1/<sales-orders|purchase-orders>/pricing-preview */
export function previewOrderPricing(
  kind: 'sales-order' | 'purchase-order',
  body: OrderPricingPreviewBody,
): Promise<OrderPreview> {
  return fakePreviewOrderPricing(kind, body);
}

/** GET /api/tenant/trade/v1/quotations/customer-options?search&cursor */
export function listCustomerOptions(search?: string, cursor?: string): Promise<CustomerOptionPage> {
  return fakeListCustomerOptions(search, cursor);
}

/** GET /api/tenant/core/v1/parties/:partyId/contacts */
export function listContactOptions(partyId: string): Promise<ContactOption[]> {
  return fakeListContactOptions(partyId);
}

// pending backend: codex-b B8 is blocked (no commercial-account code column). Contract: { items: [{ partyId, displayName,
// accounts: [{ id, code, currencyCode }] }] } with code always null (Core parties have no code) and currencyCode = the
// account's credit currency or null (coordinator 2026-11-22); the picker shows "<displayName> · <currency>".
/** GET /api/tenant/trade/v1/purchase-orders/supplier-options?search */
export function listSupplierOptions(search?: string): Promise<SupplierOption[]> {
  return fakeListSupplierOptions(search);
}

/** GET /api/tenant/crm/v1/opportunities?customerProfileId&status=IN_PROGRESS */
export function listOpportunityOptions(customerPartyId: string): Promise<SourceCrmOpportunity[]> {
  return fakeListOpportunityOptions(customerPartyId);
}

/** GET /api/tenant/crm/v1/opportunities/:id (403/404 → null) */
export function getOpportunity(id: string): Promise<SourceCrmOpportunity | null> {
  return fakeGetOpportunity(id);
}

/** GET /api/tenant/trade/v1/inventory/nodes?status=ACTIVE (bare array, ordered by code) */
export function listReceivingNodes(): Promise<ReceivingNodeOption[]> {
  return fakeListReceivingNodes();
}

/** POST /api/tenant/trade/v1/pricing/evaluate */
export function evaluatePrice(
  purpose: 'SALES' | 'PURCHASE',
  itemId: string,
  uomId: string,
  quantity: Dec,
  currencyCode: string,
): Promise<{ unitPrice: Dec }> {
  return fakeEvaluatePrice(purpose, itemId, uomId, quantity, currencyCode);
}

/** GET /api/tenant/trade/v1/templates/assignments?purpose=<printPurpose> */
export function listPrintTemplates(kind: DocumentKind): Promise<PrintTemplateOption[]> {
  return fakeListPrintTemplates(kind);
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
export function getBulkPrintArtifact(jobId: string): Promise<BulkPrintArtifact> {
  return loadDocumentsBulkModules().then((bulk) => bulk.getBulkPrintArtifact(jobId));
}

// ---------------------------------------------------------------------------
// Commands. Each takes the caller's x-idempotency-key: one key per user action, the same key on a retry
// of that action (see document-request-keys.ts). Each invalidates the matching queries.
// ---------------------------------------------------------------------------

/** POST /api/tenant/trade/v1/quotations (headers: x-idempotency-key) */
export async function createQuotation(
  body: CreateQuotationBody,
  idempotencyKey: string,
): Promise<QuotationDetail> {
  const created = await fakeCreateQuotation(body, idempotencyKey);
  invalidateDocumentQueries('quotation');
  return created;
}

/** PATCH /api/tenant/trade/v1/quotations/:id (headers: x-idempotency-key, If-Match: "<version>") */
export async function updateQuotation(
  id: string,
  version: number,
  body: UpdateQuotationBody,
  idempotencyKey: string,
): Promise<QuotationDetail> {
  const updated = await fakeUpdateQuotation(id, version, body, idempotencyKey);
  invalidateDocumentQueries('quotation');
  return updated;
}

/** POST /api/tenant/trade/v1/quotations/:id/revisions (headers: x-idempotency-key, If-Match: "<version>") */
export async function createQuotationRevision(
  id: string,
  version: number,
  body: CreateQuotationRevisionBody,
  idempotencyKey: string,
): Promise<CreateQuotationRevisionResult> {
  const revision = await fakeCreateQuotationRevision(id, version, body, idempotencyKey);
  invalidateDocumentQueries('quotation');
  return revision;
}

/** POST /api/tenant/trade/v1/quotations/:id/<send|accept|reject|cancel> (headers: x-idempotency-key, If-Match: "<version>") */
export async function quotationAction(
  id: string,
  version: number,
  action: QuotationActionKind,
  reason: ReasonInput | undefined,
  idempotencyKey: string,
): Promise<QuotationDetail> {
  const updated = await fakeQuotationAction(id, version, action, reason, { idempotencyKey });
  invalidateDocumentQueries('quotation');
  return updated;
}

/** POST /api/tenant/trade/v1/quotations/:id/convert-to-sales-order (gateway row trading.quotations.by-id.convert.to.sales.order.post; headers: x-idempotency-key, If-Match: "<version>") */
export async function convertQuotation(
  id: string,
  version: number,
  body: ConvertQuotationBody,
  idempotencyKey: string,
): Promise<SalesOrderDetail> {
  const order = await fakeConvertQuotation(id, version, body, idempotencyKey);
  invalidateDocumentQueries('quotation');
  invalidateDocumentQueries('sales-order');
  return order;
}

// pending gateway row: trade-app serves POST quotations/:id/create-sales-order (direct copy, same service call as
// convert with direct = true), but the gateway lists only convert-to-sales-order for quotations.
/** POST /api/tenant/trade/v1/quotations/:id/create-sales-order (headers: x-idempotency-key, If-Match: "<version>") */
export async function createSalesOrderFromQuotation(
  id: string,
  version: number,
  body: DirectSalesOrderFromQuotationBody,
  idempotencyKey: string,
): Promise<SalesOrderDetail> {
  const order = await fakeCreateSalesOrderFromQuotation(id, version, body, idempotencyKey);
  invalidateDocumentQueries('quotation');
  invalidateDocumentQueries('sales-order');
  return order;
}

/** POST /api/tenant/trade/v1/sales-orders (headers: x-idempotency-key) */
export async function createSalesOrder(
  body: CreateSalesOrderBody,
  idempotencyKey: string,
): Promise<SalesOrderDetail> {
  const created = await fakeCreateSalesOrder(body, idempotencyKey);
  invalidateDocumentQueries('sales-order');
  return created;
}

/** PATCH /api/tenant/trade/v1/sales-orders/:id (headers: x-idempotency-key, If-Match: "<version>") */
export async function updateSalesOrder(
  id: string,
  version: number,
  body: UpdateSalesOrderBody,
  idempotencyKey: string,
): Promise<SalesOrderDetail> {
  const updated = await fakeUpdateSalesOrder(id, version, body, idempotencyKey);
  invalidateDocumentQueries('sales-order');
  return updated;
}

/** POST /api/tenant/trade/v1/sales-orders/:id/confirm (headers: x-idempotency-key, If-Match: "<version>") */
export async function confirmSalesOrder(
  id: string,
  version: number,
  requestedDeadline: string | undefined,
  idempotencyKey: string,
): Promise<ConfirmSalesOrderResult> {
  const receipt = await fakeConfirmSalesOrder(id, version, requestedDeadline, idempotencyKey);
  invalidateDocumentQueries('sales-order');
  return receipt;
}

/** POST /api/tenant/trade/v1/sales-orders/:id/<hold|release-hold|cancel> (headers: x-idempotency-key, If-Match: "<version>") */
export async function salesOrderAction(
  id: string,
  version: number,
  action: SalesOrderActionKind,
  reason: ReasonInput,
  idempotencyKey: string,
): Promise<SalesOrderDetail> {
  const updated = await fakeSalesOrderAction(id, version, action, reason, { idempotencyKey });
  invalidateDocumentQueries('sales-order');
  return updated;
}

/** POST /api/tenant/trade/v1/purchase-orders (headers: x-idempotency-key) */
export async function createPurchaseOrder(
  body: CreatePurchaseOrderBody,
  idempotencyKey: string,
): Promise<PurchaseOrderDetail> {
  const created = await fakeCreatePurchaseOrder(body, idempotencyKey);
  invalidateDocumentQueries('purchase-order');
  return created;
}

/** PATCH /api/tenant/trade/v1/purchase-orders/:id (headers: x-idempotency-key, If-Match: "<version>") */
export async function updatePurchaseOrder(
  id: string,
  version: number,
  body: UpdatePurchaseOrderBody,
  idempotencyKey: string,
): Promise<PurchaseOrderDetail> {
  const updated = await fakeUpdatePurchaseOrder(id, version, body, idempotencyKey);
  invalidateDocumentQueries('purchase-order');
  return updated;
}

/** POST /api/tenant/trade/v1/purchase-orders/:id/<submit|withdraw|approve|reject|confirm|cancel> (headers: x-idempotency-key, If-Match: "<version>") */
export async function purchaseOrderAction(
  id: string,
  version: number,
  action: PurchaseOrderActionKind,
  reason: ReasonInput | undefined,
  idempotencyKey: string,
): Promise<PurchaseOrderDetail> {
  const updated = await fakePurchaseOrderAction(id, version, action, reason, { idempotencyKey });
  invalidateDocumentQueries('purchase-order');
  return updated;
}

/** POST /api/tenant/trade/v1/purchase-orders/:id/delivery/retry (headers: x-idempotency-key, If-Match: "<version>") */
export async function retryPurchaseDelivery(
  id: string,
  version: number,
  idempotencyKey: string,
): Promise<PurchaseOrderDetail> {
  const updated = await fakeRetryPurchaseDelivery(id, version, idempotencyKey);
  invalidateDocumentQueries('purchase-order');
  return updated;
}

/** POST /api/tenant/trade/v1/purchase-quotations (headers: x-idempotency-key) */
export async function createPurchaseQuotation(
  body: CreatePurchaseQuotationBody,
  idempotencyKey: string,
): Promise<PurchaseQuotationDetail> {
  const created = await fakeCreatePurchaseQuotation(body, idempotencyKey);
  invalidateDocumentQueries('purchase-quotation');
  return created;
}

/** PATCH /api/tenant/trade/v1/purchase-quotations/:id (headers: x-idempotency-key, If-Match: "<version>") */
export async function updatePurchaseQuotation(
  id: string,
  version: number,
  body: UpdatePurchaseQuotationBody,
  idempotencyKey: string,
): Promise<PurchaseQuotationDetail> {
  const updated = await fakeUpdatePurchaseQuotation(id, version, body, idempotencyKey);
  invalidateDocumentQueries('purchase-quotation');
  return updated;
}

/** POST /api/tenant/trade/v1/purchase-quotations/:id/issue (headers: x-idempotency-key, If-Match: "<version>") */
export async function issuePurchaseQuotation(
  id: string,
  version: number,
  idempotencyKey: string,
): Promise<PurchaseQuotationDetail> {
  const issued = await fakeIssuePurchaseQuotation(id, version, { idempotencyKey });
  invalidateDocumentQueries('purchase-quotation');
  return issued;
}

// pending gateway row: trade-app serves purchase-quotations/:id/cancel, convert-to-purchase-order and
// create-purchase-order; the gateway lists only create, update, issue and render-pdf for purchase quotations.
/** POST /api/tenant/trade/v1/purchase-quotations/:id/cancel (headers: x-idempotency-key, If-Match: "<version>") */
export async function cancelPurchaseQuotation(
  id: string,
  version: number,
  reason: ReasonInput,
  idempotencyKey: string,
): Promise<PurchaseQuotationDetail> {
  const cancelled = await fakeCancelPurchaseQuotation(id, version, reason, { idempotencyKey });
  invalidateDocumentQueries('purchase-quotation');
  return cancelled;
}

/** POST /api/tenant/trade/v1/purchase-quotations/:id/convert-to-purchase-order (headers: x-idempotency-key, If-Match: "<version>") */
export async function convertPurchaseQuotation(
  id: string,
  version: number,
  body: ConvertPurchaseQuotationBody,
  idempotencyKey: string,
): Promise<PurchaseOrderDetail> {
  const order = await fakeConvertPurchaseQuotation(id, version, body, idempotencyKey);
  invalidateDocumentQueries('purchase-quotation');
  invalidateDocumentQueries('purchase-order');
  return order;
}

/** POST /api/tenant/trade/v1/purchase-quotations/:id/create-purchase-order (headers: x-idempotency-key, If-Match: "<version>") */
export async function createPurchaseOrderFromPurchaseQuotation(
  id: string,
  version: number,
  body: DirectPurchaseOrderFromPurchaseQuotationBody,
  idempotencyKey: string,
): Promise<PurchaseOrderDetail> {
  const order = await fakeCreatePurchaseOrderFromPurchaseQuotation(id, version, body, idempotencyKey);
  invalidateDocumentQueries('purchase-quotation');
  invalidateDocumentQueries('purchase-order');
  return order;
}

// pending gateway row: trade-app serves DELETE quotations|sales-orders|purchase-orders|purchase-quotations/:id;
// the gateway has no DELETE row for them yet.
/** DELETE /api/tenant/trade/v1/<segment>/:id (headers: x-idempotency-key, If-Match: "<version>") */
export async function deleteDocument(
  kind: DocumentKind,
  id: string,
  version: number,
  idempotencyKey: string,
): Promise<void> {
  await fakeDeleteDocument(kind, id, version, idempotencyKey);
  invalidateDocumentQueries(kind);
}

// pending gateway row: trade-app serves PUT sales-orders|purchase-orders/:id/lines; the gateway has no row yet.
/** PUT /api/tenant/trade/v1/<sales-orders|purchase-orders>/:id/lines (headers: x-idempotency-key, If-Match: "<version>") */
export async function replaceOrderLines<K extends 'sales-order' | 'purchase-order'>(
  kind: K,
  id: string,
  version: number,
  body: ReplaceOrderLinesBody,
  idempotencyKey: string,
): Promise<DocumentDetailByKind[K]> {
  const updated = await fakeReplaceOrderLines(kind, id, version, body, idempotencyKey);
  invalidateDocumentQueries(kind);
  return updated;
}

/** POST /api/tenant/trade/v1/<segment>/:id/render-pdf (202; headers: x-idempotency-key) */
export function renderPdf(
  kind: DocumentKind,
  id: string,
  body: RenderPdfBody,
  idempotencyKey: string,
): Promise<RenderJob> {
  return fakeRenderPdf(kind, id, body, { idempotencyKey });
}

// The artifact download GET <segment>/:id/render-jobs/:jobId/artifact (application/pdf, inline) exists in trade-app for
// quotations, sales orders, purchase orders and purchase quotations (codex-f print run). The gateway has the quotation
// row only; the SO/PO/PQ rows (trading.<segment>.render-pdf.artifact.get) are pending Governance.
/** GET /api/tenant/trade/v1/<segment>/:id/render-jobs/:jobId */
export function getRenderJob(kind: DocumentKind, id: string, jobId: string): Promise<RenderJob> {
  return fakeGetRenderJob(kind, id, jobId);
}
