import { newIdempotencyKey } from '../../shared/trade-api';
import { stableStringify } from '../automation-fake-actors';

/**
 * Holds one X-Idempotency-Key per user action. A retry of the same request reuses the key,
 * so the backend replays instead of acting twice; a changed request (body or If-Match) or a
 * finished action gets a new key.
 */
export class ActionKeys {
  private readonly pending = new Map<string, { fingerprint: string; key: string }>();

  for(action: string, request: unknown): string {
    const fingerprint = stableStringify(request);
    const held = this.pending.get(action);
    if (held && held.fingerprint === fingerprint) return held.key;
    const key = newIdempotencyKey();
    this.pending.set(action, { fingerprint, key });
    return key;
  }

  done(action: string): void {
    this.pending.delete(action);
  }
}
