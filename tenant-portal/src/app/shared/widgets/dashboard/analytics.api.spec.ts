import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { bindCrmHttpForTest, CrmHttp, crmQueries } from '../../../features/crm/shared/crm-http';
import { CrmHttpStub } from '../../../features/crm/shared/testing/crm-http-testing';
import type { ReadinessDetail } from '../../../features/crm/settings/data-readiness/readiness.api';
import {
  explainReceipt, getCatalog, getReadiness, getReceipt, getWidgetCatalog, listMetricStats, listReadiness, listShareTargets,
} from './analytics.api';
import { listGovernedTargets } from './governed-target';
import { analyticsNow, ApiError, errorCodeOf } from './analytics-api';
import { listOwnerOptions, listPipelineOptions, listTransferTargets } from './org.api';

const VIEWS = [['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']] as const;
const branchId = '01934b10-0000-7000-8000-000000000101';

describe.each(VIEWS)('AnalyticsApi (%s / %s)', (language, theme) => {
  let dispose: () => void;
  let stub: CrmHttpStub;
  let read: MockInstance<CrmHttpStub['read']>;

  beforeEach(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    stub = new CrmHttpStub({
      '/dashboards/catalog': { metrics: [{ key: 'server.dashboard.metric' }] },
      '/widgets/catalog': { metrics: [{ key: 'server.widget.metric' }] },
      '/dashboards/receipts/receipt-1': { id: 'receipt-1', metricKey: 'crm.leads' },
      '/dashboards/receipts/receipt-1/explain': { receiptId: 'receipt-1', value: { value: '3' } },
      '/analytics/metric-stats': { items: [], pageInfo: { limit: 20, hasMore: false, nextCursor: null } },
      '/targets': { items: [{ id: 'approved-target', targetValue: '12500.50' }], hasNext: false },
    });
    dispose = bindCrmHttpForTest(stub);
    crmQueries().clear();
    read = vi.spyOn(stub, 'read');
  });

  afterEach(() => { dispose(); vi.restoreAllMocks(); });

  it('catalog', async () => {
    expect((await getCatalog()).metrics).toEqual([{ key: 'server.dashboard.metric' }]);
    expect((await getWidgetCatalog()).metrics).toEqual([{ key: 'server.widget.metric' }]);
    expect(read.mock.calls).toEqual([['/dashboards/catalog'], ['/widgets/catalog']]);
    expect(crmQueries().getQueryCache().getAll().every((query) => query.queryKey[0] === 'crm-analytics')).toBe(true);
    expect(stub.recordedWrites()).toEqual([]);
  });

  it('readiness delegates to settings', async () => {
    const detail: ReadinessDetail = {
      sourceKey: 'crm.leads', sourceFamily: 'CRM_CURRENT', ownerModule: 'crm', status: 'READY',
      reasonCode: null, uiState: 'AVAILABLE', lagSeconds: 0, freshnessSloSeconds: 60, stale: false,
      watermarkAt: null, coverageStartedAt: null, backfillFloorAt: null, lastCheckedAt: null,
      statusChangedAt: '2026-11-23T00:00:00Z', revision: 1, affectedReportCount: 0,
      captureSourceKey: null, lastConfirmedAt: null, watermarkPinned: null, affected: [],
      pageInfo: { limit: 7, hasMore: false, nextCursor: null },
    };
    const items = [detail, { ...detail, sourceKey: 'crm.other', status: 'NOT_READY' as const }];
    read.mockResolvedValueOnce({ items }).mockResolvedValueOnce(detail);
    expect(await listReadiness('READY')).toEqual({ items: [items[0]] });
    expect(await getReadiness('crm.leads', 'cursor', 7)).toEqual(detail);
    expect(read.mock.calls).toEqual([
      ['/analytics/readiness'], ['/analytics/readiness/crm.leads', { cursor: 'cursor', limit: 7 }],
    ]);
    expect(crmQueries().getQueryCache().getAll().map((query) => query.queryKey)).toEqual([
      ['crm-settings', 'data-readiness'], ['crm-settings', 'data-readiness', 'crm.leads', 'cursor', 7],
    ]);
  });

  it('receipts and explain', async () => {
    expect(read).not.toHaveBeenCalled();
    expect((await getReceipt('receipt-1')).id).toBe('receipt-1');
    expect((await explainReceipt('receipt-1', 'receipt-2')).receiptId).toBe('receipt-1');
    expect(read.mock.calls).toEqual([
      ['/dashboards/receipts/receipt-1'],
      ['/dashboards/receipts/receipt-1/explain', { compareTo: 'receipt-2' }],
    ]);
    await explainReceipt('receipt-1');
    expect(read).toHaveBeenLastCalledWith('/dashboards/receipts/receipt-1/explain', { compareTo: undefined });
  });

  it('metric stats range', async () => {
    for (const [from, to] of [
      ['2026-01-01', '2026-04-03'], ['2026-02-30', '2026-03-01'], ['2026-04-01', '2026-03-01'],
    ]) {
      await expect(listMetricStats({ from, to })).rejects.toMatchObject({ status: 422, code: 'CRM_DASHBOARD_FILTER_INVALID' });
    }
    expect(read).not.toHaveBeenCalled();
    const query = { from: '2026-01-01', to: '2026-04-02', metricKey: 'crm.leads', cursor: 'next', limit: 20 };
    await listMetricStats(query);
    expect(read).toHaveBeenCalledExactlyOnceWith('/analytics/metric-stats', query);
    await listMetricStats({ from: '2026-02-01', to: '2026-02-01' });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('propagates server errors with their correlation id', async () => {
    const error = new ApiError(503, 'CRM_ANALYTICS_SOURCE_UNAVAILABLE', undefined, { correlationId: 'request-1' });
    read.mockRejectedValueOnce(error);
    await expect(getCatalog()).rejects.toBe(error);
  });
});

describe.each(VIEWS)('GovernedTarget (%s / %s)', (language, theme) => {
  it('branch required', async () => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    const stub = new CrmHttpStub();
    const read = vi.spyOn(stub, 'read').mockResolvedValueOnce({
      items: [{ id: 'page-1' }], hasNext: true,
    }).mockResolvedValueOnce({ items: [{ id: 'page-2' }], hasNext: false });
    const dispose = bindCrmHttpForTest(stub);
    try {
      await expect(listGovernedTargets('crm.won', 'MONTH', '')).rejects.toMatchObject({
        code: 'CRM_VALIDATION_FAILED', details: { branchId: ['is_uuid'] },
      });
      expect(read).not.toHaveBeenCalled();
      expect(await listGovernedTargets('crm.won', 'MONTH', branchId)).toEqual([{ id: 'page-1' }, { id: 'page-2' }]);
      expect(read.mock.calls).toEqual([1, 2].map((page) => ['/targets', {
        branchId, metricKey: 'crm.won', periodGrain: 'MONTH', approvalState: 'APPROVED', page, limit: 100,
      }]));
    } finally { dispose(); }
  });
});

