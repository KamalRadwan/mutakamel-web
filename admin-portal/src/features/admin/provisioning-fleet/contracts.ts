import type {
  AttestFleetReportCommand,
  CreateFleetPreviewCommand,
  CreateFleetRolloutCommand,
  FieldErrors,
  FleetAttestationDraft,
  FleetManageDraft,
  FleetOperationCommand,
  FleetOperationType,
  FleetPage,
  FleetPreview,
  FleetPreviewDraft,
  FleetPreviewTenant,
  FleetReport,
  FleetResult,
  FleetRollout,
  FleetRolloutDraft,
  FleetRolloutTenant,
  FleetSelectionFilter,
  FleetTargetDraft,
  FleetTargetSelection,
  ManageFleetRolloutCommand,
  TenantLifecycleStatus,
} from "./types";
import {
  FLEET_OPERATION_TYPES,
  FLEET_ROLLOUT_STATUSES,
  FLEET_TENANT_STATUSES,
} from "./types";

export const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
export const SHA256 = /^[0-9a-f]{64}$/u;
export const COMPONENT_KEY = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_-]*)*$/u;
export const APPLICATION_KEY = /^[a-z][a-z0-9_-]{0,63}$/u;
export const RELEASE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,119}$/u;
export const SAFE_CODE = /^[A-Z][A-Z0-9._-]{2,95}$/u;
export const ED25519_SIGNATURE_BASE64 = /^[A-Za-z0-9+/]{86}==$/u;

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const CORRELATION = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

export class ProvisioningFleetContractError extends Error {
  constructor(message = "INVALID_PROVISIONING_FLEET_RESPONSE") {
    super(message);
    this.name = "ProvisioningFleetContractError";
  }
}

export function isUuidV7(value: string): boolean {
  return UUID_V7.test(value.toLowerCase());
}

export function requireUuidV7(value: string, code = "INVALID_UUID_V7"): string {
  const normalized = value.trim().toLowerCase();
  if (!UUID_V7.test(normalized)) throw new TypeError(code);
  return normalized;
}

export const emptyTargetDraft = (): FleetTargetDraft => ({
  componentKey: "",
  componentId: "",
  targetReleaseId: "",
  targetReleaseVersion: "",
  targetManifestChecksum: "",
  expectedCurrentReleaseId: "",
  expectedCurrentManifestChecksum: "",
});

export const initialPreviewDraft = (): FleetPreviewDraft => ({
  operationType: "UPDATE",
  applicationKey: "",
  componentKey: "",
  retentionAcknowledged: false,
  targets: [emptyTargetDraft()],
  broadSelection: false,
  allEligibleTenantsAcknowledged: false,
  tenantIdsText: "",
  tenantStatuses: ["ACTIVE", "SUSPENDED"],
});

