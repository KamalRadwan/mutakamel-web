// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";

const branchId = "01900100-0000-7000-8000-000000000099";
const companyId = "01900100-0000-7000-8000-000000000001";

const state = vi.hoisted(() => ({
  user: null as unknown,
  readCrmBody: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: state.user }),
}));

vi.mock("@/lib/api/envelope", () => ({
  readCrmBody: (...args: unknown[]) => state.readCrmBody(...args),
}));

const { useFirstRunChecklist } = await import("./useFirstRunChecklist");

const CRM_PERMISSIONS = [
  "org.company.read",
  "org.branch.read",
  "crm.lead_stages.read",
  "crm.pipelines.manage",
  "crm.pipelines.read",
  "trade.items.read",
];

function tenantUser(overrides: Record<string, unknown> = {}) {
  return {
    accessibleBranches: [branchId],
    accessibleCompanies: [companyId],
    teamMemberships: [],
    permissions: CRM_PERMISSIONS,
    isTenantOwner: true,
    ...overrides,
  };
}

function refused() {
  return new TenantApiClientError("CRM_FORBIDDEN", {
    status: 403,
    statusText: "Forbidden",
    headers: new Headers(),
    data: { errorCode: "CRM_FORBIDDEN" },
  });
}

beforeEach(() => {
  state.user = tenantUser();
  state.readCrmBody.mockResolvedValue([{ id: "a" }]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useFirstRunChecklist", () => {
  it("answers the zero-data case from /auth/me alone, with no request", async () => {
    // resolveAccess builds accessibleBranches for an OWNER as
    // `SELECT id FROM branches` with no user join, so an empty array is the
    // tenant's own state and needs no confirming call.
    state.user = tenantUser({ accessibleCompanies: [], accessibleBranches: [] });
    state.readCrmBody.mockResolvedValue([]);

    const { result } = renderHook(() => useFirstRunChecklist());

    expect(result.current.statuses.company).toBe("todo");
    expect(result.current.isZeroData).toBe(true);
    expect(result.current.nextStep).toBe("company");
  });

  it("blocks a branch behind its company rather than offering an action that would fail", async () => {
    state.user = tenantUser({ accessibleCompanies: [], accessibleBranches: [] });

    const { result } = renderHook(() => useFirstRunChecklist());
    expect(result.current.statuses.branch).toBe("blocked");
  });

  it("marks a populated catalogue done and an empty one as the next action", async () => {
    state.user = tenantUser();
    state.readCrmBody.mockImplementation(async (path: string) =>
      path.includes("lead-stages") ? [] : [{ id: "a" }],
    );

    const { result } = renderHook(() => useFirstRunChecklist());
    await waitFor(() => expect(result.current.isChecking).toBe(false));

    expect(result.current.statuses.leadStages).toBe("todo");
    expect(result.current.statuses.pipeline).toBe("done");
    expect(result.current.nextStep).toBe("leadStages");
  });

  it("degrades one refused probe without blanking the other five rows", async () => {
    // allSettled, not all: a 403 on one catalogue must not take down a
    // checklist whose scope steps are already known from /auth/me.
    state.readCrmBody.mockImplementation(async (path: string) =>
      path.includes("lead-stages") ? Promise.reject(refused()) : [{ id: "a" }],
    );

    const { result } = renderHook(() => useFirstRunChecklist());
    await waitFor(() => expect(result.current.isChecking).toBe(false));

    expect(result.current.statuses.leadStages).toBe("unauthorized");
    expect(result.current.statuses.pipeline).toBe("done");
    expect(result.current.statuses.company).toBe("done");
  });

  it("reports a failed probe as unchecked, never as done or todo", async () => {
    // Guessing either way is worse than saying so: "done" hides work, "todo"
    // sends the user to create a duplicate.
    state.readCrmBody.mockImplementation(async (path: string) =>
      path.includes("pipelines") ? Promise.reject(new Error("offline")) : [{ id: "a" }],
    );

    const { result } = renderHook(() => useFirstRunChecklist());
    await waitFor(() => expect(result.current.isChecking).toBe(false));

    expect(result.current.statuses.pipeline).toBe("unchecked");
    expect(result.current.degradedSteps).toEqual(["pipeline"]);
  });

  it("never probes a catalogue the actor holds no permission for", async () => {
    state.user = tenantUser({ permissions: ["org.company.read", "org.branch.read"] });

    const { result } = renderHook(() => useFirstRunChecklist());
    await waitFor(() => expect(result.current.isChecking).toBe(false));

    expect(state.readCrmBody).not.toHaveBeenCalled();
    expect(result.current.statuses.leadStages).toBe("unauthorized");
  });

  it("leaves trade items unchecked rather than firing a request that needs a branch", async () => {
    // GET /trade/v1/items needs a resolved TradeRequestContext and
    // GET /trade/v1/uoms is BRANCH_REQUIRED at the Gateway — Q112.
    const { result } = renderHook(() => useFirstRunChecklist());
    await waitFor(() => expect(result.current.isChecking).toBe(false));

    expect(result.current.statuses.items).toBe("unchecked");
    for (const call of state.readCrmBody.mock.calls) {
      expect(String(call[0])).not.toContain("/trade/");
    }
  });

  it("distinguishes an owner's empty scope from a member's", async () => {
    // For an owner an empty branch list means the tenant has none; for a
    // member it means none is granted to them. Two different sentences.
    state.user = tenantUser({ isTenantOwner: false, accessibleBranches: [] });
    const member = renderHook(() => useFirstRunChecklist());
    expect(member.result.current.isTenantOwner).toBe(false);

    state.user = tenantUser({ isTenantOwner: true, accessibleBranches: [] });
    const owner = renderHook(() => useFirstRunChecklist());
    expect(owner.result.current.isTenantOwner).toBe(true);
  });
});
