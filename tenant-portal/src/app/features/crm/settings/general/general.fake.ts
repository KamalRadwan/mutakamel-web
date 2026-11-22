import { getFakeClickToCallEnabled, setFakeClickToCallEnabled } from '../../../../shared/widgets/phone-actions/crm-call-settings.api';
import { ApiError, fakeDelay } from '../shared/settings-api';
import {
  CorePhoneSummary,
  CrmSettings,
  CrmSettingsPatch,
  GENERAL_LIMITS,
} from './general.model';

export const FAKE_READ_ONLY = false;

export type FakePhoneSummaryState = 'subscribed' | 'notSubscribed' | 'failed';
let fakePhoneSummaryState: FakePhoneSummaryState = 'subscribed';

export function setFakePhoneSummaryState(state: FakePhoneSummaryState): void {
  fakePhoneSummaryState = state;
}

function assertWritable(): void {
  if (FAKE_READ_ONLY) {
    throw new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY');
  }
}

let settingsState: CrmSettings = {
  id: '01950000-0000-7000-8000-000000000101',
  leadsEnabled: true,
  opportunitiesEnabled: true,
  requireQualifiedStageForConversion: true,
  // Matches the default pipeline id seeded in src/app/features/crm/settings/pipelines/pipelines.fake.ts
  defaultPipelineId: '01950000-0000-7000-8000-000000000201',
  outboundEmailContentRetentionDays: 730,
  outboundEmailRetentionPolicyRevision: 1,
  analyticsTimeZone: 'Africa/Cairo',
  clickToCallEnabled: true,
  logCallsAsActivities: true,
  createdAt: '2026-01-15T09:00:00.000Z',
  updatedAt: '2026-10-12T14:30:00.000Z',
};

function cloneSettings(settings: CrmSettings): CrmSettings {
  return { ...settings };
}

// GET /api/tenant/crm/v1/settings
export async function fakeGetCrmSettings(): Promise<CrmSettings> {
  await fakeDelay();
  settingsState.clickToCallEnabled = getFakeClickToCallEnabled();
  return cloneSettings(settingsState);
}

/**
 * UpdateCrmSettingsDto through the global ValidationPipe: 400 CRM_VALIDATION_FAILED with details keyed by
 * property path (string arrays of lowercase constraint names). The pipe runs before any service check.
 */
function assertUpdateSettingsBody(patch: CrmSettingsPatch): void {
  const details: Record<string, string[]> = {};
  const raw = patch as Record<string, unknown>;
  for (const field of [
    'leadsEnabled',
    'opportunitiesEnabled',
    'requireQualifiedStageForConversion',
    'clickToCallEnabled',
    'logCallsAsActivities',
  ]) {
    const value = raw[field];
    if (value !== undefined && typeof value !== 'boolean') details[field] = ['is_boolean'];
  }
  const days = raw['outboundEmailContentRetentionDays'];
  if (days !== undefined) {
    if (typeof days !== 'number' || !Number.isInteger(days)) details['outboundEmailContentRetentionDays'] = ['is_int'];
    else if (days < GENERAL_LIMITS.retentionMin) details['outboundEmailContentRetentionDays'] = ['min'];
    else if (days > GENERAL_LIMITS.retentionMax) details['outboundEmailContentRetentionDays'] = ['max'];
  }
  const revision = raw['expectedOutboundEmailRetentionPolicyRevision'];
  if (revision !== undefined) {
    if (typeof revision !== 'number' || !Number.isInteger(revision)) {
      details['expectedOutboundEmailRetentionPolicyRevision'] = ['is_int'];
    } else if (revision < 1) {
      details['expectedOutboundEmailRetentionPolicyRevision'] = ['min'];
    }
  }
  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', details);
  }
}

// PUT /api/tenant/crm/v1/settings
export async function fakeUpdateCrmSettings(patch: CrmSettingsPatch): Promise<CrmSettings> {
  await fakeDelay();
  assertWritable();

  assertUpdateSettingsBody(patch);
  const next = cloneSettings(settingsState);

  if (patch.leadsEnabled !== undefined) next.leadsEnabled = patch.leadsEnabled;
  if (patch.opportunitiesEnabled !== undefined) next.opportunitiesEnabled = patch.opportunitiesEnabled;
  if (patch.clickToCallEnabled !== undefined) next.clickToCallEnabled = patch.clickToCallEnabled;
  if (patch.logCallsAsActivities !== undefined) next.logCallsAsActivities = patch.logCallsAsActivities;

  const hasDays = patch.outboundEmailContentRetentionDays !== undefined;
  const hasRevision = patch.expectedOutboundEmailRetentionPolicyRevision !== undefined;
  if (hasDays !== hasRevision) {
    throw new ApiError(422, 'CRM_SETTING_INVALID');
  }

  if (patch.outboundEmailContentRetentionDays !== undefined) {
    const days = patch.outboundEmailContentRetentionDays;
    if (patch.expectedOutboundEmailRetentionPolicyRevision !== next.outboundEmailRetentionPolicyRevision) {
      // crm-settings.service.ts: ConflictException with code and message only, so no details reach the client.
      throw new ApiError(409, 'CRM_OUTBOUND_EMAIL_RETENTION_POLICY_STALE');
    }
    if (days !== next.outboundEmailContentRetentionDays) {
      next.outboundEmailContentRetentionDays = days;
      next.outboundEmailRetentionPolicyRevision += 1;
    }
  }

  if (patch.requireQualifiedStageForConversion !== undefined) {
    next.requireQualifiedStageForConversion = patch.requireQualifiedStageForConversion;
  }

  next.updatedAt = new Date().toISOString();
  settingsState = next;
  setFakeClickToCallEnabled(settingsState.clickToCallEnabled);
  return cloneSettings(settingsState);
}

// GET /api/tenant/webphone/v1/servers
// GET /api/tenant/webphone/v1/seats
export async function fakeGetCorePhoneSummary(): Promise<CorePhoneSummary> {
  await fakeDelay();
  if (fakePhoneSummaryState === 'notSubscribed') {
    throw new ApiError(403, 'WEBPHONE_MODULE_NOT_PURCHASED');
  }
  if (fakePhoneSummaryState === 'failed') {
    throw new ApiError(500, 'INTERNAL_ERROR');
  }
  return {
    servers: 2,
    occupied: 3,
    allowed: 10,
    available: 7,
    overAllowance: false,
  };
}
