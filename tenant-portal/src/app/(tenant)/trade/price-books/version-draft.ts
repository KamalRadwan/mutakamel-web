import { generateUUIDv7 } from "@/lib/uuid";
import { compareFixedDecimal } from "../documents/fixed-decimal";
import { isMemberOf, isUuidV7 } from "../trade-advanced-validation";
import {
  CURRENCY_CODE_PATTERN,
  PRICE_BOOK_CODE_MAX_LENGTH,
  PRICE_BOOK_VERSION_NOTES_MAX_LENGTH,
  PRICE_ENTRIES_MAX,
  PROMOTIONS_MAX,
  PROMOTION_BENEFIT_TYPES,
  PROMOTION_CODE_PATTERN,
  type PriceBookVersionDetail,
  type PromotionBenefitType,
} from "./pricing-contract";
import {
  DECIMAL_16_8_PATTERN,
  POSITIVE_DECIMAL_16_8_PATTERN,
} from "./version-draft-validation";

export {
  detectVersionDraftConflicts,
  type DraftValidationIssue,
  type VersionDraftConflictReport,
} from "./version-draft-validation";
export { applyBulkFormulaToDraftEntries, applyPriceFormulaBigInt } from "./version-formula";

export interface PriceEntryDraft {
  key?: string;
  itemId: string;
  uomId: string;
  currencyCode: string;
  minimumQuantity: string;
  maximumQuantity: string;
  unitPrice: string;
  minimumAllowedPrice: string;
  priority: string;
}

export interface PromotionRuleDraft {
  key?: string;
  code: string;
  name: string;
  benefitType: PromotionBenefitType;
  discountValue: string;
  priority: string;
  stackGroup: string;
  exclusive: boolean;
  itemId: string;
  uomId: string;
  branchId: string;
  channelId: string;
  partyId: string;
  minimumQuantity: string;
  maximumQuantity: string;
}

export interface PriceBookVersionDraft {
  effectiveFrom: string;
  effectiveTo: string;
  notes?: string;
  entries: PriceEntryDraft[];
  promotions: PromotionRuleDraft[];
}

export type VersionDraft = PriceBookVersionDraft;

export const EMPTY_PRICE_ENTRY_DRAFT: PriceEntryDraft = {
  itemId: "", uomId: "", currencyCode: "", minimumQuantity: "1",
  maximumQuantity: "", unitPrice: "", minimumAllowedPrice: "", priority: "100",
};

export const EMPTY_PROMOTION_DRAFT: PromotionRuleDraft = {
  code: "", name: "", benefitType: "PERCENTAGE", discountValue: "",
  priority: "100", stackGroup: "DEFAULT", exclusive: false,
  itemId: "", uomId: "", branchId: "", channelId: "", partyId: "",
  minimumQuantity: "1", maximumQuantity: "",
};

