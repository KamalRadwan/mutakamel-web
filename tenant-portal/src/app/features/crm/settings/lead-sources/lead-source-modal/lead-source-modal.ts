import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { ApiError, errorCodeOf, fieldErrorsOf, isValidationError } from '../../../../../core/api/api-errors';
import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { FormField, disabled, form, maxLengthError, readonly, requiredError, submit, validate } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerLoader2, tablerTrendingUp } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { FileDrop } from '../../../../../shared/ui/file-drop/file-drop';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { createLeadSource, updateLeadSource, uploadLeadSourceIcon } from '../lead-sources.api';
import {
  LEAD_SOURCE_ICON_ACCEPT,
  LEAD_SOURCE_ICON_MAX_BYTES,
  LEAD_SOURCE_NAME_MAX,
  LeadSource,
  UpdateLeadSourceInput,
  keepSourceWriteKey,
  sourceError,
  translateSourceError,
} from '../lead-sources.model';

interface LeadSourceDraft {
  nameAr: string;
  nameEn: string;
  isActive: boolean;
}

const EMPTY_DRAFT: LeadSourceDraft = { nameAr: '', nameEn: '', isActive: true };

function validateSourceName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return requiredError();
  if (Array.from(trimmed).length > LEAD_SOURCE_NAME_MAX) return maxLengthError(LEAD_SOURCE_NAME_MAX);
  return undefined;
}

