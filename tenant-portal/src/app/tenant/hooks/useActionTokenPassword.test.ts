// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { coordinateTenantSessionRefresh } from "@/lib/api/axiosClient";
import { meetsPasswordPolicy, useActionTokenPassword } from "./useActionTokenPassword";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

// PASSWORD_POLICY in core-app/src/common/security/password-policy.ts: at least
// 12 characters with one lower-case, one upper-case, one digit and one symbol.
// The DTO caps it at 128. Getting any of these wrong sends the user a 422 they
// cannot act on, because the server does not say which rule failed.
describe("meetsPasswordPolicy", () => {
  it("accepts a password that satisfies every rule", () => {
    expect(meetsPasswordPolicy("Str0ng-Passw0rd!")).toBe(true);
  });

  it.each([
    ["Sh0rt-Pw!", "shorter than 12"],
    ["alllowercase1!", "no upper-case letter"],
    ["ALLUPPERCASE1!", "no lower-case letter"],
    ["NoDigitsHere!!", "no digit"],
    ["NoSymbolsHere12", "no symbol"],
  ])("rejects %s — %s", (candidate) => {
    expect(meetsPasswordPolicy(candidate)).toBe(false);
  });

  it("rejects a password past the DTO's 128-character maximum", () => {
    expect(meetsPasswordPolicy(`Aa1!${"x".repeat(125)}`)).toBe(false);
  });
});

const VALID_TOKEN = "invite-token-0123456789abcdef";
const NEW_PASSWORD = "Str0ng-Passw0rd!";
const SESSION_ID = "019f0000-0000-7000-8000-000000000002";

describe("useActionTokenPassword fragment handling", () => {
  beforeEach(() => resetBrowser());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("clears a valid token out of the address bar before using it", async () => {
    window.location.hash = `#token=${VALID_TOKEN}`;
    const view = renderHook(() => useActionTokenPassword("reset-password"), {
      wrapper,
    });

    await waitFor(() => expect(view.result.current.state).toBe("ready"));
    expect(window.location.hash).toBe("");
  });

  // The fragment is cleared before the bounds are checked, not after they pass.
  // A token too short to send is still whatever arrived in a real email, and
  // leaving it in the address bar is what a screenshot or a back-button revisit
  // carries away — the bounds decide whether it is worth sending, not whether
  // it is worth hiding.
  it.each([
    ["too short", "short"],
    ["too long", "x".repeat(513)],
    ["not a token parameter", "code=irrelevant"],
  ])("clears a fragment that is %s and refuses it", async (_name, fragment) => {
    window.location.hash = fragment.includes("=")
      ? `#${fragment}`
      : `#token=${fragment}`;
    const view = renderHook(() => useActionTokenPassword("accept-invite"), {
      wrapper,
    });

    await waitFor(() => expect(view.result.current.state).toBe("missing-token"));
    expect(window.location.hash).toBe("");
  });
});

describe("useActionTokenPassword accepted invite", () => {
  beforeEach(() => resetBrowser());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // `POST /auth/accept-invite` returns the same body sign-in does
  // (`tenant-auth.controller.ts` — `authCookieResponse(tokens)`), and the hook
  // used to throw it away and navigate. The new user then landed in the
  // workspace holding the cookies and no session metadata: the one tab that
  // cannot refresh itself, because a refresh is coordinated against a session
  // id this tab would not have.
  it("commits the issued session so the new user can refresh it", async () => {
    window.location.hash = `#token=${VALID_TOKEN}`;
    const requested: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      requested.push(url);
      return jsonResponse(webAuthResponse());
    }));

    const view = renderHook(() => useActionTokenPassword("accept-invite"), {
      wrapper,
    });
    await waitFor(() => expect(view.result.current.state).toBe("ready"));

    act(() => {
      view.result.current.setNewPassword(NEW_PASSWORD);
      view.result.current.setConfirmPassword(NEW_PASSWORD);
    });
    await act(async () => {
      await view.result.current.submit();
    });

    expect(view.result.current.state).toBe("succeeded");
    expect(replace).toHaveBeenCalledWith("/");
    expect(JSON.parse(
      window.sessionStorage.getItem("tenant_session_meta") ?? "null",
    )).toMatchObject({ sessionId: SESSION_ID, remember: false });

    // The proof that the metadata is usable and not merely present: a
    // coordinated refresh reaches the server instead of failing the session
    // fence with AUTH_SESSION_CHANGED, which is all it could do before.
    await act(async () => {
      await coordinateTenantSessionRefresh();
    });
    expect(requested).toEqual([
      "/api/tenant/core/v1/auth/accept-invite",
      "/api/tenant/core/v1/auth/refresh",
    ]);
  });

  // A reset deliberately issues no session, so there is nothing to commit and
  // the user belongs on the sign-in form.
  it("commits nothing for a completed password reset", async () => {
    window.location.hash = `#token=${VALID_TOKEN}`;
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(webAuthResponse())));

    const view = renderHook(() => useActionTokenPassword("reset-password"), {
      wrapper,
    });
    await waitFor(() => expect(view.result.current.state).toBe("ready"));

    act(() => {
      view.result.current.setNewPassword(NEW_PASSWORD);
      view.result.current.setConfirmPassword(NEW_PASSWORD);
    });
    await act(async () => {
      await view.result.current.submit();
    });

    expect(replace).toHaveBeenCalledWith("/login");
    expect(window.sessionStorage.getItem("tenant_session_meta")).toBeNull();
  });
});

function wrapper({ children }: { children: ReactNode }) {
  return createElement(I18nProvider, null, children);
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function resetBrowser(): void {
  for (const name of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(window, name, {
      configurable: true,
      value: new MemoryStorage(),
    });
  }
  window.history.replaceState(null, "", "/tenant/accept-invite");
  replace.mockReset();
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function webAuthResponse(): Record<string, unknown> {
  return {
    data: {
      tokenType: "Bearer",
      expiresIn: 600,
      sessionExpiresIn: 1_800,
      session: {
        id: SESSION_ID,
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
