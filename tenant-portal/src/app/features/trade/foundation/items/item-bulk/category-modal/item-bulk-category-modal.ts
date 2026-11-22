import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerTag } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../../core/notify/notify';
import { BulkJobsTracker } from '../../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { Button } from '../../../../../../shared/ui/button/button';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import { TradeCategoryPicker } from '../../../../shared/pickers/category-picker/category-picker';
import { newIdempotencyKey, type TradeContext } from '../../../../shared/trade-api';
import {
  type BulkSubmitOutcome,
  type SetCategoryParams,
  bulkErrorInfo,
  submitItemsBulkJob,
  translateBulkError,
} from '../item-bulk.model';
import { ItemSelection } from '../item-selection';

@Component({
  selector: 'app-item-bulk-category-modal',
  imports: [TranslocoPipe, Button, Field, Modal, TradeCategoryPicker],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'trade-items-bulk', alias: 'itemsBulk' },
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'bulk-jobs', alias: 'bulkJobs' },
    ),
    provideIcons({ tablerTag }),
  ],
  templateUrl: './item-bulk-category-modal.html',
})
export class ItemBulkCategoryModal {
  private static nextId = 0;
  protected readonly uid = `item-bulk-category-${++ItemBulkCategoryModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly tracker = inject(BulkJobsTracker);
  private readonly injectedSelection = inject(ItemSelection, { optional: true });

  private readonly modal = viewChild.required(Modal);

  readonly selection = input<ItemSelection | null>(null);
  readonly context = input<TradeContext>({});
  readonly submitted = output<BulkSubmitOutcome>();
  readonly closed = output<void>();

  protected readonly categoryId = signal<string | null>(null);
  protected readonly categoryError = signal<string | null>(null);
  protected readonly submitting = signal(false);

  private submitKey = newIdempotencyKey();

  private readonly activeSelection = computed(() => this.selection() ?? this.injectedSelection);
  protected readonly selectedCount = computed(() => this.activeSelection()?.count() ?? 0);
  protected readonly categoryDescribedBy = computed(() =>
    this.categoryError() ? `${this.uid}-category-hint ${this.uid}-category-error` : `${this.uid}-category-hint`,
  );
  protected readonly canSubmit = computed(() => !this.submitting() && this.selectedCount() > 0);

  open(): void {
    this.categoryId.set(null);
    this.categoryError.set(null);
    this.submitting.set(false);
    this.submitKey = newIdempotencyKey();
    this.modal().open();
  }

  protected onCategoryChange(id: string | null): void {
    this.categoryId.set(id);
    this.categoryError.set(null);
    this.submitKey = newIdempotencyKey();
  }

  protected close(): void {
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.submitting.set(false);
    this.categoryError.set(null);
    this.closed.emit();
  }

  protected async submit(): Promise<void> {
    const sel = this.activeSelection();
    if (!sel || sel.count() <= 0 || this.submitting()) return;

    const params: SetCategoryParams = {
      categoryId: this.categoryId(),
    };

    this.submitting.set(true);
    this.categoryError.set(null);
    try {
      const outcome = await submitItemsBulkJob({
        action: 'SET_CATEGORY',
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
      if (info.code === 'TRADE.CATALOG.CATEGORY_ASSIGNMENT_INVALID') {
        this.categoryError.set(message);
      } else {
        this.notify.error(message);
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
