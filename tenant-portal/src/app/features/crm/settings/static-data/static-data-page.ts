import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowsSplit,
  tablerBolt,
  tablerCloudOff,
  tablerEye,
  tablerFolders,
  tablerList,
  tablerLock,
  tablerPaperclip,
  tablerShieldLock,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { errorMessage } from '../shared/settings-api';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { GroupDetailsModal } from './group-details-modal/group-details-modal';
import { getCrmStaticData } from './static-data.api';
import { StaticDataGroup, buildStaticDataGroups, matchesGroupSearch } from './static-data.groups';
import { CrmStaticData, Opt, labelIn } from './static-data.model';

const CAN_READ = true; // later from the session permissions

@Component({
  selector: 'app-static-data-page',
  imports: [TranslocoPipe, NgIcon, Button, ActionsMenu, SettingsFrame, GroupDetailsModal],
  providers: [
    provideTranslocoScope('settings', { scope: 'settings-static-data', alias: 'staticData' }),
    provideIcons({
      tablerList,
      tablerShieldLock,
      tablerFolders,
      tablerBolt,
      tablerPaperclip,
      tablerArrowsSplit,
      tablerLock,
      tablerCloudOff,
      tablerEye,
    }),
  ],
  templateUrl: './static-data-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class StaticDataPage {
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly detailsModal = viewChild.required(GroupDetailsModal);

  protected readonly canRead = CAN_READ;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  // Uses --table-head-h (36px) for the actions column.

  protected readonly data = signal<CrmStaticData | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<unknown>(null);
  protected readonly search = signal('');

  protected readonly groups = computed<StaticDataGroup[]>(() => {
    const current = this.data();
    return current ? buildStaticDataGroups(current) : [];
  });

  protected readonly visibleGroups = computed<StaticDataGroup[]>(() => {
    this.i18n();
    const lang = this.language();
    const term = this.search();
    const all = this.groups();
    if (!term.trim()) return all;
    return all.filter((group) =>
      matchesGroupSearch(group, term, this.transloco.translate(group.titleKey), lang),
    );
  });

  protected readonly initialLoadFailed = computed(
    () => !this.loading() && !this.data() && this.loadError() !== null,
  );
  protected readonly loadErrorText = computed(() => {
    this.i18n();
    const error = this.loadError();
    if (!error) return '';
    return errorMessage(error, 'staticData', this.transloco);
  });
  protected readonly isSearching = computed(() => this.search().trim().length > 0);
  protected readonly isEmptyCatalogue = computed(
    () => !this.loading() && this.data() !== null && this.groups().length === 0,
  );

  protected readonly rowActions = computed<ActionItem[]>(() => {
    this.i18n();
    return [
      {
        id: 'viewDetails',
        title: this.transloco.translate('staticData.viewDetails'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];
  });

  constructor() {
    if (this.canRead) {
      void this.reload();
    }
  }

  protected async reload(): Promise<void> {
    if (!this.canRead || this.loading()) return;
    this.loading.set(true);
    if (!this.data()) {
      this.loadError.set(null);
    }
    try {
      const result = await getCrmStaticData();
      this.data.set(result);
      this.loadError.set(null);
    } catch (error) {
      if (!this.data()) {
        this.loadError.set(error);
      } else {
        this.notify.error(this.transloco.translate('staticData.stale'));
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected clearSearch(): void {
    this.search.set('');
  }

  protected openDetails(group: StaticDataGroup): void {
    this.detailsModal().open(group);
  }

  protected onAction(group: StaticDataGroup, selection: ActionSelection): void {
    if (selection.id === 'viewDetails') {
      this.openDetails(group);
    }
  }

  protected previewOptions(group: StaticDataGroup): Opt[] {
    return group.options.slice(0, 4);
  }

  protected extraOptionsCount(group: StaticDataGroup): number {
    return Math.max(0, group.options.length - 4);
  }

  protected optionLabel(option: Opt): string {
    return labelIn(option.label, this.language());
  }

  protected showOpenToView(group: StaticDataGroup): boolean {
    return group.key === 'permissions' || group.key === 'eventOptions';
  }
}
