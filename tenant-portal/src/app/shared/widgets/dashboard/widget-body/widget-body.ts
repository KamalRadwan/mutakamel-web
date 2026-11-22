import { Component, computed, inject, input, output } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { ThemeState } from '../../../../core/theme/theme';
import { Chart } from '../../../ui/chart/chart';
import {
  isChartKind,
  type ChartContext,
  type ChartKind,
  type EntityRef,
  type ExactTable,
  type Visualization,
  type WidgetExecution,
} from '../../../ui/chart/chart.model';
import { toExactTable } from '../../../ui/chart/chart-table';
import { readChartColors } from '../../../ui/chart/chart-theme';
import { WidgetState } from '../../../ui/widget-state/widget-state';
import { ActivityFeedKind } from '../kinds/activity-feed/activity-feed';
import { AlertListKind } from '../kinds/alert-list/alert-list';
import { CalendarKind } from '../kinds/calendar/calendar';
import { LeaderboardKind } from '../kinds/leaderboard/leaderboard';
import { MetricCardKind } from '../kinds/metric-card/metric-card';
import { MultiKpiKind } from '../kinds/multi-kpi/multi-kpi';
import { ProgressCardKind } from '../kinds/progress-card/progress-card';
import { ScorecardKind } from '../kinds/scorecard/scorecard';
import { TableKind } from '../kinds/table/table';
import { TimelineKind } from '../kinds/timeline/timeline';
import { can } from '../analytics-permissions';
import { isThrottled, reasonKey, type PanelView } from '../panel-state';
import { WidgetTable } from '../widget-table/widget-table';

@Component({
  selector: 'app-widget-body',
  imports: [
    TranslocoPipe,
    Chart,
    WidgetState,
    WidgetTable,
    MetricCardKind,
    MultiKpiKind,
    ProgressCardKind,
    TableKind,
    LeaderboardKind,
    ScorecardKind,
    AlertListKind,
    ActivityFeedKind,
    TimelineKind,
    CalendarKind,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'dashboard-widgets', alias: 'dashboardWidgets' },
      { scope: 'chart', alias: 'chart' },
      { scope: 'analytics', alias: 'analytics' },
    ),
  ],
  templateUrl: './widget-body.html',
  host: { class: 'relative block size-full min-h-0' },
})
export class WidgetBody {
  private readonly language = inject(LanguageState).current;
  private readonly theme = inject(ThemeState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly kind = input.required<Visualization>();
  readonly view = input.required<PanelView>();
  readonly showTable = input(false);
  readonly title = input('');
  readonly canEdit = input(false);

  readonly retry = output<void>();
  readonly pointClick = output<{ pointKey: string; seriesKey?: string }>();
  readonly openRecord = output<EntityRef>();
  readonly openBuilder = output<void>();
  readonly openReadiness = output<string>();

  protected readonly chartKind = computed<ChartKind | null>(() => {
    const k = this.kind();
    return isChartKind(k) ? k : null;
  });

  protected readonly execution = computed<WidgetExecution | null>(() => this.view().execution);

  protected readonly displayMode = computed<
    'loading' | 'retrying' | 'ready' | 'empty' | 'timeout' | 'busy' | 'failed' | 'unavailable' | 'denied' | 'retired'
  >(() => {
    const currentView = this.view();
    switch (currentView.status) {
      case 'loading':
        return currentView.retrying ? 'retrying' : 'loading';
      case 'READY':
      case 'PARTIAL':
        return currentView.execution ? 'ready' : 'empty';
      case 'EMPTY':
        return 'empty';
      case 'TIMEOUT':
        return 'timeout';
      case 'ERROR':
        return isThrottled(currentView) ? 'busy' : 'failed';
      case 'UNAVAILABLE':
        return 'unavailable';
      case 'DENIED':
        return 'denied';
      case 'RETIRED':
        return 'retired';
    }
  });

  protected readonly readinessSourceKey = computed<string | null>(() => {
    const key = this.view().sourceKey?.trim();
    if (!key || !can('crm.analytics.readiness.view')) return null;
    return key;
  });

  protected onOpenReadiness(): void {
    const key = this.readinessSourceKey();
    if (key) {
      this.openReadiness.emit(key);
    }
  }

  protected readonly exactTable = computed<ExactTable | null>(() => {
    if (!this.showTable()) return null;
    const currentView = this.view();
    if (currentView.status !== 'READY' && currentView.status !== 'PARTIAL') return null;
    const exec = currentView.execution;
    if (!exec) return null;

    const lang = this.language();
    this.theme();
    this.i18n();

    const ctx: ChartContext = {
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      colors: readChartColors(),
      t: (key, params) => this.transloco.translate(`chart.${key}`, params),
      reasonLabel: (code) => this.transloco.translate(reasonKey(code)),
    };
    return toExactTable(this.kind(), exec, ctx);
  });

  protected readonly reasonTranslationKey = computed(() => {
    const { status, reasonCode } = this.view();
    if (reasonCode) return reasonKey(reasonCode);
    if (status === 'DENIED') return reasonKey('PERMISSION_REQUIRED');
    if (status === 'RETIRED') return reasonKey('METRIC_RETIRED');
    return reasonKey(null);
  });
}
