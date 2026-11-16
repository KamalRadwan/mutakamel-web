// @vitest-environment jsdom

import { Suspense } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import ApplicationDetailPage from "./page";

const mocks = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  push: vi.fn(),
  deleteApplication: vi.fn<(revision: string, reason: string) => Promise<boolean>>(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "operator" } }) }));
vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/rbac")>(),
  adminCanAll: () => true,
}));
vi.mock("@/i18n/I18nContext", () => {
  const value = () => ({ lang: mocks.lang, dir: mocks.lang === "ar" ? "rtl" : "ltr", t: mocks.lang === "ar" ? ar : en });
  return { useI18n: value, useOptionalI18n: value };
});
vi.mock("@/features/admin/applications/hooks/useApplication", () => ({
  useApplication: () => ({
    application: {
      id: "application-id", key: "crm", name: "CRM", lifecycleStatus: "DRAFT",
      publicationStatus: "UNPUBLISHED", catalogueRevision: "7",
      applicationType: "SYSTEM", commercialMode: "NON_BILLABLE", databaseDeployment: "NONE",
      databasePolicy: { enableOnNewServers: false, rotationEnabled: false, rotationIntervalHours: 24, maintenanceWindowStartUtc: 0, maintenanceWindowHours: 1, policyRevision: "1" },
      serverSummary: { ready: 0, eligible: 0, pending: 0, degraded: 0, coveragePercent: 0, rolloutRequired: false },
    },
    isLoading: false, isRefreshing: false, isMutating: false, manifests: [],
    deleteApplication: mocks.deleteApplication,
  }),
}));
vi.mock("@/features/admin/applications/hooks/useApplicationTechnicalProvisioning", () => ({
  useApplicationTechnicalProvisioning: () => ({ readiness: null, isLoading: false, error: null }),
}));
vi.mock("@/features/admin/applications/components/ApplicationCatalogueWorkspace", () => ({ ApplicationCatalogueWorkspace: () => null }));
vi.mock("@/features/admin/applications/components/ApplicationAddonsWorkspace", () => ({ ApplicationAddonsWorkspace: () => null }));
vi.mock("@/features/admin/applications/components/ApplicationConfigurationDialog", () => ({ ApplicationConfigurationDialog: () => null }));
vi.mock("@/features/admin/applications/components/ApplicationLifecycleDialog", () => ({ ApplicationLifecycleDialog: () => null }));
vi.mock("@/features/admin/applications/components/ApplicationDatabaseBindDialog", () => ({ ApplicationDatabaseBindDialog: () => null }));
vi.mock("@/features/admin/applications/components/ApplicationPrimaryComponentDialog", () => ({ ApplicationPrimaryComponentDialog: () => null }));
vi.mock("@/features/admin/applications/components/ApplicationPublishActivateDialog", () => ({ ApplicationPublishActivateDialog: () => null }));
vi.mock("@/features/admin/applications/components/ApplicationReleaseAuthorityRail", () => ({ ApplicationReleaseAuthorityRail: () => null }));
vi.mock("@/features/admin/applications/components/ApplicationTechnicalProvisioningPanel", () => ({ ApplicationTechnicalProvisioningPanel: () => null }));

beforeEach(() => {
  mocks.lang = "en";
  mocks.deleteApplication.mockReset().mockResolvedValue(true);
  mocks.push.mockReset();
});
afterEach(cleanup);

async function openDelete() {
  const copy = (mocks.lang === "ar" ? ar : en).applications;
  const params = Promise.resolve({ applicationKey: "crm" });
  // Flush the route's use(params) suspension before querying the real header action.
  await act(async () => {
    render(<Suspense fallback={<p>Loading</p>}><ApplicationDetailPage params={params} /></Suspense>);
  });
  fireEvent.click(await screen.findByRole("button", { name: copy.detail.delete }));
  const dialog = within(await screen.findByRole("dialog", { name: copy.detail.deleteTitle }));
  return {
    copy,
    dialog,
    name: dialog.getByRole("textbox", { name: copy.detail.deleteConfirmName }),
    reason: dialog.getByRole("textbox", { name: copy.detail.deleteReasonLabel }),
    confirm: dialog.getByRole("button", { name: copy.detail.delete }),
  };
}

