import { Component, computed, inject, input, model, output } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addMonths } from 'date-fns';
import { Button } from '../../../../shared/ui/button/button';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import type {
  DashboardDetail,
  DashboardFilters as DashboardFiltersModel,
  DatePreset,
  PeriodComparison,
  RunRequest,
  ScopeCoverage,
} from '../trade-dashboard.model';

export type DashboardScopeChoice = 'SAVED_TARGETS' | 'COMPANY' | 'BRANCH' | 'ALL_ACCESSIBLE';

export interface DashboardFilterState {
  datePreset: DatePreset;
  dateFrom: string | null;
  dateTo: string | null;
  comparisonMode: PeriodComparison;
  scopeChoice: DashboardScopeChoice;
}

export interface FilterValidation {
  valid: boolean;
  fromError: 'required' | null;
  toError: 'required' | 'order' | 'maxRange' | null;
}

export const FILTER_PRESETS: readonly DatePreset[] = [
  'TODAY',
  'CURRENT_WEEK',
  'CURRENT_MONTH',
  'CURRENT_QUARTER',
  'CURRENT_YEAR',
  'LAST_30_DAYS',
  'CUSTOM',
];

export const COMPARE_OPTIONS: readonly PeriodComparison[] = [
  'NONE',
  'PREVIOUS_PERIOD',
  'PREVIOUS_YEAR',
];

const ALLOWED_PRESET_SET = new Set<string>(FILTER_PRESETS);

