import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, convertToParamMap, ActivatedRoute, RedirectCommand, type CanActivateFn } from '@angular/router';
import { provideTransloco, TranslocoService, TRANSLOCO_LOADER } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../public/i18n/en.json';
import ar from '../../../../../../public/i18n/ar.json';
import schedulesEn from '../../../../../../public/i18n/crm-rep-schedules/en.json';
import schedulesAr from '../../../../../../public/i18n/crm-rep-schedules/ar.json';
import exportsEn from '../../../../../../public/i18n/crm-rep-exports/en.json';
import exportsAr from '../../../../../../public/i18n/crm-rep-exports/ar.json';
import analyticsEn from '../../../../../../public/i18n/analytics/en.json';
import analyticsAr from '../../../../../../public/i18n/analytics/ar.json';
import chartEn from '../../../../../../public/i18n/chart/en.json';
import chartAr from '../../../../../../public/i18n/chart/ar.json';
import recordEn from '../../../../../../public/i18n/record-page/en.json';
import recordAr from '../../../../../../public/i18n/record-page/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { CurrentUser } from '../../../../core/auth/current-user';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { OrgApi } from '../../../../shared/widgets/dashboard/org.api';
import type { Export } from '../../../../shared/widgets/dashboard/exports/exports.model';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { reportsRoutes } from '../reports.routes';
import { ExportsPage } from '../exports/exports-page/exports-page';
import { ScheduleModal } from './schedule-modal/schedule-modal';
import { SchedulesPage } from './schedules-page/schedules-page';
import type { Subscription } from './schedules.model';
import { createSubscription, deleteSubscription, disableSubscription, enableSubscription, getSubscription,
  listDeliveries, listSubscriptions, resumeSubscription, updateSubscription } from './schedules.api';

const sub: Subscription = {
  id: '01934b10-0000-7000-8000-000000001001', name: 'Daily digest', ownerUserId: 'user-1', enabled: false,
  suspendedReason: 'OWNER_ACCESS_LOST', dashboardId: 'dashboard-1', reportKey: null, periodToken: 'PREVIOUS_DAY',
  filters: {}, locale: 'en', recurrence: 'DAILY', scheduleWeekday: null, scheduleMonthDay: null,
  scheduleMinute: 540, timeZone: 'UTC', startsOn: '2026-11-23', endsOn: null, recipients: ['user-1'],
  attachmentFormats: [], linkTtlHours: 168, nextRunAt: null, lastRunAt: null, revision: 2,
  createdAt: '2026-11-23T00:00:00Z', updatedAt: '2026-11-23T00:00:00Z',
};
const exportRow: Export = { id: 'export-1', origin: 'USER', dashboardId: 'dashboard-1', reportKey: null,
  format: 'CSV', locale: 'en', status: 'QUEUED', rowCount: null, pageCount: null, byteSize: null,
  failureCode: null, queuedAt: '2026-11-23T00:00:00Z', completedAt: null, expiresAt: null, revision: 2 };
const capabilities = { formats: [{ format: 'PDF', available: false, reason: 'PDF_RENDERER_UNAVAILABLE' }] };
const pageInfo = { limit: 20, hasMore: false, nextCursor: null };
const user = { id: 'user-1', name: 'Recipient', nameAr: 'المستلم', email: 'recipient@example.test', teamId: '', branchId: '' };
const VIEWS = [['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']] as const;

