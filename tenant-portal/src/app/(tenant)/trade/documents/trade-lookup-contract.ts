import type { TradePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import { parseItemImageSummary, type ItemImageSummary } from "../items/item-image-contract";
import {
  TRADE_V1,
  isBoundedString,
  isTradeDecimal,
  isTradeStatus,
  isVersion,
  jsonObject,
  optionalUuid,
  parseTradeListPage,
  record,
  tradeInvalidResponse,
  type TradeListPage,
} from "./trade-document-contract";

// The three lookups a document line editor needs. None of them is one of this
// phase's 60 routes — a line carries `itemId`, `uomId` and (for a running
// total) a resolved `unitPrice`, and no commercial-document route supplies any
// of the three. All three are documented in trade-foundation.md and
// trade-advanced.md and exist in the Gateway contract.
//
// Each carries its **own** permission, which is not implied by the document
// permission that opened the screen:
//   /items        trade.items.read
//   /catalog/uoms trade.items.read
//   /pricing/evaluate  trade.pricing.read
// A user who may create a quotation and may not read the catalogue gets a 403
// from the picker rather than from the document. The line editor degrades to a
// named explanation instead of an empty dropdown.

const TRADE_ITEMS_PATH = `${TRADE_V1}/items`;
const TRADE_UOM_CATALOGUE_PATH = `${TRADE_V1}/catalog/uoms`;
export const TRADE_PRICING_EVALUATE_PATH = `${TRADE_V1}/pricing/evaluate` as TradePath;

/** `CatalogListQueryDto.limit` is capped at 100. Search remains server-side. */
const TRADE_LOOKUP_PAGE_SIZE = 100;
export const TRADE_ITEM_SEARCH_MAX_LENGTH = 160;

export const TRADE_LOOKUP_RESPONSE_BYTES = 400_000;

/** `PriceBookPurpose` — `SALES` for a customer document, `PURCHASE` for a supplier one. */
export type TradePricePurpose = "SALES" | "PURCHASE";

/** `ItemUsagePurpose`; POS is included for the shared catalogue contract. */
export type TradeItemPurpose = TradePricePurpose | "POS";

interface TradeItemEligibility {
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

export interface TradeItemOption {
  id: string;
  canonicalCode: string;
  barcode: string | null;
  localizedNames: Record<string, unknown>;
  quotationDescription: string | null;
  salesOrderDescription: string | null;
  receiptDescription: string | null;
  deliveryOrderDescription: string | null;
  status: string;
  /** Catalogue-owned presentation fields, never forwarded in document writes. */
  itemKind?: "PRODUCT" | "SERVICE" | "COMBO";
  image?: ItemImageSummary | null;
  eligibility: TradeItemEligibility;
}

export interface TradeUomOption {
  id: string;
  code: string;
  displayName: string;
  isBaseUom: boolean;
  canSell: boolean;
  canPurchase: boolean;
}

interface TradePriceMatchedPromotion {
  code: string;
  discountAmount: string;
}

/**
 * The pricing decision resolved via `POST /pricing/evaluate`.
 *
 * Only `unitPrice` feeds running totals; optional breakdown fields power the
 * read-only Governed Price Breakdown popover on commercial document lines and
 * are never forwarded as a `priceSnapshot`.
 */
export interface TradePriceDecision {
  unitPrice: string;
  currencyCode: string;
  priceBookId: string;
  minimumAllowedPrice: string | null;
  baselineUnitPrice?: string;
  priceBookVersion?: number;
  priceBookVersionId?: string;
  decisionId?: string;
  outcome?: string;
  matchedPromotions?: TradePriceMatchedPromotion[];
}

export function tradeItemsPath(
  page: number,
  purpose: TradeItemPurpose,
  search = "",
): TradePath {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(TRADE_LOOKUP_PAGE_SIZE),
    purpose,
  });
  const normalizedSearch = search.trim();
  if (normalizedSearch) query.set("search", normalizedSearch);
  return `${TRADE_ITEMS_PATH}?${query.toString()}` as TradePath;
}

