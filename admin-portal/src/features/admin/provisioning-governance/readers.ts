import {
  COMPONENT_KINDS,
  DISCOVERED_STATES,
  DISCOVERY_MODES,
  DISCOVERY_STATUSES,
  RELEASE_RISKS,
  type DiscoveryResult,
  type DiscoveryRun,
  type DiscoveryRunDetail,
  type Paginated,
  type PaginationMeta,
  type ProvisioningComponent,
  type ProvisioningRelease,
} from "./types";

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA_256 = /^[0-9a-f]{64}$/u;
const COMPONENT_KEY = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_-]*)*$/u;
const SEED_KEY = /^[a-z][a-z0-9_.-]{1,127}$/u;
const OWNER_APP = /^[a-z][a-z0-9_-]{0,31}$/u;

class ProvisioningGovernanceContractError extends Error {
  constructor() {
    super("INVALID_PROVISIONING_GOVERNANCE_RESPONSE");
    this.name = "ProvisioningGovernanceContractError";
  }
}

export function isUuidV7(value: string): boolean {
  return UUID_V7.test(value);
}

export function readComponentPage(
  payload: unknown,
): Paginated<ProvisioningComponent> {
  const envelope = readEnvelope(payload, true);
  const values = array(envelope.data, 100).map(readComponent);
  unique(values.map((value) => value.id));
  return page(envelope, values);
}

export function readReleasePage(
  payload: unknown,
): Paginated<ProvisioningRelease> {
  const envelope = readEnvelope(payload, true);
  const values = array(envelope.data, 100).map(readRelease);
  unique(values.map((value) => value.id));
  return page(envelope, values);
}

export function readDiscoveryRuns(payload: unknown): {
  items: DiscoveryRun[];
  correlationId: string;
  timestamp: string;
} {
  const envelope = readEnvelope(payload, false);
  const items = array(envelope.data, 200).map(readDiscoveryRunValue);
  unique(items.map((value) => value.runId));
  return {
    items,
    correlationId: envelope.correlationId,
    timestamp: envelope.timestamp,
  };
}

export function readDiscoveryRun(payload: unknown): DiscoveryRun {
  return readDiscoveryRunValue(readEnvelope(payload, false).data);
}

export function readDiscoveryRunDetail(payload: unknown): DiscoveryRunDetail {
  const value = object(readEnvelope(payload, false).data);
  exactKeys(value, [...DISCOVERY_RUN_KEYS, "results", "resultsTruncated"]);
  const run = readDiscoveryRunShape(value);
  const results = array(value.results, 1_000).map(readDiscoveryResult);
  unique(results.map((result) => `${result.tenantId}:${result.componentId}`));
  return {
    ...run,
    results,
    resultsTruncated: boolean(value.resultsTruncated),
  };
}

function readComponent(value: unknown): ProvisioningComponent {
  const row = object(value);
  exactKeys(row, [
    "id",
    "key",
    "ownerApp",
    "kind",
    "isMandatory",
    "contractVersion",
    "latestPublishedRelease",
    "createdAt",
    "updatedAt",
  ]);
  const id = uuid(row.id);
  const latest =
    row.latestPublishedRelease === null
      ? null
      : readRelease(row.latestPublishedRelease);
  if (latest && latest.componentId !== id) fail();
  return {
    id,
    key: matching(row.key, COMPONENT_KEY, 96),
    ownerApp: matching(row.ownerApp, OWNER_APP, 32),
    kind: oneOf(row.kind, COMPONENT_KINDS),
    isMandatory: boolean(row.isMandatory),
    contractVersion: positiveInteger(row.contractVersion),
    latestPublishedRelease: latest,
    createdAt: instant(row.createdAt),
    updatedAt: instant(row.updatedAt),
  };
}

