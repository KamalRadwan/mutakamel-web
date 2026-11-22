import { Component, ElementRef, computed, inject, input, model, viewChildren } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerChartBar,
  tablerChartHistogram,
  tablerChartLine,
  tablerChartPie,
  tablerGauge,
  tablerLayoutGrid,
  tablerTable,
  tablerTimeline,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../../core/i18n/language';
import type {
  Catalog,
  CatalogMetric,
  CatalogVisualization,
  ResultShape,
  Visualization,
} from '../../../../../../../shared/widgets/dashboard/analytics.model';
import { selectScopeTranslation } from '../../../../../../../shared/widgets/dashboard/scope-translation';

interface ChartFamilySpec {
  id: string;
  labelKey: string;
  icon: string;
  tileClass: string;
  kinds: readonly Visualization[];
}

interface GalleryTile {
  key: Visualization;
  label: string;
  familyIcon: string;
  familyTileClass: string;
  disabled: boolean;
  reason: string;
  selected: boolean;
}

interface GalleryGroup {
  id: string;
  label: string;
  tiles: readonly GalleryTile[];
}

const CHART_FAMILIES: readonly ChartFamilySpec[] = [
  {
    id: 'kpi',
    labelKey: 'builder2.presentation.families.kpi',
    icon: 'tablerLayoutGrid',
    tileClass: 'bg-icon-blue',
    kinds: ['METRIC_CARD', 'MULTI_KPI', 'PROGRESS_CARD'],
  },
  {
    id: 'lines',
    labelKey: 'builder2.presentation.families.lines',
    icon: 'tablerChartLine',
    tileClass: 'bg-icon-teal',
    kinds: ['LINE', 'AREA', 'LINE_AREA', 'COMBO'],
  },
  {
    id: 'bars',
    labelKey: 'builder2.presentation.families.bars',
    icon: 'tablerChartBar',
    tileClass: 'bg-icon-navy',
    kinds: ['COLUMN', 'BAR', 'STACKED_BAR', 'STACKED_BAR_100', 'WATERFALL'],
  },
  {
    id: 'proportions',
    labelKey: 'builder2.presentation.families.proportions',
    icon: 'tablerChartPie',
    tileClass: 'bg-icon-violet',
    kinds: ['PIE', 'DONUT', 'FUNNEL', 'TREEMAP'],
  },
  {
    id: 'distributions',
    labelKey: 'builder2.presentation.families.distributions',
    icon: 'tablerChartHistogram',
    tileClass: 'bg-icon-orange',
    kinds: ['HISTOGRAM', 'SCATTER', 'BUBBLE', 'BOX_PLOT', 'HEATMAP', 'CALENDAR_HEATMAP'],
  },
  {
    id: 'flows',
    labelKey: 'builder2.presentation.families.flows',
    icon: 'tablerTimeline',
    tileClass: 'bg-icon-green',
    kinds: ['FLOWCHART', 'GANTT', 'TIMELINE', 'CALENDAR'],
  },
  {
    id: 'gauges',
    labelKey: 'builder2.presentation.families.gauges',
    icon: 'tablerGauge',
    tileClass: 'bg-icon-red',
    kinds: [
      'SEMI_CIRCLE_GAUGE',
      'THREE_QUARTER_GAUGE',
      'CIRCULAR_PROGRESS_GAUGE',
      'DETAILED_SPEEDOMETER',
      'BULLET',
    ],
  },
  {
    id: 'tables',
    labelKey: 'builder2.presentation.families.tables',
    icon: 'tablerTable',
    tileClass: 'bg-icon-gray',
    kinds: ['TABLE', 'LEADERBOARD', 'SCORECARD', 'ALERT_LIST', 'ACTIVITY_FEED'],
  },
];

const ALL_KINDS: readonly Visualization[] = CHART_FAMILIES.flatMap((f) => f.kinds);

