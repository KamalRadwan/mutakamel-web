export type StoragePlacementRole = 'GENERAL' | 'BACKUP_ONLY';

export type StoragePrincipal = 'CORE' | 'CRM' | 'TRADE' | 'WORKER' | 'BACKUP' | 'PROBE';

export type StorageCredentialRole = 'OPERATION' | 'SIGNING';

export type StorageServerStatus = 'DRAFT' | 'ACTIVE' | 'DRAINING' | 'OFFLINE';

export interface StorageServer {
  id: string;
  code: string;
  name: string;
  provider: 'GARAGE';
  placementRole: StoragePlacementRole;
  internalEndpoint: string;
  publicEndpoint: string;
  region: string;
  forcePathStyle: true;
  configRevision: number;
  bindingRevision: number;
  readinessRevision: number;
  status: StorageServerStatus;
  availabilityClass: string;
  healthStatus: string;
  maxTenants: number;
  currentTenants: number;
  retainedTenants: number;
  reservedTenants: number;
  desiredNodeCount: number;
  desiredZoneCount: number;
  requiredReplicationFactor: number;
  observedNodeCount: number | null;
  observedZoneCount: number | null;
  observedReplicationFactor: number | null;
  usableCapacityBytes: string | null;
  usedCapacityBytes: string | null;
  allocatableCapacityBytes: string | null;
  activeReservedCapacityBytes: string;
  warningPercent: number;
  criticalPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStorageServerDto {
  code: string;
  name: string;
  internalEndpoint: string;
  publicEndpoint: string;
  region: string;
  placementRole?: StoragePlacementRole;
  forcePathStyle?: true;
  desiredNodeCount: number;
  desiredZoneCount: number;
  requiredReplicationFactor: number;
  maxTenants: number;
  warningPercent?: number;
  criticalPercent?: number;
}

export interface UpdateStorageServerDto {
  name?: string;
  internalEndpoint?: string;
  publicEndpoint?: string;
  region?: string;
  placementRole?: StoragePlacementRole;
  desiredNodeCount?: number;
  desiredZoneCount?: number;
  requiredReplicationFactor?: number;
  maxTenants?: number;
  warningPercent?: number;
  criticalPercent?: number;
}

export interface StorageBucketProfileDto {
  PRIVATE: string;
  RESTRICTED: string;
  CONTROL: string;
  BACKUP: string;
  PUBLIC?: string;
}

export interface StoragePrincipalProfileDto {
  CORE_OPERATION: string;
  CORE_SIGNING: string;
  CRM_OPERATION: string;
  CRM_SIGNING: string;
  TRADE_OPERATION: string;
  TRADE_SIGNING: string;
  WORKER_OPERATION: string;
  BACKUP_OPERATION: string;
  PROBE_OPERATION: string;
}

export interface StorageAttestationKeyProfileDto {
  CORE: string;
  CRM: string;
  TRADE: string;
  WORKER: string;
  BACKUP: string;
  PROBE: string;
}

export interface SetStorageRoutingProfileDto {
  expectedBindingRevision: number;
  buckets: StorageBucketProfileDto;
  principals: StoragePrincipalProfileDto;
  attestationKeys: StorageAttestationKeyProfileDto;
}

export type StorageServerErrorCode = 
  | "MISSING_REQUIRED_PERMISSIONS"
  | "STORAGE_SERVER_NOT_FOUND"
  | "STORAGE_SERVER_CODE_TAKEN"
  | "STORAGE_SERVER_INVALID_TRANSITION"
  | "STORAGE_SERVER_DRAIN_NOT_EMPTY"
  | "STORAGE_SERVER_VERIFICATION_FAILED"
  | "STORAGE_SERVER_ROUTING_OUTDATED"
  | "GW.IDEM.MISSING"
  | "GW.IDEM.BAD_VALUE"
  | "GW.IDEM.IN_FLIGHT"
  | "GW.IDEM.MISMATCH";
