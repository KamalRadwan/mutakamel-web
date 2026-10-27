// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { backupApi } from "../api";
import { BackupArtifactStatus, BackupCompressionAlgorithm, type BackupArtifact } from "../types";
import { useBackupRestores } from "./useBackupRestores";

const route = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(route.search),
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { isSuperAdmin: false, permissions: ["admin.backups.read"] } }),
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: {} }) }));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => ({}) }));
vi.mock("@/shared/hooks/usePersistedCommandAttempt", () => ({
  usePersistedCommandAttempt: () => ({ pendingAttempt: null, clear: vi.fn() }),
}));
vi.mock("../api", () => ({
  backupApi: { listArtifacts: vi.fn(), listRestores: vi.fn() },
  backupDatabaseAccessApi: { listServers: vi.fn() },
}));

const olderArtifact: BackupArtifact = {
  id: "019f0000-0000-7000-8000-000000000001",
  runId: "019f0000-0000-7000-8000-000000000002",
  tenantId: "019f0000-0000-7000-8000-000000000003",
  databaseServerId: "019f0000-0000-7000-8000-000000000004",
  databaseName: "tenant_old",
  status: BackupArtifactStatus.COMPLETED,
  sizeBytes: "100",
  sha256: null,
  compressionAlgorithm: BackupCompressionAlgorithm.NONE,
  hasFailure: false,
  failureCode: null,
  startedAt: "2026-09-01T00:00:00.000Z",
  finishedAt: "2026-09-01T00:01:00.000Z",
};

describe("restore artifact hand-off", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    route.search = "";
    vi.mocked(backupApi.listRestores).mockResolvedValue([]);
    vi.mocked(backupApi.listArtifacts).mockResolvedValue([]);
  });

  it("resolves the selected artifact even with 500 newer global artifacts", async () => {
    const newest = Array.from({ length: 500 }, (_, index) => ({
      ...olderArtifact,
      id: `newer-${index}`,
      runId: "another-run",
    }));
    vi.mocked(backupApi.listArtifacts).mockImplementation(async (query) =>
      query?.runId === olderArtifact.runId && query.tenantId === olderArtifact.tenantId
        ? [olderArtifact]
        : newest,
    );
    route.search = new URLSearchParams({
      artifactId: olderArtifact.id,
      runId: olderArtifact.runId,
      tenantId: olderArtifact.tenantId,
    }).toString();
    const { result } = renderHook(() => useBackupRestores());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(backupApi.listArtifacts).toHaveBeenCalledWith({
      runId: olderArtifact.runId,
      tenantId: olderArtifact.tenantId,
    });
    expect(result.current.artifacts.find((artifact) => artifact.id === result.current.requestedArtifactId))
      .toEqual(olderArtifact);
  });

  it("keeps the latest selector for a direct visit and excludes incomplete artifacts", async () => {
    vi.mocked(backupApi.listArtifacts).mockResolvedValue([
      olderArtifact,
      { ...olderArtifact, id: "pending", status: BackupArtifactStatus.PENDING },
    ]);
    const { result } = renderHook(() => useBackupRestores());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(backupApi.listArtifacts).toHaveBeenCalledWith(undefined);
    expect(result.current.artifacts).toEqual([olderArtifact]);
  });
});
