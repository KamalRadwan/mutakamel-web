// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { readCorePage } from "@/lib/api/envelope";
import { CONVERSION_IDS as ids } from "../__fixtures__/lead-conversion";
import { useLeadConversionOptions } from "./useLeadConversionOptions";

const auth = vi.hoisted(() => ({ user: { id: "01900100-0000-7000-8000-000000000004", firstName: "Kamal", lastName: "Radwan", status: "ACTIVE", permissions: [] as string[], accessibleBranches: ["01900100-0000-7000-8000-000000000003"] } }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/lib/api/envelope", () => ({ readCorePage: vi.fn() }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get: vi.fn() } }));
const other = { id: "01900100-0000-7000-8000-000000000099", firstName: "Dina", lastName: "Ali" };
const all = { scope: "all" as const, ownerUserIds: null };

beforeEach(() => {
  vi.clearAllMocks();
  auth.user.permissions = [];
  vi.mocked(axiosClient.get).mockResolvedValue({ data: [] } as Awaited<ReturnType<typeof axiosClient.get>>);
});
afterEach(cleanup);

describe("conversion references", () => {
  it("does no reads until optional opportunity creation is enabled", async () => {
    renderHook(() => useLeadConversionOptions(ids.branch, false, all));
    await act(async () => {});
    expect(axiosClient.get).not.toHaveBeenCalled();
    expect(readCorePage).not.toHaveBeenCalled();
  });
  it("fails pipeline selection closed without permission and preserves the known actor", async () => {
    const { result } = renderHook(() => useLeadConversionOptions(ids.branch, true, all));
    await waitFor(() => expect(result.current.pipelinesFailed).toBe(true));
    expect(axiosClient.get).not.toHaveBeenCalled();
    expect(readCorePage).not.toHaveBeenCalled();
    expect(result.current.ownerOptions.map(({ id }) => id)).toEqual([ids.owner]);
  });
  it("reads all ACTIVE user pages and narrows them to the opportunity boundary", async () => {
    auth.user.permissions = ["users.user.read", "crm.pipelines.read"];
    vi.mocked(readCorePage).mockResolvedValueOnce({ data: [{ ...other, id: ids.party }], meta: { page: 1, hasNext: true } })
      .mockResolvedValueOnce({ data: [other], meta: { page: 2, hasNext: false } });
    const { result } = renderHook(() => useLeadConversionOptions(ids.branch, true, { scope: "team", ownerUserIds: [other.id] }));
    await waitFor(() => expect(result.current.ownerOptions).toEqual([other]));
    expect(readCorePage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(readCorePage).mock.calls[0][1]).toContain(`branchId=${ids.branch}&status=ACTIVE&page=1&limit=100`);
    expect(vi.mocked(readCorePage).mock.calls[1][1]).toContain("page=2");
    expect(axiosClient.get).toHaveBeenCalledWith("/api/tenant/crm/v1/pipelines", expect.objectContaining({ cache: "no-store" }));
  });
  it("rejects duplicate users instead of rendering duplicate option keys", async () => {
    auth.user.permissions = ["users.user.read"];
    vi.mocked(readCorePage).mockResolvedValue({ data: [other, other], meta: { page: 1, hasNext: false } });
    const { result } = renderHook(() => useLeadConversionOptions(ids.branch, true, all));
    await waitFor(() => expect(result.current.usersFailed).toBe(true));
    expect(result.current.ownerOptions.map(({ id }) => id)).toEqual([ids.owner]);
  });
  it("discards late options after the modal closes", async () => {
    auth.user.permissions = ["users.user.read"];
    let finish!: (data: Awaited<ReturnType<typeof readCorePage>>) => void;
    vi.mocked(readCorePage).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook(({ enabled }) => useLeadConversionOptions(ids.branch, enabled, all), { initialProps: { enabled: true } });
    await waitFor(() => expect(readCorePage).toHaveBeenCalledOnce());
    rerender({ enabled: false });
    await act(async () => finish({ data: [other], meta: { page: 1, hasNext: false } }));
    expect(result.current.ownerOptions.map(({ id }) => id)).toEqual([ids.owner]);
  });
});
