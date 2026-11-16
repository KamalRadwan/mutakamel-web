// @vitest-environment jsdom
import { useState } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { RoleBranchPermissionsDocument } from "../contracts/role-branch-contract";
import { buildBranchCatalogueTaxonomy } from "./branch-permissions-taxonomy";
import { useRoleBranchSaveFlow } from "./useRoleBranchSaveFlow";

const io = vi.hoisted(() => ({ save: vi.fn(), read: vi.fn(), bootstrap: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ retryBootstrap: io.bootstrap }),
}));
vi.mock("../contracts/role-branch-contract", async original => ({
  ...(await original<typeof import("../contracts/role-branch-contract")>()),
  saveRoleBranchPermissions: io.save,
  fetchRoleBranchPermissions: io.read,
}));

const branchId = "01900100-0000-7000-8000-000000000011";
const permissionId = "01900100-0000-7000-8000-000000000012";
const unavailableId = "01900100-0000-7000-8000-000000000013";
const document: RoleBranchPermissionsDocument = {
  roleId: "01900100-0000-7000-8000-000000000014",
  roleName: "Sales", isSystem: false, permissionMode: "BRANCH", revision: "3",
  catalogueRevision: "a".repeat(64), globalPermissionIds: [], profiles: [],
  catalogue: [{
    id: permissionId, key: "crm.leads.read_own", nameAr: "عرض العملاء", nameEn: "View leads",
    module: { id: "crm", nameAr: "المبيعات", nameEn: "CRM" },
    groups: [{ id: "leads", nameAr: "العملاء", nameEn: "Leads" }],
    scope: "BRANCH", recordScope: "OWN",
  }],
  limits: { branches: 100, permissionsPerBranch: 200 },
};
const saved = { ...document, revision: "4" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function setup(ids = [permissionId]) {
  const onSaved = vi.fn();
  const setDocument = vi.fn();
  const hook = renderHook(() => {
    const [draft, setDraft] = useState<Record<string, string[]>>({ [branchId]: ids });
    const flow = useRoleBranchSaveFlow({
      document, setDocument, draftProfiles: draft, setDraftProfiles: setDraft,
      selectedCompanyIds: [], branchesById: new Map(),
      taxonomy: buildBranchCatalogueTaxonomy(document.catalogue),
      setStep: vi.fn(), t: en, lang: "en", onSaved,
    });
    return { ...flow, draft };
  });
  return { ...hook, onSaved, setDocument };
}

beforeEach(() => {
  vi.resetAllMocks();
  io.bootstrap.mockResolvedValue(undefined);
  io.save.mockResolvedValue(saved);
});
afterEach(cleanup);

describe("branch permission save lifecycle", () => {
  it("serializes rapid save clicks and recovery reads before React renders pending", async () => {
    const write = deferred<RoleBranchPermissionsDocument>();
    io.save.mockReturnValue(write.promise);
    const hook = setup();
    let request!: Promise<void>;
    act(() => {
      request = hook.result.current.executeSave();
      void hook.result.current.executeSave();
      void hook.result.current.checkCurrentState();
    });
    expect(io.save).toHaveBeenCalledTimes(1);
    expect(io.read).not.toHaveBeenCalled();
    await act(async () => { write.resolve(saved); await request; });
    expect(hook.onSaved).toHaveBeenCalledTimes(1);
    expect(hook.result.current.isSubmitting).toBe(false);
  });

  it("discards late private results after the modal or account content unmounts", async () => {
    const write = deferred<RoleBranchPermissionsDocument>();
    io.save.mockReturnValue(write.promise);
    const hook = setup();
    let request!: Promise<void>;
    act(() => { request = hook.result.current.executeSave(); });
    hook.unmount();
    await act(async () => { write.resolve(saved); await request; });
    expect(hook.setDocument).not.toHaveBeenCalled();
    expect(hook.onSaved).not.toHaveBeenCalled();
    expect(io.bootstrap).not.toHaveBeenCalled();
  });

  it("keeps a validated save confirmed when only refreshing the session fails", async () => {
    io.bootstrap.mockRejectedValue(new Error("refresh unavailable"));
    const hook = setup();
    await act(async () => { await hook.result.current.executeSave(); });
    expect(hook.setDocument).toHaveBeenCalledWith(saved);
    expect(hook.onSaved).toHaveBeenCalledWith(saved, expect.arrayContaining([
      en.coreIdentity.roleBranch.dialogs.saved.sessionRefreshFailed,
    ]));
    expect(hook.result.current.writeError).toBeNull();
    expect(hook.result.current.outcomeDialog).toBeNull();
    expect(io.save).toHaveBeenCalledTimes(1);
  });

  it("retains unavailable draft choices through catalogue refresh until explicitly removed", async () => {
    io.read.mockResolvedValue({ ...document, catalogueRevision: "b".repeat(64) });
    const hook = setup([permissionId, unavailableId]);
    await act(async () => { await hook.result.current.refreshCatalogue(); });
    expect(hook.result.current.draft[branchId]).toEqual([permissionId, unavailableId]);
    expect(hook.result.current.unavailableSelectionCount).toBe(1);
    act(() => { hook.result.current.removeUnavailableSelections(); });
    expect(hook.result.current.draft[branchId]).toEqual([permissionId]);
    expect(io.save).not.toHaveBeenCalled();
  });

  it("reads after an uncertain save and requires an explicit retry when it was not applied", async () => {
    io.save.mockRejectedValue(new TenantApiClientError("Upstream timeout", {
      status: 504, statusText: "Gateway Timeout", headers: new Headers(),
      data: { code: "UPSTREAM_TIMEOUT" },
    }));
    io.read.mockResolvedValue(document);
    const hook = setup();
    await act(async () => { await hook.result.current.executeSave(); });
    expect(hook.result.current.outcomeDialog).toBe("save-uncertain");
    await act(async () => { await hook.result.current.checkCurrentState(); });
    expect(hook.result.current.statusBanner).toBe("not-applied");
    expect(io.save).toHaveBeenCalledTimes(1);
    expect(hook.onSaved).not.toHaveBeenCalled();
  });
});
