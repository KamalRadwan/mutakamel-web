import { ApiError, assertBodyBooleans, assertIdempotencyKey, fakeDelay, fakeId, type TradeContext } from '../../shared/trade-api';
import { itemName, toRow } from '../../shared/trade-foundation.api';
import {
  TRADE_FAKE_DB,
  assertReasonNoteShape,
  assertUsableReason,
  bumpVersion,
  clone,
  fakeLang,
  nowIso,
} from '../../shared/trade-foundation.fake';
import type {
  CategoryNode,
  ChannelListing,
  ComboComponent,
  FakeItem,
  FakeListing,
  ItemBranchProfile,
  ItemCompanyProfile,
  ItemDetail,
  ItemImageSummary,
  ItemKind,
  ItemRow,
  ItemStandardCost,
  ItemStatus,
  LocalizedNames,
  OptionalProduct,
  Page,
  StatusCounts,
} from '../../shared/trade-foundation.model';
import { ALLOWED_ITEM_STATUS_MOVES } from '../../shared/trade-labels';
import {
  ITEM_CODE_PATTERN,
  ITEM_IMAGE_RULES,
  ITEM_KINDS,
  ITEM_LIMITS,
  NON_NEGATIVE_DECIMAL,
  POSITIVE_DECIMAL,
  type BranchProfileBody,
  type BranchProfilePatch,
  type CompanyProfileBody,
  type CompanyProfilePatch,
  type FulfillmentNodeOption,
  type ItemCreateBody,
  type ItemImageReceipt,
  type ItemImageRemoved,
  type ItemListFilter,
  type ItemListQuery,
  type ItemPatchBody,
  type ItemReferenceData,
  type ItemSaved,
  type ItemSortDirection,
  type ItemSortField,
  type ItemStatusReason,
  type ListingChannelOption,
  type ListingCreateBody,
  type ListingPatchBody,
} from './items.model';

const VALID_SORT_FIELDS: readonly ItemSortField[] = ['createdAt', 'updatedAt', 'canonicalCode', 'name'];
const VALID_SORT_DIRECTIONS: readonly ItemSortDirection[] = ['asc', 'desc'];

const COMPANY_CURRENCY: Record<string, string> = {
  c1: 'EGP',
  c2: 'SAR',
};

const TRACKING_LOCKED = new Set<string>(['item-01:c1', 'item-02:c1', 'item-17:c1']);

const idempotencyStore = new Map<string, { fingerprint: string; result: unknown }>();
let imageSeq = 100;

/** 400 TRADE.VALIDATION_FAILED as the Trade ValidationPipe sends it: details keyed by the DTO property. */
function invalid(field: string): ApiError {
  return new ApiError(400, 'TRADE.VALIDATION_FAILED', { [field]: ['invalid'] });
}

/**
 * Backend DomainIdempotencyService: the record is scoped by actor + operation (`catalog.item.update:<id>`)
 * + key, so the same key on another operation is a new request; a changed body under one key is 422 MISMATCH.
 */
function withIdempotency<T>(key: string, op: string, payload: unknown, run: () => T): T {
  const storeKey = `${op}:${assertIdempotencyKey(key)}`;
  const fingerprint = JSON.stringify(payload);
  const existing = idempotencyStore.get(storeKey);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new ApiError(422, 'TRADE.IDEMPOTENCY.MISMATCH');
    }
    return clone(existing.result as T);
  }
  const result = run();
  idempotencyStore.set(storeKey, { fingerprint, result: clone(result) });
  return clone(result);
}

function requireCompanyCtx(ctx: TradeContext): string {
  if (!ctx.companyId) {
    throw new ApiError(400, 'TRADE.CONTEXT.MISSING_COMPANY');
  }
  return ctx.companyId;
}

function requireCompanyOnlyCtx(ctx: TradeContext): string {
  const companyId = requireCompanyCtx(ctx);
  if (ctx.branchId) {
    // Gateway COMPANY_REQUIRED: a branch selector on this route is a 400 REQUEST_INVALID problem.
    throw new ApiError(400, 'REQUEST_INVALID');
  }
  return companyId;
}

function requireBranchCtx(ctx: TradeContext): { companyId: string; branchId: string } {
  const companyId = requireCompanyCtx(ctx);
  if (!ctx.branchId) {
    throw new ApiError(400, 'TRADE.CONTEXT.MISSING_BRANCH');
  }
  return { companyId, branchId: ctx.branchId };
}

function findActiveItem(id: string): FakeItem {
  const item = TRADE_FAKE_DB.items.find((entry) => entry.id === id && entry.deletedAt === null);
  if (!item) {
    throw new ApiError(404, 'TRADE.CATALOG.ITEM_NOT_FOUND');
  }
  return item;
}

function findCompanyProfile(itemId: string, companyId: string): ItemCompanyProfile | null {
  return TRADE_FAKE_DB.companyProfiles.find((p) => p.itemId === itemId && p.companyId === companyId) ?? null;
}

function itemHasAssortedBranch(itemId: string, companyProfileId: string | undefined, branchId: string): boolean {
  if (companyProfileId) {
    return TRADE_FAKE_DB.branchProfiles.some(
      (b) => b.itemCompanyProfileId === companyProfileId && b.branchId === branchId && b.isAssorted,
    );
  }
  return TRADE_FAKE_DB.branchProfiles.some(
    (b) =>
      b.branchId === branchId &&
      b.isAssorted &&
      TRADE_FAKE_DB.companyProfiles.some((p) => p.id === b.itemCompanyProfileId && p.itemId === itemId),
  );
}

function activeCategoryChain(categoryId: string): CategoryNode[] | null {
  const byId = new Map(TRADE_FAKE_DB.categories.map((cat) => [cat.id, cat]));
  const chain: CategoryNode[] = [];
  const visited = new Set<string>();
  let currId: string | null = categoryId;

  while (currId) {
    if (visited.has(currId)) return null;
    visited.add(currId);
    const node = byId.get(currId);
    if (!node || node.deletedAt !== null || node.status !== 'ACTIVE') return null;
    chain.unshift(node);
    currId = node.parentId;
  }

  return chain.length > 0 ? chain : null;
}

function categoryAncestorsForRow(categoryId: string | null): Set<string> | null {
  if (!categoryId) return null;
  const byId = new Map(TRADE_FAKE_DB.categories.map((cat) => [cat.id, cat]));
  const ids = new Set<string>();
  let currId: string | null = categoryId;

  while (currId && !ids.has(currId)) {
    const node = byId.get(currId);
    if (!node || node.deletedAt !== null) break;
    ids.add(node.id);
    currId = node.parentId;
  }

  return ids.size > 0 ? ids : null;
}

