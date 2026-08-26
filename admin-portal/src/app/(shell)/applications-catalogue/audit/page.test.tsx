// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, i18nMock, getGlobalAuditMock } = vi.hoisted(() => ({
  authMock: {
    user: { isSuperAdmin: false, permissions: [] as string[] },
    isLoading: false,
  },
  i18nMock: { lang: "en" as "ar" | "en", dir: "ltr" as "ltr" | "rtl" },
  getGlobalAuditMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => i18nMock }));
vi.mock("@/components/layout/Navbar", () => ({ Navbar: () => <nav /> }));
vi.mock("@/features/admin/applications/api/applications.api", () => ({
  applicationsApi: { getGlobalAudit: getGlobalAuditMock },
}));

import CatalogueAuditPage from "./page";

describe("CatalogueAuditPage permission and locale boundaries", () => {
  beforeEach(() => {
    authMock.user = { isSuperAdmin: false, permissions: [] };
    authMock.isLoading = false;
    i18nMock.lang = "en";
    i18nMock.dir = "ltr";
    getGlobalAuditMock.mockReset();
  });

  it("does not request audit evidence without catalogue-read permission", () => {
    render(<CatalogueAuditPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Catalogue-read permission is required",
    );
    expect(getGlobalAuditMock).not.toHaveBeenCalled();
  });

  it("renders the forbidden state in Arabic and RTL", () => {
    i18nMock.lang = "ar";
    i18nMock.dir = "rtl";

    const { container } = render(<CatalogueAuditPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("صلاحية قراءة الكتالوج");
    expect(container.firstElementChild).toHaveAttribute("dir", "rtl");
    expect(getGlobalAuditMock).not.toHaveBeenCalled();
  });
});