export function buildPreviewCommand(draft: FleetPreviewDraft): {
  command: CreateFleetPreviewCommand | null;
  errors: FieldErrors;
} {
  const errors: FieldErrors = {};
  const applicationKey = draft.applicationKey.trim();
  const componentKey = draft.componentKey.trim();
  const operationType = draft.operationType;
  if (!FLEET_OPERATION_TYPES.includes(operationType)) {
    errors.operationType = "operation";
  }

  if (operationType === "ADD_APPLICATION") {
    if (!APPLICATION_KEY.test(applicationKey)) errors.applicationKey = "applicationKey";
  } else if (applicationKey) {
    errors.applicationKey = "notAllowed";
  }
  if (operationType === "DECOMMISSION") {
    if (!COMPONENT_KEY.test(componentKey)) errors.componentKey = "componentKey";
    if (!draft.retentionAcknowledged) errors.retentionAcknowledged = "required";
  } else {
    if (componentKey) errors.componentKey = "notAllowed";
    if (draft.retentionAcknowledged) errors.retentionAcknowledged = "notAllowed";
  }

  let targetSelection: FleetTargetSelection[] | undefined;
  if (operationType === "DECOMMISSION") {
    if (draft.targets.some(hasTargetValue)) errors.targets = "notAllowed";
  } else {
    if (draft.targets.length < 1 || draft.targets.length > 100) {
      errors.targets = "targetCount";
    }
    if (operationType === "REPAIR" && draft.targets.length !== 1) {
      errors.targets = "repairTargetCount";
    }
    const seen = new Set<string>();
    targetSelection = draft.targets.map((target, index) => {
      const prefix = `targets.${index}`;
      const normalized = normalizeTargetDraft(target, prefix, operationType, errors);
      if (seen.has(normalized.componentKey)) errors[`${prefix}.componentKey`] = "duplicate";
      seen.add(normalized.componentKey);
      return normalized;
    }).sort((left, right) => left.componentKey.localeCompare(right.componentKey));
  }

  const tenantStatuses = normalizeTenantStatuses(draft.tenantStatuses, errors);
  let selectionFilter: FleetSelectionFilter;
  if (draft.broadSelection) {
    if (!draft.allEligibleTenantsAcknowledged) {
      errors.allEligibleTenantsAcknowledged = "required";
    }
    if (parseTenantIds(draft.tenantIdsText).length) errors.tenantIds = "notAllowed";
    selectionFilter = {
      allEligibleTenantsAcknowledged: true,
      ...(tenantStatuses.length ? { tenantStatuses } : {}),
    };
  } else {
    if (draft.allEligibleTenantsAcknowledged) {
      errors.allEligibleTenantsAcknowledged = "notAllowed";
    }
    const rawIds = parseTenantIds(draft.tenantIdsText);
    const normalizedIds = rawIds.map((value) => value.toLowerCase());
    if (!rawIds.length) errors.tenantIds = "required";
    if (rawIds.length > 10_000) errors.tenantIds = "tooMany";
    if (rawIds.some((value) => !UUID_V7.test(value.toLowerCase()))) {
      errors.tenantIds = "uuid";
    }
    const tenantIds = [...new Set(normalizedIds)].sort();
    if (tenantIds.length !== rawIds.length) errors.tenantIds = "duplicate";
    selectionFilter = {
      tenantIds,
      ...(tenantStatuses.length ? { tenantStatuses } : {}),
    };
  }

  if (Object.keys(errors).length) return { command: null, errors };
  return {
    command: {
      operationType,
      ...(operationType === "ADD_APPLICATION" ? { applicationKey } : {}),
      ...(operationType === "DECOMMISSION"
        ? { componentKey, retentionAcknowledged: true }
        : { targetSelection }),
      selectionFilter,
    },
    errors,
  };
}

export function initialRolloutDraft(preview: FleetPreview | null): FleetRolloutDraft {
  const eligible = Math.max(1, preview?.eligibleCount ?? 1);
  return {
    canarySize: "1",
    batchSize: String(Math.min(50, eligible)),
    maxParallel: "1",
    failureThreshold: "1",
  };
}

export function buildRolloutCommand(
  preview: FleetPreview,
  draft: FleetRolloutDraft,
): { command: CreateFleetRolloutCommand | null; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const canarySize = integerDraft(draft.canarySize, "canarySize", 1, 1_000, errors);
  const batchSize = integerDraft(draft.batchSize, "batchSize", 1, 1_000, errors);
  const maxParallel = integerDraft(draft.maxParallel, "maxParallel", 1, 100, errors);
  const failureThreshold = integerDraft(
    draft.failureThreshold,
    "failureThreshold",
    1,
    1_000,
    errors,
  );
  if (canarySize > preview.eligibleCount) errors.canarySize = "eligibleBound";
  if (failureThreshold > preview.eligibleCount) errors.failureThreshold = "eligibleBound";
  if (maxParallel > Math.min(canarySize, batchSize, preview.eligibleCount)) {
    errors.maxParallel = "parallelBound";
  }
  if (new Date(preview.expiresAt).getTime() <= Date.now()) errors.preview = "expired";
  if (Object.keys(errors).length) return { command: null, errors };
  return {
    command: {
      previewId: preview.previewId,
      expectedSelectionDigest: preview.selectionDigest,
      canarySize,
      batchSize,
      maxParallel,
      failureThreshold,
    },
    errors,
  };
}

