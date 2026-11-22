import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Badge } from '../../../../ui/badge/badge';
import type { EntityRef, WidgetExecution } from '../../../../ui/chart/chart.model';
import { DASH, formatValue } from '../../../../ui/chart/chart-format';
import { DataCell, DataColumn, DataTable } from '../../../../ui/data-table/data-table';

type ScorecardStatus = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'UNKNOWN';
type BadgeTone = 'success' | 'warning' | 'danger' | 'none';

interface ScorecardRow {
  id: string;
  metric: string;
  actual: string;
  target: string;
  status: ScorecardStatus;
  statusLabel: string;
  statusTone: BadgeTone;
  entityRef?: EntityRef;
}

const STATUS_TONES: Record<ScorecardStatus, BadgeTone> = {
  ON_TRACK: 'success',
  AT_RISK: 'warning',
  OFF_TRACK: 'danger',
  UNKNOWN: 'none',
};

@Component({
  selector: 'app-kind-scorecard',
  imports: [DataTable, DataCell, Badge],
  providers: [
    provideTranslocoScope(
      { scope: 'dashboard-kinds', alias: 'dashboardKinds' },
      { scope: 'chart', alias: 'chart' },
    ),
  ],
  templateUrl: './scorecard.html',
  host: { class: 'block size-full overflow-auto' },
})
export class ScorecardKind {
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly kindsScope = toSignal(this.transloco.selectTranslation('dashboard-kinds'));
  private readonly chartScope = toSignal(this.transloco.selectTranslation('chart'));

  readonly execution = input.required<WidgetExecution>();
  readonly title = input('');
  readonly pointClick = output<{ pointKey: string; seriesKey?: string }>();
  readonly openRecord = output<EntityRef>();

  protected readonly rowKey = (row: ScorecardRow) => row.id;

  protected readonly columns = computed<DataColumn[]>(() => {
    this.i18n();
    this.kindsScope();
    return [
      { key: 'metric', label: this.transloco.translate('dashboardKinds.metric'), width: 2, align: 'start' },
      {
        key: 'actual',
        label: this.transloco.translate('dashboardKinds.actual'),
        width: 1,
        align: 'end',
        numeric: true,
      },
      {
        key: 'target',
        label: this.transloco.translate('dashboardKinds.target'),
        width: 1,
        align: 'end',
        numeric: true,
      },
      { key: 'status', label: this.transloco.translate('dashboardKinds.statusLabel'), width: 1.2, align: 'start' },
    ];
  });

  protected readonly rows = computed<ScorecardRow[]>(() => {
    this.i18n();
    this.kindsScope();
    this.chartScope();
    const exec = this.execution();
    const lang = this.language();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);
    if (exec.result?.shape !== 'ROWS' || exec.result.rowKind !== 'SCORECARD') {
      return [];
    }

    return exec.result.rows.map((row) => {
      const primary = row.measures[0];
      const actual = primary
        ? formatValue(primary.value, primary.unit, primary.currencyCode, lang, chartT)
        : DASH;
      const targetRef = primary?.references?.find((ref) => ref.kind === 'TARGET');
      const target = targetRef
        ? formatValue(targetRef.value, targetRef.unit, targetRef.currencyCode ?? primary?.currencyCode, lang, chartT)
        : DASH;

      return {
        id: row.id,
        metric: row.label,
        actual,
        target,
        status: row.status,
        statusLabel: this.transloco.translate(`dashboardKinds.status.${row.status}`),
        statusTone: STATUS_TONES[row.status] ?? 'none',
        entityRef: row.entityRef,
      };
    });
  });

  protected readonly rowClickable = computed(() => this.rows().some((row) => Boolean(row.entityRef)));

  protected metricOf(row: unknown): string {
    return (row as ScorecardRow).metric;
  }

  protected statusToneOf(row: unknown): BadgeTone {
    return (row as ScorecardRow).statusTone;
  }

  protected statusLabelOf(row: unknown): string {
    return (row as ScorecardRow).statusLabel;
  }

  protected onRowClick(row: ScorecardRow) {
    if (row.entityRef) {
      this.openRecord.emit(row.entityRef);
      return;
    }
    this.pointClick.emit({ pointKey: row.id });
  }
}
