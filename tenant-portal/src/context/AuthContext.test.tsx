// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  publishTenantAuthEvent,
  publishTenantAuthLifecycle,
} from "@/lib/auth/sessionCoordinator";
import { TenantAuthGuard } from "@/components/auth/TenantAuthGuard";
import { TenantAuthProvider, useTenantAuth } from "./AuthContext";

const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/",
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

function LoginProbe() {
  const { authState, user, login, retryBootstrap } = useTenantAuth();
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
            email: "tenant@example.test",
            password: "correct horse battery staple",
            rememberMe: true,
          }).catch((loginError: unknown) => {
            setError(
              loginError instanceof Error ? loginError.message : "unknown",
            );
          });
        }}
      >
        login
      </button>
      <button type="button" onClick={() => void retryBootstrap()}>
        retry
      </button>
    </div>
  );
}

describe("TenantAuthProvider committed login bootstrap", () => {
  beforeEach(() => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorage,
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: sessionStorage,
    });
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("sessionStorage", sessionStorage);
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
    replace.mockReset();
    push.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(["http-503", "network"] as const)(
    "commits login metadata before /me and stays degraded on %s failure",
    async (failureKind) => {
      let loginAccepted = false;
      const requestedPaths: string[] = [];
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        requestedPaths.push(`${init?.method ?? "GET"} ${url}`);
        if (url === "/api/tenant/core/v1/auth/login") {
          loginAccepted = true;
          return jsonResponse(webAuthResponse());
        }
        if (url === "/api/tenant/core/v1/auth/me" && !loginAccepted) {
          return endedSessionResponse();
        }
        if (url === "/api/tenant/core/v1/auth/me") {
          if (failureKind === "network") {
            throw new TypeError("network unavailable");
          }
          return jsonResponse(
            { code: "AUTH_SESSION_CHECK_UNAVAILABLE" },
            503,
          );
        }
        throw new Error(`Unexpected request: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      render(
        <TenantAuthProvider>
          <LoginProbe />
        </TenantAuthProvider>,
      );
      await waitFor(() =>
        expect(screen.getByText("ENDED:none")).toBeTruthy(),
      );

      fireEvent.click(screen.getByRole("button", { name: "login" }));

      await waitFor(() =>
        expect(screen.getByText("DEGRADED:none")).toBeTruthy(),
      );
      const metadata = JSON.parse(
        window.sessionStorage.getItem("tenant_session_meta") ?? "null",
      ) as { sessionId?: string; authEventId?: string } | null;
      const event = JSON.parse(
        window.localStorage.getItem("tenant_auth_session_event") ?? "null",
      ) as { kind?: string; eventId?: string } | null;
      expect(metadata?.sessionId).toBe(
        "019f0000-0000-7000-8000-000000000002",
      );
      expect(metadata?.authEventId).toBe(event?.eventId);
      expect(event?.kind).toBe("session-updated");
      expect(requestedPaths).not.toContain(
        "POST /api/tenant/core/v1/auth/logout",
      );
      expect(requestedPaths.filter(
        (request) => request === "GET /api/tenant/core/v1/auth/me",
      )).toHaveLength(2);
      expect(push).not.toHaveBeenCalledWith("/");
    },
  );

  it("rolls back a server cookie on malformed login metadata without masking the original error", async () => {
    let loginAccepted = false;
    let rollbackCsrf: string | null = null;
    vi.spyOn(document, "cookie", "get").mockReturnValue(
      "__Host-mutakamel-tenant-csrf=tenant-csrf-proof",
    );
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/tenant/core/v1/auth/login") {
        loginAccepted = true;
        return jsonResponse({ data: { tokenType: "Bearer" } });
      }
      if (url === "/api/tenant/core/v1/auth/me" && !loginAccepted) {
        return endedSessionResponse();
      }
      if (url === "/api/tenant/core/v1/auth/logout") {
        rollbackCsrf = new Headers(init?.headers).get("x-csrf-token");
        throw new TypeError("rollback unavailable");
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TenantAuthProvider>
        <LoginProbe />
      </TenantAuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("ENDED:none")).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() =>
      expect(screen.getByText("error:INVALID_AUTH_RESPONSE")).toBeTruthy(),
    );
    expect(screen.getByText("UNAUTHENTICATED:none")).toBeTruthy();
    expect(rollbackCsrf).toBe("tenant-csrf-proof");
    expect(window.sessionStorage.getItem("tenant_session_meta")).toBeNull();
    expect(window.localStorage.getItem("tenant_auth_session_event")).toBeNull();
    expect(push).not.toHaveBeenCalledWith("/");
  });

  it.each([
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
    [503, "UNAVAILABLE"],
  ] as const)(
    "retains the authenticated profile when /me returns non-terminal %s",
    async (status, code) => {
      seedSessionState("session-a");
      let requestCount = 0;
      const fetchMock = vi.fn(async (url: string) => {
        if (url !== "/api/tenant/core/v1/auth/me") {
          throw new Error(`Unexpected request: ${url}`);
        }
        requestCount += 1;
        return requestCount === 1
          ? jsonResponse(profileResponse())
          : jsonResponse({ code }, status);
      });
      vi.stubGlobal("fetch", fetchMock);

      render(
        <TenantAuthProvider>
          <LoginProbe />
        </TenantAuthProvider>,
      );
      await waitFor(() => expect(
        screen.getByText("AUTHENTICATED:tenant@example.test"),
      ).toBeTruthy());

      fireEvent.click(screen.getByRole("button", { name: "retry" }));

      await waitFor(() => expect(
        screen.getByText("DEGRADED:tenant@example.test"),
      ).toBeTruthy());
      expect(window.sessionStorage.getItem("tenant_session_meta")).not.toBeNull();
      expect(replace).not.toHaveBeenCalledWith("/login");
    },
  );

  it("keeps the auth guard loading while a degraded bootstrap retry is pending", async () => {
    seedSessionState("session-a");
    let resolveRetry!: (response: Response) => void;
    let requestCount = 0;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url !== "/api/tenant/core/v1/auth/me") {
        throw new Error(`Unexpected request: ${url}`);
      }
      requestCount += 1;
      if (requestCount === 1) {
        return Promise.resolve(jsonResponse({ code: "UNAVAILABLE" }, 503));
      }
      return new Promise<Response>((resolve) => {
        resolveRetry = resolve;
      });
    }));

    render(
      <TenantAuthProvider>
        <TenantAuthGuard>
          <LoginProbe />
        </TenantAuthGuard>
      </TenantAuthProvider>,
    );
    await waitFor(() => expect(
      screen.getByRole("button", { name: "إعادة المحاولة" }),
    ).toBeTruthy());
    replace.mockReset();

    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));

    await waitFor(() => expect(
      screen.getByText("جاري التحقق من الجلسة..."),
    ).toBeTruthy());
    expect(replace).not.toHaveBeenCalledWith("/login");

    resolveRetry(jsonResponse(profileResponse()));
    await waitFor(() => expect(
      screen.getByText("AUTHENTICATED:tenant@example.test"),
    ).toBeTruthy());
  });

  it("ignores a tombstone for another SID and accepts the exact SID tombstone", async () => {
    seedSessionState("session-a");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(profileResponse())));
    render(
      <TenantAuthProvider>
        <LoginProbe />
      </TenantAuthProvider>,
    );
    await waitFor(() => expect(
      screen.getByText("AUTHENTICATED:tenant@example.test"),
    ).toBeTruthy());

    publishTenantAuthEvent("session-ended", "session-b");
    expect(screen.getByText("AUTHENTICATED:tenant@example.test")).toBeTruthy();
    expect(window.sessionStorage.getItem("tenant_session_meta")).not.toBeNull();

    publishTenantAuthEvent("session-ended", "session-a");
    await waitFor(() => expect(screen.getByText("ENDED:none")).toBeTruthy());
    expect(window.sessionStorage.getItem("tenant_session_meta")).toBeNull();
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("does not commit a delayed bootstrap response after its SID ends", async () => {
    seedSessionState("session-a");
    let resolveProfile!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveProfile = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <TenantAuthProvider>
        <LoginProbe />
      </TenantAuthProvider>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    publishTenantAuthEvent("session-ended", "session-a");
    resolveProfile(jsonResponse(profileResponse()));

    await waitFor(() => expect(screen.getByText("ENDED:none")).toBeTruthy());
    expect(screen.queryByText("AUTHENTICATED:tenant@example.test")).toBeNull();
  });

  it("clears the old profile before bootstrapping an accepted account switch", async () => {
    seedSessionState("session-a");
    let requestCount = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url !== "/api/tenant/core/v1/auth/me") {
        throw new Error(`Unexpected request: ${url}`);
      }
      requestCount += 1;
      return requestCount === 1
        ? jsonResponse(profileResponse())
        : jsonResponse({ code: "UNAVAILABLE" }, 503);
    }));
    render(
      <TenantAuthProvider>
        <LoginProbe />
      </TenantAuthProvider>,
    );
    await waitFor(() => expect(
      screen.getByText("AUTHENTICATED:tenant@example.test"),
    ).toBeTruthy());

    const previousMetadata = JSON.parse(
      window.sessionStorage.getItem("tenant_session_meta") ?? "null",
    ) as { savedAt: number };
    publishTenantAuthEvent("session-updated", "session-b", true, {
      savedAt: previousMetadata.savedAt + 1,
      expiresIn: 600,
      sessionExpiresIn: 1_800,
      authorizationVersion: 1,
      profileVersion: 1,
    });

    await waitFor(() => expect(screen.getByText("DEGRADED:none")).toBeTruthy());
    expect(requestCount).toBe(2);
    expect(JSON.parse(
      window.sessionStorage.getItem("tenant_session_meta") ?? "null",
    )).toMatchObject({ sessionId: "session-b" });
  });

  it("keeps the auth guard loading while a new account bootstrap is pending", async () => {
    seedSessionState("session-a");
    let resolveSwitchedProfile!: (response: Response) => void;
    let requestCount = 0;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url !== "/api/tenant/core/v1/auth/me") {
        throw new Error(`Unexpected request: ${url}`);
      }
      requestCount += 1;
      if (requestCount === 1) {
        return Promise.resolve(jsonResponse(profileResponse()));
      }
      return new Promise<Response>((resolve) => {
        resolveSwitchedProfile = resolve;
      });
    }));
    render(
      <TenantAuthProvider>
        <TenantAuthGuard>
          <LoginProbe />
        </TenantAuthGuard>
      </TenantAuthProvider>,
    );
    await waitFor(() => expect(
      screen.getByText("AUTHENTICATED:tenant@example.test"),
    ).toBeTruthy());
    replace.mockReset();

    const previousMetadata = JSON.parse(
      window.sessionStorage.getItem("tenant_session_meta") ?? "null",
    ) as { savedAt: number };
    publishTenantAuthEvent("session-updated", "session-b", true, {
      savedAt: previousMetadata.savedAt + 1,
      expiresIn: 600,
      sessionExpiresIn: 1_800,
      authorizationVersion: 1,
      profileVersion: 1,
    });

    await waitFor(() => expect(
      screen.getByText("جاري التحقق من الجلسة..."),
    ).toBeTruthy());
    expect(replace).not.toHaveBeenCalledWith("/login");

    act(() => {
      publishTenantAuthLifecycle("STALE");
      publishTenantAuthLifecycle("REFRESHING");
      publishTenantAuthLifecycle("AUTHENTICATED");
    });
    expect(screen.getByText("جاري التحقق من الجلسة...")).toBeTruthy();
    expect(replace).not.toHaveBeenCalledWith("/login");

    resolveSwitchedProfile(jsonResponse(profileResponse()));
    await waitFor(() => expect(
      screen.getByText("AUTHENTICATED:tenant@example.test"),
    ).toBeTruthy());
  });
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function endedSessionResponse(): Response {
  return jsonResponse({ code: "AUTH_SESSION_ENDED" }, 401);
}

function webAuthResponse(): Record<string, unknown> {
  return {
    data: {
      tokenType: "Bearer",
      expiresIn: 600,
      sessionExpiresIn: 1_800,
      session: {
        id: "019f0000-0000-7000-8000-000000000002",
        clientId: "mutakamel-tenant-web",
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

function profileResponse(): Record<string, unknown> {
  return {
    data: {
      id: "tenant-user-a",
      email: "tenant@example.test",
      firstName: "Tenant",
      lastName: "User",
      isTenantOwner: true,
      status: "ACTIVE",
      accessibleBranches: [],
      accessibleCompanies: ["company-a"],
      permissions: [],
      teamMemberships: [],
    },
  };
}

function seedSessionState(sessionId: string): void {
  const savedAt = Date.now();
  const eventId = `event-${sessionId}`;
  window.localStorage.setItem("tenant_auth_session_event", JSON.stringify({
    realm: "tenant",
    kind: "session-updated",
    eventId,
    sourceId: "test-source",
    issuedAt: savedAt,
    sessionId,
    timing: {
      expiresIn: 600,
      sessionExpiresIn: 1_800,
      authorizationVersion: 1,
      profileVersion: 1,
    },
  }));
  window.sessionStorage.setItem("tenant_session_meta", JSON.stringify({
    savedAt,
    expiresIn: 600,
    sessionExpiresIn: 1_800,
    tokenType: "Bearer",
    sessionId,
    remember: true,
    authorizationVersion: 1,
    profileVersion: 1,
    authEventId: eventId,
  }));
}
