// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  FleetStatus,
  MigrationRun,
  TenantSchemaVersion,
} from "../types/database-migrations";

const { languageMock, overviewMock } = vi.hoisted(() => ({
  languageMock: { lang: "en" as "en" | "ar", dir: "ltr" as "ltr" | "rtl" },
  overviewMock: {
    permissions: {
      canRead: true,
      hasExecute: true,
      hasCritical: true,
      canExecute: true,
      canDestroy: true,
    },
    state: "READY" as string,
    runs: [] as MigrationRun[],
    fleet: null as FleetStatus[] | null,
    tenants: null as {
      items: TenantSchemaVersion[];
      meta: { page: number; limit: number; total: number };
    } | null,
    projectionError: null as
      | { errorCode: string; message: string; httpStatus: number }
      | null,
    error: null,
    mutation: { name: null, phase: "IDLE", error: null },
    isRefreshing: false,
    applicationKey: "",
    setApplicationKey: vi.fn(),
    schemaState: "" as string,
    setSchemaState: vi.fn(),
    page: 1,
    setPage: vi.fn(),
    pageSize: 25,
    refresh: vi.fn(),
    startRun: vi.fn(() => Promise.resolve(null)),
    resetMutation: vi.fn(),
  },
}));

vi.mock("@/components/layout/Navbar", () => ({
  Navbar: () => <nav aria-label="Admin navigation">Admin navigation</nav>,
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => languageMock }));
vi.mock("../hooks/use-migrations-overview", () => ({
  useMigrationsOverview: () => overviewMock,
}));

import { MigrationsOverviewScreen } from "./migrations-overview-screen";

function makeFleet(overrides: Partial<FleetStatus> = {}): FleetStatus {
  return {
    applicationKey: "crm",
    availableVersion: "1801-latest",
    counts: {
      upToDate: 40,
      pending: 3,
      running: 1,
      failed: 1,
      blocked: 1,
      restoreIncomplete: 2,
      drifted: 4,
    },
    versionDistribution: [
      { schemaVersion: "1801-latest", tenantCount: 40 },
      { schemaVersion: "1799-old", tenantCount: 12 },
    ],
    activeRun: null,
    ...overrides,
  };
}

function makeTenant(
  overrides: Partial<TenantSchemaVersion> &
    Pick<TenantSchemaVersion, "tenantId" | "state">,
): TenantSchemaVersion {
  return {
    tenantName: null,
    applicationKey: "crm",
    schemaVersion: "1799-old",
    schemaChecksum: null,
    lastRunId: null,
    observedAt: "2026-08-28T09:00:00.000Z",
    driftDetail: null,
    ...overrides,
  };
}

