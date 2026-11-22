import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { BULK_JOB_LIMITS, BulkJobSelection, BulkJobSubmit } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { ApiError } from '../../settings/shared/settings-api';

const MAX_FMT = new Intl.NumberFormat('en-US', { useGrouping: true });

/**
 * One idempotency key per modal submission. A retry of the same body reuses the key so
 * the backend replays the first job instead of creating a second one; a changed body
 * (other owner, stage, reason, selection) gets a fresh key.
 */
export class LeadBulkSubmitKey {
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

/** Translation params for a bulk error: `max` comes from `details.max`, a decimal string array (['10000']). */
export function leadBulkErrorParams(error: unknown): { max: string } {
  const raw = error instanceof ApiError ? error.details?.['max'] : undefined;
  const parsed = Array.isArray(raw) ? Number(raw[0]) : NaN;
  const value = Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : BULK_JOB_LIMITS.maxItems;
  return { max: MAX_FMT.format(value) };
}

/** True when a QUERY selection searches a branch other than the job scope (the backend refuses it). */
export function selectionBranchMismatch(selection: BulkJobSelection, branchId: string): boolean {
  if (selection.kind !== 'QUERY') return false;
  const query = selection.query as { search?: { branchId?: unknown } } | null | undefined;
  return query?.search?.branchId !== branchId;
}
