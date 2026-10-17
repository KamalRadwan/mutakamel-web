import type { TradePath } from "@/lib/api/envelope";
import { categoryAssignment, parseItemCategorySummary, type CategoryIntent, type ItemCategorySummary } from "../categories/category-contract";
import {
  formatTradeDecimal,
  isJsonObject,
  isLocalizedNames,
  isNonEmptyString,
  isNullableUuidV7,
  isRowVersion,
  isTimestamp,
  isTradeDecimalString,
  isUuidV7,
  parseTradePage,
  record,
  type TradePage,
} from "../trade-validation";
import { parseItemImageSummary, type ItemImageSummary } from "./item-image-contract";

export { formatTradeDecimal };

// docs/api/trade-foundation.md#items--15-routes, verified against
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
export const ITEM_LOCALIZED_NAME_MAX_LENGTH = 200;

/**
 * `CODE_PATTERN` in `trade-app/packages/common/src/helpers/validation.ts`.
 *
 * `CreateItemDto.canonicalCode` is only `@IsString() @MinLength(1)
 * @MaxLength(80)`; `CatalogService.create` then calls `normalizeTradeCode`,
 * which throws a bare `TypeError` — a **500**, not a validation error — for
 * anything outside this pattern. Enforced here for that reason. Q72.
 */
const TRADE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u;
const ITEM_LOCALE_KEY_PATTERN = /^[a-z]{2}(?:-[A-Z]{2})?$/u;
const ITEM_DECIMAL_PATTERN = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/u;

export const ITEM_KINDS = ["PRODUCT", "SERVICE", "COMBO"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_BARCODE_MAX_LENGTH = 128;
export const ITEM_NOTES_MAX_LENGTH = 4_000;
export const ITEM_DESCRIPTION_MAX_LENGTH = 500;
export const ITEM_RELATIONS_MAX = 500;

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
  canPos: boolean;
  baseUomId: string;
  defaultSalesUomId: string;
  defaultPurchaseUomId: string;
  branchProfileId: string | null;
  branchProfileVersion: number | null;
  isAssorted: boolean | null;
}

interface ItemComboComponent {
  componentItemId: string;
  quantity: string;
  sortOrder: number;
}

interface ItemOptionalProduct {
  optionalProductItemId: string;
  sortOrder: number;
}

export interface Item {
  id: string;
  canonicalCode: string;
  itemKind: string;
  baseUomId: string;
  localizedNames: Record<string, string>;
  categoryId: string | null;
  categorySummary: ItemCategorySummary | null;
  variantIdentity: Record<string, unknown> | null;
  barcode: string | null;
  notes: string | null;
  ownerUserId: string | null;
  weightKg: string | null;
  volumeM3: string | null;
  quotationDescription: string | null;
  salesOrderDescription: string | null;
  receiptDescription: string | null;
  deliveryOrderDescription: string | null;
  comboComponents: ItemComboComponent[];
  optionalProducts: ItemOptionalProduct[];
  status: string;
  version: number;
  updatedAt: string;
  eligibility: ItemEligibility | null;
  /** The current image (LLD 02b §5); absent on create and update receipts. */
  image: ItemImageSummary | null;
}

export interface ComboComponentFormValue {
  key: string;
  itemId: string;
  quantity: string;
}

export interface OptionalProductFormValue {
  key: string;
  itemId: string;
}

export interface ItemFormValues {
  canonicalCode: string;
  itemKind: ItemKind;
  nameAr: string;
  nameEn: string;
  baseUomId: string;
  category: CategoryIntent;
  variantIdentity: string;
  barcode: string;
  notes: string;
  ownerUserId: string;
  weightKg: string;
  volumeM3: string;
  quotationDescription: string;
  salesOrderDescription: string;
  receiptDescription: string;
  deliveryOrderDescription: string;
  comboComponents: ComboComponentFormValue[];
  optionalProducts: OptionalProductFormValue[];
  status: ItemStatus;
}

