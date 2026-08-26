import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const SESSION_ONE = "019f0000-0000-7000-8000-000000000001";
const SESSION_TWO = "019f0000-0000-7000-8000-000000000002";

let api: typeof import("./axiosClient");

function seedSession(
  sessionStorage: Storage,
  localStorage: Storage,
  sessionId = SESSION_ONE,
  eventId = "activity-event",
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
      sourceId: "activity-test",
      issuedAt: savedAt,
      sessionId,
    }),
  );
}

function stubActivityBrowser(
  pathname: string,
  sessionStorage: Storage,
  localStorage: Storage,
) {
  const listeners = new Map<string, (event: Event) => void>();
  const dispatchEvent = vi.fn();
  const cookies = new Map([
    ["__Host-mutakamel-admin-csrf", "csrf-proof"],
  ]);
  const documentState = {
    visibilityState: "visible",
    get cookie() {
      return Array.from(cookies, ([name, value]) => `${name}=${value}`).join("; ");
    },
    set cookie(serialized: string) {
      const [pair = "", ...attributes] = serialized.split(";");
      const separator = pair.indexOf("=");
      if (separator < 1) return;
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      const removed = attributes.some((attribute) =>
        attribute.trim().toLowerCase() === "max-age=0"
      );
      if (removed) cookies.delete(name);
      else cookies.set(name, value);
    },
  };
  vi.stubGlobal("window", {
    location: { pathname, href: "" },
    dispatchEvent,
    sessionStorage,
    localStorage,
    addEventListener: (
      name: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      if (typeof listener === "function") {
        listeners.set(name, listener as (event: Event) => void);
      }
    },
  });
  vi.stubGlobal("sessionStorage", sessionStorage);
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("document", documentState);
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("crypto", {
    getRandomValues: (bytes: Uint8Array) => bytes.fill(4),
  });
  return { dispatchEvent, documentState, listeners };
}

