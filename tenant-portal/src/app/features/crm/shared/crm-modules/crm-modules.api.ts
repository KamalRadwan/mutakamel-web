import {
  fakeGetCrmModules,
  fakeSyncCrmModuleDefaults,
  fakeSyncCrmModulesState,
  fakeUpdateCompanyModules,
} from './crm-modules.fake';
import { CrmModuleFlags, CrmModuleOverride, CrmModulesState } from './crm-modules.model';

// GET /api/tenant/crm/v1/settings/modules
export function getCrmModules(): Promise<CrmModulesState> {
  return fakeGetCrmModules();
}

// PUT /api/tenant/crm/v1/settings/modules/companies/:companyId (body { expectedRevision, leadsEnabled?, opportunitiesEnabled? }; gateway WRITE_SENSITIVE, idempotent: false -> no x-idempotency-key)
export function updateCompanyModules(
  companyId: string,
  patch: Partial<CrmModuleOverride>,
  expectedRevision: number,
): Promise<CrmModulesState> {
  return fakeUpdateCompanyModules(companyId, patch, expectedRevision);
}

// Fake-only: keeps the in-memory modules store in step with a state the client applied.
// The real backend owns this state, so these become no-ops when the API is wired.
export function syncCrmModulesState(next: CrmModulesState): CrmModulesState {
  return fakeSyncCrmModulesState(next);
}

export function syncCrmModuleDefaults(defaults: Partial<CrmModuleFlags>): CrmModulesState {
  return fakeSyncCrmModuleDefaults(defaults);
}
