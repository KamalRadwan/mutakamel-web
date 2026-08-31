import type { NormalizedApiError } from "@/lib/api/errors";
import type { Dictionary } from "@/i18n/dictionaries/ar";

// One message per documented pricing rejection.
//
// The two that matter most to a caller:
//
//   TRADE.PRICE.NO_ELIGIBLE_PRICE is a **404**, not a 422. It means "no price
//   applies", not "the route is missing" — rendering it as a not-found page
//   would be wrong.
//   TRADE.PRICE.TEST_FAILED is a **409**, not a 422.

export function pricingMessage(
  error: NormalizedApiError,
  t: Dictionary,
): string | undefined {
  switch (error.code) {
    case "TRADE.PRICE.NO_ELIGIBLE_PRICE":
      return t.tradePricing.errorNoEligiblePrice;
    case "TRADE.PRICE.AMBIGUOUS_RULES":
      return t.tradePricing.errorAmbiguousRules;
    case "TRADE.PRICE.TIER_OVERLAP":
      return t.tradePricing.errorTierOverlap;
    case "TRADE.PRICE.VERSION_OVERLAP":
      return t.tradePricing.errorVersionOverlap;
    case "TRADE.PRICE.BOOK_NOT_FOUND":
      return t.tradePricing.errorBookNotFound;
    case "TRADE.PRICE.BOOK_INVALID":
      return t.tradePricing.errorBookInvalid;
    case "TRADE.PRICE.BOOK_ALREADY_EXISTS":
      return t.tradePricing.errorBookExists;
    case "TRADE.PRICE.ENTRY_INVALID":
      return t.tradePricing.errorEntryInvalid;
    case "TRADE.PRICE.RULE_INVALID":
      return t.tradePricing.errorRuleInvalid;
    case "TRADE.PRICE.TEST_NOT_ALLOWED":
      return t.tradePricing.errorTestNotAllowed;
    case "TRADE.PRICE.TEST_FAILED":
      return t.tradePricing.errorTestFailed;
    case "TRADE.PRICE.PUBLISH_NOT_ALLOWED":
      return t.tradePricing.errorPublishNotAllowed;
    case "TRADE.PRICE.MARGIN_GUARD":
      return t.tradePricing.errorMarginGuard;
    case "TRADE.PRICE.LOCK_INVALID":
    case "TRADE.PRICE.LOCK_EXPIRED":
    case "TRADE.PRICE.LOCK_CONTEXT_MISMATCH":
      return t.tradePricing.errorPriceLock;
    case "TRADE.CONCURRENCY.STALE_VERSION":
      return t.tradeCommon.errorStaleVersion;
    case "TRADE.CONCURRENCY.IF_MATCH_REQUIRED":
      return t.tradeCommon.errorIfMatchRequired;
    default:
      return undefined;
  }
}

export function pricingFormMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  switch (reason) {
    case "PRICING_FORM_CODE":
      return t.tradePricing.formCodeInvalid;
    case "PRICING_FORM_CURRENCY":
      return t.tradePricing.formCurrencyInvalid;
    case "PRICING_FORM_DATE":
      return t.tradePricing.formDateInvalid;
    case "PRICING_FORM_AMOUNT":
      return t.tradePricing.formAmountInvalid;
    case "PRICING_FORM_PRIORITY":
      return t.tradePricing.formPriorityInvalid;
    case "PRICING_FORM_ENTRIES":
      return t.tradePricing.formEntriesInvalid;
    case "PRICING_FORM_ENTRY_ID":
      return t.tradePricing.formEntryIdInvalid;
    case "PRICING_FORM_PROMOTIONS":
      return t.tradePricing.formPromotionsInvalid;
    case "PRICING_FORM_PROMOTION_CODE":
      return t.tradePricing.formPromotionCodeInvalid;
    case "PRICING_FORM_PROMOTION_NAME":
      return t.tradePricing.formPromotionNameInvalid;
    case "PRICING_FORM_PROMOTION_TYPE":
      return t.tradePricing.formPromotionTypeInvalid;
    case "PRICING_FORM_QUANTITY":
      return t.tradePricing.formQuantityInvalid;
    default:
      return t.tradeCommon.actionFailed;
  }
}
