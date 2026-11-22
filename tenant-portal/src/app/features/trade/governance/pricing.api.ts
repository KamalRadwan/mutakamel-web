import type { Page } from '../shared/trade-foundation.model';
import type { WriteOptions } from './governance-fake-actors';
import {
  fakeChangeEntries,
  fakeChangePromotions,
  fakeCloneVersion,
  fakeCreatePriceBook,
  fakeCreateVersion,
  fakeDeleteCompanyDefault,
  fakeDeleteVersion,
  fakeEvaluatePricing,
  fakeGetDiff,
  fakeGetKpis,
  fakeGetPriceBook,
  fakeGetPriceVersion,
  fakeGetReferenceData,
  fakeListCompanyDefaults,
  fakeListEntries,
  fakeListPriceBooks,
  fakePublishVersion,
  fakeRetireVersion,
  fakeTestVersion,
  fakeUpdatePriceBook,
  fakeUpdateVersion,
  fakeUpsertCompanyDefault,
} from './pricing.fake';
import type {
  ChangeEntriesInput,
  ChangeEntriesResult,
  ChangePromotionsInput,
  ChangePromotionsResult,
  CloneVersionInput,
  CompanyDefaultList,
  CompanyDefaultRow,
  CreatedPriceBook,
  CreatePriceBookInput,
  CreateVersionInput,
  DeletedResult,
  ListEntriesQuery,
  ListPriceBooksQuery,
  PriceBookDossier,
  PriceBookHeader,
  PriceBookKpis,
  PriceBookKpisQuery,
  PriceBookListItem,
  PriceDiff,
  PriceEntry,
  PricePurpose,
  PriceTestResult,
  PriceVersionDetail,
  PriceVersionHeadDetail,
  PriceVersionRow,
  PricingDecision,
  PricingEvaluateInput,
  PricingReferenceData,
  PublishPriceVersionInput,
  RetirePriceVersionInput,
  SavedPriceVersion,
  UpdatePriceBookInput,
  UpdateVersionInput,
} from './pricing.model';

// Routes follow trade-app pricing.controller.ts and pricing-read.controller.ts.
// Every write sends x-idempotency-key; writes on an existing row also send If-Match.

export const PRICING_QUERY_KEYS = {
  all: ['trade', 'pricing'] as const,
  books: (q?: ListPriceBooksQuery) => ['trade', 'pricing', 'books', q ?? {}] as const,
  kpis: (q?: PriceBookKpisQuery) => ['trade', 'pricing', 'kpis', q ?? {}] as const,
  book: (id: string) => ['trade', 'pricing', 'book', id] as const,
  version: (id: string, include: 'entries' | 'none' = 'entries') =>
    ['trade', 'pricing', 'version', id, include] as const,
  entries: (versionId: string, q?: ListEntriesQuery) =>
    ['trade', 'pricing', 'entries', versionId, q ?? {}] as const,
  diff: (id: string, compareId: string) => ['trade', 'pricing', 'diff', id, compareId] as const,
  referenceData: () => ['trade', 'pricing', 'reference-data'] as const,
  companyDefaults: () => ['trade', 'pricing', 'company-defaults'] as const,
};

// GET /api/tenant/trade/v1/price-books?page&limit&purpose&status&currencyCode&q&governanceState
export function listPriceBooks(q: ListPriceBooksQuery = {}): Promise<Page<PriceBookListItem>> {
  return fakeListPriceBooks(q);
}

// GET /api/tenant/trade/v1/price-books/kpis?purpose&status&currencyCode&q
export function getKpis(q: PriceBookKpisQuery = {}): Promise<PriceBookKpis> {
  return fakeGetKpis(q);
}

// GET /api/tenant/trade/v1/price-books/:id
export function getPriceBook(id: string): Promise<PriceBookDossier> {
  return fakeGetPriceBook(id);
}

// GET /api/tenant/trade/v1/price-book-versions/:id?include=entries|none
export function getPriceVersion(id: string, opts?: { include?: 'entries' }): Promise<PriceVersionDetail>;
export function getPriceVersion(id: string, opts: { include: 'none' }): Promise<PriceVersionHeadDetail>;
export function getPriceVersion(
  id: string,
  opts: { include?: 'entries' | 'none' } = {},
): Promise<PriceVersionDetail | PriceVersionHeadDetail> {
  return fakeGetPriceVersion(id, opts.include ?? 'entries');
}

// GET /api/tenant/trade/v1/price-book-versions/:id/entries?page&limit&q&uomId&itemId&sort&dir
export function listEntries(
  versionId: string,
  q: ListEntriesQuery = {},
): Promise<Page<PriceEntry>> {
  return fakeListEntries(versionId, q);
}

