import { BulkJobSubmit } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { ApiError, errorCodeOf } from '../../../../core/api/api-errors';
import { selectionBranchMismatch } from '../../shared/lookups/selection-branch';
import { sessionBranch } from '../../shared/lookups/session-branch';

/**
 * One Idempotency-Key per submit attempt of a bulk modal. A resend of the same body (for example after a
 * network failure) reuses the key, so the server never creates a second job; a changed body, a new open or
 * a successful submit starts a new key.
 */
export class CustomerBulkSubmitKey {
  private key: string | null = null;
  private fingerprint: string | null = null;
  private mismatch = false;

  for(body: BulkJobSubmit): string {
    if (this.mismatch) throw new ApiError(409, 'GW.IDEM.MISMATCH');
    const branchId = body.scope?.branchId;
    if (!branchId || sessionBranch()?.branchId !== branchId) {
      throw new ApiError(403, 'BRANCH_CONTEXT_REQUIRED');
    }
    if (selectionBranchMismatch(body.selection, branchId)) {
      throw new ApiError(403, 'BRANCH_SCOPE_MISMATCH');
    }
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

  failed(error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'GW.IDEM.MISMATCH' || code?.endsWith('_IDEMPOTENCY_MISMATCH')) this.mismatch = true;
    else if (error instanceof ApiError && error.status !== 401 && error.status !== 0 && error.status < 500 && code !== 'GW.IDEM.IN_FLIGHT') {
      this.key = null;
    }
  }
}
