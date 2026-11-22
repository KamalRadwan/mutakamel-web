import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerCircleX, tablerTrash } from '@ng-icons/tabler-icons';
import { PluralKeyPipe } from '../../../../../core/i18n/plural';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { BulkJobSelection, BulkJobSubmit } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { Field } from '../../../../../shared/ui/field/field';
import { BulkRunModal } from '../../../shared/record/bulk/bulk-run-modal/bulk-run-modal';
import { errorCodeOf } from '../../../settings/shared/settings-api';
import {
  CUSTOMERS_BULK_APP,
  CUSTOMERS_BULK_MODULE_ID,
  CUSTOMER_BULK_REASON_MAX,
  CUSTOMER_DELETE_TYPED_CONFIRM_FROM,
  SelectedCustomerRow,
  extractBulkErrorParams,
  translateCustomerBulkError,
} from '../customer-bulk.model';
import { CustomerBulkSubmitKey } from '../customer-bulk-submit-key';
import { CustomerSelection } from '../customer-selection';

@Component({
  selector: 'app-customer-bulk-delete-modal',
  imports: [NgIcon, TranslocoPipe, PluralKeyPipe, BulkRunModal, Field],
  providers: [provideIcons({ tablerTrash, tablerAlertTriangle, tablerCircleX })],
  templateUrl: './customer-bulk-delete-modal.html',
})
export class CustomerBulkDeleteModal {
  private static nextId = 0;
  protected readonly uid = `customer-bulk-delete-${++CustomerBulkDeleteModal.nextId}`;

  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly selection = inject(CustomerSelection, { optional: true });
  private readonly tracker = inject(BulkJobsTracker);

  private readonly modal = viewChild.required(BulkRunModal);

  readonly branchId = input('');
  readonly submitted = output<string>();

  protected readonly maxReasonLength = CUSTOMER_BULK_REASON_MAX;
  protected readonly typedConfirmFrom = CUSTOMER_DELETE_TYPED_CONFIRM_FROM;
  protected readonly rows = signal<SelectedCustomerRow[]>([]);
  protected readonly resolving = signal(false);
  protected readonly submitting = signal(false);
  protected readonly reason = signal('');
  protected readonly requestError = signal<string | null>(null);

  private openSeq = 0;
  private readonly submitKey = new CustomerBulkSubmitKey();

  private readonly effectiveBranchId = computed(() => this.branchId().trim() || this.scopeState.branch().id);

  protected readonly displayCount = computed(() =>
    this.resolving() && this.rows().length === 0 ? (this.selection?.count() ?? 0) : this.rows().length,
  );

  protected readonly blacklistedCount = computed(
    () => this.rows().filter((row) => row.status === 'BLACKLISTED').length,
  );

  protected readonly reasonLength = computed(() => Array.from(this.reason()).length);

  protected readonly reasonError = computed<string | null>(() => {
    this.i18n();
    if (this.reasonLength() <= CUSTOMER_BULK_REASON_MAX) return null;
    return this.transloco.translate('customerBulk.activity.validation.maxLength', { max: CUSTOMER_BULK_REASON_MAX });
  });

  protected readonly canSubmit = computed(
    () =>
      !this.submitting() &&
      !this.resolving() &&
      this.rows().length > 0 &&
      this.reasonLength() <= CUSTOMER_BULK_REASON_MAX,
  );

  open(rows?: readonly SelectedCustomerRow[]): void {
    void this.initOpen(rows);
  }

  protected onReasonInput(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
    this.requestError.set(null);
  }

  protected close(): void {
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.openSeq++;
    this.resolving.set(false);
    this.submitting.set(false);
    this.requestError.set(null);
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    const cleanReason = this.reason().trim();
    const selection: BulkJobSelection =
      this.selection && this.selection.count() > 0
        ? this.selection.snapshot()
        : { kind: 'IDS', ids: this.rows().map((row) => row.id) };

    this.submitting.set(true);
    this.requestError.set(null);
    try {
      const body: BulkJobSubmit = {
        module: CUSTOMERS_BULK_MODULE_ID,
        action: 'DELETE',
        scope: { branchId: this.effectiveBranchId() },
        selection,
        params: cleanReason ? { reason: cleanReason } : {},
      };
      const res = await this.tracker.submit(CUSTOMERS_BULK_APP, body, { idempotencyKey: this.submitKey.for(body) });
      this.submitKey.reset();
      this.close();
      this.submitted.emit(res.jobId);
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'BULK_JOB_ACTIVE') {
        this.close();
        return;
      }
      this.requestError.set(translateCustomerBulkError(this.transloco, code, extractBulkErrorParams(error)));
    } finally {
      this.submitting.set(false);
    }
  }

  private async initOpen(rows?: readonly SelectedCustomerRow[]): Promise<void> {
    const seq = ++this.openSeq;
    this.submitKey.reset();
    const mapped = rows ? [...rows] : [];
    this.reason.set('');
    this.requestError.set(null);
    this.submitting.set(false);
    this.rows.set(mapped);
    this.modal().open();

    if (mapped.length > 0) {
      this.resolving.set(false);
      return;
    }
    if (!this.selection || this.selection.count() === 0) {
      this.rows.set([]);
      this.resolving.set(false);
      return;
    }

    this.resolving.set(true);
    try {
      const resolved = await this.selection.resolve();
      if (seq !== this.openSeq) return;
      this.rows.set(resolved);
    } catch (error) {
      if (seq !== this.openSeq) return;
      const code = errorCodeOf(error);
      this.notify.error(translateCustomerBulkError(this.transloco, code, extractBulkErrorParams(error)));
      this.close();
    } finally {
      if (seq === this.openSeq) {
        this.resolving.set(false);
      }
    }
  }
}