function matchesItemSearch(item: FakeItem, needle: string): boolean {
  if (item.canonicalCode.toLowerCase().includes(needle)) return true;
  if (item.barcode && item.barcode.toLowerCase().includes(needle)) return true;
  for (const name of Object.values(item.localizedNames)) {
    if (name.toLowerCase().includes(needle)) return true;
  }
  return false;
}

function validateListFilter(ctx: TradeContext, filter: ItemListFilter): void {
  if (filter.search !== undefined && filter.search.length > 160) {
    throw invalid('search');
  }
  if (filter.scope !== undefined && filter.scope !== 'CATALOGUE' && filter.scope !== 'COMPANY') {
    throw invalid('scope');
  }
  if (filter.categoryIds !== undefined && filter.categoryIds.length > 50) {
    throw invalid('categoryIds');
  }
  if (filter.sort !== undefined && !VALID_SORT_FIELDS.includes(filter.sort)) {
    throw invalid('sort');
  }
  if (filter.direction !== undefined && !VALID_SORT_DIRECTIONS.includes(filter.direction)) {
    throw invalid('direction');
  }
  if (filter.purpose) {
    if (!ctx.companyId) {
      throw new ApiError(422, 'TRADE.CATALOG.COMPANY_PROFILE_INVALID');
    }
    if (filter.purpose === 'POS') {
      throw new ApiError(422, 'TRADE.CATALOG.CHANNEL_INVALID');
    }
  }
}

function itemMatchesFilter(item: FakeItem, ctx: TradeContext, filter: ItemListFilter): boolean {
  if (item.deletedAt !== null) return false;
  if (filter.itemKind && item.itemKind !== filter.itemKind) return false;
  if (filter.ownerUserId && item.ownerUserId !== filter.ownerUserId) return false;

  if (filter.hasImage === true && !item.image) return false;
  if (filter.hasImage === false && item.image !== null) return false;

  // Backend repository.selection merges categoryIds and categoryId into one set.
  const categoryIds = [...new Set([...(filter.categoryIds ?? []), ...(filter.categoryId ? [filter.categoryId] : [])])];
  if (categoryIds.length > 0) {
    if (filter.includeSubcategories !== false) {
      const pathIds = categoryAncestorsForRow(item.categoryId);
      if (!pathIds || !categoryIds.some((id) => pathIds.has(id))) return false;
    } else if (!item.categoryId || !categoryIds.includes(item.categoryId)) {
      return false;
    }
  }

  // Backend: a company header inner-joins the company profile unless scope=CATALOGUE; without the header there is no join.
  const requireCompanyProfile = Boolean(ctx.companyId) && filter.scope !== 'CATALOGUE';
  const cp = ctx.companyId ? findCompanyProfile(item.id, ctx.companyId) : null;
  if (requireCompanyProfile && !cp) return false;
  if (requireCompanyProfile && ctx.branchId && !itemHasAssortedBranch(item.id, cp?.id, ctx.branchId)) return false;

  if (filter.purpose === 'SALES') {
    if (!cp || item.status !== 'ACTIVE' || cp.status !== 'ACTIVE' || !cp.canSell) return false;
  } else if (filter.purpose === 'PURCHASE') {
    if (!cp || item.status !== 'ACTIVE' || cp.status !== 'ACTIVE' || !cp.canPurchase) return false;
  }

  const needle = filter.search?.trim().toLowerCase() ?? '';
  if (needle && !matchesItemSearch(item, needle)) return false;

  return true;
}

function toItemSaved(item: FakeItem): ItemSaved {
  const { deletedAt: _deletedAt, ...rest } = item;
  return clone({
    ...rest,
    comboComponents: [...item.comboComponents].sort((a, b) => a.sortOrder - b.sortOrder),
    optionalProducts: [...item.optionalProducts].sort((a, b) => a.sortOrder - b.sortOrder),
  });
}

/** DTO `@IsObject()` is the 400; the service `validateLocalizedNames` rejects the content with 422 ITEM_IDENTITY_INVALID. */
function normalizeLocalizedNames(names: LocalizedNames): LocalizedNames {
  if (!names || typeof names !== 'object' || Array.isArray(names)) {
    throw invalid('localizedNames');
  }
  const entries = Object.entries(names);
  const bad =
    entries.length < 1 ||
    entries.length > 20 ||
    entries.some(
      ([locale, value]) =>
        !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale) ||
        typeof value !== 'string' ||
        !value.trim() ||
        value.length > ITEM_LIMITS.name,
    );
  if (bad) {
    throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID');
  }
  return Object.fromEntries(entries.map(([locale, value]) => [locale, value.trim()]));
}

function normalizeOptionalString(field: string, value: string | null | undefined, maxLen: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) {
    throw invalid(field);
  }
  return trimmed;
}

function normalizePositiveDecimal(field: string, value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!POSITIVE_DECIMAL.test(trimmed)) {
    throw invalid(field);
  }
  return trimmed;
}

function validateComboAndOptionalProducts(
  selfId: string | null,
  kind: ItemKind,
  comboComponents: ComboComponent[] | undefined,
  optionalProducts: OptionalProduct[] | undefined,
  enforceComboPresence: boolean,
): { comboComponents?: ComboComponent[]; optionalProducts?: OptionalProduct[] } {
  let normalizedCombo: ComboComponent[] | undefined;
  // Backend invalidItemIdentity(): 422 ITEM_IDENTITY_INVALID with no details for every combo / optional-product rule.
  if (kind !== 'COMBO') {
    if (comboComponents !== undefined && comboComponents.length > 0) {
      throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID');
    }
    if (comboComponents !== undefined) {
      normalizedCombo = [];
    }
  } else if (comboComponents !== undefined || enforceComboPresence) {
    if (comboComponents && comboComponents.length > ITEM_LIMITS.components) {
      throw invalid('comboComponents');
    }
    if (!comboComponents || comboComponents.length < 1) {
      throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID');
    }
    const seenTargets = new Set<string>();
    const seenOrders = new Set<number>();
    normalizedCombo = comboComponents.map((row, idx) => {
      const sortOrder = row.sortOrder ?? idx;
      if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > ITEM_LIMITS.sortOrder) {
        throw invalid(`comboComponents.${idx}.sortOrder`);
      }
      if (selfId && row.componentItemId === selfId) {
        throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID');
      }
      if (seenTargets.has(row.componentItemId) || seenOrders.has(sortOrder)) {
        throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID');
      }
      const target = TRADE_FAKE_DB.items.find((entry) => entry.id === row.componentItemId && entry.deletedAt === null);
      if (!target || target.itemKind !== 'PRODUCT' || target.status !== 'ACTIVE') {
        throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID');
      }
      const qty = typeof row.quantity === 'string' ? row.quantity.trim() : '';
      if (!POSITIVE_DECIMAL.test(qty)) {
        throw invalid(`comboComponents.${idx}.quantity`);
      }
      seenTargets.add(row.componentItemId);
      seenOrders.add(sortOrder);
      return { componentItemId: row.componentItemId, quantity: qty, sortOrder };
    });
  }

  let normalizedOptional: OptionalProduct[] | undefined;
  if (optionalProducts !== undefined) {
    if (optionalProducts.length > ITEM_LIMITS.components) {
      throw invalid('optionalProducts');
    }
    const seenTargets = new Set<string>();
    const seenOrders = new Set<number>();
    normalizedOptional = optionalProducts.map((row, idx) => {
      const sortOrder = row.sortOrder ?? idx;
      if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > ITEM_LIMITS.sortOrder) {
        throw invalid(`optionalProducts.${idx}.sortOrder`);
      }
      if (selfId && row.optionalProductItemId === selfId) {
        throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID');
      }
      if (seenTargets.has(row.optionalProductItemId) || seenOrders.has(sortOrder)) {
        throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID');
      }
      const target = TRADE_FAKE_DB.items.find(
        (entry) => entry.id === row.optionalProductItemId && entry.deletedAt === null,
      );
      if (!target || target.itemKind !== 'PRODUCT' || target.status !== 'ACTIVE') {
        throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID');
      }
      seenTargets.add(row.optionalProductItemId);
      seenOrders.add(sortOrder);
      return { optionalProductItemId: row.optionalProductItemId, sortOrder };
    });
  }

  return { comboComponents: normalizedCombo, optionalProducts: normalizedOptional };
}

