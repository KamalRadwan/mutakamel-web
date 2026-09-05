// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, authMock, toastMock, i18nMock } = vi.hoisted(() => ({
  apiMock: {
    countAdminUsers: vi.fn(),
    listAdminUsers: vi.fn(),
    listWebphoneExtensions: vi.fn(),
    getAdminUser: vi.fn(),
    isForbiddenError: vi.fn(() => false),
    listRoles: vi.fn(),
    suspendAdminUser: vi.fn(),
    activateAdminUser: vi.fn(),
    deleteAdminUser: vi.fn(),
    normalizeErrorCode: vi.fn(() => "UNKNOWN"),
  },
  authMock: { user: { isSuperAdmin: true, permissions: [] as string[] }, isLoading: false },
  toastMock: { error: vi.fn(), success: vi.fn() },
  i18nMock: {
    lang: "en" as const,
    dir: "ltr" as const,
    t: { users: { fetchLoadErrorTitle: "error" } } as never,
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => i18nMock,
  useOptionalI18n: () => i18nMock,
}));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => toastMock }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("../api/adminUsersApi", () => apiMock);

import { useUsers } from "./useUsers";

const user = (id: string, status: string, isSuperAdmin = false) => ({
  id,
  status,
  isSuperAdmin,
  email: `${id}@example.test`,
});

/** A page of twenty active members out of a directory of ninety. */
const FIRST_PAGE = {
  data: Array.from({ length: 20 }, (_, index) => user(`u${index}`, "ACTIVE")),
  meta: { total: 90, totalPages: 5, page: 1, limit: 20, hasNext: true, hasPrev: false },
};

/**
 * UI-014. The summary cards read as one breakdown of one population, but only
 * the total came from the pagination metadata: active, pending and super-admin
 * were tallied from whichever twenty rows the current page held. An operator
 * on a directory of ninety saw "90 total members / 20 active accounts / 0
 * pending invites", and the breakdown changed as they paged.
 */
describe("useUsers summary cards", () => {
  beforeEach(() => {
    Object.values(apiMock).forEach((mock) => {
      if (typeof mock === "function" && "mockReset" in mock) mock.mockReset();
    });
    apiMock.isForbiddenError.mockReturnValue(false);
    apiMock.normalizeErrorCode.mockReturnValue("UNKNOWN");
    apiMock.listRoles.mockResolvedValue({ data: [] });
    apiMock.listWebphoneExtensions.mockResolvedValue([]);
    apiMock.listAdminUsers.mockResolvedValue(FIRST_PAGE);
    apiMock.countAdminUsers.mockImplementation(
      async (params: { status?: string; isSuperAdmin?: string }) => {
        if (params.isSuperAdmin === "TRUE") return 4;
        if (params.status === "ACTIVE") return 61;
        if (params.status === "INVITED") return 22;
        if (params.status === "SUSPENDED") return 7;
        return null;
      },
    );
  });

  it("counts the whole filtered directory, not the rows on the page", async () => {
    const { result } = renderHook(() => useUsers());

    await waitFor(() => expect(result.current.summaryMetrics.active).toBe(61));
    expect(result.current.summaryMetrics.total).toBe(90);
    expect(result.current.summaryMetrics.invited).toBe(22);
    expect(result.current.summaryMetrics.suspended).toBe(7);
    expect(result.current.summaryMetrics.superAdmins).toBe(4);
    // The page it read held twenty active rows and no invited ones, so a
    // page-derived breakdown could not have produced these.
    expect(result.current.users).toHaveLength(20);
  });

  it("carries the active filters into every count", async () => {
    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.summaryMetrics.active).toBe(61));

    act(() => result.current.setRoleFilter("role-7"));
    await waitFor(() =>
      expect(
        apiMock.countAdminUsers.mock.calls.some(
          ([params]) => params.roleId === "role-7" && params.status === "INVITED",
        ),
      ).toBe(true),
    );
  });

  it("leaves the breakdown unchanged when the operator pages", async () => {
    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.summaryMetrics.active).toBe(61));
    const countsBefore = apiMock.countAdminUsers.mock.calls.length;

    apiMock.listAdminUsers.mockResolvedValue({
      data: Array.from({ length: 20 }, (_, index) => user(`p2-${index}`, "INVITED")),
      meta: { total: 90, totalPages: 5, page: 2, limit: 20, hasNext: true, hasPrev: true },
    });
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.users[0].id).toBe("p2-0"));

    expect(result.current.summaryMetrics.active).toBe(61);
    expect(result.current.summaryMetrics.invited).toBe(22);
    // Paging is not a new population, so it must not re-ask for the counts.
    expect(apiMock.countAdminUsers.mock.calls.length).toBe(countsBefore);
  });

  it("shows no count at all when the route reports none", async () => {
    apiMock.countAdminUsers.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useUsers());

    await waitFor(() => expect(result.current.summaryMetrics.total).toBe(90));
    expect(result.current.summaryMetrics.active).toBeNull();
    expect(result.current.summaryMetrics.invited).toBeNull();
    expect(result.current.summaryMetrics.superAdmins).toBeNull();
  });
});
