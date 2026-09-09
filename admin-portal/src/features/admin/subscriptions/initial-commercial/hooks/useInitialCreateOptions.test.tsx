// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ user: { id: "", isSuperAdmin: false, permissions: [] as string[] } }));
const api = vi.hoisted(() => ({ options: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../initial-commercial.api", () => ({ initialCommercialApi: api }));
import { useInitialCreateOptions } from "./useInitialCreateOptions";
import { initialId, initialTermsFixture } from "../initial-commercial.fixture";
import { initialOptionsFixture } from "../initial-create-options.fixture";
import type { InitialCreateOptions } from "../initial-create-options";
import { readInitialTerms } from "../initial-commercial-request";

const change = vi.fn();
const props = () => ({ scope: "original-intent", terms: initialTermsFixture(), locked: false, maxApplications: 50 });
function setup(initial = props()) {
  return renderHook(({ scope, terms, locked, maxApplications }) => useInitialCreateOptions(scope, terms, change, locked, maxApplications), { initialProps: initial });
}
beforeEach(() => {
  vi.resetAllMocks(); auth.user = { id: initialId(30), isSuperAdmin: false, permissions: ["admin.tenants.create"] };
  api.options.mockResolvedValue(initialOptionsFixture());
});
afterEach(cleanup);

describe("Least-privilege initial catalogue picker", () => {
  it.each([["admin.catalog.read"], ["admin.subscriptions.create", "admin.subscriptions.critical"], []].map(permissions => ({ permissions })))("does not expand $permissions to tenant-create options permission", async ({ permissions }) => {
    auth.user.permissions = permissions; const { result } = setup();
    await act(async () => { await result.current.load(); });
    expect(api.options).not.toHaveBeenCalled(); expect(result.current.permitted).toBe(false);
  });
  it("does not fetch on mount and only loads on the operator request", async () => {
    const { result } = setup(); expect(api.options).not.toHaveBeenCalled();
    await act(async () => { await result.current.load(); });
    expect(api.options).toHaveBeenCalledOnce(); expect(result.current.value).toEqual(initialOptionsFixture());
  });
  it.each(["actor", "intent", "permission"])("suppresses a late response and closes selected tier state after %s changes", async kind => {
    let resolve!: (value: InitialCreateOptions) => void;
    const deferred = new Promise<InitialCreateOptions>(accept => { resolve = accept; }); api.options.mockReturnValueOnce(deferred);
    const view = setup(); let request!: Promise<void>;
    act(() => { request = view.result.current.load(); });
    const signal = api.options.mock.calls[0][0] as AbortSignal;
    const next = props();
    if (kind === "actor") auth.user.id = initialId(31);
    if (kind === "intent") next.scope = "new-intent";
    if (kind === "permission") auth.user.permissions = [];
    view.rerender(next);
    await act(async () => { resolve(initialOptionsFixture()); await request; });
    expect(signal.aborted).toBe(true); expect(view.result.current.value).toBeNull(); expect(view.result.current.tiers).toEqual({});
  });
  it("can start empty but requires an explicit genuine tier before adding an application", async () => {
    const initial = props(); initial.terms.applications = [];
    const { result } = setup(initial);
    await act(async () => { await result.current.load(); });
    act(() => { result.current.addApplication(initialId(11)); }); expect(change).not.toHaveBeenCalled();
    act(() => { result.current.chooseTier(initialId(11), initialId(80)); }); expect(result.current.tiers).toEqual({});
    act(() => { result.current.chooseTier(initialId(11), initialId(12)); });
    act(() => { result.current.addApplication(initialId(11)); });
    const next = readInitialTerms(change.mock.calls[0][0]);
    expect(next.applications[0]).toMatchObject({ applicationId: initialId(11), tierId: initialId(12), seats: 1, addons: [] });
    expect(next.applications[0].selectionKey).toMatch(/^[0-9a-f-]{14}7/u);
    expect(next.applications[0]).not.toHaveProperty("price");
  });
  it("selects the actual sealed addon definition and independent quantity", async () => {
    const initial = props(); initial.terms.applications[0].addons = [];
    const { result } = setup(initial); await act(async () => { await result.current.load(); });
    act(() => { result.current.addAddon(initialId(11), initialId(14)); });
    const next = readInitialTerms(change.mock.calls[0][0]);
    expect(next.applications[0].seats).toBe(3);
    expect(next.applications[0].addons[0]).toMatchObject({ addonId: initialId(14), definitionVersionId: initialId(15), seats: 1 });
  });
  it.each(["revoked", "incompatible", "duplicate", "invalid parent seats", "blocked application"])("does not add %s selections", async kind => {
    const initial = props(), options = initialOptionsFixture();
    if (kind !== "duplicate") initial.terms.applications[0].addons = [];
    if (kind === "revoked") options.applications[0].addons[0].catalogueReasons = ["ADDON_DEFINITION_REVOKED"];
    if (kind === "incompatible") { options.applications[0].addons[0].compatibleTierIds = []; options.applications[0].addons[0].catalogueReasons = ["ACTIVE_COMPATIBLE_TIER_REQUIRED"]; }
    if (kind === "invalid parent seats") initial.terms.applications[0].seats = 0;
    if (kind === "blocked application") options.applications[0].selectionBlockers = ["TECHNICAL_READINESS_BLOCKED"];
    api.options.mockResolvedValue(options);
    const { result } = setup(initial); await act(async () => { await result.current.load(); });
    act(() => { result.current.addAddon(initialId(11), initialId(14)); result.current.addApplication(initialId(11)); });
    expect(change).not.toHaveBeenCalled();
  });
  it("locks both refreshed reads and local mutation after a retained command appears", async () => {
    const initial = props(); initial.terms.applications[0].addons = [];
    const view = setup(initial); await act(async () => { await view.result.current.load(); });
    view.rerender({ ...initial, locked: true });
    await act(async () => { await view.result.current.load(); view.result.current.addAddon(initialId(11), initialId(14)); });
    expect(api.options).toHaveBeenCalledOnce(); expect(change).not.toHaveBeenCalled();
  });
  it("retains correlated unavailable errors without treating them as empty results", async () => {
    api.options.mockRejectedValue({ isNormalized: true, httpStatus: 503, errorCode: "TENANT_CREATE_OPTIONS_UNAVAILABLE", message: "Unavailable", correlationId: initialId(99) });
    const { result } = setup(); await act(async () => { await result.current.load(); });
    expect(result.current.value).toBeNull(); expect(result.current.error?.correlationId).toBe(initialId(99));
  });
});
