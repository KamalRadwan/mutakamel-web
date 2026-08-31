// MASTER-PLAN 11.22: a lifecycle refusal has to say which transition was
// refused, not "failed".
//
// Every key below is a code with a real throw site in trade-app/src, verified
// by grepping the constant name in
// `packages/common/src/constants/error-codes.ts` rather than the literal —
// several are raised through a ternary or a helper factory and a narrower
// search would miss them. Twelve codes in that catalogue have **no** throw
// site anywhere (QUOTE_CUSTOMER_AMBIGUOUS, QUOTE_REVISION_IMMUTABLE,
// QUOTE_SEND_NOT_ALLOWED, QUOTE_ACCEPTANCE_INVALID, QUOTE_ACCEPT_NOT_ALLOWED,
// QUOTE_REVISION_SUPERSEDED, QUOTE_ALREADY_ACCEPTED, QUOTE_ALREADY_CONVERTED,
// SALES_ORDER_ALREADY_CONVERTED, SALES_ORDER_CANCEL_QUANTITY_INVALID,
// PURCHASE_ORDER_PROCUREMENT_REQUIRED, PURCHASE_ORDER_CANCEL_QUANTITY_INVALID)
// and are deliberately absent: a branch for a code that cannot arrive is a
// dead branch.

type ErrorDictionary = Record<string, string>;

