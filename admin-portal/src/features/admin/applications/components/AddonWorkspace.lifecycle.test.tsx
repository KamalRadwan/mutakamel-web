// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  user: { id: "01900000-0000-7000-8000-000000000020", isSuperAdmin: false, permissions: [] as string[] },
}));
const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), command: vi.fn(), replacePrices: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../api/addons.api", () => ({ addonsApi: api }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr" }),
  useOptionalI18n: () => ({ lang: "en", dir: "ltr", t: { common: { close: "Close" } } }),
}));

import { ApplicationAddonsWorkspace } from "./ApplicationAddonsWorkspace";
import { readAddonDetail, readAddonRoot, type AddonDetail } from "../lib/addon-contract";
import { addonFixture, addonIds, addonPageMeta } from "../lib/addon-test-fixtures";
import { addonCopy } from "../lib/addon-copy";

const copy = addonCopy("en");
const permission = (name: string) => `admin.applications.${name}`;
const allPermissions = ["read", "create", "update", "critical", "delete"].map(permission);
const publishedId = "01900000-0000-7000-8000-000000000010";
const actionNames = [copy.edit, copy.clone, copy.publish, copy.deprecate, copy.disable, copy.remove];

// These are closed transport fixtures only, not runtime registration evidence.
function definitionFixture(status: AddonDetail["lifecycleStatus"], withDraft: boolean, revoked = false): AddonDetail {
  const root = addonFixture();
  const published = status === "DRAFT" ? null : {
    ...root.draft!, id: publishedId, name: "Published logistics", description: "Retained published description",
    definitionHash: "a".repeat(64), publishedAt: "2026-09-07T12:00:00.000Z",
    revokedAt: revoked ? "2026-09-07T13:00:00.000Z" : null,
  };
  const draft = withDraft ? {
    ...root.draft!, name: "Draft logistics", description: "Unpublished draft description", version: published ? "2" : "1",
  } : null;
  return readAddonDetail({
    ...root, lifecycleStatus: status, publishedVersionId: published?.id ?? null, published,
    draftVersionId: draft?.id ?? null, draft,
  });
}

function pageOf(...items: AddonDetail[]) {
  return {
    items: items.map(item => readAddonRoot(Object.fromEntries(
      Object.entries(item).filter(([key]) => !["ownerRegistrationAvailable", "draft", "published"].includes(key)),
    ))),
    meta: { ...addonPageMeta, total: items.length, totalPages: items.length ? 1 : 0 },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, refuse) => { resolve = accept; reject = refuse; });
  return { promise, resolve, reject };
}

async function openWorkspace(detail: AddonDetail) {
  api.list.mockResolvedValue(pageOf(detail));
  api.get.mockResolvedValue(detail);
  const ui = render(<ApplicationAddonsWorkspace applicationKey="crm" supported />);
  fireEvent.click(await screen.findByRole("button", { name: /Logistics.*crm.logistics/ }));
  await screen.findByRole("heading", { name: "Logistics" });
  return ui;
}

function workspace() { return within(screen.getByRole("region", { name: "crm.logistics" })); }

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  auth.user = { id: "01900000-0000-7000-8000-000000000020", isSuperAdmin: false, permissions: [...allPermissions] };
});
afterEach(cleanup);