function assertComboActivationReady(components: readonly ComboComponent[]): void {
  if (components.length === 0) {
    throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID');
  }
  for (const component of components) {
    const target = TRADE_FAKE_DB.items.find((entry) => entry.id === component.componentItemId && entry.deletedAt === null);
    if (!target || target.itemKind !== 'PRODUCT' || target.status !== 'ACTIVE') {
      throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID');
    }
  }
}

function validateCompanyProfileState(item: FakeItem, companyId: string, profile: ItemCompanyProfile): void {
  if (profile.canPos && !profile.canSell) {
    throw new ApiError(422, 'TRADE.CATALOG.CAPABILITY_INCOMPATIBLE');
  }
  if (item.itemKind !== 'PRODUCT' && (profile.trackInventory || profile.trackingMode !== 'NONE')) {
    throw new ApiError(422, 'TRADE.CATALOG.CAPABILITY_INCOMPATIBLE');
  }
  if (!profile.trackInventory && profile.trackingMode !== 'NONE') {
    throw new ApiError(422, 'TRADE.CATALOG.CAPABILITY_INCOMPATIBLE');
  }

  if (profile.defaultSalesUomId) {
    const uom = TRADE_FAKE_DB.uoms.find((u) => u.id === profile.defaultSalesUomId);
    if (!uom || uom.status === 'RETIRED') {
      throw new ApiError(422, 'TRADE.CATALOG.UOM_INVALID');
    }
  }
  if (profile.defaultPurchaseUomId) {
    const uom = TRADE_FAKE_DB.uoms.find((u) => u.id === profile.defaultPurchaseUomId);
    if (!uom || uom.status === 'RETIRED') {
      throw new ApiError(422, 'TRADE.CATALOG.UOM_INVALID');
    }
  }

  const expectedCurrency = COMPANY_CURRENCY[companyId] ?? null;
  if (profile.currencyCode !== null && expectedCurrency !== null && profile.currencyCode !== expectedCurrency) {
    throw new ApiError(422, 'TRADE.CATALOG.COMPANY_PROFILE_INVALID');
  }
  if (profile.salesPrice !== null) {
    if (!profile.currencyCode || !NON_NEGATIVE_DECIMAL.test(profile.salesPrice)) {
      throw new ApiError(422, 'TRADE.CATALOG.COMPANY_PROFILE_INVALID');
    }
  }

  for (const taxId of [profile.salesTaxId, profile.purchaseTaxId]) {
    if (taxId) {
      const tax = TRADE_FAKE_DB.taxes.find((t) => t.id === taxId);
      if (!tax || (tax.companyId !== null && tax.companyId !== companyId)) {
        throw new ApiError(422, 'TRADE.CATALOG.COMPANY_PROFILE_INVALID');
      }
    }
  }

  if (
    (profile.taxClassificationKey && profile.taxClassificationKey.length > ITEM_LIMITS.key) ||
    (profile.accountingMappingKey && profile.accountingMappingKey.length > ITEM_LIMITS.key)
  ) {
    throw invalid(profile.taxClassificationKey && profile.taxClassificationKey.length > ITEM_LIMITS.key ? 'taxClassificationKey' : 'accountingMappingKey');
  }
}

function nodesForBranch(branchId: string): FulfillmentNodeOption[] {
  return [
    {
      id: `node-${branchId}-wh`,
      branchId,
      localizedNames: { en: 'Main warehouse', ar: 'المستودع الرئيسي' },
    },
    {
      id: `node-${branchId}-shop`,
      branchId,
      localizedNames: { en: 'Shop floor', ar: 'صالة العرض' },
    },
  ];
}

function validateListingEligibility(
  companyId: string,
  branchId: string | undefined,
  item: FakeItem,
  cp: ItemCompanyProfile | null,
  channelId: string,
): void {
  if (!cp || item.status !== 'ACTIVE' || cp.status !== 'ACTIVE' || !cp.canSell) {
    throw new ApiError(422, 'TRADE.CATALOG.CHANNEL_LISTING_INVALID');
  }
  const channel = TRADE_FAKE_DB.channels.find((c) => c.id === channelId && c.companyId === companyId);
  if (!channel || channel.status !== 'ACTIVE') {
    throw new ApiError(422, 'TRADE.CATALOG.CHANNEL_INVALID');
  }
  if (channel.channelType === 'POS' && !cp.canPos) {
    throw new ApiError(422, 'TRADE.CATALOG.CHANNEL_INVALID');
  }
  if (branchId) {
    const linked = TRADE_FAKE_DB.channelBranches.some(
      (cb) => cb.channelId === channelId && cb.companyId === companyId && cb.branchId === branchId && cb.isActive,
    );
    if (!linked) {
      throw new ApiError(422, 'TRADE.CATALOG.CHANNEL_INVALID');
    }
  }
}

function toPublicListing(listing: FakeListing): ChannelListing {
  const { itemId: _itemId, companyId: _companyId, ...clean } = listing;
  return clean;
}

function extensionMatchesMime(fileName: string, mimeType: string): boolean {
  const idx = fileName.lastIndexOf('.');
  if (idx < 0) return false;
  const ext = fileName.slice(idx).toLowerCase();
  if (mimeType === 'image/png') return ext === '.png';
  if (mimeType === 'image/jpeg') return ext === '.jpg' || ext === '.jpeg';
  if (mimeType === 'image/webp') return ext === '.webp';
  return false;
}

