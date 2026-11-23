import type { CoreQuery } from '../../../../core/api/core-http';
import {
  assertBodyBooleans,
  assertIdempotencyKey,
  errorCodeOf,
  errorKey,
  ifMatch,
  scopeFor,
  type TradeContext,
} from '../../shared/trade-api';
import { tradeHttp } from '../../shared/trade-http';
import type {
  Channel,
  ChannelListing,
  ComboComponent,
  ItemBranchProfile,
  ItemCompanyProfile,
  ItemDetail,
  ItemRow,
  ItemStandardCost,
  ItemStatus,
  OptionalProduct,
  Page,
  StatusCounts,
} from '../../shared/trade-foundation.model';
import type {
  BranchProfileBody,
  BranchProfilePatch,
  CompanyProfileBody,
  CompanyProfilePatch,
  FulfillmentNodeOption,
  ItemCreateBody,
  ItemImageReceipt,
  ItemImageRemoved,
  ItemListFilter,
  ItemListQuery,
  ItemPatchBody,
  ItemReferenceData,
  ItemSaved,
  ItemStatusCounts,
  ItemStatusReason,
  ListingChannelOption,
  ListingCreateBody,
  ListingPatchBody,
} from './items.model';

interface WireChannelDetail extends Channel {
  branches: { branchId: string; isActive: boolean }[];
}

interface WireInventoryNode {
  id: string;
  code: string;
  name: string;
  status: string;
}

const CHANNEL_PAGE_LIMIT = 100;

function noneScope() {
  return scopeFor({}, 'NONE');
}

function buildFilterQuery(f: ItemListFilter, includeListControls: boolean): CoreQuery | undefined {
  const query: CoreQuery = {};
  if (f.itemKind !== undefined) query['itemKind'] = f.itemKind;
  if (f.purpose !== undefined) query['purpose'] = f.purpose;
  const search = f.search?.trim();
  if (search) query['search'] = search;
  if (f.categoryId !== undefined) query['categoryId'] = f.categoryId;
  if (f.categoryIds !== undefined && f.categoryIds.length > 0) query['categoryIds'] = f.categoryIds;
  if (f.includeSubcategories !== undefined) query['includeSubcategories'] = f.includeSubcategories;
  if (f.ownerUserId !== undefined) query['ownerUserId'] = f.ownerUserId;
  if (f.hasImage !== undefined) query['hasImage'] = f.hasImage;
  if (f.scope !== undefined) query['scope'] = f.scope;
  if (includeListControls) {
    if (f.status !== undefined) query['status'] = f.status;
    if (f.sort !== undefined) query['sort'] = f.sort;
    if (f.direction !== undefined) query['direction'] = f.direction;
  }
  return Object.keys(query).length > 0 ? query : undefined;
}

function sanitizeComboComponents(rows: readonly ComboComponent[]): ComboComponent[] {
  return rows.map((row) => ({
    componentItemId: row.componentItemId,
    quantity: row.quantity,
    sortOrder: row.sortOrder,
  }));
}

function sanitizeOptionalProducts(rows: readonly OptionalProduct[]): OptionalProduct[] {
  return rows.map((row) => ({
    optionalProductItemId: row.optionalProductItemId,
    sortOrder: row.sortOrder,
  }));
}

