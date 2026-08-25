import { generateUUIDv7 } from "@/lib/utils/uuid";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

export function createReleaseIntentStore(generate: () => string = generateUUIDv7) {
  const intents = new Map<string, { fingerprint: string; key: string }>();
  return {
    get(scope: string, fingerprint: string) {
      const current = intents.get(scope);
      if (current?.fingerprint === fingerprint) return current.key;
      const key = generate();
      intents.set(scope, { fingerprint, key });
      return key;
    },
    clear(scope: string) {
      intents.delete(scope);
    },
    clearAll() {
      intents.clear();
    },
  };
}

export function stableReleaseFingerprint(value: unknown): string {
  return JSON.stringify(sort(value));
}

export function shouldRetainReleaseIntent(
  error: Pick<NormalizedApiError, "httpStatus" | "errorCode">,
): boolean {
  return (
    error.httpStatus >= 500 ||
    error.httpStatus === 401 ||
    error.httpStatus === 429 ||
    error.errorCode === "GW.IDEM.IN_FLIGHT"
  );
}

function sort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sort);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sort(child)]),
  );
}
