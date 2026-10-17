import { isDecimalString } from "../trade-advanced-validation";
import { isUUIDv7 } from "@/lib/uuid";
import {
  PRICE_ENTRIES_MAX,
  PROMOTIONS_MAX,
  PROMOTION_BENEFIT_TYPES,
  PROMOTION_CODE_PATTERN,
  CURRENCY_CODE_PATTERN,
  type PromotionBenefitType,
} from "./pricing-contract";

// `CreatePriceBookVersionDto` — the body behind
// `POST /price-books/:id/versions`. Kept out of the contract file because it is
// the only part of pricing that is a form model rather than a wire type.
//
// The bounds are the DTO's: entries 1–10 000 (**at least one**), promotions
// 0–500 with a `[]` default, `priority` 0–10 000 defaulting to 100,
// `minimumQuantity` defaulting to "0" on a promotion and `stackGroup` to
// "DEFAULT". Everything monetary is a decimal string and stays one.

export interface PriceEntryDraft {
  itemId: string;
  uomId: string;
  currencyCode: string;
  minimumQuantity: string;
  maximumQuantity: string;
  unitPrice: string;
  minimumAllowedPrice: string;
  priority: string;
}

export interface PromotionDraft {
  code: string;
  name: string;
  benefitType: PromotionBenefitType;
  discountValue: string;
  priority: string;
  stackGroup: string;
  exclusive: boolean;
  itemId?: string;
  uomId?: string;
  branchId?: string;
  channelId?: string;
  partyId?: string;
  minimumQuantity?: string;
  maximumQuantity?: string;
}

export interface VersionDraft {
  effectiveFrom: string;
  effectiveTo: string;
  entries: PriceEntryDraft[];
  promotions: PromotionDraft[];
}

export const EMPTY_PRICE_ENTRY_DRAFT: PriceEntryDraft = {
  itemId: "",
  uomId: "",
  currencyCode: "",
  minimumQuantity: "0",
  maximumQuantity: "",
  unitPrice: "",
  minimumAllowedPrice: "",
  priority: "100",
};

export const EMPTY_PROMOTION_DRAFT: PromotionDraft = {
  code: "",
  name: "",
  benefitType: "PERCENTAGE",
  discountValue: "",
  priority: "100",
  stackGroup: "DEFAULT",
  exclusive: false,
  itemId: "",
  uomId: "",
  branchId: "",
  channelId: "",
  partyId: "",
  minimumQuantity: "",
  maximumQuantity: "",
};

export const EMPTY_VERSION_DRAFT: VersionDraft = {
  effectiveFrom: "",
  effectiveTo: "",
  entries: [EMPTY_PRICE_ENTRY_DRAFT],
  promotions: [],
};

function isoInstant(value: string): string {
  const parsed = new Date(value);
  if (value.trim().length === 0 || Number.isNaN(parsed.getTime())) {
    throw new Error("PRICING_FORM_DATE");
  }
  return parsed.toISOString();
}

function boundedPriority(value: string): number {
  const parsed = Number(value.trim());
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 10_000) {
    throw new Error("PRICING_FORM_PRIORITY");
  }
  return parsed;
}

function positiveDecimal(value: string): string {
  const trimmed = value.trim();
  if (!isDecimalString(trimmed) || Number(trimmed) <= 0) throw new Error("PRICING_FORM_AMOUNT");
  return trimmed;
}

interface PriceEntryBody {
  itemId: string;
  uomId: string;
  currencyCode: string;
  minimumQuantity: string;
  unitPrice: string;
  priority: number;
  maximumQuantity?: string;
  minimumAllowedPrice?: string;
}

interface PromotionBody {
  code: string;
  name: string;
  benefitType: PromotionBenefitType;
  discountValue: string;
  priority: number;
  stackGroup: string;
  exclusive: boolean;
  itemId?: string;
  uomId?: string;
  branchId?: string;
  channelId?: string;
  partyId?: string;
  minimumQuantity?: string;
  maximumQuantity?: string;
}

