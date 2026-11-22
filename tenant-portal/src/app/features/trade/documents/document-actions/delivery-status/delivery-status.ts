import { Component, computed, input, output } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerRefresh } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import type { DeliveryInfo, DispatchStatus } from '../../shared/document.model';
import { STATUS_TONE_CLASSES, statusBadge } from '../../shared/document-status';
import { canRetryDelivery } from '../document-actions';

const KNOWN_DELIVERY_ERRORS: ReadonlySet<string> = new Set([
  'DELIVERY_PDF_FAILED',
  'DELIVERY_ATTACHMENT_TOO_LARGE',
  'DELIVERY_EMAIL_NOT_FOUND',
  'DELIVERY_EMAIL_UNAVAILABLE',
  'DELIVERY_EMAIL_FAILED',
  'DELIVERY_SOURCE_STALE',
]);

@Component({
  selector: 'app-delivery-status',
  imports: [NgIcon, TranslocoPipe, Button],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'trade-documents', alias: 'td' },
      { scope: 'trade-documents-actions', alias: 'tda' },
    ),
    provideIcons({ tablerRefresh }),
  ],
  templateUrl: './delivery-status.html',
  host: { class: 'inline-flex items-center gap-6' },
})
export class DeliveryStatus {
  readonly dispatchStatus = input.required<DispatchStatus>();
  readonly delivery = input<DeliveryInfo | null>(null);

  readonly retry = output<void>();

  protected readonly badge = computed(() => statusBadge('purchase-order', 'dispatch', this.dispatchStatus()));
  protected readonly toneClass = computed(() => STATUS_TONE_CLASSES[this.badge().tone]);

  protected readonly errorKey = computed<string | null>(() => {
    const info = this.delivery();
    if (this.dispatchStatus() !== 'FAILED' && info?.status !== 'FAILED') {
      return null;
    }
    const rawCode = info?.lastErrorCode?.trim() ?? '';
    const shortCode = rawCode.startsWith('TRADE.PURCHASE_ORDER.')
      ? rawCode.slice('TRADE.PURCHASE_ORDER.'.length)
      : rawCode;
    return KNOWN_DELIVERY_ERRORS.has(shortCode)
      ? `tda.delivery.error.${shortCode}`
      : 'tda.delivery.error.generic';
  });

  protected readonly canRetry = computed(() => canRetryDelivery(this.delivery()));
}
