import { describe, expect, it } from "vitest";
import {
  clearIntentIdempotencyKey,
  isAmbiguousWriteError,
  isStaleVersionError,
  resolveIntentIdempotencyKey,
} from "./idempotent-mutation";

describe("write recovery transport contract regression", () => {
  it("treats client timeouts as unknown outcomes and retains the original identity", () => {
    expect(isAmbiguousWriteError({ status: 0 })).toBe(true);
    expect(isAmbiguousWriteError({ status: 504, code: "CLIENT_REQUEST_TIMEOUT" })).toBe(true);
    expect(isAmbiguousWriteError({ status: 409, code: "GW.IDEM.IN_FLIGHT" })).toBe(true);
    expect(isAmbiguousWriteError({ status: 409, code: "IDEMPOTENCY_REQUEST_PROCESSING" })).toBe(true);
  });
  it("distinguishes a definite validation failure from optimistic concurrency", () => {
    expect(isAmbiguousWriteError({ status: 422, code: "VALIDATION_FAILED" })).toBe(false);
    expect(isStaleVersionError({ status: 409, code: "TRADE.CONCURRENCY.STALE_VERSION" })).toBe(true);
    expect(isStaleVersionError({ status: 409, code: "GW.IDEM.IN_FLIGHT" })).toBe(false);
  });
  it("reuses a UUIDv7 for the same logical intent until a definite completion", () => {
    const store = new Map<string, string>();
    const first = resolveIntentIdempotencyKey(store, "clone:book:body");
    expect(first).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u);
    expect(resolveIntentIdempotencyKey(store, "clone:book:body")).toBe(first);
    expect(resolveIntentIdempotencyKey(store, "clone:book:other-body")).not.toBe(first);
    clearIntentIdempotencyKey(store, "clone:book:body");
    expect(resolveIntentIdempotencyKey(store, "clone:book:body")).not.toBe(first);
  });
});
