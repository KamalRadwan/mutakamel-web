// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSubscriptionOffersFixture } from "../subscription-offers.fixture";

const mocks = vi.hoisted(() => ({ owner: true, actor: "owner-a", generation: 1, read: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({
  user: { id: mocks.actor, isTenantOwner: mocks.owner }, isAuthenticated: true, realtimeAuthGeneration: mocks.generation,
}) }));
vi.mock("../subscription-offers-api", () => ({ readSubscriptionOffers: mocks.read }));
const { useCommercialLabels } = await import("./useCommercialLabels");
beforeEach(() => {
  mocks.owner = true; mocks.actor = "owner-a"; mocks.generation = 1;
  mocks.read.mockReset();
});
afterEach(cleanup);

it("uses key fallback for a scoped non-owner without calling the owner catalogue", () => {
  mocks.owner = false;
  const { result } = renderHook(() => useCommercialLabels(null, [{ addonSelectionId: "selection", applicationKey: "crm", addonKey: "crm.logistics",
    currentDefinition: { definitionVersionId: "definition", version: "1", revokedAt: null } }]));
  expect(result.current.addons.get("crm.logistics")).toBe("crm.logistics");
  expect(mocks.read).not.toHaveBeenCalled();
});

it("keeps selected offer names transiently and discards them on actor/session changes", async () => {
  mocks.read.mockRejectedValue(new Error("catalogue unavailable"));
  const { result, rerender } = renderHook(() => useCommercialLabels());
  const offers = createSubscriptionOffersFixture().data;
  act(() => result.current.rememberOffers(offers));
  expect(result.current.addons.get("crm.logistics")).toBe("Logistics");
  await waitFor(() => expect(mocks.read).toHaveBeenCalledOnce());
  mocks.actor = "owner-b"; mocks.generation += 1;
  rerender();
  expect(result.current.addons.has("crm.logistics")).toBe(false);
  await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
});

it("bounds optional catalogue discovery and aborts it when the workspace unmounts", async () => {
  mocks.read.mockResolvedValue({ items: createSubscriptionOffersFixture().data, meta: { hasNext: true } });
  const { result, unmount } = renderHook(() => useCommercialLabels());
  await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(10));
  expect(result.current.addons.get("crm.logistics")).toBe("Logistics");
  const signal = mocks.read.mock.calls[0][1] as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
});
