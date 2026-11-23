import { Component, effect, inject, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowBackUp, tablerHistory } from '@ng-icons/tabler-icons';
import { ApiError, isRetryableWriteError, writeErrorMessage } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  TemplatesApi,
  type TemplateRecoverySnapshotItem,
} from '../../templates.api';
import { TemplatePageService, TemplateRecoverySnapshotState, errorDetailsOf } from '../template-page.service';

@Component({
  selector: 'app-recovery-tab',
  imports: [NgIcon, TranslocoPipe, Button, Checkbox, Field, Modal],
  providers: [provideIcons({ tablerHistory, tablerArrowBackUp })],
  templateUrl: './recovery-tab.html',
  host: { class: 'block min-w-0' },
})
export class RecoveryTab {
  private static nextId = 0;
  protected readonly uid = `tpl-recovery-${++RecoveryTab.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  private readonly api = inject(TemplatesApi);
  protected readonly language = inject(LanguageState).current;
  protected readonly service = inject(TemplatePageService);

  private readonly restoreModal = viewChild.required<Modal>('restoreModal');

  protected readonly restoringTarget = signal<TemplateRecoverySnapshotItem | null>(null);
  protected readonly reason = signal('');
  protected readonly discardCurrentDraft = signal(false);
  protected readonly reasonError = signal<string | null>(null);
  protected readonly discardError = signal<string | null>(null);
  protected readonly restoring = signal(false);
  private templateEpoch = 0;
  private pendingRestore: { signature: string; key: string } | null = null;

  constructor() {
    let previousId: string | undefined;
    effect(() => {
      const id = this.service.definition()?.templateId;
      if (id === previousId) return;
      previousId = id;
      this.templateEpoch++;
      this.pendingRestore = null;
      this.restoringTarget.set(null);
      this.restoring.set(false);
      this.restoreModal().close();
    });
  }

  private isCurrent(templateId: string, epoch: number): boolean {
    return this.service.definition()?.templateId === templateId && this.templateEpoch === epoch;
  }

  private writeMessage(error: unknown): string {
    return error instanceof ApiError && error.status === 401
      ? writeErrorMessage(error, 'templatesPage', this.transloco)
      : this.service.translateError(this.transloco, error);
  }

  protected stateOf(item: TemplateRecoverySnapshotItem): TemplateRecoverySnapshotState {
    return this.service.snapshotState(item);
  }

  protected stateBadgeClass(state: TemplateRecoverySnapshotState): string {
    switch (state) {
      case 'AVAILABLE':
        return 'bg-success text-on-success';
      case 'QUARANTINED':
        return 'bg-danger text-on-danger';
      case 'RESTORED':
        return 'bg-brand-soft text-on-brand-soft';
      case 'EXPIRED':
      default:
        return 'bg-neutral-soft text-text-muted';
    }
  }

  protected canRestore(item: TemplateRecoverySnapshotItem): boolean {
    const def = this.service.definition();
    return (
      !this.service.isReadOnly() &&
      !!def &&
      def.lifecycleStatus !== 'ARCHIVED' &&
      def.capabilities.restoreRecovery.state === 'ENABLED' &&
      this.stateOf(item) === 'AVAILABLE'
    );
  }

  protected disabledReason(item: TemplateRecoverySnapshotItem): string | null {
    const state = this.stateOf(item);
    if (state === 'RESTORED' || state === 'QUARANTINED' || state === 'EXPIRED') {
      return this.transloco.translate(`templatesPage.recovery.restoreDisabled.${state}`);
    }
    const def = this.service.definition();
    if (def?.lifecycleStatus === 'ARCHIVED') {
      return this.transloco.translate('templatesPage.recovery.restoreDisabled.ARCHIVED');
    }
    if (this.service.isReadOnly() || def?.capabilities.restoreRecovery.state !== 'ENABLED') {
      return this.transloco.translate('templatesPage.recovery.restoreDisabled.READ_ONLY');
    }
    return null;
  }

  protected openRestoreModal(item: TemplateRecoverySnapshotItem): void {
    if (!this.canRestore(item)) return;
    this.restoringTarget.set(item);
    this.pendingRestore = null;
    this.reason.set('');
    this.discardCurrentDraft.set(false);
    this.reasonError.set(null);
    this.discardError.set(null);
    this.restoreModal().open();
  }

  protected onReasonInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.reason.set(value);
    if (this.reasonError() && value.trim().length > 0) {
      this.reasonError.set(null);
    }
  }

  protected onDiscardCheckedChange(checked: boolean): void {
    this.discardCurrentDraft.set(checked);
    if (checked && this.discardError()) {
      this.discardError.set(null);
    }
  }

  protected async submitRestore(): Promise<void> {
    const def = this.service.definition();
    const target = this.restoringTarget();
    if (!def || !target || this.restoring()) return;

    const trimmed = this.reason().trim();
    let invalid = false;
    if (!trimmed) {
      this.reasonError.set(this.transloco.translate('templatesPage.recovery.restoreModal.reasonRequired'));
      invalid = true;
    }
    if (!this.discardCurrentDraft()) {
      this.discardError.set(this.transloco.translate('templatesPage.recovery.restoreModal.discardRequired'));
      invalid = true;
    }
    if (invalid) return;

    const draftEtag = this.service.draft()?.etag ?? def.currentDraft.etag;
    const epoch = this.templateEpoch;
    const signature = JSON.stringify([def.templateId, target.snapshotId, target.snapshotChecksum, draftEtag, trimmed]);
    if (this.pendingRestore?.signature !== signature) {
      this.pendingRestore = { signature, key: newIdempotencyKey() };
    }
    this.restoring.set(true);
    try {
      const result = await this.api.restoreRecoverySnapshot(
        def.templateId,
        target.snapshotId,
        {
          expectedSnapshotChecksum: target.snapshotChecksum,
          reason: trimmed,
          discardCurrentDraft: true,
        },
        draftEtag,
        this.pendingRestore.key,
      );
      if (!this.isCurrent(def.templateId, epoch)) return;
      this.pendingRestore = null;
      const res = result.data;
      this.service.syncExternalDraft({ ...res.draft, etag: result.etag ?? res.draft.etag });
      this.service.snapshots.update(items => items.map(item =>
        item.snapshotId === res.recoveredFrom.snapshotId ? res.recoveredFrom : item));
      const [freshDef, freshSnapshots] = await Promise.allSettled([
        this.api.getTemplate(def.templateId),
        this.api.listRecoverySnapshots(def.templateId, { limit: 20 }),
      ]);
      if (!this.isCurrent(def.templateId, epoch)) return;
      if (freshDef.status === 'fulfilled') {
        this.service.syncFromDefinition(freshDef.value, this.service.overviewDirty());
      }
      if (freshSnapshots.status === 'fulfilled') {
        this.service.snapshots.set(freshSnapshots.value.items);
      }
      const failed = [freshDef, freshSnapshots].find(item => item.status === 'rejected');
      if (failed?.status === 'rejected') this.notify.error(this.service.translateError(this.transloco, failed.reason));
      this.restoreModal().close();
      this.notify.success(this.transloco.translate('templatesPage.recovery.restoreModal.restoredToast'));
    } catch (error) {
      if (!this.isCurrent(def.templateId, epoch)) return;
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) this.pendingRestore = null;
      const { status, code } = errorDetailsOf(error);
      if (status === 409 && code === 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION') {
        this.restoreModal().close();
        this.service.openConflict();
      } else if (
        status === 410 ||
        code === 'CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_ALREADY_RESTORED' ||
        code === 'CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_STALE' ||
        code === 'CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_EXPIRED' ||
        code === 'CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_INTEGRITY_FAILED'
      ) {
        this.notify.error(this.writeMessage(error));
        const freshSnapshots = await this.api.listRecoverySnapshots(def.templateId, { limit: 20 }).catch((refreshError: unknown) => {
          if (this.isCurrent(def.templateId, epoch)) this.notify.error(this.service.translateError(this.transloco, refreshError));
          return null;
        });
        if (!this.isCurrent(def.templateId, epoch)) return;
        if (freshSnapshots) {
          this.service.snapshots.set(freshSnapshots.items);
        }
        this.restoreModal().close();
      } else {
        this.notify.error(this.writeMessage(error));
      }
    } finally {
      if (this.isCurrent(def.templateId, epoch)) this.restoring.set(false);
    }
  }
}