export function buildManageCommand(draft: FleetManageDraft): {
  command: ManageFleetRolloutCommand | null;
  errors: FieldErrors;
} {
  const errors: FieldErrors = {};
  const expectedRevision = integerDraft(
    draft.expectedRevision,
    "expectedRevision",
    1,
    Number.MAX_SAFE_INTEGER,
    errors,
  );
  const reasonCode = draft.reasonCode.trim();
  if (!SAFE_CODE.test(reasonCode)) errors.reasonCode = "safeCode";
  return Object.keys(errors).length
    ? { command: null, errors }
    : { command: { expectedRevision, reasonCode }, errors };
}

export function buildAttestationCommand(draft: FleetAttestationDraft): {
  command: AttestFleetReportCommand | null;
  errors: FieldErrors;
} {
  const errors: FieldErrors = {};
  const expectedRevision = integerDraft(
    draft.expectedRevision,
    "expectedRevision",
    1,
    Number.MAX_SAFE_INTEGER,
    errors,
  );
  const publisherKeyId = draft.publisherKeyId.trim().toLowerCase();
  const signatureBase64 = draft.signatureBase64.trim();
  if (!UUID_V7.test(publisherKeyId)) errors.publisherKeyId = "uuid";
  if (!ED25519_SIGNATURE_BASE64.test(signatureBase64)) errors.signatureBase64 = "signature";
  return Object.keys(errors).length
    ? { command: null, errors }
    : {
        command: {
          expectedRevision,
          publisherKeyId,
          signatureAlgorithm: "Ed25519",
          signatureBase64,
        },
        errors,
      };
}

export function readPreviewEnvelope(value: unknown): FleetResult<FleetPreview> {
  return envelope(value, readPreview);
}

export function readPreviewTenantPage(value: unknown): FleetPage<FleetPreviewTenant> {
  return nestedPageEnvelope(value, readPreviewTenant);
}

export function readRolloutsEnvelope(value: unknown): FleetResult<FleetRollout[]> {
  return envelope(value, (payload) => {
    const values = array(payload, 200).map(readRollout);
    unique(values.map((item) => item.rolloutId));
    return values;
  });
}

export function readRolloutEnvelope(value: unknown): FleetResult<FleetRollout> {
  return envelope(value, readRollout);
}

export function readRolloutTenantPage(value: unknown): FleetPage<FleetRolloutTenant> {
  return nestedPageEnvelope(value, readRolloutTenant);
}

export function readReportEnvelope(value: unknown): FleetResult<FleetReport> {
  return envelope(value, readReport);
}

export function validatePageQuery(page: number, limit: number): void {
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 200
  ) {
    throw new TypeError("INVALID_FLEET_PAGE_QUERY");
  }
}

export function assertPreviewCommand(value: CreateFleetPreviewCommand): void {
  const row = object(value);
  const operationType = oneOf(row.operationType, FLEET_OPERATION_TYPES);
  const expected = ["operationType", "selectionFilter"];
  if (operationType === "ADD_APPLICATION") expected.push("applicationKey", "targetSelection");
  else if (operationType === "DECOMMISSION") {
    expected.push("componentKey", "retentionAcknowledged");
  } else expected.push("targetSelection");
  exact(row, expected);
  if (operationType === "ADD_APPLICATION") {
    matching(row.applicationKey, APPLICATION_KEY, 64);
  }
  if (operationType === "DECOMMISSION") {
    matching(row.componentKey, COMPONENT_KEY, 128);
    if (row.retentionAcknowledged !== true) throw new TypeError("INVALID_FLEET_PREVIEW_COMMAND");
  } else {
    const targets = array(row.targetSelection, 100).map(readTarget);
    assertTargets(operationType, targets);
  }
  readSelectionFilter(row.selectionFilter);
}

export function assertRolloutCommand(value: CreateFleetRolloutCommand): void {
  const row = object(value);
  exact(row, [
    "previewId",
    "expectedSelectionDigest",
    "canarySize",
    "batchSize",
    "maxParallel",
    "failureThreshold",
  ]);
  uuid(row.previewId);
  matching(row.expectedSelectionDigest, SHA256, 64);
  const canarySize = positiveInteger(row.canarySize, 1_000);
  const batchSize = positiveInteger(row.batchSize, 1_000);
  const maxParallel = positiveInteger(row.maxParallel, 100);
  positiveInteger(row.failureThreshold, 1_000);
  if (maxParallel > Math.min(canarySize, batchSize)) {
    throw new TypeError("INVALID_FLEET_ROLLOUT_COMMAND");
  }
}

