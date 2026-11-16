import { bytesToHex } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { SALES_PUBLISH_RECOVERY_PREFIX, safeSessionStorage } from "@/lib/safeStorage";
import { isUUIDv7 } from "@/lib/uuid";
import type { WriteAttempt } from "@/lib/api/idempotent-write";
import type { publishTemplate } from "../../template-lifecycle-api";
import { record } from "../../../contracts/core-page";

// Keep this browser retry window well inside Core's template idempotency retention.
const RECOVERY_MS = 30 * 60_000;
const MAX_RECORD_BYTES = 256;
type PublishBody = Parameters<typeof publishTemplate>[1];

const hash = (value: string) => bytesToHex(sha256(new TextEncoder().encode(value)));

export function salesPublishRecoveryScope(owner: string, target: string, definitionRevision: number): string {
  return SALES_PUBLISH_RECOVERY_PREFIX + hash(JSON.stringify([owner, target, definitionRevision])) + ":";
}

export function salesPublishRecoveryKey(scope: string, etag: string, body: PublishBody): string {
  return scope + hash(JSON.stringify([etag, body]));
}

export function clearSalesPublishScope(scope: string): void {
  try {
    for (const key of Object.keys(window.sessionStorage)) {
      if (key.startsWith(scope)) safeSessionStorage.removeItem(key);
    }
  } catch {
    // Unavailable browser storage must not interfere with a confirmed receipt.
  }
}

function parseAttempt(raw: string | null) {
  if (!raw || raw.length > MAX_RECORD_BYTES) return null;
  try {
    const data = record(JSON.parse(raw));
    const startedAt = data?.startedAt;
    if (!data || !isUUIDv7(data.idempotencyKey) || typeof startedAt !== "number" ||
      !Number.isSafeInteger(startedAt) || startedAt < 0) return null;
    return { idempotencyKey: data.idempotencyKey, startedAt };
  } catch { return null; }
}

export function isSalesPublishAttemptCurrent(key: string, attempt: WriteAttempt): boolean {
  const stored = parseAttempt(safeSessionStorage.getItem(key));
  const now = Date.now();
  return !!stored && stored.idempotencyKey === attempt.idempotencyKey &&
    stored.startedAt <= now && now - stored.startedAt < RECOVERY_MS;
}

export function retainSalesPublishAttempt(key: string, create: () => WriteAttempt): WriteAttempt | null {
  try {
    const storage = window.sessionStorage;
    const now = Date.now();
    const raw = storage.getItem(key);
    if (raw !== null) {
      const stored = parseAttempt(raw);
      return stored && stored.startedAt <= now && now - stored.startedAt < RECOVERY_MS
        ? { idempotencyKey: stored.idempotencyKey } : null;
    }
    const attempt = create();
    storage.setItem(key, JSON.stringify({ idempotencyKey: attempt.idempotencyKey, startedAt: now }));
    return isSalesPublishAttemptCurrent(key, attempt) ? attempt : null;
  } catch {
    // A failed read may hide the key of a command Core already committed.
    return null;
  }
}