function buildCreateItemBody(body: ItemCreateBody): ItemCreateBody {
  return {
    canonicalCode: body.canonicalCode,
    itemKind: body.itemKind,
    localizedNames: { ...body.localizedNames },
    baseUomId: body.baseUomId,
    ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
    ...(body.barcode !== undefined ? { barcode: body.barcode } : {}),
    ...(body.notes !== undefined ? { notes: body.notes } : {}),
    ...(body.ownerUserId !== undefined ? { ownerUserId: body.ownerUserId } : {}),
    ...(body.weightKg !== undefined ? { weightKg: body.weightKg } : {}),
    ...(body.volumeM3 !== undefined ? { volumeM3: body.volumeM3 } : {}),
    ...(body.quotationDescription !== undefined ? { quotationDescription: body.quotationDescription } : {}),
    ...(body.salesOrderDescription !== undefined ? { salesOrderDescription: body.salesOrderDescription } : {}),
    ...(body.receiptDescription !== undefined ? { receiptDescription: body.receiptDescription } : {}),
    ...(body.deliveryOrderDescription !== undefined ? { deliveryOrderDescription: body.deliveryOrderDescription } : {}),
    ...(body.comboComponents !== undefined
      ? { comboComponents: sanitizeComboComponents(body.comboComponents) }
      : {}),
    ...(body.optionalProducts !== undefined
      ? { optionalProducts: sanitizeOptionalProducts(body.optionalProducts) }
      : {}),
  };
}

function buildPatchItemBody(body: ItemPatchBody): ItemPatchBody {
  return {
    ...(body.reasonCodeId !== undefined ? { reasonCodeId: body.reasonCodeId } : {}),
    ...(body.reasonNote !== undefined ? { reasonNote: body.reasonNote } : {}),
    ...(body.localizedNames !== undefined ? { localizedNames: { ...body.localizedNames } } : {}),
    ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.barcode !== undefined ? { barcode: body.barcode } : {}),
    ...(body.notes !== undefined ? { notes: body.notes } : {}),
    ...(body.ownerUserId !== undefined ? { ownerUserId: body.ownerUserId } : {}),
    ...(body.weightKg !== undefined ? { weightKg: body.weightKg } : {}),
    ...(body.volumeM3 !== undefined ? { volumeM3: body.volumeM3 } : {}),
    ...(body.quotationDescription !== undefined ? { quotationDescription: body.quotationDescription } : {}),
    ...(body.salesOrderDescription !== undefined ? { salesOrderDescription: body.salesOrderDescription } : {}),
    ...(body.receiptDescription !== undefined ? { receiptDescription: body.receiptDescription } : {}),
    ...(body.deliveryOrderDescription !== undefined ? { deliveryOrderDescription: body.deliveryOrderDescription } : {}),
    ...(body.comboComponents !== undefined
      ? { comboComponents: sanitizeComboComponents(body.comboComponents) }
      : {}),
    ...(body.optionalProducts !== undefined
      ? { optionalProducts: sanitizeOptionalProducts(body.optionalProducts) }
      : {}),
  };
}

function buildCompanyProfileBody(body: CompanyProfileBody): CompanyProfileBody {
  return {
    canSell: body.canSell,
    canPurchase: body.canPurchase,
    ...(body.canPos !== undefined ? { canPos: body.canPos } : {}),
    trackInventory: body.trackInventory,
    trackingMode: body.trackingMode,
    ...(body.taxClassificationKey !== undefined ? { taxClassificationKey: body.taxClassificationKey } : {}),
    ...(body.defaultSalesUomId !== undefined ? { defaultSalesUomId: body.defaultSalesUomId } : {}),
    ...(body.defaultPurchaseUomId !== undefined ? { defaultPurchaseUomId: body.defaultPurchaseUomId } : {}),
    ...(body.accountingMappingKey !== undefined ? { accountingMappingKey: body.accountingMappingKey } : {}),
    ...(body.salesPrice !== undefined ? { salesPrice: body.salesPrice } : {}),
    ...(body.currencyCode !== undefined ? { currencyCode: body.currencyCode } : {}),
    ...(body.salesTaxId !== undefined ? { salesTaxId: body.salesTaxId } : {}),
    ...(body.purchaseTaxId !== undefined ? { purchaseTaxId: body.purchaseTaxId } : {}),
  };
}

