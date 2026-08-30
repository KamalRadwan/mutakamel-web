// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CUSTOM_FQDN_ID,
  customFqdnFixture,
  tenantFixture,
} from "../__tests__/fixtures";
import type { UseTenantCoreWorkspaceResult } from "../hooks/useTenantCoreWorkspace";
import type { UseTenantFqdnManagementResult } from "../hooks/useTenantFqdnManagement";
import { createTenantProfileDraft } from "../model/readers";
import type { TenantStatus, TenantView } from "../types";

import { TenantFqdnPanel } from "./TenantFqdnPanel";
import { TenantLifecyclePanel } from "./TenantLifecyclePanel";
import { TenantProfilePanel } from "./TenantProfilePanel";

function workspaceFixture(
  status: TenantStatus = "ACTIVE",
  overrides: Partial<UseTenantCoreWorkspaceResult> = {},
): UseTenantCoreWorkspaceResult {
  const tenant = tenantFixture(status);
  return {
    tenant,
    loadedTenantId: tenant.id,
    resourceState: "ready",
    loadError: null,
    permissions: {
      canRead: true,
      canUpdate: true,
      canSuspendOrActivate: true,
      canReprovisionOrCancel: true,
      canSoftDelete: true,
      canRestore: true,
      canDestroy: true,
      canValidateFqdn: true,
      canManageFqdns: true,
    },
    profileDraft: createTenantProfileDraft(tenant),
    profileDirty: false,
    profileStale: false,
    mutation: { name: null, error: null },
    lastProvisioningCommand: null,
    pollAttempts: 0,
    pollExhausted: false,
    isPolling: false,
    isAuthLoading: false,
    refresh: vi.fn().mockResolvedValue(tenant),
    replaceTenant: vi.fn(),
    updateProfileDraft: vi.fn(),
    updateAddressField: vi.fn(),
    clearAddress: vi.fn(),
    saveProfile: vi.fn().mockResolvedValue(tenant),
    reloadStaleProfile: vi.fn().mockResolvedValue(tenant),
    suspend: vi.fn().mockResolvedValue(tenant),
    activate: vi.fn().mockResolvedValue(tenant),
    reprovision: vi.fn().mockResolvedValue(null),
    cancelProvisioning: vi.fn().mockResolvedValue(null),
    softDelete: vi.fn().mockResolvedValue(tenant),
    restore: vi.fn().mockResolvedValue(tenant),
    destroy: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as UseTenantCoreWorkspaceResult;
}

function fqdnFixture(
  tenant: TenantView = tenantFixture(),
  overrides: Partial<UseTenantFqdnManagementResult> = {},
): UseTenantFqdnManagementResult {
  return {
    fqdns: tenant.fqdns,
    isLoadingFqdns: false,
    listError: null,
    reloadFqdns: vi.fn().mockResolvedValue(tenant.fqdns),
    candidate: "",
    setCandidate: vi.fn(),
    evidence: null,
    isPreflighting: false,
    preflightError: null,
    mutation: { name: null, error: null },
    canAdd: false,
    preflight: vi.fn().mockResolvedValue(null),
    add: vi.fn().mockResolvedValue(null),
    remove: vi.fn().mockResolvedValue(null),
    promote: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as UseTenantFqdnManagementResult;
}

describe("tenant profile and lifecycle panels", () => {
  it("handles a null address and updates all profile fields through one draft", () => {
    const tenant = tenantFixture("ACTIVE", { address: null, phone: null });
    const updateProfileDraft = vi.fn();
    const updateAddressField = vi.fn();
    const workspace = workspaceFixture("ACTIVE", {
      tenant,
      profileDraft: createTenantProfileDraft(tenant),
      profileDirty: true,
      updateProfileDraft,
      updateAddressField,
    });
    render(<TenantProfilePanel locale="en" workspace={workspace} />);

    fireEvent.change(screen.getByLabelText("Phone"), {
      target: { value: "01234567890" },
    });
    fireEvent.change(screen.getByLabelText("City"), {
      target: { value: "Giza" },
    });
    expect(updateProfileDraft).toHaveBeenCalledWith({
      phone: "01234567890",
    });
    expect(updateAddressField).toHaveBeenCalledWith("city", "Giza");
    expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled();
  });

  it("focuses a persistent validation summary and keeps required profile errors associated", async () => {
    const tenant = tenantFixture("ACTIVE");
    const saveProfile = vi.fn();
    const workspace = workspaceFixture("ACTIVE", {
      tenant,
      profileDraft: {
        ...createTenantProfileDraft(tenant),
        companyName: "",
        countryName: "",
        countryIsoCode: "",
      },
      profileDirty: true,
      saveProfile,
    });
    render(<TenantProfilePanel locale="en" workspace={workspace} />);

    const form = screen.getByRole("button", { name: "Save profile" }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    const summary = screen.getByText("Review the required profile fields.").closest("[role='alert']");
    await waitFor(() => expect(summary).toHaveFocus());
    expect(screen.getByLabelText("Company name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Company name")).toHaveAttribute("name", "companyName");
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it.each([
    ["ACTIVE", "Suspend"],
    ["SUSPENDED", "Activate"],
    ["PROVISIONING_FAILED", "Retry provisioning"],
    ["PROVISIONING", "Cancel provisioning"],
    ["DELETED", "Destroy permanently"],
  ] as const)("shows only the valid %s lifecycle action", (status, action) => {
    render(
      <TenantLifecyclePanel locale="en" workspace={workspaceFixture(status)} />,
    );
    expect(screen.getByRole("button", { name: action })).toBeInTheDocument();
  });

  it("passes explicit subscription purge choice to permanent destroy", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    const onDestroyed = vi.fn();
    render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", { destroy })}
        onDestroyed={onDestroyed}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Destroy permanently" }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Destroy permanently",
    });
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));

    await vi.waitFor(() => expect(destroy).toHaveBeenCalledWith(true));
    expect(onDestroyed).toHaveBeenCalledOnce();
  });

  it("offers restore beside destroy on a deleted tenant", async () => {
    const restore = vi.fn().mockResolvedValue(tenantFixture("SUSPENDED"));
    render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", { restore })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Restore tenant" }));
    const dialog = screen.getByRole("alertdialog", {
      name: "Restore tenant",
    });
    // The dialog states the landing state so restore is not mistaken for
    // putting the tenant straight back into service.
    expect(dialog).toHaveTextContent("SUSPENDED");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));

    await vi.waitFor(() => expect(restore).toHaveBeenCalledOnce());
  });

  it("hides restore from an admin without the restore grant", () => {
    render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", {
          permissions: {
            ...workspaceFixture("DELETED").permissions,
            canRestore: false,
          },
        })}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Restore tenant" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Destroy permanently" }),
    ).toBeInTheDocument();
  });
});

