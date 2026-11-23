import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerTrash } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { BulkJobSelection, BulkJobSubmit } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Field } from '../../../../../shared/ui/field/field';
import { BulkRunModal } from '../../../shared/record/bulk/bulk-run-modal/bulk-run-modal';
import { ApiError, errorCodeOf } from '../../../settings/shared/settings-api';
import { LeadBulkSubmitKey, leadBulkErrorMessage, leadBulkLoadError, leadBulkPrecheck, leadBulkValidationFields } from '../lead-bulk-submit';
import { DELETE_TYPED_CONFIRM_FROM, SelectedRow } from '../lead-bulk.model';
import { LeadSelection } from '../lead-selection';

const MAX_REASON_LENGTH = 1000;

@Component({
  selector: 'app-bulk-delete-modal',
  imports: [FullState, TranslocoPipe, BulkRunModal, Field],
  providers: [
    provideTranslocoScope('leads', { scope: 'record-related', alias: 'recordRelated' }, { scope: 'lead-bulk-actions', alias: 'leadBulk' }),
    provideIcons({ tablerTrash }),
  ],
  templateUrl: './delete-modal.html',
})
export class BulkDeleteModal {
  private static nextId = 0;
  protected readonly uid = `bulk-delete-${++BulkDeleteModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly selection = inject(LeadSelection, { optional: true });
  private readonly tracker = inject(BulkJobsTracker);

  private readonly modal = viewChild.required(BulkRunModal);

  readonly branchId = input('');
  readonly submitted = output<string>();

  protected readonly maxReasonLength = MAX_REASON_LENGTH;
  protected readonly typedConfirmFrom = DELETE_TYPED_CONFIRM_FROM;
  protected readonly rows = signal<SelectedRow[]>([]);
  protected readonly resolving = signal(false);
  protected readonly submitting = signal(false);
  protected readonly loadError = signal<ReturnType<typeof leadBulkLoadError> | null>(null);
  protected readonly reason = signal('');
  protected readonly reasonError = signal<string | null>(null);
  protected readonly submitKey = new LeadBulkSubmitKey();

  private openSeq = 0;

  protected readonly displayCount = computed(() =>
    this.resolving() && this.rows().length === 0 ? (this.selection?.count() ?? 0) : this.rows().length,
  );

  protected readonly convertedCount = computed(
    () => this.rows().filter((row) => row.status === 'CONVERTED').length,
  );

  protected readonly reasonLength = computed(() => [...this.reason()].length);

  protected readonly canSubmit = computed(
    () =>
      !this.loadError() &&
      !this.submitKey.blocked() &&
      !this.submitting() &&
      !this.resolving() &&
      this.rows().length > 0 &&
      this.reasonLength() <= MAX_REASON_LENGTH,
  );

  open(rows?: SelectedRow[]): void {
    void this.initOpen(rows);
  }

  protected onReasonInput(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
    this.reasonError.set(null);
  }

  protected close(): void {
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.openSeq++;
    this.resolving.set(false);
    this.submitting.set(false);
  }

  protected async retryLoad(): Promise<void> {
    const seq = ++this.openSeq;
    this.loadError.set(null);
    this.resolving.set(true);
    try {
      const rows = this.selection?.count() ? await this.selection.resolve() : this.rows();
      if (seq === this.openSeq) this.rows.set(rows);
    } catch (error) {
      if (seq === this.openSeq) this.loadError.set(leadBulkLoadError(this.transloco, error));
    }
    if (seq === this.openSeq) this.resolving.set(false);
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    const cleanReason = this.reason().trim() || null;
    const selection: BulkJobSelection =
      this.selection && this.selection.count() > 0
        ? this.selection.snapshot()
        : { kind: 'IDS', ids: this.rows().map((row) => row.id) };
    const precheck = leadBulkPrecheck(selection, this.branchId());
    if (precheck) {
      this.notify.error(this.transloco.translate(`leadBulk.codes.${precheck}`));
      return;
    }
    const body: BulkJobSubmit = {
      module: 'crm.leads',
      action: 'DELETE',
      scope: { branchId: this.branchId() },
      selection,
      params: { reason: cleanReason },
    };

    this.submitting.set(true);
    try {
      const res = await this.tracker.submit('crm', body, { idempotencyKey: this.submitKey.for(body) });
      this.submitKey.reset();
      this.close();
      this.submitted.emit(res.jobId);
    } catch (error) {
      this.submitKey.failed(error);
      this.handleSubmitError(error);
    } finally {
      this.submitting.set(false);
    }
  }

  private async initOpen(rows?: SelectedRow[]): Promise<void> {
    const seq = ++this.openSeq;
    this.loadError.set(null);
    this.submitKey.reset();
    this.reason.set('');
    this.reasonError.set(null);
    this.submitting.set(false);
    this.rows.set(rows ?? []);
    this.modal().open();

    if (rows && rows.length > 0) {
      this.resolving.set(false);
      return;
    }
    if (!this.selection || this.selection.count() === 0) {
      this.rows.set(rows ?? []);
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
      this.loadError.set(leadBulkLoadError(this.transloco, error));
    } finally {
      if (seq === this.openSeq) {
        this.resolving.set(false);
      }
    }
  }

  private handleSubmitError(error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'BULK_JOB_ACTIVE') return;
    if (leadBulkValidationFields(error).includes('reason')) {
      this.reasonError.set(this.transloco.translate('leadBulk.invalidValue'));
      return;
    }
    this.notify.error(this.translateCode(code, error));
  }

  private translateCode(code: string | null, error?: unknown): string {
    return leadBulkErrorMessage(this.transloco, error ?? (code ? new ApiError(422, code) : null));
  }

}
