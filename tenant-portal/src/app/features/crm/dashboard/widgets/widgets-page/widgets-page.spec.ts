import { Injectable, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../public/i18n/en.json';
import ar from '../../../../../../../public/i18n/ar.json';
import enWidgets from '../../../../../../../public/i18n/crm-widgets/en.json';
import arWidgets from '../../../../../../../public/i18n/crm-widgets/ar.json';
import enAnalytics from '../../../../../../../public/i18n/analytics/en.json';
import arAnalytics from '../../../../../../../public/i18n/analytics/ar.json';
import enShare from '../../../../../../../public/i18n/crm-dash-share/en.json';
import arShare from '../../../../../../../public/i18n/crm-dash-share/ar.json';
import enRecord from '../../../../../../../public/i18n/record-page/en.json';
import arRecord from '../../../../../../../public/i18n/record-page/ar.json';
import { ApiError } from '../../../../../core/api/api-errors';
import type { CoreQuery } from '../../../../../core/api/core-http';
import { LanguageState } from '../../../../../core/i18n/language';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { Field } from '../../../../../shared/ui/field/field';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import type { CursorPage } from '../../../../../shared/widgets/dashboard/analytics-api';
import { bindAnalyticsPermissions } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { bindCrmHttpForTest, crmQueries, type CrmReadOptions } from '../../../shared/crm-http';
import { CrmHttpStub } from '../../../shared/testing/crm-http-testing';
import type { WidgetSummary } from '../widgets.model';
import { WidgetsPage } from './widgets-page';

@Injectable()
class WidgetLibraryLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const arabic = path.endsWith('ar');
    if (path.startsWith('crm-widgets/')) return of(arabic ? arWidgets : enWidgets);
    if (path.startsWith('analytics/')) return of(arabic ? arAnalytics : enAnalytics);
    if (path.startsWith('crm-dash-share/')) return of(arabic ? arShare : enShare);
    if (path.startsWith('record-page/')) return of(arabic ? arRecord : enRecord);
    return of(arabic ? ar : en);
  }
}

const cursor = '019a9c30-1234-7000-8000-000000000002';
const row: WidgetSummary = {
  id: '019a9c30-1234-7000-8000-000000000001', ownerUserId: 'owner', ownerName: 'Server owner',
  name: 'Server widget', visualizationType: 'METRIC_CARD', querySpec: null, displaySpec: null,
  schemaVersion: 2, versionNumber: 1, revision: 2, governanceRevision: 1,
  updatedAt: '2026-11-23T10:00:00Z', createdAt: '2026-11-23T10:00:00Z', accessLevel: 'OWNER',
  status: 'PUBLISHED', hasDraft: false, draftRevision: null, sourceResources: ['leads'], isShared: false,
};

