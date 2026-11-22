import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerEdit } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../../core/notify/notify';
import { BulkJobsTracker } from '../../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { Button } from '../../../../../../shared/ui/button/button';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import { Segmented, type SegmentedOption } from '../../../../../../shared/ui/segmented/segmented';
import { newIdempotencyKey, type TradeContext } from '../../../../shared/trade-api';
import {
  type BulkSubmitOutcome,
  type CapabilityChoice,
  type SetCapabilitiesParams,
  bulkErrorInfo,
  submitItemsBulkJob,
  translateBulkError,
} from '../item-bulk.model';
import { ItemSelection } from '../item-selection';

function toCapabilityChoice(raw: string | null): CapabilityChoice | null {
  if (raw === 'KEEP' || raw === 'YES' || raw === 'NO') return raw;
  return null;
}

@Component({
  selector: 'app-item-bulk-capabilities-modal',
  imports: [TranslocoPipe, Button, Field, Modal, Segmented],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'trade-items-bulk', alias: 'itemsBulk' },
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'bulk-jobs', alias: 'bulkJobs' },
    ),
    provideIcons({ tablerEdit }),
  ],
  templateUrl: './item-bulk-capabilities-modal.html',
})
export class ItemBulkCapabilitiesModal {
  private static nextId = 0;
  protected readonly uid = `item-bulk-capabilities-${++ItemBulkCapabilitiesModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly tracker = inject(BulkJobsTracker);
  private readonly injectedSelection = inject(ItemSelection, { optional: true });

  private readonly modal = viewChild.required(Modal);

  readonly selection = input<ItemSelection | null>(null);
  readonly context = input<TradeContext>({});
  readonly submitted = output<BulkSubmitOutcome>();
  readonly closed = output<void>();

  protected readonly canSell = signal<CapabilityChoice>('KEEP');
  protected readonly canPurchase = signal<CapabilityChoice>('KEEP');
  protected readonly canPos = signal<CapabilityChoice>('KEEP');
  protected readonly trackInventory = signal<CapabilityChoice>('KEEP');
  protected readonly serverPosError = signal<string | null>(null);
  protected readonly submitting = signal(false);

  private submitKey = newIdempotencyKey();

  private readonly activeSelection = computed(() => this.selection() ?? this.injectedSelection);
  protected readonly selectedCount = computed(() => this.activeSelection()?.count() ?? 0);

  protected readonly choiceOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const disabled = this.submitting();
    return [
      { value: 'KEEP', label: this.transloco.translate('itemsBulk.capabilitiesModal.keep'), disabled },
      { value: 'YES', label: this.transloco.translate('tradeShared.common.yes'), disabled },
      { value: 'NO', label: this.transloco.translate('tradeShared.common.no'), disabled },
    ];
  });

  protected readonly posError = computed<string | null>(() => {
    this.i18n();
    if (this.canPos() === 'YES' && this.canSell() === 'NO') {
      return this.transloco.translate('tradeShared.errors.TRADE_CATALOG_CAPABILITY_INCOMPATIBLE');
    }
    return this.serverPosError();
  });

  protected readonly posDescribedBy = computed(() =>
    this.posError() ? `${this.uid}-can-pos-hint ${this.uid}-can-pos-error` : `${this.uid}-can-pos-hint`,
  );

  protected readonly hasAnyChange = computed(
    () =>
      this.canSell() !== 'KEEP' ||
      this.canPurchase() !== 'KEEP' ||
      this.canPos() !== 'KEEP' ||
      this.trackInventory() !== 'KEEP',
  );

  protected readonly canSubmit = computed(
    () => !this.submitting() && this.selectedCount() > 0 && this.hasAnyChange() && !this.posError(),
  );

  open(): void {
    this.canSell.set('KEEP');
    this.canPurchase.set('KEEP');
    this.canPos.set('KEEP');
    this.trackInventory.set('KEEP');
    this.serverPosError.set(null);
    this.submitting.set(false);
    this.submitKey = newIdempotencyKey();
    this.modal().open();
  }

  protected onCanSellChange(raw: string | null): void {
    const choice = toCapabilityChoice(raw);
    if (!choice || this.submitting()) return;
    this.canSell.set(choice);
    this.serverPosError.set(null);
    this.submitKey = newIdempotencyKey();
  }

  protected onCanPurchaseChange(raw: string | null): void {
    const choice = toCapabilityChoice(raw);
    if (!choice || this.submitting()) return;
    this.canPurchase.set(choice);
    this.submitKey = newIdempotencyKey();
  }

  protected onCanPosChange(raw: string | null): void {
    const choice = toCapabilityChoice(raw);
    if (!choice || this.submitting()) return;
    this.canPos.set(choice);
    this.serverPosError.set(null);
    this.submitKey = newIdempotencyKey();
  }

  protected onTrackInventoryChange(raw: string | null): void {
    const choice = toCapabilityChoice(raw);
    if (!choice || this.submitting()) return;
    this.trackInventory.set(choice);
    this.submitKey = newIdempotencyKey();
  }

  protected close(): void {
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.submitting.set(false);
    this.serverPosError.set(null);
    this.closed.emit();
  }

  protected async submit(): Promise<void> {
    const sel = this.activeSelection();
    if (!sel || sel.count() <= 0 || !this.canSubmit()) return;

    const params: SetCapabilitiesParams = {
      ...(this.canSell() !== 'KEEP' ? { canSell: this.canSell() === 'YES' } : {}),
      ...(this.canPurchase() !== 'KEEP' ? { canPurchase: this.canPurchase() === 'YES' } : {}),
      ...(this.canPos() !== 'KEEP' ? { canPos: this.canPos() === 'YES' } : {}),
      ...(this.trackInventory() !== 'KEEP' ? { trackInventory: this.trackInventory() === 'YES' } : {}),
    };

    this.submitting.set(true);
    this.serverPosError.set(null);
    try {
      const outcome = await submitItemsBulkJob({
        action: 'SET_CAPABILITIES',
        context: this.context(),
        selection: sel.snapshot(),
        params,
        idempotencyKey: this.submitKey,
        tracker: this.tracker,
      });
      this.close();
      if (outcome) {
        this.submitted.emit(outcome);
      }
    } catch (error) {
      const info = bulkErrorInfo(error);
      const message = translateBulkError(this.transloco, info.code, info.details);
      if (info.code === 'TRADE.CATALOG.CAPABILITY_INCOMPATIBLE') {
        this.serverPosError.set(message);
      } else {
        this.notify.error(message);
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
