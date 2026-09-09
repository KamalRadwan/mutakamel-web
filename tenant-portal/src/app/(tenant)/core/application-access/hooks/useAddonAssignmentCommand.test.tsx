// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast as sonnerToast } from "sonner";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { createAddonAssignmentOptionsFixture } from "../application-addon-assignment-options.fixture";
import { readAddonAssignmentIntent, type AddonAssignmentSource } from "../application-addon-assignment-intent";
import type { AddonAssignmentCommand, AddonAssignmentReceipt } from "../application-addon-assignment-command";

const mocks = vi.hoisted(() => ({ send: vi.fn(), bootstrap: vi.fn(), auth: {
  user: { id: "018ef54e-2222-7777-8888-000000000090", permissions: ["applications.addon_seats.manage"], isTenantOwner: false },
  isAuthenticated: true, realtimeAuthGeneration: "session-1" as string | null, authState: "AUTHENTICATED",
} }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ ...mocks.auth, retryBootstrap: mocks.bootstrap }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
vi.mock("../application-addon-assignment-command", async (original) => ({ ...await original<typeof import("../application-addon-assignment-command")>(), sendAddonAssignmentCommand: mocks.send }));
const { useAddonAssignmentCommand } = await import("./useAddonAssignmentCommand");
const id = (n: number) => `018ef54e-2222-7777-8888-${String(n).padStart(12, "0")}`;
const source = (): Extract<AddonAssignmentSource, { kind: "OPTION" }> => ({ kind: "OPTION", row: createAddonAssignmentOptionsFixture().data[0] });
function result(command: AddonAssignmentCommand, changed = true): AddonAssignmentReceipt {
  return {  operationId: id(95), operationRevision: "1", state: "COMMITTED", operationKind: command.operationKind,
    changed, resourceId: command.operationKind === "UNASSIGN_ADDON" ? command.assignmentId : id(5), resourceRevision: "4", completedAt: "2026-09-08T10:00:00.000Z" };
}
const failure = (status: number, errorCode?: string) => new TenantApiClientError("do not display raw message", { status, statusText: "Error", headers: new Headers(), data: { errorCode } });
function setup(selected: AddonAssignmentSource = source()) {
  const reload = vi.fn(), context = { actorId: mocks.auth.user.id, userId: selected.row.userId, addonSelectionId: selected.row.addonSelectionId };
  const hook = renderHook(({ target, item }) => useAddonAssignmentCommand(target, item, reload), { initialProps: { target: selected.row.userId, item: selected } });
  return { ...hook, reload, context, selected };
}
beforeEach(() => {
  vi.spyOn(sonnerToast, "custom").mockReturnValue(1);
  window.sessionStorage.clear(); mocks.send.mockReset().mockImplementation(async (command: AddonAssignmentCommand) => result(command));
  mocks.bootstrap.mockReset().mockResolvedValue(undefined);
  mocks.auth.user = { id: id(90), permissions: ["applications.addon_seats.manage"], isTenantOwner: false };
  mocks.auth.isAuthenticated = true; mocks.auth.realtimeAuthGeneration = "session-1"; mocks.auth.authState = "AUTHENTICATED";
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function open(hook: ReturnType<typeof setup>) {
  await waitFor(() => expect(hook.result.current.canOpen).toBe(true)); act(() => hook.result.current.open());
}

describe("prepared assignment command lifecycle", () => {
  it.each([true, false])("requires explicit confirmation, commits changed=%s and refreshes reads", async (changed) => {
    mocks.send.mockImplementation(async (command: AddonAssignmentCommand) => result(command, changed));
    const hook = setup(); await open(hook); expect(mocks.send).not.toHaveBeenCalled(); expect(window.sessionStorage.length).toBe(0);
    await act(async () => hook.result.current.confirm());
    expect(hook.result.current.state?.receipt?.changed).toBe(changed); expect(hook.reload).toHaveBeenCalledOnce();
    expect(readAddonAssignmentIntent(hook.context)).toBeNull(); expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(sonnerToast.custom).toHaveBeenCalledOnce();
    expect(vi.mocked(sonnerToast.custom).mock.calls[0][0](1)).toMatchObject({ props: {
      title: changed ? en.addonAssignmentCommand.assigned : en.addonAssignmentCommand.noChange, message: en.addonAssignmentCommand.historical,
    } });
    expect(vi.mocked(sonnerToast.custom).mock.invocationCallOrder[0]).toBeLessThan(hook.reload.mock.invocationCallOrder[0]);
  });
  it.each(["applications.addon_seats.read", "applications.activation.manage", "users.user.read"])("does not substitute %s for actual manage", async (permission) => {
    mocks.auth.user.permissions = [permission]; const hook = setup(); await act(async () => undefined);
    expect(hook.result.current.denied).toBe(true); act(() => hook.result.current.open()); await act(async () => hook.result.current.confirm());
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("admits the current owner without a profile grant, but not after loss of ownership", async () => {
    mocks.auth.user.permissions = []; mocks.auth.user.isTenantOwner = true;
    const hook = setup(); await open(hook); mocks.auth.user.isTenantOwner = false; hook.rerender({ target: hook.selected.row.userId, item: hook.selected });
    expect(hook.result.current.denied).toBe(true); await act(async () => hook.result.current.confirm()); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("blocks duplicate clicks synchronously and does not cancel an in-flight write by closing", async () => {
    let resolve!: (value: AddonAssignmentReceipt) => void;
    mocks.send.mockReturnValue(new Promise<AddonAssignmentReceipt>((done) => { resolve = done; }));
    const hook = setup(); await open(hook);
    act(() => { void hook.result.current.confirm(); void hook.result.current.confirm(); hook.result.current.close(); });
    expect(mocks.send).toHaveBeenCalledOnce(); expect(hook.result.current.state?.open).toBe(true);
    await act(async () => resolve(result(mocks.send.mock.calls[0][0]))); expect(hook.result.current.state?.phase).toBe("committed");
  });
  it.each([new Error("lost response"), failure(503), failure(409, "ADDON_OPERATION_UNCERTAIN")])("retains exact original command on uncertain outcome", async (error) => {
    mocks.send.mockRejectedValueOnce(error); const hook = setup(); await open(hook); await act(async () => hook.result.current.confirm());
    const original = mocks.send.mock.calls[0][0] as AddonAssignmentCommand;
    expect(hook.result.current.state?.phase).toBe("uncertain"); expect(readAddonAssignmentIntent(hook.context)).toEqual(original);
    expect(sonnerToast.custom).not.toHaveBeenCalled();
    await act(async () => hook.result.current.confirm()); expect(mocks.send.mock.calls[1][0]).toEqual(original);
    expect(hook.result.current.state?.phase).toBe("committed");
  });
  it("preserves the originally retained child/revisions when the option later has no assignment", async () => {
    const selected = source(); if (selected.kind === "OPTION") { selected.row.targetActive = false; selected.row.assignment = { id: id(5), revision: "3" }; }
    mocks.send.mockRejectedValueOnce(new Error("response lost")); const hook = setup(selected); await open(hook); await act(async () => hook.result.current.confirm());
    const original = mocks.send.mock.calls[0][0] as AddonAssignmentCommand, updated = source(); updated.row.allowanceRevision = "99";
    hook.rerender({ target: selected.row.userId, item: updated }); await act(async () => hook.result.current.confirm());
    expect(mocks.send.mock.calls[1][0]).toEqual(original); expect(original).toMatchObject({ operationKind: "UNASSIGN_ADDON", assignmentId: id(5), query: { expectedAssignmentRevision: "3" } });
  });
  it("retires stale successes after target change without clearing their original recovery evidence", async () => {
    let resolve!: (value: AddonAssignmentReceipt) => void;
    mocks.send.mockReturnValueOnce(new Promise<AddonAssignmentReceipt>((done) => { resolve = done; })); const hook = setup(); await open(hook);
    act(() => { void hook.result.current.confirm(); }); const original = mocks.send.mock.calls[0][0] as AddonAssignmentCommand;
    const next = source(); next.row.userId = id(10); hook.rerender({ target: next.row.userId, item: next });
    expect((mocks.send.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
    await act(async () => resolve(result(original))); expect(hook.result.current.state?.receipt).toBeNull(); expect(hook.reload).not.toHaveBeenCalled();
    expect(sonnerToast.custom).not.toHaveBeenCalled();
    expect(readAddonAssignmentIntent(hook.context)).toEqual(original);
  });
  it("ignores a late403 from a replaced actor and never reuses their retained intent", async () => {
    let reject!: (value: unknown) => void;
    mocks.send.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; })); const hook = setup(); await open(hook);
    act(() => { void hook.result.current.confirm(); }); mocks.auth.user.id = id(10); hook.rerender({ target: hook.selected.row.userId, item: hook.selected });
    await act(async () => reject(failure(403))); expect(hook.result.current.denied).toBe(false); expect(hook.result.current.state?.command).toBeNull();
    expect(readAddonAssignmentIntent(hook.context)).not.toBeNull();
  });
  it("restores only the same actor/target's original request across expiry and reauthentication without auto sending", async () => {
    mocks.send.mockRejectedValueOnce(failure(401, "AUTH_AUTHORIZATION_STALE")); const hook = setup(); await open(hook); await act(async () => hook.result.current.confirm());
    const original = mocks.send.mock.calls[0][0]; mocks.auth.isAuthenticated = false; mocks.auth.authState = "ENDED";
    hook.rerender({ target: hook.selected.row.userId, item: hook.selected }); expect(hook.result.current.state).toBeNull();
    hook.unmount(); mocks.auth.isAuthenticated = true; mocks.auth.authState = "AUTHENTICATED"; mocks.auth.realtimeAuthGeneration = "session-2";
    const recovered = setup(); await open(recovered); expect(mocks.send).toHaveBeenCalledOnce();
    await act(async () => recovered.result.current.confirm()); expect(mocks.send.mock.calls[1][0]).toEqual(original);
  });
  it("hides all context on actual403 while retaining a recoverable unknown original command", async () => {
    mocks.send.mockRejectedValueOnce(failure(403, "TENANT_MAINTENANCE_ACTIVE")); const hook = setup(); await open(hook); await act(async () => hook.result.current.confirm());
    expect(hook.result.current.denied).toBe(true); expect(readAddonAssignmentIntent(hook.context)).not.toBeNull();
    await act(async () => hook.result.current.confirm()); expect(mocks.send).toHaveBeenCalledOnce();
  });
  it("does not clear a receipt or claim rollback when refresh fails after a confirmed self mutation", async () => {
    const selected = source(); mocks.auth.user.id = selected.row.userId; mocks.bootstrap.mockRejectedValue(new Error("refresh failed"));
    const hook = setup(selected); await open(hook); await act(async () => hook.result.current.confirm());
    expect(hook.result.current.state).toMatchObject({ phase: "committed", refreshFailed: true });
    expect(hook.result.current.state?.receipt).not.toBeNull(); expect(readAddonAssignmentIntent(hook.context)).toBeNull();
  });
  it("allows explicit fresh review only after a first definite pre-commit stale-CAS rejection", async () => {
    mocks.send.mockRejectedValueOnce(failure(409, "ADDON_ASSIGNMENT_REVISION_STALE")); const hook = setup(); await open(hook); await act(async () => hook.result.current.confirm());
    const original = mocks.send.mock.calls[0][0]; expect(hook.result.current.state?.phase).toBe("rejected"); expect(readAddonAssignmentIntent(hook.context)).toBeNull();
    await act(async () => hook.result.current.recheck()); expect(hook.result.current.canOpen).toBe(false);
    const refreshed = source(); refreshed.row.allowanceRevision = "22"; hook.rerender({ target: refreshed.row.userId, item: refreshed });
    await open(hook); await act(async () => hook.result.current.confirm());
    expect(mocks.send.mock.calls[1][0].idempotencyKey).not.toBe(original.idempotencyKey);
    expect(mocks.send.mock.calls[1][0].body.expectedAllowanceRevision).toBe("22");
  });
  it("never treats the same stale rejection after a prior uncertain attempt as a resolved first rejection", async () => {
    mocks.send.mockRejectedValueOnce(new Error("lost response")).mockRejectedValueOnce(failure(409, "ADDON_ASSIGNMENT_REVISION_STALE"));
    const hook = setup(); await open(hook); await act(async () => hook.result.current.confirm()); await act(async () => hook.result.current.confirm());
    expect(hook.result.current.state?.phase).toBe("uncertain"); expect(readAddonAssignmentIntent(hook.context)).toEqual(mocks.send.mock.calls[0][0]);
    expect(mocks.send.mock.calls[1][0]).toEqual(mocks.send.mock.calls[0][0]);
  });
  it("refuses a new send when the actual browser cannot persist the original intent", async () => {
    const hook = setup(); await open(hook); vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Quota", "QuotaExceededError"); });
    await act(async () => hook.result.current.confirm()); expect(mocks.send).not.toHaveBeenCalled(); expect(hook.result.current.state?.phase).toBe("storage");
  });
  it("preserves terminal success during same-session refresh without admitting another open or send", async () => {
    let resolve!: (value: AddonAssignmentReceipt) => void;
    mocks.send.mockReturnValueOnce(new Promise<AddonAssignmentReceipt>((done) => { resolve = done; }));
    const hook = setup(); await open(hook); act(() => { void hook.result.current.confirm(); });
    const original = mocks.send.mock.calls[0][0] as AddonAssignmentCommand, signal = mocks.send.mock.calls[0][1] as AbortSignal;
    mocks.auth.authState = "REFRESHING"; hook.rerender({ target: hook.selected.row.userId, item: hook.selected });
    expect(hook.result.current.state).toBeNull(); expect(signal.aborted).toBe(false); expect(readAddonAssignmentIntent(hook.context)).toEqual(original);
    const committed = result(original); await act(async () => resolve(committed));
    expect(mocks.auth.authState).toBe("REFRESHING"); expect(hook.result.current.state).toBeNull();
    expect(hook.result.current.ready).toBe(false); expect(hook.result.current.canOpen).toBe(false);
    expect(sonnerToast.custom).toHaveBeenCalledOnce();
    expect(vi.mocked(sonnerToast.custom).mock.calls[0][0](1)).toMatchObject({ props: {
      title: en.addonAssignmentCommand.assigned, message: en.addonAssignmentCommand.historical,
    } });
    act(() => hook.result.current.open()); await act(async () => hook.result.current.confirm());
    expect(mocks.send).toHaveBeenCalledOnce(); expect(hook.reload).toHaveBeenCalledOnce(); expect(readAddonAssignmentIntent(hook.context)).toBeNull();
    mocks.auth.authState = "AUTHENTICATED"; hook.rerender({ target: hook.selected.row.userId, item: hook.selected });
    expect(hook.result.current.state).toMatchObject({ phase: "committed", open: false });
    expect(hook.result.current.state?.receipt).toBe(committed); expect(sonnerToast.custom).toHaveBeenCalledOnce(); expect(mocks.send).toHaveBeenCalledOnce();
  });
  it("does not show a late successful command in a replaced session, even after returning to its target", async () => {
    let resolve!: (value: AddonAssignmentReceipt) => void;
    mocks.send.mockReturnValueOnce(new Promise<AddonAssignmentReceipt>((done) => { resolve = done; }));
    const hook = setup(); await open(hook); act(() => { void hook.result.current.confirm(); });
    const original = mocks.send.mock.calls[0][0] as AddonAssignmentCommand;
    mocks.auth.realtimeAuthGeneration = "session-2"; hook.rerender({ target: hook.selected.row.userId, item: hook.selected });
    await act(async () => resolve(result(original))); expect(hook.result.current.state?.receipt).toBeNull();
    expect(sonnerToast.custom).not.toHaveBeenCalled();
    expect(hook.result.current.state?.phase).toBe("uncertain"); expect(readAddonAssignmentIntent(hook.context)).toEqual(original);
  });
  it("aborts UI ownership on unmount but preserves the original command after a late failed send", async () => {
    let reject!: (value: unknown) => void;
    mocks.send.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    const hook = setup(); await open(hook); act(() => { void hook.result.current.confirm(); });
    const original = mocks.send.mock.calls[0][0]; hook.unmount(); expect((mocks.send.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
    await act(async () => reject(new Error("lost response"))); expect(readAddonAssignmentIntent(hook.context)).toEqual(original); expect(hook.reload).not.toHaveBeenCalled();
  });
  it("cannot submit a row belonging to another user or an unverified session", async () => {
    const hook = setup(); await open(hook); hook.rerender({ target: id(10), item: hook.selected });
    expect(hook.result.current.denied).toBe(true); await act(async () => hook.result.current.confirm()); expect(mocks.send).not.toHaveBeenCalled();
    mocks.auth.realtimeAuthGeneration = null; hook.rerender({ target: hook.selected.row.userId, item: hook.selected });
    expect(hook.result.current.ready).toBe(false); expect(hook.result.current.canOpen).toBe(false);
  });
});
