// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ADMIN_AUTH_RETRY_BASE_MS } from "@/lib/auth/sessionRefresh";

const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/dashboard",
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

function AuthProbe() {
  const { authState, user } = useAuth();
  return <div>{authState}:{user?.email ?? "none"}</div>;
}

function ProtectedProbe() {
  return <div>protected-content</div>;
}

function LogoutProbe() {
  const { authState, user, logout } = useAuth();
  return (
    <div>
      <span>{authState}:{user?.email ?? "none"}</span>
      <button type="button" onClick={() => void logout().catch(() => undefined)}>
        logout
      </button>
    </div>
  );
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

describe("AuthProvider server-authoritative bootstrap", () => {
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("validates a cold tab, then silently seeds refresh timing", async () => {
    const requestedUrls: string[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      requestedUrls.push(url);
      if (url === "/api/admin/core/v1/auth/me") {
        expect(init?.cache).toBe("no-store");
        return jsonResponse(adminMePayload());
      }
      if (url === "/api/admin/core/v1/auth/refresh") {
        return jsonResponse(webAuthResponse("mutakamel-admin-web"));
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("AUTHENTICATED:admin@example.test")).toBeTruthy(),
    );
    await waitFor(() =>
      expect(requestedUrls).toContain("/api/admin/core/v1/auth/refresh"),
    );
    await waitFor(() =>
      expect(window.sessionStorage.getItem("admin_session_meta")).not.toBeNull(),
    );
    expect(requestedUrls[0]).toBe("/api/admin/core/v1/auth/me");
    expect(window.sessionStorage.getItem("access_token")).toBeNull();
  });

  it("starts bounded presence after cold bootstrap and stops it on unmount", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T10:00:00.000Z"));
    vi.spyOn(document, "cookie", "get").mockReturnValue(
      "__Host-mutakamel-admin-csrf=admin-csrf-proof",
    );
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    const requestedUrls: string[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      requestedUrls.push(url);
      if (url === "/api/admin/core/v1/auth/me") {
        return jsonResponse(adminMePayload());
      }
      if (url === "/api/admin/core/v1/auth/refresh") {
        return jsonResponse(webAuthResponse("mutakamel-admin-web"));
      }
      if (url === "/api/admin/core/v1/auth/presence") {
        const headers = new Headers(init?.headers);
        expect(headers.get("x-csrf-token")).toBe("admin-csrf-proof");
        expect(headers.has("x-auth-user-activity")).toBe(false);
        return jsonResponse({
          data: {
            sessionId: "019f0000-0000-7000-8000-000000000001",
            sessionExpiresIn: 1_800,
            idleExpiresAt: "2026-08-26T10:35:00.000Z",
            absoluteExpiresAt: "2026-08-26T22:00:00.000Z",
          },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("AUTHENTICATED:admin@example.test")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(requestedUrls).toContain("/api/admin/core/v1/auth/refresh");
    expect(requestedUrls).not.toContain(
      "/api/admin/core/v1/auth/presence",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000);
    });
    expect(requestedUrls.filter((url) =>
      url === "/api/admin/core/v1/auth/presence"
    )).toHaveLength(1);

    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60_000);
    });
    expect(requestedUrls.filter((url) =>
      url === "/api/admin/core/v1/auth/presence"
    )).toHaveLength(1);
  });

  it("keeps a cold protected tree pending while an expired /me request refreshes", async () => {
    let meRequests = 0;
    let resolveRefresh!: (response: Response) => void;
    let resolveReplayedMe!: (response: Response) => void;
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    const replayedMeResponse = new Promise<Response>((resolve) => {
      resolveReplayedMe = resolve;
    });
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/admin/core/v1/auth/me") {
        meRequests += 1;
        if (meRequests === 1) {
          return Promise.resolve(
            jsonResponse({ code: "COMMON.AUTH.TOKEN_EXPIRED" }, 401),
          );
        }
        return replayedMeResponse;
      }
      if (url === "/api/admin/core/v1/auth/refresh") {
        return refreshResponse;
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AuthGuard>
          <ProtectedProbe />
        </AuthGuard>
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/core/v1/auth/refresh",
        expect.objectContaining({ credentials: "include", method: "POST" }),
      ),
    );
    expect(screen.queryByText("protected-content")).toBeNull();
    expect(screen.getByText("جاري التحقق من الجلسة...")).toBeTruthy();
    expect(push).not.toHaveBeenCalledWith("/login");

    await act(async () => {
      resolveRefresh(jsonResponse(webAuthResponse("mutakamel-admin-web")));
    });

    await waitFor(() => expect(meRequests).toBe(2));
    expect(screen.queryByText("protected-content")).toBeNull();
    expect(screen.getByText("جاري التحقق من الجلسة...")).toBeTruthy();
    expect(push).not.toHaveBeenCalledWith("/login");

    await act(async () => {
      resolveReplayedMe(jsonResponse(adminMePayload()));
    });

    await waitFor(() =>
      expect(screen.getByText("protected-content")).toBeTruthy(),
    );
    expect(meRequests).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(push).not.toHaveBeenCalledWith("/login");
  });

  it("keeps the protected tree mounted while proactive refresh is in flight", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    window.sessionStorage.setItem(
      "admin_session_meta",
      JSON.stringify({
        savedAt: Date.now(),
        expiresIn: 60,
        sessionExpiresIn: 1_800,
        tokenType: "Bearer",
        sessionId: "019f0000-0000-7000-8000-000000000001",
        remember: false,
        authorizationVersion: 1,
        profileVersion: 1,
        authEventId: "event-before-proactive-refresh",
      }),
    );

    let resolveRefresh!: (response: Response) => void;
    const heldRefresh = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    let refreshRequests = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/admin/core/v1/auth/me") {
        return Promise.resolve(jsonResponse(adminMePayload()));
      }
      if (url === "/api/admin/core/v1/auth/refresh") {
        refreshRequests += 1;
        return heldRefresh;
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AuthGuard>
          <ProtectedProbe />
        </AuthGuard>
      </AuthProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("protected-content")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(48_000);
    });
    expect(refreshRequests).toBe(1);
    expect(screen.getByText("protected-content")).toBeTruthy();
    expect(push).not.toHaveBeenCalledWith("/login");

    await act(async () => {
      resolveRefresh(jsonResponse(webAuthResponse("mutakamel-admin-web", 60)));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("protected-content")).toBeTruthy();
    expect(refreshRequests).toBe(1);
  });

  it("hides the old protected tree while a different tab session is validated", async () => {
    window.sessionStorage.setItem(
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
        authEventId: "old-session-event",
      }),
    );
    let meRequests = 0;
    const pendingNewSession = new Promise<Response>(() => undefined);
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url !== "/api/admin/core/v1/auth/me") {
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      }
      meRequests += 1;
      return meRequests === 1
        ? Promise.resolve(jsonResponse(adminMePayload()))
        : pendingNewSession;
    }));

    render(
      <AuthProvider>
        <AuthGuard>
          <ProtectedProbe />
        </AuthGuard>
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("protected-content")).toBeTruthy(),
    );

    act(() => {
      window.dispatchEvent(new CustomEvent("admin-auth-session-event", {
        detail: {
          realm: "admin",
          kind: "session-updated",
          eventId: "new-session-event",
          sourceId: "other-tab",
          issuedAt: Date.now() + 1,
          sessionId: "019f0000-0000-7000-8000-000000000002",
          timing: {
            expiresIn: 600,
            sessionExpiresIn: 1_800,
            authorizationVersion: 1,
            profileVersion: 1,
          },
        },
      }));
    });

    expect(screen.queryByText("protected-content")).toBeNull();
    expect(screen.getByText(/الجلسة/u)).toBeTruthy();
    await waitFor(() => expect(meRequests).toBe(2));
    expect(push).not.toHaveBeenCalledWith("/login");
  });

  it("ignores a delayed logout event from an older session", async () => {
    const savedAt = Date.now();
    window.sessionStorage.setItem(
      "admin_session_meta",
      JSON.stringify({
        savedAt,
        expiresIn: 600,
        sessionExpiresIn: 1_800,
        tokenType: "Bearer",
        sessionId: "session-new",
        remember: false,
        authorizationVersion: 1,
        profileVersion: 1,
        authEventId: "new-session-event",
      }),
    );
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(adminMePayload())));

    render(
      <AuthProvider>
        <AuthGuard>
          <ProtectedProbe />
        </AuthGuard>
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("protected-content")).toBeTruthy(),
    );

    act(() => {
      window.dispatchEvent(new CustomEvent("admin-auth-session-event", {
        detail: {
          realm: "admin",
          kind: "session-ended",
          eventId: "delayed-old-logout",
          sourceId: "old-tab",
          issuedAt: savedAt - 1,
          sessionId: "session-old",
        },
      }));
    });

    expect(screen.getByText("protected-content")).toBeTruthy();
    expect(window.sessionStorage.getItem("admin_session_meta")).not.toBeNull();
    expect(replace).not.toHaveBeenCalledWith("/login");
  });

  it("holds bootstrap through a transient refresh 502 without clearing the session", async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(
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
        authEventId: "event-before-transient-failure",
      }),
    );

    let meRequests = 0;
    let refreshRequests = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/me") {
        meRequests += 1;
        if (meRequests === 1) {
          return jsonResponse({ code: "COMMON.AUTH.TOKEN_EXPIRED" }, 401);
        }
        return jsonResponse(adminMePayload());
      }
      if (url === "/api/admin/core/v1/auth/refresh") {
        refreshRequests += 1;
        if (refreshRequests === 1) {
          return jsonResponse({ code: "GW.UPSTREAM.UNAVAILABLE" }, 502);
        }
        return jsonResponse(webAuthResponse("mutakamel-admin-web"));
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AuthGuard>
          <ProtectedProbe />
        </AuthGuard>
      </AuthProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/الجلسة/u)).toBeTruthy();
    expect(screen.queryByText("protected-content")).toBeNull();
    expect(window.sessionStorage.getItem("admin_session_meta")).not.toBeNull();
    expect(refreshRequests).toBe(1);
    expect(push).not.toHaveBeenCalledWith("/login");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ADMIN_AUTH_RETRY_BASE_MS);
    });

    expect(screen.getByText("protected-content")).toBeTruthy();
    expect(meRequests).toBe(2);
    expect(refreshRequests).toBe(2);
    expect(window.sessionStorage.getItem("admin_session_meta")).not.toBeNull();
    expect(push).not.toHaveBeenCalledWith("/login");
  });

  it.each([
    [401, "COMMON.AUTH.MISSING_TOKEN"],
    [403, "AUTH_CSRF_INVALID"],
  ])(
    "recovers invisibly when refresh first returns non-terminal %s %s",
    async (refreshStatus, refreshCode) => {
      vi.useFakeTimers();
      let meRequests = 0;
      let refreshRequests = 0;
      window.sessionStorage.setItem(
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
          authEventId: "event-before-nonterminal-refresh",
        }),
      );
      vi.stubGlobal("fetch", vi.fn(async (url: string) => {
        if (url === "/api/admin/core/v1/auth/me") {
          meRequests += 1;
          if (refreshRequests >= 2) {
            return jsonResponse(adminMePayload());
          }
          return jsonResponse({ code: "COMMON.AUTH.TOKEN_EXPIRED" }, 401);
        }
        if (url === "/api/admin/core/v1/auth/refresh") {
          refreshRequests += 1;
          if (refreshRequests === 1) {
            return jsonResponse({ code: refreshCode }, refreshStatus);
          }
          return jsonResponse(webAuthResponse("mutakamel-admin-web"));
        }
        throw new Error(`Unexpected request: ${url}`);
      }));

      render(
        <AuthProvider>
          <AuthGuard>
            <ProtectedProbe />
          </AuthGuard>
        </AuthProvider>,
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.queryByText("protected-content")).toBeNull();
      expect(window.sessionStorage.getItem("admin_session_meta")).not.toBeNull();
      expect(replace).not.toHaveBeenCalledWith("/login");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(ADMIN_AUTH_RETRY_BASE_MS);
      });

      expect(screen.getByText("protected-content")).toBeTruthy();
      expect(meRequests).toBe(2);
      expect(refreshRequests).toBe(2);
      expect(window.sessionStorage.getItem("admin_session_meta")).not.toBeNull();
      expect(replace).not.toHaveBeenCalledWith("/login");
    },
  );

  it("retains an indeterminate session as degraded on availability failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(
        JSON.stringify({ code: "AUTH_SESSION_CHECK_UNAVAILABLE" }),
        { status: 503, headers: { "Content-Type": "application/problem+json" } },
      )));

    render(
      <AuthProvider>
        <AuthGuard>
          <AuthProbe />
        </AuthGuard>
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("تعذر التحقق من الجلسة حاليًا. لم يتم تسجيل خروجك.")).toBeTruthy(),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("retains the authenticated state when durable logout fails", async () => {
    window.sessionStorage.setItem(
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
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/me") {
        return new Response(
          JSON.stringify({
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
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ code: "AUTH_SESSION_WRITE_UNAVAILABLE" }),
        { status: 503, headers: { "Content-Type": "application/problem+json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <LogoutProbe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("AUTHENTICATED:admin@example.test")).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() =>
      expect(screen.getByText("DEGRADED:admin@example.test")).toBeTruthy(),
    );
    expect(window.sessionStorage.getItem("admin_session_meta")).not.toBeNull();
    expect(replace).not.toHaveBeenCalledWith("/login");
  });

  it.each([
    [401, "COMMON.AUTH.MISSING_TOKEN"],
    [403, "AUTH_CSRF_INVALID"],
  ])(
    "retains a freshly committed login after non-terminal %s %s",
    async (status, code) => {
      let loginAccepted = false;
      let postLoginMeRequests = 0;
      let refreshRequests = 0;
      let logoutRequests = 0;
      vi.stubGlobal("fetch", vi.fn(async (url: string) => {
        if (url === "/api/admin/core/v1/auth/login") {
          loginAccepted = true;
          return jsonResponse(webAuthResponse("mutakamel-admin-web"));
        }
        if (url === "/api/admin/core/v1/auth/me" && !loginAccepted) {
          return endedSessionResponse();
        }
        if (url === "/api/admin/core/v1/auth/me") {
          postLoginMeRequests += 1;
          if (status === 401 && postLoginMeRequests === 1) {
            return jsonResponse({ code: "COMMON.AUTH.TOKEN_EXPIRED" }, 401);
          }
          return jsonResponse({ code }, status);
        }
        if (url === "/api/admin/core/v1/auth/refresh") {
          refreshRequests += 1;
          return jsonResponse(webAuthResponse("mutakamel-admin-web"));
        }
        if (url === "/api/admin/core/v1/auth/logout") {
          logoutRequests += 1;
          return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected request: ${url}`);
      }));

      render(
        <AuthProvider>
          <LoginProbe />
        </AuthProvider>,
      );
      await waitFor(() => expect(screen.getByText("ENDED:none")).toBeTruthy());
      replace.mockClear();
      fireEvent.click(screen.getByRole("button", { name: "login" }));

      await waitFor(() =>
        expect(screen.getByText("DEGRADED:none")).toBeTruthy(),
      );
      expect(window.sessionStorage.getItem("admin_session_meta")).not.toBeNull();
      expect(logoutRequests).toBe(0);
      expect(refreshRequests).toBe(0);
      expect(JSON.parse(
        window.localStorage.getItem("admin_auth_session_event") ?? "null",
      )).toMatchObject({ kind: "session-updated" });
      expect(replace).not.toHaveBeenCalledWith("/login");
    },
  );

  it.each(["http-503", "network"] as const)(
    "commits login metadata before /me and stays degraded on %s failure",
    async (failureKind) => {
      let loginAccepted = false;
      const requestedPaths: string[] = [];
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        requestedPaths.push(`${init?.method ?? "GET"} ${url}`);
        if (url === "/api/admin/core/v1/auth/login") {
          loginAccepted = true;
          return jsonResponse(webAuthResponse("mutakamel-admin-web"));
        }
        if (url === "/api/admin/core/v1/auth/me" && !loginAccepted) {
          return endedSessionResponse();
        }
        if (url === "/api/admin/core/v1/auth/me") {
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
        <AuthProvider>
          <LoginProbe />
        </AuthProvider>,
      );
      await waitFor(() =>
        expect(screen.getByText("ENDED:none")).toBeTruthy(),
      );

      fireEvent.click(screen.getByRole("button", { name: "login" }));

      await waitFor(() =>
        expect(screen.getByText("DEGRADED:none")).toBeTruthy(),
      );
      const metadata = JSON.parse(
        window.sessionStorage.getItem("admin_session_meta") ?? "null",
      ) as { sessionId?: string; authEventId?: string } | null;
      const event = JSON.parse(
        window.localStorage.getItem("admin_auth_session_event") ?? "null",
      ) as { kind?: string; eventId?: string } | null;
      expect(metadata?.sessionId).toBe(
        "019f0000-0000-7000-8000-000000000001",
      );
      expect(metadata?.authEventId).toBe(event?.eventId);
      expect(event?.kind).toBe("session-updated");
      expect(requestedPaths).not.toContain(
        "POST /api/admin/core/v1/auth/logout",
      );
      expect(requestedPaths.filter(
        (request) => request === "GET /api/admin/core/v1/auth/me",
      )).toHaveLength(2);
      expect(push).not.toHaveBeenCalledWith("/dashboard");
    },
  );

  it("keeps an overtaken cross-tab login pending for authoritative adoption", async () => {
    let loginRequests = 0;
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/admin/core/v1/auth/me") return endedSessionResponse();
      if (url === "/api/admin/core/v1/auth/login") {
        loginRequests += 1;
        return jsonResponse(webAuthResponse("mutakamel-admin-web"));
      }
      throw new Error(`Unexpected request: ${url}`);
    }));

    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText("ENDED:none")).toBeTruthy());

    const blockerCreatedAt = Number.MAX_SAFE_INTEGER - 10;
    window.localStorage.setItem(
      "admin_auth_mutex_entry:blocker",
      JSON.stringify({
        id: "blocker",
        state: "active",
        createdAt: blockerCreatedAt,
        expiresAt: Date.now() + 60_000,
      }),
    );
    window.localStorage.setItem(
      "admin_auth_intent",
      JSON.stringify({ id: "blocker", createdAt: blockerCreatedAt }),
    );
    fireEvent.click(screen.getByRole("button", { name: "login" }));

    let waitingEntry: { id: string; createdAt: number } | undefined;
    await waitFor(() => {
      waitingEntry = Array.from({ length: window.localStorage.length })
        .map((_, index) => window.localStorage.key(index))
        .filter((key): key is string =>
          Boolean(key?.startsWith("admin_auth_mutex_entry:")))
        .map((key) => JSON.parse(
          window.localStorage.getItem(key) ?? "null",
        ) as { id: string; state: string; createdAt: number })
        .find((entry) => entry.state === "waiting");
      expect(waitingEntry).toBeDefined();
    });
    window.localStorage.setItem(
      "admin_auth_intent",
      JSON.stringify({
        id: "newer-tab-login",
        createdAt: (waitingEntry?.createdAt ?? blockerCreatedAt) + 1,
      }),
    );
    window.localStorage.removeItem("admin_auth_mutex_entry:blocker");

    await waitFor(() =>
      expect(screen.getByText("STALE:none")).toBeTruthy());
    expect(screen.getByText("error:AUTH_SESSION_CHANGED")).toBeTruthy();
    expect(loginRequests).toBe(0);
    expect(window.sessionStorage.getItem("admin_session_meta")).toBeNull();
    expect(push).not.toHaveBeenCalledWith("/dashboard");
  });

  it("rolls back a server cookie on malformed login metadata without masking the original error", async () => {
    let loginAccepted = false;
    let rollbackCsrf: string | null = null;
    vi.spyOn(document, "cookie", "get").mockReturnValue(
      "__Host-mutakamel-admin-csrf=admin-csrf-proof",
    );
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/admin/core/v1/auth/login") {
        loginAccepted = true;
        return jsonResponse({ data: { tokenType: "Bearer" } });
      }
      if (url === "/api/admin/core/v1/auth/me" && !loginAccepted) {
        return endedSessionResponse();
      }
      if (url === "/api/admin/core/v1/auth/logout") {
        rollbackCsrf = new Headers(init?.headers).get("x-csrf-token");
        throw new TypeError("rollback unavailable");
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("ENDED:none")).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() =>
      expect(screen.getByText("error:INVALID_AUTH_RESPONSE")).toBeTruthy(),
    );
    expect(screen.getByText("UNAUTHENTICATED:none")).toBeTruthy();
    expect(rollbackCsrf).toBe("admin-csrf-proof");
    expect(window.sessionStorage.getItem("admin_session_meta")).toBeNull();
    expect(JSON.parse(
      window.localStorage.getItem("admin_auth_session_event") ?? "null",
    )).toMatchObject({ kind: "session-ended" });
    expect(push).not.toHaveBeenCalledWith("/dashboard");
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

function webAuthResponse(
  clientId: string,
  expiresIn = 600,
): Record<string, unknown> {
  return {
    data: {
      tokenType: "Bearer",
      expiresIn,
      sessionExpiresIn: 1_800,
      session: {
        id: "019f0000-0000-7000-8000-000000000001",
        clientId,
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
