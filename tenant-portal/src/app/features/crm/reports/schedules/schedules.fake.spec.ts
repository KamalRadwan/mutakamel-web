import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, newIdempotencyKey } from '../../../../shared/widgets/dashboard/analytics-api';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { ANALYTICS_PERMISSIONS_FIXTURE } from '../../../../shared/widgets/dashboard/analytics-permissions.fixture';
import { FAKE_ME, FAKE_PEOPLE } from '../../../../shared/widgets/dashboard/fake/fake-org';
import {
  fakeCreateSubscription,
  fakeDisableSubscription,
  fakeEnableSubscription,
  fakeListDeliveries,
  fakeListSubscriptions,
  fakeResumeSubscription,
  fakeUpdateSubscription,
} from './schedules.fake';
import type { CreateSubscription } from './schedules.model';

beforeEach(() => bindAnalyticsPermissions(() => ANALYTICS_PERMISSIONS_FIXTURE));
afterEach(() => bindAnalyticsPermissions(() => []));

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
    return error as ApiError;
  }
  throw new Error('expected an ApiError');
}

const DASHBOARD = '01934b10-0000-7000-8000-000000001001';

function createBody(overrides: Partial<CreateSubscription> = {}): CreateSubscription {
  return {
    name: 'Daily digest',
    dashboardId: DASHBOARD,
    periodToken: 'PREVIOUS_DAY',
    recurrence: 'DAILY',
    scheduleMinute: 540,
    timeZone: 'Africa/Cairo',
    startsOn: '2026-12-01',
    recipients: [FAKE_ME.id],
    ...overrides,
  };
}

