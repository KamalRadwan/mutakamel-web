// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { PermissionScope } from "@/lib/auth/permission-scope";

const { auth, io, toast } = vi.hoisted(() => ({
  auth: { user: { permissions: [] as string[], permissionScopes: {} as Record<string, PermissionScope> } },
  io: {
    get: vi.fn(), post: vi.fn(), patch: vi.fn(), remove: vi.fn(),
    listCompanies: vi.fn(), createCompany: vi.fn(), deleteCompany: vi.fn(),
    listRoles: vi.fn(), readRole: vi.fn(), createRole: vi.fn(), deleteRole: vi.fn(),
    updateRole: vi.fn(), setPermissions: vi.fn(),
    permissionCatalogue: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn(), errorFromApi: vi.fn(), outcomeFromApi: vi.fn() },
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/design-system", async () => ({
  ...await import("@/design-system/patterns/permission-gate/useCan"),
  useToast: () => toast,
  useRealtimeResync: () => undefined,
}));
vi.mock("./core-api", () => ({
  coreGet: io.get, corePost: io.post, corePatch: io.patch, coreDelete: io.remove,
}));
vi.mock("./contracts/organization-contract", async (original) => ({
  ...await original<typeof import("./contracts/organization-contract")>(),
  fetchOrgNodes: io.listCompanies, createOrgNode: io.createCompany, deleteOrgNode: io.deleteCompany,
}));
vi.mock("./contracts/role-contract", async (original) => ({
  ...await original<typeof import("./contracts/role-contract")>(),
  fetchTenantRoles: io.listRoles, fetchTenantRole: io.readRole,
  createTenantRole: io.createRole, deleteTenantRole: io.deleteRole,
  updateTenantRole: io.updateRole, setRolePermissions: io.setPermissions,
  fetchPermissionCatalogue: io.permissionCatalogue,
}));

import { EMPTY_ORG_NODE_FORM, useOrganizationLevel } from "./organization/hooks/useOrganizationLevel";
import { useTenantRoles } from "./roles/hooks/useTenantRoles";
import { useRolePermissionEditor } from "./roles/[id]/hooks/useRolePermissionEditor";
import { useTaxes } from "./settings/taxes/hooks/useTaxes";
import { useNumberingSequences } from "./settings/numbering/hooks/useNumberingSequences";
import { EMPTY_TAX_FORM } from "./settings/taxes/tax-contract";
import { EMPTY_NUMBERING_FORM } from "./settings/numbering/numbering-contract";

const COMPANY = "01900100-0000-7000-8000-000000000001";
const OTHER_COMPANY = "01900100-0000-7000-8000-000000000002";
const ROLE = "01900100-0000-7000-8000-000000000003";
const BRANCH = "01900100-0000-7000-8000-000000000004";
const KEYS = ["org.company.manage", "roles.role.create", "roles.role.update", "roles.role.delete",
  "roles.permission.read", "taxes.tax.manage", "numbering.manage"];
const role = { id: ROLE, name: "Delegated", nameAr: "Delegated", nameEn: "Delegated",
  descriptionAr: null, descriptionEn: null, isSystem: false, permissionIds: [],
  createdAt: "2026-10-17T00:00:00.000Z", updatedAt: "2026-10-17T00:00:00.000Z" };

function setGrants(tenantWide: boolean) {
  auth.user = {
    permissions: KEYS,
    permissionScopes: Object.fromEntries(KEYS.map((key) => [key, {
      tenantWide, companyIds: tenantWide ? [] : [COMPANY], branchIds: tenantWide ? [] : [BRANCH],
    }])),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setGrants(false);
  io.listCompanies.mockResolvedValue({ items: [{ id: COMPANY }], page: 1, limit: 25, total: 1 });
  io.listRoles.mockResolvedValue({ items: [role], page: 1, limit: 25, total: 1 });
  io.readRole.mockResolvedValue(role);
  io.createCompany.mockResolvedValue(undefined);
  io.createRole.mockResolvedValue(role);
  io.updateRole.mockResolvedValue(role);
  io.setPermissions.mockResolvedValue(role);
  io.permissionCatalogue.mockResolvedValue({ items: [], hasNext: false });
  io.post.mockResolvedValue({ data: {}, headers: new Headers() });
  io.get.mockImplementation(async (path: string) => ({
    data: { items: path.includes("/organization/companies") ? [
      { id: COMPANY, code: "A", name: "Company A" },
      { id: OTHER_COMPANY, code: "B", name: "Company B" },
    ] : [], total: 0, page: 1, limit: 25 },
    headers: new Headers(),
  }));
});
afterEach(cleanup);

