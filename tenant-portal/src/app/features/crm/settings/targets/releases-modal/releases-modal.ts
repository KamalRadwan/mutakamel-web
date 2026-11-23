import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { provideIcons } from '@ng-icons/core';
import { tablerHistory } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { DASH, formatDate, formatDateTime } from '../../../../../shared/ui/chart/chart-format';
import { DataCell, DataColumn, DataTable } from '../../../../../shared/ui/data-table/data-table';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { errorCodeOf } from '../../../../../core/api/api-errors';
import { crmSettingsError } from '../../shared/settings-api';
import { listReleases, targetErrorMessage } from '../targets.api';
import {
  SalesTarget,
  TargetRelease,
  TargetableMetric,
  formatTargetPeriod,
  targetDateInZone,
  formatTargetValue,
  resolveMetricLabel,
  resolvePersonName,
  resolveTargetSubjectName,
} from '../targets.model';

@Component({
  selector: 'app-releases-modal',
  imports: [TranslocoPipe, Badge, Button, DataCell, DataTable, FullState, Modal],
  providers: [provideIcons({ tablerHistory })],
  templateUrl: './releases-modal.html',
})
export class ReleasesModal {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('modal');

  readonly metrics = input<readonly TargetableMetric[]>([]);

  protected readonly dash = DASH;
  protected readonly target = signal<SalesTarget | null>(null);
  protected readonly releases = signal<TargetRelease[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly loadError = signal(false);
  protected readonly failure = signal<ReturnType<typeof crmSettingsError> | null>(null);

  private loadSeq = 0;

  protected readonly subtitle = computed(() => {
    this.i18n();
    const current = this.target();
    if (!current) return '';
    const lang = this.language();
    const subject = resolveTargetSubjectName(current, lang);
    const metric = resolveMetricLabel(current.metricKey, lang, this.metrics());
    const period = formatTargetPeriod(current.periodGrain, current.periodStart, lang, (n, year) =>
      this.transloco.translate('targets.quarter', { n, year }),
    );
    return `${subject} · ${metric} · ${period}`;
  });

  protected readonly columns = computed<DataColumn[]>(() => {
    this.i18n();
    return [
      {
        key: 'releaseNumber',
        label: this.transloco.translate('targets.releasesModal.columns.release'),
        width: 0.7,
        numeric: true,
        align: 'end',
      },
      {
        key: 'targetValue',
        label: this.transloco.translate('targets.releasesModal.columns.value'),
        width: 1.5,
        numeric: true,
        align: 'end',
      },
      {
        key: 'approvalBasis',
        label: this.transloco.translate('targets.releasesModal.columns.basis'),
        width: 1.1,
      },
      {
        key: 'correctionReason',
        label: this.transloco.translate('targets.releasesModal.columns.reason'),
        width: 1.9,
      },
      {
        key: 'approvedByUserId',
        label: this.transloco.translate('targets.releasesModal.columns.approvedBy'),
        width: 1.4,
      },
      {
        key: 'approvedAt',
        label: this.transloco.translate('targets.releasesModal.columns.approvedAt'),
        width: 1.5,
      },
      {
        key: 'period',
        label: this.transloco.translate('targets.releasesModal.columns.period'),
        width: 2.3,
      },
    ];
  });

  protected readonly rowKey = (row: TargetRelease) => row.id;

  open(target: SalesTarget): void {
    this.target.set(target);
    this.releases.set([]);
    this.nextCursor.set(null);
    this.hasMore.set(false);
    this.loadError.set(false);
    this.modal().open();
    void this.reload();
  }

  close(): void {
    this.modal().close();
  }

  protected onClosed(): void {
    this.loadSeq++;
    this.loading.set(false);
    this.loadingMore.set(false);
  }

  protected async reload(): Promise<void> {
    const current = this.target();
    if (!current) return;
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadingMore.set(false);
    this.loadError.set(false);
    try {
      const page = await listReleases(current.id, null);
      if (seq !== this.loadSeq) return;
      this.releases.set(page.items);
      this.nextCursor.set(page.pageInfo.nextCursor);
      this.hasMore.set(page.pageInfo.hasMore);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.failure.set(crmSettingsError(this.transloco, error, 'targets'));
      this.loadError.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected async loadMore(): Promise<void> {
    const current = this.target();
    const cursor = this.nextCursor();
    if (!current || !this.hasMore() || !cursor || this.loadingMore()) return;
    const seq = this.loadSeq;
    this.loadingMore.set(true);
    try {
      const page = await listReleases(current.id, cursor);
      if (seq !== this.loadSeq) return;
      this.releases.update((prev) => [...prev, ...page.items]);
      this.nextCursor.set(page.pageInfo.nextCursor);
      this.hasMore.set(page.pageInfo.hasMore);
    } catch (error) {
      if (seq === this.loadSeq) {
        if (errorCodeOf(error) === 'CRM_DASHBOARD_LIST_CURSOR_INVALID') {
          await this.reload();
          return;
        }
        this.notify.error(targetErrorMessage(this.transloco, error));
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loadingMore.set(false);
      }
    }
  }

  protected formatValue(release: TargetRelease): string {
    return formatTargetValue(
      release.targetValue,
      release.measureKind,
      release.currencyCode,
      this.language(),
    );
  }

  protected approvedByName(userId: string): string {
    return resolvePersonName(userId, this.language());
  }

  protected formatApprovedAt(iso: string): string {
    return formatDateTime(iso, this.language());
  }

  protected formatPeriodRange(release: TargetRelease): string {
    const lang = this.language();
    const start = formatDate(targetDateInZone(release.periodStartAt, release.periodTimeZone), lang);
    const end = formatDate(targetDateInZone(release.periodEndAt, release.periodTimeZone), lang);
    return `${start} – ${end} (${release.periodTimeZone})`;
  }
}
