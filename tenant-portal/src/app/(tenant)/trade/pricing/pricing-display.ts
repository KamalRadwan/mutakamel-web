import type { Dictionary } from "@/i18n/dictionaries/ar";
import { formatTemplate } from "@/lib/format/template";
import type {
  PriceBook,
  PricingDecisionResult,
} from "../price-books/pricing-contract";
import {
  canonicalizeDecimalInput,
  compareFixedDecimal,
  DECIMAL_ZERO,
  fixedDecimalUnits,
  multiplyFixedDecimal,
  subtractFixedDecimal,
} from "../documents/fixed-decimal";

const ZERO_BIGINT = BigInt(0);
const TWO_BIGINT = BigInt(2);
const HUNDRED_BIGINT = BigInt(100);
const TEN_THOUSAND_BIGINT = BigInt(10000);

export type PricingScenarioPreset = "retail" | "wholesale" | "vip";
export type PricingResolutionSourceTier = "EXPLICIT" | "AUTOMATIC";

type PricingWaterfallStep =
  | {
      readonly stepNumber: number;
      readonly kind: "BASELINE";
      readonly deltaAmount: null;
      readonly runningUnitPrice: string;
    }
  | {
      readonly stepNumber: number;
      readonly kind: "PROMOTION";
      readonly promotion: PricingDecisionResult["matchedPromotions"][number];
      readonly deltaAmount: string;
      readonly runningUnitPrice: string;
    }
  | {
      readonly stepNumber: number;
      readonly kind: "RECONCILIATION";
      readonly deltaAmount: string;
      readonly runningUnitPrice: string;
    };

export interface PricingWaterfallModel {
  readonly steps: readonly PricingWaterfallStep[];
  readonly netUnitDelta: string;
  readonly discountPercent: string | null;
}

export function pricingDisplayTotals(
  baselineUnitPrice: string,
  unitPrice: string,
  quantity: string,
) {
  const discount = subtractFixedDecimal(baselineUnitPrice, unitPrice);
  return {
    subtotal: multiplyFixedDecimal(unitPrice, quantity),
    savings: compareFixedDecimal(discount, DECIMAL_ZERO) > 0
      ? multiplyFixedDecimal(discount, quantity)
      : DECIMAL_ZERO,
  };
}

function formatDiscountPercentOffBaseline(
  baselineUnitPrice: string,
  unitPrice: string,
): string | null {
  const baseUnits = fixedDecimalUnits(baselineUnitPrice);
  const finalUnits = fixedDecimalUnits(unitPrice);
  if (baseUnits <= ZERO_BIGINT || finalUnits >= baseUnits) return null;
  const diffUnits = baseUnits - finalUnits;
  const basisPoints = (diffUnits * TEN_THOUSAND_BIGINT + baseUnits / TWO_BIGINT) / baseUnits;
  if (basisPoints <= ZERO_BIGINT) return null;
  const whole = basisPoints / HUNDRED_BIGINT;
  const remainder = basisPoints % HUNDRED_BIGINT;
  if (remainder === ZERO_BIGINT) return whole.toString();
  const fraction = remainder.toString().padStart(2, "0").replace(/0+$/u, "");
  return `${whole}.${fraction}`;
}

/**
 * Derives deterministic per-unit waterfall steps strictly from the authoritative
 * `POST /pricing/evaluate` decision payload using `numeric(24,8)` BigInt math.
 *
 * The matched entry's quantity tier price IS `baselineUnitPrice` — never a
 * synthetic promotion. If final `unitPrice` differs from the running total after
 * matched promotions, show the difference without inventing a reason. The
 * engine rejects a promotion crossing the floor; it never partially applies one.
 */
export function buildPricingWaterfall(decision: PricingDecisionResult): PricingWaterfallModel {
  const steps: PricingWaterfallStep[] = [
    {
      stepNumber: 1,
      kind: "BASELINE",
      deltaAmount: null,
      runningUnitPrice: decision.baselineUnitPrice,
    },
  ];

  let running = decision.baselineUnitPrice;
  for (const promotion of decision.matchedPromotions) {
    const nextRunning = subtractFixedDecimal(running, promotion.discountAmount);
    steps.push({
      stepNumber: steps.length + 1,
      kind: "PROMOTION",
      promotion,
      deltaAmount: promotion.discountAmount,
      runningUnitPrice: nextRunning,
    });
    running = nextRunning;
  }

  if (compareFixedDecimal(running, decision.unitPrice) !== 0) {
    steps.push({
      stepNumber: steps.length + 1,
      kind: "RECONCILIATION",
      deltaAmount: subtractFixedDecimal(decision.unitPrice, running),
      runningUnitPrice: decision.unitPrice,
    });
  }

  return {
    steps,
    netUnitDelta: subtractFixedDecimal(decision.unitPrice, decision.baselineUnitPrice),
    discountPercent: formatDiscountPercentOffBaseline(
      decision.baselineUnitPrice,
      decision.unitPrice,
    ),
  };
}

export function resolveActiveScenarioPreset(
  purpose: string,
  quantity: string,
): PricingScenarioPreset | null {
  if (purpose !== "SALES") return null;
  const canonical = canonicalizeDecimalInput(quantity);
  if (!canonical) return null;
  if (compareFixedDecimal(canonical, "10") === 0) return "retail";
  if (compareFixedDecimal(canonical, "100") === 0) return "wholesale";
  if (compareFixedDecimal(canonical, "500") === 0) return "vip";
  return null;
}

export function resolveSourceTier(
  evaluatedInputs: { priceBookId: string } | null,
): PricingResolutionSourceTier {
  // Public simulation omits source attribution. Bounded reference arrays cannot
  // prove account/default provenance; describe the user's selection instead.
  return evaluatedInputs?.priceBookId ? "EXPLICIT" : "AUTOMATIC";
}

export function resolvePublishedVersionNumber(
  decision: PricingDecisionResult | null,
  resolvedBook?: PriceBook,
): number | null {
  if (!decision) return null;
  if (typeof decision.priceBookVersion === "number") return decision.priceBookVersion;
  const matchingVersion = resolvedBook?.versions?.find(
    (entry) => entry.id === decision.priceBookVersionId,
  );
  if (matchingVersion) return matchingVersion.versionNumber;
  return null;
}

export function localizeRejectionReason(reason: string, t: Dictionary): string {
  switch (reason) {
    case "ACCOUNT_REQUIRED":
      return t.tradePricing.evalRejectionReason_ACCOUNT_REQUIRED;
    case "SELECTOR_MISMATCH":
      return t.tradePricing.evalRejectionReason_SELECTOR_MISMATCH;
    case "STACK_GROUP_LOWER_PRECEDENCE":
      return t.tradePricing.evalRejectionReason_STACK_GROUP_LOWER_PRECEDENCE;
    case "EXCLUSIVE_PROMOTION_APPLIED":
      return t.tradePricing.evalRejectionReason_EXCLUSIVE_PROMOTION_APPLIED;
    case "MINIMUM_PRICE_GUARD":
      return t.tradePricing.evalRejectionReason_MINIMUM_PRICE_GUARD;
    case "LOWER_PRECEDENCE":
      return t.tradePricing.evalRejectionReason_LOWER_PRECEDENCE;
    default:
      return formatTemplate(t.common.unknownCode, { code: reason });
  }
}
