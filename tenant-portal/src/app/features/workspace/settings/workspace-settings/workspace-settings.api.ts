import {
  fakeGetWorkspaceSettings,
  fakeListCurrencyCatalogue,
  fakeListTimezones,
  fakeUpdateWorkspaceSettings,
} from './workspace-settings.fake';
import {
  CurrencyOption,
  TimezoneOption,
  UpdateWorkspaceSettingsRequest,
  WorkspaceSettings,
} from './workspace-settings.model';

export function getWorkspaceSettings(): Promise<WorkspaceSettings> {
  // GET /api/v1/tenant/workspace-settings [workspace.read]
  return fakeGetWorkspaceSettings();
}

export function updateWorkspaceSettings(
  body: UpdateWorkspaceSettingsRequest,
  idempotencyKey: string,
): Promise<WorkspaceSettings> {
  // PUT /api/v1/tenant/workspace-settings [workspace.manage, tenant-wide] (x-idempotency-key)
  return fakeUpdateWorkspaceSettings(body, idempotencyKey);
}

export function listCurrencyCatalogue(): Promise<CurrencyOption[]> {
  // gap D2: no API yet. Later GET /api/v1/tenant/currencies?status=ACTIVE [currencies.currency.read], or the options endpoint
  return fakeListCurrencyCatalogue();
}

export function listTimezones(): Promise<TimezoneOption[]> {
  // gap D2: client list from Intl. Later the options endpoint (server list)
  return fakeListTimezones();
}
