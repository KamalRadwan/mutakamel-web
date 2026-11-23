import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlarm,
  tablerCalendarEvent,
  tablerCircleDot,
  tablerMail,
  tablerMap2,
  tablerPhone,
  tablerPlus,
  tablerSquareCheck,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { errorMessage } from '../../../../../core/api/api-errors';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { ActivitiesApi } from '../../../../../shared/widgets/activities/activities.api';
import {
  Activity,
  ActivityStatus,
  ActivitySummary,
  DueState,
  TYPE_LOOK,
  dueState,
  isOpen,
} from '../../../../../shared/widgets/activities/activities.model';
import { RecordActivities, RecordTarget } from '../../../../../shared/widgets/activities/record-activities/record-activities';
import { hasNextPage } from './activity-page';

export type RecordActivityTargetType = 'LEAD' | 'CUSTOMER_PROFILE' | 'OPPORTUNITY' | 'PARTY';
type ActivityFilter = 'open' | 'done' | 'all';

interface DayGroup {
  key: string;
  kind: 'today' | 'yesterday' | 'tomorrow' | 'date';
  formattedDate: string;
  items: Activity[];
}

const PAGE_LIMIT = 20;
const SKELETON_ROWS = [1, 2, 3, 4, 5];

const DUE_BADGE: Record<DueState, string> = {
  OVERDUE: 'bg-danger text-on-danger',
  TODAY: 'bg-warning text-on-warning',
  UPCOMING: 'bg-success text-on-success',
};

const DUE_DOT: Record<DueState, string> = {
  OVERDUE: 'bg-danger',
  TODAY: 'bg-warning',
  UPCOMING: 'bg-success',
};

const FILTER_STATUSES: Record<ActivityFilter, ActivityStatus[] | undefined> = {
  open: ['PLANNED', 'IN_PROGRESS'],
  done: ['DONE'],
  all: undefined,
};

