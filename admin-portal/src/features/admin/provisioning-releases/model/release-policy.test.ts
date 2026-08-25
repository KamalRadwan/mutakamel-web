import { describe, expect, it } from "vitest";
import {
  createReleaseIntentStore,
  shouldRetainReleaseIntent,
  stableReleaseFingerprint,
} from "./release-intents";
import { readReleasePermissions } from "./release-permissions";

describe("release-governance RBAC and command policy", () => {
  it("requires exact ALL semantics for publish and retire critical actions", () => {
    const partial = readReleasePermissions({
      isSuperAdmin: false,
      permissions: [
        "admin.provisioning.releases.read",
        "admin.provisioning.releases.publish",
        "admin.provisioning.releases.retire",
      ],
    });
    expect(partial).toEqual({
      canRead: true,
      canManageDrafts: true,
      canPublishCritical: false,
      canRetireCritical: false,
    });
    const critical = readReleasePermissions({
      isSuperAdmin: false,
      permissions: [
        "admin.provisioning.releases.publish",
        "admin.provisioning.releases.retire",
        "admin.provisioning.critical",
      ],
    });
    expect(critical.canPublishCritical).toBe(true);
    expect(critical.canRetireCritical).toBe(true);
  });

  it("reuses UUID identity only for the exact same logical command", () => {
    const keys = ["key-1", "key-2", "key-3"];
    const store = createReleaseIntentStore(() => keys.shift() ?? "unexpected");
    const first = stableReleaseFingerprint({ body: { z: 2, a: 1 } });
    const same = stableReleaseFingerprint({ body: { a: 1, z: 2 } });
    const changed = stableReleaseFingerprint({ body: { a: 2, z: 2 } });
    expect(store.get("publish", first)).toBe("key-1");
    expect(store.get("publish", same)).toBe("key-1");
    expect(store.get("publish", changed)).toBe("key-2");
    store.clear("publish");
    expect(store.get("publish", changed)).toBe("key-3");
  });

  it("retains identity only for ambiguous or explicitly retryable outcomes", () => {
    expect(shouldRetainReleaseIntent({ httpStatus: 503, errorCode: "CORE_DOWN" })).toBe(true);
    expect(shouldRetainReleaseIntent({ httpStatus: 401, errorCode: "AUTH_EXPIRED" })).toBe(true);
    expect(shouldRetainReleaseIntent({ httpStatus: 429, errorCode: "RATE_LIMIT" })).toBe(true);
    expect(shouldRetainReleaseIntent({ httpStatus: 409, errorCode: "GW.IDEM.IN_FLIGHT" })).toBe(true);
    expect(shouldRetainReleaseIntent({ httpStatus: 409, errorCode: "PROVISIONING_RELEASE_DRAFT_STALE" })).toBe(false);
    expect(shouldRetainReleaseIntent({ httpStatus: 422, errorCode: "PROVISIONING_RELEASE_SIGNATURE_INVALID" })).toBe(false);
  });
});
