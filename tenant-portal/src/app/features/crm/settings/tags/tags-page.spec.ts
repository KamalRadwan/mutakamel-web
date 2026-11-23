import { Injectable, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../public/i18n/en.json';
import ar from '../../../../../../public/i18n/ar.json';
import enSettings from '../../../../../../public/i18n/settings/en.json';
import arSettings from '../../../../../../public/i18n/settings/ar.json';
import enTags from '../../../../../../public/i18n/settings-tags/en.json';
import arTags from '../../../../../../public/i18n/settings-tags/ar.json';
import enBulk from '../../../../../../public/i18n/bulk-jobs/en.json';
import arBulk from '../../../../../../public/i18n/bulk-jobs/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { BulkJobReport } from '../../../../shared/bulk-jobs/job-report/job-report';
import { BulkJob, BulkJobSubmitResult, isBulkJobActive } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { TagModal } from './tag-modal/tag-modal';
import { TagsPage } from './tags-page';
import type { Tag } from './tags.model';
import { CRM_TAGS_BULK_MODULE, tagDeleteJob } from './tags-bulk';

@Injectable()
class TagsLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const arabic = path.endsWith('ar');
    if (path.startsWith('bulk-jobs/')) return of(arabic ? arBulk : enBulk);
    if (path.startsWith('settings-tags/')) return of(arabic ? arTags : enTags);
    if (path.startsWith('settings/')) return of(arabic ? arSettings : enSettings);
    return of(arabic ? ar : en);
  }
}

const tag = (id: string, name: string): Tag => ({
  id, name, backgroundColor: null, textColor: null,
  createdAt: '2026-11-18T00:00:00Z', updatedAt: '2026-11-18T00:00:00Z',
});

const accepted: BulkJobSubmitResult = {
  jobId: 'tag-delete-job', status: 'QUEUED', total: 101,
  skippedAtSubmit: 0, failedAtSubmit: 0, chunkCount: 2,
};

