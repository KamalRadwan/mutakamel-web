// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";

const { authMock, i18nMock, applicationsHookMock } = vi.hoisted(() => ({
  authMock: {
    user: { isSuperAdmin: false, permissions: [] as string[] },
    isLoading: false,
  },
  i18nMock: { lang: "en" as "ar" | "en", dir: "ltr" as "ltr" | "rtl" },
  applicationsHookMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ ...i18nMock, t: i18nMock.lang === "ar" ? ar : en }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/applications-catalogue",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/admin/applications/hooks/useApplications", () => ({
  useApplications: applicationsHookMock,
}));
vi.mock(
  "@/features/admin/applications/components/CreateApplicationModal",
  () => ({ CreateApplicationModal: () => null }),
);

import ApplicationsPage from "./page";

describe("ApplicationsPage read preflight", () => {
  beforeEach(() => {
    authMock.user = { isSuperAdmin: false, permissions: [] };
    authMock.isLoading = false;
    i18nMock.lang = "en";
    i18nMock.dir = "ltr";
    applicationsHookMock.mockReset();
  });

  it("does not mount the catalogue API hook without read permission", () => {
    render(<ApplicationsPage />);

    expect(
      screen.getByRole("heading", {
        name: "You do not have permission to view the Application Catalogue.",
      }),
    ).toBeInTheDocument();
    expect(applicationsHookMock).not.toHaveBeenCalled();
  });

  it("does not mount the catalogue API hook while auth is unresolved", () => {
    authMock.isLoading = true;
    render(<ApplicationsPage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking Application Catalogue access",
    );
    expect(applicationsHookMock).not.toHaveBeenCalled();
  });

  it("renders the permission boundary in Arabic", () => {
    i18nMock.lang = "ar";
    i18nMock.dir = "rtl";

    render(<ApplicationsPage />);

    expect(
      screen.getByRole("heading", {
        name: "لا تملك صلاحية عرض كتالوج التطبيقات.",
      }),
    ).toBeInTheDocument();
    expect(applicationsHookMock).not.toHaveBeenCalled();
  });

  it("renders the catalogue filters and states in Arabic", () => {
    i18nMock.lang = "ar";
    i18nMock.dir = "rtl";
    authMock.user = {
      isSuperAdmin: false,
      permissions: ["admin.applications.read"],
    };
    applicationsHookMock.mockReturnValue({
      applications: [],
      isLoading: false,
      error: null,
      search: "",
      setSearch: vi.fn(),
      typeFilter: "ALL",
      setTypeFilter: vi.fn(),
      commercialFilter: "ALL",
      setCommercialFilter: vi.fn(),
      visibilityFilter: "ALL",
      setVisibilityFilter: vi.fn(),
      lifecycleFilter: "ALL",
      setLifecycleFilter: vi.fn(),
      publicationFilter: "ALL",
      setPublicationFilter: vi.fn(),
      deploymentFilter: "ALL",
      setDeploymentFilter: vi.fn(),
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
      page: 1,
      setPage: vi.fn(),
      limit: 20,
      setLimit: vi.fn(),
      refresh: vi.fn(),
      createApplication: vi.fn(),
      onboardApplication: vi.fn(),
    });

    render(<ApplicationsPage />);

    expect(
      screen.getByRole("heading", { name: "كتالوج التطبيقات" }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("ابحث في التطبيقات…"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
    expect(screen.getByText("لا توجد تطبيقات مطابقة")).toBeInTheDocument();
  });
});