function buildCompanyProfilePatch(body: CompanyProfilePatch): CompanyProfilePatch {
  return {
    ...(body.canSell !== undefined ? { canSell: body.canSell } : {}),
    ...(body.canPurchase !== undefined ? { canPurchase: body.canPurchase } : {}),
    ...(body.canPos !== undefined ? { canPos: body.canPos } : {}),
    ...(body.trackInventory !== undefined ? { trackInventory: body.trackInventory } : {}),
    ...(body.trackingMode !== undefined ? { trackingMode: body.trackingMode } : {}),
    ...(body.taxClassificationKey !== undefined ? { taxClassificationKey: body.taxClassificationKey } : {}),
    ...(body.defaultSalesUomId !== undefined ? { defaultSalesUomId: body.defaultSalesUomId } : {}),
    ...(body.defaultPurchaseUomId !== undefined ? { defaultPurchaseUomId: body.defaultPurchaseUomId } : {}),
    ...(body.accountingMappingKey !== undefined ? { accountingMappingKey: body.accountingMappingKey } : {}),
    ...(body.salesPrice !== undefined ? { salesPrice: body.salesPrice } : {}),
    ...(body.currencyCode !== undefined ? { currencyCode: body.currencyCode } : {}),
    ...(body.salesTaxId !== undefined ? { salesTaxId: body.salesTaxId } : {}),
    ...(body.purchaseTaxId !== undefined ? { purchaseTaxId: body.purchaseTaxId } : {}),
  };
}

function buildBranchProfileBody(body: BranchProfileBody): BranchProfileBody {
  return {
    isAssorted: body.isAssorted,
    ...(body.defaultFulfillmentNodeId !== undefined
      ? { defaultFulfillmentNodeId: body.defaultFulfillmentNodeId }
      : {}),
    ...(body.replenishmentPolicyKey !== undefined
      ? { replenishmentPolicyKey: body.replenishmentPolicyKey }
      : {}),
  };
}

function buildBranchProfilePatch(body: BranchProfilePatch): BranchProfilePatch {
  return {
    ...(body.isAssorted !== undefined ? { isAssorted: body.isAssorted } : {}),
    ...(body.defaultFulfillmentNodeId !== undefined
      ? { defaultFulfillmentNodeId: body.defaultFulfillmentNodeId }
      : {}),
    ...(body.replenishmentPolicyKey !== undefined
      ? { replenishmentPolicyKey: body.replenishmentPolicyKey }
      : {}),
  };
}

function toChannelListing(raw: ChannelListing): ChannelListing {
  return {
    id: raw.id,
    channelId: raw.channelId,
    branchId: raw.branchId ?? null,
    publicationStatus: raw.publicationStatus,
    saleConstraints: raw.saleConstraints ?? {},
    version: raw.version,
    updatedAt: raw.updatedAt,
  };
}

// GET /api/tenant/trade/v1/items?page&limit&status&itemKind&purpose&categoryId&categoryIds&includeSubcategories&ownerUserId&hasImage&scope&sort&direction&search
export function listItems(ctx: TradeContext, q: ItemListQuery): Promise<Page<ItemRow>> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const query: CoreQuery = {
    ...(buildFilterQuery(q, true) ?? {}),
    page: q.page,
    limit: q.limit,
  };
  return tradeHttp().read<Page<ItemRow>>('/items', query, { scope });
}

// GET /api/tenant/trade/v1/items/status-counts (ItemStatusCountsQueryDto: omits status, page, limit, sort, direction)
export async function countItemsByStatus(ctx: TradeContext, f: ItemListFilter): Promise<ItemStatusCounts> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const res = await tradeHttp().read<StatusCounts<ItemStatus>>(
    '/items/status-counts',
    buildFilterQuery(f, false),
    { scope },
  );
  return {
    ALL: res.total,
    DRAFT: res.DRAFT,
    ACTIVE: res.ACTIVE,
    INACTIVE: res.INACTIVE,
    DISCONTINUED: res.DISCONTINUED,
  };
}

// GET /api/tenant/trade/v1/items/:id
export function getItemDetail(ctx: TradeContext, id: string): Promise<ItemDetail> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  return tradeHttp().read<ItemDetail>(`/items/${encodeURIComponent(id)}`, undefined, { scope });
}