/**
 * Same as the backend (catalog.service + TradeReasonsService.assertUsable): a missing reasonCodeId is
 * 422 NOT_FOUND; then NOT_FOUND -> INACTIVE -> KIND_INVALID -> NOTE_REQUIRED, every one 422 with
 * details `{ field: ['reasonCodeId'] }` (KIND_INVALID adds `reason: ['kind_mismatch']`).
 * The 500-character note limit is a DTO rule (400 TRADE.VALIDATION_FAILED, no details), checked first.
 */
function validateDiscontinueReason(reason: ItemStatusReason | undefined): void {
  assertReasonNoteShape(reason?.reasonNote);
  const reasonCodeId = reason?.reasonCodeId?.trim() ?? '';
  if (!reasonCodeId) {
    throw new ApiError(422, 'TRADE.REASON.NOT_FOUND', { field: ['reasonCodeId'] });
  }
  assertUsableReason({ id: reasonCodeId, kind: 'ITEM_DISCONTINUE', note: reason?.reasonNote });
}

export async function fakeListItems(ctx: TradeContext, q: ItemListQuery): Promise<Page<ItemRow>> {
  await fakeDelay();

  const page = q.page ?? 1;
  const limit = q.limit ?? 25;
  if (!Number.isInteger(page) || page < 1) throw invalid('page');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalid('limit');
  validateListFilter(ctx, q);

  const matched = TRADE_FAKE_DB.items.filter((item) => {
    if (q.status && item.status !== q.status) return false;
    return itemMatchesFilter(item, ctx, q);
  });

  const lang = fakeLang();
  const sortField: ItemSortField = q.sort ?? 'createdAt';
  // Backend orderSelection: anything but direction=asc sorts DESC, whatever the field.
  const sortDir: ItemSortDirection = q.direction === 'asc' ? 'asc' : 'desc';
  const dirMul = sortDir === 'asc' ? 1 : -1;

  matched.sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'createdAt':
        cmp = a.createdAt.localeCompare(b.createdAt);
        break;
      case 'updatedAt':
        cmp = a.updatedAt.localeCompare(b.updatedAt);
        break;
      case 'canonicalCode':
        cmp = a.canonicalCode.localeCompare(b.canonicalCode, undefined, { sensitivity: 'base' });
        break;
      case 'name':
        cmp = itemName(a, lang).localeCompare(itemName(b, lang), lang, { sensitivity: 'base' });
        break;
    }
    if (cmp !== 0) return cmp * dirMul;
    return a.id.localeCompare(b.id) * dirMul;
  });

  const total = matched.length;
  const start = (page - 1) * limit;
  const items = matched.slice(start, start + limit).map((item) => toRow(item, ctx));

  return clone({ items, total, page, limit });
}

export async function fakeCountItemsByStatus(ctx: TradeContext, f: ItemListFilter): Promise<StatusCounts<ItemStatus>> {
  await fakeDelay();
  // ItemStatusCountsQueryDto omits status, page, limit, sort and direction (forbidNonWhitelisted: 400).
  for (const field of ['status', 'page', 'limit', 'sort', 'direction']) {
    if ((f as Record<string, unknown>)[field] !== undefined) throw invalid(field);
  }
  validateListFilter(ctx, f);

  const counts: StatusCounts<ItemStatus> = {
    DRAFT: 0,
    ACTIVE: 0,
    INACTIVE: 0,
    DISCONTINUED: 0,
    total: 0,
  };

  for (const item of TRADE_FAKE_DB.items) {
    if (!itemMatchesFilter(item, ctx, f)) continue;
    counts.total += 1;
    counts[item.status] += 1;
  }

  return clone(counts);
}

export async function fakeGetItemDetail(ctx: TradeContext, id: string): Promise<ItemDetail> {
  await fakeDelay();
  const item = findActiveItem(id);

  const companyProfile = ctx.companyId ? findCompanyProfile(item.id, ctx.companyId) : null;
  const branchProfile =
    companyProfile && ctx.branchId
      ? (TRADE_FAKE_DB.branchProfiles.find(
          (b) => b.itemCompanyProfileId === companyProfile.id && b.branchId === ctx.branchId,
        ) ?? null)
      : null;

  // Backend get(): item + categorySummary + profiles + relations; eligibility is a list-only projection.
  const { eligibility: _eligibility, ...row } = toRow(item, ctx);
  return clone({
    ...row,
    companyProfile,
    branchProfile,
    comboComponents: [...item.comboComponents].sort((a, b) => a.sortOrder - b.sortOrder),
    optionalProducts: [...item.optionalProducts].sort((a, b) => a.sortOrder - b.sortOrder),
  });
}

export async function fakeCreateItem(body: ItemCreateBody, key: string): Promise<ItemSaved> {
  await fakeDelay();
  return withIdempotency(key, 'createItem', body, () => {
    const rawCode = typeof body.canonicalCode === 'string' ? body.canonicalCode.trim() : '';
    if (!ITEM_CODE_PATTERN.test(rawCode)) {
      throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID', { field: ['canonicalCode'] });
    }
    const code = rawCode.toUpperCase();
    if (TRADE_FAKE_DB.items.some((entry) => entry.deletedAt === null && entry.canonicalCode.toUpperCase() === code)) {
      throw new ApiError(409, 'TRADE.CATALOG.CODE_TAKEN', { field: ['canonicalCode'] });
    }
    if (!ITEM_KINDS.includes(body.itemKind)) {
      throw invalid('itemKind');
    }

    const localizedNames = normalizeLocalizedNames(body.localizedNames);

    const barcode = normalizeOptionalString('barcode', body.barcode, ITEM_LIMITS.barcode) ?? null;
    if (barcode && TRADE_FAKE_DB.items.some((entry) => entry.deletedAt === null && entry.barcode === barcode)) {
      throw new ApiError(409, 'TRADE.CATALOG.ITEM_IDENTITY_CONFLICT', { field: ['barcode'] });
    }

    const baseUom = TRADE_FAKE_DB.uoms.find((u) => u.id === body.baseUomId);
    if (!baseUom || baseUom.status === 'RETIRED') {
      throw new ApiError(422, 'TRADE.CATALOG.UOM_INVALID');
    }

    const categoryId = body.categoryId ?? null;
    if (categoryId && !activeCategoryChain(categoryId)) {
      throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_ASSIGNMENT_INVALID');
    }

    const ownerUserId = body.ownerUserId ?? null;
    if (ownerUserId && !TRADE_FAKE_DB.owners.some((o) => o.id === ownerUserId)) {
      throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID');
    }

    const weightKg = normalizePositiveDecimal('weightKg', body.weightKg) ?? null;
    const volumeM3 = normalizePositiveDecimal('volumeM3', body.volumeM3) ?? null;
    const quotationDescription = normalizeOptionalString('quotationDescription', body.quotationDescription, ITEM_LIMITS.description) ?? null;
    const salesOrderDescription = normalizeOptionalString('salesOrderDescription', body.salesOrderDescription, ITEM_LIMITS.description) ?? null;
    const receiptDescription = normalizeOptionalString('receiptDescription', body.receiptDescription, ITEM_LIMITS.description) ?? null;
    const deliveryOrderDescription =
      normalizeOptionalString('deliveryOrderDescription', body.deliveryOrderDescription, ITEM_LIMITS.description) ?? null;
    const notes = normalizeOptionalString('notes', body.notes, ITEM_LIMITS.notes) ?? null;

    const { comboComponents, optionalProducts } = validateComboAndOptionalProducts(
      null,
      body.itemKind,
      body.comboComponents,
      body.optionalProducts,
      true,
    );

    const now = nowIso();
    const created: FakeItem = {
      id: fakeId(),
      canonicalCode: code,
      itemKind: body.itemKind,
      status: 'DRAFT',
      localizedNames,
      baseUomId: body.baseUomId,
      categoryId,
      barcode,
      ownerUserId,
      weightKg,
      volumeM3,
      notes,
      quotationDescription,
      salesOrderDescription,
      receiptDescription,
      deliveryOrderDescription,
      variantIdentity: null,
      currentImageId: null,
      image: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: 'usr-1',
      updatedBy: 'usr-1',
      comboComponents: comboComponents ?? [],
      optionalProducts: optionalProducts ?? [],
      deletedAt: null,
    };

    TRADE_FAKE_DB.items.push(created);
    return toItemSaved(created);
  });
}

