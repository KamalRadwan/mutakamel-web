import { z } from "zod";
import { isUUIDv7 } from "@/lib/uuid";
import { canonicalizeDecimalInput, compareFixedDecimal } from "../documents/fixed-decimal";
import { canonicalTradeQuantity } from "../documents/trade-line-validation";
import type { TradeLineDraft } from "../documents/hooks/useTradeLineDraft";
import { QUOTATION_DISCOUNT_REASON_MAX, type QuotationDiscountScope, type QuotationDiscountType,
  type QuotationLineDiscountIntent, type QuotationPricingIntent, type QuotationPricingMode,
  type QuotationPricingRequest } from "./quotation-discount-contract";

export interface QuotationDiscountDraft {
  mode: QuotationPricingMode; scope: QuotationDiscountScope; type: QuotationDiscountType;
  value: string; reason: string; lineDiscounts: Record<string, QuotationLineDiscountIntent>;
}
const lineValue = z.object({ type: z.enum(["PERCENT", "AMOUNT"]), value: z.string().max(40) }).strict();
export const quotationDiscountDraftSchema = z.object({
  mode: z.enum(["NONE", "PROMOTIONS", "DISCOUNT"]), scope: z.enum(["LINE", "DOCUMENT"]),
  type: z.enum(["PERCENT", "AMOUNT"]), value: z.string().max(40), reason: z.string().max(QUOTATION_DISCOUNT_REASON_MAX),
  lineDiscounts: z.record(z.string().refine(isUUIDv7), lineValue).refine((entries) => Object.keys(entries).length <= 1_000),
}).strict();

export function defaultQuotationDiscount(): QuotationDiscountDraft {
  return { mode: "NONE", scope: "DOCUMENT", type: "PERCENT", value: "0", reason: "", lineDiscounts: {} };
}
export function discountValue(value: string, type: QuotationDiscountType): string | null {
  if (value.length > 40) return null;
  const result = canonicalizeDecimalInput(value);
  if (result === null || !/^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/u.test(result)
    || (type === "PERCENT" && compareFixedDecimal(result, "100") > 0)) return null;
  return result;
}
export function hasQuotationDiscountEntries(draft: QuotationDiscountDraft): boolean {
  if (draft.reason.trim()) return true;
  const values = draft.scope === "DOCUMENT" ? [draft.value] : Object.values(draft.lineDiscounts).map((entry) => entry.value);
  return values.some((value) => value.trim() !== "" && canonicalizeDecimalInput(value) !== "0");
}
function quotationPricingIntent(draft: QuotationDiscountDraft): QuotationPricingIntent | null {
  if (draft.mode !== "DISCOUNT") return { mode: draft.mode };
  if (draft.reason.length > QUOTATION_DISCOUNT_REASON_MAX) return null;
  const reason = draft.reason.trim();
  if (draft.scope === "LINE") return { mode: "DISCOUNT", scope: "LINE", ...(reason ? { reason } : {}) };
  const value = discountValue(draft.value, draft.type);
  return value === null ? null : { mode: "DISCOUNT", scope: "DOCUMENT", type: draft.type, value,
    ...(reason ? { reason } : {}) };
}
export function buildQuotationPricingRequest(draft: QuotationDiscountDraft, lines: readonly TradeLineDraft[],
  partyId: string | null, currencyCode: string, crmCustomerProfileId?: string | null,
  options?: { priceBooksByLineId?: Readonly<Record<string, string>>; blocked?: boolean }): QuotationPricingRequest | null {
  if (options?.blocked) return null;
  const pricing = quotationPricingIntent(draft);
  const populated = lines.filter((line) => line.itemId !== "");
  if (!pricing || !isUUIDv7(partyId) || !/^[A-Z]{3}$/u.test(currencyCode) || populated.length < 1
    || populated.length > 1_000 || new Set(populated.map((line) => line.clientLineId)).size !== populated.length) return null;
  const result: QuotationPricingRequest["lines"] = [];
  for (const line of populated) {
    const quantity = canonicalTradeQuantity(line.quantity);
    if (!isUUIDv7(line.clientLineId) || !isUUIDv7(line.itemId) || !isUUIDv7(line.uomId) || quantity === null) return null;
    const intent = pricing.mode === "DISCOUNT" && pricing.scope === "LINE" ? draft.lineDiscounts[line.clientLineId] : undefined;
    const value = intent ? discountValue(intent.value, intent.type) : null;
    if (intent && value === null) return null;
    const priceBookId = options?.priceBooksByLineId?.[line.clientLineId];
    result.push({ clientLineId: line.clientLineId, itemId: line.itemId, uomId: line.uomId, quantity,
      ...(isUUIDv7(priceBookId) ? { priceBookId } : {}),
      ...(intent && value !== null ? { discount: { type: intent.type, value } } : {}) });
  }
  return { partyId, currencyCode, ...(crmCustomerProfileId ? { crmCustomerProfileId } : {}), lines: result, pricing };
}
export function resetQuotationFixedDiscounts(draft: QuotationDiscountDraft): QuotationDiscountDraft {
  if (draft.mode !== "DISCOUNT") return draft;
  return { ...draft, value: draft.type === "AMOUNT" ? "" : draft.value,
    lineDiscounts: Object.fromEntries(Object.entries(draft.lineDiscounts).map(([id, entry]) =>
      [id, entry.type === "AMOUNT" ? { ...entry, value: "" } : entry])) };
}
export function pruneQuotationLineDiscounts(draft: QuotationDiscountDraft, ids: ReadonlySet<string>): QuotationDiscountDraft {
  const entries = Object.entries(draft.lineDiscounts).filter(([id]) => ids.has(id));
  return entries.length === Object.keys(draft.lineDiscounts).length ? draft : { ...draft, lineDiscounts: Object.fromEntries(entries) };
}
