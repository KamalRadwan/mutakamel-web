// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { Branch } from "../../contracts/organization-contract";
import { useQuickViewNode, type QuickViewTarget } from "./useQuickViewNode";

const state = vi.hoisted(() => ({
  permissions: new Set<string>(),
  fetchNode: vi.fn(),
  fetchNodes: vi.fn(),
}));

vi.mock("@/design-system", () => ({
  useCan: (permission: string) => state.permissions.has(permission),
}));

vi.mock("@/lib/api/envelope", () => ({
  readCoreData: vi.fn(),
}));

vi.mock("../../contracts/organization-contract", async (original) => ({
  ...(await original<typeof import("../../contracts/organization-contract")>()),
  fetchOrgNode: state.fetchNode,
  fetchOrgNodes: state.fetchNodes,
}));

const companyId = "01900100-0000-7000-8000-000000000010";
const branchIdA = "01900100-0000-7000-8000-000000000021";
const branchIdB = "01900100-0000-7000-8000-000000000022";

const branchA: Branch = {
  id: branchIdA,
  companyId,
  code: "BR-A",
  name: "Riyadh Branch",
  address: "Olaya St",
  phone: "+966110000001",
  isHeadquarters: true,
  status: "ACTIVE",
  createdAt: "2026-10-17T00:00:00.000Z",
  updatedAt: "2026-10-17T00:00:00.000Z",
};

const branchB: Branch = {
  id: branchIdB,
  companyId,
  code: "BR-B",
  name: "Jeddah Branch",
  address: "Tahlia St",
  phone: "+966120000002",
  isHeadquarters: false,
  status: "INACTIVE",
  createdAt: "2026-10-17T00:00:00.000Z",
  updatedAt: "2026-10-17T00:00:00.000Z",
};

const summaryTargetA: QuickViewTarget = {
  kind: "summary",
  level: "branches",
  summary: { id: branchIdA, code: "BR-A", name: "Riyadh Branch", status: "ACTIVE" },
};

const summaryTargetB: QuickViewTarget = {
  kind: "summary",
  level: "branches",
  summary: { id: branchIdB, code: "BR-B", name: "Jeddah Branch", status: "INACTIVE" },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.permissions = new Set(["org.branch.read"]);
  state.fetchNodes.mockResolvedValue({ items: [], page: 1, limit: 100, total: 0 });
});

afterEach(cleanup);

describe("useQuickViewNode", () => {
  it("synchronously masks record A on target switch to summary B so A never flashes in B's dialog", async () => {
    const pendingB = deferred<Branch>();
    state.fetchNode.mockImplementation((_level: string, id: string) =>
      id === branchIdA ? Promise.resolve(branchA) : pendingB.promise,
    );

    const { result, rerender } = renderHook(
      ({ target }: { target: QuickViewTarget | null }) => useQuickViewNode(target),
      { initialProps: { target: summaryTargetA as QuickViewTarget | null } },
    );

    await waitFor(() => expect(result.current.node?.id).toBe(branchIdA));
    expect(result.current.isLoading).toBe(false);

    rerender({ target: summaryTargetB });

    // Immediately on rerender—before any queued microtask or network resolution—
    // record A must be masked so B's dialog never flashes A's fields.
    expect(result.current.node).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.loadError).toBeNull();

    await act(async () => {
      pendingB.resolve(branchB);
      await pendingB.promise;
    });

    await waitFor(() => expect(result.current.node?.id).toBe(branchIdB));
    expect(result.current.isLoading).toBe(false);
  });

  it("fences out-of-order responses during rapid summary A -> summary B switching", async () => {
    const pendingA = deferred<Branch>();
    const pendingB = deferred<Branch>();
    state.fetchNode.mockImplementation((_level: string, id: string) =>
      id === branchIdA ? pendingA.promise : pendingB.promise,
    );

    const { result, rerender } = renderHook(
      ({ target }: { target: QuickViewTarget | null }) => useQuickViewNode(target),
      { initialProps: { target: summaryTargetA as QuickViewTarget | null } },
    );

    await waitFor(() => expect(state.fetchNode).toHaveBeenCalledWith("branches", branchIdA, expect.any(AbortSignal)));

    rerender({ target: summaryTargetB });
    await waitFor(() => expect(state.fetchNode).toHaveBeenCalledWith("branches", branchIdB, expect.any(AbortSignal)));

    await act(async () => {
      pendingB.resolve(branchB);
      await pendingB.promise;
    });
    await waitFor(() => expect(result.current.node?.id).toBe(branchIdB));

    await act(async () => {
      pendingA.resolve(branchA);
      await pendingA.promise;
    });

    expect(result.current.node?.id).toBe(branchIdB);
    expect(result.current.node?.name).toBe("Jeddah Branch");
  });

  it("marks detail forbidden without error banner when level read is absent or server returns 403", async () => {
    state.permissions = new Set();
    const { result, rerender } = renderHook(
      ({ target }: { target: QuickViewTarget | null }) => useQuickViewNode(target),
      { initialProps: { target: summaryTargetA as QuickViewTarget | null } },
    );

    expect(state.fetchNode).not.toHaveBeenCalled();
    expect(result.current.isDetailForbidden).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadError).toBeNull();

    state.permissions = new Set(["org.branch.read"]);
    state.fetchNode.mockRejectedValueOnce(
      new TenantApiClientError("forbidden", {
        status: 403,
        statusText: "Forbidden",
        headers: new Headers(),
        data: { errorCode: "FORBIDDEN" },
      }),
    );

    rerender({ target: summaryTargetB });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isDetailForbidden).toBe(true);
    expect(result.current.loadError).toBeNull();
    expect(result.current.node).toBeNull();
  });
});