export function assertManageCommand(value: ManageFleetRolloutCommand): void {
  const row = object(value);
  exact(row, ["expectedRevision", "reasonCode"]);
  positiveInteger(row.expectedRevision);
  matching(row.reasonCode, SAFE_CODE, 96);
}

export function assertAttestationCommand(value: AttestFleetReportCommand): void {
  const row = object(value);
  exact(row, [
    "expectedRevision",
    "publisherKeyId",
    "signatureAlgorithm",
    "signatureBase64",
  ]);
  positiveInteger(row.expectedRevision);
  uuid(row.publisherKeyId);
  if (row.signatureAlgorithm !== "Ed25519") {
    throw new TypeError("INVALID_FLEET_ATTESTATION_COMMAND");
  }
  matching(row.signatureBase64, ED25519_SIGNATURE_BASE64, 88);
}

function normalizeTargetDraft(
  target: FleetTargetDraft,
  prefix: string,
  operationType: FleetOperationType,
  errors: FieldErrors,
): FleetTargetSelection {
  const componentKey = target.componentKey.trim();
  const componentId = target.componentId.trim().toLowerCase();
  const targetReleaseId = target.targetReleaseId.trim().toLowerCase();
  const targetReleaseVersion = target.targetReleaseVersion.trim();
  const targetManifestChecksum = target.targetManifestChecksum.trim();
  const expectedCurrentReleaseId = target.expectedCurrentReleaseId.trim().toLowerCase();
  const expectedCurrentManifestChecksum = target.expectedCurrentManifestChecksum.trim();
  if (!COMPONENT_KEY.test(componentKey)) errors[`${prefix}.componentKey`] = "componentKey";
  if (!UUID_V7.test(componentId)) errors[`${prefix}.componentId`] = "uuid";
  if (!UUID_V7.test(targetReleaseId)) errors[`${prefix}.targetReleaseId`] = "uuid";
  if (!RELEASE_VERSION.test(targetReleaseVersion)) {
    errors[`${prefix}.targetReleaseVersion`] = "version";
  }
  if (!SHA256.test(targetManifestChecksum)) {
    errors[`${prefix}.targetManifestChecksum`] = "sha256";
  }
  const hasCurrentId = Boolean(expectedCurrentReleaseId);
  const hasCurrentChecksum = Boolean(expectedCurrentManifestChecksum);
  if (hasCurrentId !== hasCurrentChecksum) errors[`${prefix}.currentPair`] = "pair";
  if (operationType === "UPDATE" && !hasCurrentId) {
    errors[`${prefix}.currentPair`] = "updateRequired";
  }
  if (hasCurrentId && !UUID_V7.test(expectedCurrentReleaseId)) {
    errors[`${prefix}.expectedCurrentReleaseId`] = "uuid";
  }
  if (hasCurrentChecksum && !SHA256.test(expectedCurrentManifestChecksum)) {
    errors[`${prefix}.expectedCurrentManifestChecksum`] = "sha256";
  }
  return {
    componentKey,
    componentId,
    targetReleaseId,
    targetReleaseVersion,
    targetManifestChecksum,
    ...(hasCurrentId && hasCurrentChecksum
      ? { expectedCurrentReleaseId, expectedCurrentManifestChecksum }
      : {}),
  };
}

function normalizeTenantStatuses(
  values: TenantLifecycleStatus[],
  errors: FieldErrors,
): TenantLifecycleStatus[] {
  const statuses = [...new Set(values)].sort() as TenantLifecycleStatus[];
  if (
    statuses.length !== values.length ||
    statuses.some((value) => value !== "ACTIVE" && value !== "SUSPENDED")
  ) {
    errors.tenantStatuses = "status";
  }
  return statuses;
}

function parseTenantIds(value: string): string[] {
  return value.split(/[\s,;]+/u).map((item) => item.trim()).filter(Boolean);
}

function hasTargetValue(target: FleetTargetDraft): boolean {
  return Object.values(target).some((value) => value.trim().length > 0);
}

