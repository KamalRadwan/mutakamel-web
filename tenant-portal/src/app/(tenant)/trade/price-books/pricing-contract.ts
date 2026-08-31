import type { TradePath } from "@/lib/api/envelope";
import {
  isBoundedInteger,
  isDecimalString,
  isMemberOf,
  isNonEmptyString,
  isNullableDecimalString,
  isTimestamp,
  isUuidV7,
  parseTradeOffsetPage,
  record,
  type TradeOffsetPage,
} from "../trade-advanced-validation";

// Price books, price-book versions and price evaluation — 7 routes.
// docs/api/trade-advanced.md#price-books--7-routes, verified against
// trade-app/src/modules/pricing/{pricing.controller.ts,pricing.service.ts,
// pricing-read.controller.ts,pricing-read-projection.service.ts,
// dto/pricing.dto.ts}.
//
// The three `/configuration/company-default-price-books/*` routes belong to
// this family but are Phase 10's task 10.19 (MASTER-PLAN 12.12) and are
// documented with the rest of the `/configuration` prefix — this file does not
// call them.
//
// S6 cannot be satisfied: Trade has no capabilities endpoint (Q30), so action
// admission here is the permission string plus `user.isTenantOwner` only.

export const PRICE_BOOKS_PATH = "/api/tenant/trade/v1/price-books";
export const PRICING_EVALUATE_PATH = "/api/tenant/trade/v1/pricing/evaluate";

// `/price-book-versions` has no bare route — only `/:id` and its two actions —
// so it is written as a full literal below rather than as a prefix constant.

export const PRICING_READ_PERMISSION = "trade.pricing.read";
export const PRICING_MANAGE_PERMISSION = "trade.pricing.manage";
/**
 * Publishing a price-book version needs a **Policy Studio** grant, not
 * `trade.pricing.manage`. Two of Trade's three publish actions are behind it.
 */
export const POLICY_PUBLISH_PERMISSION = "trade.policy.publish";

export const PRICE_BOOK_PAGE_SIZE = 25;
export const PRICE_BOOK_CODE_MAX_LENGTH = 80;
export const PRICE_ENTRIES_MAX = 10_000;
export const PROMOTIONS_MAX = 500;
export const PROMOTION_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
export const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/u;

export const PRICE_BOOK_PURPOSES = ["SALES", "PURCHASE"] as const;
export const PROMOTION_BENEFIT_TYPES = ["PERCENTAGE", "FIXED_AMOUNT"] as const;
export type PriceBookPurpose = (typeof PRICE_BOOK_PURPOSES)[number];
export type PromotionBenefitType = (typeof PROMOTION_BENEFIT_TYPES)[number];

// A price-book version's `status` is the same seven-value
// `GovernedVersionStatus` the policy ladder uses; it is rendered through
// `t.tradeStatus`, which holds every value, and is not narrowed here.

interface PriceBookVersionSummary {
  id: string;
  versionNumber: number;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
}

export interface PriceBook {
  id: string;
  code: string;
  purpose: string;
  currencyCode: string;
  /** A free string with no enum anywhere in source — rendered as it arrives. */
  status: string;
  version: number;
  versions: PriceBookVersionSummary[];
}

export interface PriceEntry {
  id: string;
  itemId: string;
  uomId: string;
  currencyCode: string;
  minimumQuantity: string;
  maximumQuantity: string | null;
  unitPrice: string;
  minimumAllowedPrice: string | null;
  priority: number;
}

export interface PromotionRow {
  id: string;
  code: string;
  name: string;
  versionNumber: number;
  status: string;
  priority: number;
  stackGroup: string;
  exclusive: boolean;
}

export interface PriceBookVersionDetail {
  book: { id: string; code: string; purpose: string; currencyCode: string; status: string; version: number };
  version: PriceBookVersionSummary & { checksum: string };
  entries: PriceEntry[];
  promotions: PromotionRow[];
  /** Null until a `test` run has been recorded against this checksum. */
  latestTestEvidence: { passed: boolean; testedAt: string } | null;
}

