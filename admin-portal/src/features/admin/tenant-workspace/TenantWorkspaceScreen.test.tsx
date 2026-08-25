// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  status: "PROVISIONING" as string,
  accessPanel: vi.fn(),
  billingHook: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));
vi.mock("@/components/layout/Navbar", () => ({ Navbar: () => <div>navbar</div> }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr" }),
}));
vi.mock("./core/hooks/useTenantCoreWorkspace", () => ({
  useTenantCoreWorkspace: (tenantId: string) => ({
    tenant: {
      id: tenantId,
      name: "new-tenant",
      companyName: "New Tenant",
      status: mocks.status,
    },
    resourceState: "ready",
    permissions: {},
    mutation: { name: null, error: null },
    isPolling: mocks.status === "PROVISIONING",
    pollExhausted: false,
    refresh: mocks.refresh,
    replaceTenant: vi.fn(),
  }),
}));
vi.mock("./core/hooks/useTenantFqdnManagement", () => ({
  useTenantFqdnManagement: () => ({}),
}));
vi.mock("./core/components/TenantFqdnPanel", () => ({
  TenantFqdnPanel: () => <div>fqdn-panel</div>,
}));
vi.mock("./core/components/TenantLifecyclePanel", () => ({
  TenantLifecyclePanel: () => <div>lifecycle-panel</div>,
}));
vi.mock("./core/components/TenantProfilePanel", () => ({
  TenantProfilePanel: () => <div>profile-panel</div>,
}));
vi.mock("./provisioning", () => ({
  TenantProvisioningWorkspace: () => <div>provisioning-panel</div>,
}));
vi.mock("./access", () => ({
  TenantAccessPanel: (props: unknown) => {
    mocks.accessPanel(props);
    return <div>access-panel</div>;
  },
}));
vi.mock("./billing/hooks/useTenantBillingWorkspace", () => ({
  useTenantBillingWorkspace: (_tenantId: string, options: unknown) => {
    mocks.billingHook(options);
    return {};
  },
}));
vi.mock("./billing/components/TenantBillingPanel", () => ({
  TenantBillingPanel: () => <div>billing-panel</div>,
}));

import { TenantWorkspaceScreen } from "./TenantWorkspaceScreen";

describe("TenantWorkspaceScreen post-create lifecycle", () => {
  beforeEach(() => {
    mocks.status = "PROVISIONING";
    mocks.accessPanel.mockReset();
    mocks.billingHook.mockReset();
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
    mocks.push.mockReset();
  });

  it("opens provisioning and keeps tenant-database access unmounted until ready", async () => {
    const view = render(
      <TenantWorkspaceScreen tenantId="019f0000-0000-7000-8000-000000000001" />,
    );

    await screen.findByText("provisioning-panel");
    const accessTab = screen.getByRole("button", { name: "Users & access" });
    expect(accessTab).toBeDisabled();
    expect(mocks.accessPanel).not.toHaveBeenCalled();

    mocks.status = "ACTIVE";
    view.rerender(
      <TenantWorkspaceScreen tenantId="019f0000-0000-7000-8000-000000000001" />,
    );
    await waitFor(() => expect(accessTab).not.toBeDisabled());
    fireEvent.click(accessTab);
    await screen.findByText("access-panel");
    expect(mocks.accessPanel).toHaveBeenCalledWith(
      expect.objectContaining({ tenantStatus: "ACTIVE", enabled: true }),
    );
  });

  it("lazy-loads billing only after its tab is selected", async () => {
    mocks.status = "ACTIVE";
    render(
      <TenantWorkspaceScreen tenantId="019f0000-0000-7000-8000-000000000001" />,
    );
    expect(mocks.billingHook).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Billing" }));
    await screen.findByText("billing-panel");
    expect(mocks.billingHook).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it("resets a user-selected tab when the route changes to another provisioning tenant", async () => {
    mocks.status = "ACTIVE";
    const view = render(
      <TenantWorkspaceScreen tenantId="019f0000-0000-7000-8000-000000000001" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Billing" }));
    await screen.findByText("billing-panel");

    mocks.status = "PROVISIONING";
    view.rerender(
      <TenantWorkspaceScreen tenantId="019f0000-0000-7000-8000-000000000002" />,
    );

    await screen.findByText("provisioning-panel");
    expect(screen.queryByText("billing-panel")).not.toBeInTheDocument();
  });
});
