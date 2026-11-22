import { newIdempotencyKey } from '../shared/trade-api';

const pending = new Map<string, string>();

/**
 * One x-idempotency-key per user action. A retry of the same request (same operation, record, version and
 * body) gets the same key, so the backend replays instead of running it twice; any other request gets a new
 * key. Call `done()` once the request succeeded.
 */
export function actionKey(...request: unknown[]): { key: string; done: () => void } {
  const signature = JSON.stringify(request);
  let key = pending.get(signature);
  if (!key) {
    key = newIdempotencyKey();
    pending.set(signature, key);
  }
  return { key, done: () => pending.delete(signature) };
}

/** The part of an uploaded file that identifies it in an action signature. */
export function fileSignature(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