export async function fakePatchItem(id: string, version: number, body: ItemPatchBody, key: string): Promise<ItemSaved> {
  await fakeDelay();
  return withIdempotency(key, `catalog.item.update:${id}`, { id, version, body }, () => {
    const rawBody = body as Record<string, unknown>;
    if (
      rawBody['canonicalCode'] !== undefined ||
      rawBody['itemKind'] !== undefined ||
      rawBody['baseUomId'] !== undefined
    ) {
      throw invalid(['canonicalCode', 'itemKind', 'baseUomId'].find((field) => rawBody[field] !== undefined) ?? 'body');
    }
    // DTO rule (UpdateItemDto.reasonNote @MaxLength(500)): checked before anything else, whatever the status.
    assertReasonNoteShape(rawBody['reasonNote']);

    const item = findActiveItem(id);
    if (item.version !== version) {
      throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
    }

    const nextNames = body.localizedNames !== undefined ? normalizeLocalizedNames(body.localizedNames) : item.localizedNames;

    let nextBarcode = item.barcode;
    if (body.barcode !== undefined) {
      nextBarcode = normalizeOptionalString('barcode', body.barcode, ITEM_LIMITS.barcode) ?? null;
      if (
        nextBarcode &&
        TRADE_FAKE_DB.items.some((entry) => entry.deletedAt === null && entry.id !== id && entry.barcode === nextBarcode)
      ) {
        throw new ApiError(409, 'TRADE.CATALOG.ITEM_IDENTITY_CONFLICT', { field: ['barcode'] });
      }
    }

    let nextCategoryId = item.categoryId;
    if (body.categoryId !== undefined) {
      nextCategoryId = body.categoryId;
      if (nextCategoryId && !activeCategoryChain(nextCategoryId)) {
        throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_ASSIGNMENT_INVALID');
      }
    }

    let nextOwnerUserId = item.ownerUserId;
    if (body.ownerUserId !== undefined) {
      nextOwnerUserId = body.ownerUserId;
      if (nextOwnerUserId && !TRADE_FAKE_DB.owners.some((o) => o.id === nextOwnerUserId)) {
        throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID');
      }
    }

    const nextWeightKg = body.weightKg !== undefined ? (normalizePositiveDecimal('weightKg', body.weightKg) ?? null) : item.weightKg;
    const nextVolumeM3 = body.volumeM3 !== undefined ? (normalizePositiveDecimal('volumeM3', body.volumeM3) ?? null) : item.volumeM3;
    const nextQuotation =
      body.quotationDescription !== undefined
        ? (normalizeOptionalString('quotationDescription', body.quotationDescription, ITEM_LIMITS.description) ?? null)
        : item.quotationDescription;
    const nextSalesOrder =
      body.salesOrderDescription !== undefined
        ? (normalizeOptionalString('salesOrderDescription', body.salesOrderDescription, ITEM_LIMITS.description) ?? null)
        : item.salesOrderDescription;
    const nextReceipt =
      body.receiptDescription !== undefined
        ? (normalizeOptionalString('receiptDescription', body.receiptDescription, ITEM_LIMITS.description) ?? null)
        : item.receiptDescription;
    const nextDelivery =
      body.deliveryOrderDescription !== undefined
        ? (normalizeOptionalString('deliveryOrderDescription', body.deliveryOrderDescription, ITEM_LIMITS.description) ?? null)
        : item.deliveryOrderDescription;
    const nextNotes =
      body.notes !== undefined ? (normalizeOptionalString('notes', body.notes, ITEM_LIMITS.notes) ?? null) : item.notes;

    const { comboComponents, optionalProducts } = validateComboAndOptionalProducts(
      id,
      item.itemKind,
      body.comboComponents,
      body.optionalProducts,
      false,
    );

    const nextCombo = comboComponents ?? item.comboComponents;
    const nextOptional = optionalProducts ?? item.optionalProducts;

    let nextStatus = item.status;
    if (body.status !== undefined && body.status !== item.status) {
      if (!ALLOWED_ITEM_STATUS_MOVES[item.status].includes(body.status)) {
        throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID', { field: ['status'] });
      }
      if (body.status === 'DISCONTINUED') {
        validateDiscontinueReason(
          body.reasonCodeId ? { reasonCodeId: body.reasonCodeId, reasonNote: body.reasonNote } : undefined,
        );
      }
      if (item.itemKind === 'COMBO' && body.status === 'ACTIVE') {
        assertComboActivationReady(nextCombo);
      }
      nextStatus = body.status;
    }

    item.localizedNames = nextNames;
    item.barcode = nextBarcode;
    item.categoryId = nextCategoryId;
    item.ownerUserId = nextOwnerUserId;
    item.weightKg = nextWeightKg;
    item.volumeM3 = nextVolumeM3;
    item.quotationDescription = nextQuotation;
    item.salesOrderDescription = nextSalesOrder;
    item.receiptDescription = nextReceipt;
    item.deliveryOrderDescription = nextDelivery;
    item.notes = nextNotes;
    item.comboComponents = nextCombo;
    item.optionalProducts = nextOptional;
    item.status = nextStatus;
    item.updatedBy = 'usr-1';
    bumpVersion(item);

    return toItemSaved(item);
  });
}