const SHAPE_REASON_KEY: Record<ResultShape, string> = {
  TIME_SERIES: 'builder2.presentation.reasons.needsTimeSeries',
  SCALAR: 'builder2.presentation.reasons.needsScalar',
  CATEGORY: 'builder2.presentation.reasons.needsCategory',
  XY: 'builder2.presentation.reasons.needsXy',
  INTERVAL: 'builder2.presentation.reasons.needsInterval',
  GRAPH: 'builder2.presentation.reasons.needsGraph',
  HIERARCHY: 'builder2.presentation.reasons.needsHierarchy',
  BINNED_DISTRIBUTION: 'builder2.presentation.reasons.needsBinned',
  DURATION_DISTRIBUTION: 'builder2.presentation.reasons.needsDurationDist',
  WATERFALL: 'builder2.presentation.reasons.needsWaterfall',
  EVENT_STREAM: 'builder2.presentation.reasons.needsEventStream',
  ROWS: 'builder2.presentation.reasons.needsRows',
};

let nextGallerySeq = 0;

@Component({
  selector: 'app-chart-gallery',
  imports: [NgIcon, TranslocoPipe],
  viewProviders: [
    provideTranslocoScope(
      { scope: 'crm-widget-builder-2', alias: 'builder2' },
      { scope: 'analytics', alias: 'analytics' },
    ),
  ],
  providers: [
    provideIcons({
      tablerLayoutGrid,
      tablerChartLine,
      tablerChartBar,
      tablerChartPie,
      tablerChartHistogram,
      tablerTimeline,
      tablerGauge,
      tablerTable,
    }),
  ],
  templateUrl: './chart-gallery.html',
  host: { class: 'block min-w-0' },
})
export class ChartGallery {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);
  private readonly builder2Scope = toSignal(
    selectScopeTranslation(this.transloco, 'crm-widget-builder-2', 'builder2'),
  );
  private readonly analyticsScope = toSignal(this.transloco.selectTranslation('analytics'));
  private readonly tileButtons = viewChildren<ElementRef<HTMLButtonElement>>('tileBtn');
  private readonly gallerySeq = ++nextGallerySeq;

  readonly catalog = input<Catalog | null>(null);
  readonly metrics = input<readonly CatalogMetric[]>([]);
  readonly seriesCount = input(0);
  readonly hasTarget = input(false);
  readonly id = input<string | null>(null);
  readonly describedBy = input<string | null>(null);
  readonly label = input('');
  readonly value = model<Visualization | null>(null);

  protected readonly groups = computed<readonly GalleryGroup[]>(() => {
    this.i18n();
    this.builder2Scope();
    this.analyticsScope();
    this.language();

    const vizByKey = new Map<Visualization, CatalogVisualization>();
    for (const v of this.catalog()?.visualizations ?? []) {
      vizByKey.set(v.key, v);
    }

    const chosenMetrics = this.metrics();
    const firstMetric = chosenMetrics[0] ?? null;
    const count = this.seriesCount();
    const targetReady = this.hasTarget();
    const distinctUnits = new Set(chosenMetrics.map((m) => m.unit));
    const current = this.value();

    return CHART_FAMILIES.map((family) => ({
      id: family.id,
      label: this.transloco.translate(family.labelKey),
      tiles: family.kinds.map((kind) => {
        const viz = vizByKey.get(kind);
        const reason = this.disabledReason(
          viz,
          firstMetric,
          count,
          distinctUnits.size,
          targetReady,
        );
        return {
          key: kind,
          label: this.transloco.translate(`analytics.visualization.${kind}`),
          familyIcon: family.icon,
          familyTileClass: family.tileClass,
          disabled: reason.length > 0,
          reason,
          selected: current === kind,
        };
      }),
    }));
  });

  protected readonly activeTileKey = computed<Visualization>(() => {
    const current = this.value();
    if (current && ALL_KINDS.includes(current)) {
      return current;
    }
    for (const group of this.groups()) {
      const enabled = group.tiles.find((t) => !t.disabled);
      if (enabled) return enabled.key;
    }
    return ALL_KINDS[0];
  });

  protected reasonId(kind: Visualization): string {
    return `chart-gallery-${this.gallerySeq}-${kind}-reason`;
  }

  protected tileDescribedBy(tile: GalleryTile): string | null {
    const parts: string[] = [];
    const parentDesc = this.describedBy();
    if (parentDesc) parts.push(parentDesc);
    if (tile.disabled) parts.push(this.reasonId(tile.key));
    return parts.length > 0 ? parts.join(' ') : null;
  }

  protected selectTile(tile: GalleryTile): void {
    if (tile.disabled) return;
    this.value.set(tile.key);
  }

  protected onTileKeydown(event: KeyboardEvent, kind: Visualization): void {
    const buttons = this.tileButtons();
    if (buttons.length === 0) return;

    const currentIndex = ALL_KINDS.indexOf(kind);
    if (currentIndex === -1) return;

    const rtl = this.isRtl();
    const nextHKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevHKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let nextIndex = -1;
    if (event.key === nextHKey || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % ALL_KINDS.length;
    } else if (event.key === prevHKey || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + ALL_KINDS.length) % ALL_KINDS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = ALL_KINDS.length - 1;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const tile = this.findTile(kind);
      if (tile && !tile.disabled) {
        this.value.set(tile.key);
      }
      return;
    } else {
      return;
    }

    event.preventDefault();
    buttons[nextIndex]?.nativeElement.focus();
  }

  private findTile(kind: Visualization): GalleryTile | null {
    for (const g of this.groups()) {
      const found = g.tiles.find((t) => t.key === kind);
      if (found) return found;
    }
    return null;
  }

  private disabledReason(
    viz: CatalogVisualization | undefined,
    firstMetric: CatalogMetric | null,
    seriesCount: number,
    unitCount: number,
    hasTarget: boolean,
  ): string {
    if (!firstMetric || seriesCount <= 0) {
      return this.transloco.translate('builder2.presentation.reasons.selectMetric');
    }
    if (!viz) {
      return this.transloco.translate('builder2.presentation.reasons.metricUnsupported');
    }
    if (!viz.shapes.includes(firstMetric.shape)) {
      const primaryShape = viz.shapes[0];
      const key = primaryShape
        ? SHAPE_REASON_KEY[primaryShape]
        : 'builder2.presentation.reasons.shapeMismatch';
      return this.transloco.translate(key);
    }
    if (firstMetric.visualizations && !firstMetric.visualizations.includes(viz.key)) {
      return this.transloco.translate('builder2.presentation.reasons.metricUnsupported');
    }
    if (seriesCount < viz.minSeries) {
      return this.transloco.translate('builder2.presentation.reasons.minSeries', {
        min: viz.minSeries,
      });
    }
    if (seriesCount > viz.maxSeries) {
      return viz.maxSeries === 1
        ? this.transloco.translate('builder2.presentation.reasons.oneSeriesOnly')
        : this.transloco.translate('builder2.presentation.reasons.maxSeries', {
            max: viz.maxSeries,
          });
    }
    if (unitCount > 1 && !viz.supportsMixedUnits) {
      return this.transloco.translate('builder2.presentation.reasons.mixedUnits');
    }
    if (viz.requiresTarget && !hasTarget) {
      return this.transloco.translate('builder2.presentation.reasons.needsTarget');
    }
    return '';
  }

  private isRtl(): boolean {
    const el = this.host.nativeElement;
    const dirAttr = el.closest('[dir]')?.getAttribute('dir')?.toLowerCase();
    if (dirAttr === 'rtl' || dirAttr === 'ltr') {
      return dirAttr === 'rtl';
    }
    return getComputedStyle(el).direction === 'rtl';
  }
}
