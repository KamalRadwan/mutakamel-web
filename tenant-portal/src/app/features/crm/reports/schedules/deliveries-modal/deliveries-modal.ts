import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { provideIcons } from '@ng-icons/core';
import { tablerHistory } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Badge, type BadgeTone } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { DASH, formatDateTime, formatNumber } from '../../../../../shared/ui/chart/chart-format';
import { DataCell, DataTable, type DataColumn } from '../../../../../shared/ui/data-table/data-table';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { reportCorrelation } from '../report-errors';
import { ApiError, errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import { OrgApi } from '../../../../../shared/widgets/dashboard/org.api';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { listDeliveries } from '../schedules.api';
import type { Delivery, DeliverySkipReason, DeliveryStatus, Subscription } from '../schedules.model';

const PAGE_SIZE = 6;

const STATUS_TONES: Record<DeliveryStatus, BadgeTone> = {
  SENT: 'success',
  SKIPPED: 'none',
  FAILED: 'danger',
  PENDING: 'warning',
};

const KNOWN_SKIP_REASONS = new Set<string>([
  'ENTITLEMENT_EXPIRED',
  'ENTITLEMENT_REVOKED',
  'PERMISSION_CHANGED',
  'RECIPIENT_INACTIVE',
  'REPORT_UNAVAILABLE',
  'SOURCE_NOT_READY',
  'OWNER_INACTIVE',
  'NO_DELIVERY_ADDRESS',
]);

@Component({
  selector: 'app-deliveries-modal',
  imports: [TranslocoPipe, Badge, Button, DataTable, DataCell, FullState, Modal],
  providers: [provideIcons({ tablerHistory })],
  templateUrl: './deliveries-modal.html',
})
export class DeliveriesModal {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly org = inject(OrgApi);
  private readonly people = signal(new Map<string, { name: string; nameAr: string }>());

  protected readonly subscription = signal<Subscription | null>(null);
  protected readonly deliveries = signal<Delivery[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly loadError = signal<'forbidden' | 'not-found' | 'load-failure' | null>(null);
  protected readonly loadText = signal('');

  protected readonly columns = computed<DataColumn[]>(() => {
    this.i18n();
    this.language();
    return [
      { key: 'scheduledFor', label: this.transloco.translate('repSchedules.deliveries.columns.scheduledFor'), width: 1.5 },
      { key: 'recipientUserId', label: this.transloco.translate('repSchedules.deliveries.columns.recipient'), width: 1.4 },
      { key: 'status', label: this.transloco.translate('repSchedules.deliveries.columns.status'), width: 1.0 },
      {
        key: 'attempts',
        label: this.transloco.translate('repSchedules.deliveries.columns.attempts'),
        width: 0.7,
        align: 'end',
        numeric: true,
      },
      { key: 'openedCount', label: this.transloco.translate('repSchedules.deliveries.columns.opened'), width: 0.7, align: 'end' },
      { key: 'lastOpenedAt', label: this.transloco.translate('repSchedules.deliveries.columns.lastOpened'), width: 1.5 },
    ];
  });

  protected readonly rowKey = (row: Delivery): string => row.id;

  private loadSeq = 0;

  open(sub: Subscription): void {
    this.people.set(new Map());
    this.subscription.set(sub);
    this.deliveries.set([]);
    this.nextCursor.set(null);
    this.hasMore.set(false);
    this.loadError.set(null);
    this.modal().open();
    void this.load();
  }

  close(): void {
    this.modal().close();
  }

  protected reload(): void {
    void this.load();
  }

  protected async loadMore(): Promise<void> {
    const sub = this.subscription();
    const cursor = this.nextCursor();
    if (!sub || !cursor || this.loadingMore()) return;

    const seq = this.loadSeq;
    this.loadingMore.set(true);
    try {
      const page = await listDeliveries(sub.id, cursor, PAGE_SIZE);
      if (seq !== this.loadSeq) return;
      const seen = new Set(this.deliveries().map((item) => item.id));
      const appended = page.items.filter((item) => !seen.has(item.id));
      this.deliveries.update((list) => [...list, ...appended]);
      void this.loadRecipients(appended);
      this.nextCursor.set(page.pageInfo.nextCursor);
      this.hasMore.set(page.pageInfo.hasMore);
    } catch (error) {
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    } finally {
      this.loadingMore.set(false);
    }
  }

  private async loadRecipients(rows: Delivery[]): Promise<void> {
    const seq = this.loadSeq;
    const ids = [...new Set(rows.map((row) => row.recipientUserId))].filter((id) => !this.people().has(id));
    const users = await Promise.all(ids.map((id) => this.org.getUser(id).catch(() => null)));
    if (seq !== this.loadSeq) return;
    this.people.update((current) => new Map([...current, ...users.flatMap((user) => user ? [[user.id, user] as const] : [])]));
  }

  protected recipientName(userId: string): string {
    const person = this.people().get(userId);
    if (!person) return userId;
    return this.language() === 'ar' ? person.nameAr : person.name;
  }

  protected statusTone(status: DeliveryStatus): BadgeTone {
    return STATUS_TONES[status];
  }

  protected statusLabelKey(row: Delivery): string {
    return `repSchedules.deliveries.status.${row.status}`;
  }

  protected statusTooltip(row: Delivery): string | null {
    return row.status === 'SKIPPED' ? this.skipTooltip(row.skipReason) : null;
  }

  protected skipTooltip(reason: DeliverySkipReason | undefined): string | null {
    if (!reason) return null;
    this.i18n();
    const key = KNOWN_SKIP_REASONS.has(reason) ? reason : 'GENERIC';
    return this.transloco.translate(`repSchedules.deliveries.skip.${key}`);
  }

  protected formatWhen(iso: string | null | undefined): string {
    return iso ? formatDateTime(iso, this.language()) : DASH;
  }

  protected formatAttempts(attempts: number): string {
    return formatNumber(attempts, this.language(), 0);
  }

  protected onModalClosed(): void {
    this.loadSeq++;
    this.subscription.set(null);
    this.deliveries.set([]);
    this.loading.set(false);
    this.loadingMore.set(false);
  }

  private async load(): Promise<void> {
    const sub = this.subscription();
    if (!sub) return;
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const page = await listDeliveries(sub.id, null, PAGE_SIZE);
      if (seq !== this.loadSeq) return;
      this.deliveries.set(page.items);
      void this.loadRecipients(page.items);
      this.nextCursor.set(page.pageInfo.nextCursor);
      this.hasMore.set(page.pageInfo.hasMore);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loadText.set(reportCorrelation(error, this.transloco, 'repSchedules'));
      this.loadError.set(error instanceof ApiError && error.status === 403 ? 'forbidden'
        : error instanceof ApiError && error.status === 404 ? 'not-found' : 'load-failure');
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