export interface CreateItemFormIssues {
  canonicalCode?: "ITEM_FORM_CODE";
  localizedNames?: "ITEM_FORM_NAMES";
  baseUomId?: "ITEM_FORM_UOM";
  categoryId?: "ITEM_FORM_CATEGORY";
  variantIdentity?: "ITEM_FORM_VARIANT";
  barcode?: "ITEM_FORM_BARCODE";
  notes?: "ITEM_FORM_NOTES";
  ownerUserId?: "ITEM_FORM_OWNER";
  weightKg?: "ITEM_FORM_DECIMAL";
  volumeM3?: "ITEM_FORM_DECIMAL";
  descriptions?: "ITEM_FORM_DESCRIPTION";
  comboComponents?: "ITEM_FORM_COMBO";
  optionalProducts?: "ITEM_FORM_OPTIONAL_PRODUCTS";
}

export const EMPTY_ITEM_FORM: ItemFormValues = {
  canonicalCode: "",
  itemKind: "PRODUCT",
  nameAr: "",
  nameEn: "",
  baseUomId: "",
  category: { kind: "unresolved" },
  variantIdentity: "",
  barcode: "",
  notes: "",
  ownerUserId: "",
  weightKg: "",
  volumeM3: "",
  quotationDescription: "",
  salesOrderDescription: "",
  receiptDescription: "",
  deliveryOrderDescription: "",
  comboComponents: [],
  optionalProducts: [],
  status: "DRAFT",
};

