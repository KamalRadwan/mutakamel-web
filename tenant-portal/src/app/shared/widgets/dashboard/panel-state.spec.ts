import { describe, expect, it } from 'vitest';
import ar from '../../../../../public/i18n/analytics/ar.json';
import en from '../../../../../public/i18n/analytics/en.json';
import type { ExecutionState, WidgetExecution } from './analytics.model';
import {
  errorKey,
  executionStateToPanel,
  isRetryable,
  isThrottled,
  KNOWN_ERRORS,
  KNOWN_REASONS,
  reasonKey,
  viewFromRun,
  warningReasonKeys,
} from './panel-state';

const exec = (extra: Partial<WidgetExecution> = {}): WidgetExecution => ({
  widgetId: 'w', state: 'READY', shape: 'SCALAR', series: [],
  meta: { generatedAt: '2026-11-21T09:00:00Z', warnings: [] }, ...extra,
});

describe('executionStateToPanel', () => {
  it.each<[ExecutionState, string]>([
    ['READY', 'READY'], ['EMPTY', 'EMPTY'], ['RETIRED', 'RETIRED'],
    ['DEADLINE_EXCEEDED', 'TIMEOUT'], ['FAILED', 'ERROR'], ['UNAVAILABLE', 'UNAVAILABLE'],
  ])('maps %s to %s', (state, panel) => {
    expect(executionStateToPanel(state)).toBe(panel);
  });
});

describe('reasonKey and errorKey', () => {
  it('falls back to UNKNOWN for an unknown reason', () => {
    expect(reasonKey('SOMETHING_NEW')).toBe('analytics.reason.UNKNOWN');
  });

  it('falls back to UNKNOWN for a null reason', () => {
    expect(reasonKey(null)).toBe('analytics.reason.UNKNOWN');
  });

  it('strips the colon suffix before resolving a known error', () => {
    expect(errorKey('CRM_DASHBOARD_STATEMENT_TIMEOUT:extra')).toBe('analytics.error.CRM_DASHBOARD_STATEMENT_TIMEOUT');
  });

  it('falls back to GENERIC for an unknown error', () => {
    expect(errorKey('NOPE')).toBe('analytics.error.GENERIC');
  });
});

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('errorKey (%s / %s)', (language, theme) => {
  it('catalogue groups', () => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    const messages: Record<string, string> = language === 'ar' ? ar.error : en.error;
    const groups = [
      'CRM_DASHBOARD_FILTER_INVALID', 'CRM_ANALYTICS_SOURCE_UNAVAILABLE', 'CRM_TARGET_SOURCE_NOT_READY',
      'CRM_INQUIRY_SOURCE_NOT_READY', 'CRM_WIDGET_NOT_FOUND', 'CRM_DELIVERY_LINK_EXPIRED',
      'CRM_DASHBOARD_DRILLDOWN_CURSOR_INVALID', 'CRM_WIDGET_AXIS_REQUIRED', 'CRM_SHARE_PREVIEW_LIMIT_EXCEEDED',
      'CRM_ACCESS_REQUEST_PENDING_EXISTS', 'CRM_OWNERSHIP_TARGET_INACTIVE', 'CRM_ALERT_UNIT_MISMATCH',
      'CRM_SUBSCRIPTION_ATTACHMENT_TTL_INVALID', 'CRM_EXPORT_QUEUE_LIMIT', 'CRM_DELIVERY_RECIPIENT_MISMATCH',
      'CRM_DELIVERY_ENTITLEMENT_REVOKED', 'CRM_REPORT_PANEL_NOT_PAGEABLE', 'CRM_WIDGET_PUBLISH_IMPACT_STALE',
      'GW.AUTH.MISSING_SESSION', 'GW.RATE.LIMIT_EXCEEDED', 'GW.UPSTREAM.BUSY', 'GW.IDEM.MISMATCH',
    ];
    for (const code of groups) {
      expect(errorKey(code)).toBe(`analytics.error.${code}`);
      expect(messages[code]).toBeTruthy();
      if (language === 'ar') expect(messages[code]).toMatch(/[\u0600-\u06ff]/);
    }
    for (const code of KNOWN_ERRORS) {
      expect((en.error as Record<string, string>)[code]).toBeTruthy();
      expect(messages[code]).toBeTruthy();
    }
    expect(Object.keys(ar.error).sort()).toEqual(Object.keys(en.error).sort());
  });
});

