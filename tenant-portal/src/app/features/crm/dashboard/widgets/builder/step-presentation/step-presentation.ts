import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPlus, tablerTrash } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Badge } from '../../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { Segmented, type SegmentedOption } from '../../../../../../shared/ui/segmented/segmented';
import type {
  CatalogMetric,
  CatalogVisualization,
  DisplaySpec,
  SeriesUnit,
  Visualization,
} from '../../../../../../shared/widgets/dashboard/analytics.model';
import { effectiveSeriesUnit } from '../builder-schemas';
import { BuilderState } from '../builder-state';
import { ChartGallery } from './chart-gallery/chart-gallery';
import { selectScopeTranslation } from '../../../../../../shared/widgets/dashboard/scope-translation';

type LegendPosition = NonNullable<DisplaySpec['legendPosition']>;
type NumberFormat = NonNullable<DisplaySpec['numberFormat']>;
type SizePreset = 'default' | 'minimum';
type DisplayReference = NonNullable<DisplaySpec['references']>[number];

const SERIES_SWATCH_CLASSES: readonly string[] = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
  'bg-chart-6',
  'bg-chart-7',
  'bg-chart-8',
  'bg-chart-9',
  'bg-chart-10',
];

const LEGEND_POSITIONS: readonly LegendPosition[] = ['top', 'bottom', 'start', 'end', 'none'];

