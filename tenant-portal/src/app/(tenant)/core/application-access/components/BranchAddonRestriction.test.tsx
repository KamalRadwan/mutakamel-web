// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { parseApplicationAccessResponse, type ApplicationAccessRequest } from "../application-access-contract";
import { useApplicationAccess } from "../hooks/useApplicationAccess";
import { BranchAddonRestriction } from "./BranchAddonRestriction";

const mocks = vi.hoisted(() => ({ read: vi.fn(), confirm: vi.fn(), lang: "en" as "en" | "ar", auth: {
  user: { id: "018ef54e-2222-7777-8888-000000000090", permissions: ["applications.activation.manage"], isTenantOwner: false },
  isAuthenticated: true, authState: "AUTHENTICATED", realtimeAuthGeneration: "session-1" as string | null,
} }));
const dictionaries = { en, ar }, directions = { en: "ltr", ar: "rtl" };
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => mocks.auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[mocks.lang], lang: mocks.lang, dir: directions[mocks.lang] }) }));
vi.mock("@/i18n/useLanguage", async (original) => ({ ...await original<typeof import("@/i18n/useLanguage")>(), useLanguage: () => mocks.lang, useDictionary: () => dictionaries[mocks.lang] }));
vi.mock("../application-access-api", () => ({ readApplicationAccess: mocks.read }));
const id = (n: number) => `018ef54e-2222-7777-8888-${String(n).padStart(12, "0")}`;
const request: ApplicationAccessRequest = { kind: "BRANCH_OVERRIDE", branchId: id(2), applicationKey: "crm", addonKey: "crm.logistics" };
const failure = (status: number, errorCode?: string) => new TenantApiClientError("not for display", { status, statusText: "Error", headers: new Headers(), data: { errorCode } });
function fixture(mode: "INHERIT" | "DISABLED" | null = "INHERIT", revision = "9007199254740993") {
  const timestamp = "2026-09-08T10:00:00.000Z";
  return parseApplicationAccessResponse({ success: true, correlationId: "test", timestamp, data: {
     scope: { kind: "BRANCH", companyId: id(1), branchId: id(2) },
    target: { applicationId: id(3), applicationKey: "crm", addonId: id(4), addonKey: "crm.logistics" },
    resource: { kind: "BRANCH_OVERRIDE", state: mode === null ? "NOT_CREATED" : "STORED", id: mode === null ? null : id(5),
      revision: mode === null ? "0" : revision, mode, definitionVersionId: mode === null ? null : id(6), configVersionId: mode === null ? null : id(7),
      companyApplicationEnabled: false, companyAddonEnabled: false },
    source: { observedAt: timestamp, selectionState: "NOT_SELECTED", applicationLifecycleStatus: "DISABLED", addonLifecycleStatus: "DISABLED",
      selectedDefinitionVersionId: id(8), definitionState: "REVOKED", localSourceState: "UNMATCHED", adoptionPending: true },
    operationalUse: "NOT_EVALUATED",
  } }, request);
}
function Harness({ target = request }: { target?: ApplicationAccessRequest }) {
  const read = useApplicationAccess(target);
  return <BranchAddonRestriction request={target} read={read} onConfirm={mocks.confirm} />;
}
beforeEach(() => {
  mocks.lang = "en"; mocks.auth.user = { id: id(90), permissions: ["applications.activation.manage"], isTenantOwner: false };
  mocks.auth.isAuthenticated = true; mocks.auth.authState = "AUTHENTICATED"; mocks.auth.realtimeAuthGeneration = "session-1";
  mocks.read.mockReset().mockResolvedValue(fixture()); mocks.confirm.mockReset().mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.documentElement.classList.remove("dark"); });
async function open() {
  const copy = dictionaries[mocks.lang].branchAddonRestriction;
  const trigger = screen.getByRole("button", { name: copy.review }); await waitFor(() => expect(trigger).toBeEnabled());
  trigger.focus(); fireEvent.click(trigger); return trigger;
}
function reason(value = "Restrict this Branch") {
  fireEvent.change(screen.getByRole("textbox", { name: dictionaries[mocks.lang].branchAddonRestriction.reason }), { target: { value } });
}
function confirm() { fireEvent.click(screen.getByRole("button", { name: dictionaries[mocks.lang].branchAddonRestriction.confirm })); }