describe("Application deletion", () => {
  it.each(["en", "ar"] as const)("requires the exact name and eight trimmed reason characters in %s", async (lang) => {
    mocks.lang = lang;
    const { name, reason, confirm } = await openDelete();
    expect(confirm).toBeDisabled();
    fireEvent.change(name, { target: { value: "CRM" } });
    for (const value of ["", "        ", " 1234567 ", "x".repeat(257)]) {
      fireEvent.change(reason, { target: { value } });
      expect(confirm).toBeDisabled();
      fireEvent.submit(confirm.closest("form")!);
    }
    expect(mocks.deleteApplication).not.toHaveBeenCalled();
    fireEvent.change(reason, { target: { value: " 12345678 " } });
    fireEvent.change(name, { target: { value: " CRM " } });
    expect(confirm).toBeDisabled();
    fireEvent.change(name, { target: { value: "CRM" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.deleteApplication).toHaveBeenCalledWith("7", "12345678"));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/applications-catalogue"));
  });

  it.each(["en", "ar"] as const)("catches rejection and preserves the dialog and reason for retry in %s", async (lang) => {
    mocks.lang = lang;
    mocks.deleteApplication.mockRejectedValueOnce({ code: "APPLICATION_IN_USE", message: "Server message" });
    const { copy, dialog, name, reason, confirm } = await openDelete();
    fireEvent.change(name, { target: { value: "CRM" } });
    fireEvent.change(reason, { target: { value: "Remove unused draft" } });
    fireEvent.click(confirm);
    expect(await dialog.findByRole("alert")).toHaveTextContent(copy.errors.APPLICATION_IN_USE);
    expect(reason).toHaveValue("Remove unused draft");
    expect(mocks.push).not.toHaveBeenCalled();
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/applications-catalogue"));
    expect(mocks.deleteApplication).toHaveBeenCalledTimes(2);
  });

  it("blocks duplicate submission and dismissal while deletion is pending", async () => {
    let resolveDelete!: (value: boolean) => void;
    mocks.deleteApplication.mockReturnValueOnce(new Promise<boolean>((resolve) => { resolveDelete = resolve; }));
    const { copy, dialog, name, reason, confirm } = await openDelete();
    fireEvent.change(name, { target: { value: "CRM" } });
    fireEvent.change(reason, { target: { value: "Remove unused draft" } });
    fireEvent.submit(confirm.closest("form")!);
    fireEvent.submit(confirm.closest("form")!);
    await waitFor(() => expect(mocks.deleteApplication).toHaveBeenCalledTimes(1));
    expect(confirm).toBeDisabled();
    expect(dialog.getByRole("button", { name: copy.cancel })).toBeDisabled();
    expect(reason).toBeDisabled();
    resolveDelete(true);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/applications-catalogue"));
  });

  it("catches a synchronous context-guard failure without navigating", async () => {
    mocks.deleteApplication.mockImplementationOnce(() => { throw new Error("APPLICATION_CONTEXT_CHANGED"); });
    const { dialog, name, reason, confirm } = await openDelete();
    fireEvent.change(name, { target: { value: "CRM" } });
    fireEvent.change(reason, { target: { value: "Remove unused draft" } });
    fireEvent.click(confirm);
    expect(await dialog.findByRole("alert")).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
    await waitFor(() => expect(confirm).toBeEnabled());
  });

  it.each(["en", "ar"] as const)("clears the reason and name after cancellation in %s", async (lang) => {
    mocks.lang = lang;
    const { copy, dialog, name, reason } = await openDelete();
    fireEvent.change(name, { target: { value: "CRM" } });
    fireEvent.change(reason, { target: { value: "Remove unused draft" } });
    fireEvent.click(dialog.getByRole("button", { name: copy.cancel }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: copy.detail.deleteTitle })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: copy.detail.delete }));
    const reopened = within(await screen.findByRole("dialog", { name: copy.detail.deleteTitle }));
    expect(reopened.getByRole("textbox", { name: copy.detail.deleteConfirmName })).toHaveValue("");
    expect(reopened.getByRole("textbox", { name: copy.detail.deleteReasonLabel })).toHaveValue("");
    expect(reopened.getByRole("button", { name: copy.detail.delete })).toBeDisabled();
    expect(mocks.deleteApplication).not.toHaveBeenCalled();
  });
});