describe('viewFromRun', () => {
  it('takes the source key from the error code suffix', () => {
    const view = viewFromRun(exec({ state: 'UNAVAILABLE', error: { code: 'CRM_TARGET_SOURCE_NOT_READY:targets' } }));
    expect(view.sourceKey).toBe('targets');
  });

  it('has no source key when the error code has no suffix', () => {
    expect(viewFromRun(exec({ state: 'FAILED', error: { code: 'X' } })).sourceKey).toBeNull();
  });

  it('uses generatedAt as the computed time', () => {
    expect(viewFromRun(exec()).computedAt).toBe('2026-11-21T09:00:00Z');
  });
});

describe('isRetryable', () => {
  it('is true for timeout and error views only', () => {
    const status = (s: ExecutionState) => isRetryable(viewFromRun(exec({ state: s })));
    expect([status('DEADLINE_EXCEEDED'), status('FAILED'), status('READY'), status('UNAVAILABLE')]).toEqual([true, true, false, false]);
  });
});

describe('closure rules', () => {
  const values = { value: 12 };

  it('maps an application state to unavailable with the reason and no numbers', () => {
    const view = viewFromRun(
      exec({ ...values, meta: { availability: 'APPLICATION_SUSPENDED', generatedAt: 'x', warnings: ['APPLICATION_UNAVAILABLE'] } }),
    );
    expect(view.status).toBe('UNAVAILABLE');
    expect(view.reasonCode).toBe('APPLICATION_SUSPENDED');
    expect(view.execution).toBeNull();
    expect(reasonKey(view.reasonCode)).toBe('analytics.reason.APPLICATION_SUSPENDED');
  });

  it('shows the permission state for SOURCE_PERMISSION_REQUIRED when there is no data', () => {
    const view = viewFromRun(
      exec({ value: null, meta: { availability: 'AVAILABLE', generatedAt: 'x', warnings: ['SOURCE_PERMISSION_REQUIRED'] } }),
    );
    expect(view.status).toBe('DENIED');
    expect(view.reasonCode).toBe('SOURCE_PERMISSION_REQUIRED');
  });

  it('keeps a panel with data ready and exposes partialAccess and warnings', () => {
    const view = viewFromRun(
      exec({ ...values, meta: { partialAccess: true, generatedAt: 'x', warnings: ['OTHER_CURRENCIES'] } }),
    );
    expect(view.status).toBe('READY');
    expect(view.partialAccess).toBe(true);
    expect(warningReasonKeys(view)).toEqual(['analytics.reason.OTHER_CURRENCIES']);
  });

  it('adds the clipped warning when the run budget was exceeded, without turning it into an error', () => {
    const budget = { deadlineMs: 20000, elapsedMs: 20000, statementCount: 3, deadlineExceeded: true };
    const view = viewFromRun(exec(values), undefined, budget);
    expect(view.status).toBe('READY');
    expect(view.warnings).toContain('RUN_BUDGET_CLIPPED');
  });

  it('recognises the 429 concurrency state as throttled and keeps friendly error keys', () => {
    const view = { ...viewFromRun(exec({ state: 'FAILED' })), reasonCode: 'CRM_DASHBOARD_RUN_CONCURRENCY_EXCEEDED' };
    expect(isThrottled(view)).toBe(true);
    expect(errorKey('CRM_DASHBOARD_RUN_CONCURRENCY_EXCEEDED')).toBe('analytics.error.CRM_DASHBOARD_RUN_CONCURRENCY_EXCEEDED');
    expect(errorKey('CRM_DASHBOARD_SPEC_SIZE_VIOLATION')).toBe('analytics.error.CRM_DASHBOARD_SPEC_SIZE_VIOLATION');
  });
});

describe('analytics error and reason texts', () => {
  it.each([
    ['en', en],
    ['ar', ar],
  ])('has a %s text for every known error and reason code', (_lang, json) => {
    const errors: Record<string, string> = json.error;
    const reasons: Record<string, string> = json.reason;
    expect(KNOWN_ERRORS.filter((code) => !errors[code])).toEqual([]);
    expect(KNOWN_REASONS.filter((code) => !reasons[code])).toEqual([]);
  });

  it.each([
    'CRM_IDEMPOTENCY_KEY_REUSED',
    'CRM_IDEMPOTENCY_KEY_INVALID',
    'CRM_DASHBOARD_WIDGET_LIMIT',
    'CRM_DASHBOARD_DEFINITION_ACCESS_DENIED',
    'CRM_PERMISSION_DENIED',
    'CRM_RECEIPT_NOT_FOUND',
  ])('resolves %s to its own text, not the generic one', (code) => {
    expect(errorKey(code)).toBe(`analytics.error.${code}`);
  });
});
