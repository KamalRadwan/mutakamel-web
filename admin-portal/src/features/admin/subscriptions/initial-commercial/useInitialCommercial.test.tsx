// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ user: { id: "019f0000-0000-7000-8000-000000000030", isSuperAdmin: false, permissions: [] as string[] } }));
const api = vi.hoisted(() => ({ quote: vi.fn(), seed: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("./initial-commercial.api", () => ({ initialCommercialApi: api, initialSeedUrl: (id: string) => `/api/admin/core/v1/tenants/${id}/subscription` }));
import { useInitialCommercial, type InitialCommercialContext } from "./hooks/useInitialCommercial";
import { initialId, initialNow, initialQuoteFixture, initialReceiptFixture, initialRequestFixture } from "./initial-commercial.fixture";
import type { InitialQuoteView } from "../initial-commercial-readers";

const context: InitialCommercialContext = { purpose: "INITIAL_SEED", targetTenantId: initialId(2), subscriptionId: null, subscriptionRevision: null, intentId: initialId(40) };
const permissions = ["admin.catalog.read", "admin.subscriptions.create", "admin.subscriptions.critical"];
const unavailable = { isNormalized: true, httpStatus: 503, errorCode: "UNAVAILABLE", message: "Unavailable", correlationId: initialId(99) };
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((accept, refuse) => { resolve = accept; reject = refuse; });
  return { promise, resolve, reject };
}
async function setup(input = initialRequestFixture(), scope = context) {
  const hook = renderHook(({ request, current }) => useInitialCommercial(current, request), { initialProps: { request: input, current: scope } });
  await act(async () => {});
  return hook;
}
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(initialNow));
  auth.user = { id: initialId(30), isSuperAdmin: false, permissions: [...permissions] };
  api.quote.mockImplementation(async request => initialQuoteFixture(request.purpose));
  api.seed.mockResolvedValue(initialReceiptFixture());
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Initial commercial actor, purpose and quote ownership", () => {
  it("does no I/O on mount and uses independent quote and first-seed permissions", async () => {
    auth.user.permissions = ["admin.catalog.read"];
    const { result } = await setup();
    expect(api.quote).not.toHaveBeenCalled(); expect(api.seed).not.toHaveBeenCalled();
    await act(async () => { await result.current.requestQuote(); await result.current.seed(); });
    expect(api.quote).toHaveBeenCalledOnce(); expect(api.seed).not.toHaveBeenCalled();
    expect(result.current.canQuote).toBe(true); expect(result.current.canSeed).toBe(false);
  });
  it.each([[], ["admin.subscriptions.create"], ["admin.subscriptions.create", "admin.subscriptions.critical"]].map(grants => ({ grants })))("does not infer quote authority from $grants", async ({ grants }) => {
    auth.user.permissions = grants;
    const { result } = await setup();
    await act(async () => { await result.current.requestQuote(); await result.current.seed(); });
    expect(api.quote).not.toHaveBeenCalled(); expect(api.seed).not.toHaveBeenCalled();
  });
  it("uses tenant-create ANY quote permission without turning creation into seed", async () => {
    auth.user.permissions = ["admin.tenants.create"];
    const { result } = await setup(initialRequestFixture("TENANT_CREATION"), { purpose: "TENANT_CREATION", intentId: initialId(40) });
    await act(async () => { await result.current.requestQuote(); await result.current.seed(); });
    expect(result.current.creationFields?.quoteId).toBe(initialId(1));
    expect(result.current.receipt).toBeNull(); expect(api.seed).not.toHaveBeenCalled();
    expect(result.current.creationFields).not.toHaveProperty("tenantId");
  });
  it("refuses invalid child quantity before transport", async () => {
    const request = initialRequestFixture(); request.applications[0].addons[0].seats = 4;
    const { result } = await setup(request);
    await act(async () => { await result.current.requestQuote(); });
    expect(result.current.error?.errorCode).toBe("INITIAL_SELECTION_INVALID"); expect(api.quote).not.toHaveBeenCalled();
  });
  it("cannot reuse predecessor journal readiness during a same-tick selection change", async () => {
    const view = await setup();
    expect(view.result.current.journalReady).toBe(true);
    const changed = initialRequestFixture(); changed.applications[0].seats = 4;
    view.rerender({ request: changed, current: context });
    expect(view.result.current.journalReady).toBe(false);
    act(() => { void view.result.current.requestQuote(); });
    expect(api.quote).not.toHaveBeenCalled();
    await act(async () => {});
    expect(view.result.current.journalReady).toBe(true);
    api.quote.mockRejectedValueOnce(unavailable);
    await act(async () => { await view.result.current.requestQuote(); });
    expect(api.quote).toHaveBeenCalledOnce();
    expect(api.quote.mock.calls[0][0].applications[0].seats).toBe(4);
  });
  it.each(["actor", "tenant", "intent", "subscription", "permission", "terms"] as const)("closes quote evidence when %s changes", async changed => {
    const hook = await setup();
    await act(async () => { await hook.result.current.requestQuote(); });
    expect(hook.result.current.quote).not.toBeNull();
    const request = initialRequestFixture(); let current = { ...context };
    if (changed === "actor") auth.user = { ...auth.user, id: initialId(31) };
    if (changed === "tenant") { current = { ...context, targetTenantId: initialId(8) }; Object.assign(request, { targetTenantId: initialId(8) }); }
    if (changed === "intent") current = { ...context, intentId: initialId(41) };
    if (changed === "subscription") current = { ...context, subscriptionId: initialId(9), subscriptionRevision: "1" };
    if (changed === "permission") auth.user.permissions = [];
    if (changed === "terms") request.applications[0].seats = 4;
    hook.rerender({ request, current }); await act(async () => {});
    expect(hook.result.current.quote).toBeNull();
    await act(async () => { await hook.result.current.seed(); });
    expect(api.seed).not.toHaveBeenCalled();
  });
  it.each(["success", "failure"] as const)("suppresses old quote %s after changing target", async outcome => {
    const previous = deferred<InitialQuoteView>(); api.quote.mockReturnValueOnce(previous.promise);
    const hook = await setup();
    let oldRequest!: Promise<void>;
    act(() => { oldRequest = hook.result.current.requestQuote(); });
    const signal = api.quote.mock.calls[0][1] as AbortSignal;
    const request = initialRequestFixture(); Object.assign(request, { targetTenantId: initialId(8) });
    hook.rerender({ request, current: { ...context, targetTenantId: initialId(8) } }); await act(async () => {});
    const newer = { ...initialQuoteFixture(), quoteId: initialId(7), targetTenantId: initialId(8) };
    api.quote.mockResolvedValueOnce(newer);
    await act(async () => { await hook.result.current.requestQuote(); });
    await act(async () => { if (outcome === "success") previous.resolve(initialQuoteFixture()); else previous.reject(unavailable); await oldRequest; });
    expect(signal.aborted).toBe(true); expect(hook.result.current.quote).toEqual(newer); expect(hook.result.current.error).toBeNull();
  });
  it("expires displayed quote evidence at its actual deadline", async () => {
    vi.useRealTimers(); vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] }); vi.setSystemTime(new Date(initialNow));
    const { result } = await setup();
    await act(async () => { await result.current.requestQuote(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(15 * 60_000); });
    expect(result.current.quoteIsExpired).toBe(true);
    await act(async () => { await result.current.seed(); });
    expect(api.seed).not.toHaveBeenCalled();
  });
  it("checks the deadline again at dispatch even if a background timer has not run", async () => {
    const { result } = await setup();
    await act(async () => { await result.current.requestQuote(); });
    vi.setSystemTime(new Date("2026-09-08T01:15:00.000Z"));
    await act(async () => { await result.current.seed(); });
    expect(api.seed).not.toHaveBeenCalled();
  });
});

