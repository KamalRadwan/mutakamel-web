import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerExclamationCircle,
  tablerHelpCircle,
  tablerTable,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import type { SeriesUnit } from '../../../../../shared/ui/chart/chart.model';
import {
  DASH,
  formatDate,
  formatDateTime,
  formatRateN,
  formatValue,
} from '../../../../../shared/ui/chart/chart-format';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import {
  explainReceipt,
  getCatalog,
  getReceipt,
} from '../../../../../shared/widgets/dashboard/analytics.api';
import type {
  Catalog,
  Explain,
  Receipt,
} from '../../../../../shared/widgets/dashboard/analytics.model';
import { errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import {
  FAKE_BRANCHES,
  FAKE_PEOPLE,
  FAKE_TEAMS,
} from '../../../../../shared/widgets/dashboard/fake/fake-org';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';

export type RecordsNavTarget =
  | unknown[]
  | { commands: unknown[]; queryParams?: Record<string, string> };

const VALID_UNITS = new Set<SeriesUnit>([
  'COUNT',
  'MONEY',
  'PERCENT',
  'RATIO',
  'DURATION',
  'SCORE',
]);

const KNOWN_TIME_MODELS = new Set([
  'EVENT',
  'COHORT',
  'SNAPSHOT',
  'INTERVAL',
  'CUSTOM',
  'UNKNOWN',
]);

const KNOWN_DATE_FIELDS = new Set([
  'CREATED_AT',
  'CONVERTED_AT',
  'FIRST_RESPONSE_AT',
  'UPDATED_AT',
  'EXPECTED_CLOSE_AT',
  'WON_AT',
  'CLOSED_AT',
  'STAGE_CHANGED_AT',
  'COMPLETED_AT',
  'SCHEDULED_START_AT',
  'OCCURRED_AT',
  'TRIGGERED_AT',
  'PERIOD_END_AT',
  'UNKNOWN',
]);

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5] as const;

function toSeriesUnit(raw: string | null | undefined): SeriesUnit {
  if (raw && VALID_UNITS.has(raw as SeriesUnit)) {
    return raw as SeriesUnit;
  }
  return 'COUNT';
}

