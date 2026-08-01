import type {
  CreateStorageServerDto,
  StorageApiError,
  StorageServerAdminView,
  StorageServerDraft,
  UpdateStorageServerDto,
} from "@/types/storage-server";
import {
  storageEndpointIssue,
  type StorageEndpointKind,
} from "./storage-endpoint-policy";

const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const WRITABLE_FIELDS = [
  "name",
  "internalEndpoint",
  "publicEndpoint",
  "region",
  "placementRole",
  "desiredNodeCount",
  "desiredZoneCount",
  "requiredReplicationFactor",
  "maxTenants",
  "warningPercent",
  "criticalPercent",
] as const satisfies readonly (keyof StorageServerDraft)[];

type FieldErrors = Partial<Record<keyof CreateStorageServerDto, string>>;

export function toStorageServerDraft(
  server: StorageServerAdminView,
): StorageServerDraft {
  return {
    name: server.name,
    internalEndpoint: server.internalEndpoint,
    publicEndpoint: server.publicEndpoint,
    region: server.region,
    placementRole: server.placementRole,
    desiredNodeCount: server.desiredNodeCount,
    desiredZoneCount: server.desiredZoneCount,
    requiredReplicationFactor: server.requiredReplicationFactor,
    maxTenants: server.maxTenants,
    warningPercent: server.warningPercent,
    criticalPercent: server.criticalPercent,
  };
}

export function buildStorageServerUpdate(
  server: StorageServerAdminView,
  draft: StorageServerDraft,
): UpdateStorageServerDto {
  const current = toStorageServerDraft(server);
  const update: UpdateStorageServerDto = {};

  for (const field of WRITABLE_FIELDS) {
    if (draft[field] !== current[field]) {
      Object.assign(update, { [field]: draft[field] });
    }
  }

  return update;
}

export function validateStorageServerDraft(
  draft: StorageServerDraft,
  code?: string,
): FieldErrors {
  const errors: FieldErrors = {};
  const normalizedCode = code?.trim().toLowerCase();

  if (normalizedCode !== undefined && !DNS_LABEL.test(normalizedCode)) {
    errors.code = "Use a lowercase DNS label with 1–63 letters, numbers, or hyphens.";
  }
  if (!draft.name.trim() || draft.name.trim().length > 120) {
    errors.name = "Enter a name between 1 and 120 characters.";
  }
  if (!draft.region.trim() || draft.region.trim().length > 63) {
    errors.region = "Enter a region between 1 and 63 characters.";
  }

  const internalError = validateEndpoint(draft.internalEndpoint, "internal");
  if (internalError) errors.internalEndpoint = internalError;
  const publicError = validateEndpoint(draft.publicEndpoint, "public");
  if (publicError) errors.publicEndpoint = publicError;

  for (const field of [
    "desiredNodeCount",
    "desiredZoneCount",
    "requiredReplicationFactor",
  ] as const) {
    if (!Number.isInteger(draft[field]) || draft[field] < 1 || draft[field] > 64) {
      errors[field] = "Enter a whole number from 1 to 64.";
    }
  }
  if (
    !Number.isInteger(draft.maxTenants) ||
    draft.maxTenants < 0 ||
    draft.maxTenants > 1_000_000
  ) {
    errors.maxTenants = "Enter a whole number from 0 to 1,000,000.";
  }
  if (
    !Number.isInteger(draft.warningPercent) ||
    draft.warningPercent < 1 ||
    draft.warningPercent > 98
  ) {
    errors.warningPercent = "Enter a whole percentage from 1 to 98.";
  }
  if (
    !Number.isInteger(draft.criticalPercent) ||
    draft.criticalPercent < 2 ||
    draft.criticalPercent > 99
  ) {
    errors.criticalPercent = "Enter a whole percentage from 2 to 99.";
  }
  if (draft.desiredZoneCount > draft.desiredNodeCount) {
    errors.desiredZoneCount = "Zone count cannot exceed node count.";
  }
  if (draft.requiredReplicationFactor > draft.desiredNodeCount) {
    errors.requiredReplicationFactor = "Replication factor cannot exceed node count.";
  }
  if (draft.warningPercent >= draft.criticalPercent) {
    errors.criticalPercent = "Critical capacity must be greater than warning capacity.";
  }
  if (draft.placementRole === "BACKUP_ONLY" && draft.maxTenants !== 0) {
    errors.maxTenants = "Backup-only storage cannot accept tenant placement.";
  }

  return errors;
}

