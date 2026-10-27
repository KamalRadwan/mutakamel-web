import { safeStorage } from "@/lib/safeStorage";
import type { StorageCredentialRotationView } from "../types";

/**
 * Safe temporary cache of an open rotation's identity and display timestamps.
 * Core's current-rotation read is authoritative before recovery actions.
 * Credentials, request bodies and audit reasons are never persisted here.
 * Terminal revoked/aborted handles are retired immediately.
 */
export interface StorageCredentialRotationReceipt {
  version: 1;
  storageServerId: string;
  rotationId: string;
  status: "STAGED" | "ACTIVATED" | "REVOKED" | "ABORTED";
  graceExpiresAt: string | null;
  revokedAt: string | null;
  /** When this browser wrote the receipt, for retention only. */
  savedAt: string;
}

export interface RememberedStorageRotation {
  receipt: StorageCredentialRotationReceipt;
  /**
   * Whether this browser kept the optional display cache. Recovery remains
   * available from Core even when local storage is disabled or full.
   */
  durable: boolean;
}

const KEY_PREFIX = "admin_storage_rotation_receipt:";
const RECEIPT_KEYS = new Set([
  "version",
  "storageServerId",
  "rotationId",
  "status",
  "graceExpiresAt",
  "revokedAt",
  "savedAt",
]);
const STATUSES = new Set(["STAGED", "ACTIVATED", "REVOKED", "ABORTED"]);
/**
 * A grace window is at most twenty-four hours, so a receipt older than a
 * month is not evidence about anything still open — it is a record of a
 * rotation that was completed elsewhere, or abandoned.
 */
const RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

function storageKey(storageServerId: string): string {
  return `${KEY_PREFIX}${storageServerId}`;
}

export function readStorageRotationReceipt(
  storageServerId: string,
  now = Date.now(),
): StorageCredentialRotationReceipt | null {
  if (!storageServerId) return null;
  const value = safeStorage.getItem(storageKey(storageServerId));
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<StorageCredentialRotationReceipt>;
    const savedAt = typeof parsed.savedAt === "string" ? Date.parse(parsed.savedAt) : Number.NaN;
    if (
      parsed.version !== 1 ||
      !hasOnlyKeys(parsed as Record<string, unknown>, RECEIPT_KEYS) ||
      parsed.storageServerId !== storageServerId ||
      typeof parsed.rotationId !== "string" ||
      parsed.rotationId.length < 1 ||
      parsed.rotationId.length > 128 ||
      typeof parsed.status !== "string" ||
      !STATUSES.has(parsed.status) ||
      !isTimestampOrNull(parsed.graceExpiresAt) ||
      !isTimestampOrNull(parsed.revokedAt) ||
      Number.isNaN(savedAt) ||
      now - savedAt > RETENTION_MS
    ) {
      forgetStorageRotationReceipt(storageServerId);
      return null;
    }
    // A revoked rotation is finished; it has no action left to recover.
    if (parsed.status === "REVOKED" || parsed.status === "ABORTED") {
      forgetStorageRotationReceipt(storageServerId);
      return null;
    }
    return parsed as StorageCredentialRotationReceipt;
  } catch {
    forgetStorageRotationReceipt(storageServerId);
    return null;
  }
}

export function rememberStorageRotation(
  storageServerId: string,
  rotation: StorageCredentialRotationView,
  now = Date.now(),
): RememberedStorageRotation {
  const receipt: StorageCredentialRotationReceipt = {
    version: 1,
    storageServerId,
    rotationId: rotation.id,
    status: rotation.status,
    graceExpiresAt: rotation.graceExpiresAt,
    revokedAt: rotation.revokedAt,
    savedAt: new Date(now).toISOString(),
  };

  if (receipt.status === "REVOKED" || receipt.status === "ABORTED") {
    // Nothing left to recover, and nothing left to keep.
    forgetStorageRotationReceipt(storageServerId);
    return { receipt, durable: true };
  }

  safeStorage.setItem(storageKey(storageServerId), JSON.stringify(receipt));
  const persisted = readStorageRotationReceipt(storageServerId, now);
  return {
    receipt,
    durable: persisted?.rotationId === receipt.rotationId,
  };
}

export function forgetStorageRotationReceipt(storageServerId: string): void {
  if (!storageServerId) return;
  safeStorage.removeItem(storageKey(storageServerId));
}

function isTimestampOrNull(value: unknown): boolean {
  if (value === null) return true;
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}
