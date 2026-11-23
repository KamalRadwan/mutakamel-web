import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { FormField, disabled, form, required, submit } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { ApiError, isRetryableWriteError } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { AssetsApi } from '../assets.api';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerLoader2, tablerPhoto, tablerUpload, tablerX } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { FileDrop } from '../../../../../shared/ui/file-drop/file-drop';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  TemplateAssetDeliveryClass,
  TemplateAssetDto,
  TemplateAssetType,
  TemplateListRow,
} from '../../templates.model';
import { ASSET_ACCEPT, ASSET_MAX_BYTES, canManageAssetScope, computeFileSha256, formatByteSize, prepareAssetFile, translateAssetError } from '../assets.service';

type UploadScopeValue = 'REUSABLE' | 'DEFINITION';

interface UploadAssetDraft {
  scope: UploadScopeValue;
  definitionId: string;
  assetType: TemplateAssetType;
  deliveryClass: TemplateAssetDeliveryClass | '';
  confirmPublicEmailDelivery: boolean;
}

const EMPTY_DRAFT: UploadAssetDraft = {
  scope: 'REUSABLE',
  definitionId: '',
  assetType: 'LOGO',
  deliveryClass: '',
  confirmPublicEmailDelivery: false,
};

@Component({
  selector: 'app-asset-upload-modal',
  imports: [FormField, TranslocoPipe, NgIcon, Button, Checkbox, ConfirmDialog, Dropdown, Field, FileDrop, Modal],
  providers: [provideIcons({ tablerUpload, tablerPhoto, tablerLoader2, tablerX })],
  viewProviders: [provideTranslocoScope('templates', { scope: 'templates-assets', alias: 'templatesAssets' })],
  templateUrl: './asset-upload-modal.html',
})
export class AssetUploadModal {
  private static nextId = 0;
  protected readonly uid = `asset-upload-modal-${++AssetUploadModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly api = inject(AssetsApi);
  private readonly scope = inject(TenantScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required(ConfirmDialog);

  readonly templates = input<readonly TemplateListRow[]>([]);
  readonly uploaded = output<TemplateAssetDto>();

  protected readonly accept = ASSET_ACCEPT;
  protected readonly maxBytes = ASSET_MAX_BYTES;

  private readonly initialDraft = signal<UploadAssetDraft>({ ...EMPTY_DRAFT });
  protected readonly draft = signal<UploadAssetDraft>({ ...EMPTY_DRAFT });

  protected readonly uploadForm = form(this.draft, (path) => {
    disabled(path.scope, { when: () => this.uploading() });
    disabled(path.definitionId, { when: () => this.uploading() });
    disabled(path.assetType, { when: () => this.uploading() });
    disabled(path.deliveryClass, { when: () => this.uploading() });
    disabled(path.confirmPublicEmailDelivery, { when: () => this.uploading() });

    required(path.definitionId, {
      when: ({ valueOf }) => valueOf(path.scope) === 'DEFINITION',
    });
    required(path.deliveryClass);
    required(path.confirmPublicEmailDelivery, {
      when: ({ valueOf }) => valueOf(path.deliveryClass) === 'EMAIL_PUBLIC',
    });
  });

  protected readonly uploading = computed(() => this.uploadForm().submitting());
  protected readonly file = signal<File | null>(null);
  protected readonly fileSha256 = signal('');
  protected readonly hashing = signal(false);
  protected readonly submitted = signal(false);
  protected readonly fileRejectReason = signal<'type' | 'size' | null>(null);
  protected readonly serverFileError = signal<unknown>(null);
  protected readonly serverDefinitionError = signal<unknown>(null);

  private allowClose = false;
  private confirmingDiscard = false;
  private hashSeq = 0;
  private lastFingerprint: string | null = null;
  private lastIdempotencyKey: string | null = null;

  constructor() {
    effect(() => {
      if (this.draft().scope === 'REUSABLE') {
        const defState = this.uploadForm.definitionId();
        if (defState.value() !== '' || defState.touched() || defState.dirty()) {
          untracked(() => defState.reset(''));
        }
      }
    });
    effect(() => {
      if (this.draft().deliveryClass !== 'EMAIL_PUBLIC') {
        const confirmState = this.uploadForm.confirmPublicEmailDelivery();
        if (confirmState.value() || confirmState.touched() || confirmState.dirty()) {
          untracked(() => confirmState.reset(false));
        }
      }
    });
  }

  protected readonly scopeOptions = computed<DropdownOption<UploadScopeValue>[]>(() => {
    this.i18n();
    return [
      ...(canManageAssetScope(this.scope, null) ? [{ value: 'REUSABLE' as const, label: this.transloco.translate('templatesAssets.scopes.REUSABLE') }] : []),
      ...(this.templates().length ? [{ value: 'DEFINITION' as const, label: this.transloco.translate('templatesAssets.scopes.DEFINITION') }] : []),
    ];
  });

  protected readonly templateOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const list = this.templates();
    return [
      {
        value: '',
        label: this.transloco.translate('templatesAssets.uploadModal.templatePlaceholder'),
        disabled: true,
      },
      ...list.map((tpl) => ({
        value: tpl.templateId,
        label: `${tpl.name} (${tpl.code})`,
      })),
    ];
  });

  protected readonly typeOptions = computed<DropdownOption<TemplateAssetType>[]>(() => {
    this.i18n();
    return [
      { value: 'LOGO', label: this.transloco.translate('templatesAssets.types.LOGO') },
      { value: 'IMAGE', label: this.transloco.translate('templatesAssets.types.IMAGE') },
      { value: 'BACKGROUND', label: this.transloco.translate('templatesAssets.types.BACKGROUND') },
    ];
  });

  protected readonly deliveryOptions = computed<DropdownOption<TemplateAssetDeliveryClass | ''>[]>(() => {
    this.i18n();
    return [
      {
        value: '',
        label: this.transloco.translate('templatesAssets.uploadModal.deliveryPlaceholder'),
        disabled: true,
      },
      { value: 'PRIVATE_ONLY', label: this.transloco.translate('templatesAssets.delivery.PRIVATE_ONLY') },
      { value: 'EMAIL_PUBLIC', label: this.transloco.translate('templatesAssets.delivery.EMAIL_PUBLIC') },
    ];
  });

  protected readonly templateError = computed<string | null>(() => {
    this.i18n();
    if (this.serverDefinitionError()) return translateAssetError(this.serverDefinitionError(), this.transloco);
    const state = this.uploadForm.definitionId();
    if (!state.touched() || !state.errors().length) return null;
    return this.transloco.translate('templatesAssets.validation.required');
  });

  protected readonly deliveryError = computed<string | null>(() => {
    this.i18n();
    const state = this.uploadForm.deliveryClass();
    if (!state.touched() || !state.errors().length) return null;
    return this.transloco.translate('templatesAssets.validation.required');
  });

  protected readonly confirmError = computed<string | null>(() => {
    this.i18n();
    const state = this.uploadForm.confirmPublicEmailDelivery();
    if (!state.touched() || !state.errors().length) return null;
    return this.transloco.translate('templatesAssets.validation.confirmPublicRequired');
  });

  protected readonly fileError = computed<string | null>(() => {
    this.i18n();
    const error = this.serverFileError();
    if (error instanceof ApiError && error.status === 413) return this.transloco.translate('templatesAssets.validation.fileSize');
    if (error) return translateAssetError(error, this.transloco);
    const rejected = this.fileRejectReason();
    if (rejected === 'type') return this.transloco.translate('templatesAssets.validation.fileType');
    if (rejected === 'size') return this.transloco.translate('templatesAssets.validation.fileSize');
    if (this.submitted() && !this.file()) {
      return this.transloco.translate('templatesAssets.validation.fileRequired');
    }
    return null;
  });

  protected readonly isDirty = computed(() => {
    const current = this.draft();
    const initial = this.initialDraft();
    return (
      current.scope !== initial.scope ||
      current.definitionId !== initial.definitionId ||
      current.assetType !== initial.assetType ||
      current.deliveryClass !== initial.deliveryClass ||
      current.confirmPublicEmailDelivery !== initial.confirmPublicEmailDelivery ||
      this.file() !== null
    );
  });

  open(defaults?: { scope?: UploadScopeValue; definitionId?: string }): void {
    this.allowClose = false;
    this.hashSeq++;
    this.lastFingerprint = null;
    this.lastIdempotencyKey = null;

    const initialScope = defaults?.scope ?? (canManageAssetScope(this.scope, null) ? 'REUSABLE' : 'DEFINITION');
    const initial: UploadAssetDraft = {
      scope: initialScope,
      definitionId: initialScope === 'DEFINITION' ? (defaults?.definitionId ?? '') : '',
      assetType: 'LOGO',
      deliveryClass: '',
      confirmPublicEmailDelivery: false,
    };

    this.initialDraft.set(initial);
    this.uploadForm().reset({ ...initial });
    this.file.set(null);
    this.fileSha256.set('');
    this.hashing.set(false);
    this.submitted.set(false);
    this.fileRejectReason.set(null);
    this.serverFileError.set(null);
    this.serverDefinitionError.set(null);
    this.modal().open();
  }

  protected async onFilePicked(picked: File): Promise<void> {
    const seq = ++this.hashSeq;
    this.fileRejectReason.set(null);
    this.serverFileError.set(null);
    this.file.set(null);
    this.fileSha256.set('');
    this.hashing.set(true);
    try {
      const prepared = prepareAssetFile(picked);
      this.file.set(prepared);
      const digest = await computeFileSha256(prepared);
      if (seq === this.hashSeq) {
        this.fileSha256.set(digest);
      }
    } catch (error) {
      if (seq === this.hashSeq) {
        this.file.set(null);
        this.fileSha256.set('');
        this.serverFileError.set(error);
      }
    } finally {
      if (seq === this.hashSeq) {
        this.hashing.set(false);
      }
    }
  }

  protected onFileRejected(reason: 'type' | 'size'): void {
    this.fileRejectReason.set(reason);
  }

  protected clearFile(): void {
    this.hashSeq++;
    this.file.set(null);
    this.fileSha256.set('');
    this.hashing.set(false);
    this.fileRejectReason.set(null);
    this.serverFileError.set(null);
  }

  protected formatSize(bytes: number): string {
    return formatByteSize(bytes);
  }

  protected async submit(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.uploading() || this.hashing()) return;
    this.submitted.set(true);

    await submit(this.uploadForm, async () => {
      const picked = this.file();
      const sha256 = this.fileSha256();
      const value = this.draft();
      const delivery = value.deliveryClass;
      if (!picked || !delivery || !sha256) return undefined;
      const definition = value.scope === 'DEFINITION'
        ? this.templates().find((item) => item.templateId === value.definitionId)?.definitionScope : null;
      if ((value.scope === 'DEFINITION' && !definition) || !canManageAssetScope(this.scope, definition ?? null)) return undefined;
      this.serverFileError.set(null);
      this.serverDefinitionError.set(null);

      const metadata = {
        definitionId: value.scope === 'DEFINITION' ? value.definitionId : null,
        assetType: value.assetType,
        deliveryClass: delivery,
        fileName: picked.name,
        declaredMimeType: picked.type as 'image/png' | 'image/jpeg',
        expectedRawSha256: sha256,
        ...(delivery === 'EMAIL_PUBLIC' ? { confirmPublicEmailDelivery: true as const } : {}),
      };

      const fingerprint = JSON.stringify({
        metadata,
        size: picked.size,
        lastModified: picked.lastModified,
      });
      if (fingerprint !== this.lastFingerprint || !this.lastIdempotencyKey) {
        this.lastFingerprint = fingerprint;
        this.lastIdempotencyKey = newIdempotencyKey();
      }

      try {
        const res = await this.api.uploadAsset({ metadata, file: picked }, this.lastIdempotencyKey);
        this.lastFingerprint = null;
        this.lastIdempotencyKey = null;
        this.allowClose = true;
        this.modal().close();
        this.uploaded.emit(res.asset);
        this.notify.success(this.transloco.translate('templatesAssets.toasts.uploaded'));
      } catch (error) {
        if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) {
          this.lastIdempotencyKey = null;
        }
        if (error instanceof ApiError && (error.status === 413 || [
          'CORE.TEMPLATE.ASSET.UPLOAD_INVALID', 'CORE.TEMPLATE.ASSET.CHECKSUM_MISMATCH',
          'CORE.TEMPLATE.ASSET.INVALID', 'CORE.TEMPLATE.ASSET.EMAIL_PUBLIC_NOT_ALLOWED',
        ].includes(error.code))) {
          this.serverFileError.set(error);
        } else if (error instanceof ApiError && error.status === 404) {
          this.serverDefinitionError.set(error);
          if (value.scope === 'REUSABLE') this.serverFileError.set(error);
        } else {
          this.notify.error(translateAssetError(error, this.transloco, true));
        }
      }
      return undefined;
    });
  }

  protected async requestClose(): Promise<void> {
    if (this.uploading()) return;
    if (this.isDirty() && !(await this.confirmDiscard())) return;
    this.allowClose = true;
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.uploading()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.isDirty()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
    this.lastFingerprint = null;
    this.lastIdempotencyKey = null;
  }

  private async confirmDiscardAndClose(): Promise<void> {
    if (await this.confirmDiscard()) {
      this.allowClose = true;
      this.modal().close();
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
