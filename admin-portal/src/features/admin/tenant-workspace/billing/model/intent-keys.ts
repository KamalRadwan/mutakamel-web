import { generateUUIDv7 } from "@/lib/utils/uuid";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

export interface BillingIntentKeyStore {
  get(scope: string, fingerprint: string): string;
  clear(scope: string): void;
  clearAll(): void;
}

export function createBillingIntentKeyStore(
  generate: () => string = generateUUIDv7,
): BillingIntentKeyStore {
  const entries = new Map<string, { fingerprint: string; key: string }>();
  return {
    get(scope, fingerprint) {
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

export function stableFingerprint(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function shouldRetainBillingIntentKey(
  error: Pick<NormalizedApiError, "httpStatus" | "errorCode">,
): boolean {
  return (
    error.httpStatus >= 500 ||
    error.httpStatus === 401 ||
    error.httpStatus === 429 ||
    error.errorCode === "GW.IDEM.IN_FLIGHT"
  );
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortValue(item)]),
  );
}
