export type StorageServerStatus = "DRAFT" | "ACTIVE" | "DRAINING" | "OFFLINE";
type StorageConnectionTestStatus = "NOT_TESTED" | "PASSED" | "FAILED";
export type StorageServerSortField =
  | "name"
  | "createdAt"
  | "updatedAt"
  | "lastConnectionTestedAt";

interface StorageCredentialsDto {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface CreateStorageServerDto {
  code: string;
  name: string;
  endpoint: string;
  region: string;
  bucketName: string;
  credentials: StorageCredentialsDto;
  maxTenants?: number | null;
}

export interface UpdateStorageServerDto {
  name?: string;
  endpoint?: string;
  region?: string;
  bucketName?: string;
  credentials?: StorageCredentialsDto;
  maxTenants?: number | null;
  isPlatformDefault?: boolean;
}

export interface ProbeStorageServerDto {
  expectedConfigRevision: number;
}

export interface RotateStorageCredentialsDto {
  expectedConfigRevision: number;
  credentials: StorageCredentialsDto;
  /** 1-24, server default 4 when omitted. */
  graceHours?: number;
}

type StorageCredentialRotationStatus = "STAGED" | "ACTIVATED" | "REVOKED";

/** Secret-free by construction — Core never returns raw key material. */
export interface StorageCredentialRotationView {
  id: string;
  storageServerId: string;
  expectedConfigRevision: number;
  operationGeneration: string;
  nextCredentialsRevision: number;
  graceHours: number;
  status: StorageCredentialRotationStatus;
  stagedAt: string;
  activatedAt: string | null;
  graceExpiresAt: string | null;
  revokedAt: string | null;
}

export interface StorageServerProbeResult {
  contractVersion: 1;
  commandId: string;
  storageServerId: string;
  configRevision: number;
  lifecycleStatus: StorageServerStatus;
  outcome: "PASSED" | "FAILED" | "SKIPPED";
  testedAt: string | null;
  errorCode: string | null;
}

export interface StorageServerView {
  id: string;
  code: string;
  name: string;
  endpoint: string;
  region: string;
  bucketName: string;
  status: StorageServerStatus;
  maxTenants: number | null;
  isPlatformDefault: boolean;
  assignedTenants: number;
  credentialsConfigured: boolean;
  configRevision: number;
  credentialRotatedAt: string;
  credentialRotationDueAt: string;
  lastConnectionTestStatus: StorageConnectionTestStatus;
  lastConnectionTestedAt: string | null;
  lastConnectionTestErrorCode: string | null;
  connectionEvidenceFresh: boolean;
  connectionEvidenceExpiresAt: string | null;
  nextAutomaticProbeDueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StorageServerList {
  items: StorageServerView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StorageServerListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: StorageServerStatus;
  sortBy?: StorageServerSortField;
  sortDir?: "ASC" | "DESC";
}
