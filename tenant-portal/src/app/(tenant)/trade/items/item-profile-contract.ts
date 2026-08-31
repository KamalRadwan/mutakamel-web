import type { TradePath } from "@/lib/api/envelope";
import {
  isJsonObject,
  isNullableUuidV7,
  isRowVersion,
  isTimestamp,
  isUuidV7,
  parseTradePage,
  record,
  type TradePage,
} from "../trade-validation";
import { itemPath } from "./item-contract";

// The three sub-resources of an item, each at a different scope:
//
//   company-profile   `trade.items.manage` at COMPANY
//   branch-profile    `trade.items.manage` at BRANCH
//   channel-listings  `trade.items.manage` at COMPANY_OR_BRANCH
//
// **All three bodies are full upserts, even on PATCH.** Every optional field
// with a default is written as that default when omitted, so a PATCH that
// leaves `capabilitySet` out clears it to `[]`, one that leaves `restrictions`
// out clears it to `{}`, and one that sends only `saleConstraints` silently
// resets `publicationStatus` to `"DRAFT"`. The builders below therefore always
// send the complete object.

export const ITEM_TRACKING_MODES = ["NONE", "LOT", "SERIAL"] as const;
export type ItemTrackingMode = (typeof ITEM_TRACKING_MODES)[number];

export const COMPANY_PROFILE_EXISTS_CODE = "TRADE.CATALOG.COMPANY_PROFILE_ALREADY_EXISTS";
export const COMPANY_PROFILE_INVALID_CODE = "TRADE.CATALOG.COMPANY_PROFILE_INVALID";
export const CAPABILITY_INCOMPATIBLE_CODE = "TRADE.CATALOG.CAPABILITY_INCOMPATIBLE";
export const BRANCH_PROFILE_EXISTS_CODE = "TRADE.CATALOG.BRANCH_PROFILE_ALREADY_EXISTS";
export const BRANCH_MISMATCH_CODE = "TRADE.CATALOG.BRANCH_MISMATCH";
export const LISTING_EXISTS_CODE = "TRADE.CATALOG.CHANNEL_LISTING_ALREADY_EXISTS";
export const LISTING_INVALID_CODE = "TRADE.CATALOG.CHANNEL_LISTING_INVALID";

export const LISTING_PAGE_SIZE = 50;
export const PUBLICATION_STATUS_MAX_LENGTH = 32;
/** `ItemChannelListingDto.publicationStatus` default. The set is open — Q31. */
const DEFAULT_PUBLICATION_STATUS = "DRAFT";

export interface ItemCompanyProfile {
  id: string;
  canSell: boolean;
  canPurchase: boolean;
  trackInventory: boolean;
  trackingMode: string;
  taxClassificationKey: string | null;
  defaultSalesUomId: string | null;
  defaultPurchaseUomId: string | null;
  accountingMappingKey: string | null;
  capabilitySet: unknown[];
  status: string;
  version: number;
}

export interface ItemBranchProfile {
  id: string;
  branchId: string;
  isAssorted: boolean;
  defaultFulfillmentNodeId: string | null;
  replenishmentPolicyKey: string | null;
  restrictions: Record<string, unknown>;
  version: number;
}

export interface ItemChannelListing {
  id: string;
  channelId: string;
  branchId: string | null;
  publicationStatus: string;
  saleConstraints: Record<string, unknown>;
  version: number;
  updatedAt: string;
}

export interface CompanyProfileFormValues {
  canSell: boolean;
  canPurchase: boolean;
  trackInventory: boolean;
  trackingMode: ItemTrackingMode;
  taxClassificationKey: string;
  defaultSalesUomId: string;
  defaultPurchaseUomId: string;
  accountingMappingKey: string;
  capabilitySet: string;
}

export interface BranchProfileFormValues {
  isAssorted: boolean;
  defaultFulfillmentNodeId: string;
  replenishmentPolicyKey: string;
  restrictions: string;
}

export interface ListingFormValues {
  channelId: string;
  publicationStatus: string;
  saleConstraints: string;
}

export const EMPTY_COMPANY_PROFILE_FORM: CompanyProfileFormValues = {
  canSell: false,
  canPurchase: false,
  trackInventory: false,
  trackingMode: "NONE",
  taxClassificationKey: "",
  defaultSalesUomId: "",
  defaultPurchaseUomId: "",
  accountingMappingKey: "",
  capabilitySet: "",
};

export const EMPTY_BRANCH_PROFILE_FORM: BranchProfileFormValues = {
  isAssorted: true,
  defaultFulfillmentNodeId: "",
  replenishmentPolicyKey: "",
  restrictions: "",
};

