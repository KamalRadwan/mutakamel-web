import { Component, DestroyRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerLoader2, tablerPhoto } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  TemplateAssetDto,
  getAsset,
  getAssetContent,
  retireAsset,
} from '../../templates.api';
import {
  assetTypeTile,
  formatAssetDate,
  formatByteSize,
  formatStoredMime,
  translateAssetError,
} from '../assets.service';

@Component({
  selector: 'app-asset-detail-modal',
  imports: [TranslocoPipe, NgIcon, Button, ConfirmDialog, Field, Modal],
  providers: [provideIcons({ tablerPhoto, tablerLoader2 })],
  templateUrl: './asset-detail-modal.html',
})
export class AssetDetailModal {
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);
  private readonly retireConfirm = viewChild.required(ConfirmDialog);

  readonly canManage = input(true);
  readonly templateNames = input<ReadonlyMap<string, string>>(new Map());
  readonly retired = output<TemplateAssetDto>();

  protected readonly asset = signal<TemplateAssetDto | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly loadingDetail = signal(false);
  protected readonly retiring = signal(false);

  private ownedObjectUrl: string | null = null;
  private loadSeq = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revokeOwnedUrl());
  }

  protected readonly scopeLabel = computed(() => {
    this.i18n();
    const current = this.asset();
    if (!current) return '';
    if (!current.definitionId) {
      return this.transloco.translate('templatesAssets.scopes.REUSABLE');
    }
    return this.templateNames().get(current.definitionId) ?? this.transloco.translate('templatesAssets.scopes.DEFINITION');
  });

  protected readonly dimensionsText = computed(() => {
    const current = this.asset();
    return current ? `${current.widthPx} × ${current.heightPx} px` : '';
  });

  protected readonly storedFormatText = computed(() => {
    const current = this.asset();
    return current ? formatStoredMime(current.mimeType) : '';
  });

  protected readonly fileSizeText = computed(() => {
    const current = this.asset();
    return current ? formatByteSize(current.sizeBytes) : '';
  });

  protected readonly updatedText = computed(() => {
    const current = this.asset();
    return current ? formatAssetDate(current.updatedAt, this.language()) : '';
  });

  protected readonly tileClass = computed(() => {
    const current = this.asset();
    return current ? assetTypeTile(current.assetType) : 'bg-icon-teal';
  });

  openAsset(asset: TemplateAssetDto, sharedPreviewUrl: string | null): void {
    const seq = ++this.loadSeq;
    this.revokeOwnedUrl();
    this.asset.set(asset);
    this.previewUrl.set(asset.status === 'ACTIVE' ? sharedPreviewUrl : null);
    this.loadingDetail.set(true);
    this.retiring.set(false);
    this.modal().open();

    void this.refreshDetail(asset, sharedPreviewUrl, seq);
  }

  protected async requestRetire(): Promise<void> {
    const current = this.asset();
    if (!current || !this.canManage() || this.retiring() || current.status === 'RETIRED') return;

    const confirmed = await this.retireConfirm().open();
    if (!confirmed) return;

    this.retiring.set(true);
    try {
      await retireAsset(current.assetId, current.etag);
      this.retired.emit(current);
      this.notify.success(this.transloco.translate('templatesAssets.toasts.retired'));
      this.modal().close();
    } catch (error) {
      this.notify.error(translateAssetError(error, this.transloco));
    } finally {
      this.retiring.set(false);
    }
  }

  protected closeModal(): void {
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.loadSeq++;
    this.revokeOwnedUrl();
  }

  private async refreshDetail(asset: TemplateAssetDto, sharedPreviewUrl: string | null, seq: number): Promise<void> {
    try {
      const detail = await getAsset(asset.assetId);
      if (seq !== this.loadSeq) return;
      this.asset.set(detail.asset);

      if (detail.delivery.kind === 'UNAVAILABLE') {
        this.previewUrl.set(null);
      } else if (!sharedPreviewUrl) {
        const blob = await getAssetContent(detail.asset.assetId);
        if (seq !== this.loadSeq) return;
        this.revokeOwnedUrl();
        this.ownedObjectUrl = URL.createObjectURL(blob);
        this.previewUrl.set(this.ownedObjectUrl);
      }
    } catch {
      // Keep the list projection loaded when detail refresh fails.
    } finally {
      if (seq === this.loadSeq) {
        this.loadingDetail.set(false);
      }
    }
  }

  private revokeOwnedUrl(): void {
    if (this.ownedObjectUrl) {
      URL.revokeObjectURL(this.ownedObjectUrl);
      this.ownedObjectUrl = null;
    }
  }
}
