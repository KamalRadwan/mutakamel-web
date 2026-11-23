import { Component, DestroyRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowsSort,
  tablerCalendarEvent,
  tablerFilter,
  tablerLayoutKanban,
  tablerLock,
  tablerPlus,
  tablerRefresh,
  tablerSearch,
  tablerTable,
  tablerX,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ViewOption, ViewSwitcher } from '../../../../../shared/ui/view-switcher/view-switcher';
import { ActivitiesApi } from '../../../../../shared/widgets/activities/activities.api';
import {
  ACTIVITY_STATUSES,
  Activity,
  ActivityScopeFilter,
  ActivityStatus,
  ActivitySummary,
  ActivityTypeDefinition,
  TargetApp,
} from '../../../../../shared/widgets/activities/activities.model';
import {
  RecordActivities,
  RecordTarget,
} from '../../../../../shared/widgets/activities/record-activities/record-activities';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { WorkspaceLookups } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { WorkspaceApp, WorkspaceBranch } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { SessionFailedState } from '../../shared/session-failed-state/session-failed-state';
import { ActivitiesBoard } from '../activities-board/activities-board';
import { ActivitiesCalendar, calendarMonthRange } from '../activities-calendar/activities-calendar';
import { ActivitiesFilters } from '../activities-filters/activities-filters';
import { ActivitiesList } from '../activities-list/activities-list';
import {
  ACTIVITIES_VIEWS,
  ActivitiesFilterState,
  ActivitiesView,
  BoardLaneState,
  DEFAULT_LIST_STATUSES,
  DEFAULT_PAGE_SIZE,
  ParsedActivitiesUrl,
  SEARCH_MAX_LENGTH,
  ActivityAction,
  buildUrlParams,
  canActOnActivity,
  dateRangeToApiBounds,
  defaultFilterState,
  isDefaultListStatuses,
  isForbiddenError,
  isTodayRange,
  localDayBounds,
  ALL_RECORD_TYPES,
  parseUrlState,
  primaryTargetOf,
  todayDateRange,
} from '../operations-activities.model';
import { RecordPickerModal } from '../record-picker-modal/record-picker-modal';
import { ApiError, correlationIdOf, errorMessage } from '../../../../../core/api/api-errors';

const SEARCH_DEBOUNCE_MS = 300;
const BOARD_PAGE_LIMIT = 20;

const VIEW_ICONS: Record<ActivitiesView, string> = {
  list: 'tablerTable',
  board: 'tablerLayoutKanban',
  calendar: 'tablerCalendarEvent',
};

function emptySummary(): ActivitySummary {
  return {
    overdue: 0,
    today: 0,
    upcoming: 0,
    completedToday: 0,
    byStatus: ACTIVITY_STATUSES.map((status) => ({
      status,
      total: 0,
      overdue: 0,
      today: 0,
      upcoming: 0,
    })),
  };
}

function emptyBoardLanes(): BoardLaneState[] {
  return ACTIVITY_STATUSES.map((status) => ({
    status,
    items: [],
    total: 0,
    page: 1,
    hasNext: false,
    loadingMore: false,
    overdue: 0,
    today: 0,
    upcoming: 0,
  }));
}