export interface VersionDraftConflictReport {
  hasConflicts: boolean;
  overlappingTierPairs: Array<{ firstIndex: number; secondIndex: number; itemId: string; uomId: string }>;
  currencyMismatchIndices: number[];
  floorAboveUnitIndices: number[];
  invalidQtyRangeIndices: number[];
  percentageOver100PromotionIndices: number[];
}

export function detectVersionDraftConflicts(
  draft: VersionDraft,
  bookCurrencyCode?: string,
): VersionDraftConflictReport {
  const normalizedBookCurrency = bookCurrencyCode?.trim().toUpperCase();
  const overlappingTierPairs: Array<{ firstIndex: number; secondIndex: number; itemId: string; uomId: string }> = [];
  const currencyMismatchIndices: number[] = [];
  const floorAboveUnitIndices: number[] = [];
  const invalidQtyRangeIndices: number[] = [];
  const percentageOver100PromotionIndices: number[] = [];

  draft.entries.forEach((entry, idx) => {
    const curr = entry.currencyCode.trim().toUpperCase();
    if (normalizedBookCurrency && curr.length === 3 && curr !== normalizedBookCurrency) {
      currencyMismatchIndices.push(idx);
    }
    const minQ = Number(entry.minimumQuantity.trim());
    const maxQ = entry.maximumQuantity.trim().length > 0 ? Number(entry.maximumQuantity.trim()) : Infinity;
    if (Number.isFinite(minQ) && Number.isFinite(maxQ) && minQ > maxQ) {
      invalidQtyRangeIndices.push(idx);
    }
    const unit = Number(entry.unitPrice.trim());
    const floor = entry.minimumAllowedPrice.trim().length > 0 ? Number(entry.minimumAllowedPrice.trim()) : null;
    if (floor !== null && Number.isFinite(unit) && Number.isFinite(floor) && floor > unit) {
      floorAboveUnitIndices.push(idx);
    }
  });

  for (let i = 0; i < draft.entries.length; i++) {
    for (let j = i + 1; j < draft.entries.length; j++) {
      const a = draft.entries[i];
      const b = draft.entries[j];
      const itemA = a.itemId.trim();
      const uomA = a.uomId.trim();
      if (!itemA || !uomA) continue;
      if (itemA === b.itemId.trim() && uomA === b.uomId.trim()) {
        const minA = Number(a.minimumQuantity.trim()) || 0;
        const maxA = a.maximumQuantity.trim().length > 0 ? Number(a.maximumQuantity.trim()) : Infinity;
        const minB = Number(b.minimumQuantity.trim()) || 0;
        const maxB = b.maximumQuantity.trim().length > 0 ? Number(b.maximumQuantity.trim()) : Infinity;
        if (Math.max(minA, minB) <= Math.min(maxA, maxB)) {
          overlappingTierPairs.push({ firstIndex: i, secondIndex: j, itemId: itemA, uomId: uomA });
        }
      }
    }
  }

  draft.promotions.forEach((promo, idx) => {
    if (promo.benefitType === "PERCENTAGE") {
      const val = Number(promo.discountValue.trim());
      if (Number.isFinite(val) && val > 100) {
        percentageOver100PromotionIndices.push(idx);
      }
    }
  });

  return {
    hasConflicts:
      overlappingTierPairs.length > 0 ||
      currencyMismatchIndices.length > 0 ||
      floorAboveUnitIndices.length > 0 ||
      invalidQtyRangeIndices.length > 0 ||
      percentageOver100PromotionIndices.length > 0,
    overlappingTierPairs,
    currencyMismatchIndices,
    floorAboveUnitIndices,
    invalidQtyRangeIndices,
    percentageOver100PromotionIndices,
  };
}

