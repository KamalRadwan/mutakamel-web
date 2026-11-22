import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlarm,
  tablerChevronsLeft,
  tablerChevronsRight,
  tablerCircleDot,
  tablerInbox,
  tablerMail,
  tablerMap2,
  tablerPhone,
  tablerPlus,
  tablerSquareCheck,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { rectInPage } from '../../../../../shared/ui/overlay/zoom';
import {
  ACTIVITY_STATUSES,
  Activity,
  ActivityStatus,
  TYPE_LOOK,
  dueState,
  isOpen,
} from '../../../../../shared/widgets/activities/activities.model';
import {
  BoardLaneState,
  DUE_BADGE_CLASSES,
  DUE_EDGE_CLASSES,
  avatarToneFor,
  formatActivityDate,
  primaryTargetOf,
  userInitialsFromName,
} from '../operations-activities.model';

const COLLAPSED_KEY = 'ws.operations.activities.board.collapsed';
const DEFAULT_COLLAPSED: readonly ActivityStatus[] = ['DONE', 'CANCELLED'];
const SKELETON_CARDS = [1, 2, 3] as const;

function readCollapsed(): ReadonlySet<ActivityStatus> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return new Set(DEFAULT_COLLAPSED);
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set(DEFAULT_COLLAPSED);
    const valid = new Set<string>(ACTIVITY_STATUSES);
    return new Set(parsed.filter((item): item is ActivityStatus => typeof item === 'string' && valid.has(item)));
  } catch {
    return new Set(DEFAULT_COLLAPSED);
  }
}

function writeCollapsed(ids: ReadonlySet<ActivityStatus>): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage unavailable
  }
}

@Component({
  selector: 'app-activities-board',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Button],
  providers: [
    provideIcons({
      tablerChevronsLeft,
      tablerChevronsRight,
      tablerInbox,
      tablerPlus,
      tablerSquareCheck,
      tablerPhone,
      tablerUsers,
      tablerMail,
      tablerMap2,
      tablerAlarm,
      tablerCircleDot,
    }),
  ],
  templateUrl: './activities-board.html',
  styleUrl: './activities-board.css',
  host: { class: 'flex shrink-0 flex-col' },
})
export class ActivitiesBoard {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  private readonly boardRoot = viewChild.required<ElementRef<HTMLElement>>('boardRoot');

  readonly lanes = input.required<readonly BoardLaneState[]>();
  readonly loading = input(false);
  readonly canCreate = input(false);
  readonly canComplete = input.required<(activity: Activity) => boolean>();
  readonly canCancel = input.required<(activity: Activity) => boolean>();

  readonly loadMore = output<ActivityStatus>();
  readonly openActivity = output<Activity>();
  readonly completeActivity = output<Activity>();
  readonly cancelActivity = output<Activity>();
  readonly newActivity = output<void>();

  protected readonly collapsed = signal<ReadonlySet<ActivityStatus>>(readCollapsed());
  protected readonly columnMinHeight = signal(0);
  protected readonly skeletonCards = SKELETON_CARDS;
  protected readonly typeLook = TYPE_LOOK;
  protected readonly dueBadgeClasses = DUE_BADGE_CLASSES;
  protected readonly dueEdgeClasses = DUE_EDGE_CLASSES;
  protected readonly primaryTargetOf = primaryTargetOf;
  protected readonly dueState = dueState;
  protected readonly isOpen = isOpen;
  protected readonly initials = userInitialsFromName;
  protected readonly avatarTone = avatarToneFor;

