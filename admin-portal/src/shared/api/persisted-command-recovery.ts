import { safeSessionStorage } from "@/lib/safeStorage";
import { generateUUIDv7 } from "@/lib/utils/uuid";

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA_256_PATTERN = /^[0-9a-f]{64}$/i;
const ATTEMPT_KEYS = new Set([
  "version",
  "route",
  "idempotencyKey",
  "intentSha256",
  "resource",
  "savedAt",
]);
const RESOURCE_KEYS = new Set(["kind", "id"]);

export interface PersistedCommandResource {
  kind: string;
  id: string;
}

export interface PersistedCommandAttempt {
  version: 1;
  route: string;
  idempotencyKey: string;
  intentSha256: string;
  resource: PersistedCommandResource;
  savedAt: string;
}

export class PendingCommandIntentMismatchError extends Error {
  readonly code = "PENDING_COMMAND_INTENT_MISMATCH";

  constructor(readonly attempt: PersistedCommandAttempt) {
    super(
      "Resolve the pending command outcome or re-enter the exact original values before sending another command.",
    );
    this.name = "PendingCommandIntentMismatchError";
  }
}

export function readPersistedCommandAttempt(
  storageKey: string,
  expectedRoute: string,
): PersistedCommandAttempt | null {
  const value = safeSessionStorage.getItem(storageKey);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<PersistedCommandAttempt>;
    const resource = parsed.resource as Partial<PersistedCommandResource> | undefined;
    if (
      parsed.version !== 1 ||
      !hasOnlyKeys(parsed as Record<string, unknown>, ATTEMPT_KEYS) ||
      parsed.route !== expectedRoute ||
      typeof parsed.idempotencyKey !== "string" ||
      !UUID_V7_PATTERN.test(parsed.idempotencyKey) ||
      typeof parsed.intentSha256 !== "string" ||
      !SHA_256_PATTERN.test(parsed.intentSha256) ||
      !resource ||
      !hasOnlyKeys(resource as Record<string, unknown>, RESOURCE_KEYS) ||
      typeof resource.kind !== "string" ||
      !/^[A-Z][A-Z0-9_]{1,63}$/.test(resource.kind) ||
      typeof resource.id !== "string" ||
      resource.id.length < 1 ||
      resource.id.length > 128 ||
      typeof parsed.savedAt !== "string" ||
      Number.isNaN(Date.parse(parsed.savedAt))
    ) {
      return null;
    }

    return parsed as PersistedCommandAttempt;
  } catch {
    return null;
  }
}

export async function preparePersistedCommandAttempt({
  storageKey,
  route,
  intent,
  resource,
}: {
  storageKey: string;
  route: string;
  intent: unknown;
  resource: PersistedCommandResource;
}): Promise<PersistedCommandAttempt> {
  const intentSha256 = await sha256CanonicalJson(intent);
  const existing = readPersistedCommandAttempt(storageKey, route);
  if (existing) {
    if (existing.intentSha256 !== intentSha256) {
      throw new PendingCommandIntentMismatchError(existing);
    }
    return existing;
  }

  const attempt: PersistedCommandAttempt = {
    version: 1,
    route,
    idempotencyKey: generateUUIDv7(),
    intentSha256,
    resource,
    savedAt: new Date().toISOString(),
  };
  safeSessionStorage.setItem(storageKey, JSON.stringify(attempt));
  const persisted = readPersistedCommandAttempt(storageKey, route);
  if (
    !persisted ||
    persisted.idempotencyKey !== attempt.idempotencyKey ||
    persisted.intentSha256 !== attempt.intentSha256
  ) {
    throw new Error("COMMAND_RECOVERY_STORAGE_UNAVAILABLE");
  }
  return attempt;
}

export function clearPersistedCommandAttempt(storageKey: string): void {
  safeSessionStorage.removeItem(storageKey);
}

export async function sha256CanonicalJson(value: unknown): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("COMMAND_RECOVERY_DIGEST_UNAVAILABLE");
  }
  const serialized = JSON.stringify(canonicalize(value));
  if (serialized === undefined) {
    throw new Error("COMMAND_RECOVERY_INTENT_NOT_SERIALIZABLE");
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(serialized),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        const next = (value as Record<string, unknown>)[key];
        if (
          next !== undefined &&
          typeof next !== "function" &&
          typeof next !== "symbol"
        ) {
          result[key] = canonicalize(next);
        }
        return result;
      }, {});
  }
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}
