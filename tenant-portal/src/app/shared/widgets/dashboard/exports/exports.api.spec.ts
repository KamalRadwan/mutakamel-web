import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { bindCrmHttpForTest, CrmHttp, crmQueries } from '../../../../features/crm/shared/crm-http';
import { CrmHttpStub } from '../../../../features/crm/shared/testing/crm-http-testing';
import { errorText } from '../panel-state';
import { cancelExport, createExport, downloadExport, exportFilename, getExport, listExports, pdfAvailable, toExportPeriod } from './exports.api';
import type { CreateExportRequest, Export, ExportListPage } from './exports.model';

const VIEWS = [['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']] as const;
const id = '01934b60-0000-7000-8000-000000000003';
const dashboardId = '01934a10-0000-7000-8000-000000000001';
const body: CreateExportRequest = {
  dashboardId, format: 'CSV', locale: 'en', period: { from: '2026-11-01', to: '2026-11-23' },
  scope: { branchIds: ['branch-1'] }, filters: { source: 'web' }, panelKeys: ['revenue'],
};
const row: Export = {
  id, dashboardId, reportKey: null, origin: 'USER', format: 'XLSX', locale: 'en', status: 'SUCCEEDED',
  queuedAt: '2026-11-23T08:00:00Z', completedAt: '2026-11-23T08:01:00Z', expiresAt: null,
  rowCount: 4, pageCount: null, byteSize: 12, failureCode: null, revision: 3,
};
const page: ExportListPage = {
  items: [row], pageInfo: { limit: 25, hasMore: false, nextCursor: null },
  capabilities: { formats: [{ format: 'PDF', available: false, reason: 'PDF_RENDERER_UNAVAILABLE' }] },
};

describe.each(VIEWS)('ExportsApi (%s / %s)', (language, theme) => {
  let dispose: () => void;
  let stub: CrmHttpStub;
  beforeEach(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    stub = new CrmHttpStub({
      '/analytics/exports': page, [`/analytics/exports/${id}`]: { ...row, locale: language },
      [`/analytics/exports/${id}/download`]: new Blob(['data'], { type: 'text/csv' }),
      [`/dashboards/${dashboardId}`]: { name: 'Revenue / sales:*?' },
    });
    dispose = bindCrmHttpForTest(stub);
    crmQueries().clear();
  });
  afterEach(() => { dispose(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('create queues with a key', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const restore = bindCrmHttpForTest(TestBed.inject(CrmHttp));
    const cookie = document.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    document.cookie = `${cookie}=export-test; path=/`;
    try {
      const key = newIdempotencyKey();
      const pending = createExport(body, key);
      let request!: TestRequest;
      await vi.waitFor(() => { request = http.expectOne('/api/tenant/crm/v1/analytics/exports'); });
      expect(request.request.headers.get('x-idempotency-key')).toBe(key);
      expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
      expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
      expect(request.request.body).toEqual(body);
      expect(request.request.withCredentials).toBe(true);
      request.flush({ exportId: id, status: 'QUEUED' }, { status: 202, statusText: 'Accepted' });
      await expect(pending).resolves.toEqual({ exportId: id, status: 'QUEUED' });
      http.verify();
    } finally {
      restore();
      document.cookie = `${cookie}=; Max-Age=0; path=/`;
    }
  });

  it('lists and gets bare rows with capabilities and cursor query', async () => {
    const read = vi.spyOn(stub, 'read');
    expect(await listExports('next', 10, 'RUNNING')).toEqual(page);
    expect(pdfAvailable()).toBe(false);
    expect(read).toHaveBeenCalledWith('/analytics/exports', { cursor: 'next', limit: 10, status: 'RUNNING' });
    expect(await getExport(id)).toMatchObject({ id });
    expect(crmQueries().getQueryCache().getAll().every((query) => query.queryKey[0] === 'crm-analytics')).toBe(true);
    expect(toExportPeriod({ from: '2026-01-01', to: '2026-01-02', preset: 'TODAY' })).toEqual({ from: '2026-01-01', to: '2026-01-02', kind: 'TODAY' });
  });

  it('download filename', async () => {
    const readBlob = vi.spyOn(stub, 'readBlob');
    const file = await downloadExport(id);
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe('Revenue - sales----2026-11-23.xlsx');
    expect(readBlob).toHaveBeenCalledExactlyOnceWith(`/analytics/exports/${id}/download`);
    expect(exportFilename({ ...row, format: 'CSV' }, 'ملف/العمل')).toBe('ملف-العمل-2026-11-23.csv');
    const read = vi.spyOn(stub, 'read').mockResolvedValueOnce({ ...row, locale: language, reportKey: 'sales' })
      .mockResolvedValueOnce({ report: { title: { en: 'Sales', ar: 'المبيعات' } } });
    expect(((await downloadExport(id)) as File).name).toBe(`${language === 'ar' ? 'المبيعات' : 'Sales'}-2026-11-23.xlsx`);
    expect(read).toHaveBeenLastCalledWith('/dashboards/reports/sales/manifest');
  });

  it('keeps the latest PDF capability until an explicit list refresh', async () => {
    vi.spyOn(stub, 'read').mockResolvedValueOnce({ ...page, capabilities: { formats: [{ format: 'PDF', available: true }] } });
    await listExports();
    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(pdfAvailable()).toBe(true);
    crmQueries().clear();
    expect(pdfAvailable()).toBe(false);
  });

  it('download errors', async () => {
    for (const [status, code] of [[410, 'CRM_EXPORT_EXPIRED'], [409, 'CRM_EXPORT_NOT_READY'], [409, 'CRM_EXPORT_PERMISSION_CHANGED']] as const) {
      const error = new ApiError(status, code);
      vi.spyOn(stub, 'readBlob').mockRejectedValueOnce(error);
      await expect(downloadExport(id)).rejects.toBe(error);
      expect(errorText(error).key).toBe(`analytics.error.${code}`);
    }
  });

  it('cancel errors', async () => {
    const write = vi.spyOn(stub, 'write');
    for (const code of ['CRM_EXPORT_NOT_CANCELLABLE', 'CRM_EXPORT_REVISION_STALE']) {
      const error = new ApiError(409, code);
      write.mockRejectedValueOnce(error);
      await expect(cancelExport(id, 3)).rejects.toBe(error);
      expect(write).toHaveBeenLastCalledWith('POST', `/analytics/exports/${id}/cancel`, { revision: 3 }, {
        key: expect.stringMatching(/^[0-9a-f-]{36}$/), ifMatch: `"export:${id}:3"`,
      });
      expect(errorText(error).key).toBe(`analytics.error.${code}`);
    }
  });

  it('preserves a cancel key only for retryable failures and invalidates without polling', async () => {
    const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(503, 'UNAVAILABLE'));
    const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
    const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
    await expect(cancelExport(id, 3)).rejects.toMatchObject({ status: 503 });
    await cancelExport(id, 3);
    expect(write.mock.calls[0][3].key).toBe(write.mock.calls[1][3].key);
    expect(write.mock.calls[1][3]).not.toHaveProperty('scope');
    expect(cancel).toHaveBeenCalledWith({ queryKey: ['crm-analytics', 'exports'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-analytics', 'exports'], refetchType: 'none' });
  });
});
