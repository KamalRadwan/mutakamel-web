import { ApiError, isRetryableWriteError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { crmHttp, crmQueries, type CrmHttpTransport } from '../../shared/crm-http';
import {
  BranchPatch,
  CompanyPatch,
  DefaultsPatch,
  PolicyTree,
  PolicyWriteResult,
} from './duplicates.model';

const queryKey = ['crm-settings', 'duplicates'] as const;
const path = '/settings/duplicate-policy';
const pendingWrites = new WeakMap<CrmHttpTransport, Map<string, { key: string; bodyJson: string }>>();

/** GET /api/tenant/crm/v1/settings/duplicate-policy */
export function getPolicy(): Promise<PolicyTree> {
  return crmQueries().fetchQuery({ queryKey, queryFn: () => crmHttp().read<PolicyTree>(path) });
}

/** PUT /api/tenant/crm/v1/settings/duplicate-policy/defaults */
export function putDefaults(
  patch: DefaultsPatch,
  expectedRevision: number,
  confirmResets = false,
): Promise<PolicyWriteResult> {
  return writePolicy(`${path}/defaults`, patch, expectedRevision, confirmResets);
}

/** PUT /api/tenant/crm/v1/settings/duplicate-policy/companies/:companyId */
export function putCompany(
  companyId: string,
  patch: CompanyPatch,
  expectedRevision: number,
  confirmResets = false,
): Promise<PolicyWriteResult> {
  return writePolicy(`${path}/companies/${encodeURIComponent(companyId)}`, patch, expectedRevision, confirmResets);
}

/** PUT /api/tenant/crm/v1/settings/duplicate-policy/branches/:branchId */
export function putBranch(
  branchId: string,
  patch: BranchPatch,
  expectedRevision: number,
  confirmResets = false,
): Promise<PolicyWriteResult> {
  return writePolicy(`${path}/branches/${encodeURIComponent(branchId)}`, patch, expectedRevision, confirmResets);
}

async function writePolicy(
  target: string,
  patch: DefaultsPatch | CompanyPatch | BranchPatch,
  expectedRevision: number,
  confirmResets: boolean,
): Promise<PolicyWriteResult> {
  const http = crmHttp();
  let pending = pendingWrites.get(http);
  if (!pending) pendingWrites.set(http, (pending = new Map()));
  const bodyJson = JSON.stringify({ ...patch, expectedRevision, ...(confirmResets ? { confirmResets: true } : {}) });
  const previous = pending.get(target);
  const key = previous?.bodyJson === bodyJson ? previous.key : newIdempotencyKey();
  pending.delete(target);
  let result: PolicyWriteResult;
  try {
    result = (await http.write<PolicyWriteResult>('PUT', target, JSON.parse(bodyJson), { key })).data;
  } catch (error) {
    if (isRetryableWriteError(error) || error instanceof ApiError && error.status === 401) {
      pending.set(target, { key, bodyJson });
    }
    throw error;
  }
  await crmQueries().cancelQueries({ queryKey });
  await crmQueries().invalidateQueries({ queryKey });
  return result;
}
