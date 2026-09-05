import { describe, expect, it } from "vitest";
import { parseCurrencyRateLines } from "./parse-currency-rate-lines";

const messages = {
  lineFormatInvalid: "LINE_FORMAT_INVALID",
  activeFlagInvalid: "ACTIVE_FLAG_INVALID",
};

const parse = (text: string) => parseCurrencyRateLines(text, messages);

/**
 * FE-B04. This box sets billing exchange rates, so "accepted quietly" is the
 * expensive outcome, not "rejected".
 */
describe("parseCurrencyRateLines", () => {
  it("reads the documented shapes", () => {
    expect(parse("EUR,0.92\nEGP,48.5,true\nAED,3.67,FALSE")).toEqual([
      { currencyCode: "EUR", currencyUnitsPerUsd: "0.92", isActive: true },
      { currencyCode: "EGP", currencyUnitsPerUsd: "48.5", isActive: true },
      { currencyCode: "AED", currencyUnitsPerUsd: "3.67", isActive: false },
    ]);
  });

  it.each(["flase", "0", "no", "inactive", "off", "null"])(
    "refuses %s rather than reading it as active",
    (active) => {
      // Each of these used to activate the rate, because the old rule was
      // "anything that is not literally false".
      expect(() => parse(`EUR,0.92,${active}`)).toThrow("ACTIVE_FLAG_INVALID");
    },
  );

  it("refuses a line with more cells than the format has", () => {
    // Previously the fourth cell was dropped by destructuring and the line
    // accepted, so the operator never learned their input was misread.
    expect(() => parse("EUR,0.92,true,extra")).toThrow("LINE_FORMAT_INVALID");
  });

  it("still refuses a line missing the rate", () => {
    expect(() => parse("EUR")).toThrow("LINE_FORMAT_INVALID");
    expect(() => parse("EUR,")).toThrow("LINE_FORMAT_INVALID");
  });

  it("ignores blank lines and surrounding whitespace", () => {
    expect(parse("\n  EUR , 0.92 , TRUE  \n\n")).toEqual([
      { currencyCode: "EUR", currencyUnitsPerUsd: "0.92", isActive: true },
    ]);
  });
});
