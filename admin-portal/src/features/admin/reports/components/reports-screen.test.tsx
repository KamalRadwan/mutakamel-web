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

/** Two of three stalled tenants: `limit` cut the third. */
function provisioningData() {
  return {
    kind: "PROVISIONING",
    snapshot: {
      data: {
        asOf: TIMESTAMP,
        stuck: 3,
        items: [
          {
            id: "019f0000-0000-7000-8000-0000000000a3",
            name: "initech",
            status: "SUSPENDED",
            createdAt: "2026-08-01T10:00:00.000Z",
            operation: {
              id: "019f0000-0000-7000-8000-0000000000b3",
              type: "REPAIR",
              status: "CANCEL_REQUESTED",
              currentPhase: "core.seed",
              generation: 7,
            },
            stall: {
              stepKey: null,
              since: "2026-08-12T07:35:00.000Z",
              ageSeconds: 25 * 60,
              reason: "CANCEL_PENDING",
            },
          },
          {
            id: "019f0000-0000-7000-8000-0000000000a1",
            name: "globex",
            status: "ACTIVE",
            createdAt: "2026-08-02T10:00:00.000Z",
            operation: {
              id: "019f0000-0000-7000-8000-0000000000b1",
              type: "UPDATE",
              status: "RUNNING",
              currentPhase: "crm.schema",
              generation: 4,
            },
            stall: {
              stepKey: "crm.schema",
              since: "2026-08-12T07:52:00.000Z",
              ageSeconds: 8 * 60,
              reason: "NO_PROGRESS",
            },
          },
        ],
      },
      correlationId: "corr-provisioning",
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

  it("lists stalled tenants with their operation, stall point, reason and silence, without a date window", () => {
    reportMock.activeReport = "PROVISIONING";
    reportMock.draft = { from: "", to: "", status: "", serverId: "", limit: "50" };
    reportMock.data = provisioningData();

    render(<ReportsScreen />);

    // Current state: no window to choose, only how many rows to list.
    expect(screen.queryByLabelText("From date (UTC)")).toBeNull();
    expect(screen.queryByLabelText("Through date (UTC)")).toBeNull();
    expect(screen.getByLabelText("Rows per report")).toBeTruthy();

    expect(screen.getByText("Stuck tenants")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(
      screen.getByText(
        "Showing the 2 longest stalls of 3. Choose more rows per report to list more.",
      ),
    ).toBeTruthy();

    const update = screen.getByRole("row", { name: /globex/ });
    expect(update).toHaveTextContent("Update");
    expect(update).toHaveTextContent("Generation 4");
    expect(update).toHaveTextContent("crm.schema");
    expect(update).toHaveTextContent("No progress");
    expect(update).toHaveTextContent("for 8 min");
    expect(screen.getByRole("link", { name: "globex" })).toHaveAttribute(
      "href",
      "/tenants/019f0000-0000-7000-8000-0000000000a1",
    );

    // No step running: the current phase is where it stopped.
    const repair = screen.getByRole("row", { name: /initech/ });
    expect(repair).toHaveTextContent("Repair");
    expect(repair).toHaveTextContent("Phase");
    expect(repair).toHaveTextContent("core.seed");
    expect(repair).toHaveTextContent("Cancellation not confirmed");
    expect(repair).toHaveTextContent("for 25 min");
  });

  it("shows the stalled tenants in Arabic", () => {
    languageMock.lang = "ar";
    reportMock.activeReport = "PROVISIONING";
    reportMock.draft = { from: "", to: "", status: "", serverId: "", limit: "50" };
    reportMock.data = provisioningData();

    render(<ReportsScreen />);

    expect(screen.getByText("المستأجرون العالقون")).toBeTruthy();
    const repair = screen.getByRole("row", { name: /initech/ });
    expect(repair).toHaveTextContent("إصلاح");
    expect(repair).toHaveTextContent("الإلغاء لم يُؤكَّد");
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
