import { describe, expect, it, vi } from "vitest";
import {
  createBillingIntentKeyStore,
  shouldRetainBillingIntentKey,
  stableFingerprint,
} from "./intent-keys";

describe("billing intent keys", () => {
  it("reuses a key for the same intent and rotates it when input changes", () => {
    const generate = vi.fn().mockReturnValueOnce("key-1").mockReturnValueOnce("key-2");
    const store = createBillingIntentKeyStore(generate);
    const first = stableFingerprint({ note: "reviewed", quoteId: "quote-1" });
    const reordered = stableFingerprint({ quoteId: "quote-1", note: "reviewed" });
    expect(store.get("confirm", first)).toBe("key-1");
    expect(store.get("confirm", reordered)).toBe("key-1");
    expect(store.get("confirm", stableFingerprint({ quoteId: "quote-2" }))).toBe("key-2");
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("retains keys only for ambiguous or in-flight outcomes", () => {
    expect(
      shouldRetainBillingIntentKey({ httpStatus: 503, errorCode: "HTTP_503" }),
    ).toBe(true);
    expect(
      shouldRetainBillingIntentKey({
        httpStatus: 409,
        errorCode: "GW.IDEM.IN_FLIGHT",
      }),
    ).toBe(true);
    expect(
      shouldRetainBillingIntentKey({ httpStatus: 422, errorCode: "VALIDATION" }),
    ).toBe(false);
    expect(
      shouldRetainBillingIntentKey({ httpStatus: 409, errorCode: "CONFLICT" }),
    ).toBe(false);
  });
});
