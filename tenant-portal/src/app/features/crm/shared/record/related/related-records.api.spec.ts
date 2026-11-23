import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { defer, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../public/i18n/record-related/en.json';
import ar from '../../../../../../../public/i18n/record-related/ar.json';
import enGlobal from '../../../../../../../public/i18n/en.json';
import arGlobal from '../../../../../../../public/i18n/ar.json';
import { ApiError } from '../../../../../core/api/api-errors';
import { CoreHttp } from '../../../../../core/api/core-http';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { CrmHttp, bindCrmHttpForTest, crmQueries } from '../../crm-http';
import { invalidateRelatedCounts, relatedCounts, relatedCountsQueryKey, relatedCountsRevision } from './related-records.api';
import { RecordRelatedBadges } from './record-related-badges';
import type { RelatedCounts } from './related-records.model';

const COMPANY = '019f0000-0000-7000-8000-000000000010';
const BRANCH = '019f0000-0000-7000-8000-000000000011';
const OTHER_BRANCH = '019f0000-0000-7000-8000-000000000012';
const RECORD = '019f0000-0000-7000-8000-00000000001a';
const URL = '/api/tenant/crm/v1/related-records/counts';
const COUNTS: RelatedCounts = { partyId: COMPANY, leads: 2, opportunities: 0, quotations: null, salesOrders: null, invoices: 0 };

class Loader implements TranslocoLoader {
  getTranslation(path: string) {
    const data = path.includes('/') ? (path.endsWith('ar') ? ar : en) : (path === 'ar' ? arGlobal : enGlobal);
    return defer(() => Promise.resolve(data as Translation));
  }
}

async function microtasks(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark']) {
    describe(`${lang} / ${theme}`, () => {
      describe('RelatedRecords', () => {
        const selection = signal<{ companyId: string; branchId: string | null } | null>(null);
        const branchCompanies = signal<ReadonlyMap<string, string>>(new Map());
        let http: HttpTestingController;
        let dispose: () => void;
        let fixture: ComponentFixture<RecordRelatedBadges> | undefined;
        let attributes: (string | null)[];
        let warnings: ReturnType<typeof vi.spyOn>;

        beforeEach(async () => {
          attributes = ['lang', 'dir', 'data-theme'].map(name => document.documentElement.getAttribute(name));
          document.documentElement.lang = lang;
          document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
          document.documentElement.dataset['theme'] = theme;
          selection.set({ companyId: COMPANY, branchId: BRANCH });
          branchCompanies.set(new Map([[BRANCH, COMPANY], [OTHER_BRANCH, COMPANY]]));
          TestBed.configureTestingModule({
            imports: [RecordRelatedBadges],
            providers: [
              provideHttpClient(), provideHttpClientTesting(), CoreHttp, CrmHttp,
              provideRouter([{ path: 'crm/leads', children: [] }, { path: 'crm/opportunities', children: [] }]),
              provideTransloco({
                config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true, prodMode: false },
                loader: Loader,
              }),
              { provide: TenantScopeState, useValue: { selection, branchCompanies } },
            ],
          });
          http = TestBed.inject(HttpTestingController);
          dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
          document.cookie = '__Host-mutakamel-tenant-csrf=test-csrf; Path=/; Secure';
          document.cookie = 'mutakamel-http-tenant-csrf=test-csrf; Path=/';
          warnings = vi.spyOn(console, 'warn');
          const transloco = TestBed.inject(TranslocoService);
          await firstValueFrom(transloco.load(lang));
          await firstValueFrom(transloco.load('record-related/' + lang));
        });

        afterEach(() => {
          fixture?.destroy();
          fixture = undefined;
          http.verify();
          crmQueries().clear();
          dispose();
          document.cookie = '__Host-mutakamel-tenant-csrf=; Path=/; Secure; Max-Age=0';
          document.cookie = 'mutakamel-http-tenant-csrf=; Path=/; Max-Age=0';
          ['lang', 'dir', 'data-theme'].forEach((name, i) => attributes[i] === null
            ? document.documentElement.removeAttribute(name) : document.documentElement.setAttribute(name, attributes[i]!));
          const missing = warnings.mock.calls.filter((args: unknown[]) => /Missing hint|Missing translation|not found/i.test(args.join(' ')));
          vi.restoreAllMocks();
          expect(missing).toEqual([]);
        });

        function assertRequest(request: TestRequest): void {
          expect(request.request.method).toBe('POST');
          expect(request.request.withCredentials).toBe(true);
          expect(request.request.headers.get('x-idempotency-key')).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
          expect(request.request.headers.get('x-mutakamel-company-id')).toBe(COMPANY);
          expect(request.request.headers.get('x-mutakamel-branch-id')).toBe(request.request.body.branchId);
          expect(Object.keys(request.request.body).sort()).toEqual(['branchId', 'recordIds', 'recordType']);
        }

        async function mount(): Promise<TestRequest> {
          fixture = TestBed.createComponent(RecordRelatedBadges);
          fixture.componentRef.setInput('recordType', 'LEAD');
          fixture.componentRef.setInput('recordId', RECORD);
          fixture.componentRef.setInput('branchId', BRANCH);
          fixture.detectChanges();
          await microtasks();
          return http.expectOne(URL);
        }

        async function render(): Promise<void> {
          await fixture!.whenStable();
          fixture!.detectChanges();
        }

        it('batches counts', async () => {
          const ids = Array.from({ length: 201 }, (_, n) => `019f0000-0000-7000-8000-${String(n + 100).padStart(12, '0')}`);
          const pending = ids.map(id => relatedCounts(BRANCH, 'LEAD', id));
          const duplicate = relatedCounts(BRANCH, 'LEAD', ' ' + ids[0].toUpperCase() + ' ');
          await microtasks();
          const requests = http.match(URL);
          expect(requests.map(req => req.request.body.recordIds.length)).toEqual([100, 100, 1]);
          const keys = requests.map(req => req.request.headers.get('x-idempotency-key'));
          expect(new Set(keys).size).toBe(3);
          for (const req of requests) {
            assertRequest(req);
            expect(req.request.body.recordType).toBe('LEAD');
            expect(new Set(req.request.body.recordIds).size).toBe(req.request.body.recordIds.length);
            req.flush({ countsByRecordId: Object.fromEntries(req.request.body.recordIds.map((id: string) => [id, COUNTS])) });
          }
          expect(await Promise.all(pending)).toEqual(ids.map(() => COUNTS));
          expect(await duplicate).toEqual(COUNTS);
          const cached = await relatedCounts(BRANCH, 'LEAD', ids[0]);
          cached!.leads = 99;
          expect((await relatedCounts(BRANCH, 'LEAD', ids[0]))!.leads).toBe(2);
          http.expectNone(URL);
          expect(relatedCountsQueryKey('LEAD', RECORD)).toEqual(['crm', 'related-counts', 'LEAD', RECORD]);
        });

        it('unavailable and empty', async () => {
          const request = await mount();
          assertRequest(request);
          request.flush({ countsByRecordId: { [RECORD]: COUNTS } });
          await render();
          const element: HTMLElement = fixture!.nativeElement;
          const badges = element.querySelectorAll('nav a, nav [role="link"]');
          expect(badges).toHaveLength(5);
          expect(Array.from(badges, badge => badge.querySelector('bdi')!.textContent)).toEqual(['2', '0', '—', '—', '0']);
          const texts = lang === 'ar' ? ar : en;
          expect(badges[0].getAttribute('aria-label')).toBe(texts.kinds.leads + ': 2');
          expect(badges[2].getAttribute('aria-label')).toBe(texts.kinds.quotations + ': —');
          expect(badges[2].getAttribute('title')).toBe(texts.unavailable);
          expect(badges[0].getAttribute('href')).toContain('excludeId=' + RECORD);
          expect(badges[0].getAttribute('href')).toContain('partyId=' + COMPANY);
          for (const badge of Array.from(badges).slice(1)) {
            expect(badge.getAttribute('aria-disabled')).toBe('true');
            expect(badge.hasAttribute('href')).toBe(false);
          }
          invalidateRelatedCounts('LEAD', RECORD);
          fixture!.detectChanges();
          await microtasks();
          http.expectOne(URL).flush({ countsByRecordId: {} });
          await render();
          expect(element.querySelectorAll('nav a, nav [role="link"]')).toHaveLength(0);
          expect(element.hidden).toBe(true);
          expect(await relatedCounts(BRANCH, 'LEAD', RECORD)).toBeNull();
          http.expectNone(URL);
        });

        it('separates branch and record type caches and invalidates each record across branches', async () => {
          const first = relatedCounts(BRANCH, 'LEAD', RECORD);
          const customer = relatedCounts(BRANCH, 'CUSTOMER_PROFILE', RECORD);
          await microtasks();
          const requests = http.match(URL);
          expect(requests).toHaveLength(2);
          for (const req of requests) { assertRequest(req); req.flush({ countsByRecordId: { [RECORD]: COUNTS } }); }
          await Promise.all([first, customer]);
          selection.set({ companyId: COMPANY, branchId: OTHER_BRANCH });
          const otherBranch = relatedCounts(OTHER_BRANCH, 'LEAD', RECORD);
          await microtasks();
          const req = http.expectOne(URL);
          assertRequest(req);
          req.flush({ countsByRecordId: { [RECORD]: { ...COUNTS, leads: 7 } } });
          expect((await otherBranch)!.leads).toBe(7);
          const previous = relatedCountsRevision();
          invalidateRelatedCounts('LEAD', RECORD);
          expect(relatedCountsRevision()).toBe(previous + 1);
          selection.set({ companyId: COMPANY, branchId: BRANCH });
          expect(await relatedCounts(BRANCH, 'CUSTOMER_PROFILE', RECORD)).toEqual(COUNTS);
          http.expectNone(URL);
          const reloaded = relatedCounts(BRANCH, 'LEAD', RECORD);
          await microtasks();
          http.expectOne(URL).flush({ countsByRecordId: {} });
          expect(await reloaded).toBeNull();
        });

        it('makes no request with no branch, an ambiguous branch, or a mismatching branch', async () => {
          expect(await relatedCounts('', 'LEAD', RECORD)).toBeNull();
          expect(await relatedCounts(BRANCH, 'LEAD', ' ')).toBeNull();
          selection.set({ companyId: COMPANY, branchId: null });
          expect(await relatedCounts(BRANCH, 'LEAD', RECORD)).toBeNull();
          selection.set({ companyId: COMPANY, branchId: BRANCH });
          branchCompanies.set(new Map());
          expect(await relatedCounts(BRANCH, 'LEAD', RECORD)).toBeNull();
          branchCompanies.set(new Map([[BRANCH, COMPANY]]));
          expect(await relatedCounts(OTHER_BRANCH, 'LEAD', RECORD)).toBeNull();
          http.expectNone(URL);
        });

        it('expires counts after 60 seconds and supports type-wide and full invalidation', async () => {
          const now = Date.now();
          const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
          for (const invalidate of [() => clock.mockReturnValue(now + 60_001),
            () => invalidateRelatedCounts('LEAD'), () => invalidateRelatedCounts()]) {
            const pending = relatedCounts(BRANCH, 'LEAD', RECORD);
            await microtasks();
            http.expectOne(URL).flush({ countsByRecordId: { [RECORD]: COUNTS } });
            await pending;
            expect(await relatedCounts(BRANCH, 'LEAD', RECORD)).toEqual(COUNTS);
            http.expectNone(URL);
            invalidate();
          }
          const pending = relatedCounts(BRANCH, 'LEAD', RECORD);
          await microtasks();
          http.expectOne(URL).flush({ countsByRecordId: {} });
          expect(await pending).toBeNull();
        });

        it('does not let a response started before invalidation replace the new count', async () => {
          const old = relatedCounts(BRANCH, 'LEAD', RECORD).catch(() => null);
          await microtasks();
          const oldRequest = http.expectOne(URL);
          invalidateRelatedCounts('LEAD', RECORD);
          const fresh = relatedCounts(BRANCH, 'LEAD', RECORD);
          await microtasks();
          http.expectOne(URL).flush({ countsByRecordId: { [RECORD]: { ...COUNTS, leads: 8 } } });
          expect((await fresh)!.leads).toBe(8);
          oldRequest.flush({ countsByRecordId: { [RECORD]: COUNTS } });
          await old;
          expect((await relatedCounts(BRANCH, 'LEAD', RECORD))!.leads).toBe(8);
          http.expectNone(URL);
        });

        it('shows a load failure with correlation id and retries without caching the failure', async () => {
          const request = await mount();
          request.flush({ errorCode: 'COMMON.GENERIC.INTERNAL_ERROR', correlationId: 'xr-rel-test' }, { status: 503, statusText: 'Unavailable' });
          await render();
          const element: HTMLElement = fixture!.nativeElement;
          expect(element.textContent).toContain('xr-rel-test');
          expect(element.textContent).toContain((lang === 'ar' ? arGlobal : enGlobal).apiErrors.generic);
          expect(element.querySelector('[role="alert"]')).not.toBeNull();
          element.querySelector<HTMLButtonElement>('ui-full-state button')!.click();
          fixture!.detectChanges();
          await microtasks();
          const retry = http.expectOne(URL);
          assertRequest(retry);
          retry.flush({ countsByRecordId: { [RECORD]: COUNTS } });
          await render();
          expect(element.querySelector('ui-full-state')).toBeNull();
          expect(element.querySelector('nav a')).not.toBeNull();
        });

        it('preserves transport errors without automatically retrying a read-like POST', async () => {
          for (const [status, code] of [[0, 'NETWORK_ERROR'], [403, 'BRANCH_PERMISSION_DENIED'], [429, 'GW.RATE.LIMIT_EXCEEDED']] as const) {
            const pending = relatedCounts(BRANCH, 'LEAD', RECORD);
            const rejected = expect(pending).rejects.toMatchObject({ status, code });
            await microtasks();
            const req = http.expectOne(URL);
            assertRequest(req);
            if (status === 0) req.error(new ProgressEvent('error'));
            else req.flush({ code }, { status, statusText: 'Rejected' });
            await rejected;
            expect(crmQueries().getQueryCache().getAll().at(-1)!.state.error).toBeInstanceOf(ApiError);
            http.expectNone(URL);
          }
        });

        it('rejects a malformed response for every record in the batch', async () => {
          const first = relatedCounts(BRANCH, 'LEAD', RECORD);
          const second = relatedCounts(BRANCH, 'LEAD', COMPANY);
          const failures = [expect(first).rejects.toBeInstanceOf(Error), expect(second).rejects.toBeInstanceOf(Error)];
          await microtasks();
          http.expectOne(URL).flush({});
          await Promise.all(failures);
        });
      });
    });
  }
}
