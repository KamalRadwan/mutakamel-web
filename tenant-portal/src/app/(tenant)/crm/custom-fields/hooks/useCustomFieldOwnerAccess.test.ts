// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CrmRecordSourceType } from "@/hooks/useCrmRecordOptions";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useCustomFieldOwnerAccess } from "./useCustomFieldOwnerAccess";

const { get, scope, auth } = vi.hoisted(() => ({ get: vi.fn(), scope: vi.fn(), auth: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth() as unknown }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get } };
});
vi.mock("@/hooks/useOrganizationScope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useOrganizationScope")>();
  return { ...actual, useOrganizationScopeHeaders: () => scope() as unknown };
});

const BRANCH = "0192f3a0-0000-7000-8000-000000000001";
const OTHER_BRANCH = "0192f3a0-0000-7000-8000-000000000002";
const OWNER = "0192f3a0-0000-7000-8000-0000000000aa";
const OTHER_OWNER = "0192f3a0-0000-7000-8000-0000000000bb";
const USER = "0192f3a0-0000-7000-8000-0000000000cc";
const OTHER_USER = "0192f3a0-0000-7000-8000-0000000000dd";
const HEADERS = { "x-mutakamel-branch-id": BRANCH, "x-mutakamel-company-id": OTHER_BRANCH };
const READY = { ready: true, headers: HEADERS, gap: null };
const AUTH = { user: { id: USER }, authState: "AUTHENTICATED", realtimeAuthGeneration: "session-a" };
const INPUT = { ownerType: "LEAD" as CrmRecordSourceType, branchId: BRANCH, ownerId: OWNER, enabled: true };

function capabilities(update: unknown = { scope: "all", ownerUserIds: null }, group = "leads", branchId = BRANCH) {
  return { data: { branchId, [group]: { update } } };
}
function owner(change: Record<string, unknown> = {}) {
  return { data: { id: OWNER, branchId: BRANCH, ownerUserId: USER, status: "OPEN", ...change } };
}
function respond(capability = capabilities(), detail = owner()) {
  get.mockImplementation((url: string) => Promise.resolve(url.includes("/capabilities?") ? capability : detail));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => { auth.mockReturnValue(AUTH); scope.mockReturnValue(READY); respond(); });
afterEach(() => { cleanup(); get.mockReset(); scope.mockReset(); auth.mockReset(); });

