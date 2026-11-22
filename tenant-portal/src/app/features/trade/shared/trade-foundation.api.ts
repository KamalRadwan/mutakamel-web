import { ApiError, fakeDelay, type TradeContext } from './trade-api';
import { TRADE_FAKE_DB, clone, fakeLang, fakeListReasonCodes } from './trade-foundation.fake';
import type {
  CategoryNode,
  CategoryOption,
  CategorySummaryRef,
  Channel,
  CommercialAccount,
  CommercialAccountRole,
  CommercialAccountStatus,
  CommercialAccountSummary,
  FakeItem,
  ItemCompanyProfile,
  ItemDetail,
  ItemEligibility,
  ItemKind,
  ItemRow,
  ItemStatus,
  ItemSummary,
  ItemUsagePurpose,
  LocalizedNames,
  PartyRef,
  Page,
  ReasonCode,
  ReasonKind,
  ReferenceData,
  Tax,
  TaxDefault,
  Uom,
  UomStatus,
} from './trade-foundation.model';

export interface SearchItemsQuery {
  page?: number;
  limit?: number;
  itemKind?: ItemKind;
  status?: ItemStatus;
  purpose?: ItemUsagePurpose;
  categoryId?: string;
  search?: string;
}

export interface ListUomsQuery {
  status?: UomStatus;
  purpose?: 'ANY' | 'SALES' | 'PURCHASE';
  itemId?: string;
  companyId?: string;
}

export interface SearchAccountsQuery {
  role?: CommercialAccountRole;
  status?: CommercialAccountStatus;
  search?: string;
}

export interface ListReasonsOptions {
  includeInactive?: boolean;
}

const lastUomsById = new Map<string, Uom>();

const currentLang = fakeLang;

export function itemName(item: { localizedNames: LocalizedNames }, lang: string): string {
  const byLang = item.localizedNames[lang];
  if (byLang) return byLang;
  const byEn = item.localizedNames['en'];
  if (byEn) return byEn;
  for (const val of Object.values(item.localizedNames)) {
    if (val) return val;
  }
  return '';
}

function categoryChain(categoryId: string | null): CategoryNode[] | null {
  if (!categoryId) return null;
  const byId = new Map(TRADE_FAKE_DB.categories.map((cat) => [cat.id, cat]));
  const chain: CategoryNode[] = [];
  const visited = new Set<string>();
  let currId: string | null = categoryId;

  while (currId) {
    if (visited.has(currId)) return null;
    visited.add(currId);
    const node = byId.get(currId);
    if (!node || node.deletedAt !== null) return null;
    chain.unshift(node);
    currId = node.parentId;
  }

  return chain.length > 0 ? chain : null;
}

function buildCategorySummary(categoryId: string | null, lang: 'en' | 'ar'): CategorySummaryRef | null {
  const chain = categoryChain(categoryId);
  if (!chain) return null;

  const self = chain[chain.length - 1];
  return {
    id: self.id,
    code: self.code,
    name: self.localizedNames[lang] ?? self.displayName,
    path: chain.map((node) => ({
      id: node.id,
      code: node.code,
      name: node.localizedNames[lang] ?? node.displayName,
    })),
    effectiveActive: chain.every((node) => node.status === 'ACTIVE'),
    treeVersion: TRADE_FAKE_DB.meta.categoryTreeVersion,
  };
}

function findCompanyProfile(itemId: string, companyId: string | undefined): ItemCompanyProfile | null {
  if (!companyId) return null;
  return TRADE_FAKE_DB.companyProfiles.find((p) => p.itemId === itemId && p.companyId === companyId) ?? null;
}

