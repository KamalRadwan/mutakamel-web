import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerLock, tablerLockOpen } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../../core/notify/notify';
import { ApiError } from '../../../../../crm/settings/shared/settings-api';
import { listBulkJobs } from '../../../../../../shared/bulk-jobs/bulk-jobs.api';
import {
  type BulkJob,
  type BulkJobSubmit,
  type BulkJobSubmitResult,
  isBulkJobActive,
} from '../../../../../../shared/bulk-jobs/bulk-jobs.model';
import { BulkJobsTracker } from '../../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { Button } from '../../../../../../shared/ui/button/button';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import {
  type ReasonPickerValue,
  TradeReasonPicker,
} from '../../../../shared/pickers/reason-picker/reason-picker';
import { errorCodeOf, newIdempotencyKey, type TradeContext } from '../../../../shared/trade-api';
import type { ReasonKind } from '../../../../shared/trade-foundation.model';
import { type AccountListFilter, AccountSelection } from '../account-selection';
import {
  TRADE_ACCOUNTS_BULK_EVIDENCE_MAX,
  TRADE_ACCOUNTS_BULK_MODULE_ID,
  type TradeAccountsBulkAction,
  type TradeAccountsBulkParams,
} from '../accounts-bulk.descriptor';

const MAX_EVIDENCE_LENGTH = TRADE_ACCOUNTS_BULK_EVIDENCE_MAX;

function extractErrorCode(error: unknown): string | null {
  const tradeCode = errorCodeOf(error);
  if (tradeCode) return tradeCode;
  if (error && typeof error === 'object' && 'code' in error) {
    const raw = (error as { code?: unknown }).code;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  }
  return null;
}

function extractDetails(error: unknown): Record<string, unknown> | undefined {
  if (error && typeof error === 'object' && 'details' in error) {
    const details = (error as { details?: unknown }).details;
    if (details && typeof details === 'object' && !Array.isArray(details)) {
      return details as Record<string, unknown>;
    }
  }
  return undefined;
}

function extractDetailString(
  details: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const raw = details?.[key];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed || null;
  }
  if (Array.isArray(raw) && typeof raw[0] === 'string') {
    const trimmed = raw[0].trim();
    return trimmed || null;
  }
  return null;
}

