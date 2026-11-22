import { Component, computed, inject, input, output } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBriefcase,
  tablerBroadcast,
  tablerBuildingSkyscraper,
  tablerBuildingStore,
  tablerCashRegister,
  tablerEye,
  tablerMapPin,
  tablerPencil,
  tablerPlayerPause,
  tablerPlayerPlay,
  tablerPlugConnected,
  tablerPlus,
  tablerRefresh,
  tablerShoppingCart,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { formatDate } from '../../../shared/trade-format';
import type { ChannelType } from '../../../shared/trade-foundation.model';
import { BADGE_CLASS, CHANNEL_TYPE_KEY, CHANNEL_TYPE_TILE, type TileSpec } from '../../../shared/trade-labels';
import type { ChannelRow } from '../channels.model';

interface BranchCountParts {
  before: string;
  hasCount: boolean;
  after: string;
}

const COUNT_PLACEHOLDER = '__BRANCH_COUNT__';

@Component({
  selector: 'app-channel-table',
  imports: [NgIcon, TranslocoPipe, Button, ActionsMenu],
  providers: [
    provideIcons({
      tablerBriefcase,
      tablerCashRegister,
      tablerShoppingCart,
      tablerBuildingSkyscraper,
      tablerBuildingStore,
      tablerMapPin,
      tablerPlugConnected,
      tablerEye,
      tablerPencil,
      tablerPlayerPause,
      tablerPlayerPlay,
      tablerBroadcast,
      tablerPlus,
      tablerRefresh,
    }),
  ],
  templateUrl: './channel-table.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class ChannelTable {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  readonly rows = input.required<readonly ChannelRow[]>();
  readonly loading = input(false);
  readonly loadFailed = input(false);
  readonly hasAnyChannels = input(false);
  readonly companyName = input('');
  readonly canManage = input(true);
  readonly busyChannelId = input<string | null>(null);

  readonly open = output<ChannelRow>();
  readonly toggleStatus = output<ChannelRow>();
  readonly create = output<void>();
  readonly clearSearch = output<void>();
  readonly retry = output<void>();

  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly gridCols =
    'grid-cols-channel-row-actions';
  protected readonly typeKeys = CHANNEL_TYPE_KEY;
  protected readonly activeBadgeClass = BADGE_CLASS.success;
  protected readonly inactiveBadgeClass = BADGE_CLASS.muted;

  protected readonly actionItemsById = computed<Record<string, ActionItem[]>>(() => {
    this.i18n();
    this.language();
    const canManage = this.canManage();
    const busyId = this.busyChannelId();
    const map: Record<string, ActionItem[]> = {};

    for (const row of this.rows()) {
      const items: ActionItem[] = [
        {
          id: 'open',
          title: this.transloco.translate('tradeChannels.actions.open'),
          icon: 'tablerEye',
          tile: 'bg-icon-blue',
        },
      ];

      if (canManage) {
        items.push({
          id: 'edit',
          title: this.transloco.translate('tradeChannels.actions.edit'),
          icon: 'tablerPencil',
          tile: 'bg-icon-navy',
        });

        if (row.status === 'ACTIVE') {
          items.push({
            id: 'toggle',
            title: this.transloco.translate('tradeChannels.actions.deactivate'),
            icon: 'tablerPlayerPause',
            tile: 'bg-icon-gray',
            disabled: busyId === row.id,
          });
        } else {
          items.push({
            id: 'toggle',
            title: this.transloco.translate('tradeChannels.actions.activate'),
            icon: 'tablerPlayerPlay',
            tile: 'bg-icon-green',
            disabled: busyId === row.id,
          });
        }
      }

      map[row.id] = items;
    }

    return map;
  });

  protected typeTile(channelType: ChannelType): TileSpec {
    return CHANNEL_TYPE_TILE[channelType];
  }

  protected formatUpdated(iso: string): string {
    return formatDate(iso, this.language());
  }

  protected branchCountParts(count: number): BranchCountParts {
    this.i18n();
    const form =
      count === 0 ? 'zero' : count === 1 ? 'one' : count === 2 ? 'two' : count <= 10 ? 'few' : 'other';
    const raw = this.transloco.translate(`tradeChannels.table.branchCount.${form}`, {
      count: COUNT_PLACEHOLDER,
    });
    const idx = raw.indexOf(COUNT_PLACEHOLDER);
    if (idx < 0) {
      return { before: raw, hasCount: false, after: '' };
    }
    return {
      before: raw.slice(0, idx),
      hasCount: true,
      after: raw.slice(idx + COUNT_PLACEHOLDER.length),
    };
  }

  protected onRowKeydown(event: KeyboardEvent, row: ChannelRow): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open.emit(row);
    }
  }

  protected onAction(row: ChannelRow, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.open.emit(row);
        break;
      case 'toggle':
        this.toggleStatus.emit(row);
        break;
    }
  }
}
