import { generateUUIDv7 } from "@/lib/utils/uuid";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

interface IntentEntry {
  fingerprint: string;
  key: string;
}

export interface TenantIntentKeyStore {
  get(scope: string, intent: unknown): string;
  clear(scope: string): void;
  clearAll(): void;
}

export function createTenantIntentKeyStore(
  generate: () => string = generateUUIDv7,
): TenantIntentKeyStore {
  const entries = new Map<string, IntentEntry>();
  return {
    get(scope, intent) {
      const fingerprint = stableSerialize(intent);
      const existing = entries.get(scope);
      if (existing?.fingerprint === fingerprint) return existing.key;
      const key = generate();
      entries.set(scope, { fingerprint, key });
      return key;
    },
    clear(scope) {
      entries.delete(scope);
    },
    clearAll() {
      entries.clear();
    },
  };
}

export function shouldRetainTenantIntentKey(
  error: Pick<NormalizedApiError, "httpStatus" | "errorCode">,
): boolean {
  return (
    error.httpStatus >= 500 ||
    error.httpStatus === 401 ||
    error.httpStatus === 429 ||
    error.errorCode === "GW.IDEM.IN_FLIGHT"
  );
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
    .join(",")}}`;
}
