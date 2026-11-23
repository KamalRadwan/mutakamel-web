import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { getWidgetCatalog } from '../../../../../shared/widgets/dashboard/analytics.api';
import { bindCrmHttpForTest, CrmHttp, crmQueries } from '../../../shared/crm-http';
import { listOwnerOptions, listWidgets } from '../widgets.api';

describe('Widgets library HTTP contract', () => {
  let http: HttpTestingController;
  let dispose: () => void;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    crmQueries().clear();
    dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
  });

  afterEach(() => {
    http.verify();
    crmQueries().clear();
    dispose();
    TestBed.resetTestingModule();
  });

  it('sends every filter and cursor and preserves the bare server page', async () => {
    const query = {
      access: 'TEAM' as const, status: 'ARCHIVED' as const, source: 'unclassified',
      ownerUserId: '019a9c30-1234-7000-8000-000000000001', search: '  Revenue  ',
      cursor: '019a9c30-1234-7000-8000-000000000002', limit: 75,
    };
    const pending = listWidgets(query);
    const request = http.expectOne((r) => r.url === '/api/tenant/crm/v1/widgets');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys().sort()).toEqual(Object.keys(query).sort());
    for (const [key, value] of Object.entries(query)) {
      expect(request.request.params.get(key)).toBe(String(value).trim());
    }
    expect(request.request.withCredentials).toBe(true);
    for (const header of ['x-mutakamel-company-id', 'x-mutakamel-branch-id', 'x-idempotency-key']) {
      expect(request.request.headers.has(header)).toBe(false);
    }
    expect(crmQueries().getQueryCache().getAll()[0].queryKey.slice(0, 2)).toEqual(['crm-analytics', 'widgets']);
    const response = { items: [], nextCursor: '019a9c30-1234-7000-8000-000000000003' };
    request.flush(response);
    expect(await pending).toEqual(response);
  });

  it('uses 50 by default and omits empty query values', async () => {
    const pending = listWidgets({ cursor: null, search: '  ' });
    const request = http.expectOne((r) => r.url === '/api/tenant/crm/v1/widgets');
    expect(request.request.params.keys()).toEqual(['limit']);
    expect(request.request.params.get('limit')).toBe('50');
    request.flush({ items: [], nextCursor: null });
    expect(await pending).toEqual({ items: [], nextCursor: null });
  });

  it('reuses the real owner-options and widget catalog adapters without scope headers', async () => {
    const owners = listOwnerOptions('  Owner  ');
    const ownerRequest = http.expectOne((r) => r.url === '/api/tenant/crm/v1/widgets/owner-options');
    expect(ownerRequest.request.params.get('search')).toBe('Owner');
    expect(ownerRequest.request.params.get('limit')).toBe('50');
    expect(ownerRequest.request.headers.has('x-mutakamel-company-id')).toBe(false);
    expect(ownerRequest.request.headers.has('x-mutakamel-branch-id')).toBe(false);
    const page = { items: [{ id: 'owner', name: 'Server owner' }, { id: 'unnamed', name: null }], nextCursor: null };
    ownerRequest.flush(page);
    expect(await owners).toEqual({
      ...page, items: [{ id: 'owner', name: 'Server owner' }, { id: 'unnamed', name: 'unnamed' }],
    });

    const catalog = getWidgetCatalog();
    const catalogRequest = http.expectOne('/api/tenant/crm/v1/widgets/catalog');
    expect(catalogRequest.request.headers.has('x-mutakamel-company-id')).toBe(false);
    expect(catalogRequest.request.headers.has('x-mutakamel-branch-id')).toBe(false);
    catalogRequest.flush({ metrics: [], dimensions: [], visualizations: [] });
    expect(await catalog).toEqual({ metrics: [], dimensions: [], visualizations: [] });
  });

  it.each([
    [400, 'CRM_VALIDATION_FAILED'], [401, 'GW.AUTH.UNAUTHORIZED'],
    [403, 'CRM_SCOPED_PERMISSION_DENIED'], [404, 'CRM_WIDGET_NOT_FOUND'],
    [500, 'COMMON.GENERIC.INTERNAL_ERROR'], [503, 'CRM_TEAM_SCOPE_NOT_READY'],
  ])('preserves %s errors and correlation ids without retrying', async (status, code) => {
    const pending = listWidgets({});
    const rejected = expect(pending).rejects.toMatchObject({ status, code, correlationId: 'request-1' });
    http.expectOne((r) => r.url === '/api/tenant/crm/v1/widgets')
      .flush({ errorCode: code, correlationId: 'request-1' }, { status, statusText: 'Error' });
    await rejected;
    http.expectNone((r) => r.url === '/api/tenant/crm/v1/widgets');
  });

  it('preserves rate-limit delay and a lost connection', async () => {
    const limited = listWidgets({});
    const rejected = expect(limited).rejects.toMatchObject({ status: 429, details: { retryAfterSeconds: ['9'] } });
    http.expectOne((r) => r.url === '/api/tenant/crm/v1/widgets').flush(
      { code: 'GW.RATE.LIMIT_EXCEEDED' }, { status: 429, statusText: 'Limited', headers: { 'Retry-After': '9' } },
    );
    await rejected;

    const offline = listWidgets({});
    const offlineRejected = expect(offline).rejects.toEqual(new ApiError(0, 'NETWORK_ERROR'));
    http.expectOne((r) => r.url === '/api/tenant/crm/v1/widgets').error(new ProgressEvent('error'));
    await offlineRejected;
  });
});
