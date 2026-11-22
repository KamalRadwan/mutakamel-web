import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import {
  getWorkspaceSettings,
  listCurrencyCatalogue,
  listTimezones,
  updateWorkspaceSettings,
} from './workspace-settings.api';
import { FAKE_WORKSPACE_FAIL_NEXT, resetWorkspaceSettingsFake } from './workspace-settings.fake';

/*
 * workspace-settings.api.ts over workspace-settings.fake.ts: a singleton record (Core's envelope
 * `data`, no page), PUT with x-idempotency-key, and the 422 business codes of
 * WorkspaceSettingsService (LANGUAGE_INVALID, CURRENCY_NOT_ENABLED, TIMEZONE_INVALID).
 */

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

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

describe('workspace settings api (fake)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetWorkspaceSettingsFake();
  });
  afterEach(() => vi.useRealTimers());

  describe('getWorkspaceSettings', () => {
    it('returns the singleton record', async () => {
      const settings = await settle(getWorkspaceSettings());
      expect(Object.keys(settings).sort()).toEqual([
        'allowSupport',
        'createdAt',
        'defaultCurrencyCode',
        'defaultLanguage',
        'id',
        'timezone',
        'updatedAt',
      ]);
      expect(settings).toMatchObject({ defaultLanguage: 'en', defaultCurrencyCode: 'EGP', timezone: 'Africa/Cairo', allowSupport: true });
    });

    it('maps FAIL_NEXT codes to their status', async () => {
      FAKE_WORKSPACE_FAIL_NEXT.code = 'TENANT_NOT_READY';
      const notReady = await errorOf(getWorkspaceSettings());
      expect([notReady.status, notReady.code]).toEqual([503, 'TENANT_NOT_READY']);
      FAKE_WORKSPACE_FAIL_NEXT.code = 'TENANT_WIDE_PERMISSION_REQUIRED';
      expect((await errorOf(getWorkspaceSettings())).status).toBe(403);
      await expect(settle(getWorkspaceSettings())).resolves.toBeTruthy();
    });
  });

  describe('updateWorkspaceSettings', () => {
    it('normalises and saves the fields', async () => {
      const before = await settle(getWorkspaceSettings());
      const updated = await settle(
        updateWorkspaceSettings({ defaultLanguage: ' AR ' as never, defaultCurrencyCode: 'usd', timezone: 'Asia/Riyadh', allowSupport: false }, newIdempotencyKey()),
      );
      expect(updated).toMatchObject({ defaultLanguage: 'ar', defaultCurrencyCode: 'USD', timezone: 'Asia/Riyadh', allowSupport: false });
      expect(updated.updatedAt).not.toBe(before.updatedAt);
      expect(await settle(getWorkspaceSettings())).toEqual(updated);
    });

    it('returns the record unchanged for a no-op', async () => {
      const before = await settle(getWorkspaceSettings());
      const same = await settle(updateWorkspaceSettings({ timezone: 'Africa/Cairo' }, newIdempotencyKey()));
      expect(same).toEqual(before);
    });

    it('answers the 422 business codes', async () => {
      const language = await errorOf(updateWorkspaceSettings({ defaultLanguage: 'fr' } as never, newIdempotencyKey()));
      expect([language.status, language.code]).toEqual([422, 'LANGUAGE_INVALID']);

      const currency = await errorOf(updateWorkspaceSettings({ defaultCurrencyCode: 'JPY' }, newIdempotencyKey()));
      expect([currency.status, currency.code]).toEqual([422, 'CURRENCY_NOT_ENABLED']);

      const timezone = await errorOf(updateWorkspaceSettings({ timezone: 'Mars/Olympus' }, newIdempotencyKey()));
      expect([timezone.status, timezone.code]).toEqual([422, 'TIMEZONE_INVALID']);

      const offset = await errorOf(updateWorkspaceSettings({ timezone: '+02:00' }, newIdempotencyKey()));
      expect(offset.code).toBe('TIMEZONE_INVALID');
    });

    it('rejects a bad DTO with 400 keyed by the field', async () => {
      const error = await errorOf(updateWorkspaceSettings({ defaultCurrencyCode: 'US' }, newIdempotencyKey()));
      expect(error.status).toBe(400);
      expect(Object.keys(error.details ?? {})).toEqual(['defaultCurrencyCode']);
    });

    // UpdateWorkspaceSettingsDto (@Length(3, 3), @IsBoolean...) fails in Core's ValidationPipe, so the
    // real answer is 400 CORE_VALIDATION_FAILED with details { defaultCurrencyCode: [messages] }.
    it('a bad DTO answers CORE_VALIDATION_FAILED keyed by field', async () => {
      const error = await errorOf(updateWorkspaceSettings({ defaultCurrencyCode: 'US' }, newIdempotencyKey()));
      expect(error.code).toBe('CORE_VALIDATION_FAILED');
      expect(error.details?.['defaultCurrencyCode']).toEqual([expect.any(String)]);
    });

    it('replays the same key and answers GW.IDEM.MISSING / GW.IDEM.BAD_VALUE', async () => {
      const key = newIdempotencyKey();
      const first = await settle(updateWorkspaceSettings({ allowSupport: false }, key));
      expect(await settle(updateWorkspaceSettings({ allowSupport: false }, key))).toEqual(first);

      const missing = await errorOf(updateWorkspaceSettings({ allowSupport: true }, ''));
      expect([missing.status, missing.code]).toEqual([400, 'GW.IDEM.MISSING']);
      const bad = await errorOf(updateWorkspaceSettings({ allowSupport: true }, 'not-a-uuid'));
      expect([bad.status, bad.code]).toEqual([400, 'GW.IDEM.BAD_VALUE']);
    });

    // PUT workspace-settings is WRITE_SENSITIVE at the gateway and Core has no @IdempotencyRequired on it,
    // so a reused key with another body is the gateway's 422 GW.IDEM.MISMATCH (gateway-error.catalog.ts).
    it('reusing a key with another body answers 422 GW.IDEM.MISMATCH', async () => {
      const key = newIdempotencyKey();
      await settle(updateWorkspaceSettings({ allowSupport: false }, key));
      const error = await errorOf(updateWorkspaceSettings({ timezone: 'Asia/Dubai' }, key));
      expect([error.status, error.code]).toEqual([422, 'GW.IDEM.MISMATCH']);
    });
  });

  describe('lookups', () => {
    it('lists the active currency options', async () => {
      const currencies = await settle(listCurrencyCatalogue());
      expect(currencies.map((currency) => currency.code)).toContain('EGP');
      expect(Object.keys(currencies[0]).sort()).toEqual(['code', 'name', 'symbol']);
    });

    it('lists time zones with UTC and an offset label', async () => {
      const zones = await settle(listTimezones());
      const utc = zones.find((zone) => zone.value === 'UTC');
      expect(utc).toBeDefined();
      expect(Object.keys(utc!).sort()).toEqual(['label', 'offset', 'value']);
      expect(zones.some((zone) => zone.value === 'Africa/Cairo')).toBe(true);
    });
  });
});