const CODE_TO_KEY: Record<string, string> = {
  // Cross-cutting
  "TRADE.CONCURRENCY.IF_MATCH_REQUIRED": "concurrencyPrecondition",
  "TRADE.CONCURRENCY.STALE_VERSION": "concurrencyStale",
  "TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE": "evidenceIncomplete",
  "TRADE.FINALIZED_DOCUMENT.NUMBERING_UNAVAILABLE": "numberingUnavailable",
  "TRADE.CONTEXT.MISSING_COMPANY": "scopeMissing",
  "TRADE.CONTEXT.MISSING_BRANCH": "scopeMissing",
  "TRADE.AUTH.TARGET_DENIED": "targetDenied",
  "TRADE.POLICY.DECISION_UNAVAILABLE": "policyUnavailable",
  "TRADE.DOCUMENT_PROFILE.PUBLICATION_UNAVAILABLE": "profileUnavailable",
  "TRADE.DEPENDENCY.TIMEOUT": "dependencyTimeout",
  "TRADE.STORAGE.UNAVAILABLE": "storageUnavailable",
  "GW.REQUEST.INVALID": "gatewayRequestInvalid",

  // Quotations
  "TRADE.QUOTE.TRANSITION_NOT_ALLOWED": "quoteTransition",
  "TRADE.QUOTE.EXPIRED": "quoteExpired",
  "TRADE.QUOTE.LINE_INVALID": "quoteLineInvalid",
  "TRADE.QUOTE.VALIDITY_INVALID": "quoteValidityInvalid",
  "TRADE.QUOTE.COMMERCIAL_ACCOUNT_BLOCKED": "quoteAccountBlocked",
  "TRADE.QUOTE.CUSTOMER_NOT_ELIGIBLE": "quoteCustomerNotEligible",
  "TRADE.QUOTE.CUSTOMER_INVALID": "quoteCustomerInvalid",
  "TRADE.QUOTE.CUSTOMER_ELIGIBILITY_UNAVAILABLE": "quoteEligibilityUnavailable",

  // Pricing, reached through a document action
  "TRADE.PRICE.BOOK_REQUIRED": "priceBookRequired",
  "TRADE.PRICE.LOCK_INVALID": "priceLockInvalid",
  "TRADE.PRICE.LOCK_EXPIRED": "priceLockExpired",
  "TRADE.PRICE.LOCK_CONTEXT_MISMATCH": "priceLockContextMismatch",
  "TRADE.PRICE.MARGIN_GUARD": "priceMarginGuard",
  "TRADE.PRICE.NO_ELIGIBLE_PRICE": "priceNoEligiblePrice",

  // Sales orders
  "TRADE.SALES_ORDER.CONFIRM_NOT_ALLOWED": "salesOrderConfirmNotAllowed",
  "TRADE.SALES_ORDER.CONFIRMATION_RESULT_INVALID": "salesOrderAttemptNotFound",
  "TRADE.SALES_ORDER.HOLD_TRANSITION_INVALID": "salesOrderHoldInvalid",
  "TRADE.SALES_ORDER.CANCEL_NOT_ALLOWED": "salesOrderCancelNotAllowed",
  "TRADE.SALES_ORDER.CUSTOMER_BLOCKED": "salesOrderCustomerBlocked",
  "TRADE.SALES_ORDER.SOURCE_INVALID": "salesOrderSourceInvalid",
  "TRADE.SALES_ORDER.LINE_INVALID": "salesOrderLineInvalid",
  "TRADE.INVENTORY.NODE_INVALID": "inventoryNodeInvalid",

  // Purchase orders
  "TRADE.PURCHASE_ORDER.APPROVAL_INVALID": "purchaseOrderApprovalInvalid",
  "TRADE.PURCHASE_ORDER.CONFIRM_NOT_ALLOWED": "purchaseOrderConfirmNotAllowed",
  "TRADE.PURCHASE_ORDER.CANCEL_NOT_ALLOWED": "purchaseOrderCancelNotAllowed",
  "TRADE.PURCHASE_ORDER.SUPPLIER_INVALID": "purchaseOrderSupplierInvalid",
  "TRADE.PURCHASE_ORDER.ITEM_NOT_PURCHASABLE": "purchaseOrderItemNotPurchasable",
  "TRADE.PURCHASE_ORDER.LINE_INVALID": "purchaseOrderLineInvalid",
  "TRADE.PURCHASE_ORDER.PRICE_INVALID": "purchaseOrderPriceInvalid",
  "TRADE.PURCHASE_ORDER.RECEIVING_SCOPE_INVALID": "purchaseOrderReceivingScopeInvalid",
  "TRADE.APPROVAL.MAKER_CHECKER_REQUIRED": "approvalMakerChecker",
  "TRADE.APPROVAL.REJECTED": "approvalRejected",

  // Purchase quotations
  "TRADE.PURCHASE_QUOTATION.NOT_FOUND": "purchaseQuotationNotFound",
  "TRADE.PURCHASE_QUOTATION.DRAFT_NOT_MUTABLE": "purchaseQuotationNotMutable",
  "TRADE.PURCHASE_QUOTATION.SUPPLIER_INVALID": "purchaseQuotationSupplierInvalid",
  "TRADE.PURCHASE_QUOTATION.LINE_INVALID": "purchaseQuotationLineInvalid",
  "TRADE.PURCHASE_QUOTATION.VALIDITY_INVALID": "purchaseQuotationValidityInvalid",
  "TRADE.PURCHASE_QUOTATION.REPRICING_REQUIRED": "purchaseQuotationRepricingRequired",

  // Invoices and contracts
  "TRADE.INVOICE.NOT_FOUND": "invoiceNotFound",
  "TRADE.INVOICE.CUSTOMER_INVALID": "invoiceCustomerInvalid",
  "TRADE.INVOICE.LINE_INVALID": "invoiceLineInvalid",
  "TRADE.INVOICE.FINANCIAL_EVIDENCE_INVALID": "invoiceEvidenceInvalid",
  "TRADE.INVOICE.TRANSITION_NOT_ALLOWED": "invoiceTransition",
  "TRADE.CONTRACT.NOT_FOUND": "contractNotFound",
  "TRADE.CONTRACT.EVIDENCE_INVALID": "contractEvidenceInvalid",
  "TRADE.CONTRACT.TRANSITION_NOT_ALLOWED": "contractTransition",

  // PDF rendering. The quotation family and the business-document family carry
  // parallel codes for the same conditions.
  "TRADE.QUOTE.PDF_NOT_FOUND": "pdfNotFound",
  "TRADE.BUSINESS_DOCUMENT.PDF_NOT_FOUND": "pdfNotFound",
  "TRADE.QUOTE.PDF_REVISION_NOT_ELIGIBLE": "pdfSourceNotEligible",
  "TRADE.BUSINESS_DOCUMENT.PDF_SOURCE_NOT_ELIGIBLE": "pdfSourceNotEligible",
  "TRADE.QUOTE.PDF_TEMPLATE_INCOMPATIBLE": "pdfTemplateIncompatible",
  "TRADE.BUSINESS_DOCUMENT.PDF_TEMPLATE_INCOMPATIBLE": "pdfTemplateIncompatible",
  "TRADE.QUOTE.PDF_BUNDLE_UNAVAILABLE": "pdfBundleUnavailable",
  "TRADE.BUSINESS_DOCUMENT.PDF_BUNDLE_UNAVAILABLE": "pdfBundleUnavailable",
  "TRADE.QUOTE.PDF_ARTIFACT_UNAVAILABLE": "pdfArtifactUnavailable",
  "TRADE.BUSINESS_DOCUMENT.PDF_ARTIFACT_UNAVAILABLE": "pdfArtifactUnavailable",
  // These three are never HTTP statuses. They are written into the render-job
  // record by the worker result path and read inside the 200 body of
  // `GET …/render-jobs/:id` — see useTradePdfJob.
  "TRADE.QUOTE.PDF_INPUT_EXPIRED": "pdfInputExpired",
  "TRADE.BUSINESS_DOCUMENT.PDF_INPUT_EXPIRED": "pdfInputExpired",
  "TRADE.QUOTE.PDF_RENDER_FAILED": "pdfRenderFailed",
  "TRADE.BUSINESS_DOCUMENT.PDF_RENDER_FAILED": "pdfRenderFailed",
  "TRADE.QUOTE.PDF_RESULT_CONFLICT": "pdfResultConflict",
  "TRADE.BUSINESS_DOCUMENT.PDF_RESULT_CONFLICT": "pdfResultConflict",
  // Q36 — the Gateway's `assertPublicLocationContract` requires a `Location`
  // prefix that trade-app does not emit, so a render 202 is turned into a 502
  // at the edge and the job id never reaches the browser. A live backend
  // defect, given its own message so the failure is legible rather than
  // arriving as a generic upstream error.
  "GW.IDEM.RESPONSE_CONTRACT_BREACH": "pdfGatewayContractBreach",
};

