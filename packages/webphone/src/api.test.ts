import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWebphoneApi } from "./api";
import type { WebphoneHttpClient } from "./http";

const getMock = vi.fn();
const postMock = vi.fn();
const http = { get: getMock, post: postMock } as unknown as WebphoneHttpClient;

const ADMIN_BASE = "/api/admin/webphone/v1";

describe("webphone API transport", () => {
  beforeEach(() => {
    getMock.mockReset().mockResolvedValue({ data: { data: null } });
    postMock.mockReset().mockResolvedValue({ data: { data: { id: "log" } } });
  });

  it("reads the whole runtime payload from a single /me call", async () => {
    getMock.mockResolvedValue({ data: { data: { enabled: true } } });

    const me = await createWebphoneApi(ADMIN_BASE, http).loadMe();

    expect(getMock).toHaveBeenCalledWith(`${ADMIN_BASE}/me`);
    expect(me).toEqual({ enabled: true });
  });

  it("scopes every route to the base path the portal injects", async () => {
    await createWebphoneApi("/api/tenant/webphone/v1", http).loadMe();

    expect(getMock).toHaveBeenCalledWith("/api/tenant/webphone/v1/me");
  });

  it("falls back to an empty history when the call-log payload is not a list", async () => {
    getMock.mockResolvedValue({ data: { data: null } });

    const logs = await createWebphoneApi(ADMIN_BASE, http).loadCallLogs();

    expect(getMock).toHaveBeenCalledWith(`${ADMIN_BASE}/me/call-logs`);
    expect(logs).toEqual([]);
  });

  it("opts the non-idempotent call-log route out of keys and refresh replay", async () => {
    const payload = { type: "OUT" as const, phoneNumber: "+201000000000" };

    await createWebphoneApi(ADMIN_BASE, http).createCallLog(payload);

    expect(postMock).toHaveBeenCalledWith(
      `${ADMIN_BASE}/me/call-logs`,
      payload,
      {
        skipAutoIdempotency: true,
        nonReplayable: true,
        cache: "no-store",
      },
    );
  });
});
