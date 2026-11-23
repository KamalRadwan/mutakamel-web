import { Component, Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { type Translation, TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { defer } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enGlobal from '../../../../../../../public/i18n/en.json';
import enActivities from '../../../../../../../public/i18n/activities/en.json';
import enRecordActivitiesTab from '../../../../../../../public/i18n/record-activities-tab/en.json';
import { ApiError } from '../../../../../core/api/api-errors';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActivitiesApi } from '../../../../../shared/widgets/activities/activities.api';
import type {
  Activity,
  ActivityListParams,
  ActivityPage,
  ActivitySummary,
  ActivitySummaryScope,
} from '../../../../../shared/widgets/activities/activities.model';
import { RecordActivities } from '../../../../../shared/widgets/activities/record-activities/record-activities';
import { RecordActivitiesTab, type RecordActivityTargetType } from './record-activities-tab';

const TRANSLATIONS: Record<string, Translation> = {
  en: enGlobal,
  'activities/en': enActivities,
  'record-activities-tab/en': enRecordActivitiesTab,
};

@Injectable()
class AsyncTestLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return defer(() => Promise.resolve(TRANSLATIONS[path] ?? {}));
  }
}

@Component({
  selector: 'app-record-activities-tab-host',
  imports: [RecordActivitiesTab],
  template: `
    <app-record-activities-tab
      [targetType]="targetType()"
      [targetId]="targetId()"
      [label]="label()"
      [canEdit]="canEdit()"
      [newRequest]="newRequest()"
      (countChange)="counts.push($event)"
    />
  `,
})
class TestHost {
  readonly targetType = signal<RecordActivityTargetType>('LEAD');
  readonly targetId = signal('lead-1');
  readonly label = signal('Acme Lead');
  readonly canEdit = signal(true);
  readonly newRequest = signal(0);
  readonly counts: Array<{ open: number; total: number }> = [];
}

interface TabInternals {
  loading(): boolean;
  loadingMore(): boolean;
  loadFailed(): boolean;
  items(): Activity[];
  page(): number;
  hasNext(): boolean;
  currentTotal(): number;
  openCount(): number;
  doneCount(): number;
  allCount(): number;
  summary(): ActivitySummary;
  filter(): 'open' | 'done' | 'all';
  onFilterChange(value: string | null): void;
  loadMore(): Promise<void>;
  reload(): void;
  openNew(): void;
  openItem(item: Activity): void;
}

function makeActivity(id: string, overrides: Partial<Activity> = {}): Activity {
  return {
    id,
    type: 'CALL',
    subject: `Activity ${id}`,
    description: null,
    direction: 'OUTBOUND',
    priority: 'NORMAL',
    status: 'PLANNED',
    dueAt: '2026-12-01T10:00:00.000Z',
    endsAt: null,
    reminderOffsetMinutes: 15,
    reminderSentAt: null,
    location: null,
    meetingUrl: null,
    completedAt: null,
    cancelledAt: null,
    outcome: null,
    assigneeUserId: 'user-1',
    assigneeName: 'Kamal',
    createdByUserId: 'user-1',
    createdByName: 'Kamal',
    branchId: 'branch-1',
    companyId: 'company-1',
    version: 1,
    createdAt: '2026-11-23T08:00:00.000Z',
    updatedAt: '2026-11-23T08:00:00.000Z',
    targets: [
      {
        id: `tgt-${id}`,
        role: 'PRIMARY',
        targetApp: 'CRM',
        targetType: 'LEAD',
        targetId: 'lead-1',
        label: 'Acme Lead',
        route: '/crm/leads/lead-1',
        targetVersion: '1',
        unavailableAt: null,
      },
    ],
    ...overrides,
  };
}

function makePage(data: Activity[], meta: Partial<ActivityPage['meta']> = {}): ActivityPage {
  return {
    data,
    meta: {
      page: 1,
      limit: 20,
      total: data.length,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
      ...meta,
    },
  };
}

