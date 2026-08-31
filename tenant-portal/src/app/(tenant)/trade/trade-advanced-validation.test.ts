import { describe, expect, it } from "vitest";
import {
  GOVERNED_CODE_PATTERN,
  INVENTORY_CODE_PATTERN,
  asOpenEnum,
  isBoundedInteger,
  isDecimalString,
  isMemberOf,
  isNonEmptyString,
  isNullableDecimalString,
  isOptionalText,
  isTimestamp,
  isUuidV7,
  parseTradeArray,
  parseTradeItemList,
  parseTradeOffsetPage,
  record,
  tradeStatusLabel,
} from "./trade-advanced-validation";

function invalid(): never {
  throw new Error("invalid");
}

describe("Trade advanced validation kernel", () => {
  it("accepts only UUID v7, which every Trade path parameter is", () => {
    expect(isUuidV7("01902001-3000-7000-8000-000000000001")).toBe(true);
    // A v4 UUID has a 4 in the version nibble and is rejected.
    expect(isUuidV7("01902001-3000-4000-8000-000000000001")).toBe(false);
    expect(isUuidV7("not-a-uuid")).toBe(false);
    expect(isUuidV7(null)).toBe(false);
  });

  it("keeps decimals as exact strings and refuses more than eight places", () => {
    expect(isDecimalString("10.50")).toBe(true);
    expect(isDecimalString("-0.00000001")).toBe(true);
    expect(isDecimalString("1.123456789")).toBe(false);
    // A number is never a decimal on the wire, even when it looks like one.
    expect(isDecimalString(10.5)).toBe(false);
    expect(isNullableDecimalString(null)).toBe(true);
    expect(isNullableDecimalString("abc")).toBe(false);
  });

  it("bounds integers and strings the way the DTOs do", () => {
    expect(isBoundedInteger(5, 0, 10)).toBe(true);
    expect(isBoundedInteger(5.5, 0, 10)).toBe(false);
    expect(isBoundedInteger(11, 0, 10)).toBe(false);
    expect(isNonEmptyString("x", 1)).toBe(true);
    expect(isNonEmptyString("", 1)).toBe(false);
    expect(isOptionalText(undefined, 5)).toBe(true);
    expect(isOptionalText("toolong", 5)).toBe(false);
  });

  it("pins the two code patterns the Create DTOs use", () => {
    expect(GOVERNED_CODE_PATTERN.test("CREDIT_LIMIT.V2")).toBe(true);
    expect(GOVERNED_CODE_PATTERN.test("lowercase")).toBe(false);
    expect(INVENTORY_CODE_PATTERN.test("PERIOD_CLOSE")).toBe(true);
    expect(INVENTORY_CODE_PATTERN.test("1BAD")).toBe(false);
  });

  it("renders an open enum as itself rather than dropping it", () => {
    // Control tower's severity and retryClass are not closed by source, so an
    // unmapped value has to survive to the screen.
    expect(tradeStatusLabel({ HIGH: "High" }, "HIGH")).toBe("High");
    expect(tradeStatusLabel({ HIGH: "High" }, "PERMANENT_SOURCE_CORRECTION")).toBe(
      "PERMANENT_SOURCE_CORRECTION",
    );
    expect(asOpenEnum("TRANSIENT")).toBe("TRANSIENT");
    expect(asOpenEnum(42)).toBeNull();
    expect(isMemberOf("A", ["A", "B"])).toBe(true);
    expect(isMemberOf("C", ["A", "B"])).toBe(false);
  });

  it("reads an offset page without inventing totalPages, hasNext or hasPrev", () => {
    const page = parseTradeOffsetPage(
      { items: [1, 2], total: 7, page: 2, limit: 25 },
      (value) => value as number,
      invalid,
    );
    expect(page).toEqual({ items: [1, 2], total: 7, page: 2, limit: 25 });
    expect(Object.keys(page)).toEqual(["items", "total", "page", "limit"]);
  });

  it("refuses a page that is missing the flat keys Trade actually sends", () => {
    // Core puts the pager in a sibling `meta`; Trade does not, and a `meta`
    // shape must not be read as a Trade page.
    expect(() =>
      parseTradeOffsetPage({ data: [], meta: { total: 0 } }, (value) => value, invalid),
    ).toThrow("invalid");
  });

  it("reads a bare array, which is what every inventory list is", () => {
    expect(parseTradeArray([{ id: 1 }], (value) => value, invalid)).toEqual([{ id: 1 }]);
    // `{ items: [...] }` is NOT the inventory shape and must not silently pass.
    expect(() => parseTradeArray({ items: [] }, (value) => value, invalid)).toThrow("invalid");
  });

  it("reads an { items } list with no total", () => {
    expect(parseTradeItemList({ items: ["a"] }, (value) => value, invalid)).toEqual(["a"]);
    expect(() => parseTradeItemList(["a"], (value) => value, invalid)).toThrow("invalid");
  });

  it("treats arrays as non-records so an array is never read as an object", () => {
    expect(record([])).toBeNull();
    expect(record({ a: 1 })).toEqual({ a: 1 });
    expect(isTimestamp("2026-08-31T00:00:00.000Z")).toBe(true);
    expect(isTimestamp("not a date")).toBe(false);
  });
});
