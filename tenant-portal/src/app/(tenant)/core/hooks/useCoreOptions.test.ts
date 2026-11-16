// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { CorePage } from "../contracts/core-page";
import {
  fetchOrgNodes,
  type OrgLevel,
  type OrgNodeOf,
} from "../contracts/organization-contract";
import { fetchTenantRoles, type TenantRole } from "../contracts/role-contract";
import { fetchTenantUsers, type TenantUser } from "../contracts/user-contract";
import {
  useOrgNodeOptions,
  useRoleOptions,
  useTenantUserOptions,
} from "./useCoreOptions";

vi.mock("@/i18n/useLanguage", () => ({ useLanguage: () => "en" }));
vi.mock("../contracts/organization-contract", () => ({ fetchOrgNodes: vi.fn() }));
vi.mock("../contracts/user-contract", () => ({
  fetchTenantUsers: vi.fn(),
  userDisplayName: (user: { firstName: string; lastName: string }) =>
    `${user.firstName} ${user.lastName}`,
}));
vi.mock("../contracts/role-contract", () => ({ fetchTenantRoles: vi.fn() }));

const COMPANY_A_ID = "019f3000-0000-7000-8000-000000000001";
const COMPANY_B_ID = "019f3000-0000-7000-8000-000000000002";
const BRANCH_A1_ID = "019f3000-0000-7000-8000-000000000011";
const BRANCH_A2_ID = "019f3000-0000-7000-8000-000000000012";
const BRANCH_B1_ID = "019f3000-0000-7000-8000-000000000013";
const DEPT_A1_ID = "019f3000-0000-7000-8000-000000000021";
const TEAM_A1_ID = "019f3000-0000-7000-8000-000000000031";
const USER_1_ID = "019f3000-0000-7000-8000-000000000041";
const ROLE_OWNER_ID = "019f3000-0000-7000-8000-000000000051";
const ROLE_AUDITOR_ID = "019f3000-0000-7000-8000-000000000052";
const CORRELATION_ID = "019f3000-0000-7000-8000-000000000099";
const NOW = "2026-11-01T10:00:00.000Z";

function makePage<T>(
  items: T[],
  overrides: Partial<Omit<CorePage<T>, "items">> = {},
): CorePage<T> {
  const total = overrides.total ?? items.length;
  return {
    items,
    page: overrides.page ?? 1,
    limit: overrides.limit ?? 100,
    total,
    totalPages: overrides.totalPages ?? (total === 0 ? 0 : 1),
    hasNext: overrides.hasNext ?? false,
    hasPrev: overrides.hasPrev ?? false,
  };
}

