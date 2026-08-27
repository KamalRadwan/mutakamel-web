// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, detailHookMock } = vi.hoisted(() => ({
  authMock: {
    user: { isSuperAdmin: false, permissions: [] as string[] },
    isLoading: false,
  },
  detailHookMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "en",
    dir: "ltr",
    t: {
      databaseServerDetail: {
        checkingAccess: "Checking database-server access...",
        forbiddenTitle: "You do not have permission to view this database server.",
      },
    },
  }),
}));
vi.mock(
  "@/features/admin/database-servers/hooks/useDatabaseServerDetailPage",
  () => ({ useDatabaseServerDetailPage: detailHookMock }),
);

import DatabaseServerDetailPage from "./page";

const RESOLVED_PARAMS = Object.assign(
  Promise.resolve({ id: "019f0000-0000-7000-8000-000000000001" }),
  {
    status: "fulfilled" as const,
    value: { id: "019f0000-0000-7000-8000-000000000001" },
  },
);

describe("DatabaseServerDetailPage read preflight", () => {
  beforeEach(() => {
    authMock.user = { isSuperAdmin: false, permissions: [] };
    authMock.isLoading = false;
    detailHookMock.mockReset();
  });

  it("does not mount any detail API hooks without read permission", () => {
    render(<DatabaseServerDetailPage params={RESOLVED_PARAMS} />);

    expect(
      screen.getByRole("heading", {
        name: "You do not have permission to view this database server.",
      }),
    ).toBeInTheDocument();
    expect(detailHookMock).not.toHaveBeenCalled();
  });

  it("does not mount detail hooks while authorization is unresolved", () => {
    authMock.isLoading = true;
    render(<DatabaseServerDetailPage params={RESOLVED_PARAMS} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking database-server access",
    );
    expect(detailHookMock).not.toHaveBeenCalled();
  });
});
