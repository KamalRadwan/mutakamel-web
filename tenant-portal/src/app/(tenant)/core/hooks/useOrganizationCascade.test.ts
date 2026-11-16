// @vitest-environment jsdom

import { useState } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { CorePage } from "../contracts/core-page";
import {
  fetchOrgNodes,
  type OrgLevel,
  type OrgNodeOf,
} from "../contracts/organization-contract";
import type { RemoteOptions } from "./useCoreOptions";
import {
  buildCascadeSelectionPatch,
  type CascadePatchFlags,
  type OrganizationCascadeLevel,
  type OrganizationCascadePatch,
  type OrganizationCascadeSelection,
} from "./organization-cascade-helpers";
import {
  getSoleEligibleOptionId,
  isRemoteOptionsEmpty,
  isRemoteOptionsForbidden,
  isSoleEligibleOption,
  useOrganizationCascade,
  type OrganizationCascadeResult,
  type UseOrganizationCascadeOptions,
} from "./useOrganizationCascade";

vi.mock("@/i18n/useLanguage", () => ({ useLanguage: () => "en" }));
vi.mock("../contracts/organization-contract", () => ({ fetchOrgNodes: vi.fn() }));

const COMPANY_A = "019f3100-0000-7000-8000-000000000001";
const COMPANY_B = "019f3100-0000-7000-8000-000000000002";
const BRANCH_A1 = "019f3100-0000-7000-8000-000000000011";
const BRANCH_B1 = "019f3100-0000-7000-8000-000000000012";
const BRANCH_B2 = "019f3100-0000-7000-8000-000000000013";
const DEPT_A1 = "019f3100-0000-7000-8000-000000000021";
const DEPT_B1 = "019f3100-0000-7000-8000-000000000022";
const TEAM_A1 = "019f3100-0000-7000-8000-000000000031";
const NOW = "2026-11-01T10:00:00.000Z";

function makePage<T>(items: T[], extra: Partial<Omit<CorePage<T>, "items">> = {}): CorePage<T> {
  const total = extra.total ?? items.length;
  return {
    items,
    page: 1,
    limit: 100,
    total,
    totalPages: total === 0 ? 0 : 1,
    hasNext: extra.hasNext ?? false,
    hasPrev: false,
  };
}

function makeNode(level: OrgLevel, id: string, parentId = COMPANY_A): OrgNodeOf<OrgLevel> {
  const base = { id, code: id.slice(-4), name: `${level}-${id.slice(-2)}`, status: "ACTIVE" as const, createdAt: NOW, updatedAt: NOW };
  if (level === "companies") return { ...base, legalName: null, taxNumber: null, currencyCode: "SAR" };
  if (level === "branches") return { ...base, companyId: parentId, address: null, phone: null, isHeadquarters: false };
  if (level === "departments") return { ...base, branchId: parentId };
  return { ...base, departmentId: parentId, leadUserId: null };
}

