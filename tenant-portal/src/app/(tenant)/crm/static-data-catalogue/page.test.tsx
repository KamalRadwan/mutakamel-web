// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { api, auth } = vi.hoisted(() => ({
  api: { get: vi.fn() }, auth: { user: { id: "actor", permissions: ["crm.settings.read"] } },
}));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: api, TenantApiClientError: class extends Error {
  constructor(message: string, public response: { status: number; data: Record<string, unknown> }) { super(message); }
} }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));

import { TenantApiClientError } from "@/lib/api/axiosClient";
import { I18nProvider } from "@/i18n/I18nContext";
import { setLanguage } from "@/i18n/useLanguage";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { TooltipProvider } from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import { catalogueFixture } from "./hooks/static-catalogue.test-fixture";
import CrmStaticCataloguePage from "./page";

function renderPage(language: "en" | "ar" = "en") {
  return render(<I18nProvider initialLanguage={language}><TooltipProvider><CrmStaticCataloguePage /></TooltipProvider></I18nProvider>);
}
beforeEach(async () => {
  vi.clearAllMocks(); auth.user.permissions = ["crm.settings.read"];
  window.localStorage.setItem("tenant_lang", "en");
  await setLanguage("en");
  api.get.mockResolvedValue({ data: catalogueFixture });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("approved static catalogue workspace", () => {
  it("shows a read-only four-column catalogue, real size and all groups without fake paging", async () => {
    renderPage();
    expect(await screen.findByText("18 catalogue groups")).toBeVisible();
    expect(screen.getByRole("heading", { name: en.crmStaticCatalogue.title })).toBeVisible();
    expect(screen.getAllByRole("columnheader")).toHaveLength(4);
    const attachment = screen.getByRole("cell", { name: en.crmStaticCatalogue.groups.attachmentPolicy }).closest("tr")!;
    expect(within(attachment).getByText("25 MB")).toBeVisible();
    expect(within(attachment).getByText("PDF · Images · Word · Excel · Text")).toBeVisible();
    expect(screen.queryByRole("button", { name: en.common.nextPage })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: en.nav.leadStages })).not.toBeInTheDocument();
    expect(screen.queryByText(en.crmStaticCatalogue.stale)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzzz" } });
    expect(await screen.findByText(en.crmStaticCatalogue.empty)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: en.crmStaticCatalogue.clearSearch }));
    expect(await screen.findByRole("cell", { name: en.crmStaticCatalogue.groups.profileTypes })).toBeVisible();
  });

  it("makes every value accessible in details and keeps wire codes behind technical disclosure", async () => {
    renderPage();
    const group = en.crmStaticCatalogue.groups.customFieldTypes;
    fireEvent.click(await screen.findByRole("button", { name: formatTemplate(en.crmStaticCatalogue.viewDetails, { group }) }));
    const dialog = screen.getByRole("dialog", { name: group });
    expect(within(dialog).getByText("Select")).toBeVisible();
    expect(within(dialog).queryByText("SELECT")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: en.crmStaticCatalogue.technicalDetails }));
    expect(within(dialog).getByText("SELECT")).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: en.common.close }));
    fireEvent.click(screen.getByRole("button", { name: formatTemplate(en.crmStaticCatalogue.viewDetails, {
      group: en.crmStaticCatalogue.groups.opportunityStatusByStageFlag,
    }) }));
    const rules = screen.getByRole("dialog");
    expect(within(rules).getAllByRole("row")).toHaveLength(5);
    expect(within(rules).getByText(en.crmStaticCatalogue.otherStages)).toBeVisible();
  });

  it("uses Arabic labels and Western count digits, including untranslated permission notes", async () => {
    await setLanguage("ar");
    renderPage("ar");
    expect(await screen.findByText("18 مجموعة مرجعية")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: formatTemplate(ar.crmStaticCatalogue.viewDetails, {
      group: ar.crmStaticCatalogue.groups.permissions,
    }) }));
    expect(within(screen.getByRole("dialog")).getByText(`Read own leads — ${ar.crmStaticCatalogue.untranslatedLabel}`)).toBeVisible();
    expect(screen.queryByText("١٨ مجموعة مرجعية")).not.toBeInTheDocument();
  });

  it("retries an initial failure, retains rows on a failed refresh and replaces them on a server denial", async () => {
    api.get.mockRejectedValueOnce(new Error("offline"));
    renderPage();
    expect(await screen.findByText(en.crmStaticCatalogue.loadFailed)).toBeVisible();
    expect(screen.queryByText(en.crmStaticCatalogue.emptyCatalogue)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    await screen.findByText("18 catalogue groups");
    api.get.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: en.crmStaticCatalogue.reload }));
    expect(await screen.findByText(en.crmStaticCatalogue.stale)).toBeVisible();
    expect(screen.getByRole("cell", { name: en.crmStaticCatalogue.groups.profileTypes })).toBeVisible();
    api.get.mockRejectedValueOnce(new TenantApiClientError("denied", { status: 403, statusText: "Forbidden", headers: new Headers(), data: {} }));
    fireEvent.click(screen.getByRole("button", { name: en.crmStaticCatalogue.reload }));
    await waitFor(() => expect(screen.getByText(en.permissionGate.title)).toBeVisible());
    expect(screen.queryByRole("cell", { name: en.crmStaticCatalogue.groups.profileTypes })).not.toBeInTheDocument();
  });
});
