import { Component, computed, inject, input, output } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerX } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { DateRange, DateRangeValue } from '../../../../../shared/ui/date-range/date-range';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import {
  ACTIVITY_PRIORITIES,
  ACTIVITY_STATUSES,
  ACTIVITY_TYPES,
  ActivityPriority,
  ActivityStatus,
  ActivityType,
  ActivityTypeDefinition,
  TYPE_LOOK,
} from '../../../../../shared/widgets/activities/activities.model';
import { WorkspaceBranch } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { ActivitiesMultiSelect, MultiSelectOption } from '../activities-multi-select/activities-multi-select';
import {
  ALL_RECORD_TYPES,
  ActivitiesFilterState,
  ActivitiesShowScope,
  ActivitiesView,
  DEFAULT_LIST_STATUSES,
  PRIORITY_DOT_CLASSES,
  STATUS_DOT_CLASSES,
} from '../operations-activities.model';

@Component({
  selector: 'app-activities-filters',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    DateRange,
    Dropdown,
    Field,
    Segmented,
    ActivitiesMultiSelect,
  ],
  providers: [provideIcons({ tablerX })],
  templateUrl: './activities-filters.html',
  host: { class: 'block shrink-0' },
})
export class ActivitiesFilters {
  private static nextId = 0;
  protected readonly uid = `ws-activities-filters-${++ActivitiesFilters.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly panelId = input('ws-activities-filters');
  readonly view = input.required<ActivitiesView>();
  readonly state = input.required<ActivitiesFilterState>();
  readonly branches = input<readonly WorkspaceBranch[]>([]);
  readonly activityTypes = input<readonly ActivityTypeDefinition[]>([]);
  readonly hasActiveFilters = input(false);

  readonly patch = output<Partial<ActivitiesFilterState>>();
  readonly clearAll = output<void>();

  protected readonly showOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'mine', label: this.transloco.translate('wsActivities.filters.myActivities') },
      { value: 'all', label: this.transloco.translate('wsActivities.filters.allVisible') },
    ];
  });

  protected readonly typeOptions = computed<MultiSelectOption[]>(() => {
    this.i18n();
    const defs = this.activityTypes();
    const keys = defs.length > 0 ? defs.map((def) => def.key) : ACTIVITY_TYPES;
    return keys.map((key) => ({
      value: key,
      label: this.transloco.translate(`activities.types.${key}`),
      icon: TYPE_LOOK[key].icon,
      tile: TYPE_LOOK[key].tile,
    }));
  });

  protected readonly priorityOptions = computed<MultiSelectOption[]>(() => {
    this.i18n();
    return ACTIVITY_PRIORITIES.map((priority) => ({
      value: priority,
      label: this.transloco.translate(`activities.priorities.${priority}`),
      dot: PRIORITY_DOT_CLASSES[priority],
    }));
  });

  protected readonly statusOptions = computed<MultiSelectOption[]>(() => {
    this.i18n();
    return ACTIVITY_STATUSES.map((status) => ({
      value: status,
      label: this.transloco.translate(`activities.statuses.${status}`),
      dot: STATUS_DOT_CLASSES[status],
    }));
  });

  protected readonly selectedStatuses = computed<string[]>(() => {
    const explicit = this.state().statusesExplicit;
    if (this.view() === 'board') {
      return [...ACTIVITY_STATUSES];
    }
    if (explicit !== null) {
      return explicit;
    }
    return this.view() === 'list' ? [...DEFAULT_LIST_STATUSES] : [];
  });

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('wsActivities.filters.allBranches') },
      ...this.branches().map((branch) => ({ value: branch.id, label: branch.name })),
    ];
  });

  protected readonly recordTypeOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('wsActivities.filters.allRecordTypes') },
      ...ALL_RECORD_TYPES.map((item) => ({
        value: item.key,
        label: `${this.transloco.translate(`wsActivities.apps.${item.app}`)} · ${this.transloco.translate(
          `wsActivities.recordTypes.${item.app}.${item.type}`,
        )}`,
      })),
    ];
  });

  protected onShowChange(next: string | null): void {
    if (next !== 'mine' && next !== 'all') return;
    if (next === this.state().show) return;
    this.patch.emit({ show: next as ActivitiesShowScope });
  }

  protected onTypesChange(values: string[]): void {
    this.patch.emit({ types: values as ActivityType[] });
  }

  protected onPrioritiesChange(values: string[]): void {
    this.patch.emit({ priorities: values as ActivityPriority[] });
  }

  protected onStatusesChange(values: string[]): void {
    if (this.view() === 'board') return;
    this.patch.emit({ statusesExplicit: values as ActivityStatus[] });
  }

  protected onBranchChange(branchId: string): void {
    this.patch.emit({ branchId: branchId || null });
  }

  protected onRecordTypeChange(recordType: string): void {
    this.patch.emit({ recordType: recordType || null });
  }

  protected onDueRangeChange(dueRange: DateRangeValue | null): void {
    this.patch.emit({
      dueRange,
      ...(dueRange ? { overdue: false } : {}),
    });
  }

  protected clearOverdue(): void {
    this.patch.emit({ overdue: false });
  }
}
