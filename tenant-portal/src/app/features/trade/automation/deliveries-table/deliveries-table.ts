import { Component, computed, inject, input, output } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerLoader2,
  tablerRefresh,
  tablerSearch,
  tablerSend,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Button } from '../../../../shared/ui/button/button';
import { formatDate } from '../../shared/trade-format';
import { AutomationBadge } from '../automation-shared/automation-badge/automation-badge';
import type { WebhookDelivery } from '../webhooks.model';

@Component({
  selector: 'app-deliveries-table',
  imports: [NgIcon, TranslocoPipe, Button, AutomationBadge],
  providers: [provideIcons({ tablerSend, tablerLoader2, tablerRefresh, tablerSearch })],
  templateUrl: './deliveries-table.html',
})
export class DeliveriesTable {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  readonly rows = input.required<readonly WebhookDelivery[]>();
  readonly loading = input(false);
  readonly loadFailed = input(false);
  readonly hasFilters = input(false);

  readonly open = output<WebhookDelivery>();
  readonly retry = output<void>();
  readonly clearFilters = output<void>();

  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  protected readonly columns = computed(() => {
    this.i18n();
    return ['status', 'event', 'subscription', 'attempts', 'nextOrEnded', 'size', 'created'] as const;
  });

  protected eventCode(row: WebhookDelivery): string {
    return row.sourceEventType;
  }

  protected eventLabel(row: WebhookDelivery): string {
    this.i18n();
    const key = `webhooks.events.${row.sourceEventType}`;
    const translated = this.transloco.translate(key);
    return translated !== key ? translated : row.sourceEventType;
  }

  protected nextOrEndedAt(row: WebhookDelivery): string | null {
    return row.nextAttemptAt ?? row.terminalAt;
  }

  protected formatSizeKb(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0.0 KB';
    const kb = bytes / 1024;
    return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  }

  protected formatDateTime(iso: string | null | undefined): string {
    if (!iso) return this.transloco.translate('webhooks.common.none');
    const lang = this.language();
    const datePart = formatDate(iso, lang);
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return datePart;
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${datePart} ${hh}:${mm}`;
  }

  protected isInProgress(row: WebhookDelivery): boolean {
    return row.status === 'PENDING' || row.status === 'RETRY_PENDING';
  }

  protected onRowKeydown(event: KeyboardEvent, row: WebhookDelivery): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open.emit(row);
    }
  }
}
