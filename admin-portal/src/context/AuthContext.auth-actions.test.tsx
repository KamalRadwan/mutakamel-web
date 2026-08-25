// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

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

function AuthActionsProbe() {
  const { authState, user, acceptInvite, resetPassword, logoutAll } = useAuth();
  const [error, setError] = useState("none");
  const run = (action: () => Promise<void>) => {
    setError("none");
    void action().catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "unknown");
    });
  };
  return (
    <div>
      <span>{authState}:{user?.email ?? "none"}</span>
      <span>error:{error}</span>
      <button type="button" onClick={() => run(() => acceptInvite({
        token: "abcdefghijklmnop",
        newPassword: "StrongPassword1!",
      }))}>accept</button>
      <button type="button" onClick={() => run(() => resetPassword({
        token: "qrstuvwxyzabcdef",
        newPassword: "AnotherStrong2@",
      }))}>reset</button>
      <button type="button" onClick={() => run(logoutAll)}>logout-all</button>
    </div>
  );
}

describe("AuthProvider admin password and all-session actions", () => {
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

  it("accepts an invite with the exact non-replayable DTO and establishes the cookie session", async () => {
    let accepted = false;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/me") {
        return accepted ? jsonResponse(adminMePayload()) : endedSessionResponse();
      }
      if (url === "/api/admin/core/v1/auth/accept-invite") {
        accepted = true;
        return jsonResponse(webAuthResponse());
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthProvider><AuthActionsProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("ENDED:none")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "accept" }));

    await waitFor(() => expect(screen.getByText("AUTHENTICATED:admin@example.test"))
      .toBeInTheDocument());
    expect(push).toHaveBeenCalledWith("/dashboard");
    const [, init] = findRequest(fetchMock, "/api/admin/core/v1/auth/accept-invite");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({
        token: "abcdefghijklmnop",
        newPassword: "StrongPassword1!",
      }),
    });
    expect(new Headers(init?.headers).get("idempotency-key")).toBeNull();
    expect(window.sessionStorage.getItem("admin_session_meta")).not.toBeNull();
  });

  it("resets a password with the exact DTO and ends local session state", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/me") return endedSessionResponse();
      if (url === "/api/admin/core/v1/auth/reset-password") {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthProvider><AuthActionsProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("ENDED:none")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "reset" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    const [, init] = findRequest(fetchMock, "/api/admin/core/v1/auth/reset-password");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({
        token: "qrstuvwxyzabcdef",
        newPassword: "AnotherStrong2@",
      }),
    });
    expect(new Headers(init?.headers).get("idempotency-key")).toBeNull();
    expect(window.sessionStorage.getItem("admin_session_meta")).toBeNull();
  });

  it("refreshes session ownership, logs out all devices, and clears local state", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/me") return jsonResponse(adminMePayload());
      if (url === "/api/admin/core/v1/auth/refresh") {
        return jsonResponse(webAuthResponse());
      }
      if (url === "/api/admin/core/v1/auth/logout-all") {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthProvider><AuthActionsProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("AUTHENTICATED:admin@example.test"))
      .toBeInTheDocument());
    await waitFor(() => expect(window.sessionStorage.getItem("admin_session_meta"))
      .not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "logout-all" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    const [, init] = findRequest(fetchMock, "/api/admin/core/v1/auth/logout-all");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(new Headers(init?.headers).get("idempotency-key")).toBeNull();
    expect(window.sessionStorage.getItem("admin_session_meta")).toBeNull();
    expect(screen.getByText("ENDED:none")).toBeInTheDocument();
  });
});

function findRequest(
  fetchMock: ReturnType<typeof vi.fn>,
  url: string,
): [string, RequestInit | undefined] {
  const request = fetchMock.mock.calls.find(([candidate]) => candidate === url);
  expect(request).toBeDefined();
  return request as [string, RequestInit | undefined];
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function endedSessionResponse(): Response {
  return jsonResponse({ code: "AUTH_SESSION_ENDED" }, 401);
}

function adminMePayload(): Record<string, unknown> {
  return {
    data: {
      id: "019f0000-0000-7000-8000-000000000010",
      email: "admin@example.test",
      firstName: "Admin",
      lastName: "User",
      isSuperAdmin: false,
      role: {
        id: "019f0000-0000-7000-8000-000000000011",
        name: "Operator",
      },
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
        createdAt: "2026-08-12T10:00:00.000Z",
        lastRefreshAt: null,
        lastUserActivityAt: null,
        idleExpiresAt: "2026-08-12T10:30:00.000Z",
        absoluteExpiresAt: "2026-08-12T22:00:00.000Z",
        refreshUseCount: "0",
        accessIssueCount: "1",
        credentialVersion: 1,
        authorizationVersion: 1,
        profileVersion: 1,
      },
    },
  };
}
