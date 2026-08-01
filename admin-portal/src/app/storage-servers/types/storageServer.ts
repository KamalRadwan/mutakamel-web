export type StorageServerStatus = "DRAFT" | "ACTIVE" | "OFFLINE";

export type StorageConnectionTestStatus = "NOT_TESTED" | "PASSED" | "FAILED";

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
  createdAt: string;
  updatedAt: string;
}

export interface StorageServerList {
  items: StorageServerView[];
  total: number;
}

// In the frontend code, we alias the domain 'StorageServer' directly to 'StorageServerView' 
// for backwards compatibility with component props
export type StorageServer = StorageServerView;
