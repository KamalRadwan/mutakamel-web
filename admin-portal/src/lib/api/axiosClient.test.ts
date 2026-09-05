import { afterEach, describe, expect, it, vi } from "vitest";
import {
  customFetch,
  ensureAdminCookieSessionFresh,
  getAdminAuthHandling,
  getApiRequestOutcome,
  readWebAuthSessionResponse,
  shouldHonorSessionEndedEvent,
  synchronizeAdminTabSession,
  withAuthLock,
} from "./axiosClient";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function stubBrowserStorage(pathname: string, sessionStorage: Storage) {
  const localStorage = new MemoryStorage();

  vi.stubGlobal("window", {
    location: { pathname, href: "" },
    dispatchEvent: vi.fn(),
    sessionStorage,
    localStorage,
  });
  vi.stubGlobal("sessionStorage", sessionStorage);
  vi.stubGlobal("localStorage", localStorage);
  return localStorage;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function seedAdminSession(
  sessionStorage: Storage,
  localStorage: Storage,
  sessionId = "019f0000-0000-7000-8000-000000000001",
  eventId = "session-one-event",
  savedAt = Date.now(),
) {
  sessionStorage.setItem(
    "admin_session_meta",
    JSON.stringify({
      savedAt,
      expiresIn: 600,
      sessionExpiresIn: 1_800,
      tokenType: "Bearer",
      sessionId,
      remember: false,
      authorizationVersion: 1,
      profileVersion: 1,
      authEventId: eventId,
    }),
  );
  localStorage.setItem(
    "admin_auth_session_event",
    JSON.stringify({
      realm: "admin",
      kind: "session-updated",
      eventId,
      sourceId: "test-tab",
      issuedAt: savedAt,
      sessionId,
    }),
  );
}

function successfulRefreshResponse(
  sessionId = "019f0000-0000-7000-8000-000000000001",
) {
  return new Response(
    JSON.stringify({
      data: {
        tokenType: "Bearer",
        expiresIn: 600,
        sessionExpiresIn: 28_800,
        session: { ...authSession(), id: sessionId },
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function dispatchedEvents(type: string): CustomEvent[] {
  return vi.mocked(window.dispatchEvent).mock.calls
    .map(([event]) => event)
    .filter((event): event is CustomEvent => event.type === type);
}

describe("admin cookie refresh retry", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("retries with the rotated cookie and never reattaches a legacy bearer token", async () => {
    const storage = new MemoryStorage();
    storage.setItem("access_token", "expired-access-token");
    storage.setItem(
      "admin_session_meta",
      JSON.stringify({
        accessToken: "expired-access-token",
        savedAt: 0,
        expiresIn: 3600,
        tokenType: "Bearer",
        loginGeneration: "test-generation",
        remember: false,
        cookieRevision: 1,
      }),
    );

    const sharedStorage = stubBrowserStorage("/users", storage);
    sharedStorage.setItem("admin_auth_remember", "1");
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(1),
    });

    const requests: Array<{ url: string; headers: Headers }> = [];
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async (url: string, init: RequestInit) => {
        requests.push({ url, headers: new Headers(init.headers) });
        return new Response(
          JSON.stringify({ code: "COMMON.AUTH.TOKEN_EXPIRED" }),
          {
            status: 401,
            headers: { "Content-Type": "application/problem+json" },
          },
        );
      })
      .mockImplementationOnce(async (url: string, init: RequestInit) => {
        requests.push({ url, headers: new Headers(init.headers) });
        return new Response(
          JSON.stringify({
            data: {
              tokenType: "Bearer",
              expiresIn: 600,
              sessionExpiresIn: 28_800,
              session: authSession(),
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      })
      .mockImplementationOnce(async (url: string, init: RequestInit) => {
        requests.push({ url, headers: new Headers(init.headers) });
        return new Response(JSON.stringify({ data: [{ id: "admin-1" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await customFetch<{ data: Array<{ id: string }> }>(
      "/api/admin/core/v1/users",
    );

    expect(result.status).toBe(200);
    expect(requests).toHaveLength(3);
    expect(requests[1].url).toBe("/api/admin/core/v1/auth/refresh");
    expect(requests[1].headers.has("x-auth-remember")).toBe(false);
    for (const request of requests) {
      expect(request.headers.has("Authorization")).toBe(false);
    }
    expect(storage.getItem("access_token")).toBeNull();
    expect(storage.getItem("admin_session_meta")).not.toContain("accessToken");
  });

  it("does not attach an idempotency key when the route contract opts out", async () => {
    const storage = new MemoryStorage();
    stubBrowserStorage("/backup", storage);
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(1),
    });

    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(new Headers(init.headers).has("x-idempotency-key")).toBe(false);
      return new Response(JSON.stringify({ data: { id: "run-1" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await customFetch("/api/admin/worker/v1/backups/runs", {
      method: "POST",
      body: JSON.stringify({ databaseServerId: "server-1" }),
      skipAutoIdempotency: true,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("repairs auth but never replays a non-replayable POST after a 401", async () => {
    const storage = new MemoryStorage();
    stubBrowserStorage("/backup", storage);
    vi.stubGlobal("navigator", {});

    const requestOptions: RequestInit[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      requestOptions.push(init);
      if (url === "/api/admin/core/v1/auth/refresh") {
        return new Response(
          JSON.stringify({
            data: {
              tokenType: "Bearer",
              expiresIn: 600,
              sessionExpiresIn: 28_800,
              session: authSession(),
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          type: "https://errors.mutakamel.ai/authentication-required",
          title: "Authentication required",
          status: 401,
          code: "COMMON.AUTH.TOKEN_EXPIRED",
          correlationId: "019f-non-replayable",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/problem+json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      customFetch("/api/admin/worker/v1/backups/runs", {
        method: "POST",
        body: JSON.stringify({ databaseServerId: "server-1" }),
        nonReplayable: true,
        skipAutoIdempotency: true,
      }),
    ).rejects.toMatchObject({
      response: {
        status: 401,
        data: {
          errorCode: "COMMON.AUTH.TOKEN_EXPIRED",
          correlationId: "019f-non-replayable",
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/admin/worker/v1/backups/runs",
    );
    expect(requestOptions[0]).not.toHaveProperty("nonReplayable");
    expect(requestOptions[0]).not.toHaveProperty("skipAutoIdempotency");
    expect(new Headers(requestOptions[0]?.headers).has("x-idempotency-key")).toBe(
      false,
    );
  });

  it("silently refreshes and replays the exact quote POST without an idempotency key", async () => {
    const storage = new MemoryStorage();
    stubBrowserStorage("/tenants/new", storage);
    vi.stubGlobal("navigator", {});

    const body = JSON.stringify({
      applicationId: "application-1",
      subscriptionTierId: "tier-1",
      users: 25,
      billingCycle: "MONTHLY",
    });
    const quoteRequests: RequestInit[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url === "/api/admin/core/v1/auth/refresh") {
        return new Response(
          JSON.stringify({
            data: {
              tokenType: "Bearer",
              expiresIn: 600,
              sessionExpiresIn: 28_800,
              session: authSession(),
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      quoteRequests.push(init);
      if (quoteRequests.length === 1) {
        return new Response(
          JSON.stringify({ code: "COMMON.AUTH.MISSING_BEARER_TOKEN" }),
          { status: 401, headers: { "Content-Type": "application/problem+json" } },
        );
      }
      return new Response(
        JSON.stringify({ data: { quoteId: "quote-1" } }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await customFetch("/api/admin/core/v1/subscriptions/quote", {
      method: "POST",
      body,
      skipAutoIdempotency: true,
      replayAfterRefresh: true,
    });

    expect(result.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(quoteRequests).toHaveLength(2);
    expect(quoteRequests[0]?.body).toBe(body);
    expect(quoteRequests[1]?.body).toBe(body);
    for (const request of quoteRequests) {
      expect(new Headers(request.headers).has("x-idempotency-key")).toBe(false);
    }
  });

  it("holds a replay-safe quote through a transient refresh outage", async () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    stubBrowserStorage("/tenants/new", storage);
    vi.stubGlobal("navigator", {});

    let quoteRequests = 0;
    let refreshRequests = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/refresh") {
        refreshRequests += 1;
        if (refreshRequests === 1) {
          return new Response(
            JSON.stringify({ code: "GW.UPSTREAM.UNAVAILABLE" }),
            { status: 502, headers: { "Content-Type": "application/problem+json" } },
          );
        }
        return new Response(
          JSON.stringify({
            data: {
              tokenType: "Bearer",
              expiresIn: 600,
              sessionExpiresIn: 28_800,
              session: authSession(),
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      quoteRequests += 1;
      if (quoteRequests === 1) {
        return new Response(
          JSON.stringify({ code: "COMMON.AUTH.MISSING_BEARER_TOKEN" }),
          { status: 401, headers: { "Content-Type": "application/problem+json" } },
        );
      }
      return new Response(JSON.stringify({ data: { quoteId: "quote-1" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const pendingQuote = customFetch(
      "/api/admin/core/v1/subscriptions/quote",
      {
        method: "POST",
        body: JSON.stringify({
          billingCycle: "MONTHLY",
          currencyCode: "USD",
          items: [{ moduleId: "module-1", tierId: "tier-1", seats: 25 }],
        }),
        skipAutoIdempotency: true,
        replayAfterRefresh: true,
      },
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(quoteRequests).toBe(1);
    expect(refreshRequests).toBe(1);

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pendingQuote).resolves.toMatchObject({ status: 201 });
    expect(refreshRequests).toBe(2);
    expect(quoteRequests).toBe(2);
  });

  it.each([
    { status: 401, code: "COMMON.AUTH.MISSING_TOKEN" },
    { status: 403, code: "AUTH_CSRF_INVALID" },
  ])("retries a non-terminal refresh $status without logging out or showing permission denial", async ({ status, code }) => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/tenants/new", storage);
    seedAdminSession(storage, sharedStorage);
    vi.stubGlobal("navigator", {});
    let quoteRequests = 0;
    let refreshRequests = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/refresh") {
        refreshRequests += 1;
        if (refreshRequests === 1) {
          return new Response(JSON.stringify({ code }), {
            status,
            headers: { "Content-Type": "application/problem+json" },
          });
        }
        return successfulRefreshResponse();
      }
      quoteRequests += 1;
      if (quoteRequests === 1) {
        return new Response(
          JSON.stringify({ code: "COMMON.AUTH.MISSING_BEARER_TOKEN" }),
          { status: 401, headers: { "Content-Type": "application/problem+json" } },
        );
      }
      return new Response(JSON.stringify({ data: { quoteId: "quote-1" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }));

    const pending = customFetch("/api/admin/core/v1/subscriptions/quote", {
      method: "POST",
      body: JSON.stringify({ items: [] }),
      skipAutoIdempotency: true,
      replayAfterRefresh: true,
    });
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(pending).resolves.toMatchObject({ status: 201 });
    expect(refreshRequests).toBe(2);
    expect(quoteRequests).toBe(2);
    expect(storage.getItem("admin_session_meta")).not.toBeNull();
    expect(dispatchedEvents("global-toast")).toHaveLength(0);
    expect(
      dispatchedEvents("admin-auth-lifecycle").map((event) => event.detail),
    ).not.toContain("ENDED");
  });

  it.each([
    { status: 401, code: "COMMON.AUTH.MISSING_TOKEN" },
    { status: 403, code: "AUTH_CSRF_INVALID" },
  ])("retains the session and surfaces exhausted non-terminal refresh $status repair", async ({ status, code }) => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/tenants/new", storage);
    seedAdminSession(storage, sharedStorage);
    vi.stubGlobal("navigator", {});
    let quoteRequests = 0;
    let refreshRequests = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/refresh") {
        refreshRequests += 1;
        return new Response(JSON.stringify({ code }), {
          status,
          headers: { "Content-Type": "application/problem+json" },
        });
      }
      quoteRequests += 1;
      return new Response(
        JSON.stringify({ code: "COMMON.AUTH.MISSING_BEARER_TOKEN" }),
        { status: 401, headers: { "Content-Type": "application/problem+json" } },
      );
    }));

    const pending = customFetch("/api/admin/core/v1/subscriptions/quote", {
      method: "POST",
      body: JSON.stringify({ items: [] }),
      skipAutoIdempotency: true,
      replayAfterRefresh: true,
    });
    const settled = pending.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(121_000);
    const failure = await settled;

    expect(failure).toMatchObject({ response: { status } });
    expect(getAdminAuthHandling(failure)).toBe("repair-degraded");
    expect(refreshRequests).toBe(9);
    expect(quoteRequests).toBe(1);
    expect(storage.getItem("admin_session_meta")).not.toBeNull();
    expect(dispatchedEvents("global-toast")).toHaveLength(0);
    expect(
      dispatchedEvents("admin-auth-lifecycle").map((event) => event.detail),
    ).toContain("DEGRADED");
  });

  it("preserves repair-degraded provenance after exhausted refresh network failures", async () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/tenants/new", storage);
    seedAdminSession(storage, sharedStorage);
    vi.stubGlobal("navigator", {});
    let quoteRequests = 0;
    let refreshRequests = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/refresh") {
        refreshRequests += 1;
        throw new TypeError("network unavailable");
      }
      quoteRequests += 1;
      return new Response(
        JSON.stringify({ code: "COMMON.AUTH.MISSING_BEARER_TOKEN" }),
        { status: 401, headers: { "Content-Type": "application/problem+json" } },
      );
    }));

    const settled = customFetch(
      "/api/admin/core/v1/subscriptions/quote",
      {
        method: "POST",
        body: JSON.stringify({ items: [] }),
        skipAutoIdempotency: true,
        replayAfterRefresh: true,
      },
    ).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(121_000);
    const failure = await settled;

    expect(failure).toBeInstanceOf(TypeError);
    expect(getAdminAuthHandling(failure)).toBe("repair-degraded");
    expect(refreshRequests).toBe(9);
    expect(quoteRequests).toBe(1);
    expect(storage.getItem("admin_session_meta")).not.toBeNull();
  });

  it.each([
    { status: 401, code: "AUTH_SESSION_ENDED" },
    { status: 403, code: "SESSION_IDENTITY_INACTIVE" },
  ])("ends the session for an explicit terminal refresh $status without a toast", async ({ status, code }) => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/tenants/new", storage);
    seedAdminSession(storage, sharedStorage);
    vi.stubGlobal("navigator", {});
    let refreshRequests = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/refresh") {
        refreshRequests += 1;
        return new Response(JSON.stringify({ code }), {
          status,
          headers: { "Content-Type": "application/problem+json" },
        });
      }
      return new Response(
        JSON.stringify({ code: "COMMON.AUTH.MISSING_BEARER_TOKEN" }),
        { status: 401, headers: { "Content-Type": "application/problem+json" } },
      );
    }));

    const failure = await customFetch(
      "/api/admin/core/v1/subscriptions/quote",
      {
        method: "POST",
        body: JSON.stringify({ items: [] }),
        skipAutoIdempotency: true,
        replayAfterRefresh: true,
      },
    ).catch((error: unknown) => error);

    expect(getAdminAuthHandling(failure)).toBe("session-ended");
    expect(refreshRequests).toBe(1);
    expect(storage.getItem("admin_session_meta")).toBeNull();
    expect(dispatchedEvents("global-toast")).toHaveLength(0);
    expect(
      dispatchedEvents("admin-auth-lifecycle").map((event) => event.detail),
    ).toContain("ENDED");
  });

  it("tags a business permission denial and emits exactly one global toast", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/users", storage);
    seedAdminSession(storage, sharedStorage);
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ code: "COMMON.AUTH.FORBIDDEN" }),
      { status: 403, headers: { "Content-Type": "application/problem+json" } },
    )));

    const failure = await customFetch("/api/admin/core/v1/users")
      .catch((error: unknown) => error);

    expect(getAdminAuthHandling(failure)).toBe("permission-denied");
    expect(storage.getItem("admin_session_meta")).not.toBeNull();
    expect(dispatchedEvents("global-toast")).toHaveLength(1);
    expect(
      dispatchedEvents("admin-auth-lifecycle").map((event) => event.detail),
    ).not.toContain("DEGRADED");
  });

  it("never sends a third quote when the single replay is also unauthorized", async () => {
    const storage = new MemoryStorage();
    stubBrowserStorage("/tenants/new", storage);
    vi.stubGlobal("navigator", {});

    let quoteRequests = 0;
    let refreshRequests = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/refresh") {
        refreshRequests += 1;
        return new Response(
          JSON.stringify({
            data: {
              tokenType: "Bearer",
              expiresIn: 600,
              sessionExpiresIn: 28_800,
              session: authSession(),
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      quoteRequests += 1;
      return new Response(
        JSON.stringify({ code: "COMMON.AUTH.MISSING_BEARER_TOKEN" }),
        { status: 401, headers: { "Content-Type": "application/problem+json" } },
      );
    }));

    const failure = await customFetch(
      "/api/admin/core/v1/subscriptions/quote",
      {
        method: "POST",
        body: JSON.stringify({ items: [] }),
        skipAutoIdempotency: true,
        replayAfterRefresh: true,
      },
    ).catch((error: unknown) => error);
    expect(failure).toMatchObject({ response: { status: 401 } });
    expect(getAdminAuthHandling(failure)).toBe("repair-degraded");
    expect(refreshRequests).toBe(1);
    expect(quoteRequests).toBe(2);
    expect(storage.getItem("admin_session_meta")).not.toBeNull();
    expect(
      dispatchedEvents("admin-auth-lifecycle").map((event) => event.detail),
    ).toContain("DEGRADED");
  });

  it("cancels transient refresh waiting when the caller aborts", async () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    stubBrowserStorage("/tenants/new", storage);
    vi.stubGlobal("navigator", {});
    const controller = new AbortController();
    let quoteRequests = 0;
    let refreshRequests = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/refresh") {
        refreshRequests += 1;
        return new Response(
          JSON.stringify({ code: "GW.UPSTREAM.UNAVAILABLE" }),
          { status: 502, headers: { "Content-Type": "application/problem+json" } },
        );
      }
      quoteRequests += 1;
      return new Response(
        JSON.stringify({ code: "COMMON.AUTH.MISSING_BEARER_TOKEN" }),
        { status: 401, headers: { "Content-Type": "application/problem+json" } },
      );
    }));

    const pending = customFetch("/api/admin/core/v1/subscriptions/quote", {
      method: "POST",
      body: JSON.stringify({ items: [] }),
      skipAutoIdempotency: true,
      replayAfterRefresh: true,
      signal: controller.signal,
    });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(refreshRequests).toBe(1);
    expect(quoteRequests).toBe(1);
  });

  it("lets one caller abort a hung refresh while a same-session waiter still completes", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/tenants/new", storage);
    seedAdminSession(storage, sharedStorage);
    vi.stubGlobal("navigator", {});
    const refresh = deferred<Response>();
    const controller = new AbortController();
    let quoteRequests = 0;
    let refreshRequests = 0;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/admin/core/v1/auth/refresh") {
        refreshRequests += 1;
        return refresh.promise;
      }
      quoteRequests += 1;
      return Promise.resolve(new Response(
        JSON.stringify({ code: "COMMON.AUTH.MISSING_BEARER_TOKEN" }),
        { status: 401, headers: { "Content-Type": "application/problem+json" } },
      ));
    }));

    const quote = customFetch("/api/admin/core/v1/subscriptions/quote", {
      method: "POST",
      body: JSON.stringify({ items: [] }),
      skipAutoIdempotency: true,
      replayAfterRefresh: true,
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(refreshRequests).toBe(1));
    const sibling = ensureAdminCookieSessionFresh();

    controller.abort();
    await expect(quote).rejects.toMatchObject({ name: "AbortError" });
    refresh.resolve(successfulRefreshResponse());
    await expect(sibling).resolves.toBeUndefined();
    expect(refreshRequests).toBe(1);
    expect(quoteRequests).toBe(1);
  });

  it("times out a wedged shared refresh and permits a later attempt", async () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/users", storage);
    seedAdminSession(storage, sharedStorage);
    vi.stubGlobal("navigator", {});
    let refreshRequests = 0;
    const observed: { firstSignal?: AbortSignal } = {};
    vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe("/api/admin/core/v1/auth/refresh");
      refreshRequests += 1;
      if (refreshRequests === 1) {
        if (init.signal) observed.firstSignal = init.signal;
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        });
      }
      return Promise.resolve(successfulRefreshResponse());
    }));

    const first = ensureAdminCookieSessionFresh();
    const firstFailure = first.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(firstFailure).resolves.toMatchObject({
      response: {
        status: 504,
        data: { errorCode: "AUTH_REFRESH_TIMEOUT" },
      },
    });
    expect(observed.firstSignal?.aborted).toBe(true);

    const second = ensureAdminCookieSessionFresh();
    await vi.advanceTimersByTimeAsync(0);
    await expect(second).resolves.toBeUndefined();
    expect(refreshRequests).toBe(2);
  });

  it("aborts a timed-out Web Lock request before its callback can refresh", async () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/users", storage);
    seedAdminSession(storage, sharedStorage);
    const observed: { lockSignal?: AbortSignal } = {};
    vi.stubGlobal("navigator", {
      locks: {
        request: (
          _name: string,
          options: { signal?: AbortSignal },
        ) => new Promise<never>((_resolve, reject) => {
          if (options.signal) observed.lockSignal = options.signal;
          options.signal?.addEventListener(
            "abort",
            () => reject(options.signal?.reason),
            { once: true },
          );
        }),
      },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const settled = ensureAdminCookieSessionFresh()
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(settled).resolves.toMatchObject({
      response: {
        status: 504,
        data: { errorCode: "AUTH_REFRESH_TIMEOUT" },
      },
    });
    expect(observed.lockSignal?.aborted).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never replays an old-session quote after the refresh cookie switches sessions", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/tenants/new", storage);
    seedAdminSession(storage, sharedStorage);
    vi.stubGlobal("navigator", {});
    const refresh = deferred<Response>();
    let quoteRequests = 0;
    let refreshRequests = 0;
    let cleanupRequests = 0;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/admin/core/v1/auth/refresh") {
        refreshRequests += 1;
        return refresh.promise;
      }
      if (url === "/api/admin/core/v1/auth/logout") {
        cleanupRequests += 1;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      quoteRequests += 1;
      return Promise.resolve(new Response(
        JSON.stringify({ code: "COMMON.AUTH.MISSING_BEARER_TOKEN" }),
        { status: 401, headers: { "Content-Type": "application/problem+json" } },
      ));
    }));

    const pending = customFetch("/api/admin/core/v1/subscriptions/quote", {
      method: "POST",
      body: JSON.stringify({ items: [] }),
      skipAutoIdempotency: true,
      replayAfterRefresh: true,
    });
    await vi.waitFor(() => expect(refreshRequests).toBe(1));
    const secondSessionId = "019f0000-0000-7000-8000-000000000002";
    seedAdminSession(storage, sharedStorage, secondSessionId, "session-two-event");
    refresh.resolve(successfulRefreshResponse(secondSessionId));

    await expect(pending).rejects.toMatchObject({
      response: {
        status: 409,
        data: { errorCode: "AUTH_SESSION_CHANGED" },
      },
    });
    expect(refreshRequests).toBe(1);
    expect(quoteRequests).toBe(1);
    expect(cleanupRequests).toBe(0);
  });

  it("fails closed when an old-session refresh response overwrites a newer cookie session", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/tenants/new", storage);
    seedAdminSession(storage, sharedStorage);
    vi.stubGlobal("navigator", {});
    const refresh = deferred<Response>();
    let quoteRequests = 0;
    let refreshRequests = 0;
    let cleanupRequests = 0;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/admin/core/v1/auth/refresh") {
        refreshRequests += 1;
        return refresh.promise;
      }
      if (url === "/api/admin/core/v1/auth/logout") {
        cleanupRequests += 1;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      quoteRequests += 1;
      return Promise.resolve(new Response(
        JSON.stringify({ code: "COMMON.AUTH.MISSING_BEARER_TOKEN" }),
        { status: 401, headers: { "Content-Type": "application/problem+json" } },
      ));
    }));

    const pending = customFetch("/api/admin/core/v1/subscriptions/quote", {
      method: "POST",
      body: JSON.stringify({ items: [] }),
      skipAutoIdempotency: true,
      replayAfterRefresh: true,
    });
    await vi.waitFor(() => expect(refreshRequests).toBe(1));
    seedAdminSession(
      storage,
      sharedStorage,
      "019f0000-0000-7000-8000-000000000002",
      "session-two-event",
    );
    // The stale S1 refresh response represents Set-Cookie already reverting
    // the browser cookie before JavaScript can inspect the returned sid.
    refresh.resolve(successfulRefreshResponse());
    const failure = await pending.catch((error: unknown) => error);

    expect(failure).toMatchObject({
      response: {
        status: 409,
        data: { errorCode: "AUTH_SESSION_CHANGED" },
      },
    });
    expect(getAdminAuthHandling(failure)).toBe("session-ended");
    expect(storage.getItem("admin_session_meta")).toBeNull();
    expect(
      dispatchedEvents("admin-auth-lifecycle").map((event) => event.detail),
    ).toContain("ENDED");
    expect(quoteRequests).toBe(1);
    expect(cleanupRequests).toBe(1);
    expect(sharedStorage.getItem("admin_auth_cookie_quarantine")).toBeNull();
  });

  it("quarantines a stale cookie across reloads until a locked login cleans it", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/tenants/new", storage);
    seedAdminSession(storage, sharedStorage);
    vi.stubGlobal("navigator", {});
    const refresh = deferred<Response>();
    let quoteRequests = 0;
    let refreshRequests = 0;
    let cleanupRequests = 0;
    let meRequests = 0;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/admin/core/v1/auth/refresh") {
        refreshRequests += 1;
        return refresh.promise;
      }
      if (url === "/api/admin/core/v1/auth/logout") {
        cleanupRequests += 1;
        return Promise.resolve(new Response(null, {
          status: cleanupRequests < 2 ? 502 : 204,
        }));
      }
      if (url === "/api/admin/core/v1/auth/login") {
        return Promise.resolve(successfulRefreshResponse(
          "019f0000-0000-7000-8000-000000000003",
        ));
      }
      if (url === "/api/admin/core/v1/auth/me") {
        meRequests += 1;
        return Promise.resolve(new Response(JSON.stringify({ data: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }));
      }
      quoteRequests += 1;
      return Promise.resolve(new Response(
        JSON.stringify({ code: "COMMON.AUTH.MISSING_BEARER_TOKEN" }),
        { status: 401, headers: { "Content-Type": "application/problem+json" } },
      ));
    }));

    const pending = customFetch("/api/admin/core/v1/subscriptions/quote", {
      method: "POST",
      body: JSON.stringify({ items: [] }),
      skipAutoIdempotency: true,
      replayAfterRefresh: true,
    });
    await vi.waitFor(() => expect(refreshRequests).toBe(1));
    seedAdminSession(
      storage,
      sharedStorage,
      "019f0000-0000-7000-8000-000000000002",
      "session-two-event",
    );
    refresh.resolve(successfulRefreshResponse());

    await expect(pending).rejects.toMatchObject({
      response: { status: 409, data: { errorCode: "AUTH_SESSION_CHANGED" } },
    });
    expect(quoteRequests).toBe(1);
    expect(cleanupRequests).toBe(1);
    const quarantineGeneration = sharedStorage.getItem(
      "admin_auth_cookie_quarantine",
    );
    expect(quarantineGeneration).toBeTruthy();

    // A reload loses per-tab metadata but retains the cross-tab quarantine.
    storage.clear();
    const firstBootstrap = customFetch("/api/admin/core/v1/auth/me", {
      skipAuthRefresh: true,
      cache: "no-store",
    });
    const blockedBootstrap = await firstBootstrap.catch((error: unknown) => error);
    expect(blockedBootstrap).toMatchObject({
      response: {
        status: 401,
        data: { errorCode: "AUTH_SESSION_ENDED" },
      },
    });
    expect(getAdminAuthHandling(blockedBootstrap)).toBe("session-ended");
    expect(meRequests).toBe(0);
    expect(cleanupRequests).toBe(1);
    expect(sharedStorage.getItem("admin_auth_cookie_quarantine")).toBe(
      quarantineGeneration,
    );

    const successfulLogin = withAuthLock(() => customFetch(
      "/api/admin/core/v1/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: "admin@example.test",
          password: "correct horse battery staple",
        }),
        skipAuthRefresh: true,
        skipAutoIdempotency: true,
        cache: "no-store",
      },
    ));
    await expect(successfulLogin).resolves.toMatchObject({ status: 200 });
    expect(cleanupRequests).toBe(2);
    expect(meRequests).toBe(0);
    expect(sharedStorage.getItem("admin_auth_cookie_quarantine")).toBeNull();
  });

  it("finishes quarantined-cookie cleanup before sending an explicit login", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/login", storage);
    sharedStorage.setItem("admin_auth_cookie_quarantine", "1");
    vi.stubGlobal("navigator", {});
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      requests.push(url);
      if (url === "/api/admin/core/v1/auth/logout") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url === "/api/admin/core/v1/auth/login") {
        return Promise.resolve(successfulRefreshResponse(
          "019f0000-0000-7000-8000-000000000003",
        ));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }));

    const response = await withAuthLock(() => customFetch(
      "/api/admin/core/v1/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: "admin@example.test",
          password: "correct horse battery staple",
        }),
        skipAuthRefresh: true,
        skipAutoIdempotency: true,
        cache: "no-store",
      },
    ));

    expect(response.status).toBe(200);
    expect(requests).toEqual([
      "/api/admin/core/v1/auth/logout",
      "/api/admin/core/v1/auth/login",
    ]);
    expect(sharedStorage.getItem("admin_auth_cookie_quarantine")).toBeNull();
  });

  it("never sends login while its locked quarantine cleanup is pending", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/login", storage);
    sharedStorage.setItem("admin_auth_cookie_quarantine", "1");
    vi.stubGlobal("navigator", {});
    const cleanup = deferred<Response>();
    let cleanupRequests = 0;
    let loginRequests = 0;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/admin/core/v1/auth/logout") {
        cleanupRequests += 1;
        return cleanup.promise;
      }
      if (url === "/api/admin/core/v1/auth/login") {
        loginRequests += 1;
        return Promise.resolve(successfulRefreshResponse(
          "019f0000-0000-7000-8000-000000000003",
        ));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }));

    const login = withAuthLock(() => customFetch(
      "/api/admin/core/v1/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: "admin@example.test",
          password: "correct horse battery staple",
        }),
        skipAuthRefresh: true,
        skipAutoIdempotency: true,
        cache: "no-store",
      },
    ));
    await vi.waitFor(() => expect(cleanupRequests).toBe(1));
    expect(loginRequests).toBe(0);

    cleanup.resolve(new Response(null, { status: 204 }));
    await expect(login).resolves.toMatchObject({ status: 200 });
    expect(loginRequests).toBe(1);
  });

  /*
   * Cross-tab cleanup leases remain a fallback coordination signal when the
   * browser does not expose Web Locks. Production login still holds the auth
   * mutex for both cleanup and cookie issuance.
   */
  it("waits for another tab's long-lived cleanup lease before login", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/login", storage);
    sharedStorage.setItem("admin_auth_cookie_quarantine", "1");
    sharedStorage.setItem(
      "admin_auth_cookie_cleanup_lease:other-tab",
      JSON.stringify({ generation: "1", expiresAt: Date.now() + 110_000 }),
    );
    vi.stubGlobal("navigator", {});
    let loginRequests = 0;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/admin/core/v1/auth/logout") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url === "/api/admin/core/v1/auth/login") {
        loginRequests += 1;
        return Promise.resolve(successfulRefreshResponse());
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }));

    const login = withAuthLock(() => customFetch(
      "/api/admin/core/v1/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: "admin@example.test",
          password: "correct horse battery staple",
        }),
        skipAuthRefresh: true,
        skipAutoIdempotency: true,
      },
    ));
    await Promise.resolve();
    await Promise.resolve();
    expect(loginRequests).toBe(0);

    sharedStorage.removeItem("admin_auth_cookie_cleanup_lease:other-tab");
    await expect(login).resolves.toMatchObject({ status: 200 });
    expect(loginRequests).toBe(1);
  });

  it("retires an orphaned cleanup lease after the response-settlement horizon", async () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/login", storage);
    sharedStorage.setItem(
      "admin_auth_cookie_cleanup_lease:dead-tab",
      JSON.stringify({ generation: "old", expiresAt: Date.now() + 120_000 }),
    );
    vi.stubGlobal("navigator", {});
    let loginRequests = 0;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      expect(url).toBe("/api/admin/core/v1/auth/login");
      loginRequests += 1;
      return Promise.resolve(successfulRefreshResponse());
    }));

    const login = withAuthLock(() => customFetch(
      "/api/admin/core/v1/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: "admin@example.test",
          password: "correct horse battery staple",
        }),
        skipAuthRefresh: true,
        skipAutoIdempotency: true,
      },
    ));
    await vi.advanceTimersByTimeAsync(119_900);
    expect(loginRequests).toBe(0);
    await vi.advanceTimersByTimeAsync(100);
    await expect(login).resolves.toMatchObject({ status: 200 });
    expect(loginRequests).toBe(1);
    expect(
      sharedStorage.getItem("admin_auth_cookie_cleanup_lease:dead-tab"),
    ).toBeNull();
  });

  it("lets an aborted caller stop waiting on another tab's cleanup lease", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/login", storage);
    sharedStorage.setItem(
      "admin_auth_cookie_cleanup_lease:other-tab",
      JSON.stringify({ generation: "old", expiresAt: Date.now() + 120_000 }),
    );
    vi.stubGlobal("navigator", {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const login = withAuthLock(() => customFetch(
      "/api/admin/core/v1/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: "admin@example.test",
          password: "correct horse battery staple",
        }),
        skipAuthRefresh: true,
        skipAutoIdempotency: true,
        signal: controller.signal,
      },
    ), controller.signal);
    await Promise.resolve();
    controller.abort();

    await expect(login).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serializes auth mutations when the Web Locks API is unavailable", async () => {
    const storage = new MemoryStorage();
    stubBrowserStorage("/login", storage);
    vi.stubGlobal("navigator", {});
    const entered = deferred<void>();
    const release = deferred<void>();
    const order: string[] = [];

    const first = withAuthLock(async () => {
      order.push("first-enter");
      entered.resolve();
      await release.promise;
      order.push("first-exit");
    });
    await entered.promise;
    const second = withAuthLock(async () => {
      order.push("second-enter");
    });
    await Promise.resolve();
    expect(order).toEqual(["first-enter"]);

    release.resolve();
    await Promise.all([first, second]);
    expect(order).toEqual(["first-enter", "first-exit", "second-enter"]);
  });

  it("renews a queued fallback auth lock beyond its initial lease", async () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    stubBrowserStorage("/login", storage);
    vi.stubGlobal("navigator", {});
    const entered = deferred<void>();
    const release = deferred<void>();
    let secondEntered = false;

    const first = withAuthLock(async () => {
      entered.resolve();
      await release.promise;
    });
    await entered.promise;
    const second = withAuthLock(async () => {
      secondEntered = true;
    });

    await vi.advanceTimersByTimeAsync(61_000);
    expect(secondEntered).toBe(false);
    release.resolve();
    await vi.advanceTimersByTimeAsync(25);
    await Promise.all([first, second]);
    expect(secondEntered).toBe(true);
  });

  it("keeps an active fallback auth lock past the server session horizon", async () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    stubBrowserStorage("/login", storage);
    vi.stubGlobal("navigator", {});
    const entered = deferred<void>();
    const release = deferred<void>();
    let secondEntered = false;

    const first = withAuthLock(async () => {
      entered.resolve();
      await release.promise;
    });
    await entered.promise;
    vi.setSystemTime(Date.now() + 12.5 * 60 * 60 * 1_000);
    const second = withAuthLock(async () => {
      secondEntered = true;
    });
    await vi.advanceTimersByTimeAsync(25);
    expect(secondEntered).toBe(false);

    release.resolve();
    await vi.advanceTimersByTimeAsync(25);
    await Promise.all([first, second]);
    expect(secondEntered).toBe(true);
  });

  it("takes the fallback auth lock from a tab that was closed mid-callback", async () => {
    // A tab holding the fallback mutex is closed, or the browser is killed,
    // while its auth callback is outstanding. The `finally` that removes the
    // record never runs, and the record claims the mutex for the rest of its
    // thirteen-hour active lease — surviving a reload and a browser restart,
    // because it lives in this origin's storage. Every sign-in after that
    // waited behind a tab that no longer existed.
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/login", storage);
    vi.stubGlobal("navigator", {});
    sharedStorage.setItem(
      "admin_auth_mutex_entry:dead-tab",
      JSON.stringify({
        id: "dead-tab",
        state: "active",
        createdAt: Date.now() - 1_000,
        // Renewed once, moments before the tab went away.
        expiresAt: Date.now() + 13 * 60 * 60 * 1_000,
      }),
    );
    let entered = false;

    const login = withAuthLock(async () => {
      entered = true;
    });

    // Nobody is renewing that record, so after the orphan grace the waiter
    // stops believing in its holder.
    await vi.advanceTimersByTimeAsync(3 * 60_000 + 100);
    await login;

    expect(entered).toBe(true);
    expect(sharedStorage.getItem("admin_auth_mutex_entry:dead-tab")).toBeNull();
  });

  it("keeps waiting on a holder that is still renewing its fallback lease", async () => {
    // The same silence test must not retire a tab that is merely slow. This
    // holder keeps renewing across the whole orphan grace and beyond, and
    // keeps the mutex.
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    stubBrowserStorage("/login", storage);
    vi.stubGlobal("navigator", {});
    const entered = deferred<void>();
    const release = deferred<void>();
    let secondEntered = false;

    const first = withAuthLock(async () => {
      entered.resolve();
      await release.promise;
    });
    await entered.promise;
    const second = withAuthLock(async () => {
      secondEntered = true;
    });

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(secondEntered).toBe(false);

    release.resolve();
    await vi.advanceTimersByTimeAsync(25);
    await Promise.all([first, second]);
    expect(secondEntered).toBe(true);
  });

  it("rejects a fallback waiter that a newer auth intent overtook", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/login", storage);
    vi.stubGlobal("navigator", {});
    const entered = deferred<void>();
    const release = deferred<void>();
    let staleWaiterEntered = false;

    const first = withAuthLock(async () => {
      entered.resolve();
      await release.promise;
    });
    await entered.promise;
    const staleWaiter = withAuthLock(async () => {
      staleWaiterEntered = true;
    });
    await vi.waitFor(() => {
      const waitingEntry = Array.from({ length: sharedStorage.length })
        .map((_, index) => sharedStorage.key(index))
        .filter((key): key is string =>
          Boolean(key?.startsWith("admin_auth_mutex_entry:")))
        .map((key) => JSON.parse(sharedStorage.getItem(key) ?? "null") as {
          id: string;
          state: string;
          createdAt: number;
        })
        .find((entry) => entry.state === "waiting");
      expect(waitingEntry).toBeDefined();
      sharedStorage.setItem(
        "admin_auth_intent",
        JSON.stringify({
          id: "newer-tab-auth-intent",
          createdAt: (waitingEntry?.createdAt ?? 0) + 1,
        }),
      );
    });

    await expect(staleWaiter).rejects.toMatchObject({
      response: {
        status: 409,
        data: { errorCode: "AUTH_SESSION_CHANGED" },
      },
    });
    expect(staleWaiterEntered).toBe(false);
    release.resolve();
    await first;
  });

  it("quarantines cookies when an overtaken fallback login response settles", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/login", storage);
    vi.stubGlobal("navigator", {});
    const loginResponse = deferred<Response>();
    let cleanupRequests = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/auth/login")) return loginResponse.promise;
      if (url.endsWith("/auth/logout")) {
        cleanupRequests += 1;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const login = withAuthLock(() =>
      customFetch("/api/admin/core/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "admin@example.test",
          password: "correct horse battery staple",
        }),
        skipAuthRefresh: true,
        skipAutoIdempotency: true,
      }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const activeIntent = JSON.parse(
      sharedStorage.getItem("admin_auth_intent") ?? "null",
    ) as { createdAt: number };
    sharedStorage.setItem(
      "admin_auth_intent",
      JSON.stringify({
        id: "newer-tab-auth-intent",
        createdAt: activeIntent.createdAt + 1,
      }),
    );
    loginResponse.resolve(new Response(JSON.stringify({ data: { ok: true } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    await expect(login).rejects.toMatchObject({
      response: {
        status: 409,
        data: { errorCode: "AUTH_SESSION_CHANGED" },
      },
    });
    expect(cleanupRequests).toBe(1);
    expect(sharedStorage.getItem("admin_auth_cookie_quarantine")).toBeNull();
    expect(storage.getItem("admin_session_meta")).toBeNull();
  });

  it("quarantines an overtaken login even when its response body errors", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/login", storage);
    vi.stubGlobal("navigator", {});
    const loginResponse = deferred<Response>();
    let cleanupRequests = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/auth/login")) return loginResponse.promise;
      if (url.endsWith("/auth/logout")) {
        cleanupRequests += 1;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const login = withAuthLock(() =>
      customFetch("/api/admin/core/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "admin@example.test",
          password: "correct horse battery staple",
        }),
        skipAuthRefresh: true,
        skipAutoIdempotency: true,
      }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const activeIntent = JSON.parse(
      sharedStorage.getItem("admin_auth_intent") ?? "null",
    ) as { createdAt: number };
    sharedStorage.setItem(
      "admin_auth_intent",
      JSON.stringify({
        id: "newer-tab-auth-intent",
        createdAt: activeIntent.createdAt + 1,
      }),
    );
    loginResponse.resolve(new Response(new ReadableStream({
      start(controller) {
        controller.error(new Error("truncated login response"));
      },
    }), { status: 200 }));

    await expect(login).rejects.toMatchObject({
      response: {
        status: 409,
        data: { errorCode: "AUTH_SESSION_CHANGED" },
      },
    });
    expect(cleanupRequests).toBe(1);
    expect(sharedStorage.getItem("admin_auth_cookie_quarantine")).toBeNull();
    expect(storage.getItem("admin_session_meta")).toBeNull();
  });

  it("fences a current-session revocation that can clear auth cookies", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/settings/auth", storage);
    seedAdminSession(storage, sharedStorage);
    vi.stubGlobal("navigator", {});
    const revokeResponse = deferred<Response>();
    let cleanupRequests = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/auth/sessions/")) return revokeResponse.promise;
      if (url.endsWith("/auth/logout")) {
        cleanupRequests += 1;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const revoke = withAuthLock(() => customFetch(
      "/api/admin/core/v1/auth/sessions/019f0000-0000-7000-8000-000000000001",
      {
        method: "DELETE",
        skipAuthRefresh: true,
        skipAutoIdempotency: true,
      },
    ));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const activeIntent = JSON.parse(
      sharedStorage.getItem("admin_auth_intent") ?? "null",
    ) as { createdAt: number };
    sharedStorage.setItem(
      "admin_auth_intent",
      JSON.stringify({
        id: "newer-tab-auth-intent",
        createdAt: activeIntent.createdAt + 1,
      }),
    );
    revokeResponse.resolve(new Response(null, { status: 204 }));

    await expect(revoke).rejects.toMatchObject({
      response: {
        status: 409,
        data: { errorCode: "AUTH_SESSION_CHANGED" },
      },
    });
    expect(cleanupRequests).toBe(1);
    expect(storage.getItem("admin_session_meta")).toBeNull();
  });

  it("rejects a different-session waiter instead of joining a shared refresh", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/users", storage);
    seedAdminSession(storage, sharedStorage);
    vi.stubGlobal("navigator", {});
    const refresh = deferred<Response>();
    let refreshRequests = 0;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      expect(url).toBe("/api/admin/core/v1/auth/refresh");
      refreshRequests += 1;
      return refresh.promise;
    }));

    const first = ensureAdminCookieSessionFresh();
    await vi.waitFor(() => expect(refreshRequests).toBe(1));
    const secondSessionId = "019f0000-0000-7000-8000-000000000002";
    seedAdminSession(storage, sharedStorage, secondSessionId, "session-two-event");

    await expect(ensureAdminCookieSessionFresh()).rejects.toMatchObject({
      response: {
        status: 409,
        data: { errorCode: "AUTH_SESSION_CHANGED" },
      },
    });
    refresh.resolve(successfulRefreshResponse(secondSessionId));
    await expect(first).rejects.toMatchObject({
      response: { status: 409 },
    });
    expect(refreshRequests).toBe(1);
  });

  it("rejects old-session data when the session changes before a success settles", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/users", storage);
    seedAdminSession(storage, sharedStorage);
    vi.stubGlobal("navigator", {});
    const response = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => response.promise));

    const pending = customFetch("/api/admin/core/v1/users");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    seedAdminSession(
      storage,
      sharedStorage,
      "019f0000-0000-7000-8000-000000000002",
      "session-two-event",
    );
    response.resolve(new Response(JSON.stringify({ data: [{ id: "user-1" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const failure = await pending.catch((error: unknown) => error);
    expect(failure).toMatchObject({
      response: {
        status: 409,
        data: { errorCode: "AUTH_SESSION_CHANGED" },
      },
    });
    expect(getApiRequestOutcome(failure)).toBe(
      "settled-before-session-change",
    );
  });

  it("does not let a stale tab log out a newer cross-tab session", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/users", storage);
    const savedAt = Date.now();
    seedAdminSession(
      storage,
      sharedStorage,
      "019f0000-0000-7000-8000-000000000001",
      "session-one-event",
      savedAt,
    );
    sharedStorage.setItem(
      "admin_auth_session_event",
      JSON.stringify({
        realm: "admin",
        kind: "session-updated",
        eventId: "session-two-event",
        sourceId: "other-tab",
        issuedAt: savedAt + 1_000,
        sessionId: "019f0000-0000-7000-8000-000000000002",
      }),
    );
    vi.stubGlobal("navigator", {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(customFetch("/api/admin/core/v1/auth/logout", {
      method: "POST",
      skipAuthRefresh: true,
      nonReplayable: true,
      skipAutoIdempotency: true,
    })).rejects.toMatchObject({
      response: {
        status: 409,
        data: { errorCode: "AUTH_SESSION_CHANGED" },
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage.getItem("admin_session_meta")).toBeNull();
  });

  it("accepts a success when only the same session refresh epoch advanced", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/users", storage);
    const sessionId = "019f0000-0000-7000-8000-000000000001";
    seedAdminSession(storage, sharedStorage, sessionId, "event-one", Date.now());
    vi.stubGlobal("navigator", {});
    const response = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => response.promise));

    const pending = customFetch<{ data: Array<{ id: string }> }>(
      "/api/admin/core/v1/users",
    );
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    seedAdminSession(
      storage,
      sharedStorage,
      sessionId,
      "event-two",
      Date.now() + 1_000,
    );
    response.resolve(new Response(JSON.stringify({ data: [{ id: "user-1" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    await expect(pending).resolves.toMatchObject({ status: 200 });
  });

  it("refreshes inside the proactive lead before sending a protected request", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "admin_session_meta",
      JSON.stringify({
        savedAt: Date.now() - 550_000,
        expiresIn: 600,
        sessionExpiresIn: 1_800,
        tokenType: "Bearer",
        sessionId: "019f0000-0000-7000-8000-000000000001",
        remember: false,
        authorizationVersion: 1,
        profileVersion: 1,
        authEventId: "before-proactive-refresh",
      }),
    );
    stubBrowserStorage("/tenants/new", storage);
    vi.stubGlobal("navigator", {});

    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      urls.push(url);
      if (url === "/api/admin/core/v1/auth/refresh") {
        return new Response(
          JSON.stringify({
            data: {
              tokenType: "Bearer",
              expiresIn: 600,
              sessionExpiresIn: 28_800,
              session: authSession(),
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ data: { quoteId: "quote-1" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await customFetch("/api/admin/core/v1/subscriptions/quote", {
      method: "POST",
      body: JSON.stringify({ applicationId: "application-1" }),
      skipAutoIdempotency: true,
      replayAfterRefresh: true,
    });

    expect(urls).toEqual([
      "/api/admin/core/v1/auth/refresh",
      "/api/admin/core/v1/subscriptions/quote",
    ]);
  });

  it("captures a new epoch after preflight before repairing a later stale-claims 401", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "admin_session_meta",
      JSON.stringify({
        savedAt: Date.now() - 550_000,
        expiresIn: 600,
        sessionExpiresIn: 1_800,
        tokenType: "Bearer",
        sessionId: "019f0000-0000-7000-8000-000000000001",
        remember: false,
        authorizationVersion: 1,
        profileVersion: 1,
        authEventId: "before-preflight",
      }),
    );
    stubBrowserStorage("/users", storage);
    vi.stubGlobal("navigator", {});

    let refreshRequests = 0;
    let userRequests = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/refresh") {
        refreshRequests += 1;
        return new Response(
          JSON.stringify({
            data: {
              tokenType: "Bearer",
              expiresIn: 600,
              sessionExpiresIn: 28_800,
              session: {
                ...authSession(),
                authorizationVersion: refreshRequests,
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      userRequests += 1;
      if (userRequests === 1) {
        return new Response(
          JSON.stringify({ code: "AUTH_AUTHORIZATION_STALE" }),
          { status: 401, headers: { "Content-Type": "application/problem+json" } },
        );
      }
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await customFetch("/api/admin/core/v1/users");

    expect(refreshRequests).toBe(2);
    expect(userRequests).toBe(2);
  });

  it("retains local auth when refresh returns a non-terminal 401 code", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "admin_session_meta",
      JSON.stringify({
        savedAt: Date.now(),
        expiresIn: 600,
        sessionExpiresIn: 1_800,
        tokenType: "Bearer",
        sessionId: "019f0000-0000-7000-8000-000000000001",
        remember: false,
        authorizationVersion: 1,
        profileVersion: 1,
        authEventId: "before-refresh",
      }),
    );
    stubBrowserStorage("/users", storage);
    vi.stubGlobal("navigator", {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: "COMMON.AUTH.TOKEN_EXPIRED" }),
          { status: 401, headers: { "Content-Type": "application/problem+json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: "COMMON.AUTH.MISSING_TOKEN" }),
          { status: 401, headers: { "Content-Type": "application/problem+json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(customFetch("/api/admin/core/v1/users", {
      nonReplayable: true,
    })).rejects.toMatchObject({
      response: {
        status: 401,
        data: { errorCode: "COMMON.AUTH.MISSING_TOKEN" },
      },
    });
    expect(storage.getItem("admin_session_meta")).not.toBeNull();
  });

  it("ends local auth for an explicit terminal 403 instead of showing permission denial", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "admin_session_meta",
      JSON.stringify({
        savedAt: Date.now(),
        expiresIn: 600,
        sessionExpiresIn: 1_800,
        tokenType: "Bearer",
        sessionId: "019f0000-0000-7000-8000-000000000001",
        remember: false,
        authorizationVersion: 1,
        profileVersion: 1,
        authEventId: "before-inactive-identity",
      }),
    );
    const sharedStorage = stubBrowserStorage("/users", storage);
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(
        JSON.stringify({ code: "SESSION_IDENTITY_INACTIVE" }),
        { status: 403, headers: { "Content-Type": "application/problem+json" } },
      )));

    await expect(customFetch("/api/admin/core/v1/users")).rejects.toMatchObject({
      response: { status: 403 },
    });
    expect(storage.getItem("admin_session_meta")).toBeNull();
    expect(JSON.parse(
      sharedStorage.getItem("admin_auth_session_event") ?? "null",
    )).toMatchObject({ kind: "session-ended" });
  });

  it("honors terminal evidence after a harmless same-session refresh epoch advance", async () => {
    const storage = new MemoryStorage();
    const sharedStorage = stubBrowserStorage("/users", storage);
    const sessionId = "019f0000-0000-7000-8000-000000000001";
    const savedAt = Date.now();
    seedAdminSession(storage, sharedStorage, sessionId, "event-one", savedAt);
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", vi.fn(async () => {
      seedAdminSession(
        storage,
        sharedStorage,
        sessionId,
        "event-two",
        savedAt + 1_000,
      );
      return new Response(JSON.stringify({ code: "AUTH_SESSION_ENDED" }), {
        status: 401,
        headers: { "Content-Type": "application/problem+json" },
      });
    }));

    const failure = await customFetch("/api/admin/core/v1/users")
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ response: { status: 401 } });
    expect(getAdminAuthHandling(failure)).toBe("session-ended");
    expect(storage.getItem("admin_session_meta")).toBeNull();
    expect(
      dispatchedEvents("admin-auth-lifecycle").map((event) => event.detail),
    ).toContain("ENDED");
  });

  it("does not let a terminal response from an older session end a newer session", async () => {
    const storage = new MemoryStorage();
    const originalSavedAt = Date.now();
    storage.setItem(
      "admin_session_meta",
      JSON.stringify({
        savedAt: originalSavedAt,
        expiresIn: 600,
        sessionExpiresIn: 1_800,
        tokenType: "Bearer",
        sessionId: "019f0000-0000-7000-8000-000000000001",
        remember: false,
        authorizationVersion: 1,
        profileVersion: 1,
        authEventId: "session-one-event",
      }),
    );
    const sharedStorage = stubBrowserStorage("/users", storage);
    sharedStorage.setItem(
      "admin_auth_session_event",
      JSON.stringify({
        realm: "admin",
        kind: "session-updated",
        eventId: "session-one-event",
        sourceId: "original-tab",
        issuedAt: originalSavedAt,
        sessionId: "019f0000-0000-7000-8000-000000000001",
      }),
    );
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", vi.fn(async () => {
      const newerSavedAt = originalSavedAt + 1_000;
      // The shared event can arrive before this tab's storage listener adopts
      // the new session. The stale response must not overwrite that event with
      // a session-ended publication for the old request.
      sharedStorage.setItem(
        "admin_auth_session_event",
        JSON.stringify({
          realm: "admin",
          kind: "session-updated",
          eventId: "session-two-event",
          sourceId: "other-tab",
          issuedAt: newerSavedAt,
          sessionId: "019f0000-0000-7000-8000-000000000002",
        }),
      );
      return new Response(
        JSON.stringify({ code: "AUTH_SESSION_ENDED" }),
        { status: 401, headers: { "Content-Type": "application/problem+json" } },
      );
    }));

    await expect(customFetch("/api/admin/core/v1/users")).rejects.toMatchObject({
      response: {
        status: 409,
        data: { errorCode: "AUTH_SESSION_CHANGED" },
      },
    });
    expect(storage.getItem("admin_session_meta")).toBeNull();
    expect(JSON.parse(
      sharedStorage.getItem("admin_auth_session_event") ?? "null",
    )).toMatchObject({
      kind: "session-updated",
      sessionId: "019f0000-0000-7000-8000-000000000002",
    });
  });

  it("adopts newer same-session timing without treating it as auth proof", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "admin_session_meta",
      JSON.stringify({
        savedAt: 100,
        expiresIn: 60,
        sessionExpiresIn: 1_800,
        tokenType: "Bearer",
        sessionId: "019f0000-0000-7000-8000-000000000001",
        remember: false,
        authorizationVersion: 1,
        profileVersion: 1,
        authEventId: "old-event",
      }),
    );
    stubBrowserStorage("/users", storage);

    expect(synchronizeAdminTabSession({
      realm: "admin",
      kind: "session-updated",
      eventId: "new-event",
      sourceId: "other-tab",
      issuedAt: 200,
      sessionId: "019f0000-0000-7000-8000-000000000001",
      timing: {
        expiresIn: 600,
        sessionExpiresIn: 2_400,
        authorizationVersion: 2,
        profileVersion: 3,
      },
    })).toEqual({
      sessionChanged: false,
      timingAdopted: true,
      claimsChanged: true,
      ignored: false,
    });
    expect(JSON.parse(storage.getItem("admin_session_meta") ?? "null"))
      .toMatchObject({
        savedAt: 200,
        expiresIn: 600,
        sessionExpiresIn: 2_400,
        authorizationVersion: 2,
        profileVersion: 3,
        authEventId: "new-event",
      });
  });

  it("ignores delayed events from an older session without clearing the newer binding", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "admin_session_meta",
      JSON.stringify({
        savedAt: 500,
        expiresIn: 600,
        sessionExpiresIn: 1_800,
        tokenType: "Bearer",
        sessionId: "session-new",
        remember: false,
        authorizationVersion: 2,
        profileVersion: 2,
        authEventId: "new-session-event",
      }),
    );
    stubBrowserStorage("/users", storage);
    const delayedUpdate = {
      realm: "admin" as const,
      kind: "session-updated" as const,
      eventId: "delayed-old-update",
      sourceId: "old-tab",
      issuedAt: 400,
      sessionId: "session-old",
    };

    expect(synchronizeAdminTabSession(delayedUpdate)).toMatchObject({
      ignored: true,
      sessionChanged: false,
    });
    expect(JSON.parse(storage.getItem("admin_session_meta") ?? "null"))
      .toMatchObject({
        sessionId: "session-new",
        authEventId: "new-session-event",
      });
    expect(shouldHonorSessionEndedEvent({
      ...delayedUpdate,
      kind: "session-ended",
    })).toBe(false);
  });

  it("preserves the exact UUIDv7 key and body across one safe replay", async () => {
    const storage = new MemoryStorage();
    stubBrowserStorage("/database-servers", storage);
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(2),
      randomUUID: () => "event-id",
    });

    const protectedRequests: RequestInit[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url === "/api/admin/core/v1/auth/refresh") {
        return new Response(
          JSON.stringify({
            data: {
              tokenType: "Bearer",
              expiresIn: 600,
              sessionExpiresIn: 28_800,
              session: authSession(),
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      protectedRequests.push(init);
      if (protectedRequests.length === 1) {
        return new Response(
          JSON.stringify({ code: "COMMON.AUTH.TOKEN_EXPIRED" }),
          { status: 401, headers: { "Content-Type": "application/problem+json" } },
        );
      }
      return new Response(JSON.stringify({ data: { id: "server-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const body = JSON.stringify({ name: "Primary" });
    const idempotencyKey = "019f0000-0000-7000-8000-000000000099";
    await customFetch("/api/admin/core/v1/database-servers/server-1", {
      method: "PATCH",
      body,
      headers: { "x-idempotency-key": idempotencyKey },
    });

    expect(protectedRequests).toHaveLength(2);
    const firstHeaders = new Headers(protectedRequests[0]?.headers);
    const secondHeaders = new Headers(protectedRequests[1]?.headers);
    expect(secondHeaders.get("x-idempotency-key")).toBe(
      firstHeaders.get("x-idempotency-key"),
    );
    expect(firstHeaders.get("x-idempotency-key")).toBe(idempotencyKey);
    expect(protectedRequests[0]?.body).toBe(body);
    expect(protectedRequests[1]?.body).toBe(body);
  });

  it("repairs auth but fails closed instead of replaying an unproven mutation", async () => {
    const storage = new MemoryStorage();
    stubBrowserStorage("/users", storage);
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(4),
      randomUUID: () => "event-id",
    });

    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      urls.push(url);
      if (url === "/api/admin/core/v1/auth/refresh") {
        return new Response(
          JSON.stringify({
            data: {
              tokenType: "Bearer",
              expiresIn: 600,
              sessionExpiresIn: 28_800,
              session: authSession(),
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ code: "COMMON.AUTH.TOKEN_EXPIRED" }),
        { status: 401, headers: { "Content-Type": "application/problem+json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      customFetch("/api/admin/core/v1/users/user-1/activate", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });

    expect(urls).toEqual([
      "/api/admin/core/v1/users/user-1/activate",
      "/api/admin/core/v1/auth/refresh",
    ]);
  });

  it("does not replay a request after another tab changes the server session", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "admin_session_meta",
      JSON.stringify({
        savedAt: Date.now(),
        expiresIn: 600,
        sessionExpiresIn: 1_800,
        tokenType: "Bearer",
        sessionId: "019f0000-0000-7000-8000-000000000001",
        remember: false,
        authorizationVersion: 1,
        profileVersion: 1,
        authEventId: "old-event",
      }),
    );
    const sharedStorage = stubBrowserStorage("/users", storage);
    sharedStorage.setItem(
      "admin_auth_session_event",
      JSON.stringify({
        realm: "admin",
        kind: "session-updated",
        eventId: "old-event",
        sourceId: "old-tab",
        issuedAt: Date.now(),
        sessionId: "019f0000-0000-7000-8000-000000000001",
      }),
    );
    vi.stubGlobal("navigator", {});

    const fetchMock = vi.fn(async () => {
      sharedStorage.setItem(
        "admin_auth_session_event",
        JSON.stringify({
          realm: "admin",
          kind: "session-updated",
          eventId: "new-login-event",
          sourceId: "other-tab",
          issuedAt: Date.now(),
          sessionId: "019f0000-0000-7000-8000-000000000002",
        }),
      );
      return new Response(
        JSON.stringify({ code: "COMMON.AUTH.TOKEN_EXPIRED" }),
        { status: 401, headers: { "Content-Type": "application/problem+json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(customFetch("/api/admin/core/v1/users")).rejects.toMatchObject({
      response: {
        status: 409,
        data: { errorCode: "AUTH_SESSION_CHANGED" },
      },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(storage.getItem("admin_session_meta")).toBeNull();
  });

  it("rechecks the shared epoch after acquiring the Web Lock", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "admin_session_meta",
      JSON.stringify({
        savedAt: Date.now(),
        expiresIn: 600,
        sessionExpiresIn: 1_800,
        tokenType: "Bearer",
        sessionId: "019f0000-0000-7000-8000-000000000001",
        remember: false,
        authorizationVersion: 1,
        profileVersion: 1,
        authEventId: "before-refresh",
      }),
    );
    const sharedStorage = stubBrowserStorage("/users", storage);
    sharedStorage.setItem(
      "admin_auth_session_event",
      JSON.stringify({
        realm: "admin",
        kind: "session-updated",
        eventId: "before-refresh",
        sourceId: "original-tab",
        issuedAt: Date.now(),
        sessionId: "019f0000-0000-7000-8000-000000000001",
      }),
    );
    vi.stubGlobal("navigator", {
      locks: {
        request: async (
          _name: string,
          _options: unknown,
          callback: () => Promise<unknown>,
        ) => {
          localStorage.setItem(
            "admin_auth_session_event",
            JSON.stringify({
              realm: "admin",
              kind: "session-updated",
              eventId: "other-tab-refresh",
              sourceId: "other-tab",
              issuedAt: Date.now(),
              sessionId: "019f0000-0000-7000-8000-000000000001",
            }),
          );
          return callback();
        },
      },
    });

    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      urls.push(url);
      if (urls.length === 1) {
        return new Response(
          JSON.stringify({ code: "COMMON.AUTH.TOKEN_EXPIRED" }),
          { status: 401, headers: { "Content-Type": "application/problem+json" } },
        );
      }
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await customFetch("/api/admin/core/v1/users");

    expect(urls).toEqual([
      "/api/admin/core/v1/users",
      "/api/admin/core/v1/users",
    ]);
  });

  it("keeps automatic idempotency for ordinary mutations", async () => {
    const storage = new MemoryStorage();
    stubBrowserStorage("/database-servers", storage);
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(1),
    });

    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(new Headers(init.headers).get("x-idempotency-key")).toMatch(
        /^[0-9a-f-]{36}$/,
      );
      return new Response(JSON.stringify({ data: { id: "server-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await customFetch("/api/admin/core/v1/database-servers/server-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Primary" }),
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("copies the non-HttpOnly CSRF proof to unsafe cookie requests", async () => {
    const storage = new MemoryStorage();
    stubBrowserStorage("/settings/auth", storage);
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("document", {
      cookie: "theme=dark; __Host-mutakamel-admin-csrf=proof%2Dvalue",
    });

    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(new Headers(init.headers).get("x-csrf-token")).toBe("proof-value");
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await customFetch("/api/admin/core/v1/auth/sessions/session-1", {
      method: "DELETE",
      skipAutoIdempotency: true,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    ["http:", "mutakamel-http-admin-csrf=http-proof; __Host-mutakamel-admin-csrf=secure-proof", "http-proof"],
    ["https:", "mutakamel-http-admin-csrf=http-proof; __Host-mutakamel-admin-csrf=secure-proof", "secure-proof"],
    ["http:", "__Host-mutakamel-admin-csrf=secure-proof", "secure-proof"],
    ["https:", "mutakamel-http-admin-csrf=http-proof", "http-proof"],
  ])("selects the available %s admin CSRF cookie profile", async (protocol, cookie, expected) => {
    stubBrowserStorage("/settings/auth", new MemoryStorage());
    window.location.protocol = protocol;
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("document", { cookie });
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      expect(headers.get("x-csrf-token")).toBe(expected);
      expect(headers.has("Authorization")).toBe(false);
      expect(init.credentials).toBe("include");
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await customFetch("/api/admin/core/v1/auth/sessions/session-1", {
      method: "DELETE",
      skipAutoIdempotency: true,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects cross-origin and protocol-relative API targets before sending CSRF proof", async () => {
    const storage = new MemoryStorage();
    stubBrowserStorage("/settings/auth", storage);
    vi.stubGlobal("document", {
      cookie: "__Host-mutakamel-admin-csrf=csrf-proof",
      visibilityState: "visible",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(customFetch("https://evil.example/api", { method: "POST" }))
      .rejects.toMatchObject({
        response: {
          status: 400,
          data: { errorCode: "UNTRUSTED_API_ORIGIN" },
        },
      });
    await expect(customFetch("//evil.example/api", { method: "POST" }))
      .rejects.toMatchObject({ response: { status: 400 } });
    await expect(customFetch(" \thttps://evil.example/api", { method: "POST" }))
      .rejects.toMatchObject({ response: { status: 400 } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checkpoints recent human activity through Core before a Worker request", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "admin_session_meta",
      JSON.stringify({
        savedAt: Date.now(),
        expiresIn: 600,
        sessionExpiresIn: 1_800,
        tokenType: "Bearer",
        sessionId: "019f0000-0000-7000-8000-000000000001",
        remember: false,
        authorizationVersion: 1,
        profileVersion: 1,
        authEventId: "event-1",
      }),
    );
    const listeners = new Map<string, (event: Event) => void>();
    stubBrowserStorage("/backup", storage);
    vi.stubGlobal("window", {
      location: { pathname: "/backup", href: "" },
      dispatchEvent: vi.fn(),
      sessionStorage: storage,
      localStorage: new MemoryStorage(),
      addEventListener: (name: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === "function") {
          listeners.set(name, listener as (event: Event) => void);
        }
      },
    });
    vi.stubGlobal("document", {
      cookie: "__Host-mutakamel-admin-csrf=csrf-proof",
      visibilityState: "visible",
    });
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(3),
    });

    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      urls.push(url);
      const headers = new Headers(init.headers);
      if (listeners.has("pointerdown") && urls.length > 1) {
        expect(headers.get("x-auth-user-activity")).toBe("1");
      }
      if (url === "/api/admin/core/v1/auth/activity") {
        expect(headers.get("x-csrf-token")).toBe("csrf-proof");
        expect(headers.has("x-idempotency-key")).toBe(false);
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    // Installs listeners without manufacturing activity.
    await customFetch("/api/admin/worker/v1/backups/runs");
    expect(urls).toEqual(["/api/admin/worker/v1/backups/runs"]);
    urls.length = 0;
    listeners.get("pointerdown")?.({ isTrusted: false } as Event);

    await customFetch("/api/admin/worker/v1/backups/runs");
    expect(urls).toEqual(["/api/admin/worker/v1/backups/runs"]);
    urls.length = 0;
    listeners.get("pointerdown")?.({ isTrusted: true } as Event);

    await customFetch("/api/admin/worker/v1/backups/runs");
    expect(urls).toEqual([
      "/api/admin/core/v1/auth/activity",
      "/api/admin/worker/v1/backups/runs",
    ]);
  });

  it("rejects raw credentials in a browser cookie-mode response", () => {
    expect(
      readWebAuthSessionResponse({
        data: {
          tokenType: "Bearer",
          expiresIn: 600,
          sessionExpiresIn: 28_800,
          session: authSession(),
          accessToken: "must-not-reach-browser-code",
        },
      }),
    ).toBeNull();
    expect(
      readWebAuthSessionResponse({
        data: {
          tokenType: "Bearer",
          expiresIn: 600,
          sessionExpiresIn: 28_800,
          session: {
            ...authSession(),
            sessionCredential: "must-not-reach-browser-code",
          },
        },
      }),
    ).toBeNull();
  });
});

function authSession() {
  return {
    id: "019f0000-0000-7000-8000-000000000001",
    clientType: "WEB",
    clientId: "mutakamel-admin-web",
    createdAt: "2026-08-09T10:00:00.000Z",
    lastRefreshAt: "2026-08-09T10:01:00.000Z",
    lastUserActivityAt: "2026-08-09T10:01:00.000Z",
    idleExpiresAt: "2026-08-09T18:01:00.000Z",
    absoluteExpiresAt: "2026-08-10T10:00:00.000Z",
    refreshUseCount: "1",
    accessIssueCount: "2",
    credentialVersion: 1,
    authorizationVersion: 1,
    profileVersion: 1,
  };
}
