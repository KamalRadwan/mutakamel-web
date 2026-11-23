import { EnvironmentInjector, Signal, WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService, Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../public/i18n/en.json';
import ar from '../../../../../../public/i18n/ar.json';
import enBulk from '../../../../../../public/i18n/opportunity-bulk/en.json';
import arBulk from '../../../../../../public/i18n/opportunity-bulk/ar.json';
import enRecord from '../../../../../../public/i18n/record-bulk/en.json';
import arRecord from '../../../../../../public/i18n/record-bulk/ar.json';
import enOpportunities from '../../../../../../public/i18n/opportunities/en.json';
import arOpportunities from '../../../../../../public/i18n/opportunities/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreWriteMethod } from '../../../../core/api/core-http';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { BulkJob, BulkJobItem, BulkJobSubmit, BulkJobSubmitResult } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { bindCrmHttpForTest, crmQueries, CrmWriteOptions } from '../../shared/crm-http';
import { bindCrmInjectorForTest } from '../../shared/crm-runtime';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { selectOpportunities } from '../opportunities.api';
import { OpportunitySelection, toBulkQuery } from './opportunity-selection';
import { OpportunityBulkMenu } from './bulk-menu/bulk-menu';
import { OppBulkAssignModal } from './assign-modal/assign-modal';
import { OppBulkStageModal } from './stage-modal/stage-modal';
import { OppBulkDeleteModal } from './delete-modal/delete-modal';
import { OppBulkActivityModal } from './activity-modal/activity-modal';
import {
  OpportunityBulkSubmission, buildAssignBulkJob, buildMoveStageBulkJob, buildDeleteBulkJob,
  buildCreateActivityBulkJob, moveStageParamsFor, opportunityBulkErrorMessage,
  toWireActivitySchedule,
} from './bulk-runner';
import { CRM_OPPORTUNITIES_BULK_MODULE } from './opportunities-bulk.descriptor';
import { listBulkOpportunityOwners } from './opportunity-bulk.api';

const branchId = '019f0000-0000-7000-8000-000000000011';
const companyId = '019f0000-0000-7000-8000-000000000010';
const id = '019f0000-0000-7000-8000-000000030008';
const ownerId = '019f0000-0000-7000-8000-000000000022';
const row = { id, title: 'Office equipment', ownerUserId: ownerId, stageId: 'new', status: 'IN_PROGRESS' as const, updatedAt: '2026-11-21T12:00:00Z' };
const selection = { kind: 'IDS' as const, ids: [id] };
const result: BulkJobSubmitResult = { jobId: id, status: 'QUEUED', total: 1, skippedAtSubmit: 0, failedAtSubmit: 0, chunkCount: 1 };
const pipeline = { id: 'pipeline', isActive: true, isDefault: true, nameEn: 'Sales', nameAr: 'المبيعات', stages: [
  { id: 'new', pipelineId: 'pipeline', rank: 1, nameEn: 'New', nameAr: 'جديدة', isActive: true, flag: 'NEW', category: 'OPEN' },
  { id: 'lost', pipelineId: 'pipeline', rank: 2, nameEn: 'Lost', nameAr: 'خاسرة', isActive: true, flag: 'LOST', category: 'CLOSED' },
] };
const translations: Record<string, Translation> = {
  en, ar, 'opportunity-bulk/en': enBulk, 'opportunity-bulk/ar': arBulk,
  'opportunities/en': enOpportunities, 'opportunities/ar': arOpportunities,
  'record-bulk/en': enRecord, 'record-bulk/ar': arRecord,
};
class BulkTranslations { getTranslation(path: string) { return of(translations[path] ?? {}); } }

class BulkTransport extends CrmHttpStub {
  failure: ApiError | null = null;
  readonly denied = new Set<string>();
  ownerCursor: string | null = null;
  selectionResponse = { items: [row], total: 1, truncated: false };
  constructor() { super({
    '/pipelines': [pipeline], '/opportunities/reasons': { items: [] },
    '/assignable-owners': { items: [{ id: ownerId, displayName: 'A user', avatarUrl: null }], nextCursor: null },
  }); }
  override async read<T>(...args: Parameters<CrmHttpStub['read']>): Promise<T> {
    const response = await super.read<T>(...args);
    if (this.denied.has(args[0])) throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
    if (args[0] === '/assignable-owners') {
      return { items: [{ id: args[1]?.['cursor'] ? id : ownerId, displayName: 'A user', avatarUrl: null }],
        nextCursor: args[1]?.['cursor'] ? null : this.ownerCursor } as T;
    }
    return response;
  }
  override async write<T>(method: CoreWriteMethod, path: string, body: unknown, options: CrmWriteOptions) {
    const response = await super.write<T>(method, path, body, options);
    if (this.failure) throw this.failure;
    return { ...response, data: structuredClone(this.selectionResponse) as T };
  }
}

interface ModalState {
  submit(): Promise<void>;
  canSubmit?: Signal<boolean>;
  submission: OpportunityBulkSubmission;
  subject: WritableSignal<string>;
  selectedStageId: WritableSignal<string>;
  ownersDenied: WritableSignal<boolean>;
  lossReasonsDenied: WritableSignal<boolean>;
  lossReasonsHidden: WritableSignal<boolean>;
  serverStartError: Signal<string | null>;
  serverOwnerError: Signal<string | null>;
  serverFieldErrors: Signal<Record<string, string>>;
  reasonError: Signal<string | null>;
  handleSubmitError(error: unknown): void;
}

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('%s / %s', (lang, theme) => {
  let transport: BulkTransport;
  let disposeHttp: () => void;
  let disposeRuntime: () => void;
  let t: TranslocoService;
  let branch: WritableSignal<{ branchId: string | null; companyId: string }>;
  let submit: ReturnType<typeof vi.fn<BulkJobsTracker['submit']>>;
  let tracker: BulkJobsTracker;
  let attrs: (string | null)[];
  let dialogMethods: PropertyDescriptorMap;
  const notify = { error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  beforeEach(() => {
    dialogMethods = Object.getOwnPropertyDescriptors(HTMLDialogElement.prototype);
    vi.useFakeTimers();
    vi.clearAllMocks();
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true, writable: true, value: function(this: HTMLDialogElement) { this.open = true; },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true, writable: true, value: function(this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')); },
    });
    attrs = ['lang', 'dir', 'data-theme'].map((key) => document.documentElement.getAttribute(key));
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    localStorage.setItem('lang', lang);
    branch = signal<{ branchId: string | null; companyId: string }>({ branchId, companyId });
    submit = vi.fn<BulkJobsTracker['submit']>().mockResolvedValue(result);
    tracker = { submit, hasActive: () => false } as unknown as BulkJobsTracker;
    TestBed.configureTestingModule({ providers: [
      { provide: TenantScopeState, useValue: {
        selection: branch, branchCompanies: () => new Map([[branchId, companyId]]),
        me: () => ({ id: ownerId, email: 'a@example.test', firstName: 'A', lastName: 'user', workspace: { timezone: 'Africa/Cairo', defaultLanguage: 'en' } }),
      } },
      { provide: Notify, useValue: notify }, { provide: BulkJobsTracker, useValue: tracker },
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true }, loader: BulkTranslations }),
    ] });
    t = TestBed.inject(TranslocoService);
    t.setTranslation({ ...translations[lang], oppBulk: translations[`opportunity-bulk/${lang}`],
      recordBulk: translations[`record-bulk/${lang}`], opportunities: translations[`opportunities/${lang}`] }, lang);
    transport = new BulkTransport();
    disposeHttp = bindCrmHttpForTest(transport);
    disposeRuntime = bindCrmInjectorForTest(() => TestBed.inject(EnvironmentInjector));
  });
  afterEach(async () => {
    TestBed.resetTestingModule();
    await vi.advanceTimersByTimeAsync(300);
    disposeHttp(); disposeRuntime(); crmQueries().clear();
    vi.useRealTimers(); vi.restoreAllMocks(); localStorage.removeItem('lang');
    for (const name of ['showModal', 'close']) {
      const descriptor = dialogMethods[name];
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    }
    ['lang', 'dir', 'data-theme'].forEach((key, index) => attrs[index] === null
      ? document.documentElement.removeAttribute(key) : document.documentElement.setAttribute(key, attrs[index]!));
  });
  async function settle(render: () => void = () => undefined) {
    for (let index = 0; index < 4; index++) { render(); await vi.advanceTimersByTimeAsync(1); }
    render();
  }

  describe('OpportunityBulk', () => {
    it('submit', async () => {
      const actions = [
        buildAssignBulkJob(branchId, selection, { ownerUserId: ownerId }),
        buildMoveStageBulkJob(branchId, selection, moveStageParamsFor({ id: 'lost', flag: 'LOST' }, 'pipeline', '', 'Price')),
        buildDeleteBulkJob(branchId, selection, { reason: 'Duplicate' }),
        buildCreateActivityBulkJob(branchId, selection, { activity: { type: 'TODO', subject: 'Call', durationMinutes: null },
          schedule: toWireActivitySchedule({ startAt: '2027-01-01T12:00:00Z', gapMinutes: 15, order: 'table', assigneeMode: 'me', spacePerAssignee: false }) }),
      ];
      for (const body of actions) {
        await new OpportunityBulkSubmission().submit(tracker, body);
        expect(submit).toHaveBeenLastCalledWith('crm', body, { idempotencyKey: expect.stringMatching(/^[\da-f-]{14}7[\da-f-]{21}$/i) });
        // NONE: the only tracker option is the key. Branch scope stays inside the submitted body.
        expect(Object.keys(submit.mock.calls.at(-1)?.[2] ?? {})).toEqual(['idempotencyKey']);
      }
    });

    it('branch pre-check', async () => {
      for (const query of [{ branchId: 'another' }, {}, { search: { branchId } }]) {
        const body = buildDeleteBulkJob(branchId, { kind: 'QUERY', query });
        await expect(new OpportunityBulkSubmission().submit(tracker, body)).rejects.toMatchObject({ code: 'BRANCH_SCOPE_MISMATCH' });
      }
      await expect(new OpportunityBulkSubmission().submit(tracker, buildDeleteBulkJob('', selection))).rejects.toMatchObject({ code: 'BRANCH_SCOPE_MISMATCH' });
      expect(submit).not.toHaveBeenCalled();
      const query = toBulkQuery({ branchId, page: 2, sort: 'title:ASC', filterTree: { field: 'title', operator: 'contains', value: 'Office' } });
      const body = buildDeleteBulkJob(branchId, { kind: 'QUERY', query, excludedIds: [ownerId] });
      await new OpportunityBulkSubmission().submit(tracker, body);
      expect(submit.mock.calls[0][1].selection).toEqual({ kind: 'QUERY', query, excludedIds: [ownerId] });
    });

    it('pipeline mismatch skipped', async () => {
      const response = { ...result, skippedAtSubmit: 1 };
      submit.mockResolvedValueOnce(response);
      const body = buildMoveStageBulkJob(branchId, selection, { pipelineId: 'pipeline', stageId: 'new' });
      expect(await new OpportunityBulkSubmission().submit(tracker, body)).toEqual(response);
      const item = { entityId: id, status: 'SKIPPED', code: 'OPPORTUNITY_PIPELINE_MISMATCH', current: { pipelineId: 'another' } } as unknown as BulkJobItem;
      expect(CRM_OPPORTUNITIES_BULK_MODULE.codeKeyPrefixes).toContain('oppBulk.codes.');
      expect(t.translate(`oppBulk.codes.${item.code}`)).toBe(translations[`opportunity-bulk/${lang}`]['codes']['OPPORTUNITY_PIPELINE_MISMATCH']);
      expect(CRM_OPPORTUNITIES_BULK_MODULE.itemLink?.(item, { action: 'MOVE_STAGE' } as BulkJob)).toEqual({ commands: ['/crm/opportunities', id] });
      expect(CRM_OPPORTUNITIES_BULK_MODULE.retryOverrides?.({ action: 'CREATE_ACTIVITY' } as BulkJob)).toBe('START_AT');
    });

    it.each([new ApiError(0, 'NETWORK_ERROR'), new ApiError(503, 'SERVER_ERROR'), new ApiError(409, 'GW.IDEM.IN_FLIGHT'), new ApiError(401, 'SESSION')])('retains the body/key after $code', async (error) => {
      const state = new OpportunityBulkSubmission();
      const body = buildAssignBulkJob(branchId, selection, { ownerUserId: ownerId });
      submit.mockRejectedValueOnce(error);
      await expect(state.submit(tracker, body)).rejects.toBe(error);
      await state.submit(tracker, structuredClone(body));
      expect(submit.mock.calls[0][2]?.idempotencyKey).toBe(submit.mock.calls[1][2]?.idempotencyKey);
      await state.submit(tracker, body);
      expect(submit.mock.calls[2][2]?.idempotencyKey).not.toBe(submit.mock.calls[1][2]?.idempotencyKey);
    });

    it('uses a new key after an edit and never resends a mismatch even after reopening', async () => {
      const state = new OpportunityBulkSubmission();
      const body = buildDeleteBulkJob(branchId, selection);
      submit.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
      await expect(state.submit(tracker, body)).rejects.toMatchObject({ status: 0 });
      submit.mockRejectedValueOnce(new ApiError(422, 'GW.IDEM.MISMATCH'));
      await expect(state.submit(tracker, { ...body, params: { reason: 'Edited' } })).rejects.toMatchObject({ code: 'GW.IDEM.MISMATCH' });
      expect(submit.mock.calls[1][2]?.idempotencyKey).not.toBe(submit.mock.calls[0][2]?.idempotencyKey);
      state.reset();
      await expect(state.submit(tracker, body)).rejects.toMatchObject({ code: 'GW.IDEM.MISMATCH' });
      expect(submit).toHaveBeenCalledTimes(2);
    });

    it.each(['CRM_OPPORTUNITIES_DISABLED', 'CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY'])('becomes read-only on %s', async (code) => {
      const state = new OpportunityBulkSubmission(); submit.mockRejectedValueOnce(new ApiError(403, code));
      await expect(state.submit(tracker, buildDeleteBulkJob(branchId, selection))).rejects.toMatchObject({ code });
      expect(state.readOnly()).toBe(true);
    });

    it('selection uses BRANCH_REQUIRED, a key, and no page', async () => {
      const input = { branchId, search: 'Office', sort: 'title:ASC', page: 7 };
      expect(await selectOpportunities(input, 10000)).toEqual({ items: [row], total: 1, truncated: false });
      expect(transport.recordedWrites()[0]).toMatchObject({ method: 'POST', path: '/opportunities/selection',
        body: { branchId, search: 'Office', sort: 'title:ASC', limit: 10000 }, options: { scope: { branchId, companyId }, key: expect.any(String) } });
      expect(transport.recordedWrites()[0].body).not.toHaveProperty('page');
      await expect(selectOpportunities({ branchId: 'another' })).rejects.toMatchObject({ status: 403 });
      branch.set({ companyId, branchId: null });
      await expect(selectOpportunities({ branchId })).rejects.toMatchObject({ status: 403 });
      expect(transport.recordedWrites()).toHaveLength(1);
    });

    it('loads owner cursor pages through XR-LK with BRANCH_REQUIRED and no fake fallback', async () => {
      transport.ownerCursor = 'next-owner';
      expect((await listBulkOpportunityOwners(branchId)).map((owner) => owner.id)).toEqual([ownerId, id]);
      const reads = transport.recordedReads();
      expect(reads).toHaveLength(2);
      for (const read of reads) {
        expect(read.scope).toEqual({ branchId, companyId });
        expect(read.query).toMatchObject({ branchId, resource: 'opportunities', action: 'update' });
      }
      expect(reads[1].query?.['cursor']).toBe('next-owner');
      branch.set({ companyId, branchId: null });
      expect(await listBulkOpportunityOwners(branchId)).toEqual([]);
      expect(transport.recordedReads()).toHaveLength(2);
    });

    it('caps selection and uses details.max and retry seconds in translated errors', async () => {
      transport.failure = new ApiError(422, 'OPPORTUNITY_SELECTION_TOO_LARGE', { max: ['10000'] });
      await expect(selectOpportunities({ branchId }, 10001)).rejects.toMatchObject({ code: 'OPPORTUNITY_SELECTION_TOO_LARGE' });
      for (const code of ['OPPORTUNITY_SELECTION_TOO_LARGE', 'BULK_SELECTION_TOO_LARGE']) {
        expect(opportunityBulkErrorMessage(t, new ApiError(422, code, { max: ['10000'] }))).toContain('10000');
      }
      expect(opportunityBulkErrorMessage(t, new ApiError(401, 'SESSION'))).toBe(t.translate('apiErrors.notSaved'));
      expect(opportunityBulkErrorMessage(t, new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['17'] }))).toContain('17');
    });

    it('select-all keeps QUERY filters and exclusions and truncation keeps explicit IDs', async () => {
      const store = TestBed.runInInjectionContext(() => new OpportunitySelection());
      await store.selectAllMatching({ branchId, search: 'Office' });
      store.toggle(row);
      expect(store.snapshot()).toEqual({ kind: 'QUERY', query: { branchId, search: 'Office' }, excludedIds: [id] });
      store.clear();
      transport.selectionResponse = { items: [row], total: 2, truncated: true };
      crmQueries().clear();
      await store.selectAllMatching({ branchId });
      expect(store.snapshot()).toEqual(selection);
      expect(store.truncated()).toBe(true);
    });

    it('renders all four modals with translated hints, submits actions and blocks a changed branch', async () => {
      for (const type of [OppBulkAssignModal, OppBulkStageModal, OppBulkDeleteModal, OppBulkActivityModal]) {
        const fixture = TestBed.createComponent<OppBulkAssignModal | OppBulkStageModal | OppBulkDeleteModal | OppBulkActivityModal>(type);
        fixture.detectChanges(); fixture.componentInstance.open([row]);
        await settle(() => fixture.detectChanges());
        const state = fixture.componentInstance as unknown as ModalState;
        if (type === OppBulkActivityModal) state.subject.set('Follow up');
        for (const field of fixture.nativeElement.querySelectorAll('ui-field')) {
          expect(field.querySelector('[id$="-hint"]')?.textContent.trim()).toBeTruthy();
          expect(field.textContent).not.toMatch(/(?:oppBulk|recordBulk|opportunities)\.[a-zA-Z]/);
        }
        await state.submit();
        expect(submit.mock.calls.at(-1)?.[1].module).toBe('crm.opportunities');
        expect(fixture.nativeElement.querySelector('fieldset')).not.toBeNull();
        fixture.componentInstance.open([row]); await settle(() => fixture.detectChanges());
        branch.set({ companyId, branchId: null }); fixture.detectChanges();
        const count = submit.mock.calls.length;
        await state.submit(); expect(submit).toHaveBeenCalledTimes(count);
        branch.set({ companyId, branchId }); fixture.destroy();
      }
    });

    it('keeps BULK_JOB_ACTIVE silent and puts past-start and validation errors under their fields', async () => {
      for (const type of [OppBulkAssignModal, OppBulkStageModal, OppBulkDeleteModal, OppBulkActivityModal]) {
        const fixture = TestBed.createComponent<OppBulkAssignModal | OppBulkStageModal | OppBulkDeleteModal | OppBulkActivityModal>(type); fixture.detectChanges();
        const state = fixture.componentInstance as unknown as ModalState;
        state.handleSubmitError(new ApiError(409, 'BULK_JOB_ACTIVE'));
        expect(notify.error).not.toHaveBeenCalled();
        if (type === OppBulkActivityModal) {
          state.handleSubmitError(new ApiError(422, 'OPPORTUNITY_BULK_START_IN_PAST'));
          expect(state.serverStartError()).toBe(t.translate('oppBulk.codes.OPPORTUNITY_BULK_START_IN_PAST'));
          state.handleSubmitError(new ApiError(400, 'CRM_VALIDATION_FAILED', { 'params.activity.subject': ['required'] }));
          expect(state.serverFieldErrors()['subject']).toBe(t.translate('apiErrors.validation'));
        } else if (type === OppBulkAssignModal) {
          state.handleSubmitError(new ApiError(400, 'CRM_VALIDATION_FAILED', { 'params.ownerUserId': ['required'] }));
          expect(state.serverOwnerError()).toBe(t.translate('apiErrors.validation'));
        } else if (type === OppBulkDeleteModal) {
          state.handleSubmitError(new ApiError(400, 'CRM_VALIDATION_FAILED', { 'params.reason': ['too_long'] }));
          expect(state.reasonError()).toBe(t.translate('apiErrors.validation'));
        }
        fixture.destroy();
      }
    });

    it('disables denied reason controls with the existing hint and blocks the required loss reason', async () => {
      transport.denied.add('/opportunities/reasons');
      const fixture = TestBed.createComponent(OppBulkStageModal); fixture.detectChanges();
      fixture.componentInstance.open([row]); await settle(() => fixture.detectChanges());
      const state = fixture.componentInstance as unknown as ModalState;
      state.selectedStageId.set('lost');
      fixture.detectChanges();
      expect(state.canSubmit?.()).toBe(false);
      expect(fixture.nativeElement.querySelector('ui-dropdown button').disabled).toBe(true);
      expect(fixture.nativeElement.textContent).toContain(t.translate('opportunities.search.listRestricted'));
      fixture.destroy();
    });

    it('hides bulk actions until capabilities allow them', async () => {
      const fixture = TestBed.createComponent(OpportunityBulkMenu); fixture.componentRef.setInput('count', 1);
      await settle(() => fixture.detectChanges());
      expect(fixture.nativeElement.querySelector('app-record-bulk-menu')).toBeNull(); fixture.destroy();
    });
  });
});
