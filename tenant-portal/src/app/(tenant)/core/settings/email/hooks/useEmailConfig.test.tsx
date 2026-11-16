// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useEmailConfig } from "./useEmailConfig";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  toast: {},
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => api.router }));
vi.mock("../../../core-api", () => ({ coreGet: api.get, corePatch: api.patch, corePost: api.post }));
vi.mock("@/design-system", () => ({ useCan: () => true, useToast: () => api.toast }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("email configuration admission failures", () => {
  it.each([
    { code: "ACCESS_POLICY_BLOCKED", status: 403, blocked: true, notReady: false },
    { code: "TENANT_EMAIL_CONFIG_NOT_READY", status: 503, blocked: false, notReady: true },
  ])("keeps $code distinct from provisioning and generic load errors", async ({ code, status, blocked, notReady }) => {
    api.get.mockRejectedValue(new TenantApiClientError(code, {
      status, statusText: "Failed", headers: new Headers(), data: { code },
    }));
    const { result } = renderHook(() => useEmailConfig());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAccessBlocked).toBe(blocked);
    expect(result.current.isNotReady).toBe(notReady);
    expect(result.current.loadError).toBeNull();
    expect(result.current.config).toBeNull();
  });
});
