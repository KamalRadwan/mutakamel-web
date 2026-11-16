import { afterEach, describe, expect, it, vi } from "vitest";
import { buildShareRequest, parseSharesResponse } from "./share-contract";

const target = { subjectType: "USER", subjectId: "01900300-0000-7000-8000-000000000001", accessLevel: "VIEW" } as const;
afterEach(() => vi.useRealTimers());

describe("dashboard and widget share expiry", () => {
  it("omits empty expiry and preserves a future instant exactly", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-11-03T14:00:00Z");
    expect(buildShareRequest({ ...target, expiresAt: "  " })).not.toHaveProperty("expiresAt");
    expect(buildShareRequest({ ...target, expiresAt: "2026-11-30T17:00:00+02:00" }))
      .toMatchObject({ ...target, expiresAt: "2026-11-30T15:00:00.000Z" });
  });

  it.each(["2026-11-03T13:59:59Z", "2026-11-03T14:00:00Z", "not-a-date"])("rejects expired or invalid expiry %s", (expiresAt) => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-11-03T14:00:00Z");
    expect(() => buildShareRequest({ ...target, expiresAt })).toThrow("CRM_SHARE_EXPIRY_INVALID");
  });

  it("does not turn an invalid returned expiry into permanent access", () => {
    const share = { ...target, id: "01900300-0000-7000-8000-000000000002", createdAt: "2026-10-01T10:00:00Z" };
    expect(() => parseSharesResponse([{ ...share, expiresAt: "invalid" }])).toThrow();
    // Previously granted access can have expired; only new grants require a future expiry.
    expect(parseSharesResponse([{ ...share, expiresAt: "2026-10-02T10:00:00Z" }])[0].expiresAt)
      .toBe("2026-10-02T10:00:00Z");
  });
});
