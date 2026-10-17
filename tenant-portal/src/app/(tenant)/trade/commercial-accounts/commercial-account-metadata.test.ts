import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ROLE_PALETTES,
  parseVisualNarrowingRules,
  parseVisualTerms,
  serializeVisualNarrowingRules,
  serializeVisualTerms,
  validateNarrowingAgainstCompany,
} from "./commercial-account-metadata";
import { parseCommercialAccountLookups } from "./hooks/useCommercialAccountLookups";

describe("commercial-account-metadata", () => {
  it("defines palettes for CUSTOMER and SUPPLIER roles", () => {
    expect(ACCOUNT_ROLE_PALETTES.CUSTOMER.role).toBe("CUSTOMER");
    expect(ACCOUNT_ROLE_PALETTES.SUPPLIER.role).toBe("SUPPLIER");
  });

  it("round-trips visual commercial terms without losing extra keys", () => {
    const raw = JSON.stringify({
      orderingHold: true,
      allowedCurrencies: ["egp", "USD"],
      customNote: "VIP",
    });
    const parsed = parseVisualTerms(raw);
    expect(parsed.orderingHold).toBe(true);
    expect(parsed.allowedCurrencies).toEqual(["EGP", "USD"]);
    expect(parsed.extraKeys).toEqual({ customNote: "VIP" });

    const serialized = JSON.parse(serializeVisualTerms(parsed)) as Record<string, unknown>;
    expect(serialized.orderingHold).toBe(true);
    expect(serialized.allowedCurrencies).toEqual(["EGP", "USD"]);
    expect(serialized.customNote).toBe("VIP");
  });

  it("validates branch narrowing rules against company credit limit and allowed currencies", () => {
    const rawRule = serializeVisualNarrowingRules({
      creditLimit: "75000",
      orderingHold: false,
      allowedCurrencies: ["EGP", "EUR"],
    });
    const parsedRule = parseVisualNarrowingRules(rawRule);

    const result = validateNarrowingAgainstCompany(parsedRule, {
      accountRole: "CUSTOMER",
      creditLimit: "50000",
      terms: { allowedCurrencies: ["EGP", "USD"] },
    });
    expect(result.exceedsCompanyCreditLimit).toBe(true);
    expect(result.disallowedCurrencies).toEqual(["EUR"]);
    expect(result.isValid).toBe(false);

    const validResult = validateNarrowingAgainstCompany(
      { creditLimit: "25000", orderingHold: true, allowedCurrencies: ["EGP"] },
      {
        accountRole: "CUSTOMER",
        creditLimit: "50000",
        terms: { allowedCurrencies: ["EGP", "USD"] },
      },
    );
    expect(validResult.isValid).toBe(true);
  });

  it("parses commercial account lookups payload safely", () => {
    const lookups = parseCommercialAccountLookups({
      paymentTerms: [{ id: "01890a5d-ac96-774b-bcce-b302099a8057", source: "existing_commercial_accounts" }],
      creditPolicies: [
        {
          id: "01890a5d-ac96-774b-bcce-b302099a8058",
          code: "trade.credit.strict_gate",
          versionNumber: 2,
          scopeTarget: "COMPANY",
          status: "PUBLISHED",
          effectiveFrom: "2026-10-01T00:00:00.000Z",
          effectiveTo: null,
        },
      ],
    });
    expect(lookups.paymentTerms.length).toBe(1);
    expect(lookups.creditPolicies[0]?.code).toBe("trade.credit.strict_gate");
  });
});
