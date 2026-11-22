import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBellRinging } from '@ng-icons/tabler-icons';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Badge } from '../../../../ui/badge/badge';
import type { EntityRef, WidgetExecution } from '../../../../ui/chart/chart.model';
import { formatDate, formatDateTime } from '../../../../ui/chart/chart-format';
import { reasonKey } from '../../panel-state';

type BadgeTone = 'danger' | 'warning' | 'success' | 'none';
type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';

interface AlertItem {
  id: string;
  title: string;
  datePart: string;
  clockPart: string;
  reason: string;
  subtitle: string;
  tone: BadgeTone;
  severityLabel: string;
  entityRef: EntityRef;
}

const SEVERITY_TONES: Record<AlertSeverity, BadgeTone> = {
  CRITICAL: 'danger',
  WARNING: 'warning',
  INFO: 'none',
  SUCCESS: 'success',
};

@Component({
  selector: 'app-kind-alert-list',
  imports: [NgIcon, Badge],
  providers: [
    provideTranslocoScope(
      { scope: 'dashboard-kinds', alias: 'dashboardKinds' },
      { scope: 'analytics', alias: 'analytics' },
      { scope: 'chart', alias: 'chart' },
    ),
    provideIcons({ tablerBellRinging }),
  ],
  templateUrl: './alert-list.html',
  host: { class: 'block size-full overflow-auto' },
})
export class AlertListKind {
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly kindsScope = toSignal(this.transloco.selectTranslation('dashboard-kinds'));
  private readonly analyticsScope = toSignal(this.transloco.selectTranslation('analytics'));
  private readonly chartScope = toSignal(this.transloco.selectTranslation('chart'));

  readonly execution = input.required<WidgetExecution>();
  readonly title = input('');
  readonly pointClick = output<{ pointKey: string; seriesKey?: string }>();
  readonly openRecord = output<EntityRef>();

  protected readonly items = computed<AlertItem[]>(() => {
    this.i18n();
    this.kindsScope();
    this.analyticsScope();
    this.chartScope();
    const exec = this.execution();
    const lang = this.language();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);
    if (exec.result?.shape !== 'ROWS' || exec.result.rowKind !== 'ALERT') {
      return [];
    }

    return exec.result.rows.map((row) => {
      const severity = normalizeSeverity(row.severity);
      const fullTime = formatDateTime(row.occurredAt, lang, chartT);
      const clockMatch = /\s(\d{2}:\d{2})$/.exec(fullTime);
      const datePart = clockMatch ? formatDate(row.occurredAt, lang, chartT) : fullTime;
      const clockPart = clockMatch ? clockMatch[1] : '';
      const reason = this.transloco.translate(reasonKey(row.reasonCode ?? null));
      return {
        id: row.id,
        title: row.title,
        datePart,
        clockPart,
        reason,
        subtitle: `${fullTime} · ${reason}`,
        tone: SEVERITY_TONES[severity],
        severityLabel: this.transloco.translate(`dashboardKinds.severity.${severity}`),
        entityRef: row.entityRef,
      };
    });
  });
}

function normalizeSeverity(raw: string): AlertSeverity {
  const upper = raw.toUpperCase();
  if (upper === 'CRITICAL' || upper === 'WARNING' || upper === 'SUCCESS' || upper === 'INFO') {
    return upper;
  }
  return 'INFO';
}
