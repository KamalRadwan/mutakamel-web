// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrandingProvider, useTenantBranding } from "./BrandingContext";
import { fetchPublicBranding, PUBLIC_BRANDING_LOGO_PATH, PUBLIC_BRANDING_ICON_PATH, type PublicBranding } from "@/lib/branding/public-branding";
import { applyBrandingTokens } from "@/lib/branding/apply-branding";

vi.mock("@/lib/branding/public-branding", async (original) => ({
  ...await original<typeof import("@/lib/branding/public-branding")>(),
  fetchPublicBranding: vi.fn(),
}));
vi.mock("@/lib/branding/apply-branding", () => ({ applyBrandingTokens: vi.fn() }));

const saved: PublicBranding = {
  appName: "New name", tabTitle: "New title", primaryColor: "#2563eb",
  secondaryColor: null, fontFamily: null, loginHtml: null,
  logoUrl: PUBLIC_BRANDING_LOGO_PATH, iconUrl: PUBLIC_BRANDING_ICON_PATH,
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("shared branding updates", () => {
  it("updates existing consumers and tokens and gives successive assets fresh URLs", async () => {
    vi.mocked(fetchPublicBranding).mockResolvedValue({ ...saved, appName: "Old name" });
    const { result } = renderHook(useTenantBranding, { wrapper: BrandingProvider });
    await waitFor(() => expect(result.current.appName).toBe("Old name"));
    act(() => result.current.updateBranding(saved));
    expect(result.current.appName).toBe("New name");
    const firstUrl = result.current.logoUrl;
    expect(firstUrl).toMatch(new RegExp(`^${PUBLIC_BRANDING_LOGO_PATH}\\?v=`));
    expect(applyBrandingTokens).toHaveBeenLastCalledWith(expect.objectContaining({
      primaryColor: saved.primaryColor,
      iconUrl: expect.stringContaining(`${PUBLIC_BRANDING_ICON_PATH}?v=`),
    }));
    act(() => result.current.updateBranding(saved));
    expect(result.current.logoUrl).not.toBe(firstUrl);
  });

  it("does not let an initial request replace a successful write", async () => {
    let resolveInitial!: (value: PublicBranding) => void;
    vi.mocked(fetchPublicBranding).mockReturnValue(new Promise((resolve) => { resolveInitial = resolve; }));
    const { result } = renderHook(useTenantBranding, { wrapper: BrandingProvider });
    act(() => result.current.updateBranding(saved));
    await act(async () => { resolveInitial({ ...saved, appName: "Stale name" }); });
    expect(result.current.appName).toBe("New name");
    expect(applyBrandingTokens).toHaveBeenCalledTimes(1);
  });
});
