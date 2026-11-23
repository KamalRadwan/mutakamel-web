import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerLoader2, tablerPhoto, tablerPhotoUp } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { ApiError } from '../../../../../core/api/api-errors';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { FileDrop } from '../../../../../shared/ui/file-drop/file-drop';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { BrandingApi } from '../branding.api';
import {
  BRANDING_ASSET_LIMITS,
  BRANDING_MIME_TYPES,
  Branding,
  BrandingAssetKind,
  brandingErrorKey,
  readImageSize,
} from '../branding.model';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

@Component({
  selector: 'app-branding-upload-modal',
  imports: [TranslocoPipe, NgIcon, Button, Field, FileDrop, Modal],
  providers: [provideIcons({ tablerPhotoUp, tablerPhoto, tablerLoader2 })],
  templateUrl: './branding-upload-modal.html',
})
export class BrandingUploadModal {
  private static nextId = 0;
  protected readonly uid = `branding-upload-${++BrandingUploadModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly api = inject(BrandingApi);
  private readonly modal = viewChild.required(Modal);

  readonly saved = output<{ kind: BrandingAssetKind; branding: Branding }>();
  readonly canManage = input(false);
  readonly tenantWideRequired = output<void>();

  protected readonly kind = signal<BrandingAssetKind>('logo');
  protected readonly currentUrl = signal<string | null>(null);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly dimensions = signal<{ width: number; height: number } | null>(null);
  protected readonly inspecting = signal(false);
  protected readonly clientErrorKey = signal<string | null>(null);
  private readonly serverError = signal<unknown>(null);

  private readonly uploadingState = signal(false);
  readonly uploading = this.uploadingState.asReadonly();
  readonly activeKind = this.kind.asReadonly();

  protected readonly acceptTypes = BRANDING_MIME_TYPES.join(',');
  protected readonly limits = computed(() => BRANDING_ASSET_LIMITS[this.kind()]);
  protected readonly limitsHintKey = computed(() =>
    this.kind() === 'logo' ? 'wsBranding.asset.logo.limits' : 'wsBranding.asset.icon.limits',
  );
  protected readonly activeError = computed(() => {
    this.i18n();
    const clientKey = this.clientErrorKey();
    if (clientKey) return this.transloco.translate(clientKey);
    return this.serverError() ? brandingErrorKey(this.serverError(), this.transloco) : null;
  });
  protected readonly fileSizeLabel = computed(() => {
    const file = this.selectedFile();
    return file ? formatFileSize(file.size) : '';
  });
  protected readonly canUpload = computed(
    () =>
      this.canManage() &&
      !this.uploading() &&
      !this.inspecting() &&
      this.selectedFile() !== null &&
      this.clientErrorKey() === null,
  );

  private uploadKey: string | null = null;
  private previewObjectUrl: string | null = null;
  private inspectSeq = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revokePreviewUrl());
  }

  open(kind: BrandingAssetKind, currentUrl: string | null): void {
    if (!this.canManage() || this.uploading()) return;
    this.kind.set(kind);
    this.currentUrl.set(currentUrl);
    this.resetSelection();
    this.uploadingState.set(false);
    this.modal().open();
  }

  protected onFilePicked(file: File): void {
    if (this.uploading()) return;
    const seq = ++this.inspectSeq;
    const activeKind = this.kind();
    const kindLimits = BRANDING_ASSET_LIMITS[activeKind];

    this.resetSelectionState();
    this.inspecting.set(true);

    if (file.size === 0) {
      this.inspecting.set(false);
      this.clientErrorKey.set('wsBranding.upload.errors.fileRequired');
      return;
    }

    if (!BRANDING_MIME_TYPES.includes(file.type)) {
      this.inspecting.set(false);
      this.clientErrorKey.set('wsBranding.upload.errors.typeUnsupported');
      return;
    }

    if (file.size > kindLimits.maxBytes) {
      this.inspecting.set(false);
      this.clientErrorKey.set(
        activeKind === 'logo'
          ? 'wsBranding.upload.errors.logoTooLarge'
          : 'wsBranding.upload.errors.iconTooLarge',
      );
      return;
    }

    void this.inspectImageFile(file, activeKind, kindLimits.maxEdge, seq);
  }

  protected onFileRejected(reason: 'type' | 'size'): void {
    if (this.uploading()) return;
    ++this.inspectSeq;
    this.resetSelectionState();
    this.inspecting.set(false);

    if (reason === 'type') {
      this.clientErrorKey.set('wsBranding.upload.errors.typeUnsupported');
      return;
    }
    this.clientErrorKey.set(
      this.kind() === 'logo'
        ? 'wsBranding.upload.errors.logoTooLarge'
        : 'wsBranding.upload.errors.iconTooLarge',
    );
  }

  protected async confirmUpload(): Promise<void> {
    const file = this.selectedFile();
    if (!file || !this.canUpload()) return;

    const activeKind = this.kind();
    const key = this.uploadKey ?? newIdempotencyKey();
    this.uploadKey = key;

    this.serverError.set(null);
    this.uploadingState.set(true);

    try {
      const branding =
        activeKind === 'logo'
          ? await this.api.uploadBrandingLogo(file, key)
          : await this.api.uploadBrandingIcon(file, key);

      this.notify.success(this.transloco.translate('wsBranding.upload.success'));
      this.saved.emit({ kind: activeKind, branding });
      this.uploadingState.set(false);
      this.modal().close();
    } catch (error) {
      this.uploadingState.set(false);
      if (
        error instanceof ApiError &&
        (error.status === 413 ||
          error.status === 415 ||
          [
            'BRANDING_FILE_REQUIRED',
            'BRANDING_FILE_INVALID',
            'BRANDING_FILE_TYPE_UNSUPPORTED',
            'BRANDING_FILE_TOO_LARGE',
          ].includes(error.code))
      ) {
        this.serverError.set(error);
      } else {
        this.notify.error(brandingErrorKey(error, this.transloco));
      }
      if (error instanceof ApiError && error.code === 'BRANDING_IDEMPOTENCY_CONFLICT')
        this.uploadKey = null;
      if (error instanceof ApiError && error.code === 'TENANT_WIDE_PERMISSION_REQUIRED') {
        this.tenantWideRequired.emit();
        this.modal().close();
      }
    }
  }

  protected cancel(): void {
    if (this.uploading()) return;
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (this.uploading()) {
      this.modal().open();
      return;
    }
    ++this.inspectSeq;
    this.resetSelection();
  }

  private async inspectImageFile(
    file: File,
    activeKind: BrandingAssetKind,
    maxEdge: number,
    seq: number,
  ): Promise<void> {
    try {
      const size = await readImageSize(file);
      if (seq !== this.inspectSeq) return;

      if (size.width > maxEdge || size.height > maxEdge) {
        this.clientErrorKey.set(
          activeKind === 'logo'
            ? 'wsBranding.upload.errors.dimensionsLogo'
            : 'wsBranding.upload.errors.dimensionsIcon',
        );
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      this.revokePreviewUrl();
      this.previewObjectUrl = objectUrl;
      this.selectedFile.set(file);
      this.previewUrl.set(objectUrl);
      this.dimensions.set(size);
      this.uploadKey = newIdempotencyKey();
    } catch {
      if (seq !== this.inspectSeq) return;
      this.clientErrorKey.set('wsBranding.upload.errors.unreadable');
    } finally {
      if (seq === this.inspectSeq) {
        this.inspecting.set(false);
      }
    }
  }

  private resetSelection(): void {
    this.inspecting.set(false);
    this.resetSelectionState();
  }

  private resetSelectionState(): void {
    this.revokePreviewUrl();
    this.selectedFile.set(null);
    this.previewUrl.set(null);
    this.dimensions.set(null);
    this.clientErrorKey.set(null);
    this.serverError.set(null);
    this.uploadKey = null;
  }

  private revokePreviewUrl(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
  }
}
