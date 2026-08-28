// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  MigrationRun,
  MigrationTenantResult,
} from "../types/database-migrations";

const { languageMock, detailMock } = vi.hoisted(() => ({
  languageMock: { lang: "en" as "en" | "ar", dir: "ltr" as "ltr" | "rtl" },
  detailMock: {
    permissions: {
      canRead: true,
      hasExecute: true,
      hasCritical: true,
      canExecute: true,
      canDestroy: true,
    },
    state: "READY" as string,
    run: null as MigrationRun | null,
    outcomes: null as {
      items: MigrationTenantResult[];
      meta: { page: number; limit: number; total: number };
    } | null,
    outcomesError: null as { errorCode: string } | null,
    availability: {
      canPause: true,
      canResume: false,
      canAbort: true,
      canRetryFailed: true,
    },
    error: null,
    mutation: { name: null, phase: "IDLE", error: null },
    isRefreshing: false,
    outcomeFilter: "" as string,
    setOutcomeFilter: vi.fn(),
    page: 1,
    setPage: vi.fn(),
    pageSize: 50,
    refresh: vi.fn(),
    control: vi.fn(() => Promise.resolve(null)),
    resetMutation: vi.fn(),
  },
}));

vi.mock("@/components/layout/Navbar", () => ({
  Navbar: () => <nav aria-label="Admin navigation">Admin navigation</nav>,
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => languageMock }));
vi.mock("../hooks/use-migration-run-detail", () => ({
  useMigrationRunDetail: () => detailMock,
}));

import { MigrationRunDetailScreen } from "./migration-run-detail-screen";

const RUN_ID = "019f0000-0000-7000-8000-000000000001";

function makeRun(overrides: Partial<MigrationRun> = {}): MigrationRun {
  return {
    id: RUN_ID,
    applicationKey: "crm",
    targetVersion: "1801-add-index",
    strategy: "batched",
    batchSize: 50,
    failFast: false,
    status: "PAUSED",
    progress: {
      totalTenants: 5,
      queuedTenants: 1,
      inFlightTenants: 1,
      succeededTenants: 1,
      failedTenants: 1,
      skippedTenants: 2,
      appliedMigrations: 1,
      currentBatch: 2,
      dryRun: false,
    },
    summary: null,
    triggeredBy: "release 42",
    startedAt: "2026-08-28T10:00:00.000Z",
    pausedAt: "2026-08-28T10:05:00.000Z",
    finishedAt: null,
    error: null,
    tenantScope: null,
    ...overrides,
  };
}

