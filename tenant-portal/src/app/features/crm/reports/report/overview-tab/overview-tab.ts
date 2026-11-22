import { Component, computed, inject, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerChartBar,
  tablerEye,
  tablerInfoCircle,
  tablerPin,
  tablerTable,
  tablerExclamationCircle,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { isChartKind, type Panel, type PanelCoverage } from '../../../../../shared/widgets/dashboard/analytics.model';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { governedTargetParts } from '../../../../../shared/widgets/dashboard/governed-target';
import {
  LOADING_VIEW,
  viewFromPanel,
  warningReasonKeys,
  type PanelView,
} from '../../../../../shared/widgets/dashboard/panel-state';
import { WidgetBody } from '../../../../../shared/widgets/dashboard/widget-body/widget-body';
import type { ActionItem } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { formatDate, formatNumber, formatRateN, formatShortDate } from '../../../../../shared/ui/chart/chart-format';
import { WidgetFrame } from '../../../../../shared/ui/widget-frame/widget-frame';
import { defaultPanelHeight } from '../report.api';
import { ReportState } from '../report-state';
import { selectScopeTranslation } from '../../../../../shared/widgets/dashboard/scope-translation';

@Component({
  selector: 'app-report-overview-tab',
  imports: [NgIcon, TranslocoPipe, Badge, WidgetFrame, WidgetBody],
  providers: [
    provideIcons({
      tablerExclamationCircle,
      tablerTable,
      tablerChartBar,
      tablerEye,
      tablerInfoCircle,
      tablerPin,
    }),
  ],
  templateUrl: './overview-tab.html',
  host: { class: 'block min-w-0' },
})
export class OverviewTab {
  private readonly router = inject(Router);
  private readonly state = inject(ReportState);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly reportScope = toSignal(selectScopeTranslation(this.transloco, 'crm-rep-report', 'repReport'));
  private readonly widgetsScope = toSignal(this.transloco.selectTranslation('dashboard-widgets'));
  private readonly analyticsScope = toSignal(this.transloco.selectTranslation('analytics'));
  private readonly chartScope = toSignal(this.transloco.selectTranslation('chart'));

  readonly pinPanel = output<string>();
  readonly openRecords = output<string>();
  readonly openExplain = output<string>();

  protected readonly tablePanels = signal<ReadonlySet<string>>(new Set());
  protected readonly panels = computed<Panel[]>(() => this.state.manifest()?.panels ?? []);

  protected gridColumn(panel: Panel): string {
    const desktop = panel.layout?.['desktop'];
    if (desktop) {
      return `${desktop.x + 1} / span ${desktop.w}`;
    }
    if (panel.visualization === 'TABLE') return 'span 12 / span 12';
    if (panel.visualization === 'METRIC_CARD' || panel.visualization === 'PROGRESS_CARD') {
      return 'span 3 / span 3';
    }
    return 'span 6 / span 6';
  }

  protected gridRow(panel: Panel): string {
    const desktop = panel.layout?.['desktop'];
    const h = desktop?.h ?? defaultPanelHeight(panel.visualization);
    const span = Math.max(1, Math.ceil((h + 1) / 2));
    return `span ${span} / span ${span}`;
  }

  protected panelTitle(panel: Panel): string {
    return this.language() === 'ar' ? panel.title.ar : panel.title.en;
  }

  protected panelTag(panel: Panel): string | null {
    this.i18n();
    this.chartScope();
    const manifest = this.state.manifest();
    if (!manifest) return null;
    const lang = this.language();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);

    const from = manifest.period.from;
    const to = manifest.period.to;
    const fromShort = formatShortDate(from, lang, 'DAY', chartT);
    const toShort = formatShortDate(to, lang, 'DAY', chartT);
    const periodText = from === to ? fromShort : `${fromShort} – ${toShort}`;

    const currency = this.resolvePanelCurrency(panel);
    return currency ? `${periodText} · ${currency}` : periodText;
  }

  protected panelHint(panel: Panel): string {
    this.i18n();
    this.analyticsScope();
    this.chartScope();
    const manifest = this.state.manifest();
    const lang = this.language();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);

    const parts: string[] = [];

    if (panel.experimental) {
      parts.push(this.transloco.translate('analytics.readiness.EXPERIMENTAL'));
    }

    parts.push(...this.coverageParts(panel.coverage, lang, chartT));

    const exec = panel.result;
    const view = viewFromPanel(panel);
    if (view.partialAccess) {
      parts.push(this.transloco.translate('analytics.common.partialAccess'));
    }
    parts.push(...governedTargetParts(exec, (key, params) => this.transloco.translate(key, params)));
    if (view.status === 'READY' || view.status === 'PARTIAL') {
      const targetShown = new Set(['TARGET_NOT_SET', 'SOURCE_PERMISSION_REQUIRED', 'CALENDAR_HOURS_MISSING']);
      for (const key of warningReasonKeys(view)) {
        if (!targetShown.has(key.slice(key.lastIndexOf('.') + 1))) {
          parts.push(this.transloco.translate(key));
        }
      }
    }

    const num = exec?.details?.['numerator'];
    const den = exec?.details?.['denominator'];
    if (typeof num === 'number' && typeof den === 'number') {
      parts.push(formatRateN(num, den, lang, chartT));
    }

    const basis = exec?.meta.timeBasis;
    if (basis === 'COHORT' && manifest) {
      const month = formatShortDate(manifest.period.from, lang, 'MONTH', chartT);
      const date = formatShortDate(manifest.period.to, lang, 'DAY', chartT);
      parts.push(this.transloco.translate('analytics.common.cohortObserved', { month, date }));
      // The cohort month is still maturing when the data was generated within that same month.
      const generatedAt = exec?.meta.generatedAt;
      if (generatedAt && generatedAt.slice(0, 7) === manifest.period.to.slice(0, 7)) {
        parts.push(this.transloco.translate('analytics.common.maturing', { month }));
      }
    } else if (
      basis === 'CURRENT' ||
      basis === 'AS_OF' ||
      basis === 'EVENT' ||
      basis === 'SNAPSHOT' ||
      basis === 'FACT'
    ) {
      parts.push(this.transloco.translate(`analytics.basis.${basis}`));
    }

    return parts.filter(Boolean).join(' · ');
  }

  protected panelView(panel: Panel): PanelView {
    if (this.state.loadingPanels().has(panel.panelKey)) {
      return LOADING_VIEW;
    }
    return viewFromPanel(panel);
  }

  protected isTableShown(panelKey: string): boolean {
    return this.tablePanels().has(panelKey);
  }

  protected menuItemsFor(panel: Panel): ActionItem[] {
    this.i18n();
    this.reportScope();
    this.widgetsScope();
    this.language();

    const ready = panel.state === 'READY' || panel.state === 'PARTIAL';
    const items: ActionItem[] = [];

    if (ready && isChartKind(panel.visualization)) {
      const shown = this.isTableShown(panel.panelKey);
      items.push({
        id: 'toggleTable',
        title: this.transloco.translate(
          shown ? 'dashboardWidgets.menu.hideTable' : 'dashboardWidgets.menu.showTable',
        ),
        icon: shown ? 'tablerChartBar' : 'tablerTable',
        tile: shown ? 'bg-icon-blue' : 'bg-icon-navy',
      });
    }

    if (ready && panel.pageable) {
      items.push({
        id: 'viewRecords',
        title: this.transloco.translate('repReport.menu.viewRecords'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      });
    }

    if (panel.receiptId && (ready || panel.state === 'EMPTY')) {
      items.push({
        id: 'explain',
        title: this.transloco.translate('dashboardWidgets.menu.explain'),
        icon: 'tablerInfoCircle',
        tile: 'bg-icon-teal',
      });
    }

    if (panel.pinnable && can('crm.dashboards.update')) {
      items.push({
        id: 'pin',
        title: this.transloco.translate('repReport.addToDashboard'),
        icon: 'tablerPin',
        tile: 'bg-icon-violet',
      });
    }

    return items;
  }

  protected onMenuAction(panel: Panel, actionId: string): void {
    switch (actionId) {
      case 'toggleTable':
        this.tablePanels.update((prev) => {
          const next = new Set(prev);
          if (next.has(panel.panelKey)) {
            next.delete(panel.panelKey);
          } else {
            next.add(panel.panelKey);
          }
          return next;
        });
        break;
      case 'viewRecords':
        this.openRecords.emit(panel.panelKey);
        break;
      case 'explain':
        this.openExplain.emit(panel.panelKey);
        break;
      case 'pin':
        this.pinPanel.emit(panel.panelKey);
        break;
    }
  }

  protected retryPanel(panelKey: string): void {
    void this.state.run({ panelKeys: [panelKey] });
  }

  protected onOpenReadiness(source: string): void {
    void this.router.navigate(['/crm/settings/data-readiness'], { queryParams: { source } });
  }

  protected partialTooltip(panel: Panel): string {
    this.i18n();
    this.analyticsScope();
    this.chartScope();
    const lang = this.language();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);
    const parts = this.coverageParts(panel.coverage, lang, chartT);
    const view = viewFromPanel(panel);
    if (view.partialAccess) {
      parts.push(this.transloco.translate('analytics.common.partialAccess'));
    }
    parts.push(...warningReasonKeys(view).map((key) => this.transloco.translate(key)));
    return parts.length > 0
      ? parts.join(' · ')
      : this.transloco.translate('analytics.state.PARTIAL');
  }

  private coverageParts(
    coverage: PanelCoverage | undefined,
    lang: 'ar' | 'en',
    chartT: (key: string, params?: Record<string, unknown>) => string,
  ): string[] {
    if (!coverage) return [];
    const parts: string[] = [];
    const tiers = coverage.tiers;
    const verified = tiers.VERIFIED ?? 0;
    const total =
      verified +
      (tiers.DERIVED ?? 0) +
      (tiers.UNVERIFIED ?? 0) +
      (tiers.BEFORE_TRACKING ?? 0) +
      (tiers.HISTORY_INCOMPLETE ?? 0);
    if (total > 0) {
      parts.push(
        this.transloco.translate('analytics.common.coverage', {
          n: formatNumber(verified, lang),
          total: formatNumber(total, lang),
        }),
      );
    }
    if (coverage.note) {
      parts.push(lang === 'ar' ? coverage.note.ar : coverage.note.en);
    } else if (coverage.trackingSince) {
      parts.push(
        this.transloco.translate('analytics.common.trackingSince', {
          date: formatDate(coverage.trackingSince, lang, chartT),
        }),
      );
    }
    return parts;
  }

  private resolvePanelCurrency(panel: Panel): string | null {
    const exec = panel.result;
    if (exec) {
      if (exec.meta.currency) return exec.meta.currency;
      const moneySeries = exec.series.find((s) => s.unit === 'MONEY' && s.currency);
      if (moneySeries?.currency) return moneySeries.currency;
      const res = exec.result;
      if (res && 'currencyCode' in res && res.currencyCode) return res.currencyCode;
    }
    if (panel.table?.columns.some((c) => c.unit === 'MONEY')) {
      const fromFilter = this.state.request().filters?.['currencyCode'];
      return typeof fromFilter === 'string' && fromFilter ? fromFilter : 'EGP';
    }
    return null;
  }
}
