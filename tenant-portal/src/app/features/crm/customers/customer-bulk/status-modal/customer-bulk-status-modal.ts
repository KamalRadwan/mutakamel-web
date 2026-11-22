import { Component, ElementRef, computed, inject, input, output, signal, viewChild, viewChildren } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerArrowsExchange, tablerCircleX } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { PluralKeyPipe } from '../../../../../core/i18n/plural';
import { ScopeState } from '../../../../../core/scope/scope';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { BulkJobSelection, BulkJobSubmit } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { Field } from '../../../../../shared/ui/field/field';
import { BulkRunModal } from '../../../shared/record/bulk/bulk-run-modal/bulk-run-modal';
import { errorCodeOf } from '../../../settings/shared/settings-api';
import { CUSTOMER_STATUS_TONE, MANUAL_STATUSES } from '../../customer-statuses';
import { ManualCustomerStatus } from '../../customers.model';
import {
  CUSTOMERS_BULK_APP,
  CUSTOMERS_BULK_MODULE_ID,
  SelectedCustomerRow,
  extractBulkErrorParams,
  translateCustomerBulkError,
} from '../customer-bulk.model';
import { CustomerBulkSubmitKey } from '../customer-bulk-submit-key';
import { CustomerSelection } from '../customer-selection';

@Component({
  selector: 'app-customer-bulk-status-modal',
  imports: [NgIcon, TranslocoPipe, PluralKeyPipe, BulkRunModal, Field],
  providers: [provideIcons({ tablerArrowsExchange, tablerAlertTriangle, tablerCircleX })],
  templateUrl: './customer-bulk-status-modal.html',
})
export class CustomerBulkStatusModal {
  private static nextId = 0;
  protected readonly uid = `customer-bulk-status-${++CustomerBulkStatusModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly selection = inject(CustomerSelection, { optional: true });
  private readonly tracker = inject(BulkJobsTracker);

  private readonly modal = viewChild.required(BulkRunModal);
  private readonly optionButtons = viewChildren<ElementRef<HTMLButtonElement>>('statusOption');

  readonly branchId = input('');
  readonly submitted = output<string>();

  protected readonly statuses = MANUAL_STATUSES;
  protected readonly statusTone = CUSTOMER_STATUS_TONE;
  protected readonly rows = signal<SelectedCustomerRow[]>([]);
  protected readonly resolving = signal(false);
  protected readonly submitting = signal(false);
  protected readonly selectedStatus = signal<ManualCustomerStatus | null>(null);
  protected readonly requestError = signal<string | null>(null);

  private openSeq = 0;
  private readonly submitKey = new CustomerBulkSubmitKey();

  private readonly effectiveBranchId = computed(() => this.branchId().trim() || this.scopeState.branch().id);

  protected readonly displayCount = computed(() =>
    this.resolving() && this.rows().length === 0 ? (this.selection?.count() ?? 0) : this.rows().length,
  );

  protected readonly unchangedCount = computed(() => {
    const status = this.selectedStatus();
    if (!status) return 0;
    return this.rows().filter((row) => row.status === status).length;
  });

  protected readonly isDanger = computed(() => this.selectedStatus() === 'BLACKLISTED');

  protected readonly canSubmit = computed(
    () =>
      !this.submitting() &&
      !this.resolving() &&
      this.selectedStatus() !== null &&
      this.rows().length > 0,
  );

  open(rows?: readonly SelectedCustomerRow[]): void {
    void this.initOpen(rows);
  }

  protected selectStatus(status: ManualCustomerStatus): void {
    this.selectedStatus.set(status);
    this.requestError.set(null);
  }

  protected onStatusKeydown(event: KeyboardEvent, index: number): void {
    const list = this.statuses;
    const rtl = this.isRtl();
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let targetIndex = -1;
    if (event.key === 'ArrowDown' || event.key === nextKey) {
      targetIndex = (index + 1) % list.length;
    } else if (event.key === 'ArrowUp' || event.key === prevKey) {
      targetIndex = (index - 1 + list.length) % list.length;
    } else if (event.key === 'Home') {
      targetIndex = 0;
    } else if (event.key === 'End') {
      targetIndex = list.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    this.selectStatus(list[targetIndex]);
    this.optionButtons()[targetIndex]?.nativeElement.focus();
  }

  protected dotClass(status: ManualCustomerStatus): string {
    return this.statusTone[status] === 'danger' ? 'bg-danger' : 'bg-brand';
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
    const status = this.selectedStatus();
    if (!status) return;

    const selection: BulkJobSelection =
      this.selection && this.selection.count() > 0
        ? this.selection.snapshot()
        : { kind: 'IDS', ids: this.rows().map((row) => row.id) };

    this.submitting.set(true);
    this.requestError.set(null);
    try {
      const body: BulkJobSubmit = {
        module: CUSTOMERS_BULK_MODULE_ID,
        action: 'SET_STATUS',
        scope: { branchId: this.effectiveBranchId() },
        selection,
        params: { status },
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
      this.i18n();
      this.requestError.set(translateCustomerBulkError(this.transloco, code, extractBulkErrorParams(error)));
    } finally {
      this.submitting.set(false);
    }
  }

  private async initOpen(rows?: readonly SelectedCustomerRow[]): Promise<void> {
    const seq = ++this.openSeq;
    this.submitKey.reset();
    const mapped = rows ? [...rows] : [];
    this.selectedStatus.set(null);
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

  private isRtl(): boolean {
    const element = this.host.nativeElement;
    const dirAttr = element.closest('[dir]')?.getAttribute('dir')?.toLowerCase();
    if (dirAttr === 'rtl' || dirAttr === 'ltr') {
      return dirAttr === 'rtl';
    }
    return getComputedStyle(element).direction === 'rtl';
  }
}
