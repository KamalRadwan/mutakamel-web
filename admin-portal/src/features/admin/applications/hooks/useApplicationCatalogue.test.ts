// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listTiers: vi.fn(),
  listFeatures: vi.fn(),
  getTierGrants: vi.fn(),
  getPriceLadder: vi.fn(),
  getApplicationAudit: vi.fn(),
  replacePriceLadder: vi.fn(),
  replaceTierGrants: vi.fn(),
  deleteTier: vi.fn(),
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

describe("useApplicationCatalogue tier detail freshness", () => {
  const SAVED_LADDER = [{ billingCycle: "MONTHLY", unitPrice: "9.00" }];
  const SAVED_GRANTS = [{ featureId: "feature-new" }];

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    sessionStorage.clear();
    api.listTiers.mockResolvedValue([
      { id: "tier-a", key: "a", name: "A", rank: 0, color: "#000000", isActive: true },
    ]);
    api.listFeatures.mockResolvedValue([]);
    api.getApplicationAudit.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
    // The first read is what the editor opened with; every read after the save
    // is what the server now holds.
    api.getTierGrants
      .mockResolvedValueOnce([{ featureId: "feature-old" }])
      .mockResolvedValue(SAVED_GRANTS);
    api.getPriceLadder
      .mockResolvedValueOnce([{ billingCycle: "MONTHLY", unitPrice: "1.00" }])
      .mockResolvedValue(SAVED_LADDER);
    api.replacePriceLadder.mockResolvedValue(undefined);
    api.replaceTierGrants.mockResolvedValue(undefined);
  });

  it("re-reads the selected tier's prices after saving into it", async () => {
    const { result } = renderHook(() => useApplicationCatalogue("application-1"));
    await waitFor(() => expect(result.current.loadedTierId).toBe("tier-a"));
    expect(result.current.prices).toEqual([
      { billingCycle: "MONTHLY", unitPrice: "1.00" },
    ]);

    await act(async () => {
      await result.current.replacePrices("tier-a", {
        billingCycle: "MONTHLY",
        brackets: [{ minUsers: 1, maxUsers: null, unitPrice: "9.0000" }],
      });
    });

    // Saving into the tier already selected changes no id, so nothing but this
    // reload brings the ladder up to date. Left stale, the pricing editor
    // rebuilt its brackets from it on the next billing-cycle change and offered
    // to write the old price back over the new one.
    await waitFor(() => expect(result.current.prices).toEqual(SAVED_LADDER));
    expect(result.current.pricesFor("MONTHLY")).toEqual(SAVED_LADDER);
    expect(result.current.loadedTierId).toBe("tier-a");
  });

  it("re-reads the selected tier's grants after replacing them", async () => {
    const { result } = renderHook(() => useApplicationCatalogue("application-1"));
    await waitFor(() => expect(result.current.loadedTierId).toBe("tier-a"));
    expect(result.current.grants).toEqual([{ featureId: "feature-old" }]);

    await act(async () => {
      await result.current.replaceGrants("tier-a", {
        features: [{ featureId: "feature-new" }],
      });
    });

    await waitFor(() => expect(result.current.grants).toEqual(SAVED_GRANTS));
  });

  it("brings the selected tier's detail up to date on an explicit refresh", async () => {
    const { result } = renderHook(() => useApplicationCatalogue("application-1"));
    await waitFor(() => expect(result.current.loadedTierId).toBe("tier-a"));

    await act(async () => {
      await result.current.refreshAll();
    });

    // Refresh claims to refresh the screen, and grants and prices are on it.
    expect(result.current.prices).toEqual(SAVED_LADDER);
    expect(result.current.grants).toEqual(SAVED_GRANTS);
  });

  it("does not re-read a tier the same write deleted", async () => {
    api.listTiers
      .mockResolvedValueOnce([
        { id: "tier-a", key: "a", name: "A", rank: 0, color: "#000000", isActive: true },
        { id: "tier-b", key: "b", name: "B", rank: 1, color: "#000000", isActive: true },
      ])
      .mockResolvedValue([
        { id: "tier-b", key: "b", name: "B", rank: 1, color: "#000000", isActive: true },
      ]);
    api.deleteTier.mockResolvedValue(undefined);

    const { result } = renderHook(() => useApplicationCatalogue("application-1"));
    await waitFor(() => expect(result.current.loadedTierId).toBe("tier-a"));
    const readsOfDeletedTier = api.getTierGrants.mock.calls.filter(
      (call) => call[0] === "tier-a",
    ).length;

    await act(async () => {
      await result.current.deleteTier("tier-a");
    });

    // The selection moved to the surviving tier, so the post-write reload has
    // to follow it. Re-reading the tier that has just been deleted would put a
    // failure on screen for a command that succeeded.
    await waitFor(() => expect(result.current.selectedTierId).toBe("tier-b"));
    expect(
      api.getTierGrants.mock.calls.filter((call) => call[0] === "tier-a").length,
    ).toBe(readsOfDeletedTier);
    expect(result.current.tierDetailError).toBeNull();
  });
});
