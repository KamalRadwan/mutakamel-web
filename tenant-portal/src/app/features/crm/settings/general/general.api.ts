import { fakeGetCorePhoneSummary, fakeGetCrmSettings, fakeUpdateCrmSettings } from './general.fake';
import { CorePhoneSummary, CrmSettings, CrmSettingsPatch } from './general.model';

// GET /api/tenant/crm/v1/settings
export function getCrmSettings(): Promise<CrmSettings> {
  return fakeGetCrmSettings();
}

// PUT /api/tenant/crm/v1/settings
export function updateCrmSettings(patch: CrmSettingsPatch): Promise<CrmSettings> {
  return fakeUpdateCrmSettings(patch);
}

// GET /api/tenant/webphone/v1/servers
// GET /api/tenant/webphone/v1/seats
export function getCorePhoneSummary(): Promise<CorePhoneSummary> {
  return fakeGetCorePhoneSummary();
}
