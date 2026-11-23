import type { CoreQuery } from '../../../core/api/core-http';
import { scopeFor, type TradeContext } from './trade-api';
import { tradeHttp } from './trade-http';
import type {
  CategoryOption,
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
  Page,
  PartyRef,
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

export type ItemSummarySource = Omit<ItemRow, 'eligibility'> & {
  eligibility?: ItemEligibility | null;
  companyProfile?: ItemCompanyProfile | null;
};

interface CatalogUomRow {
  id: string;
  code: string;
  displayName: string;
  localizedNames: LocalizedNames;
  version: number;
  status?: UomStatus;
  updatedAt?: string;
}

interface WireAccountParty {
  id: string;
  displayName: string;
  displayNameAr?: string | null;
  partyType: 'INDIVIDUAL' | 'ORGANIZATION';
  code: string | null;
}

type WireAccountRow = CommercialAccount & {
  party?: WireAccountParty | null;
};

const UOM_PAGE_LIMIT = 100;
const lastUomsById = new Map<string, Uom>();

function activeLang(): 'en' | 'ar' {
  if (typeof document !== 'undefined' && document.documentElement.lang.toLowerCase().startsWith('ar')) {
    return 'ar';
  }
  return 'en';
}

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

function toTaxDefault(taxId: string | null | undefined, taxesById?: ReadonlyMap<string, Tax>): TaxDefault | null {
  if (!taxId || !taxesById) return null;
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

async function loadTaxesById(ctx: TradeContext): Promise<ReadonlyMap<string, Tax>> {
  try {
    const ref = await listReferenceData(ctx);
    return new Map(ref.taxes.map((tax) => [tax.id, tax]));
  } catch {
    return new Map();
  }
}

export function toRow(item: FakeItem, _ctx: TradeContext = {}): ItemRow {
  const { comboComponents: _cc, optionalProducts: _op, deletedAt: _del, ...base } = item;
  return {
    ...base,
    categorySummary: null,
    eligibility: null,
  };
}

export function toSummary(
  row: ItemSummarySource,
  _ctx: TradeContext = {},
  taxesById?: ReadonlyMap<string, Tax>,
): ItemSummary {
  const cp = row.companyProfile ?? null;
  const elig = cp ? null : (row.eligibility ?? null);

  const defaultUomId = cp
    ? (cp.defaultSalesUomId ?? row.baseUomId)
    : elig
      ? (elig.defaultSalesUomId ?? row.baseUomId)
      : row.baseUomId;

  const defaultPurchaseUomId = cp
    ? (cp.defaultPurchaseUomId ?? row.baseUomId)
    : elig
      ? (elig.defaultPurchaseUomId ?? row.baseUomId)
      : row.baseUomId;

  const trackingMode = cp?.trackingMode ?? 'NONE';

  const companyProfile: ItemSummary['companyProfile'] = cp
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
    : elig
      ? {
          id: elig.companyProfileId,
          version: elig.companyProfileVersion,
          canSell: elig.canSell,
          canPurchase: elig.canPurchase,
          canPos: elig.canPos,
          trackInventory: false,
          trackingMode: 'NONE',
          defaultSalesUomId: elig.defaultSalesUomId,
          defaultPurchaseUomId: elig.defaultPurchaseUomId,
          salesPrice: elig.salesPrice,
          currencyCode: elig.currencyCode,
        }
      : null;

  const salesTaxId = cp ? cp.salesTaxId : elig?.salesTaxId;
  const purchaseTaxId = cp ? cp.purchaseTaxId : elig?.purchaseTaxId;

  return {
    id: row.id,
    sku: row.canonicalCode,
    canonicalCode: row.canonicalCode,
    itemKind: row.itemKind,
    status: row.status,
    displayName: itemName(row, activeLang()),
    localizedNames: row.localizedNames,
    categoryId: row.categoryId,
    image: row.image,
    baseUomId: row.baseUomId,
    defaultUomId,
    defaultPurchaseUomId,
    trackingMode,
    companyProfile,
    salesTaxDefault: toTaxDefault(salesTaxId, taxesById),
    purchaseTaxDefault: toTaxDefault(purchaseTaxId, taxesById),
  };
}

function buildSearchItemsQuery(q: SearchItemsQuery): CoreQuery | undefined {
  const query: CoreQuery = {};
  if (q.page !== undefined) query['page'] = q.page;
  if (q.limit !== undefined) query['limit'] = q.limit;
  if (q.itemKind !== undefined) query['itemKind'] = q.itemKind;
  if (q.status !== undefined) query['status'] = q.status;
  if (q.purpose !== undefined) query['purpose'] = q.purpose;
  if (q.categoryId !== undefined) query['categoryId'] = q.categoryId;
  const search = q.search?.trim();
  if (search) query['search'] = search;
  return Object.keys(query).length > 0 ? query : undefined;
}

// GET /api/tenant/trade/v1/items?page&limit&itemKind&status&purpose&categoryId&search (+ OPTIONAL scope)
export function searchItems(ctx: TradeContext = {}, q: SearchItemsQuery = {}): Promise<Page<ItemRow>> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  return tradeHttp().read<Page<ItemRow>>('/items', buildSearchItemsQuery(q), { scope });
}

// GET /api/tenant/trade/v1/items?... (+ OPTIONAL scope) -> mapped to derived ItemSummary view
export async function searchItemSummaries(
  ctx: TradeContext = {},
  q: SearchItemsQuery = {},
): Promise<Page<ItemSummary>> {
  const page = await searchItems(ctx, q);
  const needsTaxes =
    Boolean(ctx.companyId) &&
    page.items.some((row) => Boolean(row.eligibility?.salesTaxId || row.eligibility?.purchaseTaxId));
  const taxesById = needsTaxes ? await loadTaxesById(ctx) : undefined;

  return {
    items: page.items.map((row) => toSummary(row, ctx, taxesById)),
    total: page.total,
    page: page.page,
    limit: page.limit,
  };
}

// GET /api/tenant/trade/v1/items/:id (+ OPTIONAL scope)
export function getItem(ctx: TradeContext, id: string): Promise<ItemDetail> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  return tradeHttp().read<ItemDetail>(`/items/${encodeURIComponent(id)}`, undefined, { scope });
}