@Component({
  selector: 'app-lead-source-modal',
  imports: [FormField, TranslocoPipe, NgIcon, Button, ConfirmDialog, Field, FileDrop, Modal, Switch, SettingsNotice],
  providers: [provideIcons({ tablerTrendingUp, tablerLoader2 })],
  templateUrl: './lead-source-modal.html',
})
export class LeadSourceModal {
  private static nextId = 0;
  protected readonly uid = `lead-source-modal-${++LeadSourceModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required(ConfirmDialog);
  private readonly iconSection = viewChild<ElementRef<HTMLElement>>('iconSection');

  readonly canManage = input(false);
  readonly becameReadOnly = output<void>();
  readonly reloadRequested = output<void>();
  readonly saved = output<{ source: LeadSource; isNew: boolean }>();
  readonly iconUpdated = output<LeadSource>();
  readonly deleteRequested = output<LeadSource>();

  protected readonly nameMax = LEAD_SOURCE_NAME_MAX;
  protected readonly iconAccept = LEAD_SOURCE_ICON_ACCEPT;
  protected readonly iconMaxBytes = LEAD_SOURCE_ICON_MAX_BYTES;

  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly baseSource = signal<LeadSource | null>(null);
  protected readonly uploadingIcon = signal(false);
  private readonly readOnly = signal(false);
  protected readonly canEdit = computed(() => this.canManage() && !this.readOnly());
  private readonly serverError = signal<{ error: unknown; draft: LeadSourceDraft } | null>(null);
  private readonly iconError = signal<unknown>(null);
  protected readonly iconMessage = computed(() => {
    this.i18n();
    const error = this.iconError();
    return error ? fieldErrorsOf(error)['file']?.[0] ?? translateSourceError(error, this.transloco) : null;
  });
  protected readonly brokenIconUrl = signal<string | null>(null);
  private pendingIcon: { file: File; key: string } | null = null;

  private readonly draft = signal<LeadSourceDraft>({ ...EMPTY_DRAFT });
  protected readonly sourceForm = form(this.draft, (path) => {
    validate(path.nameAr, ({ value }) => validateSourceName(value()));
    validate(path.nameEn, ({ value }) => validateSourceName(value()));
    readonly(path.nameAr, { when: () => !this.canEdit() });
    readonly(path.nameEn, { when: () => !this.canEdit() });
    disabled(path.isActive, { when: () => !this.canEdit() || this.saving() });
  });

  protected readonly saving = computed(() => this.sourceForm().submitting());
  protected readonly nameArCount = computed(() => Array.from(this.draft().nameAr).length);
  protected readonly nameEnCount = computed(() => Array.from(this.draft().nameEn).length);
  protected readonly dirty = computed(() => {
    if (!this.canEdit()) return false;
    const current = this.draft();
    if (this.mode() === 'create') {
      return current.nameAr.trim() !== '' || current.nameEn.trim() !== '';
    }
    const base = this.baseSource();
    if (!base) return false;
    return (
      current.nameAr.trim() !== base.nameAr ||
      current.nameEn.trim() !== base.nameEn ||
      current.isActive !== base.isActive
    );
  });

  private allowClose = false;
  private confirmingDiscard = false;

  openCreate(): void {
    if (!this.canEdit()) return;
    this.serverError.set(null);
    this.iconError.set(null);
    this.pendingIcon = null;
    this.allowClose = false;
    this.mode.set('create');
    this.baseSource.set(null);
    this.uploadingIcon.set(false);
    this.sourceForm().reset({ ...EMPTY_DRAFT });
    this.modal().open();
    afterNextRender(
      () => {
        this.host.nativeElement.querySelector<HTMLInputElement>(`#${this.uid}-name-ar`)?.focus();
      },
      { injector: this.injector },
    );
  }

  openEdit(source: LeadSource, options?: { focusIcon?: boolean }): void {
    this.serverError.set(null);
    this.iconError.set(null);
    this.pendingIcon = null;
    this.allowClose = false;
    this.mode.set('edit');
    this.baseSource.set(source);
    this.uploadingIcon.set(false);
    this.sourceForm().reset({
      nameAr: source.nameAr,
      nameEn: source.nameEn,
      isActive: source.isActive,
    });
    this.modal().open();
    afterNextRender(
      () => {
        if (options?.focusIcon) {
          const section = this.iconSection()?.nativeElement;
          section?.scrollIntoView({ block: 'nearest' });
          section?.querySelector<HTMLButtonElement>('button')?.focus();
        } else {
          this.host.nativeElement.querySelector<HTMLInputElement>(`#${this.uid}-name-ar`)?.focus();
        }
      },
      { injector: this.injector },
    );
  }

  closeImmediate(): void {
    this.allowClose = true;
    this.modal().close();
  }

  protected errorOf(field: 'nameAr' | 'nameEn'): string | null {
    this.i18n();
    const server = this.serverError();
    if (server && server.draft[field] === this.draft()[field]) {
      if (errorCodeOf(server.error) === 'CRM_ACQUISITION_SOURCE_NAME_TAKEN') return translateSourceError(server.error, this.transloco);
      const message = fieldErrorsOf(server.error)[field]?.[0];
      if (message) return message;
    }
    const state = this.sourceForm[field]();
    const error = state.touched() ? state.errors()[0] : undefined;
    if (!error) return null;
    if (error.kind === 'maxLength') {
      return this.transloco.translate('leadSources.validation.maxLength', { max: LEAD_SOURCE_NAME_MAX });
    }
    return this.transloco.translate(`leadSources.validation.${error.kind}`);
  }

  protected save(event?: Event): void {
    event?.preventDefault();
    if (!this.canEdit() || this.saving() || this.uploadingIcon()) return;

    void submit(this.sourceForm, async () => {
      this.serverError.set(null);
      const value = this.draft();
      const nameAr = value.nameAr.trim();
      const nameEn = value.nameEn.trim();

      try {
        if (this.mode() === 'create') {
          const created = await createLeadSource({ nameAr, nameEn });
          this.mode.set('edit');
          this.baseSource.set(created);
          this.sourceForm().reset({
            nameAr: created.nameAr,
            nameEn: created.nameEn,
            isActive: created.isActive,
          });
          this.saved.emit({ source: created, isNew: true });
          this.notify.success(this.transloco.translate('leadSources.toasts.created'));
          afterNextRender(
            () => {
              this.iconSection()?.nativeElement.querySelector<HTMLButtonElement>('button')?.focus();
            },
            { injector: this.injector },
          );
          return undefined;
        }

        const base = this.baseSource();
        if (!base) return undefined;
        const changes: UpdateLeadSourceInput = {};
        if (nameAr !== base.nameAr) changes.nameAr = nameAr;
        if (nameEn !== base.nameEn) changes.nameEn = nameEn;
        if (value.isActive !== base.isActive) changes.isActive = value.isActive;
        if (Object.keys(changes).length === 0) return undefined;

        const updated = await updateLeadSource(base.id, changes);
        this.baseSource.set(updated);
        this.sourceForm().reset({
          nameAr: updated.nameAr,
          nameEn: updated.nameEn,
          isActive: updated.isActive,
        });
        this.saved.emit({ source: updated, isNew: false });
        this.notify.success(this.transloco.translate('leadSources.toasts.saved'));
      } catch (error) {
        if (errorCodeOf(error) === 'CRM_ACQUISITION_SOURCE_NAME_TAKEN' || isValidationError(error)) {
          this.serverError.set({ error, draft: { ...value } });
          const fields = fieldErrorsOf(error);
          if (errorCodeOf(error) === 'CRM_ACQUISITION_SOURCE_NAME_TAKEN' || (!fields['_']?.length && (fields['nameAr']?.length || fields['nameEn']?.length))) return undefined;
        }
        this.writeFailed(error);
      }
      return undefined;
    });
  }

  protected undo(): void {
    this.serverError.set(null);
    const base = this.baseSource();
    if (!base) return;
    this.sourceForm().reset({
      nameAr: base.nameAr,
      nameEn: base.nameEn,
      isActive: base.isActive,
    });
  }

  protected async requestClose(): Promise<void> {
    if (this.saving() || this.uploadingIcon()) return;
    if (this.dirty() && !(await this.confirmDiscard())) return;
    this.closeImmediate();
  }

  protected requestDelete(): void {
    const base = this.baseSource();
    if (!base || !this.canEdit() || this.saving() || this.uploadingIcon()) return;
    this.deleteRequested.emit(base);
  }

  protected onModalClosed(): void {
    if (!this.allowClose && (this.saving() || this.uploadingIcon())) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
  }

  protected async onIconPicked(file: File): Promise<void> {
    const base = this.baseSource();
    if (!base || !this.canEdit() || this.saving() || this.uploadingIcon()) return;
    this.uploadingIcon.set(true);
    this.iconError.set(null);
    try {
      if (!this.pendingIcon || !(await sameIconFile(this.pendingIcon.file, file))) {
        this.pendingIcon = { file, key: newIdempotencyKey() };
      }
      const updated = await uploadLeadSourceIcon(base.id, this.pendingIcon.file, this.pendingIcon.key);
      this.pendingIcon = null;
      if (this.baseSource()?.id === updated.id) {
        this.baseSource.set(updated);
      }
      this.iconUpdated.emit(updated);
      this.notify.success(this.transloco.translate('leadSources.toasts.iconUploaded'));
    } catch (error) {
      if (!keepSourceWriteKey(error)) this.pendingIcon = null;
      if (errorCodeOf(error)?.startsWith('CRM_ACQUISITION_SOURCE_ICON_') && error instanceof ApiError && [400, 413, 415].includes(error.status)) {
        this.iconError.set(error);
      } else if (isValidationError(error) && fieldErrorsOf(error)['file']?.length) {
        this.iconError.set(error);
      } else {
        this.writeFailed(error);
      }
    } finally {
      this.uploadingIcon.set(false);
    }
  }

  protected onIconRejected(reason: 'type' | 'size'): void {
    const code =
      reason === 'type'
        ? 'CRM_ACQUISITION_SOURCE_ICON_TYPE_UNSUPPORTED'
        : 'CRM_ACQUISITION_SOURCE_ICON_TOO_LARGE';
    this.pendingIcon = null;
    this.iconError.set(new ApiError(reason === 'type' ? 415 : 413, code));
  }

  private writeFailed(error: unknown): void {
    if (sourceError(error, this.transloco).readOnly) {
      this.readOnly.set(true);
      this.becameReadOnly.emit();
    }
    this.notify.error(translateSourceError(error, this.transloco));
    if (error instanceof ApiError && error.status === 404) {
      this.closeImmediate();
      this.reloadRequested.emit();
    }
  }

  private async confirmDiscardAndClose(): Promise<void> {
    if (await this.confirmDiscard()) {
      this.closeImmediate();
    }
  }

  private async confirmDiscard(): Promise<boolean> {
    if (this.confirmingDiscard) return false;
    this.confirmingDiscard = true;
    try {
      return await this.discardDialog().open();
    } finally {
      this.confirmingDiscard = false;
    }
  }
}

async function sameIconFile(left: File, right: File): Promise<boolean> {
  if (left === right) return true;
  if (left.name !== right.name || left.type !== right.type || left.size !== right.size) return false;
  const read = (file: File) => new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
  const [a, b] = await Promise.all([read(left), read(right)]);
  const bytes = new Uint8Array(b);
  return new Uint8Array(a).every((value, index) => value === bytes[index]);
}
