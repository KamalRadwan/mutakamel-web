// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reportMock, languageMock } = vi.hoisted(() => ({
  languageMock: { lang: "en" as "en" | "ar" },
  reportMock: {
    activeReport: "OVERVIEW" as
      "OVERVIEW" | "TENANTS" | "SERVERS" | "BILLING" | "PROVISIONING",
    draft: { from: "", to: "", status: "", serverId: "", limit: "20" },
    validationErrors: {} as Record<string, string>,
    requestState: "READY" as
      "LOADING" | "READY" | "EMPTY" | "FORBIDDEN" | "UNAVAILABLE" | "ERROR",
    data: null as unknown,
    error: null as null | {
      isNormalized: true;
      httpStatus: number;
      errorCode: string;
      message: string;
      correlationId?: string;
    },
    isRefreshing: false,
    canRead: true,
    tenantPage: 1,
    setActiveReport: vi.fn(),
    updateFilter: vi.fn(),
    submitFilters: vi.fn(),
    clearFilters: vi.fn(),
    refresh: vi.fn(),
    previousTenantPage: vi.fn(),
    nextTenantPage: vi.fn(),
  },
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => languageMock,
}));
vi.mock("../hooks/use-reports", () => ({
  useReports: () => reportMock,
}));

import { ReportsScreen } from "./reports-screen";

const TIMESTAMP = "2026-08-12T08:00:00.000Z";

function overviewData() {
  return {
    kind: "OVERVIEW",
    snapshot: {
      data: {
        asOf: TIMESTAMP,
        tenantsByStatus: { ACTIVE: 2 },
        subscriptions: { count: 2, totalAllowedUsers: 40 },
        outstandingInvoices: { count: 1, total: "120.0000" },
      },
      correlationId: "corr-overview",
      responseTimestamp: TIMESTAMP,
    },
  };
}

describe("ReportsScreen", () => {
  beforeEach(() => {
    languageMock.lang = "en";
    reportMock.activeReport = "OVERVIEW";
    reportMock.draft = {
      from: "",
      to: "",
      status: "",
      serverId: "",
      limit: "20",
    };
    reportMock.validationErrors = {};
    reportMock.requestState = "READY";
    reportMock.data = overviewData();
    reportMock.error = null;
    reportMock.isRefreshing = false;
    reportMock.canRead = true;
    reportMock.setActiveReport.mockClear();
    reportMock.submitFilters.mockClear();
    reportMock.clearFilters.mockClear();
    reportMock.refresh.mockClear();
  });

  it("renders all report tabs, overview filters, evidence, and correlation", () => {
    render(<ReportsScreen />);

    expect(
      screen.getByRole("heading", { name: "Administrative reports" }),
    ).toBeTruthy();
    for (const tab of [
      "Overview",
      "Tenants",
      "Server capacity",
      "Billing",
      "Provisioning",
    ]) {
      expect(screen.getByRole("tab", { name: tab })).toBeTruthy();
    }
    expect(screen.getByLabelText("From date (UTC)")).toBeTruthy();
    expect(screen.getByLabelText("Through date (UTC)")).toBeTruthy();
    expect(screen.getByText("120.0000")).toBeTruthy();
    expect(screen.getByText("corr-overview")).toBeTruthy();

    // Radix Tabs.Trigger activates on mousedown, not click (see
    // @radix-ui/react-tabs's TabsTrigger) — fireEvent.click alone never
    // fires it.
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Tenants" }));
    expect(reportMock.setActiveReport).toHaveBeenCalledWith("TENANTS");
    fireEvent.submit(screen.getByRole("form", { name: "Report filters" }));
    expect(reportMock.submitFilters).toHaveBeenCalledOnce();
  });

  it("renders every tenant-specific input and accessible validation feedback", () => {
    reportMock.activeReport = "TENANTS";
    reportMock.draft = {
      from: "",
      to: "",
      status: "ACTIVE",
      serverId: "not-a-v7-id",
      limit: "20",
    };
    reportMock.validationErrors = {
      serverId: "INVALID_SERVER_UUID_V7",
    };
    reportMock.requestState = "EMPTY";
    reportMock.data = {
      kind: "TENANTS",
      snapshot: {
        data: {
          items: [],
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
        correlationId: "corr-tenants",
        responseTimestamp: TIMESTAMP,
      },
    };

    render(<ReportsScreen />);

    expect(screen.getByLabelText("Tenant status")).toHaveTextContent("ACTIVE");
    expect(screen.getByLabelText(/^Database server UUID v7/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Rows per report")).toBeTruthy();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a UUID v7 database server identifier.",
    );
  });

  it("hides report controls at the client permission gate", () => {
    reportMock.canRead = false;
    reportMock.requestState = "FORBIDDEN";
    reportMock.data = null;

    render(<ReportsScreen />);

    expect(
      screen.getByText("Required permission: admin.reports.read"),
    ).toBeTruthy();
    expect(screen.queryByRole("form", { name: "Report filters" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Overview" })).toBeNull();
  });

  it("shows a retryable unavailable state with the server correlation ID", () => {
    reportMock.requestState = "UNAVAILABLE";
    reportMock.data = null;
    reportMock.error = {
      isNormalized: true,
      httpStatus: 503,
      errorCode: "CORE_UPSTREAM_UNAVAILABLE",
      message: "Core report upstream is unavailable",
      correlationId: "corr-unavailable",
    };

    render(<ReportsScreen />);

    expect(screen.getByText("corr-unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(reportMock.refresh).toHaveBeenCalledOnce();
  });

  it("uses local Arabic feature copy", () => {
    languageMock.lang = "ar";
    render(<ReportsScreen />);

    expect(screen.getByRole("heading", { level: 1 })).not.toHaveTextContent(
      "Administrative reports",
    );
  });
});
