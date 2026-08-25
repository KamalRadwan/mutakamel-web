import { describe, expect, it, vi } from "vitest";
import {
  createTenantIntentKeyStore,
  shouldRetainTenantIntentKey,
} from "./intent-keys";

describe("tenant caller-owned idempotency intent keys", () => {
  it("keeps one key for the same stable semantic intent", () => {
    const generate = vi
      .fn()
      .mockReturnValueOnce("key-1")
      .mockReturnValueOnce("key-2");
    const store = createTenantIntentKeyStore(generate);

    expect(store.get("profile", { b: 2, a: { y: 2, x: 1 } })).toBe("key-1");
    expect(store.get("profile", { a: { x: 1, y: 2 }, b: 2 })).toBe("key-1");
    expect(generate).toHaveBeenCalledOnce();
  });

  it("rotates on changed intent, explicit clear, scope, and route clear", () => {
    let sequence = 0;
    const store = createTenantIntentKeyStore(() => `key-${++sequence}`);

    expect(store.get("profile", { value: "A" })).toBe("key-1");
    expect(store.get("profile", { value: "B" })).toBe("key-2");
    expect(store.get("delete", { value: "B" })).toBe("key-3");
    store.clear("profile");
    expect(store.get("profile", { value: "B" })).toBe("key-4");
    store.clearAll();
    expect(store.get("delete", { value: "B" })).toBe("key-5");
  });

  it.each([
    [500, "TEMPORARY", true],
    [503, "TEMPORARY", true],
    [401, "UNAUTHENTICATED", true],
    [429, "RATE_LIMITED", true],
    [409, "GW.IDEM.IN_FLIGHT", true],
    [409, "TENANT_UPDATE_STALE", false],
    [403, "FORBIDDEN", false],
    [400, "INVALID", false],
  ])(
    "maps retry ambiguity for HTTP %s / %s",
    (httpStatus, errorCode, retained) => {
      expect(shouldRetainTenantIntentKey({ httpStatus, errorCode })).toBe(
        retained,
      );
    },
  );
});