  private measureTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly actionsBuilder = computed<(item: Activity) => ActionItem[]>(() => {
    this.i18n();
    const canCompleteFn = this.canComplete();
    const canCancelFn = this.canCancel();
    const t = (key: string) => this.transloco.translate(key);

    return (item: Activity) => {
      const open = isOpen(item);
      const completeAllowed = open && canCompleteFn(item);
      const cancelAllowed = open && canCancelFn(item);
      const closedReason = t('wsActivities.actions.alreadyClosed');
      const noPermReason = t('wsActivities.actions.noPermission');

      return [
        {
          id: 'open',
          title: t('wsActivities.actions.open'),
          icon: 'tablerEye',
          tile: 'bg-icon-blue',
        },
        {
          id: 'complete',
          title: t('wsActivities.actions.complete'),
          icon: 'tablerCheck',
          tile: completeAllowed ? 'bg-icon-green' : 'bg-icon-gray',
          disabled: !completeAllowed,
          reason: !open ? closedReason : !canCompleteFn(item) ? noPermReason : undefined,
        },
        {
          id: 'cancel',
          title: t('wsActivities.actions.cancel'),
          icon: 'tablerX',
          tile: cancelAllowed ? 'bg-icon-red' : 'bg-icon-gray',
          danger: true,
          disabled: !cancelAllowed,
          reason: !open ? closedReason : !canCancelFn(item) ? noPermReason : undefined,
        },
      ];
    };
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(() => {
      this.lanes();
      if (this.measureTimer !== null) {
        clearTimeout(this.measureTimer);
      }
      this.measureTimer = setTimeout(() => {
        this.measureTimer = null;
        requestAnimationFrame(() => this.measureColumns());
      });
    });

    afterNextRender(() => {
      const board = this.boardRoot().nativeElement;
      const main = board.closest('main');
      const observer = new ResizeObserver(() => this.measureColumns());
      if (main) observer.observe(main);
      const page = board.parentElement;
      if (page) observer.observe(page);
      observer.observe(board);
      this.measureColumns();
      destroyRef.onDestroy(() => {
        observer.disconnect();
        if (this.measureTimer !== null) {
          clearTimeout(this.measureTimer);
          this.measureTimer = null;
        }
      });
    });
  }

  protected toggleCollapse(status: ActivityStatus): void {
    const next = new Set(this.collapsed());
    if (next.has(status)) next.delete(status);
    else next.add(status);
    this.collapsed.set(next);
    writeCollapsed(next);
  }

  protected segments(lane: BoardLaneState): { key: string; count: number; color: string }[] {
    if (lane.status === 'DONE') {
      return lane.total > 0 ? [{ key: 'done', count: lane.total, color: 'bg-success' }] : [];
    }
    if (lane.status === 'CANCELLED') {
      return [];
    }
    const list: { key: string; count: number; color: string }[] = [];
    if (lane.overdue > 0) list.push({ key: 'overdue', count: lane.overdue, color: 'bg-danger' });
    if (lane.today > 0) list.push({ key: 'today', count: lane.today, color: 'bg-warning' });
    if (lane.upcoming > 0) list.push({ key: 'upcoming', count: lane.upcoming, color: 'bg-success' });
    return list;
  }

  protected dueSummary(lane: BoardLaneState): string {
    this.i18n();
    if (lane.status === 'DONE' || lane.status === 'CANCELLED') {
      return `${this.transloco.translate(`activities.statuses.${lane.status}`)}: ${lane.total}`;
    }
    return this.transloco.translate('wsActivities.board.dueSummary', {
      overdue: lane.overdue,
      today: lane.today,
      upcoming: lane.upcoming,
    });
  }

  protected formatDueDate(iso: string): string {
    return formatActivityDate(iso, this.language());
  }

  protected onCardKeydown(event: KeyboardEvent, item: Activity): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openActivity.emit(item);
    }
  }

  protected onAction(item: Activity, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
        this.openActivity.emit(item);
        break;
      case 'complete':
        this.completeActivity.emit(item);
        break;
      case 'cancel':
        this.cancelActivity.emit(item);
        break;
    }
  }

  private measureColumns(): void {
    const board = this.boardRoot().nativeElement;
    const main = board.closest('main');
    if (!main) return;
    const offsetInMain = rectInPage(board).top - rectInPage(main).top + main.scrollTop;
    const scrollbar = board.offsetHeight - board.clientHeight;
    const mainPadBottom = parseFloat(getComputedStyle(main).paddingBottom) || 0;
    const bottomGap = 8 + 12 + scrollbar + mainPadBottom;
    const min = Math.max(0, Math.floor(main.clientHeight - offsetInMain - bottomGap));
    this.columnMinHeight.set(min);
    requestAnimationFrame(() => {
      if (board.offsetHeight - board.clientHeight !== scrollbar) {
        this.measureColumns();
      }
    });
  }
}