@Component({
  selector: 'app-activities-page',
  imports: [
    SessionFailedState,
    FullState,
    NgIcon,
    TranslocoPipe,
    Button,
    ViewSwitcher,
    ActivitiesFilters,
    ActivitiesList,
    ActivitiesBoard,
    ActivitiesCalendar,
    RecordPickerModal,
    RecordActivities,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'ws-activities', alias: 'wsActivities' }, 'activities'),
    provideIcons({
      tablerPlus,
      tablerSearch,
      tablerX,
      tablerFilter,
      tablerTable,
      tablerLayoutKanban,
      tablerCalendarEvent,
      tablerArrowsSort,
      tablerLock,
      tablerRefresh,
    }),
  ],
  templateUrl: './activities-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class ActivitiesPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly scope = inject(TenantScopeState);
  private readonly auth = inject(AuthSession);
  private readonly api = inject(ActivitiesApi);
  private readonly lookups = inject(WorkspaceLookups);
  private readonly apps = signal<WorkspaceApp[]>([]);

  protected readonly sessionFailed = computed(() => !this.scope.me() && this.auth.status() === 'failed');
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly recordPicker = viewChild(RecordPickerModal);
  private readonly recordActivities = viewChild(RecordActivities);

  private readonly initialUrl = parseUrlState(this.route.snapshot.queryParamMap);

  protected readonly view = signal<ActivitiesView>(this.initialUrl.view);
  protected readonly filters = signal<ActivitiesFilterState>(this.initialUrl.filters);
  protected readonly page = signal<number>(this.initialUrl.page);
  protected readonly pageSize = signal<number>(this.initialUrl.pageSize);
  protected readonly calendarMonth = signal<Date>(this.initialUrl.calendarMonth);
  protected readonly searchDraft = signal<string>(this.initialUrl.filters.search);
  protected readonly filtersOpen = signal(false);

  protected readonly branches = signal<WorkspaceBranch[]>([]);
  protected readonly activityTypes = signal<ActivityTypeDefinition[]>([]);
  protected readonly summary = signal<ActivitySummary>(emptySummary());

  private readonly rawListItems = signal<Activity[]>([]);
  protected readonly listTotal = signal(0);
  private readonly rawBoardLanes = signal<BoardLaneState[]>(emptyBoardLanes());
  private readonly rawCalendarItems = signal<Activity[]>([]);

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly errorCorrelationId = signal<string | null>(null);
  protected readonly forbiddenError = signal(false);
  private readonly reloadTick = signal(0);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private loadSeq = 0;
  private lastWrittenQueryKey = JSON.stringify(buildUrlParams(this.initialUrl));
  private lastTruncatedNoticeKey = '';
  private linkedActivityId: string | null = null;

  protected readonly canRead = computed(() => {
    // Until the session has loaded (or if loading failed) do not show the 403 state; the API decides.
    if (!this.scope.me()) return true;
    return this.hasPermission('activities.read');
  });

  protected readonly canCreate = computed(() => {
    const me = this.scope.me();
    if (!me) return false;
    return this.hasPermission('activities.create');
  });

  protected readonly availableApps = computed<TargetApp[]>(() => {
    const owner = this.scope.me()?.isTenantOwner === true;
    return (['CRM', 'CORE', 'TRADE'] as const).filter((app) => app === 'CORE' ||
      this.apps().some((item) => item.moduleKey === app.toLowerCase() && item.group === 'SUBSCRIBED' &&
        (owner || item.myAccessState === 'ACTIVE' || item.myAccessState === 'OVER_CAPACITY')));
  });

  private canActOn(action: ActivityAction): (activity: Activity) => boolean {
    const me = this.scope.me();
    return (activity: Activity) =>
      canActOnActivity(
        { meId: me?.id ?? null, isOwner: me?.isTenantOwner === true, can: (permission, scope) => this.hasPermission(permission, scope) },
        action,
        activity,
      );
  }

  protected readonly canCompleteFn = computed(() => this.canActOn('complete'));
  protected readonly canCancelFn = computed(() => this.canActOn('cancel'));

  protected readonly viewOptions = computed<ViewOption[]>(() => {
    this.i18n();
    return ACTIVITIES_VIEWS.map((id) => ({
      id,
      icon: VIEW_ICONS[id],
      label: this.transloco.translate(`wsActivities.views.${id}`),
    }));
  });

  protected readonly activeFilterCount = computed(() => {
    const f = this.filters();
    const currentView = this.view();
    let count = 0;
    if (f.show === 'all') count++;
    if (f.types.length > 0) count++;
    if (f.priorities.length > 0) count++;
    if (currentView === 'list') {
      if (f.statusesExplicit !== null && !isDefaultListStatuses(f.statusesExplicit)) {
        count++;
      }
    } else if (currentView === 'calendar') {
      if (f.statusesExplicit !== null && f.statusesExplicit.length > 0 && f.statusesExplicit.length < ACTIVITY_STATUSES.length) {
        count++;
      }
    }
    if (f.branchId) count++;
    if (f.recordType) count++;
    if (f.dueRange) count++;
    if (f.overdue) count++;
    return count;
  });

  protected readonly hasAnyActiveFilterOrSearch = computed(
    () => this.activeFilterCount() > 0 || this.filters().search.trim().length > 0,
  );

  protected readonly todayChipActive = computed(() => {
    const f = this.filters();
    return !f.overdue && isTodayRange(f.dueRange);
  });

  protected readonly listItems = this.rawListItems.asReadonly();

  protected readonly boardLanes = computed<BoardLaneState[]>(() => {
    const summaryByStatus = new Map(this.summary().byStatus.map((item) => [item.status, item]));
    return this.rawBoardLanes().map((lane) => {
      const counts = summaryByStatus.get(lane.status);
      return {
        ...lane,
        items: lane.items,
        total: counts?.total ?? lane.total,
        overdue: counts?.overdue ?? lane.overdue,
        today: counts?.today ?? lane.today,
        upcoming: counts?.upcoming ?? lane.upcoming,
      };
    });
  });

  protected readonly calendarItems = this.rawCalendarItems.asReadonly();

  private readonly summaryTotal = computed(() =>
    this.summary().byStatus.reduce((acc, item) => acc + item.total, 0),
  );

  private readonly hasVisibleItems = computed(() => {
    const currentView = this.view();
    if (currentView === 'list') return this.listItems().length > 0 || this.listTotal() > 0;
    if (currentView === 'board') return this.boardLanes().some((lane) => lane.items.length > 0 || lane.hasNext);
    return this.calendarItems().length > 0;
  });

  protected readonly isFirstUseEmpty = computed(
    () =>
      !this.loading() &&
      !this.loadError() &&
      !this.forbiddenError() &&
      this.view() !== 'calendar' &&
      !this.hasVisibleItems() &&
      !this.hasAnyActiveFilterOrSearch() &&
      this.summaryTotal() === 0,
  );

  protected readonly isFilteredEmpty = computed(
    () =>
      !this.loading() &&
      !this.loadError() &&
      !this.forbiddenError() &&
      this.view() !== 'calendar' &&
      !this.hasVisibleItems() &&
      !this.isFirstUseEmpty(),
  );

  protected goHome(): void {
    void this.router.navigate(['/']);
  }

  protected readonly loadFailureText = computed(() => {
    this.i18n();
    const reference = this.errorCorrelationId();
    const text = this.transloco.translate('wsActivities.states.loadFailedText');
    return reference ? `${text} ${this.transloco.translate('wsActivities.states.reference', { correlationId: reference })}` : text;
  });

  protected retrySession(): void {
    void this.auth.ensureLoaded().catch(() => undefined);
  }

  constructor() {
    if (!this.scope.me()) {
      void this.auth.ensureLoaded().catch(() => undefined);
    }
    void this.loadLookups();

    effect(() => {
      const pm = this.queryParams();
      if (!pm) return;
      const activityId = pm.get('activityId');
      const window = this.recordActivities();
      if (activityId && window) untracked(() => void this.openLinkedActivity(activityId));
      const parsed = parseUrlState(pm);
      const key = JSON.stringify(buildUrlParams(parsed));
      if (key === this.lastWrittenQueryKey) return;
      this.lastWrittenQueryKey = key;
      untracked(() => {
        this.view.set(parsed.view);
        this.filters.set(parsed.filters);
        this.searchDraft.set(parsed.filters.search);
        this.page.set(parsed.page);
        this.pageSize.set(parsed.pageSize);
        this.calendarMonth.set(parsed.calendarMonth);
      });
    });

    effect(() => {
      const readable = this.canRead();
      const meId = this.scope.me()?.id ?? null;
      const currentView = this.view();
      const f = this.filters();
      const currentPage = this.page();
      const currentSize = this.pageSize();
      const currentMonth = this.calendarMonth();
      this.reloadTick();

      if (!readable) {
        untracked(() => {
          this.loading.set(false);
        });
        return;
      }

      untracked(() => {
        void this.loadData({
          meId,
          view: currentView,
          filters: f,
          page: currentPage,
          pageSize: currentSize,
          calendarMonth: currentMonth,
        });
      });
    });

    inject(DestroyRef).onDestroy(() => this.clearSearchTimer());
  }

  protected reload(): void {
    this.reloadTick.update((count) => count + 1);
  }

  protected setView(next: string): void {
    const nextView: ActivitiesView = ACTIVITIES_VIEWS.includes(next as ActivitiesView)
      ? (next as ActivitiesView)
      : 'list';
    if (nextView === this.view()) return;
    this.view.set(nextView);
    if (nextView === 'list') {
      this.page.set(1);
    }
    this.syncUrl();
  }

  protected toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  protected onSearchInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value.slice(0, SEARCH_MAX_LENGTH);
    this.searchDraft.set(next);
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      if (this.filters().search !== next) {
        this.filters.update((current) => ({ ...current, search: next }));
        this.page.set(1);
        this.syncUrl();
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  protected commitSearchNow(): void {
    this.clearSearchTimer();
    const next = this.searchDraft();
    if (this.filters().search !== next) {
      this.filters.update((current) => ({ ...current, search: next }));
      this.page.set(1);
      this.syncUrl();
    }
  }

  protected clearSearch(): void {
    this.clearSearchTimer();
    this.searchDraft.set('');
    if (this.filters().search !== '') {
      this.filters.update((current) => ({ ...current, search: '' }));
      this.page.set(1);
      this.syncUrl();
    }
  }

  protected toggleOverdueChip(): void {
    this.filters.update((current) => {
      const nextOverdue = !current.overdue;
      return {
        ...current,
        overdue: nextOverdue,
        ...(nextOverdue && isTodayRange(current.dueRange) ? { dueRange: null } : {}),
      };
    });
    this.page.set(1);
    this.syncUrl();
  }

  protected toggleTodayChip(): void {
    this.filters.update((current) => {
      if (!current.overdue && isTodayRange(current.dueRange)) {
        return { ...current, dueRange: null };
      }
      return {
        ...current,
        overdue: false,
        dueRange: todayDateRange(),
      };
    });
    this.page.set(1);
    this.syncUrl();
  }

  protected toggleSortDir(): void {
    this.filters.update((current) => ({
      ...current,
      sortDir: current.sortDir === 'ASC' ? 'DESC' : 'ASC',
    }));
    this.page.set(1);
    this.syncUrl();
  }

  protected onFiltersPatch(patch: Partial<ActivitiesFilterState>): void {
    this.filters.update((current) => ({ ...current, ...patch }));
    this.page.set(1);
    this.syncUrl();
  }

  protected clearAllFilters(): void {
    this.clearSearchTimer();
    this.searchDraft.set('');
    const currentView = this.view();
    if (currentView === 'list' && !this.hasAnyActiveFilterOrSearch() && this.summaryTotal() > 0) {
      this.filters.set({ ...defaultFilterState(), statusesExplicit: [] });
    } else {
      this.filters.set(defaultFilterState());
    }
    this.page.set(1);
    this.syncUrl();
  }

  protected onPageChange(nextPage: number): void {
    if (nextPage === this.page()) return;
    this.page.set(nextPage);
    this.syncUrl();
  }

  protected onPageSizeChange(nextSize: number): void {
    if (nextSize === this.pageSize()) return;
    this.pageSize.set(nextSize);
    this.page.set(1);
    this.syncUrl();
  }

  protected onCalendarMonthChange(nextMonth: Date): void {
    this.calendarMonth.set(nextMonth);
    this.syncUrl();
  }

  protected openNewActivityPicker(): void {
    if (!this.canCreate()) return;
    this.recordPicker()?.open();
  }

  protected onRecordPicked(target: RecordTarget): void {
    this.recordActivities()?.open(target, { screen: 'new' });
  }

  protected openActivityWindow(activity: Activity): void {
    const primary = primaryTargetOf(activity);
    if (!primary) {
      this.notify.error(this.transloco.translate('activities.errors.generic'));
      return;
    }
    const target: RecordTarget = {
      app: primary.targetApp, type: primary.targetType, id: primary.targetId,
      label: primary.unavailableAt ? this.transloco.translate('wsActivities.unavailable') : primary.label,
    };
    this.recordActivities()?.open(target, { screen: 'edit', activityId: activity.id });
  }

  protected async loadMoreLane(status: ActivityStatus): Promise<void> {
    const lane = this.rawBoardLanes().find((item) => item.status === status);
    if (!lane || lane.loadingMore || !lane.hasNext) return;

    const seqAtStart = this.loadSeq;
    const f = this.filters();
    const meId = this.scope.me()?.id ?? null;
    const scope = this.buildScopeFilter(f, meId);

    this.rawBoardLanes.update((lanes) =>
      lanes.map((item) => (item.status === status ? { ...item, loadingMore: true } : item)),
    );

    try {
      const next = await this.api.listActivities({
        ...scope,
        statuses: [status],
        overdue: f.overdue ? true : undefined,
        sortBy: 'dueAt',
        sortDir: f.sortDir,
        page: lane.page + 1,
        limit: BOARD_PAGE_LIMIT,
      });
      if (seqAtStart !== this.loadSeq) return;
      this.rawBoardLanes.update((lanes) =>
        lanes.map((item) => {
          if (item.status !== status) return item;
          const seen = new Set(item.items.map((existing) => existing.id));
          const merged = [...item.items, ...next.data.filter((added) => !seen.has(added.id))];
          return {
            ...item,
            items: merged,
            total: next.meta.total,
            page: next.meta.page,
            hasNext: next.meta.hasNext,
            loadingMore: false,
          };
        }),
      );
    } catch {
      if (seqAtStart !== this.loadSeq) return;
      this.rawBoardLanes.update((lanes) =>
        lanes.map((item) => (item.status === status ? { ...item, loadingMore: false } : item)),
      );
      this.notify.error(this.transloco.translate('wsActivities.states.loadFailedTitle'));
    }
  }

  private buildScopeFilter(f: ActivitiesFilterState, meId: string | null): ActivityScopeFilter {
    const bounds = dateRangeToApiBounds(f.dueRange);
    const recordType = ALL_RECORD_TYPES.find((item) => item.key === f.recordType);
    return {
      ...(recordType ? { targetApp: recordType.app, targetType: recordType.type } : {}),
      ...(f.show === 'mine' && meId ? { assigneeUserId: meId } : {}),
      ...(f.branchId ? { branchId: f.branchId } : {}),
      ...(f.types.length > 0 ? { types: f.types } : {}),
      ...(f.priorities.length > 0 ? { priorities: f.priorities } : {}),
      ...(f.search.trim() ? { search: f.search.trim() } : {}),
      ...(bounds.dueFrom ? { dueFrom: bounds.dueFrom } : {}),
      ...(bounds.dueTo ? { dueTo: bounds.dueTo } : {}),
    };
  }

  private effectiveListStatuses(f: ActivitiesFilterState): ActivityStatus[] | undefined {
    if (f.statusesExplicit === null) return [...DEFAULT_LIST_STATUSES];
    return f.statusesExplicit.length > 0 ? f.statusesExplicit : undefined;
  }

  private effectiveCalendarStatuses(f: ActivitiesFilterState): ActivityStatus[] | undefined {
    if (!f.statusesExplicit || f.statusesExplicit.length === 0) return undefined;
    return f.statusesExplicit.length === ACTIVITY_STATUSES.length ? undefined : f.statusesExplicit;
  }

  private async loadData(params: {
    meId: string | null;
    view: ActivitiesView;
    filters: ActivitiesFilterState;
    page: number;
    pageSize: number;
    calendarMonth: Date;
  }): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(false);
    this.errorCorrelationId.set(null);
    this.forbiddenError.set(false);

    const scope = this.buildScopeFilter(params.filters, params.meId);
    const { dayStart, dayEnd } = localDayBounds();

    try {
      const summaryPromise = this.api.activitySummary(scope, dayStart, dayEnd);

      if (params.view === 'list') {
        const listPromise = this.api.listActivities({
          ...scope,
          statuses: this.effectiveListStatuses(params.filters),
          overdue: params.filters.overdue ? true : undefined,
          sortBy: 'dueAt',
          sortDir: params.filters.sortDir,
          page: params.page,
          limit: params.pageSize,
        });
        const [summaryRes, pageRes] = await Promise.all([summaryPromise, listPromise]);
        if (seq !== this.loadSeq) return;
        this.summary.set(summaryRes);
        this.rawListItems.set(pageRes.data);
        this.listTotal.set(pageRes.meta.total);
      } else if (params.view === 'board') {
        const lanePromises = ACTIVITY_STATUSES.map((status) =>
          this.api.listActivities({
            ...scope,
            statuses: [status],
            overdue: params.filters.overdue ? true : undefined,
            sortBy: 'dueAt',
            sortDir: params.filters.sortDir,
            page: 1,
            limit: BOARD_PAGE_LIMIT,
          }),
        );
        const [summaryRes, ...lanePages] = await Promise.all([summaryPromise, ...lanePromises]);
        if (seq !== this.loadSeq) return;
        this.summary.set(summaryRes);
        const byStatus = new Map(summaryRes.byStatus.map((item) => [item.status, item]));
        this.rawBoardLanes.set(
          ACTIVITY_STATUSES.map((status, index) => {
            const pageRes = lanePages[index];
            const bucket = byStatus.get(status);
            return {
              status,
              items: pageRes.data,
              total: bucket?.total ?? pageRes.meta.total,
              page: pageRes.meta.page,
              hasNext: pageRes.meta.hasNext,
              loadingMore: false,
              overdue: bucket?.overdue ?? 0,
              today: bucket?.today ?? 0,
              upcoming: bucket?.upcoming ?? 0,
            };
          }),
        );
      } else {
        const { gridStart, gridEndExclusive } = calendarMonthRange(params.calendarMonth);
        const from = gridStart.toISOString();
        const to = gridEndExclusive.toISOString();
        const calStatuses = this.effectiveCalendarStatuses(params.filters);
        const { dueFrom: _dueFrom, dueTo: _dueTo, ...calendarScope } = scope;
        const calendarPromise = this.api.listActivityCalendar({
          ...calendarScope,
          statuses: calStatuses,
          overdue: params.filters.overdue ? true : undefined,
          from,
          to,
        });
        const [summaryRes, calRes] = await Promise.all([summaryPromise, calendarPromise]);
        if (seq !== this.loadSeq) return;
        this.summary.set(summaryRes);
        this.rawCalendarItems.set(calRes.items);

        const noticeKey = JSON.stringify({
          scope,
          calStatuses,
          overdue: params.filters.overdue,
          from,
          to,
        });
        if (calRes.truncated && noticeKey !== this.lastTruncatedNoticeKey) {
          this.lastTruncatedNoticeKey = noticeKey;
          this.notify.warning(this.transloco.translate('wsActivities.calendar.truncatedToast'));
        } else if (!calRes.truncated && noticeKey === this.lastTruncatedNoticeKey) {
          this.lastTruncatedNoticeKey = '';
        }
      }
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (error instanceof ApiError && (error.code.startsWith('TENANT_MAINTENANCE_') || error.status === 429 || error.status === 422 || error.status === 400 || error.status === 413)) {
        this.notify.error(errorMessage(error, 'wsActivities', this.transloco));
      } else if (isForbiddenError(error)) {
        this.forbiddenError.set(true);
      } else {
        this.loadError.set(true);
        this.errorCorrelationId.set(correlationIdOf(error));
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async loadLookups(): Promise<void> {
    const [branchesRes, typesRes, appsRes] = await Promise.allSettled([
      this.lookups.allBranches(),
      this.api.listActivityTypes(),
      this.lookups.appsOverview(),
    ]);
    this.apps.set(appsRes.status === 'fulfilled' ? appsRes.value : []);
    if (branchesRes.status === 'fulfilled') {
      this.branches.set(branchesRes.value);
    }
    if (typesRes.status === 'fulfilled') {
      this.activityTypes.set(typesRes.value);
    }
  }

  private hasPermission(key: string, resource?: { branchId?: string | null }): boolean {
    const me = this.scope.me();
    if (!me) return false;
    if (me.isTenantOwner) return true;
    if (!me.permissions.includes(key)) return false;
    if (!resource?.branchId) return true;
    const permission = me.permissionScopes[key];
    return permission?.tenantWide === true || permission?.branchIds.includes(resource.branchId) === true;
  }

  private async openLinkedActivity(id: string): Promise<void> {
    if (this.linkedActivityId === id) return;
    this.linkedActivityId = id;
    try {
      this.openActivityWindow(await this.api.getActivity(id));
    } catch (error) {
      this.notify.error(errorMessage(error, 'activities', this.transloco));
    } finally {
      await this.router.navigate([], {
        relativeTo: this.route, queryParams: { activityId: null }, queryParamsHandling: 'merge', replaceUrl: true,
      });
      this.linkedActivityId = null;
    }
  }

  private currentUrlState(): ParsedActivitiesUrl {
    return {
      view: this.view(),
      filters: this.filters(),
      page: this.page(),
      pageSize: this.pageSize(),
      calendarMonth: this.calendarMonth(),
    };
  }

  private syncUrl(): void {
    const params = buildUrlParams(this.currentUrlState());
    this.lastWrittenQueryKey = JSON.stringify(params);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      replaceUrl: true,
    });
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }
}
