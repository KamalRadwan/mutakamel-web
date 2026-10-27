// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBranding } from "./useBranding";
import { EMPTY_BRANDING, fetchBrandingSettings, updateBrandingSettings, uploadBrandingAsset } from "../branding-contract";
import { PUBLIC_BRANDING_LOGO_PATH } from "@/lib/branding/public-branding";

const mocks = vi.hoisted(() => ({
  updateBranding: vi.fn(),
  toast: { success: vi.fn(), outcomeFromApi: vi.fn(), errorFromApi: vi.fn() },
  t: { coreBilling: {} },
}));
vi.mock("@/context/BrandingContext", () => ({
  useTenantBranding: () => ({ updateBranding: mocks.updateBranding }),
}));
vi.mock("@/design-system", () => ({ useCan: () => true, useToast: () => mocks.toast }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: mocks.t }) }));
vi.mock("../branding-contract", async (original) => ({
  ...await original<typeof import("../branding-contract")>(),
  fetchBrandingSettings: vi.fn(),
  updateBrandingSettings: vi.fn(),
  uploadBrandingAsset: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(fetchBrandingSettings).mockResolvedValue(EMPTY_BRANDING);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("branding write publication", () => {
  it("publishes the validated saved name and color", async () => {
    const saved = { ...EMPTY_BRANDING, appName: "Saved tenant", primaryColor: "#2563eb" };
    vi.mocked(updateBrandingSettings).mockResolvedValue(saved);
    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setValue({ appName: "Saved tenant", primaryColor: "#2563eb" }));
    await act(async () => { await result.current.save(); });
    expect(mocks.updateBranding).toHaveBeenCalledWith({
      appName: saved.appName, primaryColor: saved.primaryColor,
      tabTitle: null, secondaryColor: null, fontFamily: null, logoUrl: null, iconUrl: null,
    });
  });

  it("publishes a successful logo upload, including an idempotent replay", async () => {
    vi.mocked(uploadBrandingAsset).mockResolvedValue({
      branding: { ...EMPTY_BRANDING, hasLogo: true }, replayed: true,
    });
    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.upload("logo", new File(["image"], "logo.png", { type: "image/png" }));
    });
    expect(mocks.updateBranding).toHaveBeenCalledWith(expect.objectContaining({ logoUrl: PUBLIC_BRANDING_LOGO_PATH }));
    expect(result.current.assetVersion).toBe(1);
  });

  it("does not publish a rejected save", async () => {
    vi.mocked(updateBrandingSettings).mockRejectedValue(new Error("Save failed"));
    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.save(); });
    expect(mocks.updateBranding).not.toHaveBeenCalled();
  });
});