describe("Original first-seed intent and uncertain recovery", () => {
  it("latches double submission and exposes only the original immutable receipt", async () => {
    const { result } = await setup();
    await act(async () => { await result.current.requestQuote(); });
    await act(async () => { await Promise.all([result.current.seed(), result.current.seed()]); });
    expect(api.seed).toHaveBeenCalledOnce(); expect(result.current.receipt).toEqual(initialReceiptFixture());
    expect(result.current.pending).toBeNull(); expect(result.current.locked).toBe(true);
    await act(async () => { await result.current.seed(); await result.current.requestQuote(); });
    expect(api.seed).toHaveBeenCalledOnce(); expect(api.quote).toHaveBeenCalledOnce();
  });
  it.each([unavailable, { ...unavailable, httpStatus: 409, errorCode: "GW.IDEM.IN_FLIGHT" },
    { ...unavailable, httpStatus: 409, errorCode: "AUTH_SESSION_CHANGED", requestOutcome: "settled-before-session-change" }])("retains exact request/key after $errorCode and allows only original retry", async failure => {
    const request = initialRequestFixture(); delete request.trialDays;
    api.seed.mockRejectedValueOnce(failure).mockResolvedValueOnce(initialReceiptFixture());
    const { result } = await setup(request);
    await act(async () => { await result.current.requestQuote(); });
    await act(async () => { await result.current.seed(); });
    expect(result.current.pending).not.toBeNull(); expect(result.current.canRetry).toBe(true);
    const first = api.seed.mock.calls[0];
    expect(first[1]).not.toHaveProperty("trialDays");
    const stored = sessionStorage.getItem(`admin.initial-seed:${initialId(30)}:${initialId(2)}`)!;
    expect(stored).not.toMatch(/applications|trialDays|definitionVersionId/);
    await act(async () => { await result.current.requestQuote(); await result.current.seed(); });
    expect(api.quote).toHaveBeenCalledOnce(); expect(api.seed).toHaveBeenCalledOnce();
    vi.setSystemTime(new Date("2026-09-08T02:00:00.000Z"));
    await act(async () => { await result.current.retrySeed(); });
    expect(api.seed.mock.calls[1]).toEqual(first); expect(result.current.receipt).toEqual(initialReceiptFixture());
    expect(result.current.pending).toBeNull();
  });
  it("retains the journal across remount without reconstructing or silently replacing its original request", async () => {
    api.seed.mockRejectedValue(unavailable);
    const first = await setup();
    await act(async () => { await first.result.current.requestQuote(); });
    await act(async () => { await first.result.current.seed(); });
    const key = first.result.current.pending?.idempotencyKey;
    first.unmount();
    const second = await setup();
    expect(second.result.current.pending?.idempotencyKey).toBe(key); expect(second.result.current.canRetry).toBe(false);
    await act(async () => { await second.result.current.requestQuote(); await second.result.current.seed(); await second.result.current.retrySeed(); });
    expect(api.quote).toHaveBeenCalledOnce(); expect(api.seed).toHaveBeenCalledOnce();
  });
  it("requires new quote review after a definitive refusal and clears only that attempt", async () => {
    api.seed.mockRejectedValue({ ...unavailable, httpStatus: 409, errorCode: "COMMERCIAL_QUOTE_STALE" });
    const { result } = await setup();
    await act(async () => { await result.current.requestQuote(); });
    await act(async () => { await result.current.seed(); });
    expect(result.current.quote).toBeNull(); expect(result.current.pending).toBeNull(); expect(result.current.receipt).toBeNull();
    await act(async () => { await result.current.seed(); });
    expect(api.seed).toHaveBeenCalledOnce();
  });
  it("does not expose a late original receipt in another tenant or intent", async () => {
    const deferredSeed = deferred<ReturnType<typeof initialReceiptFixture>>(); api.seed.mockReturnValue(deferredSeed.promise);
    const hook = await setup();
    await act(async () => { await hook.result.current.requestQuote(); });
    let command!: Promise<void>;
    await act(async () => { command = hook.result.current.seed(); });
    const nextRequest = initialRequestFixture(); Object.assign(nextRequest, { targetTenantId: initialId(8) });
    hook.rerender({ request: nextRequest, current: { ...context, targetTenantId: initialId(8), intentId: initialId(41) } });
    await act(async () => { deferredSeed.resolve(initialReceiptFixture()); await command; });
    expect(hook.result.current.receipt).toBeNull(); expect(hook.result.current.quote).toBeNull(); expect(hook.result.current.error).toBeNull();
  });
});
