// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStoredTenantSessionMeta } from "../api/axiosClient";
import { revokeTenantAuthSession, type TenantAuthSessionSummary } from "./sessionApi";

describe("revokeTenantAuthSession", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
