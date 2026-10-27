// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { PermissionScope } from "@/lib/auth/permission-scope";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { TenantPermission, TenantRoleDetail } from "../../../contracts/role-contract";
import { useCoreErrorText } from "../../../hooks/useCoreErrorText";
import { useRolePermissionEditor } from "../hooks/useRolePermissionEditor";
import { RoleEditorWorkspace } from "./role-editor-workspace";

const { auth, io, locale } = vi.hoisted(() => ({
  auth: { user: { permissions: [] as string[], permissionScopes: {} as Record<string, PermissionScope> }, retryBootstrap: vi.fn() },
  io: { read: vi.fn(), catalogue: vi.fn(), save: vi.fn(), rename: vi.fn() },
  locale: { lang: "en" as "en" | "ar" },
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { en, ar }[locale.lang], lang: locale.lang }),
}));
vi.mock("../../../contracts/role-contract", async (original) => ({
  ...await original<typeof import("../../../contracts/role-contract")>(),
  fetchTenantRole: io.read, fetchPermissionCatalogue: io.catalogue,
  setRolePermissions: io.save, updateTenantRole: io.rename,
}));

const ROLE = "01900100-0000-7000-8000-000000000001";
const TENANT_PERMISSION = "01900100-0000-7000-8000-000000000002";
const SCOPED_PERMISSION = "01900100-0000-7000-8000-000000000003";
const UNKNOWN_PERMISSION = "01900100-0000-7000-8000-000000000004";
const role: TenantRoleDetail = {
  id: ROLE, name: "Custom role", nameAr: "دور مخصص", nameEn: "Custom role",
  descriptionAr: null, descriptionEn: null, isSystem: false, permissionIds: [],
  createdAt: "2026-10-17T00:00:00.000Z", updatedAt: "2026-10-17T00:00:00.000Z",
};
const catalogue: TenantPermission[] = [
  { id: TENANT_PERMISSION, key: "roles.role.read", group: "roles", nameAr: "قراءة الأدوار",
    nameEn: "Read roles", groupNameAr: "الأدوار", groupNameEn: "Roles" },
  { id: SCOPED_PERMISSION, key: "users.user.read", group: "users", nameAr: "قراءة المستخدمين",
    nameEn: "Read users", groupNameAr: "المستخدمون", groupNameEn: "Users" },
];

