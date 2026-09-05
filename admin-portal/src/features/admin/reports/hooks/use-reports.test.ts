// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportSnapshot } from "../types/reports";

const {
  authMock,
  overviewMock,
  tenantsMock,
  serversMock,
  billingMock,
  provisioningMock,
} = vi.hoisted(() => ({
  authMock: {
    user: {
      isSuperAdmin: false,
      permissions: ["admin.reports.read"],
    } as { isSuperAdmin: boolean; permissions: string[] } | null,
    isLoading: false,
  },
  overviewMock: vi.fn(),
  tenantsMock: vi.fn(),
  serversMock: vi.fn(),
  billingMock: vi.fn(),
  provisioningMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("../api/reports-api", () => ({
  reportsApi: {
    overview: overviewMock,
    tenants: tenantsMock,
    servers: serversMock,
    billing: billingMock,
    provisioning: provisioningMock,
  },
}));

import { useReports } from "./use-reports";

const TIMESTAMP = "2026-08-12T08:00:00.000Z";

function snapshot<T>(data: T): ReportSnapshot<T> {
  return {
    data,
    correlationId: "019f0000-0000-7000-8000-000000000001",
    responseTimestamp: TIMESTAMP,
  };
}

const OVERVIEW = snapshot({
  asOf: TIMESTAMP,
  tenantsByStatus: { ACTIVE: 2 },
  subscriptions: { count: 2, totalAllowedUsers: 40 },
  outstandingInvoices: { count: 1, total: "20.0000" },
});

const EMPTY_TENANTS = snapshot({
  items: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
});

const EMPTY_SERVERS = snapshot({ asOf: TIMESTAMP, items: [] });
const EMPTY_BILLING = snapshot({ asOf: TIMESTAMP, buckets: [] });
const EMPTY_PROVISIONING = snapshot({ asOf: TIMESTAMP, stuck: 0, items: [] });

describe("useReports", () => {
  beforeEach(() => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: ["admin.reports.read"],
    };
    authMock.isLoading = false;
    overviewMock.mockReset().mockResolvedValue(OVERVIEW);
    tenantsMock.mockReset().mockResolvedValue(EMPTY_TENANTS);
    serversMock.mockReset().mockResolvedValue(EMPTY_SERVERS);
    billingMock.mockReset().mockResolvedValue(EMPTY_BILLING);
    provisioningMock.mockReset().mockResolvedValue(EMPTY_PROVISIONING);
  });

  it("loads the overview only for an authorized admin", async () => {
    const { result } = renderHook(() => useReports());

    await waitFor(() => expect(result.current.requestState).toBe("READY"));
    expect(overviewMock).toHaveBeenCalledWith({}, expect.any(AbortSignal));
    expect(result.current.data?.kind).toBe("OVERVIEW");
  });

  it("fails closed at the RBAC gate without making a report request", async () => {
    authMock.user = { isSuperAdmin: false, permissions: [] };
    const { result } = renderHook(() => useReports());

    await waitFor(() => expect(result.current.requestState).toBe("FORBIDDEN"));
    expect(overviewMock).not.toHaveBeenCalled();
    expect(tenantsMock).not.toHaveBeenCalled();
  });

  it("switches to the exact report reader and does not reload a selected tab", async () => {
    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(result.current.requestState).toBe("READY"));

    act(() => result.current.setActiveReport("TENANTS"));
    await waitFor(() => expect(result.current.requestState).toBe("EMPTY"));
    expect(tenantsMock).toHaveBeenCalledWith(
      { page: 1, limit: 20 },
      expect.any(AbortSignal),
    );

    act(() => result.current.setActiveReport("TENANTS"));
    expect(result.current.requestState).toBe("EMPTY");
    expect(tenantsMock).toHaveBeenCalledTimes(1);
  });

  it("ignores a stale response after the operator changes report tabs", async () => {
    let resolveOverview: ((value: typeof OVERVIEW) => void) | undefined;
    overviewMock.mockReturnValueOnce(
      new Promise<typeof OVERVIEW>((resolve) => {
        resolveOverview = resolve;
      }),
    );
    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(overviewMock).toHaveBeenCalledOnce());

    act(() => result.current.setActiveReport("SERVERS"));
    await waitFor(() => expect(result.current.requestState).toBe("EMPTY"));
    expect(result.current.activeReport).toBe("SERVERS");

    await act(async () => resolveOverview?.(OVERVIEW));
    expect(result.current.activeReport).toBe("SERVERS");
    expect(result.current.data?.kind).toBe("SERVERS");
  });

  it("maps server authorization and availability failures to explicit states", async () => {
    overviewMock.mockRejectedValueOnce({
      isNormalized: true,
      httpStatus: 403,
      errorCode: "ADMIN_PERMISSION_DENIED",
      message: "Permission denied",
      correlationId: "corr-forbidden",
    });
    const forbidden = renderHook(() => useReports());
    await waitFor(() =>
      expect(forbidden.result.current.requestState).toBe("FORBIDDEN"),
    );
    forbidden.unmount();

    overviewMock.mockRejectedValueOnce({
      isNormalized: true,
      httpStatus: 503,
      errorCode: "CORE_UPSTREAM_UNAVAILABLE",
      message: "Core unavailable",
      correlationId: "corr-unavailable",
    });
    const unavailable = renderHook(() => useReports());
    await waitFor(() =>
      expect(unavailable.result.current.requestState).toBe("UNAVAILABLE"),
    );
    expect(unavailable.result.current.error?.correlationId).toBe(
      "corr-unavailable",
    );
  });

  it("distinguishes a malformed success projection from transport failure", async () => {
    overviewMock.mockRejectedValueOnce(
      new Error("INVALID_ADMIN_REPORT_RESPONSE"),
    );
    const { result } = renderHook(() => useReports());

    await waitFor(() => expect(result.current.requestState).toBe("ERROR"));
    expect(result.current.error?.message).toBe("INVALID_ADMIN_REPORT_RESPONSE");
  });

  /**
   * FE-B03. The table's onPageChange only ever asked "forward or back" and
   * called next/previous, so First, Last and any numbered page moved a single
   * step: clicking page 9 from page 1 landed on page 2, and Last was
   * indistinguishable from Next. A report of any size was unreachable past its
   * second page.
   */
  it("jumps to the requested tenant report page, clamped to the page count", async () => {
    tenantsMock.mockResolvedValue(
      snapshot({
        items: [],
        total: 180,
        page: 1,
        limit: 20,
        totalPages: 9,
        hasNext: true,
        hasPrev: false,
      }),
    );

    const { result } = renderHook(() => useReports());
    act(() => result.current.setActiveReport("TENANTS"));
    await waitFor(() => expect(tenantsMock).toHaveBeenCalled());

    act(() => result.current.goToTenantPage(9));
    await waitFor(() =>
      expect(tenantsMock).toHaveBeenCalledWith(
        expect.objectContaining({ page: 9 }),
        expect.anything(),
      ),
    );

    // Out of range in either direction resolves to the nearest real page, so a
    // stale render cannot ask for one the snapshot does not have.
    act(() => result.current.goToTenantPage(99));
    await waitFor(() =>
      expect(tenantsMock).toHaveBeenCalledWith(
        expect.objectContaining({ page: 9 }),
        expect.anything(),
      ),
    );

    act(() => result.current.goToTenantPage(0));
    await waitFor(() =>
      expect(tenantsMock).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
        expect.anything(),
      ),
    );
  });
});
