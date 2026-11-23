import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowBackUp, tablerChevronLeft, tablerChevronRight, tablerStack2 } from '@ng-icons/tabler-icons';
import { ApiError, isRetryableWriteError, writeErrorMessage } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  TemplatesApi,
  type TemplateVersionDetail,
  type TemplateVersionItem,
} from '../../templates.api';
import { TemplatePageService, errorDetailsOf } from '../template-page.service';

@Component({
  selector: 'app-versions-tab',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Button, Checkbox, ConfirmDialog, Field, Modal],
  providers: [provideIcons({ tablerStack2, tablerChevronLeft, tablerChevronRight, tablerArrowBackUp })],
  templateUrl: './versions-tab.html',
  host: { class: 'block min-w-0' },
})
export class VersionsTab {
  private static nextId = 0;
  protected readonly uid = `tpl-versions-${++VersionsTab.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  private readonly api = inject(TemplatesApi);
  protected readonly language = inject(LanguageState).current;
  protected readonly service = inject(TemplatePageService);

  private readonly viewModal = viewChild.required<Modal>('viewModal');
  private readonly restoreModal = viewChild.required<Modal>('restoreModal');
  private readonly retireConfirm = viewChild.required<ConfirmDialog>('retireConfirm');

  protected readonly cursorStack = signal<(string | null)[]>([]);
  protected readonly currentCursor = signal<string | null>(null);
  protected readonly paging = signal(false);

  protected readonly viewingVersion = signal<TemplateVersionDetail | null>(null);
  protected readonly viewingVersionNumber = signal<number | null>(null);
  protected readonly loadingView = signal(false);

  private viewSeq = 0;
  private templateEpoch = 0;
  private pendingRestore: { signature: string; key: string } | null = null;
  private pendingRetire: { signature: string; key: string } | null = null;

  constructor() {
    let previousId: string | undefined;
    effect(() => {
      const id = this.service.definition()?.templateId;
      if (id === previousId) return;
      previousId = id;
      this.templateEpoch++;
      this.viewSeq++;
      this.viewingVersion.set(null);
      this.loadingView.set(false);
      this.cursorStack.set([]);
      this.currentCursor.set(null);
      this.paging.set(false);
      this.restoring.set(false);
      this.retiring.set(false);
      this.restoringTarget.set(null);
      this.retiringTarget.set(null);
      this.pendingRestore = null;
      this.pendingRetire = null;
      this.viewModal().close();
      this.restoreModal().close();
    });
  }

  private isCurrent(templateId: string, epoch: number): boolean {
    return this.service.definition()?.templateId === templateId && this.templateEpoch === epoch;
  }

  private capabilityReason(reason: string | null | undefined): string | undefined {
    if (!reason) return undefined;
    const key = `templatesPage.header.capabilities.${reason}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : undefined;
  }

  private writeMessage(error: unknown): string {
    return error instanceof ApiError && error.status === 401
      ? writeErrorMessage(error, 'templatesPage', this.transloco)
      : this.service.translateError(this.transloco, error);
  }

  protected readonly restoringTarget = signal<TemplateVersionItem | null>(null);
  protected readonly restoreReason = signal('');
  protected readonly restoreDiscardDraft = signal(false);
  protected readonly restoreReasonError = signal<string | null>(null);
  protected readonly restoreDiscardError = signal<string | null>(null);
  protected readonly restoring = signal(false);

  protected readonly retiringTarget = signal<TemplateVersionItem | null>(null);
  protected readonly retiring = signal(false);

  protected readonly currentPublishedVersionId = computed(
    () => this.service.definition()?.currentPublishedVersion?.templateVersionId ?? null,
  );

  protected readonly canPrevPage = computed(() => this.cursorStack().length > 0);
  protected readonly canNextPage = computed(() => this.service.versionsHasNext() && !!this.service.versionsNextCursor());

  protected actionsFor(row: TemplateVersionItem): ActionItem[] {
    this.language();
    const def = this.service.definition();
    const isCurrent = row.templateVersionId === this.currentPublishedVersionId();
    const isRetired = row.lifecycleStatus === 'RETIRED';
    const isArchived = def?.lifecycleStatus === 'ARCHIVED';
    const canRestore =
      !this.service.isReadOnly() && !!def && def.capabilities.restoreVersion.state === 'ENABLED' && !isArchived && !isCurrent;
    const canRetire =
      !this.service.isReadOnly() &&
      !!def &&
      def.capabilities.retireVersion.state === 'ENABLED' &&
      !isCurrent &&
      !isRetired;

    let retireReason: string | undefined;
    if (isCurrent) {
      retireReason = this.transloco.translate('templatesPage.versions.actions.retireCurrentReason');
    } else if (isRetired) {
      retireReason = this.transloco.translate('templatesPage.versions.actions.alreadyRetiredReason');
    } else if (this.service.isReadOnly()) {
      retireReason = this.transloco.translate('templatesPage.header.capabilities.ACCESS_POLICY_READ_ONLY');
    } else {
      retireReason = this.capabilityReason(def?.capabilities.retireVersion.reason);
    }

    let restoreReason: string | undefined;
    if (isCurrent) {
      restoreReason = this.transloco.translate('templatesPage.versions.actions.restoreCurrentReason');
    } else if (isArchived) {
      restoreReason = this.transloco.translate('templatesPage.versions.actions.archivedReason');
    } else if (this.service.isReadOnly()) {
      restoreReason = this.transloco.translate('templatesPage.header.capabilities.ACCESS_POLICY_READ_ONLY');
    } else if (def && def.capabilities.restoreVersion.state !== 'ENABLED' && def.capabilities.restoreVersion.reason) {
      restoreReason = this.capabilityReason(def.capabilities.restoreVersion.reason);
    }

    return [
      {
        id: 'view',
        title: this.transloco.translate('templatesPage.versions.actions.view'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'restore',
        title: this.transloco.translate('templatesPage.versions.actions.restore'),
        icon: 'tablerArrowBackUp',
        tile: 'bg-icon-teal',
        disabled: !canRestore,
        reason: restoreReason,
      },
      {
        id: 'retire',
        title: this.transloco.translate('templatesPage.versions.actions.retire'),
        icon: 'tablerCircleOff',
        tile: 'bg-icon-orange',
        disabled: !canRetire,
        reason: retireReason,
      },
    ];
  }

  protected onAction(row: TemplateVersionItem, selection: ActionSelection): void {
    switch (selection.id) {
      case 'view':
        void this.openViewModal(row);
        break;
      case 'restore':
        this.openRestoreModal(row);
        break;
      case 'retire':
        void this.confirmRetire(row);
        break;
    }
  }

  protected async openViewModal(row: TemplateVersionItem): Promise<void> {
    const def = this.service.definition();
    if (!def) return;
    const seq = ++this.viewSeq;
    const epoch = this.templateEpoch;
    this.viewingVersion.set(null);
    this.viewingVersionNumber.set(row.versionNumber);
    this.loadingView.set(true);
    this.viewModal().open();
    try {
      const detail = await this.api.getVersion(def.templateId, row.templateVersionId);
      if (seq !== this.viewSeq || !this.isCurrent(def.templateId, epoch)) return;
      if (!detail.editorDocument || detail.editorSchemaVersion !== 1 ||
          typeof detail.nodeRegistryVersion !== 'string' || typeof detail.compilerVersion !== 'string' ||
          typeof detail.validationRunId !== 'string' || !Array.isArray(detail.rendererTargets) ||
          !Array.isArray(detail.bindingManifest) || !Array.isArray(detail.assetManifest)) {
        throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
      }
      this.viewingVersion.set(detail);
    } catch (error) {
      if (seq !== this.viewSeq || !this.isCurrent(def.templateId, epoch)) return;
      this.viewModal().close();
      this.notify.error(this.service.translateError(this.transloco, error));
    } finally {
      if (seq === this.viewSeq) {
        this.loadingView.set(false);
      }
    }
  }

  protected openRestoreModal(row: TemplateVersionItem): void {
    if (row.templateVersionId === this.currentPublishedVersionId()) return;
    this.restoringTarget.set(row);
    this.pendingRestore = null;
    this.restoreReason.set('');
    this.restoreDiscardDraft.set(false);
    this.restoreReasonError.set(null);
    this.restoreDiscardError.set(null);
    this.restoreModal().open();
  }

  protected onRestoreReasonInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.restoreReason.set(value);
    if (this.restoreReasonError() && value.trim().length > 0) {
      this.restoreReasonError.set(null);
    }
  }

  protected onDiscardCheckedChange(checked: boolean): void {
    this.restoreDiscardDraft.set(checked);
    if (checked && this.restoreDiscardError()) {
      this.restoreDiscardError.set(null);
    }
  }

  protected async submitRestore(): Promise<void> {
    const def = this.service.definition();
    const target = this.restoringTarget();
    if (!def || !target || this.restoring()) return;

    const reason = this.restoreReason().trim();
    let invalid = false;
    if (!reason) {
      this.restoreReasonError.set(this.transloco.translate('templatesPage.versions.restoreModal.reasonRequired'));
      invalid = true;
    }
    if (!this.restoreDiscardDraft()) {
      this.restoreDiscardError.set(this.transloco.translate('templatesPage.versions.restoreModal.discardRequired'));
      invalid = true;
    }
    if (invalid) return;

    const draftEtag = this.service.draft()?.etag ?? def.currentDraft.etag;
    const epoch = this.templateEpoch;
    const signature = JSON.stringify([def.templateId, target.templateVersionId, draftEtag, reason]);
    if (this.pendingRestore?.signature !== signature) {
      this.pendingRestore = { signature, key: newIdempotencyKey() };
    }
    this.restoring.set(true);
    try {
      const result = await this.api.restoreVersion(
        def.templateId,
        target.templateVersionId,
        { reason, discardCurrentDraft: true },
        draftEtag,
        this.pendingRestore.key,
      );
      if (!this.isCurrent(def.templateId, epoch)) return;
      this.pendingRestore = null;
      this.service.syncExternalDraft({ ...result.data.draft, etag: result.etag ?? result.data.draft.etag });
      const [freshDef, snapshotsPage] = await Promise.allSettled([
        this.api.getTemplate(def.templateId),
        this.api.listRecoverySnapshots(def.templateId, { limit: 20 }),
      ]);
      if (!this.isCurrent(def.templateId, epoch)) return;
      if (freshDef.status === 'fulfilled') {
        this.service.syncFromDefinition(freshDef.value, this.service.overviewDirty());
      }
      if (snapshotsPage.status === 'fulfilled') {
        this.service.snapshots.set(snapshotsPage.value.items);
      }
      const failed = [freshDef, snapshotsPage].find(item => item.status === 'rejected');
      if (failed?.status === 'rejected') this.notify.error(this.service.translateError(this.transloco, failed.reason));
      this.restoreModal().close();
      this.notify.success(
        this.transloco.translate('templatesPage.versions.restoreModal.restoredToast', {
          version: target.versionNumber,
        }),
      );
    } catch (error) {
      if (!this.isCurrent(def.templateId, epoch)) return;
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) this.pendingRestore = null;
      const { status, code } = errorDetailsOf(error);
      if (status === 409 && code === 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION') {
        this.restoreModal().close();
        this.service.openConflict();
      } else {
        this.notify.error(this.writeMessage(error));
      }
    } finally {
      if (this.isCurrent(def.templateId, epoch)) this.restoring.set(false);
    }
  }

  protected async confirmRetire(row: TemplateVersionItem): Promise<void> {
    const def = this.service.definition();
    if (!def || this.retiring()) return;
    if (row.templateVersionId === this.currentPublishedVersionId() || row.lifecycleStatus === 'RETIRED') return;

    this.retiringTarget.set(row);
    const epoch = this.templateEpoch;
    const confirmed = await this.retireConfirm().open();
    if (!confirmed || !this.isCurrent(def.templateId, epoch) || this.retiring()) return;

    const signature = JSON.stringify([def.templateId, row.templateVersionId, def.etag]);
    if (this.pendingRetire?.signature !== signature) this.pendingRetire = { signature, key: newIdempotencyKey() };
    this.retiring.set(true);
    try {
      const result = await this.api.retireVersion(def.templateId, row.templateVersionId, def.etag, this.pendingRetire.key);
      if (!this.isCurrent(def.templateId, epoch)) return;
      this.pendingRetire = null;
      const res = result.data;
      this.service.versions.update((list) =>
        list.map((item) => (item.templateVersionId === res.version.templateVersionId ? res.version : item)),
      );
      this.service.syncFromDefinition({ ...def, revision: res.definitionRevision, etag: result.etag ?? res.definitionEtag }, this.service.overviewDirty());
      try {
        const freshDef = await this.api.getTemplate(def.templateId);
        if (!this.isCurrent(def.templateId, epoch)) return;
        this.service.syncFromDefinition(freshDef, this.service.overviewDirty());
      } catch (error) {
        if (!this.isCurrent(def.templateId, epoch)) return;
        this.notify.error(this.service.translateError(this.transloco, error));
      }
      this.notify.success(
        this.transloco.translate('templatesPage.versions.retireConfirm.retiredToast', {
          version: row.versionNumber,
        }),
      );
    } catch (error) {
      if (!this.isCurrent(def.templateId, epoch)) return;
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) this.pendingRetire = null;
      const { status, code } = errorDetailsOf(error);
      if (status === 409 && code === 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION') {
        this.service.openConflict();
      } else {
        this.notify.error(this.writeMessage(error));
      }
    } finally {
      if (this.isCurrent(def.templateId, epoch)) this.retiring.set(false);
    }
  }

  protected async nextPage(): Promise<void> {
    const def = this.service.definition();
    const nextCursor = this.service.versionsNextCursor();
    if (!def || !nextCursor || this.paging()) return;

    const prevCursor = this.currentCursor();
    await this.loadPage(def.templateId, nextCursor, [...this.cursorStack(), prevCursor]);
  }

  protected async prevPage(): Promise<void> {
    const def = this.service.definition();
    const stack = this.cursorStack();
    if (!def || stack.length === 0 || this.paging()) return;

    const targetCursor = stack[stack.length - 1] ?? null;
    await this.loadPage(def.templateId, targetCursor, stack.slice(0, -1));
  }

  private async loadPage(templateId: string, cursor: string | null, nextStack: (string | null)[]): Promise<void> {
    const epoch = this.templateEpoch;
    this.paging.set(true);
    try {
      const page = await this.api.listVersions(templateId, { cursor, limit: 25 });
      if (!this.isCurrent(templateId, epoch)) return;
      this.service.versions.set(page.items);
      this.service.versionsHasNext.set(page.pageInfo.hasNextPage);
      this.service.versionsNextCursor.set(page.pageInfo.nextCursor);
      this.currentCursor.set(cursor);
      this.cursorStack.set(nextStack);
    } catch (error) {
      if (!this.isCurrent(templateId, epoch)) return;
      this.notify.error(this.service.translateError(this.transloco, error));
      if (cursor && error instanceof ApiError && error.code === 'CORE.TEMPLATE.CURSOR.INVALID') {
        await this.loadPage(templateId, null, []);
      }
    } finally {
      if (this.isCurrent(templateId, epoch)) this.paging.set(false);
    }
  }
}
