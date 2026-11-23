import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslocoLoader, TranslocoService, Translation, provideTransloco } from '@jsverse/transloco';
import { firstValueFrom, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../public/i18n/party-calls/en.json';
import ar from '../../../../../public/i18n/party-calls/ar.json';
import enCalls from '../../../../../public/i18n/call-log/en.json';
import arCalls from '../../../../../public/i18n/call-log/ar.json';
import enPagination from '../../../../../public/i18n/ui-pagination/en.json';
import arPagination from '../../../../../public/i18n/ui-pagination/ar.json';
import enGlobal from '../../../../../public/i18n/en.json';
import arGlobal from '../../../../../public/i18n/ar.json';
import { ApiError } from '../../../core/api/api-errors';
import { CurrentUser } from '../../../core/auth/current-user';
import { LanguageState } from '../../../core/i18n/language';
import { Notify } from '../../../core/notify/notify';
import { PhoneState } from '../../../core/phone/phone';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { bindCrmHttpForTest, crmQueries, type CrmHttpTransport } from '../../../features/crm/shared/crm-http';
import { FullState } from '../../ui/full-state/full-state';
import { CallLogTable } from '../call-log/call-log-table/call-log-table';
import { PartyCall } from './party-calls.model';
import { PartyCalls } from './party-calls';

const ID = '0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa02';
const ROW: PartyCall = {
  id: ID, callLogId: ID, type: 'IN_NOANS', phoneNumber: '+201005550142', displayName: 'Amal',
  startedAt: '2026-11-22T23:30:00Z', answeredAt: null, endedAt: '2026-11-22T23:30:20Z',
  durationSeconds: null, linkKind: 'NUMBER_MATCH', ownerUserId: ID, ownerName: 'Sara',
  transferKind: null, conferenceId: null,
};
const SUMMARY = { total: 42, missed: 7, lastCallAt: ROW.startedAt };
type ReadCalls = (path: string, query: Record<string, unknown>) => Promise<unknown>;

class Loader implements TranslocoLoader {
  getTranslation(path: string) {
    const arabic = path.endsWith('ar');
    const data = path.startsWith('party-calls/') ? (arabic ? ar : en)
      : path.startsWith('call-log/') ? (arabic ? arCalls : enCalls)
      : path.startsWith('ui-pagination/') ? (arabic ? arPagination : enPagination)
      : arabic ? arGlobal : enGlobal;
    return of(data as Translation);
  }
}

interface TableActions {
  onTypeChange(type: string): void;
  onFromChange(value: string | null): void;
  onToChange(value: string | null): void;
  onSearchInput(event: Event): void;
  onPageChange(page: number): void;
  onPageSizeChange(size: number): void;
  clearFilters(): void;
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark']) {
    describe(`PartyCalls ${lang} ${theme}`, () => {
      let fixture: ComponentFixture<PartyCalls>;
      let dispose: () => void;
      let read: ReturnType<typeof vi.fn<ReadCalls>>;
      let warnings: ReturnType<typeof vi.spyOn>;
      let toast: ReturnType<typeof vi.fn>;
      let call: ReturnType<typeof vi.fn>;
      let totals: number[];
      let missed: number[];
      const me = signal<unknown>({ workspace: {} });
      const user = signal({ timeZone: 'Africa/Cairo' });

      async function render() {
        fixture.detectChanges();
        for (let i = 0; i < 30; i++) await Promise.resolve();
        await fixture.whenStable();
        fixture.detectChanges();
      }
      function table() {
        return fixture.debugElement.query(By.directive(CallLogTable)).componentInstance as TableActions;
      }
      function lastListQuery() {
        return read.mock.calls.filter(([path]) => path === '/calls').at(-1)![1];
      }
      async function setup() {
        const transloco = TestBed.inject(TranslocoService);
        for (const scope of ['', 'party-calls/', 'call-log/', 'ui-pagination/']) {
          await firstValueFrom(transloco.load(scope + lang));
        }
        transloco.setTranslation({ pagination: lang === 'ar' ? arPagination : enPagination }, lang, { merge: true });
        fixture = TestBed.createComponent(PartyCalls);
        fixture.componentRef.setInput('partyType', 'LEAD');
        fixture.componentRef.setInput('partyId', ID);
        fixture.componentRef.setInput('partyLabel', 'Amal');
        fixture.componentInstance.total.subscribe((value) => totals.push(value));
        fixture.componentInstance.missed.subscribe((value) => missed.push(value));
        await render();
      }
      beforeEach(() => {
        TestBed.resetTestingModule();
        crmQueries().clear();
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.dataset['theme'] = theme;
        me.set({ workspace: {} });
        user.set({ timeZone: 'Africa/Cairo' });
        read = vi.fn<ReadCalls>().mockImplementation(async (path, query) => path === '/calls/summary' ? SUMMARY
          : { data: [ROW], meta: { page: query['page'], limit: query['limit'], total: 42 } });
        dispose = bindCrmHttpForTest({ read, readBlob: vi.fn(), write: vi.fn(), writeMultipart: vi.fn() } as unknown as CrmHttpTransport);
        toast = vi.fn();
        call = vi.fn();
        totals = [];
        missed = [];
        warnings = vi.spyOn(console, 'warn');
        TestBed.configureTestingModule({
          imports: [PartyCalls],
          providers: [
            provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: lang,
              reRenderOnLangChange: true, prodMode: false }, loader: Loader }),
            { provide: LanguageState, useValue: { current: signal(lang) } },
            { provide: TenantScopeState, useValue: { me } },
            { provide: CurrentUser, useValue: { user } },
            { provide: Notify, useValue: { error: toast } },
            { provide: PhoneState, useValue: { visible: signal(true), busy: signal(false), call } },
          ],
        });
      });
      afterEach(() => {
        vi.useRealTimers();
        fixture?.destroy();
        crmQueries().clear();
        dispose();
        const missing = warnings.mock.calls.filter((args: unknown[]) => /Missing hint|Missing translation|not found/i.test(args.join(' ')));
        vi.restoreAllMocks();
        TestBed.resetTestingModule();
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.lang = 'en';
        document.documentElement.dir = 'ltr';
        expect(missing).toEqual([]);
      });

      it('lists calls', async () => {
        await setup();
        expect(fixture.nativeElement.textContent).toContain('Sara');
        expect(fixture.nativeElement.textContent).toContain('01:30');
        expect(lastListQuery()).toMatchObject({ partyType: 'LEAD', partyId: ID, page: 1, limit: 20 });
        table().onTypeChange('IN_NOANS');
        await render();
        table().onFromChange('2026-11-01');
        await render();
        table().onToChange('2026-11-23');
        await render();
        expect(lastListQuery()).toMatchObject({ type: 'IN_NOANS', from: '2026-10-31T22:00:00.000Z', to: '2026-11-23T21:59:59.999Z' });
        table().onPageChange(2);
        await render();
        expect(lastListQuery()['page']).toBe(2);
        table().onPageSizeChange(50);
        await render();
        expect(lastListQuery()).toMatchObject({ page: 1, limit: 50 });

        const fields = fixture.nativeElement.querySelectorAll('ui-field') as NodeListOf<HTMLElement>;
        expect(fields.length).toBe(4);
        for (const field of fields) {
          const control = field.querySelector('[aria-describedby]')!;
          expect(control).not.toBeNull();
          const ids = control.getAttribute('aria-describedby')!.split(/\s+/);
          expect(ids.some((id) => field.querySelector(`[id="${id}"]`)?.textContent?.trim())).toBe(true);
        }
      });

      it('summary', async () => {
        await setup();
        expect(totals).toEqual([42]);
        expect(missed).toEqual([7]);
        expect(read).toHaveBeenCalledWith('/calls/summary', { partyType: 'LEAD', partyId: ID });
        fixture.componentRef.setInput('partyType', 'CUSTOMER_PROFILE');
        fixture.componentRef.setInput('partyId', '0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa03');
        await render();
        expect(lastListQuery()['partyType']).toBe('CUSTOMER_PROFILE');
      });

      it.each(['/calls', '/calls/summary'])('denial is not an error: %s', async (deniedPath) => {
        read.mockImplementation(async (path) => {
          if (path === deniedPath) throw ApiError.fromResponse(404, { message: 'CRM record not found' });
          return path === '/calls/summary' ? SUMMARY : { data: [ROW], meta: { page: 1, limit: 20, total: 42 } };
        });
        await setup();
        expect(fixture.nativeElement.textContent).toContain((lang === 'ar' ? ar : en).errors.notFound);
        expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
        const state = fixture.debugElement.query(By.directive(FullState)).componentInstance as FullState;
        expect(state.kind()).toBe('not-found');
        expect(state.actionLabel()).toBe('');
        expect(toast).not.toHaveBeenCalled();
        expect(totals).toEqual([0]);
        expect(missed).toEqual([0]);
      });

      it.each([0, 500])('shows load failure %s with correlation and retries', async (status) => {
        read.mockRejectedValueOnce(new ApiError(status, 'NETWORK_ERROR', undefined, { correlationId: 'calls-correlation' }));
        await setup();
        const state = fixture.debugElement.query(By.directive(FullState)).componentInstance as FullState;
        expect(state.kind()).toBe('load-failure');
        expect(state.text()).toContain('calls-correlation');
        state.action.emit();
        await render();
        expect(fixture.nativeElement.textContent).toContain('Sara');
      });

      it('uses UTC bounds when settingsTimeZone returns null', async () => {
        me.set(null);
        await setup();
        table().onFromChange('2026-11-01');
        await render();
        expect(lastListQuery()['from']).toBe('2026-11-01T00:00:00.000Z');
        expect(fixture.nativeElement.textContent).toContain('23:30');
      });

      it('includes the full 25-hour day when the settings zone leaves daylight saving time', async () => {
        user.set({ timeZone: 'America/New_York' });
        await setup();
        table().onFromChange('2026-11-01');
        await render();
        table().onToChange('2026-11-01');
        await render();
        expect(lastListQuery()).toMatchObject({ from: '2026-11-01T04:00:00.000Z', to: '2026-11-02T04:59:59.999Z' });
      });

      it('retries a failed summary together with the list', async () => {
        const normalRead = read.getMockImplementation()!;
        let failed = false;
        read.mockImplementation(async (path, query) => {
          if (path === '/calls/summary' && !failed) {
            failed = true;
            throw new ApiError(500, 'COMMON.GENERIC.INTERNAL_ERROR');
          }
          return normalRead(path, query);
        });
        await setup();
        expect(totals).toEqual([]);
        const state = fixture.debugElement.query(By.directive(FullState)).componentInstance as FullState;
        expect(state.kind()).toBe('load-failure');
        state.action.emit();
        await render();
        expect(totals).toEqual([42]);
        expect(missed).toEqual([7]);
      });

      it('shows the existing empty and filtered-empty states', async () => {
        read.mockImplementation(async (path) => path === '/calls/summary'
          ? { total: 0, missed: 0, lastCallAt: null }
          : { data: [], meta: { page: 1, limit: 20, total: 0 } });
        await setup();
        const texts = lang === 'ar' ? arCalls : enCalls;
        expect(fixture.nativeElement.textContent).toContain(texts.states.empty);
        table().onTypeChange('IN_NOANS');
        await render();
        expect(fixture.nativeElement.textContent).toContain(texts.states.noMatch);
        table().clearFilters();
        await render();
        expect(fixture.nativeElement.textContent).toContain(texts.states.empty);
      });

      it('shows a forbidden state for a 403 from the landed backend', async () => {
        read.mockRejectedValueOnce(new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED'));
        await setup();
        const state = fixture.debugElement.query(By.directive(FullState)).componentInstance as FullState;
        expect(state.kind()).toBe('forbidden');
        expect(state.text()).toContain((lang === 'ar' ? arGlobal : enGlobal).apiErrors.permission);
        expect(toast).not.toHaveBeenCalled();
      });

      it('shows the gateway rate-limit countdown message', async () => {
        read.mockRejectedValueOnce(new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['17'] }));
        await setup();
        const state = fixture.debugElement.query(By.directive(FullState)).componentInstance as FullState;
        expect(state.text()).toContain('17');
        expect(state.actionLabel()).toBe((lang === 'ar' ? arCalls : enCalls).actions.retry);
      });

      it('searches after debounce and resets paging', async () => {
        await setup();
        table().onPageChange(2);
        await render();
        const input = fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
        const before = read.mock.calls.length;
        vi.useFakeTimers();
        input.value = '  Amal  ';
        table().onSearchInput({ target: input } as unknown as Event);
        await vi.advanceTimersByTimeAsync(399);
        expect(read.mock.calls.length).toBe(before);
        await vi.advanceTimersByTimeAsync(1);
        vi.useRealTimers();
        await render();
        expect(lastListQuery()).toMatchObject({ q: 'Amal', page: 1 });
      });

      it('keeps the phone callback linked to the current record', async () => {
        await setup();
        const button = fixture.nativeElement.querySelector(`button[aria-label="${(lang === 'ar' ? arCalls : enCalls).actions.callBack}"]`) as HTMLButtonElement;
        button.click();
        expect(call).toHaveBeenCalledWith(ROW.phoneNumber, { type: 'LEAD', id: ID, label: 'Amal' });
      });
    });
  }
}
