import { ApiError, isRetryableWriteError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { crmHttp, crmQueries, type CrmHttpTransport } from '../crm-http';
import type { CrmModuleOverride, CrmModulesState } from './crm-modules.model';

const queryKey = ['crm-settings', 'modules'] as const;
const retries = new WeakMap<CrmHttpTransport, Map<string, { key: string; bodyJson: string }>>();

// GET /api/tenant/crm/v1/settings/modules (available to every signed-in CRM user).
export function getCrmModules(): Promise<CrmModulesState> {
  return crmQueries().fetchQuery({ queryKey, queryFn: () => crmHttp().read('/settings/modules') });
}

// PUT /api/tenant/crm/v1/settings/modules/companies/:companyId
export async function updateCompanyModules(
  companyId: string,
  patch: Partial<CrmModuleOverride>,
  expectedRevision: number,
): Promise<CrmModulesState> {
  const http = crmHttp();
  let pendingWrites = retries.get(http);
  if (!pendingWrites) retries.set(http, (pendingWrites = new Map()));
  const action = `${companyId}:${Object.keys(patch).sort().join(',')}`;
  const bodyJson = JSON.stringify({ expectedRevision, ...patch });
  const previous = pendingWrites.get(action);
  const request = {
    bodyJson,
    key: previous?.bodyJson === bodyJson ? previous.key : newIdempotencyKey(),
  };
  pendingWrites.set(action, request);
  let saved: CrmModulesState;
  try {
    saved = (
      await http.write<CrmModulesState>(
        'PUT',
        `/settings/modules/companies/${encodeURIComponent(companyId)}`,
        JSON.parse(bodyJson),
        { key: request.key },
      )
    ).data;
  } catch (error) {
    if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) {
      if (pendingWrites.get(action) === request) pendingWrites.delete(action);
    }
    throw error;
  }
  if (pendingWrites.get(action) === request) pendingWrites.delete(action);
  await crmQueries().cancelQueries({ queryKey });
  await crmQueries().invalidateQueries({ queryKey });
  return saved;
}
