import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerDownload, tablerFileExport, tablerRefresh } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Badge, type BadgeTone } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import {
  DASH,
  formatDate,
  formatDateTime,
  formatNumber,
} from '../../../../../shared/ui/chart/chart-format';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { reportCorrelation, reportWriteError } from '../../schedules/report-errors';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DataCell, DataTable, type DataColumn } from '../../../../../shared/ui/data-table/data-table';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { ApiError, errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import {
  cancelExport,
  downloadExport,
  getExport,
  listExports,
  resolveExportSource,
} from '../../../../../shared/widgets/dashboard/exports/exports.api';
import type {
  DeliveryCapabilities,
  Export,
  ExportListPage,
  ExportStatus,
} from '../../../../../shared/widgets/dashboard/exports/exports.model';

const PAGE_SIZE = 20;

const KNOWN_FAILURE_CODES = new Set<string>([
  'RUNNER_UNAVAILABLE',
  'RUN_TIMEOUT',
  'STORAGE_FAILED',
  'RENDER_FAILED',
  'PDF_RENDER_FAILED',
  'FINGERPRINT_UNAVAILABLE',
  'TOO_LARGE',
  'NO_EXPORTABLE_PANELS',
  'PERMISSION_DENIED',
  'PDF_RESULT_INVALID',
  'ABANDONED',
]);

const STATUS_TONES: Record<ExportStatus, BadgeTone> = {
  QUEUED: 'none',
  RUNNING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  CANCELLED: 'none',
  EXPIRED: 'none',
};

function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return DASH;
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${formatNumber(kb, 'en', kb >= 10 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${formatNumber(mb, 'en', 1)} MB`;
  const gb = mb / 1024;
  return `${formatNumber(gb, 'en', 1)} GB`;
}

@Component({
  selector: 'app-exports-page',
  imports: [NgIcon, TranslocoPipe, Badge, Button, ConflictDialog, ConfirmDialog, DataTable, DataCell, FullState],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-rep-exports', alias: 'repExports' },
      { scope: 'analytics', alias: 'analytics' },
      { scope: 'chart', alias: 'chart' },
    ),
    provideIcons({ tablerRefresh, tablerDownload, tablerFileExport }),
  ],
  templateUrl: './exports-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class ExportsPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  protected readonly language = inject(LanguageState).current;

  private readonly cancelDialog = viewChild.required<ConfirmDialog>('cancelDialog');

  protected readonly canExport = can('crm.exports.create');
  protected readonly readOnly = signal(false);
  protected readonly conflictOpen = signal(false);
  protected readonly conflictRecord = signal<Export | null>(null);
  protected readonly loadText = signal('');
  protected readonly exports = signal<Export[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly loadError = signal<'forbidden' | 'load-failure' | null>(null);
  protected readonly downloadingId = signal<string | null>(null);
  protected readonly cancellingId = signal<string | null>(null);
  /** Format admission from the export list (`{ items, pageInfo, capabilities }`); null until the first page lands. */
  protected readonly capabilities = signal<DeliveryCapabilities | null>(null);
  /** PDF is offered only while the backend lists it as available. */
  protected readonly pdfOffered = computed(
    () => this.capabilities()?.formats.some((entry) => entry.format === 'PDF' && entry.available) ?? false,
  );

  protected readonly columns = computed<DataColumn[]>(() => {
    this.i18n();
    this.language();
    return [
      { key: 'queuedAt', label: this.transloco.translate('repExports.columns.requested'), width: 1.3 },
      { key: 'source', label: this.transloco.translate('repExports.columns.source'), width: 1.8 },
      { key: 'format', label: this.transloco.translate('repExports.columns.format'), width: 0.7 },
      { key: 'status', label: this.transloco.translate('repExports.columns.status'), width: 1.0 },
      {
        key: 'byteSize',
        label: this.transloco.translate('repExports.columns.size'),
        width: 0.8,
        align: 'end',
        numeric: true,
      },
      {
        key: 'rowCount',
        label: this.transloco.translate('repExports.columns.rows'),
        width: 0.7,
        align: 'end',
        numeric: true,
      },
      { key: 'expiresAt', label: this.transloco.translate('repExports.columns.expires'), width: 1.1 },
      { key: 'actions', label: this.transloco.translate('repExports.columns.actions'), width: 1.1, align: 'end' },
    ];
  });

  protected readonly rowKey = (row: Export): string => row.id;

  private destroyed = false;
  private loadSeq = 0;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });
    void this.load();
  }

  protected async load(): Promise<void> {
    if (!this.canExport) { this.loadError.set('forbidden'); return; }
    this.readOnly.set(false);
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const page = await listExports(null, PAGE_SIZE);
      if (this.destroyed || seq !== this.loadSeq) return;
      this.applyFirstPage(page);
    } catch (error) {
      if (this.destroyed || seq !== this.loadSeq) return;
      this.loadText.set(reportCorrelation(error, this.transloco, 'repExports'));
      this.loadError.set(error instanceof ApiError && error.status === 403 ? 'forbidden' : 'load-failure');
    } finally {
      if (!this.destroyed && seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) return;
    const seq = this.loadSeq;
    this.loadingMore.set(true);
    try {
      const page = await listExports(cursor, PAGE_SIZE);
      if (this.destroyed || seq !== this.loadSeq) return;
      const seen = new Set(this.exports().map((item) => item.id));
      const appended = page.items.filter((item) => !seen.has(item.id));
      this.exports.update((current) => [...current, ...appended]);
      this.nextCursor.set(page.pageInfo.nextCursor);
      this.hasMore.set(page.pageInfo.hasMore);
      this.capabilities.set(page.capabilities);
    } catch (error) {
      if (!this.destroyed) {
        this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
      }
    } finally {
      if (!this.destroyed) {
        this.loadingMore.set(false);
      }
    }
  }

  protected sourceLabel(row: Export): string {
    return resolveExportSource(row, this.language()) ?? DASH;
  }

  protected statusTone(status: ExportStatus): BadgeTone {
    return STATUS_TONES[status];
  }

  protected failureTooltip(row: Export): string | null {
    if (row.status !== 'FAILED') return null;
    this.i18n();
    const code = row.failureCode && KNOWN_FAILURE_CODES.has(row.failureCode) ? row.failureCode : 'GENERIC';
    return this.transloco.translate(`repExports.failure.${code}`);
  }

  protected formatRequestedAt(iso: string): string {
    return formatDateTime(iso, this.language());
  }

  protected formatSize(bytes: number | null): string {
    return formatBytes(bytes);
  }

  protected formatRows(count: number | null): string {
    return formatNumber(count, this.language(), 0);
  }

  protected formatExpires(iso: string | null): string {
    return iso ? formatDate(iso, this.language()) : DASH;
  }

  protected async download(row: Export): Promise<void> {
    if (!this.canExport || row.status !== 'SUCCEEDED' || this.downloadingId() === row.id) return;
    this.downloadingId.set(row.id);
    try {
      const blob = await downloadExport(row.id);
      if (this.destroyed) return;
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = blob instanceof File ? blob.name : `export-${row.id}.${row.format.toLowerCase()}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      if (this.destroyed) return;
      const code = errorCodeOf(error);
      this.notify.error(this.transloco.translate(errorKey(code)));
      if (code === 'CRM_EXPORT_EXPIRED' || code === 'CRM_EXPORT_NOT_READY') {
        void this.refreshSilently();
      }
    } finally {
      if (!this.destroyed) {
        this.downloadingId.set(null);
      }
    }
  }

  protected async requestCancel(row: Export): Promise<void> {
    if (!this.canExport || this.readOnly() || (row.status !== 'QUEUED' && row.status !== 'RUNNING') || this.cancellingId()) return;
    const confirmed = await this.cancelDialog().open();
    if (!confirmed || this.destroyed) return;

    this.cancellingId.set(row.id);
    try {
      const updated = await cancelExport(row.id, row.revision);
      if (this.destroyed) return;
      this.exports.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
      this.notify.success(this.transloco.translate('repExports.cancelledToast'));
    } catch (error) {
      if (this.destroyed) return;
      const code = errorCodeOf(error);
      const state = reportWriteError(error, this.transloco, 'repExports');
      if (state.readOnly) this.readOnly.set(true);
      if (state.conflict) {
        this.conflictRecord.set(row);
        this.conflictOpen.set(true);
      } else this.notify.error(state.message);
      if (state.reloadRequired || code === 'CRM_EXPORT_NOT_CANCELLABLE') {
        void this.refreshSilently();
      }
    } finally {
      if (!this.destroyed) {
        this.cancellingId.set(null);
      }
    }
  }

  private applyFirstPage(page: ExportListPage): void {
    this.exports.set(page.items);
    this.nextCursor.set(page.pageInfo.nextCursor);
    this.hasMore.set(page.pageInfo.hasMore);
    this.capabilities.set(page.capabilities);
  }

  protected async resolveConflict(): Promise<void> {
    const row = this.conflictRecord();
    if (!row) return;
    try {
      const latest = await getExport(row.id);
      this.exports.update((rows) => rows.map((item) => item.id === latest.id ? latest : item));
    } catch (error) {
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    }
  }

  private async refreshSilently(): Promise<void> {
    const seq = this.loadSeq;
    const limit = Math.max(PAGE_SIZE, this.exports().length);
    try {
      const page = await listExports(null, limit);
      if (this.destroyed || seq !== this.loadSeq) return;
      this.applyFirstPage(page);
    } catch {
      this.notify.error(this.transloco.translate('analytics.common.loadFailed'));
    }
  }
}
