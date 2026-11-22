import { Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerApps,
  tablerBox,
  tablerCalculator,
  tablerChevronDown,
  tablerChevronRight,
  tablerMinus,
  tablerPlus,
  tablerPuzzle,
  tablerTrendingUp,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { ModuleUsage, SeatUsage } from '../../../seats/seats.model';
import { SubscriptionAddonSelection, SubscriptionBaseItem } from '../../billing.model';
import { changeLink } from '../../shared/change-link';
import { catalogueNames } from '../../shared/catalogue-names';
import { formatUnitPrice, formatUsd } from '../../shared/money';

interface AppVisual {
  readonly tile: string;
  readonly icon: string;
}

const APP_VISUALS: Readonly<Record<string, AppVisual>> = {
  crm: { tile: 'bg-icon-blue', icon: 'tablerUsers' },
  trade: { tile: 'bg-icon-orange', icon: 'tablerBox' },
  accounting: { tile: 'bg-icon-gray', icon: 'tablerCalculator' },
};

const DEFAULT_APP_VISUAL: AppVisual = {
  tile: 'bg-icon-violet',
  icon: 'tablerApps',
};

@Component({
  selector: 'app-items-table',
  imports: [NgIcon, TranslocoPipe, ActionsMenu],
  providers: [
    provideIcons({
      tablerApps,
      tablerBox,
      tablerCalculator,
      tablerChevronDown,
      tablerChevronRight,
      tablerMinus,
      tablerPlus,
      tablerPuzzle,
      tablerTrendingUp,
      tablerUsers,
    }),
  ],
  templateUrl: './items-table.html',
  host: { class: 'block' },
})
export class ItemsTable {
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly bsubReady = toSignal(this.transloco.selectTranslation('ws-billing-subscription'));

  readonly baseItems = input.required<SubscriptionBaseItem[]>();
  readonly addonSelections = input.required<SubscriptionAddonSelection[]>();
  readonly seatUsage = input<SeatUsage | null>(null);
  readonly canChange = input(true);
  readonly disabledReason = input<string | null>(null);

  protected readonly formatUsd = formatUsd;
  protected readonly formatUnitPrice = formatUnitPrice;
  protected readonly expandedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly names = computed(() => {
    this.i18n();
    return catalogueNames(this.transloco);
  });

  private readonly usageByModule = computed(() => {
    const map = new Map<string, ModuleUsage>();
    for (const mod of this.seatUsage()?.modules ?? []) {
      map.set(mod.moduleKey, mod);
    }
    return map;
  });

  protected readonly addonsByParent = computed(() => {
    const map = new Map<string, SubscriptionAddonSelection[]>();
    for (const addon of this.addonSelections()) {
      const list = map.get(addon.parentItemId);
      if (list) {
        list.push(addon);
      } else {
        map.set(addon.parentItemId, [addon]);
      }
    }
    return map;
  });

  protected readonly baseActions = computed<ActionItem[]>(() => {
    this.i18n();
    this.bsubReady();
    const locked = !this.canChange();
    const reason = locked ? (this.disabledReason() ?? undefined) : undefined;
    return [
      {
        id: 'add-seats',
        title: this.transloco.translate('bsub.items.actions.addSeats'),
        icon: 'tablerPlus',
        tile: 'bg-icon-green',
        disabled: locked,
        reason,
      },
      {
        id: 'upgrade-tier',
        title: this.transloco.translate('bsub.items.actions.upgradeTier'),
        icon: 'tablerTrendingUp',
        tile: 'bg-icon-blue',
        disabled: locked,
        reason,
      },
      {
        id: 'add-addon',
        title: this.transloco.translate('bsub.items.actions.addAddon'),
        icon: 'tablerPuzzle',
        tile: 'bg-icon-violet',
      },
      {
        id: 'reduce-seats',
        title: this.transloco.translate('bsub.items.actions.reduceSeats'),
        icon: 'tablerMinus',
        tile: 'bg-icon-orange',
      },
    ];
  });

  protected readonly addonActions = computed<ActionItem[]>(() => {
    this.i18n();
    this.bsubReady();
    const locked = !this.canChange();
    const reason = locked ? (this.disabledReason() ?? undefined) : undefined;
    return [
      {
        id: 'add-seats',
        title: this.transloco.translate('bsub.items.actions.addSeats'),
        icon: 'tablerPlus',
        tile: 'bg-icon-green',
        disabled: locked,
        reason,
      },
    ];
  });

  protected appVisual(applicationKey: string): AppVisual {
    return APP_VISUALS[applicationKey] ?? DEFAULT_APP_VISUAL;
  }

  protected moduleUsageFor(applicationKey: string): ModuleUsage | null {
    return this.usageByModule().get(applicationKey) ?? null;
  }

  protected addonsFor(parentItemId: string): SubscriptionAddonSelection[] {
    return this.addonsByParent().get(parentItemId) ?? [];
  }

  protected isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  protected toggleExpand(id: string): void {
    this.expandedIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  protected onBaseAction(item: SubscriptionBaseItem, selection: ActionSelection): void {
    switch (selection.id) {
      case 'add-seats': {
        const target = changeLink({ kind: 'seats', itemId: item.id });
        void this.router.navigate([target.path], { queryParams: target.queryParams });
        break;
      }
      case 'upgrade-tier': {
        const target = changeLink({ kind: 'tier', itemId: item.id, tierId: '' });
        void this.router.navigate([target.path], { queryParams: target.queryParams });
        break;
      }
      case 'add-addon': {
        void this.router.navigate(['/workspace/billing/catalogue'], {
          queryParams: { app: item.applicationKey },
        });
        break;
      }
      case 'reduce-seats': {
        void this.router.navigate(['/workspace/billing/subscription/seats/reduce'], {
          queryParams: { module: item.applicationKey },
        });
        break;
      }
    }
  }

  protected onAddonAction(addon: SubscriptionAddonSelection, selection: ActionSelection): void {
    if (selection.id !== 'add-seats') return;
    const target = changeLink({ kind: 'seats', itemId: addon.id });
    void this.router.navigate([target.path], { queryParams: target.queryParams });
  }
}
