import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { bindCrmHttpForTest, CrmHttp, crmQueries } from '../../../shared/crm-http';
import { createWidget, discardDraft, getDraft, getWidget, previewWidget, publishImpact, publishWidget, saveDraft } from '../widgets.api';
import { widgetDetail, widgetDraft, widgetId, widgetImpact, widgetPreview } from './builder-test-support';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const base = '/api/tenant/crm/v1/widgets';
const body = () => ({ name: 'Leads', visualizationType: 'METRIC_CARD' as const,
  querySpec: widgetDraft().draft!.querySpec, displaySpec: {} });
const tokens = () => ({ expectedWidgetRevision: 7, expectedDraftId: widgetDraft().draft!.draftId, expectedDraftRevision: 5 });

for (const language of ['en', 'ar']) for (const theme of ['light', 'dark']) {
  describe(`WidgetsApi ${language} ${theme}`, () => {
    let http: HttpTestingController;
    let dispose: () => void;
    let cookieName: string;
    let attributes: (string | null)[];
    beforeEach(() => {
      attributes = ['lang', 'dir', 'data-theme'].map((name) => document.documentElement.getAttribute(name));
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.setAttribute('data-theme', theme);
      cookieName = location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
      document.cookie = `${cookieName}=widget-test; Path=/${location.protocol === 'https:' ? '; Secure' : ''}`;
      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
      http = TestBed.inject(HttpTestingController);
      crmQueries().clear();
      dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
    });
    afterEach(() => {
      try { http?.verify(); } finally { crmQueries().clear(); dispose?.(); TestBed.resetTestingModule(); vi.restoreAllMocks(); }
      document.cookie = `${cookieName}=; Max-Age=0; Path=/${location.protocol === 'https:' ? '; Secure' : ''}`;
      ['lang', 'dir', 'data-theme'].forEach((name, index) => {
        const value = attributes[index];
        if (value === null) document.documentElement.removeAttribute(name);
        else document.documentElement.setAttribute(name, value);
      });
    });
    async function request(path: string) { return vi.waitFor(() => http.expectOne((r) => r.url === path)); }
    function headers(call: TestRequest, write = false) {
      expect(call.request.withCredentials).toBe(true);
      expect(call.request.headers.has('x-mutakamel-company-id')).toBe(false);
      expect(call.request.headers.has('x-mutakamel-branch-id')).toBe(false);
      if (write) expect(call.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
      else expect(call.request.headers.has('x-idempotency-key')).toBe(false);
    }

    it('reads widget usage and usageCursor as bare bodies', async () => {
      const pending = getWidget(widgetId, 'usage-cursor');
      const call = await request(`${base}/${widgetId}`);
      expect(call.request.method).toBe('GET');
      expect(call.request.params.get('usageCursor')).toBe('usage-cursor');
      headers(call);
      call.flush(widgetDetail());
      expect(await pending).toEqual(widgetDetail());
    });

    it('reads the expected-token draft', async () => {
      const pending = getDraft(widgetId);
      const call = await request(`${base}/${widgetId}/draft`);
      headers(call); call.flush(widgetDraft());
      expect(await pending).toEqual(widgetDraft());
    });

    it('creates with the supplied key and invalidates analytics after writing', async () => {
      const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
      const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
      const key = newIdempotencyKey();
      const pending = createWidget(body(), key);
      await Promise.resolve();
      const call = await request(base);
      expect(call.request.method).toBe('POST'); headers(call, true);
      expect(call.request.headers.get('x-idempotency-key')).toBe(key);
      expect(call.request.body).toEqual(body());
      call.flush({ ...widgetDraft(), activeVersionNumber: null }, { status: 201, statusText: 'Created' });
      expect((await pending).activeVersionNumber).toBeNull();
      expect(cancel).toHaveBeenCalledWith({ queryKey: ['crm-analytics', 'widgets'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-analytics'] });
    });

    it('draft save tokens', async () => {
      const payload = { ...body(), ...tokens() };
      const pending = saveDraft(widgetId, payload);
      await Promise.resolve();
      const call = await request(`${base}/${widgetId}`);
      expect(call.request.method).toBe('PATCH'); headers(call, true);
      expect(call.request.body).toEqual(payload);
      expect(call.request.headers.has('If-Match')).toBe(false);
      call.flush(widgetDraft());
      expect(await pending).toEqual(widgetDraft());
    });

    it('discards using the three loaded tokens and a key', async () => {
      const pending = discardDraft(widgetId, tokens());
      await Promise.resolve();
      const call = await request(`${base}/${widgetId}/draft/discard`);
      expect(call.request.method).toBe('POST'); headers(call, true);
      expect(call.request.body).toEqual(tokens()); call.flush({ ...widgetDraft(), draft: null });
      expect((await pending).draft).toBeNull();
    });

    it('previews and inspects impact on demand without an AbortSignal', async () => {
      const preview = previewWidget(body());
      const previewCall = await request(`${base}/preview`);
      expect(previewCall.request.method).toBe('POST'); headers(previewCall, true);
      expect(previewCall.request.body).toEqual(body()); previewCall.flush(widgetPreview());
      expect(await preview).toEqual(widgetPreview());
      const payload = { ...tokens(), expectedGovernanceRevision: 3 };
      const impact = publishImpact(widgetId, payload);
      const impactCall = await request(`${base}/${widgetId}/publish-impact`);
      headers(impactCall, true); expect(impactCall.request.body).toEqual(payload);
      impactCall.flush(widgetImpact()); expect(await impact).toEqual(widgetImpact());
    });

    it('publishes impactId plus all four tokens even on the gateway idem-false route', async () => {
      const payload = { ...tokens(), expectedGovernanceRevision: 3, impactId: widgetImpact().impactId };
      const key = newIdempotencyKey();
      const pending = publishWidget(widgetId, payload, key);
      await Promise.resolve();
      const call = await request(`${base}/${widgetId}/publish`);
      headers(call, true); expect(call.request.headers.get('x-idempotency-key')).toBe(key);
      expect(call.request.body).toEqual(payload); call.flush({ widgetId, versionNumber: 3 });
      expect(await pending).toMatchObject({ widgetId, versionNumber: 3 });
    });

    it('retains the same draft body and key after a lost connection', async () => {
      const payload = { ...body(), ...tokens() };
      const first = saveDraft(widgetId, payload);
      const rejected = expect(first).rejects.toMatchObject({ status: 0 });
      await Promise.resolve();
      const firstCall = await request(`${base}/${widgetId}`);
      const key = firstCall.request.headers.get('x-idempotency-key');
      firstCall.error(new ProgressEvent('error')); await rejected;
      const retry = saveDraft(widgetId, structuredClone(payload));
      await Promise.resolve();
      const retryCall = await request(`${base}/${widgetId}`);
      expect(retryCall.request.headers.get('x-idempotency-key')).toBe(key);
      expect(retryCall.request.body).toEqual(payload); retryCall.flush(widgetDraft()); await retry;
      const next = saveDraft(widgetId, { ...payload, name: 'Next action' });
      await Promise.resolve();
      const nextCall = await request(`${base}/${widgetId}`);
      expect(nextCall.request.headers.get('x-idempotency-key')).not.toBe(key);
      nextCall.flush(widgetDraft()); await next;
    });

    it.each([400, 401, 403, 404, 409, 422, 429, 500, 503])('preserves %s service errors and correlation without retrying', async (status) => {
      const pending = getWidget(widgetId);
      const rejected = expect(pending).rejects.toMatchObject({ status, code: 'CRM_WIDGET_TEST', correlationId: 'widget-ref' });
      const call = await request(`${base}/${widgetId}`);
      call.flush({ errorCode: 'CRM_WIDGET_TEST', correlationId: 'widget-ref', details: { name: ['invalid'] } },
        { status, statusText: 'Error' });
      await rejected;
      http.expectNone(`${base}/${widgetId}`);
    });
  });
}