@Component({
  selector: 'app-step-presentation',
  imports: [TranslocoPipe, NgIcon, Badge, Button, Field, Dropdown, Segmented, ChartGallery],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-widget-builder-2', alias: 'builder2' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({ tablerPlus, tablerTrash }),
  ],
  templateUrl: './step-presentation.html',
  host: { class: 'block min-w-0' },
})
export class StepPresentation {
  protected readonly state = inject(BuilderState);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);
  private readonly builder2Scope = toSignal(selectScopeTranslation(this.transloco, 'crm-widget-builder-2', 'builder2'));
  private readonly analyticsScope = toSignal(this.transloco.selectTranslation('analytics'));

  protected readonly chosenMetrics = computed<readonly CatalogMetric[]>(() => {
    const catalog = this.state.catalog();
    if (!catalog) return [];
    const byKey = new Map(catalog.metrics.map((m) => [m.key, m]));
    return this.state
      .draft()
      .querySpec.series.map((s) => byKey.get(s.metricKey))
      .filter((m): m is CatalogMetric => Boolean(m));
  });

  protected readonly hasTarget = computed(() => {
    const type = this.state.draft().querySpec.comparison?.type;
    return type === 'TARGET' || type === 'GOVERNED_TARGET';
  });

  protected readonly selectedViz = computed<CatalogVisualization | null>(() => {
    const kind = this.state.draft().visualizationType;
    if (!kind) return null;
    return this.state.catalog()?.visualizations.find((v) => v.key === kind) ?? null;
  });

  protected readonly hasDurationMetric = computed(() =>
    this.chosenMetrics().some((m) => m.unit === 'DURATION'),
  );

  protected readonly legendOptions = computed<DropdownOption<LegendPosition>[]>(() => {
    this.i18n();
    this.builder2Scope();
    this.language();

    return LEGEND_POSITIONS.map((pos) => ({
      value: pos,
      label: this.transloco.translate(this.legendKey(pos)),
    }));
  });

  protected readonly numberFormatOptions = computed<DropdownOption<NumberFormat>[]>(() => {
    this.i18n();
    this.builder2Scope();
    this.language();

    const base: DropdownOption<NumberFormat>[] = [
      { value: 'auto', label: this.transloco.translate('builder2.presentation.formatAuto') },
      { value: 'full', label: this.transloco.translate('builder2.presentation.formatFull') },
    ];
    if (!this.hasDurationMetric()) return base;

    return [
      ...base,
      {
        value: 'duration-auto',
        label: this.transloco.translate('builder2.presentation.formatDurationAuto'),
      },
      {
        value: 'duration-minutes',
        label: this.transloco.translate('builder2.presentation.formatDurationMinutes'),
      },
      {
        value: 'duration-hours',
        label: this.transloco.translate('builder2.presentation.formatDurationHours'),
      },
      {
        value: 'duration-days',
        label: this.transloco.translate('builder2.presentation.formatDurationDays'),
      },
    ];
  });

  protected readonly currentNumberFormat = computed<NumberFormat>(() => {
    const current = this.state.draft().displaySpec.numberFormat ?? 'auto';
    if (!this.hasDurationMetric() && current.startsWith('duration-')) {
      return 'auto';
    }
    return current;
  });

  protected readonly seriesColorRows = computed(() => {
    this.i18n();
    this.builder2Scope();
    const lang = this.language();
    const metrics = new Map((this.state.catalog()?.metrics ?? []).map((m) => [m.key, m]));

    return this.state.draft().querySpec.series.map((s, index) => {
      const metric = metrics.get(s.metricKey);
      const fallbackLabel = metric
        ? lang === 'ar'
          ? metric.labelAr
          : metric.labelEn
        : this.transloco.translate('builder2.presentation.seriesFallback', { n: index + 1 });
      return {
        key: `${s.metricKey}-${index}`,
        label: s.label?.trim() || fallbackLabel,
        swatchClass: SERIES_SWATCH_CLASSES[index] ?? 'bg-status-none',
      };
    });
  });

  protected readonly references = computed<readonly DisplayReference[]>(
    () => this.state.draft().displaySpec.references ?? [],
  );

  protected readonly activeCurrency = computed(
    () => this.state.draft().querySpec.filters?.currencyCode || null,
  );

  protected readonly canAddReference = computed(() => {
    if (!this.selectedViz()?.supportsReferences) return false;
    const refs = this.references();
    if (refs.length >= 4) return false;
    const used = new Set(refs.map((r) => r.seriesIndex));
    return this.state.draft().querySpec.series.some((_, idx) => !used.has(idx));
  });

  protected seriesOptionsForRow(rowIndex: number): DropdownOption<string>[] {
    this.i18n();
    this.builder2Scope();
    const refs = this.references();
    const currentIdx = refs[rowIndex]?.seriesIndex ?? 0;
    const usedElsewhere = new Set(
      refs.filter((_, i) => i !== rowIndex).map((r) => r.seriesIndex),
    );
    return this.seriesColorRows()
      .map((item, idx) => ({ item, idx }))
      .filter(({ idx }) => idx === currentIdx || !usedElsewhere.has(idx))
      .map(({ item, idx }) => ({ value: String(idx), label: item.label }));
  }

  protected refValueText(ref: DisplayReference): string {
    return typeof ref.value === 'number' && Number.isFinite(ref.value) ? String(ref.value) : '';
  }

  protected refValueHint(unit: SeriesUnit): string {
    this.i18n();
    this.builder2Scope();
    this.analyticsScope();
    const unitLabel = this.transloco.translate(`analytics.unit.${unit}`);
    if (unit === 'PERCENT' || unit === 'SCORE') {
      return this.transloco.translate('builder2.presentation.refValuePercentHint', {
        unit: unitLabel,
      });
    }
    return this.transloco.translate('builder2.presentation.refValueHint', {
      unit: unitLabel,
    });
  }

  protected readonly sizeOptions = computed<readonly SegmentedOption[]>(() => {
    this.i18n();
    this.builder2Scope();
    this.language();

    return [
      { value: 'default', label: this.transloco.translate('builder2.presentation.defaultSize') },
      { value: 'minimum', label: this.transloco.translate('builder2.presentation.minimumSize') },
    ];
  });

  protected readonly sizePreset = computed<SizePreset>(() => {
    const raw = this.state.draft().displaySpec.options?.['sizePreset'];
    return raw === 'minimum' ? 'minimum' : 'default';
  });

  protected readonly activeSize = computed<{ w: number; h: number } | null>(() => {
    const viz = this.selectedViz();
    if (!viz) return null;
    return this.sizePreset() === 'minimum' ? viz.minSize : viz.defaultSize;
  });

  protected errorFor(fieldPath: string): string | null {
    return this.state.errors().presentation?.[fieldPath] ?? null;
  }

  protected onChartChange(next: Visualization | null): void {
    const current = this.state.draft().visualizationType;
    if (!next || next === current) return;

    const nextViz = this.state.catalog()?.visualizations.find((v) => v.key === next) ?? null;
    this.state.patch({ visualizationType: next });

    if (nextViz) {
      const q = this.state.draft().querySpec;
      if (!nextViz.supportsDualAxis && q.series.some((s) => s.axis === 'RIGHT')) {
        this.state.patchQuery({
          series: q.series.map((s) => (s.axis === 'RIGHT' ? { ...s, axis: 'LEFT' } : { ...s })),
        });
      }

      if (
        !nextViz.supportsPeriodComparison &&
        (q.comparison?.type === 'PREVIOUS_PERIOD' || q.comparison?.type === 'PREVIOUS_YEAR')
      ) {
        this.state.patchQuery({
          comparison: { type: 'NONE' },
        });
      }

      if (!nextViz.supportsReferences && (this.state.draft().displaySpec.references?.length ?? 0) > 0) {
        this.state.patchDisplay({ references: undefined });
      }
    }

    this.state.refreshPreview();
  }

  protected onTitleInput(value: string): void {
    this.state.patch({ name: value });
    this.state.patchDisplay({ title: value.trim() ? value : undefined });
  }

  protected onDescriptionInput(value: string): void {
    this.state.patch({ description: value });
  }

  protected onLegendChange(legendPosition: LegendPosition): void {
    this.state.patchDisplay({ legendPosition });
  }

  protected onNumberFormatChange(numberFormat: NumberFormat): void {
    this.state.patchDisplay({ numberFormat });
  }

  protected addReference(): void {
    if (!this.canAddReference()) return;
    const series = this.state.draft().querySpec.series;
    const cat = this.state.catalog();
    const refs = this.references();
    const used = new Set(refs.map((r) => r.seriesIndex));
    const nextIdx = series.findIndex((_, i) => !used.has(i));
    if (nextIdx < 0) return;

    const unit = effectiveSeriesUnit(series[nextIdx], cat);
    const defaultLabel = this.transloco.translate('builder2.presentation.referenceDefaultLabel');
    this.state.patchDisplay({
      references: [
        ...refs,
        {
          seriesIndex: nextIdx,
          unit,
          value: 0,
          label:
            defaultLabel && defaultLabel !== 'builder2.presentation.referenceDefaultLabel'
              ? defaultLabel
              : 'Reference',
        },
      ],
    });
  }

  protected removeReference(rowIndex: number): void {
    const next = this.references().filter((_, i) => i !== rowIndex);
    this.state.patchDisplay({ references: next.length > 0 ? next : undefined });
  }

  protected onReferenceSeriesChange(rowIndex: number, rawIndex: string): void {
    const seriesIndex = Number.parseInt(rawIndex, 10);
    if (!Number.isInteger(seriesIndex)) return;
    const seriesItem = this.state.draft().querySpec.series[seriesIndex];
    const unit = effectiveSeriesUnit(seriesItem, this.state.catalog());
    const next = this.references().map((r, i) =>
      i === rowIndex ? { ...r, seriesIndex, unit } : r,
    );
    this.state.patchDisplay({ references: next });
  }

  protected onReferenceValueInput(rowIndex: number, raw: string): void {
    const trimmed = raw.trim();
    const parsed = trimmed === '' ? Number.NaN : Number(trimmed);
    const next = this.references().map((r, i) =>
      i === rowIndex ? { ...r, value: parsed } : r,
    );
    this.state.patchDisplay({ references: next });
  }

  protected onReferenceLabelInput(rowIndex: number, raw: string): void {
    const next = this.references().map((r, i) =>
      i === rowIndex ? { ...r, label: raw } : r,
    );
    this.state.patchDisplay({ references: next });
  }

  protected onSizePresetChange(value: string | null): void {
    if (value !== 'default' && value !== 'minimum') return;
    const existingOpts = { ...(this.state.draft().displaySpec.options ?? {}) };
    existingOpts['sizePreset'] = value;
    this.state.patchDisplay({ options: existingOpts });
  }

  private legendKey(pos: LegendPosition): string {
    switch (pos) {
      case 'top':
        return 'builder2.presentation.legendTop';
      case 'bottom':
        return 'builder2.presentation.legendBottom';
      case 'start':
        return 'builder2.presentation.legendStart';
      case 'end':
        return 'builder2.presentation.legendEnd';
      case 'none':
        return 'builder2.presentation.legendNone';
    }
  }
}
