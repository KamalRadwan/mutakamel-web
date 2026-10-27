// @vitest-environment jsdom

import { Suspense } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { rolesApi } from "../api";
import RoleDetailPage from "./page";

const auth = { user: { isSuperAdmin: false, permissions: [] as string[] } };
const toast = { success: vi.fn(), error: vi.fn() };
let lang: "en" | "ar" = "en";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => toast }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang, dir: lang === "ar" ? "rtl" : "ltr", t: lang === "ar" ? ar : en }),
  useOptionalI18n: () => ({ lang, dir: lang === "ar" ? "rtl" : "ltr", t: lang === "ar" ? ar : en }),
}));
vi.mock("../api", () => ({
  rolesApi: { get: vi.fn(), permissions: vi.fn(), update: vi.fn(), replacePermissions: vi.fn() },
}));

const ROLE_ID = "019f0000-0000-7000-8000-000000000011";
const READ_ID = "019f0000-0000-7000-8000-000000000012";
const UPDATE_ID = "019f0000-0000-7000-8000-000000000013";
const DELETE_ID = "019f0000-0000-7000-8000-000000000014";
const TIMESTAMP = "2026-08-12T10:00:00.000Z";
const role = {
  id: ROLE_ID, name: "Billing Manager", description: null, isSystem: false,
  permissionIds: [READ_ID], createdAt: TIMESTAMP, updatedAt: TIMESTAMP,
};
const catalogue = [
  { id: READ_ID, key: "admin.billing.read", nameEn: "Read billing", nameAr: "قراءة الفوترة" },
  { id: UPDATE_ID, key: "admin.billing.update", nameEn: "Update billing", nameAr: "تعديل الفوترة" },
  { id: DELETE_ID, key: "admin.billing.delete", nameEn: "Delete billing", nameAr: "حذف الفوترة" },
].map((permission) => ({
  ...permission, description: permission.nameEn, group: "Billing",
  createdAt: TIMESTAMP, updatedAt: TIMESTAMP,
}));
const response = <T,>(data: T) => ({ data, correlationId: ROLE_ID, timestamp: TIMESTAMP });

async function openPage() {
  await act(async () => {
    render(<Suspense fallback={null}><RoleDetailPage params={Promise.resolve({ id: ROLE_ID })} /></Suspense>);
  });
  await screen.findByRole("checkbox", { name: new RegExp(catalogue[0]![lang === "ar" ? "nameAr" : "nameEn"]) });
}

describe("role permission delegation controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lang = "en";
    auth.user = {
      isSuperAdmin: false,
      permissions: ["admin.roles.update", "admin.roles.critical", "admin.billing.read", "admin.billing.update"],
    };
    vi.mocked(rolesApi.get).mockResolvedValue(response(role));
    vi.mocked(rolesApi.permissions).mockResolvedValue(response(catalogue));
    vi.mocked(rolesApi.replacePermissions).mockImplementation(async (_id, command) =>
      response({ ...role, permissionIds: command.permissionIds }),
    );
  });

  it.each(["en", "ar"] as const)("explains disabled permissions and saves only delegated group selections in %s", async (locale) => {
    lang = locale;
    const t = locale === "ar" ? ar : en;
    await openPage();
    const unowned = screen.getByRole("checkbox", { name: /Delete billing|حذف الفوترة/u });
    expect(unowned).toBeDisabled();
    expect(unowned).toHaveAccessibleDescription(t.roles.permissionNotDelegableHint);
    expect(screen.getByText(t.roles.permissionNotDelegableHint)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: t.roles.selectAll }));
    expect(screen.getByRole("checkbox", { name: /Update billing|تعديل الفوترة/u })).toBeChecked();
    expect(unowned).not.toBeChecked();
    // All delegable permissions are selected even though the locked one is not.
    expect(screen.getByRole("button", { name: t.roles.deselectAll })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: t.roles.savePermissionSet }));
    await waitFor(() => expect(rolesApi.replacePermissions).toHaveBeenCalledWith(
      ROLE_ID, { permissionIds: [READ_ID, UPDATE_ID] }, expect.any(String),
    ));
  });

  it.each(["en", "ar"] as const)("preserves protected assignments and explains the read-only matrix in %s", async (locale) => {
    lang = locale;
    const t = locale === "ar" ? ar : en;
    vi.mocked(rolesApi.get).mockResolvedValue(response({ ...role, permissionIds: [READ_ID, DELETE_ID] }));
    await openPage();
    expect(screen.getByText(t.roles.protectedPermissionSetHint)).toBeVisible();
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Delete billing|حذف الفوترة/u })).toBeChecked();
    expect(screen.queryByRole("button", { name: t.roles.savePermissionSet })).not.toBeInTheDocument();
    expect(rolesApi.replacePermissions).not.toHaveBeenCalled();
  });

  it("disables a group action when the filtered group contains no delegable permissions", async () => {
    await openPage();
    fireEvent.change(screen.getByPlaceholderText(en.roles.searchPermissionsPlaceholder), {
      target: { value: "admin.billing.delete" },
    });
    expect(screen.getByRole("button", { name: en.roles.selectAll })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Delete billing" })).toBeDisabled();
    expect(screen.getByText(en.roles.permissionNotDelegableHint)).toBeVisible();
  });
});
