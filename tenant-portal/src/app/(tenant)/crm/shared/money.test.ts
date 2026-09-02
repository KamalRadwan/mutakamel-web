import { describe, expect, it } from "vitest";
import {
  MONEY_MAX_AMOUNT,
  MONEY_MAX_INTEGER_DIGITS,
  MONEY_OUT_OF_RANGE,
  isExactMoneyDecimal,
  toMoneyWireNumber,
} from "./money";

describe("CRM money conversion", () => {
  it("keeps an empty box out of the request rather than sending zero", () => {
    expect(isExactMoneyDecimal("")).toBe(true);
    expect(isExactMoneyDecimal("   ")).toBe(true);
    expect(toMoneyWireNumber("")).toBeUndefined();
    expect(toMoneyWireNumber("  ")).toBeUndefined();
  });

  it.each([
    ["0", 0],
    ["0.01", 0.01],
    ["12.5", 12.5],
    ["1234567890.12", 1234567890.12],
    [MONEY_MAX_AMOUNT, 9999999999999.99],
  ])("converts %s exactly", (input, expected) => {
    expect(isExactMoneyDecimal(input)).toBe(true);
    expect(toMoneyWireNumber(input)).toBe(expected);
  });

  // D3: the values the old 15-integer-digit guard accepted and corrupted.
  it.each([
    // 999_999_999_999_999.99 arrived as 1_000_000_000_000_000 — a whole unit
    // conceived out of nothing.
    "999999999999999.99",
    // 99_999_999_999_999.99 lost a cent.
    "99999999999999.99",
    // One digit over the limit, on a round number that still cannot round-trip
    // with cents attached.
    "10000000000000.01",
  ])("refuses %s instead of silently rewriting it", (input) => {
    expect(isExactMoneyDecimal(input)).toBe(false);
    expect(() => toMoneyWireNumber(input)).toThrow(MONEY_OUT_OF_RANGE);
  });

  it("draws the boundary at the last exactly-representable amount", () => {
    expect(MONEY_MAX_AMOUNT.split(".")[0]).toHaveLength(MONEY_MAX_INTEGER_DIGITS);
    expect(isExactMoneyDecimal(MONEY_MAX_AMOUNT)).toBe(true);
    // One integer digit further is where the cents start disappearing.
    expect(isExactMoneyDecimal("99999999999999.99")).toBe(false);
  });

  it.each([
    ["-1.00", "a negative amount the DTO's @Min(0) would refuse"],
    ["1.234", "three decimal places"],
    ["1e3", "exponential notation"],
    ["1,000.00", "a thousands separator"],
    ["abc", "text"],
    [".5", "a missing integer part"],
    ["1.", "a trailing separator"],
    ["Infinity", "a non-finite literal"],
  ])("rejects %s (%s)", (input) => {
    expect(isExactMoneyDecimal(input)).toBe(false);
    expect(() => toMoneyWireNumber(input)).toThrow(MONEY_OUT_OF_RANGE);
  });

  // The property the whole module exists for: whatever this accepts, the JSON
  // body carries back the same decimal. `JSON.stringify` and `String` share the
  // shortest-round-trip algorithm, so this is the wire form, not a proxy for it.
  it("round-trips every accepted amount through JSON unchanged", () => {
    const samples: string[] = ["0.00", "0.10", "7.07"];
    for (let digits = 1; digits <= MONEY_MAX_INTEGER_DIGITS; digits += 1) {
      const nines = "9".repeat(digits);
      samples.push(nines, `${nines}.99`, `${nines}.01`, `${"1".repeat(digits)}.23`);
    }
    // A deterministic spread of cents across the whole accepted range.
    for (let step = 0; step < 400; step += 1) {
      const whole = String((step * 7919 * 3_571_113) % 10_000_000_000_000);
      samples.push(`${whole}.${String(step % 100).padStart(2, "0")}`);
    }

    for (const sample of samples) {
      expect(isExactMoneyDecimal(sample)).toBe(true);
      // The literal bytes of the request body, read back as cents by string
      // arithmetic that never touches a float.
      const wire = JSON.stringify({ amount: toMoneyWireNumber(sample) });
      const emitted = /"amount":([^},]+)/.exec(wire)?.[1] ?? "";
      expect(exactCents(emitted)).toBe(exactCents(sample));
    }
  });
});

/**
 * Minor units read off a decimal string by concatenating digits — no
 * multiplication, no float. The result is at most 15 digits inside the accepted
 * range, so the single `Number()` on an integer literal is itself exact.
 */
function exactCents(value: string): number {
  const [whole, fraction = ""] = value.split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) {
    throw new Error(`Not a plain decimal: ${value}`);
  }
  const cents = Number(`${whole}${fraction.padEnd(2, "0").slice(0, 2)}`);
  if (!Number.isSafeInteger(cents)) throw new Error(`Unsafe cents: ${value}`);
  return cents;
}
