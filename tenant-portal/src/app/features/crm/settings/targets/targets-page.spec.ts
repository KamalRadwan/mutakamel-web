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
import targetsEn from '../../../../../../public/i18n/settings-targets/en.json';
import targetsAr from '../../../../../../public/i18n/settings-targets/ar.json';
import settingsEn from '../../../../../../public/i18n/settings/en.json';
import settingsAr from '../../../../../../public/i18n/settings/ar.json';
import analyticsEn from '../../../../../../public/i18n/analytics/en.json';
import analyticsAr from '../../../../../../public/i18n/analytics/ar.json';
import chartEn from '../../../../../../public/i18n/chart/en.json';
import chartAr from '../../../../../../public/i18n/chart/ar.json';
import recordEn from '../../../../../../public/i18n/record-page/en.json';
import recordAr from '../../../../../../public/i18n/record-page/ar.json';
import paginationEn from '../../../../../../public/i18n/ui-pagination/en.json';
import paginationAr from '../../../../../../public/i18n/ui-pagination/ar.json';
import globalEn from '../../../../../../public/i18n/en.json';
import globalAr from '../../../../../../public/i18n/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp } from '../../../../core/api/core-http';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Field } from '../../../../shared/ui/field/field';
import { WorkspaceLookups } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import type { WorkspaceBranch } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { bindCrmHttpForTest } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { CRM_SETTINGS_FIXTURES } from '../../shared/testing/crm-settings-fixtures';
import { TargetsPage } from './targets-page';
import { TargetModal } from './target-modal/target-modal';
import { ReleasesModal } from './releases-modal/releases-modal';
import {
  isPeriodClosed,
  type SalesTarget,
  type TargetableMetric,
  type TargetRelease,
} from './targets.model';

const TARGET = CRM_SETTINGS_FIXTURES[
  '/targets/01934c00-0000-7000-8000-000000000014'
] as SalesTarget;
const BRANCH = TARGET.branchId!;
const OTHER = '01934b10-0000-7000-8000-000000000099';
const METRICS: TargetableMetric[] = [
  {
    key: 'crm.leads.created.count',
    labelEn: 'Server lead metric',
    labelAr: 'مقياس العملاء من الخادم',
    measureKind: 'COUNT',
    unit: 'COUNT',
  },
  {
    key: 'crm.opportunities.won.estimated_value',
    labelEn: 'Server money metric',
    labelAr: 'مقياس القيمة من الخادم',
    measureKind: 'MONEY',
    unit: 'MONEY',
  },
];
const BRANCHES: WorkspaceBranch[] = [BRANCH, OTHER].map((id, i) => ({
  id,
  companyId: 'company',
  code: String(i),
  name: `Branch ${i}`,
  status: 'ACTIVE',
  address: null,
  phone: null,
  isHeadquarters: false,
  createdAt: '',
  updatedAt: '',
}));
const dialogMethods = {
  showModal: HTMLDialogElement.prototype.showModal,
  close: HTMLDialogElement.prototype.close,
};
type PageState = {
  loading(): boolean;
  branchesLoading(): boolean;
  branchFilter: WritableSignal<string | null>;
  targets(): SalesTarget[];
  load(): void;
  actionsFor(target: SalesTarget): { id: string; disabled?: boolean }[];
  requestDelete(target: SalesTarget): Promise<void>;
  openReject(target: SalesTarget): void;
  confirmReject(): Promise<void>;
  rejectNote: WritableSignal<string>;
  rejectNoteError(): string | null;
  openCorrect(target: SalesTarget): void;
  confirmCorrect(): Promise<void>;
  correctValueInput: WritableSignal<string>;
  correctReason: WritableSignal<string>;
  activeActionTarget(): SalesTarget | null;
  releaseZones: Map<string, string>;
  closed(target: SalesTarget, now?: string): boolean;
  timeZone: WritableSignal<string | null>;
};
type ModalState = {
  subjectOptions(): { value: string; label: string }[];
  metricOptions(): { value: string; label: string }[];
  currencyOptions(): { value: string }[];
  subjectType: WritableSignal<'USER' | 'TEAM' | 'BRANCH' | 'TEAM_SET'>;
  metricKey: WritableSignal<string>;
  valueInput: WritableSignal<string>;
  currencyCode: WritableSignal<string>;
  onMetricChange(key: string): void;
  subjectsLoading(): boolean;
  currenciesError(): boolean;
  subjectsFailed(): boolean;
  save(): Promise<boolean>;
  resolveConflict(reload: boolean): void;
  serverErrors(): Record<string, string>;
  canEditValue(): boolean;
  onSubjectTypeChange(type: 'USER' | 'TEAM' | 'BRANCH' | 'TEAM_SET'): void;
  onBranchChange(id: string): void;
  selectedTeamIds: WritableSignal<string[]>;
  periodYear: WritableSignal<number>;
  periodMonth: WritableSignal<number>;
  monthOptions(): { value: number }[];
  branchId: WritableSignal<string>;
  subjectId: WritableSignal<string>;
  subjectError(): string | null;
};

