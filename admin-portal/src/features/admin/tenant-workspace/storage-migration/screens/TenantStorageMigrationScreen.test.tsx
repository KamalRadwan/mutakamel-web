// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, i18nMock, preflightApi, migrationApi, backupApiMock } =
  vi.hoisted(() => ({
    authMock: {
      user: { isSuperAdmin: false, permissions: [] as string[] },
      isLoading: false,
    },
    i18nMock: { lang: "en" as "ar" | "en", dir: "ltr" as "ltr" | "rtl" },
    preflightApi: { read: vi.fn() },
    migrationApi: { start: vi.fn(), get: vi.fn(), releaseSource: vi.fn() },
    backupApiMock: { listArtifacts: vi.fn(), listRestores: vi.fn() },
  }));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => i18nMock }));
vi.mock("../api", () => ({
  tenantStorageMigrationPreflightApi: preflightApi,
  tenantStorageMigrationApi: migrationApi,
}));
vi.mock("@/features/admin/backup/api", () => ({ backupApi: backupApiMock }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: { href: string; children: ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { TenantStorageMigrationScreen } from "./TenantStorageMigrationScreen";
import type { TenantStorageMigrationStatus } from "../../storage/types";

const TENANT_ID = "019f0000-0000-7000-8000-000000000001";
const SOURCE_ID = "019f0000-0000-7000-8000-000000000010";
const TARGET_ID = "019f0000-0000-7000-8000-000000000011";
const MIGRATION_ID = "019f0000-0000-7000-8000-000000000040";
const ARTIFACT_ID = "019f0000-0000-7000-8000-000000000020";
const RESTORE_ID = "019f0000-0000-7000-8000-000000000021";

const READ_ONLY = ["admin.storage_migrations.read"];
const FULL = [
  "admin.storage_migrations.read",
  "admin.storage_migrations.execute",
  "admin.storage_migrations.critical",
  "admin.backups.read",
];

function preflight(overrides: Record<string, unknown> = {}) {
  return {
    tenant: { id: TENANT_ID, name: "acme", status: "ACTIVE" },
    current: {
      storageServerId: SOURCE_ID,
      storageServerName: "Garage Cairo",
      storagePlacementRevision: "3",
    },
    targets: [
      {
        id: TARGET_ID,
        code: "garage-fra-1",
        name: "Garage Frankfurt",
        region: "eu-central-1",
        status: "ACTIVE",
        assignedTenants: 4,
        maxTenants: 100,
        maxBytes: "1099511627776",
        reservedBytes: "1073741824",
        committedBytes: "536870912",
        lastConnectionTestStatus: "PASSED",
        lastConnectionTestedAt: "2026-09-01T09:00:00.000Z",
      },
    ],
    blockers: [],
    openMigrationId: null,
    ...overrides,
  };
}

function migration(
  status: TenantStorageMigrationStatus,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: MIGRATION_ID,
    tenantId: TENANT_ID,
    sourceStorageServerId: SOURCE_ID,
    targetStorageServerId: TARGET_ID,
    expectedStoragePlacementRevision: "3",
    resultingStoragePlacementRevision: null,
    sourceOperationGeneration: "1",
    targetOperationGeneration: "1",
    status,
    copiedObjectCount: null,
    copiedBytes: null,
    namespaceDigest: null,
    failureCode: null,
    retainSource: false,
    sourceReleaseRequestedAt: null,
    ...overrides,
  };
}

describe("TenantStorageMigrationScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.user = { isSuperAdmin: false, permissions: [...FULL] };
    authMock.isLoading = false;
    i18nMock.lang = "en";
    i18nMock.dir = "ltr";
    preflightApi.read.mockResolvedValue(preflight());
    backupApiMock.listArtifacts.mockResolvedValue([
      {
        id: ARTIFACT_ID,
        runId: "run-1",
        databaseServerId: SOURCE_ID,
        tenantId: TENANT_ID,
        databaseName: "tenant_acme",
        status: "COMPLETED",
        sizeBytes: "1024",
        sha256: null,
        compressionAlgorithm: "gzip",
        hasFailure: false,
        failureCode: null,
        startedAt: "2026-09-01T08:00:00.000Z",
        finishedAt: "2026-09-01T08:10:00.000Z",
      },
    ]);
    backupApiMock.listRestores.mockResolvedValue([
      {
        id: RESTORE_ID,
        artifactId: ARTIFACT_ID,
        tenantId: TENANT_ID,
        databaseServerId: SOURCE_ID,
        sourceDatabaseName: "tenant_acme",
        targetDatabaseName: "tenant_acme_restore",
        status: "VERIFIED",
        hasVerification: true,
        reason: null,
        hasFailure: false,
        failureCode: null,
        startedAt: "2026-09-01T08:20:00.000Z",
        finishedAt: "2026-09-01T08:30:00.000Z",
        promotedAt: null,
        promoteReason: null,
      },
    ]);
    window.sessionStorage.clear();
  });

  it("renders a real permission boundary and issues no read without migration-read", () => {
    authMock.user = { isSuperAdmin: false, permissions: [] };

    render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "admin.storage_migrations.read",
    );
    expect(preflightApi.read).not.toHaveBeenCalled();
    expect(backupApiMock.listArtifacts).not.toHaveBeenCalled();
  });

  it("shows the placement revision the migration will be fenced on", async () => {
    render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);

    expect(await screen.findByText("Garage Cairo")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(preflightApi.read).toHaveBeenCalledWith(TENANT_ID);
  });

  it("loads backup evidence as its own resource and offers both selects", async () => {
    render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);

    expect(
      await screen.findByRole("combobox", { name: "Backup artifact" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Restore run" })).toBeInTheDocument();
    expect(backupApiMock.listArtifacts).toHaveBeenCalledWith({ tenantId: TENANT_ID });
    expect(backupApiMock.listRestores).toHaveBeenCalledWith({ tenantId: TENANT_ID });
  });

  it("keeps the page usable when backup evidence is forbidden and never requests it", async () => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: [
        "admin.storage_migrations.read",
        "admin.storage_migrations.execute",
        "admin.storage_migrations.critical",
      ],
    };

    render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);

    expect(await screen.findByText(/requires admin.backups.read/)).toBeInTheDocument();
    expect(backupApiMock.listArtifacts).not.toHaveBeenCalled();
    // The placement the operator came to read is still there.
    expect(screen.getByText("Garage Cairo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start storage migration/ }),
    ).toBeDisabled();
  });

  it("names every missing permission, including the backup evidence gate", async () => {
    authMock.user = { isSuperAdmin: false, permissions: [...READ_ONLY] };

    render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);

    expect(
      await screen.findByText("admin.storage_migrations.execute"),
    ).toBeInTheDocument();
    expect(screen.getByText("admin.storage_migrations.critical")).toBeInTheDocument();
    expect(screen.getByText("admin.backups.read")).toBeInTheDocument();
  });

  it("explains every blocker in plain language and refuses to submit", async () => {
    preflightApi.read.mockResolvedValue(
      preflight({ blockers: ["STORAGE_MIGRATION_IN_PROGRESS", "MAINTENANCE_FENCE_OPEN"] }),
    );

    render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);

    expect(
      await screen.findByText("A storage migration is already running"),
    ).toBeInTheDocument();
    expect(screen.getByText("A maintenance fence is open")).toBeInTheDocument();
    expect(screen.getByText("Garage Cairo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start storage migration/ }),
    ).toBeDisabled();
  });

  it("explains that no destination is eligible rather than offering an empty select", async () => {
    preflightApi.read.mockResolvedValue(preflight({ targets: [] }));

    render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);

    expect(await screen.findByText("No destination is eligible")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Destination Storage Server" }),
    ).not.toBeInTheDocument();
  });

  it("recovers an open migration from the preflight after a reload", async () => {
    preflightApi.read.mockResolvedValue(
      preflight({ openMigrationId: MIGRATION_ID }),
    );
    migrationApi.get.mockResolvedValue(migration("COPYING"));

    render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);

    expect(
      await screen.findByRole("heading", { level: 2, name: "Migration progress" }),
    ).toBeInTheDocument();
    expect(migrationApi.get).toHaveBeenCalledWith(MIGRATION_ID);
    expect(screen.getByText("A migration is already open for this tenant")).toBeInTheDocument();
    expect(screen.getByText("Refreshing automatically")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Start storage migration/ }),
    ).not.toBeInTheDocument();
  });

  it("polls a running migration and reports a rollback once it settles", async () => {
    vi.useFakeTimers();
    try {
      preflightApi.read.mockResolvedValue(
        preflight({ openMigrationId: MIGRATION_ID }),
      );
      migrationApi.get.mockResolvedValueOnce(migration("COPYING"));
      migrationApi.get.mockResolvedValue(
        migration("ROLLED_BACK", { failureCode: "STORAGE_TARGET_UNREACHABLE" }),
      );

      render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByText("Refreshing automatically")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });

      expect(
        screen.getByText(/The migration was rolled back/),
      ).toBeInTheDocument();
      expect(screen.getByText("STORAGE_TARGET_UNREACHABLE")).toBeInTheDocument();

      // A terminal status stops the poll.
      const callsAfterSettling = migrationApi.get.mock.calls.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      expect(migrationApi.get).toHaveBeenCalledTimes(callsAfterSettling);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the old copy by default and says plainly what that means", async () => {
    render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);

    const retain = await screen.findByRole("switch", {
      name: "Keep the old copy until I confirm removal",
    });
    expect(retain).toBeChecked();
    expect(
      screen.getByText(/its old storage namespace is kept exactly as it was/),
    ).toBeInTheDocument();
    expect(screen.getByText(/nothing is fenced and nothing is degraded/)).toBeInTheDocument();
  });

  it("explains the cost of turning retention off", async () => {
    render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);

    fireEvent.click(
      await screen.findByRole("switch", {
        name: "Keep the old copy until I confirm removal",
      }),
    );

    expect(
      screen.getByText(/deleted in the same call, as soon as placement commits/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nothing is kept to compare against or fall back to/),
    ).toBeInTheDocument();
  });

  it("treats a retained committed migration as finished, not as stuck", async () => {
    preflightApi.read.mockResolvedValue(preflight({ openMigrationId: MIGRATION_ID }));
    migrationApi.get.mockResolvedValue(
      migration("PLACEMENT_COMMITTED", { retainSource: true }),
    );

    render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);

    expect(await screen.findByText("Old copy kept")).toBeInTheDocument();
    expect(
      screen.getByText(/The tenant now runs on the destination Storage Server/),
    ).toBeInTheDocument();
    // Resting, not running: no auto-refresh badge and the release is offered.
    expect(screen.queryByText("Refreshing automatically")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Delete the old copy/ }),
    ).toBeEnabled();
  });

  it("stops polling a retained committed migration", async () => {
    vi.useFakeTimers();
    try {
      preflightApi.read.mockResolvedValue(preflight({ openMigrationId: MIGRATION_ID }));
      migrationApi.get.mockResolvedValue(
        migration("PLACEMENT_COMMITTED", { retainSource: true }),
      );

      render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const callsAfterLoad = migrationApi.get.mock.calls.length;

      // Nothing advances this state on its own, so a poll would wait forever.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(migrationApi.get).toHaveBeenCalledTimes(callsAfterLoad);
    } finally {
      vi.useRealTimers();
    }
  });

  it("requires the typed tenant id before deleting the old copy", async () => {
    preflightApi.read.mockResolvedValue(preflight({ openMigrationId: MIGRATION_ID }));
    migrationApi.get.mockResolvedValue(
      migration("PLACEMENT_COMMITTED", { retainSource: true }),
    );
    migrationApi.releaseSource.mockResolvedValue(
      migration("COMPLETED", {
        retainSource: true,
        sourceReleaseRequestedAt: "2026-09-03T10:00:00.000Z",
      }),
    );

    render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Delete the old copy/ }),
    );

    const confirm = await screen.findByRole("button", { name: "Delete permanently" });
    expect(confirm).toBeDisabled();
    expect(
      screen.getByText(/permanently deletes the tenant.s old storage namespace/),
    ).toBeInTheDocument();
    expect(migrationApi.releaseSource).not.toHaveBeenCalled();

    fireEvent.change(
      screen.getByRole("textbox", { name: "Type the exact name to confirm" }),
      { target: { value: TENANT_ID } },
    );
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(migrationApi.releaseSource).toHaveBeenCalledTimes(1),
    );
    const [id, body, key] = migrationApi.releaseSource.mock.calls[0];
    expect(id).toBe(MIGRATION_ID);
    expect(body).toEqual({ confirmTenantId: TENANT_ID });
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(await screen.findByText("The old copy has been deleted.")).toBeInTheDocument();
  });

  it("offers an exact retry, never a rollback, when the deletion is unconfirmed", async () => {
    preflightApi.read.mockResolvedValue(preflight({ openMigrationId: MIGRATION_ID }));
    migrationApi.get.mockResolvedValue(
      migration("PLACEMENT_COMMITTED", { retainSource: true }),
    );
    migrationApi.releaseSource.mockRejectedValue({
      response: {
        status: 503,
        data: {
          success: false,
          errorCode: "STORAGE_MIGRATION_FORWARD_REPAIR_REQUIRED",
          message: "Placement is committed; retry the same command.",
        },
      },
    });

    render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Delete the old copy/ }),
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Type the exact name to confirm" }),
      { target: { value: TENANT_ID } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

    expect(await screen.findByText(/Core is forward-only here/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry exact" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check actual state" })).toBeInTheDocument();
    // The same key is reused for the exact retry.
    const firstKey = migrationApi.releaseSource.mock.calls[0][2];
    fireEvent.click(screen.getByRole("button", { name: "Retry exact" }));
    await waitFor(() =>
      expect(migrationApi.releaseSource).toHaveBeenCalledTimes(2),
    );
    expect(migrationApi.releaseSource.mock.calls[1][2]).toBe(firstKey);
  });

  it("does not offer a deletion for a migration that never retained its source", async () => {
    preflightApi.read.mockResolvedValue(preflight({ openMigrationId: MIGRATION_ID }));
    migrationApi.get.mockResolvedValue(
      migration("COMPLETED", { retainSource: false }),
    );

    render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);

    expect(
      await screen.findByText(/The tenant.s storage now lives on the destination/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Delete the old copy/ }),
    ).not.toBeInTheDocument();
  });

  it("does not offer a deletion to an operator without execute and critical", async () => {
    authMock.user = { isSuperAdmin: false, permissions: [...READ_ONLY] };
    preflightApi.read.mockResolvedValue(preflight({ openMigrationId: MIGRATION_ID }));
    migrationApi.get.mockResolvedValue(
      migration("PLACEMENT_COMMITTED", { retainSource: true }),
    );

    render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);

    expect(await screen.findByText("Old copy kept")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Delete the old copy/ })).toBeDisabled();
  });

  it("renders the retained resting state in Arabic without mojibake", async () => {
    i18nMock.lang = "ar";
    i18nMock.dir = "rtl";
    preflightApi.read.mockResolvedValue(preflight({ openMigrationId: MIGRATION_ID }));
    migrationApi.get.mockResolvedValue(
      migration("PLACEMENT_COMMITTED", { retainSource: true }),
    );

    render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);

    expect(await screen.findByText("تم الاحتفاظ بالنسخة القديمة")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /حذف النسخة القديمة/ })).toBeEnabled();
    expect(document.body.textContent).not.toMatch(/[ØÙâÂ]/);
  });

  it("renders Arabic RTL without mojibake", async () => {
    i18nMock.lang = "ar";
    i18nMock.dir = "rtl";
    preflightApi.read.mockResolvedValue(
      preflight({ blockers: ["PLACEMENT_CUTOVER_IN_PROGRESS"] }),
    );

    const { container } = render(<TenantStorageMigrationScreen tenantId={TENANT_ID} />);

    expect(await screen.findByText("يوجد تحويل توزيع قيد التنفيذ")).toBeInTheDocument();
    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/[ØÙâÂ]/);
  });
});
