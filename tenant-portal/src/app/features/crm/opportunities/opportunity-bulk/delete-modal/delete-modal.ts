import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerTrash } from '@ng-icons/tabler-icons';
import { PluralKeyPipe } from '../../../../../core/i18n/plural';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { BulkJobSelection } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { Field } from '../../../../../shared/ui/field/field';
import { BulkRunModal } from '../../../shared/record/bulk/bulk-run-modal/bulk-run-modal';
import { ApiError, errorCodeOf } from '../../../settings/shared/settings-api';
import { OPPORTUNITY_LIMITS, type SelectedOpportunity } from '../../opportunities.model';
import {
  buildDeleteBulkJob,
  OpportunityBulkSubmission,
  opportunityBulkErrorMessage,
  opportunityBulkFieldError,
  translateOpportunityBulkError,
} from '../bulk-runner';
import {
  OPPORTUNITY_DELETE_TYPED_CONFIRM_FROM,
  OpportunitySelection,
  type OpportunitySelectionRow,
  toSelectedOpportunity,
} from '../opportunity-selection';

const MAX_REASON_LENGTH = OPPORTUNITY_LIMITS.reason;

@Component({
  selector: 'app-opp-bulk-delete-modal',
  imports: [TranslocoPipe, PluralKeyPipe, BulkRunModal, Field],
  viewProviders: [
    provideTranslocoScope('opportunities', { scope: 'opportunity-bulk', alias: 'oppBulk' }),
    provideIcons({ tablerTrash }),
  ],
  templateUrl: './delete-modal.html',
})
export class OppBulkDeleteModal {
  private static nextId = 0;
  protected readonly uid = `opp-bulk-delete-${++OppBulkDeleteModal.nextId}`;

  private readonly scopeState = inject(TenantScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly selection = inject(OpportunitySelection, { optional: true });
  private readonly tracker = inject(BulkJobsTracker);
  protected readonly submission = new OpportunityBulkSubmission();
  private readonly openedBranchId = signal('');

  private readonly modal = viewChild.required(BulkRunModal);

  readonly branchId = input('');
  readonly submitted = output<string>();

  protected readonly maxReasonLength = MAX_REASON_LENGTH;
  protected readonly typedConfirmFrom = OPPORTUNITY_DELETE_TYPED_CONFIRM_FROM;
  protected readonly rows = signal<SelectedOpportunity[]>([]);
  protected readonly resolving = signal(false);
  protected readonly submitting = signal(false);
  protected readonly reason = signal('');
  private readonly serverReasonError = signal<string | null>(null);

  private openSeq = 0;

  private readonly effectiveBranchId = computed(() => {
    const selected = this.scopeState.selection()?.branchId ?? '';
    return selected === this.openedBranchId() && (!this.branchId().trim() || this.branchId().trim() === selected)
      && this.scopeState.branchCompanies().has(selected) ? selected : '';
  });

  protected readonly displayCount = computed(() =>
    this.resolving() && this.rows().length === 0 ? (this.selection?.count() ?? 0) : this.rows().length,
  );

  protected readonly typedConfirmWords = computed<readonly string[]>(() => [String(this.displayCount())]);

  protected readonly reasonLength = computed(() => [...this.reason()].length);

  protected readonly reasonError = computed<string | null>(() =>
    this.serverReasonError() ?? (this.reasonLength() > MAX_REASON_LENGTH ? this.transloco.translate('oppBulk.delete.reasonTooLong') : null),
  );

  protected readonly canSubmit = computed(
    () =>
      !this.submission.readOnly() &&
      !!this.effectiveBranchId() &&
      !this.submitting() &&
      !this.resolving() &&
      this.rows().length > 0 &&
      this.reasonLength() <= MAX_REASON_LENGTH,
  );

  open(rows?: readonly OpportunitySelectionRow[]): void {
    void this.initOpen(rows);
  }

  protected onReasonInput(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
    this.serverReasonError.set(null);
  }

  protected close(): void {
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.openSeq++;
    this.resolving.set(false);
    this.submitting.set(false);
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    const cleanReason = this.reason().trim();
    const selection: BulkJobSelection =
      this.selection && this.selection.count() > 0
        ? this.selection.snapshot()
        : { kind: 'IDS', ids: this.rows().map((row) => row.id) };
    const body = buildDeleteBulkJob(this.effectiveBranchId(), selection, cleanReason ? { reason: cleanReason } : undefined);

    this.submitting.set(true);
    try {
      const res = await this.submission.submit(this.tracker, body);
      this.close();
      this.submitted.emit(res.jobId);
    } catch (error) {
      this.handleSubmitError(error);
    } finally {
      this.submitting.set(false);
    }
  }

  private async initOpen(rows?: readonly OpportunitySelectionRow[]): Promise<void> {
    this.openedBranchId.set(this.scopeState.selection()?.branchId ?? '');
    this.submission.reset();
    if (!this.effectiveBranchId()) {
      this.notify.error(this.transloco.translate('opportunities.page.chooseBranch'));
      return;
    }
    const seq = ++this.openSeq;
    const mapped = rows ? rows.map(toSelectedOpportunity) : [];
    this.reason.set('');
    this.serverReasonError.set(null);
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
      this.showResolveError(error);
      this.close();
    } finally {
      if (seq === this.openSeq) {
        this.resolving.set(false);
      }
    }
  }

  private handleSubmitError(error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'BULK_JOB_ACTIVE') return;
    const fieldError = opportunityBulkFieldError(this.transloco, error, 'reason');
    if (fieldError) { this.serverReasonError.set(fieldError); return; }
    this.notify.error(opportunityBulkErrorMessage(this.transloco, error));
  }

  private translateCode(code: string | null): string {
    return translateOpportunityBulkError(this.transloco, code);
  }

  private showResolveError(error: unknown): void {
    const code = error instanceof ApiError ? error.code : errorCodeOf(error);
    this.notify.error(this.translateCode(code));
  }
}