export function tradeUomCataloguePath(itemId: string, purpose: TradePricePurpose): TradePath {
  if (!isUUIDv7(itemId)) tradeInvalidResponse();
  const query = new URLSearchParams({
    page: "1",
    limit: String(TRADE_LOOKUP_PAGE_SIZE),
    purpose,
    itemId,
  });
  return `${TRADE_UOM_CATALOGUE_PATH}?${query.toString()}` as TradePath;
}

export function parseTradeItems(
  payload: unknown,
  purpose: TradeItemPurpose,
): TradeListPage<TradeItemOption> {
  const page = parseTradeListPage(payload, (item): TradeItemOption => {
    const row = record(item);
    const eligibility = record(row?.eligibility);
    if (
      !row ||
      !isUUIDv7(row.id) ||
      !isBoundedString(row.canonicalCode, 80) ||
      !isTradeStatus(row.status) ||
      (row.itemKind !== undefined && row.itemKind !== "PRODUCT" && row.itemKind !== "SERVICE" && row.itemKind !== "COMBO") ||
      !eligibility ||
      !isUUIDv7(eligibility.companyProfileId) ||
      !isVersion(eligibility.companyProfileVersion) ||
      !isTradeStatus(eligibility.companyProfileStatus) ||
      typeof eligibility.canSell !== "boolean" ||
      typeof eligibility.canPurchase !== "boolean" ||
      typeof eligibility.canPos !== "boolean" ||
      !isUUIDv7(eligibility.baseUomId) ||
      !isUUIDv7(eligibility.defaultSalesUomId) ||
      !isUUIDv7(eligibility.defaultPurchaseUomId) ||
      !isOptionalVersion(eligibility.branchProfileVersion) ||
      !isOptionalBoolean(eligibility.isAssorted)
    ) {
      tradeInvalidResponse();
    }
    return {
      id: row.id,
      canonicalCode: row.canonicalCode,
      barcode: nullableBoundedString(row.barcode, 128),
      localizedNames: jsonObject(row.localizedNames),
      quotationDescription: nullableBoundedString(row.quotationDescription, 500),
      salesOrderDescription: nullableBoundedString(row.salesOrderDescription, 500),
      receiptDescription: nullableBoundedString(row.receiptDescription, 500),
      deliveryOrderDescription: nullableBoundedString(row.deliveryOrderDescription, 500),
      status: row.status,
      ...(row.itemKind === "PRODUCT" || row.itemKind === "SERVICE" || row.itemKind === "COMBO"
        ? { itemKind: row.itemKind } : {}),
      image: parseItemImageSummary(row.image),
      eligibility: {
        companyProfileId: eligibility.companyProfileId,
        companyProfileVersion: eligibility.companyProfileVersion,
        companyProfileStatus: eligibility.companyProfileStatus,
        canSell: eligibility.canSell,
        canPurchase: eligibility.canPurchase,
        canPos: eligibility.canPos,
        baseUomId: eligibility.baseUomId,
        defaultSalesUomId: eligibility.defaultSalesUomId,
        defaultPurchaseUomId: eligibility.defaultPurchaseUomId,
        branchProfileId: optionalUuid(eligibility.branchProfileId),
        branchProfileVersion: eligibility.branchProfileVersion ?? null,
        isAssorted: eligibility.isAssorted ?? null,
      },
    };
  });
  return {
    ...page,
    // The query already asks the server for purpose-eligible rows. This second
    // gate is intentional: a stale or regressed backend must not put an item
    // into a document type its company profile disallows.
    items: page.items.filter((item) => isItemEligibleForPurpose(item, purpose)),
  };
}

export function isItemEligibleForPurpose(
  item: TradeItemOption,
  purpose: TradeItemPurpose,
): boolean {
  if (item.status !== "ACTIVE" || item.eligibility.companyProfileStatus !== "ACTIVE") return false;
  if (
    item.eligibility.isAssorted !== true ||
    !item.eligibility.branchProfileId ||
    !item.eligibility.branchProfileVersion
  ) {
    return false;
  }
  if (purpose === "PURCHASE") return item.eligibility.canPurchase;
  if (purpose === "POS") return item.eligibility.canSell && item.eligibility.canPos;
  return item.eligibility.canSell;
}

