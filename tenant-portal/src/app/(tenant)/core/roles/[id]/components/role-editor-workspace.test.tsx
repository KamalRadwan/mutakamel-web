// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { PermissionScope } from "@/lib/auth/permission-scope";
import { formatTemplate } from "@/lib/format/template";
import {
  MAX_ROLE_PERMISSIONS,
  type TenantPermission,
  type TenantRoleDetail,
} from "../../../contracts/role-contract";
import { useCoreErrorText } from "../../../hooks/useCoreErrorText";
import { MAX_CATALOGUE_PAGES } from "../hooks/usePermissionCatalogue";
import { useRolePermissionEditor } from "../hooks/useRolePermissionEditor";
import { RoleEditorWorkspace } from "./role-editor-workspace";

const DIRECTIONS = { en: "ltr", ar: "rtl" } as const;

const { auth, io, locale } = vi.hoisted(() => ({
  auth: {
    user: {
      permissions: [] as string[],
      permissionScopes: {} as Record<string, PermissionScope>,
    },
    retryBootstrap: vi.fn(),
  },
  io: {
    read: vi.fn(),
    catalogue: vi.fn(),
    save: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
  },
  locale: { lang: "en" as "en" | "ar" },
}));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { en, ar }[locale.lang], lang: locale.lang }),
}));
vi.mock("@/i18n/useLanguage", async (original) => ({
  ...(await original<typeof import("@/i18n/useLanguage")>()),
  useLanguage: () => locale.lang,
  useDictionary: () => ({ en, ar }[locale.lang]),
  useDirection: () => DIRECTIONS[locale.lang],
}));
vi.mock("../../../contracts/role-contract", async (original) => ({
  ...(await original<typeof import("../../../contracts/role-contract")>()),
  fetchTenantRole: io.read,
  fetchPermissionCatalogue: io.catalogue,
  setRolePermissions: io.save,
  updateTenantRole: io.rename,
  deleteTenantRole: io.remove,
}));

const ROLE = "01900100-0000-7000-8000-000000000001";
const TENANT_PERMISSION = "01900100-0000-7000-8000-000000000002";
const SCOPED_PERMISSION = "01900100-0000-7000-8000-000000000003";
const UNKNOWN_PERMISSION = "01900100-0000-7000-8000-000000000004";
const EXTRA_PERMISSION = "01900100-0000-7000-8000-000000000005";

const role: TenantRoleDetail = {
  id: ROLE,
  name: "Custom role",
  nameAr: "دور مخصص",
  nameEn: "Custom role",
  descriptionAr: null,
  descriptionEn: null,
  isSystem: false,
  permissionMode: "GLOBAL",
  permissionIds: [],
  createdAt: "2026-10-17T00:00:00.000Z",
  updatedAt: "2026-10-17T00:00:00.000Z",
};

const catalogue: TenantPermission[] = [
  {
    id: TENANT_PERMISSION,
    key: "roles.role.read",
    group: "roles",
    nameAr: "قراءة الأدوار",
    nameEn: "Read roles",
    groupNameAr: "الأدوار",
    groupNameEn: "Roles",
  },
  {
    id: SCOPED_PERMISSION,
    key: "users.user.read",
    group: "users",
    nameAr: "قراءة المستخدمين",
    nameEn: "Read users",
    groupNameAr: "المستخدمون",
    groupNameEn: "Users",
  },
];