export async function fakeMoveItemStatus(
  id: string,
  version: number,
  status: ItemStatus,
  key: string,
  reason?: ItemStatusReason,
): Promise<ItemSaved> {
  await fakeDelay();
  return withIdempotency(key, `catalog.item.update:${id}`, { id, version, status, reason }, () => {
    const item = findActiveItem(id);
    if (item.version !== version) {
      throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
    }
    if (item.status === status) {
      return toItemSaved(item);
    }
    if (!ALLOWED_ITEM_STATUS_MOVES[item.status].includes(status)) {
      throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID', { field: ['status'] });
    }
    if (status === 'DISCONTINUED') {
      validateDiscontinueReason(reason);
    }
    if (item.itemKind === 'COMBO' && status === 'ACTIVE') {
      assertComboActivationReady(item.comboComponents);
    }

    item.status = status;
    item.updatedBy = 'usr-1';
    bumpVersion(item);
    return toItemSaved(item);
  });
}

export async function fakeCreateCompanyProfile(
  ctx: TradeContext,
  itemId: string,
  body: CompanyProfileBody,
  key: string,
): Promise<ItemCompanyProfile> {
  await fakeDelay();
  assertBodyBooleans(body, ['canSell', 'canPurchase', 'canPos', 'trackInventory']);
  return withIdempotency(key, `createCompanyProfile:${itemId}`, { ctx, itemId, body }, () => {
    const companyId = requireCompanyOnlyCtx(ctx);
    const item = findActiveItem(itemId);

    if (findCompanyProfile(itemId, companyId)) {
      throw new ApiError(409, 'TRADE.CATALOG.COMPANY_PROFILE_ALREADY_EXISTS');
    }

    const salesPrice = body.salesPrice?.trim() ? body.salesPrice.trim() : null;
    const currencyCode = body.currencyCode?.trim() ? body.currencyCode.trim() : null;

    const created: ItemCompanyProfile = {
      id: fakeId(),
      itemId,
      companyId,
      canSell: body.canSell,
      canPurchase: body.canPurchase,
      canPos: body.canPos ?? false,
      trackInventory: body.trackInventory,
      trackingMode: body.trackingMode,
      taxClassificationKey: body.taxClassificationKey?.trim() || null,
      defaultSalesUomId: body.defaultSalesUomId ?? null,
      defaultPurchaseUomId: body.defaultPurchaseUomId ?? null,
      salesPrice,
      currencyCode,
      salesTaxId: body.salesTaxId ?? null,
      purchaseTaxId: body.purchaseTaxId ?? null,
      capabilitySet: [],
      capabilitySetVersion: 1,
      accountingMappingKey: body.accountingMappingKey?.trim() || null,
      status: 'ACTIVE',
      version: 1,
      updatedAt: nowIso(),
    };

    validateCompanyProfileState(item, companyId, created);
    TRADE_FAKE_DB.companyProfiles.push(created);
    return clone(created);
  });
}

export async function fakePatchCompanyProfile(
  ctx: TradeContext,
  itemId: string,
  version: number,
  body: CompanyProfilePatch,
  key: string,
): Promise<ItemCompanyProfile> {
  await fakeDelay();
  assertBodyBooleans(body, ['canSell', 'canPurchase', 'canPos', 'trackInventory']);
  return withIdempotency(key, `patchCompanyProfile:${itemId}`, { ctx, itemId, version, body }, () => {
    const companyId = requireCompanyOnlyCtx(ctx);
    const item = findActiveItem(itemId);
    const existing = findCompanyProfile(itemId, companyId);
    if (!existing) {
      throw new ApiError(404, 'TRADE.CATALOG.COMPANY_PROFILE_NOT_FOUND');
    }
    if (existing.version !== version) {
      throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
    }

    if (
      TRACKING_LOCKED.has(`${itemId}:${companyId}`) &&
      ((body.trackInventory !== undefined && body.trackInventory !== existing.trackInventory) ||
        (body.trackingMode !== undefined && body.trackingMode !== existing.trackingMode))
    ) {
      throw new ApiError(409, 'TRADE.CATALOG.TRACKING_LOCKED');
    }

    const salesPrice =
      body.salesPrice !== undefined ? (body.salesPrice?.trim() ? body.salesPrice.trim() : null) : existing.salesPrice;
    const currencyCode =
      body.currencyCode !== undefined
        ? body.currencyCode?.trim()
          ? body.currencyCode.trim()
          : null
        : existing.currencyCode;

    const candidate: ItemCompanyProfile = {
      ...existing,
      canSell: body.canSell ?? existing.canSell,
      canPurchase: body.canPurchase ?? existing.canPurchase,
      canPos: body.canPos ?? existing.canPos,
      trackInventory: body.trackInventory ?? existing.trackInventory,
      trackingMode: body.trackingMode ?? existing.trackingMode,
      taxClassificationKey:
        body.taxClassificationKey !== undefined
          ? body.taxClassificationKey?.trim() || null
          : existing.taxClassificationKey,
      accountingMappingKey:
        body.accountingMappingKey !== undefined
          ? body.accountingMappingKey?.trim() || null
          : existing.accountingMappingKey,
      defaultSalesUomId: body.defaultSalesUomId !== undefined ? body.defaultSalesUomId : existing.defaultSalesUomId,
      defaultPurchaseUomId:
        body.defaultPurchaseUomId !== undefined ? body.defaultPurchaseUomId : existing.defaultPurchaseUomId,
      salesPrice,
      currencyCode,
      salesTaxId: body.salesTaxId !== undefined ? body.salesTaxId : existing.salesTaxId,
      purchaseTaxId: body.purchaseTaxId !== undefined ? body.purchaseTaxId : existing.purchaseTaxId,
      status: 'ACTIVE',
    };

    validateCompanyProfileState(item, companyId, candidate);
    Object.assign(existing, candidate);
    bumpVersion(existing);

    const costRow = TRADE_FAKE_DB.standardCosts.find((c) => c.companyProfileId === existing.id);
    if (costRow) {
      costRow.version = existing.version;
      costRow.currencyCode = existing.currencyCode;
    }

    return clone(existing);
  });
}