function useControlledCascade(
  initial: Partial<OrganizationCascadeSelection> = {},
  extra: Partial<Omit<UseOrganizationCascadeOptions, "companyId" | "onChange">> = {},
): {
  state: OrganizationCascadeSelection;
  patches: OrganizationCascadePatch[];
  cascade: OrganizationCascadeResult;
} {
  const [state, setState] = useState<OrganizationCascadeSelection>({
    companyId: initial.companyId ?? "",
    branchId: initial.branchId ?? "",
    departmentId: initial.departmentId ?? "",
    teamId: initial.teamId ?? "",
  });
  const [patches, setPatches] = useState<OrganizationCascadePatch[]>([]);
  const cascade = useOrganizationCascade({
    enabled: extra.enabled ?? true,
    companyId: state.companyId,
    branchId: state.branchId,
    departmentId: state.departmentId,
    teamId: state.teamId,
    includeBranches: extra.includeBranches ?? true,
    includeDepartments: extra.includeDepartments ?? true,
    includeTeams: extra.includeTeams ?? true,
    autoSelectTeams: extra.autoSelectTeams ?? false,
    onChange: (patch) => {
      setPatches((prev) => [...prev, patch]);
      setState((prev) => ({ ...prev, ...patch }));
    },
  });
  return { state, patches, cascade };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("organization cascade helpers", () => {
  it("accepts only unsearched single-page active singletons and distinguishes 403 from empty", () => {
    const base: RemoteOptions = {
      options: [{ value: COMPANY_A, label: "Alpha" }],
      isLoading: false,
      isReady: true,
      isUnsearchedReady: true,
      total: 1,
      hasNext: false,
      search: vi.fn(),
      labelFor: () => undefined,
    };
    expect(getSoleEligibleOptionId(base)).toBe(COMPANY_A);
    expect(isSoleEligibleOption(base)).toBe(true);
    expect(isSoleEligibleOption({ ...base, isUnsearchedReady: false })).toBe(false);
    expect(isSoleEligibleOption({ ...base, hasNext: true, total: 2 })).toBe(false);
    expect(isSoleEligibleOption({ ...base, options: [{ value: COMPANY_A, label: "Alpha", disabled: true }] })).toBe(false);

    const forbidden: RemoteOptions = {
      ...base,
      options: [],
      isReady: false,
      isUnsearchedReady: false,
      total: undefined,
      hasNext: undefined,
      error: { status: 403, code: "FORBIDDEN" },
    };
    expect(isRemoteOptionsForbidden(forbidden)).toBe(true);
    expect(isRemoteOptionsEmpty(forbidden)).toBe(false);
    expect(isRemoteOptionsEmpty({ ...base, options: [], total: 0 })).toBe(true);

    const level: OrganizationCascadeLevel = "company";
    const flags: CascadePatchFlags = { includeBranches: true, includeDepartments: false, includeTeams: false };
    expect(buildCascadeSelectionPatch(level, COMPANY_A, flags)).toEqual({
      companyId: COMPANY_A,
      branchId: "",
    });
  });
});

describe("useOrganizationCascade", () => {
  it("auto-selects chained singletons through actual parent keys and leaves optional team blank", async () => {
    vi.mocked(fetchOrgNodes).mockImplementation(async (level, opts) => {
      if (level === "companies") return makePage([makeNode("companies", COMPANY_A)]);
      if (level === "branches" && opts.parentId === COMPANY_A) return makePage([makeNode("branches", BRANCH_A1, COMPANY_A)]);
      if (level === "departments" && opts.parentId === BRANCH_A1) return makePage([makeNode("departments", DEPT_A1, BRANCH_A1)]);
      if (level === "teams" && opts.parentId === DEPT_A1) return makePage([makeNode("teams", TEAM_A1, DEPT_A1)]);
      return makePage([]);
    });

    const { result } = renderHook(() => useControlledCascade());
    await waitFor(() => expect(result.current.cascade.teams.isUnsearchedReady).toBe(true));

    expect(result.current.state).toEqual({
      companyId: COMPANY_A,
      branchId: BRANCH_A1,
      departmentId: DEPT_A1,
      teamId: "",
    });
    expect(fetchOrgNodes).toHaveBeenCalledWith("departments", expect.objectContaining({ parentId: BRANCH_A1 }));
    expect(fetchOrgNodes).toHaveBeenCalledWith("teams", expect.objectContaining({ parentId: DEPT_A1 }));
  });

  it("leaves multiple options unselected and preserves pre-populated Edit selections without dirtying", async () => {
    vi.mocked(fetchOrgNodes).mockImplementation(async (level) => {
      if (level === "companies") {
        return makePage([makeNode("companies", COMPANY_A), makeNode("companies", COMPANY_B)]);
      }
      return makePage([makeNode(level, BRANCH_A1)]);
    });

    const createHook = renderHook(() => useControlledCascade());
    await waitFor(() => expect(createHook.result.current.cascade.companies.isUnsearchedReady).toBe(true));
    expect(createHook.result.current.state.companyId).toBe("");
    expect(fetchOrgNodes).toHaveBeenCalledTimes(1);

    const editHook = renderHook(() =>
      useControlledCascade({
        companyId: COMPANY_B,
        branchId: BRANCH_B1,
        departmentId: DEPT_B1,
        teamId: TEAM_A1,
      }),
    );
    await waitFor(() => expect(editHook.result.current.cascade.teams.isUnsearchedReady).toBe(true));
    expect(editHook.result.current.patches).toEqual([]);
    expect(editHook.result.current.state).toEqual({
      companyId: COMPANY_B,
      branchId: BRANCH_B1,
      departmentId: DEPT_B1,
      teamId: TEAM_A1,
    });
  });

  it("resets descendants on upstream change, ignores same-value reselect, and fences stale races", async () => {
    let resolveSlowBranchesA!: (page: CorePage<OrgNodeOf<OrgLevel>>) => void;

    vi.mocked(fetchOrgNodes).mockImplementation((level, opts) => {
      if (level === "companies") {
        return Promise.resolve(makePage([makeNode("companies", COMPANY_A), makeNode("companies", COMPANY_B)]));
      }
      if (level === "branches" && opts.parentId === COMPANY_A) {
        return new Promise((resolve) => { resolveSlowBranchesA = resolve; });
      }
      if (level === "branches" && opts.parentId === COMPANY_B) {
        return Promise.resolve(makePage([makeNode("branches", BRANCH_B1, COMPANY_B), makeNode("branches", BRANCH_B2, COMPANY_B)]));
      }
      if (level === "departments") {
        return Promise.resolve(makePage([makeNode("departments", DEPT_B1, opts.parentId ?? BRANCH_B1)]));
      }
      return Promise.resolve(makePage([makeNode("teams", TEAM_A1, opts.parentId ?? DEPT_B1)]));
    });

    const { result } = renderHook(() => useControlledCascade());
    await waitFor(() => expect(result.current.cascade.companies.isUnsearchedReady).toBe(true));

    act(() => result.current.cascade.selectCompany(COMPANY_A));
    await waitFor(() => expect(resolveSlowBranchesA).toBeTypeOf("function"));

    act(() => result.current.cascade.selectCompany(COMPANY_B));
    await waitFor(() => expect(result.current.cascade.branches.isUnsearchedReady).toBe(true));

    await act(async () => {
      resolveSlowBranchesA(makePage([makeNode("branches", BRANCH_A1, COMPANY_A)]));
    });
    expect(result.current.state.companyId).toBe(COMPANY_B);
    expect(result.current.state.branchId).toBe("");

    act(() => result.current.cascade.selectBranch(BRANCH_B1));
    await waitFor(() => expect(result.current.state.departmentId).toBe(DEPT_B1));
    act(() => result.current.cascade.selectTeam(TEAM_A1));
    expect(result.current.state.teamId).toBe(TEAM_A1);

    const patchCountBeforeNoop = result.current.patches.length;
    act(() => result.current.cascade.selectCompany(COMPANY_B));
    expect(result.current.patches).toHaveLength(patchCountBeforeNoop);
    expect(result.current.state.departmentId).toBe(DEPT_B1);

    act(() => result.current.cascade.selectTeam(undefined));
    expect(result.current.state.teamId).toBe("");

    act(() => result.current.cascade.selectBranch(BRANCH_B2));
    expect(result.current.state).toEqual({
      companyId: COMPANY_B,
      branchId: BRANCH_B2,
      departmentId: "",
      teamId: "",
    });
  });

  it("gates child fetches when disabled or missing parent, surfaces 403, and resumes on retry", async () => {
    const forbidden = new TenantApiClientError("Forbidden", {
      status: 403,
      statusText: "Forbidden",
      headers: new Headers(),
      data: { errorCode: "AUTH_INSUFFICIENT_PERMISSIONS", message: "Denied" },
    });
    let failBranches = true;
    vi.mocked(fetchOrgNodes).mockImplementation(async (level, opts) => {
      if (level === "companies") return makePage([makeNode("companies", COMPANY_A)]);
      if (level === "branches" && opts.parentId === COMPANY_A) {
        if (failBranches) throw forbidden;
        return makePage([makeNode("branches", BRANCH_A1, COMPANY_A)]);
      }
      if (level === "departments" && opts.parentId === BRANCH_A1) {
        return makePage([makeNode("departments", DEPT_A1, BRANCH_A1)]);
      }
      return makePage([]);
    });

    const disabledHook = renderHook(() => useControlledCascade({}, { enabled: false }));
    await act(async () => {});
    expect(fetchOrgNodes).not.toHaveBeenCalled();
    disabledHook.unmount();

    const { result } = renderHook(() => useControlledCascade({}, { includeTeams: false }));
    await waitFor(() => expect(isRemoteOptionsForbidden(result.current.cascade.branches)).toBe(true));

    expect(isRemoteOptionsEmpty(result.current.cascade.branches)).toBe(false);
    expect(result.current.state.branchId).toBe("");
    expect(fetchOrgNodes).not.toHaveBeenCalledWith("departments", expect.anything());

    failBranches = false;
    act(() => result.current.cascade.branches.retry?.());
    await waitFor(() => expect(result.current.state.departmentId).toBe(DEPT_A1));
    expect(result.current.state.branchId).toBe(BRANCH_A1);
  });
});
