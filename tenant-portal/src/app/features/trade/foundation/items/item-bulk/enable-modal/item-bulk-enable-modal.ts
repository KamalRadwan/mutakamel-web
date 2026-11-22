import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerCheck } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../../core/notify/notify';
import { BulkJobsTracker } from '../../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { Button } from '../../../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../../shared/ui/switch/switch';
import { newIdempotencyKey, type TradeContext } from '../../../../shared/trade-api';
import { listReferenceData } from '../../../../shared/trade-foundation.api';
import type { ItemTrackingMode, Tax } from '../../../../shared/trade-foundation.model';
import { TRACKING_KEY } from '../../../../shared/trade-labels';
import {
  type BulkSubmitOutcome,
  type EnableForCompanyParams,
  bulkErrorInfo,
  submitItemsBulkJob,
  translateBulkError,
} from '../item-bulk.model';
import { ItemSelection } from '../item-selection';

const TRACKING_MODES: readonly ItemTrackingMode[] = ['NONE', 'LOT', 'SERIAL'];

@Component({
  selector: 'app-item-bulk-enable-modal',
  imports: [TranslocoPipe, Button, Dropdown, Field, Modal, Switch],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'trade-items-bulk', alias: 'itemsBulk' },
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'bulk-jobs', alias: 'bulkJobs' },
    ),
    provideIcons({ tablerCheck }),
  ],
  templateUrl: './item-bulk-enable-modal.html',
})
export class ItemBulkEnableModal {
  private static nextId = 0;
  protected readonly uid = `item-bulk-enable-${++ItemBulkEnableModal.nextId}`;

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

  protected readonly canSell = signal(true);
  protected readonly canPurchase = signal(true);
  protected readonly canPos = signal(false);
  protected readonly trackInventory = signal(true);
  protected readonly trackingMode = signal<ItemTrackingMode>('NONE');
  protected readonly salesTaxId = signal<string | null>(null);
  protected readonly purchaseTaxId = signal<string | null>(null);
  protected readonly taxes = signal<Tax[]>([]);
  protected readonly taxesLoading = signal(false);
  protected readonly serverPosError = signal<string | null>(null);
  protected readonly submitting = signal(false);

  private openSeq = 0;
  private submitKey = newIdempotencyKey();

  private readonly activeSelection = computed(() => this.selection() ?? this.injectedSelection);
  protected readonly selectedCount = computed(() => this.activeSelection()?.count() ?? 0);

  protected readonly posError = computed<string | null>(() => {
    this.i18n();
    if (this.canPos() && !this.canSell()) {
      return this.transloco.translate('tradeShared.errors.TRADE_CATALOG_CAPABILITY_INCOMPATIBLE');
    }
    return this.serverPosError();
  });

  protected readonly posDescribedBy = computed(() =>
    this.posError() ? `${this.uid}-can-pos-hint ${this.uid}-can-pos-error` : `${this.uid}-can-pos-hint`,
  );

  protected readonly trackingOptions = computed<DropdownOption<ItemTrackingMode>[]>(() => {
    this.i18n();
    return TRACKING_MODES.map((mode) => ({
      value: mode,
      label: this.transloco.translate(TRACKING_KEY[mode]),
    }));
  });

  protected readonly taxOptions = computed<DropdownOption<string | null>[]>(() => {
    this.i18n();
    if (this.taxesLoading()) {
      return [{ value: null, label: this.transloco.translate('tradeShared.picker.loading'), disabled: true }];
    }
    return [
      { value: null, label: this.transloco.translate('itemsBulk.enableModal.noTax') },
      ...this.taxes().map((tax) => ({
        value: tax.id,
        label: `${tax.code} — ${tax.name}`,
      })),
    ];
  });

  protected readonly canSubmit = computed(
    () => !this.submitting() && !this.taxesLoading() && this.selectedCount() > 0 && !this.posError(),
  );

  open(): void {
    const seq = ++this.openSeq;
    this.canSell.set(true);
    this.canPurchase.set(true);
    this.canPos.set(false);
    this.trackInventory.set(true);
    this.trackingMode.set('NONE');
    this.salesTaxId.set(null);
    this.purchaseTaxId.set(null);
    this.serverPosError.set(null);
    this.submitting.set(false);
    this.submitKey = newIdempotencyKey();
    this.modal().open();
    void this.loadTaxes(seq);
  }

  protected onCanSellChange(value: boolean): void {
    this.canSell.set(value);
    if (!value) {
      this.canPos.set(false);
    }
    this.serverPosError.set(null);
    this.submitKey = newIdempotencyKey();
  }

  protected onCanPurchaseChange(value: boolean): void {
    this.canPurchase.set(value);
    this.submitKey = newIdempotencyKey();
  }

  protected onCanPosChange(value: boolean): void {
    this.canPos.set(value);
    this.serverPosError.set(null);
    this.submitKey = newIdempotencyKey();
  }

  protected onTrackInventoryChange(value: boolean): void {
    this.trackInventory.set(value);
    if (!value) {
      this.trackingMode.set('NONE');
    }
    this.submitKey = newIdempotencyKey();
  }

  protected onTrackingModeChange(mode: ItemTrackingMode): void {
    this.trackingMode.set(mode);
    this.submitKey = newIdempotencyKey();
  }

  protected onSalesTaxChange(taxId: string | null): void {
    this.salesTaxId.set(taxId);
    this.submitKey = newIdempotencyKey();
  }

  protected onPurchaseTaxChange(taxId: string | null): void {
    this.purchaseTaxId.set(taxId);
    this.submitKey = newIdempotencyKey();
  }

  protected close(): void {
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.openSeq++;
    this.submitting.set(false);
    this.serverPosError.set(null);
    this.closed.emit();
  }

  protected async submit(): Promise<void> {
    const sel = this.activeSelection();
    if (!sel || sel.count() <= 0 || !this.canSubmit()) return;

    const params: EnableForCompanyParams = {
      canSell: this.canSell(),
      canPurchase: this.canPurchase(),
      canPos: this.canSell() ? this.canPos() : false,
      trackInventory: this.trackInventory(),
      trackingMode: this.trackInventory() ? this.trackingMode() : 'NONE',
      salesTaxId: this.salesTaxId(),
      purchaseTaxId: this.purchaseTaxId(),
    };

    this.submitting.set(true);
    this.serverPosError.set(null);
    try {
      const outcome = await submitItemsBulkJob({
        action: 'ENABLE_FOR_COMPANY',
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

  private async loadTaxes(seq: number): Promise<void> {
    this.taxesLoading.set(true);
    try {
      const data = await listReferenceData(this.context());
      if (seq !== this.openSeq) return;
      this.taxes.set(data.taxes);
    } catch {
      if (seq !== this.openSeq) return;
      this.taxes.set([]);
      this.notify.error(this.transloco.translate('tradeShared.common.loadFailed'));
    } finally {
      if (seq === this.openSeq) {
        this.taxesLoading.set(false);
      }
    }
  }
}