for (const language of ['en', 'ar'] as const)
  for (const theme of ['light', 'dark']) {
    describe(`${language} ${theme}`, () => {
      let fixture: ComponentFixture<TagsPage>;
      let page: TagsPage;
      let modal: TagModal;
      let stub: CrmHttpStub;
      let dispose: () => void;
      let rows: Tag[];
      let reportFixture: ComponentFixture<BulkJobReport> | undefined;
      const jobs = signal<BulkJob[]>([]);
      // Angular bundles module exports as non-configurable; stub the tracker boundary instead.
      const tracker = {
        jobs: computed(() => [...jobs()].sort((a, b) => Number(isBulkJobActive(b.status)) - Number(isBulkJobActive(a.status)))),
        activeCount: computed(() => jobs().filter((job) => isBulkJobActive(job.status)).length),
        reportTarget: signal(null).asReadonly(),
        scopesVersion: signal(0).asReadonly(),
        openReport: vi.fn(),
        clearReportTarget: vi.fn(),
        syncExternalJob: vi.fn((job: BulkJob) => jobs.update((items) => [job, ...items.filter((item) => item.id !== job.id)])),
        descriptorFor: () => CRM_TAGS_BULK_MODULE,
        actionDescriptorFor: () => CRM_TAGS_BULK_MODULE.actions['DELETE'],
        jobTitle: () => TestBed.inject(TranslocoService).translate(CRM_TAGS_BULK_MODULE.actions['DELETE'].titleKey),
        reasonText: (code: string) => TestBed.inject(TranslocoService).translate(`tags.errors.${code}`),
        ensureScopesForModule: async () => {},
        retry: vi.fn(),
      };
      const me = signal(FAKE_TENANT_ME);
      const dialogPrototype = HTMLDialogElement.prototype;
      const originalShow = dialogPrototype.showModal;
      const originalClose = dialogPrototype.close;
      let originalAttributes: { lang: string; dir: string; theme: string | null };

      beforeEach(() => {
        TestBed.resetTestingModule();
        globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
        dialogPrototype.showModal = function () { this.setAttribute('open', ''); };
        dialogPrototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
        originalAttributes = { lang: document.documentElement.lang, dir: document.documentElement.dir,
          theme: document.documentElement.getAttribute('data-theme') };
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', theme);
        rows = [tag('z', 'Zulu'), tag('a', 'Alpha')];
        jobs.set([]);
        vi.clearAllMocks();
        stub = new CrmHttpStub({ '/tags': rows });
        dispose = bindCrmHttpForTest(stub);
        TestBed.configureTestingModule({
          imports: [TagsPage],
          providers: [provideRouter([]), { provide: BulkJobsTracker, useValue: tracker }, provideTransloco({
            config: { availableLangs: ['en', 'ar'], defaultLang: language, reRenderOnLangChange: true },
            loader: TagsLoader,
          }), { provide: TenantScopeState, useValue: { me } },
          { provide: LanguageState, useValue: { current: signal(language) } }],
        });
        TestBed.inject(TranslocoService).setTranslation({ ...(language === 'ar' ? ar : en),
          settings: language === 'ar' ? arSettings : enSettings,
          tags: language === 'ar' ? arTags : enTags,
          bulkJobs: language === 'ar' ? arBulk : enBulk,
        }, language);
      });

      afterEach(() => {
        reportFixture?.destroy();
        reportFixture = undefined;
        fixture?.destroy();
        dialogPrototype.showModal = originalShow;
        dialogPrototype.close = originalClose;
        crmQueries().clear();
        dispose();
        vi.restoreAllMocks();
        TestBed.resetTestingModule();
        document.documentElement.lang = originalAttributes.lang;
        document.documentElement.dir = originalAttributes.dir;
        if (originalAttributes.theme === null) document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', originalAttributes.theme);
      });

      async function stable() {
        await fixture.whenStable();
        fixture.detectChanges();
      }

      async function render(manage = true, read = true, tenantWide = true) {
        const permissions = [read ? 'crm.tags.read.team' : '', manage ? 'crm.tags.manage.team' : ''].filter(Boolean);
        me.set({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions,
          permissionScopes: Object.fromEntries(permissions.map((key) => [key,
            { tenantWide, companyIds: [], branchIds: tenantWide ? [] : ['branch-a'] }])),
        });
        fixture = TestBed.createComponent(TagsPage);
        page = fixture.componentInstance;
        fixture.detectChanges();
        await vi.waitFor(() => expect(page['loading']()).toBe(false));
        await stable();
        modal = fixture.debugElement.query(By.directive(TagModal)).componentInstance;
      }

      const t = (key: string, params?: Record<string, unknown>) => TestBed.inject(TranslocoService).translate(key, params);
      const fullState = () => fixture.debugElement.query(By.directive(FullState))?.componentInstance as FullState | undefined;
      const errorToast = () => vi.spyOn(TestBed.inject(Notify), 'error');

      describe('TagsPage', () => {
        it('loads and shows empty', async () => {
          const read = vi.spyOn(stub, 'read');
          await render();
          expect(read).toHaveBeenCalledWith('/tags');
          expect(page['tags']().map((item) => item.name)).toEqual(['Alpha', 'Zulu']);
          expect(fixture.nativeElement.textContent).toContain('Alpha');
          read.mockResolvedValue([]);
          await page['load']();
          await stable();
          expect(fixture.nativeElement.textContent).toContain(t('tags.empty'));
          expect(page['canManage']()).toBe(true);
        });

        it('create re-sorts', async () => {
          await render();
          const created = tag('b', 'Beta');
          vi.spyOn(stub, 'write').mockResolvedValue({ status: 201, data: created, etag: null, location: null });
          page['openNew']();
          await stable();
          modal['name'].set('Beta');
          await modal['save']();
          await stable();
          expect(page['tags']().map((item) => item.name)).toEqual(['Alpha', 'Beta', 'Zulu']);
        });

        it('update replaces and re-sorts', async () => {
          await render();
          vi.spyOn(stub, 'write').mockResolvedValue({ status: 200, data: tag('z', 'Aardvark'), etag: null, location: null });
          page['openTag'](rows[0]);
          await stable();
          modal['name'].set('Aardvark');
          await modal['save']();
          await stable();
          expect(page['tags']().map((item) => item.name)).toEqual(['Aardvark', 'Alpha']);
        });

        it('delete runs as a job', async () => {
          await render();
          vi.spyOn(page['deleteDialog'](), 'open').mockResolvedValue(true);
          vi.spyOn(stub, 'write').mockResolvedValue({ status: 202, data: accepted, etag: null, location: null });
          const success = vi.spyOn(TestBed.inject(Notify), 'success');
          await page['requestDelete'](rows[0]);
          await stable();
          expect(tracker.activeCount()).toBe(1);
          expect(tracker.jobs()[0]).toMatchObject({ id: accepted.jobId, module: 'crm.tags', action: 'DELETE',
            paramsSummary: { tagId: 'z' } });
          expect(tracker.openReport).toHaveBeenCalledWith('crm', accepted.jobId);
          expect(tracker.jobTitle()).toBe(t('tags.job.delete'));
          expect(fixture.nativeElement.textContent).toContain(t('tags.delete.deleting'));
          expect(fixture.nativeElement.textContent).toContain(t('tags.delete.report'));
          expect(t('tags.delete.text', { name: 'Zulu' })).toContain(language === 'en'
            ? 'This tag will be removed from every record that carries it.' : 'سيُزال هذا الوسم من كل سجل يحمله.');
          expect(page['tags']()).toHaveLength(2);
          expect(success).not.toHaveBeenCalled();

          reportFixture = TestBed.createComponent(BulkJobReport);
          reportFixture.componentInstance['job'].set(tracker.jobs()[0]);
          reportFixture.detectChanges();
          await reportFixture.whenStable();
          reportFixture.detectChanges();
          expect(reportFixture.nativeElement.textContent).toContain(t('tags.job.delete'));
        });

        it('repeat delete reuses the job', async () => {
          await render();
          const confirm = vi.spyOn(page['deleteDialog'](), 'open').mockResolvedValue(true);
          const write = vi.spyOn(stub, 'write').mockResolvedValue({ status: 202, data: accepted, etag: null, location: null });
          await page['requestDelete'](rows[0]);
          const running = { ...tracker.jobs()[0], status: 'RUNNING' as const, revision: 3, processed: 40 };
          tracker.syncExternalJob(running);
          await stable();
          await page['requestDelete'](rows[0]);
          expect(write).toHaveBeenCalledTimes(1);
          expect(confirm).toHaveBeenCalledTimes(1);
          expect(tracker.jobs()).toEqual([running]);
          expect(tracker.openReport).toHaveBeenLastCalledWith('crm', accepted.jobId);
          page['openTag'](rows[0]);
          expect(modal.editingId()).toBeNull();
        });

        it('job outcome', async () => {
          const read = vi.spyOn(stub, 'read');
          await render();
          vi.spyOn(page['deleteDialog'](), 'open').mockResolvedValue(true);
          vi.spyOn(stub, 'write').mockResolvedValue({ status: 202, data: accepted, etag: null, location: null });
          await page['requestDelete'](rows[0]);
          const failed = { ...tracker.jobs()[0], status: 'COMPLETED_WITH_ERRORS' as const, revision: 1,
            processed: 101, counts: { succeeded: 100, unchanged: 0, skipped: 0, failed: 1, cancelled: 0 } };
          tracker.syncExternalJob(failed);
          await stable();
          expect(page['tags']()).toHaveLength(2);
          expect(fixture.nativeElement.textContent).toContain(t('tags.delete.incomplete'));

          reportFixture = TestBed.createComponent(BulkJobReport);
          reportFixture.componentInstance['job'].set(failed);
          reportFixture.componentInstance['items'].set([{ ordinal: 101, entityId: 'link-id',
            label: 'LEAD:record-id', status: 'FAILED', code: 'CRM_TAG_DELETE_LINKS_REMAINING' }]);
          reportFixture.detectChanges();
          await reportFixture.whenStable();
          reportFixture.detectChanges();
          expect(reportFixture.nativeElement.textContent).toContain(t('bulkJobs.report.retry'));
          expect(reportFixture.nativeElement.textContent).toContain(t('tags.errors.CRM_TAG_DELETE_LINKS_REMAINING'));

          const retried = { ...accepted, jobId: 'retry-job' };
          tracker.retry.mockImplementation(async () => {
            tracker.syncExternalJob(tagDeleteJob('z', retried));
            return retried.jobId;
          });
          const retryButton = [...reportFixture.nativeElement.querySelectorAll('button')]
            .find((button) => (button as HTMLButtonElement).textContent?.trim() === t('bulkJobs.report.retry')) as HTMLButtonElement;
          retryButton.click();
          await reportFixture.whenStable();
          await stable();
          expect(tracker.retry).toHaveBeenCalledWith(failed, null);
          expect(tracker.openReport).toHaveBeenLastCalledWith('crm', retried.jobId);
          expect(tracker.activeCount()).toBe(1);
          expect(page['deleteJobs']().get('z')?.id).toBe('retry-job');
          expect(fixture.nativeElement.textContent).toContain(t('tags.delete.deleting'));

          read.mockResolvedValue([rows[1]]);
          const completed = { ...tagDeleteJob('z', retried), status: 'COMPLETED' as const, revision: 2,
            processed: 101, counts: { succeeded: 101, unchanged: 0, skipped: 0, failed: 0, cancelled: 0 } };
          tracker.syncExternalJob(completed);
          await stable();
          expect(page['tags']()).toEqual([rows[1]]);
          expect(tracker.activeCount()).toBe(0);
        });

        it('delete 404 is done', async () => {
          const read = vi.spyOn(stub, 'read');
          await render();
          const toast = errorToast();
          vi.spyOn(page['deleteDialog'](), 'open').mockResolvedValue(true);
          vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(404, 'CRM_TAG_NOT_FOUND'));
          read.mockResolvedValue([rows[1]]);
          await page['requestDelete'](rows[0]);
          await stable();
          expect(read).toHaveBeenCalledTimes(2);
          expect(page['tags']()).toEqual([rows[1]]);
          expect(toast).not.toHaveBeenCalled();
        });

        it('sync delete', async () => {
          const read = vi.spyOn(stub, 'read');
          await render();
          vi.spyOn(page['deleteDialog'](), 'open').mockResolvedValue(true);
          read.mockResolvedValue([rows[1]]);
          await page['requestDelete'](rows[0]);
          expect(page['tags']()).toEqual([rows[1]]);
          expect(stub.recordedWrites()[0]).toMatchObject({ method: 'DELETE', path: '/tags/z' });
        });

        it('restored completion waits for the initial list before refreshing', async () => {
          jobs.set([{ ...tagDeleteJob('z', accepted), status: 'COMPLETED', revision: 2 }]);
          const read = vi.spyOn(stub, 'read').mockResolvedValue([rows[1]]);
          await render();
          expect(page['loading']()).toBe(false);
          expect(page['tags']()).toEqual([rows[1]]);
          expect(read).toHaveBeenCalledTimes(2);
        });

        it('read-only render', async () => {
          await render(false);
          expect(fixture.nativeElement.querySelector('ui-actions-menu')).toBeNull();
          const labels = () => [...fixture.nativeElement.querySelectorAll('button')].map((b) => (b as HTMLButtonElement).textContent?.trim());
          expect(labels()).not.toContain(t('tags.new'));
          page['openTag'](rows[0]);
          await stable();
          expect(fixture.nativeElement.querySelector('app-tag-modal input').readOnly).toBe(true);
          const modalLabels = [...fixture.nativeElement.querySelectorAll('app-tag-modal button')].map((b) => (b as HTMLButtonElement).textContent?.trim());
          expect(modalLabels).not.toContain(t('settings.common.save'));
          expect(modalLabels).not.toContain(t('settings.common.delete'));
          await modal['save']();
          await page['requestDelete'](rows[0]);
          expect(stub.recordedWrites()).toEqual([]);
        });

        it('requires a tenant-wide read grant', async () => {
          const read = vi.spyOn(stub, 'read');
          await render(true, true, false);
          expect(fullState()?.kind()).toBe('forbidden');
          expect(read).not.toHaveBeenCalled();
        });

        it('load failure shows Retry and correlation id', async () => {
          vi.spyOn(stub, 'read').mockRejectedValue(new ApiError(503, 'INTERNAL_ERROR', undefined, { correlationId: 'tag-ref' }));
          await render();
          expect(fullState()?.kind()).toBe('load-failure');
          expect(fullState()?.text()).toContain('tag-ref');
          expect(fullState()?.actionLabel()).toBe(t('settings.common.retry'));
        });

        it('load 403 shows forbidden', async () => {
          vi.spyOn(stub, 'read').mockRejectedValue(new ApiError(403, 'CRM_MODULE_DISABLED'));
          await render();
          expect(fullState()?.kind()).toBe('forbidden');
        });
      });

      describe('TagModal', () => {
        it('create errors on fields', async () => {
          await render();
          const write = vi.spyOn(stub, 'write');
          const toast = errorToast();
          page['openNew']();
          await stable();
          modal['name'].set('Taken');
          for (const [error, nameCode, colorCode] of [
            [new ApiError(409, 'CRM_TAG_NAME_TAKEN'), 'CRM_TAG_NAME_TAKEN', null],
            [new ApiError(400, 'CRM_VALIDATION_FAILED', { name: ['Name message'], backgroundColor: ['Colour message'] }), 'CRM_TAG_NAME_INVALID', 'CRM_TAG_COLOR_INVALID'],
            [new ApiError(422, 'CRM_TAG_COLOR_INCOMPLETE'), null, 'CRM_TAG_COLOR_INCOMPLETE'],
          ] as const) {
            write.mockRejectedValue(error);
            await modal['save']();
            await stable();
            expect(modal['nameServerError']()).toBe(nameCode);
            expect(modal['colorServerError']()).toBe(colorCode);
            expect(modal['name']()).toBe('Taken');
          }
          expect(toast).not.toHaveBeenCalled();
          const input = fixture.nativeElement.querySelector('app-tag-modal input') as HTMLInputElement;
          const hintId = input.getAttribute('aria-describedby')!.split(' ')[0];
          expect(fixture.nativeElement.querySelector(`[id="${hintId}"]`)).not.toBeNull();
        });

        it('unchanged edit sends nothing', async () => {
          await render();
          const write = vi.spyOn(stub, 'write');
          page['openTag'](rows[0]);
          await stable();
          await modal['save']();
          expect(write).not.toHaveBeenCalled();
        });

        for (const code of ['CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY']) {
          it(`${code} preserves the form as read-only without Save`, async () => {
            await render();
            vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(403, code));
            page['openNew']();
            await stable();
            modal['name'].set('Kept');
            await modal['save']();
            await stable();
            expect(modal['name']()).toBe('Kept');
            expect(page['canManage']()).toBe(false);
            expect(fixture.nativeElement.querySelector('app-tag-modal input').readOnly).toBe(true);
            const labels = [...fixture.nativeElement.querySelectorAll('app-tag-modal button')].map((b) => (b as HTMLButtonElement).textContent?.trim());
            expect(labels).not.toContain(t('settings.common.save'));
          });
        }

        for (const [status, code, details, expectedKey] of [
          [401, 'UNAUTHORIZED', undefined, 'settings.errors.notSaved'],
          [409, 'GW.IDEM.IN_FLIGHT', undefined, 'settings.errors.GW.IDEM.IN_FLIGHT'],
          [409, 'GW.IDEM.MISMATCH', undefined, 'settings.errors.idempotencyMismatch'],
          [429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['12'] }, 'settings.errors.rateLimitedIn'],
          [403, 'CRM_PERMISSION_DENIED', undefined, 'settings.errors.CRM_PERMISSION_DENIED'],
          [0, 'NETWORK_ERROR', undefined, 'settings.errors.network'],
          [503, 'INTERNAL_ERROR', undefined, 'settings.errors.generic'],
        ] as const) {
          it(`keeps edits and shows the write error for ${code}`, async () => {
            await render();
            vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(status, code, details));
            const toast = errorToast();
            page['openNew']();
            await stable();
            modal['name'].set('Kept');
            await modal['save']();
            await stable();
            expect(modal['name']()).toBe('Kept');
            expect(toast).toHaveBeenCalledWith(t(expectedKey, { seconds: '12' }));
          });
        }

        it('PATCH 404 closes and reloads', async () => {
          const read = vi.spyOn(stub, 'read');
          await render();
          page['openTag'](rows[0]);
          await stable();
          modal['name'].set('Changed');
          read.mockResolvedValue([rows[1]]);
          vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(404, 'CRM_TAG_NOT_FOUND'));
          await modal['save']();
          await stable();
          expect(read).toHaveBeenCalledTimes(2);
          expect(page['tags']()).toEqual([rows[1]]);
          expect(modal.editingId()).toBeNull();
        });
      });
    });
  }