export const EMPTY_LISTING_FORM: ListingFormValues = {
  channelId: "",
  publicationStatus: DEFAULT_PUBLICATION_STATUS,
  saleConstraints: "",
};

export function toCompanyProfileForm(profile: ItemCompanyProfile): CompanyProfileFormValues {
  return {
    canSell: profile.canSell,
    canPurchase: profile.canPurchase,
    trackInventory: profile.trackInventory,
    trackingMode: isTrackingMode(profile.trackingMode) ? profile.trackingMode : "NONE",
    taxClassificationKey: profile.taxClassificationKey ?? "",
    defaultSalesUomId: profile.defaultSalesUomId ?? "",
    defaultPurchaseUomId: profile.defaultPurchaseUomId ?? "",
    accountingMappingKey: profile.accountingMappingKey ?? "",
    capabilitySet: profile.capabilitySet.length ? JSON.stringify(profile.capabilitySet) : "",
  };
}

export function toBranchProfileForm(profile: ItemBranchProfile): BranchProfileFormValues {
  return {
    isAssorted: profile.isAssorted,
    defaultFulfillmentNodeId: profile.defaultFulfillmentNodeId ?? "",
    replenishmentPolicyKey: profile.replenishmentPolicyKey ?? "",
    restrictions: Object.keys(profile.restrictions).length
      ? JSON.stringify(profile.restrictions, null, 2)
      : "",
  };
}

export function toListingForm(listing: ItemChannelListing): ListingFormValues {
  return {
    channelId: listing.channelId,
    publicationStatus: listing.publicationStatus,
    saleConstraints: Object.keys(listing.saleConstraints).length
      ? JSON.stringify(listing.saleConstraints, null, 2)
      : "",
  };
}

export function isTrackingMode(value: unknown): value is ItemTrackingMode {
  return typeof value === "string" && (ITEM_TRACKING_MODES as readonly string[]).includes(value);
}

export function companyProfilePath(itemId: string): TradePath {
  return `${itemPath(itemId)}/company-profile` as TradePath;
}

export function branchProfilePath(itemId: string): TradePath {
  return `${itemPath(itemId)}/branch-profile` as TradePath;
}

export function channelListingsPath(itemId: string, page: number): TradePath {
  const query = new URLSearchParams({ page: String(page), limit: String(LISTING_PAGE_SIZE) });
  return `${itemPath(itemId)}/channel-listings?${query.toString()}` as TradePath;
}

export function channelListingPath(itemId: string, channelId: string): TradePath {
  if (!isUuidV7(channelId)) invalidResponse();
  return `${itemPath(itemId)}/channel-listings/${encodeURIComponent(channelId)}` as TradePath;
}

function parseJsonObject(raw: string, failure: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed = record(JSON.parse(trimmed) as unknown);
    if (!parsed) throw new Error(failure);
    return parsed;
  } catch {
    throw new Error(failure);
  }
}

function parseJsonArray(raw: string, failure: string): unknown[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || parsed.length > 64) throw new Error(failure);
    return parsed;
  } catch {
    throw new Error(failure);
  }
}

/** `UpsertItemCompanyProfileDto` — always complete, never a partial patch. */
export function buildCompanyProfileRequest(values: CompanyProfileFormValues) {
  const optionalId = (raw: string): string | undefined => {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    if (!isUuidV7(trimmed)) throw new Error("PROFILE_FORM_UOM");
    return trimmed;
  };
  return {
    canSell: values.canSell,
    canPurchase: values.canPurchase,
    trackInventory: values.trackInventory,
    trackingMode: values.trackingMode,
    capabilitySet: parseJsonArray(values.capabilitySet, "PROFILE_FORM_CAPABILITY"),
    ...(values.taxClassificationKey.trim()
      ? { taxClassificationKey: values.taxClassificationKey.trim() }
      : {}),
    ...(values.accountingMappingKey.trim()
      ? { accountingMappingKey: values.accountingMappingKey.trim() }
      : {}),
    ...(optionalId(values.defaultSalesUomId)
      ? { defaultSalesUomId: optionalId(values.defaultSalesUomId) }
      : {}),
    ...(optionalId(values.defaultPurchaseUomId)
      ? { defaultPurchaseUomId: optionalId(values.defaultPurchaseUomId) }
      : {}),
  };
}

/** `UpsertItemBranchProfileDto` — same full-upsert rule. */
export function buildBranchProfileRequest(values: BranchProfileFormValues) {
  const node = values.defaultFulfillmentNodeId.trim();
  if (node && !isUuidV7(node)) throw new Error("PROFILE_FORM_NODE");
  return {
    isAssorted: values.isAssorted,
    restrictions: parseJsonObject(values.restrictions, "PROFILE_FORM_RESTRICTIONS"),
    ...(node ? { defaultFulfillmentNodeId: node } : {}),
    ...(values.replenishmentPolicyKey.trim()
      ? { replenishmentPolicyKey: values.replenishmentPolicyKey.trim() }
      : {}),
  };
}

