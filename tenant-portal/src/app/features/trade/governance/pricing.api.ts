import type { CoreQuery } from '../../../core/api/core-http';
import {
  ApiError,
  type TradeContext,
  assertBodyBooleans,
  assertIdempotencyKey,
  ifMatch,
  newIdempotencyKey,
  scopeFor,
} from '../shared/trade-api';
import type { Page } from '../shared/trade-foundation.model';
import { tradeHttp } from '../shared/trade-http';
import type {
  ChangeEntriesInput,
  ChangeEntriesResult,
  ChangePromotionsInput,
  ChangePromotionsResult,
  CloneVersionInput,
  CompanyDefaultList,
  CompanyDefaultRow,
  CreatePriceBookInput,
  CreateVersionInput,
  CreatedPriceBook,
  DeletedResult,
  EntryCreateInput,
  EntryInput,
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
  PricingWriteOptions,
  PromotionCreateInput,
  PromotionInput,
  PublishPriceVersionInput,
  ReferenceChannel,
  ReferenceCommercialAccount,
  ReferenceItem,
  ReferenceUom,
  RetirePriceVersionInput,
  SavedPriceVersion,
  UpdatePriceBookInput,
  UpdateVersionInput,
} from './pricing.model';

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

function encodeSeg(value: string): string {
  return encodeURIComponent(value);
}

function compactQuery(
  entries: Record<string, string | number | boolean | undefined>,
): CoreQuery | undefined {
  const result: Record<string, string | number | boolean> = {};
  let count = 0;
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined || v === '') continue;
    result[k] = v;
    count += 1;
  }
  return count > 0 ? result : undefined;
}

interface ResolvedWriteMeta {
  key: string;
  ifMatchHeader?: string;
  scope: TradeContext | undefined;
}

function resolveWriteMeta(
  ifMatchOrOpts: number | PricingWriteOptions | undefined,
  idempotencyKey: string | undefined,
  ctx: TradeContext | undefined,
  ifMatchMode: 'positive' | 'nonNegative' | 'none',
): ResolvedWriteMeta {
  const opts =
    typeof ifMatchOrOpts === 'object' && ifMatchOrOpts !== null ? ifMatchOrOpts : undefined;
  const expected =
    typeof ifMatchOrOpts === 'number' ? ifMatchOrOpts : opts?.ifMatch;
  const explicitKey =
    idempotencyKey !== undefined ? idempotencyKey : opts?.idempotencyKey;
  const resolvedCtx = ctx ?? opts?.ctx ?? {};

  const key = assertIdempotencyKey(
    explicitKey === undefined ? newIdempotencyKey() : explicitKey,
  );

  let ifMatchHeader: string | undefined;
  if (ifMatchMode !== 'none') {
    const min = ifMatchMode === 'nonNegative' ? 0 : 1;
    if (typeof expected !== 'number' || !Number.isSafeInteger(expected) || expected < min) {
      throw new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
    }
    ifMatchHeader = ifMatch(expected);
  }

  return {
    key,
    ifMatchHeader,
    scope: scopeFor(resolvedCtx, 'COMPANY'),
  };
}

function serializeEntry(entry: EntryInput, includeId: false): EntryCreateInput;
function serializeEntry(entry: EntryInput, includeId: true): EntryInput;
function serializeEntry(entry: EntryInput, includeId: boolean): EntryInput {
  return {
    ...(includeId && entry.id !== undefined ? { id: entry.id } : {}),
    itemId: entry.itemId,
    uomId: entry.uomId,
    currencyCode: entry.currencyCode,
    minimumQuantity: entry.minimumQuantity,
    ...(entry.maximumQuantity !== undefined ? { maximumQuantity: entry.maximumQuantity } : {}),
    unitPrice: entry.unitPrice,
    ...(entry.minimumAllowedPrice !== undefined
      ? { minimumAllowedPrice: entry.minimumAllowedPrice }
      : {}),
    ...(entry.priority !== undefined ? { priority: entry.priority } : {}),
  };
}