// POST /api/tenant/trade/v1/items (Gateway scope NONE)
export async function createItem(body: ItemCreateBody, key: string): Promise<ItemSaved> {
  const { data } = await tradeHttp().write<ItemSaved>('POST', '/items', buildCreateItemBody(body), {
    key: assertIdempotencyKey(key),
    scope: noneScope(),
  });
  return data;
}

// PATCH /api/tenant/trade/v1/items/:id (If-Match = version, Gateway scope NONE)
export async function patchItem(id: string, version: number, body: ItemPatchBody, key: string): Promise<ItemSaved> {
  const { data } = await tradeHttp().write<ItemSaved>(
    'PATCH',
    `/items/${encodeURIComponent(id)}`,
    buildPatchItemBody(body),
    {
      key: assertIdempotencyKey(key),
      ifMatch: ifMatch(version),
      scope: noneScope(),
    },
  );
  return data;
}

// PATCH /api/tenant/trade/v1/items/:id { status, reasonCodeId?, reasonNote? } (If-Match = version, Gateway scope NONE)
export async function moveItemStatus(
  id: string,
  version: number,
  status: ItemStatus,
  key: string,
  reason?: ItemStatusReason,
): Promise<ItemSaved> {
  const payload: ItemPatchBody = {
    status,
    ...(reason?.reasonCodeId !== undefined ? { reasonCodeId: reason.reasonCodeId } : {}),
    ...(reason?.reasonNote !== undefined ? { reasonNote: reason.reasonNote } : {}),
  };
  const { data } = await tradeHttp().write<ItemSaved>('PATCH', `/items/${encodeURIComponent(id)}`, payload, {
    key: assertIdempotencyKey(key),
    ifMatch: ifMatch(version),
    scope: noneScope(),
  });
  return data;
}

// POST /api/tenant/trade/v1/items/:id/company-profile (COMPANY scope)
export async function createCompanyProfile(
  ctx: TradeContext,
  itemId: string,
  body: CompanyProfileBody,
  key: string,
): Promise<ItemCompanyProfile> {
  assertBodyBooleans(body, ['canSell', 'canPurchase', 'canPos', 'trackInventory']);
  const scope = scopeFor(ctx, 'COMPANY');
  const { data } = await tradeHttp().write<ItemCompanyProfile>(
    'POST',
    `/items/${encodeURIComponent(itemId)}/company-profile`,
    buildCompanyProfileBody(body),
    {
      key: assertIdempotencyKey(key),
      scope,
    },
  );
  return data;
}

// PATCH /api/tenant/trade/v1/items/:id/company-profile (If-Match = version, COMPANY scope)
export async function patchCompanyProfile(
  ctx: TradeContext,
  itemId: string,
  version: number,
  body: CompanyProfilePatch,
  key: string,
): Promise<ItemCompanyProfile> {
  assertBodyBooleans(body, ['canSell', 'canPurchase', 'canPos', 'trackInventory']);
  const scope = scopeFor(ctx, 'COMPANY');
  const { data } = await tradeHttp().write<ItemCompanyProfile>(
    'PATCH',
    `/items/${encodeURIComponent(itemId)}/company-profile`,
    buildCompanyProfilePatch(body),
    {
      key: assertIdempotencyKey(key),
      ifMatch: ifMatch(version),
      scope,
    },
  );
  return data;
}

// GET /api/tenant/trade/v1/items/:id/standard-cost (COMPANY scope)
export function getStandardCost(ctx: TradeContext, itemId: string): Promise<ItemStandardCost> {
  const scope = scopeFor(ctx, 'COMPANY');
  return tradeHttp().read<ItemStandardCost>(`/items/${encodeURIComponent(itemId)}/standard-cost`, undefined, {
    scope,
  });
}

