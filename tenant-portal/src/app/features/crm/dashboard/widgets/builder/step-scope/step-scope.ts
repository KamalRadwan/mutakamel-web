import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../../../core/i18n/language';
import type {
  DatePreset,
  DashboardFilters,
} from '../../../../../../shared/widgets/dashboard/analytics.model';
import { analyticsNow } from '../../../../../../shared/widgets/dashboard/analytics-api';
import { Checkbox } from '../../../../../../shared/ui/checkbox/checkbox';
import { DateRange, type DateRangeValue } from '../../../../../../shared/ui/date-range/date-range';
import { Dropdown, type DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { QueryBuilder } from '../../../../../../shared/ui/query-builder/query-builder/query-builder';
import type { OperatorLabelFn, Query, QueryField } from '../../../../../../shared/query-builder/query.model';
import { Segmented, type SegmentedOption } from '../../../../../../shared/ui/segmented/segmented';
import { DATE_PRESETS } from '../builder-schemas';
import { BuilderState } from '../builder-state';
import {
  filterFieldsFor,
  filterTreeMetricKeys,
  filterTreeRecordType,
  fromWire,
  strictWireOperator,
  toWire,
  unknownWireOperators,
  unmappableOperators,
} from '../filter-tree';
import { selectScopeTranslation } from '../../../../../../shared/widgets/dashboard/scope-translation';

@Component({
  selector: 'app-step-scope',
  imports: [TranslocoPipe, Field, Dropdown, DateRange, Segmented, Checkbox, QueryBuilder],
  templateUrl: './step-scope.html',
  host: { class: 'flex min-w-0 flex-col gap-8' },
})
export class StepScope {
  protected readonly state = inject(BuilderState);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly builderScope = toSignal(selectScopeTranslation(this.transloco, 'crm-widget-builder', 'builder'));
  private readonly analyticsScope = toSignal(this.transloco.selectTranslation('analytics'));

  protected readonly fakeNow = analyticsNow();
  protected readonly branches = this.state.branches;

  protected readonly errors = computed(() => this.state.errors().scope ?? {});
  protected readonly periodError = computed(
    () => this.errors()['filters.datePreset'] ?? null,
  );

  protected readonly filters = computed<DashboardFilters>(
    () => this.state.draft().querySpec.filters ?? { datePreset: 'CURRENT_MONTH' },
  );

  protected readonly datePreset = computed<DatePreset>(
    () => this.filters().datePreset ?? 'CURRENT_MONTH',
  );

  protected readonly customRangeValue = computed<DateRangeValue | null>(() => {
    const f = this.filters();
    if (!f.dateFrom || !f.dateTo) return null;
    const from = f.dateFrom.includes('T') ? f.dateFrom.slice(0, 16) : `${f.dateFrom}T00:00`;
    const to = f.dateTo.includes('T') ? f.dateTo.slice(0, 16) : `${f.dateTo}T23:59`;
    return { from, to, preset: null };
  });

  protected readonly presetOptions = computed<DropdownOption<DatePreset>[]>(() => {
    this.i18n();
    this.analyticsScope();
    return DATE_PRESETS.map((preset) => ({
      value: preset,
      label: this.transloco.translate(`analytics.datePreset.${preset}`),
    }));
  });

  protected readonly basisLabel = computed(() => {
    this.i18n();
    this.analyticsScope();
    const firstKey = this.state.draft().querySpec.series[0]?.metricKey;
    const metric = firstKey
      ? this.state.catalog()?.metrics.find((m) => m.key === firstKey)
      : undefined;
    if (!metric) return '—';
    return this.transloco.translate(`analytics.basis.${metric.readiness.basis}`);
  });

  protected readonly scopeMode = computed<'VIEWER_RELATIVE' | 'FIXED_REQUESTED'>(
    () => this.state.draft().querySpec.scopeBinding?.kind ?? 'VIEWER_RELATIVE',
  );

  protected readonly scopeModeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    this.builderScope();
    return [
      {
        value: 'VIEWER_RELATIVE',
        label: this.transloco.translate('builder.scope.viewerRelative'),
      },
      {
        value: 'FIXED_REQUESTED',
        label: this.transloco.translate('builder.scope.fixedScope'),
      },
    ];
  });

  protected readonly fixedBranchIds = computed<string[]>(() => {
    const binding = this.state.draft().querySpec.scopeBinding;
    if (binding?.kind !== 'FIXED_REQUESTED') return [];
    return binding.ceiling.branchIds ?? [];
  });

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    this.builderScope();
    const lang = this.language();
    return [
      { value: '', label: this.transloco.translate('builder.scope.allBranches') },
      ...this.state.branches().map((b) => ({
        value: b.id,
        label: lang === 'ar' ? b.name.ar : b.name.en,
      })),
    ];
  });

  protected readonly branchId = computed(() => this.filters().branchId ?? '');

  protected readonly supportedFilters = computed<Set<string>>(() => {
    const cat = this.state.catalog();
    const set = new Set<string>();
    for (const s of this.state.draft().querySpec.series) {
      const m = cat?.metrics.find((item) => item.key === s.metricKey);
      if (m) {
        for (const f of m.supportedFilters) set.add(f);
      }
    }
    return set;
  });

  protected readonly pipelineOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    this.builderScope();
    return [
      { value: '', label: this.transloco.translate('builder.scope.allPipelines') },
      ...this.state.pipelines().map((p) => ({
        value: p.id,
        label: this.language() === 'ar' ? p.nameAr : p.nameEn,
      })),
    ];
  });

  protected readonly currencyOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    this.builderScope();
    return [
      { value: '', label: this.transloco.translate('builder.scope.allCurrencies') },
      ...this.state.currencies().map((code) => ({ value: code, label: code })),
    ];
  });

  protected branchName(branch: { id: string; name: { en: string; ar: string } }): string {
    return this.language() === 'ar' ? branch.name.ar : branch.name.en;
  }

  protected onPresetChange(preset: DatePreset): void {
    const current = this.filters();
    const next: DashboardFilters = {
      ...current,
      datePreset: preset,
    };
    if (preset !== 'CUSTOM') {
      delete next.dateFrom;
      delete next.dateTo;
    } else if (!next.dateFrom || !next.dateTo) {
      const today = analyticsNow().slice(0, 10);
      next.dateFrom = `${today.slice(0, 8)}01`;
      next.dateTo = today;
    }
    this.state.patchQuery({ filters: next });
  }

  protected onCustomRangeChange(range: DateRangeValue | null): void {
    const current = this.filters();
    if (!range) return;
    this.state.patchQuery({
      filters: {
        ...current,
        datePreset: 'CUSTOM',
        dateFrom: range.from.slice(0, 10),
        dateTo: range.to.slice(0, 10),
      },
    });
  }

  protected onScopeModeChange(mode: string | null): void {
    if (mode === 'FIXED_REQUESTED') {
      const existing = this.fixedBranchIds();
      this.state.patchQuery({
        scopeBinding: {
          kind: 'FIXED_REQUESTED',
          ceiling: {
            branchIds: existing.length > 0 ? existing : this.state.branches().slice(0, 1).map((b) => b.id),
          },
        },
      });
      return;
    }
    this.state.patchQuery({
      scopeBinding: { kind: 'VIEWER_RELATIVE' },
    });
  }

  protected toggleScopeBranch(branchId: string, checked: boolean): void {
    const current = this.fixedBranchIds();
    const next = checked
      ? Array.from(new Set([...current, branchId]))
      : current.filter((id) => id !== branchId);
    this.state.patchQuery({
      scopeBinding: {
        kind: 'FIXED_REQUESTED',
        ceiling: { branchIds: next },
      },
    });
  }

  protected onBranchChange(branchId: string): void {
    const current = { ...this.filters() };
    if (branchId) {
      current.branchId = branchId;
    } else {
      delete current.branchId;
    }
    this.state.patchQuery({ filters: current });
  }

  protected onPipelineChange(pipelineId: string): void {
    const current = { ...this.filters() };
    if (pipelineId) {
      current.pipelineId = pipelineId;
    } else {
      delete current.pipelineId;
    }
    this.state.patchQuery({ filters: current });
  }

  protected onCurrencyChange(currencyCode: string): void {
    const current = { ...this.filters() };
    if (currencyCode) {
      current.currencyCode = currencyCode;
    } else {
      delete current.currencyCode;
    }
    this.state.patchQuery({ filters: current });
  }

  protected onNumberFilterChange(
    key: 'staleDays' | 'closingWindowDays',
    event: Event,
  ): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    const current = { ...this.filters() };
    if (raw === '') {
      delete current[key];
    } else {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) {
        current[key] = parsed;
      }
    }
    this.state.patchQuery({ filters: current });
  }

  protected readonly filterExpanded = signal(false);

  protected readonly filterRecordType = computed(() =>
    filterTreeRecordType(filterTreeMetricKeys(this.state.draft().querySpec.series)),
  );

  protected readonly filterFields = computed<QueryField[]>(() => {
    const rt = this.filterRecordType();
    if (!rt) return [];
    return filterFieldsFor(rt, this.language(), this.state.filterDomains());
  });

  protected readonly appliedFilterQuery = computed<Query>(() =>
    fromWire(this.state.draft().querySpec.filterTree),
  );

  /** Labels stored strict rules (GT/LT) as "more than" / "less than" in the rules editor rows themselves. */
  protected readonly filterOperatorLabel = computed<OperatorLabelFn>(() => {
    this.i18n();
    this.builderScope();
    const greater = this.transloco.translate('builder.scope.opGreater');
    const less = this.transloco.translate('builder.scope.opLess');
    return (condition, operator) => {
      const strict = strictWireOperator(condition, operator);
      return strict === 'GT' ? greater : strict === 'LT' ? less : null;
    };
  });

  /** Set when an applied rule uses an operator the wire cannot express: the rules are refused, not rewritten. */
  private readonly filterOperatorRefused = signal(false);

  protected readonly filterTreeError = computed<string | null>(() => {
    this.i18n();
    this.builderScope();
    const schemaError = this.errors()['filterTree'];
    if (schemaError) return schemaError;
    if (this.filterOperatorRefused() || unknownWireOperators(this.state.draft().querySpec.filterTree).length > 0) {
      return this.transloco.translate('builder.errors.filterOperatorUnsupported');
    }
    return null;
  });

  protected onFilterTreeApply(query: Query): void {
    if (unmappableOperators(query).length > 0) {
      this.filterOperatorRefused.set(true);
      return;
    }
    this.filterOperatorRefused.set(false);
    this.state.patchQuery({ filterTree: toWire(query) });
  }

  protected onFilterTreeClear(): void {
    this.filterOperatorRefused.set(false);
    this.state.patchQuery({ filterTree: undefined });
  }
}
