import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../core/api/api-errors';
import type { CorePageMeta } from '../../core/api/core-page';
import { listActiveCoreCurrencies, listActiveCoreCurrencyCodes, type CoreCurrency } from './core-currencies';

const path = '/api/tenant/core/v1/currencies';
const egp: CoreCurrency = {
  id: '019aaf90-0000-7000-8000-000000000001', code: 'EGP', name: 'Egyptian Pound',
  symbol: null, decimalPlaces: 2, isDefault: true, exchangeRate: '1.00000000', status: 'ACTIVE',
  createdAt: '2026-11-23T00:00:00.000Z', updatedAt: '2026-11-23T00:00:00.000Z',
};
const usd: CoreCurrency = { ...egp, id: '019aaf90-0000-7000-8000-000000000002', code: 'USD', isDefault: false, exchangeRate: '0.02000000' };

function meta(page = 1, hasNext = false): CorePageMeta {
  return { page, limit: 100, total: 2, totalPages: 2, hasNext, hasPrev: page > 1 };
}

describe.each([
  { lang: 'en', dir: 'ltr', theme: 'light' },
  { lang: 'en', dir: 'ltr', theme: 'dark' },
  { lang: 'ar', dir: 'rtl', theme: 'light' },
  { lang: 'ar', dir: 'rtl', theme: 'dark' },
])('$lang / $theme', ({ lang, dir, theme }) => {
  describe('coreCurrencies', () => {
    let http: HttpTestingController;
    let previous: { lang: string; dir: string; theme: string | null };

    beforeEach(() => {
      const root = document.documentElement;
      previous = { lang: root.lang, dir: root.dir, theme: root.getAttribute('data-theme') };
      root.lang = lang;
      root.dir = dir;
      root.setAttribute('data-theme', theme);
      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
      http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      const root = document.documentElement;
      root.lang = previous.lang;
      root.dir = previous.dir;
      if (previous.theme === null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', previous.theme);
      http.verify();
    });

    function requestPage(page: number) {
      const request = http.expectOne((req) => req.url === path && req.params.get('page') === String(page));
      expect(request.request.method).toBe('GET');
      expect(request.request.withCredentials).toBe(true);
      expect(request.request.params.keys()).toEqual(['page', 'limit', 'status', 'sortBy', 'sortDir']);
      expect(request.request.params.get('limit')).toBe('100');
      expect(request.request.params.get('status')).toBe('ACTIVE');
      expect(request.request.params.get('sortBy')).toBe('code');
      expect(request.request.params.get('sortDir')).toBe('ASC');
      expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
      expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
      return request;
    }

    it('reads every page', async () => {
      const pending = TestBed.runInInjectionContext(listActiveCoreCurrencies);
      requestPage(1).flush({ success: true, data: [egp, { ...egp, code: 'SAR', status: 'INACTIVE' }], meta: meta(1, true) });
      const second = await vi.waitFor(() => requestPage(2));
      second.flush({ success: true, data: [usd], meta: meta(2) });
      await expect(pending).resolves.toEqual([egp, usd]);
    });

    it('403 reaches the caller', async () => {
      const pending = TestBed.runInInjectionContext(listActiveCoreCurrencies);
      const rejected = expect(pending).rejects.toMatchObject({
        status: 403, code: 'MISSING_REQUIRED_PERMISSIONS', correlationId: 'currency-forbidden',
      });
      requestPage(1).flush({ code: 'MISSING_REQUIRED_PERMISSIONS', correlationId: 'currency-forbidden' },
        { status: 403, statusText: 'Forbidden' });
      await rejected;
      await expect(pending).rejects.toBeInstanceOf(ApiError);
    });

    it('core envelope', async () => {
      const pending = TestBed.runInInjectionContext(listActiveCoreCurrencies);
      requestPage(1).flush({ success: true, data: [egp], meta: { ...meta(), total: 1, totalPages: 1 }, correlationId: 'currency-envelope' });
      await expect(pending).resolves.toEqual([egp]);
    });

    it('keeps the currency codes helper', async () => {
      const pending = TestBed.runInInjectionContext(listActiveCoreCurrencyCodes);
      requestPage(1).flush({ success: true, data: [egp, usd], meta: { ...meta(), totalPages: 1 } });
      await expect(pending).resolves.toEqual(['EGP', 'USD']);
    });

    it('follows hasNext even when a page is empty', async () => {
      const pending = TestBed.runInInjectionContext(listActiveCoreCurrencies);
      requestPage(1).flush({ success: true, data: [], meta: meta(1, true) });
      const second = await vi.waitFor(() => requestPage(2));
      second.flush({ success: true, data: [], meta: meta(2) });
      await expect(pending).resolves.toEqual([]);
    });

    it('rejects a later page instead of returning a partial list', async () => {
      const pending = TestBed.runInInjectionContext(listActiveCoreCurrencies);
      const rejected = expect(pending).rejects.toMatchObject({ status: 403, code: 'MISSING_REQUIRED_PERMISSIONS' });
      requestPage(1).flush({ success: true, data: [egp], meta: meta(1, true) });
      const second = await vi.waitFor(() => requestPage(2));
      second.flush({ errorCode: 'MISSING_REQUIRED_PERMISSIONS' }, { status: 403, statusText: 'Forbidden' });
      await rejected;
    });
  });
});