/**
 * Codes that mean "ask again", not "you may not".
 *
 * Rendering the generic error state for one of these loses a user who only
 * needed to press the button a second time.
 */
const RETRYABLE_CODES = new Set([
  "TRADE.QUOTE.CUSTOMER_ELIGIBILITY_UNAVAILABLE",
  "TRADE.POLICY.DECISION_UNAVAILABLE",
  "TRADE.DOCUMENT_PROFILE.PUBLICATION_UNAVAILABLE",
  "TRADE.DEPENDENCY.TIMEOUT",
  "TRADE.STORAGE.UNAVAILABLE",
  "TRADE.QUOTE.PDF_BUNDLE_UNAVAILABLE",
  "TRADE.BUSINESS_DOCUMENT.PDF_BUNDLE_UNAVAILABLE",
  "TRADE.QUOTE.PDF_ARTIFACT_UNAVAILABLE",
  "TRADE.BUSINESS_DOCUMENT.PDF_ARTIFACT_UNAVAILABLE",
  // A 422 that reads like a dependency failure and is one: the number sequence
  // could not be reserved. Offering a retry is right; a validation message is
  // not.
  "TRADE.FINALIZED_DOCUMENT.NUMBERING_UNAVAILABLE",
]);

/** The message for a documented code, or undefined so the caller falls back. */
export function tradeDocumentMessage(
  code: string | undefined,
  errors: ErrorDictionary,
): string | undefined {
  if (!code) return undefined;
  const key = CODE_TO_KEY[code];
  return key ? errors[key] : undefined;
}

export function isRetryableTradeCode(code: string | undefined): boolean {
  return code !== undefined && RETRYABLE_CODES.has(code);
}

