import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  delete: vi.fn(),
  ensureFresh: vi.fn(),
  withAuthLock: vi.fn(),
}));

vi.mock("../api/axiosClient", () => ({
  axiosClient: { get: api.get, delete: api.delete },
  ensureAdminCookieSessionFresh: api.ensureFresh,
  withAuthLock: api.withAuthLock,
  unwrapCoreData: (value: { data?: unknown }) => value.data,
}));

import { listAdminAuthSessions, revokeAdminAuthSession } from "./sessionApi";

describe("Admin auth session API", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.delete.mockReset();
    api.ensureFresh.mockReset().mockResolvedValue(undefined);
    api.withAuthLock.mockReset().mockImplementation(
      (callback: () => Promise<unknown>) => callback(),
    );
  });

  it("requests session metadata without reading or writing the browser cache", async () => {
    api.get.mockResolvedValue({
      data: {
        data: {
          items: [
            {
              id: "019f0000-0000-7000-8000-000000000001",
              clientId: "mutakamel-admin-web",
              clientType: "WEB",
              deviceLabel: "Admin browser",
              current: true,
              createdAt: "2026-08-11T10:00:00.000Z",
              lastRefreshAt: null,
              lastAccessIssuedAt: "2026-08-11T10:00:00.000Z",
              lastUserActivityAt: null,
              idleExpiresAt: "2026-08-11T10:30:00.000Z",
              absoluteExpiresAt: "2026-08-11T22:00:00.000Z",
              endedAt: null,
              endReason: null,
              refreshUseCount: "0",
              accessIssueCount: "1",
              credentialVersion: 1,
              sessionEpoch: 1,
            },
          ],
        },
      },
    });

    await expect(listAdminAuthSessions()).resolves.toHaveLength(1);
    expect(api.get).toHaveBeenCalledWith(
      "/api/admin/core/v1/auth/sessions",
      { cache: "no-store" },
    );
  });

  it("refreshes then serializes a cookie-clearing session revocation", async () => {
    api.delete.mockResolvedValue({ status: 204 });

    await revokeAdminAuthSession("session/one", true);

    expect(api.ensureFresh).toHaveBeenCalledOnce();
    expect(api.withAuthLock).toHaveBeenCalledOnce();
    expect(api.delete).toHaveBeenCalledWith(
      "/api/admin/core/v1/auth/sessions/session%2Fone",
      {
        skipAuthRefresh: true,
        skipAutoIdempotency: true,
      },
    );
    expect(api.ensureFresh.mock.invocationCallOrder[0]).toBeLessThan(
      api.delete.mock.invocationCallOrder[0],
    );
  });

  it("does not make remote-session revocation depend on refresh health", async () => {
    api.delete.mockResolvedValue({ status: 204 });

    await revokeAdminAuthSession("remote-session", false);

    expect(api.ensureFresh).not.toHaveBeenCalled();
    expect(api.withAuthLock).not.toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledWith(
      "/api/admin/core/v1/auth/sessions/remote-session",
      {
        skipAutoIdempotency: true,
        replayAfterRefresh: true,
      },
    );
  });
});