export function toItemForm(item: Item): ItemFormValues {
  return {
    canonicalCode: item.canonicalCode,
    itemKind: isItemKind(item.itemKind) ? item.itemKind : "PRODUCT",
    nameAr: item.localizedNames.ar ?? "",
    nameEn: item.localizedNames.en ?? "",
    baseUomId: item.baseUomId,
    category: item.categoryId ? { kind: "selected", id: item.categoryId } : { kind: "none" },
    variantIdentity: item.variantIdentity ? JSON.stringify(item.variantIdentity, null, 2) : "",
    barcode: item.barcode ?? "",
    notes: item.notes ?? "",
    ownerUserId: item.ownerUserId ?? "",
    weightKg: item.weightKg ? formatTradeDecimal(item.weightKg) : "",
    volumeM3: item.volumeM3 ? formatTradeDecimal(item.volumeM3) : "",
    quotationDescription: item.quotationDescription ?? "",
    salesOrderDescription: item.salesOrderDescription ?? "",
    receiptDescription: item.receiptDescription ?? "",
    deliveryOrderDescription: item.deliveryOrderDescription ?? "",
    comboComponents: item.comboComponents.map((component) => ({
      key: `combo-${component.sortOrder}-${component.componentItemId}`,
      itemId: component.componentItemId,
      quantity: formatTradeDecimal(component.quantity),
    })),
    optionalProducts: item.optionalProducts.map((product) => ({
      key: `optional-${product.sortOrder}-${product.optionalProductItemId}`,
      itemId: product.optionalProductItemId,
    })),
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
  categoryId?: string | null;
  variantIdentity?: Record<string, unknown>;
  barcode: string | null;
  notes: string | null;
  ownerUserId: string | null;
  weightKg: string | null;
  volumeM3: string | null;
  quotationDescription: string | null;
  salesOrderDescription: string | null;
  receiptDescription: string | null;
  deliveryOrderDescription: string | null;
  comboComponents?: ItemComboComponent[];
  optionalProducts: ItemOptionalProduct[];
}

/** Values persisted in Trade `numeric(24,8)` columns. */
export function isItemDecimalString(value: unknown): value is string {
  return typeof value === "string" && ITEM_DECIMAL_PATTERN.test(value);
}

/** `UpdateItemDto` — no code, kind or base UOM; those are fixed at creation. */
export interface UpdateItemRequest {
  localizedNames?: Record<string, string>;
  categoryId?: string | null;
  variantIdentity?: Record<string, unknown> | null;
  status?: ItemStatus;
  barcode?: string | null;
  notes?: string | null;
  ownerUserId?: string | null;
  weightKg?: string | null;
  volumeM3?: string | null;
  quotationDescription?: string | null;
  salesOrderDescription?: string | null;
  receiptDescription?: string | null;
  deliveryOrderDescription?: string | null;
  comboComponents?: ItemComboComponent[];
  optionalProducts?: ItemOptionalProduct[];
}

/**
 * `CatalogSearchDto` supports one free-text term across localized names, code
 * and barcode. Structured filters remain equality-only and are deliberately
 * kept separate from that term.
 */
export interface ItemSearchRequest {
  page: number;
  limit: number;
  itemKind?: ItemKind;
  status?: ItemStatus;
  search?: string;
  filters: Array<{ field: "canonicalCode" | "barcode" | "status" | "itemKind"; value: string }>;
}

export interface ItemReferenceSearchRequest {
  page: 1;
  limit: typeof ITEM_PAGE_SIZE;
  itemKind: "PRODUCT";
  status: "ACTIVE";
  search: string;
  filters: [];
}

export function buildItemReferenceSearchRequest(search: string): ItemReferenceSearchRequest {
  return {
    page: 1,
    limit: ITEM_PAGE_SIZE,
    itemKind: "PRODUCT",
    status: "ACTIVE",
    search: search.trim().slice(0, 160),
    filters: [],
  };
}

export function buildItemSearchRequest(
  page: number,
  search: string,
  itemKind?: ItemKind,
  status?: ItemStatus,
): ItemSearchRequest {
  const trimmed = search.trim().slice(0, 160);
  return {
    page,
    limit: ITEM_PAGE_SIZE,
    ...(itemKind ? { itemKind } : {}),
    ...(status ? { status } : {}),
    ...(trimmed ? { search: trimmed } : {}),
    filters: [],
  };
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
  const entries = Object.entries(names);
  if (
    entries.length === 0 ||
    entries.length > 20 ||
    entries.some(
      ([locale, name]) =>
        !ITEM_LOCALE_KEY_PATTERN.test(locale) ||
        !name.trim() ||
        name.trim().length > ITEM_LOCALIZED_NAME_MAX_LENGTH,
    )
  ) {
    throw new Error("ITEM_FORM_NAMES");
  }
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

function nullableText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed || null;
}

function isPositiveDecimal(value: string): boolean {
  return isItemDecimalString(value) && /[1-9]/u.test(value);
}

function relationIdsAreValid(ids: string[], selfId?: string): boolean {
  return (
    ids.length <= ITEM_RELATIONS_MAX &&
    ids.every((id) => isUuidV7(id) && id !== selfId) &&
    new Set(ids).size === ids.length
  );
}

function buildComboComponents(values: ItemFormValues): ItemComboComponent[] | undefined {
  if (values.itemKind !== "COMBO") return undefined;
  return values.comboComponents.map((component, sortOrder) => ({
    componentItemId: component.itemId.trim(),
    quantity: component.quantity.trim(),
    sortOrder,
  }));
}

function buildOptionalProducts(values: ItemFormValues): ItemOptionalProduct[] {
  return values.optionalProducts.map((product, sortOrder) => ({
    optionalProductItemId: product.itemId.trim(),
    sortOrder,
  }));
}

function validateExtendedFields(
  values: ItemFormValues,
  issues: CreateItemFormIssues,
  selfId?: string,
): void {
  if (values.barcode.trim().length > ITEM_BARCODE_MAX_LENGTH) issues.barcode = "ITEM_FORM_BARCODE";
  if (values.notes.trim().length > ITEM_NOTES_MAX_LENGTH) issues.notes = "ITEM_FORM_NOTES";
  const ownerUserId = values.ownerUserId.trim();
  if (ownerUserId && !isUuidV7(ownerUserId)) issues.ownerUserId = "ITEM_FORM_OWNER";

  const weightKg = values.weightKg.trim();
  if (weightKg && !isPositiveDecimal(weightKg)) issues.weightKg = "ITEM_FORM_DECIMAL";
  const volumeM3 = values.volumeM3.trim();
  if (volumeM3 && !isPositiveDecimal(volumeM3)) issues.volumeM3 = "ITEM_FORM_DECIMAL";

  const descriptions = [
    values.quotationDescription,
    values.salesOrderDescription,
    values.receiptDescription,
    values.deliveryOrderDescription,
  ];
  if (descriptions.some((description) => description.trim().length > ITEM_DESCRIPTION_MAX_LENGTH)) {
    issues.descriptions = "ITEM_FORM_DESCRIPTION";
  }

  const combo = buildComboComponents(values) ?? [];
  if (
    (values.itemKind === "COMBO" && combo.length === 0) ||
    !relationIdsAreValid(combo.map((component) => component.componentItemId), selfId) ||
    combo.some((component) => !isPositiveDecimal(component.quantity))
  ) {
    issues.comboComponents = "ITEM_FORM_COMBO";
  }

  const optional = buildOptionalProducts(values);
  if (!relationIdsAreValid(optional.map((product) => product.optionalProductItemId), selfId)) {
    issues.optionalProducts = "ITEM_FORM_OPTIONAL_PRODUCTS";
  }
}

export function validateCreateItemForm(values: ItemFormValues): CreateItemFormIssues {
  const issues: CreateItemFormIssues = {};
  const canonicalCode = values.canonicalCode.trim().toUpperCase();
  if (!TRADE_CODE_PATTERN.test(canonicalCode)) issues.canonicalCode = "ITEM_FORM_CODE";
  if (!values.nameAr.trim() && !values.nameEn.trim()) issues.localizedNames = "ITEM_FORM_NAMES";
  if (!isUuidV7(values.baseUomId.trim())) issues.baseUomId = "ITEM_FORM_UOM";

  try { categoryAssignment(values.category); } catch { issues.categoryId = "ITEM_FORM_CATEGORY"; }

  try {
    parseVariantIdentity(values.variantIdentity);
  } catch {
    issues.variantIdentity = "ITEM_FORM_VARIANT";
  }
  validateExtendedFields(values, issues);
  return issues;
}

export function buildCreateItemRequest(values: ItemFormValues): CreateItemRequest {
  const issues = validateCreateItemForm(values);
  const firstIssue = Object.values(issues)[0];
  if (firstIssue) throw new Error(firstIssue);

  const canonicalCode = values.canonicalCode.trim().toUpperCase();

  const request: CreateItemRequest = {
    canonicalCode,
    itemKind: values.itemKind,
    localizedNames: buildLocalizedNames(values),
    baseUomId: values.baseUomId.trim(),
    barcode: nullableText(values.barcode),
    notes: nullableText(values.notes),
    ownerUserId: nullableText(values.ownerUserId),
    weightKg: nullableText(values.weightKg),
    volumeM3: nullableText(values.volumeM3),
    quotationDescription: nullableText(values.quotationDescription),
    salesOrderDescription: nullableText(values.salesOrderDescription),
    receiptDescription: nullableText(values.receiptDescription),
    deliveryOrderDescription: nullableText(values.deliveryOrderDescription),
    optionalProducts: buildOptionalProducts(values),
  };
  const comboComponents = buildComboComponents(values);
  if (comboComponents) request.comboComponents = comboComponents;
  Object.assign(request, categoryAssignment(values.category));
  const variantIdentity = parseVariantIdentity(values.variantIdentity);
  if (variantIdentity) request.variantIdentity = variantIdentity;
  return request;
}

export function buildUpdateItemRequest(current: Item, values: ItemFormValues): UpdateItemRequest {
  const issues: CreateItemFormIssues = {};
  validateExtendedFields(values, issues, current.id);
  const firstIssue = Object.values(issues)[0];
  if (firstIssue) throw new Error(firstIssue);

  const request: UpdateItemRequest = {};
  const names = buildLocalizedNames(values, current.localizedNames);
  if (JSON.stringify(names) !== JSON.stringify(current.localizedNames)) {
    request.localizedNames = names;
  }

  try { Object.assign(request, categoryAssignment(values.category, current.categoryId)); }
  catch { throw new Error("ITEM_FORM_CATEGORY"); }

  const variantIdentity = parseVariantIdentity(values.variantIdentity) ?? null;
  if (JSON.stringify(variantIdentity) !== JSON.stringify(current.variantIdentity ?? null)) {
    request.variantIdentity = variantIdentity;
  }

  if (values.status !== current.status) request.status = values.status;

  const scalarFields = [
    ["barcode", nullableText(values.barcode), current.barcode],
    ["notes", nullableText(values.notes), current.notes],
    ["ownerUserId", nullableText(values.ownerUserId), current.ownerUserId],
    [
      "weightKg",
      values.weightKg.trim() ? formatTradeDecimal(values.weightKg) : null,
      current.weightKg ? formatTradeDecimal(current.weightKg) : null,
    ],
    [
      "volumeM3",
      values.volumeM3.trim() ? formatTradeDecimal(values.volumeM3) : null,
      current.volumeM3 ? formatTradeDecimal(current.volumeM3) : null,
    ],
    ["quotationDescription", nullableText(values.quotationDescription), current.quotationDescription],
    ["salesOrderDescription", nullableText(values.salesOrderDescription), current.salesOrderDescription],
    ["receiptDescription", nullableText(values.receiptDescription), current.receiptDescription],
    ["deliveryOrderDescription", nullableText(values.deliveryOrderDescription), current.deliveryOrderDescription],
  ] as const;
  for (const [field, next, previous] of scalarFields) {
    if (next !== previous) request[field] = next;
  }

  const comboComponents = buildComboComponents(values)?.map((component) => ({
    ...component,
    quantity: formatTradeDecimal(component.quantity),
  }));
  const currentComboOrder = current.comboComponents.map((component, sortOrder) => ({
    componentItemId: component.componentItemId,
    quantity: formatTradeDecimal(component.quantity),
    sortOrder,
  }));
  if (comboComponents && JSON.stringify(comboComponents) !== JSON.stringify(currentComboOrder)) {
    request.comboComponents = comboComponents;
  }
  const optionalProducts = buildOptionalProducts(values);
  const currentOptionalOrder = current.optionalProducts.map((product, sortOrder) => ({
    optionalProductItemId: product.optionalProductItemId,
    sortOrder,
  }));
  if (JSON.stringify(optionalProducts) !== JSON.stringify(currentOptionalOrder)) {
    request.optionalProducts = optionalProducts;
  }
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
    typeof eligibility.canPos !== "boolean" ||
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
    canPos: eligibility.canPos,
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

function isNullableBoundedText(value: unknown, maxLength: number): value is string | null {
  return value === null || (typeof value === "string" && value.length <= maxLength);
}

function parseComboComponents(value: unknown): ItemComboComponent[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > ITEM_RELATIONS_MAX) invalidResponse();
  const components = value.map((candidate) => {
    const component = record(candidate);
    if (
      !component ||
      !isUuidV7(component.componentItemId) ||
      !isTradeDecimalString(component.quantity) ||
      !isPositiveDecimal(component.quantity) ||
      typeof component.sortOrder !== "number" ||
      !Number.isSafeInteger(component.sortOrder) ||
      component.sortOrder < 0
    ) {
      invalidResponse();
    }
    return {
      componentItemId: component.componentItemId,
      quantity: component.quantity,
      sortOrder: component.sortOrder,
    };
  });
  if (new Set(components.map((component) => component.componentItemId)).size !== components.length) {
    invalidResponse();
  }
  return components.sort((left, right) => left.sortOrder - right.sortOrder);
}

function parseOptionalProducts(value: unknown): ItemOptionalProduct[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > ITEM_RELATIONS_MAX) invalidResponse();
  const products = value.map((candidate) => {
    const product = record(candidate);
    if (
      !product ||
      !isUuidV7(product.optionalProductItemId) ||
      typeof product.sortOrder !== "number" ||
      !Number.isSafeInteger(product.sortOrder) ||
      product.sortOrder < 0
    ) {
      invalidResponse();
    }
    return { optionalProductItemId: product.optionalProductItemId, sortOrder: product.sortOrder };
  });
  if (new Set(products.map((product) => product.optionalProductItemId)).size !== products.length) {
    invalidResponse();
  }
  return products.sort((left, right) => left.sortOrder - right.sortOrder);
}