function grant(key: string, tenantWide: boolean) {
  auth.user = {
    permissions: [...new Set([...auth.user.permissions, key])],
    permissionScopes: {
      ...auth.user.permissionScopes,
      [key]: {
        tenantWide,
        companyIds: tenantWide ? [] : [ROLE],
        branchIds: tenantWide ? [] : [ROLE],
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.retryBootstrap.mockResolvedValue(undefined);
  locale.lang = "en";
  localStorage.setItem("tenant_lang", "en");
  auth.user = { permissions: [], permissionScopes: {} };
  for (const key of ["roles.role.read", "roles.role.update", "roles.permission.read"]) {
    grant(key, true);
  }
  grant("users.user.read", false);
  io.read.mockResolvedValue(role);
  io.catalogue.mockResolvedValue({ items: catalogue, hasNext: false });
  io.save.mockImplementation(async (_id: string, permissionIds: string[]) => ({
    ...role,
    permissionIds,
  }));
  io.rename.mockImplementation(
    async (_id: string, body: { name?: string; description?: string }) => ({
      ...role,
      name: body.name ?? role.name,
      nameAr: body.name ?? role.nameAr,
      nameEn: body.name ?? role.nameEn,
      descriptionAr: body.description || null,
      descriptionEn: body.description || null,
    }),
  );
  io.remove.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("role permission grant authority and grouped editor", () => {
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
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      en.coreIdentity.roles.permissionNotGrantable,
    );
  });

  it("refuses scoped and unknown toggles but saves tenant-wide keys", async () => {
    const { result } = renderHook(() => useRolePermissionEditor(ROLE));
    await waitFor(() => expect(result.current.canEditPermissions).toBe(true));
    act(() => {
      result.current.toggle(SCOPED_PERMISSION);
      result.current.toggle(UNKNOWN_PERMISSION);
    });
    expect(result.current.selectedIds).toEqual([]);
    act(() => result.current.toggle(TENANT_PERMISSION));
    await act(async () => {
      await result.current.save();
    });
    expect(io.save).toHaveBeenCalledWith(ROLE, [TENANT_PERMISSION]);
    expect(auth.retryBootstrap).toHaveBeenCalledOnce();
    expect(io.save.mock.invocationCallOrder[0]).toBeLessThan(
      auth.retryBootstrap.mock.invocationCallOrder[0],
    );
  });

  it("does not refresh the profile after a rejected permission save", async () => {
    io.save.mockRejectedValueOnce(
      new TenantApiClientError("Forbidden", {
        status: 403,
        statusText: "Forbidden",
        headers: new Headers(),
        data: { code: "ROLE_PERMISSION_GRANT_DENIED" },
      }),
    );
    const { result } = renderHook(() => useRolePermissionEditor(ROLE));
    await waitFor(() => expect(result.current.canEditPermissions).toBe(true));
    act(() => result.current.toggle(TENANT_PERMISSION));
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.writeError?.status).toBe(403);
    expect(auth.retryBootstrap).not.toHaveBeenCalled();
  });

  it.each([SCOPED_PERMISSION, UNKNOWN_PERMISSION])(
    "warns and blocks replacement of existing ungrantable ID %s",
    async (permissionId) => {
      io.read.mockResolvedValue({ ...role, permissionIds: [permissionId] });
      render(<RoleEditorWorkspace id={ROLE} />);
      expect(
        await screen.findByText(en.coreIdentity.roles.outsideGrantAuthority),
      ).toBeVisible();
      expect(screen.getByRole("checkbox", { name: "Read roles" })).toBeDisabled();
      expect(
        screen.getByRole("button", { name: en.coreIdentity.roles.savePermissions }),
      ).toBeDisabled();
      expect(io.save).not.toHaveBeenCalled();
    },
  );

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
    act(() => {
      result.current.toggle(TENANT_PERMISSION);
    });
    act(() => result.current.openConfirm());
    expect(result.current.isConfirmOpen).toBe(true);
    grant("roles.role.read", false);
    rerender();
    await act(async () => {
      await result.current.save();
    });
    expect(io.save).not.toHaveBeenCalled();
    expect(result.current.canSavePermissions).toBe(false);
  });

  it("explains missing catalogue permission without fetching it", async () => {
    auth.user.permissions = auth.user.permissions.filter(
      (key) => key !== "roles.permission.read",
    );
    render(<RoleEditorWorkspace id={ROLE} />);
    expect(await screen.findByText(en.permissionGate.description)).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(io.catalogue).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: en.coreIdentity.roles.savePermissions }),
    ).toBeDisabled();
  });

  it("renders a permission gate on an authoritative catalogue 403", async () => {
    io.catalogue.mockRejectedValue(
      new TenantApiClientError("Forbidden", {
        status: 403,
        statusText: "Forbidden",
        headers: new Headers(),
        data: {},
      }),
    );
    render(<RoleEditorWorkspace id={ROLE} />);
    expect(await screen.findByText(en.permissionGate.description)).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it.each(["en", "ar"] as const)("maps grant denial in %s", (lang) => {
    locale.lang = lang;
    const { result } = renderHook(useCoreErrorText);
    expect(result.current({ status: 403, code: "ROLE_PERMISSION_GRANT_DENIED" })).toBe(
      { en, ar }[lang].coreIdentity.errors.ROLE_PERMISSION_GRANT_DENIED,
    );
  });

  it("renders server-localized Arabic group headings and Western numerals, and preserves hidden selections across client search", async () => {
    locale.lang = "ar";
    localStorage.setItem("tenant_lang", "ar");

    render(<RoleEditorWorkspace id={ROLE} />);
    const allowed = await screen.findByRole("checkbox", { name: "قراءة الأدوار" });
    expect(screen.getByRole("heading", { name: "الأدوار" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "المستخدمون" })).toBeVisible();

    fireEvent.click(allowed);
    // Western numerals even in Arabic (`ar-EG-u-nu-latn`).
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      expect.stringContaining("1"),
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      expect.stringContaining("200"),
    );

    // Client-side search hides "قراءة الأدوار" without dropping it from selectedIds.
    const searchInput = screen.getByRole("searchbox", { name: ar.common.search });
    fireEvent.change(searchInput, { target: { value: "no-matching-permission" } });
    expect(screen.getByText(ar.common.noData)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: ar.filters.clearAll }));
    expect(searchInput).toHaveValue("");

    fireEvent.change(searchInput, { target: { value: "users" } });
    expect(screen.queryByRole("checkbox", { name: "قراءة الأدوار" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "قراءة المستخدمين" })).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: ar.coreIdentity.roles.savePermissions }),
    );
    const confirmDialog = await screen.findByRole("dialog");
    expect(within(confirmDialog).getByText("قراءة الأدوار")).toBeVisible();
    fireEvent.click(
      within(confirmDialog).getByRole("button", {
        name: ar.coreIdentity.roles.savePermissions,
      }),
    );

    await waitFor(() =>
      expect(io.save).toHaveBeenCalledWith(ROLE, [TENANT_PERMISSION]),
    );
  });

  it("enforces MAX_ROLE_PERMISSIONS (200) cap and blocks save when exceeded or when catalogue fails", async () => {
    const bulkCatalogue: TenantPermission[] = Array.from(
      { length: MAX_ROLE_PERMISSIONS + 1 },
      (_, idx) => {
        const suffix = String(idx + 1).padStart(12, "0");
        const key = `roles.bulk.perm_${idx + 1}`;
        grant(key, true);
        return {
          id: `01900100-0000-7000-8000-${suffix}`,
          key,
          group: "roles",
          nameAr: `صلاحية ${idx + 1}`,
          nameEn: `Permission ${idx + 1}`,
          groupNameAr: "الأدوار",
          groupNameEn: "Roles",
        };
      },
    );
    io.catalogue.mockResolvedValue({ items: bulkCatalogue, hasNext: false });
    io.read.mockResolvedValue({
      ...role,
      permissionIds: bulkCatalogue.slice(0, MAX_ROLE_PERMISSIONS).map((p) => p.id),
    });

    render(<RoleEditorWorkspace id={ROLE} />);
    const extraCheckbox = await screen.findByRole("checkbox", { name: "Permission 201" });
    fireEvent.click(extraCheckbox);

    expect(
      await screen.findByText(
        formatTemplate(en.coreIdentity.roles.overCap, { max: "200" }),
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: en.coreIdentity.roles.savePermissions }),
    ).toBeDisabled();

    // Unloaded / failed catalogue (500) also blocks saving.
    cleanup();
    io.catalogue.mockRejectedValueOnce(
      new TenantApiClientError("Server Error", {
        status: 500,
        statusText: "Internal Server Error",
        headers: new Headers(),
        data: {},
      }),
    );
    render(<RoleEditorWorkspace id={ROLE} />);
    expect(
      await screen.findByText(en.coreIdentity.roles.catalogueFailed),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: en.coreIdentity.roles.savePermissions }),
    ).toBeDisabled();
  });

  it("renders system roles in read-only mode without edit, save, or delete actions", async () => {
    grant("roles.role.delete", true);
    io.read.mockResolvedValue({
      ...role,
      name: "Owner",
      nameAr: "المالك",
      nameEn: "Owner",
      isSystem: true,
      permissionIds: [TENANT_PERMISSION],
    });

    render(<RoleEditorWorkspace id={ROLE} />);
    expect(
      await screen.findByText(en.coreIdentity.roles.systemRoleReadOnly),
    ).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Read roles" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: en.coreIdentity.roles.savePermissions }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en.coreIdentity.roles.rename }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en.coreIdentity.actions.delete }),
    ).not.toBeInTheDocument();
  });

  it("displays a 259-permission system role without the custom-role 200 warning", async () => {
    const systemCatalogue = Array.from({ length: 259 }, (_, index) => ({
      ...catalogue[0], id: `019f5000-0000-7000-8000-${String(index).padStart(12, "0")}`,
      key: `system.permission.${index}`, nameEn: `Permission ${index}`, nameAr: `صلاحية ${index}`,
    }));
    io.catalogue.mockResolvedValue({ items: systemCatalogue, hasNext: false });
    io.read.mockResolvedValue({ ...role, isSystem: true, permissionIds: systemCatalogue.map(row => row.id) });
    render(<RoleEditorWorkspace id={ROLE} />);
    await screen.findByText(en.coreIdentity.roles.systemRoleReadOnly);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "259");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "1000");
    expect(screen.queryByText(formatTemplate(en.coreIdentity.roles.overCap, { max: "200" }))).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.coreIdentity.roles.savePermissions })).not.toBeInTheDocument();
  });

  it("shows added and removed diff items in AtomicReplacementConfirm and supports clearing all permissions to []", async () => {
    grant("roles.role.create", true);
    io.catalogue.mockResolvedValue({
      items: [
        ...catalogue,
        {
          id: EXTRA_PERMISSION,
          key: "roles.role.create",
          group: "roles",
          nameAr: "إنشاء الأدوار",
          nameEn: "Create roles",
          groupNameAr: "الأدوار",
          groupNameEn: "Roles",
        },
      ],
      hasNext: false,
    });
    io.read.mockResolvedValue({
      ...role,
      permissionIds: [TENANT_PERMISSION],
    });

    render(<RoleEditorWorkspace id={ROLE} />);
    const readRolesBox = await screen.findByRole("checkbox", { name: "Read roles" });
    const createRolesBox = screen.getByRole("checkbox", { name: "Create roles" });
    expect(screen.getByText(en.coreIdentity.roles.savePermissionsDescription)).toBeVisible();

    // Uncheck existing permission (clearing to []) and open full-replacement confirm.
    fireEvent.click(readRolesBox);
    fireEvent.click(
      screen.getByRole("button", { name: en.coreIdentity.roles.savePermissions }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(en.coreIdentity.roles.savePermissionsDescription),
    ).toBeVisible();
    expect(
      within(dialog).getByText(
        formatTemplate(en.atomicReplacement.removedHeading, { count: "1" }),
      ),
    ).toBeVisible();
    expect(within(dialog).getByText("Read roles")).toBeVisible();

    const confirmButton = within(dialog).getByRole("button", {
      name: en.coreIdentity.roles.savePermissions,
    });
    expect(confirmButton).toBeDisabled();

    // Acknowledge removal, then confirm clearing all permissions (`permissionIds: []`).
    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);

    await waitFor(() => expect(io.save).toHaveBeenCalledWith(ROLE, []));

    // Now add Create roles and verify Adding 1 diff preview.
    fireEvent.click(createRolesBox);
    fireEvent.click(
      screen.getByRole("button", { name: en.coreIdentity.roles.savePermissions }),
    );
    const addDialog = await screen.findByRole("dialog");
    expect(
      within(addDialog).getByText(
        formatTemplate(en.atomicReplacement.addedHeading, { count: "1" }),
      ),
    ).toBeVisible();
    expect(within(addDialog).getByText("Create roles")).toBeVisible();
  });

  it("clears description via centered edit modal and shows DeletionBlockerDialog on 409 ROLE_IN_USE from detail screen", async () => {
    grant("roles.role.delete", true);
    const onDeleted = vi.fn();
    io.read.mockResolvedValue({
      ...role,
      descriptionAr: "وصف سابق",
      descriptionEn: "Existing description",
    });
    io.remove.mockRejectedValueOnce(
      new TenantApiClientError("Conflict", {
        status: 409,
        statusText: "Conflict",
        headers: new Headers(),
        data: { code: "ROLE_IN_USE" },
      }),
    );

    render(<RoleEditorWorkspace id={ROLE} onDeleted={onDeleted} />);
    await screen.findByRole("checkbox", { name: "Read roles" });

    // Edit details modal clears existing description with `""`.
    fireEvent.click(screen.getByRole("button", { name: en.coreIdentity.roles.rename }));
    const editDialog = await screen.findByRole("dialog");
    const descField = within(editDialog).getByRole("textbox", {
      name: en.coreIdentity.roles.description,
    });
    expect(descField).toHaveValue("Existing description");
    fireEvent.change(descField, { target: { value: "" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: en.common.save }));

    await waitFor(() =>
      expect(io.rename).toHaveBeenCalledWith(ROLE, {
        name: "Custom role",
        description: "",
      }),
    );

    // Attempting delete when role is in use shows DeletionBlockerDialog and does not navigate away.
    fireEvent.click(screen.getByRole("button", { name: en.coreIdentity.actions.delete }));
    const deleteConfirm = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(deleteConfirm).getByRole("button", { name: en.coreIdentity.actions.delete }),
    );

    await waitFor(() => expect(io.remove).toHaveBeenCalledWith(ROLE));
    const blockerDialog = await screen.findByRole("dialog");
    expect(within(blockerDialog).getByText(en.deletionBlocker.title)).toBeVisible();
    expect(
      within(blockerDialog).getByText(en.coreIdentity.errors.ROLE_IN_USE),
    ).toBeVisible();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("walks paginated permission catalogue responses until hasNext is false", async () => {
    io.catalogue
      .mockResolvedValueOnce({ items: [catalogue[0]], hasNext: true })
      .mockResolvedValueOnce({ items: [catalogue[1]], hasNext: false });

    render(<RoleEditorWorkspace id={ROLE} />);
    expect(await screen.findByRole("checkbox", { name: "Read roles" })).toBeVisible();
    expect(await screen.findByRole("checkbox", { name: "Read users" })).toBeVisible();
    expect(io.catalogue).toHaveBeenCalledTimes(2);
    expect(io.catalogue.mock.calls[0]?.[0]).toBe(1);
    expect(io.catalogue.mock.calls[1]?.[0]).toBe(2);
  });

  it("fails closed when MAX_CATALOGUE_PAGES is reached with hasNext still true, blocks edits/save without false totals, and recovers on retry", async () => {
    io.read.mockResolvedValue({ ...role, permissionIds: [TENANT_PERMISSION] });
    io.catalogue.mockResolvedValue({ items: [catalogue[0]], hasNext: true });

    const { result } = renderHook(() => useRolePermissionEditor(ROLE));
    await waitFor(() => expect(result.current.isCatalogueTruncated).toBe(true));
    expect(io.catalogue).toHaveBeenCalledTimes(MAX_CATALOGUE_PAGES);
    expect(result.current.isCatalogueLoaded).toBe(false);
    expect(result.current.catalogueError).toBeNull();
    expect(result.current.groups).toEqual([]);
    expect(result.current.canEditPermissions).toBe(false);
    expect(result.current.canSavePermissions).toBe(false);

    act(() => {
      result.current.toggle(TENANT_PERMISSION);
      result.current.openConfirm();
    });
    expect(result.current.selectedIds).toEqual([TENANT_PERMISSION]);
    expect(result.current.isConfirmOpen).toBe(false);
    await act(async () => {
      await result.current.save();
    });
    expect(io.save).not.toHaveBeenCalled();
    cleanup();

    io.catalogue.mockClear();
    io.catalogue.mockResolvedValue({ items: [catalogue[0]], hasNext: true });

    render(<RoleEditorWorkspace id={ROLE} />);
    expect(await screen.findByText(en.coreIdentity.roles.catalogueFailed)).toBeVisible();
    expect(io.catalogue).toHaveBeenCalledTimes(MAX_CATALOGUE_PAGES);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.coreIdentity.roles.savePermissions }),
    ).toBeDisabled();

    io.catalogue.mockResolvedValue({ items: catalogue, hasNext: false });
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));

    const allowed = await screen.findByRole("checkbox", { name: "Read roles" });
    expect(allowed).toBeEnabled();
    expect(allowed).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Read users" })).toBeDisabled();
    expect(screen.queryByText(en.coreIdentity.roles.catalogueFailed)).not.toBeInTheDocument();
  });

  it.each(["en", "ar"] as const)(
    "renders a localized empty state when the completed catalogue is empty (%s) and keeps save disabled and a no-op with zero changes",
    async (lang) => {
      locale.lang = lang;
      localStorage.setItem("tenant_lang", lang);
      const dict = { en, ar }[lang];
      io.catalogue.mockResolvedValue({ items: [], hasNext: false });

      render(<RoleEditorWorkspace id={ROLE} />);
      expect(await screen.findByText(dict.common.noData)).toBeVisible();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: dict.filters.clearAll }),
      ).not.toBeInTheDocument();

      const saveButton = screen.getByRole("button", {
        name: dict.coreIdentity.roles.savePermissions,
      });
      expect(saveButton).toBeDisabled();
      fireEvent.click(saveButton);
      expect(io.save).not.toHaveBeenCalled();

      const { result } = renderHook(() => useRolePermissionEditor(ROLE));
      await waitFor(() => expect(result.current.isCatalogueLoaded).toBe(true));
      expect(result.current.groups).toEqual([]);
      expect(result.current.isDirty).toBe(false);
      act(() => result.current.openConfirm());
      expect(result.current.isConfirmOpen).toBe(false);
      await act(async () => {
        await result.current.save();
      });
      expect(io.save).not.toHaveBeenCalled();
    },
  );
});
