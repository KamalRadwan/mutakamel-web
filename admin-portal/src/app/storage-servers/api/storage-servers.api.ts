import { axiosClient, unwrapCoreData } from "@/lib/api/axiosClient";
import type { SuccessResponse } from "@/types/common";
import type {
  CreateStorageServerDto,
  StorageServerAdminView,
  StorageServerHistoryResponse,
  StorageServerListResponse,
  StorageVerificationRunStartView,
  StorageVerificationRunView,
  UpdateStorageServerDto,
} from "@/types/storage-server";
import { isSafeStorageEndpoint } from "../lib/storage-endpoint-policy";

const STORAGE_SERVERS_PATH = "/api/admin/core/v1/storage-servers";
const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORAGE_STATUSES = ["DRAFT", "ACTIVE", "DRAINING", "OFFLINE"] as const;
const AVAILABILITY_CLASSES = [
  "DEGRADED_SINGLE_NODE",
  "SINGLE_NODE_OPERATIONAL",
  "BACKUP_TARGET_OPERATIONAL",
  "HA_PRODUCTION_READY",
] as const;
const HEALTH_STATUSES = ["UNKNOWN", "HEALTHY", "UNHEALTHY"] as const;
const VERIFICATION_STATUSES = ["PENDING", "PASS", "FAIL", "EXPIRED"] as const;
const HISTORY_ACTIONS = [
  "BOOTSTRAPPED",
  "CREATED",
  "UPDATED",
  "BINDINGS_CHANGED",
  "PRINCIPAL_ROTATED",
  "VERIFIED",
  "ACTIVATED",
  "DRAINED",
  "OFFLINED",
  "DELETED",
] as const;
const PRINCIPALS = [
  "CORE",
  "CRM",
  "TRADE",
  "WORKER",
  "BACKUP",
  "PROBE",
] as const;
const CREDENTIAL_ROLES = ["OPERATION", "SIGNING"] as const;

function idempotencyHeaders(idempotencyKey: string) {
  return { headers: { "x-idempotency-key": idempotencyKey } };
}

async function unwrapResponse<T>(
  request: Promise<{ data: SuccessResponse<T> }>,
): Promise<T> {
  const response = await request;
  return unwrapCoreData<T>(response.data);
}

