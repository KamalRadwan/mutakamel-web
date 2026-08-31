import type { TradePath } from "@/lib/api/envelope";
import {
  isJsonObject,
  isLocalizedNames,
  isNonEmptyString,
  isNullableUuidV7,
  isRowVersion,
  isTimestamp,
  isUuidV7,
  hasValidLocaleKeys,
  parseTradePage,
  record,
  type TradePage,
} from "../trade-validation";

// docs/api/trade-foundation.md#items--12-routes, verified against
// trade-app/src/modules/catalog/catalog.controller.ts, catalog.service.ts,
// catalog.repository.ts and dto/catalog.dto.ts.
//
// Three permissions and three scopes on one entity: creating the item is
// `trade.catalog_master.manage` at TENANT, its company profile is
// `trade.items.manage` at COMPANY, its branch profile is the same permission at
// BRANCH. A user can legitimately hold one and not the others, so the screens
// degrade step by step rather than gating as a whole.

export const ITEMS_PATH = "/api/tenant/trade/v1/items";
export const ITEM_PAGE_SIZE = 25;

export const ITEM_CODE_MAX_LENGTH = 80;

/**
 * `CODE_PATTERN` in `trade-app/packages/common/src/helpers/validation.ts`.
 *
 * `CreateItemDto.canonicalCode` is only `@IsString() @MinLength(1)
 * @MaxLength(80)`; `CatalogService.create` then calls `normalizeTradeCode`,
 * which throws a bare `TypeError` — a **500**, not a validation error — for
 * anything outside this pattern. Enforced here for that reason. Q72.
 */
const TRADE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u;

export const ITEM_KINDS = ["PRODUCT", "SERVICE"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE", "DISCONTINUED"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ITEM_NOT_FOUND_CODE = "TRADE.CATALOG.ITEM_NOT_FOUND";
export const ITEM_CODE_TAKEN_CODE = "TRADE.CATALOG.CODE_TAKEN";
export const ITEM_IDENTITY_INVALID_CODE = "TRADE.CATALOG.ITEM_IDENTITY_INVALID";
export const ITEM_UOM_INVALID_CODE = "TRADE.CATALOG.UOM_INVALID";

/** The company-scope projection the list adds when a company header is sent. */
interface ItemEligibility {
  companyProfileId: string;
  companyProfileVersion: number;
  companyProfileStatus: string;
  canSell: boolean;
  canPurchase: boolean;
  baseUomId: string;
  defaultSalesUomId: string;
  defaultPurchaseUomId: string;
  branchProfileId: string | null;
  branchProfileVersion: number | null;
  isAssorted: boolean | null;
}

export interface Item {
  id: string;
  canonicalCode: string;
  itemKind: string;
  baseUomId: string;
  localizedNames: Record<string, string>;
  categoryId: string | null;
  variantIdentity: Record<string, unknown> | null;
  status: string;
  version: number;
  updatedAt: string;
  eligibility: ItemEligibility | null;
}

export interface ItemFormValues {
  canonicalCode: string;
  itemKind: ItemKind;
  nameAr: string;
  nameEn: string;
  baseUomId: string;
  categoryId: string;
  variantIdentity: string;
  status: ItemStatus;
}

export const EMPTY_ITEM_FORM: ItemFormValues = {
  canonicalCode: "",
  itemKind: "PRODUCT",
  nameAr: "",
  nameEn: "",
  baseUomId: "",
  categoryId: "",
  variantIdentity: "",
  status: "DRAFT",
};

export function toItemForm(item: Item): ItemFormValues {
  return {
    canonicalCode: item.canonicalCode,
    itemKind: isItemKind(item.itemKind) ? item.itemKind : "PRODUCT",
    nameAr: item.localizedNames.ar ?? "",
    nameEn: item.localizedNames.en ?? "",
    baseUomId: item.baseUomId,
    categoryId: item.categoryId ?? "",
    variantIdentity: item.variantIdentity ? JSON.stringify(item.variantIdentity, null, 2) : "",
    status: isItemStatus(item.status) ? item.status : "DRAFT",
  };
}

export function isItemKind(value: unknown): value is ItemKind {
  return typeof value === "string" && (ITEM_KINDS as readonly string[]).includes(value);
}

export function isItemStatus(value: unknown): value is ItemStatus {
  return typeof value === "string" && (ITEM_STATUSES as readonly string[]).includes(value);
}

export function itemPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidResponse();
  return `${ITEMS_PATH}/${encodeURIComponent(id)}` as TradePath;
}

