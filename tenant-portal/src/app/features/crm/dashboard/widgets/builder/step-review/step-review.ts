import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowRight, tablerExclamationCircle, tablerSend } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { pluralKey } from '../../../../../../core/i18n/plural';
import { Notify } from '../../../../../../core/notify/notify';
import { Badge } from '../../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../../shared/ui/button/button';
import {
  DASH,
  formatDate,
  formatMoney,
  formatNumber,
} from '../../../../../../shared/ui/chart/chart-format';
import { Field } from '../../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../../shared/ui/overlay/zoom';
import type { CatalogMetric } from '../../../../../../shared/widgets/dashboard/analytics.model';
import { can } from '../../../../../../shared/widgets/dashboard/analytics-permissions';
import { PublishModal } from '../../publish-modal/publish-modal';
import {
  BuilderState,
  STEP_ORDER,
  type BuilderDraft,
  type StepId,
} from '../builder-state';
import { countFilterLeaves } from '../filter-tree';
import { selectScopeTranslation } from '../../../../../../shared/widgets/dashboard/scope-translation';

type DraftWithReviewNotes = BuilderDraft & {
  changeSummary?: string | null;
  internalNotes?: string | null;
};

interface SummaryRow {
  key: string;
  label: string;
  hint: string;
  value: string;
  ltr?: boolean;
}

interface ValidationRow {
  id: StepId;
  label: string;
  valid: boolean;
}

const FALLBACK_SUMMARY_STEPS: readonly StepId[] = [
  'data',
  'metrics',
  'scope',
  'compare',
  'presentation',
];

