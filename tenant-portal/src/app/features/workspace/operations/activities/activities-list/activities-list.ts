import { Component, computed, inject, input, output } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlarm,
  tablerChevronDown,
  tablerChevronUp,
  tablerCircleDot,
  tablerMail,
  tablerMap2,
  tablerPhone,
  tablerSquareCheck,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { Pagination } from '../../../../../shared/ui/pagination/pagination';
import {
  Activity,
  TYPE_LOOK,
  dueState,
  isOpen,
} from '../../../../../shared/widgets/activities/activities.model';
import {
  ActivitiesSortDir,
  DUE_BADGE_CLASSES,
  PAGE_SIZES,
  PRIORITY_BADGE_CLASSES,
  STATUS_BADGE_CLASSES,
  avatarToneFor,
  formatActivityDateTime,
  primaryTargetOf,
  userInitialsFromName,
} from '../operations-activities.model';

const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;

@Component({
  selector: 'app-activities-list',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Button, Pagination],
  providers: [
    provideIcons({
      tablerChevronUp,
      tablerChevronDown,
      tablerSquareCheck,
      tablerPhone,
      tablerUsers,
      tablerMail,
      tablerMap2,
      tablerAlarm,
      tablerCircleDot,
    }),
  ],
  templateUrl: './activities-list.html',
  host: { class: 'flex flex-1 flex-col gap-8' },
})
export class ActivitiesList {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  readonly items = input.required<readonly Activity[]>();
  readonly total = input.required<number>();
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly sortDir = input.required<ActivitiesSortDir>();
  readonly loading = input(false);
  readonly canComplete = input.required<(activity: Activity) => boolean>();
  readonly canCancel = input.required<(activity: Activity) => boolean>();

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly sortDirToggle = output<void>();
  readonly openActivity = output<Activity>();
  readonly completeActivity = output<Activity>();
  readonly cancelActivity = output<Activity>();
  readonly clearFilters = output<void>();

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly typeLook = TYPE_LOOK;
  protected readonly dueBadgeClasses = DUE_BADGE_CLASSES;
  protected readonly priorityBadgeClasses = PRIORITY_BADGE_CLASSES;
  protected readonly statusBadgeClasses = STATUS_BADGE_CLASSES;
  protected readonly primaryTargetOf = primaryTargetOf;
  protected readonly dueState = dueState;
  protected readonly isOpen = isOpen;
  protected readonly initials = userInitialsFromName;
  protected readonly avatarTone = avatarToneFor;

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

  protected formatDue(iso: string): string {
    return formatActivityDateTime(iso, this.language());
  }

  protected onRowKeydown(event: KeyboardEvent, item: Activity): void {
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
}
