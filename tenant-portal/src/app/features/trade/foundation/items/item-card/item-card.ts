import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBan,
  tablerBox,
  tablerCopy,
  tablerEye,
  tablerPackages,
  tablerPencil,
  tablerPlayerPause,
  tablerPlayerPlay,
  tablerTool,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { ScopeState } from '../../../../../core/scope/scope';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../../shared/ui/actions-menu/actions-menu';
import { tradeContext } from '../../../shared/trade-api';
import { formatMoney } from '../../../shared/trade-format';
import { itemName } from '../../../shared/trade-foundation.api';
import type { ItemRow } from '../../../shared/trade-foundation.model';
import { itemThumbUrl, releaseThumbUrl } from '../../../shared/trade-image';
import {
  ALLOWED_ITEM_STATUS_MOVES,
  BADGE_CLASS,
  ITEM_KIND_KEY,
  ITEM_KIND_TILE,
  ITEM_STATUS_KEY,
  ITEM_STATUS_TONE,
} from '../../../shared/trade-labels';

export type ItemActionId = 'open' | 'edit' | 'activate' | 'deactivate' | 'discontinue' | 'copyCode';

export function itemActions(
  item: ItemRow,
  canManage: boolean,
  translate: (key: string) => string,
): ActionItem[] {
  const items: ActionItem[] = [
    {
      id: 'open',
      title: translate('tradeShared.common.open'),
      icon: 'tablerEye',
      tile: 'bg-icon-blue',
    },
  ];

  const legalMoves = ALLOWED_ITEM_STATUS_MOVES[item.status];
  if (canManage) {
    items.push({
      id: 'edit',
      title: translate('tradeShared.common.edit'),
      icon: 'tablerPencil',
      tile: 'bg-icon-navy',
    });
    if (legalMoves.includes('ACTIVE')) {
      items.push({
        id: 'activate',
        title: translate('tradeItems.actions.activate'),
        icon: 'tablerPlayerPlay',
        tile: 'bg-icon-green',
      });
    }
    if (legalMoves.includes('INACTIVE')) {
      items.push({
        id: 'deactivate',
        title: translate('tradeItems.actions.deactivate'),
        icon: 'tablerPlayerPause',
        tile: 'bg-icon-gray',
      });
    }
  }

  items.push({
    id: 'copyCode',
    title: translate('tradeItems.actions.copyCode'),
    icon: 'tablerCopy',
    tile: 'bg-icon-teal',
  });

  if (canManage && legalMoves.includes('DISCONTINUED')) {
    items.push({
      id: 'discontinue',
      title: translate('tradeItems.actions.discontinue'),
      icon: 'tablerBan',
      tile: 'bg-icon-red',
      danger: true,
    });
  }

  return items;
}

@Component({
  selector: 'app-item-card',
  imports: [NgIcon, TranslocoPipe, ActionsMenu],
  providers: [
    provideIcons({
      tablerBox,
      tablerTool,
      tablerPackages,
      tablerEye,
      tablerPencil,
      tablerPlayerPlay,
      tablerPlayerPause,
      tablerCopy,
      tablerBan,
    }),
  ],
  templateUrl: './item-card.html',
  host: { class: 'block min-w-0' },
})
export class ItemCard {
  private readonly scopeState = inject(ScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  readonly item = input.required<ItemRow>();
  readonly companyView = input(false);
  readonly canManage = input(true);
  readonly showThumb = input(true);
  readonly elevated = input(false);

  readonly open = output<void>();
  readonly action = output<ItemActionId>();

  private readonly thumbUrlSignal = signal<string | null>(null);
  protected readonly thumbUrl = this.thumbUrlSignal.asReadonly();

  protected readonly name = computed(() => itemName(this.item(), this.language()));
  protected readonly kindTile = computed(() => ITEM_KIND_TILE[this.item().itemKind]);
  protected readonly kindKey = computed(() => ITEM_KIND_KEY[this.item().itemKind]);
  protected readonly statusKey = computed(() => ITEM_STATUS_KEY[this.item().status]);
  protected readonly statusBadgeClass = computed(() => BADGE_CLASS[ITEM_STATUS_TONE[this.item().status]]);
  protected readonly eligibilityBadgeClass = BADGE_CLASS.published;
  protected readonly categoryName = computed(() => this.item().categorySummary?.name ?? null);
  protected readonly categoryPath = computed(() => {
    const summary = this.item().categorySummary;
    if (!summary) return '';
    return summary.path.map((part) => part.name).join(' › ');
  });

  protected readonly priceText = computed(() => {
    const elig = this.item().eligibility;
    if (!elig) return '—';
    return formatMoney(elig.currencyCode, elig.salesPrice);
  });

  protected readonly menuLabel = computed(() => {
    this.i18n();
    return this.transloco.translate('tradeItems.actions.label', { name: this.name() });
  });

  protected readonly actions = computed(() => {
    this.i18n();
    return itemActions(this.item(), this.canManage(), (key) => this.transloco.translate(key));
  });

  constructor() {
    let seq = 0;
    let activeUrl: string | null = null;
    const setThumb = (next: string | null) => {
      if (activeUrl && activeUrl !== next) {
        releaseThumbUrl(activeUrl);
      }
      activeUrl = next;
      this.thumbUrlSignal.set(next);
    };

    effect(() => {
      const current = this.item();
      const enabled = this.showThumb();
      const ctx = tradeContext(this.scopeState, 'BRANCH');
      const loadId = ++seq;
      if (!enabled || !current.image) {
        setThumb(null);
        return;
      }
      void itemThumbUrl(current.id, current.image, ctx)
        .catch(() => null)
        .then((url) => {
          if (loadId !== seq) {
            releaseThumbUrl(url);
            return;
          }
          setThumb(url);
        });
    });

    inject(DestroyRef).onDestroy(() => {
      seq += 1;
      releaseThumbUrl(activeUrl);
      activeUrl = null;
    });
  }

  protected onCardClick(): void {
    this.open.emit();
  }

  protected onActionSelected(selection: ActionSelection): void {
    this.action.emit(selection.id as ItemActionId);
  }
}
