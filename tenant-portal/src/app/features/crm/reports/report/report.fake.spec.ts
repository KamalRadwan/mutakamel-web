import { describe, expect, it } from 'vitest';
import { ApiError, newIdempotencyKey } from '../../../../shared/widgets/dashboard/analytics-api';
import { errorText } from '../../../../shared/widgets/dashboard/panel-state';
import { buildFakeManifest, buildFakePanelRows, executeFakePinPanel, listFakeDashboards } from './report.fake';

function errorOf(work: () => unknown): ApiError {
  try {
    work();
  } catch (error) {
    return error as ApiError;
  }
  throw new Error('expected an ApiError');
}

const REPORT = 'opportunities-by-stage';

function pageablePanelKey(): string {
  const panel = buildFakeManifest(REPORT).panels.find((p) => p.pageable);
  if (!panel) throw new Error('no pageable panel');
  return panel.panelKey;
}

function pinnablePanelKey(): string {
  const panel = buildFakeManifest(REPORT).panels.find((p) => p.pinnable);
  if (!panel) throw new Error('no pinnable panel');
  return panel.panelKey;
}

describe('report run fake (POST /crm/dashboards/reports/:reportKey)', () => {
  it('returns the filter schema on the manifest GET, and on a run only when asked', () => {
    expect(buildFakeManifest(REPORT).filters.schema.length).toBeGreaterThan(0);
    expect(buildFakeManifest(REPORT, {}, true).filters.schema).toEqual([]);
    expect(buildFakeManifest(REPORT, { includeFilterSchema: true }, true).filters.schema.length).toBeGreaterThan(0);
  });

  it('refuses more than 24 panel keys with a 400 validation error', () => {
    const panelKeys = Array.from({ length: 25 }, (_, i) => `panel-${i}`);
    const error = errorOf(() => buildFakeManifest(REPORT, { panelKeys }, true));
    expect([error.status, error.code, error.details]).toEqual([400, 'CRM_VALIDATION_FAILED', { panelKeys: ['array_max_size'] }]);
  });

  it('ignores undeclared filters and refuses a malformed record id', () => {
    expect(() => buildFakeManifest(REPORT, { filters: { notDeclared: 'x' } }, true)).not.toThrow();
    const error = errorOf(() => buildFakeManifest(REPORT, { filters: { pipelineId: 'pipe-main' } }, true));
    expect([error.status, error.code]).toEqual([422, 'CRM_DASHBOARD_FILTER_INVALID']);
  });

  it('applies the backend period rules', () => {
    expect(errorOf(() => buildFakeManifest(REPORT, { period: { preset: 'MAXIMUM' } }, true)).code).toBe(
      'CRM_DASHBOARD_FILTER_INVALID',
    );
    expect(errorOf(() => buildFakeManifest(REPORT, { period: { from: '2026-05-01', to: '2026-04-01' } }, true)).code).toBe(
      'CRM_DASHBOARD_FILTER_INVALID',
    );
    expect(errorOf(() => buildFakeManifest(REPORT, { period: { from: '2024-01-01', to: '2026-01-03' } }, true)).code).toBe(
      'CRM_DASHBOARD_DATE_RANGE_EXCEEDED',
    );
    expect(errorOf(() => buildFakeManifest(REPORT, { period: { from: '2026/01/01' } }, true)).details).toEqual({
      'period.from': ['matches'],
    });
    expect(buildFakeManifest(REPORT, { period: { from: '2026-01-01', to: '2026-03-31' } }, true).period.kind).toBe('CUSTOM');
  });

  it('resolves YESTERDAY to the day before the anchor, and refuses the old picker-only presets', () => {
    const period = buildFakeManifest(REPORT, { period: { preset: 'YESTERDAY' } }, true).period;
    expect([period.kind, period.from.slice(0, 10), period.to.slice(0, 10)]).toEqual(['YESTERDAY', '2026-11-20', '2026-11-20']);
    for (const preset of ['TODAY_YESTERDAY', 'Q1', 'Q4']) {
      expect(errorOf(() => buildFakeManifest(REPORT, { period: { preset } }, true)).code).toBe('CRM_DASHBOARD_FILTER_INVALID');
    }
  });

  it('accepts a CUSTOM range of exactly 732 days and refuses 733', () => {
    expect(buildFakeManifest(REPORT, { period: { preset: 'CUSTOM', from: '2024-11-20', to: '2026-11-21' } }, true).period.kind).toBe(
      'CUSTOM',
    );
    const tooLong = errorOf(() => buildFakeManifest(REPORT, { period: { preset: 'CUSTOM', from: '2024-11-19', to: '2026-11-21' } }, true));
    expect([tooLong.code, tooLong.details]).toEqual([
      'CRM_DASHBOARD_DATE_RANGE_EXCEEDED',
      { maxDays: ['732'], requestedDays: ['733'] },
    ]);
    expect(errorText(tooLong)).toEqual({ key: 'analytics.errorDetail.dateRangeMax', params: { maxDays: '732' } });
  });

  it('404s an unknown report', () => {
    const error = errorOf(() => buildFakeManifest('no-such-report'));
    expect([error.status, error.code]).toEqual([404, 'CRM_REPORT_NOT_FOUND']);
  });
});

