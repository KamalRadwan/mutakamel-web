import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import {
  getEmailConfig,
  liftSuppression,
  lookupSuppression,
  patchEmailConfig,
  verifyEmailDomain,
  verifySmtpConnection,
} from './email.api';
import { FAKE_EMAIL_BUMP_REVISION, FAKE_EMAIL_FAIL_NEXT, resetEmailFake } from './email.fake';

/*
 * email.api.ts over email.fake.ts: the config is a single record { config, revision } (no page),
 * guarded by If-Match revision (428 / 409), with x-idempotency-key on every write.
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

describe('email api (fake)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetEmailFake();
  });
  afterEach(() => vi.useRealTimers());

  describe('getEmailConfig', () => {
    it('returns the single record { config, revision } with no page meta', async () => {
      const result = await settle(getEmailConfig());
      expect(Object.keys(result).sort()).toEqual(['config', 'revision']);
      expect(result.revision).toBe(7);
      expect(result.config).toMatchObject({ revision: 7, providerDriver: 'smtp', status: 'SUSPENDED', smtpPasswordConfigured: true });
      expect(result.config).not.toHaveProperty('smtpPassword');
    });

    it('maps FAIL_NEXT codes to their default status', async () => {
      FAKE_EMAIL_FAIL_NEXT.code = 'TENANT_EMAIL_CONFIG_NOT_READY';
      const notReady = await errorOf(getEmailConfig());
      expect([notReady.status, notReady.code]).toEqual([503, 'TENANT_EMAIL_CONFIG_NOT_READY']);
      FAKE_EMAIL_FAIL_NEXT.code = 'NETWORK';
      expect((await errorOf(getEmailConfig())).status).toBe(0);
      await expect(settle(getEmailConfig())).resolves.toBeTruthy();
    });
  });

  describe('patchEmailConfig', () => {
    it('saves a change, bumps the revision and recomputes effective quotas', async () => {
      const result = await settle(patchEmailConfig({ fromName: 'Acme Mail', dailyQuota: 500 }, 7, newIdempotencyKey()));
      expect(result.revision).toBe(8);
      expect(result.config).toMatchObject({ fromName: 'Acme Mail', dailyQuota: 500, effectiveDailyQuota: 500 });
      expect((await settle(getEmailConfig())).revision).toBe(8);
    });

    it('resets DKIM verification when the sender tuple changes', async () => {
      await settle(verifyEmailDomain(7, newIdempotencyKey()));
      const result = await settle(patchEmailConfig({ dkimSelector: 'mt2' }, 8, newIdempotencyKey()));
      expect(result.config).toMatchObject({ dkimSelector: 'mt2', dkimVerified: false, verifiedAt: null, status: 'SUSPENDED' });
    });

    it('switching to a non-SMTP driver clears the SMTP block', async () => {
      const result = await settle(patchEmailConfig({ providerDriver: 'platform-shared' }, 7, newIdempotencyKey()));
      expect(result.config).toMatchObject({
        providerDriver: 'platform-shared',
        credentialsMode: 'PLATFORM_SHARED',
        smtpHost: null,
        smtpPort: null,
        smtpPasswordConfigured: false,
      });
    });

    it('answers 428 without a revision and 409 for a stale revision', async () => {
      const missing = await errorOf(patchEmailConfig({ fromName: 'X' }, 0, newIdempotencyKey()));
      expect([missing.status, missing.code]).toEqual([428, 'TENANT_EMAIL_CONFIG_PRECONDITION_REQUIRED']);
      FAKE_EMAIL_BUMP_REVISION();
      const stale = await errorOf(patchEmailConfig({ fromName: 'X' }, 7, newIdempotencyKey()));
      expect([stale.status, stale.code]).toEqual([409, 'TENANT_EMAIL_CONFIG_STALE_REVISION']);
    });

    it('answers the patch business codes', async () => {
      const empty = await errorOf(patchEmailConfig({}, 7, newIdempotencyKey()));
      expect([empty.status, empty.code]).toEqual([400, 'TENANT_EMAIL_CONFIG_EMPTY_PATCH']);

      const invalid = await errorOf(patchEmailConfig({ smtpPort: 2526 } as never, 7, newIdempotencyKey()));
      // @IsIn(SMTP_ALLOWED_PORTS) fails in Core's ValidationPipe: 400 keyed by field.
      expect([invalid.status, invalid.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
      expect(invalid.details).toEqual({ smtpPort: ['smtpPort is not valid'] });

      // tenant-email-config.policy.ts invalid(): 422 with a message and no details.
      const domain = await errorOf(patchEmailConfig({ fromAddress: 'a@other.example' }, 7, newIdempotencyKey()));
      expect([domain.status, domain.code]).toEqual([422, 'TENANT_EMAIL_CONFIG_INVALID']);
      expect(domain.details).toBeUndefined();

      const plan = await errorOf(patchEmailConfig({ dailyQuota: 20_000 }, 7, newIdempotencyKey()));
      expect([plan.status, plan.code]).toEqual([422, 'TENANT_EMAIL_CONFIG_QUOTA_EXCEEDS_PLAN']);

      const noChange = await errorOf(patchEmailConfig({ fromName: 'Acme Support' }, 7, newIdempotencyKey()));
      expect([noChange.status, noChange.code]).toEqual([422, 'TENANT_EMAIL_CONFIG_NO_CHANGES']);

      const activate = await errorOf(patchEmailConfig({ status: 'ACTIVE' }, 7, newIdempotencyKey()));
      expect([activate.status, activate.code]).toEqual([422, 'TENANT_EMAIL_CONFIG_INVALID']);
    });

    it('rejects SMTP fields for a non-SMTP driver with TENANT_SMTP_SETTINGS_INVALID', async () => {
      const error = await errorOf(patchEmailConfig({ providerDriver: 'ses', smtpHost: 'x.example' }, 7, newIdempotencyKey()));
      expect([error.status, error.code]).toEqual([422, 'TENANT_SMTP_SETTINGS_INVALID']);
    });

    it('toggles status alone after verification', async () => {
      const verified = await settle(verifyEmailDomain(7, newIdempotencyKey()));
      const active = await settle(patchEmailConfig({ status: 'ACTIVE' }, verified.revision, newIdempotencyKey()));
      expect(active.config.status).toBe('ACTIVE');
      expect(active.revision).toBe(verified.revision + 1);
    });

    it('replays a key and answers GW.IDEM.MISSING / GW.IDEM.BAD_VALUE', async () => {
      const key = newIdempotencyKey();
      const first = await settle(patchEmailConfig({ fromName: 'Replay' }, 7, key));
      const second = await settle(patchEmailConfig({ fromName: 'Replay' }, 7, key));
      expect(second).toEqual(first);
      expect((await settle(getEmailConfig())).revision).toBe(8);

      const missing = await errorOf(patchEmailConfig({ fromName: 'X' }, 8, ''));
      expect([missing.status, missing.code]).toEqual([400, 'GW.IDEM.MISSING']);
      const bad = await errorOf(patchEmailConfig({ fromName: 'X' }, 8, 'bad'));
      expect([bad.status, bad.code]).toEqual([400, 'GW.IDEM.BAD_VALUE']);
    });

    // PATCH email-config is WRITE_SENSITIVE at the gateway, which checks the key before Core's own
    // IdempotencyInterceptor: a reused key with another request is 422 GW.IDEM.MISMATCH.
    it('reusing a key with a different body answers 422 GW.IDEM.MISMATCH', async () => {
      const key = newIdempotencyKey();
      await settle(patchEmailConfig({ fromName: 'First' }, 7, key));
      const error = await errorOf(patchEmailConfig({ fromName: 'Second' }, 8, key));
      expect([error.status, error.code]).toEqual([422, 'GW.IDEM.MISMATCH']);
    });
  });

  describe('verifyEmailDomain and verifySmtpConnection', () => {
    it('verifies the domain and bumps the revision', async () => {
      const result = await settle(verifyEmailDomain(7, newIdempotencyKey()));
      expect(result.revision).toBe(8);
      expect(result.config.dkimVerified).toBe(true);
      expect(result.config.verifiedAt).not.toBeNull();
    });

    it('answers TENANT_EMAIL_CONFIG_VERIFICATION_FAILED without a selector', async () => {
      const cleared = await settle(patchEmailConfig({ dkimSelector: null }, 7, newIdempotencyKey()));
      const error = await errorOf(verifyEmailDomain(cleared.revision, newIdempotencyKey()));
      expect([error.status, error.code]).toEqual([422, 'TENANT_EMAIL_CONFIG_VERIFICATION_FAILED']);
    });

    it('answers TENANT_EMAIL_CONFIG_DKIM_PROOF_NOT_REGISTERED for an unregistered selector', async () => {
      const changed = await settle(patchEmailConfig({ dkimSelector: 'unregistered' }, 7, newIdempotencyKey()));
      const error = await errorOf(verifyEmailDomain(changed.revision, newIdempotencyKey()));
      expect(error.code).toBe('TENANT_EMAIL_CONFIG_DKIM_PROOF_NOT_REGISTERED');
    });

    it('verifies the SMTP connection or explains why it cannot', async () => {
      expect(await settle(verifySmtpConnection(newIdempotencyKey()))).toEqual({ verified: true });

      const down = await settle(patchEmailConfig({ smtpHost: 'down.example' }, 7, newIdempotencyKey()));
      const failed = await errorOf(verifySmtpConnection(newIdempotencyKey()));
      expect([failed.status, failed.code]).toEqual([422, 'TENANT_SMTP_CONNECTION_FAILED']);

      await settle(patchEmailConfig({ providerDriver: 'ses' }, down.revision, newIdempotencyKey()));
      const unavailable = await errorOf(verifySmtpConnection(newIdempotencyKey()));
      expect(unavailable.code).toBe('TENANT_SMTP_CONNECTION_VERIFICATION_UNAVAILABLE');
    });
  });

  describe('suppressions', () => {
    it('looks up a suppressed and a clean address', async () => {
      expect(await settle(lookupSuppression(' Blocked@Example.com '))).toEqual({
        suppressed: true,
        reasonCode: 'HARD_BOUNCE',
        firstOccurredAt: '2026-11-02T08:15:00.000Z',
        lastOccurredAt: '2026-11-19T14:42:00.000Z',
      });
      expect(await settle(lookupSuppression('clean@example.com'))).toEqual({ suppressed: false });
    });

    it('lifts a suppression once', async () => {
      expect(await settle(liftSuppression('spam@example.com', newIdempotencyKey()))).toEqual({ suppressed: false, lifted: true });
      expect(await settle(liftSuppression('spam@example.com', newIdempotencyKey()))).toEqual({ suppressed: false, lifted: false });
      expect(await settle(lookupSuppression('spam@example.com'))).toEqual({ suppressed: false });
    });

    it('answers 400 for a malformed address', async () => {
      const error = await errorOf(lookupSuppression('not-an-email'));
      expect(error.status).toBe(400);
      expect(error.code).toBe('CORE_VALIDATION_FAILED');
      expect(Object.keys(error.details ?? {})).toEqual(['address']);
    });
  });
});
