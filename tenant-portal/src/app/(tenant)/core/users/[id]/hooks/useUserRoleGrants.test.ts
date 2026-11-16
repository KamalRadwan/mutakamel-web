// @vitest-environment jsdom

import { useState } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchBranchRoleAssignments,
  fetchScopeRoleAssignments,
  replaceBranchRoleAssignments,
  replaceScopeRoleAssignments,
  type BranchRoleAssignment,
  type ScopeRoleAssignmentInput,
} from "../../../contracts/role-assignment-contract";
import { useScopeRoleDraftForm } from "./useScopeRoleDraftForm";
import { useUserRoleGrants } from "./useUserRoleGrants";

vi.mock("@/i18n/useLanguage", () => ({ useLanguage: () => "en" }));
vi.mock("../../../hooks/useCoreOptions", () => ({
  useOrgNodeOptions: () => ({
    options: [],
    isLoading: false,
    isReady: true,
    isUnsearchedReady: true,
    total: 0,
    hasNext: false,
    labelFor: () => undefined,
    search: vi.fn(),
  }),
}));
vi.mock("../../../contracts/role-assignment-contract", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../contracts/role-assignment-contract")>()),
  fetchBranchRoleAssignments: vi.fn(),
  fetchScopeRoleAssignments: vi.fn(),
  replaceBranchRoleAssignments: vi.fn(),
  replaceScopeRoleAssignments: vi.fn(),
}));

const USER_ID = "0192f3a0-0000-7000-8000-000000000002";
const SECOND_USER_ID = "0192f3a0-0000-7000-8000-000000000009";
const ROLE_A = "0192f3a0-0000-7000-8000-000000000011";
const ROLE_B = "0192f3a0-0000-7000-8000-000000000012";
const COMPANY_A = "0192f3a0-0000-7000-8000-000000000021";
const COMPANY_B = "0192f3a0-0000-7000-8000-000000000022";
const BRANCH_A = "0192f3a0-0000-7000-8000-000000000031";
const BRANCH_B = "0192f3a0-0000-7000-8000-000000000032";

