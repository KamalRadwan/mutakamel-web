import type { NormalizedApiError } from "@/lib/api/errors";
import type { Dictionary } from "@/i18n/dictionaries/ar";

// Policy Studio rejections. Two are worth their own note:
//
//   TRADE.POLICY.TEST_FAILED is 422 *and* 409, so a failed test and a refused
//   test share one code.
//   TRADE.AUTH.TARGET_DENIED is a **422** here — policy-studio.service.ts
//   throws UnprocessableEntity when the request's resolved target does not
//   equal the definition's scopeTarget. The same code is a 403 from the guard,
//   which is why S7's 403-to-PermissionGate rule alone would miss it.

export function governanceMessage(
  error: NormalizedApiError,
  t: Dictionary,
): string | undefined {
  switch (error.code) {
    case "TRADE.POLICY.DEFINITION_NOT_FOUND":
      return t.tradeGovernance.errorDefinitionNotFound;
    case "TRADE.POLICY.CODE_TAKEN":
      return t.tradeGovernance.errorCodeTaken;
    case "TRADE.POLICY.DEFINITION_INVALID":
      return t.tradeGovernance.errorDefinitionInvalid;
    case "TRADE.POLICY.EXPRESSION_INVALID":
      return t.tradeGovernance.errorExpressionInvalid;
    case "TRADE.POLICY.OUTPUT_INVALID":
      return t.tradeGovernance.errorOutputInvalid;
    case "TRADE.POLICY.TEST_FAILED":
      return t.tradeGovernance.errorTestFailed;
    case "TRADE.POLICY.PUBLISH_NOT_ALLOWED":
      return t.tradeGovernance.errorPublishNotAllowed;
    case "TRADE.POLICY.EFFECTIVE_OVERLAP":
      return t.tradeGovernance.errorEffectiveOverlap;
    case "TRADE.POLICY.DECISION_UNAVAILABLE":
      return t.tradeGovernance.errorDecisionUnavailable;
    case "TRADE.WORKFLOW.DEFINITION_INVALID":
      return t.tradeGovernance.errorWorkflowInvalid;
    case "TRADE.APPROVAL.MAKER_CHECKER_REQUIRED":
      return t.tradeGovernance.errorMakerChecker;
    case "TRADE.AUTH.TARGET_DENIED":
      return t.tradeCommon.errorTargetDenied;
    case "TRADE.CONCURRENCY.STALE_VERSION":
      return t.tradeCommon.errorStaleVersion;
    case "TRADE.CONCURRENCY.IF_MATCH_REQUIRED":
      return t.tradeCommon.errorIfMatchRequired;
    default:
      return undefined;
  }
}

export function governanceFormMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  switch (reason) {
    case "GOVERNANCE_FORM_CODE":
      return t.tradeGovernance.formCodeInvalid;
    case "GOVERNANCE_FORM_KIND":
      return t.tradeGovernance.formKindInvalid;
    case "GOVERNANCE_FORM_CONTENT":
      return t.tradeGovernance.formContentInvalid;
    case "GOVERNANCE_FORM_TEST_CASES":
      return t.tradeGovernance.formTestCasesInvalid;
    case "GOVERNANCE_FORM_DATE":
      return t.tradeGovernance.formDateInvalid;
    case "GOVERNANCE_FORM_REASON":
      return t.tradeGovernance.formReasonInvalid;
    default:
      return t.tradeCommon.actionFailed;
  }
}