@Component({
  selector: 'app-step-review',
  imports: [NgIcon, TranslocoPipe, Badge, Button, Field, PublishModal],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-widget-builder-2', alias: 'builder2' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({ tablerSend, tablerExclamationCircle, tablerArrowRight }),
  ],
  templateUrl: './step-review.html',
  host: { class: 'block min-w-0' },
})
export class StepReview {
  protected readonly state = inject(BuilderState);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);
  private readonly builder2Scope = toSignal(selectScopeTranslation(this.transloco, 'crm-widget-builder-2', 'builder2'));
  private readonly analyticsScope = toSignal(this.transloco.selectTranslation('analytics'));

  private readonly publishModal = viewChild.required<PublishModal>('publishModal');

  protected readonly canPublish = can('crm.widgets.publish');
  protected readonly publishingFlow = signal(false);
  protected readonly activeHint = signal<string | null>(null);
  protected readonly tooltipPlace = signal({ top: 0, start: 0 });
  protected readonly tipPlaced = signal(false);

  private destroyed = false;

  private readonly summarySteps = computed<readonly StepId[]>(() => {
    const ordered = STEP_ORDER.filter((id) => id !== 'review');
    return ordered.length > 0 ? ordered : FALLBACK_SUMMARY_STEPS;
  });

  protected readonly changeSummaryValue = computed(() => {
    const draft = this.state.draft() as DraftWithReviewNotes;
    if (draft.changeSummary !== undefined) {
      return draft.changeSummary ?? '';
    }
    return this.state.draftState()?.draft?.changeSummary ?? '';
  });

  protected readonly internalNotesValue = computed(() => {
    const draft = this.state.draft() as DraftWithReviewNotes;
    if (draft.internalNotes !== undefined) {
      return draft.internalNotes ?? '';
    }
    return this.state.draftState()?.draft?.internalNotes ?? '';
  });

  protected readonly summaryRows = computed<readonly SummaryRow[]>(() => {
    this.i18n();
    this.builder2Scope();
    this.analyticsScope();
    const lang = this.language();
    const draft = this.state.draft();
    const catalog = this.state.catalog();
    const metricMap = new Map<string, CatalogMetric>(
      (catalog?.metrics ?? []).map((m) => [m.key, m]),
    );
    const dimMap = new Map((catalog?.dimensions ?? []).map((d) => [d.key, d]));

    const sourceValue = draft.source
      ? this.transloco.translate(`builder2.sources.${draft.source}`)
      : DASH;

    const chosenMetrics = draft.querySpec.series
      .map((s) => metricMap.get(s.metricKey))
      .filter((m): m is CatalogMetric => Boolean(m));

    const metricsText =
      draft.querySpec.series.length > 0
        ? draft.querySpec.series
            .map((s) => {
              const m = metricMap.get(s.metricKey);
              if (m) return lang === 'ar' ? m.labelAr : m.labelEn;
              return s.label || s.metricKey;
            })
            .join(' · ')
        : DASH;

    const groupingParts: string[] = [];
    const dim = draft.querySpec.dimension;
    if (dim && dim.key && dim.key !== 'none') {
      const dimMeta = dimMap.get(dim.key);
      const dimLabel = dimMeta
        ? (lang === 'ar' ? dimMeta.labelAr : dimMeta.labelEn) ?? dim.key
        : dim.key;
      const grainLabel =
        dim.key === 'time' && dim.grain
          ? ` (${this.transloco.translate(`builder2.grains.${dim.grain}`)})`
          : '';
      groupingParts.push(`${dimLabel}${grainLabel}`);
    }
    const breakdown = draft.querySpec.breakdown;
    if (breakdown && breakdown.key && breakdown.key !== 'none') {
      const bdMeta = dimMap.get(breakdown.key);
      const bdLabel = bdMeta
        ? (lang === 'ar' ? bdMeta.labelAr : bdMeta.labelEn) ?? breakdown.key
        : breakdown.key;
      const topPart = breakdown.topN
        ? ` (${this.transloco.translate('builder2.review.topN', { n: breakdown.topN })})`
        : '';
      groupingParts.push(`${bdLabel}${topPart}`);
    }
    const groupingText =
      groupingParts.length > 0
        ? groupingParts.join(' · ')
        : this.transloco.translate('builder2.review.none');

    const filters = draft.querySpec.filters;
    let periodText = DASH;
    if (filters?.datePreset === 'CUSTOM' && filters.dateFrom && filters.dateTo) {
      periodText = `${formatDate(filters.dateFrom, lang)} – ${formatDate(filters.dateTo, lang)}`;
    } else if (filters?.datePreset) {
      periodText = this.transloco.translate(`analytics.datePreset.${filters.datePreset}`);
    }
    const primaryMetric = chosenMetrics[0] ?? null;
    const basisKey = primaryMetric?.readiness.basis;
    const basisText = basisKey ? this.transloco.translate(`analytics.basis.${basisKey}`) : '';
    const periodBasisText = basisText && periodText !== DASH ? `${periodText} · ${basisText}` : periodText;

    const scopeText = this.formatScope(draft, lang);
    const comparisonText = this.formatComparison(draft, primaryMetric, lang);
    const chartText = draft.visualizationType
      ? this.transloco.translate(`analytics.visualization.${draft.visualizationType}`)
      : DASH;
    const titleText = draft.name.trim() || DASH;

    return [
      {
        key: 'source',
        label: this.transloco.translate('builder2.review.source'),
        hint: this.transloco.translate('builder2.review.sourceHint'),
        value: sourceValue,
      },
      {
        key: 'metrics',
        label: this.transloco.translate('builder2.review.metrics'),
        hint: this.transloco.translate('builder2.review.metricsHint'),
        value: metricsText,
      },
      {
        key: 'grouping',
        label: this.transloco.translate('builder2.review.grouping'),
        hint: this.transloco.translate('builder2.review.groupingHint'),
        value: groupingText,
      },
      {
        key: 'periodBasis',
        label: this.transloco.translate('builder2.review.periodBasis'),
        hint: this.transloco.translate('builder2.review.periodBasisHint'),
        value: periodBasisText,
      },
      {
        key: 'scope',
        label: this.transloco.translate('builder2.review.scope'),
        hint: this.transloco.translate('builder2.review.scopeHint'),
        value: scopeText,
      },
      {
        key: 'filterRules',
        label: this.transloco.translate('builder2.review.filterRules'),
        hint: this.transloco.translate('builder2.review.filterRulesHint'),
        value: (() => {
          const leafCount = countFilterLeaves(draft.querySpec.filterTree);
          return leafCount > 0
            ? this.transloco.translate(pluralKey('builder2.review.filterRulesCountPlural', leafCount, lang), { n: leafCount })
            : this.transloco.translate('builder2.review.none');
        })(),
      },
      {
        key: 'comparison',
        label: this.transloco.translate('builder2.review.comparison'),
        hint: this.transloco.translate('builder2.review.comparisonHint'),
        value: comparisonText,
      },
      {
        key: 'chartKind',
        label: this.transloco.translate('builder2.review.chartKind'),
        hint: this.transloco.translate('builder2.review.chartKindHint'),
        value: chartText,
      },
      {
        key: 'title',
        label: this.transloco.translate('builder2.review.title'),
        hint: this.transloco.translate('builder2.review.titleHint'),
        value: titleText,
      },
    ];
  });

  protected readonly validationRows = computed<readonly ValidationRow[]>(() => {
    this.i18n();
    this.builder2Scope();
    this.language();
    const errorsByStep = this.state.errors();

    return this.summarySteps().map((id) => {
      const stepErrors = errorsByStep[id];
      const hasError = Boolean(stepErrors && Object.keys(stepErrors).length > 0);
      return {
        id,
        label: this.transloco.translate(`builder2.steps.${id}`),
        valid: !hasError,
      };
    });
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
    });

    effect(() => {
      const catalog = this.state.catalog();
      const draft = this.state.draft();
      void draft.source;
      void draft.name;
      void draft.description;
      void draft.visualizationType;
      void draft.querySpec;
      void draft.displaySpec;

      if (!catalog) return;
      queueMicrotask(() => {
        if (this.destroyed) return;
        untracked(() => {
          for (const stepId of this.summarySteps()) {
            this.state.validateStep(stepId);
          }
        });
      });
    });
  }

  protected goToStep(stepId: StepId): void {
    this.state.step.set(stepId);
  }

  protected onChangeSummaryInput(value: string): void {
    this.state.patch({
      changeSummary: value.trim() ? value : null,
    } as Partial<BuilderDraft>);
  }

  protected onInternalNotesInput(value: string): void {
    this.state.patch({
      internalNotes: value.trim() ? value : null,
    } as Partial<BuilderDraft>);
  }

  protected async onPublish(): Promise<void> {
    if (!this.canPublish || this.publishingFlow()) return;

    const invalid = this.state.validateAll();
    if (invalid) {
      this.state.step.set(invalid.step);
      return;
    }

    this.publishingFlow.set(true);
    try {
      if (this.state.dirty() || !this.state.widgetId() || !this.state.draftState()?.draft) {
        const saved = await this.state.saveDraft();
        if (!saved) return;
      }

      const id = this.state.widgetId();
      const ds = this.state.draftState();
      if (!id || !ds || !ds.draft) {
        this.notify.warning(this.transloco.translate('builder2.review.saveBeforePublish'));
        return;
      }

      const published = await this.publishModal().open(id, ds);
      if (!published) return;

      const version =
        this.publishModal().lastPublishedVersion() ?? (ds.activeVersionNumber ?? 0) + 1;

      // Stay on the review step; only the server-side state (status, version, revisions) is re-read.
      await this.state.reload({ keepStep: true });
      this.state.notifyPublished();

      this.notify.success(
        this.transloco.translate('builder2.review.published', { n: version }),
      );
    } finally {
      this.publishingFlow.set(false);
    }
  }

  protected showHint(key: string, triggerEl: HTMLElement, tipEl: HTMLElement): void {
    const rect = rectInPage(triggerEl);
    const tip = rectInPage(tipEl);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    let start = (rtl ? width - rect.left : rect.right) + 6;
    if (start + tip.width > width - 8) {
      const altStart = (rtl ? width - rect.right : rect.left) - 6 - tip.width;
      start = altStart >= 8 ? altStart : Math.max(8, width - 8 - tip.width);
    }

    const top = Math.max(8, rect.bottom - tip.height);
    this.tooltipPlace.set({ top, start });
    this.activeHint.set(key);
    this.tipPlaced.set(true);
  }

  protected hideHint(): void {
    this.activeHint.set(null);
    this.tipPlaced.set(false);
  }

  private formatScope(draft: BuilderDraft, lang: 'ar' | 'en'): string {
    const binding = draft.querySpec.scopeBinding;
    const branchMap = new Map(
      this.state.branches().map((b) => [b.id, lang === 'ar' ? b.name.ar : b.name.en]),
    );
    const parts: string[] = [];

    if (binding?.kind === 'FIXED_REQUESTED') {
      const fixedLabel = this.transloco.translate('builder2.review.fixedScope');
      const ceilingBranches = (binding.ceiling.branchIds ?? [])
        .map((id) => branchMap.get(id) ?? id)
        .filter(Boolean);
      parts.push(
        ceilingBranches.length > 0 ? `${fixedLabel}: ${ceilingBranches.join(', ')}` : fixedLabel,
      );
    } else {
      parts.push(this.transloco.translate('builder2.review.viewerRelative'));
    }

    const filterBranch = draft.querySpec.filters?.branchId;
    if (filterBranch) {
      parts.push(branchMap.get(filterBranch) ?? filterBranch);
    }

    return parts.join(' · ');
  }

  private formatComparison(
    draft: BuilderDraft,
    primaryMetric: CatalogMetric | null,
    lang: 'ar' | 'en',
  ): string {
    const comp = draft.querySpec.comparison;
    if (!comp || comp.type === 'NONE') {
      return this.transloco.translate('builder2.review.none');
    }

    switch (comp.type) {
      case 'PREVIOUS_PERIOD':
        return this.transloco.translate('builder2.compare.previousPeriod');
      case 'PREVIOUS_YEAR':
        return this.transloco.translate('builder2.compare.previousYear');
      case 'TARGET': {
        const label = this.transloco.translate('builder2.compare.targetNumber');
        if (typeof comp.target !== 'number' || !Number.isFinite(comp.target)) {
          return label;
        }
        const currency = draft.querySpec.filters?.currencyCode;
        const formatted =
          primaryMetric?.unit === 'MONEY' && currency
            ? formatMoney(comp.target, currency)
            : formatNumber(comp.target, lang, Number.isInteger(comp.target) ? 0 : 2);
        return `${label}: ${formatted}`;
      }
      case 'GOVERNED_TARGET': {
        const label = this.transloco.translate('builder2.compare.governedTarget');
        const gt = comp.governedTarget;
        if (!gt) return label;
        const grainLabel = this.transloco.translate(`builder2.grains.${gt.periodGrain}`);
        const detail = gt.currencyCode ? `${grainLabel} · ${gt.currencyCode}` : grainLabel;
        return `${label} (${detail})`;
      }
      case 'DATASETS': {
        const basisKey =
          comp.basis === 'BRANCH'
            ? 'builder2.compare.basisBranch'
            : comp.basis === 'COMPANY'
              ? 'builder2.compare.basisCompany'
              : comp.basis === 'TEAM'
                ? 'builder2.compare.basisTeam'
                : 'builder2.compare.basisPeriod';
        const summaryKey =
          comp.basis === 'TEAM'
            ? 'builder2.review.datasetsTeamsSummary'
            : 'builder2.review.datasetsSummary';
        return this.transloco.translate(summaryKey, {
          count: comp.datasets?.length ?? 0,
          basis: this.transloco.translate(basisKey),
        });
      }
    }
  }
}