beforeEach(() => {
  vi.mocked(fetchBranchRoleAssignments).mockResolvedValue([]);
  vi.mocked(fetchScopeRoleAssignments).mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("loads and reloads branch grants without requesting scope grants for non-owners", async () => {
  const { result } = renderHook(() => useUserRoleGrants(USER_ID, true, false));
  await waitFor(() => expect(fetchBranchRoleAssignments).toHaveBeenCalledTimes(1));
  act(() => result.current.reload());
  await waitFor(() => expect(fetchBranchRoleAssignments).toHaveBeenCalledTimes(2));
  expect(fetchScopeRoleAssignments).not.toHaveBeenCalled();
  expect(result.current.scopeError).toBeNull();
  expect(result.current.isScopeLoading).toBe(false);
});

it("loads scope grants for owners and clears a previous failure when ownership is lost", async () => {
  vi.mocked(fetchScopeRoleAssignments).mockRejectedValue(new Error("Unavailable"));
  const { result, rerender } = renderHook(
    ({ isOwner }) => useUserRoleGrants(USER_ID, true, isOwner),
    { initialProps: { isOwner: true } },
  );
  await waitFor(() => expect(result.current.scopeError).not.toBeNull());
  rerender({ isOwner: false });
  await waitFor(() => expect(result.current.scopeError).toBeNull());
  act(() => result.current.reload());
  await waitFor(() => expect(fetchBranchRoleAssignments).toHaveBeenCalledTimes(3));
  expect(fetchScopeRoleAssignments).toHaveBeenCalledTimes(1);
  expect(result.current.isScopeLoading).toBe(false);
});

describe("atomic replacement diffs, baseline target tracking, and failure preservation", () => {
  it("computes branch role replacement diff and preserves draft when PUT fails", async () => {
    vi.mocked(fetchBranchRoleAssignments).mockResolvedValue([
      {
        id: "0192f3a0-0000-7000-8000-000000000091",
        tenantUserId: USER_ID,
        branchId: BRANCH_A,
        roleId: ROLE_A,
      },
    ]);
    vi.mocked(replaceBranchRoleAssignments).mockRejectedValueOnce(new Error("Write failed"));

    const { result } = renderHook(() => useUserRoleGrants(USER_ID, true, false));
    await waitFor(() => expect(result.current.branchRoles).toHaveLength(1));

    act(() => result.current.startBranchReplace());
    act(() =>
      result.current.setBranchDraft([
        { branchId: BRANCH_B, roleId: ROLE_B },
      ]),
    );

    const diff = result.current.branchDiff((grant) => ({
      label: grant.roleId,
      hint: grant.branchId,
    }));
    expect(diff.added).toHaveLength(1);
    expect(diff.removed).toHaveLength(1);
    expect(diff.unchanged).toHaveLength(0);

    let ok = true;
    await act(async () => {
      ok = await result.current.commitBranchRoles();
    });
    expect(ok).toBe(false);
    expect(result.current.branchDraft).toEqual([{ branchId: BRANCH_B, roleId: ROLE_B }]);
  });

  it("invalidates previous user's drafts and baselines across both pending and completed userId switches", async () => {
    let resolveSecondBranches: (rows: BranchRoleAssignment[]) => void = () => undefined;
    vi.mocked(fetchBranchRoleAssignments)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(
        new Promise<BranchRoleAssignment[]>((resolve) => {
          resolveSecondBranches = resolve;
        }),
      );

    const { result, rerender } = renderHook(
      ({ userId }) => useUserRoleGrants(userId, true, true),
      { initialProps: { userId: USER_ID } },
    );
    await waitFor(() => expect(result.current.isScopeLoading).toBe(false));

    act(() => {
      result.current.startBranchReplace();
      result.current.setBranchDraft([{ branchId: BRANCH_A, roleId: ROLE_A }]);
      result.current.startScopeEdit();
      result.current.setDraft([{ scopeTarget: "TENANT", roleId: ROLE_A }]);
      result.current.review();
    });
    expect(result.current.isReviewing).toBe(true);

    // Switch target user: drafts and review state mask immediately and refuse commit both before and after load
    rerender({ userId: SECOND_USER_ID });
    expect(result.current.branchDraft).toBeNull();
    expect(result.current.draft).toBeNull();
    expect(result.current.isReviewing).toBe(false);

    await waitFor(() => expect(result.current.isScopeLoading).toBe(false));
    await act(async () => {
      resolveSecondBranches([]);
    });
    await waitFor(() => expect(result.current.isBranchLoading).toBe(false));

    let branchAccepted = true;
    let scopeAccepted = true;
    await act(async () => {
      branchAccepted = await result.current.commitBranchRoles();
      scopeAccepted = await result.current.commitScopeRoles();
    });
    expect(branchAccepted).toBe(false);
    expect(scopeAccepted).toBe(false);
    expect(replaceBranchRoleAssignments).not.toHaveBeenCalled();
    expect(replaceScopeRoleAssignments).not.toHaveBeenCalled();
  });

  it("enforces exact-scope TENANT/COMPANY/BRANCH predicates and resets branch on company change", async () => {
    const { result } = renderHook(() => {
      const [draft, setDraft] = useState<ScopeRoleAssignmentInput[]>([]);
      const form = useScopeRoleDraftForm({
        draft,
        initialKeys: [],
        onDraftChange: setDraft,
      });
      return { draft, form };
    });

    act(() => result.current.form.handleScopeTargetChange("BRANCH"));
    act(() => result.current.form.setRoleId(ROLE_A));
    expect(result.current.form.canAdd).toBe(false);

    act(() => result.current.form.cascade.selectCompany(COMPANY_A));
    expect(result.current.form.canAdd).toBe(false);

    act(() => result.current.form.cascade.selectBranch(BRANCH_A));
    expect(result.current.form.canAdd).toBe(true);

    act(() => result.current.form.cascade.selectCompany(COMPANY_B));
    await waitFor(() => expect(result.current.form.branchId).toBe(""));
    expect(result.current.form.canAdd).toBe(false);

    act(() => result.current.form.cascade.selectBranch(BRANCH_B));
    act(() => result.current.form.addRow());
    expect(result.current.draft).toEqual([
      {
        scopeTarget: "BRANCH",
        roleId: ROLE_A,
        companyId: COMPANY_B,
        branchId: BRANCH_B,
      },
    ]);

    expect(replaceScopeRoleAssignments).toBeDefined();
  });
});
