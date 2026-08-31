import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { resolveTradeStatus, tradeStatusValues, type TradeStatusKind } from "./trade-document-status";
import { isRetryableTradeCode, tradeDocumentMessage } from "./trade-document-errors";

const KINDS: TradeStatusKind[] = [
  "TradeQuotationStatus",
  "TradeQuotationRevisionStatus",
  "TradeSalesOrderStatus",
  "TradeConfirmationStatus",
  "TradeHoldStatus",
  "TradeFulfillmentStatus",
  "TradeBillingStatus",
  "TradePurchaseOrderStatus",
  "TradeApprovalStatus",
  "TradePurchaseQuotationStatus",
  "TradeInvoiceStatus",
  "TradeContractStatus",
  "TradeRenderJobStatus",
];

describe("the Trade status vocabulary", () => {
  // AGENTS.md: every enum value rendered needs a label, and a raw wire value is
  // never displayed. This is the only thing that keeps that true as the sets
  // grow.
  it("has an English and an Arabic label for every documented value", () => {
    for (const kind of KINDS) {
      for (const value of tradeStatusValues(kind)) {
        expect(en.statusValues[`${kind}.${value}`], `${kind}.${value} (en)`).toBeTruthy();
        expect(ar.statusValues[`${kind}.${value}`], `${kind}.${value} (ar)`).toBeTruthy();
      }
    }
  });

  it("separates an unknown value from a known one with no tone", () => {
    // Three Trade status fields are free strings with no enum and no check
    // constraint (Q31), so a value outside the documented set is possible and
    // must render as unknown rather than be swallowed.
    expect(resolveTradeStatus("TradeQuotationStatus", "DRAFT")).toEqual({ known: true, role: null });
    expect(resolveTradeStatus("TradeQuotationStatus", "SOMETHING_NEW")).toEqual({
      known: false,
      role: null,
    });
  });

  it("gives an outcome a hue and a process position none", () => {
    expect(resolveTradeStatus("TradeQuotationStatus", "ACCEPTED").role).toBe("positive");
    expect(resolveTradeStatus("TradeQuotationStatus", "REJECTED").role).toBe("negative");
    expect(resolveTradeStatus("TradeQuotationStatus", "SENT").role).toBeNull();
  });

  it("carries CLOSED, which is exported and never assigned, as a renderable value", () => {
    expect(resolveTradeStatus("TradeSalesOrderStatus", "CLOSED").known).toBe(true);
  });

  it("carries SIGNED, which the check constraint allows and no route writes", () => {
    expect(resolveTradeStatus("TradeContractStatus", "SIGNED").known).toBe(true);
  });

  it("has all six approval values, four of which the order row can hold", () => {
    expect(tradeStatusValues("TradeApprovalStatus")).toEqual([
      "NOT_REQUIRED",
      "PENDING",
      "APPROVED",
      "REJECTED",
      "WITHDRAWN",
      "EXPIRED",
    ]);
  });
});

describe("error codes", () => {
  it("resolves a documented code to a message in both dictionaries", () => {
    expect(tradeDocumentMessage("TRADE.QUOTE.EXPIRED", en.tradeDocuments.errors)).toBeTruthy();
    expect(tradeDocumentMessage("TRADE.QUOTE.EXPIRED", ar.tradeDocuments.errors)).toBeTruthy();
  });

  it("returns undefined for a code with no throw site, so no dead branch renders", () => {
    // `QUOTE_ALREADY_CONVERTED` is in TRADE_ERROR_CODES and thrown nowhere.
    expect(
      tradeDocumentMessage("TRADE.QUOTE.ALREADY_CONVERTED", en.tradeDocuments.errors),
    ).toBeUndefined();
  });

  it("treats the three PDF 503s as retryable, not as refusals", () => {
    expect(isRetryableTradeCode("TRADE.QUOTE.PDF_BUNDLE_UNAVAILABLE")).toBe(true);
    expect(isRetryableTradeCode("TRADE.BUSINESS_DOCUMENT.PDF_ARTIFACT_UNAVAILABLE")).toBe(true);
    expect(isRetryableTradeCode("TRADE.POLICY.DECISION_UNAVAILABLE")).toBe(true);
  });

  it("treats a numbering failure as retryable even though it is a 422", () => {
    expect(isRetryableTradeCode("TRADE.FINALIZED_DOCUMENT.NUMBERING_UNAVAILABLE")).toBe(true);
  });

  it("does not offer a retry for a refused transition", () => {
    expect(isRetryableTradeCode("TRADE.QUOTE.TRANSITION_NOT_ALLOWED")).toBe(false);
  });

  it("names the Gateway PDF contract breach, which is a live backend defect", () => {
    expect(
      tradeDocumentMessage("GW.IDEM.RESPONSE_CONTRACT_BREACH", en.tradeDocuments.errors),
    ).toBeTruthy();
  });
});
