import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupWidgetTest } from '../builder-test-support';
import { StepScope } from './step-scope';
import { OrgApi } from '../../../../../../shared/widgets/dashboard/org.api';
import { CrmHttpStub } from '../../../../shared/testing/crm-http-testing';
import { bindCrmHttpForTest } from '../../../../shared/crm-http';
import { widgetCatalog } from '../builder-test-support';
import { CoreHttp } from '../../../../../../core/api/core-http';
import { ApiError } from '../../../../../../core/api/api-errors';

class ScopeHarness extends StepScope {
  get pipelinesForTest() { return this.pipelineOptions(); }
  get currenciesForTest() { return this.currencyOptions(); }
  get fieldsForTest() { return this.filterFields(); }
  customPeriod() { this.onPresetChange('CUSTOM'); }
}

describe('live builder scope domains', () => {
  let env: ReturnType<typeof setupWidgetTest>;
  beforeEach(() => {
    env = setupWidgetTest();
    TestBed.configureTestingModule({ providers: [{ provide: CoreHttp, useValue: { readPage: vi.fn() } }] });
    env.initialize();
  });
  afterEach(() => env.restore());

  it('uses server pipeline labels, active currency codes and filter domains', () => {
    vi.spyOn(env.state, 'pipelines').mockReturnValue([{ id: 'real-pipeline', nameEn: 'Wholesale', nameAr: 'الجملة' }]);
    env.state.currencies.set(['JPY']);
    env.state.filterDomains.set({ 'leads.sourceId': [{ value: 'real-source', labelEn: 'Fair', labelAr: 'معرض' }] });
    env.state.patchQuery({ series: [{ metricKey: 'crm.leads.count' }] });
    const scope = TestBed.runInInjectionContext(() => new ScopeHarness());
    expect(scope.pipelinesForTest.at(-1)).toEqual({ value: 'real-pipeline', label: 'Wholesale' });
    expect(scope.currenciesForTest.map((o) => o.value)).toEqual(['', 'JPY']);
    expect(scope.fieldsForTest.find((f) => f.id === 'leads.sourceId')?.options).toEqual([{ value: 'real-source', label: 'Fair' }]);
  });

  it('loads live builder branches and leaves unauthorized optional directories empty', async () => {
    const rows = [{ id: 'branch', companyId: 'company', name: { en: 'Branch', ar: 'الفرع' } }];
    vi.spyOn(TestBed.inject(OrgApi), 'listGrantedBranches').mockResolvedValue(rows);
    const dispose = bindCrmHttpForTest(new CrmHttpStub({ '/widgets/catalog': widgetCatalog, '/static-data': {} }));
    try {
      await env.state.load(null);
      expect(env.state.loadError()).toBeNull();
      expect(env.state.branches()).toEqual(rows);
      expect(env.state.teams()).toEqual([]);
      expect(env.state.currencies()).toEqual([]);
      expect(env.state.filterDomains()['leads.sourceId']).toEqual([]);
    } finally { dispose(); }
  });

  it('loads every active currency page through the Core currency helper', async () => {
    env.permissions.push('currencies.currency.read');
    vi.spyOn(TestBed.inject(OrgApi), 'listGrantedBranches').mockResolvedValue([]);
    const readPage = vi.mocked(TestBed.inject(CoreHttp).readPage);
    readPage.mockResolvedValueOnce({ data: [{ code: 'JPY', status: 'ACTIVE' }], meta: { page: 1, limit: 100, total: 2, totalPages: 2, hasNext: true, hasPrev: false } });
    readPage.mockResolvedValueOnce({ data: [{ code: 'KWD', status: 'ACTIVE' }], meta: { page: 2, limit: 100, total: 2, totalPages: 2, hasNext: false, hasPrev: true } });
    const dispose = bindCrmHttpForTest(new CrmHttpStub({ '/widgets/catalog': widgetCatalog, '/static-data': {} }));
    try {
      await env.state.load(null);
      expect(env.state.loadError()).toBeNull();
      expect(env.state.currencies()).toEqual(['JPY', 'KWD']);
      expect(readPage.mock.calls.map((call) => call[1]?.['page'])).toEqual([1, 2]);
    } finally { dispose(); }
  });

  it('maps directory failures through the existing builder read state', async () => {
    vi.spyOn(TestBed.inject(OrgApi), 'listGrantedBranches').mockRejectedValue(new ApiError(503, 'GW.UPSTREAM.UNAVAILABLE'));
    const dispose = bindCrmHttpForTest(new CrmHttpStub({ '/widgets/catalog': widgetCatalog, '/static-data': {} }));
    try {
      await env.state.load(null);
      expect(env.state.loadError()).toBe('load-failure');
      expect(env.state.branches()).toEqual([]);
    } finally { dispose(); }
  });

  it('defaults custom dates from the current instant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-04-18T12:00:00Z'));
    const scope = TestBed.runInInjectionContext(() => new ScopeHarness());
    scope.customPeriod();
    expect(env.state.draft().querySpec.filters).toMatchObject({ dateFrom: '2030-04-01', dateTo: '2030-04-18' });
  });
});
