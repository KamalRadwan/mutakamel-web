import type { NormalizedApiError } from "@/lib/api/errors";
import { classifyApiOutcome } from "@/lib/api/outcomes";
import { generateUUIDv7 } from "@/lib/uuid";

export interface AmbiguousMutationState {
  intentName: string;
  operation: string;
  idempotencyKey: string;
  correlationId?: string;
  retry: () => Promise<boolean> | void;
}

export interface StaleConflictSnapshot<TDraft, TServer> {
  retainedDraft: TDraft;
  latestServer: TServer | null;
}

export function isAmbiguousWriteError(error: NormalizedApiError): boolean {
  return error.status === 0 || error.code === "CLIENT_REQUEST_TIMEOUT" ||
    classifyApiOutcome(error) === "idempotencyProcessing";
}

export function isStaleVersionError(error: NormalizedApiError): boolean {
  return (
    error.status === 409 &&
    error.code === "TRADE.CONCURRENCY.STALE_VERSION"
  );
}

/**
 * Mints one UUIDv7 per logical write intent and retains that exact key across
 * network timeouts or `GW.IDEM.IN_FLIGHT` / `IDEMPOTENCY_REQUEST_PROCESSING`
 * responses so retrying replays safely instead of creating a duplicate write.
 */
export function resolveIntentIdempotencyKey(
  store: Map<string, string>,
  intentSignature: string,
): string {
  const existing = store.get(intentSignature);
  if (existing) return existing;
  const created = generateUUIDv7();
  store.set(intentSignature, created);
  return created;
}

export function clearIntentIdempotencyKey(
  store: Map<string, string>,
  intentSignature: string,
): void {
  store.delete(intentSignature);
}
