import { TranslocoService } from '@jsverse/transloco';
import {
  ApiError,
  errorCodeOf,
  fieldErrorsOf,
  isRetryableWriteError,
} from '../../../../core/api/api-errors';
import { CoreHttp, type CoreWriteMethod } from '../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import type { FlatPage, InfoPage } from '../../../../shared/widgets/dashboard/analytics-api';
import type { WorkspaceLookups } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { crmHttp, crmQueries } from '../../shared/crm-http';
import { crmSettingsError } from '../shared/settings-api';
import type {
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
  TargetSubjectOptions,
  TargetCurrency,
  UpdateTargetBody,
} from './targets.model';

const queryKey = ['crm-settings', 'targets'] as const;
const pendingWrites = new Map<string, { key: string; bodyJson: string }>();

function read<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
  return crmQueries().fetchQuery({
    queryKey: [...queryKey, path, query],
    queryFn: () => crmHttp().read<T>(path, query),
  });
}

async function write<T>(
  method: CoreWriteMethod,
  path: string,
  body: unknown,
  options: { key?: string; revision?: number } = {},
): Promise<T> {
  const action = `${method} ${path}`;
  const bodyJson = JSON.stringify([body ?? null, options.revision ?? null]);
  const previous = pendingWrites.get(action);
  const key = options.key ?? (previous?.bodyJson === bodyJson ? previous.key : newIdempotencyKey());
  pendingWrites.set(action, { key, bodyJson });
  try {
    const response = await crmHttp().write<T>(method, path, body, {
      key,
      ...(options.revision !== undefined ? { ifMatch: `"${options.revision}"` } : {}),
    });
    pendingWrites.delete(action);
    await crmQueries().cancelQueries({ queryKey });
    await crmQueries().invalidateQueries({ queryKey });
    return response.data;
  } catch (error) {
    if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401))
      pendingWrites.delete(action);
    throw error;
  }
}

/** A newly opened form is a new user action, even if its values match a failed, discarded form. */
export function beginTargetAction(action: 'create' | 'update' | 'reject', id?: string): void {
  const method = action === 'update' ? 'PATCH' : 'POST';
  const path =
    action === 'create'
      ? '/targets'
      : `/targets/${encodeURIComponent(id!)}` + (action === 'reject' ? '/reject' : '');
  pendingWrites.delete(`${method} ${path}`);
}
export function listTargets(q: ListTargetsQuery): Promise<FlatPage<SalesTarget>> {
  return read('/targets', { ...q });
}
export function getTarget(id: string): Promise<SalesTarget> {
  return read(`/targets/${encodeURIComponent(id)}`);
}
export function listReleases(
  id: string,
  cursor?: string | null,
  limit?: number,
): Promise<InfoPage<TargetRelease>> {
  return read(`/targets/${encodeURIComponent(id)}/releases`, {
    cursor: cursor ?? undefined,
    limit,
  });
}
export function createTarget(body: CreateTargetBody): Promise<SalesTarget> {
  return write('POST', '/targets', body);
}
export function updateTarget(id: string, body: UpdateTargetBody): Promise<SalesTarget> {
  return write('PATCH', `/targets/${encodeURIComponent(id)}`, body, { revision: body.revision });
}
/** The landed controller accepts an optional If-Match revision and enforces DRAFT. */
export function deleteTarget(id: string, revision?: number): Promise<void> {
  return write('DELETE', `/targets/${encodeURIComponent(id)}`, undefined, { revision });
}
export function submitTarget(id: string, body: SubmitTargetBody): Promise<SalesTarget> {
  return write('POST', `/targets/${encodeURIComponent(id)}/submit`, body, {
    revision: body.revision,
  });
}
export function approveTarget(
  id: string,
  body: ApproveTargetBody,
  key: string,
): Promise<TargetApprovalResult> {
  return write('POST', `/targets/${encodeURIComponent(id)}/approve`, body, {
    key,
    revision: body.revision,
  });
}
export function rejectTarget(id: string, body: RejectTargetBody): Promise<SalesTarget> {
  return write('POST', `/targets/${encodeURIComponent(id)}/reject`, body, {
    revision: body.revision,
  });
}
export function correctTarget(
  id: string,
  body: CorrectTargetBody,
  key: string,
): Promise<TargetApprovalResult> {
  return write('POST', `/targets/${encodeURIComponent(id)}/corrections`, body, {
    key,
    revision: body.revision,
  });
}
export function targetableMetrics(): Promise<TargetableMetric[]> {
  return read('/targets/metrics');
}
export function targetSubjectOptions(
  branchId: string,
  search?: string,
  limit = 100,
): Promise<TargetSubjectOptions> {
  return read('/targets/subject-options', { branchId, search, limit });
}
export function targetCurrencies(core: CoreHttp): Promise<TargetCurrency[]> {
  return crmQueries().fetchQuery({
    queryKey: [...queryKey, 'currencies'],
    queryFn: () => core.read<TargetCurrency[]>('/api/tenant/core/v1/currencies/options'),
  });
}
export function targetBranches(lookups: WorkspaceLookups) {
  return crmQueries().fetchQuery({
    queryKey: [...queryKey, 'branches'],
    queryFn: () => lookups.allBranches({ status: 'ACTIVE' }),
  });
}
export function isTargetGone(error: unknown): boolean {
  const code = errorCodeOf(error);
  return code === 'CRM_TARGET_NOT_FOUND' || code === 'BRANCH_CONTEXT_REQUIRED';
}
export function targetFieldErrors(error: unknown): Record<string, string[]> {
  return fieldErrorsOf(error);
}
export function targetErrorMessage(transloco: TranslocoService, error: unknown): string {
  return crmSettingsError(transloco, error, 'targets').message;
}