export const storageServersApi = {
  async list(): Promise<StorageServerListResponse> {
    return readStorageServerListResponse(
      await unwrapResponse(
      axiosClient.get<SuccessResponse<StorageServerListResponse>>(
        STORAGE_SERVERS_PATH,
      ),
      ),
    );
  },

  async get(id: string): Promise<StorageServerAdminView> {
    assertUuidV7(id, "Storage Server ID");
    return readStorageServerAdminView(
      await unwrapResponse(
      axiosClient.get<SuccessResponse<StorageServerAdminView>>(
        `${STORAGE_SERVERS_PATH}/${encodeURIComponent(id)}`,
      ),
      ),
    );
  },

  create(
    body: CreateStorageServerDto,
    idempotencyKey: string,
  ): Promise<StorageServerAdminView> {
    assertUuidV7(idempotencyKey, "idempotency key");
    return unwrapResponse(
      axiosClient.post<SuccessResponse<StorageServerAdminView>>(
        STORAGE_SERVERS_PATH,
        body,
        idempotencyHeaders(idempotencyKey),
      ),
    ).then(readStorageServerAdminView);
  },

  update(
    id: string,
    body: UpdateStorageServerDto,
    idempotencyKey: string,
  ): Promise<StorageServerAdminView> {
    assertUuidV7(id, "Storage Server ID");
    assertUuidV7(idempotencyKey, "idempotency key");
    return unwrapResponse(
      axiosClient.patch<SuccessResponse<StorageServerAdminView>>(
        `${STORAGE_SERVERS_PATH}/${encodeURIComponent(id)}`,
        body,
        idempotencyHeaders(idempotencyKey),
      ),
    ).then(readStorageServerAdminView);
  },

  async history(id: string): Promise<StorageServerHistoryResponse> {
    assertUuidV7(id, "Storage Server ID");
    return readStorageServerHistoryResponse(
      await unwrapResponse(
      axiosClient.get<SuccessResponse<StorageServerHistoryResponse>>(
        `${STORAGE_SERVERS_PATH}/${encodeURIComponent(id)}/history`,
      ),
      ),
    );
  },

  activate(id: string, idempotencyKey: string): Promise<StorageServerAdminView> {
    return lifecycleMutation(id, "activate", idempotencyKey);
  },

  drain(id: string, idempotencyKey: string): Promise<StorageServerAdminView> {
    return lifecycleMutation(id, "drain", idempotencyKey);
  },

  offline(id: string, idempotencyKey: string): Promise<StorageServerAdminView> {
    return lifecycleMutation(id, "offline", idempotencyKey);
  },

  startVerification(
    id: string,
    idempotencyKey: string,
  ): Promise<StorageVerificationRunStartView> {
    assertUuidV7(id, "Storage Server ID");
    assertUuidV7(idempotencyKey, "idempotency key");
    return unwrapResponse(
      axiosClient.post<SuccessResponse<StorageVerificationRunStartView>>(
        `${STORAGE_SERVERS_PATH}/${encodeURIComponent(id)}/verification-runs`,
        {},
        idempotencyHeaders(idempotencyKey),
      ),
    ).then(readStorageVerificationRunStartView);
  },

  getVerification(
    id: string,
    runId: string,
  ): Promise<StorageVerificationRunView> {
    assertUuidV7(id, "Storage Server ID");
    assertUuidV7(runId, "verification run ID");
    return unwrapResponse(
      axiosClient.get<SuccessResponse<StorageVerificationRunView>>(
        `${STORAGE_SERVERS_PATH}/${encodeURIComponent(id)}/verification-runs/${encodeURIComponent(runId)}`,
      ),
    ).then(readStorageVerificationRunView);
  },

  async remove(id: string, idempotencyKey: string): Promise<void> {
    assertUuidV7(id, "Storage Server ID");
    assertUuidV7(idempotencyKey, "idempotency key");
    await axiosClient.delete(
      `${STORAGE_SERVERS_PATH}/${encodeURIComponent(id)}`,
      idempotencyHeaders(idempotencyKey),
    );
  },
};

function lifecycleMutation(
  id: string,
  action: "activate" | "drain" | "offline",
  idempotencyKey: string,
): Promise<StorageServerAdminView> {
  assertUuidV7(id, "Storage Server ID");
  assertUuidV7(idempotencyKey, "idempotency key");
  return unwrapResponse(
    axiosClient.post<SuccessResponse<StorageServerAdminView>>(
      `${STORAGE_SERVERS_PATH}/${encodeURIComponent(id)}/${action}`,
      {},
      idempotencyHeaders(idempotencyKey),
    ),
  ).then(readStorageServerAdminView);
}

export function readStorageServerListResponse(
  value: unknown,
): StorageServerListResponse {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.items) || !isNonNegativeInt(record.total)) {
    throw new Error("INVALID_STORAGE_SERVER_LIST_RESPONSE");
  }
  const items = record.items.map(readStorageServerAdminView);
  if (items.length !== record.total) {
    throw new Error("INVALID_STORAGE_SERVER_LIST_RESPONSE");
  }
  return { items, total: record.total };
}

