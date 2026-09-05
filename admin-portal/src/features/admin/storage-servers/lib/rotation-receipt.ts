import { safeStorage } from "@/lib/safeStorage";
import type { StorageCredentialRotationView } from "../types";

/**
 * Durable handle on an in-progress safe credential rotation.
 *
 * Starting a rotation returns a receipt naming the rotation record. Revoking
 * the old key needs that record's id, and cannot happen until the grace
 * window closes — between one and twenty-four hours later. Core exposes no
 * read route for rotations and the storage-server projection carries none of
 * this, so the receipt from the POST is the only handle that exists.
 *
 * Holding it in React state alone meant a reload, a navigation away and back,
 * or simply coming back after the grace window it was waiting out lost it,
 * and with it the portal's only way to finish the rotation: the server
 * refuses to revoke without the record's id, and rejects it before the grace
 * expires. The rotation stayed open, counted as overdue, and had to be
 * completed outside the portal.
 *
 * So the handle is written to this browser, in the same shape the recovery
 * marker for a pending command uses: a narrow, explicitly listed projection,
 * validated on the way back in, verified by reading back what was written.
 *
 * Nothing secret is stored. The rotation view is secret-free by construction
 * — Core never returns key material — and this narrows it further, to the
 * record's identity, its lifecycle status, and the two timestamps the card
 * shows. The new access key, the old one, and the reason are not part of it.
 * This is a browser-local stopgap and it is scoped like one: it survives a
 * reload on this machine and nothing more. The durable answer is a rotation
 * projection on the storage-server read route.
 */
export interface StorageCredentialRotationReceipt {
  version: 1;
  storageServerId: string;
  rotationId: string;
  status: "STAGED" | "ACTIVATED" | "REVOKED";
  graceExpiresAt: string | null;
  revokedAt: string | null;
  /** When this browser wrote the receipt, for retention only. */
  savedAt: string;
}

export interface RememberedStorageRotation {
  receipt: StorageCredentialRotationReceipt;
  /**
   * Whether this browser actually kept the receipt. A private window with
   * storage disabled, or a full quota, leaves the receipt in memory only —
   * and the operator has to be told, because then the old rule still holds:
   * finish the revoke from this page or lose the handle.
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
const STATUSES = new Set(["STAGED", "ACTIVATED", "REVOKED"]);
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
    if (parsed.status === "REVOKED") {
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

  if (receipt.status === "REVOKED") {
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
