// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRoleDetail } from "./useRoleDetail";
import { rolesApi } from "../api";
import type { AdminRole } from "../contract";

const pushMock = vi.fn();
const toastMock = { success: vi.fn(), error: vi.fn() };
const authMock: { user: { isSuperAdmin: boolean; permissions: string[] } } = {
  user: { isSuperAdmin: false, permissions: [] },
};

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => toastMock }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "en",
    t: {
      roles: {
        nameRequiredError: "Role name is required.",
        nameTooShortError: "Name must contain at least 2 characters.",
        nameTooLongError: "Name cannot exceed 120 characters.",
        descriptionLengthError: "Description cannot exceed 2,000 characters.",
        metadataSavedTitle: "Role updated",
        metadataSavedDesc: "The server-confirmed role metadata is now displayed.",
        updateFailedTitle: "Update failed",
        permissionsSavedTitle: "Permissions updated",
        permissionsSavedDesc: "The server-confirmed permission set is now displayed.",
      },
    },
  }),
}));
vi.mock("../api", () => ({
  rolesApi: {
    get: vi.fn(),
    permissions: vi.fn(),
    update: vi.fn(),
    replacePermissions: vi.fn(),
  },
}));

const ROLE_ID = "019f0000-0000-7000-8000-000000000011";
const PERMISSION_ID = "019f0000-0000-7000-8000-000000000012";
const SECOND_PERMISSION_ID = "019f0000-0000-7000-8000-000000000013";
const TIMESTAMP = "2026-08-12T10:00:00.000Z";
const role: AdminRole = {
  id: ROLE_ID,
  name: "Billing Manager",
  description: "Old description",
  isSystem: false,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  permissionIds: [PERMISSION_ID],
};
const permission = {
  id: PERMISSION_ID,
  key: "admin.billing.read",
  nameAr: "قراءة الفوترة",
  nameEn: "Read billing",
  description: "Read billing",
  group: "Billing",
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
};
const result = <T,>(data: T) => ({
  data,
  correlationId: "019f0000-0000-7000-8000-000000000019",
  timestamp: TIMESTAMP,
});

