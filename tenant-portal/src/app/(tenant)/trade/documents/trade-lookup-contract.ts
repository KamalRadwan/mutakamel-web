import type { TradePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import {
  TRADE_V1,
  isBoundedString,
  isTradeDecimal,
  isTradeStatus,
  jsonObject,
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

/**
 * `CatalogListQueryDto` takes `page`, `limit`, `itemKind` and `status` — and
 * **no search term**. `POST /items/search` adds only exact-value filters on
 * `canonicalCode`, `status` and `itemKind`, so there is no substring search
 * over item names anywhere in Trade. The picker therefore loads one page and
 * filters it in the browser, and says so when the catalogue is larger than the
 * page it holds.
 */
const TRADE_LOOKUP_PAGE_SIZE = 100;

export const TRADE_LOOKUP_RESPONSE_BYTES = 400_000;

/** `PriceBookPurpose` — `SALES` for a customer document, `PURCHASE` for a supplier one. */
export type TradePricePurpose = "SALES" | "PURCHASE";

export interface TradeItemOption {
  id: string;
  canonicalCode: string;
  localizedNames: Record<string, unknown>;
  status: string;
}

export interface TradeUomOption {
  id: string;
  code: string;
  displayName: string;
  isBaseUom: boolean;
  canSell: boolean;
  canPurchase: boolean;
}

/**
 * The pricing decision, of which only `unitPrice` is used.
 *
 * The rest of the receipt — `checksum`, `matchedEntryId`, `components`,
 * `inputFingerprint` — is deliberately not forwarded as a `priceSnapshot`.
 * The engine itself marks the decision `taxFinal: false`, and nothing in
 * trade-app says a price decision is what a `priceSnapshot` should contain
 * (Q32). Reusing it would be a guess wearing the costume of evidence.
 */
export interface TradePriceDecision {
  unitPrice: string;
  currencyCode: string;
  priceBookId: string;
  minimumAllowedPrice: string | null;
}

export function tradeItemsPath(page: number): TradePath {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(TRADE_LOOKUP_PAGE_SIZE),
    status: "ACTIVE",
  });
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

export function parseTradeItems(payload: unknown): TradeListPage<TradeItemOption> {
  return parseTradeListPage(payload, (item) => {
    const row = record(item);
    if (
      !row ||
      !isUUIDv7(row.id) ||
      !isBoundedString(row.canonicalCode, 80) ||
      !isTradeStatus(row.status)
    ) {
      tradeInvalidResponse();
    }
    return {
      id: row.id,
      canonicalCode: row.canonicalCode,
      localizedNames: jsonObject(row.localizedNames),
      status: row.status,
    };
  });
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
  return {
    unitPrice: decision.unitPrice,
    currencyCode: decision.currencyCode,
    priceBookId: decision.priceBookId,
    minimumAllowedPrice: isTradeDecimal(decision.minimumAllowedPrice)
      ? decision.minimumAllowedPrice
      : null,
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
