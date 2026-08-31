import { describe, expect, it } from "vitest";
import {
  hasValidLocaleKeys,
  isRowVersion,
  isTradeDecimalString,
  parseTradePage,
  tradeLocalizedName,
} from "./trade-validation";

describe("isTradeDecimalString", () => {
  it("accepts the shapes trade-app's DTO regex accepts", () => {
    expect(isTradeDecimalString("0")).toBe(true);
    expect(isTradeDecimalString("10")).toBe(true);
    // `fixedDecimalText` strips trailing zeros, so this is what 10.50 looks
    // like on the wire.
    expect(isTradeDecimalString("10.5")).toBe(true);
    expect(isTradeDecimalString("1.12345678")).toBe(true);
  });

  it("rejects what the server rejects with a 400", () => {
    expect(isTradeDecimalString("010")).toBe(false);
    expect(isTradeDecimalString("10.")).toBe(false);
    expect(isTradeDecimalString("")).toBe(false);
    expect(isTradeDecimalString("1.123456789")).toBe(false);
    // A JSON number is a 400 on every money field in Trade.
    expect(isTradeDecimalString(10.5)).toBe(false);
  });
});

describe("isRowVersion", () => {
  it("rejects 0, which no Trade row can hold", () => {
    // `@VersionColumn` starts at 1, and `parseExpectedVersion` refuses 0
    // everywhere except the company-default price-book upsert, where it is a
    // REQUEST value and never a response one.
    expect(isRowVersion(0)).toBe(false);
    expect(isRowVersion(1)).toBe(true);
  });
});

describe("tradeLocalizedName", () => {
  it("prefers the active language", () => {
    expect(tradeLocalizedName({ ar: "قطعة", en: "Piece" }, "ar")).toBe("قطعة");
    expect(tradeLocalizedName({ ar: "قطعة", en: "Piece" }, "en")).toBe("Piece");
  });

  it("falls back to the other language rather than rendering blank", () => {
    expect(tradeLocalizedName({ en: "Piece" }, "ar")).toBe("Piece");
  });

  it("accepts a regional locale for the same language", () => {
    expect(tradeLocalizedName({ "ar-EG": "قطعة" }, "ar")).toBe("قطعة");
  });

  it("falls through to any populated locale — the set need not contain ar or en", () => {
    expect(tradeLocalizedName({ fr: "Pièce" }, "en")).toBe("Pièce");
    expect(tradeLocalizedName({}, "en")).toBe("");
  });
});

describe("hasValidLocaleKeys", () => {
  it("mirrors normalizeLocalizedNames' own bounds", () => {
    expect(hasValidLocaleKeys({ ar: "قطعة" })).toBe(true);
    expect(hasValidLocaleKeys({ "ar-EG": "قطعة" })).toBe(true);
    expect(hasValidLocaleKeys({})).toBe(false);
    expect(hasValidLocaleKeys({ arabic: "قطعة" })).toBe(false);
    expect(hasValidLocaleKeys({ ar: "   " })).toBe(false);
  });
});

describe("parseTradePage", () => {
  it("derives the pager fields Trade never sends", () => {
    const page = parseTradePage(
      { items: [{ id: "a" }], total: 3, page: 1, limit: 2 },
      (value) => value as { id: string },
      () => {
        throw new Error("unreachable");
      },
    );
    expect(page).toMatchObject({ total: 3, page: 1, limit: 2, totalPages: 2, hasNext: true });
  });

  it("refuses a bare array — GET /channels needs its own parser", () => {
    expect(() =>
      parseTradePage(
        [{ id: "a" }],
        (value) => value,
        () => {
          throw new Error("invalid");
        },
      ),
    ).toThrow("invalid");
  });
});