@Component({
  selector: 'app-record-activities-tab',
  imports: [NgIcon, TranslocoPipe, Button, Field, Segmented, RecordActivities],
  providers: [
    provideTranslocoScope(
      'activities',
      { scope: 'record-activities-tab', alias: 'recordActivitiesTab' },
    ),
    provideIcons({
      tablerPlus,
      tablerCalendarEvent,
      tablerSquareCheck,
      tablerPhone,
      tablerUsers,
      tablerMail,
      tablerMap2,
      tablerAlarm,
      tablerCircleDot,
    }),
  ],
  templateUrl: './record-activities-tab.html',
})
export class RecordActivitiesTab {
  private static nextId = 0;
  protected readonly uid = `record-activities-tab-${++RecordActivitiesTab.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly activitiesApi = inject(ActivitiesApi);
  private readonly notify = inject(Notify);
  private readonly recordActivities = viewChild.required(RecordActivities);

  readonly targetType = input.required<RecordActivityTargetType>();
  readonly targetId = input.required<string>();
  readonly label = input.required<string>();
  readonly canEdit = input(true);
  readonly newRequest = input(0);
  readonly countChange = output<{ open: number; total: number }>();

  protected readonly typeLook = TYPE_LOOK;
  protected readonly isOpen = isOpen;
  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly filter = signal<ActivityFilter>('open');
  protected readonly items = signal<Activity[]>([]);
  protected readonly page = signal(1);
  protected readonly hasNext = signal(false);
  protected readonly currentTotal = signal(0);
  protected readonly openCount = signal(0);
  protected readonly doneCount = signal(0);
  protected readonly allCount = signal(0);
  protected readonly summary = signal<ActivitySummary>({
    overdue: 0,
    today: 0,
    upcoming: 0,
    completedToday: 0,
    byStatus: [],
  });
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly loadFailed = signal(false);

  protected readonly filterOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    this.language();
    return [
      { value: 'open', label: this.transloco.translate('recordActivitiesTab.filter.open', { n: this.openCount() }) },
      { value: 'done', label: this.transloco.translate('recordActivitiesTab.filter.done', { n: this.doneCount() }) },
      { value: 'all', label: this.transloco.translate('recordActivitiesTab.filter.all', { n: this.allCount() }) },
    ];
  });

  protected readonly dayGroups = computed<DayGroup[]>(() => {
    const list = this.items();
    const activeFilter = this.filter();
    const lang = this.language();
    const now = new Date();
    const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
    const tomorrowMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    const locale = `${lang}-u-nu-latn`;
    const currentYear = now.getFullYear();

    const groups = new Map<string, DayGroup>();

    for (const item of list) {
      const iso = activeFilter === 'done' ? (item.completedAt ?? item.dueAt) : item.dueAt;
      const parsed = new Date(iso);
      const date = Number.isNaN(parsed.getTime()) ? now : parsed;
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayMs = dayStart.getTime();
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      let group = groups.get(key);
      if (!group) {
        let kind: DayGroup['kind'] = 'date';
        let formattedDate = '';
        if (dayMs === todayMs) {
          kind = 'today';
        } else if (dayMs === yesterdayMs) {
          kind = 'yesterday';
        } else if (dayMs === tomorrowMs) {
          kind = 'tomorrow';
        } else {
          formattedDate = new Intl.DateTimeFormat(locale, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            ...(date.getFullYear() !== currentYear ? { year: 'numeric' } : {}),
          }).format(dayStart);
        }
        group = { key, kind, formattedDate, items: [] };
        groups.set(key, group);
      }
      group.items.push(item);
    }

    return Array.from(groups.values());
  });

  private loadSeq = 0;
  private lastTargetKey: string | null = null;
  private lastHandledNewRequest = 0;

  constructor() {
    effect(() => {
      const type = this.targetType();
      const id = this.targetId();
      const key = `${type}:${id}`;
      if (!id || key === this.lastTargetKey) return;
      this.lastTargetKey = key;
      untracked(() => {
        this.filter.set('open');
        this.items.set([]);
        this.page.set(1);
        this.hasNext.set(false);
        this.currentTotal.set(0);
        this.openCount.set(0);
        this.doneCount.set(0);
        this.allCount.set(0);
        this.summary.set({ overdue: 0, today: 0, upcoming: 0, completedToday: 0, byStatus: [] });
        void this.loadData(true);
      });
    });

    effect(() => {
      const req = this.newRequest();
      if (req <= this.lastHandledNewRequest) {
        if (req < this.lastHandledNewRequest) {
          this.lastHandledNewRequest = req;
        }
        return;
      }
      this.lastHandledNewRequest = req;
      untracked(() => {
        if (this.targetId()) {
          this.openNew();
        }
      });
    });
  }

  protected reload(): void {
    void this.loadData(this.loadFailed() || this.items().length === 0);
  }

  protected onFilterChange(value: string | null): void {
    if (value !== 'open' && value !== 'done' && value !== 'all') return;
    if (value === this.filter()) return;
    this.filter.set(value);
    this.items.set([]);
    this.page.set(1);
    this.hasNext.set(false);
    this.currentTotal.set(0);
    void this.loadData(true);
  }

  protected openNew(): void {
    this.recordActivities().open(this.target(), { screen: 'new' });
  }

  protected openItem(item: Activity): void {
    this.recordActivities().open(this.target(), { screen: 'edit', activityId: item.id });
  }

  protected onRowKeydown(event: KeyboardEvent, item: Activity): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.openItem(item);
  }

  protected async loadMore(): Promise<void> {
    if (this.loading() || this.loadingMore() || !this.hasNext()) return;
    const type = this.targetType();
    const id = this.targetId();
    if (!id) return;

    const activeFilter = this.filter();
    const nextPage = this.page() + 1;
    const seq = ++this.loadSeq;
    this.loadingMore.set(true);

    try {
      const res = await this.activitiesApi.listActivities({
        targetApp: 'CRM',
        targetType: type,
        targetId: id,
        statuses: FILTER_STATUSES[activeFilter],
        page: nextPage,
        limit: PAGE_LIMIT,
        sortDir: activeFilter === 'open' ? 'ASC' : 'DESC',
      });
      if (seq !== this.loadSeq || this.targetType() !== type || this.targetId() !== id || this.filter() !== activeFilter) {
        return;
      }

      const existingIds = new Set(this.items().map((item) => item.id));
      const appended = res.data.filter((item) => !existingIds.has(item.id));
      this.items.update((prev) => [...prev, ...appended]);
      this.page.set(res.meta.page);
      this.hasNext.set(hasNextPage(res));
      this.currentTotal.set(res.meta.total);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      // Keep the already loaded timeline rows when paging fails.
      this.notify.error(errorMessage(error, 'activities', this.transloco));
    } finally {
      if (seq === this.loadSeq) {
        this.loadingMore.set(false);
      }
    }
  }

  protected dotClass(item: Activity): string {
    if (isOpen(item)) {
      return DUE_DOT[dueState(item) ?? 'UPCOMING'];
    }
    return item.status === 'DONE' ? 'bg-icon-gray' : 'bg-neutral-soft';
  }

  protected dueOf(item: Activity): DueState {
    return dueState(item) ?? 'UPCOMING';
  }

  protected dueBadgeClass(state: DueState): string {
    return DUE_BADGE[state];
  }

  protected formatSubline(item: Activity): string {
    const start = new Date(item.dueAt);
    const locale = `${this.language()}-u-nu-latn`;
    const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false });

    let timeText = '';
    if (!Number.isNaN(start.getTime())) {
      timeText = timeFmt.format(start);
      if (item.endsAt) {
        const end = new Date(item.endsAt);
        if (!Number.isNaN(end.getTime())) {
          timeText = `${timeText}–${timeFmt.format(end)}`;
        }
      }
    }

    const assignee = item.assigneeName?.trim() || null;
    const outcome = item.status === 'DONE' ? (item.outcome?.trim() || null) : null;
    return [timeText || null, assignee, outcome].filter(Boolean).join(' · ');
  }

  private target(): RecordTarget {
    return { app: 'CRM', type: this.targetType(), id: this.targetId(), label: this.label() };
  }

  private async loadData(showSkeleton: boolean): Promise<void> {
    const type = this.targetType();
    const id = this.targetId();
    if (!id) return;

    const activeFilter = this.filter();
    const seq = ++this.loadSeq;
    this.loadFailed.set(false);
    this.loadingMore.set(false);
    if (showSkeleton) {
      this.loading.set(true);
    }

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    try {
      const [listPage, openPage, donePage, allPage, summary] = await Promise.all([
        this.activitiesApi.listActivities({
          targetApp: 'CRM',
          targetType: type,
          targetId: id,
          statuses: FILTER_STATUSES[activeFilter],
          page: 1,
          limit: PAGE_LIMIT,
          sortDir: activeFilter === 'open' ? 'ASC' : 'DESC',
        }),
        this.activitiesApi.listActivities({
          targetApp: 'CRM',
          targetType: type,
          targetId: id,
          statuses: FILTER_STATUSES.open,
          page: 1,
          limit: 1,
        }),
        this.activitiesApi.listActivities({
          targetApp: 'CRM',
          targetType: type,
          targetId: id,
          statuses: FILTER_STATUSES.done,
          page: 1,
          limit: 1,
        }),
        this.activitiesApi.listActivities({
          targetApp: 'CRM',
          targetType: type,
          targetId: id,
          page: 1,
          limit: 1,
        }),
        this.activitiesApi.activitySummary({ app: 'CRM', type, id }, dayStart, dayEnd),
      ]);

      if (seq !== this.loadSeq || this.targetType() !== type || this.targetId() !== id || this.filter() !== activeFilter) {
        return;
      }

      this.items.set(listPage.data);
      this.page.set(listPage.meta.page);
      this.hasNext.set(hasNextPage(listPage));
      this.currentTotal.set(listPage.meta.total);
      this.openCount.set(openPage.meta.total);
      this.doneCount.set(donePage.meta.total);
      this.allCount.set(allPage.meta.total);
      this.summary.set(summary);
      this.countChange.emit({ open: openPage.meta.total, total: allPage.meta.total });
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loadFailed.set(true);
      this.notify.error(errorMessage(error, 'activities', this.transloco));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