describe.each(VIEWS)('analytics-api (%s / %s)', (language, theme) => {
  it('real clock', () => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2031-06-01T00:00:00Z'));
      expect(analyticsNow()).toBe('2031-06-01T00:00:00.000Z');
      vi.advanceTimersByTime(1500);
      expect(analyticsNow()).toBe('2031-06-01T00:00:01.500Z');
      expect(errorCodeOf(new ApiError(409, 'CRM_DASHBOARD_REVISION_CONFLICT'))).toBe('CRM_DASHBOARD_REVISION_CONFLICT');
      expect(errorCodeOf(null)).toBeNull();
    } finally { vi.useRealTimers(); }
  });
});

describe('AnalyticsApi transport', () => {
  it('uses bare CRM reads without organization scope headers', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
    const calls: [() => Promise<unknown>, string, object][] = [
      [getCatalog, '/dashboards/catalog', { metrics: [] }],
      [getWidgetCatalog, '/widgets/catalog', { metrics: [] }],
      [() => getReceipt('receipt'), '/dashboards/receipts/receipt', { id: 'receipt' }],
      [() => explainReceipt('receipt', 'previous'), '/dashboards/receipts/receipt/explain', { receiptId: 'receipt' }],
      [() => listMetricStats({ from: '2026-01-01', to: '2026-01-02' }), '/analytics/metric-stats', { items: [], pageInfo: {} }],
      [() => listGovernedTargets('crm.won', 'MONTH', branchId), '/targets', { items: [], hasNext: false }],
      [() => listShareTargets('dashboards'), '/dashboards/share-targets', { items: [] }],
      [() => listShareTargets('widgets'), '/widgets/share-targets', { items: [] }],
      [listOwnerOptions, '/widgets/owner-options', { items: [], nextCursor: null }],
      [() => listTransferTargets('widget'), '/widgets/widget/ownership-transfer/targets', { items: [], nextCursor: null }],
      [listPipelineOptions, '/pipelines', []],
    ];
    try {
      for (const [call, path, body] of calls) {
        const result = call();
        const request = http.expectOne((req) => req.url === `/api/tenant/crm/v1${path}`);
        expect(request.request.method).toBe('GET');
        expect(request.request.withCredentials).toBe(true);
        expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
        expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
        request.flush(body);
        await expect(result).resolves.toEqual(path === '/targets' ? [] : body);
      }
      http.verify();
    } finally { dispose(); }
  });
});