describe('subscriptions fake (/crm/analytics/subscriptions)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('lists { items, pageInfo, capabilities } newest first with PDF unavailable', async () => {
    const page = await settle(fakeListSubscriptions());
    expect(page.pageInfo.limit).toBe(25);
    const updated = page.items.map((item) => item.updatedAt);
    expect(updated).toEqual([...updated].sort().reverse());
    expect(page.capabilities.formats.find((f) => f.format === 'PDF')).toEqual({
      format: 'PDF',
      available: false,
      reason: 'PDF_RENDERER_UNAVAILABLE',
    });
    expect(page.items.every((item) => typeof item.dashboardId === 'string' && Array.isArray(item.recipients))).toBe(true);
  });

  it('creates a disabled subscription with no next run and returns capabilities', async () => {
    const created = await settle(fakeCreateSubscription(createBody(), newIdempotencyKey()));
    expect(created).toMatchObject({ enabled: false, nextRunAt: null, revision: 1, locale: 'ar', linkTtlHours: 168 });
    expect(created.capabilities.formats).toHaveLength(3);
  });

  it('a report subscription points at the owner REPORT row', async () => {
    const created = await settle(
      fakeCreateSubscription(createBody({ dashboardId: undefined, reportKey: 'lead-acquisition' }), newIdempotencyKey()),
    );
    expect(created.reportKey).toBe('lead-acquisition');
    expect(created.dashboardId).toBe('01934b60-0000-7000-8000-000000000001');
  });

  it('returns 400 CRM_VALIDATION_FAILED with snake_case details for DTO failures', async () => {
    const error = await errorOf(
      fakeCreateSubscription(createBody({ name: '  ', recipients: [], linkTtlHours: 721 }), newIdempotencyKey()),
    );
    expect([error.status, error.code]).toEqual([400, 'CRM_VALIDATION_FAILED']);
    expect(error.details).toEqual({ name: ['min_length'], recipients: ['array_min_size'], linkTtlHours: ['max'] });
  });

  it('refuses a dashboard the caller cannot see', async () => {
    const error = await errorOf(
      fakeCreateSubscription(createBody({ dashboardId: '01934b10-0000-7000-8000-00000000ffff' }), newIdempotencyKey()),
    );
    expect([error.status, error.code]).toEqual([422, 'CRM_SUBSCRIPTION_TARGET_INVALID']);
  });

  it('refuses a field the DTO does not declare', async () => {
    const body = { ...createBody(), channel: 'EMAIL' } as unknown as CreateSubscription;
    const error = await errorOf(fakeCreateSubscription(body, newIdempotencyKey()));
    expect(error.details).toEqual({ channel: ['whitelist_validation'] });
  });

  it('maps service rules to 422 codes with lowercase string-array details where the backend sends them', async () => {
    const both = await errorOf(fakeCreateSubscription(createBody({ reportKey: 'lead-acquisition' }), newIdempotencyKey()));
    expect([both.status, both.code, both.details]).toEqual([422, 'CRM_SUBSCRIPTION_TARGET_INVALID', undefined]);
    const weekday = await errorOf(fakeCreateSubscription(createBody({ scheduleWeekday: 1 }), newIdempotencyKey()));
    expect([weekday.code, weekday.details]).toEqual(['CRM_SUBSCRIPTION_SCHEDULE_INVALID', { problems: ['weekday_forbidden'] }]);
    const weekly = await errorOf(fakeCreateSubscription(createBody({ recurrence: 'WEEKLY' }), newIdempotencyKey()));
    expect(weekly.details).toEqual({ problems: ['weekday_required'] });
    const ttl = await errorOf(fakeCreateSubscription(createBody({ attachmentFormats: ['CSV'], linkTtlHours: 200 }), newIdempotencyKey()));
    expect(ttl.code).toBe('CRM_SUBSCRIPTION_ATTACHMENT_TTL_INVALID');
    const pdf = await errorOf(fakeCreateSubscription(createBody({ attachmentFormats: ['PDF'] }), newIdempotencyKey()));
    expect([pdf.code, pdf.details]).toEqual(['CRM_EXPORT_FORMAT_INVALID', { reason: ['pdf_renderer_unavailable'] }]);
    const many = Array.from({ length: 51 }, (_, i) => `01934b10-0000-7000-8000-${String(900000 + i).padStart(12, '0')}`);
    const recipients = await errorOf(fakeCreateSubscription(createBody({ recipients: many }), newIdempotencyKey()));
    expect(recipients.code).toBe('CRM_SUBSCRIPTION_RECIPIENTS_INVALID');
  });

  it('checks the idempotency key and replays the same body', async () => {
    expect((await errorOf(fakeCreateSubscription(createBody(), 'abc'))).code).toBe('CRM_IDEMPOTENCY_KEY_INVALID');
    const key = newIdempotencyKey();
    const first = await settle(fakeCreateSubscription(createBody({ name: 'Replay me' }), key));
    expect((await settle(fakeCreateSubscription(createBody({ name: 'Replay me' }), key))).id).toBe(first.id);
    const reused = await errorOf(fakeCreateSubscription(createBody({ name: 'Other' }), key));
    expect([reused.status, reused.code]).toEqual([422, 'CRM_IDEMPOTENCY_KEY_REUSED']);
  });

  it('update refuses target fields and stale revisions', async () => {
    const created = await settle(fakeCreateSubscription(createBody(), newIdempotencyKey()));
    const target = await errorOf(
      fakeUpdateSubscription(created.id, { revision: 1, dashboardId: DASHBOARD } as never),
    );
    expect(target.details).toEqual({ dashboardId: ['whitelist_validation'] });
    const stale = await errorOf(fakeUpdateSubscription(created.id, { revision: 9, name: 'x' }));
    expect([stale.status, stale.code]).toEqual([409, 'CRM_SUBSCRIPTION_REVISION_STALE']);
    const missing = await errorOf(fakeUpdateSubscription(created.id, { name: 'x' } as never));
    expect(missing.code).toBe('CRM_DASHBOARD_REVISION_MISMATCH');
    const updated = await settle(fakeUpdateSubscription(created.id, { revision: 1, recipients: [FAKE_PEOPLE[1].id] }));
    expect([updated.revision, updated.recipients]).toEqual([2, [FAKE_PEOPLE[1].id]]);
  });

  it('enable computes the next run; disable clears it; resume needs a suspended row', async () => {
    const created = await settle(fakeCreateSubscription(createBody(), newIdempotencyKey()));
    const enabled = await settle(fakeEnableSubscription(created.id, 1));
    expect(enabled.enabled).toBe(true);
    expect(enabled.nextRunAt).not.toBeNull();
    const disabled = await settle(fakeDisableSubscription(created.id, 2));
    expect([disabled.enabled, disabled.nextRunAt]).toEqual([false, null]);
    const notSuspended = await errorOf(fakeResumeSubscription(created.id, 3));
    expect(notSuspended.code).toBe('CRM_SUBSCRIPTION_REVISION_STALE');
    const lost = await errorOf(fakeResumeSubscription('01934b30-0000-7000-8000-000000000005', 6));
    expect([lost.status, lost.code]).toEqual([403, 'CRM_SUBSCRIPTION_OWNER_ACCESS_LOST']);
  });

  it('lists deliveries with backend fields only', async () => {
    const page = await settle(fakeListDeliveries('01934b30-0000-7000-8000-000000000001'));
    const allowed = new Set(['id', 'recipientUserId', 'scheduledFor', 'status', 'skipReason', 'attempts', 'sentAt', 'openedCount', 'lastOpenedAt']);
    expect(page.items.every((row) => Object.keys(row).every((key) => allowed.has(key)))).toBe(true);
    expect(page.items.filter((row) => row.status === 'SKIPPED').every((row) => row.skipReason)).toBe(true);
  });
});