// GET /api/tenant/trade/v1/items/:id (+ OPTIONAL scope) -> ItemSummary & ItemDetail
export async function getItemSummary(ctx: TradeContext, id: string): Promise<ItemSummary & ItemDetail> {
  const detail = await getItem(ctx, id);
  const cp = detail.companyProfile;
  const needsTaxes = Boolean(cp && (cp.salesTaxId || cp.purchaseTaxId));
  const taxCtx = cp && !ctx.companyId ? { ...ctx, companyId: cp.companyId } : ctx;
  const taxesById = needsTaxes && taxCtx.companyId ? await loadTaxesById(taxCtx) : undefined;
  const summary = toSummary(detail, ctx, taxesById);
  return {
    ...summary,
    ...detail,
  };
}

// Without itemId: GET /api/tenant/trade/v1/uoms?page&limit=100&status (+ OPTIONAL scope)
// With itemId:    GET /api/tenant/trade/v1/catalog/uoms?page&limit=100&purpose&itemId (+ OPTIONAL scope)
export async function listUoms(q?: ListUomsQuery, ctx?: TradeContext): Promise<Uom[]> {
  if (q?.itemId) {
    const effectiveCtx: TradeContext = {
      ...(ctx ?? {}),
      ...(q.companyId && !ctx?.companyId ? { companyId: q.companyId } : {}),
    };
    const scope = scopeFor(effectiveCtx, 'OPTIONAL');
    const merged: Uom[] = [];

    for (let page = 1; ; page += 1) {
      const query: CoreQuery = {
        page,
        limit: UOM_PAGE_LIMIT,
        itemId: q.itemId,
        ...(q.purpose !== undefined ? { purpose: q.purpose } : {}),
      };
      const res = await tradeHttp().read<Page<CatalogUomRow>>('/catalog/uoms', query, { scope });
      for (const row of res.items) {
        merged.push({
          id: row.id,
          code: row.code,
          displayName: row.displayName,
          localizedNames: row.localizedNames,
          status: row.status ?? 'ACTIVE',
          version: row.version,
          updatedAt: row.updatedAt ?? '',
        });
      }
      if (res.items.length < UOM_PAGE_LIMIT || merged.length >= res.total) {
        break;
      }
    }

    const result = q.status ? merged.filter((uom) => uom.status === q.status) : merged;
    for (const uom of result) {
      lastUomsById.set(uom.id, structuredClone(uom));
    }
    return result;
  }

  const scope = scopeFor(ctx ?? {}, 'OPTIONAL');
  const status = q?.status;
  const merged: Uom[] = [];

  for (let page = 1; ; page += 1) {
    const query: CoreQuery = {
      page,
      limit: UOM_PAGE_LIMIT,
      ...(status !== undefined ? { status } : {}),
    };
    const res = await tradeHttp().read<Page<Uom>>('/uoms', query, { scope });
    merged.push(...res.items);
    if (res.items.length < UOM_PAGE_LIMIT || merged.length >= res.total) {
      break;
    }
  }

  if (!status) {
    lastUomsById.clear();
  }
  for (const uom of merged) {
    lastUomsById.set(uom.id, structuredClone(uom));
  }
  return merged;
}

