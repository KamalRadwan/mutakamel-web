import arGlobal from '../../../../../../public/i18n/ar.json';
import arActivities from '../../../../../../public/i18n/activities/ar.json';
import arCallLog from '../../../../../../public/i18n/call-log/ar.json';
import arCrmModules from '../../../../../../public/i18n/crm-modules/ar.json';
import arDateRange from '../../../../../../public/i18n/date-range/ar.json';
import arGeo from '../../../../../../public/i18n/geo/ar.json';
import arOppForm from '../../../../../../public/i18n/opportunity-form/ar.json';
import arOppMoves from '../../../../../../public/i18n/opportunity-moves/ar.json';
import arOppPage from '../../../../../../public/i18n/opportunity-page/ar.json';
import arOpportunities from '../../../../../../public/i18n/opportunities/ar.json';
import arPartyCalls from '../../../../../../public/i18n/party-calls/ar.json';
import arRecordActivitiesTab from '../../../../../../public/i18n/record-activities-tab/ar.json';
import arRecordAttachments from '../../../../../../public/i18n/record-attachments/ar.json';
import arRecordFields from '../../../../../../public/i18n/record-fields/ar.json';
import arRecordForm from '../../../../../../public/i18n/record-form/ar.json';
import arRecordHistory from '../../../../../../public/i18n/record-history/ar.json';
import arRecordPage from '../../../../../../public/i18n/record-page/ar.json';
import arRecordRelated from '../../../../../../public/i18n/record-related/ar.json';
import arUiPagination from '../../../../../../public/i18n/ui-pagination/ar.json';
import arUiPhone from '../../../../../../public/i18n/ui-phone/ar.json';
import arUiTagPicker from '../../../../../../public/i18n/ui-tag-picker/ar.json';
import { Component, Injectable, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { type Translation, TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { defer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enGlobal from '../../../../../../public/i18n/en.json';
import enActivities from '../../../../../../public/i18n/activities/en.json';
import enCallLog from '../../../../../../public/i18n/call-log/en.json';
import enCrmModules from '../../../../../../public/i18n/crm-modules/en.json';
import enDateRange from '../../../../../../public/i18n/date-range/en.json';
import enGeo from '../../../../../../public/i18n/geo/en.json';
import enOppForm from '../../../../../../public/i18n/opportunity-form/en.json';
import enOppMoves from '../../../../../../public/i18n/opportunity-moves/en.json';
import enOppPage from '../../../../../../public/i18n/opportunity-page/en.json';
import enOpportunities from '../../../../../../public/i18n/opportunities/en.json';
import enPartyCalls from '../../../../../../public/i18n/party-calls/en.json';
import enRecordActivitiesTab from '../../../../../../public/i18n/record-activities-tab/en.json';
import enRecordAttachments from '../../../../../../public/i18n/record-attachments/en.json';
import enRecordFields from '../../../../../../public/i18n/record-fields/en.json';
import enRecordForm from '../../../../../../public/i18n/record-form/en.json';
import enRecordHistory from '../../../../../../public/i18n/record-history/en.json';
import enRecordPage from '../../../../../../public/i18n/record-page/en.json';
import enRecordRelated from '../../../../../../public/i18n/record-related/en.json';
import enUiPagination from '../../../../../../public/i18n/ui-pagination/en.json';
import enUiPhone from '../../../../../../public/i18n/ui-phone/en.json';
import enUiTagPicker from '../../../../../../public/i18n/ui-tag-picker/en.json';
import { type OpportunityRow, opportunityRef } from '../opportunities.model';
import type { OpportunityDraft } from '../opportunity-form/opportunity-draft';
import { OpportunityForm } from '../opportunity-form/opportunity-form';
import { OpportunityPage } from './opportunity-page';

/** OP-30008: seeded on branch b1 (Cairo HQ, company c1), amount 6,200 KWD, with seeded audit history. */
const OP_30008_ID = opportunityId;
const MISSING_ID = '0192b8ea-7c4f-7a7d-9c9f-51c7f2b3ffff';

const TRANSLATIONS: Record<string, Translation> = {
  en: enGlobal,
  'activities/en': enActivities,
  'call-log/en': enCallLog,
  'crm-modules/en': enCrmModules,
  'date-range/en': enDateRange,
  'geo/en': enGeo,
  'opportunities/en': enOpportunities,
  'opportunity-page/en': enOppPage,
  'opportunity-form/en': enOppForm,
  'opportunity-moves/en': enOppMoves,
  'party-calls/en': enPartyCalls,
  'record-activities-tab/en': enRecordActivitiesTab,
  'record-attachments/en': enRecordAttachments,
  'record-fields/en': enRecordFields,
  'record-form/en': enRecordForm,
  'record-history/en': enRecordHistory,
  'record-page/en': enRecordPage,
  'record-related/en': enRecordRelated,
  'ui-pagination/en': enUiPagination,
  'ui-phone/en': enUiPhone,
  'ui-tag-picker/en': enUiTagPicker,
  ar: arGlobal,
  'activities/ar': arActivities,
  'call-log/ar': arCallLog,
  'crm-modules/ar': arCrmModules,
  'date-range/ar': arDateRange,
  'geo/ar': arGeo,
  'opportunities/ar': arOpportunities,
  'opportunity-page/ar': arOppPage,
  'opportunity-form/ar': arOppForm,
  'opportunity-moves/ar': arOppMoves,
  'party-calls/ar': arPartyCalls,
  'record-activities-tab/ar': arRecordActivitiesTab,
  'record-attachments/ar': arRecordAttachments,
  'record-fields/ar': arRecordFields,
  'record-form/ar': arRecordForm,
  'record-history/ar': arRecordHistory,
  'record-page/ar': arRecordPage,
  'record-related/ar': arRecordRelated,
  'ui-pagination/ar': arUiPagination,
  'ui-phone/ar': arUiPhone,
  'ui-tag-picker/ar': arUiTagPicker,
};

/** Answers on a microtask, never synchronously (a synchronous loader triggers NG0600). */
@Injectable()
class AsyncTestLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return defer(() => Promise.resolve(TRANSLATIONS[path] ?? {}));
  }
}

@Component({ template: '' })
class StubPage {}

import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp } from '../../../../core/api/core-http';
import { Notify } from '../../../../core/notify/notify';
import { crmQueries } from '../../shared/crm-http';
import { OpportunityModal } from '../opportunity-modal/opportunity-modal';
import { OpportunityLookups } from '../opportunity-form/opportunity-lookups';
import { OpportunityStagesTab } from './opportunity-stages-tab/opportunity-stages-tab';
import enRecordModal from '../../../../../../public/i18n/record-modal/en.json';
import arRecordModal from '../../../../../../public/i18n/record-modal/ar.json';
import enOppModal from '../../../../../../public/i18n/opportunity-modal/en.json';
import arOppModal from '../../../../../../public/i18n/opportunity-modal/ar.json';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { bindRecordTest, branchId, companyId, opportunityId, OpportunityTransport, recordTestProviders } from './opportunity-test-support';

