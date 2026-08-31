export type DatabaseServerStatus =
  | "DRAFT"
  | "ACTIVE"
  | "DRAINING"
  | "OFFLINE";

export type DatabaseServerSslMode =
  | "disable"
  | "require"
  | "verify-ca"
  | "verify-full";

type DatabaseServerHistoryAction =
  | "CREATE"
  | "UPDATE"
  | "ACTIVATE"
  | "DRAIN"
  | "OFFLINE"
  | "DELETE";

type DatabaseServerApplicationBindingStatus =
  | "PENDING"
  | "PROVISIONING"
  | "READY"
  | "ROTATING"
  | "DEFERRED"
  | "RECONCILING"
  | "DEGRADED"
  | "DISABLED";

interface DatabaseServerCredentialsDto {
  username: string; // trimmed, /^(?!pg_)[a-z_][a-z0-9_]{0,62}$/
  password: string; // 1..1024, do not trim
}

export interface DatabaseServerSslConfigDto {
  ca?: string; // max 20,000
  cert?: string; // max 20,000
  key?: string; // max 20,000
  passphrase?: string; // max 1,024
}

export interface DatabaseServerView {
  id: string;
  /** Non-null only when the server is soft-deleted and eligible for Destroy. */
  deletedAt: string | null;
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
  hasSecurityAdminCredentials: boolean;
  hasBackupCredentials: boolean;
  hasProvisioningCredentials: boolean;
  credentialBootstrap: DatabaseServerCredentialBootstrapSummary;
  /** Database Servers owns only the provisioning projection. Backup has its own module adapter. */
  systemPrincipals: DatabaseServerProvisioningPrincipalBindingView[];
  maxTenants: number;
  currentTenants: number;
  status: DatabaseServerStatus;
  countryName?: string;
  countryIsoCode?: string;
  createdAt: string;
  updatedAt: string;
}

type DatabaseServerCredentialBootstrapStatus =
  | "PENDING"
  | "PROVISIONING"
  | "READY"
  | "RECONCILING"
  | "DEGRADED";

interface DatabaseServerCredentialBootstrapSummary {
  status: DatabaseServerCredentialBootstrapStatus;
  totalPrincipals: number;
  readyPrincipals: number;
}

export interface DatabaseServerProvisioningPrincipalBindingView {
  purpose: "PROVISIONING";
  databasePrincipal: "mutakamel_provisioner";
  status: DatabaseServerApplicationBindingStatus;
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

export interface DatabaseServerApplicationBindingView {
  applicationId: string;
  applicationKey: string;
  applicationName: string;
  databasePrincipal: string;
  requiredOnDatabaseServer: boolean;
  status: DatabaseServerApplicationBindingStatus;
  credentialRevision: string;
  permissionManifestChecksum: string;
  policyRevision: string;
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

interface ApplicationCredentialBootstrapReceiptItem {
  applicationId: string;
  applicationKey: string;
  databasePrincipal: string;
  credentialRevision: string;
  permissionManifestChecksum: string;
  status: "READY";
}

export interface ApplicationCredentialBootstrapReceipt {
  databaseServerId: string;
  applications: ApplicationCredentialBootstrapReceiptItem[];
  status: "READY";
  completedAt: string;
}

export interface ApplicationCredentialMutationReceipt {
  databaseServerId: string;
  applicationKey: string;
  databasePrincipal: string;
  previousCredentialRevision: string;
  credentialRevision: string;
  status: "READY";
  invalidatedTenantCount: number;
}

export type DatabaseCredentialAction =
  | { kind: "retry-bootstrap" }
  | {
      kind: "regenerate" | "reconcile";
      applicationKey: string;
      databasePrincipal: string;
      expectedCredentialRevision: string;
    }
  | {
      kind: "regenerate-system" | "reconcile-system";
      databasePrincipal: "mutakamel_provisioner";
      expectedCredentialRevision: string;
    };

export interface CreateDatabaseServerDto {
  name: string;
  host: string;
  port?: number;
  securityAdminCredentials: DatabaseServerCredentialsDto;
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

export interface CheckDatabaseServerConnectivityDto {
  host: string;
  port?: number;
  securityAdminCredentials: DatabaseServerCredentialsDto;
  sslMode?: DatabaseServerSslMode;
  sslRejectUnauthorized?: boolean;
  sslConfig?: DatabaseServerSslConfigDto;
  maintenanceDatabase?: string;
  connectTimeoutMs?: number;
  statementTimeoutMs?: number;
  idleTimeoutMs?: number;
}

export type DatabaseServerCredentialCheckName = "securityAdmin";

export interface DatabaseServerConnectivityResult {
  connected: boolean;
  message: string;
  checks?: Array<{
    principal: DatabaseServerCredentialCheckName;
    connected: boolean;
    message: string;
  }>;
}

export interface UpdateDatabaseServerDto {
  name?: string;
  host?: string;
  port?: number;
  securityAdminCredentials?: DatabaseServerCredentialsDto;
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
  maxTenants?: number;
  countryName?: string;
  countryIsoCode?: string;
}

export interface BootstrapDatabaseServerApplicationsDto {
  reason: string; // trimmed, 8..500
}

export interface BootstrapDatabaseServerApplicationDto {
  expectedCatalogueRevision: string;
  expectedPolicyRevision: string;
  reason: string; // 8..500
}

export interface ApplicationDatabaseCredentialCommandDto {
  expectedCredentialRevision: string;
  reason: string; // 8..500
}

export interface UpdateDatabaseServerSystemPrincipalRotationDto {
  expectedCredentialRevision: string;
  rotationEnabled?: boolean;
  rotationIntervalHours?: number;
  maintenanceWindowStartUtc?: number;
  maintenanceWindowHours?: number;
  reason: string;
}

export interface DatabaseServerSystemCredentialMutationReceipt {
  databaseServerId: string;
  purpose: "PROVISIONING";
  databasePrincipal: "mutakamel_provisioner";
  credentialRevision: string;
  status: "READY";
}

export interface DatabaseServerQueryDto {
  page?: number;
  limit?: number;
  sortBy?: "name" | "host" | "currentTenants" | "createdAt";
  sortDir?: "ASC" | "DESC";
  search?: string;
  status?: DatabaseServerStatus;
  countryIsoCode?: string;
  /** When true, return only soft-deleted servers. Omit for the active registry. */
  deleted?: boolean;
}

export interface DatabaseServerHistoryQueryDto {
  action?: DatabaseServerHistoryAction;
  limit?: number; // 1..100
}

type DatabaseServerHistoryValue = string | number | boolean | null;

export interface DatabaseServerHistoryView {
  id: string;
  databaseServerId: string;
  action: DatabaseServerHistoryAction;
  serverName: string;
  changes: Array<{
    field: string;
    label: string;
    previousValue: DatabaseServerHistoryValue;
    newValue: DatabaseServerHistoryValue;
  }>;
  actorId: string | null;
  createdAt: string;
  updatedAt: string;
}
