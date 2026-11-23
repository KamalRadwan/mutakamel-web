import { Injectable, signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import {
  TranslocoLoader,
  TranslocoService,
  provideTransloco,
  type Translation,
} from '@jsverse/transloco';
import { defer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import enGlobal from '../../../../../../public/i18n/en.json';
import arGlobal from '../../../../../../public/i18n/ar.json';
import enCalendars from '../../../../../../public/i18n/settings-calendars/en.json';
import arCalendars from '../../../../../../public/i18n/settings-calendars/ar.json';
import enSettings from '../../../../../../public/i18n/settings/en.json';
import arSettings from '../../../../../../public/i18n/settings/ar.json';
import enChart from '../../../../../../public/i18n/chart/en.json';
import arChart from '../../../../../../public/i18n/chart/ar.json';
import enAnalytics from '../../../../../../public/i18n/analytics/en.json';
import arAnalytics from '../../../../../../public/i18n/analytics/ar.json';
import enRecord from '../../../../../../public/i18n/record-page/en.json';
import arRecord from '../../../../../../public/i18n/record-page/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import { TenantMe } from '../../../../core/auth/auth-session.model';
import { CurrentUser } from '../../../../core/auth/current-user';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Field } from '../../../../shared/ui/field/field';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { WorkspaceLookups } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { WorkspaceBranch } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { bindCrmHttpForTest } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { CalendarsPage } from './calendars-page';
import { buildWorkingDaysForYear, type WorkingCalendar } from './calendars.model';
import { WeekEditor } from './week-editor/week-editor';

const BRANCH = '01934b10-0000-7000-8000-000000000901';
const OTHER = '01934b10-0000-7000-8000-000000000902';
const THIRD = '01934b10-0000-7000-8000-000000000903';
const dialogPrototype = HTMLDialogElement.prototype;
const originalShow = Object.getOwnPropertyDescriptor(dialogPrototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(dialogPrototype, 'close');
const translations: Record<string, Translation> = {
  en: enGlobal,
  ar: arGlobal,
  'settings-calendars/en': enCalendars,
  'settings-calendars/ar': arCalendars,
  'settings/en': enSettings,
  'settings/ar': arSettings,
  'chart/en': enChart,
  'chart/ar': arChart,
  'analytics/en': enAnalytics,
  'analytics/ar': arAnalytics,
  'record-page/en': enRecord,
  'record-page/ar': arRecord,
};
@Injectable()
class TestLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return defer(() => Promise.resolve(translations[path] ?? {}));
  }
}
interface PageState {
  selectedBranchId: WritableSignal<string>;
  selectedYear: WritableSignal<number>;
  workingDays: WritableSignal<string>;
  timeZone: WritableSignal<string>;
  startMinute: WritableSignal<number>;
  endMinute: WritableSignal<number>;
  revision(): number;
  loading(): boolean;
  saving(): boolean;
  canManage(): boolean;
  conflictOpen(): boolean;
  dirty(): boolean;
  branchOptions(): { value: string; label: string }[];
  yearOptions(): { value: number; label: string }[];
  publish(): Promise<void>;
  loadCalendar(): Promise<void>;
  onBranchSelect(branch: string): Promise<void>;
}
function branch(id: string): WorkspaceBranch {
  return {
    id,
    name: id === BRANCH ? 'Branch A' : 'Branch B',
    companyId: 'company-a',
    code: id,
    address: null,
    phone: null,
    isHeadquarters: false,
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: '',
  };
}
function empty(year = 2026): WorkingCalendar {
  return {
    branchId: BRANCH,
    calendarYear: year,
    revision: 0,
    workingDays: null,
    publishedAt: null,
    workdayStartMinute: null,
    workdayEndMinute: null,
    timeZone: null,
    windows: [],
  };
}
function published(revision = 2): WorkingCalendar {
  return {
    ...empty(),
    revision,
    workingDays: buildWorkingDaysForYear(2026, 31),
    publishedAt: '2026-01-05T08:00:00Z',
    workdayStartMinute: 540,
    workdayEndMinute: 1020,
    timeZone: 'Asia/Dubai',
  };
}

