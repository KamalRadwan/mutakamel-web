// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast as sonnerToast } from "sonner";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { createAddonAssignmentOptionsFixture } from "../application-addon-assignment-options.fixture";
import { addonAssignmentCommandSchema } from "../application-addon-assignment-command";
import { captureAddonAssignmentDraft, retainAddonAssignmentIntent } from "../application-addon-assignment-intent";

const mocks = vi.hoisted(() => ({ lang: "en" as "en" | "ar", bootstrap: vi.fn(), auth: {
  user: { id: "018ef54e-2222-7777-8888-000000000090", permissions: ["applications.addon_seats.manage"], isTenantOwner: false },
  isAuthenticated: true, authState: "AUTHENTICATED", realtimeAuthGeneration: "session-1",
} }));
const dictionaries = { en, ar }, directions = { en: "ltr", ar: "rtl" };
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ ...mocks.auth, retryBootstrap: mocks.bootstrap }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[mocks.lang], lang: mocks.lang, dir: directions[mocks.lang] }) }));
vi.mock("@/i18n/useLanguage", async (original) => ({ ...await original<typeof import("@/i18n/useLanguage")>(), useLanguage: () => mocks.lang, useDictionary: () => dictionaries[mocks.lang] }));
const { AddonAssignmentCommand } = await import("./AddonAssignmentCommand");
const { AddonAssignmentRecovery } = await import("./AddonAssignmentRecovery");
const id = (n: number) => `018ef54e-2222-7777-8888-${String(n).padStart(12, "0")}`;
const row = () => createAddonAssignmentOptionsFixture().data[0];
function reply(kind: "ASSIGN_ADDON" | "UNASSIGN_ADDON" = "ASSIGN_ADDON", changed = true) {
  return { status: kind === "ASSIGN_ADDON" ? 201 : 200, statusText: "OK", headers: new Headers(),
    data: { success: true, correlationId: "request", timestamp: "2026-09-08T10:00:01.000Z", data: {  operationId: id(95),
      operationRevision: "1", state: "COMMITTED", operationKind: kind, changed, resourceId: id(5), resourceRevision: "4", completedAt: "2026-09-08T10:00:00.000Z" } } };
}
beforeEach(() => {
  vi.spyOn(sonnerToast, "custom").mockReturnValue(1);
  window.sessionStorage.clear(); mocks.lang = "en"; mocks.bootstrap.mockReset().mockResolvedValue(undefined);
  mocks.auth.user = { id: id(90), permissions: ["applications.addon_seats.manage"], isTenantOwner: false };
  mocks.auth.isAuthenticated = true; mocks.auth.authState = "AUTHENTICATED"; mocks.auth.realtimeAuthGeneration = "session-1";
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.documentElement.classList.remove("dark"); });