describe('RecordActivitiesTab', () => {
  const api = {
    listActivities: vi.fn<(params?: ActivityListParams) => Promise<ActivityPage>>(),
    activitySummary: vi.fn<(scope?: ActivitySummaryScope, dayStart?: string, dayEnd?: string) => Promise<ActivitySummary>>(),
  };
  const notify = { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.listActivities.mockImplementation(async (params = {}) => {
      if (params.limit === 1 && params.statuses?.includes('PLANNED')) {
        return makePage([makeActivity('open-1')], { limit: 1, total: 3, totalPages: 3, hasNext: true });
      }
      if (params.limit === 1 && params.statuses?.includes('DONE')) {
        return makePage([makeActivity('done-1', { status: 'DONE' })], { limit: 1, total: 2, totalPages: 2, hasNext: true });
      }
      if (params.limit === 1 && !params.statuses) {
        return makePage([makeActivity('all-1')], { limit: 1, total: 6, totalPages: 6, hasNext: true });
      }
      return makePage([makeActivity('act-1'), makeActivity('act-2')], {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        total: 3,
        totalPages: 2,
        hasNext: (params.page ?? 1) < 2,
        hasPrev: (params.page ?? 1) > 1,
      });
    });
    api.activitySummary.mockResolvedValue({
      overdue: 1,
      today: 1,
      upcoming: 1,
      completedToday: 0,
      byStatus: [],
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: ActivitiesApi, useValue: api },
        { provide: Notify, useValue: notify },
        { provide: LanguageState, useValue: { current: signal<'ar' | 'en'>('en') } },
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
          loader: AsyncTestLoader,
        }),
      ],
    });
    TestBed.overrideComponent(RecordActivities, { set: { template: '', imports: [] } });
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation(enGlobal, 'en', { merge: true });
    transloco.setTranslation(
      { activities: enActivities, recordActivitiesTab: enRecordActivitiesTab },
      'en',
      { merge: true },
    );
  });

  async function mount() {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const tabDebug = fixture.debugElement.query(By.directive(RecordActivitiesTab));
    const tab = tabDebug.componentInstance as unknown as TabInternals;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(tab.loading()).toBe(false);
    });
    return {
      fixture,
      host: fixture.componentInstance,
      tab,
      modal: tabDebug.query(By.directive(RecordActivities)).componentInstance as RecordActivities,
    };
  }

  it('loads list, CorePageMeta totals, and day-bounded summary through ActivitiesApi', async () => {
    const { host, tab } = await mount();

    expect(api.listActivities).toHaveBeenCalledWith({
      targetApp: 'CRM',
      targetType: 'LEAD',
      targetId: 'lead-1',
      statuses: ['PLANNED', 'IN_PROGRESS'],
      page: 1,
      limit: 20,
      sortDir: 'ASC',
    });
    expect(api.activitySummary).toHaveBeenCalledWith(
      { app: 'CRM', type: 'LEAD', id: 'lead-1' },
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    );
    const [, dayStartArg, dayEndArg] = api.activitySummary.mock.calls[0];
    expect(Date.parse(dayEndArg ?? '') - Date.parse(dayStartArg ?? '')).toBe(24 * 60 * 60 * 1000);

    expect(tab.items().map((item) => item.id)).toEqual(['act-1', 'act-2']);
    expect(tab.hasNext()).toBe(true);
    expect(tab.currentTotal()).toBe(3);
    expect(tab.openCount()).toBe(3);
    expect(tab.doneCount()).toBe(2);
    expect(tab.allCount()).toBe(6);
    expect(tab.summary()).toMatchObject({ overdue: 1, today: 1, upcoming: 1 });
    expect(host.counts).toEqual([{ open: 3, total: 6 }]);
  });

  it('switches filters to done and all with expected status and sort parameters', async () => {
    const { fixture, tab } = await mount();
    api.listActivities.mockClear();

    tab.onFilterChange('done');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(tab.loading()).toBe(false);
    });
    expect(api.listActivities).toHaveBeenCalledWith({
      targetApp: 'CRM',
      targetType: 'LEAD',
      targetId: 'lead-1',
      statuses: ['DONE'],
      page: 1,
      limit: 20,
      sortDir: 'DESC',
    });

    api.listActivities.mockClear();
    tab.onFilterChange('all');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(tab.loading()).toBe(false);
    });
    expect(api.listActivities).toHaveBeenCalledWith({
      targetApp: 'CRM',
      targetType: 'LEAD',
      targetId: 'lead-1',
      statuses: undefined,
      page: 1,
      limit: 20,
      sortDir: 'DESC',
    });
  });

  it('appends deduplicated rows on loadMore and updates CorePageMeta pagination', async () => {
    const { tab } = await mount();
    api.listActivities.mockResolvedValueOnce(
      makePage(
        [makeActivity('act-2'), makeActivity('act-3')],
        { page: 2, limit: 20, total: 3, totalPages: 2, hasNext: false, hasPrev: true },
      ),
    );

    await tab.loadMore();

    expect(api.listActivities).toHaveBeenLastCalledWith({
      targetApp: 'CRM',
      targetType: 'LEAD',
      targetId: 'lead-1',
      statuses: ['PLANNED', 'IN_PROGRESS'],
      page: 2,
      limit: 20,
      sortDir: 'ASC',
    });
    expect(tab.items().map((item) => item.id)).toEqual(['act-1', 'act-2', 'act-3']);
    expect(tab.page()).toBe(2);
    expect(tab.hasNext()).toBe(false);
    expect(tab.currentTotal()).toBe(3);
  });

  it('keeps existing rows and notifies when loadMore fails', async () => {
    const { tab } = await mount();
    api.listActivities.mockRejectedValueOnce(new ApiError(503, 'ACTIVITY_TARGET_RESOLVER_UNAVAILABLE'));

    await tab.loadMore();

    expect(tab.items().map((item) => item.id)).toEqual(['act-1', 'act-2']);
    expect(tab.loadingMore()).toBe(false);
    expect(notify.error).toHaveBeenCalledWith(enActivities.errors.ACTIVITY_TARGET_RESOLVER_UNAVAILABLE);
  });

  it.each<[number, string, Record<string, unknown> | undefined, string]>([
    [403, 'MISSING_REQUIRED_PERMISSIONS', undefined, enActivities.errors.MISSING_REQUIRED_PERMISSIONS],
    [403, 'ACCESS_POLICY_BLOCKED', undefined, enActivities.errors.ACCESS_POLICY_BLOCKED],
    [403, 'ACTIVITY_ACCESS_DENIED', undefined, enActivities.errors.ACTIVITY_ACCESS_DENIED],
    [404, 'ACTIVITY_NOT_FOUND', undefined, enActivities.errors.ACTIVITY_NOT_FOUND],
    [422, 'ACTIVITY_INVALID', undefined, enActivities.errors.ACTIVITY_INVALID],
    [429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['9'] }, 'Too many requests. Try again in 9 s.'],
    [503, 'ACCESS_POLICY_UNAVAILABLE', undefined, enActivities.errors.ACCESS_POLICY_UNAVAILABLE],
    [503, 'ACTIVITY_TARGET_RESOLVER_UNAVAILABLE', undefined, enActivities.errors.ACTIVITY_TARGET_RESOLVER_UNAVAILABLE],
    [0, 'NETWORK_ERROR', undefined, enGlobal.apiErrors.network],
  ])('maps backend error %s (%s) to loadFailed and error toast, then recovers on reload', async (status, code, details, expectedText) => {
    const { fixture, tab } = await mount();
    notify.error.mockClear();
    api.listActivities.mockRejectedValueOnce(new ApiError(status, code, details));

    tab.reload();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(tab.loadFailed()).toBe(true);
    });

    expect(tab.loadFailed()).toBe(true);
    expect(notify.error).toHaveBeenCalledWith(expectedText);

    api.listActivities.mockResolvedValueOnce(makePage([makeActivity('act-recovered')]));
    tab.reload();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(tab.items().map((item) => item.id)).toEqual(['act-recovered']);
      expect(tab.loading()).toBe(false);
    });
    expect(tab.loadFailed()).toBe(false);
  });

  it('delegates openNew and openItem to RecordActivities and reloads on changed event', async () => {
    const { fixture, tab, modal } = await mount();
    const openSpy = vi.spyOn(modal, 'open').mockImplementation(() => {});

    tab.openNew();
    expect(openSpy).toHaveBeenCalledWith(
      { app: 'CRM', type: 'LEAD', id: 'lead-1', label: 'Acme Lead' },
      { screen: 'new' },
    );

    const item = makeActivity('act-9');
    tab.openItem(item);
    expect(openSpy).toHaveBeenCalledWith(
      { app: 'CRM', type: 'LEAD', id: 'lead-1', label: 'Acme Lead' },
      { screen: 'edit', activityId: 'act-9' },
    );

    api.listActivities.mockClear();
    modal.changed.emit();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(api.listActivities).toHaveBeenCalled();
    });
  });
});