export function emptyPriceEntryDraft(currencyCode = ""): PriceEntryDraft {
  return { ...EMPTY_PRICE_ENTRY_DRAFT, key: generateUUIDv7(), currencyCode };
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function hydrateVersionDraftFromDetail(detail: PriceBookVersionDetail): PriceBookVersionDraft {
  const currency = detail.book.currencyCode;
  return {
    effectiveFrom: toDatetimeLocalValue(detail.version.effectiveFrom),
    effectiveTo: toDatetimeLocalValue(detail.version.effectiveTo),
    notes: detail.version.notes ?? "",
    entries: detail.entries.map((e) => ({
      key: e.id || generateUUIDv7(),
      itemId: e.itemId,
      uomId: e.uomId,
      currencyCode: e.currencyCode || currency,
      minimumQuantity: e.minimumQuantity,
      maximumQuantity: e.maximumQuantity ?? "",
      unitPrice: e.unitPrice,
      minimumAllowedPrice: e.minimumAllowedPrice ?? "",
      priority: String(e.priority),
    })),
    promotions: detail.promotions.map((p) => {
      const sel = p.selector ?? {};
      const ben = p.benefit ?? {};
      const bType = p.benefitType === "FIXED_AMOUNT" || ben.type === "FIXED_AMOUNT" ? "FIXED_AMOUNT" : "PERCENTAGE";
      const dVal = typeof p.discountValue === "string" ? p.discountValue : typeof ben.value === "string" ? ben.value : "0";
      return {
        key: p.id || generateUUIDv7(),
        code: p.code,
        name: p.name,
        benefitType: bType,
        discountValue: dVal,
        priority: String(p.priority),
        stackGroup: p.stackGroup || "DEFAULT",
        exclusive: p.exclusive,
        itemId: typeof sel.itemId === "string" ? sel.itemId : "",
        uomId: typeof sel.uomId === "string" ? sel.uomId : "",
        branchId: typeof sel.branchId === "string" ? sel.branchId : "",
        channelId: typeof sel.channelId === "string" ? sel.channelId : "",
        partyId: typeof sel.partyId === "string" ? sel.partyId : "",
        minimumQuantity: typeof sel.minimumQuantity === "string" ? sel.minimumQuantity : "1",
        maximumQuantity: typeof sel.maximumQuantity === "string" ? sel.maximumQuantity : "",
      };
    }),
  };
}

function validateAndSerializeEntriesAndPromos(draft: PriceBookVersionDraft, requireAtLeastOneEntry: boolean) {
  const effectiveFrom = isoDate(draft.effectiveFrom);
  const effectiveTo = optionalIsoDate(draft.effectiveTo);
  if (effectiveTo && new Date(effectiveTo).getTime() <= new Date(effectiveFrom).getTime()) {
    throw new Error("PRICING_FORM_DATE");
  }
  const notesTrimmed = draft.notes?.trim() ?? "";
  if (notesTrimmed.length > PRICE_BOOK_VERSION_NOTES_MAX_LENGTH) throw new Error("PRICING_FORM_NOTES");
  if ((requireAtLeastOneEntry && draft.entries.length === 0) || draft.entries.length > PRICE_ENTRIES_MAX) {
    throw new Error("PRICING_FORM_ENTRIES");
  }
  if (draft.promotions.length > PROMOTIONS_MAX) throw new Error("PRICING_FORM_PROMOTIONS");

  const entries = draft.entries.map((entry) => {
    const itemId = entry.itemId.trim();
    const uomId = entry.uomId.trim();
    const currencyCode = entry.currencyCode.trim().toUpperCase();
    if (!isUuidV7(itemId) || !isUuidV7(uomId)) throw new Error("PRICING_FORM_ENTRY_ID");
    if (!CURRENCY_CODE_PATTERN.test(currencyCode)) throw new Error("PRICING_FORM_CURRENCY");
    const minimumQuantity = nonNegativeDecimal(entry.minimumQuantity, "PRICING_FORM_QUANTITY");
    const maximumQuantity = optionalPositiveDecimal(entry.maximumQuantity, "PRICING_FORM_QUANTITY");
    if (maximumQuantity && compareFixedDecimal(maximumQuantity, minimumQuantity) <= 0) {
      throw new Error("PRICING_FORM_QUANTITY");
    }
    const unitPrice = nonNegativeDecimal(entry.unitPrice, "PRICING_FORM_AMOUNT");
    const minimumAllowedPrice = optionalNonNegativeDecimal(entry.minimumAllowedPrice, "PRICING_FORM_AMOUNT");
    if (minimumAllowedPrice !== undefined && compareFixedDecimal(minimumAllowedPrice, unitPrice) > 0) {
      throw new Error("PRICING_FORM_AMOUNT");
    }
    return {
      itemId, uomId, currencyCode, minimumQuantity,
      ...(maximumQuantity ? { maximumQuantity } : {}),
      unitPrice,
      ...(minimumAllowedPrice !== undefined ? { minimumAllowedPrice } : {}),
      priority: priorityInt(entry.priority),
    };
  });

  const seenPromoCodes = new Set<string>();
  const promotions = draft.promotions.map((rule) => {
    const code = rule.code.trim();
    const name = rule.name.trim();
    const stackGroup = rule.stackGroup.trim();
    if (!code || code.length > PRICE_BOOK_CODE_MAX_LENGTH || !PROMOTION_CODE_PATTERN.test(code)) {
      throw new Error("PRICING_FORM_PROMOTION_CODE");
    }
    const normCode = code.toUpperCase();
    if (seenPromoCodes.has(normCode)) throw new Error("PRICING_FORM_PROMOTION_CODE");
    seenPromoCodes.add(normCode);
    if (!name || name.length > 160) throw new Error("PRICING_FORM_PROMOTION_NAME");
    if (!isMemberOf(rule.benefitType, PROMOTION_BENEFIT_TYPES)) throw new Error("PRICING_FORM_PROMOTION_TYPE");
    const discountValue = positiveDecimal(rule.discountValue, "PRICING_FORM_AMOUNT");
    if (rule.benefitType === "PERCENTAGE" && compareFixedDecimal(discountValue, "100") > 0) {
      throw new Error("PRICING_FORM_AMOUNT");
    }
    if (!stackGroup || stackGroup.length > PRICE_BOOK_CODE_MAX_LENGTH || !PROMOTION_CODE_PATTERN.test(stackGroup)) {
      throw new Error("PRICING_FORM_PROMOTION_CODE");
    }
    const minimumQuantity = nonNegativeDecimal(rule.minimumQuantity, "PRICING_FORM_QUANTITY");
    const maximumQuantity = optionalPositiveDecimal(rule.maximumQuantity, "PRICING_FORM_QUANTITY");
    if (maximumQuantity && compareFixedDecimal(maximumQuantity, minimumQuantity) <= 0) {
      throw new Error("PRICING_FORM_QUANTITY");
    }
    return {
      code, name, benefitType: rule.benefitType, discountValue,
      priority: priorityInt(rule.priority), stackGroup, exclusive: rule.exclusive,
      ...optionalUuid("itemId", rule.itemId),
      ...optionalUuid("uomId", rule.uomId),
      ...optionalUuid("branchId", rule.branchId),
      ...optionalUuid("channelId", rule.channelId),
      ...optionalUuid("partyId", rule.partyId),
      minimumQuantity,
      ...(maximumQuantity ? { maximumQuantity } : {}),
    };
  });

  return { effectiveFrom, effectiveTo, notesTrimmed, entries, promotions };
}

export function buildCreateVersionRequest(draft: PriceBookVersionDraft) {
  const { effectiveFrom, effectiveTo, notesTrimmed, entries, promotions } =
    validateAndSerializeEntriesAndPromos(draft, true);
  return {
    effectiveFrom,
    ...(effectiveTo ? { effectiveTo } : {}),
    ...(notesTrimmed ? { notes: notesTrimmed } : {}),
    entries,
    ...(promotions.length > 0 ? { promotions } : {}),
  };
}


export function buildUpdatePriceBookVersionRequest(draft: PriceBookVersionDraft) {
  const { effectiveFrom, effectiveTo, notesTrimmed, entries, promotions } =
    validateAndSerializeEntriesAndPromos(draft, false);
  return {
    effectiveFrom,
    effectiveTo: effectiveTo ?? null,
    notes: notesTrimmed || null,
    entries,
    promotions,
  };
}


function isoDate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("PRICING_FORM_DATE");
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) throw new Error("PRICING_FORM_DATE");
  return parsed.toISOString();
}
function optionalIsoDate(raw: string): string | undefined {
  return raw.trim().length === 0 ? undefined : isoDate(raw);
}
function nonNegativeDecimal(raw: string, errorCode: string): string {
  const trimmed = raw.trim();
  if (!DECIMAL_16_8_PATTERN.test(trimmed)) throw new Error(errorCode);
  return trimmed;
}
function optionalNonNegativeDecimal(raw: string, errorCode: string): string | undefined {
  return raw.trim().length === 0 ? undefined : nonNegativeDecimal(raw, errorCode);
}
function positiveDecimal(raw: string, errorCode: string): string {
  const trimmed = raw.trim();
  if (!POSITIVE_DECIMAL_16_8_PATTERN.test(trimmed)) throw new Error(errorCode);
  return trimmed;
}
function optionalPositiveDecimal(raw: string, errorCode: string): string | undefined {
  return raw.trim().length === 0 ? undefined : positiveDecimal(raw, errorCode);
}
function priorityInt(raw: string): number {
  const trimmed = raw.trim();
  if (!/^\d+$/u.test(trimmed)) throw new Error("PRICING_FORM_PRIORITY");
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 10_000) throw new Error("PRICING_FORM_PRIORITY");
  return parsed;
}
function optionalUuid<Key extends "itemId" | "uomId" | "branchId" | "channelId" | "partyId">(key: Key, raw: string): Partial<Record<Key, string>> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return {};
  if (!isUuidV7(trimmed)) throw new Error("PRICING_FORM_ENTRY_ID");
  return { [key]: trimmed } as Record<Key, string>;
}
