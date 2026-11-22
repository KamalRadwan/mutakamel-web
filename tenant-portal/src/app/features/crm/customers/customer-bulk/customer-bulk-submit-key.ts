import { BulkJobSubmit } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { newIdempotencyKey } from '../../settings/shared/settings-api';

/**
 * One Idempotency-Key per submit attempt of a bulk modal. A resend of the same body (for example after a
 * network failure) reuses the key, so the server never creates a second job; a changed body, a new open or
 * a successful submit starts a new key.
 */
export class CustomerBulkSubmitKey {
  private key: string | null = null;
  private fingerprint: string | null = null;

  for(body: BulkJobSubmit): string {
    const fingerprint = JSON.stringify(body);
    if (!this.key || this.fingerprint !== fingerprint) {
      this.key = newIdempotencyKey();
      this.fingerprint = fingerprint;
    }
    return this.key;
  }

  reset(): void {
    this.key = null;
    this.fingerprint = null;
  }
}
