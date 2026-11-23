import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { Router } from '@angular/router';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { provideIcons } from '@ng-icons/core';
import { tablerHistory } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Badge, type BadgeTone } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { DASH, formatDateTime, formatNumber } from '../../../../../shared/ui/chart/chart-format';
import { DataCell, DataTable, type DataColumn } from '../../../../../shared/ui/data-table/data-table';
import { DateRange, type DateRangeValue } from '../../../../../shared/ui/date-range/date-range';
import { Field } from '../../../../../shared/ui/field/field';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import { errorText, reasonKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { Notify } from '../../../../../core/notify/notify';
import { alertReadKind, alertErrorText } from '../alerts-error';
import { listEvaluations } from '../alerts.api';
import {
  DEFAULT_EVALUATION_WINDOW_DAYS,
  formatAlertAmount,
  formatAlertRate,
  type AlertEvaluation,
  type AlertEvaluationOutcome,
  type AlertRule,
} from '../alerts.model';
import { OrgApi } from '../../../../../shared/widgets/dashboard/org.api';

const OUTCOME_TONES: Record<AlertEvaluationOutcome, BadgeTone> = {
  NOTIFIED: 'success',
  NOT_MET: 'none',
  BELOW_MIN_COHORT: 'none',
  MET_COOLDOWN: 'warning',
  MET_QUIET_DEFERRED: 'warning',
  MET_QUIET_DROPPED: 'warning',
  SOURCE_UNAVAILABLE: 'danger',
  RECIPIENT_INELIGIBLE: 'danger',
  ERROR: 'danger',
};

function defaultDateRange(nowIso: string): DateRangeValue {
  const endDate = nowIso.slice(0, 10);
  const start = new Date(Date.parse(nowIso) - DEFAULT_EVALUATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const startDate = start.toISOString().slice(0, 10);
  return {
    from: `${startDate}T00:00`,
    to: `${endDate}T23:59`,
    preset: null,
  };
}

@Component({
  selector: 'app-evaluations-modal',
  imports: [TranslocoPipe, Badge, Button, DataCell, DataTable, DateRange, Field, FullState, Modal],
  providers: [provideIcons({ tablerHistory })],
  templateUrl: './evaluations-modal.html',
})
export class EvaluationsModal {
  private readonly router = inject(Router);
  protected readonly canReadiness = can('crm.analytics.readiness.view');
  protected openReadiness(): void { void this.router.navigateByUrl('/crm/settings/data-readiness'); }
  private readonly org = inject(OrgApi);
  private static nextId = 0;
  protected readonly uid = `alert-evals-${++EvaluationsModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly modal = viewChild.required<Modal>('modal');

  protected readonly today = this.org.now();
  protected readonly rule = signal<AlertRule | null>(null);
  protected readonly dateRange = signal<DateRangeValue>(defaultDateRange(this.org.now()));
  protected readonly rows = signal<AlertEvaluation[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = signal(false);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loadError = signal(false);
  private readonly notify = inject(Notify);
  protected readonly failure = signal<unknown>(null);
  protected readonly failureKind = computed(() => alertReadKind(this.failure()));
  protected readonly failureText = computed(() => alertErrorText(this.transloco, this.failure()));
  protected readonly rangeError = signal<string | null>(null);

  private fetchSeq = 0;

  protected readonly periodDescribedBy = computed(() =>
    `${this.uid}-period-hint${this.rangeError() ? ` ${this.uid}-period-error` : ''}`,
  );

  protected readonly columns = computed<DataColumn[]>(() => {
    this.i18n();
    this.language();
    return [
      { key: 'scheduledFor', label: this.transloco.translate('alerts.evaluations.scheduledFor'), width: 1.2 },
      { key: 'evaluatedAt', label: this.transloco.translate('alerts.evaluations.evaluatedAt'), width: 1.2 },
      { key: 'outcome', label: this.transloco.translate('alerts.evaluations.outcome'), width: 1.2 },
      {
        key: 'observedValue',
        label: this.transloco.translate('alerts.evaluations.observedValue'),
        width: 1,
        align: 'end',
        numeric: true,
      },
      {
        key: 'cohort',
        label: this.transloco.translate('alerts.evaluations.cohort'),
        width: 0.9,
        align: 'end',
        numeric: true,
      },
      { key: 'reason', label: this.transloco.translate('alerts.evaluations.reason'), width: 1.3 },
    ];
  });

  protected readonly rowKey = (row: AlertEvaluation): string => row.id;

  open(rule: AlertRule): void {
    this.rule.set(rule);
    this.dateRange.set(defaultDateRange(this.org.now()));
    this.rows.set([]);
    this.hasMore.set(false);
    this.nextCursor.set(null);
    this.loadError.set(false);
    this.rangeError.set(null);
    this.modal().open();
    void this.fetchPage(true);
  }

  close(): void {
    this.modal().close();
  }

  protected onClosed(): void {
    this.fetchSeq++;
    this.rule.set(null);
    this.rows.set([]);
    this.loading.set(false);
    this.loadingMore.set(false);
  }

  protected onRangeChange(next: DateRangeValue | null): void {
    if (!next) return;
    this.dateRange.set(next);
    this.rangeError.set(null);
    void this.fetchPage(true);
  }

  protected retry(): void {
    void this.fetchPage(true);
  }

  protected loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;
    void this.fetchPage(false);
  }

  protected outcomeTone(outcome: AlertEvaluationOutcome): BadgeTone {
    return OUTCOME_TONES[outcome] ?? 'none';
  }

  protected formatTimestamp(iso: string | null | undefined): string {
    if (!iso) return DASH;
    this.i18n();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);
    return formatDateTime(iso, this.language(), chartT);
  }

  protected formatObserved(row: AlertEvaluation): string {
    return formatAlertAmount(
      row.observedValue,
      row.valueUnit,
      row.currencyCode,
      this.language(),
      row.conditionKind,
    );
  }

  protected formatCohort(row: AlertEvaluation): string {
    this.i18n();
    const lang = this.language();
    if (row.numerator !== null && row.denominator !== null) {
      const ofWord = lang === 'ar' ? 'من' : 'of';
      return formatAlertRate(row.numerator, row.denominator, lang, ofWord);
    }
    if (row.denominator !== null) {
      const n = Number(row.denominator);
      return Number.isFinite(n) ? formatNumber(n, lang) : DASH;
    }
    return DASH;
  }

  protected formatReason(row: AlertEvaluation): string {
    this.i18n();
    this.language();
    if (!row.reasonCode) return DASH;
    return this.transloco.translate(reasonKey(row.reasonCode));
  }

  private async fetchPage(reset: boolean): Promise<void> {
    const activeRule = this.rule();
    if (!activeRule) return;
    const seq = ++this.fetchSeq;

    if (reset) {
      this.loading.set(true);
      this.loadError.set(false);
    } else {
      this.loadingMore.set(true);
    }

    const range = this.dateRange();
    const fromIso = `${range.from.slice(0, 10)}T00:00:00.000Z`;
    const toIso = `${range.to.slice(0, 10)}T23:59:59.999Z`;

    try {
      const page = await listEvaluations(activeRule.id, {
        from: fromIso,
        to: toIso,
        cursor: reset ? null : this.nextCursor(),
        limit: 15,
      });
      if (seq !== this.fetchSeq) return;
      this.rangeError.set(null);
      this.rows.update((current) => (reset ? page.items : [...current, ...page.items]));
      this.hasMore.set(page.pageInfo.hasMore);
      this.nextCursor.set(page.pageInfo.nextCursor);
    } catch (error) {
      if (seq !== this.fetchSeq) return;
      const code = errorCodeOf(error);
      if (code === 'CRM_DASHBOARD_DATE_RANGE_EXCEEDED') {
        const text = errorText(error);
        this.rangeError.set(this.transloco.translate(text.key, text.params));
        if (reset) {
          this.rows.set([]);
          this.hasMore.set(false);
          this.nextCursor.set(null);
        }
      } else if (reset) {
        this.failure.set(error);
        this.loadError.set(true);
      } else {
        this.notify.error(alertErrorText(this.transloco, error));
      }
    } finally {
      if (seq === this.fetchSeq) {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    }
  }
}