function integerDraft(
  value: string,
  field: string,
  minimum: number,
  maximum: number,
  errors: FieldErrors,
): number {
  if (!/^\d+$/u.test(value.trim())) {
    errors[field] = "integer";
    return 0;
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    errors[field] = "range";
  }
  return result;
}

function readPreview(value: unknown): FleetPreview {
  const row = object(value);
  exact(row, [
    "previewId",
    "operationType",
    "operationCommand",
    "targetSelection",
    "targetSelectionDigest",
    "selectionFilter",
    "selectionDigest",
    "eligibleCount",
    "ineligibleCount",
    "expiresAt",
    "createdAt",
  ]);
  const operationType = oneOf(row.operationType, FLEET_OPERATION_TYPES);
  const targetSelection = array(row.targetSelection, 100).map(readTarget);
  assertTargets(operationType, targetSelection);
  const eligibleCount = nonNegativeInteger(row.eligibleCount);
  const ineligibleCount = nonNegativeInteger(row.ineligibleCount);
  if (eligibleCount + ineligibleCount < 1) fail();
  const createdAt = instant(row.createdAt);
  const expiresAt = instant(row.expiresAt);
  if (new Date(expiresAt).getTime() <= new Date(createdAt).getTime()) fail();
  return {
    previewId: uuid(row.previewId),
    operationType,
    operationCommand: readOperationCommand(row.operationCommand, operationType),
    targetSelection,
    targetSelectionDigest: matching(row.targetSelectionDigest, SHA256, 64),
    selectionFilter: readSelectionFilter(row.selectionFilter),
    selectionDigest: matching(row.selectionDigest, SHA256, 64),
    eligibleCount,
    ineligibleCount,
    expiresAt,
    createdAt,
  };
}

function readPreviewTenant(value: unknown): FleetPreviewTenant {
  const row = object(value);
  exact(row, [
    "tenantId",
    "eligible",
    "deterministicRank",
    "safeReasonCode",
    "eligibilityDigest",
  ]);
  const eligible = bool(row.eligible);
  const safeReasonCode = nullableMatching(row.safeReasonCode, SAFE_CODE, 96);
  if ((eligible && safeReasonCode !== null) || (!eligible && safeReasonCode === null)) fail();
  return {
    tenantId: uuid(row.tenantId),
    eligible,
    deterministicRank: positiveInteger(row.deterministicRank),
    safeReasonCode,
    eligibilityDigest: matching(row.eligibilityDigest, SHA256, 64),
  };
}

function readRollout(value: unknown): FleetRollout {
  const row = object(value);
  exact(row, [
    "rolloutId",
    "previewId",
    "operationType",
    "operationCommand",
    "targetSelection",
    "targetSelectionDigest",
    "selectionDigest",
    "status",
    "canarySize",
    "batchSize",
    "maxParallel",
    "failureThreshold",
    "totalCount",
    "completedCount",
    "failedCount",
    "currentBatch",
    "revision",
    "safeReasonCode",
    "startedAt",
    "pausedAt",
    "completedAt",
    "createdAt",
  ]);
  const operationType = oneOf(row.operationType, FLEET_OPERATION_TYPES);
  const targetSelection = array(row.targetSelection, 100).map(readTarget);
  assertTargets(operationType, targetSelection);
  const status = oneOf(row.status, FLEET_ROLLOUT_STATUSES);
  const totalCount = positiveInteger(row.totalCount, 10_000);
  const canarySize = positiveInteger(row.canarySize, 1_000);
  const batchSize = positiveInteger(row.batchSize, 1_000);
  const maxParallel = positiveInteger(row.maxParallel, 100);
  const failureThreshold = positiveInteger(row.failureThreshold, 1_000);
  const completedCount = nonNegativeInteger(row.completedCount);
  const failedCount = nonNegativeInteger(row.failedCount);
  if (
    canarySize > totalCount ||
    maxParallel > Math.min(canarySize, batchSize, totalCount) ||
    failureThreshold > totalCount ||
    completedCount + failedCount > totalCount
  ) fail();
  const startedAt = nullableInstant(row.startedAt);
  const pausedAt = nullableInstant(row.pausedAt);
  const completedAt = nullableInstant(row.completedAt);
  if (!validRolloutDates(status, startedAt, pausedAt, completedAt)) fail();
  return {
    rolloutId: uuid(row.rolloutId),
    previewId: uuid(row.previewId),
    operationType,
    operationCommand: readOperationCommand(row.operationCommand, operationType),
    targetSelection,
    targetSelectionDigest: matching(row.targetSelectionDigest, SHA256, 64),
    selectionDigest: matching(row.selectionDigest, SHA256, 64),
    status,
    canarySize,
    batchSize,
    maxParallel,
    failureThreshold,
    totalCount,
    completedCount,
    failedCount,
    currentBatch: nonNegativeInteger(row.currentBatch),
    revision: positiveInteger(row.revision),
    safeReasonCode: nullableMatching(row.safeReasonCode, SAFE_CODE, 96),
    startedAt,
    pausedAt,
    completedAt,
    createdAt: instant(row.createdAt),
  };
}