for (const lang of ['en', 'ar'] as const)
  for (const theme of ['light', 'dark']) {
    describe(`CalendarsPage (${lang}, ${theme})`, () => {
      let fixture: ComponentFixture<CalendarsPage>;
      let page: PageState;
      let stub: CrmHttpStub;
      let dispose: () => void;
      const me = signal<TenantMe | null>(null);
      const allBranches = vi.fn<WorkspaceLookups['allBranches']>();
      const notify = { success: vi.fn(), error: vi.fn() };
      const texts = lang === 'ar' ? arCalendars : enCalendars;
      const path = `/targets/working-calendars/${BRANCH}/2026`;
      let read: MockInstance<CrmHttpStub['read']>;
      let write: MockInstance<CrmHttpStub['write']>;

      function grants(readIds = [BRANCH, OTHER], manageIds = [BRANCH, OTHER], picker = true) {
        const permissions = [
          'crm.targets.read.all',
          ...(manageIds.length ? ['crm.targets.manage'] : []),
          ...(picker ? ['org.branch.read'] : []),
        ];
        me.set({
          ...FAKE_TENANT_ME,
          isTenantOwner: false,
          permissions,
          permissionScopes: {
            'crm.targets.read.all': { tenantWide: false, companyIds: [], branchIds: readIds },
            'crm.targets.manage': { tenantWide: false, companyIds: [], branchIds: manageIds },
          },
          accessibleBranchCompanies: [],
          accessScope: { ...FAKE_TENANT_ME.accessScope!, branchesTruncated: false },
        });
        bindAnalyticsPermissions(() => me()?.permissions ?? []);
      }
      async function render() {
        TestBed.inject(TranslocoService).setTranslation(
          {
            ...translations[lang],
            settings: lang === 'ar' ? arSettings : enSettings,
            calendars: texts,
            analytics: lang === 'ar' ? arAnalytics : enAnalytics,
            chart: lang === 'ar' ? arChart : enChart,
            recordPage: lang === 'ar' ? arRecord : enRecord,
          },
          lang,
        );
        fixture = TestBed.createComponent(CalendarsPage);
        page = fixture.componentInstance as unknown as PageState;
        fixture.detectChanges();
        await vi.waitFor(() => expect(page.loading()).toBe(false));
        await fixture.whenStable();
        fixture.detectChanges();
      }
      async function paint() {
        fixture.detectChanges();
        await vi.waitFor(() => {
          expect(page.loading()).toBe(false);
          expect(page.saving()).toBe(false);
        });
        await fixture.whenStable();
        fixture.detectChanges();
      }
      function state() {
        return fixture.debugElement.query(By.directive(FullState))?.componentInstance as
          FullState | undefined;
      }

      beforeEach(() => {
        Object.defineProperty(dialogPrototype, 'showModal', {
          configurable: true,
          value: function (this: HTMLDialogElement) {
            this.open = true;
          },
        });
        Object.defineProperty(dialogPrototype, 'close', {
          configurable: true,
          value: function (this: HTMLDialogElement) {
            this.open = false;
          },
        });
        globalThis.ResizeObserver ??= class {
          observe() {}
          unobserve() {}
          disconnect() {}
        } as never;
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-11-23T10:00:00Z'));
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', theme);
        fixture = undefined as unknown as ComponentFixture<CalendarsPage>;
        grants();
        allBranches.mockReset().mockResolvedValue([branch(BRANCH), branch(OTHER), branch(THIRD)]);
        notify.error.mockReset();
        notify.success.mockReset();
        TestBed.configureTestingModule({
          imports: [CalendarsPage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: {
                availableLangs: ['en', 'ar'],
                defaultLang: lang,
                reRenderOnLangChange: true,
                prodMode: false,
              },
              loader: TestLoader,
            }),
            { provide: LanguageState, useValue: { current: signal(lang) } },
            { provide: TenantScopeState, useValue: { me, selection: signal(null) } },
            { provide: CurrentUser, useValue: { user: signal({ timeZone: 'Pacific/Auckland' }) } },
            { provide: WorkspaceLookups, useValue: { allBranches } },
            { provide: Notify, useValue: notify },
          ],
        });
        stub = new CrmHttpStub({ [path]: empty() });
        dispose = bindCrmHttpForTest(stub);
        read = vi.spyOn(stub, 'read');
        write = vi.spyOn(stub, 'write').mockImplementation(async (_method, _path, body) => ({
          status: 201,
          data: { ...published(3), ...(body as object), revision: 3 } as never,
          etag: null,
          location: null,
        }));
      });
      afterEach(() => {
        fixture?.destroy();
        dispose();
        bindAnalyticsPermissions(() => []);
        vi.restoreAllMocks();
        vi.useRealTimers();
        if (originalShow) Object.defineProperty(dialogPrototype, 'showModal', originalShow);
        else Reflect.deleteProperty(dialogPrototype, 'showModal');
        if (originalClose) Object.defineProperty(dialogPrototype, 'close', originalClose);
        else Reflect.deleteProperty(dialogPrototype, 'close');
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.removeAttribute('dir');
        document.documentElement.removeAttribute('lang');
      });

      it('empty calendar uses the authenticated workspace zone', async () => {
        await render();
        expect(page.timeZone()).toBe('Pacific/Auckland');
        await page.publish();
        await paint();
        expect(write).toHaveBeenCalled();
      });

      it('published calendar keeps its zone', async () => {
        read.mockResolvedValue(published());
        await render();
        expect(page.timeZone()).toBe('Asia/Dubai');
        expect(page.revision()).toBe(2);
      });

      it('branch without access shows forbidden', async () => {
        read.mockRejectedValue(new ApiError(403, 'BRANCH_PERMISSION_DENIED'));
        await render();
        expect(state()?.kind()).toBe('forbidden');
        expect(fixture.nativeElement.querySelector('app-week-editor')).toBeNull();
        expect(fixture.nativeElement.querySelector(':scope > footer')).toBeNull();
        expect(notify.error).not.toHaveBeenCalled();
      });

      it('missing keys show the permission state', async () => {
        for (const code of ['CRM_PERMISSION_DENIED', 'MISSING_REQUIRED_PERMISSIONS']) {
          read.mockRejectedValue(new ApiError(403, code));
          if (!fixture) await render();
          else {
            await page.loadCalendar();
            await paint();
          }
          expect(state()?.kind()).toBe('forbidden');
          expect(notify.error).not.toHaveBeenCalled();
        }
      });

      it('load failure', async () => {
        read.mockRejectedValueOnce(
          new ApiError(503, 'GW.UPSTREAM.UNAVAILABLE', undefined, {
            correlationId: 'cal-reference',
          }),
        );
        await render();
        expect(state()?.kind()).toBe('load-failure');
        expect(fixture.nativeElement.textContent).toContain('cal-reference');
        read.mockResolvedValue(empty());
        state()!.action.emit();
        await paint();
        expect(state()).toBeUndefined();
        expect(read).toHaveBeenCalledTimes(2);
      });

      it('publish keeps the new head', async () => {
        await render();
        page.timeZone.set('Asia/Riyadh');
        await page.publish();
        await paint();
        expect(page.revision()).toBe(3);
        expect(page.dirty()).toBe(false);
        expect(notify.success).toHaveBeenCalledWith(texts.page.publishedToast);
        expect(write.mock.calls[0][2]).toMatchObject({
          expectedRevision: 0,
          timeZone: 'Asia/Riyadh',
        });
      });

      it('409 keeps the editor', async () => {
        await render();
        page.timeZone.set('Asia/Riyadh');
        page.endMinute.set(900);
        const edited = page.workingDays();
        write.mockRejectedValueOnce(new ApiError(409, 'CRM_WORKING_CALENDAR_REVISION_CONFLICT'));
        await page.publish();
        await paint();
        expect(page.conflictOpen()).toBe(true);
        read.mockResolvedValueOnce(published(9));
        const dialog = fixture.debugElement.query(By.directive(ConflictDialog))
          .componentInstance as ConflictDialog;
        dialog.keepEditing.emit();
        await paint();
        expect(page.revision()).toBe(9);
        expect(page.timeZone()).toBe('Asia/Riyadh');
        expect(page.endMinute()).toBe(900);
        expect(page.workingDays()).toBe(edited);
        expect(page.dirty()).toBe(true);
        expect(write).toHaveBeenCalledTimes(1);
        await page.publish();
        expect(write.mock.calls[1][2]).toMatchObject({ expectedRevision: 9 });
      });

      it('409 Reload replaces the draft with the latest head', async () => {
        await render();
        page.timeZone.set('Asia/Riyadh');
        page.endMinute.set(900);
        write.mockRejectedValueOnce(new ApiError(409, 'CRM_WORKING_CALENDAR_REVISION_CONFLICT'));
        await page.publish();
        await paint();
        read.mockResolvedValueOnce(published(9));
        const dialog = fixture.debugElement.query(By.directive(ConflictDialog))
          .componentInstance as ConflictDialog;
        dialog.reload.emit();
        await paint();
        expect(page.revision()).toBe(9);
        expect(page.timeZone()).toBe('Asia/Dubai');
        expect(page.endMinute()).toBe(1020);
        expect(page.dirty()).toBe(false);
        expect(write).toHaveBeenCalledTimes(1);
      });

      it.each([
        [401, 'UNAUTHORIZED'],
        [0, 'NETWORK_ERROR'],
        [503, 'GW.UPSTREAM.UNAVAILABLE'],
        [429, 'GW.RATE.LIMIT_EXCEEDED'],
        [409, 'GW.IDEM.IN_FLIGHT'],
        [422, 'GW.IDEM.MISMATCH'],
      ] as const)(
        'write %s %s preserves the draft and never retries automatically',
        async (status, code) => {
          await render();
          page.timeZone.set('Asia/Riyadh');
          page.endMinute.set(900);
          write.mockRejectedValueOnce(new ApiError(status, code, { retryAfterSeconds: ['12'] }));
          await page.publish();
          await paint();
          expect(page.timeZone()).toBe('Asia/Riyadh');
          expect(page.endMinute()).toBe(900);
          expect(page.dirty()).toBe(true);
          expect(write).toHaveBeenCalledTimes(1);
          expect(notify.error).toHaveBeenCalled();
          const shared = lang === 'ar' ? arSettings : enSettings;
          if (status === 401) expect(notify.error).toHaveBeenCalledWith(shared.errors.notSaved);
          if (status === 429)
            expect(notify.error).toHaveBeenCalledWith(
              shared.errors.rateLimitedIn.replace('{{seconds}}', '12'),
            );
          if (code === 'GW.IDEM.IN_FLIGHT')
            expect(notify.error).toHaveBeenCalledWith(shared.errors['GW.IDEM.IN_FLIGHT']);
          if (code === 'GW.IDEM.MISMATCH')
            expect(notify.error).toHaveBeenCalledWith(shared.errors['GW.IDEM.MISMATCH']);
        },
      );

      it('all field labels keep their linked hints', async () => {
        await render();
        for (const element of fixture.debugElement.queryAll(By.directive(Field))) {
          const field = element.componentInstance as Field;
          expect(field.hint().trim()).not.toBe('');
          const id = field.for();
          if (!id) continue;
          const control = (element.nativeElement as HTMLElement).querySelector(`[id="${id}"]`);
          expect(control?.getAttribute('aria-describedby')).toContain(`${id}-hint`);
        }
      });

      it('422 codes show at their section', async () => {
        await render();
        page.timeZone.set('Asia/Riyadh');
        for (const code of [
          'CRM_WORKING_CALENDAR_INVALID',
          'CRM_CALENDAR_HOURS_INVALID',
          'CRM_CALENDAR_TIME_ZONE_INVALID',
          'CRM_CALENDAR_WINDOW_OVERLAP',
        ] as const) {
          write.mockRejectedValueOnce(new ApiError(422, code));
          await page.publish();
          await paint();
          const fields = fixture.debugElement
            .queryAll(By.directive(Field))
            .map((field) => field.componentInstance as Field);
          expect(fields.some((field) => field.error() === texts.errors[code])).toBe(true);
          expect(notify.error).not.toHaveBeenCalled();
        }
      });

      it('publish 403 makes the branch read-only', async () => {
        await render();
        page.timeZone.set('Asia/Riyadh');
        write.mockRejectedValueOnce(new ApiError(403, 'BRANCH_PERMISSION_DENIED'));
        await page.publish();
        await paint();
        expect(notify.error).toHaveBeenCalledWith(texts.errors.BRANCH_PERMISSION_DENIED);
        expect(page.canManage()).toBe(false);
        expect(fixture.nativeElement.querySelector(':scope > footer')).toBeNull();
        const discard = fixture.debugElement
          .queryAll(By.directive(ConfirmDialog))
          .map((element) => element.componentInstance as ConfirmDialog)
          .find((dialog) => dialog.title() === texts.page.discardTitle)!;
        vi.spyOn(discard, 'open').mockResolvedValue(true);
        read.mockResolvedValue(empty());
        await page.onBranchSelect(OTHER);
        await paint();
        expect(page.canManage()).toBe(true);
      });

      it('editor read-only without manage in that branch', async () => {
        grants([BRANCH, OTHER], [OTHER]);
        await render();
        expect(page.canManage()).toBe(false);
        expect(
          (
            fixture.debugElement.query(By.directive(WeekEditor)).componentInstance as WeekEditor
          ).readOnly(),
        ).toBe(true);
        expect(fixture.nativeElement.querySelector(':scope > footer')).toBeNull();
        await page.publish();
        expect(write).not.toHaveBeenCalled();
      });

      it('picker hidden without org.branch.read', async () => {
        grants([BRANCH], [BRANCH], false);
        await render();
        expect(allBranches).not.toHaveBeenCalled();
        expect(fixture.nativeElement.querySelector('ui-dropdown[id$="-branch"]')).toBeNull();
        const control = fixture.nativeElement.querySelector(
          'input[id$="-branch"]',
        ) as HTMLInputElement;
        expect(control.readOnly).toBe(true);
        expect(control.value).toBe(texts.page.branchPermission);
        expect(control.getAttribute('aria-describedby')).toContain(`${control.id}-hint`);
        expect(page.selectedBranchId()).toBe(BRANCH);
      });

      it('single branch preselected', async () => {
        grants([BRANCH], [BRANCH]);
        await render();
        expect(page.selectedBranchId()).toBe(BRANCH);
        expect(page.branchOptions()).toEqual([{ value: BRANCH, label: 'Branch A' }]);
        expect(fixture.nativeElement.textContent).toContain(texts.page.yourBranch);
        expect(allBranches).toHaveBeenCalledWith({ status: 'ACTIVE' });
      });

      it('year window', async () => {
        vi.setSystemTime(new Date('2026-12-31T23:30:00Z'));
        Object.assign(me()!, { workspace: {} });
        await render();
        expect(page.yearOptions().map((option) => option.value)).toEqual([2026, 2027, 2028, 2029]);
        expect(page.selectedYear()).toBe(2027);
        fixture.destroy();
        grants();
        await render();
        expect(page.yearOptions().map((option) => option.value)).toEqual([2026, 2027, 2028, 2029]);
      });

      it('dirty switch asks to discard', async () => {
        await render();
        page.timeZone.set('Asia/Riyadh');
        const dialogs = fixture.debugElement.queryAll(By.directive(ConfirmDialog));
        const discard = dialogs
          .map((element) => element.componentInstance as ConfirmDialog)
          .find((dialog) => dialog.title() === texts.page.discardTitle)!;
        const choice = vi.spyOn(discard, 'open').mockResolvedValue(false);
        await page.onBranchSelect(OTHER);
        expect(choice).toHaveBeenCalled();
        expect(page.selectedBranchId()).toBe(BRANCH);
        expect(page.timeZone()).toBe('Asia/Riyadh');
        expect(read).toHaveBeenCalledTimes(1);
        choice.mockResolvedValue(true);
        read.mockResolvedValue(empty());
        await page.onBranchSelect(OTHER);
        expect(page.selectedBranchId()).toBe(OTHER);
        expect(page.dirty()).toBe(false);
      });

      it('does not narrow a truncated branch projection', async () => {
        me.update((value) => ({
          ...value!,
          accessScope: { ...value!.accessScope!, branchesTruncated: true },
        }));
        await render();
        expect(page.branchOptions().map((option) => option.value)).toEqual([BRANCH, OTHER, THIRD]);
      });

      it('400 validation messages stay at the matching fields', async () => {
        await render();
        page.timeZone.set('Asia/Riyadh');
        write.mockRejectedValueOnce(
          new ApiError(400, 'CRM_VALIDATION_FAILED', {
            timeZone: ['Choose a valid time zone'],
            'windows.0.layer': ['Layer must be an integer'],
          }),
        );
        await page.publish();
        await paint();
        expect(fixture.nativeElement.textContent).toContain('Choose a valid time zone');
        expect(fixture.nativeElement.textContent).toContain('Layer must be an integer');
        expect(notify.error).not.toHaveBeenCalled();
      });

      it.each(['CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY'])(
        'plan denial %s removes publishing for all branches',
        async (code) => {
          await render();
          page.timeZone.set('Asia/Riyadh');
          write.mockRejectedValueOnce(new ApiError(403, code));
          await page.publish();
          await paint();
          expect(page.canManage()).toBe(false);
          const discard = fixture.debugElement
            .queryAll(By.directive(ConfirmDialog))
            .map((element) => element.componentInstance as ConfirmDialog)
            .find((dialog) => dialog.title() === texts.page.discardTitle)!;
          vi.spyOn(discard, 'open').mockResolvedValue(true);
          read.mockResolvedValue(empty());
          await page.onBranchSelect(OTHER);
          await paint();
          expect(page.canManage()).toBe(false);
          expect(notify.error).toHaveBeenCalled();
        },
      );
    });
  }