describe('panel rows fake (POST .../panels/:panelKey/rows)', () => {
  it('returns columns, rows, pageInfo, receiptId and coverageNotes without a total', () => {
    const page = buildFakePanelRows(REPORT, pageablePanelKey(), { limit: 10 });
    expect(Object.keys(page).sort()).toEqual(['columns', 'coverageNotes', 'pageInfo', 'receiptId', 'rows']);
    expect(page.pageInfo).toMatchObject({ limit: 10, hasMore: true });
  });

  it('refuses a limit above 100 and a panel without paged rows', () => {
    expect(errorOf(() => buildFakePanelRows(REPORT, pageablePanelKey(), { limit: 101 })).details).toEqual({ limit: ['max'] });
    const notPageable = buildFakeManifest(REPORT).panels.find((p) => !p.pageable)!.panelKey;
    expect(errorOf(() => buildFakePanelRows(REPORT, notPageable)).code).toBe('CRM_REPORT_PANEL_NOT_PAGEABLE');
  });
});

describe('pin fake (POST .../panels/:panelKey/pin)', () => {
  const OWN = '01934b10-0000-7000-8000-000000001001';
  const FULL = '01934b10-0000-7000-8000-000000001003';
  const VIEW_ONLY = '01934b10-0000-7000-8000-000000001004';

  it('lists dashboards as { items, nextCursor } with access levels', () => {
    const page = listFakeDashboards();
    expect(page.nextCursor).toBeNull();
    expect(page.items.map((row) => row.accessLevel)).toContain('VIEW');
  });

  it('needs a UUID v7 idempotency key and replays the same body', () => {
    const body = { dashboardId: OWN, revision: 3 };
    expect(errorOf(() => executeFakePinPanel(REPORT, pinnablePanelKey(), body, 'not-a-key')).code).toBe(
      'CRM_IDEMPOTENCY_KEY_INVALID',
    );
    const key = newIdempotencyKey();
    const first = executeFakePinPanel(REPORT, pinnablePanelKey(), body, key);
    expect(executeFakePinPanel(REPORT, pinnablePanelKey(), body, key)).toEqual(first);
    const reused = errorOf(() => executeFakePinPanel(REPORT, pinnablePanelKey(), { ...body, revision: 4 }, key));
    expect([reused.status, reused.code]).toEqual([422, 'CRM_IDEMPOTENCY_KEY_REUSED']);
  });

  it('maps access, revision and placement-limit failures to the backend codes', () => {
    const panelKey = pinnablePanelKey();
    const pin = (dashboardId: string, revision: number) =>
      errorOf(() => executeFakePinPanel(REPORT, panelKey, { dashboardId, revision }, newIdempotencyKey()));
    expect(pin(VIEW_ONLY, 1).code).toBe('CRM_DASHBOARD_DEFINITION_ACCESS_DENIED');
    expect(pin(FULL, 1).code).toBe('CRM_DASHBOARD_REVISION_CONFLICT');
    expect([pin(FULL, 5).status, pin(FULL, 5).code]).toEqual([409, 'CRM_DASHBOARD_WIDGET_LIMIT']);
    expect(pin('01934b10-0000-7000-8000-000000009999', 1).code).toBe('CRM_DASHBOARD_RESOURCE_NOT_FOUND');
    expect(pin('dash-1', 1).details).toEqual({ dashboardId: ['is_uuid'] });
    expect(errorOf(() => executeFakePinPanel(REPORT, 'missing-panel', { dashboardId: OWN, revision: 1 }, newIdempotencyKey())).code).toBe(
      'CRM_REPORT_PANEL_NOT_PINNABLE',
    );
  });
});
