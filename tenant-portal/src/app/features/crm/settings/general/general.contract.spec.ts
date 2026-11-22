import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, fieldErrorsOf } from '../../../../core/api/api-errors';
import { getCorePhoneSummary, getCrmSettings, updateCrmSettings } from './general.api';
import { setFakePhoneSummaryState } from './general.fake';
import { CrmSettingsPatch } from './general.model';

/** Runs the fake timers to completion and returns (or rethrows) the settled result. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function errorOf(promise: Promise<unknown>): Promise<ApiError | undefined> {
  try {
    await settle(promise);
    return undefined;
  } catch (error) {
    return error instanceof ApiError ? error : undefined;
  }
}

/** A patch with a wrongly typed field, as a broken client could send it. */
function badPatch(field: keyof CrmSettingsPatch, value: unknown): CrmSettingsPatch {
  return { [field]: value } as unknown as CrmSettingsPatch;
}

describe('general settings contract (crm settings)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    setFakePhoneSummaryState('subscribed');
    vi.useRealTimers();
  });

  describe('GET crm/v1/settings', () => {
    it('returns the bare CrmSettings body', async () => {
      const settings = await settle(getCrmSettings());
      expect(settings).toEqual({
        id: expect.any(String),
        leadsEnabled: expect.any(Boolean),
        opportunitiesEnabled: expect.any(Boolean),
        requireQualifiedStageForConversion: expect.any(Boolean),
        defaultPipelineId: expect.any(String),
        outboundEmailContentRetentionDays: expect.any(Number),
        outboundEmailRetentionPolicyRevision: expect.any(Number),
        analyticsTimeZone: expect.any(String),
        clickToCallEnabled: expect.any(Boolean),
        logCallsAsActivities: expect.any(Boolean),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(settings).not.toHaveProperty('data');
    });

    it('returns a copy, so editing the result never changes the store', async () => {
      const first = await settle(getCrmSettings());
      first.leadsEnabled = !first.leadsEnabled;
      const second = await settle(getCrmSettings());
      expect(second.leadsEnabled).toBe(!first.leadsEnabled);
    });
  });

  describe('PUT crm/v1/settings', () => {
    it('applies the boolean switches and returns the saved settings', async () => {
      const before = await settle(getCrmSettings());
      const saved = await settle(
        updateCrmSettings({
          leadsEnabled: !before.leadsEnabled,
          opportunitiesEnabled: !before.opportunitiesEnabled,
          requireQualifiedStageForConversion: !before.requireQualifiedStageForConversion,
          logCallsAsActivities: !before.logCallsAsActivities,
        }),
      );
      expect(saved.leadsEnabled).toBe(!before.leadsEnabled);
      expect(saved.opportunitiesEnabled).toBe(!before.opportunitiesEnabled);
      expect(saved.requireQualifiedStageForConversion).toBe(!before.requireQualifiedStageForConversion);
      expect(saved.logCallsAsActivities).toBe(!before.logCallsAsActivities);
      expect(saved.id).toBe(before.id);
      expect(saved.defaultPipelineId).toBe(before.defaultPipelineId);

      const reread = await settle(getCrmSettings());
      expect(reread).toEqual(saved);
    });

    it('keeps clickToCallEnabled in step with the phone actions setting', async () => {
      const off = await settle(updateCrmSettings({ clickToCallEnabled: false }));
      expect(off.clickToCallEnabled).toBe(false);
      expect((await settle(getCrmSettings())).clickToCallEnabled).toBe(false);

      const on = await settle(updateCrmSettings({ clickToCallEnabled: true }));
      expect(on.clickToCallEnabled).toBe(true);
      expect((await settle(getCrmSettings())).clickToCallEnabled).toBe(true);
    });

    it('bumps the retention policy revision only when the days change', async () => {
      const before = await settle(getCrmSettings());
      const same = await settle(
        updateCrmSettings({
          outboundEmailContentRetentionDays: before.outboundEmailContentRetentionDays,
          expectedOutboundEmailRetentionPolicyRevision: before.outboundEmailRetentionPolicyRevision,
        }),
      );
      expect(same.outboundEmailRetentionPolicyRevision).toBe(before.outboundEmailRetentionPolicyRevision);

      const changed = await settle(
        updateCrmSettings({
          outboundEmailContentRetentionDays: 365,
          expectedOutboundEmailRetentionPolicyRevision: before.outboundEmailRetentionPolicyRevision,
        }),
      );
      expect(changed.outboundEmailContentRetentionDays).toBe(365);
      expect(changed.outboundEmailRetentionPolicyRevision).toBe(before.outboundEmailRetentionPolicyRevision + 1);
    });

    it('answers a stale retention revision with 409 CRM_OUTBOUND_EMAIL_RETENTION_POLICY_STALE', async () => {
      const current = await settle(getCrmSettings());
      const error = await errorOf(
        updateCrmSettings({
          outboundEmailContentRetentionDays: 400,
          expectedOutboundEmailRetentionPolicyRevision: current.outboundEmailRetentionPolicyRevision + 5,
        }),
      );
      expect(error?.status).toBe(409);
      expect(error?.code).toBe('CRM_OUTBOUND_EMAIL_RETENTION_POLICY_STALE');
      expect((await settle(getCrmSettings())).outboundEmailContentRetentionDays).toBe(
        current.outboundEmailContentRetentionDays,
      );
    });

    // Backend crm-settings.service.ts throws the ConflictException with code and message only.
    it('the stale retention 409 carries no details', async () => {
      const current = await settle(getCrmSettings());
      const error = await errorOf(
        updateCrmSettings({
          outboundEmailContentRetentionDays: 400,
          expectedOutboundEmailRetentionPolicyRevision: current.outboundEmailRetentionPolicyRevision + 5,
        }),
      );
      expect(error?.details).toBeUndefined();
    });

    it('answers days without a revision, or a revision without days, with 422 CRM_SETTING_INVALID', async () => {
      const daysOnly = await errorOf(updateCrmSettings({ outboundEmailContentRetentionDays: 90 }));
      expect(daysOnly?.status).toBe(422);
      expect(daysOnly?.code).toBe('CRM_SETTING_INVALID');

      const revisionOnly = await errorOf(updateCrmSettings({ expectedOutboundEmailRetentionPolicyRevision: 1 }));
      expect(revisionOnly?.status).toBe(422);
      expect(revisionOnly?.code).toBe('CRM_SETTING_INVALID');
    });

    it('answers retention days out of 30..2555 with 400 CRM_VALIDATION_FAILED', async () => {
      const current = await settle(getCrmSettings());
      for (const days of [29, 2556, 90.5]) {
        const error = await errorOf(
          updateCrmSettings({
            outboundEmailContentRetentionDays: days,
            expectedOutboundEmailRetentionPolicyRevision: current.outboundEmailRetentionPolicyRevision,
          }),
        );
        expect(error?.status).toBe(400);
        expect(error?.code).toBe('CRM_VALIDATION_FAILED');
        expect(Object.keys(fieldErrorsOf(error))).toEqual(['outboundEmailContentRetentionDays']);
      }
    });

    it('answers a non-boolean switch with 400 CRM_VALIDATION_FAILED naming the field', async () => {
      for (const field of ['leadsEnabled', 'opportunitiesEnabled', 'clickToCallEnabled', 'logCallsAsActivities'] as const) {
        const error = await errorOf(updateCrmSettings(badPatch(field, 'yes')));
        expect(error?.status).toBe(400);
        expect(error?.code).toBe('CRM_VALIDATION_FAILED');
        expect(Object.keys(fieldErrorsOf(error))).toEqual([field]);
      }
    });

    // AGENTS.md: details are keyed by field path with string-array messages ({ leadsEnabled: ['is_boolean'] }).
    it('validation details are keyed by field path with string arrays', async () => {
      const error = await errorOf(updateCrmSettings(badPatch('leadsEnabled', 'yes')));
      expect(error?.details).toEqual({ leadsEnabled: expect.arrayContaining([expect.any(String)]) });
    });

    // Backend UpdateCrmSettingsDto: requireQualifiedStageForConversion is @IsBoolean.
    it('a non-boolean requireQualifiedStageForConversion is 400 CRM_VALIDATION_FAILED', async () => {
      const error = await errorOf(updateCrmSettings(badPatch('requireQualifiedStageForConversion', 'yes')));
      expect(error?.status).toBe(400);
      expect(error?.code).toBe('CRM_VALIDATION_FAILED');
    });

    // Backend: the ValidationPipe (400, @Max(2555)) runs before the service's 422 CRM_SETTING_INVALID check.
    it('out-of-range days without a revision is 400 CRM_VALIDATION_FAILED first', async () => {
      const error = await errorOf(updateCrmSettings({ outboundEmailContentRetentionDays: 9999 }));
      expect(error?.status).toBe(400);
      expect(error?.code).toBe('CRM_VALIDATION_FAILED');
    });
  });

  describe('GET webphone/v1/servers + seats (phone summary)', () => {
    it('returns the bare summary counts', async () => {
      const summary = await settle(getCorePhoneSummary());
      expect(summary).toEqual({ servers: 2, occupied: 3, allowed: 10, available: 7, overAllowance: false });
    });

    it('answers a tenant without the phone module with 403 WEBPHONE_MODULE_NOT_PURCHASED', async () => {
      setFakePhoneSummaryState('notSubscribed');
      const error = await errorOf(getCorePhoneSummary());
      expect(error?.status).toBe(403);
      expect(error?.code).toBe('WEBPHONE_MODULE_NOT_PURCHASED');
    });

    it('passes a server failure through as 500', async () => {
      setFakePhoneSummaryState('failed');
      const error = await errorOf(getCorePhoneSummary());
      expect(error?.status).toBe(500);
    });
  });
});
