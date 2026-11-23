import { Component, DestroyRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { ApiError, isRetryableWriteError } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { AssetsApi } from '../assets.api';
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
} from '../../templates.model';
import {
  assetTypeTile,
  formatAssetDate,
  formatByteSize,
  formatStoredMime,
  translateAssetError,
} from '../assets.service';

@Component({
  selector: 'app-asset-detail-modal',
  imports: [TranslocoPipe, NgIcon, Button, ConfirmDialog, Field, Modal, FullState, ConflictDialog],
  providers: [provideIcons({ tablerPhoto, tablerLoader2 })],
  viewProviders: [provideTranslocoScope('templates', { scope: 'templates-assets', alias: 'templatesAssets' })],
  templateUrl: './asset-detail-modal.html',
})
export class AssetDetailModal {
  private readonly api = inject(AssetsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);
  private readonly retireConfirm = viewChild.required(ConfirmDialog);

  readonly canManage = input(false);
  readonly templateNames = input<ReadonlyMap<string, string>>(new Map());
  readonly retired = output<TemplateAssetDto>();

  protected readonly asset = signal<TemplateAssetDto | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly loadingDetail = signal(false);
  protected readonly retiring = signal(false);
  protected readonly detailError = signal<ApiError | null>(null);
  protected readonly conflictOpen = signal(false);
  private retireAttempt: { etag: string; key: string } | null = null;

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
    this.detailError.set(null);
    this.retireAttempt = null;
    this.modal().open();

    void this.refreshDetail(asset, sharedPreviewUrl, seq);
  }

  protected async requestRetire(): Promise<void> {
    const current = this.asset();
    if (!current || !this.canManage() || this.retiring() || current.status === 'RETIRED') return;

    const confirmed = await this.retireConfirm().open();
    if (!confirmed) return;

    this.retiring.set(true);
    if (this.retireAttempt?.etag !== current.etag) this.retireAttempt = { etag: current.etag, key: newIdempotencyKey() };
    try {
      await this.api.retireAsset(current.assetId, current.etag, this.retireAttempt.key);
      this.retireAttempt = null;
      this.retired.emit(current);
      this.notify.success(this.transloco.translate('templatesAssets.toasts.retired'));
      this.modal().close();
    } catch (error) {
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) this.retireAttempt = null;
      if (error instanceof ApiError && error.status === 404) {
        this.retired.emit(current);
        this.modal().close();
      } else if (error instanceof ApiError && error.status === 409 && !error.code.endsWith('ASSET.IN_USE') && !error.code.includes('IN_FLIGHT')) {
        this.conflictOpen.set(true);
      } else {
        this.notify.error(translateAssetError(error, this.transloco, true));
      }
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

  protected async resolveRetireConflict(keep: boolean): Promise<void> {
    this.conflictOpen.set(false);
    const current = this.asset();
    if (!current) return;
    if (!keep) { this.openAsset(current, null); return; }
    try {
      this.asset.set((await this.api.getAsset(current.assetId)).asset);
    } catch (error) {
      this.notify.error(translateAssetError(error, this.transloco));
    }
  }

  protected retryDetail(): void {
    const current = this.asset();
    if (current) this.openAsset(current, null);
  }

  private async refreshDetail(asset: TemplateAssetDto, sharedPreviewUrl: string | null, seq: number): Promise<void> {
    try {
      const detail = await this.api.getAsset(asset.assetId);
      if (seq !== this.loadSeq || this.destroyRef.destroyed) return;
      this.asset.set(detail.asset);

      if (detail.delivery.kind === 'UNAVAILABLE') {
        this.previewUrl.set(null);
      } else if (!sharedPreviewUrl) {
        const blob = await this.api.getAssetContent(detail.asset.assetId);
        if (seq !== this.loadSeq || this.destroyRef.destroyed) return;
        this.revokeOwnedUrl();
        this.ownedObjectUrl = URL.createObjectURL(blob);
        this.previewUrl.set(this.ownedObjectUrl);
      }
    } catch (error) {
      if (seq !== this.loadSeq || this.destroyRef.destroyed) return;
      this.previewUrl.set(null);
      this.detailError.set(error instanceof ApiError ? error : new ApiError(500, 'COMMON.GENERIC.INTERNAL_ERROR'));
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
