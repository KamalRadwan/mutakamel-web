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
    const response = await axiosClient.patch<BackupPolicy>(
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
    const response = await axiosClient.patch<BackupDatabaseOverride>(
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

  startRun: async (data: StartBackupRunDto, idempotencyKey: string) => {
    const response = await axiosClient.post<BackupRun>(
      `${BACKUP_BASE_URL}/runs`,
      data,
      idempotentWrite(idempotencyKey),
    );
    return response.data;
  },

  listRuns: async (query?: BackupRunListQuery) => {
    const response = await axiosClient.get<BackupRun[]>(
      `${BACKUP_BASE_URL}/runs${toQueryString(query)}`,
    );
    return response.data;
  },

  deleteRun: async (runId: string, idempotencyKey: string) => {
    await axiosClient.delete(
      `${BACKUP_BASE_URL}/runs/${encodeURIComponent(runId)}`,
      idempotentWrite(idempotencyKey),
    );
  },

  listArtifacts: async (query?: BackupArtifactListQuery) => {
    const response = await axiosClient.get<BackupArtifact[]>(
      `${BACKUP_BASE_URL}/artifacts${toQueryString(query)}`,
    );
    return response.data;
  },

  deleteArtifact: async (artifactId: string, idempotencyKey: string) => {
    await axiosClient.delete(
      `${BACKUP_BASE_URL}/artifacts/${encodeURIComponent(artifactId)}`,
      idempotentWrite(idempotencyKey),
    );
  },

  startRestore: async (
    data: StartRestoreRunDto,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.post<RestoreRun>(
      `${RESTORE_BASE_URL}/runs`,
      data,
      idempotentWrite(idempotencyKey),
    );
    return response.data;
  },

  listRestores: async (query?: RestoreRunListQuery) => {
    const response = await axiosClient.get<RestoreRun[]>(
      `${RESTORE_BASE_URL}/runs${toQueryString(query)}`,
    );
    return response.data;
  },

  promoteRestore: async (
    runId: string,
    data: PromoteRestoreRunDto,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.post<RestoreRun>(
      `${RESTORE_BASE_URL}/runs/${encodeURIComponent(runId)}/promote`,
      data,
      idempotentWrite(idempotencyKey),
    );
    return response.data;
  },
};