export const ITEMS_SEARCH_PATH = `${ITEMS_PATH}/search` as TradePath;

export function itemsListPath(page: number, itemKind?: ItemKind, status?: ItemStatus): TradePath {
  const query = new URLSearchParams({ page: String(page), limit: String(ITEM_PAGE_SIZE) });
  if (itemKind) query.set("itemKind", itemKind);
  if (status) query.set("status", status);
  return `${ITEMS_PATH}?${query.toString()}` as TradePath;
}

/** `CreateItemDto`. `extensionValues` is not offered — it needs a published profile. */
export interface CreateItemRequest {
  canonicalCode: string;
  itemKind: ItemKind;
  localizedNames: Record<string, string>;
  baseUomId: string;
  categoryId?: string;
  variantIdentity?: Record<string, unknown>;
}

/** `UpdateItemDto` — no code, kind or base UOM; those are fixed at creation. */
export interface UpdateItemRequest {
  localizedNames?: Record<string, string>;
  categoryId?: string | null;
  variantIdentity?: Record<string, unknown> | null;
  status?: ItemStatus;
}

/**
 * `CatalogSearchDto` — `CatalogListQueryDto` plus up to 50 `{ field, value }`
 * filters, where `field` is exactly `canonicalCode`, `status` or `itemKind`.
 * Every filter is an **equality** match; there is no partial search anywhere
 * on this route.
 */
export interface ItemSearchRequest {
  page: number;
  limit: number;
  filters: Array<{ field: "canonicalCode" | "status" | "itemKind"; value: string }>;
}

export function buildItemSearchRequest(
  page: number,
  code: string,
  itemKind?: ItemKind,
  status?: ItemStatus,
): ItemSearchRequest {
  const filters: ItemSearchRequest["filters"] = [];
  const trimmed = code.trim().toUpperCase();
  if (trimmed) filters.push({ field: "canonicalCode", value: trimmed });
  if (itemKind) filters.push({ field: "itemKind", value: itemKind });
  if (status) filters.push({ field: "status", value: status });
  return { page, limit: ITEM_PAGE_SIZE, filters };
}

function buildLocalizedNames(
  values: ItemFormValues,
  current?: Record<string, string>,
): Record<string, string> {
  const names: Record<string, string> = { ...(current ?? {}) };
  const arabic = values.nameAr.trim();
  const english = values.nameEn.trim();
  if (arabic) names.ar = arabic;
  else delete names.ar;
  if (english) names.en = english;
  else delete names.en;
  if (!hasValidLocaleKeys(names)) throw new Error("ITEM_FORM_NAMES");
  return names;
}

function parseVariantIdentity(raw: string): Record<string, unknown> | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    const asRecord = record(parsed);
    if (!asRecord) throw new Error("ITEM_FORM_VARIANT");
    return asRecord;
  } catch {
    throw new Error("ITEM_FORM_VARIANT");
  }
}

export function buildCreateItemRequest(values: ItemFormValues): CreateItemRequest {
  const canonicalCode = values.canonicalCode.trim().toUpperCase();
  if (!TRADE_CODE_PATTERN.test(canonicalCode)) throw new Error("ITEM_FORM_CODE");
  if (!isUuidV7(values.baseUomId.trim())) throw new Error("ITEM_FORM_UOM");

  const request: CreateItemRequest = {
    canonicalCode,
    itemKind: values.itemKind,
    localizedNames: buildLocalizedNames(values),
    baseUomId: values.baseUomId.trim(),
  };
  const categoryId = values.categoryId.trim();
  if (categoryId) {
    if (!isUuidV7(categoryId)) throw new Error("ITEM_FORM_UOM");
    request.categoryId = categoryId;
  }
  const variantIdentity = parseVariantIdentity(values.variantIdentity);
  if (variantIdentity) request.variantIdentity = variantIdentity;
  return request;
}

