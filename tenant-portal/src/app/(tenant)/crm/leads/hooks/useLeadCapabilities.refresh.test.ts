// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLeadCapabilities } from "./useLeadCapabilities";
import { useLeadStagesAndCapabilities } from "./useLeadStagesAndCapabilities";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
const BRANCH = "01900100-0000-7000-8000-000000000001";
const OTHER = "01900100-0000-7000-8000-000000000002";
const SCOPE = { ready: true, headers: { "x-mutakamel-branch-id": BRANCH }, gap: null };
vi.mock("@/hooks/useOrganizationScope", () => ({
  SCOPE_UNRESOLVED_ERROR: { code: "scope-unresolved" },
  useOrganizationScopeHeaders: () => SCOPE,
}));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get } };
});

function response(branchId: string, allowed = true) {
  const capability = allowed ? { scope: "all", ownerUserIds: null } : null;
  return { data: { branchId,
    leads: { create: capability, update: capability, delete: capability, convert: capability },
    notes: { create: capability, delete: capability },
    attachments: { create: capability, delete: capability },
  } };
}
function deny(endpoint = "/api/tenant/crm/v1/leads/example", code = "CRM_SCOPED_PERMISSION_DENIED") {
  window.dispatchEvent(new CustomEvent("tenant-permission-denied", {
    detail: { code, endpoint, method: "PATCH", branchId: BRANCH, companyId: null },
  }));
}
beforeEach(() => {
  get.mockImplementation((url: string) => Promise.resolve(url.includes("capabilities") ? response(BRANCH) : { data: [] }));
});
afterEach(() => { cleanup(); get.mockReset(); });

describe.each([
  ["detail", useLeadCapabilities],
  ["list", useLeadStagesAndCapabilities],
] as const)("%s capability freshness", (_name, useCapabilities) => {
  it("hides the old branch immediately and ignores late old responses", async () => {
    const { result, rerender } = renderHook(({ branchId }) => useCapabilities(branchId), {
      initialProps: { branchId: BRANCH },
    });
    await waitFor(() => expect(result.current.capabilities?.update).toEqual({ scope: "all", ownerUserIds: null }));
    let resolveOld: ((value: ReturnType<typeof response>) => void) | undefined;
    get.mockImplementation((url: string) => url.includes("capabilities")
      ? new Promise<ReturnType<typeof response>>((resolve) => { resolveOld = resolve; })
      : Promise.resolve({ data: [] }));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(result.current.capabilities?.update ?? null).toBeNull();
    get.mockImplementation((url: string) => Promise.resolve(url.includes("capabilities") ? response(OTHER, false) : { data: [] }));
    rerender({ branchId: OTHER });
    expect(result.current.capabilities?.update ?? null).toBeNull();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { resolveOld?.(response(BRANCH)); });
    expect(result.current.capabilities?.update ?? null).toBeNull();
  });

  it("reloads on write denial and focus, without a capability-denial loop", async () => {
    const { result, unmount } = renderHook(() => useCapabilities(BRANCH));
    await waitFor(() => expect(result.current.capabilities?.update).toEqual({ scope: "all", ownerUserIds: null }));
    get.mockImplementation((url: string) => Promise.resolve(url.includes("capabilities") ? response(BRANCH, false) : { data: [] }));
    act(() => deny());
    expect(result.current.capabilities?.update ?? null).toBeNull();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.capabilities?.update ?? null).toBeNull();
    const calls = get.mock.calls.length;
    act(() => { deny("/api/tenant/crm/v1/leads/capabilities?branchId=" + BRANCH); deny(undefined, "OTHER_ERROR"); });
    expect(get).toHaveBeenCalledTimes(calls);
    get.mockImplementation((url: string) => Promise.resolve(url.includes("capabilities") ? response(BRANCH) : { data: [] }));
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(result.current.capabilities?.update).toEqual({ scope: "all", ownerUserIds: null }));
    unmount();
    const afterUnmount = get.mock.calls.length;
    act(() => { deny(); window.dispatchEvent(new Event("focus")); });
    expect(get).toHaveBeenCalledTimes(afterUnmount);
  });
});
