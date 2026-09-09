// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { createSubscriptionOffersFixture } from "../subscription-offers.fixture";
import type { SubscriptionOfferPage } from "../subscription-offers";
const auth = vi.hoisted(() => ({ user: { id: "actor", isTenantOwner: true, permissions: [] as string[] }, isAuthenticated: true, realtimeAuthGeneration: "session-1" }));
const read = vi.hoisted(() => vi.fn());
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../subscription-offers-api", () => ({ readSubscriptionOffers: read }));
const { useSubscriptionOffers } = await import("./useSubscriptionOffers");
const fixture = createSubscriptionOffersFixture();
const page: SubscriptionOfferPage = { items: fixture.data, meta: fixture.meta };
beforeEach(() => {
  auth.user = { id: "actor", isTenantOwner: true, permissions: [] }; auth.isAuthenticated = true; auth.realtimeAuthGeneration = "session-1";
  read.mockReset().mockResolvedValue(page);
});
afterEach(cleanup);

describe("published offer owner and session fencing", () => {
  it("admits a current authenticated owner without inventing a billing permission", async () => {
    const { result } = renderHook(useSubscriptionOffers);
    await waitFor(() => expect(result.current.data).toBe(page)); expect(result.current.denied).toBe(false);
  });
  it("never substitutes an ordinary permission for ownership", () => {
    auth.user.isTenantOwner = false; auth.user.permissions = ["applications.activation.manage"];
    const { result } = renderHook(useSubscriptionOffers); expect(result.current.denied).toBe(true); expect(read).not.toHaveBeenCalled();
  });
  it("filters only an actual current Application tier and resets pagination", async () => {
    const { result } = renderHook(useSubscriptionOffers); await waitFor(() => expect(result.current.data).toBe(page));
    act(() => result.current.selectTier(page.items[1])); expect(read).toHaveBeenCalledTimes(1);
    act(() => result.current.selectTier(page.items[0]));
    expect(result.current.data).toBeNull();
    expect(read.mock.calls[1][0]).toEqual({ page: 1, limit: 20, applicationKey: "crm", parentTierId: "018ef54e-2222-7777-8888-000000000003" });
    await waitFor(() => expect(result.current.data).toBe(page));
    act(() => result.current.selectTier(page.items[0])); expect(read).toHaveBeenCalledTimes(2);
    act(() => result.current.changePage(2)); await waitFor(() => expect(result.current.data).toBe(page));
    act(() => result.current.reset()); expect(result.current.selectedTier).toBeNull(); expect(read.mock.calls.at(-1)?.[0]).toEqual({ page: 1, limit: 20 });
  });
  it("does not accept a tier that was not in the latest verified response", async () => {
    const { result } = renderHook(useSubscriptionOffers); await waitFor(() => expect(result.current.data).toBe(page));
    const base = structuredClone(page.items[0]);
    if (base.sourceKind !== "APPLICATION") throw new Error("Invalid fixture");
    base.tier.id = "018ef54e-2222-7777-8888-000000000099";
    act(() => result.current.selectTier(base)); expect(read).toHaveBeenCalledTimes(1);
  });
  it("keeps actual403 as denied rather than an empty catalogue", async () => {
    read.mockRejectedValue(new TenantApiClientError("denied", { status: 403, statusText: "Forbidden", headers: new Headers(), data: {} }));
    const { result } = renderHook(useSubscriptionOffers); await waitFor(() => expect(result.current.denied).toBe(true));
    expect(result.current.data).toBeNull(); expect(result.current.error?.status).toBe(403);
  });
  it("discards old-session prices, selectors and late completions", async () => {
    let resolveOld: (value: SubscriptionOfferPage) => void = () => undefined;
    const { result, rerender } = renderHook(useSubscriptionOffers); await waitFor(() => expect(result.current.data).toBe(page));
    read.mockImplementationOnce(() => new Promise<SubscriptionOfferPage>((resolve) => { resolveOld = resolve; }));
    act(() => result.current.selectTier(page.items[0]));
    const oldSignal = read.mock.calls[1][1] as AbortSignal;
    auth.realtimeAuthGeneration = "session-2"; rerender();
    expect(oldSignal.aborted).toBe(true); expect(result.current.selectedTier).toBeNull(); expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.data).toBe(page));
    await act(async () => resolveOld({ ...page, items: [] })); expect(result.current.data).toBe(page);
  });
  it("hides offers during refresh and after loss of ownership", async () => {
    const { result, rerender, unmount } = renderHook(useSubscriptionOffers); await waitFor(() => expect(result.current.data).toBe(page));
    read.mockImplementationOnce(() => new Promise(() => undefined)); act(() => result.current.reload());
    expect(result.current.data).toBeNull(); auth.user.isTenantOwner = false; rerender(); expect(result.current.denied).toBe(true);
    unmount(); expect((read.mock.calls[1][1] as AbortSignal).aborted).toBe(true);
  });
});
