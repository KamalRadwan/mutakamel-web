import { signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { isRetryableWriteError, writeErrorMessage } from '../../../../core/api/api-errors';
import { BULK_JOB_LIMITS, BulkJobSelection, BulkJobSubmit } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { ApiError, crmSettingsError } from '../../settings/shared/settings-api';
import { sessionBranch } from '../../shared/lookups/session-branch';
import { selectionBranchMismatch } from '../../shared/lookups/selection-branch';

export { selectionBranchMismatch } from '../../shared/lookups/selection-branch';

const MAX_FMT = new Intl.NumberFormat('en-US', { useGrouping: true });

/**
 * One idempotency key per modal submission. A retry of the same body reuses the key so
 * the backend replays the first job instead of creating a second one; a changed body
 * (other owner, stage, reason, selection) gets a fresh key.
 */
export class LeadBulkSubmitKey {
  readonly blocked = signal(false);
  private key: string | null = null;
  private fingerprint: string | null = null;

  for(body: BulkJobSubmit): string {
    if (this.blocked()) throw new Error('Reload the bulk form before submitting again');
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
    this.blocked.set(false);
  }

  failed(error: unknown): void {
    const code = error instanceof ApiError ? error.code : '';
    if (code === 'GW.IDEM.MISMATCH' || code.endsWith('_IDEMPOTENCY_MISMATCH') ||
        crmSettingsError((key) => key, error, 'leadBulk').readOnly) {
      this.blocked.set(true);
    }
    if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) {
      this.key = null;
      this.fingerprint = null;
    }
  }
}

/** Translation params for a bulk error: `max` comes from `details.max`, a decimal string array (['10000']). */
export function leadBulkErrorParams(error: unknown): { max: string } {
  const raw = error instanceof ApiError ? error.details?.['max'] : undefined;
  const parsed = Array.isArray(raw) ? Number(raw[0]) : NaN;
  const value = Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : BULK_JOB_LIMITS.maxItems;
  return { max: MAX_FMT.format(value) };
}

/** A stale modal or a QUERY from another branch must never reach the tracker. */
export function leadBulkPrecheck(selection: BulkJobSelection, branchId: string): string | null {
  const scope = sessionBranch();
  if (!scope) return 'BRANCH_REQUIRED';
  return scope.branchId !== branchId || selectionBranchMismatch(selection, branchId) ? 'BRANCH_SCOPE_MISMATCH' : null;
}

export function leadBulkErrorMessage(transloco: TranslocoService, error: unknown): string {
  // Probe loaded dictionaries without emitting missing-translation warnings for unrelated codes.
  const translate = (key: string, params?: Record<string, unknown>): string => {
    const dictionary = transloco.getTranslation(transloco.getActiveLang());
    const value = dictionary[key] ?? key.split('.').reduce<unknown>((node, part) =>
      node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined, dictionary);
    return typeof value === 'string' ? transloco.translate(key, params) : key;
  };
  if (error instanceof ApiError && error.status !== 401) {
    if (error.code === 'GW.IDEM.MISMATCH' || error.code.endsWith('_IDEMPOTENCY_MISMATCH')) {
      return translate('apiErrors.idempotencyMismatch');
    }
    if (['CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY'].includes(error.code)) {
      return translate('apiErrors.subscription');
    }
    if (error.status === 429) {
      const raw = error.details?.['retryAfterSeconds'];
      const seconds = Array.isArray(raw) ? raw[0] : null;
      if (seconds) return translate('apiErrors.rateLimitedIn', { seconds });
    }
    for (const prefix of ['leadBulk.codes.', 'bulkAct.codes.', 'bulkJobs.codes.']) {
      const key = `${prefix}${error.code}`;
      const message = translate(key, leadBulkErrorParams(error));
      if (message !== key) return message;
    }
  }
  const mapped = crmSettingsError(translate, error, 'leadBulk');
  return error instanceof ApiError && error.status === 401 ? writeErrorMessage(error, 'leadBulk', translate) : mapped.message;
}

export function leadBulkLoadError(transloco: TranslocoService, error: unknown) {
  return { ...crmSettingsError((key) => key, error, 'leadBulk'), message: leadBulkErrorMessage(transloco, error) };
}

export function leadBulkValidationFields(error: unknown): string[] {
  if (!(error instanceof ApiError) || !['CRM_VALIDATION_FAILED', 'BULK_JOB_PARAMS_INVALID'].includes(error.code)) return [];
  const raw = error.details?.['field'];
  const fields = [...Object.keys(error.details ?? {}).filter((key) => key !== 'field'),
    ...(typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw.filter((key): key is string => typeof key === 'string') : [])];
  return fields.map((path) => path.replace(/^params\./, '').replace(/^(activity|schedule)\./, ''));
}