export function buildUpdateItemRequest(current: Item, values: ItemFormValues): UpdateItemRequest {
  const request: UpdateItemRequest = {};
  const names = buildLocalizedNames(values, current.localizedNames);
  if (JSON.stringify(names) !== JSON.stringify(current.localizedNames)) {
    request.localizedNames = names;
  }

  const categoryId = values.categoryId.trim();
  if (categoryId !== (current.categoryId ?? "")) {
    if (categoryId && !isUuidV7(categoryId)) throw new Error("ITEM_FORM_UOM");
    // `@IsOptional()` treats null as absent, so a cleared category is sent as
    // null deliberately — `UpdateItemDto.categoryId` is typed `string | null`
    // and the service assigns whatever is not `undefined`.
    request.categoryId = categoryId || null;
  }

  const variantIdentity = parseVariantIdentity(values.variantIdentity) ?? null;
  if (JSON.stringify(variantIdentity) !== JSON.stringify(current.variantIdentity ?? null)) {
    request.variantIdentity = variantIdentity;
  }

  if (values.status !== current.status) request.status = values.status;
  return request;
}

function parseEligibility(value: unknown): ItemEligibility | null {
  const eligibility = record(value);
  if (
    !eligibility ||
    !isUuidV7(eligibility.companyProfileId) ||
    !isRowVersion(eligibility.companyProfileVersion) ||
    typeof eligibility.companyProfileStatus !== "string" ||
    typeof eligibility.canSell !== "boolean" ||
    typeof eligibility.canPurchase !== "boolean" ||
    !isUuidV7(eligibility.baseUomId) ||
    !isUuidV7(eligibility.defaultSalesUomId) ||
    !isUuidV7(eligibility.defaultPurchaseUomId)
  ) {
    return null;
  }
  return {
    companyProfileId: eligibility.companyProfileId,
    companyProfileVersion: eligibility.companyProfileVersion,
    companyProfileStatus: eligibility.companyProfileStatus,
    canSell: eligibility.canSell,
    canPurchase: eligibility.canPurchase,
    baseUomId: eligibility.baseUomId,
    defaultSalesUomId: eligibility.defaultSalesUomId,
    defaultPurchaseUomId: eligibility.defaultPurchaseUomId,
    branchProfileId: isUuidV7(eligibility.branchProfileId) ? eligibility.branchProfileId : null,
    branchProfileVersion: isRowVersion(eligibility.branchProfileVersion)
      ? eligibility.branchProfileVersion
      : null,
    isAssorted: typeof eligibility.isAssorted === "boolean" ? eligibility.isAssorted : null,
  };
}

export function parseItemResponse(payload: unknown): Item {
  const item = record(payload);
  if (
    !item ||
    !isUuidV7(item.id) ||
    !isNonEmptyString(item.canonicalCode, ITEM_CODE_MAX_LENGTH) ||
    !isNonEmptyString(item.itemKind, 16) ||
    !isUuidV7(item.baseUomId) ||
    !isLocalizedNames(item.localizedNames) ||
    !isNullableUuidV7(item.categoryId) ||
    !isNonEmptyString(item.status, 20) ||
    !isRowVersion(item.version) ||
    !isTimestamp(item.updatedAt) ||
    !(item.variantIdentity == null || isJsonObject(item.variantIdentity))
  ) {
    invalidResponse();
  }
  return {
    id: item.id,
    canonicalCode: item.canonicalCode,
    itemKind: item.itemKind,
    baseUomId: item.baseUomId,
    localizedNames: item.localizedNames,
    categoryId: (item.categoryId as string | null | undefined) ?? null,
    variantIdentity: (item.variantIdentity as Record<string, unknown> | null | undefined) ?? null,
    status: item.status,
    version: item.version,
    updatedAt: item.updatedAt,
    eligibility: parseEligibility(item.eligibility),
  };
}

export function parseItemsResponse(payload: unknown): TradePage<Item> {
  return parseTradePage(payload, parseItemResponse, invalidResponse);
}

function invalidResponse(): never {
  throw new Error("Invalid Trade items response.");
}
