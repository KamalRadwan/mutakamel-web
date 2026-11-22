import { Component, inject, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowBackUp, tablerHistory } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  TemplateRecoverySnapshotItem,
  getTemplate,
  listRecoverySnapshots,
  restoreRecoverySnapshot,
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
  protected readonly language = inject(LanguageState).current;
  protected readonly service = inject(TemplatePageService);

  private readonly restoreModal = viewChild.required<Modal>('restoreModal');

  protected readonly restoringTarget = signal<TemplateRecoverySnapshotItem | null>(null);
  protected readonly reason = signal('');
  protected readonly discardCurrentDraft = signal(false);
  protected readonly reasonError = signal<string | null>(null);
  protected readonly discardError = signal<string | null>(null);
  protected readonly restoring = signal(false);

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
    this.restoring.set(true);
    try {
      const res = await restoreRecoverySnapshot(
        def.templateId,
        target.snapshotId,
        {
          expectedSnapshotChecksum: target.snapshotChecksum,
          reason: trimmed,
          discardCurrentDraft: true,
        },
        draftEtag,
      );
      this.service.syncExternalDraft(res.draft);
      const [freshDef, freshSnapshots] = await Promise.all([
        getTemplate(def.templateId).catch(() => null),
        listRecoverySnapshots(def.templateId, { limit: 20 }).catch(() => null),
      ]);
      if (freshDef) {
        this.service.syncFromDefinition(freshDef, this.service.overviewDirty());
      }
      if (freshSnapshots) {
        this.service.snapshots.set(freshSnapshots.items);
      }
      this.restoreModal().close();
      this.notify.success(this.transloco.translate('templatesPage.recovery.restoreModal.restoredToast'));
    } catch (error) {
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
        this.notify.error(this.service.translateError(this.transloco, error));
        const freshSnapshots = await listRecoverySnapshots(def.templateId, { limit: 20 }).catch(() => null);
        if (freshSnapshots) {
          this.service.snapshots.set(freshSnapshots.items);
        }
        this.restoreModal().close();
      } else {
        this.notify.error(this.service.translateError(this.transloco, error));
      }
    } finally {
      this.restoring.set(false);
    }
  }
}