// GET /api/tenant/trade/v1/price-book-versions/:id/diff/:compareVersionId
export function getDiff(id: string, compareVersionId: string): Promise<PriceDiff> {
  return fakeGetDiff(id, compareVersionId);
}

// GET /api/tenant/trade/v1/pricing/reference-data
export function getReferenceData(): Promise<PricingReferenceData> {
  return fakeGetReferenceData();
}

// GET /api/tenant/trade/v1/configuration/company-default-price-books
export function listCompanyDefaults(): Promise<CompanyDefaultList> {
  return fakeListCompanyDefaults();
}

// POST /api/tenant/trade/v1/price-books
export function createPriceBook(
  input: CreatePriceBookInput,
  opts?: WriteOptions | string,
): Promise<CreatedPriceBook> {
  return fakeCreatePriceBook(input, opts);
}

// PATCH /api/tenant/trade/v1/price-books/:id
export function updatePriceBook(
  id: string,
  input: UpdatePriceBookInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<PriceBookHeader> {
  return fakeUpdatePriceBook(id, input, ifMatchOrOpts, idempotencyKey);
}

// POST /api/tenant/trade/v1/price-books/:id/versions (If-Match: the book version)
export function createVersion(
  bookId: string,
  input: CreateVersionInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<SavedPriceVersion> {
  return fakeCreateVersion(bookId, input, ifMatchOrOpts, idempotencyKey);
}

// POST /api/tenant/trade/v1/price-books/:id/versions/clone (If-Match: the book version)
export function cloneVersion(
  bookId: string,
  input: CloneVersionInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<SavedPriceVersion> {
  return fakeCloneVersion(bookId, input, ifMatchOrOpts, idempotencyKey);
}

// PATCH /api/tenant/trade/v1/price-book-versions/:id
export function updateVersion(
  id: string,
  input: UpdateVersionInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<SavedPriceVersion> {
  return fakeUpdateVersion(id, input, ifMatchOrOpts, idempotencyKey);
}

// POST /api/tenant/trade/v1/price-book-versions/:id/entries/changes
export function changeEntries(
  versionId: string,
  input: ChangeEntriesInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<ChangeEntriesResult> {
  return fakeChangeEntries(versionId, input, ifMatchOrOpts, idempotencyKey);
}

// POST /api/tenant/trade/v1/price-book-versions/:id/promotions/changes
export function changePromotions(
  versionId: string,
  input: ChangePromotionsInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<ChangePromotionsResult> {
  return fakeChangePromotions(versionId, input, ifMatchOrOpts, idempotencyKey);
}

// DELETE /api/tenant/trade/v1/price-book-versions/:id
export function deleteVersion(
  id: string,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<DeletedResult> {
  return fakeDeleteVersion(id, ifMatchOrOpts, idempotencyKey);
}

// POST /api/tenant/trade/v1/price-book-versions/:id/test
export function testVersion(
  id: string,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<PriceTestResult> {
  return fakeTestVersion(id, ifMatchOrOpts, idempotencyKey);
}

// POST /api/tenant/trade/v1/price-book-versions/:id/publish
export function publishVersion(
  id: string,
  input: PublishPriceVersionInput = {},
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<PriceVersionRow> {
  return fakePublishVersion(id, input, ifMatchOrOpts, idempotencyKey);
}

// POST /api/tenant/trade/v1/price-book-versions/:id/retire
export function retireVersion(
  id: string,
  body: RetirePriceVersionInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<PriceVersionRow> {
  return fakeRetireVersion(id, body, ifMatchOrOpts, idempotencyKey);
}

// POST /api/tenant/trade/v1/configuration/company-default-price-books/:purpose/:currencyCode/upsert
// If-Match 0 creates (201), the mapping version replaces (200).
export function upsertCompanyDefault(
  purpose: PricePurpose,
  currencyCode: string,
  priceBookId: string,
  ifMatchOrOpts: number | WriteOptions = 0,
  idempotencyKey?: string,
): Promise<CompanyDefaultRow> {
  return fakeUpsertCompanyDefault(purpose, currencyCode, priceBookId, ifMatchOrOpts, idempotencyKey);
}

// DELETE /api/tenant/trade/v1/configuration/company-default-price-books/:purpose/:currencyCode
export function deleteCompanyDefault(
  purpose: PricePurpose,
  currencyCode: string,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<DeletedResult> {
  return fakeDeleteCompanyDefault(purpose, currencyCode, ifMatchOrOpts, idempotencyKey);
}

// POST /api/tenant/trade/v1/pricing/evaluate
export function evaluate(input: PricingEvaluateInput): Promise<PricingDecision> {
  return fakeEvaluatePricing(input);
}