export function readStorageServerAdminView(
  value: unknown,
): StorageServerAdminView {
  const item = asRecord(value);
  if (
    !item ||
    !isUuidV7(item.id) ||
    !isNonEmptyString(item.code) ||
    !isNonEmptyString(item.name) ||
    item.provider !== "GARAGE" ||
    !isOneOf(item.placementRole, ["GENERAL", "BACKUP_ONLY"] as const) ||
    !isSafeStorageEndpoint(item.internalEndpoint, "internal") ||
    !isSafeStorageEndpoint(item.publicEndpoint, "public") ||
    !isNonEmptyString(item.region) ||
    item.forcePathStyle !== true ||
    !isPositiveInt(item.configRevision) ||
    !isPositiveInt(item.bindingRevision) ||
    !isPositiveInt(item.readinessRevision) ||
    !isOneOf(item.status, STORAGE_STATUSES) ||
    !isOneOf(item.availabilityClass, AVAILABILITY_CLASSES) ||
    !isOneOf(item.healthStatus, HEALTH_STATUSES) ||
    !isNonNegativeInt(item.maxTenants) ||
    !isNonNegativeInt(item.currentTenants) ||
    !isNonNegativeInt(item.retainedTenants) ||
    !isNonNegativeInt(item.reservedTenants) ||
    !isPositiveInt(item.desiredNodeCount) ||
    !isPositiveInt(item.desiredZoneCount) ||
    !isPositiveInt(item.requiredReplicationFactor) ||
    !isNullableNonNegativeInt(item.observedNodeCount) ||
    !isNullableNonNegativeInt(item.observedZoneCount) ||
    !isNullableNonNegativeInt(item.observedReplicationFactor) ||
    !isNullableDecimal(item.usableCapacityBytes) ||
    !isNullableDecimal(item.usedCapacityBytes) ||
    !isNullableDecimal(item.allocatableCapacityBytes) ||
    !isDecimalString(item.activeReservedCapacityBytes) ||
    !isPositiveInt(item.warningPercent) ||
    !isPositiveInt(item.criticalPercent) ||
    !isIsoDate(item.createdAt) ||
    !isIsoDate(item.updatedAt)
  ) {
    throw new Error("INVALID_STORAGE_SERVER_RESPONSE");
  }
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    provider: item.provider,
    placementRole: item.placementRole,
    internalEndpoint: item.internalEndpoint,
    publicEndpoint: item.publicEndpoint,
    region: item.region,
    forcePathStyle: item.forcePathStyle,
    configRevision: item.configRevision,
    bindingRevision: item.bindingRevision,
    readinessRevision: item.readinessRevision,
    status: item.status,
    availabilityClass: item.availabilityClass,
    healthStatus: item.healthStatus,
    maxTenants: item.maxTenants,
    currentTenants: item.currentTenants,
    retainedTenants: item.retainedTenants,
    reservedTenants: item.reservedTenants,
    desiredNodeCount: item.desiredNodeCount,
    desiredZoneCount: item.desiredZoneCount,
    requiredReplicationFactor: item.requiredReplicationFactor,
    observedNodeCount: item.observedNodeCount,
    observedZoneCount: item.observedZoneCount,
    observedReplicationFactor: item.observedReplicationFactor,
    usableCapacityBytes: item.usableCapacityBytes,
    usedCapacityBytes: item.usedCapacityBytes,
    allocatableCapacityBytes: item.allocatableCapacityBytes,
    activeReservedCapacityBytes: item.activeReservedCapacityBytes,
    warningPercent: item.warningPercent,
    criticalPercent: item.criticalPercent,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function readStorageServerHistoryResponse(
  value: unknown,
): StorageServerHistoryResponse {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.items) || !isNonNegativeInt(record.total)) {
    throw new Error("INVALID_STORAGE_SERVER_HISTORY_RESPONSE");
  }
  const items = record.items.map((candidate) => {
    const item = asRecord(candidate);
    if (
      !item ||
      !isUuidV7(item.id) ||
      !isOneOf(item.action, HISTORY_ACTIONS) ||
      !isPositiveInt(item.configRevision) ||
      !isPositiveInt(item.bindingRevision) ||
      !isPositiveInt(item.readinessRevision) ||
      !Array.isArray(item.changes) ||
      !(item.actorId === null || isUuidV7(item.actorId)) ||
      !(item.correlationId === null || isUuidV7(item.correlationId)) ||
      !isIsoDate(item.createdAt)
    ) {
      throw new Error("INVALID_STORAGE_SERVER_HISTORY_RESPONSE");
    }
    const changes = item.changes.map((candidateChange) => {
      const change = asRecord(candidateChange);
      if (
        !change ||
        !isNonEmptyString(change.field) ||
        !isHistoryValue(change.previousValue) ||
        !isHistoryValue(change.nextValue)
      ) {
        throw new Error("INVALID_STORAGE_SERVER_HISTORY_RESPONSE");
      }
      return {
        field: change.field,
        previousValue: change.previousValue,
        nextValue: change.nextValue,
      };
    });
    return {
      id: item.id,
      action: item.action,
      configRevision: item.configRevision,
      bindingRevision: item.bindingRevision,
      readinessRevision: item.readinessRevision,
      changes,
      actorId: item.actorId,
      correlationId: item.correlationId,
      createdAt: item.createdAt,
    };
  });
  if (items.length !== record.total) {
    throw new Error("INVALID_STORAGE_SERVER_HISTORY_RESPONSE");
  }
  return { items, total: record.total };
}

