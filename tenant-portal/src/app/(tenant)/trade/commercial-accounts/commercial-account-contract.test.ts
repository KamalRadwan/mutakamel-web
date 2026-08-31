import { describe, expect, it } from "vitest";
import {
  buildCreateAccountRequest,
  buildCreditRequest,
  buildUpdateAccountRequest,
  EMPTY_ACCOUNT_FORM,
  parseAccountResponse,
  parseCreditDecision,
  toAccountForm,
  type CommercialAccount,
} from "./commercial-account-contract";

const ACCOUNT_ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const PARTY_ID = "01890a5d-ac96-774b-bcce-b302099a8058";
const COMPANY_ID = "01890a5d-ac96-774b-bcce-b302099a8059";

const row = {
  id: ACCOUNT_ID,
  partyId: PARTY_ID,
  companyId: COMPANY_ID,
  accountRole: "CUSTOMER",
  paymentTermsId: null,
  creditLimit: "10.5",
  creditCurrencyCode: "EGP",
  priceBookId: null,
  creditPolicyVersionId: null,
  terms: {},
  status: "ACTIVE",
  blockReasonCode: null,
  version: 4,
  updatedAt: "2026-08-31T09:00:00.000Z",
};

describe("buildCreateAccountRequest", () => {
  it("requires a party id", () => {
    expect(() => buildCreateAccountRequest(EMPTY_ACCOUNT_FORM)).toThrow("ACCOUNT_FORM_PARTY");
  });

  it("accepts a decimal string with at most eight places", () => {
    const request = buildCreateAccountRequest({
      ...EMPTY_ACCOUNT_FORM,
      partyId: PARTY_ID,
      creditLimit: "1000.12345678",
      creditCurrencyCode: "egp",
    });
    expect(request.creditLimit).toBe("1000.12345678");
    expect(request.creditCurrencyCode).toBe("EGP");
  });

  it("rejects a limit with nine decimal places", () => {
    expect(() =>
      buildCreateAccountRequest({
        ...EMPTY_ACCOUNT_FORM,
        partyId: PARTY_ID,
        creditLimit: "1.123456789",
      }),
    ).toThrow("ACCOUNT_FORM_CREDIT");
  });

  it("rejects a currency that is not three uppercase letters", () => {
    expect(() =>
      buildCreateAccountRequest({
        ...EMPTY_ACCOUNT_FORM,
        partyId: PARTY_ID,
        creditCurrencyCode: "EG",
      }),
    ).toThrow("ACCOUNT_FORM_CURRENCY");
  });
});

describe("buildUpdateAccountRequest", () => {
  it("never sends partyId or accountRole — neither is in UpdateCommercialAccountDto", () => {
    const account: CommercialAccount = { ...row, accountRole: "CUSTOMER" };
    const request = buildUpdateAccountRequest(toAccountForm(account));
    expect("partyId" in request).toBe(false);
    expect("accountRole" in request).toBe(false);
  });

  it("omits `terms` when empty, which leaves the stored value alone on update", () => {
    const request = buildUpdateAccountRequest({ ...EMPTY_ACCOUNT_FORM, terms: "" });
    expect("terms" in request).toBe(false);
  });
});

describe("buildCreditRequest", () => {
  it("requires both an amount and a currency", () => {
    expect(buildCreditRequest("250", "egp")).toEqual({
      proposedAmount: "250",
      currencyCode: "EGP",
    });
    expect(() => buildCreditRequest("", "EGP")).toThrow("CREDIT_FORM_AMOUNT");
  });
});

describe("parseAccountResponse", () => {
  it("keeps the credit limit as the exact string the server sent", () => {
    // `fixedDecimalText` strips trailing zeros, so a stored 10.50 arrives as
    // "10.5" — re-padding it would break a comparison against the server.
    expect(parseAccountResponse(row).creditLimit).toBe("10.5");
  });

  it("refuses a JS number where a decimal string is required", () => {
    expect(() => parseAccountResponse({ ...row, creditLimit: 10.5 })).toThrow(
      /Invalid Trade commercial account/u,
    );
  });
});

describe("parseCreditDecision", () => {
  it("reads the decision out of the receipt's `result`, not the receipt itself", () => {
    const decision = parseCreditDecision({
      id: ACCOUNT_ID,
      explanation: "Within limit.",
      result: {
        outcome: "ALLOW",
        reasonCode: "CREDIT_WITHIN_LIMIT",
        currencyCode: "EGP",
        orderingHold: false,
        proposedAmount: "250",
        effectiveLimit: "1000",
        exposureAmount: "100",
        remainingAmount: "650",
        asOf: "2026-08-31T09:00:00.000Z",
      },
    });
    expect(decision).toMatchObject({
      receiptId: ACCOUNT_ID,
      outcome: "ALLOW",
      remainingAmount: "650",
    });
  });

  it("accepts an unlimited account, where every money field but the proposal is null", () => {
    const decision = parseCreditDecision({
      id: ACCOUNT_ID,
      explanation: "No limit.",
      result: {
        outcome: "ALLOW",
        reasonCode: "ACCOUNT_ACTIVE_UNLIMITED",
        currencyCode: "EGP",
        orderingHold: false,
        proposedAmount: "250",
        effectiveLimit: null,
        exposureAmount: null,
        remainingAmount: null,
        asOf: null,
      },
    });
    expect(decision.effectiveLimit).toBeNull();
    expect(decision.asOf).toBeNull();
  });
});
