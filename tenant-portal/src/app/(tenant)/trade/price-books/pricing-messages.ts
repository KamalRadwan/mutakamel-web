import type { NormalizedApiError } from "@/lib/api/errors";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { DraftValidationIssue } from "./version-draft-validation";

type PricingText = Dictionary["tradePricing"];

const PRICING_ERRORS: Record<string, keyof PricingText> = {
  "TRADE.PRICE.NO_ELIGIBLE_PRICE": "errorNoEligiblePrice",
  "TRADE.PRICE.AMBIGUOUS_RULES": "errorAmbiguousRules",
  "TRADE.PRICE.RULE_SELECTION_INVALID": "errorAmbiguousRules",
  "TRADE.PRICE.TIER_OVERLAP": "errorTierOverlap",
  "TRADE.PRICE.VERSION_OVERLAP": "errorVersionOverlap",
  "TRADE.PRICE.BOOK_NOT_FOUND": "errorBookNotFound",
  "TRADE.PRICE.BOOK_INVALID": "errorBookInvalid",
  "TRADE.PRICE.BOOK_ALREADY_EXISTS": "errorBookExists",
  "TRADE.PRICE.ENTRY_INVALID": "errorEntryInvalid",
  "TRADE.PRICE.RULE_INVALID": "errorRuleInvalid",
  "TRADE.PRICE.TEST_NOT_ALLOWED": "errorTestNotAllowed",
  "TRADE.PRICE.TEST_FAILED": "errorTestFailed",
  "TRADE.PRICE.PUBLISH_NOT_ALLOWED": "errorPublishNotAllowed",
  "TRADE.PRICE.MARGIN_GUARD": "errorMarginGuard",
  "TRADE.PRICE.LOCK_INVALID": "errorPriceLock",
  "TRADE.PRICE.LOCK_DATA_INVALID": "errorPriceLock",
  "TRADE.PRICE.LOCK_EXPIRED": "errorPriceLock",
  "TRADE.PRICE.LOCK_CONTEXT_MISMATCH": "errorPriceLock",
  "TRADE.APPROVAL.MAKER_CHECKER_REQUIRED": "publishCheckerRequired",
  "TRADE.CONCURRENCY.STALE_VERSION": "staleConflictKeepEditsHint",
};

const PRICING_FORM_ERRORS: Record<string, keyof PricingText> = {
  PRICING_FORM_CODE: "formCodeInvalid",
  PRICING_FORM_BOOK_NAME: "formBookNameInvalid",
  PRICING_FORM_BOOK_DESCRIPTION: "formBookDescriptionInvalid",
  PRICING_FORM_CURRENCY: "formCurrencyInvalid",
  PRICING_FORM_DATE: "formDateInvalid",
  PRICING_FORM_NOTES: "issueNotesTooLong",
  PRICING_FORM_AMOUNT: "formAmountInvalid",
  PRICING_FORM_PRIORITY: "formPriorityInvalid",
  PRICING_FORM_ENTRIES: "formEntriesInvalid",
  PRICING_FORM_ENTRY_ID: "formEntryIdInvalid",
  PRICING_FORM_PROMOTIONS: "formPromotionsInvalid",
  PRICING_FORM_PROMOTION_CODE: "formPromotionCodeInvalid",
  PRICING_FORM_PROMOTION_NAME: "formPromotionNameInvalid",
  PRICING_FORM_PROMOTION_TYPE: "formPromotionTypeInvalid",
  PRICING_FORM_QUANTITY: "formQuantityInvalid",
};

export function pricingMessage(
  error: NormalizedApiError,
  t: Dictionary,
): string | undefined {
  const tp = t.tradePricing;
  if (error.code === "TRADE.CONCURRENCY.STALE_VERSION") return t.tradeCommon.errorStaleVersion;
  if (error.code === "TRADE.CONCURRENCY.IF_MATCH_REQUIRED") return t.tradeCommon.errorIfMatchRequired;
  const key = error.code ? PRICING_ERRORS[error.code] : undefined;
  return key ? String(tp[key]) : undefined;
}