function buildEligibility(item: FakeItem, ctx: TradeContext): ItemEligibility | undefined {
  if (!ctx.companyId) return undefined;
  const cp = findCompanyProfile(item.id, ctx.companyId);
  if (!cp) return undefined;

  const bp = ctx.branchId
    ? TRADE_FAKE_DB.branchProfiles.find((b) => b.itemCompanyProfileId === cp.id && b.branchId === ctx.branchId)
    : undefined;

  return {
    companyProfileId: cp.id,
    companyProfileVersion: cp.version,
    companyProfileStatus: cp.status,
    canSell: cp.canSell,
    canPurchase: cp.canPurchase,
    canPos: cp.canPos,
    salesPrice: cp.salesPrice,
    currencyCode: cp.currencyCode,
    salesTaxId: cp.salesTaxId,
    purchaseTaxId: cp.purchaseTaxId,
    baseUomId: item.baseUomId,
    defaultSalesUomId: cp.defaultSalesUomId ?? item.baseUomId,
    defaultPurchaseUomId: cp.defaultPurchaseUomId ?? item.baseUomId,
    branchProfileId: bp?.id ?? null,
    branchProfileVersion: bp?.version ?? null,
    isAssorted: bp ? bp.isAssorted : null,
  };
}

function toTaxDefault(taxId: string | null, taxesById: Map<string, Tax>): TaxDefault | null {
  if (!taxId) return null;
  const tax = taxesById.get(taxId);
  if (!tax) return null;
  return {
    taxId: tax.id,
    code: tax.code,
    name: tax.name,
    rate: tax.rate,
    isInclusive: tax.isInclusive,
  };
}

export function toRow(item: FakeItem, ctx: TradeContext = {}): ItemRow {
  const lang = currentLang();
  const { comboComponents: _cc, optionalProducts: _op, deletedAt: _del, ...base } = item;
  return {
    ...base,
    categorySummary: buildCategorySummary(item.categoryId, lang),
    eligibility: buildEligibility(item, ctx) ?? null,
  };
}

export function toSummary(row: Omit<ItemRow, 'eligibility'>, ctx: TradeContext = {}): ItemSummary {
  const cp = findCompanyProfile(row.id, ctx.companyId);
  const taxesById = new Map(TRADE_FAKE_DB.taxes.map((t) => [t.id, t]));

  return {
    id: row.id,
    sku: row.canonicalCode,
    canonicalCode: row.canonicalCode,
    itemKind: row.itemKind,
    status: row.status,
    displayName: itemName(row, currentLang()),
    localizedNames: row.localizedNames,
    categoryId: row.categoryId,
    image: row.image,
    baseUomId: row.baseUomId,
    defaultUomId: cp?.defaultSalesUomId ?? row.baseUomId,
    defaultPurchaseUomId: cp?.defaultPurchaseUomId ?? row.baseUomId,
    trackingMode: cp?.trackingMode ?? 'NONE',
    companyProfile: cp
      ? {
          id: cp.id,
          version: cp.version,
          canSell: cp.canSell,
          canPurchase: cp.canPurchase,
          canPos: cp.canPos,
          trackInventory: cp.trackInventory,
          trackingMode: cp.trackingMode,
          defaultSalesUomId: cp.defaultSalesUomId,
          defaultPurchaseUomId: cp.defaultPurchaseUomId,
          salesPrice: cp.salesPrice,
          currencyCode: cp.currencyCode,
        }
      : null,
    salesTaxDefault: cp ? toTaxDefault(cp.salesTaxId, taxesById) : null,
    purchaseTaxDefault: cp ? toTaxDefault(cp.purchaseTaxId, taxesById) : null,
  };
}