export async function fakeGetStandardCost(ctx: TradeContext, itemId: string): Promise<ItemStandardCost> {
  await fakeDelay();
  const companyId = requireCompanyOnlyCtx(ctx);
  findActiveItem(itemId);
  const profile = findCompanyProfile(itemId, companyId);
  if (!profile) {
    throw new ApiError(404, 'TRADE.CATALOG.COMPANY_PROFILE_NOT_FOUND');
  }

  const row = TRADE_FAKE_DB.standardCosts.find((c) => c.companyProfileId === profile.id);
  if (row) {
    return clone({
      ...row,
      currencyCode: profile.currencyCode,
      version: profile.version,
    });
  }

  return clone({
    itemId,
    companyProfileId: profile.id,
    standardCost: null,
    currencyCode: profile.currencyCode,
    version: profile.version,
  });
}

export async function fakePatchStandardCost(
  ctx: TradeContext,
  itemId: string,
  version: number,
  standardCost: string | null,
  key: string,
): Promise<ItemStandardCost> {
  await fakeDelay();
  return withIdempotency(key, `patchStandardCost:${itemId}`, { ctx, itemId, version, standardCost }, () => {
    const companyId = requireCompanyOnlyCtx(ctx);
    findActiveItem(itemId);
    const profile = findCompanyProfile(itemId, companyId);
    if (!profile) {
      throw new ApiError(404, 'TRADE.CATALOG.COMPANY_PROFILE_NOT_FOUND');
    }
    if (profile.version !== version) {
      throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
    }

    const cleanCost = standardCost?.trim() ? standardCost.trim() : null;
    if (cleanCost !== null) {
      if (!profile.currencyCode || !NON_NEGATIVE_DECIMAL.test(cleanCost)) {
        throw new ApiError(422, 'TRADE.CATALOG.COMPANY_PROFILE_INVALID');
      }
    }

    bumpVersion(profile);

    let row = TRADE_FAKE_DB.standardCosts.find((c) => c.companyProfileId === profile.id);
    if (row) {
      row.standardCost = cleanCost;
      row.currencyCode = profile.currencyCode;
      row.version = profile.version;
    } else {
      row = {
        itemId,
        companyProfileId: profile.id,
        standardCost: cleanCost,
        currencyCode: profile.currencyCode,
        version: profile.version,
      };
      TRADE_FAKE_DB.standardCosts.push(row);
    }

    return clone(row);
  });
}

export async function fakeCreateBranchProfile(
  ctx: TradeContext,
  itemId: string,
  body: BranchProfileBody,
  key: string,
): Promise<ItemBranchProfile> {
  await fakeDelay();
  return withIdempotency(key, `createBranchProfile:${itemId}`, { ctx, itemId, body }, () => {
    const { companyId, branchId } = requireBranchCtx(ctx);
    findActiveItem(itemId);
    const cp = findCompanyProfile(itemId, companyId);
    if (!cp) {
      throw new ApiError(422, 'TRADE.CATALOG.COMPANY_PROFILE_INVALID');
    }

    if (TRADE_FAKE_DB.branchProfiles.some((b) => b.itemCompanyProfileId === cp.id && b.branchId === branchId)) {
      throw new ApiError(409, 'TRADE.CATALOG.BRANCH_PROFILE_ALREADY_EXISTS');
    }

    const nodeId = body.defaultFulfillmentNodeId ?? null;
    if (nodeId && !nodesForBranch(branchId).some((n) => n.id === nodeId)) {
      throw new ApiError(422, 'TRADE.CATALOG.BRANCH_MISMATCH');
    }

    const replenishment = normalizeOptionalString('replenishmentPolicyKey', body.replenishmentPolicyKey, ITEM_LIMITS.key) ?? null;

    const created: ItemBranchProfile = {
      id: fakeId(),
      itemCompanyProfileId: cp.id,
      companyId,
      branchId,
      defaultFulfillmentNodeId: nodeId,
      isAssorted: body.isAssorted,
      replenishmentPolicyKey: replenishment,
      restrictions: {},
      version: 1,
    };

    TRADE_FAKE_DB.branchProfiles.push(created);
    return clone(created);
  });
}

export async function fakePatchBranchProfile(
  ctx: TradeContext,
  itemId: string,
  version: number,
  body: BranchProfilePatch,
  key: string,
): Promise<ItemBranchProfile> {
  await fakeDelay();
  return withIdempotency(key, `patchBranchProfile:${itemId}`, { ctx, itemId, version, body }, () => {
    const { companyId, branchId } = requireBranchCtx(ctx);
    findActiveItem(itemId);
    const cp = findCompanyProfile(itemId, companyId);
    if (!cp) {
      throw new ApiError(422, 'TRADE.CATALOG.COMPANY_PROFILE_INVALID');
    }

    const bp = TRADE_FAKE_DB.branchProfiles.find((b) => b.itemCompanyProfileId === cp.id && b.branchId === branchId);
    if (!bp) {
      throw new ApiError(404, 'TRADE.CATALOG.BRANCH_PROFILE_NOT_FOUND');
    }
    if (bp.version !== version) {
      throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
    }

    let nextNodeId = bp.defaultFulfillmentNodeId;
    if (body.defaultFulfillmentNodeId !== undefined) {
      nextNodeId = body.defaultFulfillmentNodeId;
      if (nextNodeId && !nodesForBranch(branchId).some((n) => n.id === nextNodeId)) {
        throw new ApiError(422, 'TRADE.CATALOG.BRANCH_MISMATCH');
      }
    }

    const nextPolicy =
      body.replenishmentPolicyKey !== undefined
        ? (normalizeOptionalString('replenishmentPolicyKey', body.replenishmentPolicyKey, ITEM_LIMITS.key) ?? null)
        : bp.replenishmentPolicyKey;

    bp.isAssorted = body.isAssorted ?? bp.isAssorted;
    bp.defaultFulfillmentNodeId = nextNodeId;
    bp.replenishmentPolicyKey = nextPolicy;
    bp.version += 1;

    return clone(bp);
  });
}

export async function fakeListItemListings(
  ctx: TradeContext,
  itemId: string,
  page = 1,
  limit = 50,
): Promise<Page<ChannelListing>> {
  await fakeDelay();
  const companyId = requireCompanyCtx(ctx);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw invalid(Number.isInteger(page) && page >= 1 ? 'limit' : 'page');
  }

  findActiveItem(itemId);
  const cp = findCompanyProfile(itemId, companyId);
  if (!cp) {
    throw new ApiError(404, 'TRADE.CATALOG.ITEM_NOT_FOUND');
  }

  const branchScope = ctx.branchId ?? null;
  const matched = TRADE_FAKE_DB.listings
    .filter((l) => l.itemId === itemId && l.companyId === companyId && l.branchId === branchScope)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const total = matched.length;
  const start = (page - 1) * limit;
  const items = matched.slice(start, start + limit).map(toPublicListing);

  return clone({ items, total, page, limit });
}

