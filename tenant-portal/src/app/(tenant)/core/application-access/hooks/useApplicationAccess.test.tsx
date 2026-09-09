// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { ApplicationAccessRequest, ApplicationAccessView } from "../application-access-contract";
import { TenantApiClientError } from "@/lib/api/axiosClient";

const auth = vi.hoisted(() => ({
  user: { id: "actor", permissions: ["applications.activation.read"], isTenantOwner: false },
  isAuthenticated: true, realtimeAuthGeneration: "session-1",
}));
const read = vi.hoisted(() => vi.fn());
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../application-access-api", () => ({ readApplicationAccess: read }));
const { useApplicationAccess } = await import("./useApplicationAccess");
const request: ApplicationAccessRequest = {
  kind: "APPLICATION_ACTIVATION", companyId: "018ef54e-2222-7777-8888-000000000001", applicationKey: "crm",
};
// Only hook identity is exercised here; full hostile wire shapes have separate contract tests.
const view = { operationalUse: "NOT_EVALUATED" } as ApplicationAccessView;

beforeEach(() => {
  auth.user = { id: "actor", permissions: ["applications.activation.read"], isTenantOwner: false };
  auth.isAuthenticated = true;
  auth.realtimeAuthGeneration = "session-1";
  read.mockReset().mockResolvedValue(view);
});
afterEach(cleanup);

describe("scoped read lifecycle", () => {
  it.each(["applications.activation.read", "applications.activation.manage"])("honors explicit ANY %s", async (permission) => {
    auth.user.permissions = [permission];
    const { result } = renderHook(() => useApplicationAccess(request));
    await waitFor(() => expect(result.current.view).toBe(view));
    expect(result.current.denied).toBe(false);
  });
  it.each(["applications.activation.read.all", "org.company.read", "applications.configuration.manage"])("does not substitute %s", (permission) => {
    auth.user.permissions = [permission];
    const { result } = renderHook(() => useApplicationAccess(request));
    expect(result.current.denied).toBe(true);
    expect(read).not.toHaveBeenCalled();
  });
  it("admits an authenticated owner administratively without asserting usable access", async () => {
    auth.user.permissions = [];
    auth.user.isTenantOwner = true;
    const { result } = renderHook(() => useApplicationAccess(request));
    await waitFor(() => expect(result.current.view?.operationalUse).toBe("NOT_EVALUATED"));
  });
  it("uses the independent configuration pair", async () => {
    auth.user.permissions = ["applications.configuration.manage"];
    const configuration: ApplicationAccessRequest = { ...request, kind: "COMPANY_CONFIGURATION", addonKey: "crm.logistics" };
    const { result } = renderHook(() => useApplicationAccess(configuration));
    await waitFor(() => expect(result.current.view).toBe(view));
  });
  it("renders an actual403 as denial, never absence", async () => {
    read.mockRejectedValue(new TenantApiClientError("denied", { status: 403, statusText: "Forbidden", headers: new Headers(), data: {} }));
    const { result } = renderHook(() => useApplicationAccess(request));
    await waitFor(() => expect(result.current.denied).toBe(true));
    expect(result.current.view).toBeNull();
    expect(result.current.error?.status).toBe(403);
  });
  it("clears old scope immediately and ignores its late completion", async () => {
    let resolveOld: (value: ApplicationAccessView) => void = () => undefined;
    read.mockImplementationOnce(() => new Promise<ApplicationAccessView>((resolve) => { resolveOld = resolve; }));
    const { result, rerender } = renderHook(({ target }) => useApplicationAccess(target), { initialProps: { target: request } });
    const firstSignal = read.mock.calls[0][1] as AbortSignal;
    const next = { ...request, applicationKey: "trade" };
    rerender({ target: next });
    expect(firstSignal.aborted).toBe(true);
    await waitFor(() => expect(result.current.view).toBe(view));
    await act(async () => resolveOld({ ...view }));
    expect(result.current.view).toBe(view);
  });
  it("hides a completed view on session change until the new read completes", async () => {
    const { result, rerender } = renderHook(() => useApplicationAccess(request));
    await waitFor(() => expect(result.current.view).toBe(view));
    read.mockImplementationOnce(() => new Promise(() => undefined));
    auth.realtimeAuthGeneration = "session-2";
    rerender();
    expect(result.current.view).toBeNull();
    expect(result.current.loading).toBe(true);
  });
  it("permanently retires A before B so returning to A cannot revive its old confirmation snapshot", async () => {
    const { result, rerender } = renderHook(({ target }) => useApplicationAccess(target), { initialProps: { target: request } });
    await waitFor(() => expect(result.current.view).toBe(view));
    const originalKey = result.current.snapshotKey; expect(result.current.requestedKey).toBe(JSON.stringify(request));
    read.mockImplementation(() => new Promise(() => undefined));
    rerender({ target: { ...request, applicationKey: "trade" } }); rerender({ target: request });
    expect(result.current.view).toBeNull(); expect(result.current.snapshotKey).toBeNull();
    expect(result.current.loading).toBe(true); expect(originalKey).not.toBeNull();
  });
  it("hides facts after permission removal or logout", async () => {
    const { result, rerender } = renderHook(() => useApplicationAccess(request));
    await waitFor(() => expect(result.current.view).toBe(view));
    auth.user.permissions = [];
    rerender();
    expect(result.current.view).toBeNull();
    expect(result.current.denied).toBe(true);
    auth.user.isTenantOwner = true;
    auth.isAuthenticated = false;
    rerender();
    expect(result.current.denied).toBe(true);
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("explicit refresh discards prior facts and aborts on unmount", async () => {
    const { result, unmount } = renderHook(() => useApplicationAccess(request));
    await waitFor(() => expect(result.current.view).toBe(view));
    read.mockImplementationOnce(() => new Promise(() => undefined));
    act(() => result.current.reload());
    expect(result.current.view).toBeNull();
    expect(result.current.loading).toBe(true);
    const lastSignal = read.mock.calls[1][1] as AbortSignal;
    unmount();
    expect(lastSignal.aborted).toBe(true);
  });
});
