import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerArrowsExchange } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../../core/notify/notify';
import { BulkJobsTracker } from '../../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { Button } from '../../../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import { TradeReasonPicker, type ReasonPickerValue } from '../../../../shared/pickers/reason-picker/reason-picker';
import { newIdempotencyKey, type TradeContext } from '../../../../shared/trade-api';
import type { ItemStatus } from '../../../../shared/trade-foundation.model';
import { ITEM_STATUS_KEY } from '../../../../shared/trade-labels';
import {
  type BulkSubmitOutcome,
  type SetStatusParams,
  bulkErrorInfo,
  submitItemsBulkJob,
  translateBulkError,
} from '../item-bulk.model';
import { ItemSelection } from '../item-selection';

const TARGET_STATUSES: readonly ItemStatus[] = ['ACTIVE', 'INACTIVE', 'DISCONTINUED'];

@Component({
  selector: 'app-item-bulk-status-modal',
  imports: [TranslocoPipe, Button, Dropdown, Field, Modal, TradeReasonPicker],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'trade-items-bulk', alias: 'itemsBulk' },
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'bulk-jobs', alias: 'bulkJobs' },
    ),
    provideIcons({ tablerArrowsExchange }),
  ],
  templateUrl: './item-bulk-status-modal.html',
})
export class ItemBulkStatusModal {
  private static nextId = 0;
  protected readonly uid = `item-bulk-status-${++ItemBulkStatusModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly tracker = inject(BulkJobsTracker);
  private readonly injectedSelection = inject(ItemSelection, { optional: true });

  private readonly modal = viewChild.required(Modal);
  private readonly reasonPicker = viewChild<TradeReasonPicker>('reasonPicker');

  readonly selection = input<ItemSelection | null>(null);
  readonly context = input<TradeContext>({});
  readonly submitted = output<BulkSubmitOutcome>();
  readonly closed = output<void>();

  protected readonly targetStatus = signal<ItemStatus>('ACTIVE');
  protected readonly reasonValue = signal<ReasonPickerValue>({ reasonCodeId: null, note: '' });
  protected readonly showErrors = signal(false);
  protected readonly submitting = signal(false);

  private submitKey = newIdempotencyKey();

  private readonly activeSelection = computed(() => this.selection() ?? this.injectedSelection);
  protected readonly selectedCount = computed(() => this.activeSelection()?.count() ?? 0);

  protected readonly statusOptions = computed<DropdownOption<ItemStatus>[]>(() => {
    this.i18n();
    return TARGET_STATUSES.map((status) => ({
      value: status,
      label: this.transloco.translate(ITEM_STATUS_KEY[status]),
    }));
  });

  protected readonly canSubmit = computed(() => !this.submitting() && this.selectedCount() > 0);

  open(): void {
    this.targetStatus.set('ACTIVE');
    this.reasonValue.set({ reasonCodeId: null, note: '' });
    this.showErrors.set(false);
    this.submitting.set(false);
    this.submitKey = newIdempotencyKey();
    this.modal().open();
  }

  protected onStatusChange(status: ItemStatus): void {
    this.targetStatus.set(status);
    this.showErrors.set(false);
    this.submitKey = newIdempotencyKey();
  }

  protected onReasonChange(value: ReasonPickerValue): void {
    this.reasonValue.set(value);
    this.submitKey = newIdempotencyKey();
  }

  protected close(): void {
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.submitting.set(false);
    this.showErrors.set(false);
    this.closed.emit();
  }

  protected async submit(): Promise<void> {
    const sel = this.activeSelection();
    if (!sel || sel.count() <= 0 || this.submitting()) return;

    const status = this.targetStatus();
    if (status === 'DISCONTINUED') {
      const picker = this.reasonPicker();
      if (!picker || !picker.valid()) {
        this.showErrors.set(true);
        return;
      }
    }

    const reason = this.reasonValue();
    const params: SetStatusParams =
      status === 'DISCONTINUED'
        ? {
            status,
            reasonCodeId: reason.reasonCodeId,
            reasonNote: reason.note.trim() || null,
          }
        : { status };

    this.submitting.set(true);
    try {
      const outcome = await submitItemsBulkJob({
        action: 'SET_STATUS',
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
      this.notify.error(translateBulkError(this.transloco, info.code, info.details));
    } finally {
      this.submitting.set(false);
    }
  }
}
