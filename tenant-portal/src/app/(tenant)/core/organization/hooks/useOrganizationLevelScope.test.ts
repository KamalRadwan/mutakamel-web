// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { writeCoreData } from "@/lib/api/envelope";
import type { PermissionScope } from "@/lib/auth/permission-scope";
import type { Branch, OrgNodeOf, Team } from "../../contracts/organization-contract";
import { EMPTY_ORG_NODE_FORM } from "../organization-payloads";
import { useOrganizationLevel } from "./useOrganizationLevel";

type Department = OrgNodeOf<"departments">;

const state = vi.hoisted(() => ({
  user: {
    permissions: [] as string[],
    permissionScopes: {} as Record<string, PermissionScope>,
  },
  list: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: state.user }),
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en" }),
}));

vi.mock("@/design-system", async () => ({
  ...(await import("@/design-system/patterns/permission-gate/useCan")),
  useRealtimeResync: () => undefined,
}));

vi.mock("@/lib/api/envelope", () => ({
  readCoreData: vi.fn(),
  readCorePage: vi.fn(),
  writeCoreData: vi.fn(),
}));

vi.mock("../../contracts/organization-contract", async (original) => ({
  ...(await original<typeof import("../../contracts/organization-contract")>()),
  fetchOrgNodes: state.list,
}));

const companyA = "01900100-0000-7000-8000-000000000011";
const companyB = "01900100-0000-7000-8000-000000000012";
const branchA = "01900100-0000-7000-8000-000000000021";
const branchB = "01900100-0000-7000-8000-000000000022";
const deptInBranchA = "01900100-0000-7000-8000-000000000031";
const deptInBranchB = "01900100-0000-7000-8000-000000000032";
const teamInBranchA = "01900100-0000-7000-8000-000000000041";
const teamInBranchB = "01900100-0000-7000-8000-000000000042";

const branchRowA: Branch = {
  id: branchA,
  companyId: companyA,
  code: "BR-A",
  name: "Branch A",
  address: null,
  phone: null,
  isHeadquarters: false,
  status: "ACTIVE",
  createdAt: "2026-10-17T00:00:00.000Z",
  updatedAt: "2026-10-17T00:00:00.000Z",
};

const branchRowB: Branch = {
  ...branchRowA,
  id: branchB,
  companyId: companyB,
  code: "BR-B",
  name: "Branch B",
};

const deptRowA: Department = {
  id: deptInBranchA,
  branchId: branchA,
  code: "DEPT-A",
  name: "Department A",
  status: "ACTIVE",
  createdAt: "2026-10-17T00:00:00.000Z",
  updatedAt: "2026-10-17T00:00:00.000Z",
};

const deptRowB: Department = {
  ...deptRowA,
  id: deptInBranchB,
  branchId: branchB,
  code: "DEPT-B",
  name: "Department B",
};

const teamRowA: Team = {
  id: teamInBranchA,
  departmentId: deptInBranchA,
  leadUserId: null,
  code: "TEAM-A",
  name: "Team A",
  status: "ACTIVE",
  createdAt: "2026-10-17T00:00:00.000Z",
  updatedAt: "2026-10-17T00:00:00.000Z",
};