describe("custom-field owner action admission", () => {
  it.each([
    ["LEAD", "leads", "leads"],
    ["CUSTOMER_PROFILE", "customer-profiles", "customerProfiles"],
    ["OPPORTUNITY", "opportunities", "opportunities"],
  ] as const)("uses the owning %s capability and detail with scope headers", async (ownerType, path, group) => {
    respond(capabilities(undefined, group));
    const { result } = renderHook(() => useCustomFieldOwnerAccess({ ...INPUT, ownerType }));
    expect(result.current.canEdit).toBe(false);
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    expect(get).toHaveBeenCalledWith(`/api/tenant/crm/v1/${path}/capabilities?branchId=${BRANCH}`,
      expect.objectContaining({ headers: HEADERS, cache: "no-store", signal: expect.any(AbortSignal) }));
    expect(get).toHaveBeenCalledWith(`/api/tenant/crm/v1/${path}/${OWNER}`,
      expect.objectContaining({ headers: HEADERS, cache: "no-store" }));
    expect(result.current.error).toBeNull();
  });

  it.each([
    { enabled: false }, { ownerId: undefined }, { branchId: null }, { ownerId: "bad" }, { branchId: "bad" },
  ])("does not load without a valid enabled selection: %j", async (change) => {
    const { result } = renderHook(() => useCustomFieldOwnerAccess({ ...INPUT, ...change }));
    await act(async () => { await Promise.resolve(); });
    expect(get).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ canEdit: false, isLoading: false, error: null });
  });

  it("does not send an unresolved organization scope", async () => {
    scope.mockReturnValue({ ready: false, headers: null, gap: "company-required" });
    const { result } = renderHook(() => useCustomFieldOwnerAccess(INPUT));
    await act(async () => { await Promise.resolve(); });
    expect(get).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ canEdit: false, isLoading: false,
      error: { status: 0, code: "CRM_ORGANIZATION_SCOPE_UNRESOLVED" } });
  });

  it.each([
    ["own", USER, true], ["team", USER, true], ["own", OTHER_USER, false], ["team", null, false],
  ] as const)("matches %s scope against the selected record owner %s", async (accessScope, ownerUserId, allowed) => {
    respond(capabilities({ scope: accessScope, ownerUserIds: [USER] }), owner({ ownerUserId }));
    const { result } = renderHook(() => useCustomFieldOwnerAccess(INPUT));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canEdit).toBe(allowed);
    expect(result.current.error).toBeNull();
  });

  it("allows an unowned record for all scope and treats null action as unavailable", async () => {
    respond(capabilities(), owner({ ownerUserId: null }));
    const { result } = renderHook(() => useCustomFieldOwnerAccess(INPUT));
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    respond(capabilities(null));
    act(() => result.current.retry());
    expect(result.current.canEdit).toBe(false);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canEdit).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it.each([
    { scope: "own", ownerUserIds: null }, { scope: "all", ownerUserIds: [USER] },
    { scope: "team", ownerUserIds: [] }, { scope: "all", ownerUserIds: "bad" },
  ])("rejects malformed capability boundaries: %j", async (update) => {
    respond(capabilities(update));
    const { result } = renderHook(() => useCustomFieldOwnerAccess(INPUT));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.canEdit).toBe(false);
  });

  it.each([
    { id: OTHER_OWNER }, { branchId: OTHER_BRANCH }, { ownerUserId: "bad" },
    { ownerUserId: undefined }, { status: "NEW" }, { status: undefined },
  ])("rejects an invalid selected-owner projection: %j", async (change) => {
    respond(capabilities(), owner(change));
    const { result } = renderHook(() => useCustomFieldOwnerAccess(INPUT));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.canEdit).toBe(false);
  });

  it("rejects a capability response for another branch", async () => {
    respond(capabilities(undefined, "leads", OTHER_BRANCH));
    const { result } = renderHook(() => useCustomFieldOwnerAccess(INPUT));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.canEdit).toBe(false);
  });

  it("makes a converted Lead read-only even with an all update grant", async () => {
    respond(capabilities(), owner({ status: "CONVERTED" }));
    const { result } = renderHook(() => useCustomFieldOwnerAccess(INPUT));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ canEdit: false, converted: true, error: null });
  });

  it("retains normalized denial and retries only on request", async () => {
    get.mockRejectedValue(new TenantApiClientError("Denied", {
      status: 403, statusText: "Forbidden", headers: new Headers(), data: { code: "CRM_SCOPED_PERMISSION_DENIED" },
    }));
    const { result } = renderHook(() => useCustomFieldOwnerAccess(INPUT));
    await waitFor(() => expect(result.current.error?.status).toBe(403));
    expect(result.current.canEdit).toBe(false);
    expect(get).toHaveBeenCalledTimes(2);
    respond();
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    expect(get).toHaveBeenCalledTimes(4);
  });

  it("hides a previous grant synchronously when selection or enabled changes", async () => {
    const pending = deferred<ReturnType<typeof owner>>();
    const { result, rerender } = renderHook(useCustomFieldOwnerAccess, { initialProps: INPUT });
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    get.mockReturnValue(pending.promise);
    rerender({ ...INPUT, ownerId: OTHER_OWNER });
    expect(result.current.canEdit).toBe(false);
    expect(result.current.isLoading).toBe(true);
    rerender({ ...INPUT, enabled: false });
    expect(result.current).toMatchObject({ canEdit: false, isLoading: false, converted: false });
  });

  it("ignores late old-record responses even if transport cancellation loses the race", async () => {
    const first = deferred<ReturnType<typeof owner>>();
    get.mockImplementation((url: string) => url.includes("/capabilities?") ? Promise.resolve(capabilities()) : first.promise);
    const { result, rerender } = renderHook(useCustomFieldOwnerAccess, { initialProps: INPUT });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    const signal = get.mock.calls[0][1].signal as AbortSignal;
    respond(capabilities(null), owner({ id: OTHER_OWNER }));
    rerender({ ...INPUT, ownerId: OTHER_OWNER });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(signal.aborted).toBe(true);
    await act(async () => { first.resolve(owner()); });
    expect(result.current).toMatchObject({ canEdit: false, converted: false, error: null });
  });

  it.each(["owner", "enabled"])("requires a fresh answer after a %s round trip", async (change) => {
    const { result, rerender } = renderHook(useCustomFieldOwnerAccess, { initialProps: INPUT });
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    const pending = deferred<ReturnType<typeof owner>>();
    get.mockReturnValue(pending.promise);
    rerender(change === "owner" ? { ...INPUT, ownerId: OTHER_OWNER } : { ...INPUT, enabled: false });
    expect(result.current.canEdit).toBe(false);
    rerender(INPUT);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it.each([
    { ...AUTH, user: { id: OTHER_USER } },
    { ...AUTH, realtimeAuthGeneration: "session-b" },
    { ...AUTH, user: { id: USER, permissions: [] } },
  ])("does not reuse a grant across an auth snapshot change: %j", async (nextAuth) => {
    const { result, rerender } = renderHook(() => useCustomFieldOwnerAccess(INPUT));
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    const pending = deferred<ReturnType<typeof owner>>();
    get.mockReturnValue(pending.promise);
    auth.mockReturnValue(nextAuth); rerender();
    expect(result.current.canEdit).toBe(false);
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(4));
  });

  it.each(["STALE", "REFRESHING", "DEGRADED", "ENDED"])("does not admit writes while auth is %s", async (authState) => {
    const { result, rerender } = renderHook(() => useCustomFieldOwnerAccess(INPUT));
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    auth.mockReturnValue({ ...AUTH, authState }); rerender();
    expect(result.current.canEdit).toBe(false);
    await act(async () => { await Promise.resolve(); });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("ignores a late grant from the previous authenticated actor", async () => {
    const first = deferred<ReturnType<typeof owner>>();
    get.mockImplementation((url: string) => url.includes("/capabilities?") ? Promise.resolve(capabilities()) : first.promise);
    const { result, rerender } = renderHook(() => useCustomFieldOwnerAccess(INPUT));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    const signal = get.mock.calls[0][1].signal as AbortSignal;
    auth.mockReturnValue({ ...AUTH, user: { id: OTHER_USER }, realtimeAuthGeneration: "session-b" });
    respond(capabilities(null)); rerender();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(signal.aborted).toBe(true);
    await act(async () => { first.resolve(owner()); });
    expect(result.current).toMatchObject({ canEdit: false, error: null });
  });
});
