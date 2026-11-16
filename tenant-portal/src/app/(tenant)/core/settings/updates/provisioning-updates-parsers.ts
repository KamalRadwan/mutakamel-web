import { parseCorePageMeta, type CorePage } from "../../contracts/core-page";
import { isNonEmptyString, isTimestamp, isUuidV7, record } from "../../core-validation";
import {
  RISK_LEVELS,
  SHA256_PATTERN,
  isTenantOperationStatus,
  type ComponentReleaseRisk,
  type TenantAvailableUpdate,
  type TenantProvisioningOperationView,
} from "./provisioning-updates-contract";

interface ApplyProvisioningUpdatesResult {
  replayed: boolean;
  operation: TenantProvisioningOperationView;
}

export function parseProvisioningUpdatesPage(envelope: {
  data: unknown;
  meta: unknown;
}): CorePage<TenantAvailableUpdate> {
  if (!Array.isArray(envelope.data)) {
    throw new Error("Invalid Core provisioning updates response.");
  }
  const items = envelope.data.map(parseAvailableUpdateItem);
  if (new Set(items.map(({ componentKey }) => componentKey)).size !== items.length) {
    throw new Error("Duplicate componentKey in Core provisioning updates response.");
  }
  return {
    items,
    ...parseCorePageMeta(envelope.meta, items.length),
  };
}

function parseAvailableUpdateItem(raw: unknown): TenantAvailableUpdate {
  const row = record(raw);
  const current = row ? record(row.current) : null;
  const available = row ? record(row.availableRelease) : null;
  if (
    !row ||
    !current ||
    !available ||
    !isUuidV7(row.componentId) ||
    !isNonEmptyString(row.componentKey, 96) ||
    !isNonEmptyString(row.ownerApp, 64) ||
    !isNonEmptyString(row.installationState, 64) ||
    typeof row.updateAlreadyPlanned !== "boolean" ||
    !isUuidV7(available.id) ||
    !isNonEmptyString(available.releaseVersion, 120) ||
    typeof available.manifestChecksum !== "string" ||
    !SHA256_PATTERN.test(available.manifestChecksum) ||
    typeof available.riskLevel !== "string" ||
    !RISK_LEVELS.has(available.riskLevel) ||
    typeof available.selfServiceAllowed !== "boolean" ||
    typeof available.requiresBackup !== "boolean" ||
    typeof available.requiresMaintenance !== "boolean"
  ) {
    throw new Error("Invalid Core provisioning update item.");
  }

  return {
    lastOperationId: isUuidV7(row.lastOperationId) ? row.lastOperationId : null,
    componentId: row.componentId,
    componentKey: row.componentKey,
    ownerApp: row.ownerApp,
    installationState: row.installationState,
    current: {
      releaseId: isUuidV7(current.releaseId) ? current.releaseId : null,
      releaseVersion: optionalString(current.releaseVersion, 120),
      schemaVersion: optionalString(current.schemaVersion, 120),
      manifestChecksum:
        typeof current.manifestChecksum === "string" &&
        SHA256_PATTERN.test(current.manifestChecksum)
          ? current.manifestChecksum
          : null,
    },
    desiredReleaseId: isUuidV7(row.desiredReleaseId) ? row.desiredReleaseId : null,
    updateAlreadyPlanned: row.updateAlreadyPlanned,
    availableRelease: {
      id: available.id,
      releaseVersion: available.releaseVersion,
      manifestVersion: optionalVersion(available.manifestVersion, 120),
      schemaTarget: optionalString(available.schemaTarget, 120),
      manifestChecksum: available.manifestChecksum,
      schemaChecksum: optionalString(available.schemaChecksum, 128),
      riskLevel: available.riskLevel as ComponentReleaseRisk,
      selfServiceAllowed: available.selfServiceAllowed,
      requiresBackup: available.requiresBackup,
      requiresMaintenance: available.requiresMaintenance,
      publishedAt: isTimestamp(available.publishedAt) ? available.publishedAt : null,
      compatibilityContractVersion: optionalVersion(available.compatibilityContractVersion, 64),
    },
  };
}

export function parseProvisioningOperationView(
  payload: unknown,
  expectedOperationId?: string,
): TenantProvisioningOperationView {
  const op = record(payload);
  if (
    !op ||
    !isUuidV7(op.id) ||
    !isTenantOperationStatus(op.status) ||
    (expectedOperationId !== undefined && op.id !== expectedOperationId)
  ) {
    throw new Error("Invalid Core provisioning operation response.");
  }
  const nestedError = record(op.safeError);
  return {
    id: op.id,
    status: op.status,
    type: optionalString(op.type, 64),
    currentPhase: optionalString(op.currentPhase, 64),
    safeErrorCode:
      optionalString(nestedError?.code, 128) ?? optionalString(op.safeErrorCode, 128),
    safeErrorMessage:
      optionalString(nestedError?.message, 500) ?? optionalString(op.safeErrorMessage, 500),
    updatedAt: isTimestamp(op.updatedAt) ? op.updatedAt : null,
  };
}

export function parseApplyProvisioningUpdatesResponse(
  payload: unknown,
): ApplyProvisioningUpdatesResult {
  const body = record(payload);
  if (!body || typeof body.replayed !== "boolean") {
    throw new Error("Invalid Core apply provisioning updates response.");
  }
  return {
    replayed: body.replayed,
    operation: parseProvisioningOperationView(body.operation),
  };
}

export function extractAcceptedResponseOperationId(payload: unknown): string | null {
  const body = record(payload);
  const op = body ? record(body.operation) : null;
  if (!op || !isUuidV7(op.id)) {
    return null;
  }
  return op.id;
}

function optionalString(value: unknown, maxLength: number): string | null {
  return isNonEmptyString(value, maxLength) ? value : null;
}

function optionalVersion(value: unknown, maxLength: number): string | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  return optionalString(value, maxLength);
}
