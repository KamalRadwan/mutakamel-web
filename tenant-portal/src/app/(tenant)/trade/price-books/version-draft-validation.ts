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
} from "./pricing-contract";
import type { PriceBookVersionDraft } from "./version-draft";
import { findTierOverlaps } from "./version-tier-overlaps";

/** `trade-app/src/common/decimal-patterns.ts` — non-negative 16 integer + 8 fractional digits. */
export const DECIMAL_16_8_PATTERN = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/u;
/** `trade-app/src/common/decimal-patterns.ts` — strictly positive 16 integer + 8 fractional digits. */
export const POSITIVE_DECIMAL_16_8_PATTERN =
  /^(?!0(?:\.0{1,8})?$)(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/u;

interface VersionEntryConflict {
  kind: "FLOOR_ABOVE_UNIT" | "MIN_ABOVE_MAX" | "TIER_OVERLAP";
  rowIndexes: number[];
  itemId?: string;
  uomId?: string;
  overlapStart?: string;
  overlapEnd?: string | null;
}

interface VersionPromotionConflict {
  kind: "DUPLICATE_CODE" | "PERCENTAGE_OVER_100" | "EQUAL_PRECEDENCE" | "MIN_ABOVE_MAX";
  rowIndexes: number[];
  code?: string;
  stackGroup?: string;
  priority?: number;
}

type DraftValidationIssueCode =
  | "EFFECTIVE_FROM_INVALID"
  | "EFFECTIVE_TO_INVALID"
  | "NOTES_TOO_LONG"
  | "ENTRIES_OVER_LIMIT"
  | "PROMOTIONS_OVER_LIMIT"
  | "ENTRY_ITEM_REQUIRED"
  | "ENTRY_UOM_REQUIRED"
  | "ENTRY_CURRENCY_MISMATCH"
  | "ENTRY_MIN_QTY_INVALID"
  | "ENTRY_MAX_QTY_INVALID"
  | "ENTRY_MIN_ABOVE_MAX"
  | "ENTRY_UNIT_PRICE_INVALID"
  | "ENTRY_FLOOR_INVALID"
  | "ENTRY_FLOOR_ABOVE_UNIT"
  | "ENTRY_PRIORITY_INVALID"
  | "ENTRY_TIER_OVERLAP"
  | "PROMO_CODE_INVALID"
  | "PROMO_DUPLICATE_CODE"
  | "PROMO_NAME_INVALID"
  | "PROMO_BENEFIT_INVALID"
  | "PROMO_DISCOUNT_INVALID"
  | "PROMO_PERCENT_OVER_100"
  | "PROMO_MIN_QTY_INVALID"
  | "PROMO_MAX_QTY_INVALID"
  | "PROMO_MIN_ABOVE_MAX"
  | "PROMO_STACK_GROUP_INVALID"
  | "PROMO_PRIORITY_INVALID"
  | "PROMO_EQUAL_PRECEDENCE";

export interface DraftValidationIssue {
  id: string;
  tab: "matrix" | "promotions" | "details";
  targetDomId: string;
  rowKey?: string;
  rowIndex?: number;
  field: string;
  code: DraftValidationIssueCode;
  params?: Record<string, string | number>;
}

export interface VersionDraftConflictReport {
  hasConflicts: boolean;
  hasBlockingErrors: boolean;
  currencyMismatchIndices: number[];
  floorAboveUnitIndices: number[];
  invalidQtyRangeIndices: number[];
  percentageOver100PromotionIndices: number[];
  entryConflicts: VersionEntryConflict[];
  promotionConflicts: VersionPromotionConflict[];
  issues: DraftValidationIssue[];
}

function isValidPriority(raw: string): boolean {
  const t = raw.trim();
  return /^\d+$/u.test(t) && Number.isSafeInteger(Number(t)) && Number(t) <= 10_000;
}

export function detectVersionDraftConflicts(
  draft: PriceBookVersionDraft,
  expectedCurrencyCode?: string,
): VersionDraftConflictReport {
  const entryConflicts: VersionEntryConflict[] = [];
  const promotionConflicts: VersionPromotionConflict[] = [];
  const issues: DraftValidationIssue[] = [];
  const currencyMismatchIndices: number[] = [];
  const floorAboveUnitIndices: number[] = [];
  const invalidQtyRangeIndices: number[] = [];
  const percentageOver100PromotionIndices: number[] = [];

  const pushIssue = (
    tab: DraftValidationIssue["tab"],
    targetDomId: string,
    field: string,
    code: DraftValidationIssueCode,
    rowKey?: string,
    rowIndex?: number,
    params?: Record<string, string | number>,
  ) => {
    issues.push({
      id: `${tab}-${rowKey ?? field}-${code}-${rowIndex ?? 0}`,
      tab,
      targetDomId,
      rowKey,
      rowIndex,
      field,
      code,
      params,
    });
  };

  const parsedFrom = new Date(draft.effectiveFrom.trim());
  if (!draft.effectiveFrom.trim() || Number.isNaN(parsedFrom.getTime())) {
    pushIssue("details", "version-effectiveFrom", "effectiveFrom", "EFFECTIVE_FROM_INVALID");
  }
  const toTrimmed = draft.effectiveTo.trim();
  if (toTrimmed.length > 0) {
    const parsedTo = new Date(toTrimmed);
    if (Number.isNaN(parsedTo.getTime()) || (!Number.isNaN(parsedFrom.getTime()) && parsedTo.getTime() <= parsedFrom.getTime())) {
      pushIssue("details", "version-effectiveTo", "effectiveTo", "EFFECTIVE_TO_INVALID");
    }
  }
  if ((draft.notes?.trim() ?? "").length > PRICE_BOOK_VERSION_NOTES_MAX_LENGTH) {
    pushIssue("details", "version-notes", "notes", "NOTES_TOO_LONG");
  }
  if (draft.entries.length > PRICE_ENTRIES_MAX) {
    pushIssue("matrix", "matrix-search-input", "entries", "ENTRIES_OVER_LIMIT");
  }
  if (draft.promotions.length > PROMOTIONS_MAX) {
    pushIssue("promotions", "promotions-search-input", "promotions", "PROMOTIONS_OVER_LIMIT");
  }

  draft.entries.forEach((entry, idx) => {
    const key = entry.key ?? `row-${idx}`;
    const ccy = entry.currencyCode.trim().toUpperCase();
    const minQ = entry.minimumQuantity.trim();
    const maxQ = entry.maximumQuantity.trim();
    const unitP = entry.unitPrice.trim();
    const floorP = entry.minimumAllowedPrice.trim();

    if (!isUuidV7(entry.itemId.trim())) pushIssue("matrix", `entry-${key}-itemId`, "itemId", "ENTRY_ITEM_REQUIRED", key, idx, { row: idx + 1 });
    if (!isUuidV7(entry.uomId.trim())) pushIssue("matrix", `entry-${key}-uomId`, "uomId", "ENTRY_UOM_REQUIRED", key, idx, { row: idx + 1 });
    if (!CURRENCY_CODE_PATTERN.test(ccy) || (expectedCurrencyCode && ccy !== expectedCurrencyCode.toUpperCase())) {
      currencyMismatchIndices.push(idx);
      pushIssue("matrix", `entry-${key}-unitPrice`, "currencyCode", "ENTRY_CURRENCY_MISMATCH", key, idx, { row: idx + 1, currency: expectedCurrencyCode ?? ccy });
    }
    const minValid = DECIMAL_16_8_PATTERN.test(minQ);
    if (!minValid) pushIssue("matrix", `entry-${key}-minimumQuantity`, "minimumQuantity", "ENTRY_MIN_QTY_INVALID", key, idx, { row: idx + 1 });

    const maxValid = maxQ.length === 0 || POSITIVE_DECIMAL_16_8_PATTERN.test(maxQ);
    if (!maxValid) {
      pushIssue("matrix", `entry-${key}-maximumQuantity`, "maximumQuantity", "ENTRY_MAX_QTY_INVALID", key, idx, { row: idx + 1 });
    } else if (maxQ.length > 0 && minValid && compareFixedDecimal(maxQ, minQ) <= 0) {
      invalidQtyRangeIndices.push(idx);
      entryConflicts.push({ kind: "MIN_ABOVE_MAX", rowIndexes: [idx] });
      pushIssue("matrix", `entry-${key}-maximumQuantity`, "maximumQuantity", "ENTRY_MIN_ABOVE_MAX", key, idx, { row: idx + 1, min: minQ, max: maxQ });
    }

    const unitValid = DECIMAL_16_8_PATTERN.test(unitP);
    if (!unitValid) pushIssue("matrix", `entry-${key}-unitPrice`, "unitPrice", "ENTRY_UNIT_PRICE_INVALID", key, idx, { row: idx + 1 });

    const floorValid = floorP.length === 0 || DECIMAL_16_8_PATTERN.test(floorP);
    if (!floorValid) {
      pushIssue("matrix", `entry-${key}-minimumAllowedPrice`, "minimumAllowedPrice", "ENTRY_FLOOR_INVALID", key, idx, { row: idx + 1 });
    } else if (floorP.length > 0 && unitValid && compareFixedDecimal(floorP, unitP) > 0) {
      floorAboveUnitIndices.push(idx);
      entryConflicts.push({ kind: "FLOOR_ABOVE_UNIT", rowIndexes: [idx] });
      pushIssue("matrix", `entry-${key}-minimumAllowedPrice`, "minimumAllowedPrice", "ENTRY_FLOOR_ABOVE_UNIT", key, idx, { row: idx + 1, floor: floorP, unit: unitP });
    }
    if (!isValidPriority(entry.priority)) pushIssue("matrix", `entry-${key}-priority`, "priority", "ENTRY_PRIORITY_INVALID", key, idx, { row: idx + 1 });
  });

  const tiers = draft.entries.flatMap((entry, rowIndex) => {
    const min = entry.minimumQuantity.trim();
    const max = entry.maximumQuantity.trim();
    if (!entry.itemId.trim() || !entry.uomId.trim() || !isValidPriority(entry.priority) ||
      !DECIMAL_16_8_PATTERN.test(min) || (max && (!POSITIVE_DECIMAL_16_8_PATTERN.test(max) || compareFixedDecimal(max, min) <= 0))) return [];
    return [{ rowIndex, itemId: entry.itemId.trim(), uomId: entry.uomId.trim(),
      currencyCode: entry.currencyCode.trim().toUpperCase(), priority: Number(entry.priority),
      minimumQuantity: min, maximumQuantity: max || null }];
  });
  for (const conflict of findTierOverlaps(tiers)) {
    entryConflicts.push({ kind: "TIER_OVERLAP", ...conflict });
    const [first, second] = conflict.rowIndexes;
    if (first === undefined || second === undefined) continue;
    const key = draft.entries[second]?.key ?? `row-${second}`;
    pushIssue("matrix", `entry-${key}-minimumQuantity`, "minimumQuantity", "ENTRY_TIER_OVERLAP", key, second,
      { first: first + 1, second: second + 1, start: conflict.overlapStart, end: conflict.overlapEnd ?? "∞" });
  }
  const promoCodeMap = new Map<string, number>();
  const stackPrioMap = new Map<string, number>();

  draft.promotions.forEach((promo, idx) => {
    const key = promo.key ?? `promo-${idx}`;
    const code = promo.code.trim();
    const normCode = code.toUpperCase();
    const disc = promo.discountValue.trim();
    const minQ = promo.minimumQuantity.trim();
    const maxQ = promo.maximumQuantity.trim();
    const stack = promo.stackGroup.trim();

    if (!code || code.length > PRICE_BOOK_CODE_MAX_LENGTH || !PROMOTION_CODE_PATTERN.test(code)) {
      pushIssue("promotions", `promo-${key}-code`, "code", "PROMO_CODE_INVALID", key, idx, { row: idx + 1 });
    } else if (promoCodeMap.has(normCode)) {
      const prev = promoCodeMap.get(normCode)!;
      promotionConflicts.push({ kind: "DUPLICATE_CODE", rowIndexes: [prev, idx], code: normCode });
      pushIssue("promotions", `promo-${key}-code`, "code", "PROMO_DUPLICATE_CODE", key, idx, { first: prev + 1, second: idx + 1, code: normCode });
    } else {
      promoCodeMap.set(normCode, idx);
    }

    if (!promo.name.trim() || promo.name.trim().length > 160) pushIssue("promotions", `promo-${key}-name`, "name", "PROMO_NAME_INVALID", key, idx, { row: idx + 1 });
    if (!isMemberOf(promo.benefitType, PROMOTION_BENEFIT_TYPES)) pushIssue("promotions", `promo-${key}-discountValue`, "benefitType", "PROMO_BENEFIT_INVALID", key, idx, { row: idx + 1 });

    if (!POSITIVE_DECIMAL_16_8_PATTERN.test(disc)) {
      pushIssue("promotions", `promo-${key}-discountValue`, "discountValue", "PROMO_DISCOUNT_INVALID", key, idx, { row: idx + 1 });
    } else if (promo.benefitType === "PERCENTAGE" && compareFixedDecimal(disc, "100") > 0) {
      percentageOver100PromotionIndices.push(idx);
      promotionConflicts.push({ kind: "PERCENTAGE_OVER_100", rowIndexes: [idx] });
      pushIssue("promotions", `promo-${key}-discountValue`, "discountValue", "PROMO_PERCENT_OVER_100", key, idx, { row: idx + 1, value: disc });
    }

    const minValid = DECIMAL_16_8_PATTERN.test(minQ);
    if (!minValid) pushIssue("promotions", `promo-${key}-minimumQuantity`, "minimumQuantity", "PROMO_MIN_QTY_INVALID", key, idx, { row: idx + 1 });
    const maxValid = maxQ.length === 0 || POSITIVE_DECIMAL_16_8_PATTERN.test(maxQ);
    if (!maxValid) {
      pushIssue("promotions", `promo-${key}-maximumQuantity`, "maximumQuantity", "PROMO_MAX_QTY_INVALID", key, idx, { row: idx + 1 });
    } else if (maxQ.length > 0 && minValid && compareFixedDecimal(maxQ, minQ) <= 0) {
      promotionConflicts.push({ kind: "MIN_ABOVE_MAX", rowIndexes: [idx] });
      pushIssue("promotions", `promo-${key}-maximumQuantity`, "maximumQuantity", "PROMO_MIN_ABOVE_MAX", key, idx, { row: idx + 1, min: minQ, max: maxQ });
    }

    const stackValid = Boolean(stack && stack.length <= PRICE_BOOK_CODE_MAX_LENGTH && PROMOTION_CODE_PATTERN.test(stack));
    if (!stackValid) pushIssue("promotions", `promo-${key}-stackGroup`, "stackGroup", "PROMO_STACK_GROUP_INVALID", key, idx, { row: idx + 1 });
    const prioValid = isValidPriority(promo.priority);
    if (!prioValid) pushIssue("promotions", `promo-${key}-priority`, "priority", "PROMO_PRIORITY_INVALID", key, idx, { row: idx + 1 });

    if (stackValid && prioValid) {
      const spKey = `${stack.toUpperCase()}:${Number(promo.priority.trim())}`;
      const prevSp = stackPrioMap.get(spKey);
      if (prevSp !== undefined) {
        promotionConflicts.push({ kind: "EQUAL_PRECEDENCE", rowIndexes: [prevSp, idx], stackGroup: stack.toUpperCase(), priority: Number(promo.priority.trim()) });
        pushIssue("promotions", `promo-${key}-priority`, "priority", "PROMO_EQUAL_PRECEDENCE", key, idx, { first: prevSp + 1, second: idx + 1, stackGroup: stack.toUpperCase(), priority: Number(promo.priority.trim()) });
      } else {
        stackPrioMap.set(spKey, idx);
      }
    }
  });

  const hasBlockingErrors = issues.length > 0 || entryConflicts.length > 0 || promotionConflicts.length > 0;
  return {
    hasConflicts: hasBlockingErrors,
    hasBlockingErrors,
    currencyMismatchIndices,
    floorAboveUnitIndices,
    invalidQtyRangeIndices,
    percentageOver100PromotionIndices,
    entryConflicts,
    promotionConflicts,
    issues,
  };
}
