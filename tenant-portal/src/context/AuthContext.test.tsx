// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  publishTenantAuthEvent,
  publishTenantAuthLifecycle,
} from "@/lib/auth/sessionCoordinator";
import { TenantAuthGuard } from "@/components/auth/TenantAuthGuard";
import { I18nProvider } from "@/i18n/I18nContext";
import { ar } from "@/i18n/dictionaries/ar";
import { useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
import { TenantAuthProvider, useTenantAuth } from "./AuthContext";

const replace = vi.fn();
const push = vi.fn();
const SCOPE_BRANCH = "0192f3a0-0000-7000-8000-000000000002";
const SCOPE_COMPANY = "0192f3a0-0000-7000-8000-000000000001";
const OTHER_SCOPE_COMPANY = "0192f3a0-0000-7000-8000-000000000004";

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

// Sign-out is driven through the context, not a third probe button:
// `design:census` counts every hand-rolled button element under `src/`, tests
// included, and one more here is a ratchet regression that says nothing true
// about the design system.
const signOut: { run: (() => Promise<void>) | null } = { run: null };

function LogoutProbe() {
  const { authState, logout } = useTenantAuth();
  useEffect(() => {
    signOut.run = logout;
    return () => { signOut.run = null; };
  }, [logout]);
  return <span>state:{authState}</span>;
}

function OrganizationScopeProbe() {
  const headers = useOrganizationScopeHeaders("BRANCH_REQUIRED", SCOPE_BRANCH);
  return <output data-testid="organization-scope">{JSON.stringify(headers)}</output>;
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
    vi.spyOn(document, "cookie", "get").mockReturnValue("");
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

  it.each([false, true])(
    "settles a guest without /me or refresh when cookies are absent (stored metadata: %s)",
    async (hasStoredMetadata) => {
      if (hasStoredMetadata) seedSessionState("stale-session");
      vi.spyOn(document, "cookie", "get").mockReturnValue("unrelated-preference=1");
      const addListener = vi.spyOn(window, "addEventListener");
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      render(<TenantAuthProvider><LoginProbe /></TenantAuthProvider>);

      await waitFor(() => expect(screen.getByText("UNAUTHENTICATED:none")).toBeTruthy());
      fireEvent.focus(window);
      fireEvent(window, new Event("online"));
      fireEvent(window, new Event("pageshow"));
      fireEvent.click(screen.getByRole("button", { name: "retry" }));
      expect(fetchMock).not.toHaveBeenCalled();
      expect(addListener.mock.calls.some(([type]) => type === "pointerdown"))
        .toBe(false);
      expect(window.sessionStorage.getItem("tenant_session_meta")).toBeNull();
    },
  );

  // A second tab, a restored window, and the redirect after an accepted invite
  // all hold the cookies and none of the metadata, because `tenant_session_meta`
  // lives in sessionStorage. Authenticating on /me alone left every one of them
  // signed in and unable to stay that way — no refresh timing, no session id
  // for a 401 to name, no realtime generation — so the tab worked until the
  // access cookie expired and then failed every request. It spends one refresh
  // first instead, which the Gateway answers from the session cookie alone.
  it.each([
    "mutakamel-http-tenant-csrf",
    "__Host-mutakamel-tenant-csrf",
  ])("adopts a %s session this tab holds no metadata for", async (cookieName) => {
    vi.spyOn(document, "cookie", "get").mockReturnValue(`${cookieName}=csrf-proof`);
    const addListener = vi.spyOn(window, "addEventListener");
    const requested: string[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      requested.push(url);
      expect(init?.credentials).toBe("include");
      expect(new Headers(init?.headers).has("Authorization")).toBe(false);
      if (url === "/api/tenant/core/v1/auth/refresh") {
        expect(init?.method).toBe("POST");
        expect(new Headers(init?.headers).get("x-csrf-token")).toBe("csrf-proof");
        return jsonResponse(webAuthResponse());
      }
      expect(url).toBe("/api/tenant/core/v1/auth/me");
      expect(init?.method).toBe("GET");
      return jsonResponse(profileResponse());
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TenantAuthProvider><LoginProbe /></TenantAuthProvider>);

    await waitFor(() => expect(screen.getByText("AUTHENTICATED:tenant@example.test")).toBeTruthy());
    // Order is the point: /me answering 200 first would have left nothing to
    // repair the session with once the access cookie ran out.
    expect(requested).toEqual([
      "/api/tenant/core/v1/auth/refresh",
      "/api/tenant/core/v1/auth/me",
    ]);
    expect(JSON.parse(
      window.sessionStorage.getItem("tenant_session_meta") ?? "null",
    )).toMatchObject({ sessionId: "019f0000-0000-7000-8000-000000000002" });
    // Inside its own waitFor, not asserted straight after the one above.
    //
    // That first waitFor polls the DOM, and the DOM is written at commit time.
    // Activity tracking starts in a useEffect (AuthContext's `authState`/`user`
    // effect), and React flushes passive effects AFTER the commit — so there is
    // a window where the probe already reads AUTHENTICATED and the listener has
    // not been registered yet. Asserting immediately made this test fail on
    // roughly one run in three, and only when other tests ran alongside it,
    // because they are what made the machine slow enough to land in that window.
    //
    // Keep it as a retried assertion rather than an `act()`/flush: if tracking
    // genuinely never starts, this still fails on the waitFor timeout, so the
    // test keeps its teeth.
    await waitFor(() =>
      expect(addListener.mock.calls.some(([type]) => type === "pointerdown")).toBe(true),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // The failure this whole path exists for. A tab that never held metadata
  // could not refresh, so an access cookie that expired while it was closed
  // meant a 401 on the very first request and a degraded screen whose retry
  // button could only produce the same 401 — while the session cookie beside
  // it was still perfectly valid.
  it("recovers a fresh tab whose access cookie expired before its first request", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("mutakamel-http-tenant-csrf=csrf-proof");
    let refreshed = false;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/tenant/core/v1/auth/refresh") {
        refreshed = true;
        return jsonResponse(webAuthResponse());
      }
      if (url === "/api/tenant/core/v1/auth/me") {
        // The exact code the Gateway returns for an expired access cookie —
        // api-gateway-app/src/auth/gateway-jwt-verifier.service.ts.
        return refreshed
          ? jsonResponse(profileResponse())
          : jsonResponse({ code: "COMMON.AUTH.TOKEN_EXPIRED" }, 401);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TenantAuthProvider><LoginProbe /></TenantAuthProvider>);

    await waitFor(() => expect(
      screen.getByText("AUTHENTICATED:tenant@example.test"),
    ).toBeTruthy());
    expect(fetchMock.mock.calls.filter(([url]) =>
      url === "/api/tenant/core/v1/auth/refresh",
    )).toHaveLength(1);
  });

  // A refresh that fails for a reason that is not the session's fault must not
  // condemn a still-valid access cookie: the adoption is best-effort, and /me
  // stays the authority on whether this browser is signed in.
  it("still authenticates a metadata-less tab when the adoption refresh is unavailable", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("mutakamel-http-tenant-csrf=csrf-proof");
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/tenant/core/v1/auth/refresh") {
        return jsonResponse({ code: "AUTH_REFRESH_UNAVAILABLE" }, 503);
      }
      return jsonResponse(profileResponse());
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TenantAuthProvider><LoginProbe /></TenantAuthProvider>);

    await waitFor(() => expect(
      screen.getByText("AUTHENTICATED:tenant@example.test"),
    ).toBeTruthy());
  });

  it("restores an owner and resolves branch scope without a team membership", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("mutakamel-http-tenant-csrf=csrf-proof");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(profileResponse({
      accessibleBranches: [SCOPE_BRANCH],
      accessibleCompanies: [SCOPE_COMPANY],
      accessibleBranchCompanies: [{ branchId: SCOPE_BRANCH, companyId: SCOPE_COMPANY }],
    }))));

    render(
      <TenantAuthProvider><LoginProbe /><OrganizationScopeProbe /></TenantAuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("AUTHENTICATED:tenant@example.test")).toBeTruthy());
    expect(JSON.parse(screen.getByTestId("organization-scope").textContent ?? "null")).toEqual({
      ready: true,
      gap: null,
      headers: {
        "x-mutakamel-company-id": SCOPE_COMPANY,
        "x-mutakamel-branch-id": SCOPE_BRANCH,
      },
    });
  });

  // D4, corrected deliberately. The `OTHER_SCOPE_COMPANY` row used to expect
  // `{}` — no headers for a branch whose owning company truncation had dropped
  // from `accessibleCompanies`. Core truncates the two collections
  // independently, so that is a normal response about a perfectly valid
  // branch; the ownership map is the authority and the headers come from it.
  it.each([SCOPE_COMPANY, OTHER_SCOPE_COMPANY])(
    "resolves a mapped branch even when its company was truncated away (%s)",
    async (selectedCompany) => {
      const otherBranch = "0192f3a0-0000-7000-8000-000000000003";
      vi.spyOn(document, "cookie", "get").mockReturnValue("mutakamel-http-tenant-csrf=csrf-proof");
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(profileResponse({
        accessibleBranches: [SCOPE_BRANCH, otherBranch],
        accessibleCompanies: [SCOPE_COMPANY],
        accessibleBranchCompanies: [
          { branchId: SCOPE_BRANCH, companyId: selectedCompany },
          { branchId: otherBranch, companyId: OTHER_SCOPE_COMPANY },
        ],
        accessScope: { branchesTruncated: false, companiesTruncated: true },
      }))));

      render(
        <TenantAuthProvider><LoginProbe /><OrganizationScopeProbe /></TenantAuthProvider>,
      );

      await waitFor(() => expect(screen.getByText("AUTHENTICATED:tenant@example.test")).toBeTruthy());
      expect(JSON.parse(screen.getByTestId("organization-scope").textContent ?? "null")).toEqual({
        ready: true,
        gap: null,
        headers: {
          "x-mutakamel-company-id": selectedCompany,
          "x-mutakamel-branch-id": SCOPE_BRANCH,
        },
      });
    },
  );

  it.each([
    { name: "null map", mapping: null },
    { name: "object instead of array", mapping: { branchId: SCOPE_BRANCH, companyId: SCOPE_COMPANY } },
    { name: "null entry", mapping: [null] },
    { name: "invalid branch UUID", mapping: [{ branchId: "branch", companyId: SCOPE_COMPANY }] },
    { name: "invalid company UUID", mapping: [{ branchId: SCOPE_BRANCH, companyId: "company" }] },
    { name: "inaccessible branch", mapping: [{ branchId: "0192f3a0-0000-7000-8000-000000000003", companyId: SCOPE_COMPANY }] },
    { name: "inaccessible company", mapping: [{ branchId: SCOPE_BRANCH, companyId: "0192f3a0-0000-7000-8000-000000000005" }] },
    { name: "conflicting ownership", mapping: [
      { branchId: SCOPE_BRANCH, companyId: SCOPE_COMPANY },
      { branchId: SCOPE_BRANCH, companyId: OTHER_SCOPE_COMPANY },
    ] },
  ])("rejects an auth profile with $name", async ({ mapping }) => {
    // Seeded so this stays a test of the profile validator: a tab that already
    // holds its metadata has nothing to adopt, and asks /me exactly once.
    seedSessionState("session-a");
    const fetchMock = vi.fn(async () => jsonResponse(profileResponse({
      accessibleBranches: [SCOPE_BRANCH],
      accessibleCompanies: [SCOPE_COMPANY, OTHER_SCOPE_COMPANY],
      accessibleBranchCompanies: mapping,
    })));
    vi.stubGlobal("fetch", fetchMock);

    render(<TenantAuthProvider><LoginProbe /></TenantAuthProvider>);

    await waitFor(() => expect(screen.getByText("UNAUTHENTICATED:none")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    "mutakamel-http-tenant-csrf",
    "__Host-mutakamel-tenant-csrf",
  ])("still refreshes expired access for an established %s session", async (cookieName) => {
    seedSessionState("019f0000-0000-7000-8000-000000000002");
    vi.spyOn(document, "cookie", "get").mockReturnValue(`${cookieName}=csrf-proof`);
    let refreshed = false;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/tenant/core/v1/auth/refresh") {
        expect(init?.method).toBe("POST");
        expect(new Headers(init?.headers).get("x-csrf-token")).toBe("csrf-proof");
        refreshed = true;
        return jsonResponse(webAuthResponse());
      }
      if (url === "/api/tenant/core/v1/auth/me") {
        return refreshed
          ? jsonResponse(profileResponse())
          : jsonResponse({ code: "TOKEN_EXPIRED" }, 401);
      }
      throw new Error("Unexpected auth request");
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TenantAuthProvider><LoginProbe /></TenantAuthProvider>);

    await waitFor(() => expect(screen.getByText("AUTHENTICATED:tenant@example.test")).toBeTruthy());
    expect(fetchMock.mock.calls.filter(([url]) =>
      url === "/api/tenant/core/v1/auth/refresh",
    )).toHaveLength(1);
  });

  it("does not authenticate from a CSRF hint when the server rejects the session", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("mutakamel-http-tenant-csrf=stale-proof");
    const requested: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      requested.push(url);
      return jsonResponse({ code: "COMMON.AUTH.MISSING_BEARER_TOKEN" }, 401);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TenantAuthProvider><LoginProbe /></TenantAuthProvider>);

    await waitFor(() => expect(screen.getByText("UNAUTHENTICATED:none")).toBeTruthy());
    // A cookie left behind by a session the server has forgotten buys an
    // adoption attempt and nothing else: neither the refresh nor /me is
    // allowed to turn a readable proof into a signed-in state, and no
    // metadata survives either rejection.
    expect(requested).toEqual([
      "/api/tenant/core/v1/auth/refresh",
      "/api/tenant/core/v1/auth/me",
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tenant/core/v1/auth/me",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(window.sessionStorage.getItem("tenant_session_meta")).toBeNull();
  });

  it("posts login credentials as JSON and bootstraps without Web Locks", async () => {
    Object.defineProperty(window.navigator, "locks", { configurable: true, value: undefined });
    let loginAccepted = false;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).not.toContain("?");
      if (url === "/api/tenant/core/v1/auth/login") {
        expect(init?.method).toBe("POST");
        expect(init?.credentials).toBe("include");
        const headers = new Headers(init?.headers);
        expect(headers.get("Content-Type")).toBe("application/json");
        expect(headers.has("Authorization")).toBe(false);
        expect(JSON.parse(String(init?.body))).toEqual({
          email: "tenant@example.test",
          password: "correct horse battery staple",
        });
        loginAccepted = true;
        vi.spyOn(document, "cookie", "get").mockReturnValue("mutakamel-http-tenant-csrf=csrf-proof");
        return jsonResponse(webAuthResponse());
      }
      if (url === "/api/tenant/core/v1/auth/me") {
        return loginAccepted ? jsonResponse(profileResponse()) : endedSessionResponse();
      }
      throw new Error("Unexpected auth request");
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<TenantAuthProvider><LoginProbe /></TenantAuthProvider>);
    await waitFor(() => expect(screen.getByText("UNAUTHENTICATED:none")).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "login" }));
    await waitFor(() => expect(screen.getByText("AUTHENTICATED:tenant@example.test")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenCalledWith("/");
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
          vi.spyOn(document, "cookie", "get").mockReturnValue("mutakamel-http-tenant-csrf=csrf-proof");
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
        expect(screen.getByText("UNAUTHENTICATED:none")).toBeTruthy(),
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
      )).toHaveLength(1);
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
      <I18nProvider>
        <TenantAuthProvider>
          <TenantAuthGuard>
            <LoginProbe />
          </TenantAuthGuard>
        </TenantAuthProvider>
      </I18nProvider>,
    );
    await waitFor(() => expect(
      screen.getByRole("button", { name: ar.common.retry }),
    ).toBeTruthy());
    replace.mockReset();

    fireEvent.click(screen.getByRole("button", { name: ar.common.retry }));

    await waitFor(() => expect(
      screen.getByText(ar.sessionGuard.verifying),
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
    // The provider records the end and routes nothing. It used to replace to
    // /login from here, which is why a session ending in another tab could
    // never reach the screen that explains it — see the terminal-destination
    // tests below. `TenantAuthGuard` owns that decision now, and it is not
    // rendered here.
    expect(replace).not.toHaveBeenCalled();
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
      <I18nProvider>
        <TenantAuthProvider>
          <TenantAuthGuard>
            <LoginProbe />
          </TenantAuthGuard>
        </TenantAuthProvider>
      </I18nProvider>,
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
      screen.getByText(ar.sessionGuard.verifying),
    ).toBeTruthy());
    expect(replace).not.toHaveBeenCalledWith("/login");

    act(() => {
      publishTenantAuthLifecycle("STALE");
      publishTenantAuthLifecycle("REFRESHING");
      publishTenantAuthLifecycle("AUTHENTICATED");
    });
    expect(screen.getByText(ar.sessionGuard.verifying)).toBeTruthy();
    expect(replace).not.toHaveBeenCalledWith("/login");

    resolveSwitchedProfile(jsonResponse(profileResponse()));
    await waitFor(() => expect(
      screen.getByText("AUTHENTICATED:tenant@example.test"),
    ).toBeTruthy());
  });

  // MASTER-PLAN 13.7 / OPEN-QUESTIONS.md Q18. The provider classified these
  // seven codes and then dropped them, so /session-expired could only ever
  // print a generic headline. This is the end-to-end proof that the code the
  // Gateway sent survives into the URL — the guard's own test stubs the
  // context, so only this one shows `endedReason` is actually populated.
  //
  // No seeded session state on purpose: `tenant_session_meta` lives in
  // sessionStorage, so a user who closes the tab and comes back has a
  // remembered cookie and no metadata. That is the single most common way
  // anyone meets this screen, and with no session id to refresh the transport
  // publishes no tombstone — so the bootstrap failure, and its code, is the
  // outcome the provider records.
  it.each([
    "AUTH_SESSION_IDLE_EXPIRED",
    "AUTH_SESSION_ABSOLUTE_EXPIRED",
    "AUTH_SECURITY_STALE",
  ])("carries the %s that ended the session into /session-expired", async (code) => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("mutakamel-http-tenant-csrf=csrf-proof");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ code }, 401)));

    render(
      <I18nProvider>
        <TenantAuthProvider>
          <TenantAuthGuard>
            <LoginProbe />
          </TenantAuthGuard>
        </TenantAuthProvider>
      </I18nProvider>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith(
      `/session-expired?reason=${code}`,
    ));
  });

  it("claims no expiry for a visitor who simply presented no credentials", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ code: "MISSING_BEARER_TOKEN" }, 401),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <I18nProvider>
        <TenantAuthProvider>
          <TenantAuthGuard>
            <LoginProbe />
          </TenantAuthGuard>
        </TenantAuthProvider>
      </I18nProvider>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalledWith(
      expect.stringContaining("/session-expired"),
    );
  });

  // The second half of Q18, now closed — this test previously pinned the
  // opposite outcome and has been deliberately inverted.
  //
  // With a session id in storage the transport ends the session itself:
  // `endTenantBrowserSession` clears the metadata, publishes the cross-tab
  // tombstone, and signals ENDED on the in-tab lifecycle channel. The
  // tombstone handler then finds no metadata to match and stands down, so the
  // lifecycle signal is the only thing left carrying the outcome — and it used
  // to carry a bare state and redirect to /login, which discarded both the
  // reason and the screen. It carries the code now, and redirects nothing.
  it("carries the reason through the path that ends a session mid-work", async () => {
    seedSessionState("session-a");
    vi.stubGlobal("fetch", vi.fn(async () =>
      jsonResponse({ code: "AUTH_SESSION_IDLE_EXPIRED" }, 401),
    ));

    render(
      <I18nProvider>
        <TenantAuthProvider>
          <TenantAuthGuard>
            <LoginProbe />
          </TenantAuthGuard>
        </TenantAuthProvider>
      </I18nProvider>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith(
      "/session-expired?reason=AUTH_SESSION_IDLE_EXPIRED",
    ));
    expect(replace).not.toHaveBeenCalledWith("/login");
  });

  // A deactivated or suspended account is not an expired session, and the
  // difference is the whole point: signing in again fixes one and cannot
  // touch the other. Core answers with 403 SESSION_IDENTITY_INACTIVE
  // (`auth-refresh.policy.ts`), which is definitive, so it ends the session
  // like the rest — and then has to land somewhere else.
  it("sends a deactivated identity to /account-suspended, not /session-expired", async () => {
    seedSessionState("session-a");
    vi.stubGlobal("fetch", vi.fn(async () =>
      jsonResponse({ code: "SESSION_IDENTITY_INACTIVE" }, 403),
    ));

    render(
      <I18nProvider>
        <TenantAuthProvider>
          <TenantAuthGuard>
            <LoginProbe />
          </TenantAuthGuard>
        </TenantAuthProvider>
      </I18nProvider>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/account-suspended"));
    expect(replace).not.toHaveBeenCalledWith(
      expect.stringContaining("/session-expired"),
    );
  });

  // Pressing "sign out" was answered by "your session expired". `logout()`
  // replaced to /login and settled on ENDED, the guard read ENDED and replaced
  // to /session-expired, and the guard's redirect landed second. Sign-out
  // settles UNAUTHENTICATED now, so both redirects agree.
  it("sends a completed sign-out to the sign-in form and nowhere else", async () => {
    seedSessionState("session-a");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/tenant/core/v1/auth/logout") {
        return new Response(null, { status: 204 });
      }
      return jsonResponse(profileResponse());
    }));

    render(
      <I18nProvider>
        <TenantAuthProvider>
          <TenantAuthGuard>
            <LogoutProbe />
          </TenantAuthGuard>
        </TenantAuthProvider>
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByText("state:AUTHENTICATED")).toBeTruthy());
    replace.mockReset();

    await act(async () => {
      await signOut.run?.();
    });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    // The guard runs on the same commit, with the pre-navigation pathname, so
    // a second destination here is not a race that sometimes loses — it lands
    // last and wins every time.
    expect(replace.mock.calls.every(([href]) => href === "/login")).toBe(true);
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

function profileResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
      ...overrides,
    },
  };
}

function seedSessionState(sessionId: string): void {
  vi.spyOn(document, "cookie", "get").mockReturnValue("mutakamel-http-tenant-csrf=csrf-proof");
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