export async function fakeCreateListing(
  ctx: TradeContext,
  itemId: string,
  body: ListingCreateBody,
  key: string,
): Promise<ChannelListing> {
  await fakeDelay();
  return withIdempotency(key, `createListing:${itemId}`, { ctx, itemId, body }, () => {
    const companyId = requireCompanyCtx(ctx);
    const item = findActiveItem(itemId);
    const cp = findCompanyProfile(itemId, companyId);
    validateListingEligibility(companyId, ctx.branchId, item, cp, body.channelId);

    const branchScope = ctx.branchId ?? null;
    if (
      TRADE_FAKE_DB.listings.some(
        (l) =>
          l.itemId === itemId &&
          l.companyId === companyId &&
          l.channelId === body.channelId &&
          l.branchId === branchScope,
      )
    ) {
      throw new ApiError(409, 'TRADE.CATALOG.CHANNEL_LISTING_ALREADY_EXISTS');
    }

    const created: FakeListing = {
      id: fakeId(),
      itemId,
      companyId,
      channelId: body.channelId,
      branchId: branchScope,
      publicationStatus: body.publicationStatus ?? 'DRAFT',
      saleConstraints: {},
      version: 1,
      updatedAt: nowIso(),
    };

    TRADE_FAKE_DB.listings.push(created);
    return clone(toPublicListing(created));
  });
}

export async function fakePatchListing(
  ctx: TradeContext,
  itemId: string,
  channelId: string,
  version: number,
  body: ListingPatchBody,
  key: string,
): Promise<ChannelListing> {
  await fakeDelay();
  return withIdempotency(key, `patchListing:${itemId}:${channelId}`, { ctx, itemId, channelId, version, body }, () => {
    const companyId = requireCompanyCtx(ctx);
    const item = findActiveItem(itemId);
    const cp = findCompanyProfile(itemId, companyId);
    const branchScope = ctx.branchId ?? null;

    const existing = TRADE_FAKE_DB.listings.find(
      (l) => l.itemId === itemId && l.companyId === companyId && l.channelId === channelId && l.branchId === branchScope,
    );
    if (!existing) {
      throw new ApiError(404, 'TRADE.CATALOG.CHANNEL_LISTING_NOT_FOUND');
    }
    if (existing.version !== version) {
      throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
    }

    validateListingEligibility(companyId, ctx.branchId, item, cp, channelId);

    if (body.publicationStatus !== undefined) {
      existing.publicationStatus = body.publicationStatus;
    }
    bumpVersion(existing);
    return clone(toPublicListing(existing));
  });
}

export async function fakeListListingChannels(ctx: TradeContext): Promise<ListingChannelOption[]> {
  await fakeDelay();
  const companyId = requireCompanyCtx(ctx);

  const channels = TRADE_FAKE_DB.channels.filter((c) => c.companyId === companyId);
  return clone(
    channels.map((channel) => {
      const linkedToBranch = ctx.branchId
        ? TRADE_FAKE_DB.channelBranches.some(
            (cb) => cb.channelId === channel.id && cb.companyId === companyId && cb.branchId === ctx.branchId && cb.isActive,
          )
        : null;
      return { ...channel, linkedToBranch };
    }),
  );
}

export async function fakePutItemImage(
  itemId: string,
  version: number,
  file: File,
  key: string,
): Promise<ItemImageReceipt> {
  await fakeDelay();
  const payload = { itemId, version, name: file.name, type: file.type, size: file.size };
  return withIdempotency(key, `putItemImage:${itemId}`, payload, () => {
    const item = findActiveItem(itemId);
    if (item.version !== version) {
      throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
    }
    if (!(ITEM_IMAGE_RULES.types as readonly string[]).includes(file.type)) {
      // The backend's details.reason (TYPE_NOT_ALLOWED...) is upper case, so AllExceptionsFilter rewrites it to generic text.
      throw new ApiError(415, 'TRADE.CATALOG.ITEM_IMAGE_INVALID');
    }
    if (!extensionMatchesMime(file.name, file.type)) {
      throw new ApiError(415, 'TRADE.CATALOG.ITEM_IMAGE_INVALID');
    }
    if (file.size > ITEM_IMAGE_RULES.maxBytes) {
      throw new ApiError(413, 'TRADE.CATALOG.ITEM_IMAGE_TOO_LARGE');
    }

    const replaced = item.image !== null;
    imageSeq += 1;
    const summary: ItemImageSummary = {
      id: `img-${imageSeq}`,
      sequence: (item.image?.sequence ?? 0) + 1,
      thumb: {
        mimeType: 'image/webp',
        widthPx: 256,
        heightPx: 256,
        sha256: String(imageSeq).padStart(64, '0'),
      },
      print: {
        mimeType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        widthPx: 512,
        heightPx: 512,
      },
      hasAlpha: file.type === 'image/png' || file.type === 'image/webp',
      createdAt: nowIso(),
    };

    item.image = summary;
    item.currentImageId = summary.id;
    item.updatedBy = 'usr-1';
    bumpVersion(item);

    return clone({
      itemId: item.id,
      itemVersion: item.version,
      image: summary,
      replaced,
    });
  });
}

export async function fakeDeleteItemImage(itemId: string, version: number, key: string): Promise<ItemImageRemoved> {
  await fakeDelay();
  return withIdempotency(key, `deleteItemImage:${itemId}`, { itemId, version }, () => {
    const item = findActiveItem(itemId);
    if (item.version !== version) {
      throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
    }
    if (!item.image) {
      return {
        itemId: item.id,
        itemVersion: item.version,
        removed: false,
      };
    }

    item.image = null;
    item.currentImageId = null;
    item.updatedBy = 'usr-1';
    bumpVersion(item);

    return {
      itemId: item.id,
      itemVersion: item.version,
      removed: true,
    };
  });
}

export async function fakeGetReferenceData(ctx: TradeContext, search?: string): Promise<ItemReferenceData> {
  await fakeDelay();
  const needle = search?.trim().toLowerCase() ?? '';

  const owners = TRADE_FAKE_DB.owners
    .filter((owner) => !needle || owner.name.toLowerCase().includes(needle))
    .slice(0, 50);

  const taxes = ctx.companyId
    ? TRADE_FAKE_DB.taxes
        .filter((tax) => tax.companyId === null || tax.companyId === ctx.companyId)
        .filter((tax) => !needle || tax.code.toLowerCase().includes(needle) || tax.name.toLowerCase().includes(needle))
        .slice(0, 50)
    : [];

  const companyCurrencyCode = ctx.companyId ? (COMPANY_CURRENCY[ctx.companyId] ?? null) : null;

  return clone({ owners, taxes, companyCurrencyCode });
}

export async function fakeListFulfillmentNodeOptions(ctx: TradeContext): Promise<FulfillmentNodeOption[]> {
  await fakeDelay();
  const { branchId } = requireBranchCtx(ctx);
  return clone(nodesForBranch(branchId));
}