describe("Addon lifecycle actions and immutable evidence", () => {
  it.each([
    { status: "DRAFT" as const, draft: true, label: copy.draft, shown: [copy.edit, copy.publish, copy.disable, copy.remove] },
    { status: "ACTIVE" as const, draft: false, label: copy.activeLabel, shown: [copy.clone, copy.deprecate, copy.disable] },
    { status: "ACTIVE" as const, draft: true, label: copy.activeLabel, shown: [copy.edit, copy.publish, copy.deprecate, copy.disable] },
    { status: "DEPRECATED" as const, draft: true, label: copy.deprecatedLabel, shown: [copy.edit, copy.publish, copy.disable] },
    { status: "DISABLED" as const, draft: true, label: copy.disabledLabel, shown: [copy.edit] },
  ])("renders $status with draft=$draft without inferring readiness", async ({ status, draft, label, shown }) => {
    await openWorkspace(definitionFixture(status, draft));
    const view = workspace();
    expect(view.getByText(copy.lifecycle).parentElement).toHaveTextContent(label);
    for (const name of actionNames) {
      if (shown.includes(name)) expect(view.getByRole("button", { name })).toBeEnabled();
      else expect(view.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(view.getByText(copy.boundary)).toBeInTheDocument();
    expect(view.getByText(copy.catalogueRevision).parentElement).toHaveTextContent("9007199254740993");
    expect(api.command).not.toHaveBeenCalled();
  });

  it("retains revoked published evidence without offering a clone, publish or delete", async () => {
    await openWorkspace(definitionFixture("ACTIVE", false, true));
    const view = workspace();
    for (const name of [copy.clone, copy.publish, copy.remove, copy.edit]) {
      expect(view.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(view.getByRole("cell", { name: "Published logistics" })).toBeInTheDocument();
    expect(view.getAllByText(copy.noDraft)).not.toHaveLength(0);
    expect(api.command).not.toHaveBeenCalled();
  });

  it("compares draft and sealed publication in separately labelled columns without mutating either", async () => {
    const fixture = definitionFixture("ACTIVE", true);
    const original = structuredClone(fixture);
    await openWorkspace(fixture);
    const table = workspace().getByRole("table");
    const header = within(table).getAllByRole("row")[0];
    expect(within(header).getAllByRole("columnheader").map(cell => cell.textContent)).toEqual([copy.definition, copy.published, copy.draft]);
    const row = within(table).getByRole("row", { name: /Description\s*Changed Retained published description Unpublished draft description/ });
    expect(within(row).getAllByRole("cell").map(cell => cell.textContent)).toEqual([
      "Retained published description", "Unpublished draft description",
    ]);
    expect(fixture).toEqual(original);
    expect(api.command).not.toHaveBeenCalled();
  });

  it("does not mistake an unpublished draft for retained publication", async () => {
    await openWorkspace(definitionFixture("DRAFT", true));
    const row = workspace().getByRole("row", { name: /Name\s*Changed No snapshot Draft logistics/ });
    expect(within(row).getAllByRole("cell").map(cell => cell.textContent)).toEqual([copy.emptySnapshot, "Draft logistics"]);
  });
});

describe("Addon current permission boundaries", () => {
  it.each([
    { grants: ["read"], edit: false, critical: false, remove: false },
    { grants: ["read", "update"], edit: true, critical: false, remove: false },
    { grants: ["read", "critical"], edit: false, critical: false, remove: false },
    { grants: ["read", "delete"], edit: false, critical: false, remove: false },
    { grants: ["read", "delete", "critical"], edit: false, critical: false, remove: true },
    { grants: ["read", "update", "critical"], edit: true, critical: true, remove: false },
  ])("uses ALL semantics for $grants", async ({ grants, edit, critical, remove }) => {
    auth.user.permissions = grants.map(permission);
    await openWorkspace(definitionFixture("DRAFT", true));
    const view = workspace();
    for (const [name, allowed] of [[copy.edit, edit], [copy.publish, critical], [copy.disable, critical], [copy.remove, remove]] as const) {
      expect(view.queryByRole("button", { name }) !== null).toBe(allowed);
    }
    expect(api.command).not.toHaveBeenCalled();
  });

  it.each([copy.publish, copy.remove])("closes a reviewed %s dialog when its current permission is revoked", async name => {
    const ui = await openWorkspace(definitionFixture("DRAFT", true));
    fireEvent.click(workspace().getByRole("button", { name }));
    expect(screen.getByRole("dialog", { name })).toBeInTheDocument();
    auth.user.permissions = ["read", "update", "delete"].map(permission);
    ui.rerender(<ApplicationAddonsWorkspace applicationKey="crm" supported />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.command).not.toHaveBeenCalled();
  });

  it("discards a late detail response after read permission is revoked", async () => {
    const pending = deferred<AddonDetail>();
    api.list.mockResolvedValue(pageOf(addonFixture()));
    api.get.mockReturnValue(pending.promise);
    const ui = render(<ApplicationAddonsWorkspace applicationKey="crm" supported />);
    fireEvent.click(await screen.findByRole("button", { name: /Logistics.*crm.logistics/ }));
    await waitFor(() => expect(api.get).toHaveBeenCalledOnce());
    const signal = api.get.mock.calls[0][2] as AbortSignal;
    auth.user.permissions = [];
    ui.rerender(<ApplicationAddonsWorkspace applicationKey="crm" supported />);
    expect(signal.aborted).toBe(true);
    await act(async () => { pending.resolve(addonFixture()); });
    expect(screen.queryByRole("region", { name: "crm.logistics" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("admin.applications.read");
    expect(api.command).not.toHaveBeenCalled();
  });
});

describe("Authoritative refusal and stale detail delivery", () => {
  it("does not steal focus when an authoritative rejection arrives after permission closes the dialog", async () => {
    const pending = deferred<never>();
    api.command.mockReturnValue(pending.promise);
    const ui = await openWorkspace(definitionFixture("DRAFT", true));
    fireEvent.click(workspace().getByRole("button", { name: copy.publish }));
    const dialog = within(screen.getByRole("dialog", { name: copy.publish }));
    fireEvent.change(dialog.getByRole("textbox", { name: copy.reason }), { target: { value: "Review this exact source fixture" } });
    fireEvent.click(dialog.getByRole("button", { name: copy.confirm }));
    await waitFor(() => expect(api.command).toHaveBeenCalledOnce());

    auth.user.permissions = ["read", "update"].map(permission);
    ui.rerender(<ApplicationAddonsWorkspace applicationKey="crm" supported />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const search = screen.getByRole("textbox", { name: copy.search });
    act(() => { search.focus(); });
    await act(async () => {
      pending.reject({ isNormalized: true, httpStatus: 409, errorCode: "ADDON_CATALOGUE_REVISION_STALE",
        message: "The catalogue command was refused.", correlationId: addonIds.key });
    });

    expect(search).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(api.command).toHaveBeenCalledOnce();
    expect(screen.queryByText(copy.saved)).not.toBeInTheDocument();
  });

  it.each([
    { code: "ADDON_OWNER_REGISTRATION_UNAVAILABLE", status: 422 },
    { code: "ADDON_CATALOGUE_REVISION_STALE", status: 409 },
  ])("keeps the reviewed draft and announces $code without pretending publication succeeded", async ({ code, status }) => {
    const detail = definitionFixture("DRAFT", true);
    api.command.mockRejectedValue({ isNormalized: true, httpStatus: status, errorCode: code, message: "The catalogue command was refused.", correlationId: addonIds.key });
    await openWorkspace(detail);
    fireEvent.click(workspace().getByRole("button", { name: copy.publish }));
    const dialog = within(screen.getByRole("dialog", { name: copy.publish }));
    fireEvent.change(dialog.getByRole("textbox", { name: copy.reason }), { target: { value: "Review this exact source fixture" } });
    fireEvent.click(dialog.getByRole("button", { name: copy.confirm }));
    await waitFor(() => expect(dialog.getByRole("alert")).toHaveTextContent(code));
    expect(dialog.getByRole("alert")).toHaveTextContent(addonIds.key);
    expect(api.command).toHaveBeenCalledExactlyOnceWith("crm", "crm.logistics", {
      kind: "PUBLISH", body: { expectedCatalogueRevision: detail.catalogueRevision,
        draftVersionId: detail.draftVersionId, expectedDefinitionRevision: detail.draft!.definitionRevision, reason: "Review this exact source fixture" },
    }, expect.any(String));
    expect(api.get).toHaveBeenCalledOnce();
    expect(screen.queryByText(copy.saved)).not.toBeInTheDocument();
    expect(screen.queryByText(copy.pending)).not.toBeInTheDocument();
    expect(screen.queryByText(copy.unknown)).not.toBeInTheDocument();
    await waitFor(() => expect(dialog.getByRole("alert")).toHaveFocus());
    fireEvent.click(dialog.getByRole("button", { name: copy.cancel }));
    expect(workspace().getByRole("cell", { name: "Draft logistics" })).toBeInTheDocument();
    expect(workspace().getByRole("button", { name: copy.publish })).toBeEnabled();
  });

  it.each(["success", "failure"] as const)("suppresses an older %s after selecting a different addon", async outcome => {
    const older = deferred<AddonDetail>();
    const secondId = "01900000-0000-7000-8000-000000000030";
    const secondDraftId = "01900000-0000-7000-8000-000000000031";
    const newer = readAddonDetail({ ...addonFixture(), id: secondId, key: "crm.sales", name: "Current sales",
      draftVersionId: secondDraftId, draft: { ...addonFixture().draft!, id: secondDraftId, addonId: secondId } });
    api.list.mockResolvedValue(pageOf(addonFixture(), newer));
    api.get.mockReturnValueOnce(older.promise).mockResolvedValueOnce(newer);
    render(<ApplicationAddonsWorkspace applicationKey="crm" supported />);
    fireEvent.click(await screen.findByRole("button", { name: /Logistics.*crm.logistics/ }));
    await waitFor(() => expect(api.get).toHaveBeenCalledOnce());
    const previousSignal = api.get.mock.calls[0][2] as AbortSignal;
    fireEvent.click(screen.getByRole("button", { name: /Current sales.*crm.sales/ }));
    await screen.findByRole("heading", { name: "Current sales" });
    expect(previousSignal.aborted).toBe(true);
    await act(async () => {
      if (outcome === "success") older.resolve(readAddonDetail({ ...addonFixture(), name: "Obsolete logistics" }));
      else older.reject({ isNormalized: true, httpStatus: 403, errorCode: "DENIED", message: "Obsolete denial", correlationId: addonIds.key });
    });
    expect(screen.getByRole("heading", { name: "Current sales" })).toBeInTheDocument();
    expect(screen.queryByText("Obsolete denial")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Obsolete logistics" })).not.toBeInTheDocument();
    expect(api.command).not.toHaveBeenCalled();
  });
});