const teamRowB: Team = {
  ...teamRowA,
  id: teamInBranchB,
  departmentId: deptInBranchB,
  code: "TEAM-B",
  name: "Team B",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("useOrganizationLevel target-scoped permissions", () => {
  it("allows branch manage on Branch A while blocking edit/delete on Branch B and foreign-company branch create", async () => {
    state.user = {
      permissions: ["org.branch.read", "org.branch.manage"],
      permissionScopes: {
        "org.branch.read": { tenantWide: false, companyIds: [], branchIds: [branchA, branchB] },
        "org.branch.manage": { tenantWide: false, companyIds: [companyA], branchIds: [branchA] },
      },
    };
    state.list.mockResolvedValue({
      items: [branchRowA, branchRowB],
      page: 1,
      limit: 25,
      total: 2,
    });
    vi.mocked(writeCoreData).mockResolvedValue(branchRowA);

    const { result } = renderHook(() => useOrganizationLevel("branches"));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));

    expect(result.current.canCreate).toBe(true);
    expect(result.current.canManageRow(branchRowA)).toBe(true);
    expect(result.current.canManageRow(branchRowB)).toBe(false);

    // Out-of-scope row actions and foreign-company create fail closed without dispatching writes
    act(() => {
      result.current.startEdit(branchRowB);
      result.current.requestDelete(branchRowB);
    });
    expect(result.current.editing).toBeNull();
    expect(result.current.pendingDelete).toBeNull();

    await act(async () => {
      expect(
        await result.current.handleCreate({
          ...EMPTY_ORG_NODE_FORM,
          companyId: companyB,
          code: "BR-NEW",
          name: "Unauthorized Branch",
        }),
      ).toBe(false);
    });
    expect(writeCoreData).not.toHaveBeenCalled();

    // Authorized companyA create succeeds
    await act(async () => {
      expect(
        await result.current.handleCreate({
          ...EMPTY_ORG_NODE_FORM,
          companyId: companyA,
          code: "BR-OK",
          name: "Authorized Branch",
        }),
      ).toBe(true);
    });
    expect(writeCoreData).toHaveBeenCalledOnce();
  });

  it("scopes department create/edit/delete to owning branchId", async () => {
    state.user = {
      permissions: ["org.department.read", "org.department.manage"],
      permissionScopes: {
        "org.department.read": { tenantWide: false, companyIds: [], branchIds: [branchA, branchB] },
        "org.department.manage": { tenantWide: false, companyIds: [], branchIds: [branchA] },
      },
    };
    state.list.mockResolvedValue({
      items: [deptRowA, deptRowB],
      page: 1,
      limit: 25,
      total: 2,
    });

    const { result } = renderHook(() => useOrganizationLevel("departments"));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));

    expect(result.current.canManageRow(deptRowA)).toBe(true);
    expect(result.current.canManageRow(deptRowB)).toBe(false);
    expect(
      result.current.canSubmitCreate({ ...EMPTY_ORG_NODE_FORM, branchId: branchA }),
    ).toBe(true);
    expect(
      result.current.canSubmitCreate({ ...EMPTY_ORG_NODE_FORM, branchId: branchB }),
    ).toBe(false);
  });

  it("fails closed for branch-scoped team manage until owning department lookup resolves branchId", async () => {
    state.user = {
      permissions: ["org.team.read", "org.team.manage", "org.department.read"],
      permissionScopes: {
        "org.team.read": { tenantWide: false, companyIds: [], branchIds: [branchA, branchB] },
        "org.team.manage": { tenantWide: false, companyIds: [], branchIds: [branchA] },
        "org.department.read": { tenantWide: false, companyIds: [], branchIds: [branchA, branchB] },
      },
    };
    const pendingDepartments = deferred<{
      items: Department[];
      page: number;
      limit: number;
      total: number;
    }>();

    state.list.mockImplementation((level: string) => {
      if (level === "teams") {
        return Promise.resolve({ items: [teamRowA, teamRowB], page: 1, limit: 25, total: 2 });
      }
      if (level === "departments") {
        return pendingDepartments.promise;
      }
      return Promise.resolve({ items: [], page: 1, limit: 100, total: 0 });
    });

    const { result } = renderHook(() => useOrganizationLevel("teams"));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));

    // Before department lookup resolves, branch-scoped team manage must fail closed
    expect(result.current.canManageRow(teamRowA)).toBe(false);
    expect(result.current.canManageRow(teamRowB)).toBe(false);
    await act(async () => {
      expect(
        await result.current.handleCreate({
          ...EMPTY_ORG_NODE_FORM,
          departmentId: deptInBranchA,
          code: "TM1",
          name: "Pending Team",
        }),
      ).toBe(false);
    });
    expect(writeCoreData).not.toHaveBeenCalled();

    // Once departments resolve, Team A (in Branch A) is manageable and Team B (in Branch B) remains denied
    await act(async () => {
      pendingDepartments.resolve({
        items: [deptRowA, deptRowB],
        page: 1,
        limit: 100,
        total: 2,
      });
      await pendingDepartments.promise;
    });

    await waitFor(() => expect(result.current.canManageRow(teamRowA)).toBe(true));
    expect(result.current.canManageRow(teamRowB)).toBe(false);
    expect(
      result.current.canSubmitCreate({ ...EMPTY_ORG_NODE_FORM, departmentId: deptInBranchA }),
    ).toBe(true);
    expect(
      result.current.canSubmitCreate({ ...EMPTY_ORG_NODE_FORM, departmentId: deptInBranchB }),
    ).toBe(false);
  });
});