for (const language of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) {
  describe(`${language} ${theme}`, () => {
    describe('WidgetsPage', () => {
      let fixture: ComponentFixture<WidgetsPage> | undefined;
      let stub: CrmHttpStub;
      let data: Record<string, unknown>;
      let dispose: () => void;
      let permissions: string[];
      let attributes: { lang: string; dir: string; theme: string | null };

      beforeEach(() => {
        attributes = { lang: document.documentElement.lang, dir: document.documentElement.dir,
          theme: document.documentElement.getAttribute('data-theme') };
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', theme);
        globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
        permissions = ['crm.widgets.read', 'crm.widgets.create', 'crm.analytics.readiness.view'];
        bindAnalyticsPermissions(() => permissions);
        data = {
          '/widgets': { items: [row], nextCursor: cursor },
          '/widgets/owner-options': { items: [{ id: row.ownerUserId, name: row.ownerName }], nextCursor: null },
        };
        stub = new CrmHttpStub(data);
        crmQueries().clear();
        dispose = bindCrmHttpForTest(stub);
        TestBed.configureTestingModule({ providers: [
          provideRouter([]),
          provideTransloco({ config: {
            availableLangs: ['en', 'ar'], defaultLang: language, reRenderOnLangChange: true,
          }, loader: WidgetLibraryLoader }),
          { provide: LanguageState, useValue: { current: signal(language) } },
          { provide: TenantScopeState, useValue: { selection: signal(null), me: signal(null) } },
        ] });
        TestBed.inject(TranslocoService).setTranslation({ ...(language === 'ar' ? ar : en),
          widgets: language === 'ar' ? arWidgets : enWidgets,
          analytics: language === 'ar' ? arAnalytics : enAnalytics,
          share: language === 'ar' ? arShare : enShare,
          recordPage: language === 'ar' ? arRecord : enRecord,
        }, language);
        vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      });

      afterEach(() => {
        fixture?.destroy();
        fixture = undefined;
        crmQueries().clear();
        dispose();
        bindAnalyticsPermissions(() => []);
        vi.restoreAllMocks();
        TestBed.resetTestingModule();
        document.documentElement.lang = attributes.lang;
        document.documentElement.dir = attributes.dir;
        if (attributes.theme === null) document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', attributes.theme);
      });

      const t = (key: string) => TestBed.inject(TranslocoService).translate(key);
      const reads = () => stub.recordedReads().filter((read) => read.path === '/widgets');
      async function stable() { await fixture!.whenStable(); fixture!.detectChanges(); }
      async function render() {
        fixture = TestBed.createComponent(WidgetsPage);
        fixture.detectChanges();
        await vi.waitFor(() => expect(fixture!.componentInstance['loading']()).toBe(false));
        await stable();
        return fixture.componentInstance;
      }
      async function loaded() {
        await vi.waitFor(() => expect(fixture!.componentInstance['loading']()).toBe(false));
        await stable();
      }
      function fullState(): FullState {
        return fixture!.debugElement.query(By.directive(FullState)).componentInstance;
      }

      it('filters and paging', async () => {
        const page = await render();
        expect(reads().at(-1)?.query).toMatchObject({ access: 'OWNED', limit: 50, cursor: null });
        expect(page['ownerOptions']()).toContainEqual({ value: 'owner', label: 'Server owner' });
        page['onSourceChange']('leads');
        await loaded();
        page['onOwnerChange'](row.ownerUserId);
        await loaded();
        page['onSearchInput']({ target: { value: '  Revenue  ' } } as unknown as Event);
        await vi.waitFor(() => expect(reads().at(-1)?.query?.['search']).toBe('Revenue'));
        await loaded();
        expect(reads().at(-1)?.query).toMatchObject({
          access: 'OWNED', search: 'Revenue', source: 'leads', ownerUserId: row.ownerUserId, cursor: null,
        });
        const second = { ...row, id: cursor, name: 'Next server widget' };
        data['/widgets'] = { items: [second], nextCursor: null };
        page['loadMore']();
        await vi.waitFor(() => expect(page['loadingMore']()).toBe(false));
        await stable();
        expect(reads().at(-1)?.query).toMatchObject({ cursor, search: 'Revenue', source: 'leads' });
        expect(page['items']().map((item) => item.name)).toEqual([row.name, second.name]);
        expect(page['nextCursor']()).toBeNull();
        expect(reads().every((read) => read.scope === undefined)).toBe(true);
        for (const name of ['source', 'owner', 'status']) {
          const field = fixture!.debugElement.queryAll(By.directive(Field))
            .find((el) => el.componentInstance.for() === `${page['uid']}-${name}`)!;
          expect(field.componentInstance.hint()).toBe(t(`widgets.${name}Hint`));
          const control = fixture!.nativeElement.querySelector(`[id="${page['uid']}-${name}"]`);
          expect(control.getAttribute('aria-describedby')).toContain(`${page['uid']}-${name}-hint`);
          expect(field.nativeElement.querySelector('[data-ui-hint]')).not.toBeNull();
        }
      });

      it('no usage pill on rows', async () => {
        const page = await render();
        expect(page['columns']().some((column) => column.key === 'usedOn')).toBe(false);
        expect(fixture!.nativeElement.querySelector('ui-badge[tone="count"]')).toBeNull();
        page['onViewChange']('cards');
        await stable();
        expect(fixture!.nativeElement.querySelectorAll('article').length).toBe(1);
        expect(fixture!.nativeElement.querySelector('ui-badge[tone="count"]')).toBeNull();
        expect(stub.recordedReads().every((read) => ['/widgets', '/widgets/owner-options'].includes(read.path))).toBe(true);
      });

      it('no tab counts', async () => {
        const page = await render();
        expect(page['tabs']().every((tab) => !Object.hasOwn(tab, 'count'))).toBe(true);
        for (const tab of fixture!.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>) {
          expect(tab.querySelector('bdi')).toBeNull();
        }
        expect(enWidgets).not.toHaveProperty('usedOn');
        expect(arWidgets).not.toHaveProperty('usedOnCount');
      });

      it('sends shared, published and archived filters and resets the cursor', async () => {
        const page = await render();
        page['onTabChange']('shared');
        await loaded();
        expect(reads().at(-1)?.query).toMatchObject({ access: 'SHARED', cursor: null });
        page['onTabChange']('published');
        await loaded();
        expect(reads().at(-1)?.query).toMatchObject({ status: 'PUBLISHED', cursor: null });
        expect(reads().at(-1)?.query).not.toHaveProperty('access');
        data['/widgets'] = { items: [{ ...row, status: 'ARCHIVED' }], nextCursor: null };
        page['onStatusChange']('ARCHIVED');
        await loaded();
        expect(reads().at(-1)?.query).toMatchObject({ access: 'OWNED', status: 'ARCHIVED', cursor: null });
        expect(fixture!.nativeElement.textContent).toContain(t('widgets.statusValue.ARCHIVED'));
        page['onSourceChange']('unclassified');
        await loaded();
        expect(reads().at(-1)?.query?.['source']).toBe('unclassified');
      });

      it('gates read and create with their widget permissions', async () => {
        permissions = [];
        await render();
        expect(stub.recordedReads()).toEqual([]);
        expect(fullState().kind()).toBe('forbidden');
        expect(fixture!.nativeElement.querySelector('[routerLink="/crm/dashboard/widgets/new"]')).toBeNull();
      });

      it('hides create for a reader and renders the library empty state', async () => {
        permissions = ['crm.widgets.read'];
        data['/widgets'] = { items: [], nextCursor: null };
        await render();
        expect(fixture!.nativeElement.textContent).toContain(t('widgets.empty.mine'));
        expect(fixture!.nativeElement.querySelector('[routerLink="/crm/dashboard/widgets/new"]')).toBeNull();
      });

      it.each([
        [403, 'CRM_SCOPED_PERMISSION_DENIED', 'forbidden'],
        [404, 'CRM_WIDGET_NOT_FOUND', 'not-found'],
        [503, 'CRM_TEAM_SCOPE_NOT_READY', 'provisioning'],
        [0, 'NETWORK_ERROR', 'load-failure'],
        [500, 'COMMON.GENERIC.INTERNAL_ERROR', 'load-failure'],
      ] as const)('shows %s as %s with correlation and an explicit recovery action', async (status, code, kind) => {
        vi.spyOn(stub, 'read').mockRejectedValue(new ApiError(status, code, undefined, { correlationId: 'request-1' }));
        const page = await render();
        expect(fullState().kind()).toBe(kind);
        expect(fullState().text()).toContain('request-1');
        if (kind === 'load-failure') vi.mocked(stub.read).mockRestore();
        page['onLoadFailureAction']();
        if (kind === 'forbidden' || kind === 'not-found') {
          expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/workspace/home']);
        } else if (kind === 'provisioning') {
          expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/crm/settings/data-readiness']);
        } else {
          await loaded();
          expect(page['items']()).toEqual([row]);
        }
      });

      it('keeps readiness behind its permission and shows the server rate-limit delay', async () => {
        permissions = ['crm.widgets.read'];
        const read = vi.spyOn(stub, 'read').mockRejectedValue(new ApiError(503, 'CRM_TARGET_SOURCE_NOT_READY'));
        const page = await render();
        expect(fullState().actionLabel()).toBe(t('analytics.common.retry'));
        read.mockRejectedValue(new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['7'] }));
        page['reload']();
        await loaded();
        expect(fullState().text()).toBe(TestBed.inject(TranslocoService).translate('widgets.rateLimited', { seconds: '7' }));
        expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
      });

      it('ignores an older cursor page after the filter changes', async () => {
        const page = await render();
        let resolve!: (result: CursorPage<WidgetSummary>) => void;
        const delayed = new Promise<CursorPage<WidgetSummary>>((done) => { resolve = done; });
        const original = stub.read.bind(stub);
        vi.spyOn(stub, 'read').mockImplementation(<T>(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<T> =>
          path === '/widgets' && query?.['cursor'] ? delayed as Promise<T> : original<T>(path, query, options),
        );
        page['loadMore']();
        data['/widgets'] = { items: [{ ...row, name: 'Current server result' }], nextCursor: null };
        page['onSourceChange']('activities');
        await loaded();
        resolve({ items: [{ ...row, id: cursor, name: 'Old page' }], nextCursor: cursor });
        await stable();
        expect(page['items']().map((item) => item.name)).toEqual(['Current server result']);
        expect(page['nextCursor']()).toBeNull();
        expect(page['loadingMore']()).toBe(false);
      });
    });
  });
}