function readRelease(value: unknown): ProvisioningRelease {
  const row = object(value);
  exactKeys(row, [
    "id",
    "componentId",
    "releaseVersion",
    "manifestVersion",
    "contractVersion",
    "schemaTarget",
    "schemaChecksum",
    "manifestChecksum",
    "riskLevel",
    "selfServiceAllowed",
    "requiresBackup",
    "requiresMaintenance",
    "publishedAt",
    "compatibility",
    "manifestSummaryAvailable",
    "seedPacks",
  ]);
  const compatibility = object(row.compatibility);
  exactKeys(compatibility, [
    "supportedForSelfService",
    "contractVersion",
    "requiredComponents",
  ]);
  const supported = boolean(compatibility.supportedForSelfService);
  const contractVersion =
    compatibility.contractVersion === null
      ? null
      : literalInteger(compatibility.contractVersion, 1);
  if (supported !== (contractVersion === 1)) fail();
  const requiredComponents = array(compatibility.requiredComponents, 100).map(
    (entry) => {
      const requirement = object(entry);
      exactKeys(requirement, ["componentKey", "allowedReleaseVersions"]);
      return {
        componentKey: matching(requirement.componentKey, COMPONENT_KEY, 96),
        allowedReleaseVersions: array(
          requirement.allowedReleaseVersions,
          100,
        ).map((version) => bounded(version, 120)),
      };
    },
  );
  unique(requiredComponents.map((entry) => entry.componentKey));
  const seedPacks = array(row.seedPacks, 200).map((entry) => {
    const seed = object(entry);
    exactKeys(seed, ["key", "version", "policy", "checksum"]);
    return {
      key: matching(seed.key, SEED_KEY, 128),
      version: bounded(seed.version, 120),
      policy: bounded(seed.policy, 64),
      checksum: nullableMatching(seed.checksum, SHA_256, 64),
    };
  });
  unique(seedPacks.map((entry) => entry.key));
  const manifestSummaryAvailable = boolean(row.manifestSummaryAvailable);
  if (!manifestSummaryAvailable && seedPacks.length) fail();
  return {
    id: uuid(row.id),
    componentId: uuid(row.componentId),
    releaseVersion: bounded(row.releaseVersion, 120),
    manifestVersion: positiveInteger(row.manifestVersion),
    contractVersion: positiveInteger(row.contractVersion),
    schemaTarget: bounded(row.schemaTarget, 200),
    schemaChecksum: nullableMatching(row.schemaChecksum, SHA_256, 64),
    manifestChecksum: matching(row.manifestChecksum, SHA_256, 64),
    riskLevel: oneOf(row.riskLevel, RELEASE_RISKS),
    selfServiceAllowed: boolean(row.selfServiceAllowed),
    requiresBackup: boolean(row.requiresBackup),
    requiresMaintenance: boolean(row.requiresMaintenance),
    publishedAt: instant(row.publishedAt),
    compatibility: {
      supportedForSelfService: supported,
      contractVersion,
      requiredComponents,
    },
    manifestSummaryAvailable,
    seedPacks,
  };
}

const DISCOVERY_RUN_KEYS = [
  "runId",
  "scanId",
  "mode",
  "status",
  "scheduledAt",
  "cutoffAt",
  "maxTenants",
  "eligibleTenantCount",
  "scannedCount",
  "remainingTenantCount",
  "driftedCount",
  "incompatibleCount",
  "sweepComplete",
  "safeErrorCode",
  "completedAt",
  "createdAt",
] as const;

function readDiscoveryRunValue(value: unknown): DiscoveryRun {
  const row = object(value);
  exactKeys(row, DISCOVERY_RUN_KEYS);
  return readDiscoveryRunShape(row);
}

function readDiscoveryRunShape(row: Record<string, unknown>): DiscoveryRun {
  const scheduledAt = instant(row.scheduledAt);
  const cutoffAt = instant(row.cutoffAt);
  const createdAt = instant(row.createdAt);
  const completedAt = nullableInstant(row.completedAt);
  const status = oneOf(row.status, DISCOVERY_STATUSES);
  const sweepComplete = boolean(row.sweepComplete);
  const safeErrorCode = nullableBounded(row.safeErrorCode, 200);
  const maxTenants = positiveInteger(row.maxTenants, 10_000);
  const eligibleTenantCount = nonNegativeInteger(row.eligibleTenantCount);
  const scannedCount = nonNegativeInteger(row.scannedCount);
  const remainingTenantCount = nonNegativeInteger(row.remainingTenantCount);
  const driftedCount = nonNegativeInteger(row.driftedCount);
  const incompatibleCount = nonNegativeInteger(row.incompatibleCount);
  if (
    cutoffAt > scheduledAt ||
    scannedCount > eligibleTenantCount ||
    scannedCount > maxTenants ||
    driftedCount > scannedCount ||
    incompatibleCount > scannedCount ||
    remainingTenantCount !== eligibleTenantCount - scannedCount ||
    (sweepComplete && remainingTenantCount !== 0) ||
    (status === "RUNNING" ? completedAt !== null : completedAt === null) ||
    (status === "FAILED" ? safeErrorCode === null : safeErrorCode !== null) ||
    (completedAt !== null && completedAt < scheduledAt)
  ) {
    fail();
  }
  return {
    runId: uuid(row.runId),
    scanId: uuid(row.scanId),
    mode: oneOf(row.mode, DISCOVERY_MODES),
    status,
    scheduledAt,
    cutoffAt,
    maxTenants,
    eligibleTenantCount,
    scannedCount,
    remainingTenantCount,
    driftedCount,
    incompatibleCount,
    sweepComplete,
    safeErrorCode,
    completedAt,
    createdAt,
  };
}

