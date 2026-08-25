import { beforeEach, describe, expect, it, vi } from "vitest";

const { uuidMock } = vi.hoisted(() => ({ uuidMock: vi.fn() }));
vi.mock("@/lib/utils/uuid", () => ({ generateUUIDv7: uuidMock }));

import { TenantAccessCommandIdentities, stableSerialize } from "./command-identities";

describe("tenant access command identities", () => {
  beforeEach(() => {
    uuidMock.mockReset().mockReturnValueOnce("key-1").mockReturnValueOnce("key-2").mockReturnValueOnce("key-3");
  });

  it("reuses an identity for an exact retry regardless of object key order", () => {
    const store = new TenantAccessCommandIdentities();
    expect(store.keyFor({ action: "invite", body: { email: "a", firstName: "A" } })).toBe("key-1");
    expect(store.keyFor({ body: { firstName: "A", email: "a" }, action: "invite" })).toBe("key-1");
    expect(uuidMock).toHaveBeenCalledTimes(1);
  });

  it("uses a fresh identity after payload change or successful completion", () => {
    const store = new TenantAccessCommandIdentities();
    const intent = { action: "invite", body: { email: "a" } };
    expect(store.keyFor(intent)).toBe("key-1");
    expect(store.keyFor({ action: "invite", body: { email: "b" } })).toBe("key-2");
    store.complete(intent);
    expect(store.keyFor(intent)).toBe("key-3");
  });

  it("rejects cyclic command payloads", () => {
    const value: Record<string, unknown> = {};
    value.self = value;
    expect(() => stableSerialize(value)).toThrow("CYCLIC_TENANT_ACCESS_COMMAND");
  });
});
