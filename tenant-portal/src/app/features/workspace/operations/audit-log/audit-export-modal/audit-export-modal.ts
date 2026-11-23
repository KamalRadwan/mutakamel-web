import { Component, DestroyRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerFileExport } from '@ng-icons/tabler-icons';
import { ApiError, isRetryableWriteError, writeErrorMessage } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { AuditExportContext, AuditExportReceipt, AuditLogApi } from '../audit-log.api';

@Component({
  selector: 'app-audit-export-modal',
  imports: [TranslocoPipe, Button, Field, Modal],
  viewProviders: [provideTranslocoScope('settings', { scope: 'ws-audit-log', alias: 'wsAudit' })],
  providers: [provideIcons({ tablerFileExport })],
  templateUrl: './audit-export-modal.html',
})
export class AuditExportModal {
  private static nextId = 0;
  protected readonly uid = `ws-audit-export-modal-${++AuditExportModal.nextId}`;

  private readonly api = inject(AuditLogApi);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly modal = viewChild.required(Modal);

  readonly exported = output<AuditExportReceipt>();
  readonly rangeInvalid = output<string>();

  protected readonly context = signal<AuditExportContext | null>(null);
  protected readonly submitting = signal(false);
  protected readonly rangeError = signal<string | null>(null);
  protected readonly dateRangeDisplay = computed(() => this.context()?.dateRangeLabel ?? '');

  private pendingAttempt: { key: string; bodyJson: string } | null = null;

  open(context: AuditExportContext): void {
    this.context.set(context);
    this.submitting.set(false);
    this.rangeError.set(null);
    this.pendingAttempt = null;
    this.modal().open();
  }

  close(): void {
    this.modal().close();
  }

  protected onClosed(): void {
    this.submitting.set(false);
    this.rangeError.set(null);
    this.pendingAttempt = null;
    this.context.set(null);
  }

  protected async submit(): Promise<void> {
    const ctx = this.context();
    if (!ctx || this.submitting()) return;

    const bodyJson = JSON.stringify(ctx.query);
    if (!this.pendingAttempt || this.pendingAttempt.bodyJson !== bodyJson) {
      this.pendingAttempt = { key: newIdempotencyKey(), bodyJson };
    }
    const key = this.pendingAttempt.key;

    this.submitting.set(true);
    this.rangeError.set(null);
    try {
      const receipt = await this.api.startAuditExport(ctx.query, key);
      if (this.destroyRef.destroyed) return;
      this.pendingAttempt = null;
      this.notify.success(this.transloco.translate('wsAudit.export.started'));
      this.exported.emit(receipt);
      this.close();
    } catch (error) {
      if (this.destroyRef.destroyed) return;
      const keepKey = isRetryableWriteError(error) || (error instanceof ApiError && error.status === 401);
      if (!keepKey) {
        this.pendingAttempt = null;
      }

      if (error instanceof ApiError && error.status === 401) {
        this.notify.error(writeErrorMessage(error, 'wsAudit', this.transloco));
      } else if (error instanceof ApiError && error.status === 400 && error.code === 'AUDIT_EXPORT_RANGE_INVALID') {
        const message = this.transloco.translate('wsAudit.errors.AUDIT_EXPORT_RANGE_INVALID');
        this.rangeError.set(message);
        this.rangeInvalid.emit(message);
      } else if (error instanceof ApiError && error.status === 403 && error.code === 'AUDIT_EXPORT_FORBIDDEN') {
        this.notify.error(this.transloco.translate('wsAudit.errors.AUDIT_EXPORT_FORBIDDEN'));
      } else if (error instanceof ApiError && error.status === 409 && error.code === 'AUDIT_EXPORT_IN_PROGRESS') {
        const raw = error.details?.['exportId'];
        const runningId = Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim() ? raw[0].trim() : null;
        const link = runningId ? `/workspace/operations/audit-log?exportId=${encodeURIComponent(runningId)}` : '';
        this.notify.error(this.transloco.translate('wsAudit.errors.AUDIT_EXPORT_IN_PROGRESS'), link);
      } else {
        this.notify.error(writeErrorMessage(error, 'wsAudit', this.transloco));
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.submitting.set(false);
      }
    }
  }
}