function makeResult(
  overrides: Partial<MigrationTenantResult> & Pick<MigrationTenantResult, "tenantId" | "outcome">,
): MigrationTenantResult {
  return {
    tenantName: null,
    databaseServerId: null,
    migrationName: "1801-add-index",
    migrationChecksum: null,
    skipReason: null,
    appliedCount: 0,
    pendingCount: 0,
    durationMs: null,
    errorCode: null,
    errorDetail: null,
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

const OUTCOME_ROWS: MigrationTenantResult[] = [
  makeResult({ tenantId: "tenant-applied", outcome: "APPLIED", appliedCount: 3 }),
  makeResult({
    tenantId: "tenant-excluded",
    outcome: "SKIPPED",
    skipReason: "Relocation in progress",
  }),
  makeResult({ tenantId: "tenant-current", outcome: "SKIPPED_UP_TO_DATE" }),
  makeResult({
    tenantId: "tenant-broken",
    outcome: "FAILED",
    errorCode: "MIGRATION_LOCK_TIMEOUT",
  }),
];

describe("MigrationRunDetailScreen", () => {
  beforeEach(() => {
    languageMock.lang = "en";
    languageMock.dir = "ltr";
    detailMock.permissions = {
      canRead: true,
      hasExecute: true,
      hasCritical: true,
      canExecute: true,
      canDestroy: true,
    };
    detailMock.state = "READY";
    detailMock.run = makeRun();
    detailMock.outcomes = {
      items: OUTCOME_ROWS,
      meta: { page: 1, limit: 50, total: OUTCOME_ROWS.length },
    };
    detailMock.outcomesError = null;
    detailMock.availability = {
      canPause: true,
      canResume: false,
      canAbort: true,
      canRetryFailed: true,
    };
    detailMock.mutation = { name: null, phase: "IDLE", error: null };
    detailMock.control.mockClear();
  });

  it("renders the two skip outcomes as visibly different results", () => {
    render(<MigrationRunDetailScreen runId={RUN_ID} />);
    const table = screen.getByRole("table", { name: "Per-tenant outcomes" });

    // Distinct human labels, not one shared "skipped" word.
    expect(within(table).getByText("Skipped — ineligible")).toBeInTheDocument();
    expect(within(table).getByText("Already at target")).toBeInTheDocument();

    // Distinct wire values are echoed so the state never rests on colour.
    expect(within(table).getByText("SKIPPED")).toBeInTheDocument();
    expect(within(table).getByText("SKIPPED_UP_TO_DATE")).toBeInTheDocument();

    // And distinct explanations of what each one means.
    expect(
      within(table).getByText(
        "The run was not allowed to touch this database. It is still behind.",
      ),
    ).toBeInTheDocument();
    expect(
      within(table).getByText(
        "Reached and found already carrying the target version. Nothing to apply.",
      ),
    ).toBeInTheDocument();
  });

  it("counts the two skip outcomes separately and on opposite sides of the summary", () => {
    detailMock.outcomes = {
      items: [
        ...OUTCOME_ROWS,
        makeResult({ tenantId: "t5", outcome: "SKIPPED_UP_TO_DATE" }),
        makeResult({ tenantId: "t6", outcome: "SKIPPED_UP_TO_DATE" }),
      ],
      meta: { page: 1, limit: 50, total: 6 },
    };
    render(<MigrationRunDetailScreen runId={RUN_ID} />);

    const attention = screen
      .getByText("Needs attention")
      .closest("article") as HTMLElement;
    const atTarget = screen
      .getByText("At the target version")
      .closest("article") as HTMLElement;

    // An exclusion is outstanding work; being already at the target is not.
    expect(within(attention).getByText("SKIPPED")).toBeInTheDocument();
    expect(within(attention).queryByText("SKIPPED_UP_TO_DATE")).toBeNull();
    expect(within(atTarget).getByText("SKIPPED_UP_TO_DATE")).toBeInTheDocument();
    expect(within(atTarget).queryByText("SKIPPED")).toBeNull();

    // 1 failed + 1 excluded, versus 1 applied + 3 already at target.
    expect(within(attention).getByText("2")).toBeInTheDocument();
    expect(within(atTarget).getByText("4")).toBeInTheDocument();
  });

  it("shows the recorded reason for an excluded tenant", () => {
    render(<MigrationRunDetailScreen runId={RUN_ID} />);
    expect(screen.getByText("Relocation in progress")).toBeInTheDocument();
  });

  it("raises an alert when a skipped tenant carries no reason", () => {
    detailMock.outcomes = {
      items: [makeResult({ tenantId: "tenant-silent", outcome: "SKIPPED" })],
      meta: { page: 1, limit: 50, total: 1 },
    };
    render(<MigrationRunDetailScreen runId={RUN_ID} />);

    const alerts = screen.getAllByRole("alert");
    expect(
      alerts.some((node) =>
        node.textContent?.includes("No reason was recorded"),
      ),
    ).toBe(true);
  });

  it("does not raise a missing-reason alert for an already-at-target tenant", () => {
    detailMock.outcomes = {
      items: [makeResult({ tenantId: "tenant-current", outcome: "SKIPPED_UP_TO_DATE" })],
      meta: { page: 1, limit: 50, total: 1 },
    };
    render(<MigrationRunDetailScreen runId={RUN_ID} />);

    expect(screen.queryByText(/No reason was recorded/)).toBeNull();
  });

  it("marks a dry run distinctly from a real run", () => {
    render(<MigrationRunDetailScreen runId={RUN_ID} />);
    expect(screen.getAllByText("APPLY").length).toBeGreaterThan(0);

    detailMock.run = makeRun({
      progress: { ...makeRun().progress, dryRun: true },
    });
    const { container } = render(<MigrationRunDetailScreen runId={RUN_ID} />);
    expect(within(container).getAllByText("DRY_RUN").length).toBeGreaterThan(0);
  });

  it("gives every table a caption and column headers", () => {
    render(<MigrationRunDetailScreen runId={RUN_ID} />);
    const table = screen.getByRole("table", { name: "Per-tenant outcomes" });
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual([
      "Tenant",
      "Status",
      "Migration",
      "Applied",
      "Duration",
      "Finished",
    ]);
  });
});

describe("MigrationRunDetailScreen permission gating", () => {
  beforeEach(() => {
    languageMock.lang = "en";
    languageMock.dir = "ltr";
    detailMock.state = "READY";
    detailMock.run = makeRun();
    detailMock.outcomes = {
      items: OUTCOME_ROWS,
      meta: { page: 1, limit: 50, total: OUTCOME_ROWS.length },
    };
    detailMock.availability = {
      canPause: true,
      canResume: true,
      canAbort: true,
      canRetryFailed: true,
    };
  });

  it("fails closed before rendering the run when read permission is absent", () => {
    detailMock.permissions = {
      canRead: false,
      hasExecute: false,
      hasCritical: false,
      canExecute: false,
      canDestroy: false,
    };
    detailMock.state = "FORBIDDEN";
    render(<MigrationRunDetailScreen runId={RUN_ID} />);

    expect(
      screen.getByText("Required permission: admin.migrations.read"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Abort/ })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("hides every control from a read-only operator and names the missing permissions", () => {
    detailMock.permissions = {
      canRead: true,
      hasExecute: false,
      hasCritical: false,
      canExecute: false,
      canDestroy: false,
    };
    render(<MigrationRunDetailScreen runId={RUN_ID} />);

    expect(screen.queryByRole("button", { name: /Pause/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Resume/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Abort/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Retry failed tenants/ }),
    ).toBeNull();
    expect(
      screen.getByText("admin.migrations.manage, admin.migrations.critical"),
    ).toBeInTheDocument();
    // The read surface itself stays available.
    expect(
      screen.getByRole("table", { name: "Per-tenant outcomes" }),
    ).toBeInTheDocument();
  });

  it("withholds abort from an operator without the critical permission", () => {
    detailMock.permissions = {
      canRead: true,
      hasExecute: true,
      hasCritical: false,
      canExecute: false,
      canDestroy: false,
    };
    render(<MigrationRunDetailScreen runId={RUN_ID} />);

    expect(screen.queryByRole("button", { name: /Abort/ })).toBeNull();
    expect(
      screen.getByText("admin.migrations.critical"),
    ).toBeInTheDocument();
  });

  it("offers the full control set once both mutating permissions are held", () => {
    detailMock.permissions = {
      canRead: true,
      hasExecute: true,
      hasCritical: true,
      canExecute: true,
      canDestroy: true,
    };
    render(<MigrationRunDetailScreen runId={RUN_ID} />);

    expect(screen.getByRole("button", { name: /Pause/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resume/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Retry failed tenants/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abort/ })).toBeInTheDocument();
    // Every control is inert until an audit reason is supplied.
    expect(screen.getByRole("button", { name: /Abort/ })).toBeDisabled();
  });
});

describe("MigrationRunDetailScreen Arabic rendering", () => {
  it("renders right-to-left with Arabic copy and keeps the wire values readable", () => {
    languageMock.lang = "ar";
    languageMock.dir = "rtl";
    detailMock.permissions = {
      canRead: true,
      hasExecute: false,
      hasCritical: false,
      canExecute: false,
      canDestroy: false,
    };
    detailMock.state = "READY";
    detailMock.run = makeRun();
    detailMock.outcomes = {
      items: OUTCOME_ROWS,
      meta: { page: 1, limit: 50, total: OUTCOME_ROWS.length },
    };

    const { container } = render(<MigrationRunDetailScreen runId={RUN_ID} />);
    const table = screen.getByRole("table", { name: "نتائج كل مستأجر" });

    expect(container.firstElementChild).toHaveAttribute("dir", "rtl");
    expect(within(table).getByText("متخطَّى — غير مؤهل")).toBeInTheDocument();
    expect(within(table).getByText("عند النسخة الهدف أصلًا")).toBeInTheDocument();
    expect(within(table).getByText("SKIPPED")).toBeInTheDocument();
    expect(within(table).getByText("SKIPPED_UP_TO_DATE")).toBeInTheDocument();
  });
});