/**
 * `ItemChannelListingDto` / `UpdateItemChannelListingDto`.
 *
 * Both fields are always sent. `publicationStatus` and `saleConstraints` are
 * `@IsOptional` **with defaults**, so a PATCH that omits either writes the
 * default over the stored value.
 */
export function buildListingRequest(values: ListingFormValues, includeChannel: boolean) {
  const channelId = values.channelId.trim();
  if (includeChannel && !isUuidV7(channelId)) throw new Error("LISTING_FORM_CHANNEL");
  const publicationStatus = values.publicationStatus.trim() || DEFAULT_PUBLICATION_STATUS;
  if (publicationStatus.length > PUBLICATION_STATUS_MAX_LENGTH) {
    throw new Error("LISTING_FORM_STATUS");
  }
  return {
    ...(includeChannel ? { channelId } : {}),
    publicationStatus,
    saleConstraints: parseJsonObject(values.saleConstraints, "LISTING_FORM_CONSTRAINTS"),
  };
}

export function parseCompanyProfileResponse(payload: unknown): ItemCompanyProfile {
  const profile = record(payload);
  if (
    !profile ||
    !isUuidV7(profile.id) ||
    typeof profile.canSell !== "boolean" ||
    typeof profile.canPurchase !== "boolean" ||
    typeof profile.trackInventory !== "boolean" ||
    typeof profile.trackingMode !== "string" ||
    !Array.isArray(profile.capabilitySet) ||
    typeof profile.status !== "string" ||
    !isRowVersion(profile.version) ||
    !isNullableUuidV7(profile.defaultSalesUomId) ||
    !isNullableUuidV7(profile.defaultPurchaseUomId)
  ) {
    invalidResponse();
  }
  return {
    id: profile.id,
    canSell: profile.canSell,
    canPurchase: profile.canPurchase,
    trackInventory: profile.trackInventory,
    trackingMode: profile.trackingMode,
    taxClassificationKey:
      typeof profile.taxClassificationKey === "string" ? profile.taxClassificationKey : null,
    defaultSalesUomId: (profile.defaultSalesUomId as string | null | undefined) ?? null,
    defaultPurchaseUomId: (profile.defaultPurchaseUomId as string | null | undefined) ?? null,
    accountingMappingKey:
      typeof profile.accountingMappingKey === "string" ? profile.accountingMappingKey : null,
    capabilitySet: profile.capabilitySet,
    status: profile.status,
    version: profile.version,
  };
}

export function parseBranchProfileResponse(payload: unknown): ItemBranchProfile {
  const profile = record(payload);
  if (
    !profile ||
    !isUuidV7(profile.id) ||
    !isUuidV7(profile.branchId) ||
    typeof profile.isAssorted !== "boolean" ||
    !isJsonObject(profile.restrictions) ||
    !isRowVersion(profile.version) ||
    !isNullableUuidV7(profile.defaultFulfillmentNodeId)
  ) {
    invalidResponse();
  }
  return {
    id: profile.id,
    branchId: profile.branchId,
    isAssorted: profile.isAssorted,
    defaultFulfillmentNodeId:
      (profile.defaultFulfillmentNodeId as string | null | undefined) ?? null,
    replenishmentPolicyKey:
      typeof profile.replenishmentPolicyKey === "string" ? profile.replenishmentPolicyKey : null,
    restrictions: profile.restrictions,
    version: profile.version,
  };
}

function parseListingResponse(payload: unknown): ItemChannelListing {
  const listing = record(payload);
  if (
    !listing ||
    !isUuidV7(listing.id) ||
    !isUuidV7(listing.channelId) ||
    !isNullableUuidV7(listing.branchId) ||
    typeof listing.publicationStatus !== "string" ||
    !isJsonObject(listing.saleConstraints) ||
    !isRowVersion(listing.version) ||
    !isTimestamp(listing.updatedAt)
  ) {
    invalidResponse();
  }
  return {
    id: listing.id,
    channelId: listing.channelId,
    branchId: (listing.branchId as string | null | undefined) ?? null,
    publicationStatus: listing.publicationStatus,
    saleConstraints: listing.saleConstraints,
    version: listing.version,
    updatedAt: listing.updatedAt,
  };
}

export function parseListingsResponse(payload: unknown): TradePage<ItemChannelListing> {
  return parseTradePage(payload, parseListingResponse, invalidResponse);
}

function invalidResponse(): never {
  throw new Error("Invalid Trade item profile response.");
}
