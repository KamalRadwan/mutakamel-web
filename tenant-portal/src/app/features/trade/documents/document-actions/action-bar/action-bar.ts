import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowBackUp,
  tablerBan,
  tablerBolt,
  tablerChecks,
  tablerCircleCheck,
  tablerCircleX,
  tablerExternalLink,
  tablerPlayerPause,
  tablerPlayerPlay,
  tablerPrinter,
  tablerRefresh,
  tablerRubberStamp,
  tablerSend,
  tablerTransform,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import type { DocAction, ResolvedAction } from '../document-actions';
import { translationEvents } from '../../../../../core/i18n/translation-events';

@Component({
  selector: 'app-action-bar',
  imports: [NgIcon, TranslocoPipe, Button, ActionsMenu],
  providers: [
    provideTranslocoScope({ scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-documents-actions', alias: 'tda' }),
    provideIcons({
      tablerArrowBackUp,
      tablerBan,
      tablerBolt,
      tablerChecks,
      tablerCircleCheck,
      tablerCircleX,
      tablerExternalLink,
      tablerPlayerPause,
      tablerPlayerPlay,
      tablerPrinter,
      tablerRefresh,
      tablerRubberStamp,
      tablerSend,
      tablerTransform,
      tablerTrash,
    }),
  ],
  templateUrl: './action-bar.html',
  host: { class: 'inline-flex flex-wrap items-center gap-6' },
})
export class ActionBar {
  private static nextId = 0;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly uid = `action-bar-${++ActionBar.nextId}`;

  readonly actions = input<ResolvedAction[]>([]);
  readonly busy = input<DocAction | null>(null);

  readonly run = output<DocAction>();

  protected readonly barActions = computed(() => this.actions().filter((item) => item.placement === 'bar'));

  protected readonly menuActions = computed(() => {
    const items = this.actions().filter((item) => item.placement === 'menu');
    const regular = items.filter((item) => !item.danger);
    const danger = items.filter((item) => item.danger);
    return [...regular, ...danger];
  });

  protected readonly isMenuActionBusy = computed(() => {
    const currentBusy = this.busy();
    return currentBusy !== null && this.menuActions().some((item) => item.action === currentBusy);
  });

  protected readonly menuItems = computed<ActionItem[]>(() => {
    this.i18n();
    const isBusy = this.busy() !== null;
    return this.menuActions().map((item) => {
      const tile = item.danger
        ? 'bg-icon-red'
        : item.action === 'createSalesOrderDirect' || item.action === 'createPurchaseOrderDirect'
          ? 'bg-icon-green'
          : 'bg-icon-blue';
      return {
        id: item.action,
        title: this.transloco.translate(item.labelKey),
        icon: item.icon,
        tile,
        danger: item.danger,
        disabled: isBusy || item.disabledReasonKey !== null,
        reason: item.disabledReasonKey ? this.transloco.translate(item.disabledReasonKey) : undefined,
      };
    });
  });

  protected reasonId(action: DocAction): string {
    return `${this.uid}-why-${action}`;
  }

  protected trigger(item: ResolvedAction): void {
    if (this.busy() !== null || item.disabledReasonKey !== null) return;
    this.run.emit(item.action);
  }

  protected onMenuSelected(selection: ActionSelection): void {
    if (this.busy() !== null) return;
    const match = this.menuActions().find((item) => item.action === selection.id);
    if (!match || match.disabledReasonKey !== null) return;
    this.run.emit(match.action);
  }
}
