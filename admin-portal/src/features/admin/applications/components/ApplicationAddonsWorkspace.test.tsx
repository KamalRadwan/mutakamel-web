// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: { id: "actor", isSuperAdmin: false, permissions: [] as string[] }, lang: "en" }));
const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), command: vi.fn(), replacePrices: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("../api/addons.api", () => ({ addonsApi: api }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: state.lang, dir: state.lang === "ar" ? "rtl" : "ltr" }), useOptionalI18n: () => ({ lang: "en", dir: "ltr", t: { common: { close: "Close" } } }) }));
import { ApplicationAddonsWorkspace } from "./ApplicationAddonsWorkspace";
import { addonFixture, addonPageMeta } from "../lib/addon-test-fixtures";

beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); state.lang = "en"; state.user = { id: "actor", isSuperAdmin: false, permissions: [] }; });
afterEach(cleanup);
describe("Application owned addon workspace", () => {
  it("does not issue list or detail I/O without read permission", async () => {
    state.user.permissions = ["admin.applications.create"];
    render(<ApplicationAddonsWorkspace applicationKey="crm" supported />);
    await act(async () => {});
    expect(screen.getByRole("alert")).toHaveTextContent("admin.applications.read");
    expect(screen.queryByRole("button", { name: "Create addon" })).not.toBeInTheDocument();
    expect(api.list).not.toHaveBeenCalled(); expect(api.get).not.toHaveBeenCalled();
  });
  it("renders backend denial as error rather than empty catalogue", async () => {
    state.user.permissions = ["admin.applications.read"];
    api.list.mockRejectedValue({ isNormalized: true, httpStatus: 403, errorCode: "DENIED", message: "Denied", correlationId: "safe-correlation" });
    render(<ApplicationAddonsWorkspace applicationKey="crm" supported />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("safe-correlation"));
    expect(screen.queryByText("No addons match this application.")).not.toBeInTheDocument();
  });
  it("keeps unsupported Apps read-only even for a super admin", async () => {
    state.user.isSuperAdmin = true; api.list.mockResolvedValue({ items: [], meta: addonPageMeta });
    render(<ApplicationAddonsWorkspace applicationKey="crm" supported={false} />);
    await waitFor(() => expect(api.list).toHaveBeenCalledOnce());
    expect(screen.queryByRole("button", { name: "Create addon" })).not.toBeInTheDocument();
  });
  it("requires both update and critical permissions and immediately hides the workspace after read revocation", async () => {
    state.user.permissions = ["admin.applications.read", "admin.applications.update"];
    api.list.mockResolvedValue({ items: [addonFixture()], meta: { ...addonPageMeta, total: 1, totalPages: 1 } }); api.get.mockResolvedValue(addonFixture());
    const ui = render(<ApplicationAddonsWorkspace applicationKey="crm" supported />);
    fireEvent.click(await screen.findByRole("button", { name: /Logistics.*crm.logistics/ }));
    await screen.findByRole("heading", { name: "Logistics" });
    expect(screen.queryByRole("button", { name: "Publish draft" })).not.toBeInTheDocument();
    state.user.permissions = ["admin.applications.read", "admin.applications.update", "admin.applications.critical"];
    ui.rerender(<ApplicationAddonsWorkspace applicationKey="crm" supported />);
    expect(screen.getByRole("button", { name: "Publish draft" })).toBeInTheDocument();
    state.user.permissions = [];
    ui.rerender(<ApplicationAddonsWorkspace applicationKey="crm" supported />);
    expect(screen.queryByRole("region", { name: "crm.logistics" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("admin.applications.read");
  });
});
