// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { ApplicationAccessListPage } from "../application-access-list";

const auth = vi.hoisted(() => ({ user: { id: "actor", isTenantOwner: false, permissions: ["applications.activation.read"] },
  isAuthenticated: true, realtimeAuthGeneration: "session-1" }));
const read = vi.hoisted(() => vi.fn());
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../application-access-list", () => ({ readApplicationAccessList: read }));
const { useApplicationAccessList } = await import("./useApplicationAccessList");
const company = { scope: "COMPANY" as const, scopeId: "018ef54e-2222-7777-8888-000000000001" };
const page: ApplicationAccessListPage = { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };

beforeEach(() => {
  auth.user = { id: "actor", isTenantOwner: false, permissions: ["applications.activation.read"] };
  auth.isAuthenticated = true; auth.realtimeAuthGeneration = "session-1";
  read.mockReset().mockResolvedValue(page);
});
afterEach(cleanup);

describe("scope directory read lifecycle", () => {
  it.each(["applications.activation.read", "applications.activation.manage"])("admits exact ANY %s", async (permission) => {
    auth.user.permissions = [permission];
    const { result } = renderHook(() => useApplicationAccessList(company));
    await waitFor(() => expect(result.current.data).toBe(page));
    expect(read.mock.calls[0][0]).toEqual({ ...company, page: 1, limit: 20 });
  });
  it("does not substitute organization/configuration permissions", () => {
    auth.user.permissions = ["org.company.read", "applications.configuration.manage"];
    const { result } = renderHook(() => useApplicationAccessList(company));
    expect(result.current.denied).toBe(true); expect(read).not.toHaveBeenCalled();
  });
  it("keeps actual403 distinct from a successful empty directory", async () => {
    read.mockRejectedValue(new TenantApiClientError("denied", { status: 403, statusText: "Forbidden", headers: new Headers(), data: {} }));
    const { result } = renderHook(() => useApplicationAccessList(company));
    await waitFor(() => expect(result.current.denied).toBe(true));
    expect(result.current.data).toBeNull(); expect(result.current.error?.status).toBe(403);
  });
  it("resets pagination on scope change and ignores the prior page completion", async () => {
    let completeOld: (value: ApplicationAccessListPage) => void = () => undefined;
    const { result, rerender } = renderHook(({ target }) => useApplicationAccessList(target), { initialProps: { target: company } });
    await waitFor(() => expect(result.current.data).toBe(page));
    read.mockImplementationOnce(() => new Promise<ApplicationAccessListPage>((resolve) => { completeOld = resolve; }));
    act(() => result.current.changePage(2));
    expect(result.current.data).toBeNull();
    const priorSignal = read.mock.calls[1][1] as AbortSignal;
    rerender({ target: { ...company, scopeId: "018ef54e-2222-7777-8888-000000000002" } });
    await waitFor(() => expect(result.current.data).toBe(page));
    expect(priorSignal.aborted).toBe(true); expect(read.mock.calls[2][0].page).toBe(1);
    await act(async () => completeOld({ ...page, meta: { ...page.meta, page: 2, hasPrev: true } }));
    expect(result.current.data).toBe(page);
  });
  it.each([0, -1, 1.5, 1_000_001, Number.NaN])("does not request invalid page %s", async (value) => {
    const { result } = renderHook(() => useApplicationAccessList(company));
    await waitFor(() => expect(result.current.data).toBe(page));
    act(() => result.current.changePage(value)); expect(read).toHaveBeenCalledTimes(1);
  });
  it("hides previous directory facts across session change and loss of authority", async () => {
    const { result, rerender } = renderHook(() => useApplicationAccessList(company));
    await waitFor(() => expect(result.current.data).toBe(page));
    read.mockImplementationOnce(() => new Promise(() => undefined));
    auth.realtimeAuthGeneration = "session-2"; rerender();
    expect(result.current.data).toBeNull(); expect(result.current.loading).toBe(true);
    auth.user.permissions = []; rerender();
    expect(result.current.denied).toBe(true); expect(result.current.data).toBeNull();
  });
  it("admits the current owner only while authenticated and aborts on unmount", async () => {
    auth.user.permissions = []; auth.user.isTenantOwner = true;
    const { result, rerender, unmount } = renderHook(() => useApplicationAccessList(company));
    await waitFor(() => expect(result.current.data).toBe(page));
    auth.isAuthenticated = false; rerender(); expect(result.current.denied).toBe(true);
    unmount(); expect((read.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
  });
});