export interface PricingDecisionResult {
  outcome: string;
  unitPrice: string;
  baselineUnitPrice: string;
  currencyCode: string;
  priceBookId: string;
  priceBookVersionId: string;
  minimumAllowedPrice: string | null;
  /** The receipt id — the only way to reach `GET /decisions/:id`. */
  decisionId: string;
  matchedPromotions: Array<{ code: string; discountAmount: string }>;
}

export function priceBookVersionsPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidPricingResponse();
  return `${PRICE_BOOKS_PATH}/${encodeURIComponent(id)}/versions` as TradePath;
}

export function priceBookVersionPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidPricingResponse();
  return `/api/tenant/trade/v1/price-book-versions/${encodeURIComponent(id)}` as TradePath;
}

export function priceBookVersionActionPath(id: string, action: "test" | "publish"): TradePath {
  return `${priceBookVersionPath(id)}/${action}` as TradePath;
}

export function priceBooksListPath(
  page: number,
  purpose?: PriceBookPurpose,
  status?: string,
): TradePath {
  const query = new URLSearchParams({ page: String(page), limit: String(PRICE_BOOK_PAGE_SIZE) });
  if (purpose) query.set("purpose", purpose);
  if (status) query.set("status", status);
  return `${PRICE_BOOKS_PATH}?${query.toString()}` as TradePath;
}

export interface PriceBookFormValues {
  code: string;
  purpose: PriceBookPurpose;
  currencyCode: string;
}

export const EMPTY_PRICE_BOOK_FORM: PriceBookFormValues = {
  code: "",
  purpose: "SALES",
  currencyCode: "",
};

export function buildCreatePriceBookRequest(values: PriceBookFormValues) {
  const code = values.code.trim();
  const currencyCode = values.currencyCode.trim().toUpperCase();
  if (code.length === 0 || code.length > PRICE_BOOK_CODE_MAX_LENGTH) {
    throw new Error("PRICING_FORM_CODE");
  }
  if (!CURRENCY_CODE_PATTERN.test(currencyCode)) throw new Error("PRICING_FORM_CURRENCY");
  return { code, purpose: values.purpose, currencyCode };
}

export function parsePriceBooksResponse(payload: unknown): TradeOffsetPage<PriceBook> {
  return parseTradeOffsetPage(payload, parsePriceBook, invalidPricingResponse);
}

function parseVersionSummary(payload: unknown): PriceBookVersionSummary {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isBoundedInteger(row.versionNumber, 1, Number.MAX_SAFE_INTEGER) ||
    !isNonEmptyString(row.status, 32) ||
    !isTimestamp(row.effectiveFrom) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER)
  ) {
    invalidPricingResponse();
  }
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    status: row.status,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: isTimestamp(row.effectiveTo) ? row.effectiveTo : null,
    version: row.version,
  };
}

function parsePriceBook(payload: unknown): PriceBook {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.code, PRICE_BOOK_CODE_MAX_LENGTH) ||
    !isNonEmptyString(row.purpose, 32) ||
    !isNonEmptyString(row.currencyCode, 3) ||
    !isNonEmptyString(row.status, 32) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER)
  ) {
    invalidPricingResponse();
  }
  return {
    id: row.id,
    code: row.code,
    purpose: row.purpose,
    currencyCode: row.currencyCode,
    status: row.status,
    version: row.version,
    versions: Array.isArray(row.versions) ? row.versions.map(parseVersionSummary) : [],
  };
}

export function parsePriceBookVersionDetail(payload: unknown): PriceBookVersionDetail {
  const body = record(payload);
  const book = body ? record(body.book) : null;
  const version = body ? record(body.version) : null;
  if (
    !body ||
    !book ||
    !version ||
    !isUuidV7(book.id) ||
    !isNonEmptyString(book.code, PRICE_BOOK_CODE_MAX_LENGTH) ||
    !isNonEmptyString(book.currencyCode, 3) ||
    !isNonEmptyString(version.checksum, 128) ||
    !Array.isArray(body.entries) ||
    !Array.isArray(body.promotions)
  ) {
    invalidPricingResponse();
  }
  const evidence = record(body.latestTestEvidence);
  return {
    book: {
      id: book.id,
      code: book.code,
      purpose: typeof book.purpose === "string" ? book.purpose : "",
      currencyCode: book.currencyCode,
      status: typeof book.status === "string" ? book.status : "",
      version: isBoundedInteger(book.version, 0, Number.MAX_SAFE_INTEGER) ? book.version : 0,
    },
    version: { ...parseVersionSummary(version), checksum: version.checksum },
    entries: body.entries.map(parsePriceEntry),
    promotions: body.promotions.map(parsePromotionRow),
    latestTestEvidence:
      evidence && typeof evidence.passed === "boolean" && isTimestamp(evidence.testedAt)
        ? { passed: evidence.passed, testedAt: evidence.testedAt }
        : null,
  };
}

