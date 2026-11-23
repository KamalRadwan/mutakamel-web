import { DOCUMENT, EnvironmentInjector, createEnvironmentInjector } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreHttp } from '../../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { CrmHttp, bindCrmHttpForTest, crmQueries } from '../../../shared/crm-http';
import {
  adoptBlueprint, createDashboard, createDashboardFromTemplate, getDefaultDashboard,
  getNavigation, listBlueprints, listDashboards, setDefaultDashboard, setFavoriteDashboard,
} from '../dashboards.api';
import { dashboardRoutes } from '../../dashboard.routes';
import { DATE_RANGE_NOW } from '../../../../../shared/ui/date-range/date-range-clock';

const base = '/api/tenant/crm/v1';
const id = '019a9c30-1234-7000-8000-000000000001';

for (const language of ['en', 'ar']) for (const theme of ['light', 'dark']) {
  describe(`${language} ${theme}`, () => {
    describe('DashboardsApi', () => {
      let http: HttpTestingController;
      let dispose: () => void;
      let attributes: string;

      beforeEach(() => {
        attributes = document.documentElement.outerHTML.match(/^<html[^>]*>/)?.[0] ?? '';
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', theme);
        TestBed.configureTestingModule({ providers: [
          provideHttpClient(), provideHttpClientTesting(), CoreHttp, CrmHttp,
          { provide: DOCUMENT, useValue: {
            cookie: '__Host-mutakamel-tenant-csrf=test-csrf', location: { protocol: 'https:' },
          } },
        ] });
        http = TestBed.inject(HttpTestingController);
        crmQueries().clear();
        dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
      });

      afterEach(() => {
        http.verify();
        crmQueries().clear();
        dispose();
        vi.restoreAllMocks();
        TestBed.resetTestingModule();
        for (const name of ['lang', 'dir', 'data-theme']) {
          const value = attributes.match(new RegExp(`${name}="([^"]*)"`))?.[1];
          if (value === undefined) document.documentElement.removeAttribute(name);
          else document.documentElement.setAttribute(name, value);
        }
      });

      async function request(method: string, path: string): Promise<TestRequest> {
        let found: TestRequest | undefined;
        await vi.waitFor(() => { found = http.expectOne((req) => req.method === method && req.url === `${base}${path}`); });
        return found!;
      }

      function headers(req: TestRequest, key?: string) {
        expect(req.request.withCredentials).toBe(true);
        expect(req.request.headers.get('x-mutakamel-company-id')).toBeNull();
        expect(req.request.headers.get('x-mutakamel-branch-id')).toBeNull();
        expect(req.request.headers.get('x-idempotency-key')).toBe(key ?? null);
        expect(req.request.headers.get('If-Match')).toBeNull();
        if (key) expect(req.request.headers.get('x-csrf-token')).toBe('test-csrf');
      }

      it('library sends kind', async () => {
        const result = listDashboards({ kind: 'REPORT', search: 'Sales', cursor: 'next', limit: 2 });
        const req = await request('GET', '/dashboards');
        expect(req.request.params.get('kind')).toBe('DASHBOARD');
        expect(req.request.params.get('search')).toBe('Sales');
        expect(req.request.params.get('cursor')).toBe('next');
        expect(req.request.params.get('limit')).toBe('2');
        headers(req);
        req.flush({ items: [], nextCursor: 'another' });
        await expect(result).resolves.toEqual({ items: [], nextCursor: 'another' });

        const defaults = listDashboards();
        const defaultReq = await request('GET', '/dashboards');
        expect(defaultReq.request.params.get('limit')).toBe('50');
        expect(defaultReq.request.params.has('search')).toBe(false);
        defaultReq.flush({ items: [], nextCursor: null });
        await defaults;
      });

      it('favourite and default keys', async () => {
        const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
        const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
        const favouriteKey = newIdempotencyKey();
        const favourite = setFavoriteDashboard(id, true, favouriteKey);
        const req = await request('PUT', `/dashboards/${id}/favorite`);
        headers(req, favouriteKey);
        expect(req.request.body).toEqual({ favorite: true });
        expect(cancel).toHaveBeenCalledWith({ queryKey: ['crm-analytics'] });
        req.flush({ id, isFavorite: true });
        await expect(favourite).resolves.toMatchObject({ id, isFavorite: true });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-analytics'] });

        const defaultKey = newIdempotencyKey();
        const makeDefault = setDefaultDashboard(id, defaultKey);
        const defaultReq = await request('PUT', `/dashboards/${id}/default`);
        headers(defaultReq, defaultKey);
        expect(defaultReq.request.body).toBeNull();
        defaultReq.flush({ id, isDefault: true });
        await expect(makeDefault).resolves.toMatchObject({ id, isDefault: true });
      });

      it('links creation, template PUT and blueprint adoption without scope headers', async () => {
        const body = { name: 'Sales', description: 'Pipeline', defaultFilters: { datePreset: 'CURRENT_MONTH' as const }, layoutCollisionMode: 'PUSH' as const };
        const createKey = newIdempotencyKey();
        const create = createDashboard(body, createKey);
        const createReq = await request('POST', '/dashboards');
        headers(createReq, createKey);
        expect(createReq.request.body).toEqual(body);
        createReq.flush({ id });
        await expect(create).resolves.toEqual({ id });

        const templateKey = newIdempotencyKey();
        const template = createDashboardFromTemplate('sales-pipeline', { name: 'Sales copy' }, templateKey);
        const templateReq = await request('PUT', '/dashboards/from-template/sales-pipeline');
        headers(templateReq, templateKey);
        expect(templateReq.request.body).toEqual({ name: 'Sales copy' });
        templateReq.flush({ id });
        await template;

        const adoptionKey = newIdempotencyKey();
        const adoptionBody = { definitionRevision: 4, branchId: id, confirmTargets: true as const, name: 'Team' };
        const adoption = adoptBlueprint('team', adoptionBody, adoptionKey);
        const adoptionReq = await request('PUT', '/dashboards/blueprints/team/adoption');
        headers(adoptionReq, adoptionKey);
        expect(adoptionReq.request.body).toEqual(adoptionBody);
        adoptionReq.flush({ dashboardId: id, definitionRevision: 4, created: true });
        await expect(adoption).resolves.toMatchObject({ dashboardId: id });
      });

      it('links navigation, default and branch-aware blueprint reads', async () => {
        const navigation = getNavigation({ cursor: 'page-2', limit: 10 });
        const navReq = await request('GET', '/dashboards/navigation');
        headers(navReq);
        expect(navReq.request.params.get('kind')).toBe('DASHBOARD');
        expect(navReq.request.params.has('search')).toBe(false);
        expect(navReq.request.params.get('cursor')).toBe('page-2');
        navReq.flush({ items: [], nextCursor: null, activeDashboardId: id });
        await expect(navigation).resolves.toMatchObject({ activeDashboardId: id });
        const current = getDefaultDashboard();
        const currentReq = await request('GET', '/dashboards/default');
        headers(currentReq);
        currentReq.flush({ id });
        await expect(current).resolves.toEqual({ id });
        const blueprints = listBlueprints(id);
        const bpReq = await request('GET', '/dashboards/blueprints');
        headers(bpReq);
        expect(bpReq.request.params.get('branchId')).toBe(id);
        bpReq.flush({ items: [] });
        await expect(blueprints).resolves.toEqual({ items: [] });
      });

      it('provides a clock evaluated at each call', () => {
        const injector = createEnvironmentInjector(dashboardRoutes[0].providers ?? [], TestBed.inject(EnvironmentInjector));
        const now = injector.get(DATE_RANGE_NOW);
        vi.useFakeTimers();
        try {
          vi.setSystemTime(new Date('2026-11-23T10:00:00Z'));
          expect(now().toISOString()).toBe('2026-11-23T10:00:00.000Z');
          vi.setSystemTime(new Date('2026-11-24T10:00:00Z'));
          expect(now().toISOString()).toBe('2026-11-24T10:00:00.000Z');
        } finally { vi.useRealTimers(); injector.destroy(); }
      });
    });
  });
}
