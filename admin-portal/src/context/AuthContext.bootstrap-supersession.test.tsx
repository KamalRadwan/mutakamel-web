// @vitest-environment jsdom

import { useState } from "react";
import { fireEvent, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/login",
}));

vi.mock("@/i18n/I18nContext", () => ({
  useOptionalI18n: () => null,
  useI18n: () => ({
    t: {
      common: {
        sessionChecking: "Checking the session…",
        sessionUnavailable: "The session could not be checked. You are still signed in.",
        serverErrorTitle: "Internal server error",
        serviceUnavailableTitle: "The service is temporarily unavailable",
        networkUnreachableTitle: "Could not reach the server",
        retry: "Retry",
      },
    },
  }),
}));

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolveFn) => {
    resolve = resolveFn;
  });
  return { promise, resolve };
}

function LoginProbe() {
  const { authState, user, login } = useAuth();
  const [error, setError] = useState("none");
  return (
    <div>
      <span>{authState}:{user?.email ?? "none"}</span>
      <span>error:{error}</span>
      <button
        type="button"
        onClick={() => {
          setError("none");
          void login({
            email: "admin@example.test",
            password: "correct horse battery staple",
            rememberMe: true,
          }).catch((loginError: unknown) => {
            setError(loginError instanceof Error ? loginError.message : "unknown");
          });
        }}
      >
        login
      </button>
    </div>
  );
}

describe("AuthProvider bootstrap supersession", () => {
  beforeEach(() => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();
    Object.defineProperty(window, "localStorage", { configurable: true, value: localStorage });
    Object.defineProperty(window, "sessionStorage", { configurable: true, value: sessionStorage });
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("sessionStorage", sessionStorage);
    replace.mockReset();
    push.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("allows a fresh login after reloading an already-ended session", async () => {
    window.localStorage.setItem("admin_auth_session_event", JSON.stringify({
      realm: "admin",
      kind: "session-ended",
      eventId: "persisted-session-end",
      sourceId: "closed-tab",
      issuedAt: Date.now() - 60_000,
      sessionId: "old-session",
    }));
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/login") return jsonResponse(webAuthResponse());
      if (url === "/api/admin/core/v1/auth/me") return jsonResponse(adminMePayload());
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthProvider><LoginProbe /></AuthProvider>);

    await waitFor(() => expect(screen.getByText("ENDED:none")).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("login"));
    await waitFor(() =>
      expect(screen.getByText("AUTHENTICATED:admin@example.test")).toBeTruthy(),
    );
    expect(JSON.parse(window.localStorage.getItem("admin_auth_session_event") ?? "null"))
      .toMatchObject({ kind: "session-updated" });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/admin/core/v1/auth/login",
      "/api/admin/core/v1/auth/me",
    ]);
    expect(screen.getByText("error:none")).toBeTruthy();
  });

  it("keeps a completed sign-in when the cold bootstrap it raced finally answers", async () => {
    // The ordinary way an operator reaches /login: the tab loads with no
    // session, so bootstrap's `/auth/me` is already in flight and doomed. They
    // type their password and sign in while it is still out on a slow link.
    // When it finally answers, it is answering a question about a session that
    // no longer exists — and it used to overwrite the one they just created.
    const coldBootstrapMe = deferred<Response>();
    let meRequests = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/me") {
        meRequests += 1;
        // The first is the cold bootstrap; the second is login's own profile
        // read, inside the auth lock.
        return meRequests === 1 ? coldBootstrapMe.promise : jsonResponse(adminMePayload());
      }
      if (url === "/api/admin/core/v1/auth/login") {
        return jsonResponse(webAuthResponse());
      }
      if (url === "/api/admin/core/v1/auth/refresh") {
        return jsonResponse({ errorCode: "INVALID_REFRESH_TOKEN" }, 401);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(meRequests).toBe(1));

    fireEvent.click(screen.getByText("login"));
    await waitFor(() =>
      expect(screen.getByText("AUTHENTICATED:admin@example.test")).toBeTruthy(),
    );
    expect(window.sessionStorage.getItem("admin_session_meta")).not.toBeNull();

    // The stale answer lands.
    coldBootstrapMe.resolve(
      jsonResponse({ code: "COMMON.AUTH.MISSING_BEARER_TOKEN" }, 401),
    );
    await new Promise((resolveTick) => setTimeout(resolveTick, 40));

    expect(screen.getByText("AUTHENTICATED:admin@example.test")).toBeTruthy();
    expect(window.sessionStorage.getItem("admin_session_meta")).not.toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function adminMePayload(): Record<string, unknown> {
  return {
    data: {
      id: "019f0000-0000-7000-8000-000000000010",
      email: "admin@example.test",
      firstName: "Admin",
      lastName: "User",
      isSuperAdmin: false,
      role: { id: "019f0000-0000-7000-8000-000000000011", name: "Operator" },
      status: "ACTIVE",
      permissions: ["admin.dashboard.read"],
    },
  };
}

function webAuthResponse(): Record<string, unknown> {
  return {
    data: {
      tokenType: "Bearer",
      expiresIn: 600,
      sessionExpiresIn: 1_800,
      session: {
        id: "019f0000-0000-7000-8000-000000000001",
        clientId: "mutakamel-admin-web",
        clientType: "WEB",
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
    },
  };
}
