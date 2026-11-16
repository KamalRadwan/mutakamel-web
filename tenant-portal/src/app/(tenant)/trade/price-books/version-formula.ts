import {
  addFixedDecimal,
  compareFixedDecimal,
  fixedDecimalText,
  fixedDecimalUnits,
} from "../documents/fixed-decimal";
import {
  SIGNED_DECIMAL_16_8_PATTERN,
  type PriceAdjustmentMode,
  type PriceRoundingMode,
} from "./pricing-contract";
import { DECIMAL_16_8_PATTERN } from "./version-draft-validation";
import type { PriceEntryDraft } from "./version-draft";

const SCALE = BigInt("100000000");
const ZERO = BigInt(0);
const TWO = BigInt(2);
const TEN = BigInt(10);
const HUNDRED = BigInt(100);
const END_95_FRACTION = BigInt("95000000");

function pow10(exp: number): bigint {
  let out = BigInt(1);
  for (let i = 0; i < exp; i += 1) out *= TEN;
  return out;
}

/**
 * Exact `BigInt` port of `applyPriceAdjustmentAndRounding` in
 * `trade-app/src/modules/pricing/pricing-governance.helper.ts`.
 */
export function applyPriceFormulaBigInt(
  unitPrice: string,
  currencyDecimalPlaces = 2,
  adjustmentMode: PriceAdjustmentMode = "NONE",
  adjustmentValue?: string,
  roundingMode: PriceRoundingMode = "NONE",
): string {
  const trimmedPrice = unitPrice.trim();
  if (!DECIMAL_16_8_PATTERN.test(trimmedPrice)) return unitPrice;

  const trimmedAdj = adjustmentValue?.trim() ?? "0";
  const hasValidAdj =
    trimmedAdj.length > 0 &&
    SIGNED_DECIMAL_16_8_PATTERN.test(trimmedAdj) &&
    compareFixedDecimal(trimmedAdj, "0") !== 0;

  const quantum = pow10(Math.max(0, 8 - currencyDecimalPlaces));
  let units = fixedDecimalUnits(trimmedPrice);

  if (adjustmentMode === "PERCENTAGE" && hasValidAdj) {
    const pctUnits = fixedDecimalUnits(trimmedAdj);
    const factorUnits = HUNDRED * SCALE + pctUnits;
    const rawProduct = units * factorUnits;
    const denom = HUNDRED * SCALE;
    units =
      rawProduct >= ZERO
        ? (rawProduct + denom / TWO) / denom
        : (rawProduct - denom / TWO) / denom;
  } else if (adjustmentMode === "FIXED_DELTA" && hasValidAdj) {
    units = fixedDecimalUnits(addFixedDecimal(trimmedPrice, trimmedAdj));
  }

  if (units < ZERO) units = ZERO;

  if (roundingMode === "NEAREST_1" && currencyDecimalPlaces >= 0) {
    units = ((units + SCALE / TWO) / SCALE) * SCALE;
  } else if (roundingMode === "NEAREST_0_50" && currencyDecimalPlaces >= 2) {
    const halfUnit = SCALE / TWO;
    units = ((units + halfUnit / TWO) / halfUnit) * halfUnit;
  } else if (roundingMode === "END_95" && currencyDecimalPlaces >= 2) {
    if (units > ZERO) {
      const whole = units / SCALE;
      const candidate = whole * SCALE + END_95_FRACTION;
      units =
        units <= candidate
          ? whole > ZERO && candidate - units > SCALE / TWO
            ? (whole - BigInt(1)) * SCALE + END_95_FRACTION
            : candidate
          : candidate;
    }
  } else {
    units = ((units + quantum / TWO) / quantum) * quantum;
  }

  if (units < ZERO) units = ZERO;
  return fixedDecimalText(units);
}

export function applyBulkFormulaToDraftEntries(
  entries: PriceEntryDraft[],
  adjustmentMode: PriceAdjustmentMode,
  adjustmentValue: string,
  roundingMode: PriceRoundingMode,
  currencyDecimalPlaces = 2,
  matchingKeys?: ReadonlySet<string>,
): PriceEntryDraft[] {
  return entries.map((entry, index) => {
    if (matchingKeys && !matchingKeys.has(entry.key ?? `row-${index}`)) return entry;
    const rawPrice = entry.unitPrice.trim();
    if (!DECIMAL_16_8_PATTERN.test(rawPrice)) return entry;
    const nextUnitPrice = applyPriceFormulaBigInt(
      rawPrice,
      currencyDecimalPlaces,
      adjustmentMode,
      adjustmentValue,
      roundingMode,
    );
    const rawFloor = entry.minimumAllowedPrice.trim();
    const nextFloor =
      rawFloor.length > 0 &&
      DECIMAL_16_8_PATTERN.test(rawFloor) &&
      compareFixedDecimal(rawFloor, nextUnitPrice) > 0
        ? nextUnitPrice
        : entry.minimumAllowedPrice;
    return {
      ...entry,
      unitPrice: nextUnitPrice,
      minimumAllowedPrice: nextFloor,
    };
  });
}
