// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { getActiveDictionary } from "@/i18n/dictionary-store";
import { axiosClient, subscribePermissionDenials } from "./axiosClient";

vi.mock("@/i18n/dictionary-store", async (original) => ({
  ...await original<typeof import("@/i18n/dictionary-store")>(),
  getActiveDictionary: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    errorCode: "MISSING_REQUIRED_PERMISSIONS", correlationId: "reference",
  }), { status: 403 })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("reads denial copy from the provider's active dictionary getter", async () => {
  vi.mocked(getActiveDictionary).mockResolvedValue(en);
  const toast = vi.fn();
  window.addEventListener("global-toast", toast);
  try {
    await expect(axiosClient.get("/api/tenant/core/v1/roles"))
      .rejects.toMatchObject({ response: { status: 403 } });
    expect(getActiveDictionary).toHaveBeenCalledOnce();
    expect((toast.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
      title: en.errors.accessDenied,
      message: en.coreIdentity.errors.MISSING_REQUIRED_PERMISSIONS,
    });
  } finally {
    window.removeEventListener("global-toast", toast);
  }
});

it("preserves the original 403 and denial event if a fallback chunk cannot load", async () => {
  vi.mocked(getActiveDictionary).mockRejectedValue(new Error("chunk unavailable"));
  const denial = vi.fn();
  const unsubscribe = subscribePermissionDenials(denial);
  try {
    await expect(axiosClient.get("/api/tenant/core/v1/roles"))
      .rejects.toMatchObject({ response: { status: 403, data: {
        errorCode: "MISSING_REQUIRED_PERMISSIONS", correlationId: "reference",
      } } });
    expect(denial).toHaveBeenCalledOnce();
  } finally {
    unsubscribe();
  }
});