describe("TenantFqdnPanel", () => {
  it("explains released domains and withholds the attach form on a deleted tenant", () => {
    const tenant = tenantFixture("DELETED", { fqdns: [] });
    render(
      <TenantFqdnPanel
        locale="en"
        tenant={tenant}
        permissions={{
          canRead: true,
          canValidateFqdn: true,
          canManageFqdns: true,
        }}
        fqdn={fqdnFixture(tenant)}
      />,
    );
    expect(screen.getByText(/Domains were released/i)).toBeInTheDocument();
    // Every domain mutation requires an ACTIVE tenant, so the controls that
    // would only produce a 409 are not rendered at all.
    expect(
      screen.queryByRole("button", { name: "Attach domain" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Validate" }),
    ).not.toBeInTheDocument();
  });

  it("never offers primary promotion to a tenant with its platform domain", () => {
    const tenant = tenantFixture("ACTIVE", {
      fqdns: [tenantFixture().fqdns[0]!, customFqdnFixture()],
    });
    render(
      <TenantFqdnPanel
        locale="en"
        tenant={tenant}
        permissions={{
          canRead: true,
          canValidateFqdn: true,
          canManageFqdns: true,
        }}
        fqdn={fqdnFixture(tenant)}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Set primary" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("offers verified legacy-only promotion and confirms removal by identity", async () => {
    const tenant = tenantFixture("ACTIVE", { fqdns: [customFqdnFixture()] });
    const promote = vi.fn().mockResolvedValue(null);
    const remove = vi.fn().mockResolvedValue(null);
    render(
      <TenantFqdnPanel
        locale="en"
        tenant={tenant}
        permissions={{
          canRead: true,
          canValidateFqdn: true,
          canManageFqdns: true,
        }}
        fqdn={fqdnFixture(tenant, { promote, remove })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Set primary" }));
    expect(promote).toHaveBeenCalledWith(CUSTOM_FQDN_ID);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    const dialog = screen.getByRole("alertdialog", { name: "Remove" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await vi.waitFor(() => expect(remove).toHaveBeenCalledWith(CUSTOM_FQDN_ID));
  });

  it("explains available pending DNS evidence", () => {
    const tenant = tenantFixture();
    render(
      <TenantFqdnPanel
        locale="en"
        tenant={tenant}
        permissions={{
          canRead: true,
          canValidateFqdn: true,
          canManageFqdns: true,
        }}
        fqdn={fqdnFixture(tenant, {
          candidate: "portal.example.com",
          canAdd: true,
          evidence: {
            fqdn: "portal.example.com",
            valid: false,
            available: true,
            reason: "DNS_NOT_FOUND",
            message: "DNS pending",
          },
        })}
      />,
    );
    expect(screen.getByText("DNS pending")).toBeInTheDocument();
    expect(screen.getByText(/attached as pending/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Attach domain" })).toBeEnabled();
  });
});
