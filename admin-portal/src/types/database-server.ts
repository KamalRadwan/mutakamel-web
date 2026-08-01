import { SuccessResponse } from "./common";

export type DatabaseServerStatus = "ACTIVE" | "DRAINING" | "OFFLINE";

export type DatabaseServerSslMode = "disable" | "require" | "verify-ca" | "verify-full";

export type DatabaseServerHistoryAction =
  | "CREATE"
  | "UPDATE"
  | "ACTIVATE"
  | "DRAIN"
  | "OFFLINE"
  | "DELETE";

export interface DatabaseServerView {
  id: string;
  name: string;
  host: string;
  port: number;

  sslMode: DatabaseServerSslMode;
  sslRejectUnauthorized: boolean;
  hasSslConfig: boolean;
  maintenanceDatabase: string;

  poolMin: number;
  poolMax: number;
  connectTimeoutMs: number;
  statementTimeoutMs: number;
  idleTimeoutMs: number;

  hasBackupCredentials: boolean;
  backupCredentialsUsesPrimary: boolean;
  hasProvisioningCredentials: boolean;
  runtimeCredentialsConfigured: {
    coreApp: boolean;
    crmApp: boolean;
    tradeApp: boolean;
    workerApp: boolean;
  };
  runtimePrincipalsReady: boolean;

  maxTenants: number;
  currentTenants: number;
  status: DatabaseServerStatus;

  countryName?: string;
  countryIsoCode?: string;
  region?: string; // compatibility alias equal to countryIsoCode

  createdAt: string; // serialized ISO timestamp
  updatedAt: string; // serialized ISO timestamp
}

export interface DatabaseServerCredentialsDto {
  username: string; // trim, length 1..128
  password: string; // length 1..1024; not trimmed
}

export interface DatabaseServerRuntimeCredentialsDto {
  coreApp: DatabaseServerCredentialsDto;
  crmApp: DatabaseServerCredentialsDto;
  tradeApp: DatabaseServerCredentialsDto;
  workerApp: DatabaseServerCredentialsDto;
}

export interface DatabaseServerSslConfigDto {
  ca?: string; // max 20,000
  cert?: string; // max 20,000
  key?: string; // max 20,000
  passphrase?: string; // max 1,024
}

export interface CreateDatabaseServerDto {
  name: string;
  driver?: "postgres";
  host: string;
  port?: number;

  credentials?: DatabaseServerCredentialsDto;
  runtimeCredentials?: DatabaseServerRuntimeCredentialsDto;
  backupCredentials?: DatabaseServerCredentialsDto;
  provisioningCredentials?: DatabaseServerCredentialsDto;

  sslMode?: DatabaseServerSslMode;
  sslRejectUnauthorized?: boolean;
  sslConfig?: DatabaseServerSslConfigDto;
  maintenanceDatabase?: string;

  poolMin?: number;
  poolMax?: number;
  connectTimeoutMs?: number;
  statementTimeoutMs?: number;
  idleTimeoutMs?: number;

  maxTenants: number;
  countryName?: string;
  countryIsoCode?: string;
}

export interface UpdateDatabaseServerDto {
  name?: string;
  host?: string;
  port?: number;

  credentials?: DatabaseServerCredentialsDto;
  runtimeCredentials?: DatabaseServerRuntimeCredentialsDto;
  backupCredentials?: DatabaseServerCredentialsDto;
  removeBackupCredentials?: boolean;

  sslMode?: DatabaseServerSslMode;
  sslRejectUnauthorized?: boolean;
  sslConfig?: DatabaseServerSslConfigDto;
  removeSslConfig?: boolean;
  maintenanceDatabase?: string;

  poolMin?: number;
  poolMax?: number;
  connectTimeoutMs?: number;
  statementTimeoutMs?: number;
  idleTimeoutMs?: number;

  provisioningCredentials?: DatabaseServerCredentialsDto;
  removeProvisioningCredentials?: boolean;

  maxTenants?: number;
  countryName?: string;
  countryIsoCode?: string;
}

export interface CheckDatabaseServerConnectivityDto {
  driver?: "postgres";
  host: string;
  port?: number;

  credentials?: DatabaseServerCredentialsDto;
  runtimeCredentials?: DatabaseServerRuntimeCredentialsDto;
  provisioningCredentials?: DatabaseServerCredentialsDto;
  backupCredentials?: DatabaseServerCredentialsDto;
  username?: string;
  password?: string;

  sslMode?: DatabaseServerSslMode;
  sslRejectUnauthorized?: boolean;
  sslConfig?: DatabaseServerSslConfigDto;
  maintenanceDatabase?: string;

  connectTimeoutMs?: number;
  statementTimeoutMs?: number;
  idleTimeoutMs?: number;
}

export interface DatabaseServerConnectivityResult {
  connected: boolean;
  message: string;
  checks?: DatabaseServerCredentialCheckResult[];
}

export type DatabaseServerCredentialCheckName =
  | "primary"
  | "provisioning"
  | "backup"
  | "coreApp"
  | "crmApp"
  | "tradeApp"
  | "workerApp";

export interface DatabaseServerCredentialCheckResult {
  principal: DatabaseServerCredentialCheckName;
  connected: boolean;
  message: string;
}

export interface DatabaseServerQueryDto {
  page?: number;
  limit?: number;
  sortBy?: "name" | "host" | "currentTenants" | "createdAt";
  sortDir?: "ASC" | "DESC";
  search?: string;
  status?: DatabaseServerStatus;
  countryIsoCode?: string;
  region?: string;
}

export type DatabaseServerListResponse = SuccessResponse<DatabaseServerView[]>;

export type DatabaseServerHistoryValue = string | number | boolean | null;

export interface DatabaseServerHistoryChange {
  field: string;
  label: string;
  previousValue: DatabaseServerHistoryValue;
  newValue: DatabaseServerHistoryValue;
}

export interface DatabaseServerHistoryView {
  id: string;
  databaseServerId: string;
  action: DatabaseServerHistoryAction;
  serverName: string;
  changes: DatabaseServerHistoryChange[];
  actorId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Extracted UI row format derived from View
export interface DatabaseServerRow extends DatabaseServerView {
  driver: "postgres";
  utilizationRatio: number; // 0..1
  isPlacementTarget: boolean;
}
