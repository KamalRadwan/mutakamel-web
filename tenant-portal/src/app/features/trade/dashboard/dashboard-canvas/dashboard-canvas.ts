import { Component, computed, inject, input, model, output, signal } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerChartBar, tablerExternalLink, tablerTable } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { ScopeState } from '../../../../core/scope/scope';
import type { ActionItem } from '../../../../shared/ui/actions-menu/actions-menu';
import { isChartKind } from '../../../../shared/ui/chart/chart.model';
import type { WidgetExecution } from '../../../../shared/ui/chart/chart.model';
import { WidgetFrame } from '../../../../shared/ui/widget-frame/widget-frame';
import { WidgetState } from '../../../../shared/ui/widget-state/widget-state';
import { DashboardGrid, type GridItem } from '../../../../shared/widgets/dashboard/dashboard-grid/dashboard-grid';
import type { PanelView } from '../../../../shared/widgets/dashboard/panel-state';
import { WidgetBody } from '../../../../shared/widgets/dashboard/widget-body/widget-body';
import { WidgetTable } from '../../../../shared/widgets/dashboard/widget-table/widget-table';
import { formatDate, formatMoney, formatQty } from '../../shared/trade-format';
import type {
  Catalog,
  DashboardDetail,
  Placement,
  RunResult,
  UnavailablePlacement,
} from '../trade-dashboard.model';
import {
  adaptWidget,
  toGridItem,
  TRADE_H,
  TRADE_X,
  type AdaptedWidget,
  type AdapterContext,
  type GridSizeLimits,
} from '../trade-widget-adapter';
import { drillLink } from '../trade-drill-links';

const FALLBACK_VIZ_SIZE: GridSizeLimits = {
  minimumWidth: 1,
  minimumHeight: 1,
  maximumWidth: 12,
  maximumHeight: 24,
};

const DATE_ROW_COLUMNS = new Set(['validUntil', 'expectedDate', 'createdAt']);
const QTY_ROW_COLUMNS = new Set([
  'orderedQuantity',
  'receivedQuantity',
  'onHand',
  'reserved',
  'available',
]);

function formatTime24(iso: string | null | undefined, timeZone: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = (zone: string | undefined) =>
    new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      ...(zone ? { timeZone: zone } : {}),
    }).format(d);
  try {
    return parts(timeZone);
  } catch {
    return parts(undefined);
  }
}

export function toUnavailableGridItem(u: UnavailablePlacement, title: string): GridItem {
  return {
    ...toGridItem(
      { id: u.placementId, x: u.x, y: u.y, width: u.width, height: u.height },
      { minimumWidth: u.width, minimumHeight: u.height, maximumWidth: u.width, maximumHeight: u.height },
    ),
    label: title,
  };
}

export function buildDashboardGridItems(
  detail: DashboardDetail,
  catalog: Catalog | null,
  unavailableTitle: string,
): GridItem[] {
  const vizMap = new Map((catalog?.visualizations ?? []).map((v) => [v.type, v]));
  const available = detail.placements.map((p): GridItem => {
    const viz = vizMap.get(p.widget.visualizationType) ?? FALLBACK_VIZ_SIZE;
    return {
      ...toGridItem(p, viz),
      label: p.widget.displaySpec.title ?? p.widget.name,
    };
  });
  const unavailable = detail.unavailablePlacements.map((u) =>
    toUnavailableGridItem(u, unavailableTitle),
  );
  return [...available, ...unavailable];
}

@Component({
  selector: 'app-trade-dashboard-canvas',
  imports: [TranslocoPipe, WidgetFrame, WidgetState, DashboardGrid, WidgetBody, WidgetTable],
  providers: [provideIcons({ tablerTable, tablerChartBar, tablerExternalLink })],
  templateUrl: './dashboard-canvas.html',
  host: { class: 'block min-w-0 flex-1' },
})
export class DashboardCanvas {
  private readonly router = inject(Router);
  private readonly scope = inject(ScopeState);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly detail = input.required<DashboardDetail>();
  readonly run = input<RunResult | null>(null);
  readonly catalog = input<Catalog | null>(null);
  readonly editing = input(false);
  readonly items = model<GridItem[]>([]);
  readonly loadingIds = input<ReadonlySet<string>>(new Set());
  readonly sourcesDown = input(false);
  readonly selectedId = model<string | null>(null);
  readonly removeDisabledReason = input('');