function parseIsoYmd(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function defaultFilterState(
  detail: Pick<DashboardDetail, 'defaultFilters'>,
): DashboardFilterState {
  const df = detail.defaultFilters;
  const preset: DatePreset =
    df.datePreset && ALLOWED_PRESET_SET.has(df.datePreset) ? df.datePreset : 'CURRENT_MONTH';
  const compare: PeriodComparison =
    df.comparisonMode === 'PREVIOUS_PERIOD' || df.comparisonMode === 'PREVIOUS_YEAR'
      ? df.comparisonMode
      : 'NONE';

  return {
    datePreset: preset,
    dateFrom: preset === 'CUSTOM' && df.dateFrom ? df.dateFrom.slice(0, 10) : null,
    dateTo: preset === 'CUSTOM' && df.dateTo ? df.dateTo.slice(0, 10) : null,
    comparisonMode: compare,
    scopeChoice: 'SAVED_TARGETS',
  };
}

export function validateFilterState(state: DashboardFilterState): FilterValidation {
  if (state.datePreset !== 'CUSTOM') {
    return { valid: true, fromError: null, toError: null };
  }

  const from = parseIsoYmd(state.dateFrom);
  const to = parseIsoYmd(state.dateTo);
  const fromError = from ? null : 'required';
  let toError: 'required' | 'order' | 'maxRange' | null = to ? null : 'required';

  if (from && to) {
    if (state.dateFrom! > state.dateTo!) {
      toError = 'order';
    } else if (to > addMonths(from, 24)) {
      toError = 'maxRange';
    }
  }

  return {
    valid: fromError === null && toError === null,
    fromError,
    toError,
  };
}

export function filtersEqual(a: DashboardFilterState, b: DashboardFilterState): boolean {
  return (
    a.datePreset === b.datePreset &&
    a.dateFrom === b.dateFrom &&
    a.dateTo === b.dateTo &&
    a.comparisonMode === b.comparisonMode &&
    a.scopeChoice === b.scopeChoice
  );
}

export function toRunScope(
  choice: DashboardScopeChoice,
  scopeCoverage: ScopeCoverage,
  companyId: string,
  branchId: string | null | undefined,
): RunRequest['scope'] {
  switch (choice) {
    case 'COMPANY':
      return {
        scopeMode: 'SELECTED_SCOPES',
        companyScopes: [{ companyId }],
      };
    case 'BRANCH':
      return {
        scopeMode: 'SELECTED_SCOPES',
        companyScopes: [{ companyId, ...(branchId ? { branchIds: [branchId] } : {}) }],
      };
    case 'ALL_ACCESSIBLE':
      if (scopeCoverage === 'MULTI_COMPANY_AUTHORIZED_UNION') {
        return { scopeMode: 'ALL_ACCESSIBLE' };
      }
      return { scopeMode: 'SAVED_TARGETS' };
    case 'SAVED_TARGETS':
    default:
      return { scopeMode: 'SAVED_TARGETS' };
  }
}

export function toRunFilters(
  state: DashboardFilterState,
  baseDefaults?: DashboardFiltersModel,
): DashboardFiltersModel {
  const filters: DashboardFiltersModel = {
    datePreset: state.datePreset,
    comparisonMode: state.comparisonMode,
  };

  if (state.datePreset === 'CUSTOM' && state.dateFrom && state.dateTo) {
    filters.dateFrom = state.dateFrom;
    filters.dateTo = state.dateTo;
  }

  if (baseDefaults?.currencyCodes?.length) {
    filters.currencyCodes = [...baseDefaults.currencyCodes];
  }
  if (baseDefaults?.itemIds?.length) {
    filters.itemIds = [...baseDefaults.itemIds];
  }
  if (baseDefaults?.clauses?.length) {
    filters.clauses = baseDefaults.clauses.map((c) => ({ key: c.key, values: [...c.values] }));
  }

  return filters;
}

@Component({
  selector: 'app-trade-dashboard-filters',
  imports: [TranslocoPipe, Button, DateField, Dropdown, Field],
  templateUrl: './dashboard-filters.html',
  host: { class: 'block min-w-0' },
})
export class DashboardFilters {
  private static nextId = 0;
  protected readonly uid = `trade-dash-filters-${++DashboardFilters.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly value = model.required<DashboardFilterState>();
  readonly scopeCoverage = input<ScopeCoverage>('SINGLE_COMPANY');
  readonly canReset = input(false);
  readonly disabled = input(false);

  readonly reset = output<void>();

  protected readonly validation = computed(() => validateFilterState(this.value()));

  protected readonly fromErrorText = computed<string | null>(() => {
    this.i18n();
    const err = this.validation().fromError;
    return err === 'required' ? this.transloco.translate('tradeShared.common.required') : null;
  });

  protected readonly toErrorText = computed<string | null>(() => {
    this.i18n();
    const err = this.validation().toError;
    if (!err) return null;
    if (err === 'required') return this.transloco.translate('tradeShared.common.required');
    return this.transloco.translate(`tradeDashboard.filters.errors.${err}`);
  });

  protected readonly fromDescribedBy = computed(() =>
    this.fromErrorText() ? `${this.uid}-from-hint ${this.uid}-from-error` : `${this.uid}-from-hint`,
  );

  protected readonly toDescribedBy = computed(() =>
    this.toErrorText() ? `${this.uid}-to-hint ${this.uid}-to-error` : `${this.uid}-to-hint`,
  );

  protected readonly periodOptions = computed<DropdownOption<DatePreset>[]>(() => {
    this.i18n();
    return FILTER_PRESETS.map((preset) => ({
      value: preset,
      label: this.transloco.translate(`tradeDashboard.filters.presets.${preset}`),
    }));
  });

  protected readonly compareOptions = computed<DropdownOption<PeriodComparison>[]>(() => {
    this.i18n();
    return COMPARE_OPTIONS.map((mode) => ({
      value: mode,
      label: this.transloco.translate(`tradeDashboard.filters.compareOptions.${mode}`),
    }));
  });

  protected readonly scopeOptions = computed<DropdownOption<DashboardScopeChoice>[]>(() => {
    this.i18n();
    const choices: DashboardScopeChoice[] = ['SAVED_TARGETS', 'COMPANY', 'BRANCH'];
    if (this.scopeCoverage() === 'MULTI_COMPANY_AUTHORIZED_UNION') {
      choices.push('ALL_ACCESSIBLE');
    }
    return choices.map((choice) => ({
      value: choice,
      label: this.transloco.translate(`tradeDashboard.filters.scopeOptions.${choice}`),
    }));
  });

  protected onPresetChange(datePreset: DatePreset): void {
    if (datePreset === this.value().datePreset) return;
    this.value.update((cur) => ({
      ...cur,
      datePreset,
      ...(datePreset !== 'CUSTOM' ? { dateFrom: null, dateTo: null } : {}),
    }));
  }

  protected onFromChange(dateFrom: string | null): void {
    if (dateFrom === this.value().dateFrom) return;
    this.value.update((cur) => ({ ...cur, dateFrom }));
  }

  protected onToChange(dateTo: string | null): void {
    if (dateTo === this.value().dateTo) return;
    this.value.update((cur) => ({ ...cur, dateTo }));
  }

  protected onCompareChange(comparisonMode: PeriodComparison): void {
    if (comparisonMode === this.value().comparisonMode) return;
    this.value.update((cur) => ({ ...cur, comparisonMode }));
  }

  protected onScopeChange(scopeChoice: DashboardScopeChoice): void {
    if (scopeChoice === this.value().scopeChoice) return;
    this.value.update((cur) => ({ ...cur, scopeChoice }));
  }
}
