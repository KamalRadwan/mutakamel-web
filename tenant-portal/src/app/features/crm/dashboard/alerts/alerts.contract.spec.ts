import { Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../public/i18n/en.json';
import ar from '../../../../../../public/i18n/ar.json';
import enAlerts from '../../../../../../public/i18n/crm-alerts/en.json';
import arAlerts from '../../../../../../public/i18n/crm-alerts/ar.json';
import enAnalytics from '../../../../../../public/i18n/analytics/en.json';
import arAnalytics from '../../../../../../public/i18n/analytics/ar.json';
import enChart from '../../../../../../public/i18n/chart/en.json';
import arChart from '../../../../../../public/i18n/chart/ar.json';
import enRecord from '../../../../../../public/i18n/record-page/en.json';
import arRecord from '../../../../../../public/i18n/record-page/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Field } from '../../../../shared/ui/field/field';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import type { CatalogMetric } from '../../../../shared/widgets/dashboard/analytics.model';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { OrgApi } from '../../../../shared/widgets/dashboard/org.api';
import { By } from '@angular/platform-browser';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { AlertModal } from './alert-modal/alert-modal';
import { AlertsPage } from './alerts-page/alerts-page';
import { resetAlertWriteConflicts } from './alerts.api';
import type { AlertRule } from './alerts.model';

const translations: Record<string, Translation> = {
  en: { ...en, alerts: enAlerts, analytics: enAnalytics, chart: enChart, recordPage: enRecord },
  ar: { ...ar, alerts: arAlerts, analytics: arAnalytics, chart: arChart, recordPage: arRecord },
  'crm-alerts/en': enAlerts, 'crm-alerts/ar': arAlerts,
  'analytics/en': enAnalytics, 'analytics/ar': arAnalytics,
  'chart/en': enChart, 'chart/ar': arChart,
  'record-page/en': enRecord, 'record-page/ar': arRecord,
};
@Injectable()
class Loader implements TranslocoLoader {
  getTranslation(path: string) { return of(translations[path] ?? {}); }
}
const metric: CatalogMetric = {
  key: 'crm.leads.count', availability: 'AVAILABLE', labelEn: 'Leads', labelAr: 'العملاء المحتملون',
  unit: 'COUNT', shape: 'SCALAR', dimensions: [], supportsPeriodComparison: false, timeModel: 'EVENT',
  dateField: 'createdAt', formulaKey: 'count', supportedFilters: [], comparisonTypes: ['NONE'],
  currencyPolicy: 'NOT_APPLICABLE', accessResources: ['leads'], emptyValuePolicy: 'ZERO',
  readiness: { basis: 'CURRENT', sources: [] },
};
const rule: AlertRule = {
  id: 'alert', name: 'Lead count', ownerUserId: 'owner', state: 'DISABLED', enabled: false, suspendedReason: null,
  sourceKind: 'METRIC', metricKey: metric.key, threshold: '10', comparator: 'LT', valueUnit: 'COUNT',
  timeZone: 'Africa/Cairo', scheduleKind: 'DAILY', scheduleMinute: 540, revision: 3,
  nextEvaluationAt: null, lastEvaluatedAt: null, updatedByUserId: 'owner',
  createdAt: '2026-11-23T00:00:00Z', updatedAt: '2026-11-23T00:00:00Z',
};
const page = { items: [rule], pageInfo: { limit: 20, nextCursor: null, hasMore: false } };
const result = (data: unknown) => ({ data, status: 200, etag: null, location: null });

for (const lang of ['en', 'ar'] as const) for (const theme of ['light', 'dark'] as const) {
  describe(`AL-1 (${lang}, ${theme})`, () => {
    let stub: CrmHttpStub;
    let dispose: () => void;
    let permissions: string[];
    const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
    beforeEach(() => {
      permissions = ['crm.alerts.manage', 'crm.dashboards.read.all'];
      bindAnalyticsPermissions(() => permissions);
      crmQueries().clear();
      resetAlertWriteConflicts();
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.dataset['theme'] = theme;
      globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
      HTMLDialogElement.prototype.showModal ??= function () { this.open = true; };
      HTMLDialogElement.prototype.close ??= function () { this.open = false; };
      vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
      vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false; });
      stub = new CrmHttpStub({ '/analytics/alerts': page, '/analytics/alerts/alert': rule, '/dashboards/catalog': { metrics: [metric] } });
      dispose = bindCrmHttpForTest(stub);
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true, prodMode: false }, loader: Loader }),
          { provide: LanguageState, useValue: { current: signal(lang) } },
          { provide: ScopeState, useValue: { company: signal({ currencyCode: 'EGP' }) } },
          { provide: Notify, useValue: notify },
          { provide: OrgApi, useValue: { branches: [], users: [], now: () => '2026-11-23T00:00:00Z', listGrantedBranches: async () => [], listUsers: async () => [] } },
        ],
      });
    });
    afterEach(() => {
      TestBed.resetTestingModule();
      dispose?.();
      crmQueries().clear();
      bindAnalyticsPermissions(() => []);
      vi.restoreAllMocks();
      vi.clearAllMocks();
    });

    async function modal() {
      const fixture = TestBed.createComponent(AlertModal);
      fixture.componentRef.setInput('metrics', [metric]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.componentInstance.openCreate();
      fixture.componentInstance['patchDraft']({ name: 'Lead count', thresholdText: '10' });
      fixture.detectChanges();
      return fixture;
    }

    it('AlertsPage › hidden without manage', async () => {
      permissions = [];
      const read = vi.spyOn(stub, 'read');
      const fixture = TestBed.createComponent(AlertsPage);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.componentInstance['allowed']()).toBe(false);
      expect(fixture.nativeElement.querySelector('app-alert-modal')).toBeNull();
      expect(fixture.nativeElement.querySelector('ui-data-table')).toBeNull();
      expect(read).not.toHaveBeenCalled();
    });

    it('AlertModal › create', async () => {
      const fixture = await modal();
      const instance = fixture.componentInstance;
      const write = vi.spyOn(stub, 'write');
      for (const [code, field] of [
        ['CRM_ALERT_UNIT_MISMATCH', 'valueUnit'], ['CRM_ALERT_SCHEDULE_INVALID', 'scheduleMinute'],
        ['CRM_ALERT_RECIPIENTS_INVALID', 'recipientUserIds'],
      ] as const) {
        write.mockRejectedValueOnce(new ApiError(422, code));
        expect(await instance['save']()).toBe(false);
        expect(instance['serverErrors']()[field]).toBe(TestBed.inject(TranslocoService).translate(`analytics.error.${code}`));
        expect(instance['draft']().name).toBe('Lead count');
      }
      write.mockResolvedValueOnce(result(rule));
      expect(await instance['save']()).toBe(true);
      expect(write.mock.lastCall?.[3].key).toMatch(/-7[\da-f]{3}-/);
      expect(write.mock.lastCall?.[3].scope).toBeUndefined();
      expect(write.mock.lastCall?.[2]).toMatchObject({ name: 'Lead count', metricKey: metric.key });
      for (const field of fixture.debugElement.queryAll(By.directive(Field))) {
        if (field.componentInstance.label()) expect(field.componentInstance.hint()).toBeTruthy();
      }
    });

    it('AlertModal › stale', async () => {
      const fixture = await modal();
      const instance = fixture.componentInstance;
      instance.openEdit(rule);
      instance['patchDraft']({ name: 'My draft' });
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'CRM_ALERT_REVISION_STALE'));
      await instance['save']();
      fixture.detectChanges();
      const dialog = fixture.debugElement.query(By.directive(ConflictDialog)).componentInstance as ConflictDialog;
      expect(dialog.open()).toBe(true);
      vi.spyOn(stub, 'read').mockResolvedValue({ ...rule, name: 'Server name', revision: 4 });
      await instance['resolveConflict'](false);
      expect(instance['editingRule']()?.revision).toBe(4);
      expect(instance['draft']().name).toBe('My draft');
      write.mockResolvedValueOnce(result({ ...rule, revision: 5 }));
      await instance['save']();
      expect(write.mock.lastCall?.[2]).toMatchObject({ name: 'My draft', revision: 4 });
      expect(write.mock.lastCall?.[3].ifMatch).toBe('"4"');
      instance.openEdit(rule);
      instance['patchDraft']({ name: 'Discard me' });
      await instance['resolveConflict'](true);
      expect(instance['draft']().name).toBe('Server name');
    });

    it('AlertsPage › resume', async () => {
      const suspended: AlertRule = { ...rule, state: 'SUSPENDED', suspendedReason: 'OWNER_ACCESS_LOST' };
      vi.spyOn(stub, 'read').mockImplementation(async <T>(path: string) => (path === '/analytics/alerts' ? { ...page, items: [suspended] } : { metrics: [metric] }) as T);
      const fixture = TestBed.createComponent(AlertsPage);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const instance = fixture.componentInstance;
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(fixture.debugElement.queryAll(By.directive(Badge)).some((badge) => badge.componentInstance.tone() === 'warning')).toBe(true);
      });
      expect(instance['rowActions'](suspended).some((action) => action.id === 'resume')).toBe(true);
      const write = vi.spyOn(stub, 'write').mockResolvedValueOnce(result({ ...rule, state: 'ENABLED', revision: 4 }));
      await instance['runStateChange'](suspended, 'resume');
      expect(write.mock.lastCall).toMatchObject(['POST', '/analytics/alerts/alert/resume', { revision: 3 }, { ifMatch: '"3"' }]);
      expect(instance['alerts']()[0].state).toBe('ENABLED');
    });

    it('AlertModal › test', async () => {
      const fixture = await modal();
      const instance = fixture.componentInstance;
      instance.openEdit(rule);
      const write = vi.spyOn(stub, 'write').mockResolvedValueOnce(result({ value: 5, met: true, wouldNotify: true, cohortSize: 100 }));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(write).not.toHaveBeenCalled();
      await instance['runTest']();
      fixture.detectChanges();
      expect(write).toHaveBeenCalledTimes(1);
      expect(write.mock.lastCall?.slice(0, 3)).toEqual(['POST', '/analytics/alerts/alert/test', undefined]);
      expect(instance['testResult']()?.wouldNotify).toBe(true);
      expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain('5');
      expect(notify.success).not.toHaveBeenCalled();
    });

    it('AlertModal › retries unchanged requests and renews the key after edits', async () => {
      const fixture = await modal();
      const instance = fixture.componentInstance;
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(503, 'UNAVAILABLE'));
      await instance['save']();
      write.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED'));
      await instance['save']();
      expect(write.mock.calls[0][3].key).toBe(write.mock.calls[1][3].key);
      expect(write.mock.calls[0][2]).toEqual(write.mock.calls[1][2]);
      expect(notify.error).toHaveBeenLastCalledWith(TestBed.inject(TranslocoService).translate('alerts.errors.notSaved'));
      instance['patchDraft']({ name: 'Changed request' });
      write.mockResolvedValueOnce(result(rule));
      await instance['save']();
      expect(write.mock.calls[2][3].key).not.toBe(write.mock.calls[1][3].key);
    });

    it('AlertModal › locks mismatches and module/subscription write denials without losing edits', async () => {
      const fixture = await modal();
      const instance = fixture.componentInstance;
      vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'GW.IDEM.MISMATCH'));
      await instance['save']();
      expect(instance['writeLocked']()).toBe(true);
      expect(instance['draft']().name).toBe('Lead count');
      expect(await instance['save']()).toBe(false);
      for (const code of ['CRM_LEADS_DISABLED', 'CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY']) {
        instance['writeLocked'].set(false);
        await instance['handleSaveError'](new ApiError(403, code));
        expect(instance['writeLocked']()).toBe(true);
      }
    });

    it('AlertsPage › uses shared states for failed reads with a correlation id and readiness link', async () => {
      permissions.push('crm.analytics.readiness.view');
      const read = vi.spyOn(stub, 'read');
      read.mockImplementation(async <T>(path: string) => {
        if (path === '/analytics/alerts') throw new ApiError(503, 'CRM_ANALYTICS_SOURCE_UNAVAILABLE', undefined, { correlationId: 'correlation' });
        return { metrics: [metric] } as T;
      });
      const fixture = TestBed.createComponent(AlertsPage);
      fixture.detectChanges();
      await vi.waitFor(() => expect(fixture.componentInstance['loadError']()).toBe(true));
      expect(fixture.componentInstance['failureKind']()).toBe('provisioning');
      expect(fixture.componentInstance['failureText']()).toContain('correlation');
      expect(fixture.componentInstance['canReadiness']).toBe(true);
      for (const [status, code, kind] of [[0, 'NETWORK_ERROR', 'load-failure'], [500, 'INTERNAL_ERROR', 'load-failure'], [404, 'CRM_ALERT_NOT_FOUND', 'not-found']] as const) {
        fixture.componentInstance['failure'].set(new ApiError(status, code));
        expect(fixture.componentInstance['failureKind']()).toBe(kind);
      }
    });
  });
}
