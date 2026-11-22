// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DESTROY_OPERATION_ID,
  CUSTOM_FQDN_ID,
  OPERATION_ID,
  customFqdnFixture,
  haltedTenantDestroyFixture,
  tenantDestroyFixture,
  tenantFixture,
} from "../__tests__/fixtures";
import type { UseTenantCoreWorkspaceResult } from "../hooks/useTenantCoreWorkspace";
import type { UseTenantFqdnManagementResult } from "../hooks/useTenantFqdnManagement";
import { createTenantProfileDraft } from "../model/readers";
import type { TenantStatus, TenantView } from "../types";

// The design-system confirmation modal and code references read the app
// language; the panels themselves take it as a prop.
const i18n = vi.hoisted(() => ({
  current: { lang: "en" as "en" | "ar", dir: "ltr" as "ltr" | "rtl" },
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => i18n.current,
  useOptionalI18n: () => i18n.current,
}));

import { TenantFqdnPanel } from "./TenantFqdnPanel";
import { TenantDestroyStatus } from "./TenantDestroyStatus";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { TenantLifecyclePanel } from "./TenantLifecyclePanel";
import { TenantProfilePanel } from "./TenantProfilePanel";
import { tenantWorkspaceCopy } from "./copy";

afterEach(() => {
  i18n.current = { lang: "en", dir: "ltr" };
});

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
    destroyOperation: null,
    destroyError: null,
    destroyPolling: false,
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
    abandonDestruction: vi.fn().mockResolvedValue(undefined),
    resumeDestruction: vi.fn().mockResolvedValue(undefined),
    refreshDestruction: vi.fn().mockResolvedValue(null),
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
  it.each(["en", "ar"] as const)(
    "requires the exact slug for destructive lifecycle actions in %s",
    async (locale) => {
      i18n.current = { lang: locale, dir: locale === "ar" ? "rtl" : "ltr" };
      const text = tenantWorkspaceCopy(locale);
      const cases = [
        { status: "ACTIVE", action: "softDelete", label: text.softDelete, operation: null },
        { status: "DELETED", action: "destroy", label: text.destroy, operation: null },
        { status: "DELETED", action: "resumeDestruction", label: text.resumeDestroy, operation: tenantDestroyFixture("BLOCKED") },
        { status: "DELETED", action: "resumeDestruction", label: text.resumeDestroy, operation: haltedTenantDestroyFixture("FINALIZING") },
      ] as const;

      for (const { status, action, label, operation } of cases) {
        const command = vi.fn().mockResolvedValue({
          ...tenantDestroyFixture("FINALIZING"), resumed: true,
        });
        const view = render(
          <TenantLifecyclePanel
            locale={locale}
            workspace={workspaceFixture(status, {
              destroyOperation: operation,
              [action]: command,
            })}
          />,
        );
        fireEvent.click(screen.getByRole("button", { name: label }));
        const dialog = screen.getByRole("alertdialog");
        const confirm = within(dialog).getByRole("button", {
          name: action === "resumeDestruction" ? text.resumeDestroy : text.confirm,
        });
        const input = within(dialog).getByRole("textbox");
        expect(confirm).toBeDisabled();
        for (const value of ["wrong-slug", "ACME", " acme", "acme "]) {
          fireEvent.change(input, { target: { value } });
          expect(confirm).toBeDisabled();
          fireEvent.click(confirm);
          expect(command).not.toHaveBeenCalled();
        }
        fireEvent.change(input, { target: { value: "acme" } });
        expect(confirm).toBeEnabled();
        // ConfirmActionModal owns its cancel label; the workspace copy's
        // "Keep tenant" label belongs to the generic lifecycle dialog.
        fireEvent.click(within(dialog).getByRole("button", {
          name: locale === "ar" ? "إلغاء" : "Cancel",
        }));
        expect(command).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
        fireEvent.click(screen.getByRole("button", { name: label }));
        const reopened = screen.getByRole("alertdialog");
        await waitFor(() => expect(within(reopened).getByRole("textbox")).toHaveValue(""));
        fireEvent.change(within(reopened).getByRole("textbox"), { target: { value: "acme" } });
        fireEvent.click(within(reopened).getByRole("button", {
          name: action === "resumeDestruction" ? text.resumeDestroy : text.confirm,
        }));
        await waitFor(() => expect(command).toHaveBeenCalledOnce());
        if (action === "destroy") expect(command).toHaveBeenCalledWith(false);
        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
        view.unmount();
      }
    },
  );

  it.each([
    ["en", "Storage draining"],
    ["ar", "خادم التخزين قيد الإفراغ"],
  ] as const)("labels draining storage placement in %s", (locale, label) => {
    const tenant = tenantFixture();
    tenant.storageServer!.status = "DRAINING";
    render(
      <TenantProfilePanel
        locale={locale}
        workspace={workspaceFixture("ACTIVE", { tenant })}
      />,
    );

    expect(screen.getByText(label, { exact: false })).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: locale === "en" ? "Save profile" : "حفظ الملف",
      }),
    ).toBeInTheDocument();
  });

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

  it.each([
    ["ACTIVE", "suspend", "Suspend"],
    ["SUSPENDED", "activate", "Activate"],
    ["PROVISIONING_FAILED", "reprovision", "Retry provisioning"],
    ["PROVISIONING", "cancelProvisioning", "Cancel provisioning"],
    ["DELETED", "restore", "Restore tenant"],
  ] as const)("keeps %s %s on generic confirmation", async (status, action, label) => {
    const command = vi.fn().mockResolvedValue(null);
    render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture(status, { [action]: command })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: label }));
    const dialog = screen.getByRole("alertdialog", { name: label });
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Confirm" });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(command).toHaveBeenCalledOnce());
  });

  it("requests destruction with retained financial history", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", { destroy })}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Destroy permanently" }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Destroy permanently",
    });
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent(tenantWorkspaceCopy("en").destroyHint);
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "acme" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));

    await vi.waitFor(() => expect(destroy).toHaveBeenCalledWith(false));
  });

  it("shows pending progress and disables restore and duplicate destroy", () => {
    render(<TenantLifecyclePanel locale="en" workspace={workspaceFixture("DELETED", {
      destroyOperation: tenantDestroyFixture("STOPPING_PROVISIONING"),
      destroyPolling: true,
    })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Stopping provisioning");
    expect(screen.getByText("Status refreshes automatically.")).toBeInTheDocument();
    for (const name of ["Restore tenant", "Destroy permanently"]) {
      const action = screen.getByRole("button", { name });
      expect(action).toBeDisabled();
      // The disabled action points at the note that says why.
      expect(action).toHaveAccessibleDescription(/Restore and a new destruction request stay unavailable/);
    }
    // Stopping provisioning is still before the drop, so it can be abandoned.
    expect(screen.getByRole("button", { name: "Abandon destruction" })).toBeEnabled();
  });

  it("explains a blocked destruction with its reason, waited-on operation and attempts", () => {
    render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", {
          destroyOperation: tenantDestroyFixture("BLOCKED", { attempts: 20 }),
        })}
      />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Destruction is blocked");
    expect(status).toHaveTextContent("automatic attempts have ended");
    expect(screen.getByText("An open provisioning operation has not stopped.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy reference TENANT_DESTROY_OPEN_PROVISIONING_OPERATION" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Copy reference ${OPERATION_ID}` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Copy reference ${DESTROY_OPERATION_ID}` })).toBeInTheDocument();
    expect(screen.getByText("Attempts in this phase").nextElementSibling).toHaveTextContent("20");
    // Automation has ended, so there is no next attempt and nothing polls.
    expect(screen.queryByText("Next attempt")).not.toBeInTheDocument();
    expect(screen.queryByText("Status refreshes automatically.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore tenant" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Destroy permanently" })).toBeDisabled();
    // Blocked before the drop: abandon it, or resume it once provisioning has
    // stopped.
    expect(status).toHaveTextContent("resume destruction; or abandon the request");
    expect(screen.getByRole("button", { name: "Abandon destruction" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Resume destruction" })).toBeEnabled();
  });

  it("warns that resuming a stop blocks again at once while provisioning still runs, and shows what Core answered", async () => {
    const resumeDestruction = vi
      .fn()
      .mockResolvedValue({ ...tenantDestroyFixture("STOPPING_PROVISIONING"), resumed: true });
    render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", {
          destroyOperation: tenantDestroyFixture("BLOCKED"),
          resumeDestruction,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Resume destruction" }));
    const dialog = screen.getByRole("alertdialog", { name: "Resume the destruction of acme?" });
    expect(dialog).toHaveTextContent("goes back to stopping provisioning");
    expect(dialog).toHaveTextContent("the one-hour limit for stopping still counts from the original request");
    expect(dialog).toHaveTextContent("You can abandon the request instead");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "acme" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Resume destruction" }));

    await vi.waitFor(() => expect(resumeDestruction).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "the worker is checking again whether provisioning has stopped",
      ),
    );
  });

  it("says so when the request was no longer blocked and nothing was resumed", async () => {
    const resumeDestruction = vi
      .fn()
      .mockResolvedValue({ ...tenantDestroyFixture("DROPPING_DATABASE"), resumed: false });
    render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", {
          destroyOperation: haltedTenantDestroyFixture("DROPPING_DATABASE"),
          resumeDestruction,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Resume destruction" }));
    fireEvent.change(within(screen.getByRole("alertdialog")).getByRole("textbox"), { target: { value: "acme" } });
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Resume destruction" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("The request was no longer blocked"),
    );
  });

  it("explains a request halted after the drop was authorized and offers resume, not abandon", () => {
    render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", {
          destroyOperation: haltedTenantDestroyFixture("DROPPING_DATABASE"),
        })}
      />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Destruction halted while deleting the database");
    expect(status).toHaveTextContent("the database may already be gone");
    expect(status).not.toHaveTextContent("Destruction is blocked");
    // Worker's Database Server failures share one label; the code keeps the class.
    expect(screen.getByText("The worker could not use the tenant's Database Server.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy reference WORKER.TENANT_DESTROY.DATABASE.CONNECTION_REFUSED" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Provisioning operation")).not.toBeInTheDocument();
    expect(screen.getByText("Attempts in this phase").nextElementSibling).toHaveTextContent("20");
    expect(screen.queryByText("Next attempt")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abandon destruction" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume destruction" })).toBeEnabled();
    for (const name of ["Restore tenant", "Destroy permanently"]) {
      const action = screen.getByRole("button", { name });
      expect(action).toBeDisabled();
      expect(action).toHaveAccessibleDescription(/cannot be abandoned and the tenant cannot be restored/);
    }
  });

  it("resumes a halted destruction only after the consequences are confirmed", async () => {
    const resumeDestruction = vi
      .fn()
      .mockResolvedValue({ ...tenantDestroyFixture("FINALIZING"), resumed: true });
    render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", {
          destroyOperation: haltedTenantDestroyFixture("FINALIZING"),
          resumeDestruction,
        })}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Destruction halted while finalizing");
    fireEvent.click(screen.getByRole("button", { name: "Resume destruction" }));
    expect(resumeDestruction).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog", { name: "Resume the destruction of acme?" });
    expect(dialog).toHaveTextContent("continues in the phase where it halted");
    expect(dialog).toHaveTextContent("Fix the reason it halted first");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "acme" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Resume destruction" }));

    await vi.waitFor(() => expect(resumeDestruction).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent(
      "Destruction was resumed and continues finalizing",
    );
  });

  it("closes the resume dialog when Core refuses, leaving the refusal to the workspace alert", async () => {
    const resumeDestruction = vi.fn().mockRejectedValue({
      isNormalized: true,
      httpStatus: 503,
      errorCode: "CORE_UNAVAILABLE",
      message: "Core is unavailable",
    });
    render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", {
          destroyOperation: haltedTenantDestroyFixture("DROPPING_DATABASE"),
          resumeDestruction,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Resume destruction" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "acme" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Resume destruction" }));

    await vi.waitFor(() => expect(resumeDestruction).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("shows a code without a localized label verbatim", () => {
    render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", {
          destroyOperation: tenantDestroyFixture("BLOCKED", {
            blockedReason: "WORKER.TENANT_DESTROY.SOMETHING_NEW",
            blockingOperationId: null,
          }),
        })}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Copy reference WORKER.TENANT_DESTROY.SOMETHING_NEW" }),
    ).toHaveTextContent("WORKER.TENANT_DESTROY.SOMETHING_NEW");
    expect(screen.queryByText("Provisioning operation")).not.toBeInTheDocument();
  });

  it("abandons a blocked destruction only after the consequences are confirmed", async () => {
    const abandonDestruction = vi.fn().mockResolvedValue(tenantDestroyFixture("ABANDONED"));
    render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", {
          destroyOperation: tenantDestroyFixture("BLOCKED"),
          abandonDestruction,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Abandon destruction" }));
    expect(abandonDestruction).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog", { name: "Abandon the destruction of acme?" });
    expect(dialog).toHaveTextContent("The database is kept and the tenant stays soft-deleted");
    expect(dialog).toHaveTextContent("restored or destroyed again");
    fireEvent.click(within(dialog).getByRole("button", { name: "Abandon destruction" }));

    await vi.waitFor(() => expect(abandonDestruction).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("closes the abandon dialog when Core refuses, leaving the refusal to the workspace alert", async () => {
    const abandonDestruction = vi.fn().mockRejectedValue({
      isNormalized: true,
      httpStatus: 409,
      errorCode: "TENANT_DESTROY_NOT_ABANDONABLE",
      message: "Not abandonable",
    });
    render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", {
          destroyOperation: tenantDestroyFixture("STOPPING_PROVISIONING"),
          abandonDestruction,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Abandon destruction" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Abandon destruction" }));

    await vi.waitFor(() => expect(abandonDestruction).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("explains a refused abandon beside the refreshed progress", () => {
    render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", {
          destroyOperation: tenantDestroyFixture("DROPPING_DATABASE"),
          mutation: {
            name: null,
            error: {
              isNormalized: true,
              httpStatus: 409,
              errorCode: "TENANT_DESTROY_NOT_ABANDONABLE",
              message: "Not abandonable",
            },
          },
        })}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Deleting the database");
    expect(screen.getByText(/can no longer be abandoned/)).toBeInTheDocument();
    // The drop is authorized: nothing to abandon, nothing to restore.
    expect(screen.queryByRole("button", { name: "Abandon destruction" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore tenant" })).toBeDisabled();
  });

  it("offers restore and a new destruction after the request was abandoned", () => {
    render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", {
          destroyOperation: tenantDestroyFixture("ABANDONED", {
            blockedAt: "2026-08-11T19:34:00.000Z",
            blockedReason: "TENANT_DESTROY_MULTIPLE_OPEN_OPERATIONS",
            blockedPhase: "STOPPING_PROVISIONING",
          }),
        })}
      />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Destruction was abandoned");
    expect(status).toHaveTextContent("The database was kept");
    expect(screen.getByText("Abandoned")).toBeInTheDocument();
    expect(screen.getByText("Blocked by")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore tenant" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Destroy permanently" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Abandon destruction" })).not.toBeInTheDocument();
  });

  it("withholds abandon and resume from an admin without the destroy grant", () => {
    const base = workspaceFixture("DELETED");
    const view = render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", {
          destroyOperation: tenantDestroyFixture("BLOCKED"),
          permissions: { ...base.permissions, canDestroy: false },
        })}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Destruction is blocked");
    expect(screen.queryByRole("button", { name: "Abandon destruction" })).not.toBeInTheDocument();

    view.rerender(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", {
          destroyOperation: haltedTenantDestroyFixture("DROPPING_DATABASE"),
          permissions: { ...base.permissions, canDestroy: false },
        })}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Destruction halted while deleting the database");
    expect(screen.queryByRole("button", { name: "Resume destruction" })).not.toBeInTheDocument();
  });

  it("reports an unreadable destruction status with a retry", () => {
    const refreshDestruction = vi.fn().mockResolvedValue(null);
    render(
      <TenantLifecyclePanel
        locale="en"
        workspace={workspaceFixture("DELETED", {
          destroyOperation: null,
          destroyError: {
            isNormalized: true,
            httpStatus: 503,
            errorCode: "CORE_UNAVAILABLE",
            message: "Core is unavailable",
            correlationId: "corr-1",
          },
          refreshDestruction,
        })}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Destruction status could not be loaded.");
    expect(within(alert).getByRole("button", { name: "Copy reference CORE_UNAVAILABLE" })).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Copy reference corr-1" })).toBeInTheDocument();
    fireEvent.click(within(alert).getByRole("button", { name: "Refresh status" }));
    expect(refreshDestruction).toHaveBeenCalledOnce();
  });

  it("renders blocked destruction in Arabic", () => {
    i18n.current = { lang: "ar", dir: "rtl" };
    render(
      <TenantLifecyclePanel
        locale="ar"
        workspace={workspaceFixture("DELETED", {
          destroyOperation: tenantDestroyFixture("BLOCKED"),
        })}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("الحذف النهائي متوقف");
    expect(screen.getByText("توجد عملية تجهيز مفتوحة لم تتوقف بعد.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "التخلي عن الحذف النهائي" }));
    const dialog = screen.getByRole("alertdialog", { name: "التخلي عن الحذف النهائي للمستأجر acme؟" });
    expect(dialog).toHaveTextContent("تُحفظ قاعدة البيانات");
  });

  it("renders a halted destruction and its resume confirmation in Arabic", () => {
    i18n.current = { lang: "ar", dir: "rtl" };
    render(
      <TenantLifecyclePanel
        locale="ar"
        workspace={workspaceFixture("DELETED", {
          destroyOperation: haltedTenantDestroyFixture("FINALIZING", {
            blockedReason: "WORKER.TENANT_CLAIM.HELD",
          }),
        })}
      />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("توقف الحذف النهائي أثناء الإتمام");
    expect(status).toHaveTextContent("لا يمكن التخلي عن هذا الطلب ولا استعادة المستأجر");
    expect(screen.getByText("عملية أخرى على قاعدة البيانات تحتجز قاعدة بيانات المستأجر.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "التخلي عن الحذف النهائي" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "استئناف الحذف النهائي" }));
    const dialog = screen.getByRole("alertdialog", { name: "استئناف الحذف النهائي للمستأجر acme؟" });
    expect(dialog).toHaveTextContent("عالج سبب التوقف أولًا");
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
  it.each(["en", "ar"] as const)("localizes field and command errors with diagnostics in %s", (locale) => {
    i18n.current = { lang: locale, dir: locale === "ar" ? "rtl" : "ltr" };
    const tenant = tenantFixture();
    const copy = (locale === "ar" ? ar : en).apiErrorMessages;
    render(<TenantFqdnPanel locale={locale} tenant={tenant}
      permissions={{ canRead: true, canValidateFqdn: true, canManageFqdns: true }}
      fqdn={fqdnFixture(tenant, {
        preflightError: { isNormalized: true, httpStatus: 400, errorCode: "TENANT_FQDN_REQUIRED", message: "Raw preflight error", correlationId: "preflight-correlation" },
        mutation: { name: null, error: { isNormalized: true, httpStatus: 409, errorCode: "TENANT_FQDN_STATE_INVALID", message: "Raw command error", correlationId: "fqdn-correlation" } },
      })} />);
    expect(screen.getByText(copy.fqdnRequired)).toBeInTheDocument();
    expect(screen.getByText(/TENANT_FQDN_REQUIRED/)).toHaveTextContent("preflight-correlation");
    const commandAlert = screen.getByText(copy.fqdnStateInvalid).closest('[role="alert"]');
    expect(commandAlert).toHaveTextContent("TENANT_FQDN_STATE_INVALID");
    expect(commandAlert).toHaveTextContent("fqdn-correlation");
    expect(screen.queryByText(/Raw (preflight|command) error/)).not.toBeInTheDocument();
  });

  it.each(["en", "ar"] as const)("localizes initial and refresh destroy failures in %s", (locale) => {
    i18n.current = { lang: locale, dir: locale === "ar" ? "rtl" : "ltr" };
    const copy = (locale === "ar" ? ar : en).apiErrorMessages;
    const props = { id: "destroy-errors", locale, polling: false, notAbandonable: false, onRefresh: vi.fn(),
      loadError: { isNormalized: true as const, httpStatus: 409, errorCode: "HTTP_409", message: "Raw destroy error", correlationId: "destroy-correlation" } };
    const view = render(<TenantDestroyStatus {...props} operation={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent(copy.conflict);
    expect(screen.getByText("HTTP_409")).toBeInTheDocument();
    expect(screen.getByText("destroy-correlation")).toBeInTheDocument();
    view.rerender(<TenantDestroyStatus {...props} operation={tenantDestroyFixture("BLOCKED")} />);
    expect(screen.getByText(copy.conflict)).toBeInTheDocument();
    expect(screen.getByText("HTTP_409")).toBeInTheDocument();
    expect(screen.getByText("destroy-correlation")).toBeInTheDocument();
    expect(screen.queryByText("Raw destroy error")).not.toBeInTheDocument();
  });

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
    const tenant = tenantFixture("ACTIVE", {
      fqdns: [{ ...tenantFixture().fqdns[0]!, isPlatformIssued: false }, customFqdnFixture()],
    });
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
