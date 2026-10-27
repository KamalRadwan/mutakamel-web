// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/design-system";
import { setLanguage, useLanguage } from "@/i18n/useLanguage";
import { fetchMyProfile, type TenantProfile } from "@/app/(tenant)/core/contracts/user-subresource-contract";
import { useTenantPreferenceHydration } from "./useTenantPreferenceHydration";

const auth = vi.hoisted(() => ({
  user: { id: "0192f3a0-0000-7000-8000-000000000001" },
  authState: "AUTHENTICATED",
}));
vi.mock("../AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/app/(tenant)/core/contracts/user-subresource-contract", () => ({
  fetchMyProfile: vi.fn(),
}));

const profile: TenantProfile = {
  id: "0192f3a0-0000-7000-8000-000000000002",
  tenantUserId: auth.user.id,
  language: "en",
  themeKey: "dark",
  extensions: {},
};

function mountPreferences() {
  return renderHook(() => {
    useTenantPreferenceHydration();
    return { language: useLanguage(), ...useTheme() };
  }, { wrapper: ThemeProvider });
}

function deferProfile() {
  let resolve!: (value: TenantProfile) => void;
  const pending = new Promise<TenantProfile>((done) => { resolve = done; });
  vi.mocked(fetchMyProfile).mockReturnValue(pending);
  return resolve;
}

beforeEach(() => {
  window.localStorage.clear();
  auth.user = { id: profile.tenantUserId };
  auth.authState = "AUTHENTICATED";
  vi.mocked(fetchMyProfile).mockReset();
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  vi.unstubAllGlobals();
});

describe("authenticated preference hydration", () => {
  it("keeps local first paint then adopts English/dark on an empty device", async () => {
    const resolve = deferProfile();
    const { result } = mountPreferences();
    expect(result.current.language).toBe("ar");
    expect(result.current.theme).toBe("system");
    await act(async () => resolve(profile));
    expect(result.current.language).toBe("en");
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem("tenant_lang")).toBe("en");
    expect(window.localStorage.getItem("tenant_theme")).toBe("dark");
  });

  it.each(["light", "dark", "system"])("preserves an explicit %s theme and Arabic override", async (theme) => {
    window.localStorage.setItem("tenant_theme", theme);
    window.localStorage.setItem("tenant_lang", "ar");
    vi.mocked(fetchMyProfile).mockResolvedValue(profile);
    const { result } = mountPreferences();
    await act(async () => {});
    expect(result.current.theme).toBe(theme);
    expect(result.current.language).toBe("ar");
  });

  it("retains choices made during the read, including explicit system", async () => {
    const resolve = deferProfile();
    const { result, unmount } = mountPreferences();
    act(() => {
      result.current.setTheme("system");
      setLanguage("ar");
    });
    expect(window.localStorage.getItem("tenant_theme")).toBe("system");
    await act(async () => resolve(profile));
    expect(result.current.theme).toBe("system");
    expect(result.current.language).toBe("ar");
    unmount();
    expect(mountPreferences().result.current.theme).toBe("system");
  });

  it("seeds missing keys independently", async () => {
    window.localStorage.setItem("tenant_lang", "ar");
    vi.mocked(fetchMyProfile).mockResolvedValue(profile);
    const { result } = mountPreferences();
    await waitFor(() => expect(result.current.theme).toBe("dark"));
    expect(result.current.language).toBe("ar");
  });

  it.each([
    { ...profile, language: null, themeKey: null },
    { ...profile, language: "fr", themeKey: "custom" },
    { ...profile, tenantUserId: "0192f3a0-0000-7000-8000-000000000003" },
  ])("ignores missing, unsupported or mismatched account preferences", async (response) => {
    vi.mocked(fetchMyProfile).mockResolvedValue(response);
    const { result } = mountPreferences();
    await act(async () => {});
    expect(result.current.language).toBe("ar");
    expect(result.current.theme).toBe("system");
    expect(window.localStorage.getItem("tenant_lang")).toBeNull();
    expect(window.localStorage.getItem("tenant_theme")).toBeNull();
  });

  it("does not read before authentication and ignores a late response after sign-out", async () => {
    auth.authState = "BOOTSTRAPPING";
    const resolve = deferProfile();
    const { rerender, result } = mountPreferences();
    expect(fetchMyProfile).not.toHaveBeenCalled();
    auth.authState = "AUTHENTICATED";
    rerender();
    const signal = vi.mocked(fetchMyProfile).mock.calls[0][0];
    auth.authState = "UNAUTHENTICATED";
    rerender();
    expect(signal?.aborted).toBe(true);
    await act(async () => resolve(profile));
    expect(result.current.language).toBe("ar");
    expect(result.current.theme).toBe("system");
  });

  it("keeps defaults when the profile read fails", async () => {
    vi.mocked(fetchMyProfile).mockRejectedValue(new Error("offline"));
    const { result } = mountPreferences();
    await act(async () => {});
    expect(result.current.language).toBe("ar");
    expect(result.current.theme).toBe("system");
  });
});
