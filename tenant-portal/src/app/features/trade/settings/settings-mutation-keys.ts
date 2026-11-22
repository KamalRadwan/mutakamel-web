import { newIdempotencyKey } from '../../../core/api/idempotency';

/**
 * One Idempotency-Key per user action in trade settings. An action is named by its operation
 * (`create`, `update:<id>`, `delete:<id>`, `make-default:<id>`); a retry of the same operation with
 * the same request (body and If-Match version) reuses the key, so the server replays the first result.
 * A changed request starts a new key; a success clears the operation.
 */
export class SettingsMutationKeys {
  private readonly keys = new Map<string, { key: string; fingerprint: string }>();

  for(operation: string, request: unknown): string {
    const fingerprint = JSON.stringify(request) ?? '';
    const current = this.keys.get(operation);
    if (current && current.fingerprint === fingerprint) return current.key;
    const key = newIdempotencyKey();
    this.keys.set(operation, { key, fingerprint });
    return key;
  }

  clear(operation: string): void {
    this.keys.delete(operation);
  }

  clearAll(): void {
    this.keys.clear();
  }
}
