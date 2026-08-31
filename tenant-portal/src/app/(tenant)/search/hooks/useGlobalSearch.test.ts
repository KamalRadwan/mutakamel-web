// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";

const branchId = "01900100-0000-7000-8000-000000000099";
const recordId = "01900100-0000-7000-8000-000000000110";

const state = vi.hoisted(() => ({
  user: null as unknown,
  readCorePage: vi.fn(),
  readCrmBody: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: state.user }),
}));

vi.mock("@/lib/api/envelope", () => ({
  readCorePage: (...args: unknown[]) => state.readCorePage(...args),
  readCrmBody: (...args: unknown[]) => state.readCrmBody(...args),
}));

const { useGlobalSearch } = await import("./useGlobalSearch");

const ALL_PERMISSIONS = [
  "directory.party.read",
  "crm.leads.read.team",
  "crm.customer_profiles.read.all",
  "crm.opportunities.read.own",
];

function tenantUser(overrides: Record<string, unknown> = {}) {
  return {
    accessibleBranches: [branchId],
    accessibleCompanies: ["01900100-0000-7000-8000-000000000001"],
    teamMemberships: [
      {
        branchId,
        companyId: "01900100-0000-7000-8000-000000000001",
        isPrimary: true,
      },
    ],
    permissions: ALL_PERMISSIONS,
    isTenantOwner: false,
    ...overrides,
  };
}

function corePage(total = 1) {
  return {
    data: [{ id: recordId, displayName: "Acme Holdings", legalName: null }],
    meta: { total },
  };
}

/**
 * The CRM families do not share a row shape: leads and customer profiles are
 * party-backed (`displayName`), an opportunity is not (`title`). Serving one
 * shape to all three is how a mock passes a parser that would throw on real
 * data — the exact failure recorded against `useOpportunitiesList`.
 */
function crmPage(path: string, total = 1) {
  const item = path.includes("/opportunities")
    ? { id: recordId, title: "Annual renewal" }
    : { id: recordId, displayName: "Sara Nour", companyName: "Acme" };
  return {
    items: [item],
    total,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  };
}

/** The real transport error class, so `normalizeApiError` sees a 403. */
function refused() {
  return new TenantApiClientError("CRM_SCOPE_DENIED", {
    status: 403,
    statusText: "Forbidden",
    headers: new Headers(),
    data: { errorCode: "CRM_SCOPE_DENIED" },
  });
}

