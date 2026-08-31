import { describe, expect, it } from "vitest";
import {
  DECIMAL_ZERO,
  NON_NEGATIVE_DECIMAL,
  POSITIVE_DECIMAL,
  SIGNED_DECIMAL,
  addFixedDecimal,
  canonicalizeDecimalInput,
  compareFixedDecimal,
  fixedDecimalText,
  fixedDecimalUnits,
  isCanonicalDecimal,
  multiplyFixedDecimal,
  subtractFixedDecimal,
  sumFixedDecimals,
} from "./fixed-decimal";

// Every expectation here is the behaviour of trade-app's own
// src/common/fixed-decimal.ts. If one of these ever needs changing, the port
// has drifted from the referee and every create form is submitting figures the
// server will refuse.
describe("fixedDecimalUnits", () => {
  it("scales to 1e-8 units", () => {
    expect(fixedDecimalUnits("1")).toBe(BigInt("100000000"));
    expect(fixedDecimalUnits("0.00000001")).toBe(BigInt(1));
    expect(fixedDecimalUnits("-2.5")).toBe(BigInt("-250000000"));
  });

  it("keeps full precision past 2^53, where Number cannot", () => {
    expect(fixedDecimalUnits("9007199254740993.15")).toBe(BigInt("900719925474099315000000"));
  });

  it("rejects more than eight decimal places, a missing whole part, and non-digits", () => {
    expect(() => fixedDecimalUnits("1.123456789")).toThrow();
    expect(() => fixedDecimalUnits(".5")).toThrow();
    expect(() => fixedDecimalUnits("1e3")).toThrow();
  });
});

describe("fixedDecimalText", () => {
  // MASTER-PLAN 11.21's first trap.
  it("strips trailing zeros, so 10.50 is never the wire form", () => {
    expect(fixedDecimalText(fixedDecimalUnits("10.50"))).toBe("10.5");
    expect(fixedDecimalText(fixedDecimalUnits("10.00"))).toBe("10");
    expect(fixedDecimalText(BigInt(0))).toBe("0");
  });

  it("never emits a negative zero", () => {
    expect(fixedDecimalText(-BigInt(0))).toBe("0");
    expect(subtractFixedDecimal("1", "1")).toBe(DECIMAL_ZERO);
  });
});

describe("arithmetic", () => {
  it("adds and subtracts exactly", () => {
    expect(addFixedDecimal("0.1", "0.2")).toBe("0.3");
    expect(subtractFixedDecimal("0.3", "0.1")).toBe("0.2");
    expect(sumFixedDecimals(["0.1", "0.2", "0.3"])).toBe("0.6");
  });

  it("multiplies with half-up rounding on the magnitude", () => {
    expect(multiplyFixedDecimal("3", "10.5")).toBe("31.5");
    // 0.000000005 rounds away from zero in both directions.
    expect(multiplyFixedDecimal("0.0000001", "0.05")).toBe("0.00000001");
    expect(multiplyFixedDecimal("-0.0000001", "0.05")).toBe("-0.00000001");
  });

  it("compares numerically, so padding does not change the order", () => {
    expect(compareFixedDecimal("10.5", "10.50")).toBe(0);
    expect(compareFixedDecimal("10.5", "10.51")).toBe(-1);
    expect(compareFixedDecimal("-1", "1")).toBe(-1);
  });
});

describe("the DTO patterns", () => {
  it("accepts only canonical non-negative decimals", () => {
    expect(isCanonicalDecimal("10.5", NON_NEGATIVE_DECIMAL)).toBe(true);
    expect(isCanonicalDecimal("10.50", NON_NEGATIVE_DECIMAL)).toBe(false);
    expect(isCanonicalDecimal("007", NON_NEGATIVE_DECIMAL)).toBe(false);
    expect(isCanonicalDecimal("-1", NON_NEGATIVE_DECIMAL)).toBe(false);
  });

  it("allows a negative rounding only under the signed pattern", () => {
    expect(isCanonicalDecimal("-0.05", SIGNED_DECIMAL)).toBe(true);
    expect(isCanonicalDecimal("-0.05", NON_NEGATIVE_DECIMAL)).toBe(false);
  });

  it("refuses a zero quantity under the positive pattern", () => {
    expect(isCanonicalDecimal("0", POSITIVE_DECIMAL)).toBe(false);
    expect(isCanonicalDecimal("0.00000000", POSITIVE_DECIMAL)).toBe(false);
    expect(isCanonicalDecimal("0.00000001", POSITIVE_DECIMAL)).toBe(true);
  });
});

describe("canonicalizeDecimalInput", () => {
  it("turns typed input into the form the DTO accepts", () => {
    expect(canonicalizeDecimalInput(" 10.50 ")).toBe("10.5");
    expect(canonicalizeDecimalInput("007")).toBe("7");
    expect(canonicalizeDecimalInput("1.")).toBe("1");
    expect(canonicalizeDecimalInput(".5")).toBe("0.5");
    expect(canonicalizeDecimalInput("-.5")).toBe("-0.5");
  });

  it("returns null for anything that is not a decimal at all", () => {
    expect(canonicalizeDecimalInput("")).toBeNull();
    expect(canonicalizeDecimalInput("abc")).toBeNull();
    expect(canonicalizeDecimalInput("1.123456789")).toBeNull();
    expect(canonicalizeDecimalInput("-")).toBeNull();
  });
});