function validateEndpoint(
  value: string,
  kind: StorageEndpointKind,
): string | undefined {
  const issue = storageEndpointIssue(value, kind);
  if (issue === "PUBLIC_HTTPS_REQUIRED") {
    return "Public endpoints must use HTTPS.";
  }
  if (issue === "INTERNAL_PROTOCOL") {
    return "Use an HTTP or HTTPS endpoint.";
  }
  if (issue === "ORIGIN_COMPONENTS_NOT_ALLOWED") {
    return "Credentials, paths, query strings, and fragments are not allowed.";
  }
  if (issue === "PRIVATE_HTTP_HOST_REQUIRED") {
    return "Plain-HTTP internal endpoints require localhost, loopback, or an RFC1918 IPv4 literal.";
  }
  if (issue === "INVALID_ORIGIN") {
    return "Enter a valid absolute URL origin.";
  }
}

export function formatStorageBytes(value: string | null): string {
  if (value === null) return "Unavailable";
  try {
    const bytes = BigInt(value);
    const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
    let divisor = BigInt(1);
    let unit = 0;
    while (unit < units.length - 1 && bytes >= divisor * BigInt(1024)) {
      divisor *= BigInt(1024);
      unit += 1;
    }
    const whole = bytes / divisor;
    const tenth = ((bytes % divisor) * BigInt(10)) / divisor;
    return `${whole.toString()}${tenth > BigInt(0) ? `.${tenth.toString()}` : ""} ${units[unit]}`;
  } catch {
    return "Unavailable";
  }
}

export function storageCapacityPercent(
  used: string | null,
  usable: string | null,
): number | null {
  if (used === null || usable === null) return null;
  try {
    const usedBytes = BigInt(used);
    const usableBytes = BigInt(usable);
    if (usableBytes <= BigInt(0) || usedBytes < BigInt(0)) return null;
    return Number((usedBytes * BigInt(10_000)) / usableBytes) / 100;
  } catch {
    return null;
  }
}

export function normalizeStorageApiError(error: unknown): StorageApiError {
  const candidate = error as {
    message?: unknown;
    response?: {
      status?: unknown;
      data?: {
        message?: unknown;
        errorCode?: unknown;
        code?: unknown;
        correlationId?: unknown;
        details?: unknown;
        errors?: unknown;
      };
    };
  };
  const data = candidate.response?.data;
  const status =
    typeof candidate.response?.status === "number"
      ? candidate.response.status
      : undefined;
  const rawMessage = data?.message ?? candidate.message;
  const message = Array.isArray(rawMessage)
    ? rawMessage.filter((item): item is string => typeof item === "string").join(" ")
    : typeof rawMessage === "string"
      ? rawMessage
      : "The storage request could not be completed.";
  const details =
    data?.details && typeof data.details === "object"
      ? data.details
      : data?.errors && typeof data.errors === "object"
        ? data.errors
        : {};
  const fieldErrors = Object.fromEntries(
    Object.entries(details as Record<string, unknown>).flatMap(([field, value]) => {
      if (typeof value === "string") return [[field, value]];
      if (Array.isArray(value)) {
        const text = value.filter((item): item is string => typeof item === "string").join(" ");
        return text ? [[field, text]] : [];
      }
      return [];
    }),
  );

  return {
    status,
    code:
      typeof data?.errorCode === "string"
        ? data.errorCode
        : typeof data?.code === "string"
          ? data.code
          : "STORAGE_REQUEST_FAILED",
    message,
    correlationId:
      typeof data?.correlationId === "string" ? data.correlationId : undefined,
    fieldErrors,
    ambiguous: status === undefined || status === 408 || status >= 500,
  };
}

export function storageTenantSlots(server: StorageServerAdminView): number {
  return server.currentTenants + server.retainedTenants + server.reservedTenants;
}

export function hasNoVisibleStorageAllocations(
  server: StorageServerAdminView,
): boolean {
  return (
    storageTenantSlots(server) === 0 &&
    server.activeReservedCapacityBytes === "0"
  );
}

export function canEditStorageServer(server: StorageServerAdminView): boolean {
  return (
    (server.status === "DRAFT" || server.status === "OFFLINE") &&
    hasNoVisibleStorageAllocations(server)
  );
}