// PATCH /api/tenant/trade/v1/items/:id/standard-cost (If-Match = profile version, COMPANY scope)
export async function patchStandardCost(
  ctx: TradeContext,
  itemId: string,
  version: number,
  standardCost: string | null,
  key: string,
): Promise<ItemStandardCost> {
  const scope = scopeFor(ctx, 'COMPANY');
  const { data } = await tradeHttp().write<ItemStandardCost>(
    'PATCH',
    `/items/${encodeURIComponent(itemId)}/standard-cost`,
    { standardCost },
    {
      key: assertIdempotencyKey(key),
      ifMatch: ifMatch(version),
      scope,
    },
  );
  return data;
}

// POST /api/tenant/trade/v1/items/:id/branch-profile (BRANCH scope)
export async function createBranchProfile(
  ctx: TradeContext,
  itemId: string,
  body: BranchProfileBody,
  key: string,
): Promise<ItemBranchProfile> {
  assertBodyBooleans(body, ['isAssorted']);
  const scope = scopeFor(ctx, 'BRANCH');
  const { data } = await tradeHttp().write<ItemBranchProfile>(
    'POST',
    `/items/${encodeURIComponent(itemId)}/branch-profile`,
    buildBranchProfileBody(body),
    {
      key: assertIdempotencyKey(key),
      scope,
    },
  );
  return data;
}

// PATCH /api/tenant/trade/v1/items/:id/branch-profile (If-Match = version, BRANCH scope)
export async function patchBranchProfile(
  ctx: TradeContext,
  itemId: string,
  version: number,
  body: BranchProfilePatch,
  key: string,
): Promise<ItemBranchProfile> {
  assertBodyBooleans(body, ['isAssorted']);
  const scope = scopeFor(ctx, 'BRANCH');
  const { data } = await tradeHttp().write<ItemBranchProfile>(
    'PATCH',
    `/items/${encodeURIComponent(itemId)}/branch-profile`,
    buildBranchProfilePatch(body),
    {
      key: assertIdempotencyKey(key),
      ifMatch: ifMatch(version),
      scope,
    },
  );
  return data;
}

// GET /api/tenant/trade/v1/items/:id/channel-listings (OPTIONAL_COMPANY_BRANCH)
export function listItemListings(
  ctx: TradeContext,
  itemId: string,
  page = 1,
  limit = 50,
): Promise<Page<ChannelListing>> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  return tradeHttp().read<Page<ChannelListing>>(
    `/items/${encodeURIComponent(itemId)}/channel-listings`,
    { page, limit },
    { scope },
  );
}

// POST /api/tenant/trade/v1/items/:id/channel-listings (OPTIONAL_COMPANY_BRANCH)
export async function createListing(
  ctx: TradeContext,
  itemId: string,
  body: ListingCreateBody,
  key: string,
): Promise<ChannelListing> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const payload: ListingCreateBody = {
    channelId: body.channelId,
    ...(body.publicationStatus !== undefined ? { publicationStatus: body.publicationStatus } : {}),
  };
  const { data } = await tradeHttp().write<ChannelListing>(
    'POST',
    `/items/${encodeURIComponent(itemId)}/channel-listings`,
    payload,
    {
      key: assertIdempotencyKey(key),
      scope,
    },
  );
  return toChannelListing(data);
}

// PATCH /api/tenant/trade/v1/items/:id/channel-listings/:channelId (If-Match = version, OPTIONAL_COMPANY_BRANCH)
export async function patchListing(
  ctx: TradeContext,
  itemId: string,
  channelId: string,
  version: number,
  body: ListingPatchBody,
  key: string,
): Promise<ChannelListing> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const payload: ListingPatchBody = {
    ...(body.publicationStatus !== undefined ? { publicationStatus: body.publicationStatus } : {}),
  };
  const { data } = await tradeHttp().write<ChannelListing>(
    'PATCH',
    `/items/${encodeURIComponent(itemId)}/channel-listings/${encodeURIComponent(channelId)}`,
    payload,
    {
      key: assertIdempotencyKey(key),
      ifMatch: ifMatch(version),
      scope,
    },
  );
  return toChannelListing(data);
}