describe("useRoleDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.user = { isSuperAdmin: false, permissions: [] };
    vi.mocked(rolesApi.get).mockResolvedValue(result(role));
    vi.mocked(rolesApi.permissions).mockResolvedValue(result([permission]));
    vi.mocked(rolesApi.update).mockResolvedValue(result(role));
    vi.mocked(rolesApi.replacePermissions).mockResolvedValue(result(role));
  });

  it("loads role metadata independently when the permission catalogue is forbidden", async () => {
    vi.mocked(rolesApi.permissions).mockRejectedValue({
      response: {
        status: 403,
        data: { code: "GW.AUTHZ.DENIED", title: "Forbidden", status: 403 },
      },
    });
    const { result: hook } = renderHook(() => useRoleDetail(ROLE_ID));

    await waitFor(() => expect(hook.current.isLoading).toBe(false));
    await waitFor(() => expect(hook.current.isCatalogueLoading).toBe(false));
    expect(hook.current.name).toBe("Billing Manager");
    expect(hook.current.assignedPermissions).toEqual(new Set([PERMISSION_ID]));
    expect(hook.current.catalogueError?.httpStatus).toBe(403);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("requires admin.roles.update before metadata mutation", async () => {
    const { result: hook } = renderHook(() => useRoleDetail(ROLE_ID));
    await waitFor(() => expect(hook.current.isLoading).toBe(false));
    act(() => hook.current.setName("Renamed role"));
    await act(async () => hook.current.saveMetadata());

    expect(rolesApi.update).not.toHaveBeenCalled();
    expect(hook.current.metadataError?.httpStatus).toBe(403);
  });

  it("trims a nonempty name, clears description with null, and reconciles the response", async () => {
    authMock.user.permissions = ["admin.roles.update"];
    const reconciled = {
      ...role,
      name: "Canonical role name",
      description: null,
    };
    vi.mocked(rolesApi.update).mockResolvedValue(result(reconciled));
    const { result: hook } = renderHook(() => useRoleDetail(ROLE_ID));
    await waitFor(() => expect(hook.current.isLoading).toBe(false));

    act(() => {
      hook.current.setName("  Renamed role  ");
      hook.current.setDescription("   ");
    });
    await act(async () => hook.current.saveMetadata());

    expect(rolesApi.update).toHaveBeenCalledWith(
      ROLE_ID,
      { name: "Renamed role", description: null },
      expect.stringMatching(/^[0-9a-f-]{36}$/u),
    );
    expect(hook.current.name).toBe("Canonical role name");
    expect(hook.current.description).toBe("");
    expect(hook.current.metadataDirty).toBe(false);
  });

  it("blocks trimmed-empty names before the request boundary", async () => {
    authMock.user.permissions = ["admin.roles.update"];
    const { result: hook } = renderHook(() => useRoleDetail(ROLE_ID));
    await waitFor(() => expect(hook.current.isLoading).toBe(false));
    act(() => hook.current.setName("   "));
    expect(hook.current.nameError).toBeTruthy();
    await act(async () => hook.current.saveMetadata());
    expect(rolesApi.update).not.toHaveBeenCalled();
  });

  it.each([
    ["update only", ["admin.roles.update"]],
    ["critical only", ["admin.roles.critical"]],
    ["neither permission", []],
  ])(
    "requires both update and critical permissions when the caller has %s",
    async (_label, permissions) => {
      authMock.user.permissions = permissions;
      const { result: hook } = renderHook(() => useRoleDetail(ROLE_ID));
      await waitFor(() => expect(hook.current.isLoading).toBe(false));
      expect(hook.current.canReplacePermissions).toBe(false);
      act(() => hook.current.togglePermission(SECOND_PERMISSION_ID));
      await act(async () => hook.current.savePermissions());
      expect(rolesApi.replacePermissions).not.toHaveBeenCalled();
      expect(hook.current.permissionsError?.httpStatus).toBe(403);
    },
  );

  it("submits the complete permission set only with the critical pair", async () => {
    authMock.user.permissions = ["admin.roles.update", "admin.roles.critical"];
    vi.mocked(rolesApi.permissions).mockResolvedValue(
      result([
        permission,
        { ...permission, id: SECOND_PERMISSION_ID, key: "admin.billing.update" },
      ]),
    );
    const reconciled = {
      ...role,
      permissionIds: [PERMISSION_ID, SECOND_PERMISSION_ID],
    };
    vi.mocked(rolesApi.replacePermissions).mockResolvedValue(result(reconciled));
    const { result: hook } = renderHook(() => useRoleDetail(ROLE_ID));
    await waitFor(() => expect(hook.current.catalogueLength).toBe(2));

    act(() => hook.current.togglePermission(SECOND_PERMISSION_ID));
    await act(async () => hook.current.savePermissions());

    expect(rolesApi.replacePermissions).toHaveBeenCalledWith(
      ROLE_ID,
      { permissionIds: [PERMISSION_ID, SECOND_PERMISSION_ID] },
      expect.stringMatching(/^[0-9a-f-]{36}$/u),
    );
    expect(hook.current.permissionsDirty).toBe(false);
  });

  // Metadata and permissions are two forms with two Save buttons, and each
  // write answers with the whole role. Whichever one is saved must leave the
  // other operator's unsaved work — and its dirty flag — exactly where it was.
  describe("independent editors", () => {
    const bothPermissions = ["admin.roles.update", "admin.roles.critical"];
    const twoPermissionCatalogue = [
      permission,
      { ...permission, id: SECOND_PERMISSION_ID, key: "admin.billing.update" },
    ];

    it("keeps an unsaved name when the permission editor saves", async () => {
      authMock.user.permissions = bothPermissions;
      vi.mocked(rolesApi.permissions).mockResolvedValue(
        result(twoPermissionCatalogue),
      );
      vi.mocked(rolesApi.replacePermissions).mockResolvedValue(
        result({ ...role, permissionIds: [PERMISSION_ID, SECOND_PERMISSION_ID] }),
      );
      const { result: hook } = renderHook(() => useRoleDetail(ROLE_ID));
      await waitFor(() => expect(hook.current.catalogueLength).toBe(2));

      act(() => {
        hook.current.setName("Renamed role");
        hook.current.setDescription("Draft description");
        hook.current.togglePermission(SECOND_PERMISSION_ID);
      });
      await act(async () => hook.current.savePermissions());

      expect(rolesApi.update).not.toHaveBeenCalled();
      expect(hook.current.name).toBe("Renamed role");
      expect(hook.current.description).toBe("Draft description");
      expect(hook.current.metadataDirty).toBe(true);
      expect(hook.current.assignedPermissions).toEqual(
        new Set([PERMISSION_ID, SECOND_PERMISSION_ID]),
      );
      expect(hook.current.permissionsDirty).toBe(false);
    });

    it("keeps an unsaved permission selection when the metadata editor saves", async () => {
      authMock.user.permissions = bothPermissions;
      vi.mocked(rolesApi.permissions).mockResolvedValue(
        result(twoPermissionCatalogue),
      );
      vi.mocked(rolesApi.update).mockResolvedValue(
        result({ ...role, name: "Renamed role", description: "Saved" }),
      );
      const { result: hook } = renderHook(() => useRoleDetail(ROLE_ID));
      await waitFor(() => expect(hook.current.catalogueLength).toBe(2));

      act(() => {
        hook.current.setName("Renamed role");
        hook.current.setDescription("Saved");
        hook.current.togglePermission(SECOND_PERMISSION_ID);
      });
      await act(async () => hook.current.saveMetadata());

      expect(rolesApi.replacePermissions).not.toHaveBeenCalled();
      expect(hook.current.assignedPermissions).toEqual(
        new Set([PERMISSION_ID, SECOND_PERMISSION_ID]),
      );
      expect(hook.current.permissionsDirty).toBe(true);
      expect(hook.current.name).toBe("Renamed role");
      expect(hook.current.metadataDirty).toBe(false);
    });

    it("refreshes an untouched editor from the other editor's response", async () => {
      authMock.user.permissions = bothPermissions;
      vi.mocked(rolesApi.permissions).mockResolvedValue(
        result(twoPermissionCatalogue),
      );
      // Somebody else renamed the role between the page load and this save.
      vi.mocked(rolesApi.replacePermissions).mockResolvedValue(
        result({
          ...role,
          name: "Renamed elsewhere",
          permissionIds: [PERMISSION_ID, SECOND_PERMISSION_ID],
        }),
      );
      const { result: hook } = renderHook(() => useRoleDetail(ROLE_ID));
      await waitFor(() => expect(hook.current.catalogueLength).toBe(2));

      act(() => hook.current.togglePermission(SECOND_PERMISSION_ID));
      await act(async () => hook.current.savePermissions());

      expect(hook.current.name).toBe("Renamed elsewhere");
      expect(hook.current.metadataDirty).toBe(false);
    });
  });

  it("reuses the same UUIDv7 for an exact retry after an ambiguous write", async () => {
    authMock.user.permissions = ["admin.roles.update"];
    vi.mocked(rolesApi.update)
      .mockRejectedValueOnce(new TypeError("network failed"))
      .mockResolvedValueOnce(result({ ...role, name: "Renamed role" }));
    const { result: hook } = renderHook(() => useRoleDetail(ROLE_ID));
    await waitFor(() => expect(hook.current.isLoading).toBe(false));
    act(() => hook.current.setName("Renamed role"));

    await act(async () => hook.current.saveMetadata());
    expect(hook.current.metadataAmbiguous).toBe(true);
    await act(async () => hook.current.saveMetadata());

    const firstKey = vi.mocked(rolesApi.update).mock.calls[0]?.[2];
    const secondKey = vi.mocked(rolesApi.update).mock.calls[1]?.[2];
    expect(firstKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/u);
    expect(secondKey).toBe(firstKey);
    expect(hook.current.metadataAmbiguous).toBe(false);
  });
});