function useCompanyAndRoles() {
  return { company: useOrganizationLevel("companies"), roles: useTenantRoles(),
    editor: useRolePermissionEditor(ROLE) };
}

describe("tenant-wide company and role actions", () => {
  it("hides actions and refuses writes for company/branch grants", async () => {
    const { result } = renderHook(useCompanyAndRoles);
    await waitFor(() => expect(result.current.editor.role?.id).toBe(ROLE));
    expect(result.current.company.canManage).toBe(false);
    expect(result.current.roles.canCreate).toBe(false);
    expect(result.current.roles.canDelete).toBe(false);
    expect(result.current.editor.canUpdate).toBe(false);
    act(() => {
      result.current.company.openCreate();
      result.current.roles.openCreate();
      result.current.editor.openConfirm();
      result.current.editor.openRename();
    });
    expect(result.current.company.isCreateOpen).toBe(false);
    expect(result.current.roles.isCreateOpen).toBe(false);
    expect(result.current.editor.isConfirmOpen).toBe(false);
    expect(result.current.editor.isRenameOpen).toBe(false);
    await act(async () => {
      expect(await result.current.company.handleCreate(EMPTY_ORG_NODE_FORM)).toBe(false);
      expect(await result.current.roles.handleCreate({ name: "Example" })).toBe(false);
      await result.current.editor.save();
      expect(await result.current.editor.rename({ name: "Example" })).toBe(false);
    });
    expect(io.createCompany).not.toHaveBeenCalled();
    expect(io.createRole).not.toHaveBeenCalled();
    expect(io.updateRole).not.toHaveBeenCalled();
    expect(io.setPermissions).not.toHaveBeenCalled();
  });

  it("rechecks pending deletions and editor writes when grants change", async () => {
    setGrants(true);
    const { result, rerender } = renderHook(useCompanyAndRoles);
    await waitFor(() => expect(result.current.company.rows).toHaveLength(1));
    await waitFor(() => expect(result.current.editor.role?.id).toBe(ROLE));
    expect(result.current.company.canManage).toBe(true);
    expect(result.current.roles.canCreate).toBe(true);
    expect(result.current.editor.canUpdate).toBe(true);
    const company = result.current.company.rows[0];
    if (!company) throw new Error("Missing company fixture");
    act(() => {
      result.current.company.requestDelete(company);
      result.current.roles.requestDelete(role);
    });
    setGrants(false);
    rerender();
    await act(async () => {
      await result.current.company.handleDelete();
      await result.current.roles.handleDelete();
      await result.current.editor.save();
      expect(await result.current.editor.rename({ name: "Example" })).toBe(false);
    });
    expect(io.deleteCompany).not.toHaveBeenCalled();
    expect(io.deleteRole).not.toHaveBeenCalled();
    expect(io.updateRole).not.toHaveBeenCalled();
    expect(io.setPermissions).not.toHaveBeenCalled();
  });

  it("keeps tenant-wide holders able to create and edit roles", async () => {
    setGrants(true);
    const { result } = renderHook(useCompanyAndRoles);
    await waitFor(() => expect(result.current.editor.role?.id).toBe(ROLE));
    await waitFor(() => expect(result.current.editor.canSavePermissions).toBe(true));
    await act(async () => {
      expect(await result.current.roles.handleCreate({ name: "Example" })).toBe(true);
      expect(await result.current.editor.rename({ name: "Example" })).toBe(true);
      await result.current.editor.save();
    });
    expect(io.createRole).toHaveBeenCalledOnce();
    expect(io.updateRole).toHaveBeenCalledOnce();
    expect(io.setPermissions).toHaveBeenCalledOnce();
  });
});

