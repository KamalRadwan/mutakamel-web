import { errorCodeOf, errorKey, type TradeContext } from '../../shared/trade-api';
import type {
  ChannelListing,
  ItemBranchProfile,
  ItemCompanyProfile,
  ItemDetail,
  ItemRow,
  ItemStandardCost,
  ItemStatus,
  Page,
} from '../../shared/trade-foundation.model';
import {
  fakeCountItemsByStatus,
  fakeCreateBranchProfile,
  fakeCreateCompanyProfile,
  fakeCreateItem,
  fakeCreateListing,
  fakeDeleteItemImage,
  fakeGetItemDetail,
  fakeGetReferenceData,
  fakeGetStandardCost,
  fakeListFulfillmentNodeOptions,
  fakeListItemListings,
  fakeListItems,
  fakeListListingChannels,
  fakeMoveItemStatus,
  fakePatchBranchProfile,
  fakePatchCompanyProfile,
  fakePatchItem,
  fakePatchListing,
  fakePatchStandardCost,
  fakePutItemImage,
} from './items.fake';
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

// GET /api/tenant/trade/v1/items?page&limit&status&itemKind&purpose&categoryId&includeSubcategories&ownerUserId&hasImage&scope&sort&direction&search
export async function listItems(ctx: TradeContext, q: ItemListQuery): Promise<Page<ItemRow>> {
  return fakeListItems(ctx, q);
}

// GET /api/tenant/trade/v1/items/status-counts (ItemStatusCountsQueryDto: the GET /items filters without status, page, limit, sort, direction)
export async function countItemsByStatus(ctx: TradeContext, f: ItemListFilter): Promise<ItemStatusCounts> {
  const { sort: _sort, direction: _direction, ...filter } = f;
  const res = await fakeCountItemsByStatus(ctx, filter);
  return {
    ALL: res.total,
    DRAFT: res.DRAFT,
    ACTIVE: res.ACTIVE,
    INACTIVE: res.INACTIVE,
    DISCONTINUED: res.DISCONTINUED,
  };
}

// GET /api/tenant/trade/v1/items/:id
export async function getItemDetail(ctx: TradeContext, id: string): Promise<ItemDetail> {
  return fakeGetItemDetail(ctx, id);
}

// POST /api/tenant/trade/v1/items
export async function createItem(body: ItemCreateBody, key: string): Promise<ItemSaved> {
  return fakeCreateItem(body, key);
}

// PATCH /api/tenant/trade/v1/items/:id (If-Match = version)
export async function patchItem(id: string, version: number, body: ItemPatchBody, key: string): Promise<ItemSaved> {
  return fakePatchItem(id, version, body, key);
}

// PATCH /api/tenant/trade/v1/items/:id { status, reasonCodeId?, reasonNote? } (If-Match = version)
export async function moveItemStatus(
  id: string,
  version: number,
  status: ItemStatus,
  key: string,
  reason?: ItemStatusReason,
): Promise<ItemSaved> {
  return fakeMoveItemStatus(id, version, status, key, reason);
}

// POST /api/tenant/trade/v1/items/:id/company-profile
export async function createCompanyProfile(
  ctx: TradeContext,
  itemId: string,
  body: CompanyProfileBody,
  key: string,
): Promise<ItemCompanyProfile> {
  return fakeCreateCompanyProfile(ctx, itemId, body, key);
}

// PATCH /api/tenant/trade/v1/items/:id/company-profile (If-Match = version)
export async function patchCompanyProfile(
  ctx: TradeContext,
  itemId: string,
  version: number,
  body: CompanyProfilePatch,
  key: string,
): Promise<ItemCompanyProfile> {
  return fakePatchCompanyProfile(ctx, itemId, version, body, key);
}

// GET /api/tenant/trade/v1/items/:id/standard-cost
export async function getStandardCost(ctx: TradeContext, itemId: string): Promise<ItemStandardCost> {
  return fakeGetStandardCost(ctx, itemId);
}

// PATCH /api/tenant/trade/v1/items/:id/standard-cost (If-Match = profile version)
export async function patchStandardCost(
  ctx: TradeContext,
  itemId: string,
  version: number,
  standardCost: string | null,
  key: string,
): Promise<ItemStandardCost> {
  return fakePatchStandardCost(ctx, itemId, version, standardCost, key);
}

// POST /api/tenant/trade/v1/items/:id/branch-profile
export async function createBranchProfile(
  ctx: TradeContext,
  itemId: string,
  body: BranchProfileBody,
  key: string,
): Promise<ItemBranchProfile> {
  return fakeCreateBranchProfile(ctx, itemId, body, key);
}

// PATCH /api/tenant/trade/v1/items/:id/branch-profile (If-Match = version)
export async function patchBranchProfile(
  ctx: TradeContext,
  itemId: string,
  version: number,
  body: BranchProfilePatch,
  key: string,
): Promise<ItemBranchProfile> {
  return fakePatchBranchProfile(ctx, itemId, version, body, key);
}

// GET /api/tenant/trade/v1/items/:id/channel-listings
export async function listItemListings(
  ctx: TradeContext,
  itemId: string,
  page = 1,
  limit = 50,
): Promise<Page<ChannelListing>> {
  return fakeListItemListings(ctx, itemId, page, limit);
}

// POST /api/tenant/trade/v1/items/:id/channel-listings
export async function createListing(
  ctx: TradeContext,
  itemId: string,
  body: ListingCreateBody,
  key: string,
): Promise<ChannelListing> {
  return fakeCreateListing(ctx, itemId, body, key);
}

// PATCH /api/tenant/trade/v1/items/:id/channel-listings/:channelId (If-Match = version)
export async function patchListing(
  ctx: TradeContext,
  itemId: string,
  channelId: string,
  version: number,
  body: ListingPatchBody,
  key: string,
): Promise<ChannelListing> {
  return fakePatchListing(ctx, itemId, channelId, version, body, key);
}

// GET /api/tenant/trade/v1/channels + GET /api/tenant/trade/v1/channels/:id
export async function listListingChannels(ctx: TradeContext): Promise<ListingChannelOption[]> {
  return fakeListListingChannels(ctx);
}

// PUT /api/tenant/trade/v1/items/:id/image (multipart "file", If-Match = version)
export async function putItemImage(
  itemId: string,
  version: number,
  file: File,
  key: string,
): Promise<ItemImageReceipt> {
  return fakePutItemImage(itemId, version, file, key);
}

// DELETE /api/tenant/trade/v1/items/:id/image (If-Match = version)
export async function deleteItemImage(itemId: string, version: number, key: string): Promise<ItemImageRemoved> {
  return fakeDeleteItemImage(itemId, version, key);
}

// GET /api/tenant/trade/v1/items/reference-data
export async function getReferenceData(ctx: TradeContext, search?: string): Promise<ItemReferenceData> {
  return fakeGetReferenceData(ctx, search);
}

// Inventory fulfillment node options (fake until inventory service ships)
export async function listFulfillmentNodeOptions(ctx: TradeContext): Promise<FulfillmentNodeOption[]> {
  return fakeListFulfillmentNodeOptions(ctx);
}

export function itemErrorKey(e: unknown): string {
  if (errorCodeOf(e)) {
    return errorKey(e);
  }
  return 'tradeShared.errors.generic';
}