  readonly retry = output<string>();
  readonly removePlacement = output<string>();
  readonly layoutChange = output<GridItem[]>();

  /** Arrow keys move or resize by whole Trade cells. */
  protected readonly gridStep = { cols: TRADE_X, rows: TRADE_H };

  private readonly showTableByWidget = signal<Record<string, boolean>>({});

  protected readonly placementById = computed<Record<string, Placement>>(() => {
    const map: Record<string, Placement> = {};
    for (const p of this.detail().placements) {
      map[p.id] = p;
    }
    return map;
  });

  protected readonly unavailableById = computed<Record<string, UnavailablePlacement>>(() => {
    const map: Record<string, UnavailablePlacement> = {};
    for (const u of this.detail().unavailablePlacements) {
      map[u.placementId] = u;
    }
    return map;
  });

  protected readonly adaptedByPlacement = computed<Record<string, AdaptedWidget>>(() => {
    this.i18n();
    const d = this.detail();
    const run = this.run();
    if (!run) return {};

    const lang = this.language();
    const companies = this.scope.companies();
    const companyMap = new Map(
      companies.map((c) => [c.id, lang === 'ar' ? c.nameAr : c.nameEn]),
    );
    const currentCompanyId = this.scope.company().id;

    const translateLabel = (labelKey: string): string => {
      const normalized = labelKey.replaceAll('.', '_');
      const fullKey = `tradeDashboard.labels.${normalized}`;
      const translated = this.transloco.translate(fullKey);
      if (translated && translated !== fullKey) return translated;
      const parts = labelKey.split('.');
      return parts[parts.length - 1] ?? labelKey;
    };

    const translateColumn = (name: string): string => {
      const fullKey = `tradeDashboard.columns.${name}`;
      const translated = this.transloco.translate(fullKey);
      return translated && translated !== fullKey ? translated : name;
    };

    const companyCurrencyMap = new Map(companies.map((c) => [c.id, c.currencyCode ?? null]));

    const formatRowValue = (col: string, value: unknown, row: Record<string, unknown>): string => {
      if (value === null || value === undefined) return '';
      const raw = String(value);
      if (col === 'grandTotal') {
        const code = typeof row['currencyCode'] === 'string' ? row['currencyCode'] : null;
        return formatMoney(code, raw);
      }
      if (QTY_ROW_COLUMNS.has(col)) return formatQty(raw);
      if (DATE_ROW_COLUMNS.has(col)) {
        const formatted = formatDate(raw, lang);
        return formatted === '—' ? raw : formatted;
      }
      if (col === 'lifecycleStatus') {
        return translateLabel(`trade.document.status.${raw.toLowerCase()}`);
      }
      if (col === 'severity') {
        return translateLabel(`trade.exception.severity.${raw.toLowerCase()}`);
      }
      return raw;
    };

    const result: Record<string, AdaptedWidget> = {};
    for (const p of d.placements) {
      const widgetTitle = p.widget.displaySpec.title ?? p.widget.name;
      const ctx: AdapterContext = {
        currentCompanyId,
        companyName: (id) => companyMap.get(id) ?? id,
        companyCurrency: (id) => companyCurrencyMap.get(id) ?? null,
        label: translateLabel,
        column: translateColumn,
        rowValue: formatRowValue,
        widgetTitle,
        comparisonMode: run.normalizedFilters.comparisonMode,
        normalized: run.normalizedFilters,
        generatedAt: run.generatedAt,
      };
      result[p.id] = adaptWidget(p, run.widgets[p.widgetId], ctx);
    }
    return result;
  });

