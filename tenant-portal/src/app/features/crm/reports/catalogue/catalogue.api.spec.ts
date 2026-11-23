import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { listCatalogue, listWholeCatalogue, peekCatalogueReport, setReportFavourite } from './catalogue.api';
import { countByDomain, type ReportCatalogueItem } from './catalogue.model';

const item: ReportCatalogueItem = {
  reportKey: 'pipeline', domain: 'pipeline', code: 'R01', title: { en: 'Pipeline', ar: 'مسار المبيعات' },
  summary: null, blueprintRevision: 1, readiness: 'READY', favourite: false, dashboardId: null, pinnedCount: 0,
};
const page = (items: ReportCatalogueItem[], nextCursor: string | null = null) => ({
  items, pageInfo: { limit: 25, hasMore: nextCursor !== null, nextCursor },
});

for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
  describe(`CatalogueApi ${lang} ${theme}`, () => {
    let stub: CrmHttpStub;
    let dispose: () => void;
    beforeEach(() => {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.dataset['theme'] = theme;
      crmQueries().clear();
      stub = new CrmHttpStub({ '/dashboards/reports/catalogue': page([item]) });
      dispose = bindCrmHttpForTest(stub);
    });
    afterEach(() => { dispose(); crmQueries().clear(); vi.restoreAllMocks(); });

    it('unavailable report', async () => {
      vi.spyOn(stub, 'read').mockResolvedValue(page([{ ...item, available: false }]));
      const result = await listCatalogue();
      expect(result.items[0].readiness).toBe('UNAVAILABLE');
      expect(await listCatalogue({ availableOnly: true })).toEqual(page([]));
    });

    it('passes only backend filters and preserves false, opaque cursors and source readiness', async () => {
      const read = vi.spyOn(stub, 'read');
      const result = await listCatalogue({ domain: 'pipeline', q: 'pipe', favourite: false, cursor: 'opaque', limit: 10 });
      expect(read).toHaveBeenCalledExactlyOnceWith('/dashboards/reports/catalogue', {
        domain: 'pipeline', q: 'pipe', favourite: false, cursor: 'opaque', limit: 10,
      });
      expect(result.items[0]).toEqual(item);
      expect(peekCatalogueReport('pipeline')).toEqual(item);
      expect(crmQueries().getQueryCache().getAll().every(query => query.queryKey[0] === 'crm-analytics')).toBe(true);
    });

    it('reads every cursor even when the available filter empties a page', async () => {
      vi.spyOn(stub, 'read').mockResolvedValueOnce(page([{ ...item, readiness: 'NOT_READY' }], 'next'))
        .mockResolvedValueOnce(page([item]));
      const whole = await listWholeCatalogue({ availableOnly: true });
      expect(whole).toEqual([item]);
      expect(countByDomain(whole).pipeline).toBe(1);
    });

    it('favourite sends a key, no scope headers, and invalidates cached analytics', async () => {
      const result = { dashboardId: 'saved-report', favorite: true };
      const write = vi.spyOn(stub, 'write').mockResolvedValue({ status: 200, data: result, etag: null, location: null });
      const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
      const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
      expect(await setReportFavourite('pipeline', true)).toEqual(result);
      expect(write).toHaveBeenCalledWith('PUT', '/dashboards/reports/pipeline/favorite', { favorite: true }, { key: expect.any(String) });
      expect(write.mock.calls[0][3]?.scope).toBeUndefined();
      expect(cancel).toHaveBeenCalledWith({ queryKey: ['crm-analytics'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-analytics'] });
    });

    it('keeps the key and body after an uncertain write, changes key for a different body', async () => {
      const write = vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(503, 'GW.UPSTREAM.UNAVAILABLE'));
      await expect(setReportFavourite('pipeline', true)).rejects.toMatchObject({ status: 503 });
      await expect(setReportFavourite('pipeline', true)).rejects.toMatchObject({ status: 503 });
      expect(write.mock.calls[0][3]?.key).toBe(write.mock.calls[1][3]?.key);
      await expect(setReportFavourite('pipeline', false)).rejects.toMatchObject({ status: 503 });
      expect(write.mock.calls[2][3]?.key).not.toBe(write.mock.calls[1][3]?.key);
    });

    it('preserves server validation paths and report-not-found errors', async () => {
      vi.spyOn(stub, 'read').mockRejectedValueOnce(new ApiError(400, 'CRM_VALIDATION_FAILED', { q: ['server message'] }))
        .mockRejectedValueOnce(new ApiError(404, 'CRM_REPORT_NOT_FOUND'));
      await expect(listCatalogue({ q: 'x' })).rejects.toMatchObject({ details: { q: expect.any(Array) } });
      await expect(listCatalogue()).rejects.toMatchObject({ code: 'CRM_REPORT_NOT_FOUND' });
    });
  });
}