export function parseItemResponse(payload: unknown): Item {
  const item = record(payload);
  if (
    !item ||
    !isUuidV7(item.id) ||
    !isNonEmptyString(item.canonicalCode, ITEM_CODE_MAX_LENGTH) ||
    !isItemKind(item.itemKind) ||
    !isUuidV7(item.baseUomId) ||
    !isLocalizedNames(item.localizedNames) ||
    !isNullableUuidV7(item.categoryId) ||
    !isItemStatus(item.status) ||
    !isRowVersion(item.version) ||
    !isTimestamp(item.updatedAt) ||
    !(item.variantIdentity == null || isJsonObject(item.variantIdentity)) ||
    !isNullableBoundedText(item.barcode, ITEM_BARCODE_MAX_LENGTH) ||
    !isNullableBoundedText(item.notes, ITEM_NOTES_MAX_LENGTH) ||
    !isNullableUuidV7(item.ownerUserId) ||
    !(item.weightKg === null || (typeof item.weightKg === "string" && isPositiveDecimal(item.weightKg))) ||
    !(item.volumeM3 === null || (typeof item.volumeM3 === "string" && isPositiveDecimal(item.volumeM3))) ||
    !isNullableBoundedText(item.quotationDescription, ITEM_DESCRIPTION_MAX_LENGTH) ||
    !isNullableBoundedText(item.salesOrderDescription, ITEM_DESCRIPTION_MAX_LENGTH) ||
    !isNullableBoundedText(item.receiptDescription, ITEM_DESCRIPTION_MAX_LENGTH) ||
    !isNullableBoundedText(item.deliveryOrderDescription, ITEM_DESCRIPTION_MAX_LENGTH)
  ) {
    invalidResponse();
  }
  const categorySummary = parseItemCategorySummary(item.categorySummary);
  if ((categorySummary?.id ?? null) !== (item.categoryId ?? null)) invalidResponse();
  return {
    id: item.id,
    canonicalCode: item.canonicalCode,
    itemKind: item.itemKind,
    baseUomId: item.baseUomId,
    localizedNames: item.localizedNames,
    categoryId: (item.categoryId as string | null | undefined) ?? null,
    categorySummary,
    variantIdentity: (item.variantIdentity as Record<string, unknown> | null | undefined) ?? null,
    barcode: item.barcode as string | null,
    notes: item.notes as string | null,
    ownerUserId: (item.ownerUserId as string | null | undefined) ?? null,
    weightKg: item.weightKg as string | null,
    volumeM3: item.volumeM3 as string | null,
    quotationDescription: item.quotationDescription as string | null,
    salesOrderDescription: item.salesOrderDescription as string | null,
    receiptDescription: item.receiptDescription as string | null,
    deliveryOrderDescription: item.deliveryOrderDescription as string | null,
    comboComponents: parseComboComponents(item.comboComponents),
    optionalProducts: parseOptionalProducts(item.optionalProducts),
    status: item.status,
    version: item.version,
    updatedAt: item.updatedAt,
    eligibility: parseEligibility(item.eligibility),
    image: parseItemImageSummary(item.image),
  };
}

