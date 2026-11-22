import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerCalendarTime,
  tablerClock,
  tablerCopy,
  tablerLayoutDashboard,
  tablerPlus,
  tablerRefresh,
  tablerShare,
  tablerStar,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { formatDate, formatDateTime } from '../../../../../shared/ui/chart/chart-format';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { ExportMenu } from '../../../../../shared/widgets/dashboard/exports/export-menu/export-menu';
import type { ExportPeriod } from '../../../../../shared/widgets/dashboard/exports/exports.model';
import type { DashboardDetail } from '../dashboards.model';
import { DashboardSwitcher } from '../dashboard-switcher/dashboard-switcher';
import { selectScopeTranslation } from '../../../../../shared/widgets/dashboard/scope-translation';

@Component({
  selector: 'app-dashboard-header',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Badge,
    ActionsMenu,
    DashboardSwitcher,
    ExportMenu,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-dash-page', alias: 'dashPage' },
      { scope: 'analytics', alias: 'analytics' },
      { scope: 'chart', alias: 'chart' },
    ),
    provideIcons({
      tablerLayoutDashboard,
      tablerClock,
      tablerRefresh,
      tablerAdjustmentsHorizontal,
      tablerPlus,
      tablerCopy,
      tablerShare,
      tablerStar,
      tablerStarFill,
      tablerCalendarTime,
      tablerTrash,
    }),
  ],
  templateUrl: './dashboard-header.html',
  host: { class: 'block min-w-0' },
})
export class DashboardHeader {
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly dashPageTr = toSignal(selectScopeTranslation(this.transloco, 'crm-dash-page', 'dashPage'));
  private readonly analyticsTr = toSignal(this.transloco.selectTranslation('analytics'));
  private readonly chartTr = toSignal(this.transloco.selectTranslation('chart'));

  readonly detail = input.required<DashboardDetail>();
  readonly generatedAt = input<string | null>(null);
  readonly editing = input(false);
  readonly canCustomize = input(false);
  readonly canEdit = input(false);
  readonly canAddWidget = input(true);
  readonly busy = input(false);
  readonly exportPeriod = input<ExportPeriod>({ from: '', to: '' });
  readonly exportFilters = input<object | null>(null);
  readonly switcherRefresh = input(0);

  readonly customize = output<void>();
  readonly editLayout = output<void>();
  readonly addWidget = output<void>();
  readonly refresh = output<void>();
  readonly menu = output<string>();
  readonly switchTo = output<string>();

  protected readonly isBaseDashboard = computed(() => {
    const d = this.detail();
    return d.kind === 'DASHBOARD' && Boolean(d.blueprintKey && d.accessLevel === 'VIEW');
  });

  protected readonly sharedTagText = computed<string | null>(() => {
    this.dashPageTr();
    this.analyticsTr();
    this.language();
    const d = this.detail();
    if (this.isBaseDashboard()) return null;
    if (d.accessLevel === 'OWNER' || !d.ownerName) return null;
    const level = this.transloco.translate(`analytics.access.${d.accessLevel}`);
    return this.transloco.translate('dashPage.sharedBy', {
      name: d.ownerName,
      level,
    });
  });

  protected readonly updatedText = computed<string | null>(() => {
    this.dashPageTr();
    this.chartTr();
    const iso = this.generatedAt();
    if (!iso) return null;
    const lang = this.language();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);
    const datePart = formatDate(iso, lang, chartT);
    const dateTimePart = formatDateTime(iso, lang, chartT);
    const timeMatch = /(\d{2}:\d{2})$/.exec(dateTimePart);
    const timePart = timeMatch ? timeMatch[1] : '';
    return this.transloco.translate('dashPage.updated', {
      date: datePart,
      time: timePart,
    });
  });

  protected readonly menuItems = computed<ActionItem[]>(() => {
    this.dashPageTr();
    this.language();
    const d = this.detail();
    const items: ActionItem[] = [];

    if (can('crm.dashboards.create')) {
      items.push({
        id: 'duplicate',
        title: this.transloco.translate('dashPage.menu.duplicate'),
        icon: 'tablerCopy',
        tile: 'bg-icon-gray',
      });
    }

    if (d.accessLevel === 'OWNER' && can('crm.dashboards.share')) {
      items.push({
        id: 'share',
        title: this.transloco.translate('dashPage.menu.share'),
        icon: 'tablerShare',
        tile: 'bg-icon-violet',
      });
    }

    if (!d.isDefault) {
      items.push({
        id: 'setDefault',
        title: this.transloco.translate('dashPage.menu.setDefault'),
        icon: 'tablerStar',
        tile: 'bg-icon-orange',
      });
    }

    items.push({
      id: 'toggleFavorite',
      title: this.transloco.translate(
        d.isFavorite ? 'dashPage.menu.unfavourite' : 'dashPage.menu.favourite',
      ),
      icon: d.isFavorite ? 'tablerStarFill' : 'tablerStar',
      tile: 'bg-icon-orange',
    });

    if (can('crm.subscriptions.manage')) {
      items.push({
        id: 'schedule',
        title: this.transloco.translate('dashPage.menu.schedule'),
        icon: 'tablerCalendarTime',
        tile: 'bg-icon-blue',
      });
    }

    if (d.accessLevel === 'OWNER' && can('crm.dashboards.delete')) {
      items.push({
        id: 'delete',
        title: this.transloco.translate('dashPage.menu.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      });
    }

    return items;
  });

  protected onMenuSelected(selection: ActionSelection): void {
    this.menu.emit(selection.id);
  }
}