function readRolloutTenant(value: unknown): FleetRolloutTenant {
  const row = object(value);
  exact(row, [
    "tenantId",
    "deterministicRank",
    "batchNumber",
    "status",
    "operationId",
    "eligibilityDigest",
    "evidenceDigest",
    "safeReasonCode",
    "dispatchedAt",
    "completedAt",
  ]);
  const status = oneOf(row.status, FLEET_TENANT_STATUSES);
  const operationId = nullableUuid(row.operationId);
  const evidenceDigest = nullableMatching(row.evidenceDigest, SHA256, 64);
  const dispatchedAt = nullableInstant(row.dispatchedAt);
  const completedAt = nullableInstant(row.completedAt);
  if (!validTenantEvidence(status, operationId, evidenceDigest, dispatchedAt, completedAt)) fail();
  return {
    tenantId: uuid(row.tenantId),
    deterministicRank: positiveInteger(row.deterministicRank),
    batchNumber: nonNegativeInteger(row.batchNumber),
    status,
    operationId,
    eligibilityDigest: matching(row.eligibilityDigest, SHA256, 64),
    evidenceDigest,
    safeReasonCode: nullableMatching(row.safeReasonCode, SAFE_CODE, 96),
    dispatchedAt,
    completedAt,
  };
}

function readReport(value: unknown): FleetReport {
  const row = object(value);
  exact(row, [
    "rolloutId",
    "revision",
    "status",
    "payloadBase64",
    "signingDigest",
    "reportDigest",
    "generatedAt",
    "publisherKeyId",
    "signatureAlgorithm",
    "signatureBase64",
    "attestedAt",
    "attestedByActorRef",
  ]);
  const status = oneOf(row.status, ["NOT_READY", "READY_FOR_ATTESTATION", "ATTESTED"] as const);
  const payloadBase64 = nullableMatching(row.payloadBase64, BASE64, 350_000);
  const signingDigest = nullableMatching(row.signingDigest, SHA256, 64);
  const reportDigest = nullableMatching(row.reportDigest, SHA256, 64);
  const generatedAt = nullableInstant(row.generatedAt);
  const publisherKeyId = nullableUuid(row.publisherKeyId);
  const signatureAlgorithm = row.signatureAlgorithm === null
    ? null
    : oneOf(row.signatureAlgorithm, ["Ed25519"] as const);
  const signatureBase64 = nullableMatching(
    row.signatureBase64,
    ED25519_SIGNATURE_BASE64,
    88,
  );
  const attestedAt = nullableInstant(row.attestedAt);
  const attestedByActorRef = nullableMatching(row.attestedByActorRef, SHA256, 64);
  const readyFields = [payloadBase64, signingDigest, reportDigest, generatedAt];
  const attestationFields = [
    publisherKeyId,
    signatureAlgorithm,
    signatureBase64,
    attestedAt,
    attestedByActorRef,
  ];
  if (status === "NOT_READY" && [...readyFields, ...attestationFields].some((item) => item !== null)) fail();
  if (status === "READY_FOR_ATTESTATION" && (readyFields.some((item) => item === null) || attestationFields.some((item) => item !== null))) fail();
  if (status === "ATTESTED" && [...readyFields, ...attestationFields].some((item) => item === null)) fail();
  return {
    rolloutId: uuid(row.rolloutId),
    revision: positiveInteger(row.revision),
    status,
    payloadBase64,
    signingDigest,
    reportDigest,
    generatedAt,
    publisherKeyId,
    signatureAlgorithm,
    signatureBase64,
    attestedAt,
    attestedByActorRef,
  };
}