describe("unmounted Branch DISABLED local confirmation", () => {
  it.each([["en", false], ["ar", false], ["en", true], ["ar", true]] as const)("reviews exact identity/revision in %s dark=%s without asserting eligibility", async (lang, dark) => {
    mocks.lang = lang; document.documentElement.classList.toggle("dark", dark); const t = dictionaries[lang], copy = t.branchAddonRestriction;
    const observed = fixture(), before = structuredClone(observed); mocks.read.mockResolvedValue(observed);
    render(<Harness />); await open(); const dialog = screen.getByRole("dialog", { name: copy.title });
    expect(dialog).toHaveAttribute("dir", directions[lang]); expect(dialog).toHaveAccessibleDescription(copy.notice);
    expect(screen.getByText(copy.provisional)).toBeInTheDocument(); expect(screen.getByText(id(2))).toBeInTheDocument();
    expect(screen.getByText(id(1))).toBeInTheDocument(); expect(screen.getByText("crm.logistics")).toBeInTheDocument();
    expect(screen.getByText("9007199254740993")).toBeInTheDocument(); expect(mocks.confirm).not.toHaveBeenCalled();
    const input = screen.getByRole("textbox", { name: copy.reason }); expect(input).toHaveAccessibleDescription(copy.reasonHint);
    expect(input).toHaveAttribute("maxlength", "500"); expect(input).toBeRequired(); reason(); confirm();
    await screen.findByText(copy.rereadNotice); expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith(observed, "Restrict this Branch");
    expect(observed).toEqual(before); expect(mocks.read).toHaveBeenCalledOnce();
    expect(screen.queryByText("INHERIT")).not.toBeInTheDocument(); expect(screen.queryByText("DISABLED")).not.toBeInTheDocument();
  });
  it.each(["applications.activation.read", "applications.activation.manage.all", "applications.configuration.manage", "applications.addon_seats.manage"])("does not substitute %s for exact management", async (permission) => {
    mocks.auth.user.permissions = [permission]; const view = render(<Harness />); await act(async () => undefined);
    expect(view.container).toBeEmptyDOMElement(); expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it("admits current owner only provisionally and retires review when ownership is removed", async () => {
    mocks.auth.user.permissions = []; mocks.auth.user.isTenantOwner = true; const view = render(<Harness />); await open();
    mocks.auth.user.isTenantOwner = false; view.rerender(<Harness />); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it("uses only the server-issued absent override revision zero, not a selected definition/configuration pin", async () => {
    const observed = fixture(null); mocks.read.mockResolvedValue(observed); render(<Harness />); await open();
    expect(screen.getByText("0")).toBeInTheDocument(); reason(); confirm();
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith(observed, "Restrict this Branch"));
  });
  it("shows observed DISABLED with no fresh-action or restoration affordance", async () => {
    mocks.read.mockResolvedValue(fixture("DISABLED")); render(<Harness />); await screen.findByText(en.branchAddonRestriction.alreadyDisabled);
    expect(screen.queryByRole("button")).not.toBeInTheDocument(); expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it.each(["", "ab", " leading", "trailing ", "x".repeat(501), "bad\u0001reason", "bad\u007freason"])("rejects invalid reason without fabricating or trimming it: %j", async (value) => {
    render(<Harness />); await open(); reason(value); confirm();
    const input = screen.getByRole("textbox", { name: en.branchAddonRestriction.reason });
    expect(input).toHaveAttribute("aria-invalid", "true"); expect(input).toHaveAccessibleDescription(en.branchAddonRestriction.reasonInvalid);
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it.each(["button", "escape"])("cancels with %s and restores focus without a callback", async (method) => {
    render(<Harness />); const trigger = await open(); reason();
    if (method === "button") fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    else fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument()); expect(trigger).toHaveFocus(); expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it("requires an accepted reread and a new explicit review after generic stale409", async () => {
    const updated = fixture("INHERIT", "9007199254740994"); let resolve!: (value: ReturnType<typeof fixture>) => void;
    mocks.read.mockResolvedValueOnce(fixture()).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    mocks.confirm.mockRejectedValueOnce(failure(409, "ADDON_REVISION_STALE")); render(<Harness />); await open(); reason(); confirm();
    await screen.findByText(en.branchAddonRestriction.stale); expect(screen.getByRole("button", { name: en.branchAddonRestriction.review })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: en.branchAddonRestriction.reread }));
    expect(screen.getByRole("button", { name: en.branchAddonRestriction.review })).toBeDisabled(); expect(mocks.confirm).toHaveBeenCalledOnce();
    await act(async () => resolve(updated)); await open(); expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByText("9007199254740994")).toBeInTheDocument(); expect(mocks.confirm).toHaveBeenCalledOnce();
    reason("A newly reviewed restriction"); confirm(); await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(2));
    expect(mocks.confirm.mock.calls[1]).toEqual([updated, "A newly reviewed restriction"]);
  });
  it("blocks duplicate callbacks and dismissal while the local handoff is pending", async () => {
    let resolve!: () => void; mocks.confirm.mockReturnValue(new Promise<void>((done) => { resolve = done; }));
    render(<Harness />); await open(); reason(); confirm(); confirm(); expect(mocks.confirm).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true"); expect(screen.getByRole("button", { name: en.common.cancel })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" }); expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => resolve()); await screen.findByText(en.branchAddonRestriction.rereadNotice);
  });
  it("suspends interactive review through same-session refresh without auto-confirming", async () => {
    const view = render(<Harness />); await open(); reason(); mocks.auth.authState = "REFRESHING"; view.rerender(<Harness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(screen.getByRole("button", { name: en.branchAddonRestriction.review })).toBeDisabled();
    mocks.auth.authState = "AUTHENTICATED"; view.rerender(<Harness />); expect(screen.getByRole("textbox")).toHaveValue("Restrict this Branch");
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it.each([401, 403, 404])("hides target details on actual read%s", async (status) => {
    mocks.read.mockRejectedValue(failure(status)); render(<Harness />); await screen.findByText(en.permissionGate.title);
    expect(screen.queryByRole("button")).not.toBeInTheDocument(); expect(screen.queryByText(id(2))).not.toBeInTheDocument();
  });
  it("keeps an unavailable503 read unavailable instead of treating it as absence revision zero", async () => {
    mocks.read.mockRejectedValue(failure(503)); render(<Harness />); await screen.findByText(en.branchAddonRestriction.unavailable);
    expect(screen.getByRole("button", { name: en.branchAddonRestriction.review })).toBeDisabled(); expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
  it("does not retry an unknown callback outcome or claim rollback/success", async () => {
    mocks.confirm.mockRejectedValue(failure(503)); render(<Harness />); await open(); reason(); confirm();
    await screen.findByText(en.branchAddonRestriction.uncertain); expect(screen.getByRole("button", { name: en.branchAddonRestriction.review })).toBeDisabled();
    expect(screen.queryByRole("button", { name: en.branchAddonRestriction.reread })).not.toBeInTheDocument(); expect(mocks.confirm).toHaveBeenCalledOnce();
  });
  it("retires a late callback rejection after switching to another Branch", async () => {
    let reject!: (error: unknown) => void; mocks.confirm.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    const view = render(<Harness />); await open(); reason(); confirm(); const next = fixture(); next.scope.branchId = id(20);
    mocks.read.mockResolvedValue(next); view.rerender(<Harness target={{ ...request, branchId: id(20) }} />);
    await act(async () => reject(failure(409, "ADDON_REVISION_STALE"))); await open();
    expect(screen.getByText(id(20))).toBeInTheDocument(); expect(screen.queryByText(en.branchAddonRestriction.stale)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue(""); expect(mocks.confirm).toHaveBeenCalledOnce();
  });
  it("retires a prior review across a new session before any callback", async () => {
    const view = render(<Harness />); await open(); reason(); mocks.auth.realtimeAuthGeneration = "session-2"; view.rerender(<Harness />);
    await open(); expect(screen.getByRole("textbox")).toHaveValue(""); expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it.each<ApplicationAccessRequest>([
    { kind: "ADDON_ACTIVATION", companyId: id(1), applicationKey: "crm", addonKey: "crm.logistics" },
    { kind: "BRANCH_CONFIGURATION", branchId: id(2), applicationKey: "crm", addonKey: "crm.logistics" },
  ])("never substitutes a $kind target for the Branch override", async (target) => {
    render(<Harness target={target} />); await screen.findByText(en.permissionGate.title);
    expect(screen.queryByRole("button")).not.toBeInTheDocument(); expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it.each(["branch", "application", "addon"])("rejects a substituted %s in the accepted-read composition", async (field) => {
    const other = fixture();
    if (field === "branch") other.scope.branchId = id(20);
    if (field === "application") other.target.applicationKey = "trade";
    if (field === "addon") other.target.addonKey = "crm.other";
    mocks.read.mockResolvedValue(other); render(<Harness />); await screen.findByText(en.permissionGate.title);
    expect(screen.queryByRole("button")).not.toBeInTheDocument(); expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it.each(["REFRESHING", "missing-generation"])("does not open provisional confirmation with %s authentication", async (condition) => {
    if (condition === "REFRESHING") mocks.auth.authState = "REFRESHING";
    else mocks.auth.realtimeAuthGeneration = null;
    render(<Harness />); await act(async () => undefined); const trigger = screen.getByRole("button", { name: en.branchAddonRestriction.review });
    expect(trigger).toBeDisabled(); fireEvent.click(trigger); expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it("hides a callback403 instead of treating it as an empty or applied restriction", async () => {
    mocks.confirm.mockRejectedValue(failure(403)); render(<Harness />); await open(); reason(); confirm(); await screen.findByText(en.permissionGate.title);
    expect(screen.queryByRole("button")).not.toBeInTheDocument(); expect(screen.queryByText(id(2))).not.toBeInTheDocument(); expect(mocks.confirm).toHaveBeenCalledOnce();
  });
});
