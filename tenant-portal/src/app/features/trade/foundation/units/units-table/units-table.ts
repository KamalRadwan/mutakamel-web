import { Component, computed, inject, input, output } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerEye, tablerPencil, tablerToggleRight } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { formatDate } from '../../../shared/trade-format';
import type { Uom, UomStatus } from '../../../shared/trade-foundation.model';
import { BADGE_CLASS, UOM_STATUS_KEY, UOM_STATUS_TONE } from '../../../shared/trade-labels';
import { uomNameIn } from '../units.model';

@Component({
  selector: 'app-units-table',
  imports: [TranslocoPipe, ActionsMenu],
  providers: [provideIcons({ tablerEye, tablerPencil, tablerToggleRight })],
  templateUrl: './units-table.html',
  host: { class: 'block' },
})
export class UnitsTable {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  readonly units = input.required<readonly Uom[]>();
  readonly loading = input(false);
  readonly canManage = input(true);
  readonly busyIds = input<ReadonlySet<string>>(new Set());

  readonly openUnit = output<Uom>();
  readonly retireUnit = output<Uom>();
  readonly activateUnit = output<Uom>();

  protected readonly skeletonRows = [0, 1, 2, 3, 4, 5];

  protected readonly gridColumns = computed(() =>
    this.canManage()
      ? 'grid-cols-trade-unit-row-actions'
      : 'grid-cols-trade-unit-row',
  );

  protected currentName(unit: Uom): string {
    return uomNameIn(unit, this.language());
  }

  protected englishName(unit: Uom): string {
    return unit.localizedNames['en'] ?? '—';
  }

  protected arabicName(unit: Uom): string {
    return unit.localizedNames['ar'] ?? '—';
  }

  protected statusBadgeClass(status: UomStatus): string {
    return BADGE_CLASS[UOM_STATUS_TONE[status]];
  }

  protected statusLabelKey(status: UomStatus): string {
    return UOM_STATUS_KEY[status];
  }

  protected formattedDate(iso: string): string {
    return formatDate(iso, this.language());
  }

  protected rowActions(unit: Uom): ActionItem[] {
    this.i18n();
    const busy = this.busyIds().has(unit.id);
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('tradeUnits.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'edit',
        title: this.transloco.translate('tradeUnits.actions.edit'),
        icon: 'tablerPencil',
        tile: 'bg-icon-navy',
      },
    ];

    if (unit.status === 'ACTIVE') {
      items.push({
        id: 'retire',
        title: this.transloco.translate('tradeUnits.actions.retire'),
        icon: 'tablerToggleRight',
        tile: 'bg-icon-orange',
        disabled: busy,
      });
    } else {
      items.push({
        id: 'activate',
        title: this.transloco.translate('tradeUnits.actions.activate'),
        icon: 'tablerToggleRight',
        tile: 'bg-icon-green',
        disabled: busy,
      });
    }

    return items;
  }

  protected onAction(unit: Uom, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.openUnit.emit(unit);
        break;
      case 'retire':
        this.retireUnit.emit(unit);
        break;
      case 'activate':
        this.activateUnit.emit(unit);
        break;
    }
  }

  protected onRowKeydown(event: KeyboardEvent, unit: Uom): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openUnit.emit(unit);
    }
  }
}
