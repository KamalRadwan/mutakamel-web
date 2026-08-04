import { axiosClient } from "@/lib/api/axiosClient";
import type {
  BackupArtifact,
  BackupArtifactListQuery,
  BackupDatabaseConfig,
  BackupDatabaseOverride,
  BackupPolicy,
  BackupPolicyListQuery,
  BackupRun,
  BackupRunListQuery,
  PromoteRestoreRunDto,
  RestoreRun,
  RestoreRunListQuery,
  StartBackupRunDto,
  StartRestoreRunDto,
  UpsertBackupDatabaseOverrideDto,
  UpsertBackupPolicyDto,
} from "../types";

const BACKUP_BASE_URL = "/api/admin/worker/v1/backups";
const RESTORE_BASE_URL = "/api/admin/worker/v1/restores";

type QueryValue = boolean | number | string | null | undefined;

type BackupRunWire = Omit<BackupRun, "hasFailure"> & {
  policyId: string | null;
  scheduledAt: string | null;
  storagePrefix: string;
  manifestKey: string | null;
  summary: unknown | null;
  requestedBy: string | null;
  error: unknown | null;
  provisioningRequestId: string | null;
  provisioningOperationId: string | null;
};

type BackupArtifactWire = Omit<BackupArtifact, "hasFailure"> & {
  storageKey: string | null;
  metadata: unknown | null;
  error: unknown | null;
};

type RestoreRunWire = Omit<RestoreRun, "hasFailure" | "hasVerification"> & {
  verification: unknown | null;
  requestedBy: string | null;
  error: unknown | null;
};

function hasRecordedValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

function toBackupRun(run: BackupRunWire): BackupRun {
  return {
    id: run.id,
    databaseServerId: run.databaseServerId,
    trigger: run.trigger,
    status: run.status,
    totalTenants: run.totalTenants,
    succeededTenants: run.succeededTenants,
    failedTenants: run.failedTenants,
    skippedTenants: run.skippedTenants,
    reason: run.reason,
    hasFailure: hasRecordedValue(run.error),
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  };
}

function toBackupArtifact(artifact: BackupArtifactWire): BackupArtifact {
  return {
    id: artifact.id,
    runId: artifact.runId,
    databaseServerId: artifact.databaseServerId,
    tenantId: artifact.tenantId,
    databaseName: artifact.databaseName,
    status: artifact.status,
    sizeBytes: artifact.sizeBytes,
    sha256: artifact.sha256,
    compressionAlgorithm: artifact.compressionAlgorithm,
    hasFailure: hasRecordedValue(artifact.error),
    startedAt: artifact.startedAt,
    finishedAt: artifact.finishedAt,
  };
}

function toRestoreRun(run: RestoreRunWire): RestoreRun {
  return {
    id: run.id,
    artifactId: run.artifactId,
    tenantId: run.tenantId,
    databaseServerId: run.databaseServerId,
    sourceDatabaseName: run.sourceDatabaseName,
    targetDatabaseName: run.targetDatabaseName,
    status: run.status,
    hasVerification: hasRecordedValue(run.verification),
    reason: run.reason,
    hasFailure: hasRecordedValue(run.error),
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    promotedAt: run.promotedAt,
    promoteReason: run.promoteReason,
  };
}

function toQueryString(query?: object): string {
  if (!query) return "";

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query) as Array<
    [string, QueryValue]
  >) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function idempotentWrite(idempotencyKey: string) {
  return {
    headers: { "x-idempotency-key": idempotencyKey },
  };
}

const nonIdempotentWrite = {
  nonReplayable: true,
  skipAutoIdempotency: true,
} as const;

