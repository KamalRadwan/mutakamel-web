import { Component, computed, inject, input, output } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCopy,
  tablerHeart,
  tablerLayoutDashboard,
  tablerLayoutGrid,
  tablerPencil,
  tablerPlus,
  tablerRefresh,
  tablerShare,
  tablerStar,
  tablerTemplate,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../shared/ui/actions-menu/actions-menu';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Button } from '../../../../shared/ui/button/button';
import { DashboardSwitcher } from '../dashboard-switcher/dashboard-switcher';
import type { DashboardDetail, NavItem } from '../trade-dashboard.model';

export type DashboardHeaderAction =
  | 'newBlank'
  | 'newTemplate'
  | 'editDetails'
  | 'duplicate'
  | 'share'
  | 'setDefault'
  | 'toggleFavorite'
  | 'delete';

function formatTime24(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

@Component({
  selector: 'app-trade-dashboard-header',
  imports: [NgIcon, TranslocoPipe, Button, Badge, ActionsMenu, DashboardSwitcher],
  providers: [
    provideIcons({
      tablerLayoutDashboard,
      tablerRefresh,
      tablerLayoutGrid,
      tablerPlus,
      tablerTemplate,
      tablerPencil,
      tablerCopy,
      tablerShare,
      tablerStar,
      tablerHeart,
      tablerTrash,
    }),
  ],
  templateUrl: './dashboard-header.html',
  host: { class: 'block min-w-0' },
})
export class DashboardHeader {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly detail = input.required<DashboardDetail>();
  readonly navigationItems = input<readonly NavItem[]>([]);
  readonly generatedAt = input<string | null>(null);
  readonly editing = input(false);
  readonly canManage = input(true);
  readonly canEdit = input(false);
  readonly isOwner = input(false);
  readonly busy = input(false);

  readonly switchTo = output<string>();
  readonly refresh = output<void>();
  readonly editLayout = output<void>();
  readonly menuAction = output<DashboardHeaderAction>();

  protected readonly sharedLabel = computed<string | null>(() => {
    this.i18n();
    const d = this.detail();
    if (this.isOwner() || !d.ownerName) return null;
    const accessKey = d.accessLevel === 'EDIT' ? 'EDIT' : 'VIEW';
    const level = this.transloco.translate(`tradeDashboard.header.access.${accessKey}`);
    return this.transloco.translate('tradeDashboard.header.sharedBy', {
      name: d.ownerName,
      level,
    });
  });

  protected readonly updatedTime = computed<string | null>(() => formatTime24(this.generatedAt()));

  protected readonly menuItems = computed<ActionItem[]>(() => {
    this.i18n();
    if (!this.canManage()) return [];

    const d = this.detail();
    const items: ActionItem[] = [
      {
        id: 'newBlank',
        title: this.transloco.translate('tradeDashboard.header.menu.newDashboard'),
        icon: 'tablerPlus',
        tile: 'bg-icon-green',
      },
      {
        id: 'newTemplate',
        title: this.transloco.translate('tradeDashboard.header.menu.fromTemplate'),
        icon: 'tablerTemplate',
        tile: 'bg-icon-blue',
      },
    ];

    if (this.canEdit()) {
      items.push({
        id: 'editDetails',
        title: this.transloco.translate('tradeDashboard.header.menu.editDetails'),
        icon: 'tablerPencil',
        tile: 'bg-icon-orange',
      });
    }

    items.push({
      id: 'duplicate',
      title: this.transloco.translate('tradeDashboard.header.menu.duplicate'),
      icon: 'tablerCopy',
      tile: 'bg-icon-gray',
    });

    if (this.isOwner()) {
      items.push({
        id: 'share',
        title: this.transloco.translate('tradeDashboard.header.menu.share'),
        icon: 'tablerShare',
        tile: 'bg-icon-violet',
      });
    }

    if (!d.isDefault) {
      items.push({
        id: 'setDefault',
        title: this.transloco.translate('tradeDashboard.header.menu.setDefault'),
        icon: 'tablerStar',
        tile: 'bg-icon-orange',
      });
    }

    items.push({
      id: 'toggleFavorite',
      title: this.transloco.translate(
        d.isFavorite
          ? 'tradeDashboard.header.menu.removeFavorite'
          : 'tradeDashboard.header.menu.addFavorite',
      ),
      icon: 'tablerHeart',
      tile: 'bg-icon-orange',
    });

    if (this.isOwner()) {
      items.push({
        id: 'delete',
        title: this.transloco.translate('tradeDashboard.header.menu.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      });
    }

    return items;
  });

  protected onMenuSelected(selection: ActionSelection): void {
    this.menuAction.emit(selection.id as DashboardHeaderAction);
  }
}