function grant(key: string, tenantWide: boolean) {
  auth.user = {
    permissions: [...new Set([...auth.user.permissions, key])],
    permissionScopes: { ...auth.user.permissionScopes, [key]: {
      tenantWide, companyIds: tenantWide ? [] : [ROLE], branchIds: tenantWide ? [] : [ROLE],
    } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.retryBootstrap.mockResolvedValue(undefined);
  locale.lang = "en";
  localStorage.setItem("tenant_lang", "en");
  auth.user = { permissions: [], permissionScopes: {} };
  for (const key of ["roles.role.read", "roles.role.update", "roles.permission.read"]) grant(key, true);
  grant("users.user.read", false);
  io.read.mockResolvedValue(role);
  io.catalogue.mockResolvedValue({ items: catalogue, hasNext: false });
  io.save.mockImplementation(async (_id: string, permissionIds: string[]) => ({ ...role, permissionIds }));
});
afterEach(cleanup);

describe("role permission grant authority", () => {
  it("disables scoped keys and explains them on keyboard focus", async () => {
    render(<RoleEditorWorkspace id={ROLE} />);
    const scoped = await screen.findByRole("checkbox", { name: "Read users" });
    expect(scoped).toBeDisabled();
    const allowed = screen.getByRole("checkbox", { name: "Read roles" });
    expect(allowed).toBeEnabled();
    const trigger = scoped.closest("label");
    if (!trigger) throw new Error("Missing tooltip trigger");
    expect(trigger).toHaveAttribute("tabindex", "0");
    fireEvent.focus(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(en.coreIdentity.roles.permissionNotGrantable);
  });

  it("refuses scoped and unknown toggles but saves tenant-wide keys", async () => {
    const { result } = renderHook(() => useRolePermissionEditor(ROLE));
    await waitFor(() => expect(result.current.canEditPermissions).toBe(true));
    act(() => { result.current.toggle(SCOPED_PERMISSION); result.current.toggle(UNKNOWN_PERMISSION); });
    expect(result.current.selectedIds).toEqual([]);
    act(() => result.current.toggle(TENANT_PERMISSION));
    await act(async () => { await result.current.save(); });
    expect(io.save).toHaveBeenCalledWith(ROLE, [TENANT_PERMISSION]);
    expect(auth.retryBootstrap).toHaveBeenCalledOnce();
    expect(io.save.mock.invocationCallOrder[0]).toBeLessThan(auth.retryBootstrap.mock.invocationCallOrder[0]);
  });

  it("does not refresh the profile after a rejected permission save", async () => {
    io.save.mockRejectedValueOnce(new TenantApiClientError("Forbidden", {
      status: 403, statusText: "Forbidden", headers: new Headers(), data: { code: "ROLE_PERMISSION_GRANT_DENIED" },
    }));
    const { result } = renderHook(() => useRolePermissionEditor(ROLE));
    await waitFor(() => expect(result.current.canEditPermissions).toBe(true));
    act(() => result.current.toggle(TENANT_PERMISSION));
    await act(async () => { await result.current.save(); });
    expect(result.current.writeError?.status).toBe(403);
    expect(auth.retryBootstrap).not.toHaveBeenCalled();
  });

  it.each([SCOPED_PERMISSION, UNKNOWN_PERMISSION])("warns and blocks replacement of existing ungrantable ID %s", async (permissionId) => {
    io.read.mockResolvedValue({ ...role, permissionIds: [permissionId] });
    render(<RoleEditorWorkspace id={ROLE} />);
    expect(await screen.findByText(en.coreIdentity.roles.outsideGrantAuthority)).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Read roles" })).toBeDisabled();
    expect(screen.getByRole("button", { name: en.coreIdentity.roles.savePermissions })).toBeDisabled();
    expect(io.save).not.toHaveBeenCalled();
  });

  it("allows the owner's complete tenant-wide projection", async () => {
    grant("users.user.read", true);
    io.read.mockResolvedValue({ ...role, permissionIds: [SCOPED_PERMISSION] });
    const { result } = renderHook(() => useRolePermissionEditor(ROLE));
    await waitFor(() => expect(result.current.canEditPermissions).toBe(true));
    expect(result.current.canGrantPermission(SCOPED_PERMISSION)).toBe(true);
    expect(result.current.hasUngrantablePermissions).toBe(false);
  });

  it("rechecks a pending selection when its tenant-wide grant is lost", async () => {
    const { result, rerender } = renderHook(() => useRolePermissionEditor(ROLE));
    await waitFor(() => expect(result.current.canEditPermissions).toBe(true));
    act(() => { result.current.toggle(TENANT_PERMISSION); });
    act(() => result.current.openConfirm());
    expect(result.current.isConfirmOpen).toBe(true);
    grant("roles.role.read", false);
    rerender();
    await act(async () => { await result.current.save(); });
    expect(io.save).not.toHaveBeenCalled();
    expect(result.current.canSavePermissions).toBe(false);
  });

  it("explains missing catalogue permission without fetching it", async () => {
    auth.user.permissions = auth.user.permissions.filter((key) => key !== "roles.permission.read");
    render(<RoleEditorWorkspace id={ROLE} />);
    expect(await screen.findByText(en.permissionGate.description)).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(io.catalogue).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: en.coreIdentity.roles.savePermissions })).toBeDisabled();
  });

  it("renders a permission gate on an authoritative catalogue 403", async () => {
    io.catalogue.mockRejectedValue(new TenantApiClientError("Forbidden", {
      status: 403, statusText: "Forbidden", headers: new Headers(), data: {},
    }));
    render(<RoleEditorWorkspace id={ROLE} />);
    expect(await screen.findByText(en.permissionGate.description)).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it.each(["en", "ar"] as const)("maps grant denial in %s", (lang) => {
    locale.lang = lang;
    const { result } = renderHook(useCoreErrorText);
    expect(result.current({ status: 403, code: "ROLE_PERMISSION_GRANT_DENIED" }))
      .toBe({ en, ar }[lang].coreIdentity.errors.ROLE_PERMISSION_GRANT_DENIED);
  });
});