function parseFiniteNumber(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

@Component({
  selector: 'app-explain-modal',
  imports: [NgIcon, TranslocoPipe, Badge, Button, Modal],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-dash-filters', alias: 'dashFilters' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({ tablerExclamationCircle, tablerHelpCircle, tablerTable }),
  ],
  templateUrl: './explain-modal.html',
})
export class ExplainModal {
  private static nextId = 0;
  protected readonly uid = `explain-modal-${++ExplainModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required(Modal);

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly loading = signal(false);
  protected readonly receipt = signal<Receipt | null>(null);
  protected readonly explain = signal<Explain | null>(null);
  protected readonly catalog = signal<Catalog | null>(null);
  protected readonly recordsTarget = signal<RecordsNavTarget | null>(null);
  protected readonly activeTip = signal<string | null>(null);
  protected readonly tipPlace = signal({ top: 0, start: 0 });
  private loadSeq = 0;

  protected readonly metricName = computed(() => {
    this.i18n();
    const lang = this.language();
    const exp = this.explain();
    if (!exp) return '';
    const metric = this.catalog()?.metrics.find((m) => m.key === exp.definition.metricKey);
    if (metric) {
      return lang === 'ar' ? metric.labelAr : metric.labelEn;
    }
    return exp.definition.metricKey;
  });

  protected readonly definitionSentence = computed(() => {
    this.i18n();
    this.language();
    const exp = this.explain();
    if (!exp) return '';
    const tm = KNOWN_TIME_MODELS.has(exp.definition.timeModel)
      ? exp.definition.timeModel
      : 'UNKNOWN';
    const df = KNOWN_DATE_FIELDS.has(exp.definition.dateField)
      ? exp.definition.dateField
      : 'UNKNOWN';
    const dateFieldLabel = this.transloco.translate(`dashFilters.explain.dateField.${df}`);
    const basisLabel = this.transloco.translate(`analytics.basis.${exp.definition.basis}`);
    return this.transloco.translate(`dashFilters.explain.timeModel.${tm}`, {
      dateField: dateFieldLabel,
      basis: basisLabel,
    });
  });

  protected readonly filterChips = computed<string[]>(() => {
    this.i18n();
    const lang = this.language();
    const exp = this.explain();
    const rec = this.receipt();
    if (!exp && !rec) return [];

    const rawFilters = exp?.filters ?? rec?.filters ?? {};
    const chips: string[] = [];

    const branchMap = new Map(
      FAKE_BRANCHES.map((b) => [b.id, lang === 'ar' ? b.name.ar : b.name.en]),
    );
    const teamMap = new Map(
      FAKE_TEAMS.map((t) => [t.id, lang === 'ar' ? t.name.ar : t.name.en]),
    );
    const personMap = new Map(
      FAKE_PEOPLE.map((p) => [p.id, lang === 'ar' ? p.nameAr : p.name]),
    );

    const resolveList = (val: unknown, lookup: Map<string, string>): string => {
      const ids = Array.isArray(val) ? val.map(String) : [String(val)];
      const sep = lang === 'ar' ? '، ' : ', ';
      return ids.map((id) => lookup.get(id) ?? id).join(sep);
    };

    const keyLabel = (key: string): string => {
      const i18nKey = `dashFilters.filterKey.${key}`;
      const translated = this.transloco.translate(i18nKey);
      return translated && translated !== i18nKey ? translated : key;
    };

    let hasPeriod = false;
    for (const [key, val] of Object.entries(rawFilters)) {
      if (val === undefined || val === null || val === '') continue;
      if (Array.isArray(val) && val.length === 0) continue;

      if (key === 'datePreset' || key === 'dateFrom' || key === 'dateTo') {
        hasPeriod = true;
      }

      let formattedVal = '';
      if (key === 'datePreset') {
        formattedVal = this.transloco.translate(`analytics.datePreset.${String(val)}`);
      } else if (key === 'compare') {
        if (val === 'NONE') continue;
        formattedVal = this.transloco.translate(`analytics.compare.${String(val)}`);
      } else if (key === 'dateFrom' || key === 'dateTo') {
        formattedVal = formatDate(String(val), lang);
      } else if (key === 'branchId' || key === 'branchIds') {
        formattedVal = resolveList(val, branchMap);
      } else if (key === 'teamIds') {
        formattedVal = resolveList(val, teamMap);
      } else if (key === 'ownerUserId' || key === 'ownerUserIds') {
        formattedVal = resolveList(val, personMap);
      } else if (Array.isArray(val)) {
        formattedVal = val.map(String).join(lang === 'ar' ? '، ' : ', ');
      } else {
        formattedVal = String(val);
      }

      chips.push(`${keyLabel(key)}: ${formattedVal}`);
    }

    const period = exp?.scope.period ?? rec?.period;
    if (!hasPeriod && period?.from && period?.to) {
      chips.unshift(
        `${keyLabel('period')}: ${formatDate(period.from, lang)} – ${formatDate(period.to, lang)}`,
      );
    }

    return chips;
  });

  protected readonly rateDisplay = computed<string | null>(() => {
    this.i18n();
    const lang = this.language();
    const exp = this.explain();
    const rec = this.receipt();
    const num = parseFiniteNumber(exp?.numerator?.value ?? rec?.result.numerator);
    const den = parseFiniteNumber(exp?.denominator?.value ?? rec?.result.denominator);
    if (num === null || den === null) return null;
    return formatRateN(num, den, lang);
  });

  protected readonly valueDisplay = computed<string>(() => {
    this.i18n();
    const lang = this.language();
    const exp = this.explain();
    const rec = this.receipt();
    const num = parseFiniteNumber(exp?.value.value ?? rec?.result.value);
    if (num === null) return DASH;
    const unit = toSeriesUnit(exp?.definition.unit ?? rec?.result.unit);
    const currency = rec?.result.currencyCode ?? undefined;
    return formatValue(num, unit, currency, lang);
  });

  protected readonly coverageText = computed<string>(() => {
    this.i18n();
    const lang = this.language();
    const coverage = this.explain()?.coverage ?? this.receipt()?.coverage;
    if (!coverage) return DASH;
    const dateStr = coverage.coverageStartedAt
      ? formatDate(coverage.coverageStartedAt, lang)
      : null;

    if (coverage.historyIncomplete) {
      return dateStr
        ? this.transloco.translate('dashFilters.historyIncomplete', { date: dateStr })
        : this.transloco.translate('dashFilters.historyIncompleteNoDate');
    }
    return dateStr
      ? this.transloco.translate('dashFilters.coverageCompleteSince', { date: dateStr })
      : this.transloco.translate('dashFilters.coverageComplete');
  });

  protected readonly asOfText = computed<string>(() => {
    this.i18n();
    const lang = this.language();
    const iso = this.explain()?.scope.asOf ?? this.receipt()?.asOf;
    if (!iso) return DASH;
    return formatDateTime(iso, lang);
  });

  protected readonly sourceItems = computed<{ label: string; modeLabel: string }[]>(() => {
    this.i18n();
    this.language();
    const sources = this.explain()?.definition.sources ?? [];
    return sources.map((src) => {
      const sanitized = src.sourceKey.replace(/\./g, '_');
      const nameKey = `dashFilters.sourceName.${sanitized}`;
      const translated = this.transloco.translate(nameKey);
      const label = translated && translated !== nameKey ? translated : src.sourceKey;
      const modeLabel = this.transloco.translate(`dashFilters.sourceMode.${src.mode}`);
      return { label, modeLabel };
    });
  });

  open(receiptId: string, recordsLink: RecordsNavTarget | null = null): void {
    const seq = ++this.loadSeq;
    this.recordsTarget.set(recordsLink);
    this.receipt.set(null);
    this.explain.set(null);
    this.loading.set(true);
    this.activeTip.set(null);
    this.modal().open();

    void Promise.all([
      getReceipt(receiptId),
      explainReceipt(receiptId),
      getCatalog().catch(() => null),
    ])
      .then(([receipt, explain, catalog]) => {
        if (seq !== this.loadSeq) return;
        this.receipt.set(receipt);
        this.explain.set(explain);
        this.catalog.set(catalog);
        this.loading.set(false);
      })
      .catch((error: unknown) => {
        if (seq !== this.loadSeq) return;
        this.loading.set(false);
        this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
        this.modal().close();
      });
  }

  protected close(): void {
    this.modal().close();
  }

  protected onClosed(): void {
    this.loadSeq++;
    this.activeTip.set(null);
    this.loading.set(false);
  }

  protected openRecords(): void {
    const target = this.recordsTarget();
    if (!target) return;
    this.modal().close();
    if (Array.isArray(target)) {
      void this.router.navigate(target);
    } else {
      void this.router.navigate(target.commands, { queryParams: target.queryParams });
    }
  }

  protected showTip(key: string, triggerEl: HTMLElement, tipEl: HTMLElement): void {
    const rect = rectInPage(triggerEl);
    const tipRect = rectInPage(tipEl);
    const tipWidth = tipRect.width || 240;
    const tipHeight = tipRect.height || 20;
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    let start = (rtl ? width - rect.left : rect.right) + 6;
    if (start + tipWidth > width - 8) {
      const altStart = (rtl ? width - rect.right : rect.left) - 6 - tipWidth;
      start = altStart >= 8 ? altStart : Math.max(8, width - 8 - tipWidth);
    }
    const top = Math.max(8, rect.bottom - tipHeight);

    this.tipPlace.set({ top, start });
    this.activeTip.set(key);
  }

  protected hideTip(): void {
    this.activeTip.set(null);
  }
}
