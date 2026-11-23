import { InfoPage } from '../../../../shared/widgets/dashboard/analytics-api';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { ApiError, isRetryableWriteError } from '../../../../core/api/api-errors';
import { WorkspaceLookups } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { WorkspaceBranch } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { crmHttp, crmQueries } from '../../shared/crm-http';
import {
  ListSlaPoliciesQuery,
  PreviewSlaClockRequest,
  PreviewSlaClockResponse,
  PublishSlaPolicy,
  SlaPolicy,
} from './sla.model';

const queryKey = ['crm-settings', 'sla'] as const;
let pendingPreview: { key: string; bodyJson: string } | null = null;

export function listSlaBranches(lookups: WorkspaceLookups): Promise<WorkspaceBranch[]> {
  return lookups.allBranches({ status: 'ACTIVE' });
}

// GET /api/tenant/crm/v1/sla/policies
export function listPolicies(q: ListSlaPoliciesQuery = {}): Promise<InfoPage<SlaPolicy>> {
  return crmQueries().fetchQuery({
    queryKey: [...queryKey, 'list', q],
    queryFn: () => crmHttp().read<InfoPage<SlaPolicy>>('/sla/policies', { ...q }),
  });
}

// GET /api/tenant/crm/v1/sla/policies/:id
export function getPolicy(id: string): Promise<SlaPolicy> {
  return crmQueries().fetchQuery({
    queryKey: [...queryKey, 'policy', id],
    queryFn: () => crmHttp().read<SlaPolicy>(`/sla/policies/${encodeURIComponent(id)}`),
  });
}

// POST /api/tenant/crm/v1/sla/policies
export async function publishPolicy(body: PublishSlaPolicy, key: string): Promise<SlaPolicy> {
  const result = await crmHttp().write<SlaPolicy>(
    'POST',
    '/sla/policies',
    {
      ...body,
      expectedSupersedesPolicyId: body.expectedSupersedesPolicyId ?? null,
    },
    { key },
  );
  await crmQueries().cancelQueries({ queryKey });
  await crmQueries().invalidateQueries({ queryKey });
  return result.data;
}

// POST /api/tenant/crm/v1/sla/clock/preview
export async function previewClock(body: PreviewSlaClockRequest): Promise<PreviewSlaClockResponse> {
  const bodyJson = JSON.stringify(body);
  if (pendingPreview?.bodyJson !== bodyJson) {
    pendingPreview = { key: newIdempotencyKey(), bodyJson };
  }
  const action = pendingPreview;
  try {
    const result = await crmHttp().write<PreviewSlaClockResponse>(
      'POST',
      '/sla/clock/preview',
      JSON.parse(action.bodyJson),
      { key: action.key },
    );
    if (pendingPreview === action) pendingPreview = null;
    return result.data;
  } catch (error) {
    if (
      pendingPreview === action &&
      !isRetryableWriteError(error) &&
      !(error instanceof ApiError && error.status === 401)
    )
      pendingPreview = null;
    throw error;
  }
}
