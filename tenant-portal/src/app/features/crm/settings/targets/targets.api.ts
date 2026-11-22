import { TranslocoService } from '@jsverse/transloco';
import {
  ApiError,
  FlatPage,
  InfoPage,
  errorCodeOf,
} from '../../../../shared/widgets/dashboard/analytics-api';
import { errorKey } from '../../../../shared/widgets/dashboard/panel-state';
import {
  fakeApproveTarget,
  fakeCorrectTarget,
  fakeCreateTarget,
  fakeDeleteTarget,
  fakeGetTarget,
  fakeListReleases,
  fakeListTargets,
  fakeRejectTarget,
  fakeSubmitTarget,
  fakeTargetableMetrics,
  fakeUpdateTarget,
} from './targets.fake';
import {
  ApproveTargetBody,
  CorrectTargetBody,
  CreateTargetBody,
  ListTargetsQuery,
  RejectTargetBody,
  SalesTarget,
  SubmitTargetBody,
  TargetApprovalResult,
  TargetRelease,
  TargetableMetric,
  UpdateTargetBody,
} from './targets.model';

/** GET /api/tenant/crm/v1/targets */
export function listTargets(q: ListTargetsQuery): Promise<FlatPage<SalesTarget>> {
  return fakeListTargets(q);
}

/** GET /api/tenant/crm/v1/targets/:id */
export function getTarget(id: string): Promise<SalesTarget> {
  return fakeGetTarget(id);
}

/** GET /api/tenant/crm/v1/targets/:id/releases (cursor page; limit 1..100, default 25) */
export function listReleases(id: string, cursor?: string | null, limit?: number): Promise<InfoPage<TargetRelease>> {
  return fakeListReleases(id, cursor, limit);
}

/** POST /api/tenant/crm/v1/targets */
export function createTarget(body: CreateTargetBody): Promise<SalesTarget> {
  return fakeCreateTarget(body);
}

/** PATCH /api/tenant/crm/v1/targets/:id */
export function updateTarget(id: string, body: UpdateTargetBody): Promise<SalesTarget> {
  return fakeUpdateTarget(id, body);
}

/** DELETE /api/tenant/crm/v1/targets/:id (revision goes in If-Match; optional) */
export function deleteTarget(id: string, revision?: number): Promise<void> {
  return fakeDeleteTarget(id, revision);
}

/** POST /api/tenant/crm/v1/targets/:id/submit */
export function submitTarget(id: string, body: SubmitTargetBody): Promise<SalesTarget> {
  return fakeSubmitTarget(id, body);
}

/** POST /api/tenant/crm/v1/targets/:id/approve (x-idempotency-key: one key per user action, reused on retry) */
export function approveTarget(
  id: string,
  body: ApproveTargetBody,
  key: string,
): Promise<TargetApprovalResult> {
  return fakeApproveTarget(id, body, key);
}

/** POST /api/tenant/crm/v1/targets/:id/reject */
export function rejectTarget(id: string, body: RejectTargetBody): Promise<SalesTarget> {
  return fakeRejectTarget(id, body);
}

/** POST /api/tenant/crm/v1/targets/:id/corrections (x-idempotency-key: one key per user action, reused on retry) */
export function correctTarget(
  id: string,
  body: CorrectTargetBody,
  key: string,
): Promise<TargetApprovalResult> {
  return fakeCorrectTarget(id, body, key);
}

/** FAKE-ONLY, no backend route (there is no GET /api/tenant/crm/v1/targets/metrics). */
export function targetableMetrics(): Promise<TargetableMetric[]> {
  return fakeTargetableMetrics();
}

/**
 * The target is gone or out of reach: an unknown or deleted id answers 403 BRANCH_CONTEXT_REQUIRED (authority is
 * checked before the row is read), a target outside the reader's subject scope answers 404 CRM_TARGET_NOT_FOUND.
 */
export function isTargetGone(error: unknown): boolean {
  const code = errorCodeOf(error);
  return code === 'CRM_TARGET_NOT_FOUND' || code === 'BRANCH_CONTEXT_REQUIRED';
}

/**
 * 400 CRM_VALIDATION_FAILED field paths (ValidationPipe), for example `{ targetValue: ['max'] }`.
 * Only string-array details reach the client.
 */
export function targetFieldErrors(error: unknown): Record<string, string[]> {
  if (!(error instanceof ApiError) || error.code !== 'CRM_VALIDATION_FAILED' || !error.details) return {};
  const out: Record<string, string[]> = {};
  for (const [path, value] of Object.entries(error.details)) {
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) out[path] = [...value];
  }
  return out;
}

export function targetErrorMessage(transloco: TranslocoService, error: unknown): string {
  const code = errorCodeOf(error);
  if (code) {
    const key = errorKey(code);
    const translated = transloco.translate(key);
    if (translated && translated !== key) {
      return translated;
    }
  }
  if (error instanceof ApiError) {
    if (error.status === 404) return transloco.translate('settings.errors.notFound');
    if (error.status === 403) return transloco.translate('settings.errors.permission');
    if (error.status === 422) return transloco.translate('settings.errors.validation');
  }
  return transloco.translate('analytics.error.GENERIC');
}
