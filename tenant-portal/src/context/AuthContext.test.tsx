// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantAuthProvider, useTenantAuth } from "./AuthContext";

const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
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
  const { authState, user, login } = useTenantAuth();
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
    expect(JSON.parse(
      window.localStorage.getItem("tenant_auth_session_event") ?? "null",
    )).toMatchObject({ kind: "session-ended" });
    expect(push).not.toHaveBeenCalledWith("/");
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
