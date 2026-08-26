// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("tenant browser session coordination", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    window.localStorage.clear();
    window.sessionStorage.clear();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    vi.spyOn(document, "cookie", "get").mockReturnValue(
      "__Host-mutakamel-tenant-csrf=csrf-proof",
    );
    installImmediateWebLock();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("bounds a hung direct activity checkpoint without ending the session", async () => {
    const addListener = vi.spyOn(window, "addEventListener");
    const consoleWarning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const api = await import("./axiosClient");
    await seedSession(api, "session-a");
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Request aborted", "AbortError"));
        }, { once: true });
      }));
    vi.stubGlobal("fetch", fetchMock);
    const stop = api.startTenantActivityTracking();

    emitTrustedPointer(addListener);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(consoleWarning).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(consoleWarning).toHaveBeenCalledWith(
      "Tenant activity checkpoint failed.",
      expect.objectContaining({ code: "ACTIVITY_CHECKPOINT_UNAVAILABLE" }),
    );
    expect(api.getStoredTenantSessionMeta()?.sessionId).toBe("session-a");
    expect((await import("../auth/sessionCoordinator"))
      .readLatestTenantAuthEvent()).toMatchObject({ kind: "session-updated" });
    stop();
  });

  it("refreshes expired access once and replays activity without idempotency bloat", async () => {
    const addListener = vi.spyOn(window, "addEventListener");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const api = await import("./axiosClient");
    await seedSession(api, "session-a");
    let activityCalls = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/tenant/core/v1/auth/refresh") {
        return jsonResponse(webAuthResponse("session-a"));
      }
      if (url === "/api/tenant/core/v1/auth/activity") {
        activityCalls += 1;
        const headers = new Headers(init?.headers);
        expect(headers.get("x-auth-user-activity")).toBe("1");
        expect(headers.get("x-csrf-token")).toBe("csrf-proof");
        expect(headers.has("x-idempotency-key")).toBe(false);
        return activityCalls === 1
          ? jsonResponse({ code: "TOKEN_EXPIRED" }, 401)
          : new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const stop = api.startTenantActivityTracking();

    emitTrustedPointer(addListener);
    await vi.advanceTimersByTimeAsync(0);

    expect(activityCalls).toBe(2);
    expect(fetchMock.mock.calls.filter(([url]) =>
      url === "/api/tenant/core/v1/auth/refresh"
    )).toHaveLength(1);
    expect(api.getStoredTenantSessionMeta()).toMatchObject({
      sessionId: "session-a",
      expiresIn: 600,
    });
    stop();
  });

  it("rejects an activity success completed for an obsolete SID", async () => {
    const addListener = vi.spyOn(window, "addEventListener");
    const consoleWarning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const api = await import("./axiosClient");
    await seedSession(api, "session-a");
    let resolveActivity!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => {
      resolveActivity = resolve;
    })));
    const stop = api.startTenantActivityTracking();

    emitTrustedPointer(addListener);
    await vi.advanceTimersByTimeAsync(0);
    await seedSession(api, "session-b");
    resolveActivity(new Response(null, { status: 204 }));

    await vi.waitFor(() => expect(consoleWarning).toHaveBeenCalledWith(
        "Tenant activity checkpoint failed.",
        expect.objectContaining({ code: "AUTH_SESSION_CHANGED", status: 409 }),
      ));
    expect(api.getStoredTenantSessionMeta()?.sessionId).toBe("session-b");
    stop();
  });

  it.each([403, 503])(
    "keeps %s activity failures silent and retains the exact session",
    async (status) => {
      const addListener = vi.spyOn(window, "addEventListener");
      const consoleWarning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const api = await import("./axiosClient");
      await seedSession(api, "session-a");
      const toastEvents: unknown[] = [];
      const authEvents: unknown[] = [];
      window.addEventListener("global-toast", (event) => {
        toastEvents.push((event as CustomEvent).detail);
      });
      window.addEventListener("tenant-auth-session-event", (event) => {
        authEvents.push((event as CustomEvent).detail);
      });
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(
        { code: status === 403 ? "FORBIDDEN" : "UNAVAILABLE" },
        status,
      )));
      const stop = api.startTenantActivityTracking();

      emitTrustedPointer(addListener);
      await vi.waitFor(() => expect(consoleWarning).toHaveBeenCalled());

      expect(toastEvents).toEqual([]);
      expect(authEvents).toEqual([]);
      expect(api.getStoredTenantSessionMeta()?.sessionId).toBe("session-a");
      stop();
    },
  );

  it("rejects a delayed successful response after an exact-SID tombstone", async () => {
    const api = await import("./axiosClient");
    const coordinator = await import("../auth/sessionCoordinator");
    await seedSession(api, "session-a");
    let resolveRequest!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    })));
    const request = api.customTenantFetch("/api/tenant/core/v1/data");
    await Promise.resolve();

    api.clearLocalTenantAuthState();
    coordinator.publishTenantAuthEvent("session-ended", "session-a", false);
    resolveRequest(jsonResponse({ data: { stale: true } }));

    await expect(request).rejects.toMatchObject({
      response: {
        status: 409,
        data: { errorCode: "AUTH_SESSION_CHANGED" },
      },
    });
  });

  it("shares one Web-Locked refresh across concurrent callers", async () => {
    const lockRequest = vi.fn((
      _name: string,
      _options: LockOptions,
      callback: () => Promise<unknown>,
    ) => callback());
    Object.defineProperty(window.navigator, "locks", {
      configurable: true,
      value: { request: lockRequest },
    });
    const api = await import("./axiosClient");
    const coordinator = await import("../auth/sessionCoordinator");
    await seedSession(api, "session-a");
    const observed = coordinator.readLatestTenantAuthEvent();
    const fetchMock = vi.fn(async () => jsonResponse(
      webAuthResponse("session-a"),
    ));
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([
      api.coordinateTenantSessionRefresh("session-a", observed),
      api.coordinateTenantSessionRefresh("session-a", observed),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lockRequest).toHaveBeenCalledTimes(1);
    expect(lockRequest).toHaveBeenCalledWith(
      "tenant_auth_mutex",
      { mode: "exclusive", signal: expect.any(AbortSignal) },
      expect.any(Function),
    );
  });

  it("rejects a stale refresh before it can rotate the current cookie", async () => {
    const api = await import("./axiosClient");
    await seedSession(api, "session-a");
    await seedSession(api, "session-b");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const lifecycle: unknown[] = [];
    window.addEventListener("tenant-auth-lifecycle", (event) => {
      lifecycle.push((event as CustomEvent).detail);
    });

    await expect(api.coordinateTenantSessionRefresh("session-a"))
      .rejects.toMatchObject({
        response: {
          status: 409,
          data: { errorCode: "AUTH_SESSION_CHANGED" },
        },
      });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(lifecycle).toEqual([]);
    expect(api.getStoredTenantSessionMeta()?.sessionId).toBe("session-b");
  });

  it("rejects split-brain metadata before any request or refresh", async () => {
    const api = await import("./axiosClient");
    const coordinator = await import("../auth/sessionCoordinator");
    await seedSession(api, "session-a");
    vi.setSystemTime(Date.now() + 1);
    const auth = webAuthSession("session-b");
    const latest = coordinator.publishTenantAuthEvent(
      "session-updated",
      "session-b",
      false,
      {
        savedAt: Date.now(),
        expiresIn: auth.expiresIn,
        sessionExpiresIn: auth.sessionExpiresIn,
        authorizationVersion: auth.session.authorizationVersion,
        profileVersion: auth.session.profileVersion,
      },
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.customTenantFetch("/api/tenant/core/v1/data"))
      .rejects.toMatchObject({
        response: {
          status: 409,
          data: { errorCode: "AUTH_SESSION_CHANGED" },
        },
      });
    await expect(api.coordinateTenantSessionRefresh("session-a", latest))
      .rejects.toMatchObject({
        response: {
          status: 409,
          data: { errorCode: "AUTH_SESSION_CHANGED" },
        },
      });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(api.getStoredTenantSessionMeta()?.sessionId).toBe("session-a");

    api.clearLocalTenantAuthState();
    await seedSession(api, "session-a");
    coordinator.publishTenantAuthEvent("session-ended", "session-a", false);
    await expect(api.customTenantFetch("/api/tenant/core/v1/data"))
      .rejects.toMatchObject({
        response: {
          status: 401,
          data: { errorCode: "AUTH_SESSION_ENDED" },
        },
      });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts and adopts a newer event for the same SID", async () => {
    const api = await import("./axiosClient");
    const coordinator = await import("../auth/sessionCoordinator");
    await seedSession(api, "session-a");
    vi.setSystemTime(Date.now() + 1);
    const auth = webAuthSession("session-a");
    const latest = coordinator.publishTenantAuthEvent(
      "session-updated",
      "session-a",
      false,
      {
        savedAt: Date.now(),
        expiresIn: auth.expiresIn,
        sessionExpiresIn: auth.sessionExpiresIn,
        authorizationVersion: 2,
        profileVersion: 2,
      },
    );
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/tenant/core/v1/data") {
        return jsonResponse({ data: { ok: true } });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await api.customTenantFetch("/api/tenant/core/v1/data");
    await api.coordinateTenantSessionRefresh("session-a", latest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(api.getStoredTenantSessionMeta()).toMatchObject({
      sessionId: "session-a",
      authEventId: latest.eventId,
      authorizationVersion: 2,
      profileVersion: 2,
    });
  });

  it("never shares an in-flight refresh across different SIDs", async () => {
    const api = await import("./axiosClient");
    await seedSession(api, "session-a");
    let resolveRefresh!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);
    const lifecycle: unknown[] = [];
    window.addEventListener("tenant-auth-lifecycle", (event) => {
      lifecycle.push((event as CustomEvent).detail);
    });

    const oldRefresh = api.coordinateTenantSessionRefresh("session-a");
    await vi.advanceTimersByTimeAsync(0);
    await seedSession(api, "session-b");
    await expect(api.coordinateTenantSessionRefresh("session-b"))
      .rejects.toMatchObject({
        response: {
          status: 409,
          data: { errorCode: "AUTH_SESSION_CHANGED" },
        },
      });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveRefresh(jsonResponse(webAuthResponse("session-a")));
    await expect(oldRefresh).rejects.toMatchObject({
      response: {
        status: 409,
        data: { errorCode: "AUTH_SESSION_CHANGED" },
      },
    });
    expect(lifecycle).toEqual([]);
    expect(api.getStoredTenantSessionMeta()?.sessionId).toBe("session-b");
  });

  it("bounds Web Lock acquisition and makes missing coordination explicit", async () => {
    const api = await import("./axiosClient");
    await seedSession(api, "session-a");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const lockRequest = vi.fn((
      _name: string,
      options: LockOptions,
    ) => new Promise<never>((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => {
        reject(new DOMException("Lock request aborted", "AbortError"));
      }, { once: true });
    }));
    Object.defineProperty(window.navigator, "locks", {
      configurable: true,
      value: { request: lockRequest },
    });

    const timedOut = api.coordinateTenantSessionRefresh("session-a");
    const timedOutAssertion = expect(timedOut).rejects.toMatchObject({
      response: {
        status: 503,
        data: { errorCode: "AUTH_SESSION_COORDINATION_UNAVAILABLE" },
      },
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await timedOutAssertion;
    expect(fetchMock).not.toHaveBeenCalled();

    Object.defineProperty(window.navigator, "locks", {
      configurable: true,
      value: undefined,
    });
    await expect(api.coordinateTenantSessionRefresh("session-a"))
      .rejects.toMatchObject({
        response: {
          status: 503,
          data: { errorCode: "AUTH_SESSION_COORDINATION_UNAVAILABLE" },
        },
      });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps refresh cancellation active until the response body completes", async () => {
    const lockRequest = vi.fn((
      _name: string,
      _options: LockOptions,
      callback: () => Promise<unknown>,
    ) => callback());
    Object.defineProperty(window.navigator, "locks", {
      configurable: true,
      value: { request: lockRequest },
    });
    const api = await import("./axiosClient");
    await seedSession(api, "session-a");
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        text: () => new Promise<string>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Body read aborted", "AbortError"));
          }, { once: true });
        }),
      } as Response));
    vi.stubGlobal("fetch", fetchMock);

    const refresh = api.coordinateTenantSessionRefresh("session-a");
    const refreshAssertion = expect(refresh).rejects.toMatchObject({
      response: {
        status: 503,
        data: { errorCode: "AUTH_SESSION_COORDINATION_UNAVAILABLE" },
      },
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await refreshAssertion;

    fetchMock.mockImplementationOnce(async () =>
      jsonResponse(webAuthResponse("session-a")));
    await api.coordinateTenantSessionRefresh("session-a");
    expect(lockRequest).toHaveBeenCalledTimes(2);
  });

  it("fences stale failures and keeps ordinary feature errors local", async () => {
    const api = await import("./axiosClient");
    await seedSession(api, "session-a");
    const lifecycle: unknown[] = [];
    window.addEventListener("tenant-auth-lifecycle", (event) => {
      lifecycle.push((event as CustomEvent).detail);
    });
    let resolveRequest!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    })));

    const staleRequest = api.customTenantFetch(
      "/api/tenant/core/v1/feature",
    );
    await Promise.resolve();
    await seedSession(api, "session-b");
    resolveRequest(jsonResponse({ code: "UNAVAILABLE" }, 503));
    await expect(staleRequest).rejects.toMatchObject({
      response: {
        status: 409,
        data: { errorCode: "AUTH_SESSION_CHANGED" },
      },
    });
    expect(lifecycle).toEqual([]);

    vi.stubGlobal("fetch", vi.fn(async () =>
      jsonResponse({ code: "UNAVAILABLE" }, 503)));
    await expect(api.customTenantFetch("/api/tenant/core/v1/feature"))
      .rejects.toMatchObject({ response: { status: 503 } });
    expect(lifecycle).toEqual([]);
  });

  it("lets a new SID checkpoint activity while the obsolete SID is pending", async () => {
    const addListener = vi.spyOn(window, "addEventListener");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const api = await import("./axiosClient");
    const coordinator = await import("../auth/sessionCoordinator");
    await seedSession(api, "session-a");
    const pending: Array<(response: Response) => void> = [];
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => {
      pending.push(resolve);
    })));
    const stop = api.startTenantActivityTracking();

    emitTrustedPointer(addListener);
    await vi.advanceTimersByTimeAsync(0);
    vi.setSystemTime(1_000_001);
    const auth = webAuthSession("session-b");
    const event = coordinator.publishTenantAuthEvent(
      "session-updated",
      "session-b",
      false,
      {
        savedAt: Date.now(),
        expiresIn: auth.expiresIn,
        sessionExpiresIn: auth.sessionExpiresIn,
        authorizationVersion: auth.session.authorizationVersion,
        profileVersion: auth.session.profileVersion,
      },
    );
    expect(api.synchronizeTenantTabSession(event)).toBe(true);
    emitTrustedPointer(addListener);
    await vi.advanceTimersByTimeAsync(0);

    expect(pending).toHaveLength(2);
    pending[0](new Response(null, { status: 204 }));
    pending[1](new Response(null, { status: 204 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(api.getStoredTenantSessionMeta()?.sessionId).toBe("session-b");
    stop();
  });

  it("stops an aborted caller waiting on a shared activity checkpoint", async () => {
    const addListener = vi.spyOn(window, "addEventListener");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const api = await import("./axiosClient");
    await seedSession(api, "session-a");
    let resolveActivity!: (response: Response) => void;
    const fetchMock = vi.fn((url: string) => {
      if (url !== "/api/tenant/core/v1/auth/activity") {
        throw new Error(`Unexpected request: ${url}`);
      }
      return new Promise<Response>((resolve) => {
        resolveActivity = resolve;
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const stop = api.startTenantActivityTracking();
    emitTrustedPointer(addListener);
    await vi.advanceTimersByTimeAsync(0);

    const controller = new AbortController();
    const request = api.customTenantFetch("/api/trade/v1/orders", {
      signal: controller.signal,
    });
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveActivity(new Response(null, { status: 204 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(api.getStoredTenantSessionMeta()?.sessionId).toBe("session-a");
    stop();
  });

  it("ignores older session timing even when it names a different SID", async () => {
    const api = await import("./axiosClient");
    await seedSession(api, "session-a");

    expect(api.synchronizeTenantTabSession({
      realm: "tenant",
      kind: "session-updated",
      eventId: "stale-event",
      sourceId: "stale-source",
      issuedAt: Date.now() - 1,
      sessionId: "session-b",
      timing: {
        expiresIn: 600,
        sessionExpiresIn: 1_800,
        authorizationVersion: 1,
        profileVersion: 1,
      },
    })).toBe(false);
    expect(api.getStoredTenantSessionMeta()?.sessionId).toBe("session-a");
  });
});

type TenantApiModule = typeof import("./axiosClient");

async function seedSession(api: TenantApiModule, sessionId: string): Promise<void> {
  const coordinator = await import("../auth/sessionCoordinator");
  const auth = webAuthSession(sessionId);
  const savedAt = Date.now();
  const event = coordinator.publishTenantAuthEvent(
    "session-updated",
    sessionId,
    false,
    {
      savedAt,
      expiresIn: auth.expiresIn,
      sessionExpiresIn: auth.sessionExpiresIn,
      authorizationVersion: auth.session.authorizationVersion,
      profileVersion: auth.session.profileVersion,
    },
  );
  api.storeTenantSessionMetadata(auth, true, event.eventId, savedAt);
}

function emitTrustedPointer(
  addListener: { mock: { calls: unknown[][] } },
): void {
  const listener = addListener.mock.calls.find(
    ([type]) => type === "pointerdown",
  )?.[1] as EventListenerOrEventListenerObject | undefined;
  if (!listener) throw new Error("Activity listener was not registered");
  if (typeof listener === "function") {
    listener({ isTrusted: true } as Event);
  } else {
    listener.handleEvent({ isTrusted: true } as Event);
  }
}

function webAuthSession(sessionId: string) {
  return {
    tokenType: "Bearer" as const,
    expiresIn: 600,
    sessionExpiresIn: 1_800,
    session: {
      id: sessionId,
      clientId: "mutakamel-tenant-web",
      clientType: "WEB" as const,
      createdAt: "2026-08-09T10:00:00.000Z",
      lastRefreshAt: null,
      lastUserActivityAt: null,
      idleExpiresAt: "2026-08-09T10:30:00.000Z",
      absoluteExpiresAt: "2026-08-10T10:00:00.000Z",
      refreshUseCount: "0",
      accessIssueCount: "1",
      credentialVersion: 1,
      authorizationVersion: 1,
      profileVersion: 1,
    },
  };
}

function webAuthResponse(sessionId: string): Record<string, unknown> {
  return { data: webAuthSession(sessionId) };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function installImmediateWebLock(): void {
  Object.defineProperty(window.navigator, "locks", {
    configurable: true,
    value: {
      request: vi.fn((
        _name: string,
        _options: LockOptions,
        callback: () => Promise<unknown>,
      ) => callback()),
    },
  });
}