export function uomById(id: string): Uom | undefined {
  const cached = lastUomsById.get(id);
  return cached ? structuredClone(cached) : undefined;
}

// GET /api/tenant/trade/v1/catalog/categories?limit=100&search (+ OPTIONAL scope)
export async function listCategoryOptions(ctx: TradeContext = {}, search?: string): Promise<CategoryOption[]> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const trimmed = search?.trim();
  const query: CoreQuery = {
    limit: 100,
    ...(trimmed ? { search: trimmed } : {}),
  };
  const res = await tradeHttp().read<{ items: CategoryOption[] }>('/catalog/categories', query, { scope });
  return res.items;
}

// GET /api/tenant/trade/v1/channels?page=1&limit=100 (+ COMPANY scope)
export async function listChannels(ctx: TradeContext): Promise<Channel[]> {
  const scope = scopeFor(ctx, 'COMPANY');
  const res = await tradeHttp().read<Page<Channel>>('/channels', { page: 1, limit: 100 }, { scope });
  return res.items;
}

// GET /api/tenant/trade/v1/commercial-accounts?page=1&limit=100&accountRole&status&search (+ OPTIONAL scope)
export async function searchAccounts(
  ctx: TradeContext,
  q: SearchAccountsQuery = {},
): Promise<(CommercialAccount & { party: PartyRef })[]> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const trimmed = q.search?.trim();
  const query: CoreQuery = {
    page: 1,
    limit: 100,
    ...(q.role !== undefined ? { accountRole: q.role } : {}),
    ...(q.status !== undefined ? { status: q.status } : {}),
    ...(trimmed ? { search: trimmed } : {}),
  };
  const res = await tradeHttp().read<Page<WireAccountRow>>('/commercial-accounts', query, { scope });
  const lang = activeLang();

  return res.items.map((row) => {
    const { party: wireParty, ...account } = row;
    const party: PartyRef = wireParty
      ? {
          id: wireParty.id,
          displayName: lang === 'ar' && wireParty.displayNameAr ? wireParty.displayNameAr : wireParty.displayName,
          partyType: wireParty.partyType,
          code: wireParty.code ?? null,
        }
      : {
          id: account.partyId,
          displayName: '',
          partyType: 'ORGANIZATION',
          code: null,
        };
    return { ...account, party };
  });
}

// GET /api/tenant/trade/v1/commercial-accounts?... (+ OPTIONAL scope)
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

// GET /api/tenant/trade/v1/items/reference-data?search&limit=50 (+ OPTIONAL scope)
export function listReferenceData(ctx: TradeContext = {}, search?: string): Promise<ReferenceData> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const trimmed = search?.trim();
  const query: CoreQuery = {
    limit: 50,
    ...(trimmed ? { search: trimmed } : {}),
  };
  return tradeHttp().read<ReferenceData>('/items/reference-data', query, { scope });
}

// GET /api/tenant/trade/v1/reason-codes?kind&includeInactive (+ OPTIONAL scope) -> { items } (cap 500, no total)
export async function listReasons(
  kind: ReasonKind,
  opts?: ListReasonsOptions,
  ctx: TradeContext = {},
): Promise<ReasonCode[]> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const query: CoreQuery = {
    kind,
    includeInactive: opts?.includeInactive ?? false,
  };
  const res = await tradeHttp().read<{ items: ReasonCode[] }>('/reason-codes', query, { scope });
  return res.items.map((row) => ({
    ...row,
    localizedNames: {
      en: row.localizedNames?.en ?? '',
      ar: row.localizedNames?.ar ?? '',
    },
  }));
}
