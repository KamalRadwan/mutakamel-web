// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { backupApi } from "../api";
import { BackupArtifactStatus, BackupCompressionAlgorithm, type BackupArtifact } from "../types";
import { useBackupArtifacts } from "./useBackupArtifacts";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { isSuperAdmin: false, permissions: ["admin.backups.read"] } }),
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: {} }) }));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => ({}) }));
vi.mock("@/shared/hooks/useIdempotency", () => ({
  useIdempotency: () => ({ getIdempotencyKey: vi.fn(), resetKey: vi.fn() }),
}));
vi.mock("../api", () => ({
  backupApi: { listArtifacts: vi.fn() },
  backupDatabaseAccessApi: { listServers: vi.fn() },
}));

const artifact: BackupArtifact = {
  id: "019f0000-0000-7000-8000-000000000001",
  runId: "019f0000-0000-7000-8000-000000000002",
  tenantId: "019f0000-0000-7000-8000-000000000003",
  databaseServerId: "019f0000-0000-7000-8000-000000000004",
  databaseName: "tenant_a",
  status: BackupArtifactStatus.COMPLETED,
  sizeBytes: "100",
  sha256: null,
  compressionAlgorithm: BackupCompressionAlgorithm.NONE,
  hasFailure: false,
  failureCode: null,
  startedAt: "2026-10-24T00:00:00.000Z",
  finishedAt: "2026-10-24T00:01:00.000Z",
};

describe("artifact query isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(backupApi.listArtifacts).mockResolvedValue([artifact]);
  });

  it("hides tenant A immediately and keeps it hidden when tenant B returns 403", async () => {
    const { result } = renderHook(() => useBackupArtifacts());
    act(() => result.current.setQuery({ tenantId: artifact.tenantId }));
    await waitFor(() => expect(result.current.artifacts).toEqual([artifact]));

    let rejectRequest!: (reason: unknown) => void;
    vi.mocked(backupApi.listArtifacts).mockImplementationOnce(() => new Promise((_, reject) => {
      rejectRequest = reject;
    }));
    act(() => result.current.setQuery({ tenantId: "tenant-b" }));
    expect(result.current.artifacts).toEqual([]);
    await waitFor(() => expect(backupApi.listArtifacts).toHaveBeenLastCalledWith({ tenantId: "tenant-b" }));
    await act(async () => {
      rejectRequest({ response: { status: 403, data: { code: "FORBIDDEN", message: "Forbidden" } } });
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatchObject({ httpStatus: 403, errorCode: "FORBIDDEN" });
    expect(result.current.artifacts).toEqual([]);
  });

  it("clears rows on a failed unchanged-query refresh and recovers on retry", async () => {
    const { result } = renderHook(() => useBackupArtifacts());
    await waitFor(() => expect(result.current.artifacts).toEqual([artifact]));
    vi.mocked(backupApi.listArtifacts).mockRejectedValueOnce(new Error("Unavailable"));
    await act(async () => { await result.current.refresh(); });
    expect(result.current.artifacts).toEqual([]);
    expect(result.current.error).not.toBeNull();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.artifacts).toEqual([artifact]);
    expect(result.current.error).toBeNull();
  });

  it("ignores a late response for the previous query", async () => {
    let resolvePrevious!: (rows: BackupArtifact[]) => void;
    vi.mocked(backupApi.listArtifacts).mockImplementationOnce(() => new Promise((resolve) => {
      resolvePrevious = resolve;
    }));
    const { result } = renderHook(() => useBackupArtifacts());
    await waitFor(() => expect(backupApi.listArtifacts).toHaveBeenCalledTimes(1));
    const nextArtifact = { ...artifact, id: "artifact-b", tenantId: "tenant-b" };
    vi.mocked(backupApi.listArtifacts).mockResolvedValueOnce([nextArtifact]);
    act(() => result.current.setQuery({ tenantId: "tenant-b" }));
    await waitFor(() => expect(result.current.artifacts).toEqual([nextArtifact]));
    await act(async () => { resolvePrevious([artifact]); });
    expect(result.current.artifacts).toEqual([nextArtifact]);
  });
});
