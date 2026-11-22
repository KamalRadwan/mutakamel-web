import { describe, expect, it } from 'vitest';
import { ApiError, newIdempotencyKey } from '../../../../shared/widgets/dashboard/analytics-api';
import { FAKE_CATALOG } from '../../../../shared/widgets/dashboard/fake/fake-catalog';
import { errorDetailField } from '../shared/api-error-details';
import {
  fakeCreateAlert,
  fakeDisableAlert,
  fakeListAlerts,
  fakeUpdateAlert,
} from './alerts.fake';
import type { AlertValueUnit, CreateAlertRule } from './alerts.model';

// Contract: crm-app governance/alerts (alerts.dto.ts, alert-rule.service.ts).

function rejection(work: () => unknown): ApiError {
  try {
    work();
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

const metric = FAKE_CATALOG.metrics.find(
  (m) => m.availability === 'AVAILABLE' && ['COUNT', 'PERCENT', 'RATIO', 'DURATION'].includes(m.unit),
)!;

function body(overrides: Partial<CreateAlertRule> = {}): CreateAlertRule {
  return {
    name: 'Low conversion',
    sourceKind: 'METRIC',
    metricKey: metric.key,
    comparator: 'LT',
    threshold: 12.5,
    valueUnit: metric.unit as AlertValueUnit,
    timeZone: 'Africa/Cairo',
    scheduleKind: 'DAILY',
    scheduleMinute: 540,
    ...overrides,
  };
}

describe('alerts fake (backend contract)', () => {
  it('pages with pageInfo and the default limit 25', () => {
    expect(fakeListAlerts().pageInfo.limit).toBe(25);
  });

  it('creates a disabled rule with the backend defaults and a rounded threshold', () => {
    const rule = fakeCreateAlert(body(), newIdempotencyKey());
    expect(rule.state).toBe('DISABLED');
    expect(rule.channels).toEqual(['IN_APP']);
    expect(rule.cooldownMinutes).toBe(1440);
    expect(rule.threshold).toBe(metric.unit === 'COUNT' ? '13' : '12.5000');
  });

  it('enforces the gateway key and answers a reused key with 422 CRM_IDEMPOTENCY_KEY_REUSED', () => {
    expect(rejection(() => fakeCreateAlert(body(), '')).code).toBe('GW.IDEM.MISSING');
    expect(rejection(() => fakeCreateAlert(body(), 'abc')).code).toBe('GW.IDEM.BAD_VALUE');
    const key = newIdempotencyKey();
    const first = fakeCreateAlert(body({ name: 'Replay me' }), key);
    expect(fakeCreateAlert(body({ name: 'Replay me' }), key).id).toBe(first.id);
    const reused = rejection(() => fakeCreateAlert(body({ name: 'Other' }), key));
    expect([reused.status, reused.code]).toEqual([422, 'CRM_IDEMPOTENCY_KEY_REUSED']);
  });

  it('answers DTO violations with 400 and { field: [snake_case] } details', () => {
    const error = rejection(() => fakeCreateAlert(body({ cooldownMinutes: 50_000 }), newIdempotencyKey()));
    expect([error.status, error.code]).toEqual([400, 'CRM_VALIDATION_FAILED']);
    expect(error.details).toEqual({ cooldownMinutes: ['max'] });
    expect(errorDetailField(error)).toBe('cooldownMinutes');
  });

  it('answers missing required fields with 400 and no details (service validationFailed)', () => {
    const error = rejection(() => fakeCreateAlert(body({ timeZone: undefined }), newIdempotencyKey()));
    expect([error.status, error.code, error.details]).toEqual([400, 'CRM_VALIDATION_FAILED', undefined]);
  });

  it('keeps business errors without details', () => {
    const schedule = rejection(() =>
      fakeCreateAlert(body({ scheduleKind: 'DAILY', scheduleWeekday: 2 }), newIdempotencyKey()),
    );
    expect([schedule.status, schedule.code, schedule.details]).toEqual([422, 'CRM_ALERT_SCHEDULE_INVALID', undefined]);
    const currency = rejection(() => fakeCreateAlert(body({ currencyCode: 'EGP' }), newIdempotencyKey()));
    expect([currency.status, currency.code]).toEqual([422, 'CRM_ALERT_UNIT_MISMATCH']);
    const recipients = rejection(() =>
      fakeCreateAlert(body({ recipientMode: 'USERS', recipientUserIds: [] }), newIdempotencyKey()),
    );
    expect([recipients.status, recipients.code]).toEqual([422, 'CRM_ALERT_RECIPIENTS_INVALID']);
  });

  it('checks the revision on update and leaves an already disabled rule unchanged', () => {
    const rule = fakeCreateAlert(body({ name: 'Stale check' }), newIdempotencyKey());
    const stale = rejection(() => fakeUpdateAlert(rule.id, { revision: rule.revision + 5, name: 'X' }));
    expect([stale.status, stale.code]).toEqual([409, 'CRM_ALERT_REVISION_STALE']);
    const same = fakeDisableAlert(rule.id, rule.revision);
    expect(same.revision).toBe(rule.revision);
  });
});