// GET /api/tenant/trade/v1/channels (+ GET /api/tenant/trade/v1/channels/:id when branchId is set; COMPANY scope)
export async function listListingChannels(ctx: TradeContext): Promise<ListingChannelOption[]> {
  const scope = scopeFor(ctx, 'COMPANY');
  const channels: Channel[] = [];

  for (let page = 1; ; page += 1) {
    const res = await tradeHttp().read<Page<Channel>>(
      '/channels',
      { page, limit: CHANNEL_PAGE_LIMIT },
      { scope },
    );
    channels.push(...res.items);
    if (res.items.length < CHANNEL_PAGE_LIMIT || channels.length >= res.total) {
      break;
    }
  }

  const branchId = ctx.branchId;
  if (!branchId) {
    return channels.map((channel) => ({ ...channel, linkedToBranch: null }));
  }

  return Promise.all(
    channels.map(async (channel): Promise<ListingChannelOption> => {
      if (channel.activeBranchCount === 0) {
        return { ...channel, linkedToBranch: false };
      }
      if (channel.status !== 'ACTIVE') {
        return { ...channel, linkedToBranch: null };
      }
      const detail = await tradeHttp().read<WireChannelDetail>(
        `/channels/${encodeURIComponent(channel.id)}`,
        undefined,
        { scope },
      );
      const linkedToBranch = detail.branches.some(
        (link) => link.branchId === branchId && link.isActive,
      );
      return { ...channel, linkedToBranch };
    }),
  );
}

// PUT /api/tenant/trade/v1/items/:id/image (multipart "file", If-Match = version, TENANT target -> NONE scope)
export async function putItemImage(
  itemId: string,
  version: number,
  file: File,
  key: string,
): Promise<ItemImageReceipt> {
  const form = new FormData();
  form.append('file', file, file.name);
  const { data } = await tradeHttp().write<ItemImageReceipt>(
    'PUT',
    `/items/${encodeURIComponent(itemId)}/image`,
    form,
    {
      key: assertIdempotencyKey(key),
      ifMatch: ifMatch(version),
      scope: noneScope(),
    },
  );
  return data;
}

// DELETE /api/tenant/trade/v1/items/:id/image (If-Match = version, TENANT target -> NONE scope)
export async function deleteItemImage(itemId: string, version: number, key: string): Promise<ItemImageRemoved> {
  const { data } = await tradeHttp().write<ItemImageRemoved>(
    'DELETE',
    `/items/${encodeURIComponent(itemId)}/image`,
    undefined,
    {
      key: assertIdempotencyKey(key),
      ifMatch: ifMatch(version),
      scope: noneScope(),
    },
  );
  return data;
}

// GET /api/tenant/trade/v1/items/reference-data (OPTIONAL_COMPANY_BRANCH)
export function getReferenceData(ctx: TradeContext, search?: string): Promise<ItemReferenceData> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const trimmed = search?.trim();
  const query: CoreQuery = {
    limit: 50,
    ...(trimmed ? { search: trimmed } : {}),
  };
  return tradeHttp().read<ItemReferenceData>('/items/reference-data', query, { scope });
}

// GET /api/tenant/trade/v1/inventory/nodes?status=ACTIVE (bare array, BRANCH scope)
export async function listFulfillmentNodeOptions(ctx: TradeContext): Promise<FulfillmentNodeOption[]> {
  const scope = scopeFor(ctx, 'BRANCH');
  const nodes = await tradeHttp().read<WireInventoryNode[]>(
    '/inventory/nodes',
    { status: 'ACTIVE' },
    { scope },
  );
  const branchId = ctx.branchId!;
  return nodes.map((node) => ({
    id: node.id,
    branchId,
    localizedNames: { en: node.name, ar: node.name },
  }));
}

export function itemErrorKey(e: unknown): string {
  if (errorCodeOf(e)) {
    return errorKey(e);
  }
  return 'tradeShared.errors.generic';
}
