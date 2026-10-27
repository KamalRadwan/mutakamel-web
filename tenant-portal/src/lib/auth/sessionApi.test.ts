// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStoredTenantSessionMeta } from "../api/axiosClient";
import { listTenantAuthSessionPage, listTenantAuthSessions, revokeTenantAuthSession, type TenantAuthSessionSummary } from "./sessionApi";

describe("revokeTenantAuthSession", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns every active device alongside bounded history and reads later pages', async () => {
    const items = Array.from({ length: 125 }, (_, i) => sessionSummary(`active-${i}`, i === 0));
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ data: {
      items, endedHistory: { page: 2, pageSize: 50, hasMore: false },
    } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const page = await listTenantAuthSessionPage(2);
    expect(page.items).toHaveLength(125);
    expect(page.endedHistory).toEqual({ page: 2, pageSize: 50, hasMore: false });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("historyPage=2");
    expect(await listTenantAuthSessions()).toHaveLength(125);
  });

  it('rejects malformed ended-history metadata', async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: {
      items: [], endedHistory: { page: 0, pageSize: 50, hasMore: false },
    } }), { status: 200, headers: { "content-type": "application/json" } })));
    await expect(listTenantAuthSessionPage()).rejects.toThrow("INVALID_AUTH_SESSION_LIST");
  });

  it("publishes the current SID before clearing its local fallback", async () => {
    seedSession("session-a");
    let sessionIdAtEvent: string | null = null;
    window.addEventListener("tenant-auth-session-event", (event) => {
      const detail = (event as CustomEvent<{ sessionId: string }>).detail;
      if (detail.sessionId === "session-a") {
        sessionIdAtEvent = getStoredTenantSessionMeta()?.sessionId ?? null;
      }
    }, { once: true });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));

    await revokeTenantAuthSession(sessionSummary("session-a", true));

    expect(sessionIdAtEvent).toBe("session-a");
    expect(getStoredTenantSessionMeta()).toBeNull();
  });

  it("does not end a newer SID from a stale current-session snapshot", async () => {
    seedSession("session-b");
    const authEvents: unknown[] = [];
    window.addEventListener("tenant-auth-session-event", (event) => {
      authEvents.push((event as CustomEvent).detail);
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));

    await revokeTenantAuthSession(sessionSummary("session-a", true));

    expect(getStoredTenantSessionMeta()?.sessionId).toBe("session-b");
    expect(authEvents).toEqual([]);
  });
});

function seedSession(sessionId: string): void {
  window.sessionStorage.setItem("tenant_session_meta", JSON.stringify({
    savedAt: Date.now(),
    expiresIn: 600,
    sessionExpiresIn: 1_800,
    tokenType: "Bearer",
    sessionId,
    remember: true,
    authorizationVersion: 1,
    profileVersion: 1,
    authEventId: `event-${sessionId}`,
  }));
}

function sessionSummary(
  id: string,
  current: boolean,
): TenantAuthSessionSummary {
  return {
    id,
    clientId: "mutakamel-tenant-web",
    clientType: "WEB",
    deviceLabel: null,
    createdAt: "2026-08-26T10:00:00.000Z",
    lastRefreshAt: null,
    lastAccessIssuedAt: "2026-08-26T10:00:00.000Z",
    lastUserActivityAt: null,
    idleExpiresAt: "2026-08-26T10:30:00.000Z",
    absoluteExpiresAt: "2026-08-27T10:00:00.000Z",
    endedAt: null,
    endReason: null,
    refreshUseCount: "0",
    accessIssueCount: "1",
    credentialVersion: 1,
    sessionEpoch: 1,
    current,
  };
}