export const backupApi = {
  listPolicies: async (query?: BackupPolicyListQuery) => {
    const response = await axiosClient.get<BackupPolicy[]>(
      `${BACKUP_BASE_URL}/policies${toQueryString(query)}`,
    );
    return response.data;
  },

  getPolicy: async (databaseServerId: string) => {
    const response = await axiosClient.get<BackupPolicy>(
      `${BACKUP_BASE_URL}/policies/${encodeURIComponent(databaseServerId)}`,
    );
    return response.data;
  },

  upsertPolicy: async (
    databaseServerId: string,
    data: UpsertBackupPolicyDto,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.put<BackupPolicy>(
      `${BACKUP_BASE_URL}/policies/${encodeURIComponent(databaseServerId)}`,
      data,
      idempotentWrite(idempotencyKey),
    );
    return response.data;
  },

  listDatabaseConfigs: async (databaseServerId: string) => {
    const response = await axiosClient.get<BackupDatabaseConfig[]>(
      `${BACKUP_BASE_URL}/policies/${encodeURIComponent(databaseServerId)}/databases`,
    );
    return response.data;
  },

  upsertDatabaseOverride: async (
    databaseServerId: string,
    tenantId: string,
    data: UpsertBackupDatabaseOverrideDto,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.put<BackupDatabaseOverride>(
      `${BACKUP_BASE_URL}/policies/${encodeURIComponent(databaseServerId)}/databases/${encodeURIComponent(tenantId)}`,
      data,
      idempotentWrite(idempotencyKey),
    );
    return response.data;
  },

  deleteDatabaseOverride: async (
    databaseServerId: string,
    tenantId: string,
    idempotencyKey: string,
  ) => {
    await axiosClient.delete(
      `${BACKUP_BASE_URL}/policies/${encodeURIComponent(databaseServerId)}/databases/${encodeURIComponent(tenantId)}`,
      idempotentWrite(idempotencyKey),
    );
  },

  startRun: async (data: StartBackupRunDto) => {
    const response = await axiosClient.post<BackupRunWire>(
      `${BACKUP_BASE_URL}/runs`,
      data,
      nonIdempotentWrite,
    );
    return toBackupRun(response.data);
  },

  listRuns: async (query?: BackupRunListQuery) => {
    const response = await axiosClient.get<BackupRunWire[]>(
      `${BACKUP_BASE_URL}/runs${toQueryString(query)}`,
    );
    return response.data.map(toBackupRun);
  },

  getRun: async (runId: string) => {
    const response = await axiosClient.get<BackupRunWire>(
      `${BACKUP_BASE_URL}/runs/${encodeURIComponent(runId)}`,
    );
    return toBackupRun(response.data);
  },

  deleteRun: async (runId: string, idempotencyKey: string) => {
    await axiosClient.delete(
      `${BACKUP_BASE_URL}/runs/${encodeURIComponent(runId)}`,
      idempotentWrite(idempotencyKey),
    );
  },

  listArtifacts: async (query?: BackupArtifactListQuery) => {
    const response = await axiosClient.get<BackupArtifactWire[]>(
      `${BACKUP_BASE_URL}/artifacts${toQueryString(query)}`,
    );
    return response.data.map(toBackupArtifact);
  },

  deleteArtifact: async (artifactId: string, idempotencyKey: string) => {
    await axiosClient.delete(
      `${BACKUP_BASE_URL}/artifacts/${encodeURIComponent(artifactId)}`,
      idempotentWrite(idempotencyKey),
    );
  },

  startRestore: async (data: StartRestoreRunDto) => {
    const response = await axiosClient.post<RestoreRunWire>(
      `${RESTORE_BASE_URL}/runs`,
      data,
      nonIdempotentWrite,
    );
    return toRestoreRun(response.data);
  },

  listRestores: async (query?: RestoreRunListQuery) => {
    const response = await axiosClient.get<RestoreRunWire[]>(
      `${RESTORE_BASE_URL}/runs${toQueryString(query)}`,
    );
    return response.data.map(toRestoreRun);
  },

  getRestore: async (runId: string) => {
    const response = await axiosClient.get<RestoreRunWire>(
      `${RESTORE_BASE_URL}/runs/${encodeURIComponent(runId)}`,
    );
    return toRestoreRun(response.data);
  },

  promoteRestore: async (runId: string, data: PromoteRestoreRunDto) => {
    const response = await axiosClient.post<RestoreRunWire>(
      `${RESTORE_BASE_URL}/runs/${encodeURIComponent(runId)}/promote`,
      data,
      nonIdempotentWrite,
    );
    return toRestoreRun(response.data);
  },
};
