import { newIdempotencyKey } from '../../shared/trade-api';

/** What a document flow needs to stamp each request with its x-idempotency-key. */
export interface RequestKeySource {
  /** The key for one request slot (for example "send" or "updateSalesOrder") with this id, version and body. */
  for(slot: string, request: unknown): string;
}

/**
 * One x-idempotency-key per user action, per request slot. A resend of the same request (same slot and the
 * same id, version and body, for example after a network failure) reuses the key, so the server replays the
 * first answer instead of applying the action twice. A changed request gets a new key, and reset() (after a
 * success) forgets every key so the next user action starts fresh.
 */
export class DocumentRequestKeys implements RequestKeySource {
  private readonly slots = new Map<string, { key: string; fingerprint: string }>();

  constructor(private readonly newKey: () => string = newIdempotencyKey) {}

  for(slot: string, request: unknown): string {
    const fingerprint = JSON.stringify(request) ?? '';
    const current = this.slots.get(slot);
    if (current && current.fingerprint === fingerprint) {
      return current.key;
    }
    const key = this.newKey();
    this.slots.set(slot, { key, fingerprint });
    return key;
  }

  reset(): void {
    this.slots.clear();
  }
}
