import { Injectable, signal } from '@angular/core';
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
import enStages from '../../../../../../public/i18n/settings-opportunity-stages/en.json';
import arStages from '../../../../../../public/i18n/settings-opportunity-stages/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Modal } from '../../../../shared/ui/modal/modal';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { OpportunityStageModal } from './opportunity-stage-modal/opportunity-stage-modal';
import { OpportunityStagesPage } from './opportunity-stages-page';
import { OPPORTUNITY_STAGE_USAGE_READER } from './opportunity-stages.api';
import type { OpportunityStage, StageUsagePipeline } from './opportunity-stages.model';

type UsageReader = () => Promise<Record<string, StageUsagePipeline[]>>;

@Injectable()
class SettingsLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const arabic = path.endsWith('ar');
    if (path.startsWith('settings-opportunity-stages/')) return of(arabic ? arStages : enStages);
    if (path.startsWith('settings/')) return of(arabic ? arSettings : enSettings);
    return of(arabic ? ar : en);
  }
}

for (const language of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) {
  describe(`${language} ${theme}`, () => {
    let fixture: ComponentFixture<OpportunityStagesPage>;
    let page: OpportunityStagesPage;
    let modal: OpportunityStageModal;
    let stub: CrmHttpStub;
    let dispose: () => void;
    let rows: OpportunityStage[];
    let custom: OpportunityStage;
    let usage: ReturnType<typeof vi.fn<UsageReader>>;
    const me = signal(FAKE_TENANT_ME);
    const dialog = HTMLDialogElement.prototype;
    const originalShow = dialog.showModal;
    const originalClose = dialog.close;

    beforeEach(() => {
      globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
      dialog.showModal = function () { this.setAttribute('open', ''); };
      dialog.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.setAttribute('data-theme', theme);
      const base = { isActive: true, createdAt: '2026-11-18T00:00:00Z', updatedAt: '2026-11-18T00:00:00Z' };
      rows = [
        { ...base, id: crypto.randomUUID(), nameAr: 'جديدة', nameEn: 'New', flag: 'NEW', category: 'OPEN', isSystem: true },
        { ...base, id: crypto.randomUUID(), nameAr: 'مراجعة', nameEn: 'Review', flag: 'DISCOVERY', category: 'IN_PROGRESS', isSystem: false },
      ];
      custom = rows[1];
      stub = new CrmHttpStub({ '/opportunity-stages': rows });
      dispose = bindCrmHttpForTest(stub);
      usage = vi.fn<UsageReader>().mockResolvedValue({});
      me.set({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: ['crm.pipelines.manage'],
        permissionScopes: { 'crm.pipelines.manage': { tenantWide: true, companyIds: [], branchIds: [] } } });
      TestBed.configureTestingModule({ imports: [OpportunityStagesPage], providers: [
        provideRouter([]),
        provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: language, reRenderOnLangChange: true }, loader: SettingsLoader }),
        { provide: TenantScopeState, useValue: { me } },
        { provide: LanguageState, useValue: { current: signal(language) } },
        { provide: OPPORTUNITY_STAGE_USAGE_READER, useValue: usage },
      ] });
      TestBed.inject(TranslocoService).setTranslation({ ...(language === 'ar' ? ar : en),
        settings: language === 'ar' ? arSettings : enSettings,
        opportunityStages: language === 'ar' ? arStages : enStages }, language);
    });

    afterEach(() => {
      fixture?.destroy();
      dialog.showModal = originalShow;
      dialog.close = originalClose;
      crmQueries().clear(); dispose(); vi.restoreAllMocks(); TestBed.resetTestingModule();
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.dir = 'ltr'; document.documentElement.lang = 'en';
    });

    async function stable() { await fixture.whenStable(); fixture.detectChanges(); }
    async function render() {
      fixture = TestBed.createComponent(OpportunityStagesPage); page = fixture.componentInstance;
      fixture.detectChanges();
      await vi.waitFor(() => expect(page['loading']()).toBe(false));
      await stable();
      modal = fixture.debugElement.query(By.directive(OpportunityStageModal)).componentInstance;
    }
    function fullState(): FullState | undefined { return fixture.debugElement.query(By.directive(FullState))?.componentInstance; }
    function t(key: string) { return TestBed.inject(TranslocoService).translate(key); }
    function inUseModal() { return fixture.debugElement.queryAll(By.directive(Modal)).map((d) => d.componentInstance as Modal)
      .find((m) => m.title() === t('opportunityStages.inUse.title'))!; }
    function result(data: OpportunityStage) { return { status: 200, data, etag: null, location: null }; }

    describe('OpportunityStagesPage', () => {
      it('loads stages', async () => {
        await render();
        expect(page['stages']()).toEqual(rows);
        expect(fixture.nativeElement.textContent).toContain(custom.nameAr);
        expect(fixture.nativeElement.textContent).toContain(custom.nameEn);
        expect(fullState()).toBeUndefined();
      });

      it('usage failure does not fail the page', async () => {
        usage.mockRejectedValue(new ApiError(503, 'INTERNAL_ERROR'));
        await render();
        expect(fullState()).toBeUndefined();
        expect(page['usedInText'](custom)).toBe('');
        expect(fixture.nativeElement.textContent).toContain('—');
        page['openEdit'](custom); await stable();
        expect(modal['meaningLocked']()).toBe(false);
        expect(modal['activeLocked']()).toBe(false);
        expect(fixture.nativeElement.querySelector('input[id$="-used-in"]').value).toBe('—');
      });

      it('does not wait for usage to show the catalogue', async () => {
        let resolve!: (value: Record<string, StageUsagePipeline[]>) => void;
        usage.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
        await render();
        expect(page['stages']()).toEqual(rows);
        resolve({}); await stable();
      });

      it('in use refetches usage first', async () => {
        await render(); page['openEdit'](custom); await stable();
        modal['setFlag']('PROPOSAL');
        const pipeline = { id: crypto.randomUUID(), nameAr: 'مسار جديد', nameEn: 'Fresh pipeline' };
        let resolve!: (value: Record<string, StageUsagePipeline[]>) => void;
        usage.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
        const warning = vi.spyOn(inUseModal(), 'open');
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'OPPORTUNITY_STAGE_IN_USE'));
        await modal['save']();
        expect(usage).toHaveBeenCalledTimes(2);
        expect(warning).not.toHaveBeenCalled();
        resolve({ [custom.id]: [pipeline] });
        await vi.waitFor(() => expect(warning).toHaveBeenCalledOnce());
        await stable();
        expect(page['inUsePipelines']()).toEqual([pipeline]);
        expect(modal['meaningLocked']()).toBe(true);
        expect(modal['flag']()).toBe(custom.flag);
      });

      it('delete outcomes', async () => {
        await render();
        const confirm = fixture.debugElement.queryAll(By.directive(ConfirmDialog)).map((d) => d.componentInstance as ConfirmDialog)
          .find((d) => d.tone() === 'danger')!;
        vi.spyOn(confirm, 'open').mockResolvedValue(true);
        const write = vi.spyOn(stub, 'write');
        const toast = vi.spyOn(TestBed.inject(Notify), 'error');
        const warning = vi.spyOn(inUseModal(), 'open');
        for (const [status, code] of [[409, 'OPPORTUNITY_STAGE_IN_USE'], [422, 'OPPORTUNITY_STAGE_SYSTEM_PROTECTED'], [404, 'OPPORTUNITY_STAGE_NOT_FOUND']] as const) {
          write.mockRejectedValueOnce(new ApiError(status, code));
          await page['confirmDelete'](custom);
          if (status === 409) { expect(warning).toHaveBeenCalled(); expect(usage).toHaveBeenCalledTimes(2); }
          if (status === 422) { expect(toast).toHaveBeenCalledWith(t(`opportunityStages.errors.${code}`)); expect(page['stages']()).toContainEqual(custom); }
          if (status === 404) expect(page['stages']()).not.toContainEqual(custom);
        }
        page['stages'].set(rows);
        await page['confirmDelete'](custom);
        expect(page['stages']()).not.toContainEqual(custom);
      });

      it('no fake ids left', async () => {
        await render();
        expect(page['sortedStages']()[0]).toEqual(rows[0]);
        expect(page['actions'](rows[0]).find((a) => a.id === 'toggleActive')?.disabled).toBe(true);
        page['openEdit'](rows[0]); await stable();
        expect(modal['isSystem']()).toBe(true);
        expect(modal['meaningLocked']()).toBe(true);
        expect(modal['flag']()).toBe('NEW');
        expect(page['actions'](custom).find((a) => a.id === 'toggleActive')?.disabled).toBeUndefined();
      });

      it('renders load failure and reference, then retries', async () => {
        const read = vi.spyOn(stub, 'read').mockRejectedValueOnce(new ApiError(503, 'INTERNAL_ERROR', undefined, { correlationId: 'stage-ref' }));
        await render();
        expect(fullState()?.kind()).toBe('load-failure');
        expect(fullState()?.text()).toContain('stage-ref');
        expect(fullState()?.actionLabel()).toBe(t('settings.common.retry'));
        await page['load'](); await stable();
        expect(fullState()).toBeUndefined(); expect(read).toHaveBeenCalledTimes(2);
        read.mockRejectedValueOnce(new ApiError(422, 'OPPORTUNITY_STAGE_LIMIT_EXCEEDED'));
        await page['load'](); await stable();
        expect(fullState()?.text()).toBe(t('opportunityStages.errors.OPPORTUNITY_STAGE_LIMIT_EXCEEDED'));
      });

      it('drops a missing stage after a modal update or activation', async () => {
        await render(); page['openEdit'](custom); await stable(); modal['nameEn'].set('Renamed');
        const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(404, 'OPPORTUNITY_STAGE_NOT_FOUND'));
        await modal['save'](); await stable();
        expect(page['stages']()).not.toContainEqual(custom);
        page['stages'].set(rows);
        write.mockRejectedValueOnce(new ApiError(404, 'NOT_FOUND'));
        await page['toggleActive'](custom);
        expect(page['stages']()).not.toContainEqual(custom);
      });

      it('requires tenant-wide manage and renders each forbidden load code', async () => {
        me.set({ ...me(), permissions: ['crm.pipelines.read'], permissionScopes: {} });
        const read = vi.spyOn(stub, 'read');
        await render();
        expect(fullState()?.kind()).toBe('forbidden'); expect(read).not.toHaveBeenCalled();
        me.set({ ...me(), permissions: ['crm.pipelines.manage'], permissionScopes: { 'crm.pipelines.manage': { tenantWide: true, companyIds: [], branchIds: [] } } });
        for (const code of ['CRM_SUBSCRIPTION_BLOCKED', 'CRM_MODULE_DISABLED', 'CRM_MODULE_SEAT_REQUIRED', 'CRM_FEATURE_DISABLED', 'CRM_PERMISSION_DENIED', 'BRANCH_ACCESS_DENIED']) {
          read.mockRejectedValueOnce(new ApiError(403, code));
          await page['load'](); await stable();
          expect(fullState()?.kind()).toBe('forbidden');
          expect(fullState()?.text()).toBe(t(`settings.errors.${code}`));
        }
      });
    });

    describe('OpportunityStageModal', () => {
      it('warns on a duplicate name', async () => {
        await render(); page['openCreate'](); await stable();
        modal['nameAr'].set('  ' + custom.nameAr + '  '); modal['nameEn'].set('  ' + custom.nameEn + '  ');
        await stable();
        expect(modal['errorOf']('nameAr')).toBeNull();
        expect(modal['duplicateName']('nameAr')).toBe(t('opportunityStages.validation.duplicateName'));
        expect(modal['duplicateName']('nameEn')).toBe(t('opportunityStages.validation.duplicateName'));
        const warning = fixture.nativeElement.querySelector('[id$="-name-en-warning"]');
        const control = fixture.nativeElement.querySelector('input[id$="-name-en"]');
        expect(control.getAttribute('aria-describedby')).toContain(warning.id);
        const write = vi.spyOn(stub, 'write').mockResolvedValueOnce(result({ ...custom, id: crypto.randomUUID() }));
        await modal['save']();
        expect(write.mock.calls[0][2]).toEqual({ nameAr: custom.nameAr, nameEn: custom.nameEn, flag: 'DISCOVERY', category: 'IN_PROGRESS' });
        page['stages'].set(rows);
        page['openEdit'](custom); await stable();
        expect(modal['duplicateName']('nameEn')).toBeNull();
      });

      it('keeps every label hint linked to its control', async () => {
        await render(); page['openEdit'](custom); await stable();
        for (const element of fixture.debugElement.queryAll(By.directive(Field))) {
          const field = element.componentInstance as Field;
          expect(field.hint().trim()).not.toBe('');
          const hint = element.nativeElement.querySelector('[role="tooltip"]');
          const control = element.nativeElement.querySelector('input, [role="switch"], button[aria-haspopup]');
          expect(control?.getAttribute('aria-describedby')).toContain(hint.id);
        }
      });

      it('renders server validation messages by field', async () => {
        await render(); page['openEdit'](custom); await stable(); modal['nameEn'].set('Changed');
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(400, 'CRM_VALIDATION_FAILED', { nameEn: ['Please check the stage name'], flag: ['Please check the meaning'] }));
        await modal['save'](); await stable();
        expect(Object.keys(modal['serverErrors']())).toEqual(['nameEn', 'flag']);
        expect(modal['errorOf']('nameEn')).toBe('Please check the stage name');
        expect(modal['nameEn']()).toBe('Changed');
      });

      for (const code of ['OPPORTUNITY_STAGE_CATEGORY_INVALID', 'OPPORTUNITY_STAGE_SYSTEM_PROTECTED', 'OPPORTUNITY_STAGE_LIMIT_EXCEEDED', 'CRM_PERMISSION_DENIED']) {
        it(`keeps edits with a translated toast for ${code}`, async () => {
          await render(); page['openEdit'](custom); await stable(); modal['nameEn'].set('Kept');
          vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(code === 'CRM_PERMISSION_DENIED' ? 403 : 422, code));
          await modal['save'](); await stable();
          expect(modal['nameEn']()).toBe('Kept');
          const prefix = code === 'CRM_PERMISSION_DENIED' ? 'settings' : 'opportunityStages';
          expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(t(`${prefix}.errors.${code}`));
        });
      }

      for (const code of ['CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY']) {
        it(`switches to read-only fields without Save after ${code}`, async () => {
          await render(); page['openEdit'](custom); await stable(); modal['nameEn'].set('Kept');
          vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(403, code));
          await modal['save'](); await stable();
          expect(page['canManage']()).toBe(false); expect(modal.canManage()).toBe(false);
          expect(modal['nameEn']()).toBe('Kept');
          const save = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
            .find((button) => button.textContent?.trim() === t('settings.common.save'));
          expect(save).toBeUndefined();
          expect(fixture.nativeElement.querySelector('input[id$="-name-en"]').readOnly).toBe(true);
          expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(t(`settings.errors.${code}`));
        });
      }

      for (const [status, code, key] of [[401, 'UNAUTHORIZED', 'settings.errors.notSaved'], [409, 'GW.IDEM.IN_FLIGHT', 'settings.errors.GW.IDEM.IN_FLIGHT'], [422, 'GW.IDEM.MISMATCH', 'settings.errors.GW.IDEM.MISMATCH'], [429, 'RATE_LIMITED', 'settings.errors.rateLimitedIn']] as const) {
        it(`keeps edits and shows the write message for ${code}`, async () => {
          await render(); page['openEdit'](custom); await stable(); modal['nameEn'].set('Kept');
          vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(status, code, { retryAfterSeconds: ['12'] }));
          await modal['save'](); await stable();
          expect(modal['nameEn']()).toBe('Kept');
          expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(TestBed.inject(TranslocoService).translate(key, { seconds: '12' }));
        });
      }
    });
  });
}
