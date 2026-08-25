// @vitest-environment jsdom

import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TENANT_ID, tenantPayload } from "./core/__tests__/fixtures";

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/layout/Navbar", () => ({ Navbar: () => <div>navbar</div> }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr" }),
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "019f0000-0000-7000-8000-000000000099",
      isSuperAdmin: true,
      permissions: [],
    },
    isLoading: false,
  }),
}));
vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: http,
}));
vi.mock("./provisioning", () => ({
  TenantProvisioningWorkspace: () => <div>provisioning-network-panel</div>,
}));

import { TenantWorkspaceScreen } from "./TenantWorkspaceScreen";

describe("TenantWorkspaceScreen provisioning network boundary", () => {
  beforeEach(() => {
    Object.values(http).forEach((mock) => mock.mockReset());
    http.get.mockImplementation(async (url: string) => {
      if (url === `/api/admin/core/v1/tenants/${TENANT_ID}`) {
        return {
          data: {
            success: true,
            data: tenantPayload("PROVISIONING"),
            correlationId: "019ff251-1846-7cf2-b0f3-2737000254a3",
            timestamp: "2026-08-11T19:33:48.986Z",
          },
        };
      }
      if (url === `/api/admin/core/v1/tenants/${TENANT_ID}/fqdns`) {
        return {
          data: {
            success: true,
            data: tenantPayload("PROVISIONING").fqdns,
            correlationId: "019ff251-1846-7cf2-b0f3-2737000254a4",
            timestamp: "2026-08-11T19:33:48.986Z",
          },
        };
      }
      throw new Error(`UNEXPECTED_GET:${url}`);
    });
  });

  it("issues tenant detail and the exact FQDN read but no inactive workspace reads", async () => {
    render(
      <StrictMode>
        <TenantWorkspaceScreen tenantId={TENANT_ID} />
      </StrictMode>,
    );

    await screen.findByText("provisioning-network-panel");
    await waitFor(() => expect(http.get).toHaveBeenCalledTimes(2));

    const urls = http.get.mock.calls.map((call) => String(call[0]));
    expect(urls).toEqual([
      `/api/admin/core/v1/tenants/${TENANT_ID}`,
      `/api/admin/core/v1/tenants/${TENANT_ID}/fqdns`,
    ]);
    expect(urls.join(" ")).not.toMatch(/\/users(?:\/summary)?(?:\?|$)/);
    expect(urls.join(" ")).not.toMatch(/\/subscription|\/wallet|\/payments/);
    expect(http.post).not.toHaveBeenCalled();
  });
});
