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
import type { TenantRole, TenantRoleDetail } from "../contracts/role-contract";
import { useTenantRoles } from "./hooks/useTenantRoles";
import TenantRolesPage from "./page";

const DIRECTIONS = { en: "ltr", ar: "rtl" } as const;

const { auth, io, locale } = vi.hoisted(() => ({
  auth: {
    user: {
      isTenantOwner: false,
      permissions: [] as string[],
      permissionScopes: {} as Record<string, PermissionScope>,
    },
    retryBootstrap: vi.fn(),
  },
  io: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  locale: { lang: "en" as "en" | "ar" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/core/roles",
  useRouter: () => ({ push: vi.fn() }),
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
vi.mock("../contracts/role-contract", async (original) => ({
  ...(await original<typeof import("../contracts/role-contract")>()),
  fetchTenantRoles: io.list,
  createTenantRole: io.create,
  updateTenantRole: io.update,
  deleteTenantRole: io.remove,
}));

const SYSTEM_ROLE_ID = "01900100-0000-7000-8000-000000000010";
const CUSTOM_ROLE_ID = "01900100-0000-7000-8000-000000000011";
const BRANCH_SCOPE_ID = "01900100-0000-7000-8000-000000000099";

const systemRole: TenantRole = {
  id: SYSTEM_ROLE_ID,
  name: "Owner",
  nameAr: "المالك",
  nameEn: "Owner",
  descriptionAr: "صلاحيات كاملة للنظام",
  descriptionEn: "Full system access",
  isSystem: true,
  permissionMode: "GLOBAL",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
};

const customRole: TenantRole = {
  id: CUSTOM_ROLE_ID,
  name: "Sales Coordinator",
  nameAr: "منسق مبيعات",
  nameEn: "Sales Coordinator",
  descriptionAr: "متابعة عروض الأسعار",
  descriptionEn: "Handles inbound quotes",
  isSystem: false,
  permissionMode: "GLOBAL",
  createdAt: "2026-10-12T10:00:00.000Z",
  updatedAt: "2026-10-12T10:00:00.000Z",
};

function grant(key: string, tenantWide: boolean) {
  auth.user = {
    ...auth.user,
    permissions: [...new Set([...auth.user.permissions, key])],
    permissionScopes: {
      ...auth.user.permissionScopes,
      [key]: {
        tenantWide,
        companyIds: tenantWide ? [] : [BRANCH_SCOPE_ID],
        branchIds: tenantWide ? [] : [BRANCH_SCOPE_ID],
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  locale.lang = "en";
  localStorage.setItem("tenant_lang", "en");
  auth.user = { isTenantOwner: false, permissions: [], permissionScopes: {} };
  grant("roles.role.read", true);
  grant("roles.role.create", true);
  grant("roles.role.update", true);
  grant("roles.role.delete", true);
  grant("users.user.read", true);

  io.list.mockResolvedValue({
    items: [systemRole, customRole],
    page: 1,
    limit: 25,
    total: 2,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  });
  io.create.mockImplementation(
    async (body: { name: string; description?: string }): Promise<TenantRoleDetail> => ({
      ...customRole,
      name: body.name,
      nameAr: body.name,
      nameEn: body.name,
      descriptionAr: body.description ?? null,
      descriptionEn: body.description ?? null,
      permissionIds: [],
    }),
  );
  io.update.mockImplementation(
    async (
      _id: string,
      body: { name?: string; description?: string },
    ): Promise<TenantRoleDetail> => ({
      ...customRole,
      name: body.name ?? customRole.name,
      nameAr: body.name ?? customRole.nameAr,
      nameEn: body.name ?? customRole.nameEn,
      descriptionAr: body.description || null,
      descriptionEn: body.description || null,
      permissionIds: [],
    }),
  );
  io.remove.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("TenantRolesPage list, centered modals, and deletion blockers", () => {
  it("distinguishes system vs custom roles, explains read-only system roles, and gates mutations on tenant-wide grants", async () => {
    render(<TenantRolesPage />);

    expect(await screen.findByRole("link", { name: "Owner" })).toHaveAttribute(
      "href",
      `/core/roles/${SYSTEM_ROLE_ID}`,
    );
    expect(screen.getByRole("link", { name: "Sales Coordinator" })).toHaveAttribute(
      "href",
      `/core/roles/${CUSTOM_ROLE_ID}`,
    );

    expect(screen.getByText(en.coreIdentity.roles.systemRole)).toBeVisible();
    expect(screen.getByText(en.coreIdentity.roles.customOnly)).toBeVisible();
    expect(screen.getByText(en.coreIdentity.errors.ROLE_IS_SYSTEM)).toBeVisible();

    // System role exposes no edit or delete buttons even with tenant-wide grants.
    expect(
      screen.queryByRole("button", { name: `${en.coreIdentity.roles.rename}: Owner` }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `${en.coreIdentity.actions.delete}: Owner` }),
    ).not.toBeInTheDocument();

    // Custom role exposes view, edit, and delete when tenant-wide grants are held.
    expect(
      screen.getByRole("link", { name: `${en.coreIdentity.actions.view}: Sales Coordinator` }),
    ).toHaveAttribute("href", `/core/roles/${CUSTOM_ROLE_ID}`);
    expect(
      screen.getByRole("button", { name: `${en.coreIdentity.roles.rename}: Sales Coordinator` }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: `${en.coreIdentity.actions.delete}: Sales Coordinator` }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: en.coreIdentity.roles.create }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: en.coreIdentity.actions.refresh }),
    ).toBeEnabled();

    // Scoped (non-tenant-wide) role mutation grants do not unlock role mutations.
    cleanup();
    auth.user = { isTenantOwner: false, permissions: [], permissionScopes: {} };
    grant("roles.role.read", true);
    grant("roles.role.create", false);
    grant("roles.role.update", false);
    grant("roles.role.delete", false);

    render(<TenantRolesPage />);
    expect(await screen.findByRole("link", { name: "Sales Coordinator" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: en.coreIdentity.roles.create }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: `${en.coreIdentity.roles.rename}: Sales Coordinator`,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: `${en.coreIdentity.actions.delete}: Sales Coordinator`,
      }),
    ).not.toBeInTheDocument();
  });

  it("passes server filter, debounced search, and sort fields to fetchTenantRoles", async () => {
    const { result } = renderHook(() => useTenantRoles());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(io.list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        search: "",
        isSystem: undefined,
        sortBy: "name",
        sortDir: "ASC",
      }),
    );

    act(() => {
      result.current.setIsSystemFilter(false);
      result.current.setSort({ id: "createdAt", direction: "desc" });
    });
    await waitFor(() =>
      expect(io.list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          isSystem: false,
          sortBy: "createdAt",
          sortDir: "DESC",
        }),
      ),
    );

    act(() => {
      result.current.setSearchQuery("  Coordinator  ");
    });
    await waitFor(
      () =>
        expect(io.list).toHaveBeenLastCalledWith(
          expect.objectContaining({
            page: 1,
            search: "Coordinator",
          }),
        ),
      { timeout: 1000 },
    );
    act(() => {
      result.current.handleFilterChange({
        isSystem: { kind: "select", value: "true" },
      });
    });
    await waitFor(() =>
      expect(io.list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          isSystem: true,
        }),
      ),
    );

    act(() => {
      result.current.resetFilters();
    });
    await waitFor(() =>
      expect(io.list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          isSystem: undefined,
        }),
      ),
    );
  });

  it("opens a centered create modal, omits blank description, and preserves dirty draft on 409 conflict", async () => {
    io.create.mockRejectedValueOnce(
      new TenantApiClientError("Conflict", {
        status: 409,
        statusText: "Conflict",
        headers: new Headers(),
        data: { code: "ROLE_NAME_TAKEN" },
      }),
    );

    render(<TenantRolesPage />);
    await screen.findByRole("link", { name: "Sales Coordinator" });

    fireEvent.click(screen.getByRole("button", { name: en.coreIdentity.roles.create }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(en.coreIdentity.roles.createTitle)).toBeVisible();

    const saveButton = within(dialog).getByRole("button", { name: en.coreIdentity.roles.create });
    expect(saveButton).toBeDisabled();

    const nameInput = within(dialog).getByRole("textbox", {
      name: en.coreIdentity.roles.name,
    });
    const descriptionInput = within(dialog).getByRole("textbox", {
      name: en.coreIdentity.roles.description,
    });

    fireEvent.change(nameInput, { target: { value: "  Regional Lead  " } });
    fireEvent.change(descriptionInput, { target: { value: "   " } });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);

    expect(
      await within(dialog).findByText(en.coreIdentity.errors.ROLE_NAME_TAKEN),
    ).toBeVisible();
    // Dirty draft stays intact after server rejection.
    expect(nameInput).toHaveValue("  Regional Lead  ");

    // Second attempt succeeds with trimmed name and omitted blank description.
    fireEvent.click(saveButton);
    await waitFor(() =>
      expect(io.create).toHaveBeenCalledWith({ name: "Regional Lead" }),
    );
  });

  it("edits a custom role in a centered modal, sends empty string to clear an existing description, and guards dirty discard", async () => {
    render(<TenantRolesPage />);
    await screen.findByRole("link", { name: "Sales Coordinator" });

    fireEvent.click(
      screen.getByRole("button", {
        name: `${en.coreIdentity.roles.rename}: Sales Coordinator`,
      }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(en.coreIdentity.roles.renameTitle)).toBeVisible();

    const descriptionInput = within(dialog).getByRole("textbox", {
      name: en.coreIdentity.roles.description,
    });
    expect(descriptionInput).toHaveValue("Handles inbound quotes");

    // Clearing the stored description marks the modal dirty.
    fireEvent.change(descriptionInput, { target: { value: "" } });

    // Attempting to cancel triggers the discard confirmation alertdialog first.
    fireEvent.click(within(dialog).getByRole("button", { name: en.common.cancel }));
    const discardDialog = await screen.findByRole("alertdialog");
    expect(within(discardDialog).getByText(en.common.discardTitle)).toBeVisible();

    // Dismissing the discard confirmation keeps the edit draft open.
    fireEvent.click(within(discardDialog).getByRole("button", { name: en.common.cancel }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(descriptionInput).toHaveValue("");

    // Saving sends `description: ""` so PATCH /roles/:id clears the stored text.
    fireEvent.click(within(dialog).getByRole("button", { name: en.common.save }));
    await waitFor(() =>
      expect(io.update).toHaveBeenCalledWith(CUSTOM_ROLE_ID, {
        name: "Sales Coordinator",
        description: "",
      }),
    );
  });

  it("refuses system-role deletion and surfaces DeletionBlockerDialog on 409 ROLE_IN_USE", async () => {
    const { result } = renderHook(() => useTenantRoles());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.requestDelete(systemRole));
    expect(result.current.pendingDelete).toBeNull();
    cleanup();

    io.remove.mockRejectedValueOnce(
      new TenantApiClientError("Conflict", {
        status: 409,
        statusText: "Conflict",
        headers: new Headers(),
        data: { code: "ROLE_IN_USE" },
      }),
    );

    render(<TenantRolesPage />);
    await screen.findByRole("link", { name: "Sales Coordinator" });
    const listCallsBeforeDelete = io.list.mock.calls.length;

    fireEvent.click(
      screen.getByRole("button", {
        name: `${en.coreIdentity.actions.delete}: Sales Coordinator`,
      }),
    );
    const confirmDialog = await screen.findByRole("alertdialog");
    expect(within(confirmDialog).getByText(en.coreIdentity.roles.deleteTitle)).toBeVisible();

    fireEvent.click(
      within(confirmDialog).getByRole("button", { name: en.coreIdentity.actions.delete }),
    );

    await waitFor(() => expect(io.remove).toHaveBeenCalledWith(CUSTOM_ROLE_ID));
    const blockerDialog = await screen.findByRole("dialog");
    expect(within(blockerDialog).getByText(en.deletionBlocker.title)).toBeVisible();
    expect(
      within(blockerDialog).getByText(en.coreIdentity.errors.ROLE_IN_USE),
    ).toBeVisible();
    expect(within(blockerDialog).getByRole("link")).toHaveAttribute("href", "/core/users");
    // Does not reload or claim deletion succeeded.
    expect(io.list).toHaveBeenCalledTimes(listCallsBeforeDelete);
  });

  it("clamps an out-of-range page to Math.max(1, totalPages) after last-row deletion while preserving filters, search, and sort", async () => {
    let shrunk = false;
    io.list.mockImplementation(async (params: { page: number }) => {
      if (!shrunk) {
        return {
          items: params.page === 3 ? [customRole] : [systemRole],
          page: params.page,
          limit: 25,
          total: 51,
          totalPages: 3,
          hasNext: params.page < 3,
          hasPrev: params.page > 1,
        };
      }
      if (params.page > 2) {
        return {
          items: [],
          page: params.page,
          limit: 25,
          total: 40,
          totalPages: 2,
          hasNext: false,
          hasPrev: true,
        };
      }
      return {
        items: [systemRole],
        page: params.page,
        limit: 25,
        total: 40,
        totalPages: 2,
        hasNext: params.page < 2,
        hasPrev: params.page > 1,
      };
    });
    io.remove.mockImplementationOnce(async () => {
      shrunk = true;
    });

    const { result } = renderHook(() => useTenantRoles());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setIsSystemFilter(false);
      result.current.setSort({ id: "createdAt", direction: "desc" });
      result.current.setSearchQuery("Sales");
    });
    await waitFor(
      () =>
        expect(io.list).toHaveBeenLastCalledWith(
          expect.objectContaining({
            page: 1,
            search: "Sales",
            isSystem: false,
            sortBy: "createdAt",
            sortDir: "DESC",
          }),
        ),
      { timeout: 1000 },
    );

    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.rows).toEqual([customRole]));
    expect(result.current.page).toBe(3);

    act(() => result.current.requestDelete(customRole));
    await act(async () => {
      await result.current.handleDelete();
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(io.remove).toHaveBeenCalledWith(CUSTOM_ROLE_ID);
    expect(result.current.page).toBe(2);
    expect(result.current.rows).toEqual([systemRole]);
    expect(result.current.pageInfo).toEqual({ page: 2, limit: 25, total: 40 });
    expect(io.list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 2,
        search: "Sales",
        isSystem: false,
        sortBy: "createdAt",
        sortDir: "DESC",
      }),
    );
    cleanup();

    let uiDeleted = false;
    io.list.mockClear();
    io.list.mockImplementation(async (params: { page: number }) => {
      if (!uiDeleted) {
        return {
          items: params.page === 2 ? [customRole] : [systemRole],
          page: params.page,
          limit: 25,
          total: 26,
          totalPages: 2,
          hasNext: params.page < 2,
          hasPrev: params.page > 1,
        };
      }
      if (params.page > 1) {
        return {
          items: [],
          page: params.page,
          limit: 25,
          total: 25,
          totalPages: 1,
          hasNext: false,
          hasPrev: true,
        };
      }
      return {
        items: [systemRole],
        page: 1,
        limit: 25,
        total: 25,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };
    });
    io.remove.mockImplementationOnce(async () => {
      uiDeleted = true;
    });

    render(<TenantRolesPage />);
    expect(await screen.findByRole("link", { name: "Owner" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: en.common.nextPage }));
    expect(await screen.findByRole("link", { name: "Sales Coordinator" })).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", {
        name: `${en.coreIdentity.actions.delete}: Sales Coordinator`,
      }),
    );
    const confirmDialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(confirmDialog).getByRole("button", { name: en.coreIdentity.actions.delete }),
    );

    expect(await screen.findByRole("link", { name: "Owner" })).toBeVisible();
    expect(screen.queryByText(en.coreIdentity.roles.empty)).not.toBeInTheDocument();
  });

  it("renders localized Arabic role rows and badges under RTL", async () => {
    locale.lang = "ar";
    localStorage.setItem("tenant_lang", "ar");

    render(<TenantRolesPage />);
    expect(await screen.findByRole("link", { name: "المالك" })).toBeVisible();
    expect(screen.getByRole("link", { name: "منسق مبيعات" })).toBeVisible();
    expect(screen.getByText(ar.coreIdentity.roles.systemRole)).toBeVisible();
    expect(screen.getByText(ar.coreIdentity.roles.customOnly)).toBeVisible();
  });
});
