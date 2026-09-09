// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast as sonnerToast } from "sonner";
import { useEffect } from "react";
import { Button } from "@/design-system";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { en } from "@/i18n/dictionaries/en";
import { createAddonAssignmentOptionsFixture } from "../application-addon-assignment-options.fixture";
import { createAddonAssignmentsFixture } from "../application-addon-assignments.fixture";
import { addonAssignmentCommandSchema } from "../application-addon-assignment-command";
import { captureAddonAssignmentDraft, readAddonAssignmentIntent, retainAddonAssignmentIntent } from "../application-addon-assignment-intent";
import { useAddonAssignmentOptions } from "../hooks/useAddonAssignmentOptions";
import { useAddonAssignments } from "../hooks/useAddonAssignments";
import { AddonSeatCommandPanel } from "./AddonSeatCommandPanel";

const mocks = vi.hoisted(() => ({ bootstrap: vi.fn(), auth: { user: {
  id: "018ef54e-2222-7777-8888-000000000090", permissions: ["applications.addon_seats.manage"], isTenantOwner: false,
}, isAuthenticated: true, authState: "AUTHENTICATED", realtimeAuthGeneration: "session-1" } }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ ...mocks.auth, retryBootstrap: mocks.bootstrap }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
vi.mock("@/i18n/useLanguage", async (original) => ({ ...await original<typeof import("@/i18n/useLanguage")>(), useLanguage: () => "en", useDictionary: () => en }));
const id = (n: number) => `018ef54e-2222-7777-8888-${String(n).padStart(12, "0")}`;
const headers = new Headers();
const target = createAddonAssignmentOptionsFixture().data[0].userId;
const http = (data: unknown, status = 200) => ({ status, statusText: "OK", headers, data });
const failure = (status: number) => new TenantApiClientError("not for display", { status, statusText: "Denied", headers, data: {} });
function OptionsHarness({ userId = target, displayUserId = userId, observeReload }: { userId?: string; displayUserId?: string; observeReload?: (reload: () => void) => void }) {
  const read = useAddonAssignmentOptions(userId);
  useEffect(() => { observeReload?.(read.reload); }, [observeReload, read.reload]);
  return <><Button onClick={read.reload}>Reload observed options</Button><span data-testid="observed">{read.data?.items.length ?? "waiting"}</span>
    <AddonSeatCommandPanel userId={displayUserId} kind="OPTIONS" read={read} /></>;
}
function AssignmentsHarness() {
  const read = useAddonAssignments(target);
  return <AddonSeatCommandPanel userId={target} kind="ASSIGNMENTS" read={read} />;
}
function emptyOptions() {
  const body = createAddonAssignmentOptionsFixture(); body.data = [];
  Object.assign(body.meta, { total: 0, totalPages: 0 }); return body;
}
function receipt(kind: "ASSIGN_ADDON" | "UNASSIGN_ADDON" = "ASSIGN_ADDON") {
  return http({ success: true, correlationId: "test", timestamp: "2026-09-08T10:00:01.000Z", data: {
     operationId: id(95), operationRevision: "1", state: "COMMITTED", operationKind: kind, changed: true,
    resourceId: id(5), resourceRevision: "4", completedAt: "2026-09-08T10:00:00.000Z",
  } }, kind === "ASSIGN_ADDON" ? 201 : 200);
}
function retainRemoval() {
  const row = createAddonAssignmentOptionsFixture().data[0]; row.assignment = { id: id(5), revision: "3" };
  const command = addonAssignmentCommandSchema.parse({ ...captureAddonAssignmentDraft(target, { kind: "OPTION", row }), idempotencyKey: id(99) });
  const context = { actorId: mocks.auth.user.id, userId: target, addonSelectionId: row.addonSelectionId };
  retainAddonAssignmentIntent(context, command); return { context, command };
}
beforeEach(() => {
  vi.spyOn(sonnerToast, "custom").mockReturnValue(1);
  window.sessionStorage.clear(); mocks.auth.user = { id: id(90), permissions: ["applications.addon_seats.manage"], isTenantOwner: false };
  mocks.auth.isAuthenticated = true; mocks.auth.authState = "AUTHENTICATED"; mocks.auth.realtimeAuthGeneration = "session-1";
  mocks.bootstrap.mockReset().mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function open(name = en.addonAssignmentCommand.assign) {
  const button = await screen.findByRole("button", { name }); await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
}

describe("unmounted command composition over the real accepted read hooks", () => {
  it("keeps genuine view-only reads intact and mounts no write or local recovery action", async () => {
    mocks.auth.user.permissions = ["applications.addon_seats.read"]; retainRemoval();
    const get = vi.spyOn(axiosClient, "get").mockResolvedValue(http(createAddonAssignmentOptionsFixture())), post = vi.spyOn(axiosClient, "post"), deletion = vi.spyOn(axiosClient, "delete");
    render(<OptionsHarness />); await waitFor(() => expect(screen.getByTestId("observed")).toHaveTextContent("1"));
    expect(get).toHaveBeenCalledOnce(); expect(screen.queryByRole("region", { name: en.addonAssignmentCommand.manageTitle })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.addonAssignmentCommand.reviewOriginal })).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled(); expect(deletion).not.toHaveBeenCalled();
  });
  it.each([false, true])("composes management for exact manage/current owner=%s with no duplicate read", async (owner) => {
    if (owner) { mocks.auth.user.permissions = []; mocks.auth.user.isTenantOwner = true; }
    const get = vi.spyOn(axiosClient, "get").mockResolvedValue(http(createAddonAssignmentOptionsFixture())), post = vi.spyOn(axiosClient, "post").mockResolvedValue(receipt());
    render(<OptionsHarness />); await open(); expect(get).toHaveBeenCalledOnce(); expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: en.addonAssignmentCommand.confirmAssign }));
    await waitFor(() => expect(post).toHaveBeenCalledOnce()); await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[0][1]).toMatchObject({ expectedAllowanceRevision: createAddonAssignmentOptionsFixture().data[0].allowanceRevision });
  });
  it("uses the accepted live assignment list's original child/CAS for removal without an options fetch", async () => {
    const body = createAddonAssignmentsFixture(); body.data[0].assignmentId = id(5);
    const get = vi.spyOn(axiosClient, "get").mockResolvedValue(http(body)), deletion = vi.spyOn(axiosClient, "delete").mockResolvedValue(receipt("UNASSIGN_ADDON"));
    render(<AssignmentsHarness />); await open(en.addonAssignmentCommand.remove);
    fireEvent.click(screen.getByRole("button", { name: en.addonAssignmentCommand.confirmRemove })); await waitFor(() => expect(deletion).toHaveBeenCalledOnce());
    expect(deletion.mock.calls[0][0]).toContain(`/${id(5)}?expectedAssignmentRevision=9007199254740993&expectedAllowanceRevision=4`);
    expect(get.mock.calls.every(([path]) => String(path).includes("/addon-assignments?"))).toBe(true);
  });
  it("confirms the original committed command even when reloading removes its row", async () => {
    const get = vi.spyOn(axiosClient, "get").mockResolvedValueOnce(http(createAddonAssignmentOptionsFixture())).mockResolvedValue(http(emptyOptions()));
    vi.spyOn(axiosClient, "post").mockResolvedValue(receipt()); render(<OptionsHarness />); await open();
    fireEvent.click(screen.getByRole("button", { name: en.addonAssignmentCommand.confirmAssign }));
    await waitFor(() => expect(screen.getByTestId("observed")).toHaveTextContent("0")); expect(get).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(en.addonAssignmentCommand.assigned)).not.toBeInTheDocument();
    expect(sonnerToast.custom).toHaveBeenCalledOnce();
    expect(vi.mocked(sonnerToast.custom).mock.calls[0][0](1)).toMatchObject({ props: {
      title: en.addonAssignmentCommand.assigned, message: en.addonAssignmentCommand.historical,
    } });
  });
  it("retires an open old-selection form during refresh and never submits its unconfirmed inputs", async () => {
    const first = createAddonAssignmentOptionsFixture(), second = createAddonAssignmentOptionsFixture(); second.data[0].addonSelectionId = id(25); second.data[0].allowanceRevision = "22";
    let resolve!: (value: ReturnType<typeof http>) => void;
    vi.spyOn(axiosClient, "get").mockResolvedValueOnce(http(first)).mockReturnValueOnce(new Promise((done) => { resolve = done; })).mockResolvedValue(http(second));
    let reloadObserved: () => void = () => undefined;
    const post = vi.spyOn(axiosClient, "post").mockResolvedValue(receipt()); render(<OptionsHarness observeReload={(reload) => { reloadObserved = reload; }} />); await open();
    // Simulate external read invalidation; the real modal correctly hides background controls.
    act(() => reloadObserved());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(post).not.toHaveBeenCalled(); expect(window.sessionStorage.length).toBe(0);
    await act(async () => resolve(http(second))); await open(); fireEvent.click(screen.getByRole("button", { name: en.addonAssignmentCommand.confirmAssign }));
    await waitFor(() => expect(post).toHaveBeenCalledOnce()); expect(post.mock.calls[0][1]).toMatchObject({ addonSelectionId: id(25), expectedAllowanceRevision: "22" });
  });
  it("cannot bind an old empty response to a different exact target", async () => {
    vi.spyOn(axiosClient, "get").mockResolvedValue(http(emptyOptions())); const post = vi.spyOn(axiosClient, "post");
    render(<OptionsHarness displayUserId={id(10)} />); await waitFor(() => expect(screen.getByTestId("observed")).toHaveTextContent("0"));
    expect(screen.getByText(en.permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: en.addonAssignmentCommand.recoveryTitle })).not.toBeInTheDocument(); expect(post).not.toHaveBeenCalled();
  });
  it("recovers a pending retired selection and ignores its late success after the accepted read changes", async () => {
    const first = createAddonAssignmentOptionsFixture(), second = createAddonAssignmentOptionsFixture(); second.data[0].addonSelectionId = id(25);
    vi.spyOn(axiosClient, "get").mockResolvedValueOnce(http(first)).mockResolvedValue(http(second));
    let resolve!: (value: ReturnType<typeof receipt>) => void, reloadObserved: () => void = () => undefined;
    const post = vi.spyOn(axiosClient, "post").mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    render(<OptionsHarness observeReload={(reload) => { reloadObserved = reload; }} />); await open();
    fireEvent.click(screen.getByRole("button", { name: en.addonAssignmentCommand.confirmAssign }));
    const originalKey = (post.mock.calls[0][2]?.headers as Record<string, string>)["x-idempotency-key"];
    act(() => reloadObserved()); expect((post.mock.calls[0][2]?.signal as AbortSignal).aborted).toBe(true);
    await screen.findByRole("button", { name: en.addonAssignmentCommand.reviewOriginal });
    await act(async () => resolve(receipt())); expect(screen.queryByText(en.addonAssignmentCommand.assigned)).not.toBeInTheDocument();
    expect(sonnerToast.custom).not.toHaveBeenCalled();
    await open(en.addonAssignmentCommand.reviewOriginal); expect(screen.getByText(originalKey)).toBeInTheDocument();
    expect(screen.getByText(first.data[0].addonSelectionId)).toBeInTheDocument(); expect(post).toHaveBeenCalledOnce();
  });
  it.each([401, 403, 404])("hides inaccessible target recovery on actual read%s without discarding the original intent", async (status) => {
    const original = retainRemoval(); vi.spyOn(axiosClient, "get").mockRejectedValue(failure(status)); const deletion = vi.spyOn(axiosClient, "delete");
    render(<OptionsHarness />); await screen.findByText(en.permissionGate.title);
    expect(screen.queryByRole("button", { name: en.addonAssignmentCommand.reviewOriginal })).not.toBeInTheDocument();
    expect(readAddonAssignmentIntent(original.context)).toEqual(original.command); expect(deletion).not.toHaveBeenCalled();
  });
  it("restores exact-user recovery after access returns, even when the accepted current list is empty", async () => {
    const original = retainRemoval(); vi.spyOn(axiosClient, "get").mockRejectedValueOnce(failure(403)).mockResolvedValue(http(emptyOptions()));
    const deletion = vi.spyOn(axiosClient, "delete").mockResolvedValue(receipt("UNASSIGN_ADDON")); render(<OptionsHarness />);
    await screen.findByText(en.permissionGate.title); fireEvent.click(screen.getByRole("button", { name: "Reload observed options" }));
    await waitFor(() => expect(screen.getByTestId("observed")).toHaveTextContent("0")); await open(en.addonAssignmentCommand.reviewOriginal);
    expect(deletion).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: en.addonAssignmentCommand.retryOriginal }));
    await waitFor(() => expect(screen.getByText(en.addonAssignmentCommand.removed)).toBeInTheDocument());
    expect(deletion.mock.calls[0][1]?.headers).toMatchObject({ "x-idempotency-key": original.command.idempotencyKey });
  });
  it("keeps local recovery separate from a transient503 read and never turns it into positive source eligibility", async () => {
    retainRemoval(); vi.spyOn(axiosClient, "get").mockRejectedValue(failure(503)); const post = vi.spyOn(axiosClient, "post");
    render(<OptionsHarness />); await screen.findByRole("button", { name: en.addonAssignmentCommand.reviewOriginal });
    expect(screen.getByText(en.addonAssignmentCommand.refreshInputs)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.addonAssignmentCommand.assign })).not.toBeInTheDocument(); expect(post).not.toHaveBeenCalled();
  });
  it("keeps a self-assignment owner alive through temporary same-session refresh, then refreshes session/read state", async () => {
    mocks.auth.user.id = target; const body = createAddonAssignmentOptionsFixture();
    vi.spyOn(axiosClient, "get").mockResolvedValue(http(body)); let resolve!: (value: ReturnType<typeof receipt>) => void;
    const post = vi.spyOn(axiosClient, "post").mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = render(<OptionsHarness />); await open(); fireEvent.click(screen.getByRole("button", { name: en.addonAssignmentCommand.confirmAssign }));
    const signal = post.mock.calls[0][2]?.signal as AbortSignal; mocks.auth.authState = "REFRESHING"; view.rerender(<OptionsHarness />);
    expect(signal.aborted).toBe(false); expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(window.sessionStorage.length).toBe(1);
    mocks.auth.authState = "AUTHENTICATED"; view.rerender(<OptionsHarness />); await act(async () => resolve(receipt()));
    expect(mocks.bootstrap).toHaveBeenCalledOnce(); expect(post).toHaveBeenCalledOnce(); expect(window.sessionStorage.length).toBe(0);
  });
  it("does not unmount/abort a retained self-removal replay merely because its current token is refreshing", async () => {
    mocks.auth.user.id = target; const original = retainRemoval(); vi.spyOn(axiosClient, "get").mockResolvedValue(http(emptyOptions()));
    let resolve!: (value: ReturnType<typeof receipt>) => void;
    const deletion = vi.spyOn(axiosClient, "delete").mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = render(<OptionsHarness />); await open(en.addonAssignmentCommand.reviewOriginal);
    fireEvent.click(screen.getByRole("button", { name: en.addonAssignmentCommand.retryOriginal })); const signal = deletion.mock.calls[0][1]?.signal as AbortSignal;
    mocks.auth.authState = "REFRESHING"; view.rerender(<OptionsHarness />); expect(signal.aborted).toBe(false);
    expect(readAddonAssignmentIntent(original.context)).toEqual(original.command); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    mocks.auth.authState = "AUTHENTICATED"; view.rerender(<OptionsHarness />); await act(async () => resolve(receipt("UNASSIGN_ADDON")));
    expect(deletion).toHaveBeenCalledOnce(); expect(mocks.bootstrap).toHaveBeenCalledOnce(); expect(readAddonAssignmentIntent(original.context)).toBeNull();
  });
});