describe("MigrationsOverviewScreen fleet state", () => {
  beforeEach(() => {
    languageMock.lang = "en";
    languageMock.dir = "ltr";
    overviewMock.permissions = {
      canRead: true,
      hasExecute: true,
      hasCritical: true,
      canExecute: true,
      canDestroy: true,
    };
    overviewMock.state = "READY";
    overviewMock.fleet = [makeFleet()];
    overviewMock.runs = [];
    overviewMock.tenants = { items: [], meta: { page: 1, limit: 25, total: 0 } };
    overviewMock.projectionError = null;
    overviewMock.mutation = { name: null, phase: "IDLE", error: null };
  });

  it("raises DRIFTED and RESTORE_INCOMPLETE as a dedicated alert, not a table row", () => {
    render(<MigrationsOverviewScreen />);

    const alerts = screen.getAllByRole("alert");
    const alarm = alerts.find((node) =>
      node.textContent?.includes("Databases in an unexplained state"),
    );
    expect(alarm).toBeDefined();
    expect(within(alarm as HTMLElement).getByText("DRIFTED")).toBeInTheDocument();
    expect(
      within(alarm as HTMLElement).getByText("RESTORE_INCOMPLETE"),
    ).toBeInTheDocument();
    expect(alarm?.textContent).toContain("4");
    expect(alarm?.textContent).toContain("2");
  });

  it("stays quiet when no database is in an unexplained state", () => {
    overviewMock.fleet = [
      makeFleet({
        counts: {
          upToDate: 40,
          pending: 0,
          running: 0,
          failed: 2,
          blocked: 1,
          restoreIncomplete: 0,
          drifted: 0,
        },
      }),
    ];
    render(<MigrationsOverviewScreen />);

    expect(
      screen.queryByText("Databases in an unexplained state"),
    ).toBeNull();
  });

  it("flags a fragmented fleet and shows the version distribution", () => {
    render(<MigrationsOverviewScreen />);

    expect(screen.getByText(/Fragmented fleet/)).toBeInTheDocument();
    const distribution = screen.getByRole("table", {
      name: "Version distribution",
    });
    expect(within(distribution).getByText("1799-old")).toBeInTheDocument();
    expect(within(distribution).getByText("1801-latest")).toBeInTheDocument();
    // The dominant version leads, so fragmentation reads at a glance.
    const rows = within(distribution).getAllByRole("row").slice(1);
    expect(rows[0].textContent).toContain("1801-latest");
  });

  it("keeps the run surface usable when the projection cannot be read", () => {
    overviewMock.fleet = null;
    overviewMock.tenants = null;
    overviewMock.projectionError = {
      errorCode: "PROJECTION_UNAVAILABLE",
      message: "projection unreadable",
      httpStatus: 503,
    };
    overviewMock.runs = [
      {
        id: "019f0000-0000-7000-8000-000000000001",
        applicationKey: "crm",
        targetVersion: "1801-latest",
        strategy: "batched",
        batchSize: 50,
        failFast: false,
        status: "COMPLETED",
        progress: {
          totalTenants: 4,
          queuedTenants: 0,
          inFlightTenants: 0,
          succeededTenants: 4,
          failedTenants: 0,
          skippedTenants: 0,
          appliedMigrations: 4,
          currentBatch: 1,
          dryRun: true,
        },
        summary: null,
        triggeredBy: "rehearsal",
        startedAt: "2026-08-28T10:00:00.000Z",
        pausedAt: null,
        finishedAt: "2026-08-28T10:20:00.000Z",
        error: null,
        tenantScope: null,
      },
    ];
    render(<MigrationsOverviewScreen />);

    expect(screen.getByText("Fleet projection unavailable")).toBeInTheDocument();
    expect(screen.getByText("PROJECTION_UNAVAILABLE")).toBeInTheDocument();
    // The run table survives the projection outage.
    const table = screen.getByRole("table", { name: "Migration runs" });
    expect(within(table).getByText("DRY_RUN")).toBeInTheDocument();
  });

  it("shows a tenant's drift difference rather than only its state", () => {
    overviewMock.tenants = {
      items: [
        makeTenant({
          tenantId: "tenant-a",
          state: "DRIFTED",
          driftDetail: '{"missingIndex":["idx_contacts_email"]}',
        }),
      ],
      meta: { page: 1, limit: 25, total: 1 },
    };
    render(<MigrationsOverviewScreen />);

    const table = screen.getByRole("table", { name: "Tenants" });
    expect(within(table).getByText("DRIFTED")).toBeInTheDocument();
    expect(
      within(table).getByText('{"missingIndex":["idx_contacts_email"]}'),
    ).toBeInTheDocument();
  });
});