export function pricingFormMessage(
  error: unknown,
  t: Dictionary,
): string {
  const key = error instanceof Error ? PRICING_FORM_ERRORS[error.message] : undefined;
  return key ? String(t.tradePricing[key]) : t.tradeCommon.actionFailed;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  let out = template;
  for (const [k, v] of Object.entries(params)) {
    out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

export function formatDraftValidationIssue(
  issue: DraftValidationIssue,
  tp: PricingText,
): string {
  switch (issue.code) {
    case "EFFECTIVE_FROM_INVALID":
      return tp.issueEffectiveFromInvalid;
    case "EFFECTIVE_TO_INVALID":
      return tp.issueEffectiveToInvalid;
    case "NOTES_TOO_LONG":
      return tp.issueNotesTooLong;
    case "ENTRIES_OVER_LIMIT":
      return tp.formEntriesInvalid;
    case "PROMOTIONS_OVER_LIMIT":
      return tp.formPromotionsInvalid;
    case "ENTRY_ITEM_REQUIRED":
      return interpolate(tp.issueEntryItemRequired, issue.params);
    case "ENTRY_UOM_REQUIRED":
      return interpolate(tp.issueEntryUomRequired, issue.params);
    case "ENTRY_CURRENCY_MISMATCH":
      return interpolate(tp.issueEntryCurrencyMismatch, issue.params);
    case "ENTRY_MIN_QTY_INVALID":
      return interpolate(tp.issueEntryMinQtyInvalid, issue.params);
    case "ENTRY_MAX_QTY_INVALID":
      return interpolate(tp.issueEntryMaxQtyInvalid, issue.params);
    case "ENTRY_MIN_ABOVE_MAX":
      return interpolate(tp.issueEntryMinAboveMax, issue.params);
    case "ENTRY_UNIT_PRICE_INVALID":
      return interpolate(tp.issueEntryUnitPriceInvalid, issue.params);
    case "ENTRY_FLOOR_INVALID":
      return interpolate(tp.issueEntryFloorInvalid, issue.params);
    case "ENTRY_FLOOR_ABOVE_UNIT":
      return interpolate(tp.issueEntryFloorAboveUnit, issue.params);
    case "ENTRY_PRIORITY_INVALID":
      return interpolate(tp.issueEntryPriorityInvalid, issue.params);
    case "ENTRY_TIER_OVERLAP":
      return interpolate(tp.issueEntryTierOverlap, issue.params);
    case "PROMO_CODE_INVALID":
      return interpolate(tp.issuePromoCodeInvalid, issue.params);
    case "PROMO_DUPLICATE_CODE":
      return interpolate(tp.issuePromoDuplicateCode, issue.params);
    case "PROMO_NAME_INVALID":
      return interpolate(tp.issuePromoNameInvalid, issue.params);
    case "PROMO_BENEFIT_INVALID":
      return tp.formPromotionTypeInvalid;
    case "PROMO_DISCOUNT_INVALID":
      return interpolate(tp.issuePromoDiscountInvalid, issue.params);
    case "PROMO_PERCENT_OVER_100":
      return interpolate(tp.issuePromoPercentOver100, issue.params);
    case "PROMO_MIN_QTY_INVALID":
      return interpolate(tp.issuePromoMinQtyInvalid, issue.params);
    case "PROMO_MAX_QTY_INVALID":
      return interpolate(tp.issuePromoMaxQtyInvalid, issue.params);
    case "PROMO_MIN_ABOVE_MAX":
      return interpolate(tp.issuePromoMinAboveMax, issue.params);
    case "PROMO_STACK_GROUP_INVALID":
      return interpolate(tp.issuePromoStackGroupInvalid, issue.params);
    case "PROMO_PRIORITY_INVALID":
      return interpolate(tp.issuePromoPriorityInvalid, issue.params);
    case "PROMO_EQUAL_PRECEDENCE":
      return interpolate(tp.issuePromoEqualPrecedence, issue.params);
  }
}

export function localizedAuditAction(action: string, tp: PricingText): string {
  switch (action) {
    case "CREATE":
      return tp.auditActionCreate;
    case "CLONE":
      return tp.auditActionClone;
    case "SEED_CATALOG":
      return tp.auditActionSeedCatalog;
    case "CREATE_EMPTY":
      return tp.auditActionCreateEmpty;
    case "UPDATE":
    case "UPDATE_DRAFT":
      return tp.auditActionUpdate;
    case "DEACTIVATE":
      return tp.auditActionDeactivate;
    case "ACTIVATE":
      return tp.auditActionActivate;
    case "DELETE_DRAFT":
    case "DELETE_VERSION_DRAFT":
      return tp.auditActionDeleteDraft;
    case "TEST_PASSED":
      return tp.auditActionTestPassed;
    case "TEST_FAILED":
      return tp.auditActionTestFailed;
    case "PUBLISH":
      return tp.auditActionPublish;
    case "SCHEDULE":
      return tp.auditActionSchedule;
    case "SOLO_OWNER_PUBLISH":
      return tp.auditActionSoloPublish;
    case "SOLO_OWNER_SCHEDULE":
      return tp.auditActionSoloSchedule;
    case "RETIRE":
      return tp.auditActionRetire;
    default:
      return action;
  }
}
