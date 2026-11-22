import { InfoPage } from '../../../../shared/widgets/dashboard/analytics-api';
import { fakeGetPolicy, fakeListPolicies, fakePreviewClock, fakePublishPolicy } from './sla.fake';
import {
  ListSlaPoliciesQuery,
  PreviewSlaClockRequest,
  PreviewSlaClockResponse,
  PublishSlaPolicy,
  SlaPolicy,
} from './sla.model';

// GET /api/tenant/crm/v1/sla/policies
export function listPolicies(q: ListSlaPoliciesQuery = {}): Promise<InfoPage<SlaPolicy>> {
  return fakeListPolicies(q);
}

// GET /api/tenant/crm/v1/sla/policies/:id
export function getPolicy(id: string): Promise<SlaPolicy> {
  return fakeGetPolicy(id);
}

// POST /api/tenant/crm/v1/sla/policies
export function publishPolicy(body: PublishSlaPolicy, key: string): Promise<SlaPolicy> {
  return fakePublishPolicy(body, key);
}

// POST /api/tenant/crm/v1/sla/clock/preview
export function previewClock(body: PreviewSlaClockRequest): Promise<PreviewSlaClockResponse> {
  return fakePreviewClock(body);
}