describe("MigrationsOverviewScreen permission gating", () => {
  beforeEach(() => {
    languageMock.lang = "en";
    languageMock.dir = "ltr";
    overviewMock.state = "READY";
    overviewMock.fleet = [makeFleet()];
    overviewMock.runs = [];
    overviewMock.tenants = {
      items: [makeTenant({ tenantId: "tenant-a", state: "PENDING" })],
      meta: { page: 1, limit: 25, total: 1 },
    };
    overviewMock.projectionError = null;
  });

  it("fails closed without the read permission", () => {
    overviewMock.permissions = {
      canRead: false,
      hasExecute: false,
      hasCritical: false,
      canExecute: false,
      canDestroy: false,
    };
    overviewMock.state = "FORBIDDEN";
    render(<MigrationsOverviewScreen />);

    expect(
      screen.getByText("Required permission: admin.migrations.read"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Run a migration/ })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("hides both run entry points from a read-only operator", () => {
    overviewMock.permissions = {
      canRead: true,
      hasExecute: true,
      hasCritical: false,
      canExecute: false,
      canDestroy: false,
    };
    render(<MigrationsOverviewScreen />);

    expect(screen.queryByRole("button", { name: /Run a migration/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Migrate this tenant/ }),
    ).toBeNull();
    expect(screen.getByText("admin.migrations.critical")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Tenants" })).toBeInTheDocument();
  });

  it("offers both fleet and single-tenant entry points with full permissions", () => {
    overviewMock.permissions = {
      canRead: true,
      hasExecute: true,
      hasCritical: true,
      canExecute: true,
      canDestroy: true,
    };
    render(<MigrationsOverviewScreen />);

    expect(
      screen.getByRole("button", { name: /Run a migration/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Migrate this tenant/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("This surface is read-only for you")).toBeNull();
  });
});

describe("MigrationsOverviewScreen dry-run dialog", () => {
  beforeEach(() => {
    languageMock.lang = "en";
    languageMock.dir = "ltr";
    overviewMock.permissions = {
      canRead: true,
      hasExecute: true,
      hasCritical: true,
      canExecute: true,
      canDestroy: true,
    };
    overviewMock.state = "READY";
    overviewMock.fleet = [makeFleet()];
    overviewMock.runs = [];
    overviewMock.tenants = { items: [], meta: { page: 1, limit: 25, total: 0 } };
    overviewMock.startRun.mockClear();
  });

  it("presents dry run as a first-class mode chosen before scope, and defaults to it", () => {
    render(<MigrationsOverviewScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Run a migration/ }));

    const dryRun = screen.getByRole("radio", { name: /Dry run/ });
    const apply = screen.getByRole("radio", { name: /Apply for real/ });
    expect(dryRun).toBeChecked();
    expect(apply).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Start dry run" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("How should this run execute?"),
    ).toBeInTheDocument();
  });

  it("starts a dry run without a typed confirmation", () => {
    render(<MigrationsOverviewScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Run a migration/ }));
    const dialog = screen.getByRole("dialog", { name: "Run a migration" });

    fireEvent.change(within(dialog).getByLabelText("Application"), {
      target: { value: "crm" },
    });
    fireEvent.change(within(dialog).getByLabelText("Target version"), {
      target: { value: "1801-latest" },
    });
    fireEvent.change(within(dialog).getByLabelText("Audit reason"), {
      target: { value: "rehearsing release 42" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Run a migration" }));

    expect(overviewMock.startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationKey: "crm",
        targetVersion: "1801-latest",
        dryRun: true,
        triggeredBy: "rehearsing release 42",
      }),
    );
  });

  it("demands a typed confirmation naming the application before a real fleet run", () => {
    render(<MigrationsOverviewScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Run a migration/ }));

    const dialog = screen.getByRole("dialog", { name: "Run a migration" });
    fireEvent.click(
      within(dialog).getByRole("radio", { name: /Apply for real/ }),
    );
    fireEvent.change(within(dialog).getByLabelText("Application"), {
      target: { value: "crm" },
    });
    fireEvent.change(within(dialog).getByLabelText("Target version"), {
      target: { value: "1801-latest" },
    });
    fireEvent.change(within(dialog).getByLabelText("Audit reason"), {
      target: { value: "release 42 rollout" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Run a migration" }));

    // The run is held until the operator types what is affected.
    expect(overviewMock.startRun).not.toHaveBeenCalled();
    const confirmation = screen.getByRole("dialog", {
      name: "Apply to every eligible tenant",
    });
    expect(confirmation.textContent).toContain("crm");
    // The confirmation names the blast radius, not just the action.
    expect(confirmation.textContent).toContain("12 tenants are currently behind");
  });

  it("refuses to submit without an audit reason", () => {
    render(<MigrationsOverviewScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Run a migration/ }));

    const dialog = screen.getByRole("dialog", { name: "Run a migration" });
    fireEvent.change(within(dialog).getByLabelText("Application"), {
      target: { value: "crm" },
    });
    fireEvent.change(within(dialog).getByLabelText("Target version"), {
      target: { value: "1801-latest" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Run a migration" }));

    expect(overviewMock.startRun).not.toHaveBeenCalled();
    const alerts = screen.getAllByRole("alert");
    expect(
      alerts.some((node) =>
        node.textContent?.includes("Enter an audit reason"),
      ),
    ).toBe(true);
  });

  it("opens scoped to one tenant from the tenant row action", () => {
    overviewMock.tenants = {
      items: [makeTenant({ tenantId: "tenant-a", state: "PENDING" })],
      meta: { page: 1, limit: 25, total: 1 },
    };
    render(<MigrationsOverviewScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Migrate this tenant/ }));

    expect(screen.getByRole("radio", { name: /Single tenant/ })).toBeChecked();
    expect(screen.getByLabelText("Tenant ID")).toHaveValue("tenant-a");
  });
});
