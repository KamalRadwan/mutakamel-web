import { signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import {
  TRANSLOCO_LOADER,
  TranslocoService,
  provideTransloco,
  type Translation,
} from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import slaEn from '../../../../../../public/i18n/settings-sla/en.json';
import slaAr from '../../../../../../public/i18n/settings-sla/ar.json';
import settingsEn from '../../../../../../public/i18n/settings/en.json';
import settingsAr from '../../../../../../public/i18n/settings/ar.json';
import analyticsEn from '../../../../../../public/i18n/analytics/en.json';
import analyticsAr from '../../../../../../public/i18n/analytics/ar.json';
import chartEn from '../../../../../../public/i18n/chart/en.json';
import chartAr from '../../../../../../public/i18n/chart/ar.json';
import recordEn from '../../../../../../public/i18n/record-page/en.json';
import recordAr from '../../../../../../public/i18n/record-page/ar.json';
import globalEn from '../../../../../../public/i18n/en.json';
import globalAr from '../../../../../../public/i18n/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { DataTable } from '../../../../shared/ui/data-table/data-table';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { WorkspaceLookups } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import type { WorkspaceBranch } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { bindCrmHttpForTest } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { SlaPage } from './sla-page';
import { SlaModal } from './sla-modal/sla-modal';
import type { SlaPolicy } from './sla.model';

const BRANCH = '01934b10-0000-7000-8000-000000000001';
const OTHER = '01934b10-0000-7000-8000-000000000002';
const POLICY: SlaPolicy = {
  id: '01934b20-0000-7000-8000-000000000001',
  policyKind: 'FIRST_RESPONSE',
  appliesToRecord: 'LEAD',
  branchId: BRANCH,
  versionNumber: 1,
  state: 'ACTIVE',
  effectiveFrom: '2026-11-01T00:00:00.000Z',
  effectiveTo: null,
  startEvent: 'ASSIGNMENT',
  qualifyingFact: 'TOUCH',
  clockKind: 'WORKING_MINUTES',
  targetMinutes: 30,
  requiredTouchCount: null,
  compliancePct: null,
  qualifyingTouchBy: 'OWNER',
  qualifying: { activityTypes: ['CALL'], directions: null, touchSources: null },
  nameEn: 'Response',
  nameAr: 'الاستجابة',
  supersedesPolicyId: null,
  nextPolicyId: null,
  publishedByUserId: 'user',
  publishedAt: '2026-11-01T00:00:00.000Z',
};
const BRANCHES: WorkspaceBranch[] = [BRANCH, OTHER].map((id, index) => ({
  id,
  companyId: 'company',
  code: String(index),
  name: `Branch ${index + 1}`,
  status: 'ACTIVE',
  address: null,
  phone: null,
  isHeadquarters: false,
  createdAt: '',
  updatedAt: '',
}));
const PAGE = { items: [POLICY], pageInfo: { limit: 25, hasMore: false, nextCursor: null } };
const dialogMethods = {
  showModal: HTMLDialogElement.prototype.showModal,
  close: HTMLDialogElement.prototype.close,
};

type ModalState = {
  nameEn: WritableSignal<string>;
  nameAr: WritableSignal<string>;
  branchKey: WritableSignal<string>;
  clockBranchId: WritableSignal<string>;
  clockMissingReason: () => string | null;
  readOnly: () => boolean;
  branchOptions: () => { value: string }[];
  conflictOpen: () => boolean;
  resolvingConflict: () => boolean;
  effectiveFromError: () => string | null;
  branchError: () => string | null;
  clockMinutesError: () => string | null;
  publish(): Promise<void>;
  calculateClock(): Promise<void>;
  resolveConflict(reload: boolean): Promise<void>;
};
type PageState = {
  load(): Promise<void>;
  loadMore(): Promise<void>;
  openPolicy(policy: SlaPolicy): Promise<void>;
  nextCursor: WritableSignal<string | null>;
  kindFilter: WritableSignal<string>;
  loading: () => boolean;
  canManage: () => boolean;
  branchName(id: string): string;
};

describe.each([
  ['en', 'light'],
  ['en', 'dark'],
  ['ar', 'light'],
  ['ar', 'dark'],
] as const)('SLA in %s / %s', (language, theme) => {
  let dispose: () => void;
  let me: WritableSignal<TenantMe>;
  let stub: CrmHttpStub;
  let read: MockInstance<CrmHttpStub['read']>;
  let write: MockInstance<CrmHttpStub['write']>;
  let fixture: ComponentFixture<SlaPage | SlaModal>;
  let originalAttributes: (string | null)[];
  const branches = vi.fn().mockResolvedValue(BRANCHES);
  const texts = language === 'ar' ? slaAr : slaEn;

  beforeEach(() => {
    originalAttributes = ['lang', 'dir', 'data-theme'].map((key) =>
      document.documentElement.getAttribute(key),
    );
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('data-theme', theme);
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as never;
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    branches.mockClear();
    me = signal({
      ...FAKE_TENANT_ME,
      isTenantOwner: false,
      permissions: ['crm.sla.manage', 'org.branch.read'],
      permissionScopes: {
        'crm.sla.manage': { tenantWide: true, companyIds: [], branchIds: [] },
        'org.branch.read': { tenantWide: true, companyIds: [], branchIds: [] },
      },
    });
    const translations: Record<string, Translation> = {
      en: globalEn,
      ar: globalAr,
      'settings/en': settingsEn,
      'settings/ar': settingsAr,
      'analytics/en': analyticsEn,
      'analytics/ar': analyticsAr,
      'chart/en': chartEn,
      'chart/ar': chartAr,
      'settings-sla/en': slaEn,
      'settings-sla/ar': slaAr,
      'record-page/en': recordEn,
      'record-page/ar': recordAr,
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTransloco({
          config: {
            availableLangs: ['en', 'ar'],
            defaultLang: language,
            reRenderOnLangChange: true,
            prodMode: true,
          },
        }),
        {
          provide: TRANSLOCO_LOADER,
          useValue: { getTranslation: (path: string) => of(translations[path] ?? {}) },
        },
        { provide: TenantScopeState, useValue: { me } },
        { provide: LanguageState, useValue: { current: signal(language) } },
        { provide: WorkspaceLookups, useValue: { allBranches: branches } },
      ],
    });
    const t = TestBed.inject(TranslocoService);
    for (const lang of ['en', 'ar']) {
      t.setTranslation(
        {
          ...translations[lang],
          settings: translations[`settings/${lang}`],
          analytics: translations[`analytics/${lang}`],
          chart: translations[`chart/${lang}`],
          sla: translations[`settings-sla/${lang}`],
          recordPage: translations[`record-page/${lang}`],
        },
        lang,
      );
    }
    t.setActiveLang(language);
    stub = new CrmHttpStub();
    read = vi
      .spyOn(stub, 'read')
      .mockImplementation(
        async <T>(path: string) => (path === '/sla/policies' ? PAGE : POLICY) as T,
      );
    write = vi
      .spyOn(stub, 'write')
      .mockResolvedValue({ status: 201, data: POLICY, etag: null, location: null });
    dispose = bindCrmHttpForTest(stub);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    dispose();
    vi.restoreAllMocks();
    HTMLDialogElement.prototype.showModal = dialogMethods.showModal;
    HTMLDialogElement.prototype.close = dialogMethods.close;
    ['lang', 'dir', 'data-theme'].forEach((key, index) => {
      const value = originalAttributes[index];
      if (value === null) document.documentElement.removeAttribute(key);
      else document.documentElement.setAttribute(key, value);
    });
  });

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  async function page() {
    fixture = TestBed.createComponent(SlaPage);
    await settle();
    const state = fixture.componentInstance as unknown as PageState;
    await vi.waitFor(() => expect(state.loading()).toBe(false));
    await settle();
    return state;
  }
  async function modal(policy?: SlaPolicy) {
    const modalFixture = TestBed.createComponent(SlaModal);
    fixture = modalFixture;
    fixture.componentRef.setInput('canManage', true);
    fixture.componentRef.setInput('branches', BRANCHES);
    await settle();
    if (policy) modalFixture.componentInstance.openPolicy(policy);
    else modalFixture.componentInstance.openCreate();
    await settle();
    const state = modalFixture.componentInstance as unknown as ModalState;
    if (!policy) {
      state.nameEn.set('Response');
      state.nameAr.set('الاستجابة');
    }
    return state;
  }
  function fullState() {
    return fixture.debugElement.query(By.directive(FullState))?.componentInstance as
      FullState | undefined;
  }
  function setBranchOnly() {
    me.update((value) => ({
      ...value,
      permissionScopes: {
        ...value.permissionScopes,
        'crm.sla.manage': { tenantWide: false, companyIds: [], branchIds: [BRANCH] },
      },
    }));
  }

  describe('SlaPage', () => {
    it('loads and shows empty', async () => {
      read.mockResolvedValueOnce({ ...PAGE, items: [] });
      const state = await page();
      expect(fixture.nativeElement.textContent).toContain(texts.errors.noPoliciesYet);
      expect(state.canManage()).toBe(true);
      expect(fixture.debugElement.query(By.directive(DataTable))).toBeTruthy();
      await state.load();
      await settle();
      expect(fixture.nativeElement.textContent).toContain(
        language === 'ar' ? POLICY.nameAr : POLICY.nameEn,
      );
      expect(branches).toHaveBeenCalledWith({ status: 'ACTIVE' });
      expect(state.branchName('unknown')).toBe(texts.filters.branch);
    });

    it('missing keys show the permission state', async () => {
      me.update((value) => ({ ...value, isTenantOwner: true }));
      read.mockRejectedValue(new ApiError(403, 'CRM_PERMISSION_DENIED'));
      const state = await page();
      expect(fullState()?.kind()).toBe('forbidden');
      read.mockRejectedValue(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'));
      await state.load();
      await settle();
      expect(fullState()?.kind()).toBe('forbidden');
      expect(TestBed.inject(Notify).toasts()).toEqual([]);
    });

    it('readers see rows without Publish and never request unavailable branches', async () => {
      me.update((value) => ({
        ...value,
        permissions: ['crm.dashboards.read.team'],
        permissionScopes: {
          'crm.dashboards.read.team': { tenantWide: true, branchIds: [], companyIds: [] },
        },
      }));
      const state = await page();
      expect(state.canManage()).toBe(false);
      expect(branches).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain(
        language === 'ar' ? POLICY.nameAr : POLICY.nameEn,
      );
    });

    it('load failure retains the correlation id and retries', async () => {
      read.mockRejectedValueOnce(
        new ApiError(503, 'SERVER_ERROR', undefined, { correlationId: 'sla-ref' }),
      );
      const state = await page();
      expect(fullState()?.kind()).toBe('load-failure');
      expect(fixture.nativeElement.textContent).toContain('sla-ref');
      await state.load();
      await settle();
      expect(fullState()).toBeUndefined();
    });

    it('invalid cursor returns to page one and missing versions reload the list', async () => {
      const state = await page();
      state.nextCursor.set('bad');
      state.kindFilter.set('NEXT_STEP');
      read.mockRejectedValueOnce(new ApiError(400, 'CRM_DASHBOARD_LIST_CURSOR_INVALID'));
      await state.loadMore();
      expect(read.mock.calls.at(-1)).toEqual(['/sla/policies', { kind: 'NEXT_STEP' }]);
      read.mockRejectedValueOnce(new ApiError(404, 'CRM_DASHBOARD_RESOURCE_NOT_FOUND'));
      await state.openPolicy(POLICY);
      expect(read.mock.calls.at(-1)?.[0]).toBe('/sla/policies');
      expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(
        texts.errors.CRM_DASHBOARD_RESOURCE_NOT_FOUND,
      );
    });
  });

  describe('SlaModal', () => {
    it('stale reload and keep', async () => {
      const state = await modal(POLICY);
      state.nameEn.set('My changes');
      write.mockRejectedValueOnce(new ApiError(409, 'CRM_SLA_POLICY_STALE'));
      await state.publish();
      await settle();
      expect(state.conflictOpen()).toBe(true);
      const conflict = fixture.debugElement.query(By.directive(ConflictDialog))
        .componentInstance as ConflictDialog;
      const latest = { ...POLICY, id: OTHER, versionNumber: 2, nameEn: 'Latest' };
      read.mockResolvedValue({ ...PAGE, items: [latest] });
      conflict.keepEditing.emit();
      await vi.waitFor(() => expect(state.resolvingConflict()).toBe(false));
      await settle();
      expect(state.nameEn()).toBe('My changes');
      expect(write).toHaveBeenCalledTimes(1);
      write.mockRejectedValueOnce(new ApiError(409, 'CRM_SLA_POLICY_STALE'));
      await state.publish();
      await settle();
      expect(write.mock.calls[1][2]).toMatchObject({
        expectedSupersedesPolicyId: OTHER,
        nameEn: 'My changes',
      });
      conflict.reload.emit();
      await vi.waitFor(() => expect(state.resolvingConflict()).toBe(false));
      await settle();
      expect(state.nameEn()).toBe('Latest');
      expect(write).toHaveBeenCalledTimes(2);
      expect(state.conflictOpen()).toBe(false);
    });

    it('backdated on the date field', async () => {
      const state = await modal();
      write.mockRejectedValueOnce(new ApiError(422, 'CRM_SLA_BACKDATED'));
      await state.publish();
      await settle();
      expect(state.effectiveFromError()).toBe(texts.validation.backdated);
      expect(
        fixture.nativeElement.querySelector('[id$="-effective-from-error"]')?.textContent,
      ).toContain(texts.validation.backdated);
      expect(TestBed.inject(Notify).toasts()).toEqual([]);
    });

    it('branch 403 on the field', async () => {
      const state = await modal();
      write.mockRejectedValueOnce(new ApiError(403, 'BRANCH_PERMISSION_DENIED'));
      await state.publish();
      await settle();
      expect(state.branchError()).toBe(texts.errors.BRANCH_PERMISSION_DENIED);
      expect(fixture.nativeElement.querySelector('[id$="-branch-error"]')?.textContent).toContain(
        texts.errors.BRANCH_PERMISSION_DENIED,
      );
      expect(TestBed.inject(Notify).toasts()).toEqual([]);
    });

    it('tenant default needs tenant-wide manage', async () => {
      setBranchOnly();
      const state = await modal();
      expect(state.branchOptions().map((option) => option.value)).toEqual([BRANCH]);
      expect(state.branchKey()).toBe(BRANCH);
      state.branchKey.set('__TENANT__');
      await state.publish();
      expect(write).not.toHaveBeenCalled();
    });

    it('preview missing calendar', async () => {
      const state = await modal();
      for (const reason of [
        'CALENDAR_UNAVAILABLE',
        'CALENDAR_HOURS_MISSING',
        'DEADLINE_BEYOND_HORIZON',
      ] as const) {
        write.mockResolvedValueOnce({
          status: 200,
          data: { deadline: null, missingReason: reason },
          etag: null,
          location: null,
        });
        await state.calculateClock();
        await settle();
        expect(fixture.nativeElement.textContent).toContain(texts.missing[reason]);
        expect(
          fixture.nativeElement.querySelector('a[href="/crm/settings/calendars"]'),
        ).toBeTruthy();
      }
      write.mockRejectedValueOnce(new ApiError(422, 'CRM_SLA_CLOCK_RANGE_EXCEEDED'));
      await state.calculateClock();
      await settle();
      expect(state.clockMinutesError()).toBe(texts.errors.CRM_SLA_CLOCK_RANGE_EXCEEDED);
      expect(TestBed.inject(Notify).toasts()).toEqual([]);
    });

    it('no preview without manage', async () => {
      me.update((value) => ({
        ...value,
        permissions: ['crm.dashboards.read.own', 'org.branch.read'],
      }));
      const state = await modal(POLICY);
      expect(fixture.nativeElement.querySelector('[id$="-clock-branch"]')).toBeNull();
      expect(state.readOnly()).toBe(true);
      expect(fixture.nativeElement.querySelector('[id$="-name-en"]').readOnly).toBe(true);
      await state.calculateClock();
      await state.publish();
      expect(write).not.toHaveBeenCalled();
    });

    it('picker hidden without org.branch.read', async () => {
      me.update((value) => ({ ...value, permissions: ['crm.sla.manage'] }));
      const state = await modal();
      expect(fixture.nativeElement.querySelector('ui-dropdown [id$="-branch"]')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain(texts.errors.branchLookupUnavailable);
      await state.calculateClock();
      expect(write).not.toHaveBeenCalled();
    });

    it('history opens read-only', async () => {
      const state = await modal({ ...POLICY, nextPolicyId: OTHER });
      expect(state.readOnly()).toBe(true);
      expect(fixture.nativeElement.querySelector('[id$="-name-en"]').readOnly).toBe(true);
      expect(fixture.nativeElement.textContent).not.toContain(texts.modal.publishVersion);
      await state.publish();
      expect(write).not.toHaveBeenCalled();
    });

    it('truncated branch projection leaves active options for server authorization', async () => {
      setBranchOnly();
      me.update((value) => ({
        ...value,
        accessScope: { ...value.accessScope, branchesTruncated: true },
      }));
      const state = await modal();
      expect(state.branchOptions().map((option) => option.value)).toEqual([BRANCH, OTHER]);
      expect(state.branchOptions().some((option) => option.value === '__TENANT__')).toBe(false);
    });

    it('gateway mismatch and throttling keep the form and require a new action key', async () => {
      const state = await modal();
      write.mockRejectedValueOnce(new ApiError(422, 'GW.IDEM.MISMATCH'));
      await state.publish();
      const notify = TestBed.inject(Notify);
      const settings = language === 'ar' ? settingsAr : settingsEn;
      expect(notify.toasts().at(-1)?.title).toBe(settings.errors.idempotencyMismatch);
      write.mockRejectedValueOnce(
        new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['12'] }),
      );
      await state.publish();
      expect(notify.toasts().at(-1)?.title).toContain('12');
      expect(state.nameEn()).toBe('Response');
      expect(write.mock.calls[1][3].key).not.toBe(write.mock.calls[0][3].key);
    });

    it('retired and other-branch versions are read-only', async () => {
      setBranchOnly();
      const state = await modal({ ...POLICY, branchId: OTHER });
      expect(state.readOnly()).toBe(true);
      (fixture.componentInstance as SlaModal).openPolicy({ ...POLICY, state: 'RETIRED' });
      expect(state.readOnly()).toBe(true);
    });

    it('publish retries retain the key only for retryable outcomes or session expiry', async () => {
      const state = await modal();
      for (const error of [
        new ApiError(0, 'NETWORK_ERROR'),
        new ApiError(503, 'SERVER_ERROR'),
        new ApiError(409, 'GW.IDEM.IN_FLIGHT'),
        new ApiError(401, 'UNAUTHORIZED'),
      ]) {
        write.mockRejectedValueOnce(error);
        await state.publish();
      }
      expect(write).toHaveBeenCalledTimes(4);
      for (const call of write.mock.calls) {
        expect(call[2]).toEqual(write.mock.calls[0][2]);
        expect(call[3].key).toBe(write.mock.calls[0][3].key);
        expect(call[3].key).toMatch(/-7[0-9a-f]{3}-[89ab]/);
      }
      state.nameEn.set('Changed');
      write.mockRejectedValueOnce(new ApiError(422, 'CRM_SLA_QUALIFIER_UNKNOWN'));
      await state.publish();
      expect(write.mock.calls[4][3].key).not.toBe(write.mock.calls[0][3].key);
      const rejectedKey = write.mock.calls[4][3].key;
      await state.publish();
      expect(write.mock.calls[5][3].key).not.toBe(rejectedKey);
    });

    it('read-only plan removes Publish and validation errors stay on fields', async () => {
      const state = await modal();
      write.mockRejectedValueOnce(
        new ApiError(400, 'CRM_VALIDATION_FAILED', { nameEn: ['Enter a supported name'] }),
      );
      await state.publish();
      await settle();
      expect(fixture.nativeElement.querySelector('[id$="-name-en-error"]')?.textContent).toContain(
        'Enter a supported name',
      );
      write.mockRejectedValueOnce(
        new ApiError(400, 'CRM_VALIDATION_FAILED', {
          'qualifying.activityTypes.0': ['Select a supported activity type'],
        }),
      );
      await state.publish();
      await settle();
      expect(
        fixture.nativeElement.querySelector('[id$="-activity-types-error"]')?.textContent,
      ).toContain('Select a supported activity type');
      write.mockRejectedValueOnce(new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY'));
      await state.publish();
      await settle();
      expect(state.readOnly()).toBe(true);
      expect(fixture.nativeElement.textContent).not.toContain(texts.modal.publishVersion);
    });

    it('every rendered label retains a linked hint', async () => {
      await modal();
      for (const debug of fixture.debugElement.queryAll(By.directive(Field))) {
        const field = debug.componentInstance as Field;
        if (!field.label()) continue;
        expect(field.hint()).toBeTruthy();
        const id = field.for();
        if (!id) continue;
        const control = fixture.nativeElement.querySelector(`[id="${id}"]`);
        expect(control).toBeTruthy();
        const hint = fixture.nativeElement.querySelector(`[id="${id}-hint"]`);
        expect(hint).toBeTruthy();
        expect(control.getAttribute('aria-describedby')?.split(' ')).toContain(`${id}-hint`);
      }
    });
  });
});
