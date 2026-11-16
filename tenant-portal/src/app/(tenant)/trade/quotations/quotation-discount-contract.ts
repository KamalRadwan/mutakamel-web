import type { TradePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import { compareFixedDecimal, multiplyFixedDecimal, subtractFixedDecimal, sumFixedDecimals } from "../documents/fixed-decimal";
import { isTradeDecimal, record, tradeInvalidResponse, TRADE_V1 } from "../documents/trade-document-contract";
import { parseTradePriceDecision, type TradePriceDecision } from "../documents/trade-lookup-contract";

// documents/dto/quotation-pricing.dto.ts and pricing/quotation-discount.types.ts.
export const QUOTATION_PRICING_PREVIEW_PATH = `${TRADE_V1}/quotations/pricing-preview` as TradePath;
export const QUOTATION_DISCOUNT_REASON_MAX = 240;
export type QuotationPricingMode = "NONE" | "PROMOTIONS" | "DISCOUNT";
export type QuotationDiscountScope = "LINE" | "DOCUMENT";
export type QuotationDiscountType = "PERCENT" | "AMOUNT";
export interface QuotationLineDiscountIntent { type: QuotationDiscountType; value: string }
export interface QuotationPricingIntent {
  mode: QuotationPricingMode;
  scope?: QuotationDiscountScope;
  type?: QuotationDiscountType;
  value?: string;
  reason?: string;
}
export interface QuotationPricingLineInput {
  clientLineId: string; itemId: string; uomId: string; quantity: string;
  priceBookId?: string;
  discount?: QuotationLineDiscountIntent;
}
export interface QuotationPricingRequest {
  partyId: string; crmCustomerProfileId?: string; currencyCode: string;
  lines: QuotationPricingLineInput[]; pricing: QuotationPricingIntent;
}
export interface QuotationDiscountLimits {
  maxPercent: string; allowFreeItems: boolean; reasonRequired: boolean; id?: string; version?: number;
}
interface QuotationPricingLine {
  clientLineId: string; itemId: string; uomId: string; quantity: string;
  unitPrice: string; baseUnitPrice: string; subtotal: string; discountTotal: string;
  netUnitPrice: string; priceDecision?: TradePriceDecision;
  lineTotal: string; promotionSavings: string; minimumAllowedPrice: string | null;
  maxDiscountAmount: string; maxDiscountPercent: string;
}
export interface QuotationPricingTotals {
  subtotal: string; discountTotal: string; grandTotal: string;
  baseSubtotal: string; promotionSavings: string;
}
export interface QuotationPricingCalculation {
  pricing: QuotationPricingIntent; currencyDecimalPlaces: number;
  limitsSnapshot: QuotationDiscountLimits | null; lines: QuotationPricingLine[];
  totals: QuotationPricingTotals; fingerprint: string;
}

function isQuotationDiscountType(value: unknown): value is QuotationDiscountType {
  return value === "PERCENT" || value === "AMOUNT";
}
export function parseQuotationPricingIntent(payload: unknown): QuotationPricingIntent {
  const row = record(payload);
  if (!row || (row.mode !== "NONE" && row.mode !== "PROMOTIONS" && row.mode !== "DISCOUNT")) tradeInvalidResponse();
  if (row.mode !== "DISCOUNT") {
    if (["scope", "type", "value", "reason"].some((key) => row[key] !== undefined)) tradeInvalidResponse();
    return { mode: row.mode };
  }
  if (row.scope !== "LINE" && row.scope !== "DOCUMENT") tradeInvalidResponse();
  if (row.reason !== undefined && (typeof row.reason !== "string" || row.reason.length > QUOTATION_DISCOUNT_REASON_MAX)) tradeInvalidResponse();
  if (row.scope === "LINE") {
    if (row.type !== undefined || row.value !== undefined) tradeInvalidResponse();
    return { mode: "DISCOUNT", scope: "LINE", ...(typeof row.reason === "string" ? { reason: row.reason } : {}) };
  }
  if (!isQuotationDiscountType(row.type) || !money(row.value)
    || (row.type === "PERCENT" && compareFixedDecimal(row.value, "100") > 0)) tradeInvalidResponse();
  return { mode: "DISCOUNT", scope: "DOCUMENT", type: row.type, value: row.value,
    ...(typeof row.reason === "string" ? { reason: row.reason } : {}) };
}

export function parseQuotationDiscountLimits(payload: unknown): QuotationDiscountLimits {
  const row = record(payload);
  if (!row || !money(row.maxPercent) || compareFixedDecimal(row.maxPercent, "100") > 0
    || typeof row.allowFreeItems !== "boolean" || typeof row.reasonRequired !== "boolean") tradeInvalidResponse();
  if ((row.id !== undefined || row.version !== undefined)
    && (!isUUIDv7(row.id) || typeof row.version !== "number" || !Number.isSafeInteger(row.version) || row.version < 1)) tradeInvalidResponse();
  return { maxPercent: row.maxPercent, allowFreeItems: row.allowFreeItems, reasonRequired: row.reasonRequired,
    ...(typeof row.id === "string" && typeof row.version === "number" ? { id: row.id, version: row.version } : {}) };
}

export function parseQuotationPricingCalculation(payload: unknown, expected?: QuotationPricingRequest): QuotationPricingCalculation {
  const row = record(payload);
  if (!row || !Array.isArray(row.lines) || row.lines.length < 1 || row.lines.length > 1_000
    || typeof row.fingerprint !== "string" || !/^[a-f0-9]{64}$/u.test(row.fingerprint)
    || typeof row.currencyDecimalPlaces !== "number" || !Number.isInteger(row.currencyDecimalPlaces)
    || row.currencyDecimalPlaces < 0 || row.currencyDecimalPlaces > 8) tradeInvalidResponse();
  const pricing = parseQuotationPricingIntent(row.pricing);
  const limitsSnapshot = row.limitsSnapshot === null ? null : parseQuotationDiscountLimits(row.limitsSnapshot);
  if (pricing.mode === "DISCOUNT" && limitsSnapshot === null) tradeInvalidResponse();
  const lines = row.lines.map(parsePricingLine);
  if (new Set(lines.map((line) => line.clientLineId)).size !== lines.length) tradeInvalidResponse();
  const totals = parseQuotationPricingTotals(row.totals);
  for (const field of ["subtotal", "discountTotal", "lineTotal", "promotionSavings"] as const) {
    const target = field === "lineTotal" ? "grandTotal" : field;
    if (!equal(sumFixedDecimals(lines.map((line) => line[field])), totals[target])) tradeInvalidResponse();
  }
  if (pricing.mode === "PROMOTIONS" && (!equal(totals.discountTotal, "0")
    || !equal(subtractFixedDecimal(totals.baseSubtotal, totals.promotionSavings), totals.grandTotal))) tradeInvalidResponse();
  if (pricing.mode !== "PROMOTIONS" && (!equal(totals.promotionSavings, "0") || !equal(totals.baseSubtotal, totals.subtotal))) tradeInvalidResponse();
  if (pricing.mode === "NONE" && !equal(totals.discountTotal, "0")) tradeInvalidResponse();
  if (!equal(sumFixedDecimals(lines.map((line) => multiplyFixedDecimal(line.quantity, line.baseUnitPrice))), totals.baseSubtotal)) tradeInvalidResponse();
  if (expected) {
    if (JSON.stringify(pricing) !== JSON.stringify(parseQuotationPricingIntent(expected.pricing)) || lines.length !== expected.lines.length) tradeInvalidResponse();
    if (lines.some((line, index) => {
      const original = expected.lines[index];
      return !original || line.clientLineId !== original.clientLineId || line.itemId !== original.itemId || line.uomId !== original.uomId || !equal(line.quantity, original.quantity)
        || (line.priceDecision !== undefined && line.priceDecision.currencyCode !== expected.currencyCode);
    })) tradeInvalidResponse();
  }
  return { pricing, currencyDecimalPlaces: row.currencyDecimalPlaces, limitsSnapshot, lines, totals, fingerprint: row.fingerprint };
}

export function parseQuotationPricingTotals(payload: unknown): QuotationPricingTotals {
  const row = record(payload);
  if (!row || !money(row.subtotal) || !money(row.discountTotal) || !money(row.grandTotal)
    || !money(row.baseSubtotal) || !money(row.promotionSavings)
    || compareFixedDecimal(row.discountTotal, row.subtotal) > 0
    || !equal(subtractFixedDecimal(row.subtotal, row.discountTotal), row.grandTotal)) tradeInvalidResponse();
  return { subtotal: row.subtotal, discountTotal: row.discountTotal, grandTotal: row.grandTotal,
    baseSubtotal: row.baseSubtotal, promotionSavings: row.promotionSavings };
}

function parsePricingLine(payload: unknown): QuotationPricingLine {
  const row = record(payload);
  const fields = ["quantity", "unitPrice", "baseUnitPrice", "netUnitPrice", "subtotal", "discountTotal", "lineTotal", "promotionSavings", "maxDiscountAmount", "maxDiscountPercent"] as const;
  if (!row || !isUUIDv7(row.clientLineId) || !isUUIDv7(row.itemId) || !isUUIDv7(row.uomId)
    || !fields.every((field) => money(row[field])) || compareFixedDecimal(row.quantity as string, "0") <= 0
    || (row.minimumAllowedPrice !== null && !money(row.minimumAllowedPrice))
    || compareFixedDecimal(row.maxDiscountPercent as string, "100") > 0
    || !equal(multiplyFixedDecimal(row.quantity as string, row.unitPrice as string), row.subtotal as string)
    || compareFixedDecimal(row.discountTotal as string, row.subtotal as string) > 0
    || !equal(subtractFixedDecimal(row.subtotal as string, row.discountTotal as string), row.lineTotal as string)) tradeInvalidResponse();
  return { clientLineId: row.clientLineId, itemId: row.itemId, uomId: row.uomId,
    quantity: row.quantity as string, unitPrice: row.unitPrice as string, baseUnitPrice: row.baseUnitPrice as string, netUnitPrice: row.netUnitPrice as string,
    subtotal: row.subtotal as string, discountTotal: row.discountTotal as string, lineTotal: row.lineTotal as string,
    promotionSavings: row.promotionSavings as string, minimumAllowedPrice: row.minimumAllowedPrice as string | null,
    maxDiscountAmount: row.maxDiscountAmount as string, maxDiscountPercent: row.maxDiscountPercent as string,
    ...(row.priceDecision === undefined ? {} : { priceDecision: parseTradePriceDecision(row.priceDecision) }) };
}

function money(value: unknown): value is string { return isTradeDecimal(value) && value.length <= 40; }
function equal(left: string, right: string): boolean { return compareFixedDecimal(left, right) === 0; }
