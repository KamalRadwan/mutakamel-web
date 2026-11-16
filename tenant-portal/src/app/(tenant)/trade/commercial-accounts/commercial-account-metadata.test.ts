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

  it.each([
    ["9007199254740993.01", "9007199254740993.00", true],
    ["9007199254740993.00", "9007199254740993.00", false],
    ["9007199254740992.99999999", "9007199254740993.00", false],
    ["9007199254740993.00000001", "9007199254740993.00", true],
    [" 09007199254740993.000 ", "9007199254740993.0", false],
  ] as const)("compares branch %s against company %s exactly", (branch, company, exceeds) => {
    const result = validateNarrowingAgainstCompany(
      { creditLimit: branch, orderingHold: false, allowedCurrencies: [] },
      { accountRole: "CUSTOMER", creditLimit: company, terms: {} },
    );
    expect(result.exceedsCompanyCreditLimit).toBe(exceeds);
    expect(result.isValid).toBe(!exceeds);
  });

  it.each(["abc", "Infinity", "1e3", "0x10", "1.123456789", "1.2.3", "-1"])(
    "rejects invalid credit limit %s on either side",
    (invalid) => {
      for (const [branch, company] of [[invalid, "100"], ["10", invalid]] as const) {
        const result = validateNarrowingAgainstCompany(
          { creditLimit: branch, orderingHold: false, allowedCurrencies: [] },
          { accountRole: "CUSTOMER", creditLimit: company, terms: {} },
        );
        expect(result.isValid).toBe(false);
      }
    },
  );

  it("preserves optional limits while rejecting malformed input without a company ceiling", () => {
    const account = { accountRole: "CUSTOMER", creditLimit: null, terms: {} };
    for (const branch of ["", "  ", "9007199254740993.01"]) {
      expect(validateNarrowingAgainstCompany(
        { creditLimit: branch, orderingHold: false, allowedCurrencies: [] }, account,
      ).isValid).toBe(true);
    }
    expect(validateNarrowingAgainstCompany(
      { creditLimit: "abc", orderingHold: false, allowedCurrencies: [] }, account,
    ).isValid).toBe(false);
    expect(validateNarrowingAgainstCompany(
      { creditLimit: "", orderingHold: false, allowedCurrencies: [] },
      { ...account, creditLimit: "100" },
    ).isValid).toBe(true);
  });

  it("parses commercial account lookups payload safely", () => {
    const lookups = parseCommercialAccountLookups({
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
    expect(lookups).not.toHaveProperty("paymentTerms");
    expect(lookups.creditPolicies[0]?.code).toBe("trade.credit.strict_gate");
  });
});
