import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type { PaginationMeta } from "@/types/common";

export type { PaginationMeta };

export const COMPONENT_KINDS = ["FOUNDATION", "MODULE"] as const;
type ComponentKind = (typeof COMPONENT_KINDS)[number];

export const RELEASE_RISKS = ["LOW", "MEDIUM", "HIGH"] as const;
type ReleaseRisk = (typeof RELEASE_RISKS)[number];

export const DISCOVERY_MODES = [
  "SCHEDULED",
  "MANUAL",
  "CATCH_UP",
  "DRY_RUN",
] as const;
type DiscoveryMode = (typeof DISCOVERY_MODES)[number];
type ManualDiscoveryMode = Extract<DiscoveryMode, "MANUAL" | "DRY_RUN">;

export const DISCOVERY_STATUSES = [
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "DRY_RUN",
] as const;
type DiscoveryStatus = (typeof DISCOVERY_STATUSES)[number];

export const DISCOVERED_STATES = [
  "READY",
  "NOT_INSTALLED",
  "OUTDATED",
  "DRIFTED",
  "INCOMPATIBLE",
] as const;
type DiscoveredState = (typeof DISCOVERED_STATES)[number];

export interface ProvisioningRelease {
  id: string;
  componentId: string;
  releaseVersion: string;
  manifestVersion: number;
  contractVersion: number;
  schemaTarget: string;
  schemaChecksum: string | null;
  manifestChecksum: string;
  riskLevel: ReleaseRisk;
  selfServiceAllowed: boolean;
  requiresBackup: boolean;
  requiresMaintenance: boolean;
  publishedAt: string;
  compatibility: {
    supportedForSelfService: boolean;
    contractVersion: 1 | null;
    requiredComponents: Array<{
      componentKey: string;
      allowedReleaseVersions: string[];
    }>;
  };
  manifestSummaryAvailable: boolean;
  seedPacks: Array<{
    key: string;
    version: string;
    policy: string;
    checksum: string | null;
  }>;
}

export interface ProvisioningComponent {
  id: string;
  key: string;
  ownerApp: string;
  kind: ComponentKind;
  isMandatory: boolean;
  contractVersion: number;
  latestPublishedRelease: ProvisioningRelease | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> extends PaginationMeta {
  items: T[];
  correlationId: string;
  timestamp: string;
}

export interface ComponentQuery {
  page: number;
  limit: number;
  sortBy: "key" | "ownerApp" | "kind" | "createdAt" | "updatedAt";
  sortDir: "ASC" | "DESC";
  search?: string;
  componentKey?: string;
  ownerApp?: string;
  kind?: ComponentKind;
}

export interface ReleaseQuery {
  page: number;
  limit: number;
  sortBy: "publishedAt" | "releaseVersion" | "manifestVersion" | "riskLevel";
  sortDir: "ASC" | "DESC";
  search?: string;
  riskLevel?: ReleaseRisk;
  selfServiceAllowed?: boolean;
  requiresBackup?: boolean;
  requiresMaintenance?: boolean;
}

export interface DiscoveryRun {
  runId: string;
  scanId: string;
  mode: DiscoveryMode;
  status: DiscoveryStatus;
  scheduledAt: string;
  cutoffAt: string;
  maxTenants: number;
  eligibleTenantCount: number;
  scannedCount: number;
  remainingTenantCount: number;
  driftedCount: number;
  incompatibleCount: number;
  sweepComplete: boolean;
  safeErrorCode: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface DiscoveryResult {
  tenantId: string;
  componentId: string;
  discoveredState: DiscoveredState;
  observedReleaseId: string | null;
  observedSchemaVersion: string | null;
  observedManifestChecksum: string | null;
  safeCode: string | null;
  resultDigest: string;
  observedAt: string;
}

export interface DiscoveryRunDetail extends DiscoveryRun {
  results: DiscoveryResult[];
  resultsTruncated: boolean;
}

export interface CreateDiscoveryRunCommand {
  mode: ManualDiscoveryMode;
  cutoffAt: string;
  maxTenants: number;
}

export type RequestState =
  | "IDLE"
  | "LOADING"
  | "READY"
  | "EMPTY"
  | "FORBIDDEN"
  | "UNAVAILABLE"
  | "ERROR";

export interface AsyncView<T> {
  state: RequestState;
  data: T | null;
  error: NormalizedApiError | null;
  isRefreshing: boolean;
}