function parsePriceEntry(payload: unknown): PriceEntry {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isUuidV7(row.itemId) ||
    !isUuidV7(row.uomId) ||
    !isNonEmptyString(row.currencyCode, 3) ||
    !isDecimalString(row.minimumQuantity) ||
    !isDecimalString(row.unitPrice) ||
    !isNullableDecimalString(row.maximumQuantity ?? null) ||
    !isNullableDecimalString(row.minimumAllowedPrice ?? null) ||
    !isBoundedInteger(row.priority, 0, 10_000)
  ) {
    invalidPricingResponse();
  }
  return {
    id: row.id,
    itemId: row.itemId,
    uomId: row.uomId,
    currencyCode: row.currencyCode,
    minimumQuantity: row.minimumQuantity,
    maximumQuantity: (row.maximumQuantity as string | null | undefined) ?? null,
    unitPrice: row.unitPrice,
    minimumAllowedPrice: (row.minimumAllowedPrice as string | null | undefined) ?? null,
    priority: row.priority,
  };
}

function parsePromotionRow(payload: unknown): PromotionRow {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.code, PRICE_BOOK_CODE_MAX_LENGTH) ||
    !isNonEmptyString(row.name, 160) ||
    !isBoundedInteger(row.versionNumber, 0, Number.MAX_SAFE_INTEGER) ||
    !isNonEmptyString(row.status, 32) ||
    !isBoundedInteger(row.priority, 0, 10_000) ||
    typeof row.exclusive !== "boolean"
  ) {
    invalidPricingResponse();
  }
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    versionNumber: row.versionNumber,
    status: row.status,
    priority: row.priority,
    stackGroup: typeof row.stackGroup === "string" ? row.stackGroup : "DEFAULT",
    exclusive: row.exclusive,
  };
}

export function parsePricingDecision(payload: unknown): PricingDecisionResult {
  const row = record(payload);
  if (
    !row ||
    !isNonEmptyString(row.outcome, 32) ||
    !isDecimalString(row.unitPrice) ||
    !isDecimalString(row.baselineUnitPrice) ||
    !isNonEmptyString(row.currencyCode, 3) ||
    !isUuidV7(row.priceBookId) ||
    !isUuidV7(row.priceBookVersionId) ||
    !isUuidV7(row.decisionId) ||
    !isNullableDecimalString(row.minimumAllowedPrice ?? null)
  ) {
    invalidPricingResponse();
  }
  return {
    outcome: row.outcome,
    unitPrice: row.unitPrice,
    baselineUnitPrice: row.baselineUnitPrice,
    currencyCode: row.currencyCode,
    priceBookId: row.priceBookId,
    priceBookVersionId: row.priceBookVersionId,
    minimumAllowedPrice: (row.minimumAllowedPrice as string | null | undefined) ?? null,
    decisionId: row.decisionId,
    matchedPromotions: Array.isArray(row.matchedPromotions)
      ? row.matchedPromotions.flatMap((entry) => {
          const promotion = record(entry);
          return promotion &&
            typeof promotion.code === "string" &&
            isDecimalString(promotion.discountAmount)
            ? [{ code: promotion.code, discountAmount: promotion.discountAmount }]
            : [];
        })
      : [],
  };
}

export function isPriceBookPurpose(value: unknown): value is PriceBookPurpose {
  return isMemberOf(value, PRICE_BOOK_PURPOSES);
}

function invalidPricingResponse(): never {
  throw new Error("Invalid Trade pricing response.");
}
