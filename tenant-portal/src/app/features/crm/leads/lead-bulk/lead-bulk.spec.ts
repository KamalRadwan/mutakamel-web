import { Injectable, Injector, Type, WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Translation, TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { ApiError } from '../../../../core/api/api-errors';
import { CurrentUser } from '../../../../core/auth/current-user';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { BulkJobSubmit } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { Field } from '../../../../shared/ui/field/field';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { bindCrmInjectorForTest } from '../../shared/crm-runtime';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { LeadStage } from '../leads.model';
import { BulkActivityModal } from './activity-modal/activity-modal';
import { BulkAssignModal } from './assign-modal/assign-modal';
import { BulkDeleteModal } from './delete-modal/delete-modal';
import { BulkStageModal } from './stage-modal/stage-modal';
import { LeadSelection } from './lead-selection';
import { SelectedRow } from './lead-bulk.model';
import { LeadBulkSubmitKey } from './lead-bulk-submit';
import { CRM_LEADS_BULK_MODULE } from './leads-bulk.descriptor';
import enGlobal from '../../../../../../public/i18n/en.json';
import en_leads from '../../../../../../public/i18n/leads/en.json';
import en_record_related from '../../../../../../public/i18n/record-related/en.json';
import en_record_bulk from '../../../../../../public/i18n/record-bulk/en.json';
import en_lead_bulk_actions from '../../../../../../public/i18n/lead-bulk-actions/en.json';
import en_lead_bulk_activity from '../../../../../../public/i18n/lead-bulk-activity/en.json';
import en_date_range from '../../../../../../public/i18n/date-range/en.json';
import arGlobal from '../../../../../../public/i18n/ar.json';
import ar_leads from '../../../../../../public/i18n/leads/ar.json';
import ar_record_related from '../../../../../../public/i18n/record-related/ar.json';
import ar_record_bulk from '../../../../../../public/i18n/record-bulk/ar.json';
import ar_lead_bulk_actions from '../../../../../../public/i18n/lead-bulk-actions/ar.json';
import ar_lead_bulk_activity from '../../../../../../public/i18n/lead-bulk-activity/ar.json';
import ar_date_range from '../../../../../../public/i18n/date-range/ar.json';

const translations: Record<string, Translation> = {
  'en': enGlobal,
  'leads/en': en_leads,
  'record-related/en': en_record_related,
  'record-bulk/en': en_record_bulk,
  'lead-bulk-actions/en': en_lead_bulk_actions,
  'lead-bulk-activity/en': en_lead_bulk_activity,
  'date-range/en': en_date_range,
  'ar': arGlobal,
  'leads/ar': ar_leads,
  'record-related/ar': ar_record_related,
  'record-bulk/ar': ar_record_bulk,
  'lead-bulk-actions/ar': ar_lead_bulk_actions,
  'lead-bulk-activity/ar': ar_lead_bulk_activity,
  'date-range/ar': ar_date_range,
};
@Injectable()
class Loader implements TranslocoLoader {
  getTranslation(path: string) { return of(translations[path] ?? {}); }
}
const branchId = '019f0000-0000-7000-8000-000000000011';
const companyId = '019f0000-0000-7000-8000-000000000010';
const row: SelectedRow = { id: '019f0000-0000-7000-8000-000000000012', displayName: 'Acme', ownerUserId: 'owner', stageId: 'stage', stageFlag: 'NEW', status: 'OPEN' };
const stage: LeadStage = { id: 'next-stage', flag: 'QUALIFIED', isActive: true, sortOrder: 1, nameEn: 'Qualified', nameAr: 'مؤهل' };
const modals: [string, Type<unknown>, string][] = [
  ['ASSIGN', BulkAssignModal, 'ownerUserId'], ['MOVE_STAGE', BulkStageModal, 'stageId'],
  ['DELETE', BulkDeleteModal, 'reason'], ['CREATE_ACTIVITY', BulkActivityModal, 'activity'],
];
interface ModalState {
  rows: WritableSignal<SelectedRow[]>;
  owners?: WritableSignal<{ id: string; displayName: string; avatarUrl: string | null }[]>;
  selectedOwnerId?: WritableSignal<string>;
  subject?: WritableSignal<string>;
  startDate?: WritableSignal<string>;
  startTime?: WritableSignal<string>;
  serverStartError?: WritableSignal<string | null>;
  serverOwnerError?: WritableSignal<string | null>;
  ownersForbidden?: WritableSignal<boolean>;
  loadError: WritableSignal<{ kind: 'forbidden' | 'not-found' | 'load-failure' | 'provisioning'; message: string; correlationId: string | null } | null>;
  submitKey: LeadBulkSubmitKey;
  submit(): Promise<void>;
  retryLoad(): Promise<void>;
  loadOwners(seq: number): Promise<void>;
}

describe.each([['en','light'], ['en','dark'], ['ar','light'], ['ar','dark']])('LeadBulk %s / %s', (lang, theme) => {
  let dispose: () => void;
  let restoreRuntime: () => void;
  let attributes: (string | null)[];
  let http: CrmHttpStub;
  let fixtures: ComponentFixture<unknown>[];
  let selection: LeadSelection;
  const notify = { error: vi.fn(), info: vi.fn() };
  const submit = vi.fn();
  const session = signal<{ companyId: string; branchId: string | null }>({ companyId, branchId });

  beforeEach(() => {
    attributes = ['lang','dir','data-theme'].map((name) => document.documentElement.getAttribute(name));
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    session.set({ companyId, branchId });
    fixtures = [];
    selection = new LeadSelection();
    submit.mockReset().mockResolvedValue({ jobId: 'job', status: 'QUEUED', total: 1 });
    notify.error.mockClear(); notify.info.mockClear();
    TestBed.configureTestingModule({ providers: [
      { provide: BulkJobsTracker, useValue: { submit } }, { provide: Notify, useValue: notify },
      { provide: LeadSelection, useValue: selection },
      { provide: LanguageState, useValue: { current: signal(lang) } },
      { provide: CurrentUser, useValue: { userId: () => 'me', user: () => ({ displayName: 'User' }) } },
      { provide: TenantScopeState, useValue: { selection: session, branchCompanies: () => new Map([[branchId, companyId]]) } },
      provideTransloco({ config: { availableLangs: ['en','ar'], defaultLang: lang, reRenderOnLangChange: true }, loader: Loader }),
    ] });
    const transloco = TestBed.inject(TranslocoService);
    transloco.setActiveLang(lang);
    transloco.setTranslation(translations[lang], lang);
    for (const [scope, alias] of Object.entries({"leads": "leads", "record-related": "recordRelated", "record-bulk": "recordBulk", "lead-bulk-actions": "leadBulk", "lead-bulk-activity": "bulkAct", "date-range": "dateRange"})) {
      transloco.setTranslation({ [alias]: translations[`${scope}/${lang}`] }, lang, { merge: true });
    }
    restoreRuntime = bindCrmInjectorForTest(() => TestBed.inject(Injector));
    http = new CrmHttpStub({ '/assignable-owners': { items: [{ id: 'owner', displayName: 'Owner', avatarUrl: null }], nextCursor: null } });
    dispose = bindCrmHttpForTest(http); crmQueries().clear();
  });
  afterEach(() => {
    fixtures.forEach((fixture) => fixture.destroy());
    dispose(); restoreRuntime(); crmQueries().clear(); vi.restoreAllMocks();
    ['lang','dir','data-theme'].forEach((key, i) => attributes[i] === null
      ? document.documentElement.removeAttribute(key) : document.documentElement.setAttribute(key, attributes[i]!));
  });

  function create(component: Type<unknown>) {
    const fixture = TestBed.createComponent(component); fixtures.push(fixture);
    fixture.componentRef.setInput('branchId', branchId);
    if (component === BulkStageModal) fixture.componentRef.setInput('stages', [stage]);
    const state = fixture.componentInstance as ModalState;
    state.rows.set([row]);
    if (component === BulkAssignModal) {
      state.owners!.set([{ id: 'owner', displayName: 'Owner', avatarUrl: null }]);
      state.selectedOwnerId!.set('owner');
    }
    if (component === BulkActivityModal) {
      state.subject!.set('Call customer');
      state.startDate!.set('2099-01-01'); state.startTime!.set('12:00');
    }
    fixture.detectChanges();
    return { fixture, state };
  }

  it.each(modals)('LeadBulk › submit (%s)', async (action, component, param) => {
    const { fixture, state } = create(component);
    await state.submit();
    expect(submit).toHaveBeenCalledTimes(1);
    const [app, body, options] = submit.mock.calls[0] as [string, BulkJobSubmit, { idempotencyKey: string }];
    expect(app).toBe('crm');
    expect(body).toMatchObject({ module: 'crm.leads', action, scope: { branchId }, selection: { kind: 'IDS', ids: [row.id] } });
    expect(body.params).toHaveProperty(param);
    expect(Object.keys(options)).toEqual(['idempotencyKey']);
    expect(options.idempotencyKey).toMatch(/^[0-9a-f-]{14}7[0-9a-f-]+$/i);
    const fields = fixture.debugElement.queryAll(By.directive(Field));
    expect(fields.length).toBeGreaterThan(0);
    fields.forEach((field) => {
      expect((field.componentInstance as Field).hint().trim()).not.toBe('');
      expect((field.componentInstance as Field).label()).not.toMatch(/^(leadBulk|bulkAct)\./);
    });
  });

  it.each(modals)('LeadBulk › branch pre-check (%s)', async (_action, component) => {
    const { state } = create(component);
    selection.selectAllMatching({ branchId: 'other-branch' }, 1);
    await state.submit();
    expect(submit).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith(TestBed.inject(TranslocoService).translate('leadBulk.codes.BRANCH_SCOPE_MISMATCH'));
    selection.clear(); session.set({ companyId, branchId: null });
    await state.submit(); expect(submit).not.toHaveBeenCalled();
  });

  it.each(modals)('LeadBulk › active job (%s)', async (_action, component) => {
    const { state } = create(component);
    submit.mockRejectedValueOnce(new ApiError(409, 'BULK_JOB_ACTIVE'));
    await state.submit();
    expect(notify.error).not.toHaveBeenCalled();
    expect(state.rows()).toEqual([row]);
  });

  it.each(modals)('retains the key on an uncertain retry and blocks idempotency mismatches (%s)', async (_action, component) => {
    const { state, fixture } = create(component);
    submit.mockRejectedValueOnce(new ApiError(503, 'UNAVAILABLE'));
    await state.submit();
    submit.mockRejectedValueOnce(new ApiError(409, 'GW.IDEM.MISMATCH'));
    await state.submit();
    expect(submit.mock.calls[0][2]).toEqual(submit.mock.calls[1][2]);
    expect(state.submitKey.blocked()).toBe(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(true);
    await state.submit(); expect(submit).toHaveBeenCalledTimes(2);
  });

  it('LeadBulk › activity rules', async () => {
    const { state, fixture } = create(BulkActivityModal);
    state.startDate!.set('2000-01-01');
    await state.submit(); expect(submit).not.toHaveBeenCalled();
    state.startDate!.set('2099-01-01');
    submit.mockRejectedValueOnce(new ApiError(422, 'LEAD_BULK_START_IN_PAST'));
    await state.submit(); fixture.detectChanges();
    expect(state.serverStartError!()).toBe(TestBed.inject(TranslocoService).translate('leadBulk.codes.LEAD_BULK_START_IN_PAST'));
    const body = submit.mock.calls[0][1] as BulkJobSubmit;
    expect(body.params).toMatchObject({ schedule: { startAt: expect.any(String), gapMinutes: 15, order: 'TABLE', assignee: { mode: 'LEAD_OWNER' } } });
    expect(CRM_LEADS_BULK_MODULE.retryOverrides!({ action: 'CREATE_ACTIVITY' } as Parameters<NonNullable<typeof CRM_LEADS_BULK_MODULE.retryOverrides>>[0])).toBe('START_AT');
  });

  it('disables an inaccessible catalogue and offers Retry with a correlation id on a read failure', async () => {
    const { state, fixture } = create(BulkAssignModal);
    vi.spyOn(http, 'read').mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN'));
    await state.loadOwners(0); fixture.detectChanges();
    expect(state.ownersForbidden!()).toBe(true);
    expect(fixture.nativeElement.querySelector('button[aria-haspopup]').disabled).toBe(true);
    vi.mocked(http.read).mockRejectedValueOnce(new ApiError(503, 'UNAVAILABLE', undefined, { correlationId: 'trace-123' }));
    await state.loadOwners(0); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ui-full-state').textContent).toContain('trace-123');
    await state.retryLoad(); fixture.detectChanges();
    expect(state.loadError()).toBeNull();
  });

  it('keeps the form and key on 401 and shows the retry delay on 429', async () => {
    const { state } = create(BulkAssignModal);
    const t = TestBed.inject(TranslocoService);
    submit.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED'));
    await state.submit();
    expect(notify.error).toHaveBeenLastCalledWith(t.translate('apiErrors.notSaved'));
    submit.mockRejectedValueOnce(new ApiError(429, 'RATE_LIMITED', { retryAfterSeconds: ['12'] }));
    await state.submit();
    expect(submit.mock.calls[0][2]).toEqual(submit.mock.calls[1][2]);
    expect(notify.error).toHaveBeenLastCalledWith(t.translate('apiErrors.rateLimitedIn', { seconds: '12' }));
    expect(state.rows()).toEqual([row]);
  });

  it.each(['CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY', 'CRM_LEADS_DISABLED'])('makes the form read-only for %s', async (code) => {
    const { state, fixture } = create(BulkDeleteModal);
    submit.mockRejectedValueOnce(new ApiError(403, code));
    await state.submit(); fixture.detectChanges();
    expect(state.submitKey.blocked()).toBe(true);
    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(true);
    expect(notify.error).toHaveBeenCalled();
    await state.submit(); expect(submit).toHaveBeenCalledTimes(1);
  });

  it('shows validation under the owner field and uses the server selection cap', async () => {
    const { state, fixture } = create(BulkAssignModal);
    submit.mockRejectedValueOnce(new ApiError(400, 'CRM_VALIDATION_FAILED', { 'params.ownerUserId': ['invalid'] }));
    await state.submit(); fixture.detectChanges();
    expect(state.serverOwnerError!()).toBe(TestBed.inject(TranslocoService).translate('leadBulk.invalidValue'));
    submit.mockRejectedValueOnce(new ApiError(422, 'BULK_SELECTION_TOO_LARGE', { max: ['5000'] }));
    await state.submit();
    expect(notify.error).toHaveBeenLastCalledWith(TestBed.inject(TranslocoService).translate('leadBulk.codes.BULK_SELECTION_TOO_LARGE', { max: '5,000' }));
  });
});
