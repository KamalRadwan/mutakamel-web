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
import enDup from '../../../../../../public/i18n/settings-duplicates/en.json';
import arDup from '../../../../../../public/i18n/settings-duplicates/ar.json';
import enRecord from '../../../../../../public/i18n/record-page/en.json';
import arRecord from '../../../../../../public/i18n/record-page/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { CRM_SETTINGS_FIXTURES } from '../../shared/testing/crm-settings-fixtures';
import { DuplicatesPage } from './duplicates-page';
import { PolicyTree, PolicyWriteResult } from './duplicates.model';
import { PolicyCell } from './policy-cell/policy-cell';

@Injectable()
class DuplicatesLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const arabic = path.endsWith('ar');
    if (path.startsWith('settings-duplicates/')) return of(arabic ? arDup : enDup);
    if (path.startsWith('settings/')) return of(arabic ? arSettings : enSettings);
    if (path.startsWith('record-page/')) return of(arabic ? arRecord : enRecord);
    return of(arabic ? ar : en);
  }
}

const path = '/settings/duplicate-policy';

for (const language of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) {
  describe(`DuplicatesPage ${language} ${theme}`, () => {
    let fixture: ComponentFixture<DuplicatesPage>;
    let page: DuplicatesPage;
    let stub: CrmHttpStub;
    let dispose: () => void;
    let tree: PolicyTree;
    const me = signal(FAKE_TENANT_ME);
    let attributes: { lang: string; dir: string; theme: string | null };
    const showModal = HTMLDialogElement.prototype.showModal;
    const close = HTMLDialogElement.prototype.close;

    beforeEach(() => {
      globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
      HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
      HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
      attributes = { lang: document.documentElement.lang, dir: document.documentElement.dir,
        theme: document.documentElement.getAttribute('data-theme') };
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.setAttribute('data-theme', theme);
      me.set({ ...FAKE_TENANT_ME, isTenantOwner: true });
      tree = structuredClone(CRM_SETTINGS_FIXTURES[path]) as PolicyTree;
      tree.companies[0].name = 'HQ';
      tree.companies[0].branches[0].name = 'CAIRO';
      stub = new CrmHttpStub({ [path]: tree });
      dispose = bindCrmHttpForTest(stub);
      TestBed.configureTestingModule({
        imports: [DuplicatesPage],
        providers: [provideRouter([]), provideTransloco({
          config: { availableLangs: ['en', 'ar'], defaultLang: language, reRenderOnLangChange: true },
          loader: DuplicatesLoader,
        }), { provide: TenantScopeState, useValue: { me } },
        { provide: LanguageState, useValue: { current: signal(language) } }],
      });
      TestBed.inject(TranslocoService).setTranslation({ ...(language === 'ar' ? ar : en),
        settings: language === 'ar' ? arSettings : enSettings,
        dup: language === 'ar' ? arDup : enDup,
        recordPage: language === 'ar' ? arRecord : enRecord,
      }, language);
    });

    afterEach(() => {
      fixture?.destroy();
      dispose();
      crmQueries().clear();
      vi.restoreAllMocks();
      document.documentElement.lang = attributes.lang;
      document.documentElement.dir = attributes.dir;
      if (attributes.theme === null) document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', attributes.theme);
      HTMLDialogElement.prototype.showModal = showModal;
      HTMLDialogElement.prototype.close = close;
    });

    async function stable(): Promise<void> {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    async function render(): Promise<void> {
      fixture = TestBed.createComponent(DuplicatesPage);
      page = fixture.componentInstance;
      await stable();
    }

    function t(key: string): string { return TestBed.inject(TranslocoService).translate(key); }
    function result(next: PolicyTree = tree, resets: PolicyWriteResult['resets'] = []) {
      return { status: 200, data: { ...next, resets }, etag: null, location: null };
    }
    function resetError() {
      return new ApiError(409, 'CRM_DUPLICATE_POLICY_RESETS_REQUIRED', {
        scopeType: ['company', 'branch'],
        id: [tree.companies[0].companyId, tree.companies[0].branches[0].branchId],
        name: ['Invalid value', 'Invalid value'], switch: ['b', 'u'],
      });
    }
    async function writeDefaults() {
      await page['enqueueWrite']({ kind: 'defaults', patch: { checkEmail: false } });
      await stable();
    }

    it('loads the tree', async () => {
      await render();
      expect(page['tree']()).toEqual(tree);
      expect(fixture.nativeElement.textContent).toContain('HQ');
      tree.truncated = true;
      vi.spyOn(stub, 'read').mockResolvedValue(tree);
      page['reload']();
      await stable();
      expect(fixture.nativeElement.textContent).toContain(t('dup.truncated'));
      tree.companies = [];
      vi.mocked(stub.read).mockResolvedValue(structuredClone(tree));
      page['reload']();
      await stable();
      expect(page['flatRows']().map((row) => row.kind)).toEqual(['workspace']);
      expect(fixture.nativeElement.querySelector('ui-full-state')).toBeNull();
      page['search'].set('missing');
      await stable();
      expect(fixture.nativeElement.textContent).toContain(t('dup.noResults'));
    });

    it('load failure', async () => {
      const read = vi.spyOn(stub, 'read').mockRejectedValue(new ApiError(503, 'CRM_SETTINGS_MISSING', undefined,
        { correlationId: 'dup-load-503' }));
      await render();
      const state = fixture.debugElement.query(By.directive(FullState)).componentInstance as FullState;
      expect(state.kind()).toBe('load-failure');
      expect(fixture.nativeElement.textContent).toContain('dup-load-503');
      read.mockResolvedValue(tree);
      state.action.emit();
      await stable();
      expect(page['tree']()).toEqual(tree);
    });

    it('save replaces the tree and lists resets', async () => {
      await render();
      const next = structuredClone(tree);
      next.revision = 2;
      next.defaults.checkEmail = false;
      const reset = { scopeType: 'BRANCH' as const, id: tree.companies[0].branches[0].branchId, name: 'CAIRO', switch: 'u' as const };
      const info = vi.spyOn(TestBed.inject(Notify), 'info');
      vi.spyOn(stub, 'write').mockResolvedValue(result(next, [reset]));
      await writeDefaults();
      expect(page['tree']()).toEqual(next);
      expect(info).toHaveBeenCalledWith(expect.stringContaining('CAIRO'));
      expect(info).toHaveBeenCalledWith(expect.stringContaining(t('dup.cols.u')));
    });

    it('stale opens the conflict modal', async () => {
      await render();
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'CRM_DUPLICATE_POLICY_STALE'));
      await writeDefaults();
      expect(page['conflictOpen']()).toBe(true);
      expect(fixture.debugElement.query(By.directive(ConflictDialog))).toBeTruthy();
      const fresh = structuredClone(tree);
      fresh.revision = 7;
      fresh.defaults.checkPhone = false;
      vi.spyOn(stub, 'read').mockResolvedValue(fresh);
      write.mockResolvedValue(result({ ...fresh, revision: 8, defaults: { ...fresh.defaults, checkEmail: false } }));
      await page['keepChangeOnConflict']();
      await stable();
      expect(write.mock.calls[1][2]).toEqual({ checkEmail: false, expectedRevision: 7 });
      expect(page['tree']()?.defaults.checkPhone).toBe(false);
      expect(page['conflictOpen']()).toBe(false);
    });

    it('reload discards a stale pending write', async () => {
      await render();
      const write = vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(409, 'CRM_DUPLICATE_POLICY_STALE'));
      await writeDefaults();
      const fresh = { ...tree, revision: 9 };
      vi.spyOn(stub, 'read').mockResolvedValue(fresh);
      await page['reloadOnConflict']();
      await stable();
      expect(page['tree']()).toEqual(fresh);
      expect(page['pendingStaleWrite']()).toBeNull();
      expect(write).toHaveBeenCalledTimes(1);
    });

    it('resets confirm resends with confirmResets', async () => {
      await render();
      vi.spyOn(page['resetsConfirm'](), 'open').mockResolvedValue(true);
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(resetError()).mockResolvedValue(result());
      await writeDefaults();
      expect(write).toHaveBeenCalledTimes(2);
      const first = write.mock.calls[0];
      const second = write.mock.calls[1];
      expect(second[2]).toEqual({ ...(first[2] as object), confirmResets: true });
      expect(second[3].key).not.toBe(first[3].key);
    });

    it('reset names come from the tree', async () => {
      await render();
      vi.spyOn(stub, 'write').mockRejectedValue(resetError());
      vi.spyOn(page['resetsConfirm'](), 'open').mockImplementation(async () => {
        expect(page['resetsDialogText']()).toContain('HQ');
        expect(page['resetsDialogText']()).toContain('CAIRO');
        expect(page['resetsDialogText']()).not.toContain('Invalid value');
        return false;
      });
      await writeDefaults();
      expect(page['tree']()).toEqual(tree);
    });

    it('missing company reloads', async () => {
      await render();
      const read = vi.spyOn(stub, 'read').mockResolvedValue({ ...tree, companies: [] });
      const toast = vi.spyOn(TestBed.inject(Notify), 'error');
      vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(404, 'CRM_COMPANY_NOT_FOUND'));
      await page['enqueueWrite']({ kind: 'company', companyId: tree.companies[0].companyId,
        patch: { allowAcrossUsers: true }, cellKey: 'company:u' });
      await stable();
      expect(read).toHaveBeenCalledTimes(1);
      expect(page['tree']()?.companies).toEqual([]);
      expect(toast).toHaveBeenCalledWith(t('dup.errors.CRM_COMPANY_NOT_FOUND'));
    });

    it('unchanged values send nothing', async () => {
      await render();
      const write = vi.spyOn(stub, 'write');
      page['onToggleContactType']('checkEmail', true);
      page['onWorkspaceChoice']('allowAcrossUsers', false, 'workspace:u');
      const company = tree.companies[0];
      page['onCompanyChoice'](company.companyId, 'allowAcrossUsers', company.override.allowAcrossUsers, 'company:u');
      const branch = company.branches[0];
      page['onBranchChoice'](branch.branchId, 'allowAcrossUsers', branch.override.allowAcrossUsers, 'branch:u');
      await page['enqueueWrite']({ kind: 'defaults', patch: { checkEmail: true } });
      expect(write).not.toHaveBeenCalled();
    });

    it('read-only render', async () => {
      me.set({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: ['crm.settings.read'],
        permissionScopes: { 'crm.settings.read': { tenantWide: true, companyIds: [], branchIds: [] } } });
      await render();
      expect(page['canManage']()).toBe(false);
      expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(true);
      for (const cell of fixture.debugElement.queryAll(By.directive(PolicyCell))) {
        expect((cell.componentInstance as PolicyCell).canManage()).toBe(false);
        expect(cell.nativeElement.querySelector('button').getAttribute('aria-haspopup')).toBeNull();
      }
      const write = vi.spyOn(stub, 'write');
      await writeDefaults();
      expect(write).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('button[type="submit"]')).toBeNull();
    });

    it('keeps hints connected to the contact controls', async () => {
      await render();
      for (const field of fixture.nativeElement.querySelectorAll('ui-field')) {
        const hint = field.querySelector('[data-ui-hint]');
        expect(hint).toBeTruthy();
        const tooltip = field.querySelector('[role="tooltip"]');
        expect(tooltip.textContent.trim()).not.toBe('');
        const controls = field.querySelectorAll('input, [role="switch"]');
        for (const control of controls) expect(control.getAttribute('aria-describedby')).toContain(tooltip.id);
      }
    });

    it.each(['CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY'])('switches to read-only after %s', async (code) => {
      await render();
      vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(403, code));
      await writeDefaults();
      expect(page['canManage']()).toBe(false);
      expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(true);
    });

    it('renders forbidden without making a request when read is not tenant-wide', async () => {
      me.set({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: ['crm.settings.read'],
        permissionScopes: { 'crm.settings.read': { tenantWide: false, companyIds: ['company'], branchIds: [] } } });
      await render();
      expect(stub.recordedReads()).toEqual([]);
      expect(fixture.debugElement.query(By.directive(FullState)).componentInstance.kind()).toBe('forbidden');
    });

    it('shows validation under the field with its hint', async () => {
      await render();
      vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(400, 'CRM_VALIDATION_FAILED', { checkEmail: ['Enter a boolean value.'] }));
      await writeDefaults();
      expect(page['validationErrors']()['types']).toBe('Enter a boolean value.');
      expect(fixture.nativeElement.querySelector('ui-field [role="alert"]').textContent).toContain('Enter a boolean value.');
      expect(fixture.nativeElement.querySelector('ui-field [data-ui-hint]')).toBeTruthy();
    });

    it('connects a policy validation message to its real control', async () => {
      await render();
      vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(400, 'CRM_VALIDATION_FAILED', {
        allowAcrossUsers: ['Enter a boolean value.'],
      }));
      const companyId = tree.companies[0].companyId;
      const cellKey = `company:${companyId}:u`;
      await page['enqueueWrite']({ kind: 'company', companyId, cellKey, patch: { allowAcrossUsers: true } });
      await stable();
      const invalid = fixture.nativeElement.querySelector('app-policy-cell button[aria-invalid="true"]');
      expect(invalid).toBeTruthy();
      const message = fixture.nativeElement.querySelector('#' + invalid.getAttribute('aria-describedby'));
      expect(message.textContent).toBe('Enter a boolean value.');
    });

    it.each([
      [0, 'NETWORK_ERROR', undefined], [500, 'SERVER_ERROR', undefined],
      [401, 'COMMON.GENERIC.UNAUTHORIZED', undefined],
      [409, 'GW.IDEM.IN_FLIGHT', undefined], [409, 'GW.IDEM.MISMATCH', undefined],
      [422, 'CRM_DUPLICATE_POLICY_CONFLICT', undefined],
      [429, 'COMMON.GENERIC.RATE_LIMITED', { retryAfterSeconds: ['12'] }],
    ])('keeps the page and shows a write toast after %s %s', async (status, code, details) => {
      await render();
      const toast = vi.spyOn(TestBed.inject(Notify), 'error');
      const write = vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(status, code, details));
      await writeDefaults();
      expect(write).toHaveBeenCalledTimes(1);
      expect(page['tree']()).toEqual(tree);
      expect(page['canManage']()).toBe(true);
      expect(toast).toHaveBeenCalledTimes(1);
      if (status === 401) expect(toast).toHaveBeenCalledWith(t('settings.errors.notSaved'));
      if (status === 429) expect(toast).toHaveBeenCalledWith(expect.stringContaining('12'));
    });

    it('shows a server permission failure as a forbidden full state', async () => {
      vi.spyOn(stub, 'read').mockRejectedValue(new ApiError(403, 'CRM_MODULE_DISABLED'));
      await render();
      expect(fixture.debugElement.query(By.directive(FullState)).componentInstance.kind()).toBe('forbidden');
    });

    it('serializes queued writes and reads the latest revision', async () => {
      await render();
      const write = vi.spyOn(stub, 'write')
        .mockResolvedValueOnce(result({ ...tree, revision: 2, defaults: { ...tree.defaults, checkEmail: false } }))
        .mockResolvedValueOnce(result({ ...tree, revision: 3, defaults: { ...tree.defaults, checkEmail: false, checkPhone: false } }));
      await Promise.all([
        page['enqueueWrite']({ kind: 'defaults', patch: { checkEmail: false } }),
        page['enqueueWrite']({ kind: 'defaults', patch: { checkPhone: false } }),
      ]);
      expect(write.mock.calls.map((call) => call[2])).toEqual([
        { checkEmail: false, expectedRevision: 1 }, { checkPhone: false, expectedRevision: 2 },
      ]);
    });
  });
}