/** A detail payload must carry both relation collections; list rows may omit them. */
export function parseItemDetailResponse(payload: unknown): Item {
  const item = record(payload);
  if (!item || !Array.isArray(item.comboComponents) || !Array.isArray(item.optionalProducts)) {
    invalidResponse();
  }
  return parseItemResponse(payload);
}

export function parseItemsResponse(payload: unknown): TradePage<Item> {
  return parseTradePage(payload, parseItemResponse, invalidResponse);
}

export interface VariantAttributeRow {
  id: string;
  name: string;
  value: string;
}

export function serializeVariantRows(rows: VariantAttributeRow[]): {
  json: string;
  invalid: boolean;
  count: number;
} {
  const identity: Record<string, string> = {};
  let invalid = false;
  for (const row of rows) {
    const name = row.name.trim();
    const value = row.value.trim();
    if (!name && !value) continue;
    if (!name || Object.hasOwn(identity, name)) {
      invalid = true;
      continue;
    }
    identity[name] = value;
  }
  const keysCount = Object.keys(identity).length;
  return {
    json: keysCount > 0 ? JSON.stringify(identity, null, 2) : "",
    invalid,
    count: keysCount,
  };
}

export function parseVariantIdentityToRows(
  raw: string,
  firstId = 1,
): { rows: VariantAttributeRow[]; nextRowId: number } {
  const trimmed = raw.trim();
  if (!trimmed) return { rows: [], nextRowId: firstId };
  try {
    const parsed: unknown = JSON.parse(trimmed);
    const asRecord = record(parsed);
    if (!asRecord) return { rows: [], nextRowId: firstId };
    const entries = Object.entries(asRecord);
    return {
      rows: entries.map(([name, value], index) => ({
        id: `attribute-${firstId + index}`,
        name,
        value:
          value === null || value === undefined
            ? ""
            : typeof value === "object"
              ? JSON.stringify(value)
              : String(value),
      })),
      nextRowId: firstId + entries.length,
    };
  } catch {
    return { rows: [], nextRowId: firstId };
  }
}

function invalidResponse(): never {
  throw new Error("Invalid Trade items response.");
}
