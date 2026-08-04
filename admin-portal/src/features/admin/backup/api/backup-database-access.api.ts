import { axiosClient } from "@/lib/api/axiosClient";
import {
  extractCoreData,
  extractCoreMeta,
  type SuccessResponse,
} from "@/shared/api/core-envelope";
import type {
  BackupCredentialCommandDto,
  BackupCredentialMutationReceipt,
  BackupDatabaseAccessBinding,
  BackupDatabaseAccessBindingStatus,
  BackupDatabaseServerOption,
  BackupDatabaseServerStatus,
  UpdateBackupRotationPolicyDto,
} from "../types";

const DATABASE_SERVERS_BASE_URL =
  "/api/admin/core/v1/database-servers";
const BACKUP_PRINCIPAL_SEGMENT = "system-principals/backup";

interface SystemPrincipalWireView {
  purpose: "PROVISIONING" | "BACKUP";
  databasePrincipal: string;
  status: BackupDatabaseAccessBindingStatus;
  credentialRevision: string;
  rotationEnabled: boolean;
  rotationIntervalHours: number;
  maintenanceWindowStartUtc: number;
  maintenanceWindowHours: number;
  rotationDueAt: string | null;
  lastRotationAttemptAt: string | null;
  lastRotationSucceededAt: string | null;
  retryAt: string | null;
  safeFailureCode: string | null;
  operationGeneration: string;
  hasStagedCandidate: boolean;
}

interface DatabaseServerOptionWireView {
  id: string;
  name: string;
  status: BackupDatabaseServerStatus;
  host?: string;
}

function idempotentWrite(idempotencyKey: string) {
  return {
    headers: { "x-idempotency-key": idempotencyKey },
  };
}

function assertBackupBinding(
  binding: SystemPrincipalWireView,
): asserts binding is BackupDatabaseAccessBinding {
  if (
    binding.purpose !== "BACKUP" ||
    binding.databasePrincipal !== "mutakamel_backup"
  ) {
    throw new Error("CORE_BACKUP_PRINCIPAL_CONTRACT_MISMATCH");
  }
}

function assertBackupReceipt(
  receipt: BackupCredentialMutationReceipt,
): void {
  if (
    receipt.purpose !== "BACKUP" ||
    receipt.databasePrincipal !== "mutakamel_backup"
  ) {
    throw new Error("CORE_BACKUP_PRINCIPAL_CONTRACT_MISMATCH");
  }
}

export const backupDatabaseAccessApi = {
  listServers: async (): Promise<BackupDatabaseServerOption[]> => {
    const servers: BackupDatabaseServerOption[] = [];
    for (let page = 1; page <= 1_000; page += 1) {
      const response = await axiosClient.get<
        SuccessResponse<DatabaseServerOptionWireView[]>
      >(`${DATABASE_SERVERS_BASE_URL}?page=${page}&limit=100`);

      const pageRows = extractCoreData(response);
      servers.push(
        ...pageRows.map(({ id, name, status, host }) => ({
          id,
          name,
          status,
          ...(host ? { host } : {}),
        })),
      );
      const meta = extractCoreMeta(response);
      if (!meta) {
        if (pageRows.length >= 100) {
          throw new Error("CORE_DATABASE_SERVER_PAGINATION_METADATA_MISSING");
        }
        return servers;
      }
      if (!meta.hasNext) return servers;
      if (meta.page !== page || meta.totalPages <= page) {
        throw new Error("CORE_DATABASE_SERVER_PAGINATION_CONTRACT_MISMATCH");
      }
    }

    throw new Error("CORE_DATABASE_SERVER_LIST_EXCEEDS_SAFE_BOUND");
  },

  getBinding: async (
    databaseServerId: string,
  ): Promise<BackupDatabaseAccessBinding | null> => {
    const response = await axiosClient.get<
      SuccessResponse<SystemPrincipalWireView[]>
    >(
      `${DATABASE_SERVERS_BASE_URL}/${encodeURIComponent(databaseServerId)}/system-principals`,
    );
    const binding = extractCoreData(response).find(
      (candidate) => candidate.purpose === "BACKUP",
    );

    if (!binding) return null;
    assertBackupBinding(binding);
    return binding;
  },

  updateRotationPolicy: async (
    databaseServerId: string,
    data: UpdateBackupRotationPolicyDto,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.patch<
      SuccessResponse<SystemPrincipalWireView>
    >(
      `${DATABASE_SERVERS_BASE_URL}/${encodeURIComponent(databaseServerId)}/${BACKUP_PRINCIPAL_SEGMENT}/rotation-policy`,
      data,
      idempotentWrite(idempotencyKey),
    );
    const binding = extractCoreData(response);
    assertBackupBinding(binding);
    return binding;
  },

  regenerateCredential: async (
    databaseServerId: string,
    data: BackupCredentialCommandDto,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.post<
      SuccessResponse<BackupCredentialMutationReceipt>
    >(
      `${DATABASE_SERVERS_BASE_URL}/${encodeURIComponent(databaseServerId)}/${BACKUP_PRINCIPAL_SEGMENT}/credential/regenerate`,
      data,
      idempotentWrite(idempotencyKey),
    );
    const receipt = extractCoreData(response);
    assertBackupReceipt(receipt);
    return receipt;
  },

  reconcileCredential: async (
    databaseServerId: string,
    data: BackupCredentialCommandDto,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.post<
      SuccessResponse<BackupCredentialMutationReceipt>
    >(
      `${DATABASE_SERVERS_BASE_URL}/${encodeURIComponent(databaseServerId)}/${BACKUP_PRINCIPAL_SEGMENT}/credential/reconcile`,
      data,
      idempotentWrite(idempotencyKey),
    );
    const receipt = extractCoreData(response);
    assertBackupReceipt(receipt);
    return receipt;
  },
};