describe.each([
  ['en', 'light'],
  ['en', 'dark'],
  ['ar', 'light'],
  ['ar', 'dark'],
] as const)('Targets %s / %s', (language, theme) => {
  let dispose: () => void;
  let me: WritableSignal<TenantMe>;
  let stub: CrmHttpStub;
  let read: MockInstance<CrmHttpStub['read']>;
  let write: MockInstance<CrmHttpStub['write']>;
  let fixture: ComponentFixture<TargetsPage | TargetModal | ReleasesModal>;
  let attributes: (string | null)[];
  const branches = vi.fn().mockResolvedValue(BRANCHES);
  const coreRead = vi
    .fn()
    .mockResolvedValue([
      { code: 'JPY', nameEn: 'Yen', nameAr: 'ين', decimals: 0, isDefault: true },
    ]);
  const notify = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-23T00:00:00Z'));
    attributes = ['lang', 'dir', 'data-theme'].map((k) => document.documentElement.getAttribute(k));
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
    coreRead.mockClear();
    notify.error.mockClear();
    const permissions = [
      'crm.targets.read.all',
      'crm.targets.manage',
      'crm.targets.approve',
      'org.branch.read',
    ];
    me = signal({
      ...FAKE_TENANT_ME,
      isTenantOwner: false,
      permissions,
      permissionScopes: Object.fromEntries(
        permissions.map((key) => [key, { tenantWide: false, companyIds: [], branchIds: [BRANCH] }]),
      ),
      accessibleBranches: [BRANCH],
      accessibleBranchCompanies: [{ branchId: BRANCH, companyId: 'company' }],
      accessScope: { ...FAKE_TENANT_ME.accessScope, branchesTruncated: false },
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
      'settings-targets/en': targetsEn,
      'settings-targets/ar': targetsAr,
      'record-page/en': recordEn,
      'record-page/ar': recordAr,
      'ui-pagination/en': paginationEn,
      'ui-pagination/ar': paginationAr,
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
        {
          provide: TenantScopeState,
          useValue: { me, selection: () => ({ companyId: 'company', branchId: BRANCH }) },
        },
        { provide: LanguageState, useValue: { current: signal(language) } },
        { provide: WorkspaceLookups, useValue: { allBranches: branches } },
        { provide: CoreHttp, useValue: { read: coreRead } },
        { provide: Notify, useValue: notify },
      ],
    });
    const t = TestBed.inject(TranslocoService);
    for (const lang of ['en', 'ar'])
      t.setTranslation(
        {
          ...translations[lang],
          settings: translations[`settings/${lang}`],
          analytics: translations[`analytics/${lang}`],
          chart: translations[`chart/${lang}`],
          targets: translations[`settings-targets/${lang}`],
          recordPage: translations[`record-page/${lang}`],
          pagination: translations[`ui-pagination/${lang}`],
        },
        lang,
      );
    t.setActiveLang(language);
    stub = new CrmHttpStub();
    read = vi.spyOn(stub, 'read').mockImplementation(async <T>(path: string) => {
      if (path === '/targets') return { items: [TARGET], total: 1, page: 1, limit: 12 } as T;
      if (path === '/targets/metrics') return METRICS as T;
      if (path === '/targets/subject-options')
        return {
          users: [{ id: 'user', displayName: 'Real user' }],
          teams: [{ id: 'team', name: 'Real team' }],
        } as T;
      if (path.endsWith('/releases'))
        return {
          items: [{ periodTimeZone: 'America/Los_Angeles' }],
          pageInfo: { hasMore: false, nextCursor: null },
        } as T;
      return { ...TARGET, revision: 8 } as T;
    });
    write = vi
      .spyOn(stub, 'write')
      .mockResolvedValue({ status: 200, data: TARGET, etag: null, location: null });
    dispose = bindCrmHttpForTest(stub);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    dispose();
    vi.restoreAllMocks();
    vi.useRealTimers();
    HTMLDialogElement.prototype.showModal = dialogMethods.showModal;
    HTMLDialogElement.prototype.close = dialogMethods.close;
    ['lang', 'dir', 'data-theme'].forEach((k, i) =>
      attributes[i] === null
        ? document.documentElement.removeAttribute(k)
        : document.documentElement.setAttribute(k, attributes[i]!),
    );
  });
  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  async function page() {
    fixture = TestBed.createComponent(TargetsPage);
    await settle();
    const state = fixture.componentInstance as unknown as PageState;
    await vi.waitFor(() => {
      expect(state.branchesLoading()).toBe(false);
      expect(state.loading()).toBe(false);
    });
    await settle();
    return state;
  }
  async function modal(target?: SalesTarget) {
    const f = TestBed.createComponent(TargetModal);
    fixture = f;
    f.componentRef.setInput('canManage', true);
    f.componentRef.setInput('branches', BRANCHES);
    f.componentRef.setInput('metrics', METRICS);
    await settle();
    if (target) f.componentInstance.openEdit(target);
    else f.componentInstance.openCreate(BRANCH);
    await settle();
    const state = f.componentInstance as unknown as ModalState;
    if (!target) await vi.waitFor(() => expect(state.subjectsLoading()).toBe(false));
    await settle();
    return state;
  }
  it.each(['BRANCH_PERMISSION_DENIED', 'MISSING_REQUIRED_PERMISSIONS', 'CRM_MODULE_DISABLED'])(
    'TargetsPage › forbidden states (%s)',
    async (code) => {
      read.mockImplementation(async <T>(path: string) => {
        if (path === '/targets') throw new ApiError(403, code);
        return METRICS as T;
      });
      await page();
      expect(fixture.debugElement.query(By.directive(FullState)).componentInstance.kind()).toBe(
        'forbidden',
      );
    },
  );
  it('TargetsPage › branch picker gate', async () => {
    me.update((m) => ({ ...m, permissions: m.permissions.filter((p) => p !== 'org.branch.read') }));
    const state = await page();
    expect(branches).not.toHaveBeenCalled();
    expect(state.branchFilter()).toBe(BRANCH);
    expect(fixture.nativeElement.textContent).toContain(
      language === 'ar' ? targetsAr.yourBranch : targetsEn.yourBranch,
    );
  });
  it('asks the administrator when no single branch grant exists', async () => {
    me.update((m) => ({
      ...m,
      permissions: m.permissions.filter((p) => p !== 'org.branch.read'),
      permissionScopes: {
        ...m.permissionScopes,
        'crm.targets.read.all': { tenantWide: false, companyIds: [], branchIds: [BRANCH, OTHER] },
      },
      accessibleBranches: [BRANCH, OTHER],
    }));
    const state = await page();
    expect(state.branchFilter()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      language === 'ar' ? targetsAr.askAdministrator : targetsEn.askAdministrator,
    );
    expect(read.mock.calls.some(([path]) => path === '/targets')).toBe(false);
  });
  it('TargetsPage › closed period rule', async () => {
    const state = await page();
    state.timeZone.set('Asia/Tokyo');
    const target = {
      ...TARGET,
      periodGrain: 'MONTH' as const,
      periodStart: '2026-11-01',
      periodEndExclusive: '2026-12-01',
      latestRelease: {
        id: 'release',
        releaseNumber: 1,
        targetValue: '50',
        approvalBasis: 'REVIEWED',
        approvedAt: '',
        periodTimeZone: 'America/Los_Angeles',
      },
    };
    state.releaseZones.set(target.id, 'America/Los_Angeles');
    expect(state.closed(target, '2026-12-01T02:00:00Z')).toBe(false);
    state.releaseZones.clear();
    expect(state.closed({ ...target, latestRelease: null }, '2026-12-01T02:00:00Z')).toBe(true);
    state.timeZone.set(null);
    expect(state.closed({ ...target, latestRelease: null }, '2026-12-01T02:00:00Z')).toBe(true);
    expect(
      isPeriodClosed('MONTH', '2026-11-01', '2026-12-01T08:00:00Z', 'America/Los_Angeles'),
    ).toBe(true);
  });
  it('gates row actions against every branch and permits closed draft corrections', async () => {
    const state = await page();
    expect(state.actionsFor({ ...TARGET, branchId: OTHER }).map((a) => a.id)).toEqual(['releases']);
    const set = {
      ...TARGET,
      subjectType: 'TEAM_SET' as const,
      branchId: null,
      subjects: [
        { teamId: 'a', teamName: 'A', branchId: BRANCH, branchName: 'B' },
        { teamId: 'b', teamName: 'B', branchId: OTHER, branchName: 'C' },
      ],
    };
    expect(state.actionsFor(set).map((a) => a.id)).toEqual(['releases']);
    const closed = { ...TARGET, periodStart: '2026-09-01', periodEndExclusive: '2026-10-01' };
    expect(state.actionsFor(closed).map((a) => a.id)).toContain('correct');
  });
  it('TargetsPage › only drafts delete', async () => {
    const state = await page();
    expect(
      state.actionsFor({ ...TARGET, approvalState: 'APPROVED' }).find((a) => a.id === 'delete')
        ?.disabled,
    ).toBe(true);
    const confirm = fixture.debugElement
      .queryAll(By.directive(ConfirmDialog))
      .map((d) => d.componentInstance as ConfirmDialog)
      .find((d) => d.tone() === 'danger')!;
    vi.spyOn(confirm, 'open').mockResolvedValue(true);
    write.mockRejectedValueOnce(new ApiError(409, 'CRM_TARGET_NOT_DRAFT'));
    await state.requestDelete(TARGET);
    expect(notify.error).toHaveBeenCalledWith(
      language === 'ar'
        ? targetsAr.errors.CRM_TARGET_NOT_DRAFT
        : targetsEn.errors.CRM_TARGET_NOT_DRAFT,
    );
  });
  it('TargetModal › metrics from the server', async () => {
    const state = await modal();
    expect(state.metricOptions().map((o) => o.value)).toEqual(METRICS.map((m) => m.key));
    expect(state.metricOptions()[0].label).toBe(
      language === 'ar' ? METRICS[0].labelAr : METRICS[0].labelEn,
    );
    fixture.componentRef.setInput('metricsError', true);
    await settle();
    expect(fixture.debugElement.query(By.directive(FullState)).componentInstance.kind()).toBe(
      'load-failure',
    );
  });
  it('TargetModal › subject options', async () => {
    const state = await modal();
    expect(state.subjectOptions()).toEqual([{ value: 'user', label: 'Real user' }]);
    state.onSubjectTypeChange('TEAM');
    expect(state.subjectOptions()).toEqual([{ value: 'team', label: 'Real team' }]);
    read.mockRejectedValueOnce(new ApiError(403, 'BRANCH_PERMISSION_DENIED'));
    state.onBranchChange(OTHER);
    await vi.waitFor(() => expect(state.subjectsFailed()).toBe(true));
    await settle();
    expect(state.subjectError()).toBe(
      language === 'ar'
        ? targetsAr.errors.BRANCH_PERMISSION_DENIED
        : targetsEn.errors.BRANCH_PERMISSION_DENIED,
    );
  });
  it('TargetModal › currencies from core', async () => {
    const state = await modal();
    state.onMetricChange(METRICS[1].key);
    await settle();
    expect(coreRead).toHaveBeenCalledWith('/api/tenant/core/v1/currencies/options');
    expect(state.currencyOptions()).toEqual([{ value: 'JPY', label: 'JPY' }]);
    expect(state.currencyCode()).toBe('JPY');
  });
  it.each([
    ['CRM_TARGET_VALUE_INVALID', 'value'],
    ['CRM_TARGET_PERIOD_INVALID', 'period'],
    ['CRM_TARGET_CURRENCY_INVALID', 'currency'],
    ['CRM_TARGET_MEASURE_INVALID', 'metric'],
    ['CRM_TARGET_SUBJECT_INVALID', 'subject'],
    ['CRM_TARGET_TEAM_SET_INVALID', 'teams'],
    ['CRM_TARGET_METRIC_NOT_TARGETABLE', 'metric'],
    ['CRM_TARGET_DUPLICATE', 'metric'],
    ['CRM_TARGET_SECOND_CURRENCY_AFTER_R2', 'currency'],
  ])('TargetModal › create errors (%s)', async (code, field) => {
    const state = await modal();
    state.valueInput.set('50');
    state.metricKey.set(METRICS[0].key);
    write.mockRejectedValueOnce(new ApiError(code.includes('DUPLICATE') ? 409 : 422, code));
    await expect(state.save()).resolves.toBe(false);
    expect(state.serverErrors()[field]).toBe(code);
    expect(state.valueInput()).toBe('50');
  });
  it('TargetModal › reject note', async () => {
    const state = await page();
    state.openReject({ ...TARGET, approvalState: 'SUBMITTED' });
    state.rejectNote.set('Review it');
    write.mockRejectedValueOnce(new ApiError(422, 'CRM_TARGET_REJECT_NOTE_REQUIRED'));
    await state.confirmReject();
    expect(state.rejectNoteError()).toBe(
      language === 'ar'
        ? targetsAr.errors.CRM_TARGET_REJECT_NOTE_REQUIRED
        : targetsEn.errors.CRM_TARGET_REJECT_NOTE_REQUIRED,
    );
  });
  it.each([true, false])('TargetsPage › conflict (reload=%s)', async (reload) => {
    const state = await modal(TARGET);
    state.valueInput.set('55');
    write.mockRejectedValueOnce(new ApiError(409, 'CRM_TARGET_REVISION_CONFLICT'));
    const saving = state.save();
    await vi.waitFor(() =>
      expect(
        (
          fixture.debugElement.query(By.directive(ConflictDialog))
            .componentInstance as ConflictDialog
        ).open(),
      ).toBe(true),
    );
    state.resolveConflict(reload);
    await saving;
    if (reload) expect(state.valueInput()).not.toBe('55');
    else expect(state.valueInput()).toBe('55');
    state.valueInput.set('56');
    await state.save();
    expect(write.mock.calls.at(-1)?.[2]).toEqual({ revision: 8, targetValue: 56 });
  });
  it('shows a currency failure without an editable currency picker and retains entered values', async () => {
    coreRead.mockRejectedValueOnce(new ApiError(503, 'COMMON.GENERIC.INTERNAL_ERROR'));
    const state = await modal();
    state.onMetricChange(METRICS[1].key);
    state.valueInput.set('25');
    await vi.waitFor(() => expect(state.currenciesError()).toBe(true));
    await settle();
    expect(fixture.nativeElement.querySelector('ui-dropdown[id$="-currency"]')).toBeNull();
    await expect(state.save()).resolves.toBe(false);
    expect(state.valueInput()).toBe('25');
    expect(write).not.toHaveBeenCalled();
  });
  it('shows a load failure with the correlation id for source-not-ready', async () => {
    read.mockImplementation(async <T>(path: string) => {
      if (path === '/targets')
        throw new ApiError(503, 'CRM_TARGET_SOURCE_NOT_READY', undefined, {
          correlationId: 'corr-targets',
        });
      return METRICS as T;
    });
    await page();
    const full = fixture.debugElement.query(By.directive(FullState)).componentInstance as FullState;
    expect(full.kind()).toBe('load-failure');
    expect(full.text()).toContain('corr-targets');
  });
  it('puts an invalid list period on the filter field', async () => {
    read.mockImplementation(async <T>(path: string) => {
      if (path === '/targets') throw new ApiError(422, 'CRM_TARGET_PERIOD_INVALID');
      return METRICS as T;
    });
    await page();
    const fields = fixture.debugElement
      .queryAll(By.directive(Field))
      .map((d) => d.componentInstance as Field);
    expect(
      fields.some(
        (f) =>
          f.error() ===
          (language === 'ar'
            ? targetsAr.errors.CRM_TARGET_PERIOD_INVALID
            : targetsEn.errors.CRM_TARGET_PERIOD_INVALID),
      ),
    ).toBe(true);
  });
  it('restarts release history on a bad cursor without leaving Load more busy', async () => {
    const history = CRM_SETTINGS_FIXTURES[
      '/targets/01934c00-0000-7000-8000-000000000001/releases'
    ] as { items: TargetRelease[] };
    const release = history.items[0];
    let count = 0;
    read.mockImplementation(async <T>() => {
      count++;
      if (count === 2) throw new ApiError(400, 'CRM_DASHBOARD_LIST_CURSOR_INVALID');
      return {
        items: [release],
        pageInfo: { nextCursor: count === 1 ? 'expired' : null, hasMore: count === 1 },
      } as T;
    });
    const f = TestBed.createComponent(ReleasesModal);
    fixture = f;
    await settle();
    f.componentInstance.open(TARGET);
    const state = f.componentInstance as unknown as {
      loading(): boolean;
      loadingMore(): boolean;
      releases(): TargetRelease[];
      loadMore(): Promise<void>;
      formatPeriodRange(release: TargetRelease): string;
    };
    await vi.waitFor(() => expect(state.releases()).toHaveLength(1));
    await state.loadMore();
    await settle();
    expect(state.releases()).toHaveLength(1);
    expect(state.loadingMore()).toBe(false);
    expect(count).toBe(3);
    const range = state.formatPeriodRange({
      ...release,
      periodStartAt: '2026-10-31T22:00:00Z',
      periodEndAt: '2026-11-30T22:00:00Z',
      periodTimeZone: 'Africa/Cairo',
    });
    expect(range).toContain('2026');
    expect(range).toContain('Africa/Cairo');
  });
  it('preserves two-decimal rates and rejects excessive precision with a field message', async () => {
    const state = await modal({ ...TARGET, measureKind: 'RATE', targetValue: '12.25' });
    expect(state.valueInput()).toBe('12.25');
    state.valueInput.set('12.251');
    await expect(state.save()).resolves.toBe(false);
    await settle();
    expect(fixture.nativeElement.textContent).toContain(
      language === 'ar' ? targetsAr.validation.valuePrecision : targetsEn.validation.valuePrecision,
    );
  });
  it('keeps creation fields readable without dropdowns after a read-only denial', async () => {
    const state = await modal();
    state.valueInput.set('55');
    write.mockRejectedValueOnce(new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY'));
    await state.save();
    await settle();
    expect(state.canEditValue()).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('form ui-dropdown')).toHaveLength(0);
    expect(state.valueInput()).toBe('55');
  });
  it('does not infer one branch from a truncated permission projection', async () => {
    me.update((m) => ({
      ...m,
      permissions: m.permissions.filter((p) => p !== 'org.branch.read'),
      accessScope: { ...m.accessScope, branchesTruncated: true },
    }));
    const state = await page();
    expect(state.branchFilter()).toBeNull();
  });
  it('offers only open or future periods, and keeps hints linked to real controls', async () => {
    const state = await modal();
    state.periodYear.set(2026);
    expect(state.monthOptions().map((o) => o.value)).toEqual([11, 12]);
    state.periodMonth.set(9);
    state.valueInput.set('20');
    await expect(state.save()).resolves.toBe(false);
    for (const field of fixture.debugElement.queryAll(By.directive(Field)))
      expect((field.componentInstance as Field).hint()).toBeTruthy();
    const search = fixture.nativeElement.querySelector('input[type=search]') as HTMLInputElement;
    expect(
      fixture.nativeElement.querySelector(`#${search.getAttribute('aria-describedby')}`),
    ).toBeTruthy();
  });
  it('switches write controls to read-only after a subscription denial', async () => {
    const state = await modal(TARGET);
    state.valueInput.set('55');
    write.mockRejectedValueOnce(new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY'));
    await state.save();
    await settle();
    expect(state.canEditValue()).toBe(false);
    expect(fixture.nativeElement.querySelector('input[id$="-value"]')?.readOnly).toBe(true);
  });
});
