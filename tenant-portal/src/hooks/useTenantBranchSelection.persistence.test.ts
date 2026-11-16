// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tenantBranchSelectionKey } from "@/lib/tenant-branch-selection";
import { useTenantBranchSelection, type TenantBranchSource } from "./useTenantBranchSelection";

const BRANCH_A = "01900100-0000-7000-8000-000000000001";
const BRANCH_B = "01900100-0000-7000-8000-000000000002";
let nextActor = 0;

function source(): TenantBranchSource & { id: string } {
  return {
    id: `branch-persistence-${++nextActor}`,
    accessibleBranches: [BRANCH_A, BRANCH_B],
    teamMemberships: [{ branchId: BRANCH_A, isPrimary: true }],
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("tab branch preference", () => {
  it("preserves required and optional defaults before any explicit selection", () => {
    const actor = source();
    const { result } = renderHook(() => ({
      required: useTenantBranchSelection(actor),
      optional: useTenantBranchSelection(actor, { optional: true }),
    }));
    expect(result.current.required.branchId).toBe(BRANCH_A);
    expect(result.current.optional.branchId).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("shares the selected branch across mounted pages and restores it on navigation", () => {
    const actor = source();
    const leads = renderHook(() => useTenantBranchSelection(actor));
    const customers = renderHook(() => useTenantBranchSelection(actor));
    act(() => leads.result.current.selectBranch(BRANCH_B));
    expect(customers.result.current.branchId).toBe(BRANCH_B);
    expect(window.sessionStorage.getItem(tenantBranchSelectionKey(actor.id))).toBe(BRANCH_B);
    expect(window.localStorage.length).toBe(0);
    leads.unmount();
    customers.unmount();
    const opportunities = renderHook(() => useTenantBranchSelection(actor));
    expect(opportunities.result.current.branchId).toBe(BRANCH_B);
  });

  it("restores a persisted branch after a page reload, including optional consumers", () => {
    const actor = source();
    window.sessionStorage.setItem(tenantBranchSelectionKey(actor.id), BRANCH_B);
    const { result } = renderHook(() => useTenantBranchSelection(actor, { optional: true }));
    expect(result.current.branchId).toBe(BRANCH_B);
  });

  it("keeps another actor's choice isolated during actor switches", () => {
    const first = source();
    const second = source();
    const { result, rerender } = renderHook(({ actor }) => useTenantBranchSelection(actor), { initialProps: { actor: first } });
    act(() => result.current.selectBranch(BRANCH_B));
    rerender({ actor: second });
    expect(result.current.branchId).toBe(BRANCH_A);
    rerender({ actor: first });
    expect(result.current.branchId).toBe(BRANCH_B);
    expect(window.sessionStorage.getItem(tenantBranchSelectionKey(second.id))).toBeNull();
  });

  it("never restores an inaccessible branch after access is revoked", () => {
    const actor = source();
    const { result, rerender } = renderHook(({ profile }) => useTenantBranchSelection(profile), { initialProps: { profile: actor } });
    act(() => result.current.selectBranch(BRANCH_B));
    rerender({ profile: { ...actor, accessibleBranches: [BRANCH_A] } });
    expect(result.current.branchId).toBe(BRANCH_A);
    expect(result.current.branchIds).toEqual([BRANCH_A]);
  });

  it.each(["broken", "{", JSON.stringify({ branchId: BRANCH_B }), "null"])("ignores malformed stored branch: %s", (raw) => {
    const actor = source();
    window.sessionStorage.setItem(tenantBranchSelectionKey(actor.id), raw);
    const { result } = renderHook(() => useTenantBranchSelection(actor));
    expect(result.current.branchId).toBe(BRANCH_A);
  });

  it("clears the shared preference while preserving each consumer's fallback", () => {
    const actor = source();
    const required = renderHook(() => useTenantBranchSelection(actor));
    const optional = renderHook(() => useTenantBranchSelection(actor, { optional: true }));
    act(() => optional.result.current.selectBranch(BRANCH_B));
    act(() => optional.result.current.selectBranch(null));
    expect(optional.result.current.branchId).toBeNull();
    expect(required.result.current.branchId).toBe(BRANCH_A);
    expect(window.sessionStorage.getItem(tenantBranchSelectionKey(actor.id))).toBeNull();
    optional.unmount();
    const reopened = renderHook(() => useTenantBranchSelection(actor, { optional: true }));
    expect(reopened.result.current.branchId).toBeNull();
  });

  it("does not adopt browser storage events from another tab", () => {
    const actor = source();
    const { result } = renderHook(() => useTenantBranchSelection(actor));
    act(() => result.current.selectBranch(BRANCH_B));
    act(() => window.dispatchEvent(new StorageEvent("storage", {
      key: tenantBranchSelectionKey(actor.id), oldValue: BRANCH_B, newValue: BRANCH_A,
    })));
    expect(result.current.branchId).toBe(BRANCH_B);
  });

  it("keeps same-tab consumers synchronized when browser storage is unavailable", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const method of ["getItem", "setItem", "removeItem"] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    }
    const actor = source();
    const first = renderHook(() => useTenantBranchSelection(actor));
    const second = renderHook(() => useTenantBranchSelection(actor));
    act(() => first.result.current.selectBranch(BRANCH_B));
    expect(second.result.current.branchId).toBe(BRANCH_B);
    act(() => first.result.current.selectBranch(null));
    expect(second.result.current.branchId).toBe(BRANCH_A);
  });

  it("keeps sources without an actor ID local and never persists them", () => {
    const actor = { ...source(), id: undefined };
    const first = renderHook(() => useTenantBranchSelection(actor));
    const second = renderHook(() => useTenantBranchSelection(actor));
    act(() => first.result.current.selectBranch(BRANCH_B));
    expect(first.result.current.branchId).toBe(BRANCH_B);
    expect(second.result.current.branchId).toBe(BRANCH_A);
    expect(window.sessionStorage.length).toBe(0);
  });
});
