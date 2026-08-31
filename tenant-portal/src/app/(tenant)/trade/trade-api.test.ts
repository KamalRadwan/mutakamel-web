import { describe, expect, it } from "vitest";
import { derivePageInfo, isTradeReplay, tradeErrorCode, tradeIfMatch } from "./trade-api";

// These four rules differ from Core's and each would break every Trade screen
// at once. They are pinned here because they were read from trade-app source
// (docs/api/trade-*.md), not inferred from Core.

describe("isTradeReplay", () => {
  it("treats only the literal \"true\" as a replay", () => {
    expect(isTradeReplay(new Headers({ "idempotency-replayed": "true" }))).toBe(true);
  });

  it("is false when Trade reports a FIRST execution", () => {
    // The trap: Trade sets this header itself and writes "false" on the first
    // execution, so `headers.has(...)` is true on every idempotent write.
    // Presence is not replay.
    expect(isTradeReplay(new Headers({ "idempotency-replayed": "false" }))).toBe(false);
  });

  it("is false when the header is absent", () => {
    expect(isTradeReplay(new Headers())).toBe(false);
  });
});

describe("tradeIfMatch", () => {
  it("sends the strong form", () => {
    expect(tradeIfMatch(7)).toBe('"7"');
    expect(tradeIfMatch("7")).toBe('"7"');
  });
});

describe("derivePageInfo", () => {
  it("derives the fields Trade does not send", () => {
    // Trade sends no totalPages, hasNext or hasPrev anywhere.
    const info = derivePageInfo({ items: [1, 2], total: 25, page: 2, limit: 10 });
    expect(info).toMatchObject({ totalPages: 3, hasPrev: true, hasNext: true, page: 2 });
  });

  it("closes hasNext on the last page", () => {
    expect(derivePageInfo({ items: [1], total: 21, page: 3, limit: 10 })).toMatchObject({
      totalPages: 3,
      hasNext: false,
      hasPrev: true,
    });
  });

  it("reports one page when the list is empty rather than zero", () => {
    expect(derivePageInfo({ items: [], total: 0, page: 1, limit: 20 })).toMatchObject({
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
  });

  it("defaults page to 1 for the limit-only dialect", () => {
    expect(derivePageInfo({ items: [], total: 0, limit: 20 })).toMatchObject({ page: 1 });
  });

  it("returns null for a bare array, which GET /channels sends", () => {
    expect(derivePageInfo([{ id: "a" }])).toBeNull();
  });

  it("returns null rather than guessing when the shape is not a page", () => {
    expect(derivePageInfo({ id: "a" })).toBeNull();
    expect(derivePageInfo(null)).toBeNull();
  });
});

describe("tradeErrorCode", () => {
  it("reads `code`, not Core's `errorCode`", () => {
    expect(tradeErrorCode({ code: "TRADE.CONCURRENCY.IF_MATCH_REQUIRED" })).toBe(
      "TRADE.CONCURRENCY.IF_MATCH_REQUIRED",
    );
  });

  it("does not mistake Core's key for Trade's", () => {
    expect(tradeErrorCode({ errorCode: "COMMON.SOMETHING" })).toBeNull();
  });

  it("reaches a nested error object, since Trade has no exception filter", () => {
    expect(tradeErrorCode({ error: { code: "TRADE.IMPORT.FILE_UNSAFE" } })).toBe(
      "TRADE.IMPORT.FILE_UNSAFE",
    );
  });

  it("returns null instead of a non-string", () => {
    expect(tradeErrorCode({ code: 422 })).toBeNull();
    expect(tradeErrorCode("boom")).toBeNull();
  });
});
