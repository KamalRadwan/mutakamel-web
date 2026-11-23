import { DOCUMENT } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreHttp } from '../../../../../core/api/core-http';
import { CrmHttp, bindCrmHttpForTest, crmQueries } from '../../../shared/crm-http';
import { getReceipt, explainReceipt } from '../../../../../shared/widgets/dashboard/analytics.api';
import { drilldown, getDashboard, runDashboard } from '../dashboards.api';
import { dashboardDetail, dashboardId, dashboardRun, receipt, receiptId, widgetId } from './dashboard-test-support';

const base = '/api/tenant/crm/v1';
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
for (const language of ['en', 'ar']) for (const theme of ['light', 'dark']) {
  describe(`Dashboard read API ${language} ${theme}`, () => {
    let http: HttpTestingController;
    let dispose: () => void;
    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), CoreHttp, CrmHttp,
        { provide: DOCUMENT, useValue: { cookie: '__Host-mutakamel-tenant-csrf=test-csrf', location: { protocol: 'https:' } } },
      ] });
      http = TestBed.inject(HttpTestingController); crmQueries().clear();
      dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
    });
    afterEach(() => { http.verify(); crmQueries().clear(); dispose(); TestBed.resetTestingModule(); });
    async function request(path: string): Promise<TestRequest> {
      let found: TestRequest | undefined;
      await vi.waitFor(() => { found = http.expectOne((req) => req.url === `${base}${path}`); });
      return found!;
    }
    function headers(req: TestRequest, post: boolean) {
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.headers.get('x-mutakamel-company-id')).toBeNull();
      expect(req.request.headers.get('x-mutakamel-branch-id')).toBeNull();
      expect(req.request.headers.get('If-Match')).toBeNull();
      if (post) {
        expect(req.request.headers.get('x-idempotency-key')).toMatch(uuidV7);
        expect(req.request.headers.get('x-csrf-token')).toBe('test-csrf');
      } else expect(req.request.headers.get('x-idempotency-key')).toBeNull();
    }

    it('reads the bare dashboard detail', async () => {
      const result = getDashboard(dashboardId); const req = await request(`/dashboards/${dashboardId}`);
      expect(req.request.method).toBe('GET'); headers(req, false); req.flush(dashboardDetail());
      expect((await result).revision).toBe(7);
    });

    it('sends the source run DTO once with population options and currency series intact', async () => {
      const body = { filters: { companyIds: [dashboardId], branchIds: [widgetId], currencyCode: 'USD' },
        crossFilters: [{ placementId: widgetId, field: 'owner', values: [dashboardId] }], refresh: true };
      const result = runDashboard(dashboardId, body); const req = await request(`/dashboards/${dashboardId}/run`);
      headers(req, true); expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ ...body, includePopulationOptions: true });
      const run = dashboardRun(); req.flush(run); expect(await result).toEqual(run);
      expect(crmQueries().getQueryCache().getAll().every((query) => query.queryKey[0] === 'crm-analytics')).toBe(true);
    });

    it('sends cursor and currency drill selections without scope headers', async () => {
      const result = drilldown(dashboardId, widgetId, { pointKey: 'value', cursor: null, filters: { currencyCode: 'USD' } });
      const req = await request(`/dashboards/${dashboardId}/widgets/${widgetId}/drilldown`);
      headers(req, true);
      expect(req.request.body).toEqual({ pointKey: 'value', filters: { currencyCode: 'USD' } });
      req.flush({ records: [], pageInfo: { limit: 25, hasMore: false, nextCursor: null } });
      expect((await result).records).toEqual([]);
    });

    it('reads receipts and their comparison explanation through the shared API', async () => {
      const result = getReceipt(receiptId); const req = await request(`/dashboards/receipts/${receiptId}`);
      headers(req, false); req.flush(receipt); expect(await result).toEqual(receipt);
      const explanation = explainReceipt(receiptId, dashboardId);
      const explain = await request(`/dashboards/receipts/${receiptId}/explain`);
      headers(explain, false); expect(explain.request.params.get('compareTo')).toBe(dashboardId);
      explain.flush({ receiptId }); expect(await explanation).toEqual({ receiptId });
    });
  });
}
