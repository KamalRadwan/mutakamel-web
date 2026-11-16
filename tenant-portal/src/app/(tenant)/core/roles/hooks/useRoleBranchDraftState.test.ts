// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoleBranchPermissionsDocument } from "../contracts/role-branch-contract";
import { useRoleBranchDraftState } from "./useRoleBranchDraftState";
import { en } from "@/i18n/dictionaries/en";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));

const companyId = "01900100-0000-7000-8000-000000000021";
const savedBranchId = "01900100-0000-7000-8000-000000000022";
const emptyBranchId = "01900100-0000-7000-8000-000000000023";
const permissionId = "01900100-0000-7000-8000-000000000024";
const branches = [savedBranchId, emptyBranchId].map(id => ({
  id, companyId, name: id === savedBranchId ? "Main" : "New",
  companyName: "Company A", isActive: true,
}));
const document: RoleBranchPermissionsDocument = {
  roleId: "01900100-0000-7000-8000-000000000025", roleName: "Sales",
  isSystem: false, permissionMode: "BRANCH", revision: "3",
  catalogueRevision: "a".repeat(64), globalPermissionIds: [],
  profiles: [{
    branchId: savedBranchId, companyId, companyName: "Company A",
    branchName: "Main", isActive: true, permissionIds: [permissionId],
  }],
  catalogue: [], limits: { branches: 100, permissionsPerBranch: 200 },
};

afterEach(cleanup);

describe("removing a company from the permission draft", () => {
  it("selects a newly chosen company's sole active branch without restoring an explicitly unchecked branch", async () => {
    const secondCompany = "01900100-0000-7000-8000-000000000031";
    const secondBranch = "01900100-0000-7000-8000-000000000032";
    const options = [...branches, { id: secondBranch, companyId: secondCompany, name: "Only branch", companyName: "Company B", isActive: true }];
    const hook = renderHook(() => useRoleBranchDraftState({
      document: { ...document, permissionMode: "GLOBAL", profiles: [] }, effectiveMode: "edit", branches: options,
      companies: [{ id: companyId, name: "Company A", isActive: true }, { id: secondCompany, name: "Company B", isActive: true }],
      branchesById: new Map(options.map(branch => [branch.id, branch])),
      isScopeComplete: true, isLoadingScope: false,
      onEnterViewMode: vi.fn(), onDraftMutated: vi.fn(),
    }));
    await waitFor(() => expect(hook.result.current.initialized).toBe(true));
    act(() => { hook.result.current.handleCompanySelectionChange([secondCompany]); });
    expect(hook.result.current.draftProfiles).toEqual({ [secondBranch]: [] });
    expect(hook.result.current.activeBranchId).toBe(secondBranch);
    expect(hook.result.current.autoSingleBranchId).toBe(secondBranch);
    act(() => { hook.result.current.handleToggleBranch(secondBranch); });
    act(() => { hook.result.current.handleCompanySelectionChange([secondCompany]); });
    expect(hook.result.current.draftProfiles).toEqual({});
    act(() => { hook.result.current.handleCompanySelectionChange([companyId, secondCompany]); });
    expect(hook.result.current.draftProfiles).toEqual({});
  });

  it("does not infer a sole branch from an incomplete option list", async () => {
    const hook = renderHook(({ complete }) => useRoleBranchDraftState({
      document: { ...document, profiles: [] }, effectiveMode: "edit", branches: branches.slice(0, 1),
      companies: [{ id: companyId, name: "Company A", isActive: true }],
      branchesById: new Map(branches.map(branch => [branch.id, branch])),
      isScopeComplete: complete, isLoadingScope: false,
      onEnterViewMode: vi.fn(), onDraftMutated: vi.fn(),
    }), { initialProps: { complete: true } });
    await waitFor(() => expect(hook.result.current.initialized).toBe(true));
    act(() => { hook.result.current.handleCompanySelectionChange([]); });
    hook.rerender({ complete: false });
    act(() => { hook.result.current.handleCompanySelectionChange([companyId]); });
    expect(hook.result.current.draftProfiles).toEqual({});
  });

  it("confirms protected changes, then removes its saved and empty branch drafts together", async () => {
    const hook = renderHook(() => useRoleBranchDraftState({
      document, effectiveMode: "edit", branches,
      companies: [{ id: companyId, name: "Company A", isActive: true }],
      branchesById: new Map(branches.map(branch => [branch.id, branch])),
      isScopeComplete: true, isLoadingScope: false,
      onEnterViewMode: vi.fn(), onDraftMutated: vi.fn(),
    }));
    await waitFor(() => expect(hook.result.current.initialized).toBe(true));
    act(() => { hook.result.current.handleToggleBranch(emptyBranchId); });
    expect(Object.keys(hook.result.current.draftProfiles)).toEqual([savedBranchId, emptyBranchId]);
    act(() => { hook.result.current.handleCompanySelectionChange([]); });
    expect(hook.result.current.selectedCompanyIds).toEqual([companyId]);
    expect(hook.result.current.pendingRemoval?.branchLabel).toBe("Main");
    act(() => { hook.result.current.confirmRemoval(); });
    expect(hook.result.current.selectedCompanyIds).toEqual([]);
    expect(hook.result.current.draftProfiles).toEqual({});
    expect(hook.result.current.pendingRemoval).toBeNull();
  });
});
