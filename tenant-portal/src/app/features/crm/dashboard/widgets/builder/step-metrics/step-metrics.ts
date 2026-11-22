import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowDown,
  tablerArrowUp,
  tablerCircleX,
  tablerGripVertical,
  tablerLock,
  tablerPlus,
  tablerSearch,
  tablerX,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../../../core/i18n/language';
import type { CatalogMetric, Grouping } from '../../../../../../shared/widgets/dashboard/analytics.model';
import { reasonKey } from '../../../../../../shared/widgets/dashboard/panel-state';
import { Badge } from '../../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../../shared/ui/checkbox/checkbox';
import { Dropdown, type DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { Segmented, type SegmentedOption } from '../../../../../../shared/ui/segmented/segmented';
import { TIME_GRAINS, compatibleOperands, isNaturalDimension, metricMatchesSource } from '../builder-schemas';
import { BuilderState } from '../builder-state';
import { selectScopeTranslation } from '../../../../../../shared/widgets/dashboard/scope-translation';

interface ChosenSeriesRow {
  index: number;
  metricKey: string;
  label: string;
  unit: string;
  timeModel: string;
  axis: 'LEFT' | 'RIGHT';
  error: string | null;
  calculation: { operation: 'RATIO' | 'DIFFERENCE'; operandMetricKey: string } | null;
  operands: DropdownOption<string>[];
  calcError: string | null;
}

@Component({
  selector: 'app-step-metrics',
  imports: [
    TranslocoPipe,
    NgIcon,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    Field,
    Dropdown,
    Button,
    Badge,
    Checkbox,
    Segmented,
  ],
  providers: [
    provideIcons({
      tablerGripVertical,
      tablerArrowUp,
      tablerArrowDown,
      tablerX,
      tablerSearch,
      tablerPlus,
      tablerLock,
      tablerCircleX,
    }),
  ],
  templateUrl: './step-metrics.html',
  host: { class: 'flex min-w-0 flex-col gap-8' },
})
export class StepMetrics {
  protected readonly state = inject(BuilderState);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly builderScope = toSignal(selectScopeTranslation(this.transloco, 'crm-widget-builder', 'builder'));
  private readonly analyticsScope = toSignal(this.transloco.selectTranslation('analytics'));

  protected readonly searchQuery = signal('');

  protected readonly errors = computed(() => this.state.errors().metrics ?? {});
  protected readonly seriesError = computed(() => this.errors()['series'] ?? null);

  protected readonly maxSeries = computed(() => {
    const vizKey = this.state.draft().visualizationType;
    if (!vizKey) return 4;
    const viz = this.state.catalog()?.visualizations.find((v) => v.key === vizKey);
    return viz ? Math.min(4, viz.maxSeries) : 4;
  });

  protected readonly showDualAxisToggle = computed(() => {
    const vizKey = this.state.draft().visualizationType;
    if (!vizKey) return this.state.draft().querySpec.series.length > 1;
    const viz = this.state.catalog()?.visualizations.find((v) => v.key === vizKey);
    return viz ? viz.supportsDualAxis : false;
  });

  protected readonly seriesRows = computed<ChosenSeriesRow[]>(() => {
    this.i18n();
    this.builderScope();
    this.analyticsScope();
    const lang = this.language();
    const cat = this.state.catalog();
    const vizType = this.state.draft().visualizationType;
    const errMap = this.errors();

    return this.state.draft().querySpec.series.map((item, index) => {
      const metric = cat?.metrics.find((m) => m.key === item.metricKey);
      const label = metric
        ? lang === 'ar'
          ? metric.labelAr
          : metric.labelEn
        : item.label || item.metricKey;
      const effectiveUnitKey =
        item.calculation?.operation === 'RATIO' ? 'RATIO' : metric?.unit;
      const unit = effectiveUnitKey ? this.transloco.translate(`analytics.unit.${effectiveUnitKey}`) : '';
      const timeModel = metric
        ? this.transloco.translate(`builder.metrics.timeModel.${metric.timeModel}`)
        : '';
      const operands = metric
        ? compatibleOperands(metric, cat, vizType).map((cand) => ({
            value: cand.key,
            label: lang === 'ar' ? cand.labelAr : cand.labelEn,
          }))
        : [];
      const calcError =
        errMap[`series.${index}.calculation`] ??
        errMap[`series.${index}.calculation.operandMetricKey`] ??
        null;

      return {
        index,
        metricKey: item.metricKey,
        label,
        unit,
        timeModel,
        axis: item.axis === 'RIGHT' ? 'RIGHT' : 'LEFT',
        error: errMap[`series.${index}.metricKey`] ?? null,
        calculation: item.calculation ? { ...item.calculation } : null,
        operands,
        calcError,
      };
    });
  });

  protected readonly calcOperationOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    this.builderScope();
    return [
      { value: 'RATIO', label: this.transloco.translate('builder.metrics.calcRatio') },
      { value: 'DIFFERENCE', label: this.transloco.translate('builder.metrics.calcDiff') },
    ];
  });

  protected readonly addedMetricKeys = computed(
    () => new Set(this.state.draft().querySpec.series.map((s) => s.metricKey)),
  );

  protected readonly atMaxSeries = computed(
    () => this.state.draft().querySpec.series.length >= this.maxSeries(),
  );

  protected readonly filteredMetrics = computed<CatalogMetric[]>(() => {
    const source = this.state.draft().source;
    const metrics = this.state.catalog()?.metrics ?? [];
    if (!source) return [];

    const q = this.searchQuery().trim().toLowerCase();
    return metrics.filter((m) => {
      if (!metricMatchesSource(m, source)) return false;
      if (!q) return true;
      return (
        m.labelEn.toLowerCase().includes(q) ||
        m.labelAr.toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q)
      );
    });
  });

  private readonly firstMetric = computed(() => {
    const key = this.state.draft().querySpec.series[0]?.metricKey;
    if (!key) return undefined;
    return this.state.catalog()?.metrics.find((m) => m.key === key);
  });

  protected readonly requiresDailyGrain = computed(() => {
    const cat = this.state.catalog();
    return this.state.draft().querySpec.series.some((s) => {
      const m = cat?.metrics.find((item) => item.key === s.metricKey);
      return m?.requiredGrain === 'DAY';
    });
  });

  protected readonly groupByOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    const metric = this.firstMetric();
    const catalogDims = this.state.catalog()?.dimensions ?? [];
    if (!metric) return [];

    return metric.dimensions.map((key) => {
      const def = catalogDims.find((d) => d.key === key);
      return {
        value: key,
        label: (lang === 'ar' ? def?.labelAr : def?.labelEn) ?? key,
      };
    });
  });

  protected readonly selectedDimension = computed(() => {
    const current = this.state.draft().querySpec.dimension?.key;
    if (current) return current;
    const dims = this.firstMetric()?.dimensions ?? [];
    return dims[0] ?? 'none';
  });

  protected readonly grainOptions = computed<DropdownOption<'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR'>[]>(() => {
    this.i18n();
    this.builderScope();
    const forcedDaily = this.requiresDailyGrain();
    return TIME_GRAINS.map((grain) => ({
      value: grain,
      label: this.transloco.translate(`builder.metrics.grains.${grain}`),
      disabled: forcedDaily && grain !== 'DAY',
    }));
  });

  protected readonly selectedGrain = computed<'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR'>(() => {
    if (this.requiresDailyGrain()) return 'DAY';
    return this.state.draft().querySpec.dimension?.grain ?? 'MONTH';
  });

  protected readonly splitByOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    this.builderScope();
    const lang = this.language();
    const metric = this.firstMetric();
    const catalogDims = this.state.catalog()?.dimensions ?? [];
    const primary = this.selectedDimension();

    const options: DropdownOption<string>[] = [
      { value: 'none', label: this.transloco.translate('builder.metrics.splitNone') },
    ];
    if (!metric) return options;

    for (const key of metric.dimensions) {
      if (key === 'none' || key === 'time' || key === primary) continue;
      const def = catalogDims.find((d) => d.key === key);
      options.push({
        value: key,
        label: (lang === 'ar' ? def?.labelAr : def?.labelEn) ?? key,
      });
    }
    return options;
  });

  protected readonly selectedBreakdown = computed(
    () => this.state.draft().querySpec.breakdown?.key ?? 'none',
  );

  /** Top-N / group-rest is refused on enum or bounded (NATURAL) dimensions, so the controls are hidden there. */
  protected readonly topNAllowed = computed(
    () => !isNaturalDimension(this.state.catalog(), this.selectedBreakdown()),
  );

  protected readonly topNValue = computed(
    () => this.state.draft().querySpec.breakdown?.topN ?? 10,
  );

  protected readonly groupRestValue = computed(
    () => this.state.draft().querySpec.breakdown?.groupRest ?? false,
  );

  protected metricName(metric: CatalogMetric): string {
    return this.language() === 'ar' ? metric.labelAr : metric.labelEn;
  }

  protected metricCaption(metric: CatalogMetric): string {
    this.i18n();
    this.analyticsScope();
    this.builderScope();
    const unit = this.transloco.translate(`analytics.unit.${metric.unit}`);
    const model = this.transloco.translate(`builder.metrics.timeModel.${metric.timeModel}`);
    return `${unit} · ${model}`;
  }

  protected unavailableReason(metric: CatalogMetric): string {
    this.i18n();
    this.analyticsScope();
    const fallback = metric.availability === 'RETIRED' ? 'METRIC_RETIRED' : 'METRIC_UNAVAILABLE';
    return this.transloco.translate(reasonKey(metric.unavailableReason ?? fallback));
  }

  protected addMetric(metric: CatalogMetric): void {
    if (metric.availability !== 'AVAILABLE') return;
    const query = this.state.draft().querySpec;
    if (query.series.length >= this.maxSeries()) return;
    if (query.series.some((s) => s.metricKey === metric.key)) return;

    const nextSeries = [...query.series, { metricKey: metric.key, axis: 'LEFT' as const }];
    let nextDim = query.dimension;

    if (query.series.length === 0) {
      const defaultDim = metric.dimensions[0];
      if (defaultDim && defaultDim !== 'none') {
        nextDim =
          defaultDim === 'time'
            ? { key: 'time', grain: metric.requiredGrain === 'DAY' ? 'DAY' : 'MONTH' }
            : { key: defaultDim };
      } else {
        nextDim = undefined;
      }
    } else if (metric.requiredGrain === 'DAY' && nextDim?.key === 'time') {
      nextDim = { ...nextDim, grain: 'DAY' };
    }

    this.state.patchQuery({
      series: nextSeries,
      dimension: nextDim,
    });
  }

  protected removeMetric(index: number): void {
    const query = this.state.draft().querySpec;
    const nextSeries = query.series.filter((_, i) => i !== index);
    if (nextSeries.length === 0) {
      this.state.patchQuery({
        series: [],
        dimension: undefined,
        breakdown: undefined,
      });
      return;
    }

    const firstKey = nextSeries[0].metricKey;
    const first = this.state.catalog()?.metrics.find((m) => m.key === firstKey);
    let nextDim = query.dimension;
    if (first && nextDim?.key && !first.dimensions.includes(nextDim.key)) {
      const fallback = first.dimensions[0];
      nextDim =
        fallback && fallback !== 'none'
          ? fallback === 'time'
            ? { key: 'time', grain: first.requiredGrain === 'DAY' ? 'DAY' : 'MONTH' }
            : { key: fallback }
          : undefined;
    }

    let nextBreakdown = query.breakdown;
    if (first && nextBreakdown?.key && !first.dimensions.includes(nextBreakdown.key)) {
      nextBreakdown = undefined;
    }

    this.state.patchQuery({
      series: nextSeries,
      dimension: nextDim,
      breakdown: nextBreakdown,
    });
  }

  protected moveMetric(index: number, delta: -1 | 1): void {
    const target = index + delta;
    const list = [...this.state.draft().querySpec.series];
    if (target < 0 || target >= list.length) return;
    moveItemInArray(list, index, target);
    this.state.patchQuery({ series: list });
  }

  protected onDrop(event: CdkDragDrop<ChosenSeriesRow[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const list = [...this.state.draft().querySpec.series];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.state.patchQuery({ series: list });
  }

  protected toggleAxis(index: number): void {
    const list = this.state.draft().querySpec.series.map((s, i) =>
      i === index ? { ...s, axis: s.axis === 'RIGHT' ? ('LEFT' as const) : ('RIGHT' as const) } : s,
    );
    this.state.patchQuery({ series: list });
  }

  protected enableCalculation(index: number): void {
    const row = this.seriesRows()[index];
    const firstOperand = row?.operands[0]?.value;
    if (!firstOperand) return;
    const list = this.state.draft().querySpec.series.map((s, i) =>
      i === index
        ? { ...s, calculation: { operation: 'RATIO' as const, operandMetricKey: firstOperand } }
        : s,
    );
    this.state.patchQuery({ series: list });
  }

  protected onCalcOperationChange(index: number, value: string | null): void {
    if (value !== 'RATIO' && value !== 'DIFFERENCE') return;
    const operation: 'RATIO' | 'DIFFERENCE' = value;
    const list = this.state.draft().querySpec.series.map((s, i) =>
      i === index && s.calculation
        ? { ...s, calculation: { ...s.calculation, operation } }
        : s,
    );
    this.state.patchQuery({ series: list });
  }

  protected onCalcOperandChange(index: number, operandMetricKey: string): void {
    const list = this.state.draft().querySpec.series.map((s, i) =>
      i === index && s.calculation
        ? { ...s, calculation: { ...s.calculation, operandMetricKey } }
        : s,
    );
    this.state.patchQuery({ series: list });
  }

  protected removeCalculation(index: number): void {
    const list = this.state.draft().querySpec.series.map((s, i) => {
      if (i !== index) return s;
      const { calculation: _drop, ...rest } = s;
      return rest;
    });
    this.state.patchQuery({ series: list });
  }

  protected onGroupByChange(dimKey: string): void {
    const query = this.state.draft().querySpec;
    if (!dimKey || dimKey === 'none') {
      this.state.patchQuery({ dimension: undefined });
      return;
    }

    const nextDim: Grouping =
      dimKey === 'time'
        ? {
            key: 'time',
            grain: this.requiresDailyGrain() ? 'DAY' : (query.dimension?.grain ?? 'MONTH'),
          }
        : { key: dimKey };

    const clearBreakdown = query.breakdown?.key === dimKey ? undefined : query.breakdown;
    this.state.patchQuery({
      dimension: nextDim,
      breakdown: clearBreakdown,
    });
  }

  protected onGrainChange(grain: 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR'): void {
    const current = this.state.draft().querySpec.dimension;
    this.state.patchQuery({
      dimension: {
        ...(current ?? { key: 'time' }),
        key: 'time',
        grain: this.requiresDailyGrain() ? 'DAY' : grain,
      },
    });
  }

  protected onSplitByChange(dimKey: string): void {
    if (!dimKey || dimKey === 'none') {
      this.state.patchQuery({ breakdown: undefined });
      return;
    }
    const existing = this.state.draft().querySpec.breakdown;
    if (isNaturalDimension(this.state.catalog(), dimKey)) {
      this.state.patchQuery({ breakdown: { key: dimKey } });
      return;
    }
    this.state.patchQuery({
      breakdown: {
        key: dimKey,
        topN: existing?.topN ?? 10,
        groupRest: existing?.groupRest ?? true,
      },
    });
  }

  protected onTopNChange(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const parsed = raw === '' ? undefined : Number.parseInt(raw, 10);
    const current = this.state.draft().querySpec.breakdown;
    if (!current) return;
    this.state.patchQuery({
      breakdown: {
        ...current,
        topN: parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined,
      },
    });
  }

  protected onGroupRestChange(checked: boolean): void {
    const current = this.state.draft().querySpec.breakdown;
    if (!current) return;
    this.state.patchQuery({
      breakdown: {
        ...current,
        groupRest: checked,
      },
    });
  }

  protected onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }
}