export function buildCreateVersionRequest(draft: VersionDraft): {
  effectiveFrom: string;
  effectiveTo?: string;
  entries: PriceEntryBody[];
  promotions: PromotionBody[];
} {
  if (draft.entries.length < 1 || draft.entries.length > PRICE_ENTRIES_MAX) {
    throw new Error("PRICING_FORM_ENTRIES");
  }
  if (draft.promotions.length > PROMOTIONS_MAX) throw new Error("PRICING_FORM_PROMOTIONS");

  const entries = draft.entries.map((entry) => {
    const itemId = entry.itemId.trim();
    const uomId = entry.uomId.trim();
    const currencyCode = entry.currencyCode.trim().toUpperCase();
    if (!isUUIDv7(itemId) || !isUUIDv7(uomId)) throw new Error("PRICING_FORM_ENTRY_ID");
    if (!CURRENCY_CODE_PATTERN.test(currencyCode)) throw new Error("PRICING_FORM_CURRENCY");
    if (!isDecimalString(entry.minimumQuantity.trim())) throw new Error("PRICING_FORM_AMOUNT");

    const body: PriceEntryBody = {
      itemId,
      uomId,
      currencyCode,
      minimumQuantity: entry.minimumQuantity.trim(),
      unitPrice: positiveDecimal(entry.unitPrice),
      priority: boundedPriority(entry.priority),
    };
    // Both optional fields are nullable on the DTO, but an empty string is not
    // a decimal — omit rather than send "".
    if (entry.maximumQuantity.trim().length > 0) {
      body.maximumQuantity = positiveDecimal(entry.maximumQuantity);
    }
    if (entry.minimumAllowedPrice.trim().length > 0) {
      if (!isDecimalString(entry.minimumAllowedPrice.trim())) throw new Error("PRICING_FORM_AMOUNT");
      body.minimumAllowedPrice = entry.minimumAllowedPrice.trim();
    }
    return body;
  });

  const promotions = draft.promotions.map((promotion) => {
    const code = promotion.code.trim();
    const name = promotion.name.trim();
    if (!PROMOTION_CODE_PATTERN.test(code) || code.length > 80) {
      throw new Error("PRICING_FORM_PROMOTION_CODE");
    }
    if (name.length === 0 || name.length > 160) throw new Error("PRICING_FORM_PROMOTION_NAME");
    if (!PROMOTION_BENEFIT_TYPES.includes(promotion.benefitType)) {
      throw new Error("PRICING_FORM_PROMOTION_TYPE");
    }
    const body: PromotionBody = {
      code,
      name,
      benefitType: promotion.benefitType,
      discountValue: positiveDecimal(promotion.discountValue),
      priority: boundedPriority(promotion.priority),
      stackGroup: promotion.stackGroup.trim() || "DEFAULT",
      exclusive: promotion.exclusive,
    };
    const optionalUuidFields = ["itemId", "uomId", "branchId", "channelId", "partyId"] as const;
    for (const key of optionalUuidFields) {
      const rawVal = promotion[key]?.trim();
      if (rawVal && rawVal.length > 0) {
        if (!isUUIDv7(rawVal)) throw new Error("PRICING_FORM_ENTRY_ID");
        body[key] = rawVal;
      }
    }
    if (promotion.minimumQuantity && promotion.minimumQuantity.trim().length > 0) {
      if (!isDecimalString(promotion.minimumQuantity.trim())) throw new Error("PRICING_FORM_AMOUNT");
      body.minimumQuantity = promotion.minimumQuantity.trim();
    }
    if (promotion.maximumQuantity && promotion.maximumQuantity.trim().length > 0) {
      body.maximumQuantity = positiveDecimal(promotion.maximumQuantity);
    }
    return body;
  });

  const request = {
    effectiveFrom: isoInstant(draft.effectiveFrom),
    entries,
    promotions,
  };
  return draft.effectiveTo.trim().length > 0
    ? { ...request, effectiveTo: isoInstant(draft.effectiveTo) }
    : request;
}
