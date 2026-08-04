export const BACKUP_NON_IDEMPOTENT_GUARD_STORAGE_KEY =
  "mutakamel.admin.backup.non-idempotent-command.v1";
export const BACKUP_NON_IDEMPOTENT_GUARD_CHANGE_EVENT =
  "mutakamel:backup-non-idempotent-guard-change";

export type BackupNonIdempotentCommandKind =
  | "BACKUP_START"
  | "RESTORE_START"
  | "RESTORE_PROMOTE";

export type BackupNonIdempotentCommandStatus = "IN_FLIGHT" | "UNKNOWN";

export interface BackupNonIdempotentCommandAttempt {
  kind: BackupNonIdempotentCommandKind;
  targetId: string;
  issuedAt: string;
  localCommandId: string;
  status: BackupNonIdempotentCommandStatus;
}

const allowedKeys = new Set([
  "kind",
  "targetId",
  "issuedAt",
  "localCommandId",
  "status",
]);
const commandKinds = new Set<BackupNonIdempotentCommandKind>([
  "BACKUP_START",
  "RESTORE_START",
  "RESTORE_PROMOTE",
]);
const commandStatuses = new Set<BackupNonIdempotentCommandStatus>([
  "IN_FLIGHT",
  "UNKNOWN",
]);
const uuidV7Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseBackupNonIdempotentCommandAttempt(
  serialized: string | null,
): BackupNonIdempotentCommandAttempt | null {
  if (serialized === null) return null;
  if (serialized.length === 0 || serialized.length > 1_000) {
    throw new Error("Stored backup command guard is invalid.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Stored backup command guard is invalid.");
  }
  if (!isPlainRecord(parsed)) {
    throw new Error("Stored backup command guard is invalid.");
  }
  const keys = Object.keys(parsed);
  if (keys.length !== allowedKeys.size || keys.some((key) => !allowedKeys.has(key))) {
    throw new Error("Stored backup command guard contains unsupported data.");
  }

  const { kind, targetId, issuedAt, localCommandId, status } = parsed;
  if (
    !commandKinds.has(kind as BackupNonIdempotentCommandKind) ||
    typeof targetId !== "string" ||
    !uuidV7Pattern.test(targetId) ||
    typeof localCommandId !== "string" ||
    !uuidV7Pattern.test(localCommandId) ||
    typeof issuedAt !== "string" ||
    !isIsoTimestamp(issuedAt) ||
    !commandStatuses.has(status as BackupNonIdempotentCommandStatus)
  ) {
    throw new Error("Stored backup command guard is invalid.");
  }

  return {
    kind: kind as BackupNonIdempotentCommandKind,
    targetId,
    issuedAt,
    localCommandId,
    status: status as BackupNonIdempotentCommandStatus,
  };
}

export function readBackupNonIdempotentCommandAttempt(
  storage: Pick<Storage, "getItem">,
): BackupNonIdempotentCommandAttempt | null {
  return parseBackupNonIdempotentCommandAttempt(
    storage.getItem(BACKUP_NON_IDEMPOTENT_GUARD_STORAGE_KEY),
  );
}

export function writeBackupNonIdempotentCommandAttempt(
  storage: Pick<Storage, "setItem">,
  attempt: BackupNonIdempotentCommandAttempt,
): void {
  storage.setItem(
    BACKUP_NON_IDEMPOTENT_GUARD_STORAGE_KEY,
    JSON.stringify(attempt),
  );
}

export function markBackupNonIdempotentCommandUnknown(
  storage: Pick<Storage, "getItem" | "setItem">,
  localCommandId: string,
): BackupNonIdempotentCommandAttempt | null {
  const current = readBackupNonIdempotentCommandAttempt(storage);
  if (!current || current.localCommandId !== localCommandId) return current;
  const unknownAttempt = { ...current, status: "UNKNOWN" as const };
  writeBackupNonIdempotentCommandAttempt(storage, unknownAttempt);
  return unknownAttempt;
}

export function clearBackupNonIdempotentCommandAttempt(
  storage: Pick<Storage, "getItem" | "removeItem">,
  localCommandId: string,
): boolean {
  const current = readBackupNonIdempotentCommandAttempt(storage);
  if (!current || current.localCommandId !== localCommandId) return false;
  storage.removeItem(BACKUP_NON_IDEMPOTENT_GUARD_STORAGE_KEY);
  return true;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

function isIsoTimestamp(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}
