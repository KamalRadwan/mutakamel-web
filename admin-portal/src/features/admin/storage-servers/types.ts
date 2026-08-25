export type StorageServerStatus = "DRAFT" | "ACTIVE" | "DRAINING" | "OFFLINE";
export type StorageConnectionTestStatus = "NOT_TESTED" | "PASSED" | "FAILED";
export type StorageServerSortField =
  | "name"
  | "createdAt"
  | "updatedAt"
  | "lastConnectionTestedAt";

export interface StorageCredentialsDto {
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
