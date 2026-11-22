import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPlus, tablerTrash } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Notify } from '../../../../../../core/notify/notify';
import { Button } from '../../../../../../shared/ui/button/button';
import { formatShortDate } from '../../../../../../shared/ui/chart/chart-format';
import { DateRange, type DateRangeValue } from '../../../../../../shared/ui/date-range/date-range';
import { Dropdown, type DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { formatMoneyNumber, toMoneyString } from '../../../../../../shared/ui/money/money-format';
import { Segmented, type SegmentedOption } from '../../../../../../shared/ui/segmented/segmented';
import type {
  CatalogMetric,
  CatalogVisualization,
  DatePreset,
  QuerySpec,
} from '../../../../../../shared/widgets/dashboard/analytics.model';
import { FAKE_NOW, errorCodeOf } from '../../../../../../shared/widgets/dashboard/analytics-api';
import { FAKE_TEAMS } from '../../../../../../shared/widgets/dashboard/fake/fake-org';
import { errorKey } from '../../../../../../shared/widgets/dashboard/panel-state';
import { listGovernedTargets } from '../../widgets.api';
import type { GovernedTargetOption } from '../../widgets.model';
import { allowedDatasetBasesForMetric } from '../builder-schemas';
import { BuilderState } from '../builder-state';
import { selectScopeTranslation } from '../../../../../../shared/widgets/dashboard/scope-translation';

type ComparisonType = NonNullable<QuerySpec['comparison']>['type'];
type DatasetBasis = NonNullable<NonNullable<QuerySpec['comparison']>['basis']>;
type DatasetEntry = NonNullable<NonNullable<QuerySpec['comparison']>['datasets']>[number];
type GovernedGrain = NonNullable<
  NonNullable<NonNullable<QuerySpec['comparison']>['governedTarget']>['periodGrain']
>;

interface MetricWithDatasetMeta extends Omit<CatalogMetric, 'datasetComparison'> {
  datasetComparison?:
    | {
        bases?: readonly DatasetBasis[];
        maxDatasets?: number;
      }
    | false;
}

const ALL_COMPARISON_TYPES: readonly ComparisonType[] = [
  'NONE',
  'PREVIOUS_PERIOD',
  'PREVIOUS_YEAR',
  'DATASETS',
  'TARGET',
  'GOVERNED_TARGET',
];

const ALL_BASES: readonly DatasetBasis[] = ['PERIOD', 'BRANCH', 'COMPANY', 'TEAM'];

const ALL_DATE_PRESETS: readonly DatePreset[] = [
  'TODAY',
  'CURRENT_WEEK',
  'CURRENT_MONTH',
  'CURRENT_QUARTER',
  'CURRENT_YEAR',
  'LAST_MONTH',
  'LAST_3_COMPLETE_MONTHS',
  'LAST_QUARTER',
  'LAST_YEAR',
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'LAST_90_DAYS',
  'CUSTOM',
];

const GOVERNED_GRAINS: readonly GovernedGrain[] = ['MONTH', 'QUARTER', 'YEAR'];

@Component({
  selector: 'app-step-compare',
  imports: [NgIcon, TranslocoPipe, Button, Field, Dropdown, Segmented, DateRange],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-widget-builder-2', alias: 'builder2' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({ tablerPlus, tablerTrash }),
  ],
  templateUrl: './step-compare.html',
  host: { class: 'block min-w-0' },
})
export class StepCompare {
  protected readonly state = inject(BuilderState);
  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);
  private readonly builder2Scope = toSignal(selectScopeTranslation(this.transloco, 'crm-widget-builder-2', 'builder2'));
  private readonly analyticsScope = toSignal(this.transloco.selectTranslation('analytics'));

  protected readonly fakeNow = FAKE_NOW;
  protected readonly governedTargets = signal<readonly GovernedTargetOption[]>([]);
  protected readonly targetsLoading = signal(false);
  protected readonly targetText = signal('');

  private targetFocused = false;
  private readonly selectedGovernedId = signal<string | null>(null);
  private targetFetchSeq = 0;

  private readonly chosenMetrics = computed<readonly MetricWithDatasetMeta[]>(() => {
    const catalog = this.state.catalog();
    if (!catalog) return [];
    const byKey = new Map(catalog.metrics.map((m) => [m.key, m as MetricWithDatasetMeta]));
    return this.state
      .draft()
      .querySpec.series.map((s) => byKey.get(s.metricKey))
      .filter((m): m is MetricWithDatasetMeta => Boolean(m));
  });

  protected readonly primaryMetric = computed<MetricWithDatasetMeta | null>(
    () => this.chosenMetrics()[0] ?? null,
  );

  private readonly selectedViz = computed<CatalogVisualization | null>(() => {
    const kind = this.state.draft().visualizationType;
    if (!kind) return null;
    return this.state.catalog()?.visualizations.find((v) => v.key === kind) ?? null;
  });

  protected readonly isMoneyMetric = computed(() =>
    this.chosenMetrics().some((m) => m.unit === 'MONEY'),
  );

  protected readonly currencyCode = computed(
    () => this.state.draft().querySpec.filters?.currencyCode || null,
  );

  protected readonly allowedComparisonTypes = computed<readonly ComparisonType[]>(() => {
    const metrics = this.chosenMetrics();
    const viz = this.selectedViz();
    const targetOnly = viz?.requiresTarget === true;
    const allowsPeriod = viz ? viz.supportsPeriodComparison : true;

    let candidates: ComparisonType[] = ALL_COMPARISON_TYPES.filter((type) => {
      if (metrics.length === 0) return type === 'NONE';
      const everyAllows = metrics.every((m) => {
        if (!m.comparisonTypes.includes(type)) return false;
        if (type === 'DATASETS' && m.datasetComparison === false) return false;
        return true;
      });
      if (!everyAllows) return false;
      if (targetOnly) {
        return type === 'TARGET' || type === 'GOVERNED_TARGET';
      }
      if (!allowsPeriod && (type === 'PREVIOUS_PERIOD' || type === 'PREVIOUS_YEAR')) {
        return false;
      }
      return true;
    });

    if (candidates.length === 0) {
      candidates = targetOnly ? ['TARGET', 'GOVERNED_TARGET'] : ['NONE'];
    }
    return candidates;
  });

  protected readonly comparisonOptions = computed<DropdownOption<ComparisonType>[]>(() => {
    this.i18n();
    this.builder2Scope();
    this.language();

    return this.allowedComparisonTypes().map((type) => ({
      value: type,
      label: this.comparisonLabel(type),
    }));
  });

  protected readonly comparisonType = computed<ComparisonType>(() => {
    const raw = this.state.draft().querySpec.comparison?.type;
    const allowed = this.allowedComparisonTypes();
    if (raw && allowed.includes(raw)) return raw;
    if (!raw && allowed.includes('NONE')) return 'NONE';
    return raw ?? allowed[0] ?? 'NONE';
  });

  protected readonly allowedBases = computed<readonly DatasetBasis[]>(() => {
    const metrics = this.chosenMetrics();
    let bases: DatasetBasis[] = [...ALL_BASES];
    for (const m of metrics) {
      const configured = allowedDatasetBasesForMetric(m as unknown as CatalogMetric);
      bases = bases.filter((b) => configured.includes(b));
    }
    return bases.length > 0 ? bases : ['PERIOD', 'BRANCH', 'COMPANY'];
  });

  protected readonly basisOptions = computed<readonly SegmentedOption[]>(() => {
    this.i18n();
    this.builder2Scope();
    this.language();

    return this.allowedBases().map((basis) => ({
      value: basis,
      label: this.transloco.translate(
        basis === 'PERIOD'
          ? 'builder2.compare.basisPeriod'
          : basis === 'BRANCH'
            ? 'builder2.compare.basisBranch'
            : basis === 'COMPANY'
              ? 'builder2.compare.basisCompany'
              : 'builder2.compare.basisTeam',
      ),
    }));
  });

  protected readonly currentBasis = computed<DatasetBasis>(() => {
    const raw = this.state.draft().querySpec.comparison?.basis;
    const allowed = this.allowedBases();
    return raw && allowed.includes(raw) ? raw : (allowed[0] ?? 'PERIOD');
  });

  protected readonly teamOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return FAKE_TEAMS.map((team) => ({
      value: team.id,
      label: lang === 'ar' ? team.name.ar : team.name.en,
    }));
  });

  protected readonly datasets = computed<readonly DatasetEntry[]>(() => {
    const existing = this.state.draft().querySpec.comparison?.datasets;
    if (existing && existing.length > 0) return existing;
    if (this.currentBasis() === 'TEAM') {
      return this.defaultTeamDatasets();
    }
    return [{ datePreset: 'CURRENT_MONTH' }, { datePreset: 'LAST_MONTH' }];
  });

  protected readonly canAddDataset = computed(() => this.datasets().length < 3);

  protected readonly presetOptions = computed<DropdownOption<DatePreset>[]>(() => {
    this.i18n();
    this.analyticsScope();
    this.language();

    return ALL_DATE_PRESETS.map((preset) => ({
      value: preset,
      label: this.transloco.translate(`analytics.datePreset.${preset}`),
    }));
  });

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    this.builder2Scope();
    const lang = this.language();

    return [
      { value: '', label: this.transloco.translate('builder2.compare.allBranches') },
      ...this.state.branches().map((branch) => ({
        value: branch.id,
        label: lang === 'ar' ? branch.name.ar : branch.name.en,
      })),
    ];
  });

  protected readonly grainOptions = computed<readonly SegmentedOption[]>(() => {
    this.i18n();
    this.builder2Scope();
    this.language();

    return GOVERNED_GRAINS.map((grain) => ({
      value: grain,
      label: this.transloco.translate(`builder2.grains.${grain}`),
    }));
  });

  protected readonly governedPeriodGrain = computed<GovernedGrain>(() => {
    const saved = this.state.draft().querySpec.comparison?.governedTarget?.periodGrain;
    if (saved) return saved;
    const dimGrain = this.state.draft().querySpec.dimension?.grain;
    if (dimGrain === 'QUARTER' || dimGrain === 'YEAR') return dimGrain;
    return 'MONTH';
  });

  protected readonly governedTargetOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    this.builder2Scope();
    const lang = this.language();
    const grain = this.governedPeriodGrain();

    return this.governedTargets().map((opt) => ({
      value: opt.id,
      label: `${opt.subjectName} · ${this.formatTargetPeriod(opt.periodStart, grain, lang)} · ${this.formatTargetValue(opt)}`,
    }));
  });

  protected readonly selectedGovernedTargetId = computed<string>(() => {
    const targets = this.governedTargets();
    const current = this.state.draft().querySpec.comparison?.governedTarget;
    if (!current || targets.length === 0) return '';
    const remembered = this.selectedGovernedId();
    if (remembered && targets.some((t) => t.id === remembered)) {
      return remembered;
    }
    const matched = targets.find(
      (t) =>
        t.branchId === current.branchId &&
        t.subjectType === current.subjectType &&
        t.subjectId === current.subjectId &&
        t.currencyCode === current.currencyCode &&
        t.periodGrain === current.periodGrain,
    );
    return matched?.id ?? '';
  });

  protected readonly governedTargetHint = computed(() => {
    this.i18n();
    this.builder2Scope();
    this.language();

    if (!this.targetsLoading() && this.governedTargets().length === 0) {
      return this.transloco.translate('builder2.compare.noApprovedTarget');
    }
    return this.transloco.translate('builder2.compare.governedTargetHint');
  });

  protected readonly compareWithError = computed<string | null>(() => {
    const errs = this.state.errors().compare;
    if (!errs) return null;
    if (errs['comparison']) return errs['comparison'];
    const type = this.comparisonType();
    if (type === 'NONE' || type === 'PREVIOUS_PERIOD' || type === 'PREVIOUS_YEAR') {
      return (
        errs['comparison.target'] ??
        errs['comparison.datasets'] ??
        errs['comparison.governedTarget'] ??
        null
      );
    }
    return null;
  });

  protected readonly datasetsError = computed<string | null>(() => {
    const errs = this.state.errors().compare;
    return errs?.['comparison.datasets'] ?? errs?.['datasets'] ?? null;
  });

  protected readonly targetError = computed<string | null>(() => {
    const errs = this.state.errors().compare;
    return errs?.['comparison.target'] ?? errs?.['target'] ?? null;
  });

  protected readonly governedTargetError = computed<string | null>(() => {
    const errs = this.state.errors().compare;
    return errs?.['comparison.governedTarget'] ?? errs?.['governedTarget'] ?? null;
  });

  constructor() {
    effect(() => {
      const catalog = this.state.catalog();
      const metrics = this.chosenMetrics();
      const allowed = this.allowedComparisonTypes();
      const raw = this.state.draft().querySpec.comparison?.type ?? 'NONE';
      const isNewOrDirty = !this.state.widgetId() || this.state.dirty();
      if (!catalog || metrics.length === 0 || allowed.length === 0 || !isNewOrDirty) return;
      if (!allowed.includes(raw)) {
        const next = allowed[0];
        queueMicrotask(() => {
          untracked(() => this.onComparisonTypeChange(next));
        });
      }
    });

    effect(() => {
      const target = this.state.draft().querySpec.comparison?.target;
      const money = this.isMoneyMetric();
      if (this.targetFocused) return;
      if (typeof target === 'number' && Number.isFinite(target)) {
        this.targetText.set(money ? (toMoneyString(target) ?? String(target)) : String(target));
      } else {
        this.targetText.set('');
      }
    });

    effect(() => {
      const type = this.comparisonType();
      const metricKey = this.primaryMetric()?.key ?? '';
      const grain = this.governedPeriodGrain();

      if (type !== 'GOVERNED_TARGET' || !metricKey) {
        this.targetFetchSeq++;
        untracked(() => {
          this.governedTargets.set([]);
          this.targetsLoading.set(false);
        });
        return;
      }

      const seq = ++this.targetFetchSeq;
      untracked(() => this.targetsLoading.set(true));

      void listGovernedTargets(metricKey, grain)
        .then((items) => {
          if (seq !== this.targetFetchSeq) return;
          this.governedTargets.set(items);
          this.targetsLoading.set(false);
        })
        .catch((err: unknown) => {
          if (seq !== this.targetFetchSeq) return;
          this.governedTargets.set([]);
          this.targetsLoading.set(false);
          const code = errorCodeOf(err);
          this.notify.error(this.transloco.translate(errorKey(code)));
        });
    });
  }

  protected onComparisonTypeChange(nextType: ComparisonType): void {
    const current = this.state.draft().querySpec.comparison;
    if (current?.type === nextType) return;

    switch (nextType) {
      case 'NONE':
      case 'PREVIOUS_PERIOD':
      case 'PREVIOUS_YEAR':
        this.state.patchQuery({ comparison: { type: nextType } });
        break;
      case 'DATASETS': {
        const basis = current?.basis && this.allowedBases().includes(current.basis)
          ? current.basis
          : (this.allowedBases()[0] ?? 'PERIOD');
        const existingDatasets = current?.datasets;
        let datasets: DatasetEntry[];
        if (basis === 'TEAM') {
          datasets =
            existingDatasets && existingDatasets.length >= 2 && existingDatasets.every((d) => Boolean(d.teamId))
              ? existingDatasets.slice(0, 3).map((d) => ({ ...d }))
              : this.defaultTeamDatasets();
        } else {
          datasets =
            existingDatasets && existingDatasets.length >= 2 && existingDatasets.some((d) => Boolean(d.datePreset))
              ? existingDatasets.slice(0, 3).map((d) => ({ ...d }))
              : [{ datePreset: 'CURRENT_MONTH' }, { datePreset: 'LAST_MONTH' }];
        }
        this.state.patchQuery({
          comparison: {
            type: 'DATASETS',
            basis,
            datasets,
          },
        });
        break;
      }
      case 'TARGET': {
        const existingTarget =
          typeof current?.target === 'number' && Number.isFinite(current.target) && current.target > 0
            ? current.target
            : undefined;
        this.state.patchQuery({
          comparison: {
            type: 'TARGET',
            ...(existingTarget !== undefined ? { target: existingTarget } : {}),
          },
        });
        break;
      }
      case 'GOVERNED_TARGET':
        this.state.patchQuery({
          comparison: {
            type: 'GOVERNED_TARGET',
            ...(current?.governedTarget ? { governedTarget: { ...current.governedTarget } } : {}),
          },
        });
        break;
    }
  }

  protected onBasisChange(value: string | null): void {
    if (value !== 'PERIOD' && value !== 'BRANCH' && value !== 'COMPANY' && value !== 'TEAM') return;
    const existing = this.datasets();
    let nextDatasets: DatasetEntry[];
    if (value === 'TEAM') {
      const hasTeams = existing.every((d) => Boolean(d.teamId));
      nextDatasets = hasTeams ? existing.map((d) => ({ ...d })) : this.defaultTeamDatasets();
    } else {
      const hasPeriod = existing.some((d) => Boolean(d.datePreset));
      nextDatasets = hasPeriod
        ? existing.map((d) => ({ ...d }))
        : [{ datePreset: 'CURRENT_MONTH' }, { datePreset: 'LAST_MONTH' }];
    }
    this.state.patchQuery({
      comparison: {
        type: 'DATASETS',
        basis: value,
        datasets: nextDatasets,
      },
    });
  }

  protected teamError(index: number): string | null {
    return this.state.errors().compare?.[`comparison.datasets.${index}.teamId`] ?? null;
  }

  protected labelError(index: number): string | null {
    return this.state.errors().compare?.[`comparison.datasets.${index}.label`] ?? null;
  }

  protected onDatasetTeamChange(index: number, teamId: string): void {
    const lang = this.language();
    const picked = FAKE_TEAMS.find((t) => t.id === teamId);
    const updated = this.datasets().map((d, i) => {
      if (i !== index) return { ...d };
      const prevTeam = FAKE_TEAMS.find((t) => t.id === d.teamId);
      const prevAutoLabel = prevTeam ? (lang === 'ar' ? prevTeam.name.ar : prevTeam.name.en) : '';
      const currentLabel = (d.label ?? '').trim();
      const shouldUpdateLabel = !currentLabel || currentLabel === prevAutoLabel || (prevTeam && (currentLabel === prevTeam.name.en || currentLabel === prevTeam.name.ar));
      const nextLabel = picked
        ? (shouldUpdateLabel ? (lang === 'ar' ? picked.name.ar : picked.name.en) : d.label ?? '')
        : d.label;
      return { teamId, label: nextLabel };
    });

    this.state.patchQuery({
      comparison: {
        type: 'DATASETS',
        basis: 'TEAM',
        datasets: updated,
      },
    });
  }

  protected onDatasetLabelChange(index: number, raw: string): void {
    const updated = this.datasets().map((d, i) =>
      i === index ? { ...d, label: raw } : { ...d },
    );

    this.state.patchQuery({
      comparison: {
        type: 'DATASETS',
        basis: 'TEAM',
        datasets: updated,
      },
    });
  }

  protected onDatasetPresetChange(index: number, preset: DatePreset): void {
    const updated = this.datasets().map((d, i) => {
      if (i !== index) return { ...d };
      if (preset === 'CUSTOM') {
        return {
          datePreset: preset,
          dateFrom: d.dateFrom ?? '2026-11-01',
          dateTo: d.dateTo ?? '2026-11-21',
          ...(d.branchId ? { branchId: d.branchId } : {}),
          ...(d.companyId ? { companyId: d.companyId } : {}),
        };
      }
      return {
        datePreset: preset,
        ...(d.branchId ? { branchId: d.branchId } : {}),
        ...(d.companyId ? { companyId: d.companyId } : {}),
      };
    });

    this.state.patchQuery({
      comparison: {
        type: 'DATASETS',
        basis: this.currentBasis(),
        datasets: updated,
      },
    });
  }

  protected datasetRange(row: DatasetEntry): DateRangeValue | null {
    if (!row.dateFrom || !row.dateTo) return null;
    const from = row.dateFrom.includes('T') ? row.dateFrom : `${row.dateFrom}T00:00`;
    const to = row.dateTo.includes('T') ? row.dateTo : `${row.dateTo}T23:59`;
    return { from, to, preset: null };
  }

  protected onDatasetRangeChange(index: number, range: DateRangeValue | null): void {
    if (!range) return;
    const dateFrom = range.from.slice(0, 10);
    const dateTo = range.to.slice(0, 10);
    const updated = this.datasets().map((d, i) =>
      i === index ? { ...d, datePreset: 'CUSTOM' as DatePreset, dateFrom, dateTo } : { ...d },
    );

    this.state.patchQuery({
      comparison: {
        type: 'DATASETS',
        basis: this.currentBasis(),
        datasets: updated,
      },
    });
  }

  protected onDatasetBranchChange(index: number, branchId: string): void {
    const updated = this.datasets().map((d, i) => {
      if (i !== index) return { ...d };
      const next: DatasetEntry = { ...d };
      if (branchId) {
        next.branchId = branchId;
      } else {
        delete next.branchId;
      }
      return next;
    });

    this.state.patchQuery({
      comparison: {
        type: 'DATASETS',
        basis: this.currentBasis(),
        datasets: updated,
      },
    });
  }

  protected addDataset(): void {
    if (!this.canAddDataset()) return;
    const basis = this.currentBasis();
    const current = this.datasets();
    let newEntry: DatasetEntry = { datePreset: 'LAST_QUARTER' };
    if (basis === 'TEAM') {
      const lang = this.language();
      const used = new Set(current.map((d) => d.teamId).filter(Boolean));
      const candidate =
        FAKE_TEAMS.find((t) => !used.has(t.id)) ?? FAKE_TEAMS[current.length % FAKE_TEAMS.length];
      newEntry = {
        teamId: candidate.id,
        label: lang === 'ar' ? candidate.name.ar : candidate.name.en,
      };
    }
    const nextRows: DatasetEntry[] = [...current.map((d) => ({ ...d })), newEntry];
    this.state.patchQuery({
      comparison: {
        type: 'DATASETS',
        basis,
        datasets: nextRows,
      },
    });
  }

  private defaultTeamDatasets(): DatasetEntry[] {
    const lang = this.language();
    return FAKE_TEAMS.slice(0, 2).map((t) => ({
      teamId: t.id,
      label: lang === 'ar' ? t.name.ar : t.name.en,
    }));
  }

  protected removeDataset(index: number): void {
    const current = this.datasets();
    if (current.length <= 2) return;
    const nextRows = current.filter((_, i) => i !== index).map((d) => ({ ...d }));
    this.state.patchQuery({
      comparison: {
        type: 'DATASETS',
        basis: this.currentBasis(),
        datasets: nextRows,
      },
    });
  }

  protected onTargetFocus(): void {
    this.targetFocused = true;
  }

  protected onTargetInput(raw: string): void {
    this.targetText.set(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      this.state.patchQuery({ comparison: { type: 'TARGET' } });
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      this.state.patchQuery({ comparison: { type: 'TARGET' } });
      return;
    }
    const target = this.isMoneyMetric() ? Number(toMoneyString(trimmed) ?? parsed) : parsed;
    this.state.patchQuery({ comparison: { type: 'TARGET', target } });
  }

  protected onTargetBlur(): void {
    this.targetFocused = false;
    const target = this.state.draft().querySpec.comparison?.target;
    if (this.isMoneyMetric() && typeof target === 'number' && Number.isFinite(target)) {
      this.targetText.set(toMoneyString(target) ?? String(target));
    }
  }

  protected onGovernedGrainChange(value: string | null): void {
    if (value !== 'MONTH' && value !== 'QUARTER' && value !== 'YEAR') return;
    this.selectedGovernedId.set(null);
    const existing = this.state.draft().querySpec.comparison?.governedTarget;
    this.state.patchQuery({
      comparison: {
        type: 'GOVERNED_TARGET',
        governedTarget: {
          branchId: existing?.branchId ?? '',
          subjectType: existing?.subjectType ?? 'BRANCH',
          subjectId: existing?.subjectId ?? '',
          currencyCode: existing?.currencyCode ?? this.currencyCode() ?? '',
          periodGrain: value,
        },
      },
    });
  }

  protected onGovernedTargetChange(targetId: string): void {
    const chosen = this.governedTargets().find((t) => t.id === targetId);
    if (!chosen) return;
    this.selectedGovernedId.set(chosen.id);
    this.state.patchQuery({
      comparison: {
        type: 'GOVERNED_TARGET',
        governedTarget: {
          branchId: chosen.branchId,
          subjectType: chosen.subjectType,
          subjectId: chosen.subjectId,
          currencyCode: chosen.currencyCode,
          periodGrain: chosen.periodGrain,
        },
      },
    });
  }

  private comparisonLabel(type: ComparisonType): string {
    switch (type) {
      case 'NONE':
        return this.transloco.translate('builder2.compare.none');
      case 'PREVIOUS_PERIOD':
        return this.transloco.translate('builder2.compare.previousPeriod');
      case 'PREVIOUS_YEAR':
        return this.transloco.translate('builder2.compare.previousYear');
      case 'DATASETS':
        return this.transloco.translate('builder2.compare.datasets');
      case 'TARGET':
        return this.transloco.translate('builder2.compare.targetNumber');
      case 'GOVERNED_TARGET':
        return this.transloco.translate('builder2.compare.governedTarget');
    }
  }

  private formatTargetPeriod(periodStart: string, grain: GovernedGrain, lang: 'ar' | 'en'): string {
    const match = /^(\d{4})-(\d{2})/.exec(periodStart);
    if (!match) return formatShortDate(periodStart, lang, 'MONTH_YEAR');
    const year = match[1];
    const month = Number(match[2]);
    if (grain === 'YEAR') return year;
    if (grain === 'QUARTER') {
      const q = Math.floor((month - 1) / 3) + 1;
      return `Q${q} ${year}`;
    }
    return formatShortDate(periodStart, lang, 'MONTH_YEAR');
  }

  private formatTargetValue(opt: GovernedTargetOption): string {
    const amount = formatMoneyNumber(opt.targetValue) ?? opt.targetValue;
    if (opt.unit === 'PERCENT') {
      return `${amount}%`;
    }
    return opt.currencyCode ? `${opt.currencyCode} ${amount}` : amount;
  }
}