function readTarget(value: unknown): FleetTargetSelection {
  const row = object(value);
  const hasCurrentId = "expectedCurrentReleaseId" in row;
  const hasCurrentChecksum = "expectedCurrentManifestChecksum" in row;
  if (hasCurrentId !== hasCurrentChecksum) fail();
  exact(row, [
    "componentKey",
    "componentId",
    "targetReleaseId",
    "targetReleaseVersion",
    "targetManifestChecksum",
    ...(hasCurrentId
      ? ["expectedCurrentReleaseId", "expectedCurrentManifestChecksum"]
      : []),
  ]);
  return {
    componentKey: matching(row.componentKey, COMPONENT_KEY, 128),
    componentId: uuid(row.componentId),
    targetReleaseId: uuid(row.targetReleaseId),
    targetReleaseVersion: matching(row.targetReleaseVersion, RELEASE_VERSION, 120),
    targetManifestChecksum: matching(row.targetManifestChecksum, SHA256, 64),
    ...(hasCurrentId
      ? {
          expectedCurrentReleaseId: uuid(row.expectedCurrentReleaseId),
          expectedCurrentManifestChecksum: matching(
            row.expectedCurrentManifestChecksum,
            SHA256,
            64,
          ),
        }
      : {}),
  };
}

function assertTargets(operationType: FleetOperationType, targets: FleetTargetSelection[]): void {
  unique(targets.map((target) => target.componentKey));
  if (operationType === "DECOMMISSION" && targets.length !== 0) fail();
  if (operationType !== "DECOMMISSION" && targets.length < 1) fail();
  if (operationType === "REPAIR" && targets.length !== 1) fail();
  if (operationType === "UPDATE" && targets.some((target) => !target.expectedCurrentReleaseId)) fail();
  const sorted = [...targets].sort((a, b) => a.componentKey.localeCompare(b.componentKey));
  if (targets.some((target, index) => target.componentKey !== sorted[index]?.componentKey)) fail();
}

function readOperationCommand(
  value: unknown,
  operationType: FleetOperationType,
): FleetOperationCommand {
  const row = object(value);
  if (operationType === "ADD_APPLICATION") {
    exact(row, ["applicationKey"]);
    return { applicationKey: matching(row.applicationKey, APPLICATION_KEY, 64) };
  }
  if (operationType === "DECOMMISSION") {
    exact(row, ["componentKey", "retentionAcknowledged"]);
    if (row.retentionAcknowledged !== true) fail();
    return {
      componentKey: matching(row.componentKey, COMPONENT_KEY, 128),
      retentionAcknowledged: true,
    };
  }
  exact(row, []);
  return {};
}

function readSelectionFilter(value: unknown): FleetSelectionFilter {
  const row = object(value);
  const statuses = "tenantStatuses" in row
    ? array(row.tenantStatuses, 2).map((item) => oneOf(item, ["ACTIVE", "SUSPENDED"] as const))
    : [];
  unique(statuses);
  if (statuses.some((item, index) => item !== [...statuses].sort()[index])) fail();
  if ("tenantIds" in row) {
    exact(row, ["tenantIds", ...(statuses.length ? ["tenantStatuses"] : [])]);
    const tenantIds = array(row.tenantIds, 10_000).map(uuid);
    if (!tenantIds.length) fail();
    unique(tenantIds);
    if (tenantIds.some((item, index) => item !== [...tenantIds].sort()[index])) fail();
    return { tenantIds, ...(statuses.length ? { tenantStatuses: statuses } : {}) };
  }
  exact(row, ["allEligibleTenantsAcknowledged", ...(statuses.length ? ["tenantStatuses"] : [])]);
  if (row.allEligibleTenantsAcknowledged !== true) fail();
  return {
    allEligibleTenantsAcknowledged: true,
    ...(statuses.length ? { tenantStatuses: statuses } : {}),
  };
}

function envelope<T>(value: unknown, reader: (value: unknown) => T): FleetResult<T> {
  const root = object(value);
  exact(root, ["success", "data", "correlationId", "timestamp"]);
  if (root.success !== true) fail();
  return {
    data: reader(root.data),
    correlationId: matching(root.correlationId, CORRELATION, 200),
    timestamp: instant(root.timestamp),
  };
}