function readDiscoveryResult(value: unknown): DiscoveryResult {
  const row = object(value);
  exactKeys(row, [
    "tenantId",
    "componentId",
    "discoveredState",
    "observedReleaseId",
    "observedSchemaVersion",
    "observedManifestChecksum",
    "safeCode",
    "resultDigest",
    "observedAt",
  ]);
  return {
    tenantId: uuid(row.tenantId),
    componentId: uuid(row.componentId),
    discoveredState: oneOf(row.discoveredState, DISCOVERED_STATES),
    observedReleaseId: nullableUuid(row.observedReleaseId),
    observedSchemaVersion: nullableBounded(row.observedSchemaVersion, 120),
    observedManifestChecksum: nullableMatching(
      row.observedManifestChecksum,
      SHA_256,
      64,
    ),
    safeCode: nullableBounded(row.safeCode, 200),
    resultDigest: matching(row.resultDigest, SHA_256, 64),
    observedAt: instant(row.observedAt),
  };
}

interface Envelope {
  data: unknown;
  correlationId: string;
  timestamp: string;
  meta?: PaginationMeta;
}

function readEnvelope(value: unknown, paginated: boolean): Envelope {
  const envelope = object(value);
  exactKeys(
    envelope,
    paginated
      ? ["success", "data", "meta", "correlationId", "timestamp"]
      : ["success", "data", "correlationId", "timestamp"],
  );
  if (envelope.success !== true) fail();
  const result: Envelope = {
    data: envelope.data,
    correlationId: uuid(envelope.correlationId),
    timestamp: instant(envelope.timestamp),
  };
  if (paginated) result.meta = readMeta(envelope.meta);
  return result;
}

function readMeta(value: unknown): PaginationMeta {
  const meta = object(value);
  exactKeys(meta, [
    "page",
    "limit",
    "total",
    "totalPages",
    "hasNext",
    "hasPrev",
  ]);
  const pageValue = positiveInteger(meta.page);
  const limit = positiveInteger(meta.limit, 100);
  const total = nonNegativeInteger(meta.total);
  const totalPages = nonNegativeInteger(meta.totalPages);
  const hasNext = boolean(meta.hasNext);
  const hasPrev = boolean(meta.hasPrev);
  if (
    totalPages !== Math.ceil(total / limit) ||
    hasNext !== pageValue < totalPages ||
    hasPrev !== pageValue > 1
  ) {
    fail();
  }
  return { page: pageValue, limit, total, totalPages, hasNext, hasPrev };
}

function page<T>(envelope: Envelope, items: T[]): Paginated<T> {
  const meta = envelope.meta;
  if (!meta || items.length > meta.limit || items.length > meta.total) fail();
  return {
    items,
    ...meta,
    correlationId: envelope.correlationId,
    timestamp: envelope.timestamp,
  };
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    fail();
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const keys = Object.keys(value).sort();
  const allowed = [...expected].sort();
  if (
    keys.length !== allowed.length ||
    keys.some((key, index) => key !== allowed[index])
  ) {
    fail();
  }
}

function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) fail();
  return value;
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_V7.test(value)) fail();
  return value;
}

function nullableUuid(value: unknown): string | null {
  return value === null ? null : uuid(value);
}

function instant(value: unknown): string {
  if (typeof value !== "string") fail();
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value)
    fail();
  return value;
}

function nullableInstant(value: unknown): string | null {
  return value === null ? null : instant(value);
}

function bounded(value: unknown, maximum: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum)
    fail();
  return value;
}

function nullableBounded(value: unknown, maximum: number): string | null {
  return value === null ? null : bounded(value, maximum);
}

function matching(value: unknown, pattern: RegExp, maximum: number): string {
  const result = bounded(value, maximum);
  if (!pattern.test(result)) fail();
  return result;
}

function nullableMatching(
  value: unknown,
  pattern: RegExp,
  maximum: number,
): string | null {
  return value === null ? null : matching(value, pattern, maximum);
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") fail();
  return value;
}

function positiveInteger(
  value: unknown,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > maximum
  ) {
    fail();
  }
  return value;
}

function literalInteger(value: unknown, expected: 1): 1 {
  const result = positiveInteger(value);
  if (result !== expected) fail();
  return 1;
}

function nonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    fail();
  return value;
}

function oneOf<const T extends string>(
  value: unknown,
  values: readonly T[],
): T {
  if (typeof value !== "string" || !values.includes(value as T)) fail();
  return value as T;
}

function unique(values: string[]): void {
  if (new Set(values).size !== values.length) fail();
}

function fail(): never {
  throw new ProvisioningGovernanceContractError();
}