function serializePromotion(promo: PromotionInput, includeId: false): PromotionCreateInput;
function serializePromotion(promo: PromotionInput, includeId: true): PromotionInput;
function serializePromotion(promo: PromotionInput, includeId: boolean): PromotionInput {
  assertBodyBooleans(promo, ['exclusive']);
  return {
    ...(includeId && promo.id !== undefined ? { id: promo.id } : {}),
    code: promo.code,
    name: promo.name,
    ...(promo.itemId !== undefined ? { itemId: promo.itemId } : {}),
    ...(promo.uomId !== undefined ? { uomId: promo.uomId } : {}),
    ...(promo.branchId !== undefined ? { branchId: promo.branchId } : {}),
    ...(promo.channelId !== undefined ? { channelId: promo.channelId } : {}),
    ...(promo.partyId !== undefined ? { partyId: promo.partyId } : {}),
    ...(promo.minimumQuantity !== undefined ? { minimumQuantity: promo.minimumQuantity } : {}),
    ...(promo.maximumQuantity !== undefined ? { maximumQuantity: promo.maximumQuantity } : {}),
    benefitType: promo.benefitType,
    discountValue: promo.discountValue,
    ...(promo.priority !== undefined ? { priority: promo.priority } : {}),
    ...(promo.stackGroup !== undefined ? { stackGroup: promo.stackGroup } : {}),
    ...(promo.exclusive !== undefined ? { exclusive: promo.exclusive } : {}),
  };
}

interface RawReferenceBranch {
  id: string;
  code: string;
  name?: string;
  nameEn?: string;
  nameAr?: string;
  companyId?: string;
  isHeadquarters?: boolean;
}

interface RawReferenceCurrency {
  code: string;
  name?: string;
  nameEn?: string;
  nameAr?: string;
  symbol?: string | null;
  decimalPlaces: number;
  isDefault?: boolean;
}

interface RawPricingReferenceData {
  canViewCost?: boolean;
  items?: ReferenceItem[];
  uoms?: ReferenceUom[];
  branches?: RawReferenceBranch[];
  channels?: ReferenceChannel[];
  commercialAccounts?: ReferenceCommercialAccount[];
  currencies?: RawReferenceCurrency[];
}

function mapReferenceData(raw: RawPricingReferenceData, ctx: TradeContext): PricingReferenceData {
  return {
    canViewCost: Boolean(raw.canViewCost),
    items: raw.items ?? [],
    uoms: raw.uoms ?? [],
    branches: (raw.branches ?? []).map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name ?? b.nameEn ?? b.code,
      nameEn: b.nameEn ?? b.name ?? b.code,
      nameAr: b.nameAr ?? b.name ?? b.code,
      companyId: b.companyId ?? ctx.companyId ?? '',
      isHeadquarters: b.isHeadquarters ?? false,
    })),
    channels: raw.channels ?? [],
    commercialAccounts: raw.commercialAccounts ?? [],
    currencies: (raw.currencies ?? []).map((c) => ({
      code: c.code,
      name: c.name ?? c.nameEn ?? c.code,
      nameEn: c.nameEn ?? c.name ?? c.code,
      nameAr: c.nameAr ?? c.name ?? c.code,
      symbol: c.symbol ?? null,
      decimalPlaces: c.decimalPlaces,
      isDefault: c.isDefault ?? false,
    })),
  };
}

export function listPriceBooks(
  q: ListPriceBooksQuery = {},
  ctx: TradeContext = {},
): Promise<Page<PriceBookListItem>> {
  const query = compactQuery({
    page: q.page,
    limit: q.limit,
    purpose: q.purpose,
    status: q.status,
    currencyCode: q.currencyCode,
    q: q.q,
    governanceState: q.governanceState,
  });
  return tradeHttp().read<Page<PriceBookListItem>>('/price-books', query, {
    scope: scopeFor(ctx, 'OPTIONAL'),
  });
}

