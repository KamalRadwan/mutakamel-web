import { type Signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { convertToParamMap } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { CoreHttp } from '../../../../../core/api/core-http';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import type { DrillRecord } from '../dashboards.model';
import { DashboardHttpStub, dashboardDetail, dashboardId, setupDashboardTest, widgetId } from '../dashboard-page/dashboard-test-support';
import { RecordsPage } from './records-page';

interface RecordsState {
  records: Signal<DrillRecord[]>;
  loading: Signal<boolean>;
  needsCurrency: Signal<boolean>;
  currentPage: Signal<number>;
  currencyOptions: Signal<{ value: string; label: string }[]>;
  onPageChange(page: number): void;
  onCurrencyChange(currency: string): void;
  onRefresh(): void;
  formatRecordMoney(record: DrillRecord): string;
}
const record = { id: 'record-1', entityType: 'LEAD', title: 'Lead' };
const firstPage = { dashboardId, widgetId, records: [record], pageInfo: { limit: 25, hasMore: true, nextCursor: 'next_page' } };

for (const language of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) {
  describe(`RecordsPage ${language} ${theme}`, () => {
    let setup: ReturnType<typeof setupDashboardTest>;
    let fixture: ComponentFixture<RecordsPage> | undefined;
    let stub: DashboardHttpStub;
    let state: RecordsState;
    beforeEach(() => { stub = new DashboardHttpStub(); setup = setupDashboardTest(language, theme, stub); });
    afterEach(() => { fixture?.destroy(); fixture = undefined; setup.restore(); });
    function create() {
      fixture = setup.create(RecordsPage);
      state = fixture.componentInstance as unknown as RecordsState;
      fixture.detectChanges();
    }
    async function settle() {
      await vi.waitFor(() => { fixture!.detectChanges(); expect(state.loading()).toBe(false); });
      await fixture!.whenStable(); fixture!.detectChanges();
    }
    const calls = () => stub.recordedWrites().filter((call) => call.path.endsWith('/drilldown'));

    it('drilldown rules', async () => {
      stub.respond = async (_path, body) => {
        if ((body as { cursor?: string }).cursor) throw new ApiError(400, 'CRM_DASHBOARD_DRILLDOWN_CURSOR_INVALID');
        return firstPage;
      };
      create(); await settle();
      expect(calls()).toHaveLength(1);
      expect(calls()[0].body).not.toHaveProperty('cursor');
      state.onPageChange(2); await settle();
      await vi.waitFor(() => expect(calls()).toHaveLength(3));
      await settle();
      expect(calls()[1].body).toHaveProperty('cursor', 'next_page');
      expect(calls()[2].body).not.toHaveProperty('cursor');
      expect(state.currentPage()).toBe(1);
      expect(setup.query.value.get('page')).toBeNull();
      expect(state.records()).toEqual([record]);
      vi.useFakeTimers(); await vi.advanceTimersByTimeAsync(60_000); vi.useRealTimers();
      expect(calls()).toHaveLength(3);
    });

    it('offers the XR-CUR list only with tenant currency permission', async () => {
      setup.me.set({ ...setup.me(), isTenantOwner: true });
      const readPage = vi.fn().mockResolvedValue({ data: [
        { code: 'EGP', status: 'ACTIVE' }, { code: 'USD', status: 'ACTIVE' },
      ], meta: { hasNext: false } });
      TestBed.overrideProvider(CoreHttp, { useValue: { readPage } });
      stub.respond = async (_path, body) => {
        if (!(body as { filters?: { currencyCode?: string } }).filters?.currencyCode) {
          throw new ApiError(422, 'CRM_DASHBOARD_DRILLDOWN_CURRENCY_REQUIRED');
        }
        return { ...firstPage, pageInfo: { limit: 25, hasMore: false, nextCursor: null } };
      };
      create(); await settle();
      expect(state.needsCurrency()).toBe(true);
      expect(state.currencyOptions().map((option) => option.value)).toEqual(['EGP', 'USD']);
      expect(readPage).toHaveBeenCalledWith('/api/tenant/core/v1/currencies', {
        page: 1, limit: 100, status: 'ACTIVE', sortBy: 'code', sortDir: 'ASC',
      });
      state.onCurrencyChange('USD'); await settle();
      expect(calls()).toHaveLength(2);
      expect(calls()[1].body).toHaveProperty('filters.currencyCode', 'USD');
      expect(state.records()).toEqual([record]);
      expect(fixture!.nativeElement.textContent).not.toContain('dashFilters.currency');
    });

    it('keeps only the saved currency when the Core list is not granted', async () => {
      const detail = dashboardDetail(); detail.defaultFilters.currencyCode = 'USD';
      setup.restore(); stub = new DashboardHttpStub(detail); setup = setupDashboardTest(language, theme, stub);
      const readPage = vi.fn();
      TestBed.overrideProvider(CoreHttp, { useValue: { readPage } });
      stub.respond = async () => { throw new ApiError(422, 'CRM_DASHBOARD_DRILLDOWN_CURRENCY_REQUIRED'); };
      create(); await settle();
      expect(readPage).not.toHaveBeenCalled();
      expect(state.currencyOptions()).toEqual([{ value: 'USD', label: 'USD' }]);
      const picker = fixture!.nativeElement.querySelector('ui-dropdown button') as HTMLElement;
      expect(picker.getAttribute('aria-describedby')).toContain('drill-currency-hint');
      expect(picker.getAttribute('aria-describedby')).toContain('drill-currency-error');
    });

    it('shows source access denial as a forbidden state', async () => {
      stub.respond = async () => { throw new ApiError(403, 'CRM_DASHBOARD_DRILLDOWN_SOURCE_ACCESS_DENIED'); };
      create(); await settle();
      const full = fixture!.debugElement.query(By.directive(FullState)).componentInstance as FullState;
      expect(full.kind()).toBe('forbidden');
      expect(calls()).toHaveLength(1);
    });

    it('does not request records when the module read key is absent', async () => {
      setup.permissions.splice(0, setup.permissions.length);
      create(); await settle();
      expect(stub.recordedReads()).toHaveLength(0);
      expect(calls()).toHaveLength(0);
      const full = fixture!.debugElement.query(By.directive(FullState)).componentInstance as FullState;
      expect(full.kind()).toBe('forbidden');
    });

    it('does not walk unknown cursors after a deep-link reload', async () => {
      setup.query.next(convertToParamMap({ widget: widgetId, point: 'value', page: '4' }));
      stub.respond = async () => firstPage;
      create(); await settle();
      await vi.waitFor(() => expect(calls()).toHaveLength(1));
      expect(setup.query.value.get('page')).toBeNull();
      expect(calls()[0].body).not.toHaveProperty('cursor');
    });

    it('keeps money ISO-first and never supplies an invented currency', async () => {
      stub.respond = async () => firstPage;
      create(); await settle();
      expect(state.formatRecordMoney({ id: 'money', amount: 12500.5, currencyCode: 'USD' })).toBe('USD 12,500.50');
      expect(state.formatRecordMoney({ id: 'money', amount: 12500.5 })).toBe('—');
    });
  });
}
