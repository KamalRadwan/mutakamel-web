// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listTiers: vi.fn(),
  listFeatures: vi.fn(),
  getTierGrants: vi.fn(),
  getPriceLadder: vi.fn(),
  getApplicationAudit: vi.fn(),
}));

vi.mock("../api/applications.api", () => ({ applicationsApi: api }));
vi.mock("@/components/ui/ToastContext", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/shared/hooks/useIdempotency", () => ({
  useIdempotency: () => ({ getIdempotencyKey: () => "key", resetKey: vi.fn() }),
}));

import { useApplicationCatalogue } from "./useApplicationCatalogue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe("useApplicationCatalogue request ownership", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    sessionStorage.clear();
    api.listTiers.mockResolvedValue([
      { id: "tier-a", key: "a", name: "A", rank: 0, color: "#000000", isActive: true },
      { id: "tier-b", key: "b", name: "B", rank: 1, color: "#000000", isActive: true },
    ]);
    api.listFeatures.mockResolvedValue([]);
    api.getApplicationAudit.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  it("keeps tier B grants and prices when delayed tier A resolves last", async () => {
    const grantsA = deferred<unknown[]>();
    const pricesA = deferred<unknown[]>();
    const grantsB = deferred<unknown[]>();
    const pricesB = deferred<unknown[]>();
    api.getTierGrants.mockImplementation((id: string) => id === "tier-a" ? grantsA.promise : grantsB.promise);
    api.getPriceLadder.mockImplementation((id: string) => id === "tier-a" ? pricesA.promise : pricesB.promise);

    const { result } = renderHook(() => useApplicationCatalogue("application-1"));
    await waitFor(() => expect(result.current.selectedTierId).toBe("tier-a"));
    await waitFor(() => expect(api.getTierGrants).toHaveBeenCalledWith("tier-a", expect.any(AbortSignal)));

    act(() => result.current.setSelectedTierId("tier-b"));
    await waitFor(() => expect(api.getTierGrants).toHaveBeenCalledWith("tier-b", expect.any(AbortSignal)));
    await act(async () => {
      grantsB.resolve([{ featureId: "feature-b" }]);
      pricesB.resolve([{ billingCycle: "MONTHLY", unitPrice: "2.00" }]);
    });
    await waitFor(() => expect(result.current.loadedTierId).toBe("tier-b"));
    expect(result.current.grants).toEqual([{ featureId: "feature-b" }]);

    await act(async () => {
      grantsA.resolve([{ featureId: "feature-a" }]);
      pricesA.resolve([{ billingCycle: "MONTHLY", unitPrice: "1.00" }]);
    });
    expect(result.current.loadedTierId).toBe("tier-b");
    expect(result.current.grants).toEqual([{ featureId: "feature-b" }]);
    expect(result.current.prices).toEqual([{ billingCycle: "MONTHLY", unitPrice: "2.00" }]);
  });
});