function nestedPageEnvelope<T>(value: unknown, reader: (value: unknown) => T): FleetPage<T> {
  const outer = envelope(value, (payload) => object(payload));
  exact(outer.data, ["data", "meta"]);
  const meta = object(outer.data.meta);
  exact(meta, ["page", "limit", "total"]);
  const page = positiveInteger(meta.page);
  const limit = positiveInteger(meta.limit, 200);
  const total = nonNegativeInteger(meta.total);
  const items = array(outer.data.data, limit).map(reader);
  if (items.length > total) fail();
  const totalPages = Math.ceil(total / limit);
  if (total > 0 && page > totalPages && items.length > 0) fail();
  const identity = items.map((item) => JSON.stringify(item));
  unique(identity);
  const tenantIds = items.map((item) =>
    typeof item === "object" && item !== null && "tenantId" in item
      ? String(item.tenantId)
      : "",
  );
  if (tenantIds.some(Boolean)) unique(tenantIds);
  const ranks = items.map((item) =>
    typeof item === "object" && item !== null && "deterministicRank" in item
      ? String(item.deterministicRank)
      : "",
  );
  if (ranks.some(Boolean)) unique(ranks);
  return {
    items,
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
    correlationId: outer.correlationId,
    timestamp: outer.timestamp,
  };
}

function validRolloutDates(
  status: FleetRollout["status"],
  startedAt: string | null,
  pausedAt: string | null,
  completedAt: string | null,
): boolean {
  if (status === "DRAFT") return !startedAt && !pausedAt && !completedAt;
  if (status === "RUNNING") return Boolean(startedAt && !pausedAt && !completedAt);
  if (status === "PAUSED") return Boolean(startedAt && pausedAt && !completedAt);
  if (status === "CANCEL_REQUESTED") return Boolean(startedAt && !completedAt);
  return Boolean(startedAt && completedAt);
}

function validTenantEvidence(
  status: FleetRolloutTenant["status"],
  operationId: string | null,
  evidenceDigest: string | null,
  dispatchedAt: string | null,
  completedAt: string | null,
): boolean {
  if (["ELIGIBLE", "INELIGIBLE", "PENDING"].includes(status)) {
    return !operationId && !evidenceDigest && !dispatchedAt && !completedAt;
  }
  if (status === "DISPATCHED") return Boolean(dispatchedAt && !evidenceDigest && !completedAt);
  if (status === "SUCCEEDED") return Boolean(operationId && evidenceDigest && dispatchedAt && completedAt);
  if (status === "FAILED") return Boolean(evidenceDigest && dispatchedAt && completedAt);
  return Boolean(completedAt);
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail();
  return value as Record<string, unknown>;
}

function exact(value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) fail();
}

function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) fail();
  return value;
}

function matching(value: unknown, pattern: RegExp, maximum: number): string {
  if (typeof value !== "string" || value.length > maximum || !pattern.test(value)) fail();
  return value;
}

function nullableMatching(value: unknown, pattern: RegExp, maximum: number): string | null {
  return value === null ? null : matching(value, pattern, maximum);
}

function uuid(value: unknown): string {
  return matching(value, UUID_V7, 36);
}

function nullableUuid(value: unknown): string | null {
  return value === null ? null : uuid(value);
}

function bool(value: unknown): boolean {
  if (typeof value !== "boolean") fail();
  return value;
}

function positiveInteger(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > maximum) fail();
  return value as number;
}

function nonNegativeInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail();
  return value as number;
}

function instant(value: unknown): string {
  const text = matching(value, INSTANT, 24);
  if (new Date(text).toISOString() !== text) fail();
  return text;
}

function nullableInstant(value: unknown): string | null {
  return value === null ? null : instant(value);
}

function oneOf<const T extends readonly string[]>(value: unknown, values: T): T[number] {
  if (typeof value !== "string" || !values.includes(value)) fail();
  return value as T[number];
}

function unique(values: string[]): void {
  if (new Set(values).size !== values.length) fail();
}

function fail(): never {
  throw new ProvisioningFleetContractError();
}