function matchesItemSearch(item: FakeItem, needle: string): boolean {
  if (item.canonicalCode.toLowerCase().includes(needle)) return true;
  if (item.barcode && item.barcode.toLowerCase().includes(needle)) return true;
  for (const name of Object.values(item.localizedNames)) {
    if (name.toLowerCase().includes(needle)) return true;
  }
  return false;
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

// GET /api/tenant/trade/v1/items?page&limit&itemKind&status&purpose&search (+ context headers)
export async function searchItems(ctx: TradeContext = {}, q: SearchItemsQuery = {}): Promise<Page<ItemRow>> {
  await fakeDelay();

  const page = q.page ?? 1;
  const limit = q.limit ?? 25;
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    (q.search !== undefined && q.search.length > 160)
  ) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  if (q.purpose) {
    if (!ctx.companyId) {
      throw new ApiError(422, 'TRADE.CATALOG.COMPANY_PROFILE_INVALID');
    }
    if (q.purpose === 'POS') {
      throw new ApiError(422, 'TRADE.CATALOG.CHANNEL_INVALID');
    }
  }

  const needle = q.search?.trim().toLowerCase() ?? '';
  const matched = TRADE_FAKE_DB.items.filter((item) => {
    if (item.deletedAt !== null) return false;
    if (q.itemKind && item.itemKind !== q.itemKind) return false;
    if (q.status && item.status !== q.status) return false;
    if (q.categoryId && item.categoryId !== q.categoryId) return false;

    const cp = findCompanyProfile(item.id, ctx.companyId);
    if (ctx.companyId && !cp) return false;
    if (ctx.branchId && !itemHasAssortedBranch(item.id, cp?.id, ctx.branchId)) return false;

    if (q.purpose === 'SALES') {
      if (!cp || item.status !== 'ACTIVE' || cp.status !== 'ACTIVE' || !cp.canSell) return false;
    } else if (q.purpose === 'PURCHASE') {
      if (!cp || item.status !== 'ACTIVE' || cp.status !== 'ACTIVE' || !cp.canPurchase) return false;
    }

    if (needle && !matchesItemSearch(item, needle)) return false;
    return true;
  });

  matched.sort((a, b) => {
    const cmp = b.createdAt.localeCompare(a.createdAt);
    return cmp !== 0 ? cmp : b.id.localeCompare(a.id);
  });

  const total = matched.length;
  const start = (page - 1) * limit;
  const items = matched.slice(start, start + limit).map((item) => toRow(item, ctx));

  return clone({ items, total, page, limit });
}

// GET /api/tenant/trade/v1/items?page&limit&itemKind&status&purpose&search (+ company header)
export async function searchItemSummaries(
  ctx: TradeContext = {},
  q: SearchItemsQuery = {},
): Promise<Page<ItemSummary>> {
  const page = await searchItems(ctx, q);
  return clone({
    items: page.items.map((row) => toSummary(row, ctx)),
    total: page.total,
    page: page.page,
    limit: page.limit,
  });
}

// GET /api/tenant/trade/v1/items/:id (+ optional company/branch headers)
export async function getItem(ctx: TradeContext, id: string): Promise<ItemDetail> {
  await fakeDelay();

  const item = TRADE_FAKE_DB.items.find((entry) => entry.id === id && entry.deletedAt === null);
  if (!item) {
    throw new ApiError(404, 'TRADE.CATALOG.ITEM_NOT_FOUND');
  }

  const companyProfile = findCompanyProfile(item.id, ctx.companyId);
  const branchProfile =
    companyProfile && ctx.branchId
      ? TRADE_FAKE_DB.branchProfiles.find(
          (b) => b.itemCompanyProfileId === companyProfile.id && b.branchId === ctx.branchId,
        ) ?? null
      : null;

  // Backend detail has no eligibility (list-only projection).
  const { eligibility: _eligibility, ...row } = toRow(item, ctx);
  return clone({
    ...row,
    companyProfile,
    branchProfile,
    comboComponents: item.comboComponents,
    optionalProducts: item.optionalProducts,
  });
}

// GET /api/tenant/trade/v1/items/:id (+ company header)
export async function getItemSummary(ctx: TradeContext, id: string): Promise<ItemSummary & ItemDetail> {
  const detail = await getItem(ctx, id);
  const summary = toSummary(detail, ctx);
  return clone({
    ...summary,
    ...detail,
  });
}