export function parseTradeUoms(payload: unknown): TradeListPage<TradeUomOption> {
  return parseTradeListPage(payload, (item) => {
    const row = record(item);
    if (
      !row ||
      !isUUIDv7(row.id) ||
      !isBoundedString(row.code, 80) ||
      !isBoundedString(row.displayName, 160) ||
      typeof row.isBaseUom !== "boolean" ||
      typeof row.canSell !== "boolean" ||
      typeof row.canPurchase !== "boolean"
    ) {
      tradeInvalidResponse();
    }
    return {
      id: row.id,
      code: row.code,
      displayName: row.displayName,
      isBaseUom: row.isBaseUom,
      canSell: row.canSell,
      canPurchase: row.canPurchase,
    };
  });
}

export function parseTradePriceDecision(payload: unknown): TradePriceDecision {
  const decision = record(payload);
  if (
    !decision ||
    !isTradeDecimal(decision.unitPrice) ||
    !isBoundedString(decision.currencyCode, 3) ||
    !isUUIDv7(decision.priceBookId)
  ) {
    tradeInvalidResponse();
  }
  const matchedPromotions: TradePriceMatchedPromotion[] | undefined = Array.isArray(
    decision.matchedPromotions,
  )
    ? decision.matchedPromotions.flatMap((entry) => {
        const promo = record(entry);
        if (
          !promo ||
          !isBoundedString(promo.code, 80) ||
          !isTradeDecimal(promo.discountAmount)
        ) {
          return [];
        }
        return [{ code: promo.code, discountAmount: promo.discountAmount }];
      })
    : undefined;

  return {
    unitPrice: decision.unitPrice,
    currencyCode: decision.currencyCode,
    priceBookId: decision.priceBookId,
    minimumAllowedPrice: isTradeDecimal(decision.minimumAllowedPrice)
      ? decision.minimumAllowedPrice
      : null,
    ...(isTradeDecimal(decision.baselineUnitPrice)
      ? { baselineUnitPrice: decision.baselineUnitPrice }
      : {}),
    ...(isVersion(decision.priceBookVersion)
      ? { priceBookVersion: decision.priceBookVersion }
      : {}),
    ...(isUUIDv7(decision.priceBookVersionId)
      ? { priceBookVersionId: decision.priceBookVersionId }
      : {}),
    ...(isUUIDv7(decision.decisionId) ? { decisionId: decision.decisionId } : {}),
    ...(isTradeStatus(decision.outcome) ? { outcome: decision.outcome } : {}),
    ...(matchedPromotions !== undefined ? { matchedPromotions } : {}),
  };
}

/**
 * The item's display name.
 *
 * `localizedNames` is a free-form `jsonb` map with no guaranteed keys, so a
 * name is looked up by the active language, then by the other one, then by the
 * first key present, and only then falls back to the canonical code. A picker
 * that showed a bare UUID or an empty label would be unusable, and the code is
 * at least a real identifier a person can match against a catalogue.
 */
export function itemDisplayName(item: TradeItemOption, language: string): string {
  const candidates = [language, "en", "ar", ...Object.keys(item.localizedNames).sort()];
  for (const key of candidates) {
    const value = item.localizedNames[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return item.canonicalCode;
}

/**
 * The line's read-only description preview. Sales quotations use their
 * dedicated nullable catalogue copy; supplier quotations have no dedicated
 * item field and therefore use the same stable name fallback the server uses.
 * This value is never part of a line write payload.
 */
export function itemDescriptionPreview(
  item: TradeItemOption,
  _language: string,
  purpose: TradePricePurpose,
): string {
  if (purpose === "SALES" && item.quotationDescription) return item.quotationDescription;
  const candidates = ["en", "ar", ...Object.keys(item.localizedNames).sort()];
  for (const key of candidates) {
    const value = item.localizedNames[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return item.canonicalCode;
}

function nullableBoundedString(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length === 0 || value.length > max) {
    return tradeInvalidResponse();
  }
  return value;
}

function isOptionalVersion(value: unknown): value is number | null | undefined {
  return value === null || value === undefined || isVersion(value);
}

function isOptionalBoolean(value: unknown): value is boolean | null | undefined {
  return value === null || value === undefined || typeof value === "boolean";
}
