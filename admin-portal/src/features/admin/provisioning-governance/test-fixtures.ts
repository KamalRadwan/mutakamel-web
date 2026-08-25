import type {
  DiscoveryRun,
  DiscoveryRunDetail,
  Paginated,
  ProvisioningComponent,
  ProvisioningRelease,
} from "./types";

export const CORRELATION_ID = "019f0000-0000-7000-8000-000000000001";
export const COMPONENT_ID = "019f0000-0000-7000-8000-000000000002";
export const RELEASE_ID = "019f0000-0000-7000-8000-000000000003";
export const RUN_ID = "019f0000-0000-7000-8000-000000000004";
export const SCAN_ID = "019f0000-0000-7000-8000-000000000005";
export const TENANT_ID = "019f0000-0000-7000-8000-000000000006";
export const OPERATOR_ID = "019f0000-0000-7000-8000-000000000007";
export const TIMESTAMP = "2026-08-12T09:00:00.000Z";

export const RELEASE: ProvisioningRelease = {
  id: RELEASE_ID,
  componentId: COMPONENT_ID,
  releaseVersion: "1.2.3",
  manifestVersion: 3,
  contractVersion: 1,
  schemaTarget: "2026081201",
  schemaChecksum: null,
  manifestChecksum: "a".repeat(64),
  riskLevel: "LOW",
  selfServiceAllowed: true,
  requiresBackup: false,
  requiresMaintenance: false,
  publishedAt: "2026-08-11T09:00:00.000Z",
  compatibility: {
    supportedForSelfService: true,
    contractVersion: 1,
    requiredComponents: [],
  },
  manifestSummaryAvailable: true,
  seedPacks: [],
};

export const COMPONENT: ProvisioningComponent = {
  id: COMPONENT_ID,
  key: "core.identity",
  ownerApp: "core-app",
  kind: "FOUNDATION",
  isMandatory: true,
  contractVersion: 1,
  latestPublishedRelease: RELEASE,
  createdAt: "2026-08-10T09:00:00.000Z",
  updatedAt: "2026-08-11T09:00:00.000Z",
};

export const RUN: DiscoveryRun = {
  runId: RUN_ID,
  scanId: SCAN_ID,
  mode: "DRY_RUN",
  status: "DRY_RUN",
  scheduledAt: "2026-08-12T08:00:00.000Z",
  cutoffAt: "2026-08-12T07:00:00.000Z",
  maxTenants: 100,
  eligibleTenantCount: 10,
  scannedCount: 10,
  remainingTenantCount: 0,
  driftedCount: 1,
  incompatibleCount: 0,
  sweepComplete: true,
  safeErrorCode: null,
  completedAt: "2026-08-12T08:01:00.000Z",
  createdAt: "2026-08-12T08:00:00.000Z",
};

export const RUN_DETAIL: DiscoveryRunDetail = {
  ...RUN,
  results: [
    {
      tenantId: TENANT_ID,
      componentId: COMPONENT_ID,
      discoveredState: "DRIFTED",
      observedReleaseId: RELEASE_ID,
      observedSchemaVersion: "2026081200",
      observedManifestChecksum: "b".repeat(64),
      safeCode: null,
      resultDigest: "c".repeat(64),
      observedAt: "2026-08-12T08:00:30.000Z",
    },
  ],
  resultsTruncated: false,
};

export const COMPONENT_PAGE: Paginated<ProvisioningComponent> = {
  items: [COMPONENT],
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
  correlationId: CORRELATION_ID,
  timestamp: TIMESTAMP,
};

export const RELEASE_PAGE: Paginated<ProvisioningRelease> = {
  ...COMPONENT_PAGE,
  items: [RELEASE],
};

export function componentEnvelope(): unknown {
  return envelope([COMPONENT], {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
}

export function releaseEnvelope(): unknown {
  return envelope([RELEASE], {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
}

export function discoveryRunsEnvelope(): unknown {
  return envelope([RUN]);
}

export function discoveryRunEnvelope(): unknown {
  return envelope(RUN);
}

export function discoveryDetailEnvelope(): unknown {
  return envelope(RUN_DETAIL);
}

function envelope(data: unknown, meta?: Record<string, unknown>) {
  return {
    success: true,
    data,
    ...(meta ? { meta } : {}),
    correlationId: CORRELATION_ID,
    timestamp: TIMESTAMP,
  };
}