// Without itemId: GET /api/tenant/trade/v1/uoms?page=1&limit=100&status (page=2 when total > 100; merged)
// With itemId:    GET /api/tenant/trade/v1/catalog/uoms?purpose&itemId (+ company header)
export async function listUoms(q?: ListUomsQuery, ctx?: TradeContext): Promise<Uom[]> {
  await fakeDelay();

  if (q?.itemId) {
    const item = TRADE_FAKE_DB.items.find((entry) => entry.id === q.itemId && entry.deletedAt === null);
    if (!item) {
      throw new ApiError(404, 'TRADE.CATALOG.ITEM_NOT_FOUND');
    }

    const companyId = ctx?.companyId ?? q.companyId;
    const profiles = companyId
      ? TRADE_FAKE_DB.companyProfiles.filter((p) => p.itemId === item.id && p.companyId === companyId)
      : TRADE_FAKE_DB.companyProfiles.filter((p) => p.itemId === item.id);

    const allowedIds = new Set<string>([item.baseUomId]);
    const purpose = q.purpose ?? 'ANY';
    for (const profile of profiles) {
      if (purpose !== 'PURCHASE' && profile.defaultSalesUomId) {
        allowedIds.add(profile.defaultSalesUomId);
      }
      if (purpose !== 'SALES' && profile.defaultPurchaseUomId) {
        allowedIds.add(profile.defaultPurchaseUomId);
      }
    }

    const result = TRADE_FAKE_DB.uoms.filter(
      (uom) => allowedIds.has(uom.id) && (!q.status || uom.status === q.status),
    );
    for (const uom of result) {
      lastUomsById.set(uom.id, clone(uom));
    }
    return clone(result);
  }

  const status = q?.status;
  const result = status ? TRADE_FAKE_DB.uoms.filter((uom) => uom.status === status) : TRADE_FAKE_DB.uoms;
  if (!status) {
    lastUomsById.clear();
  }
  for (const uom of result) {
    lastUomsById.set(uom.id, clone(uom));
  }
  return clone(result);
}

export function uomById(id: string): Uom | undefined {
  const cached = lastUomsById.get(id);
  return cached ? clone(cached) : undefined;
}

// GET /api/tenant/trade/v1/catalog/categories?limit=100&search (+ optional company/branch headers)
export async function listCategoryOptions(ctx: TradeContext = {}, search?: string): Promise<CategoryOption[]> {
  await fakeDelay();

  const lang = currentLang();
  const activeChains = new Map<string, CategoryNode[]>();
  for (const cat of TRADE_FAKE_DB.categories) {
    if (cat.deletedAt !== null) continue;
    const chain = categoryChain(cat.id);
    if (chain && chain.every((node) => node.status === 'ACTIVE')) {
      activeChains.set(cat.id, chain);
    }
  }

  let allowedIds: Set<string> | null = null;
  if (ctx.companyId) {
    allowedIds = new Set<string>();
    for (const item of TRADE_FAKE_DB.items) {
      if (item.deletedAt !== null || !item.categoryId) continue;
      const cp = findCompanyProfile(item.id, ctx.companyId);
      if (!cp) continue;
      if (ctx.branchId && !itemHasAssortedBranch(item.id, cp.id, ctx.branchId)) continue;
      const chain = activeChains.get(item.categoryId);
      if (!chain) continue;
      for (const node of chain) {
        allowedIds.add(node.id);
      }
    }
  }

  const needle = search?.trim().toLowerCase() ?? '';
  const options: CategoryOption[] = [];

  for (const cat of TRADE_FAKE_DB.categories) {
    const chain = activeChains.get(cat.id);
    if (!chain) continue;
    if (allowedIds && !allowedIds.has(cat.id)) continue;

    const localized = cat.localizedNames[lang] ?? cat.displayName;
    if (needle) {
      const codeMatch = cat.code.toLowerCase().includes(needle);
      const displayMatch = cat.displayName.toLowerCase().includes(needle);
      const nameMatch = Object.values(cat.localizedNames).some((v) => v.toLowerCase().includes(needle));
      if (!codeMatch && !displayMatch && !nameMatch) continue;
    }

    options.push({
      id: cat.id,
      code: cat.code,
      name: localized,
      path: chain.map((node) => ({
        id: node.id,
        code: node.code,
        name: node.localizedNames[lang] ?? node.displayName,
      })),
      depth: chain.length,
    });
  }

  options.sort((a, b) => a.code.localeCompare(b.code));
  return clone(options.slice(0, 100));
}

