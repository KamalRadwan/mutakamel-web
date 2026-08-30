// @vitest-environment jsdom

import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { hookMock, i18nMock } = vi.hoisted(() => ({
  hookMock: vi.fn(),
  i18nMock: {
    lang: "en" as "ar" | "en",
    t: null as unknown,
  },
}));

vi.mock("./hooks/useTenants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./hooks/useTenants")>();
  return { ...actual, useTenants: hookMock };
});
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => i18nMock }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/tenants",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import TenantsDirectoryPage from "./page";
import type { TenantRecord } from "./hooks/useTenants";
import {
  DATABASE_ID,
  TENANT_ID,
} from "@/features/admin/tenant-workspace/core/__tests__/fixtures";

describe("TenantsDirectoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18nMock.lang = "en";
    i18nMock.t = englishDictionary();
    hookMock.mockReturnValue(baseController() as never);
  });

  it("renders the exact failed status and only real observed database servers", () => {
    const controller = baseController();
    hookMock.mockReturnValue(controller as never);
    render(<TenantsDirectoryPage />);

    const status = screen.getByRole("combobox", { name: "Filter by status" });
    fireEvent.click(status);
    fireEvent.click(screen.getByRole("option", { name: "Provisioning failed" }));
    expect(controller.setStatusFilter).toHaveBeenCalledWith("PROVISIONING_FAILED");
    expect(screen.queryByRole("option", { name: "FAILED" })).not.toBeInTheDocument();

    const server = screen.getByRole("combobox", {
      name: "Filter by database server",
    });
    fireEvent.click(server);
    fireEvent.click(screen.getByRole("option", { name: "Postgres Cairo" }));
    expect(controller.setServerFilter).toHaveBeenCalledWith(DATABASE_ID);
    expect(document.body.textContent).not.toContain("srv-eg-01");
    expect(document.body.textContent).not.toContain("srv-de-02");
  });

  it("gates create and lifecycle controls and reprovisions only a failed row", () => {
    const failed = tenantRecord("PROVISIONING_FAILED", "failed");
    const active = tenantRecord("ACTIVE", "active");
    const suspended = tenantRecord("SUSPENDED", "suspended");
    const deleted = tenantRecord("DELETED", "deleted");
    const controller = baseController({
      tenants: [failed, active, suspended, deleted],
      totalItems: 4,
      permissions: {
        canRead: true,
        canCreate: false,
        canSuspendOrActivate: true,
        canReprovision: true,
        canSoftDelete: true,
      },
    });
    hookMock.mockReturnValue(controller as never);
    render(<TenantsDirectoryPage />);

    expect(
      screen.queryByRole("link", { name: "Register tenant" }),
    ).not.toBeInTheDocument();
    openMenu("Tenant actions: Acme active");
    expect(screen.getByRole("menuitem", { name: "Suspend" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    openMenu("Tenant actions: Acme suspended");
    expect(screen.getByRole("menuitem", { name: "Activate" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    openMenu("Tenant actions: Acme deleted");
    expect(screen.queryByRole("menuitem", { name: "Soft delete" })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    openMenu("Tenant actions: Acme failed");
    fireEvent.click(screen.getByRole("menuitem", { name: "Retry provisioning" }));
    expect(controller.handleReprovision).toHaveBeenCalledWith(failed);
    expect(controller.handleReprovision).toHaveBeenCalledTimes(1);
  });

  it("shows trustworthy errors and drives server pagination without guessing", () => {
    const controller = baseController({
      page: 2,
      totalItems: 30,
      pagination: {
        page: 2,
        limit: 10,
        total: 30,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      },
      loadError: {
        isNormalized: true,
        httpStatus: 503,
        errorCode: "TENANT_DATABASE_NOT_READY",
        errorCategory: "SERVER_ERROR",
        message: "Tenant database is not ready yet.",
        correlationId: "019ff251-184d-715c-8ee3-77104f14c446",
      },
    });
    hookMock.mockReturnValue(controller as never);
    render(<TenantsDirectoryPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "TENANT_DATABASE_NOT_READY",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "019ff251-184d-715c-8ee3-77104f14c446",
    );
    expect(screen.getByText("Showing 11–20 of 30 · Page 2 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(controller.setPage).toHaveBeenNthCalledWith(1, 1);
    expect(controller.setPage).toHaveBeenNthCalledWith(2, 3);
    expect(controller.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps Arabic source text valid UTF-8 across status and actions", () => {
    i18nMock.lang = "ar";
    i18nMock.t = arabicDictionary();
    hookMock.mockReturnValue(
      baseController({
        t: arabicDictionary(),
        tenants: [tenantRecord("PROVISIONING_FAILED", "failed")],
        permissions: {
          canRead: true,
          canCreate: false,
          canSuspendOrActivate: false,
          canReprovision: true,
          canSoftDelete: false,
        },
      }) as never,
    );
    render(<TenantsDirectoryPage />);

    expect(screen.getByText("عزل متعدد المستأجرين")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "تصفية حسب الحالة" }));
    expect(screen.getAllByText("فشل التجهيز")).toHaveLength(2);
    fireEvent.keyDown(document, { key: "Escape" });
    openMenu("إجراءات المستأجر: Acme failed");
    expect(screen.getByRole("menuitem", { name: "إعادة محاولة التجهيز" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[ØÙâÂ]/);
  });

  it("requires the exact tenant name in the bilingual destructive modal", () => {
    const tenant = tenantRecord("ACTIVE", "active");
    const controller = baseController({
      activeModalTenant: tenant,
      modalActionType: "delete",
    });
    hookMock.mockReturnValue(controller as never);
    render(<TenantsDirectoryPage />);

    expect(
      screen.getByRole("heading", { name: "Confirm tenant soft deletion" }),
    ).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Confirm Action" });
    expect(confirm).toBeDisabled();

    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Type the exact name to confirm",
      }),
      { target: { value: tenant.name } },
    );
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(controller.confirmModalAction).toHaveBeenCalledTimes(1);
  });

  it("disables all writes while one tenant command is pending", () => {
    const controller = baseController({
      tenants: [
        tenantRecord("PROVISIONING_FAILED", "failed"),
        tenantRecord("ACTIVE", "active"),
      ],
      pendingAction: { action: "reprovision", tenantId: TENANT_ID },
    });
    hookMock.mockReturnValue(controller as never);
    render(<TenantsDirectoryPage />);

    openMenu("Tenant actions: Acme active");
    expect(screen.getByRole("menuitem", { name: "Suspend" })).toHaveAttribute("data-disabled");
    expect(screen.getByRole("menuitem", { name: "Soft delete" })).toHaveAttribute("data-disabled");
  });
});

function openMenu(name: string) {
  fireEvent.pointerDown(screen.getByRole("button", { name }), {
    button: 0,
    ctrlKey: false,
  });
}

function baseController(overrides: Record<string, unknown> = {}) {
  const tenants = [tenantRecord("ACTIVE", "active")];
  return {
    t: englishDictionary(),
    search: "",
    setSearch: vi.fn(),
    statusFilter: "ALL",
    setStatusFilter: vi.fn(),
    serverFilter: "ALL",
    setServerFilter: vi.fn(),
    databaseServerOptions: [{ id: DATABASE_ID, name: "Postgres Cairo" }],
    databaseServerOptionsState: "ready",
    databaseServerOptionsError: null,
    retryDatabaseServerOptions: vi.fn().mockResolvedValue(undefined),
    page: 1,
    setPage: vi.fn(),
    limit: 10,
    tenants,
    totalItems: tenants.length,
    pagination: {
      page: 1,
      limit: 10,
      total: tenants.length,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
    activeModalTenant: null,
    modalActionType: null,
    closeModal: vi.fn(),
    confirmModalAction: vi.fn().mockResolvedValue(undefined),
    openActivateModal: vi.fn(),
    openSuspendModal: vi.fn(),
    openDeleteModal: vi.fn(),
    handleReprovision: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
    loadError: null,
    actionError: null,
    clearActionError: vi.fn(),
    pendingAction: null,
    permissions: {
      canRead: true,
      canCreate: true,
      canSuspendOrActivate: true,
      canReprovision: true,
      canSoftDelete: true,
    },
    ...overrides,
  };
}

function tenantRecord(
  status: TenantRecord["status"],
  suffix: string,
): TenantRecord {
  return {
    id:
      suffix === "failed"
        ? TENANT_ID
        : `019ff25${suffix.length}-02e5-71fc-a7e9-05495cb3c6a8`,
    name: `acme-${suffix}`,
    companyName: `Acme ${suffix}`,
    primaryFqdn: `acme-${suffix}.mutakamel.ai`,
    secondaryFqdnsCount: 0,
    databaseServerName: "Postgres Cairo",
    databaseServerId: DATABASE_ID,
    storageServerId: "019ff251-2222-7222-8222-222222222222",
    storageServer: {
      id: "019ff251-2222-7222-8222-222222222222",
      code: "garage-cairo-1",
      name: "Garage Cairo",
      region: "af-cairo-1",
      status: "ACTIVE",
    },
    countryName: "Egypt",
    countryIsoCode: "EG",
    subscriptionStatus: "TRIAL",
    seats: 10,
    status,
    ownerEmail: "owner@example.com",
    createdAt: "2026-08-11T19:30:00.000Z",
  };
}

function englishDictionary() {
  return {
    tenants: {
      pageTitle: "Tenants",
      pageSubtitle: "Manage isolated tenant organizations.",
      registerTenant: "Register tenant",
      allStatuses: "All statuses",
      statusNames: {
        ACTIVE: "Active",
        PROVISIONING: "Provisioning",
        FAILED: "Provisioning failed",
        SUSPENDED: "Suspended",
        DELETED: "Deleted",
      },
      allServers: "All database servers",
      tenantName: "Tenant",
      primaryFqdn: "Primary FQDN",
      status: "Status",
      actions: "Actions",
      emptyState: "No tenants found.",
    },
  };
}

function arabicDictionary() {
  return {
    tenants: {
      pageTitle: "المستأجرون",
      pageSubtitle: "إدارة المؤسسات المعزولة.",
      registerTenant: "تسجيل مستأجر",
      allStatuses: "كل الحالات",
      statusNames: {
        ACTIVE: "نشط",
        PROVISIONING: "جارٍ التجهيز",
        FAILED: "فشل التجهيز",
        SUSPENDED: "معلّق",
        DELETED: "محذوف",
      },
      allServers: "كل خوادم قواعد البيانات",
      tenantName: "المستأجر",
      primaryFqdn: "النطاق الأساسي",
      status: "الحالة",
      actions: "الإجراءات",
      emptyState: "لا يوجد مستأجرون.",
    },
  };
}
