// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { api, auth } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  auth: { user: { permissions: ["crm.tags.read", "crm.tags.manage"], accessMode: "FULL" } },
}));
vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: api,
  TenantApiClientError: class extends Error {
    constructor(message: string, public response: { status: number; data: Record<string, unknown> }) { super(message); }
  },
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("next/navigation", () => ({ usePathname: () => "/crm/tags" }));

import { TenantApiClientError } from "@/lib/api/axiosClient";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { TooltipProvider } from "@/design-system";
import CrmTagsPage from "./page";

const TAG = {
  id: "01900100-0000-7000-8000-000000000001", name: "VIP",
  backgroundColor: "#DBEAFE", textColor: "#1E40AF",
  createdAt: "2026-11-03T10:00:00Z", updatedAt: "2026-11-03T10:00:00Z",
};
function renderPage(language: "en" | "ar" = "en") {
  return render(<I18nProvider initialLanguage={language}><TooltipProvider><CrmTagsPage /></TooltipProvider></I18nProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { permissions: ["crm.tags.read", "crm.tags.manage"], accessMode: "FULL" };
  window.localStorage.setItem("tenant_lang", "en");
  api.get.mockResolvedValue({ data: [TAG] });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Tags table catalogue", () => {
  it("shows one named chip per row, real colors, catalogue counts and recoverable local search", async () => {
    renderPage();
    await screen.findByRole("cell", { name: "VIP" });
    expect(screen.getAllByRole("heading", { name: en.nav.crmTags }).some((heading) => heading.tagName === "H2")).toBe(true);
    expect(screen.getByText(en.crmTags.subtitle)).toBeVisible();
    expect(screen.getByRole("region", { name: en.nav.crmTags })).toBeVisible();
    expect(screen.getByText("Tags: 1")).toBeVisible();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
    for (const name of [en.crmTags.tag, en.crmTags.colour, en.crmTags.updated, en.common.actions]) {
      expect(within(table).getByRole("columnheader", { name })).toBeVisible();
    }
    expect(within(table).getAllByText("VIP")).toHaveLength(1);
    expect(within(table).getByTitle("VIP")).toHaveStyle({ backgroundColor: "#DBEAFE", color: "#1E40AF" });
    expect(within(table).getByRole("img", { name: `${en.tagColors.names.blue}: #DBEAFE / #1E40AF` })).toBeVisible();
    expect(screen.queryByText("#DBEAFE / #1E40AF")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: en.nav.leadStages })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.common.nextPage })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "premium" } });
    expect(await screen.findByText(en.crmTags.empty)).toBeVisible();
    expect(screen.getByText("0 of 1 tags")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: en.crmTags.clearSearch }));
    expect(await screen.findByRole("cell", { name: "VIP" })).toBeVisible();
  });

  it("keeps readable catalogue data and hides mutation actions in read-only mode", async () => {
    auth.user.accessMode = "READ_ONLY";
    renderPage();
    await screen.findByRole("cell", { name: "VIP" });
    expect(screen.getByText(en.crmTags.readOnly)).toBeVisible();
    expect(screen.queryByRole("columnheader", { name: en.common.actions })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.crmTags.add })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit: VIP" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete: VIP" })).not.toBeInTheDocument();
  });

  it("opens the existing editor from a named table row without changing the tag contract", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit: VIP" }));
    const modal = screen.getByRole("dialog", { name: en.crmTags.editTitle });
    expect(within(modal).getByRole("textbox", { name: en.crmTags.nameLabel })).toHaveValue("VIP");
    expect(within(modal).getByText(en.crmTags.editAppliesEverywhere)).toBeVisible();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("hides stale counts after a failed reload and recovers through the real reload control", async () => {
    renderPage();
    await screen.findByText("Tags: 1");
    api.get.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: en.crmTags.reload }));
    expect(await screen.findByText(en.crmTags.loadFailed)).toBeVisible();
    expect(screen.queryByText("Tags: 1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.crmTags.add })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(await screen.findByText("Tags: 1")).toBeVisible();
    expect(screen.getByRole("cell", { name: "VIP" })).toBeVisible();
  });

  it("separates an empty catalogue from permission denied", async () => {
    api.get.mockResolvedValue({ data: [] });
    const view = renderPage();
    expect(await screen.findByText(en.crmTags.emptyCatalogue)).toBeVisible();
    expect(screen.getByText(en.crmTags.emptyHint)).toBeVisible();
    view.unmount();
    auth.user.permissions = [];
    renderPage();
    expect(await screen.findByText(en.permissionGate.title)).toBeVisible();
    expect(screen.queryByText(en.crmTags.emptyCatalogue)).not.toBeInTheDocument();
  });

  it("renders an actionable detach-limit blocker with only the server-returned count", async () => {
    api.delete.mockRejectedValue(new TenantApiClientError("guard", {
      status: 422, statusText: "Unprocessable Entity", headers: new Headers(),
      data: { errorCode: "CRM_TAG_DETACH_LIMIT_EXCEEDED", details: { count: 127 } },
    }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Delete: VIP" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: en.common.delete }));
    const blocker = await screen.findByRole("dialog", { name: en.crmTags.deleteBlockedTitle });
    expect(within(blocker).getByText(en.crmTags.errors.detachLimit)).toBeVisible();
    expect(within(blocker).getByText("127")).toBeVisible();
    expect(within(blocker).queryByRole("button", { name: en.common.delete })).not.toBeInTheDocument();
    expect(api.delete).toHaveBeenCalledTimes(1);
  });

  it("does not silently submit a prior color when the visible custom draft is invalid", async () => {
    renderPage();
    await screen.findByRole("cell", { name: "VIP" });
    fireEvent.click(screen.getByRole("button", { name: en.crmTags.add }));
    const modal = screen.getByRole("dialog", { name: en.crmTags.addTitle });
    const name = within(modal).getByRole("textbox", { name: en.crmTags.nameLabel });
    expect(name).not.toHaveAttribute("maxlength");
    fireEvent.change(name, { target: { value: "Strategic account" } });
    const color = within(modal).getByRole("textbox", { name: en.tagColors.background });
    fireEvent.change(color, { target: { value: "#BAD" } });
    expect(color).toHaveAttribute("aria-invalid", "true");
    expect(within(modal).getByRole("button", { name: en.crmTags.save })).toBeDisabled();
    fireEvent.submit(name.closest("form")!);
    await waitFor(() => expect(api.post).not.toHaveBeenCalled());
  });

  it("asks before discarding changed fields and returns to the same draft", async () => {
    renderPage();
    await screen.findByRole("cell", { name: "VIP" });
    fireEvent.click(screen.getByRole("button", { name: en.crmTags.add }));
    const modal = screen.getByRole("dialog", { name: en.crmTags.addTitle });
    fireEvent.change(within(modal).getByRole("textbox", { name: en.crmTags.nameLabel }), { target: { value: "Strategic account" } });
    fireEvent.click(within(modal).getByRole("button", { name: en.common.cancel }));
    const discard = await screen.findByRole("alertdialog", { name: en.common.discardTitle });
    fireEvent.click(within(discard).getByRole("button", { name: en.common.cancel }));
    expect(within(modal).getByRole("textbox", { name: en.crmTags.nameLabel })).toHaveValue("Strategic account");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("uses translated Arabic state labels and Western digits for field counts", async () => {
    window.localStorage.setItem("tenant_lang", "ar");
    renderPage("ar");
    await screen.findByRole("cell", { name: "VIP" });
    expect(screen.getByRole("region", { name: ar.nav.crmTags })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: ar.crmTags.tag })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: ar.crmTags.add }));
    const modal = screen.getByRole("dialog", { name: ar.crmTags.addTitle });
    const name = within(modal).getByRole("textbox", { name: ar.crmTags.nameLabel });
    fireEvent.change(name, { target: { value: "عميل مميز" } });
    expect(within(modal).getByText("9/60")).toBeVisible();
    expect(within(modal).getByRole("button", { name: ar.crmTags.save })).toBeVisible();
  });
});
