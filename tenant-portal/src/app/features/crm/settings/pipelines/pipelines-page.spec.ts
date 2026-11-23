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
import enPipelines from '../../../../../../public/i18n/settings-pipelines/en.json';
import arPipelines from '../../../../../../public/i18n/settings-pipelines/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { CRM_SETTINGS_FIXTURES } from '../../shared/testing/crm-settings-fixtures';
import { PipelineModal } from './pipeline-modal/pipeline-modal';
import { PipelineDetailPage } from './pipeline-detail/pipeline-detail-page';
import { PipelinesPage } from './pipelines-page';
import type { AssignmentOptions, Pipeline } from './pipelines.model';

@Injectable()
class SettingsLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const arabic = path.endsWith('ar');
    if (path.startsWith('settings-pipelines/')) return of(arabic ? arPipelines : enPipelines);
    if (path.startsWith('settings/')) return of(arabic ? arSettings : enSettings);
    return of(arabic ? ar : en);
  }
}

for (const language of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) {
  describe(`${language} ${theme}`, () => {
    let fixture: ComponentFixture<PipelinesPage> | ComponentFixture<PipelineDetailPage>;
    let list: PipelinesPage;
    let detail: PipelineDetailPage;
    let modal: PipelineModal;
    let stub: CrmHttpStub;
    let dispose: () => void;
    let pipeline: Pipeline;
    let originalAttributes: (string | null)[];
    const me = signal(FAKE_TENANT_ME);
    const dialog = HTMLDialogElement.prototype;
    const originalShow = dialog.showModal;
    const originalClose = dialog.close;

    beforeEach(() => {
      globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
      dialog.showModal = function () { this.setAttribute('open', ''); };
      dialog.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
      originalAttributes = ['lang', 'dir', 'data-theme'].map((name) => document.documentElement.getAttribute(name));
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.setAttribute('data-theme', theme);
      pipeline = structuredClone((CRM_SETTINGS_FIXTURES['/pipelines/configuration'] as Pipeline[])[0]);
      pipeline.isDefault = false;
      pipeline.accessMode = 'RESTRICTED';
      pipeline.assignments = { accessMode: 'RESTRICTED', userIds: ['user'], teamIds: [] };
      stub = new CrmHttpStub({ ...CRM_SETTINGS_FIXTURES,
        '/pipelines/configuration': [pipeline],
        [`/pipelines/${pipeline.id}/configuration`]: pipeline,
        [`/pipelines/${pipeline.id}/assignments`]: pipeline.assignments,
        '/pipelines/assignment-options': { users: [{ id: 'user', label: 'User', status: 'ACTIVE' }], teams: [] },
      });
      dispose = bindCrmHttpForTest(stub);
      me.set({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: ['crm.pipelines.manage'],
        permissionScopes: { 'crm.pipelines.manage': { tenantWide: true, companyIds: [], branchIds: [] } } });
      TestBed.configureTestingModule({ imports: [PipelinesPage, PipelineDetailPage], providers: [
        provideRouter([]),
        provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: language, reRenderOnLangChange: true }, loader: SettingsLoader }),
        { provide: TenantScopeState, useValue: { me } },
        { provide: LanguageState, useValue: { current: signal(language) } },
      ] });
      TestBed.inject(TranslocoService).setTranslation({ ...(language === 'ar' ? ar : en),
        settings: language === 'ar' ? arSettings : enSettings,
        pipelines: language === 'ar' ? arPipelines : enPipelines }, language);
    });

    afterEach(() => {
      fixture?.destroy();
      dialog.showModal = originalShow;
      dialog.close = originalClose;
      crmQueries().clear(); dispose(); vi.restoreAllMocks(); TestBed.resetTestingModule();
      ['lang', 'dir', 'data-theme'].forEach((name, index) => {
        const value = originalAttributes[index];
        if (value === null) document.documentElement.removeAttribute(name);
        else document.documentElement.setAttribute(name, value);
      });
    });

    async function stable() { await fixture.whenStable(); fixture.detectChanges(); }
    async function renderList() {
      const created = TestBed.createComponent(PipelinesPage);
      fixture = created; list = created.componentInstance;
      created.detectChanges();
      await vi.waitFor(() => expect(list['loading']()).toBe(false));
      await stable();
      modal = fixture.debugElement.query(By.directive(PipelineModal)).componentInstance;
    }
    async function renderDetail() {
      const created = TestBed.createComponent(PipelineDetailPage);
      fixture = created; detail = created.componentInstance;
      created.componentRef.setInput('id', pipeline.id);
      created.detectChanges();
      await vi.waitFor(() => expect(detail['loading']()).toBe(false));
      await stable();
      modal = fixture.debugElement.query(By.directive(PipelineModal)).componentInstance;
    }
    function t(key: string) { return TestBed.inject(TranslocoService).translate(key); }
    function fullState(): FullState | undefined { return fixture.debugElement.query(By.directive(FullState))?.componentInstance; }
    function rejectRead(path: string, error: ApiError) {
      const original = stub.read.bind(stub);
      return vi.spyOn(stub, 'read').mockImplementation(async <T>(requested: string) => {
        if (requested === path) throw error;
        return original<T>(requested);
      });
    }
    function result<T>(data: T) { return { status: 200, data, etag: null, location: null }; }
    function errorToast() { return vi.spyOn(TestBed.inject(Notify), 'error'); }

    describe('PipelinesPage', () => {
      it('sorts default first then code', async () => {
        const original = stub.read.bind(stub);
        vi.spyOn(stub, 'read').mockImplementation(async <T>(path: string) => path === '/pipelines/configuration'
          ? [{ ...pipeline, id: 'z', code: 'Z' }, { ...pipeline, id: 'a', code: 'A' }, { ...pipeline, id: 'default', isDefault: true }] as T
          : original<T>(path));
        await renderList();
        expect(list['filteredPipelines']().map((item) => item.id)).toEqual(['default', 'a', 'z']);
      });

      it('in use offers deactivate', async () => {
        await renderList();
        vi.spyOn(list['deleteDialog'](), 'open').mockResolvedValue(true);
        const warning = vi.spyOn(list['inUseModal'](), 'open');
        const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'PIPELINE_IN_USE'));
        await list['confirmDelete'](pipeline);
        expect(warning).toHaveBeenCalledOnce();
        expect(list['inUsePipeline']()).toEqual(pipeline);
        await list['deactivateInUse']();
        expect(write).toHaveBeenLastCalledWith('PATCH', `/pipelines/${pipeline.id}`, { isActive: false }, expect.objectContaining({ key: expect.any(String) }));
      });

      it('refetches the list after making a pipeline default', async () => {
        await renderList();
        const read = vi.spyOn(stub, 'read');
        const write = vi.spyOn(stub, 'write').mockResolvedValue(result({ ...pipeline, isDefault: true }));
        await list['makeDefault']({ ...pipeline, accessMode: 'ALL' });
        expect(write).toHaveBeenCalledWith('PUT', `/pipelines/${pipeline.id}/default`, undefined, expect.objectContaining({ key: expect.stringMatching(/-7[0-9a-f]{3}-/) }));
        expect(read).toHaveBeenCalledWith('/pipelines/configuration', undefined);
      });

      it('shows a forbidden state without tenant-wide access', async () => {
        me.set({ ...me(), permissionScopes: { 'crm.pipelines.manage': { tenantWide: false, companyIds: [], branchIds: ['branch'] } } });
        const read = vi.spyOn(stub, 'read');
        await renderList();
        expect(fullState()?.kind()).toBe('forbidden');
        expect(read).not.toHaveBeenCalled();
      });

      it('shows read load failure and the correlation id without a toast', async () => {
        rejectRead('/pipelines/configuration', new ApiError(503, 'PIPELINE_READ_AUTHORITY_INVALID', undefined, { correlationId: 'corr-pipelines' }));
        const toast = errorToast();
        await renderList();
        expect(fullState()?.kind()).toBe('load-failure');
        expect(fullState()?.text()).toContain('corr-pipelines');
        expect(toast).not.toHaveBeenCalled();
      });
    });

    describe('PipelineDetailPage', () => {
      it('missing pipeline', async () => {
        rejectRead(`/pipelines/${pipeline.id}/configuration`, new ApiError(404, 'PIPELINE_NOT_FOUND'));
        await renderDetail();
        expect(fullState()?.kind()).toBe('not-found');
        expect(fullState()?.actionLabel()).toBe(t('pipelines.detail.backToList'));
      });

      it('reset blocked message', async () => {
        await renderDetail();
        detail['pipeline'].set({ ...pipeline, isDefault: true });
        vi.spyOn(detail['resetDialog'](), 'open').mockResolvedValue(true);
        const warning = vi.spyOn(detail['resetBlockedModal'](), 'open');
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'PIPELINE_RESET_BLOCKED'));
        await detail['confirmReset'](); await stable();
        expect(warning).toHaveBeenCalledOnce();
        expect(fixture.nativeElement.textContent).toContain(t('pipelines.errors.PIPELINE_RESET_BLOCKED'));
      });

      it('options failure is local', async () => {
        const read = rejectRead('/pipelines/assignment-options', new ApiError(503, 'INTERNAL_ERROR'));
        await renderDetail();
        expect(detail['pipeline']()).toEqual(pipeline);
        expect(fullState()).toBeUndefined();
        expect(detail['optionsMessage']()).toBeTruthy();
        expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(detail['optionsMessage']());
        read.mockRestore();
        detail['retryAssignmentOptions']();
        await vi.waitFor(() => expect(detail['searchingAccess']()).toBe(false));
        await stable();
        expect(detail['optionsMessage']()).toBeNull();
        expect(detail['userOptions']()).toHaveLength(1);
      });

      it('ignores an older options answer as soon as a new search is typed', async () => {
        await renderDetail();
        let resolve!: (value: AssignmentOptions) => void;
        vi.spyOn(stub, 'read').mockImplementationOnce(<T>() => new Promise<T>((done) => { resolve = (value) => done(value as T); }));
        const pending = detail['refreshAssignmentOptions']('old');
        const input = document.createElement('input'); input.value = 'latest';
        detail['onAccessSearchInput']({ target: input } as unknown as Event);
        resolve({ users: [{ id: 'old', label: 'Stale', status: 'ACTIVE' }], teams: [] });
        await pending;
        expect(detail['userOptions']().some((user) => user.id === 'old')).toBe(false);
      });

      it('stage reorder outcomes', async () => {
        await renderDetail();
        const before = detail['pipeline']()!;
        const next = [...before.stages];
        [next[1], next[2]] = [next[2], next[1]];
        const saved = next.map((stage, index) => ({ ...stage, rank: index + 1 }));
        const write = vi.spyOn(stub, 'write').mockResolvedValueOnce(result(saved));
        await detail['commitStageOrder'](before, next);
        expect(detail['pipeline']()?.stages).toEqual(saved);
        expect(write.mock.calls[0][2]).toEqual({ orderedIds: next.map((stage) => stage.id) });
        const firstKey = write.mock.calls[0][3].key;
        expect(firstKey).toMatch(/-7[0-9a-f]{3}-/);
        write.mockRejectedValueOnce(new ApiError(422, 'PIPELINE_STAGE_REORDER_INVALID'));
        const read = vi.spyOn(stub, 'read');
        await detail['commitStageOrder']({ ...before, stages: saved }, before.stages);
        expect(read).toHaveBeenCalledWith(`/pipelines/${pipeline.id}/configuration`, undefined);
        expect(detail['pipeline']()?.stages).toEqual(before.stages);
      });

      it('detach outcomes', async () => {
        await renderDetail();
        const stage = pipeline.stages.find((item) => !['NEW', 'WON', 'LOST'].includes(item.flag))!;
        vi.spyOn(detail['removeStageDialog'](), 'open').mockResolvedValue(true);
        const warning = vi.spyOn(detail['stageInUseModal'](), 'open');
        const toast = errorToast();
        const write = vi.spyOn(stub, 'write');
        write.mockRejectedValueOnce(new ApiError(409, 'PIPELINE_STAGE_IN_USE'));
        await detail['removeStage'](stage);
        expect(warning).toHaveBeenCalledOnce();
        write.mockRejectedValueOnce(new ApiError(422, 'PIPELINE_STAGE_REQUIRED'));
        await detail['removeStage'](stage);
        expect(toast).toHaveBeenCalledWith(t('pipelines.errors.PIPELINE_STAGE_REQUIRED'));
        expect(detail['pipeline']()?.stages).toContainEqual(stage);
        const read = vi.spyOn(stub, 'read');
        await detail['removeStage'](stage);
        expect(read).toHaveBeenCalledWith(`/pipelines/${pipeline.id}/configuration`, undefined);
      });

      it('dedupes assignment selections and keeps retry keys until a final outcome', async () => {
        await renderDetail();
        detail['draftUserIds'].set(['user', 'user', 'another']);
        detail['draftTeamIds'].set(['team', 'team']);
        const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(503, 'INTERNAL_ERROR'));
        await detail['confirmSaveAssignments']();
        expect(detail['draftUserIds']()).toEqual(['user', 'user', 'another']);
        const firstKey = write.mock.calls[0][3].key;
        expect(write.mock.calls[0][2]).toEqual({ accessMode: 'RESTRICTED', userIds: ['user', 'another'], teamIds: ['team'] });
        write.mockRejectedValueOnce(new ApiError(409, 'GW.IDEM.IN_FLIGHT'));
        await detail['confirmSaveAssignments']();
        expect(write.mock.calls[1][3].key).toBe(firstKey);
        write.mockRejectedValueOnce(new ApiError(422, 'PIPELINE_ASSIGNMENT_USERS_INVALID'));
        await detail['confirmSaveAssignments']();
        expect(write.mock.calls[2][3].key).toBe(firstKey);
        write.mockResolvedValueOnce(result(pipeline.assignments));
        await detail['confirmSaveAssignments']();
        expect(write.mock.calls[3][3].key).not.toBe(firstKey);
      });

      it('turns subscription write errors into read-only controls without Save', async () => {
        await renderDetail();
        detail['draftUserIds'].set(['another']);
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY'));
        await detail['confirmSaveAssignments'](); await stable();
        expect(detail['canManage']()).toBe(false);
        expect(fixture.nativeElement.querySelector('input[type="text"]')?.readOnly).toBe(true);
        const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
        expect(buttons.some((button) => button.textContent?.trim() === t('settings.common.save'))).toBe(false);
      });

      it.each(['CRM_SUBSCRIPTION_BLOCKED', 'CRM_MODULE_DISABLED', 'CRM_MODULE_SEAT_REQUIRED', 'CRM_FEATURE_DISABLED', 'CRM_PERMISSION_DENIED', 'BRANCH_ACCESS_DENIED'])('shows forbidden for %s on load', async (code) => {
        rejectRead(`/pipelines/${pipeline.id}/configuration`, new ApiError(403, code));
        await renderDetail();
        expect(fullState()?.kind()).toBe('forbidden');
      });
    });

    describe('PipelineModal', () => {
      async function openCreate() {
        await renderList(); list['openCreate'](); await stable();
        modal['code'].set('UNIQUE'); modal['nameAr'].set('اختبار'); modal['nameEn'].set('Test');
      }

      it('code taken on the code field', async () => {
        await openCreate();
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'PIPELINE_CODE_TAKEN'));
        await modal['save'](); await stable();
        expect(modal['errorOf']('code')).toBe(t('pipelines.errors.PIPELINE_CODE_TAKEN'));
        const field = fixture.debugElement.queryAll(By.directive(Field)).map((element) => element.componentInstance as Field)
          .find((item) => item.label() === t('pipelines.modal.code'))!;
        expect(field.error()).toBe(t('pipelines.errors.PIPELINE_CODE_TAKEN'));
        expect(field.hint()).toBeTruthy();
      });

      it('shows server field messages and clears them when the value changes', async () => {
        await openCreate();
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(400, 'CRM_VALIDATION_FAILED', { nameEn: ['The English name is invalid'] }));
        await modal['save'](); await stable();
        expect(Object.keys(modal['serverErrors']())).toEqual(['nameEn']);
        expect(modal['errorOf']('nameEn')).toBe('The English name is invalid');
        const input = document.createElement('input'); input.value = 'Corrected';
        modal['onTextInput']('nameEn', { target: input } as unknown as Event);
        expect(modal['errorOf']('nameEn')).toBeNull();
      });

      it('keeps values and the key after an expired session', async () => {
        await openCreate();
        const toast = errorToast();
        const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED'));
        await modal['save']();
        expect(modal['nameEn']()).toBe('Test');
        expect(toast).toHaveBeenCalledWith(t('settings.errors.notSaved'));
        write.mockResolvedValueOnce(result(pipeline));
        await modal['save']();
        expect(write.mock.calls[1][3].key).toBe(write.mock.calls[0][3].key);
      });

      it('makes stage setup read-only after a subscription write rejection', async () => {
        await openCreate();
        modal['onStageModeChange']('choose');
        const before = [...modal['chosenStages']()];
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY'));
        await modal['save'](); await stable();
        expect(modal['editable']()).toBe(false);
        expect(modal['stageModeOptions']().every((option) => option.disabled)).toBe(true);
        modal['onStageModeChange']('standard');
        modal['moveChosenStage'](1, 1);
        modal['removeChosenStage'](before[1].id);
        expect(modal['stageMode']()).toBe('choose');
        expect(modal['chosenStages']()).toEqual(before);
        expect(modal['nameEn']()).toBe('Test');
        const host = fixture.debugElement.query(By.directive(PipelineModal)).nativeElement as HTMLElement;
        expect([...host.querySelectorAll('input, textarea')].every((control) => (control as HTMLInputElement).readOnly)).toBe(true);
        expect([...host.querySelectorAll('button')].some((button) => button.textContent?.trim() === t('settings.common.save'))).toBe(false);
      });

      it('reverts a rejected default deactivation', async () => {
        await renderList();
        modal.openEdit({ ...pipeline, isDefault: true });
        modal['isActive'].set(false);
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(422, 'PIPELINE_DEFAULT_DEACTIVATE'));
        await modal['save']();
        expect(modal['isActive']()).toBe(true);
      });

      it('shows throttling delay and retains every field hint and control description', async () => {
        await openCreate();
        const toast = errorToast();
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['12'] }));
        await modal['save'](); await stable();
        expect(toast.mock.calls.at(-1)?.[0]).toContain('12');
        for (const element of fixture.debugElement.queryAll(By.directive(Field))) {
          const field = element.componentInstance as Field;
          expect(field.hint()).toBeTruthy();
          for (const control of element.nativeElement.querySelectorAll('input, textarea, [role="switch"], button[role="radio"]') as NodeListOf<HTMLElement>) {
            expect(control.getAttribute('aria-describedby')).toContain('-hint');
          }
        }
      });
    });
  });
}