describe.each(VIEWS)('RP-2 (%s / %s)', (language, theme) => {
  let fixture: ComponentFixture<ScheduleModal | SchedulesPage | ExportsPage> | undefined;
  let stub: CrmHttpStub;
  let dispose: (() => void) | undefined;
  let originalAttributes: { lang: string; dir: string; theme: string | null };
  const notify = { success: vi.fn(), error: vi.fn() };
  const texts = language === 'ar' ? schedulesAr : schedulesEn;
  beforeEach(() => {
    originalAttributes = { lang: document.documentElement.lang, dir: document.documentElement.dir,
      theme: document.documentElement.getAttribute('data-theme') };
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };
    vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    });
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
    bindAnalyticsPermissions(() => ['crm.subscriptions.manage', 'crm.exports.create', 'crm.dashboards.read.all']);
    stub = new CrmHttpStub({
      '/analytics/subscriptions': { items: [structuredClone(sub)], pageInfo, capabilities },
      [`/analytics/subscriptions/${sub.id}`]: { ...sub, revision: 3 },
      [`/analytics/subscriptions/${sub.id}/deliveries`]: { items: [], pageInfo },
      '/analytics/exports': { items: [exportRow], pageInfo, capabilities },
      '/analytics/exports/export-1': { ...exportRow, revision: 3 },
      '/dashboards': { items: [{ id: 'dashboard-1', name: 'Dashboard' }], nextCursor: null },
      '/dashboards/reports/catalogue': { items: [], pageInfo },
    });
    dispose = bindCrmHttpForTest(stub);
    crmQueries().clear();
    const global = language === 'ar' ? ar : en;
    const scoped = {
      repSchedules: texts, repExports: language === 'ar' ? exportsAr : exportsEn,
      analytics: language === 'ar' ? analyticsAr : analyticsEn,
      chart: language === 'ar' ? chartAr : chartEn, recordPage: language === 'ar' ? recordAr : recordEn,
    };
    const scopes: Record<string, unknown> = { 'crm-rep-schedules': scoped.repSchedules, 'crm-rep-exports': scoped.repExports,
      analytics: scoped.analytics, chart: scoped.chart, 'record-page': scoped.recordPage };
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: language, prodMode: false } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: (path: string) => of(scopes[path.split('/')[0]] ?? global) } },
      { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
      { provide: LanguageState, useValue: { current: signal(language) } },
      { provide: Notify, useValue: notify },
      { provide: TenantScopeState, useValue: { me: signal({ id: 'user-1', workspace: {}, isTenantOwner: false,
        permissions: [], permissionScopes: {}, accessibleBranchCompanies: [] }) } },
      { provide: CurrentUser, useValue: { user: signal({ id: 'user-1', timeZone: 'Asia/Dubai' }) } },
      { provide: OrgApi, useValue: { listUsers: vi.fn().mockResolvedValue([user]), getUser: vi.fn().mockResolvedValue(user) } },
    ] });
    TestBed.inject(TranslocoService).setTranslation({ ...global, ...scoped }, language);
  });
  afterEach(() => {
    fixture?.destroy(); fixture = undefined;
    dispose?.(); crmQueries().clear(); bindAnalyticsPermissions(() => []);
    vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks();
    document.documentElement.lang = originalAttributes.lang;
    document.documentElement.dir = originalAttributes.dir;
    if (originalAttributes.theme === null) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', originalAttributes.theme);
  });
  async function modal() {
    const result = TestBed.createComponent(ScheduleModal); fixture = result;
    result.detectChanges(); await result.whenStable();
    result.componentInstance.openCreate({ dashboardId: 'dashboard-1' });
    result.detectChanges(); await result.whenStable();
    result.componentInstance['name'].set('Daily digest');
    return result;
  }

  describe('ScheduleModal', () => {
    it('create', async () => {
      const result = await modal(); const component = result.componentInstance;
      component['attachmentFormats'].set(['CSV']); component['linkTtlHoursText'].set('169');
      expect(await component['save']()).toBe(false);
      expect(stub.recordedWrites()).toHaveLength(0);
      expect(component['fieldErrors']().linkTtlHours).toBe(texts.validation.TTL_ATTACHMENT_LIMIT);
      result.detectChanges();
      for (const input of Array.from((result.nativeElement as HTMLElement).querySelectorAll('input[aria-describedby]'))) {
        const ids = input.getAttribute('aria-describedby')!.split(' ');
        expect(ids.some((id) => id.endsWith('-hint'))).toBe(true);
      }
      component['linkTtlHoursText'].set('168');
      expect(await component['save']()).toBe(true);
      expect(stub.recordedWrites()[0]).toMatchObject({ method: 'POST', path: '/analytics/subscriptions',
        body: { recipients: ['user-1'], timeZone: 'Asia/Dubai', linkTtlHours: 168, attachmentFormats: ['CSV'] },
        options: { key: expect.stringMatching(/^[0-9a-f-]{36}$/) } });
      expect(stub.recordedWrites()[0].options.scope).toBeUndefined();
    });
    it('keeps the create body and key after network failure, rotates them after edits', async () => {
      const result = await modal(); const component = result.componentInstance;
      const original = stub.write.bind(stub);
      const write = vi.spyOn(stub, 'write').mockImplementationOnce(async (...args) => {
        await original(...args); throw new ApiError(0, 'NETWORK');
      });
      expect(await component['save']()).toBe(false);
      write.mockImplementationOnce(async (...args) => { await original(...args); throw new ApiError(503, 'GENERIC'); });
      expect(await component['save']()).toBe(false);
      const writes = stub.recordedWrites(); expect(writes[1]).toEqual(writes[0]);
      component['name'].set('Changed digest');
      await component['save']();
      expect(stub.recordedWrites()[2].options.key).not.toBe(writes[0].options.key);
    });
    it('keeps edits and reloads only the revision after a stale write', async () => {
      const result = await modal(); const component = result.componentInstance;
      component.openEdit(sub); component['name'].set('My change');
      vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'CRM_SUBSCRIPTION_REVISION_STALE'));
      expect(await component['save']()).toBe(false);
      result.detectChanges();
      expect(result.debugElement.query(By.directive(ConflictDialog)).componentInstance.open()).toBe(true);
      await component['resolveConflict'](false);
      expect(component['name']()).toBe('My change'); expect(component['currentRevision']()).toBe(3);
    });
    it('keeps 401 unsaved, maps validation paths, locks read-only and mismatched writes', async () => {
      const result = await modal(); const component = result.componentInstance;
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(401, 'SESSION'));
      await component['save'](); expect(notify.error).toHaveBeenCalledWith(texts.writeErrors.notSaved);
      write.mockRejectedValueOnce(new ApiError(400, 'CRM_VALIDATION_FAILED', { recipients: ['invalid'] }));
      await component['save'](); expect(component['serverErrors']().recipientUserIds).toBeTruthy();
      write.mockRejectedValueOnce(new ApiError(403, 'SEAT_OVER_CAPACITY_READ_ONLY'));
      await component['save'](); expect(component['editable']()).toBe(false);
      component.openCreate({ dashboardId: 'dashboard-1' }); component['name'].set('Retry');
      write.mockRejectedValueOnce(new ApiError(409, 'GW.IDEM.MISMATCH'));
      await component['save'](); expect(component['editable']()).toBe(false);
      expect(notify.error).toHaveBeenCalledWith(texts.writeErrors.reloadRequired);
      const calls = write.mock.calls.length; await component['save'](); expect(write).toHaveBeenCalledTimes(calls);
    });
  });

  describe('SchedulesPage', () => {
    it('resume', async () => {
      const result = TestBed.createComponent(SchedulesPage); fixture = result;
      result.detectChanges(); await result.whenStable();
      expect(result.componentInstance['stateKey'](sub)).toBe('SUSPENDED');
      expect(result.componentInstance['rowActionsFor'](sub).some((item) => item.id === 'resume')).toBe(true);
      result.componentInstance['onRowAction'](sub, { id: 'resume' });
      await result.whenStable();
      expect(stub.recordedWrites()[0]).toMatchObject({ method: 'POST', path: `/analytics/subscriptions/${sub.id}/resume`,
        body: { revision: 2 }, options: { key: expect.any(String), ifMatch: `"subscription:${sub.id}:2"` } });
      expect(stub.recordedWrites()[0].options.scope).toBeUndefined();
    });
    it('does not read schedules or targets without the key', async () => {
      bindAnalyticsPermissions(() => []); const read = vi.spyOn(stub, 'read');
      const result = TestBed.createComponent(SchedulesPage); fixture = result;
      result.detectChanges(); await result.whenStable();
      expect(read).not.toHaveBeenCalled();
      expect(result.debugElement.query(By.directive(FullState)).componentInstance.kind()).toBe('forbidden');
    });
  });

  describe('ExportsPage', () => {
    it('refresh only on demand', async () => {
      const read = vi.spyOn(stub, 'read'); const result = TestBed.createComponent(ExportsPage); fixture = result;
      result.detectChanges(); await result.whenStable(); expect(read).toHaveBeenCalledTimes(1);
      vi.useFakeTimers(); await vi.advanceTimersByTimeAsync(30000); expect(read).toHaveBeenCalledTimes(1);
      vi.useRealTimers(); await result.componentInstance['load'](); expect(read).toHaveBeenCalledTimes(2);
    });
    it('shows a stale cancel conflict and reloads its revision without resending', async () => {
      const result = TestBed.createComponent(ExportsPage); fixture = result;
      result.detectChanges(); await result.whenStable();
      const confirm = result.debugElement.query(By.directive(ConfirmDialog)).componentInstance as ConfirmDialog;
      vi.spyOn(confirm, 'open').mockResolvedValue(true);
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'CRM_EXPORT_REVISION_STALE'));
      await result.componentInstance['requestCancel'](exportRow); result.detectChanges();
      expect(result.debugElement.query(By.directive(ConflictDialog)).componentInstance.open()).toBe(true);
      expect(write.mock.calls[0][3]).toMatchObject({ key: expect.any(String), ifMatch: '"export:export-1:2"' });
      expect(write.mock.calls[0][3].scope).toBeUndefined();
      await result.componentInstance['resolveConflict'](); expect(result.componentInstance['exports']()[0].revision).toBe(3);
      expect(write).toHaveBeenCalledTimes(1);
    });
    it('shows read failures with their correlation id and retries on demand', async () => {
      const read = vi.spyOn(stub, 'read').mockRejectedValueOnce(new ApiError(503, 'GENERIC', undefined,
        { correlationId: 'rp2-correlation' }));
      const result = TestBed.createComponent(ExportsPage); fixture = result;
      result.detectChanges(); await result.whenStable(); result.detectChanges();
      await vi.waitFor(() => { result.detectChanges(); expect(result.componentInstance['loadError']()).toBe('load-failure'); });
      const state = result.debugElement.query(By.directive(FullState)).componentInstance as FullState;
      expect(state.kind()).toBe('load-failure'); expect(state.text()).toContain('rp2-correlation');
      await result.componentInstance['load'](); expect(read).toHaveBeenCalledTimes(2);
    });
    it('does not read exports without the key', async () => {
      bindAnalyticsPermissions(() => []); const read = vi.spyOn(stub, 'read');
      const result = TestBed.createComponent(ExportsPage); fixture = result;
      result.detectChanges(); await result.whenStable(); expect(read).not.toHaveBeenCalled();
      expect(result.debugElement.query(By.directive(FullState)).componentInstance.kind()).toBe('forbidden');
    });
  });

  describe('Reports routes', () => {
    it('schedules and exports need keys', async () => {
      for (const path of ['schedules', 'exports']) {
        const route = reportsRoutes.find((item) => item.path === path)!;
        const guard = route.canActivate![0] as CanActivateFn;
        bindAnalyticsPermissions(() => []);
        const blocked = TestBed.runInInjectionContext(() => guard({} as never, {} as never));
        expect(blocked).toBeInstanceOf(RedirectCommand);
        expect(TestBed.inject(Router).serializeUrl((blocked as RedirectCommand).redirectTo)).toBe('/forbidden');
        bindAnalyticsPermissions(() => [path === 'schedules' ? 'crm.subscriptions.manage' : 'crm.exports.create']);
        expect(TestBed.runInInjectionContext(() => guard({} as never, {} as never))).toBe(true);
      }
    });
  });

  describe('Subscriptions API', () => {
    it('reuses update keys only for retryable failures and rotates after a changed body', async () => {
      const original = stub.write.bind(stub);
      const write = vi.spyOn(stub, 'write').mockImplementationOnce(async (...args) => {
        await original(...args); throw new ApiError(0, 'NETWORK');
      });
      await expect(updateSubscription(sub.id, { revision: 2, name: 'First' })).rejects.toBeInstanceOf(ApiError);
      write.mockImplementationOnce(async (...args) => { await original(...args); throw new ApiError(409, 'GW.IDEM.IN_FLIGHT'); });
      await expect(updateSubscription(sub.id, { revision: 2, name: 'First' })).rejects.toBeInstanceOf(ApiError);
      expect(stub.recordedWrites()[1]).toEqual(stub.recordedWrites()[0]);
      await updateSubscription(sub.id, { revision: 2, name: 'Second' });
      expect(stub.recordedWrites()[2].options.key).not.toBe(stub.recordedWrites()[0].options.key);
    });
    it('reads cursor pages and detail and sends keyed revisions without scope headers on every write', async () => {
      const read = vi.spyOn(stub, 'read');
      await listSubscriptions('cursor', 10); await getSubscription(sub.id); await listDeliveries(sub.id, 'deliveries', 6);
      expect(read).toHaveBeenCalledWith('/analytics/subscriptions', { box: 'owned', cursor: 'cursor', limit: 10 });
      expect(read).toHaveBeenCalledWith(`/analytics/subscriptions/${sub.id}/deliveries`, { cursor: 'deliveries', limit: 6 });
      await createSubscription({ name: sub.name, dashboardId: sub.dashboardId, periodToken: sub.periodToken,
        recurrence: sub.recurrence, scheduleMinute: 540, timeZone: 'UTC', startsOn: sub.startsOn, recipients: sub.recipients }, newIdempotencyKey());
      await updateSubscription(sub.id, { name: 'Updated', revision: 2 });
      await enableSubscription(sub.id, 2); await disableSubscription(sub.id, 2);
      await resumeSubscription(sub.id, 2); await deleteSubscription(sub.id, 2);
      expect(stub.recordedWrites()).toHaveLength(6);
      for (const [index, write] of stub.recordedWrites().entries()) {
        expect(write.options.key).toMatch(/^[0-9a-f-]{36}$/); expect(write.options.scope).toBeUndefined();
        if (index) expect(write.options.ifMatch).toBe(`"subscription:${sub.id}:2"`);
      }
    });
  });
});