interface RecordState {
  detail: WritableSignal<OpportunityRow | null>;
  row: WritableSignal<OpportunityRow | null>;
  draft: WritableSignal<OpportunityDraft>;
  base: WritableSignal<OpportunityDraft>;
  updatedAt: WritableSignal<string | null>;
  loading(): boolean;
  showSkeleton(): boolean;
  loadFailed(): boolean;
  notFound(): boolean;
  canEdit(): boolean;
  canDelete(): boolean;
  canMove(): boolean;
  canTransfer(): boolean;
  conflictVisible(): boolean;
  serverErrors(): Record<string, string>;
  mode: WritableSignal<'create' | 'edit'>;
  capabilities: WritableSignal<unknown>;
  save(): Promise<boolean>;
  saveCreate(): Promise<boolean>;
  submitCreate(addAnother: boolean): Promise<boolean>;
  saveEdit(): Promise<boolean>;
  onFormDraftChange(draft: OpportunityDraft): void;
  resolveConflict(reload: boolean): void;
  retryLoad(): void;
  toastWriteError(error: unknown, fallback: string): void;
}

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('%s / %s', (lang, theme) => {
  describe('OpportunityPage', { timeout: 60000 }, () => {
    let harness: RouterTestingHarness;
    let transport: OpportunityTransport;
    let environment: ReturnType<typeof recordTestProviders>;
    let dispose: () => void;
    let originalAttributes: (string | null)[];

    beforeEach(() => {
      vi.useFakeTimers();
      originalAttributes = ['lang', 'dir', 'data-theme'].map((key) => document.documentElement.getAttribute(key));
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.dataset['theme'] = theme;
      localStorage.setItem('lang', lang);
      dialogProto['showModal'] = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
      dialogProto['close'] = function (this: HTMLDialogElement) { this.removeAttribute('open'); };
      transport = new OpportunityTransport();
      TRANSLATIONS['record-modal/en'] = enRecordModal;
      TRANSLATIONS['record-modal/ar'] = arRecordModal;
      TRANSLATIONS['opportunity-modal/en'] = enOppModal;
      TRANSLATIONS['opportunity-modal/ar'] = arOppModal;
      environment = recordTestProviders(transport);
      Object.assign(environment.core, { write: vi.fn().mockResolvedValue({ data: { items: [] } }) });
      TestBed.configureTestingModule({ providers: [
        ...environment.providers,
        { provide: CoreHttp, useValue: environment.core }, { provide: Notify, useValue: environment.notify },
        provideRouter([
          { path: 'crm/opportunities/new', component: OpportunityPage },
          { path: 'crm/opportunities/:id', component: OpportunityPage },
          { path: 'crm/opportunities', component: StubPage },
          { path: 'crm/leads', component: StubPage },
          { path: 'trade/documents/quotations', component: StubPage },
          { path: 'trade/documents/invoices', component: StubPage },
        ]),
        provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true, missingHandler: { logMissingKey: true } }, loader: AsyncTestLoader }),
      ] });
      TestBed.inject(TranslocoService).setTranslation(TRANSLATIONS[lang], lang);
      dispose = bindRecordTest(transport);
    });
    afterEach(async () => {
      TestBed.resetTestingModule();
      await vi.advanceTimersByTimeAsync(500);
      dispose();
      vi.useRealTimers();
      vi.restoreAllMocks();
      localStorage.removeItem('lang');
      dialogProto['showModal'] = originalDialog.showModal;
      dialogProto['close'] = originalDialog.close;
      ['lang', 'dir', 'data-theme'].forEach((key, index) => originalAttributes[index] === null ? document.documentElement.removeAttribute(key) : document.documentElement.setAttribute(key, originalAttributes[index]!));
    });

    async function settle<T>(promise: Promise<T>): Promise<T> {
      let done = false;
      const guarded = promise.finally(() => { done = true; });
      for (let i = 0; !done && i < 100; i++) await vi.advanceTimersByTimeAsync(20);
      return guarded;
    }
    async function drain() {
      for (let i = 0; i < 12; i++) { await vi.advanceTimersByTimeAsync(30); harness?.detectChanges(); }
    }
    async function open(id = opportunityId) {
      harness = await settle(RouterTestingHarness.create());
      const component = await settle(harness.navigateByUrl(`/crm/opportunities/${id}`, OpportunityPage));
      await drain();
      expect((component as unknown as RecordState).showSkeleton()).toBe(false);
      return component as unknown as RecordState;
    }
    const host = () => harness.routeNativeElement!;

    it('TradeCounts › shows counts', async () => {
      const write = vi.mocked(TestBed.inject(CoreHttp).write);
      write.mockResolvedValue({ status: 200, data: { items: [{ opportunityId, quotations: 3, salesOrders: 2 }] }, etag: null, location: null });
      await open();
      const badges = host().querySelector('app-record-related-badges')!;
      expect(badges.hasAttribute('hidden')).toBe(false);
      expect(badges.querySelector('[aria-label="' + (lang === 'en' ? 'Quotations' : 'عروض الأسعار') + ': 3"]')).not.toBeNull();
      expect(badges.querySelector('[aria-label="' + (lang === 'en' ? 'Sales orders' : 'أوامر البيع') + ': 2"]')).not.toBeNull();
      expect([...badges.querySelectorAll('bdi')].map((node) => [node.getAttribute('dir'), node.textContent?.trim()])).toEqual([['ltr', '3'], ['ltr', '2']]);
      expect(write).toHaveBeenCalledWith('POST', '/api/tenant/trade/v1/documents/counts-by-crm-opportunity', { opportunityIds: [opportunityId] }, { bare: true, key: expect.any(String) });
    });

    it('TradeCounts › no trade access', async () => {
      vi.mocked(TestBed.inject(CoreHttp).write).mockRejectedValue(new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
      await open();
      const badges = host().querySelector('app-record-related-badges')!;
      expect(badges.hasAttribute('hidden')).toBe(true);
      expect(badges.querySelector('bdi')).toBeNull();
      expect(badges.querySelector('ui-full-state')).toBeNull();
      expect(environment.notify.error).not.toHaveBeenCalled();
      expect(environment.notify.warning).not.toHaveBeenCalled();
    });

    it('load states', async () => {
      const state = await open();
      expect(state.detail()?.id).toBe(opportunityId);
      expect(host().textContent).toContain('Office equipment');
      expect(host().textContent).toContain(opportunityRef(opportunityId));
      expect(state.draft()).toMatchObject({ branchId, companyId, currencyCode: 'KWD', amount: '6200.00000000' });
      transport.readErrors.set(`/opportunities/${opportunityId}`, new ApiError(404, 'OPPORTUNITY_NOT_FOUND'));
      state.retryLoad(); await drain();
      expect(host().querySelector('ui-full-state')?.textContent).toContain(lang === 'en' ? enOppPage.notFound.text : arOppPage.notFound.text);
      transport.readErrors.set(`/opportunities/${opportunityId}`, new ApiError(503, 'SERVER_ERROR', undefined, { correlationId: 'correlation-1' }));
      state.retryLoad(); await drain();
      expect(state.loadFailed()).toBe(true);
      expect(host().querySelector('ui-full-state')?.textContent).toContain('correlation-1');
      transport.readErrors.clear(); state.retryLoad(); await drain();
      expect(state.loadFailed()).toBe(false);
    });

    it('own scope disables actions on others', async () => {
      const own = { scope: 'own' as const, ownerUserIds: ['someone-else'] };
      transport.caps = { ...transport.caps, update: own, delete: own, move: own, transfer: own };
      const state = await open();
      expect([state.canEdit(), state.canDelete(), state.canMove(), state.canTransfer()]).toEqual([false, false, false, false]);
    });

    it('patch conflict', async () => {
      const state = await open();
      const initial = structuredClone(state.draft());
      state.onFormDraftChange({ ...state.draft(), title: 'My title' });
      transport.row = { ...transport.row, description: 'Concurrent edit', updatedAt: '2026-11-22T12:00:00.000Z' };
      const pending = state.saveEdit(); await drain();
      expect(state.conflictVisible()).toBe(true);
      expect(host().querySelector('ui-conflict-dialog dialog[open]')).not.toBeNull();
      state.resolveConflict(false); await settle(pending); await drain();
      expect(state.draft()).toEqual({ ...initial, title: 'My title' });
      expect(state.updatedAt()).toBe(transport.row.updatedAt);
      await state.saveEdit();
      expect(transport.row.title).toBe('My title');
      expect(transport.row.description).toBe('Concurrent edit');
      expect(transport.recordedWrites()[0].body).toMatchObject({ expectedUpdatedAt: initial ? '2026-11-21T12:00:00.000Z' : '', title: 'My title' });
    });

    it('reloads a conflict and discards changes', async () => {
      const state = await open();
      state.onFormDraftChange({ ...state.draft(), title: 'Discard me' });
      transport.row = { ...transport.row, title: 'Server title', updatedAt: '2026-11-22T12:00:00.000Z' };
      const pending = state.saveEdit(); await drain(); state.resolveConflict(true); await settle(pending); await drain();
      expect(state.draft().title).toBe('Server title');
    });

    it('module off', async () => {
      const state = await open();
      state.onFormDraftChange({ ...state.draft(), title: 'Preserved' });
      transport.writeErrors.push(new ApiError(403, 'CRM_OPPORTUNITIES_DISABLED'));
      await state.saveEdit(); await drain();
      expect(state.canEdit()).toBe(false);
      expect(state.draft().title).toBe('Preserved');
      expect(TestBed.inject(Router).url).toBe(`/crm/opportunities/${opportunityId}`);
    });

    it('shows branch guidance without record requests', async () => {
      environment.me.update((me) => ({ ...me, accessibleBranches: [], accessibleBranchCompanies: [] }));
      await open();
      expect(transport.recordedReads()).toEqual([]);
      expect(host().textContent).toContain(lang === 'en' ? enOppForm.lookups.chooseBranch : arOppForm.lookups.chooseBranch);
    });

    it('keeps tab panels mounted and updates the URL', async () => {
      await open();
      for (const tab of ['stages', 'history', 'attachments', 'activities', 'overview']) {
        host().querySelector<HTMLButtonElement>(`[role="tab"][id$="-tab-${tab}"]`)!.click(); await drain();
        expect(host().querySelector(`[role="tabpanel"][id$="-panel-${tab}"]`)).not.toBeNull();
      }
      expect(host().querySelector('app-opportunity-stages-tab')).not.toBeNull();
    });

    it('keeps hints linked and translations present', async () => {
      await open();
      const fields = host().querySelectorAll('ui-field');
      expect(fields.length).toBeGreaterThan(5);
      for (const field of fields) {
        const hint = field.querySelector('[role="tooltip"]');
        expect(hint?.textContent?.trim()).toBeTruthy();
        const label = field.querySelector('label');
        const input = label?.htmlFor ? document.getElementById(label.htmlFor) : null;
        const control = input?.matches('input,textarea,button') ? input : input?.querySelector('input,textarea,button[aria-describedby]');
        if (control && hint) expect(control.getAttribute('aria-describedby'), label?.textContent ?? '').toContain(hint.id);
      }
      expect(host().textContent).not.toMatch(/oppForm\.|oppPage\./);
    });

    it('OpportunityForm › create mismatch never resends', async () => {
      const state = await open('new');
      state.draft.update((draft) => ({ ...draft, title: 'New deal', customerProfileId: 'customer', pipelineId: 'pipeline', stageId: 'new' }));
      transport.writeErrors.push(new ApiError(409, 'OPPORTUNITY_CREATE_IDEMPOTENCY_MISMATCH'));
      await state.saveCreate(); await drain();
      expect(state.canEdit()).toBe(false);
      expect(await state.save()).toBe(false);
      expect(transport.recordedWrites()).toHaveLength(1);
    });

    it('OpportunityForm › tags after create', async () => {
      const state = await open('new');
      state.draft.update((draft) => ({ ...draft, title: 'New deal', customerProfileId: 'customer', pipelineId: 'pipeline', stageId: 'new', tagIds: ['tag-1'] }));
      const pending = state.saveCreate(); await drain(); await settle(pending); await drain();
      expect(transport.recordedWrites().map((write) => write.path)).toEqual(['/opportunities', `/opportunities/${opportunityId}/tags`]);
      expect(transport.recordedWrites()[0].body).not.toHaveProperty('tagIds');
      expect(TestBed.inject(Router).url).toBe(`/crm/opportunities/${opportunityId}`);
    });

    it('preserves the created record when follow-up tags fail', async () => {
      const state = await open('new');
      state.draft.update((draft) => ({ ...draft, title: 'Saved deal', customerProfileId: 'customer', pipelineId: 'pipeline', stageId: 'new', tagIds: ['tag-1'] }));
      transport.writeErrorsByPath.set(`/opportunities/${opportunityId}/tags`, new ApiError(422, 'CRM_TAG_UNKNOWN'));
      const pending = state.saveCreate(); await drain(); await settle(pending); await drain();
      expect(environment.notify.warning).toHaveBeenCalledWith(lang === 'en' ? enOppForm.savedWithoutTags : arOppForm.savedWithoutTags);
      expect(transport.recordedWrites().filter((write) => write.path === '/opportunities')).toHaveLength(1);
      expect(TestBed.inject(Router).url).toBe(`/crm/opportunities/${opportunityId}`);
    });

    it('stage history', async () => {
      transport.history = { items: [{ id: 'history', fromStageId: null, toStageId: 'new', fromStatus: null, toStatus: 'IN_PROGRESS', changedAt: '2026-11-21T12:00:00.000Z', changedByUserId: 'unresolved', reason: null, fromStageSnapshot: null, toStageSnapshot: null }], nextCursor: 'next' };
      await open();
      host().querySelector<HTMLButtonElement>('[role="tab"][id$="-tab-stages"]')!.click(); await drain();
      const tab = harness.fixture.debugElement.query(By.directive(OpportunityStagesTab)).componentInstance as {
        loadMore(): Promise<void>; retry(): void; nextCursor(): string | null; loadFailed(): boolean;
      };
      expect(host().querySelector('app-opportunity-stages-tab')?.textContent).toContain(lang === 'en' ? enOppPage.stages.unknownUser : arOppPage.stages.unknownUser);
      transport.historyCursorError = new ApiError(422, 'OPPORTUNITY_HISTORY_CURSOR_INVALID');
      await tab.loadMore(); await drain();
      expect(transport.recordedReads().at(-1)?.query).toEqual({ limit: 100, cursor: null });
      transport.readErrors.set(`/opportunities/${opportunityId}/stage-history`, new ApiError(422, 'OPPORTUNITY_HISTORY_INTEGRITY_INVALID'));
      tab.retry(); await drain();
      expect(tab.loadFailed()).toBe(true);
      expect(host().querySelector('app-opportunity-stages-tab ui-full-state')).not.toBeNull();
    });

    it('trade no access', async () => {
      await open();
      const errorCount = environment.notify.error.mock.calls.length;
      environment.core.read.mockRejectedValue(new ApiError(403, 'FORBIDDEN'));
      host().querySelector<HTMLButtonElement>('[role="tab"][id$="-tab-quotations"]')!.click(); await drain();
      expect(host().querySelector('app-opportunity-quotations-tab')?.textContent).toContain(lang === 'en' ? enOppPage.quotations.denied.title : arOppPage.quotations.denied.title);
      expect(host().querySelector('app-record-related-badges')?.hasAttribute('hidden')).toBe(true);
      expect(environment.notify.error.mock.calls.length).toBe(errorCount);
    });

    it('disables the customer picker and Create without customer access', async () => {
      bindAnalyticsPermissions(() => ['crm.opportunities.read.all']);
      const state = await open('new');
      const picker = host().querySelector('app-opportunity-customer-picker input') as HTMLInputElement;
      expect(picker.disabled).toBe(true);
      expect(host().textContent).toContain(lang === 'en' ? enOppForm.lookups.denied : arOppForm.lookups.denied);
      expect(await state.save()).toBe(false);
      expect(transport.recordedWrites()).toEqual([]);
    });

    it('quick modal shows four customer-related links and navigates with the party filter', async () => {
      const fixture = TestBed.createComponent(OpportunityModal);
      fixture.detectChanges();
      await fixture.componentInstance.openRecord(opportunityId, null);
      for (let index = 0; index < 12; index++) {
        await vi.advanceTimersByTimeAsync(30);
        fixture.detectChanges();
      }
      const header = fixture.nativeElement.querySelector('app-record-modal-header') as HTMLElement;
      const links = [...header.querySelectorAll<HTMLAnchorElement>('app-record-related-badges a')];
      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        '/crm/leads?partyId=party&partyLabel=Acme',
        '/crm/opportunities?customerPartyId=party&partyLabel=Acme',
        '/trade/documents/quotations?partyId=party',
        '/trade/documents/invoices?partyId=party',
      ]);
      expect(links.map((link) => link.querySelector('bdi')?.textContent)).toEqual(['2', '3', '4', '5']);
      expect(transport.recordedWrites()).toContainEqual(expect.objectContaining({
        path: '/related-records/counts',
        body: { branchId, recordType: 'CUSTOMER_PROFILE', recordIds: [transport.row.customerProfileId] },
      }));
      links[3].click();
      await vi.advanceTimersByTimeAsync(30);
      fixture.detectChanges();
      expect(TestBed.inject(Router).url).toBe('/trade/documents/invoices?partyId=party');
      expect(fixture.nativeElement.querySelector('dialog[open]')).toBeNull();
    });

    it('quick modal keeps edits and refreshes only the stale token', async () => {
      const fixture = TestBed.createComponent(OpportunityModal);
      fixture.detectChanges();
      await fixture.componentInstance.openRecord(opportunityId, null);
      for (let index = 0; index < 12; index++) { await vi.advanceTimersByTimeAsync(30); fixture.detectChanges(); }
      const state = fixture.componentInstance as unknown as RecordState & { submitEdit(): Promise<boolean> };
      expect(state.canEdit()).toBe(true);
      state.onFormDraftChange({ ...state.draft(), title: 'Modal edit' });
      transport.row = { ...transport.row, description: 'Server edit', updatedAt: '2026-11-22T12:00:00.000Z' };
      const pending = state.submitEdit();
      for (let index = 0; index < 8; index++) { await vi.advanceTimersByTimeAsync(30); fixture.detectChanges(); }
      expect(state.conflictVisible()).toBe(true);
      state.resolveConflict(false); await settle(pending); fixture.detectChanges();
      expect(state.draft().title).toBe('Modal edit');
      expect(state.draft().description).toBe('');
      expect(state.updatedAt()).toBe(transport.row.updatedAt);
      expect(state.row()?.updatedAt).toBe(transport.row.updatedAt);
    });

    it('quick modal shows the unavailable state for a hidden record', async () => {
      transport.readErrors.set(`/opportunities/${opportunityId}`, new ApiError(404, 'OPPORTUNITY_NOT_FOUND'));
      const fixture = TestBed.createComponent(OpportunityModal);
      fixture.detectChanges();
      await fixture.componentInstance.openRecord(opportunityId, null);
      for (let index = 0; index < 12; index++) { await vi.advanceTimersByTimeAsync(30); fixture.detectChanges(); }
      expect((fixture.componentInstance as unknown as RecordState).canEdit()).toBe(false);
      expect(fixture.nativeElement.querySelector('ui-full-state')?.textContent).toContain(lang === 'en' ? 'This opportunity is not available' : 'هذه الفرصة غير متاحة');
    });
  });
});