function makeBranch(id: string, companyId: string, name: string, code: string): OrgNodeOf<"branches"> {
  return {
    id,
    companyId,
    name,
    code,
    status: "ACTIVE",
    address: null,
    phone: null,
    isHeadquarters: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("useCoreOptions", () => {
  it("preserves exact total, hasNext, and unsearched readiness for an unsearched singleton", async () => {
    const company: OrgNodeOf<"companies"> = {
      id: COMPANY_A_ID,
      code: "CMP-01",
      name: "Mersany Holding",
      status: "ACTIVE",
      legalName: null,
      taxNumber: null,
      currencyCode: "SAR",
      createdAt: NOW,
      updatedAt: NOW,
    };
    vi.mocked(fetchOrgNodes).mockResolvedValueOnce(makePage([company]));

    const { result } = renderHook(() => useOrgNodeOptions("companies"));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isReady).toBe(false);
    expect(result.current.isUnsearchedReady).toBe(false);

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(fetchOrgNodes).toHaveBeenCalledWith("companies", {
      page: 1,
      search: "",
      status: "ACTIVE",
      parentId: undefined,
      limit: 100,
      signal: expect.any(AbortSignal),
      suppressForbiddenToast: true,
    });
    expect(result.current.isUnsearchedReady).toBe(true);
    expect(result.current.total).toBe(1);
    expect(result.current.hasNext).toBe(false);
    expect(result.current.options).toEqual([
      { value: COMPANY_A_ID, label: "Mersany Holding" },
    ]);
    expect(result.current.labelFor(COMPANY_A_ID)).toBe("Mersany Holding");
  });

  it("distinguishes a multi-page first page and a searched singleton from an unsearched singleton", async () => {
    const branch1 = makeBranch(BRANCH_A1_ID, COMPANY_A_ID, "Riyadh HQ", "BR-01");
    const branch2 = makeBranch(BRANCH_A2_ID, COMPANY_A_ID, "Jeddah Port", "BR-02");
    vi.mocked(fetchOrgNodes)
      .mockResolvedValueOnce(
        makePage([branch1], { total: 2, limit: 1, totalPages: 2, hasNext: true }),
      )
      .mockResolvedValueOnce(makePage([branch2], { total: 1, hasNext: false }))
      .mockResolvedValueOnce(makePage([branch1, branch2], { total: 2, hasNext: false }));

    const { result } = renderHook(() =>
      useOrgNodeOptions("branches", { parentId: COMPANY_A_ID }),
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.isUnsearchedReady).toBe(true);
    expect(result.current.total).toBe(2);
    expect(result.current.hasNext).toBe(true);

    act(() => result.current.search("Jeddah"));
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.options).toHaveLength(1);
    expect(result.current.total).toBe(1);
    expect(result.current.hasNext).toBe(false);
    expect(result.current.isUnsearchedReady).toBe(false);
    expect(result.current.labelFor(BRANCH_A1_ID)).toBe("Riyadh HQ");

    act(() => result.current.search("   "));
    await waitFor(() => expect(result.current.isUnsearchedReady).toBe(true));
    expect(result.current.total).toBe(2);
  });

  it("gates disabled pickers, exposes 403 without faking empty, and recovers on retry", async () => {
    const forbidden = new TenantApiClientError("Forbidden", {
      status: 403,
      statusText: "Forbidden",
      headers: new Headers(),
      data: {
        errorCode: "AUTH_INSUFFICIENT_PERMISSIONS",
        message: "Missing organization read permission",
        correlationId: CORRELATION_ID,
      },
    });
    const dept: OrgNodeOf<"departments"> = {
      id: DEPT_A1_ID,
      branchId: BRANCH_A1_ID,
      name: "Operations",
      code: "DEP-01",
      status: "ACTIVE",
      createdAt: NOW,
      updatedAt: NOW,
    };
    vi.mocked(fetchOrgNodes)
      .mockRejectedValueOnce(forbidden)
      .mockResolvedValueOnce(makePage([dept]));

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useOrgNodeOptions("departments", { parentId: BRANCH_A1_ID, enabled }),
      { initialProps: { enabled: false } },
    );

    await act(async () => {});
    expect(fetchOrgNodes).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isReady).toBe(false);

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.error?.status).toBe(403));
    expect(result.current.error?.code).toBe("AUTH_INSUFFICIENT_PERMISSIONS");
    expect(result.current.isReady).toBe(false);
    expect(result.current.isUnsearchedReady).toBe(false);
    expect(result.current.total).toBeUndefined();
    expect(result.current.hasNext).toBeUndefined();
    expect(result.current.options).toEqual([]);

    act(() => result.current.retry?.());
    await waitFor(() => expect(result.current.isUnsearchedReady).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.options).toEqual([
      { value: DEPT_A1_ID, label: "Operations", description: "DEP-01" },
    ]);
  });

  it("fences out-of-order responses when parentId changes", async () => {
    let resolveSlowA!: (page: CorePage<OrgNodeOf<OrgLevel>>) => void;
    const branchA = makeBranch(BRANCH_A1_ID, COMPANY_A_ID, "Stale Branch A", "BR-A");
    const branchB = makeBranch(BRANCH_B1_ID, COMPANY_B_ID, "Fresh Branch B", "BR-B");

    vi.mocked(fetchOrgNodes)
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveSlowA = resolve; }),
      )
      .mockResolvedValueOnce(makePage([branchB]));

    const { result, rerender } = renderHook(
      ({ parentId }: { parentId: string }) => useOrgNodeOptions("branches", { parentId }),
      { initialProps: { parentId: COMPANY_A_ID } },
    );
    await waitFor(() => expect(fetchOrgNodes).toHaveBeenCalledTimes(1));

    rerender({ parentId: COMPANY_B_ID });
    await waitFor(() => expect(result.current.isUnsearchedReady).toBe(true));
    expect(result.current.options.map((opt) => opt.value)).toEqual([BRANCH_B1_ID]);

    await act(async () => {
      resolveSlowA(makePage([branchA]));
    });
    expect(result.current.options.map((opt) => opt.value)).toEqual([BRANCH_B1_ID]);
    expect(result.current.labelFor(BRANCH_A1_ID)).toBeUndefined();
  });

  it("loads user options and computes role totals safely when excluding Tenant Super Admin", async () => {
    const user: TenantUser = {
      id: USER_1_ID,
      email: "lead@mersany.example",
      firstName: "Sara",
      lastName: "Saleh",
      employeeCode: null,
      companyId: COMPANY_A_ID,
      branchId: BRANCH_A1_ID,
      departmentId: DEPT_A1_ID,
      teamId: TEAM_A1_ID,
      managerId: null,
      jobTitle: null,
      isTenantOwner: false,
      status: "ACTIVE",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const ownerRole: TenantRole = {
      id: ROLE_OWNER_ID,
      name: "Tenant Super Admin",
      nameAr: "مالك المستأجر",
      nameEn: "Tenant Super Admin",
      descriptionAr: null,
      descriptionEn: null,
      isSystem: true,
      permissionMode: "GLOBAL",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const auditorRole: TenantRole = {
      id: ROLE_AUDITOR_ID,
      name: "Auditor",
      nameAr: "مدقق",
      nameEn: "Auditor",
      descriptionAr: null,
      descriptionEn: null,
      isSystem: false,
      permissionMode: "GLOBAL",
      createdAt: NOW,
      updatedAt: NOW,
    };

    vi.mocked(fetchTenantUsers).mockResolvedValueOnce(makePage([user]));
    vi.mocked(fetchTenantRoles)
      .mockResolvedValueOnce(makePage([ownerRole, auditorRole], { total: 2, hasNext: false }))
      .mockResolvedValueOnce(makePage([auditorRole], { total: 3, hasNext: true, totalPages: 2 }));

    const usersHook = renderHook(() => useTenantUserOptions(true));
    await waitFor(() => expect(usersHook.result.current.isUnsearchedReady).toBe(true));
    expect(usersHook.result.current.total).toBe(1);
    expect(usersHook.result.current.options[0]?.label).toBe("Sara Saleh");

    const singlePageRoles = renderHook(() => useRoleOptions(true, true));
    await waitFor(() => expect(singlePageRoles.result.current.isUnsearchedReady).toBe(true));
    expect(singlePageRoles.result.current.options.map((opt) => opt.value)).toEqual([
      ROLE_AUDITOR_ID,
    ]);
    expect(singlePageRoles.result.current.total).toBe(1);

    const multiPageRoles = renderHook(() => useRoleOptions(true, true));
    await waitFor(() => expect(multiPageRoles.result.current.isUnsearchedReady).toBe(true));
    expect(multiPageRoles.result.current.hasNext).toBe(true);
    expect(multiPageRoles.result.current.total).toBeUndefined();
  });
});