@Component({
  selector: 'app-account-reason-modal',
  imports: [TranslocoPipe, Button, Field, Modal, TradeReasonPicker],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'trade-accounts-bulk', alias: 'accountsBulk' },
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'bulk-jobs', alias: 'bulkJobs' },
    ),
    provideIcons({ tablerLock, tablerLockOpen }),
  ],
  templateUrl: './account-reason-modal.html',
})
export class AccountReasonModal {
  private static nextId = 0;
  protected readonly uid = `account-reason-modal-${++AccountReasonModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly tracker = inject(BulkJobsTracker);
  private readonly injectedSelection = inject(AccountSelection, { optional: true });

  private readonly modal = viewChild.required(Modal);
  private readonly reasonPicker = viewChild<TradeReasonPicker>('reasonPicker');

  readonly selection = input<AccountSelection | null>(null);
  readonly context = input<TradeContext>({});
  readonly filter = input<AccountListFilter>({});
  readonly total = input(0);

  readonly submitted = output<BulkJobSubmitResult>();
  readonly finished = output<BulkJob>();

  protected readonly maxEvidenceLength = MAX_EVIDENCE_LENGTH;
  protected readonly action = signal<TradeAccountsBulkAction>('BLOCK');
  protected readonly isOpen = signal(false);
  protected readonly submitting = signal(false);
  protected readonly showErrors = signal(false);
  protected readonly reasonValue = signal<ReasonPickerValue>({ reasonCodeId: null, note: '' });
  protected readonly evidenceRef = signal('');
  private readonly targetCount = signal(0);

  private submitKey: string | null = null;
  private submitFingerprint: string | null = null;

  protected readonly resolvedSelection = computed(() => this.selection() ?? this.injectedSelection);

  protected readonly displayCount = computed(() =>
    this.isOpen() ? this.targetCount() : (this.resolvedSelection()?.count() ?? 0),
  );

  protected readonly reasonKind = computed<ReasonKind>(() =>
    this.action() === 'BLOCK' ? 'ACCOUNT_BLOCK' : 'ACCOUNT_UNBLOCK',
  );

  protected readonly evidenceLength = computed(() => this.evidenceRef().length);

  protected readonly evidenceError = computed<string | null>(() => {
    this.i18n();
    if (this.action() !== 'BLOCK' || this.evidenceLength() <= MAX_EVIDENCE_LENGTH) return null;
    return this.transloco.translate('accountsBulk.evidence.tooLong');
  });

  protected readonly canSubmit = computed(() => {
    if (this.submitting() || !this.isOpen()) return false;
    if (this.displayCount() <= 0 || !this.context().companyId?.trim()) return false;
    if (!(this.reasonPicker()?.valid() ?? false)) return false;
    if (this.action() === 'BLOCK' && this.evidenceLength() > MAX_EVIDENCE_LENGTH) return false;
    return true;
  });

  open(action: TradeAccountsBulkAction): void {
    const sel = this.resolvedSelection();
    this.action.set(action);
    this.reasonValue.set({ reasonCodeId: null, note: '' });
    this.evidenceRef.set('');
    this.showErrors.set(false);
    this.submitting.set(false);
    this.submitKey = null;
    this.submitFingerprint = null;
    this.targetCount.set(sel ? sel.count() : 0);
    this.isOpen.set(true);
    this.modal().open();
  }

  close(): void {
    this.modal().close();
  }

  protected onEvidenceInput(event: Event): void {
    this.evidenceRef.set((event.target as HTMLInputElement).value);
  }

  protected onModalClosed(): void {
    this.isOpen.set(false);
    this.showErrors.set(false);
    this.submitting.set(false);
    this.submitKey = null;
    this.submitFingerprint = null;
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) {
      this.showErrors.set(true);
      return;
    }

    const sel = this.resolvedSelection();
    const companyId = this.context().companyId?.trim() ?? '';
    const reasonCodeId = this.reasonValue().reasonCodeId?.trim() ?? '';
    if (!sel || sel.count() <= 0 || !companyId || !reasonCodeId) {
      this.showErrors.set(true);
      return;
    }

    const action = this.action();
    const trimmedNote = this.reasonValue().note.trim();
    const trimmedEvidence = action === 'BLOCK' ? this.evidenceRef().trim() : '';
    const params: TradeAccountsBulkParams = {
      reasonCodeId,
      ...(trimmedNote ? { note: trimmedNote } : {}),
      ...(trimmedEvidence ? { evidenceRef: trimmedEvidence } : {}),
    };

    const body: BulkJobSubmit = {
      module: TRADE_ACCOUNTS_BULK_MODULE_ID,
      action,
      scope: { companyId },
      selection: sel.snapshot(),
      params,
    };

    const fingerprint = JSON.stringify(body);
    if (fingerprint !== this.submitFingerprint || !this.submitKey) {
      this.submitFingerprint = fingerprint;
      this.submitKey = newIdempotencyKey();
    }

    this.submitting.set(true);
    try {
      const res = await this.tracker.submit('trading', body, { idempotencyKey: this.submitKey });
      const job = this.tracker
        .jobs()
        .find((entry) => entry.app === 'trading' && entry.id === res.jobId);
      if (job && !isBulkJobActive(job.status)) {
        this.finished.emit(job);
      }

      this.submitKey = null;
      this.submitFingerprint = null;
      this.close();
      this.submitted.emit(res);
    } catch (error) {
      await this.handleSubmitError(error);
    } finally {
      this.submitting.set(false);
    }
  }

  private async handleSubmitError(error: unknown): Promise<void> {
    const code = extractErrorCode(error);
    const details = extractDetails(error);

    if (error instanceof ApiError && error.code === 'BULK_JOB_ACTIVE') {
      // The tracker already warned and opened the running job.
      this.close();
      return;
    }

    if (code === 'BULK_JOB_ACTIVE' || code === 'TRADE.BULK_JOB.ACTIVE') {
      this.notify.warning(
        this.translateCodeOrFallback('bulkJobs.toast.active', 'accountsBulk.busy'),
      );
      let activeJobId = extractDetailString(details, 'activeJobId');
      if (!activeJobId) {
        try {
          const activePage = await listBulkJobs('trading', {
            scope: 'active',
            module: TRADE_ACCOUNTS_BULK_MODULE_ID,
            page: 1,
            limit: 1,
          });
          const firstActive = activePage.items[0];
          if (firstActive) {
            this.tracker.syncExternalJob(firstActive);
            activeJobId = firstActive.id;
          }
        } catch {
          // Toast already shown; ignore active lookup failure.
        }
      }
      this.close();
      if (activeJobId) {
        this.tracker.openReport('trading', activeJobId);
      }
      return;
    }

    if (code?.startsWith('TRADE.REASON.')) {
      this.showErrors.set(true);
    }

    this.notify.error(this.translateError(code, details));
  }

  private translateError(code: string | null, details?: Record<string, unknown>): string {
    const maxRaw = extractDetailString(details, 'max');
    const params: Record<string, unknown> = maxRaw ? { max: maxRaw } : { max: 10_000 };

    if (code) {
      const normalized = code.replaceAll('.', '_');
      const candidates = [
        `accountsBulk.codes.${code}`,
        `accountsBulk.codes.${normalized}`,
        `tradeShared.errors.${normalized}`,
        `bulkJobs.codes.${code}`,
      ];
      for (const key of candidates) {
        const translated = this.transloco.translate(key, params);
        if (translated && translated !== key) return translated;
      }
    }

    return this.transloco.translate('tradeShared.errors.generic');
  }

  private translateCodeOrFallback(primaryKey: string, fallbackKey: string): string {
    const primary = this.transloco.translate(primaryKey);
    if (primary && primary !== primaryKey) return primary;
    return this.transloco.translate(fallbackKey);
  }
}