// GET /api/tenant/trade/v1/channels?page=1&limit=100 (+ company header)
export async function listChannels(ctx: TradeContext): Promise<Channel[]> {
  await fakeDelay();

  if (!ctx.companyId) {
    throw new ApiError(400, 'TRADE.CONTEXT.MISSING_COMPANY');
  }

  const channels = TRADE_FAKE_DB.channels.filter((c) => c.companyId === ctx.companyId).slice(0, 100);
  return clone(channels);
}

// GET /api/tenant/trade/v1/commercial-accounts?limit=100 (+ core party directory)
export async function searchAccounts(
  ctx: TradeContext,
  q: SearchAccountsQuery = {},
): Promise<(CommercialAccount & { party: PartyRef })[]> {
  await fakeDelay();

  if (!ctx.companyId) {
    throw new ApiError(400, 'TRADE.CONTEXT.MISSING_COMPANY');
  }

  const lang = currentLang();
  const partyById = new Map(TRADE_FAKE_DB.parties.map((p) => [p.id, p]));
  const needle = q.search?.trim().toLowerCase() ?? '';
  const results: (CommercialAccount & { party: PartyRef })[] = [];

  for (const account of TRADE_FAKE_DB.accounts) {
    if (account.companyId !== ctx.companyId) continue;
    if (q.role && account.accountRole !== q.role) continue;
    if (q.status && account.status !== q.status) continue;

    const fakeParty = partyById.get(account.partyId);
    if (!fakeParty) continue;

    if (needle) {
      const enMatch = fakeParty.displayName.toLowerCase().includes(needle);
      const arMatch = fakeParty.displayNameAr.toLowerCase().includes(needle);
      const codeMatch = fakeParty.code ? fakeParty.code.toLowerCase().includes(needle) : false;
      if (!enMatch && !arMatch && !codeMatch) continue;
    }

    const party: PartyRef = {
      id: fakeParty.id,
      displayName: lang === 'ar' ? fakeParty.displayNameAr : fakeParty.displayName,
      partyType: fakeParty.partyType,
      code: fakeParty.code,
    };

    results.push({ ...account, party });
    if (results.length >= 100) break;
  }

  return clone(results);
}

// GET /api/tenant/trade/v1/commercial-accounts?limit=100 (+ core party directory)
export async function searchCommercialAccounts(
  ctx: TradeContext,
  q: SearchAccountsQuery = {},
): Promise<CommercialAccountSummary[]> {
  const rows = await searchAccounts(ctx, q);
  return rows.map((row) => ({
    ...row,
    partyName: row.party.displayName,
  }));
}

// GET /api/tenant/trade/v1/items/reference-data?search&limit=50 (+ optional company header)
export async function listReferenceData(ctx: TradeContext = {}, search?: string): Promise<ReferenceData> {
  await fakeDelay();

  const needle = search?.trim().toLowerCase() ?? '';
  const owners = TRADE_FAKE_DB.owners
    .filter((owner) => !needle || owner.name.toLowerCase().includes(needle))
    .slice(0, 50);

  const taxes = ctx.companyId
    ? TRADE_FAKE_DB.taxes
        .filter((tax) => tax.companyId === null || tax.companyId === ctx.companyId)
        .filter(
          (tax) =>
            !needle ||
            tax.code.toLowerCase().includes(needle) ||
            tax.name.toLowerCase().includes(needle),
        )
        .slice(0, 50)
    : [];

  const companyCurrencyCode = ctx.companyId === 'c1' ? 'EGP' : ctx.companyId === 'c2' ? 'SAR' : null;

  return clone({ owners, taxes, companyCurrencyCode });
}

// GET /api/tenant/trade/v1/reason-codes?kind&includeInactive -> { items } (unwrapped here).
// Unknown kind -> 422 TRADE.REASON.KIND_INVALID { field: ['kind'] }.
export async function listReasons(kind: ReasonKind, opts?: ListReasonsOptions): Promise<ReasonCode[]> {
  await fakeDelay();
  const body = fakeListReasonCodes({ kind, includeInactive: opts?.includeInactive ?? false });
  return body.items;
}