  protected readonly frameHintByPlacement = computed<Record<string, string>>(() => {
    this.i18n();
    const lang = this.language();
    const d = this.detail();
    const run = this.run();
    const adaptedMap = this.adaptedByPlacement();
    const companyMap = new Map(
      this.scope.companies().map((c) => [c.id, lang === 'ar' ? c.nameAr : c.nameEn]),
    );

    const hints: Record<string, string> = {};
    for (const p of d.placements) {
      const adapted = adaptedMap[p.id];
      if (!adapted) {
        hints[p.id] = '';
        continue;
      }

      const parts: string[] = [];
      const time = formatTime24(adapted.asOf ?? run?.generatedAt, run?.timeZone);
      if (time) {
        parts.push(
          this.transloco.translate('tradeDashboard.frame.asOf', {
            time: `\u2066${time}\u2069`,
          }),
        );
      }

      if (adapted.others.length > 0) {
        const list = adapted.others
          .map((o) => {
            const name = companyMap.get(o.companyId) ?? o.companyId;
            const formatted = o.currencyCode
              ? formatMoney(o.currencyCode, o.value)
              : adapted.execution.meta.unit === 'PERCENT'
                ? `${formatQty(o.value)}%`
                : formatQty(o.value);
            return `${name} \u2066${formatted}\u2069`;
          })
          .join('; ');
        parts.push(this.transloco.translate('tradeDashboard.frame.otherCompanies', { list }));
      }

      if (isChartKind(adapted.kind) && adapted.execution.series.length > 1) {
        parts.push(this.transloco.translate('tradeDashboard.frame.multiSeriesNote'));
      }

      hints[p.id] = parts.join(' · ');
    }
    return hints;
  });

  protected readonly menuItemsByPlacement = computed<Record<string, ActionItem[]>>(() => {
    this.i18n();
    if (this.editing()) return {};

    const d = this.detail();
    const run = this.run();
    const adaptedMap = this.adaptedByPlacement();
    const showTableMap = this.showTableByWidget();
    const result: Record<string, ActionItem[]> = {};

    for (const p of d.placements) {
      const menu: ActionItem[] = [];
      const adapted = adaptedMap[p.id];
      const widgetResult = run?.widgets[p.widgetId];
      const isReady = adapted?.execution.state === 'READY';

      if (isReady && isChartKind(adapted.kind) && !adapted.table) {
        const showingTable = Boolean(showTableMap[p.widgetId]);
        menu.push({
          id: 'toggleTable',
          title: this.transloco.translate(
            showingTable ? 'tradeDashboard.frame.showChart' : 'tradeDashboard.frame.showTable',
          ),
          icon: showingTable ? 'tablerChartBar' : 'tablerTable',
          tile: showingTable ? 'bg-icon-blue' : 'bg-icon-teal',
        });
      }

      // Portal route from the drill target code; the backend relativePath is ignored.
      if (drillLink(widgetResult?.drillThrough?.targetCode)) {
        menu.push({
          id: 'openList',
          title: this.transloco.translate('tradeDashboard.frame.openList'),
          icon: 'tablerExternalLink',
          tile: 'bg-icon-blue',
        });
      }

      result[p.id] = menu;
    }

    return result;
  });

  protected onGridLayoutChange(nextItems: GridItem[]): void {
    this.layoutChange.emit(nextItems);
  }

  protected onMenuSelected(placement: Placement, actionId: string): void {
    if (actionId === 'toggleTable') {
      this.showTableByWidget.update((cur) => ({
        ...cur,
        [placement.widgetId]: !cur[placement.widgetId],
      }));
      return;
    }
    if (actionId === 'openList') {
      const run = this.run();
      const link = drillLink(run?.widgets[placement.widgetId]?.drillThrough?.targetCode, run?.normalizedFilters);
      if (link) {
        void this.router.navigate([link.path], { queryParams: link.queryParams });
      }
    }
  }

  protected isShowingTable(widgetId: string): boolean {
    return Boolean(this.showTableByWidget()[widgetId]);
  }

  protected readyPanelView(execution: WidgetExecution): PanelView {
    return {
      status: 'READY',
      execution,
      reasonCode: null,
      sourceKey: null,
      coverage: null,
      receiptId: null,
      computedAt: null,
      experimental: false,
    };
  }
}