function refreshedSessionResponse() {
  return new Response(JSON.stringify({
    data: {
      tokenType: "Bearer",
      expiresIn: 600,
      sessionExpiresIn: 1_800,
      session: {
        id: SESSION_ONE,
        clientId: "mutakamel-admin-web",
        clientType: "WEB",
        createdAt: "2026-08-26T10:00:00.000Z",
        lastRefreshAt: "2026-08-26T10:10:00.000Z",
        lastUserActivityAt: "2026-08-26T10:09:00.000Z",
        idleExpiresAt: "2026-08-26T10:39:00.000Z",
        absoluteExpiresAt: "2026-08-26T22:00:00.000Z",
        refreshUseCount: "2",
        accessIssueCount: "3",
        credentialVersion: 1,
        authorizationVersion: 1,
        profileVersion: 1,
      },
    },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function stubWebLocks() {
  vi.stubGlobal("navigator", {
    locks: {
      request: async (
        _name: string,
        _options: unknown,
        callback: () => Promise<unknown>,
      ) => callback(),
    },
  });
}

describe("admin activity checkpoint liveness", () => {
  beforeEach(async () => {
    vi.resetModules();
    api = await import("./axiosClient");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lets an aborted caller leave a shared checkpoint and bounds a hung checkpoint", async () => {
    vi.useFakeTimers();
    const sessionStorage = new MemoryStorage();
    const localStorage = new MemoryStorage();
    seedSession(sessionStorage, localStorage);
    const { listeners } = stubActivityBrowser(
      "/backup",
      sessionStorage,
      localStorage,
    );

    const urls: string[] = [];
    const activitySignals: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
      urls.push(url);
      if (url === "/api/admin/core/v1/auth/activity") {
        if (init.signal) activitySignals.push(init.signal);
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        });
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    }));

    await api.customFetch("/api/admin/worker/v1/backups/runs");
    urls.length = 0;
    listeners.get("pointerdown")?.({ isTrusted: true } as Event);

    const controller = new AbortController();
    const abortedRequest = api.customFetch(
      "/api/admin/worker/v1/backups/runs",
      { signal: controller.signal },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(urls).toEqual(["/api/admin/core/v1/auth/activity"]);
    controller.abort();
    await expect(abortedRequest).rejects.toMatchObject({ name: "AbortError" });
    expect(activitySignals[0]?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(activitySignals[0]?.aborted).toBe(true);
    expect(urls).toEqual(["/api/admin/core/v1/auth/activity"]);

    urls.length = 0;
    listeners.get("pointerdown")?.({ isTrusted: true } as Event);
    const timedRequest = api.customFetch("/api/admin/worker/v1/backups/runs");
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(timedRequest).resolves.toMatchObject({ status: 200 });
    expect(activitySignals[1]?.aborted).toBe(true);
    expect(urls).toEqual([
      "/api/admin/core/v1/auth/activity",
      "/api/admin/worker/v1/backups/runs",
    ]);
  });

  it("checkpoints trusted visible input immediately and coalesces activity for one minute", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T10:00:00.000Z"));
    const sessionStorage = new MemoryStorage();
    const localStorage = new MemoryStorage();
    seedSession(sessionStorage, localStorage);
    const { documentState, listeners } = stubActivityBrowser(
      "/dashboard",
      sessionStorage,
      localStorage,
    );

    const activityHeaders: Headers[] = [];
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      urls.push(url);
      if (url === "/api/admin/core/v1/auth/activity") {
        activityHeaders.push(new Headers(init.headers));
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));

    // A protected bootstrap installs the listeners but does not manufacture
    // human activity.
    await api.customFetch("/api/admin/core/v1/auth/me");
    urls.length = 0;

    listeners.get("pointerdown")?.({ isTrusted: false } as Event);
    documentState.visibilityState = "hidden";
    listeners.get("keydown")?.({ isTrusted: true } as Event);
    await vi.advanceTimersByTimeAsync(0);
    expect(urls).toEqual([]);

    documentState.visibilityState = "visible";
    listeners.get("pointerdown")?.({ isTrusted: true } as Event);
    await vi.advanceTimersByTimeAsync(0);
    expect(urls).toEqual(["/api/admin/core/v1/auth/activity"]);
    expect(activityHeaders[0]?.get("x-auth-user-activity")).toBe("1");
    expect(activityHeaders[0]?.get("x-csrf-token")).toBe("csrf-proof");
    expect(activityHeaders[0]?.has("x-idempotency-key")).toBe(false);

    listeners.get("keydown")?.({ isTrusted: true } as Event);
    listeners.get("touchstart")?.({ isTrusted: true } as Event);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(urls).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    listeners.get("keydown")?.({ isTrusted: true } as Event);
    await vi.advanceTimersByTimeAsync(0);
    expect(urls).toEqual([
      "/api/admin/core/v1/auth/activity",
      "/api/admin/core/v1/auth/activity",
    ]);
  });

  it("keeps the session on transient and permission checkpoint failures", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T11:00:00.000Z"));
    const sessionStorage = new MemoryStorage();
    const localStorage = new MemoryStorage();
    seedSession(sessionStorage, localStorage);
    const { dispatchEvent, listeners } = stubActivityBrowser(
      "/dashboard",
      sessionStorage,
      localStorage,
    );

    const activityResponses = [
      new Response(JSON.stringify({ code: "GW.UPSTREAM.UNAVAILABLE" }), {
        status: 503,
        headers: { "Content-Type": "application/problem+json" },
      }),
      new Response(JSON.stringify({ errorCode: "AUTH_CSRF_INVALID" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
      new Response(null, { status: 204 }),
    ];
    let activityCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/activity") {
        activityCalls += 1;
        return activityResponses.shift() ?? new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));

    await api.customFetch("/api/admin/core/v1/auth/me");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      listeners.get("pointerdown")?.({ isTrusted: true } as Event);
      await vi.advanceTimersByTimeAsync(0);
      if (attempt < 2) await vi.advanceTimersByTimeAsync(5_000);
    }

    expect(activityCalls).toBe(3);
    expect(JSON.parse(
      sessionStorage.getItem("admin_session_meta") ?? "null",
    )?.sessionId).toBe(SESSION_ONE);
    expect(dispatchEvent.mock.calls.some(([event]) =>
      (event as Event).type === "global-toast" ||
      (event as Event).type === "admin-auth-lifecycle"
    )).toBe(false);
    expect(JSON.parse(
      localStorage.getItem("admin_auth_session_event") ?? "null",
    )?.kind).toBe("session-updated");
  });

  it("repairs an expired access cookie before the direct activity checkpoint", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T13:00:00.000Z"));
    const sessionStorage = new MemoryStorage();
    const localStorage = new MemoryStorage();
    seedSession(sessionStorage, localStorage);
    const { listeners } = stubActivityBrowser(
      "/dashboard",
      sessionStorage,
      localStorage,
    );
    stubWebLocks();

    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url);
      if (url === "/api/admin/core/v1/auth/refresh") {
        return refreshedSessionResponse();
      }
      if (url === "/api/admin/core/v1/auth/activity") {
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));

    await api.customFetch("/api/admin/core/v1/auth/me");
    urls.length = 0;
    await vi.advanceTimersByTimeAsync(601_000);

    listeners.get("pointerdown")?.({ isTrusted: true } as Event);
    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(() => {
      expect(urls).toEqual([
        "/api/admin/core/v1/auth/refresh",
        "/api/admin/core/v1/auth/activity",
      ]);
    });
    expect(JSON.parse(
      sessionStorage.getItem("admin_session_meta") ?? "null",
    )).toMatchObject({ sessionId: SESSION_ONE, expiresIn: 600 });
  });

  it("refreshes once and retries a direct checkpoint after a non-terminal 401", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T13:30:00.000Z"));
    const sessionStorage = new MemoryStorage();
    const localStorage = new MemoryStorage();
    seedSession(sessionStorage, localStorage);
    const { listeners } = stubActivityBrowser(
      "/dashboard",
      sessionStorage,
      localStorage,
    );
    stubWebLocks();

    const urls: string[] = [];
    let activityAttempts = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url);
      if (url === "/api/admin/core/v1/auth/refresh") {
        return refreshedSessionResponse();
      }
      if (url === "/api/admin/core/v1/auth/activity") {
        activityAttempts += 1;
        return activityAttempts === 1
          ? new Response(JSON.stringify({
              errorCode: "COMMON.AUTH.TOKEN_EXPIRED",
            }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            })
          : new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));

    await api.customFetch("/api/admin/core/v1/auth/me");
    urls.length = 0;
    listeners.get("pointerdown")?.({ isTrusted: true } as Event);

    await vi.waitFor(() => {
      expect(urls).toEqual([
        "/api/admin/core/v1/auth/activity",
        "/api/admin/core/v1/auth/refresh",
        "/api/admin/core/v1/auth/activity",
      ]);
    });
    expect(JSON.parse(
      sessionStorage.getItem("admin_session_meta") ?? "null",
    )?.sessionId).toBe(SESSION_ONE);
  });

  it("ends only the still-bound session on an explicit terminal checkpoint code", async () => {
    const sessionStorage = new MemoryStorage();
    const localStorage = new MemoryStorage();
    seedSession(sessionStorage, localStorage);
    const { dispatchEvent, listeners } = stubActivityBrowser(
      "/dashboard",
      sessionStorage,
      localStorage,
    );

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/activity") {
        return new Response(JSON.stringify({
          errorCode: "AUTH_SESSION_IDLE_EXPIRED",
        }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));

    await api.customFetch("/api/admin/core/v1/auth/me");
    listeners.get("pointerdown")?.({ isTrusted: true } as Event);

    await vi.waitFor(() => {
      expect(sessionStorage.getItem("admin_session_meta")).toBeNull();
    });
    expect(JSON.parse(
      localStorage.getItem("admin_auth_session_event") ?? "null",
    )).toMatchObject({ kind: "session-ended", sessionId: SESSION_ONE });
    expect(dispatchEvent.mock.calls.some(([event]) =>
      (event as CustomEvent).type === "admin-auth-lifecycle" &&
      (event as CustomEvent).detail === "ENDED"
    )).toBe(true);
  });

  it("ignores a delayed terminal activity response after another session wins", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T12:00:00.000Z"));
    const sessionStorage = new MemoryStorage();
    const localStorage = new MemoryStorage();
    seedSession(sessionStorage, localStorage);
    const { dispatchEvent, listeners } = stubActivityBrowser(
      "/dashboard",
      sessionStorage,
      localStorage,
    );

    let resolveActivity!: (response: Response) => void;
    const activityResponse = new Promise<Response>((resolve) => {
      resolveActivity = resolve;
    });
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/admin/core/v1/auth/activity") return activityResponse;
      return Promise.resolve(new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    }));

    await api.customFetch("/api/admin/core/v1/auth/me");
    listeners.get("pointerdown")?.({ isTrusted: true } as Event);
    await vi.advanceTimersByTimeAsync(0);

    seedSession(
      sessionStorage,
      localStorage,
      SESSION_TWO,
      "new-session-event",
      Date.now() + 1,
    );
    resolveActivity(new Response(JSON.stringify({
      errorCode: "AUTH_SESSION_IDLE_EXPIRED",
    }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }));
    await vi.advanceTimersByTimeAsync(0);

    expect(JSON.parse(
      sessionStorage.getItem("admin_session_meta") ?? "null",
    )?.sessionId).toBe(SESSION_TWO);
    expect(JSON.parse(
      localStorage.getItem("admin_auth_session_event") ?? "null",
    )).toMatchObject({ kind: "session-updated", sessionId: SESSION_TWO });
    expect(dispatchEvent.mock.calls.some(([event]) =>
      (event as CustomEvent).type === "admin-auth-lifecycle" &&
      (event as CustomEvent).detail === "ENDED"
    )).toBe(false);
  });
});
