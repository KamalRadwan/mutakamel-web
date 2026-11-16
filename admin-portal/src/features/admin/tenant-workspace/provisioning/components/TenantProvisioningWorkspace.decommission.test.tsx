// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { useTenantProvisioning } from "../hooks/useTenantProvisioning";
import { buildDecommissionOperationDto } from "../model/commands";
import { readTenantComponentInstallation } from "../model/readers";
import { componentInstallation, META, TENANT_ID } from "../test/fixtures";
import { TenantProvisioningWorkspace } from "./TenantProvisioningWorkspace";

const mocks = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  decommission: vi.fn(),
  paused: vi.fn(),
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: mocks.lang,
    dir: mocks.lang === "ar" ? "rtl" : "ltr",
    t: mocks.lang === "ar" ? ar : en,
  }),
}));
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(),
  useToast: () => ({ success: vi.fn() }),
}));
vi.mock("../hooks/useTenantProvisioning", () => ({
  useTenantProvisioning: (_tenantId: string, options: { paused: boolean }) => {
    mocks.paused(options.paused);
    return provisioning;
  },
}));

const TENANT_NAME = "acme";
const component = readTenantComponentInstallation(componentInstallation());
const targetName = `${TENANT_NAME} · ${component.componentKey}`;
let provisioning: ReturnType<typeof useTenantProvisioning>;

function workspace() {
  return <TenantProvisioningWorkspace tenantId={TENANT_ID} tenantName={TENANT_NAME} />;
}

function openManaged() {
  fireEvent.keyDown(screen.getByRole("tab", {
    name: mocks.lang === "ar" ? "إجراءات مُدارة" : "Managed actions",
  }), { key: "Enter" });
}

async function openConfirmation() {
  const copy = (mocks.lang === "ar" ? ar : en).tenantProvisioning;
  fireEvent.click(screen.getByRole("checkbox", { name: copy.retentionAckLabel }));
  fireEvent.click(screen.getByRole("button", { name: copy.createDecommissionButton }));
  return screen.findByRole("alertdialog");
}

describe("tenant component decommission confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lang = "en";
    mocks.decommission.mockResolvedValue(undefined);
    const ready = <T,>(data: T) => ({ status: "ready", data, error: null, refreshing: false });
    provisioning = {
      authLoading: false,
      permissions: { canDecommission: true, canRepair: false, canAddApplication: false },
      operations: ready({ items: [], meta: META }),
      selectedOperation: ready(null),
      updates: ready({ items: [], meta: META }),
      components: ready({ items: [component], meta: META }),
      mutation: { name: null, error: null, intentKey: null },
      polling: false,
      decommission: mocks.decommission,
    } as unknown as ReturnType<typeof useTenantProvisioning>;
  });

  it.each(["en", "ar"] as const)("requires retention and the exact tenant/component name in %s", async (lang) => {
    mocks.lang = lang;
    const copy = (lang === "ar" ? ar : en).tenantProvisioning;
    render(workspace());
    openManaged();
    expect(screen.getByRole("button", { name: copy.createDecommissionButton })).toBeDisabled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(mocks.decommission).not.toHaveBeenCalled();

    const dialog = await openConfirmation();
    expect(within(dialog).getByText(copy.decommissionConfirmTitle)).toBeInTheDocument();
    expect(within(dialog).getByText(copy.decommissionConfirmDescription)).toBeInTheDocument();
    expect(mocks.paused).toHaveBeenLastCalledWith(true);
    const confirm = within(dialog).getByRole("button", { name: copy.createDecommissionButton });
    const input = within(dialog).getByRole("textbox");
    expect(confirm).toBeDisabled();
    for (const value of [TENANT_NAME, component.componentKey, `${TENANT_NAME.toUpperCase()} · ${component.componentKey}`, `${TENANT_NAME} · wrong`, `${targetName} `]) {
      fireEvent.change(input, { target: { value } });
      expect(confirm).toBeDisabled();
      fireEvent.click(confirm);
      expect(mocks.decommission).not.toHaveBeenCalled();
    }
    fireEvent.change(input, { target: { value: targetName } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(mocks.decommission).toHaveBeenCalledExactlyOnceWith(
      buildDecommissionOperationDto(component, "ADMIN.DECOMMISSION", true),
    );
    expect(mocks.paused).toHaveBeenLastCalledWith(false);
    openManaged();
    expect(screen.getByRole("checkbox", { name: copy.retentionAckLabel })).not.toBeChecked();
  });

  it("cancels without a request and clears typed confirmation on reopen", async () => {
    render(workspace());
    openManaged();
    const dialog = await openConfirmation();
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: targetName } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(mocks.decommission).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: en.tenantProvisioning.createDecommissionButton }));
    const reopened = await screen.findByRole("alertdialog");
    await waitFor(() => expect(within(reopened).getByRole("textbox")).toHaveValue(""));
    expect(within(reopened).getByRole("button", { name: en.tenantProvisioning.createDecommissionButton })).toBeDisabled();
    expect(mocks.decommission).not.toHaveBeenCalled();
  });

  it("blocks opening and confirming while another provisioning command is busy", async () => {
    const { rerender } = render(workspace());
    openManaged();
    fireEvent.click(screen.getByRole("checkbox", { name: en.tenantProvisioning.retentionAckLabel }));
    provisioning.mutation.name = "repair";
    rerender(workspace());
    const trigger = screen.getByRole("button", { name: en.tenantProvisioning.createDecommissionButton });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    provisioning.mutation.name = null;
    rerender(workspace());
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: targetName } });
    provisioning.mutation.name = "repair";
    rerender(workspace());
    const confirm = within(dialog).getByRole("button", { name: "Executing..." });
    expect(confirm).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.click(confirm);
    expect(mocks.decommission).not.toHaveBeenCalled();
  });

  it("sends the captured body once even if confirmation is clicked twice before a busy render", async () => {
    let finish!: () => void;
    mocks.decommission.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { container } = render(workspace());
    openManaged();
    const dialog = await openConfirmation();
    // Even a draft change behind the modal cannot change the reviewed body.
    fireEvent.change(container.querySelector('input[name="decommissionReasonCode"]')!, {
      target: { value: "ADMIN.CHANGED" },
    });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: targetName } });
    const confirm = within(dialog).getByRole("button", { name: en.tenantProvisioning.createDecommissionButton });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(mocks.decommission).toHaveBeenCalledTimes(1);
    expect(mocks.decommission).toHaveBeenCalledWith(
      buildDecommissionOperationDto(component, "ADMIN.DECOMMISSION", true),
    );
    finish();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});