beforeEach(() => {
  state.user = tenantUser();
  state.readCorePage.mockResolvedValue(corePage());
  state.readCrmBody.mockImplementation(async (path) => crmPage(String(path)));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useGlobalSearch", () => {
  it("asks nothing until a term long enough to be worth a fan-out is submitted", async () => {
    const { result } = renderHook(() => useGlobalSearch(""));

    expect(result.current.hasSearched).toBe(false);
    expect(state.readCorePage).not.toHaveBeenCalled();
    expect(state.readCrmBody).not.toHaveBeenCalled();

    act(() => result.current.setDraft("a"));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.hasSearched).toBe(false));
    expect(state.readCrmBody).not.toHaveBeenCalled();
  });

  it("searches an initial term from the URL without a second interaction", async () => {
    const { result } = renderHook(() => useGlobalSearch("acme"));
    await waitFor(() => expect(result.current.results.parties.kind).toBe("ready"));
    expect(result.current.hasSearched).toBe(true);
  });

  it("reads Core through the Core reader and CRM through the CRM reader", async () => {
    // S1. The Core reader cannot even be handed a CRM path — the type
    // separation in lib/api/envelope.ts is what enforces that — so this pins
    // the runtime half: four families, one Core call and three CRM calls.
    const { result } = renderHook(() => useGlobalSearch("acme"));
    await waitFor(() => expect(result.current.results.leads.kind).toBe("ready"));

    expect(state.readCorePage).toHaveBeenCalledTimes(1);
    expect(state.readCorePage.mock.calls[0][0]).toBe(
      "/api/tenant/core/v1/directory/parties",
    );
    expect(state.readCrmBody).toHaveBeenCalledTimes(3);
    for (const call of state.readCrmBody.mock.calls) {
      expect(String(call[0])).toContain(`branchId=${branchId}`);
    }
  });

  it("degrades one refused family and keeps the other three", async () => {
    // Under Promise.all a single 403 blanked results the other sources had
    // returned perfectly well — docs/design/states.md#partial-failure.
    state.readCrmBody.mockImplementation(async (path: string) =>
      path.includes("/leads") ? Promise.reject(refused()) : crmPage(path),
    );

    const { result } = renderHook(() => useGlobalSearch("acme"));
    await waitFor(() => expect(result.current.results.leads.kind).toBe("denied"));

    expect(result.current.results.parties.kind).toBe("ready");
    expect(result.current.results.customerProfiles.kind).toBe("ready");
    expect(result.current.results.opportunities.kind).toBe("ready");
  });

  it("renders a 403 as denied, never as an empty result", async () => {
    // S7: "there is nothing here" and "this is not yours" are different
    // sentences, and only one of them is a reason to change the search term.
    state.readCrmBody.mockRejectedValue(refused());

    const { result } = renderHook(() => useGlobalSearch("acme"));
    await waitFor(() => expect(result.current.results.leads.kind).toBe("denied"));
    expect(result.current.results.leads).not.toMatchObject({ kind: "ready" });
  });

  it("offers a retry on a transport failure but not on a refusal", async () => {
    state.readCrmBody.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useGlobalSearch("acme"));
    await waitFor(() => expect(result.current.results.leads.kind).toBe("failed"));

    state.readCrmBody.mockImplementation(async (path) => crmPage(String(path)));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.results.leads.kind).toBe("ready"));
  });

  it("reports needsBranch for CRM families and still searches Core parties", async () => {
    // Every CRM list requires branchId (S2). Firing the request anyway would
    // be a 422 the user cannot read as "pick a branch".
    state.user = tenantUser({ accessibleBranches: [], teamMemberships: [] });

    const { result } = renderHook(() => useGlobalSearch("acme"));
    await waitFor(() => expect(result.current.results.parties.kind).toBe("ready"));

    expect(result.current.results.leads.kind).toBe("needsBranch");
    expect(result.current.results.opportunities.kind).toBe("needsBranch");
    expect(state.readCrmBody).not.toHaveBeenCalled();
  });

  it("never requests a family the actor holds no permission for", async () => {
    state.user = tenantUser({ permissions: ["directory.party.read"] });

    const { result } = renderHook(() => useGlobalSearch("acme"));
    await waitFor(() => expect(result.current.results.parties.kind).toBe("ready"));

    expect(result.current.visibleSourceIds).toEqual(["parties"]);
    expect(result.current.results.leads.kind).toBe("unauthorized");
    expect(state.readCrmBody).not.toHaveBeenCalled();
  });

  it("accepts a scoped CRM read grant, and an exact Core one", async () => {
    // crm.leads.read.team satisfies crm.leads.read; Core permissions carry no
    // scope suffix, so directory.party.read.all must NOT be accepted.
    state.user = tenantUser({
      permissions: ["crm.leads.read.own", "directory.party.read.all"],
    });

    const { result } = renderHook(() => useGlobalSearch("acme"));
    await waitFor(() => expect(result.current.results.leads.kind).toBe("ready"));

    expect(result.current.visibleSourceIds).toEqual(["leads"]);
    expect(result.current.results.parties.kind).toBe("unauthorized");
  });

  it("sums the server totals across every family that answered", async () => {
    state.readCorePage.mockResolvedValue(corePage(4));
    state.readCrmBody.mockImplementation(async (path) => crmPage(String(path), 2));

    const { result } = renderHook(() => useGlobalSearch("acme"));
    await waitFor(() => expect(result.current.results.opportunities.kind).toBe("ready"));

    expect(result.current.totalMatches).toBe(10);
  });
});