describe("tax and numbering scopes", () => {
  it("filters write choices and blocks tenant-wide and foreign-company creation", async () => {
    const { result } = renderHook(() => ({ taxes: useTaxes(), numbering: useNumberingSequences() }));
    await waitFor(() => expect(result.current.taxes.manageableCompanies).toHaveLength(1));
    await waitFor(() => expect(result.current.numbering.manageableCompanies).toHaveLength(1));
    expect(result.current.taxes.manageableCompanies[0]?.id).toBe(COMPANY);
    expect(result.current.numbering.manageableCompanies[0]?.id).toBe(COMPANY);
    expect(result.current.taxes.tenantWideAllowed).toBe(false);
    expect(result.current.numbering.tenantWideAllowed).toBe(false);
    await act(async () => {
      for (const companyId of [null, OTHER_COMPANY]) {
        expect(await result.current.taxes.create({ ...EMPTY_TAX_FORM, companyId })).toBe(false);
        expect(await result.current.numbering.create({ ...EMPTY_NUMBERING_FORM, companyId })).toBe(false);
      }
    });
    expect(io.post).not.toHaveBeenCalled();
    await act(async () => {
      expect(await result.current.taxes.create({ ...EMPTY_TAX_FORM,
        companyId: COMPANY, code: "VAT", name: "VAT", rate: "15" })).toBe(true);
      expect(await result.current.numbering.create({ ...EMPTY_NUMBERING_FORM,
        companyId: COMPANY, code: "INVOICE" })).toBe(true);
    });
    expect(io.post).toHaveBeenCalledTimes(2);
    expect(io.post.mock.calls.every((call: unknown[]) =>
      (call[1] as { companyId: string }).companyId === COMPANY)).toBe(true);
  });

  it("rechecks the immutable scope of pending edits and deactivation", async () => {
    setGrants(true);
    const { result, rerender } = renderHook(() => ({ taxes: useTaxes(), numbering: useNumberingSequences() }));
    act(() => {
      result.current.taxes.openEdit({ id: ROLE, code: "VAT", name: "VAT", rate: "15",
        isInclusive: false, companyId: null, status: "ACTIVE", updatedAt: role.updatedAt });
      result.current.taxes.openDeactivate({ id: ROLE, code: "VAT", name: "VAT", rate: "15",
        isInclusive: false, companyId: null, status: "ACTIVE", updatedAt: role.updatedAt });
      result.current.numbering.openEdit({ id: ROLE, code: "INVOICE", prefix: null, padding: 5,
        nextValue: "1", companyId: null, updatedAt: role.updatedAt });
    });
    setGrants(false);
    rerender();
    expect(result.current.taxes.canManageScope(null)).toBe(false);
    expect(result.current.numbering.canManageScope(null)).toBe(false);
    await act(async () => {
      expect(await result.current.taxes.update(EMPTY_TAX_FORM)).toBe(false);
      expect(await result.current.numbering.update(EMPTY_NUMBERING_FORM)).toBe(false);
      await result.current.taxes.deactivate();
    });
    expect(io.patch).not.toHaveBeenCalled();
    expect(io.remove).not.toHaveBeenCalled();
  });

  it("never falls back to tenant-wide creation when company lookup fails", async () => {
    io.get.mockRejectedValue(new Error("Company read unavailable"));
    const { result } = renderHook(() => ({ taxes: useTaxes(), numbering: useNumberingSequences() }));
    await waitFor(() => expect(io.get).toHaveBeenCalled());
    expect(result.current.taxes.canCreate).toBe(false);
    expect(result.current.numbering.canCreate).toBe(false);
    setGrants(true);
    const { result: tenant } = renderHook(() => ({ taxes: useTaxes(), numbering: useNumberingSequences() }));
    expect(tenant.current.taxes.canCreate).toBe(true);
    expect(tenant.current.numbering.tenantWideAllowed).toBe(true);
  });
});