export function readStorageVerificationRunStartView(
  value: unknown,
): StorageVerificationRunStartView {
  const run = asRecord(value);
  if (
    !run ||
    !isUuidV7(run.verificationRunId) ||
    !isUuidV7(run.correlationId) ||
    run.status !== "PENDING" ||
    !isIsoDate(run.expiresAt)
  ) {
    throw new Error("INVALID_STORAGE_VERIFICATION_START_RESPONSE");
  }
  return {
    verificationRunId: run.verificationRunId,
    correlationId: run.correlationId,
    status: run.status,
    expiresAt: run.expiresAt,
  };
}

export function readStorageVerificationRunView(
  value: unknown,
): StorageVerificationRunView {
  const run = asRecord(value);
  if (
    !run ||
    !isUuidV7(run.id) ||
    !isOneOf(run.status, VERIFICATION_STATUSES) ||
    !isPositiveInt(run.configRevision) ||
    !isPositiveInt(run.bindingRevision) ||
    !isPositiveInt(run.readinessRevision) ||
    run.probeProfileVersion !== 1 ||
    !isIsoDate(run.requestedAt) ||
    !isIsoDate(run.expiresAt) ||
    !(run.completedAt === null || isIsoDate(run.completedAt)) ||
    !isUuidV7(run.correlationId) ||
    !Array.isArray(run.results)
  ) {
    throw new Error("INVALID_STORAGE_VERIFICATION_RESPONSE");
  }
  const results = run.results.map((candidate) => {
    const result = asRecord(candidate);
    if (
      !result ||
      !isOneOf(result.principal, PRINCIPALS) ||
      !isOneOf(result.credentialRole, CREDENTIAL_ROLES) ||
      !isOneOf(result.status, ["PASS", "FAIL"] as const) ||
      !isIsoDate(result.verifiedAt)
    ) {
      throw new Error("INVALID_STORAGE_VERIFICATION_RESPONSE");
    }
    return {
      principal: result.principal,
      credentialRole: result.credentialRole,
      status: result.status,
      verifiedAt: result.verifiedAt,
    };
  });
  return {
    id: run.id,
    status: run.status,
    configRevision: run.configRevision,
    bindingRevision: run.bindingRevision,
    readinessRevision: run.readinessRevision,
    probeProfileVersion: run.probeProfileVersion,
    requestedAt: run.requestedAt,
    expiresAt: run.expiresAt,
    completedAt: run.completedAt,
    correlationId: run.correlationId,
    results,
  };
}

function assertUuidV7(value: string, label: string): void {
  if (!UUID_V7.test(value)) throw new Error(`INVALID_${label.toUpperCase().replaceAll(" ", "_")}`);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isUuidV7(value: unknown): value is string {
  return typeof value === "string" && UUID_V7.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOneOf<const T extends readonly string[]>(
  value: unknown,
  values: T,
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isNullableNonNegativeInt(value: unknown): value is number | null {
  return value === null || isNonNegativeInt(value);
}

function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && /^(0|[1-9]\d*)$/.test(value);
}

function isNullableDecimal(value: unknown): value is string | null {
  return value === null || isDecimalString(value);
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isHistoryValue(
  value: unknown,
): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    typeof value === "boolean"
  );
}