describe("real unmounted command components with validated transport", () => {
  it.each([["en", false], ["ar", false], ["en", true], ["ar", true]] as const)("confirms only after explicit review in %s, dark=%s", async (lang, dark) => {
    mocks.lang = lang; document.documentElement.classList.toggle("dark", dark); const t = dictionaries[lang], selected = row(), reload = vi.fn();
    const post = vi.spyOn(axiosClient, "post").mockResolvedValue(reply());
    render(<AddonAssignmentCommand userId={selected.userId} source={{ kind: "OPTION", row: selected }} onReload={reload} />);
    const trigger = screen.getByRole("button", { name: t.addonAssignmentCommand.assign }); await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.click(trigger); const dialog = screen.getByRole("dialog", { name: t.addonAssignmentCommand.assign });
    expect(dialog).toHaveAttribute("dir", directions[lang]); expect(screen.getByText(t.addonAssignmentCommand.assignNotice)).toBeInTheDocument();
    expect(screen.getByText(selected.userId)).toBeInTheDocument(); expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: t.addonAssignmentCommand.confirmAssign }));
    await waitFor(() => expect(screen.getByText(t.addonAssignmentCommand.assigned)).toBeInTheDocument());
    expect(reload).toHaveBeenCalledOnce(); expect(screen.getByText(t.addonAssignmentCommand.historical)).toBeInTheDocument();
    expect(sonnerToast.custom).toHaveBeenCalledOnce();
    expect(vi.mocked(sonnerToast.custom).mock.calls[0][0](1)).toMatchObject({ props: {
      title: t.addonAssignmentCommand.assigned, message: t.addonAssignmentCommand.historical,
    } });
    expect(screen.queryByText("COMMITTED")).not.toBeInTheDocument(); expect(window.sessionStorage.length).toBe(0);
  });
  it("cancel restores focus and sends no request", async () => {
    const selected = row(), post = vi.spyOn(axiosClient, "post");
    render(<AddonAssignmentCommand userId={selected.userId} source={{ kind: "OPTION", row: selected }} onReload={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: en.addonAssignmentCommand.assign }); await waitFor(() => expect(trigger).toBeEnabled());
    trigger.focus(); fireEvent.click(trigger); fireEvent.click(screen.getAllByRole("button", { name: en.common.close })[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus(); expect(post).not.toHaveBeenCalled(); expect(window.sessionStorage.length).toBe(0);
  });
  it("renders known no-change success without calling it a replay", async () => {
    const selected = row(); selected.targetActive = false; selected.assignment = { id: id(5), revision: "3" };
    vi.spyOn(axiosClient, "delete").mockResolvedValue(reply("UNASSIGN_ADDON", false));
    render(<AddonAssignmentCommand userId={selected.userId} source={{ kind: "OPTION", row: selected }} onReload={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: en.addonAssignmentCommand.remove }); await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.click(trigger); expect(screen.getByText(en.addonAssignmentCommand.removeNotice)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en.addonAssignmentCommand.confirmRemove }));
    await waitFor(() => expect(screen.getByText(en.addonAssignmentCommand.noChange)).toBeInTheDocument());
  });
  it("treats a malformed2xx as uncertain, retains the key and does not display a fake success", async () => {
    const selected = row(), malformed = reply(); Object.assign(malformed.data.data, { ready: true });
    const post = vi.spyOn(axiosClient, "post").mockResolvedValue(malformed);
    render(<AddonAssignmentCommand userId={selected.userId} source={{ kind: "OPTION", row: selected }} onReload={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: en.addonAssignmentCommand.assign }); await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.click(trigger); fireEvent.click(screen.getByRole("button", { name: en.addonAssignmentCommand.confirmAssign }));
    await waitFor(() => expect(screen.getByText(en.addonAssignmentCommand.uncertain)).toBeInTheDocument());
    expect(screen.queryByText(en.addonAssignmentCommand.assigned)).not.toBeInTheDocument(); expect(window.sessionStorage.length).toBe(1);
    post.mockResolvedValue(reply()); fireEvent.click(screen.getByRole("button", { name: en.addonAssignmentCommand.retryOriginal }));
    await waitFor(() => expect(screen.getByText(en.addonAssignmentCommand.assigned)).toBeInTheDocument());
    expect(post.mock.calls[1]).toEqual(post.mock.calls[0]);
  });
  it("hides the exact target and retained request after an authoritative denial", async () => {
    const selected = row(); vi.spyOn(axiosClient, "post").mockRejectedValue(new TenantApiClientError("private-message", {
      status: 403, statusText: "Forbidden", headers: new Headers(), data: { errorCode: "TENANT_MAINTENANCE_ACTIVE" },
    }));
    render(<AddonAssignmentCommand userId={selected.userId} source={{ kind: "OPTION", row: selected }} onReload={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: en.addonAssignmentCommand.assign }); await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.click(trigger); fireEvent.click(screen.getByRole("button", { name: en.addonAssignmentCommand.confirmAssign }));
    await waitFor(() => expect(screen.getByText(en.permissionGate.title)).toBeInTheDocument());
    expect(screen.queryByText(selected.userId)).not.toBeInTheDocument(); expect(screen.queryByText("private-message")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(window.sessionStorage.length).toBe(1);
  });
  it("recovers and removes the original retained assignment without any current server row", async () => {
    const selected = row(); selected.assignment = { id: id(5), revision: "3" };
    const original = addonAssignmentCommandSchema.parse({ ...captureAddonAssignmentDraft(selected.userId, { kind: "OPTION", row: selected }), idempotencyKey: id(99) });
    retainAddonAssignmentIntent({ actorId: mocks.auth.user.id, userId: selected.userId, addonSelectionId: selected.addonSelectionId }, original);
    const deletion = vi.spyOn(axiosClient, "delete").mockResolvedValue(reply("UNASSIGN_ADDON")), post = vi.spyOn(axiosClient, "post");
    render(<AddonAssignmentRecovery userId={selected.userId} onReload={vi.fn()} />);
    const trigger = await screen.findByRole("button", { name: en.addonAssignmentCommand.reviewOriginal });
    await waitFor(() => expect(trigger).toBeEnabled()); expect(deletion).not.toHaveBeenCalled(); fireEvent.click(trigger);
    expect(screen.getByText(id(5))).toBeInTheDocument(); expect(screen.getByText(selected.addonSelectionId)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en.addonAssignmentCommand.retryOriginal }));
    await waitFor(() => expect(screen.getByText(en.addonAssignmentCommand.removed)).toBeInTheDocument());
    expect(deletion.mock.calls[0][0]).toContain(`/addon-assignments/${id(5)}?expectedAssignmentRevision=3`); expect(post).not.toHaveBeenCalled();
  });
  it("never reveals another actor's recovery records or issues a request on session/target switches", async () => {
    const selected = row(), original = addonAssignmentCommandSchema.parse({ ...captureAddonAssignmentDraft(selected.userId, { kind: "OPTION", row: selected }), idempotencyKey: id(99) });
    retainAddonAssignmentIntent({ actorId: mocks.auth.user.id, userId: selected.userId, addonSelectionId: selected.addonSelectionId }, original);
    const post = vi.spyOn(axiosClient, "post"), view = render(<AddonAssignmentRecovery userId={selected.userId} onReload={vi.fn()} />);
    await screen.findByRole("button", { name: en.addonAssignmentCommand.reviewOriginal });
    mocks.auth.user.id = id(10); view.rerender(<AddonAssignmentRecovery userId={selected.userId} onReload={vi.fn()} />);
    await screen.findByText(en.addonAssignmentCommand.noRetained); expect(screen.queryByRole("button", { name: en.addonAssignmentCommand.reviewOriginal })).not.toBeInTheDocument();
    await act(async () => undefined); expect(post).not.toHaveBeenCalled();
  });
});
