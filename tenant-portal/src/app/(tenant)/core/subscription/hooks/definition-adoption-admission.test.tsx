// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canAdoptDefinitions, DEFINITION_ADOPTION_PERMISSION } from "../definition-adoption-command";
import { useCommercialChange } from "./useCommercialChange";
import { useDefinitionAdoptionDiscovery } from "./useDefinitionAdoptionDiscovery";

const mocks = vi.hoisted(() => ({
  user: { id: "018ef54e-2222-7777-8888-000000000010", isTenantOwner: false,
    permissions: ["applications.addon_definitions.adopt"],
    permissionScopes: {} as Record<string, { tenantWide: boolean; companyIds: string[]; branchIds: string[] }> },
  selections: vi.fn(), targets: vi.fn(), execute: vi.fn(), history: vi.fn(),
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: mocks.user,
  isAuthenticated: true, authState: "AUTHENTICATED", realtimeAuthGeneration: "session-one" }) }));
vi.mock("../definition-adoption-api", () => ({ readDefinitionAdoptionSelections: mocks.selections, readDefinitionAdoptionTargets: mocks.targets }));
vi.mock("../commercial-intent-execution", () => ({ executeCommercialIntent: mocks.execute,
  readCommercialHistory: mocks.history, commercialPreviewIdentity: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.user.isTenantOwner = false;
  mocks.user.permissionScopes = {};
  mocks.selections.mockResolvedValue({ expectedSubscriptionRevision: "1", items: [], nextCursor: null });
});
afterEach(cleanup);

describe("definition adoption tenant-wide admission", () => {
  it.each([
    { tenantWide: false, companyIds: ["company"], branchIds: [] },
    { tenantWide: false, companyIds: [], branchIds: ["branch"] },
    undefined,
  ])("denies a scoped or missing projection without dispatch", async (scope) => {
    if (scope) mocks.user.permissionScopes[DEFINITION_ADOPTION_PERMISSION] = scope;
    expect(canAdoptDefinitions(mocks.user)).toBe(false);
    const { result } = renderHook(() => ({ discovery: useDefinitionAdoptionDiscovery(),
      command: useCommercialChange(null, vi.fn(), true, "1") }));
    expect(result.current.discovery.denied).toBe(true);
    expect(result.current.command.denied).toBe(true);
    await act(async () => {
      result.current.discovery.reload();
      await result.current.discovery.select("selection");
      await result.current.discovery.nextSelections();
      await result.current.command.start({ expectedSubscriptionRevision: "1", changes: [] });
      await result.current.command.quote();
      await result.current.command.apply();
      await result.current.command.retry();
      await result.current.command.reload();
    });
    expect(mocks.selections).not.toHaveBeenCalled();
    expect(mocks.targets).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it.each(["tenant-wide", "owner"])("admits %s access", async (authority) => {
    mocks.user.isTenantOwner = authority === "owner";
    if (authority === "tenant-wide") mocks.user.permissionScopes[DEFINITION_ADOPTION_PERMISSION] = {
      tenantWide: true, companyIds: [], branchIds: [],
    };
    expect(canAdoptDefinitions(mocks.user)).toBe(true);
    const { result } = renderHook(() => ({ discovery: useDefinitionAdoptionDiscovery(),
      command: useCommercialChange(null, vi.fn(), true, "1") }));
    await waitFor(() => expect(result.current.command.canStart).toBe(true));
    expect(result.current.discovery.denied).toBe(false);
    expect(result.current.command.denied).toBe(false);
    expect(mocks.selections).toHaveBeenCalledTimes(1);
  });
});
