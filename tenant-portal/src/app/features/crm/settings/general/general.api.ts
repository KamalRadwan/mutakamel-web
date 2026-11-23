import { inject } from '@angular/core';
import { ApiError, isRetryableWriteError } from '../../../../core/api/api-errors';
import { CoreHttp } from '../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { crmHttp, crmQueries, type CrmHttpTransport } from '../../shared/crm-http';
import type { PipelineReadView } from '../pipelines/pipelines.model';
import type { CorePhoneSummary, CrmSettings, CrmSettingsPatch } from './general.model';

const queryKey = ['crm-settings', 'general'] as const;
const retries = new WeakMap<CrmHttpTransport, Map<string, { key: string; bodyJson: string }>>();

// GET /api/tenant/crm/v1/settings
export function getCrmSettings(): Promise<CrmSettings> {
  return crmQueries().fetchQuery({ queryKey, queryFn: () => crmHttp().read('/settings') });
}

// PUT /api/tenant/crm/v1/settings
export async function updateCrmSettings(patch: CrmSettingsPatch): Promise<CrmSettings> {
  const http = crmHttp();
  let pendingWrites = retries.get(http);
  if (!pendingWrites) retries.set(http, (pendingWrites = new Map()));
  const action = Object.keys(patch).sort().join(',');
  const bodyJson = JSON.stringify(patch);
  const previous = pendingWrites.get(action);
  const request = {
    bodyJson,
    key: previous?.bodyJson === bodyJson ? previous.key : newIdempotencyKey(),
  };
  pendingWrites.set(action, request);
  let saved: CrmSettings;
  try {
    saved = (
      await http.write<CrmSettings>('PUT', '/settings', JSON.parse(bodyJson), { key: request.key })
    ).data;
  } catch (error) {
    if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) {
      if (pendingWrites.get(action) === request) pendingWrites.delete(action);
    }
    throw error;
  }
  if (pendingWrites.get(action) === request) pendingWrites.delete(action);
  await crmQueries().cancelQueries({ queryKey, exact: true });
  await crmQueries().invalidateQueries({ queryKey });
  return saved;
}

// GET /api/tenant/crm/v1/pipelines (read permission, no configuration access needed)
export function getGeneralPipelines(): Promise<PipelineReadView[]> {
  return crmQueries().fetchQuery({
    queryKey: [...queryKey, 'pipelines'],
    queryFn: () => crmHttp().read('/pipelines'),
  });
}

// Call in an injection context to capture CoreHttp before the asynchronous query.
export function getCorePhoneSummary(): Promise<CorePhoneSummary> {
  const http = inject(CoreHttp);
  return crmQueries().fetchQuery({
    queryKey: [...queryKey, 'phone'],
    queryFn: async () => {
      const [servers, seats] = await Promise.all([
        http.read<unknown[]>('/api/tenant/webphone/v1/servers'),
        http.read<Omit<CorePhoneSummary, 'servers'>>('/api/tenant/webphone/v1/seats'),
      ]);
      return {
        servers: servers.length,
        allowed: seats.allowed,
        occupied: seats.occupied,
        available: seats.available,
        overAllowance: seats.overAllowance,
      };
    },
  });
}