export function getKpis(
  q: PriceBookKpisQuery = {},
  ctx: TradeContext = {},
): Promise<PriceBookKpis> {
  const query = compactQuery({
    purpose: q.purpose,
    status: q.status,
    currencyCode: q.currencyCode,
    q: q.q,
  });
  return tradeHttp().read<PriceBookKpis>('/price-books/kpis', query, {
    scope: scopeFor(ctx, 'OPTIONAL'),
  });
}

export function getPriceBook(id: string, ctx: TradeContext = {}): Promise<PriceBookDossier> {
  return tradeHttp().read<PriceBookDossier>(`/price-books/${encodeSeg(id)}`, undefined, {
    scope: scopeFor(ctx, 'OPTIONAL'),
  });
}

export function getPriceVersion(
  id: string,
  opts?: { include?: 'entries' },
  ctx?: TradeContext,
): Promise<PriceVersionDetail>;
export function getPriceVersion(
  id: string,
  opts: { include: 'none' },
  ctx?: TradeContext,
): Promise<PriceVersionHeadDetail>;
export function getPriceVersion(
  id: string,
  opts: { include?: 'entries' | 'none' } = {},
  ctx: TradeContext = {},
): Promise<PriceVersionDetail | PriceVersionHeadDetail> {
  const query = compactQuery({ include: opts.include });
  return tradeHttp().read<PriceVersionDetail | PriceVersionHeadDetail>(
    `/price-book-versions/${encodeSeg(id)}`,
    query,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

export function listEntries(
  versionId: string,
  q: ListEntriesQuery = {},
  ctx: TradeContext = {},
): Promise<Page<PriceEntry>> {
  const query = compactQuery({
    page: q.page,
    limit: q.limit,
    q: q.q,
    uomId: q.uomId,
    itemId: q.itemId,
    sort: q.sort,
    dir: q.dir,
  });
  return tradeHttp().read<Page<PriceEntry>>(
    `/price-book-versions/${encodeSeg(versionId)}/entries`,
    query,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

export function getDiff(
  id: string,
  compareVersionId: string,
  ctx: TradeContext = {},
): Promise<PriceDiff> {
  return tradeHttp().read<PriceDiff>(
    `/price-book-versions/${encodeSeg(id)}/diff/${encodeSeg(compareVersionId)}`,
    undefined,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

export async function getReferenceData(ctx: TradeContext = {}): Promise<PricingReferenceData> {
  const raw = await tradeHttp().read<RawPricingReferenceData>('/pricing/reference-data', undefined, {
    scope: scopeFor(ctx, 'OPTIONAL'),
  });
  return mapReferenceData(raw, ctx);
}

export function listCompanyDefaults(ctx: TradeContext = {}): Promise<CompanyDefaultList> {
  return tradeHttp().read<CompanyDefaultList>(
    '/configuration/company-default-price-books',
    undefined,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

export async function createPriceBook(
  input: CreatePriceBookInput,
  opts?: PricingWriteOptions | string,
  ctx?: TradeContext,
): Promise<CreatedPriceBook> {
  const resolvedOpts = typeof opts === 'string' ? { idempotencyKey: opts } : opts;
  const { key, scope } = resolveWriteMeta(resolvedOpts, undefined, ctx, 'none');
  const body: CreatePriceBookInput = {
    code: input.code,
    purpose: input.purpose,
    currencyCode: input.currencyCode,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.localizedNames !== undefined ? { localizedNames: input.localizedNames } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
  };
  const res = await tradeHttp().write<CreatedPriceBook>('POST', '/price-books', body, {
    key,
    scope,
  });
  return res.data;
}

export async function updatePriceBook(
  id: string,
  input: UpdatePriceBookInput,
  ifMatchOrOpts?: number | PricingWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<PriceBookHeader> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    'positive',
  );
  const body: UpdatePriceBookInput = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.localizedNames !== undefined ? { localizedNames: input.localizedNames } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  };
  const res = await tradeHttp().write<PriceBookHeader>(
    'PATCH',
    `/price-books/${encodeSeg(id)}`,
    body,
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

export async function createVersion(
  bookId: string,
  input: CreateVersionInput,
  ifMatchOrOpts?: number | PricingWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<SavedPriceVersion> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    'positive',
  );
  const body = {
    effectiveFrom: input.effectiveFrom,
    ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    entries: input.entries.map((e) => serializeEntry(e, false)),
    ...(input.promotions !== undefined
      ? { promotions: input.promotions.map((p) => serializePromotion(p, false)) }
      : {}),
  };
  const res = await tradeHttp().write<SavedPriceVersion>(
    'POST',
    `/price-books/${encodeSeg(bookId)}/versions`,
    body,
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

export async function cloneVersion(
  bookId: string,
  input: CloneVersionInput,
  ifMatchOrOpts?: number | PricingWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<SavedPriceVersion> {
  assertBodyBooleans(input, ['includePromotions']);
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    'positive',
  );
  const body: CloneVersionInput = {
    sourceMode: input.sourceMode,
    ...(input.sourceVersionId !== undefined ? { sourceVersionId: input.sourceVersionId } : {}),
    effectiveFrom: input.effectiveFrom,
    ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.includePromotions !== undefined
      ? { includePromotions: input.includePromotions }
      : {}),
    ...(input.adjustmentMode !== undefined ? { adjustmentMode: input.adjustmentMode } : {}),
    ...(input.adjustmentValue !== undefined ? { adjustmentValue: input.adjustmentValue } : {}),
    ...(input.roundingMode !== undefined ? { roundingMode: input.roundingMode } : {}),
  };
  const res = await tradeHttp().write<SavedPriceVersion>(
    'POST',
    `/price-books/${encodeSeg(bookId)}/versions/clone`,
    body,
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

export async function updateVersion(
  id: string,
  input: UpdateVersionInput,
  ifMatchOrOpts?: number | PricingWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<SavedPriceVersion> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    'positive',
  );
  const body = {
    ...(input.effectiveFrom !== undefined ? { effectiveFrom: input.effectiveFrom } : {}),
    ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.entries !== undefined
      ? { entries: input.entries.map((e) => serializeEntry(e, false)) }
      : {}),
    ...(input.promotions !== undefined
      ? { promotions: input.promotions.map((p) => serializePromotion(p, false)) }
      : {}),
  };
  const res = await tradeHttp().write<SavedPriceVersion>(
    'PATCH',
    `/price-book-versions/${encodeSeg(id)}`,
    body,
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

export async function changeEntries(
  versionId: string,
  input: ChangeEntriesInput,
  ifMatchOrOpts?: number | PricingWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<ChangeEntriesResult> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    'positive',
  );
  const body: ChangeEntriesInput = {
    ...(input.upserts !== undefined
      ? { upserts: input.upserts.map((e) => serializeEntry(e, true)) }
      : {}),
    ...(input.deletes !== undefined ? { deletes: [...input.deletes] } : {}),
  };
  const res = await tradeHttp().write<ChangeEntriesResult>(
    'POST',
    `/price-book-versions/${encodeSeg(versionId)}/entries/changes`,
    body,
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

export async function changePromotions(
  versionId: string,
  input: ChangePromotionsInput,
  ifMatchOrOpts?: number | PricingWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<ChangePromotionsResult> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    'positive',
  );
  const body: ChangePromotionsInput = {
    ...(input.upserts !== undefined
      ? { upserts: input.upserts.map((p) => serializePromotion(p, true)) }
      : {}),
    ...(input.deletes !== undefined ? { deletes: [...input.deletes] } : {}),
  };
  const res = await tradeHttp().write<ChangePromotionsResult>(
    'POST',
    `/price-book-versions/${encodeSeg(versionId)}/promotions/changes`,
    body,
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

export async function deleteVersion(
  id: string,
  ifMatchOrOpts?: number | PricingWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<DeletedResult> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    'positive',
  );
  const res = await tradeHttp().write<DeletedResult>(
    'DELETE',
    `/price-book-versions/${encodeSeg(id)}`,
    undefined,
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

export async function testVersion(
  id: string,
  ifMatchOrOpts?: number | PricingWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<PriceTestResult> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    'positive',
  );
  const res = await tradeHttp().write<PriceTestResult>(
    'POST',
    `/price-book-versions/${encodeSeg(id)}/test`,
    undefined,
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

export async function publishVersion(
  id: string,
  input: PublishPriceVersionInput = {},
  ifMatchOrOpts?: number | PricingWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<PriceVersionRow> {
  assertBodyBooleans(input, ['soloOwnerAttestation']);
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    'positive',
  );
  const body: PublishPriceVersionInput = {
    ...(input.supersedesVersionId !== undefined
      ? { supersedesVersionId: input.supersedesVersionId }
      : {}),
    ...(input.soloOwnerAttestation !== undefined
      ? { soloOwnerAttestation: input.soloOwnerAttestation }
      : {}),
    ...(input.approvalNotes !== undefined ? { approvalNotes: input.approvalNotes } : {}),
  };
  const res = await tradeHttp().write<PriceVersionRow>(
    'POST',
    `/price-book-versions/${encodeSeg(id)}/publish`,
    body,
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

export async function retireVersion(
  id: string,
  body: RetirePriceVersionInput,
  ifMatchOrOpts?: number | PricingWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<PriceVersionRow> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    'positive',
  );
  // P-6: send only reasonCode and optional reasonNote; never send deprecated reason.
  const dto: RetirePriceVersionInput = {
    reasonCode: body.reasonCode,
    ...(body.reasonNote !== undefined ? { reasonNote: body.reasonNote } : {}),
  };
  const res = await tradeHttp().write<PriceVersionRow>(
    'POST',
    `/price-book-versions/${encodeSeg(id)}/retire`,
    dto,
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

export async function upsertCompanyDefault(
  purpose: PricePurpose,
  currencyCode: string,
  priceBookId: string,
  ifMatchOrOpts: number | PricingWriteOptions = 0,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<CompanyDefaultRow> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    'nonNegative',
  );
  const res = await tradeHttp().write<CompanyDefaultRow>(
    'POST',
    `/configuration/company-default-price-books/${encodeSeg(purpose)}/${encodeSeg(currencyCode)}/upsert`,
    { priceBookId },
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

export async function deleteCompanyDefault(
  purpose: PricePurpose,
  currencyCode: string,
  ifMatchOrOpts?: number | PricingWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<DeletedResult> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    'positive',
  );
  const res = await tradeHttp().write<DeletedResult>(
    'DELETE',
    `/configuration/company-default-price-books/${encodeSeg(purpose)}/${encodeSeg(currencyCode)}`,
    undefined,
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

export async function evaluate(
  input: PricingEvaluateInput,
  ctx: TradeContext = {},
): Promise<PricingDecision> {
  const body: PricingEvaluateInput = {
    purpose: input.purpose,
    itemId: input.itemId,
    uomId: input.uomId,
    quantity: input.quantity,
    currencyCode: input.currencyCode,
    ...(input.pricingAt ? { pricingAt: input.pricingAt } : {}),
    ...(input.partyId ? { partyId: input.partyId } : {}),
    ...(input.branchId ? { branchId: input.branchId } : {}),
    ...(input.channelId ? { channelId: input.channelId } : {}),
    ...(input.priceBookId ? { priceBookId: input.priceBookId } : {}),
    ...(input.priceBookVersionId ? { priceBookVersionId: input.priceBookVersionId } : {}),
  };
  const res = await tradeHttp().write<PricingDecision>('POST', '/pricing/evaluate', body, {
    key: newIdempotencyKey(),
    scope: scopeFor(ctx, 'OPTIONAL'),
  });
  return res.data;
}
