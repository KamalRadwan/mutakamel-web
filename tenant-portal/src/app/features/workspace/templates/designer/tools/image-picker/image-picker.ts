import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { ApiError, errorMessage } from '../../../../../../core/api/api-errors';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerExternalLink, tablerPhoto, tablerRefresh, tablerSearch, tablerX } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Notify } from '../../../../../../core/notify/notify';
import { Button } from '../../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../../shared/ui/checkbox/checkbox';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../../shared/ui/segmented/segmented';
import {
  TemplateAssetDto,
  TemplateAssetType,
} from '../../../templates.model';
import { AssetsApi } from '../../../assets/assets.api';
import { DesignerState } from '../../designer-state';
import { clamp, printableRectMm, roundMm } from '../../geometry';

type AssetTypeFilter = 'ALL' | TemplateAssetType;

const ALT_MAX_LENGTH = 500;
const SEARCH_MAX_LENGTH = 100;
const PAGE_LIMIT = 12;

@Component({
  selector: 'app-tpl-image-picker',
  imports: [NgIcon, TranslocoPipe, Button, Checkbox, Field, Modal, Segmented],
  providers: [
    provideIcons({
      tablerPhoto,
      tablerSearch,
      tablerX,
      tablerExternalLink,
      tablerRefresh,
    }),
  ],
  templateUrl: './image-picker.html',
})
export class ImagePicker {
  private static nextId = 0;
  protected readonly uid = `tpl-image-picker-${++ImagePicker.nextId}`;

  private readonly api = inject(AssetsApi);
  private readonly state = inject(DesignerState);
  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);
  private readonly destroyRef = inject(DestroyRef);

  private readonly modal = viewChild.required(Modal);

  protected readonly mode = signal<'insert' | 'replace'>('insert');
  private targetNodeId: string | null = null;

  protected readonly search = signal('');
  protected readonly assetType = signal<AssetTypeFilter>('ALL');

  protected readonly items = signal<TemplateAssetDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly loadError = signal(false);
  protected readonly hasNextPage = signal(false);
  private nextCursor: string | null = null;

  protected readonly selectedAssetId = signal<string | null>(null);
  private readonly selectedAsset = signal<TemplateAssetDto | null>(null);
  protected readonly alt = signal('');
  protected readonly decorative = signal(false);
  private readonly altTouched = signal(false);

  protected readonly blobUrls = signal<Readonly<Record<string, string>>>({});
  private readonly pendingBlobs = new Set<string>();
  private readonly ownedUrls: string[] = [];

  private fetchSeq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly skeletonCards = [1, 2, 3];

  protected readonly typeOptions = computed<SegmentedOption[]>(() => {
    this.language();
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('tplTools.image.all') },
      { value: 'LOGO', label: this.transloco.translate('tplTools.image.logos') },
      { value: 'IMAGE', label: this.transloco.translate('tplTools.image.images') },
      { value: 'BACKGROUND', label: this.transloco.translate('tplTools.image.backgrounds') },
    ];
  });

  protected readonly altError = computed<string | null>(() => {
    this.language();
    this.i18n();
    if (this.decorative()) return null;
    if (this.alt().length > ALT_MAX_LENGTH) {
      return this.transloco.translate('tplTools.image.altRequired');
    }
    if (this.altTouched() && !this.alt().trim()) {
      return this.transloco.translate('tplTools.image.altRequired');
    }
    return null;
  });

  protected readonly canConfirm = computed(() => {
    if (!this.selectedAssetId()) return false;
    if (this.decorative()) return true;
    const trimmed = this.alt().trim();
    return trimmed.length > 0 && this.alt().length <= ALT_MAX_LENGTH;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.searchTimer !== null) {
        clearTimeout(this.searchTimer);
      }
      for (const url of this.ownedUrls) {
        URL.revokeObjectURL(url);
      }
      this.ownedUrls.length = 0;
    });
  }

  openInsert(): void {
    this.mode.set('insert');
    this.targetNodeId = null;
    this.resetCommonState(null, '', false);
    this.modal().open();
    void this.fetchAssets(true);
  }

  openReplace(opts: { nodeId: string; assetId: string; alt: string; decorative: boolean }): void {
    this.mode.set('replace');
    this.targetNodeId = opts.nodeId;
    this.resetCommonState(opts.assetId, opts.decorative ? '' : opts.alt, opts.decorative);
    this.modal().open();
    void this.fetchAssets(true);
  }

  close(): void {
    this.modal().close();
  }

  protected onSearchInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value.slice(0, SEARCH_MAX_LENGTH);
    this.search.set(next);
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      void this.fetchAssets(true);
    }, 180);
  }

  protected clearSearch(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.search.set('');
    void this.fetchAssets(true);
  }

  protected onSearchEscape(event: Event): void {
    if (!this.search()) return;
    event.stopPropagation();
    this.clearSearch();
  }

  protected onTypeChange(next: string | null): void {
    if (next !== 'ALL' && next !== 'LOGO' && next !== 'IMAGE' && next !== 'BACKGROUND') return;
    if (next === this.assetType()) return;
    this.assetType.set(next);
    void this.fetchAssets(true);
  }

  protected selectAsset(asset: TemplateAssetDto): void {
    this.selectedAssetId.set(asset.assetId);
    this.selectedAsset.set(asset);
  }

  protected onAltInput(event: Event): void {
    this.alt.set((event.target as HTMLInputElement).value);
    this.altTouched.set(true);
  }

  protected markAltTouched(): void {
    this.altTouched.set(true);
  }

  protected onDecorativeChange(checked: boolean): void {
    this.decorative.set(checked);
    if (checked) {
      this.alt.set('');
      this.altTouched.set(false);
    }
  }

  protected retryLoad(): void {
    void this.fetchAssets(true);
  }

  protected loadMore(): void {
    if (!this.hasNextPage() || this.loadingMore() || this.loading()) return;
    void this.fetchAssets(false);
  }

  protected formatMime(mimeType: string): 'PNG' | 'JPEG' | 'WEBP' {
    const lower = mimeType.toLowerCase();
    if (lower.includes('webp')) return 'WEBP';
    return lower.includes('jpeg') || lower.includes('jpg') ? 'JPEG' : 'PNG';
  }

  protected previewUrl(assetId: string): string | null {
    return this.blobUrls()[assetId] ?? null;
  }

  protected confirm(): void {
    this.altTouched.set(true);
    const assetId = this.selectedAssetId();
    if (!assetId || !this.canConfirm()) return;

    const decorative = this.decorative();
    const alt = decorative ? '' : this.alt().trim();

    if (this.mode() === 'replace' && this.targetNodeId) {
      const existing = this.state.document()?.nodes[this.targetNodeId];
      if (existing?.type === 'image') {
        this.state.updateNode(existing.id, {
          props: {
            ...existing.props,
            assetId,
            alt,
            decorative,
          },
        });
        this.state.requestAsset(assetId);
      }
      this.close();
      return;
    }

    const asset = this.selectedAsset() ?? this.items().find((item) => item.assetId === assetId) ?? null;
    const isFixed = this.state.layoutMode() === 'FIXED_CANVAS';
    const page = this.state.currentPage();

    let layout:
      | {
          kind: 'ABSOLUTE';
          unit: 'MM';
          x: number;
          y: number;
          width: number;
          height: number;
          rotationDeg: number;
          zIndex: number;
        }
      | undefined;

    if (isFixed && page) {
      const printable = printableRectMm(page);
      const hasDims = Boolean(asset && asset.widthPx > 0 && asset.heightPx > 0);
      let width = printable.width > 0 ? Math.min(40, printable.width) : 40;
      let height = hasDims && asset ? (width * asset.heightPx) / asset.widthPx : 20;
      if (printable.height > 0 && height > printable.height) {
        const scale = printable.height / height;
        height = printable.height;
        width = width * scale;
      }
      width = clamp(roundMm(width), 1, 500);
      height = clamp(roundMm(height), 1, 1000);
      const x = clamp(roundMm(printable.x + (printable.width - width) / 2), 0, 500);
      const y = clamp(roundMm(printable.y + (printable.height - height) / 2), 0, 1000);

      layout = {
        kind: 'ABSOLUTE',
        unit: 'MM',
        x,
        y,
        width,
        height,
        rotationDeg: 0,
        zIndex: 1,
      };
    }

    this.state.insertNode({
      type: 'image',
      props: {
        assetId,
        alt,
        decorative,
      },
      style: {
        objectFit: 'CONTAIN',
      },
      ...(layout ? { layout } : {}),
    });
    this.state.requestAsset(assetId);
    this.close();
  }

  private resetCommonState(assetId: string | null, alt: string, decorative: boolean): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.search.set('');
    this.assetType.set('ALL');
    this.selectedAssetId.set(assetId);
    this.selectedAsset.set(null);
    this.alt.set(alt);
    this.decorative.set(decorative);
    this.altTouched.set(false);
    this.items.set([]);
    this.hasNextPage.set(false);
    this.nextCursor = null;
    this.loadError.set(false);
  }

  private async fetchAssets(reset: boolean): Promise<void> {
    const seq = ++this.fetchSeq;
    const term = this.search().trim().slice(0, SEARCH_MAX_LENGTH);
    const type = this.assetType();
    const isEmail = this.state.channel() === 'EMAIL' || this.state.layoutMode() === 'EMAIL_FLOW';

    if (reset) {
      this.loading.set(true);
      this.loadingMore.set(false);
      this.loadError.set(false);
      this.nextCursor = null;
    } else {
      this.loadingMore.set(true);
    }

    try {
      const page = await this.api.listAssets({
        scope: 'ALL_AUTHORIZED',
        status: 'ACTIVE',
        ...(isEmail ? { deliveryClass: 'EMAIL_PUBLIC' as const } : {}),
        ...(type !== 'ALL' ? { assetType: type } : {}),
        ...(term ? { search: term } : {}),
        cursor: reset ? null : this.nextCursor,
        limit: PAGE_LIMIT,
      });
      if (seq !== this.fetchSeq) return;

      const nextList = reset ? page.items : [...this.items(), ...page.items];
      this.items.set(nextList);
      this.hasNextPage.set(page.pageInfo.hasNextPage);
      this.nextCursor = page.pageInfo.nextCursor;
      this.loadError.set(false);

      const selId = this.selectedAssetId();
      if (selId && !this.selectedAsset()) {
        const matched = nextList.find((item) => item.assetId === selId);
        if (matched) this.selectedAsset.set(matched);
      }

      for (const asset of page.items) {
        void this.ensureBlob(asset.assetId);
      }
    } catch (error) {
      if (seq !== this.fetchSeq) return;
      if (!reset && error instanceof ApiError && error.code === 'CORE.TEMPLATE.CURSOR.INVALID') {
        void this.fetchAssets(true);
        return;
      }
      if (reset) {
        this.items.set([]);
        this.hasNextPage.set(false);
        this.loadError.set(true);
      } else {
        this.notify.error(this.resolveLoadError(error));
      }
    } finally {
      if (seq === this.fetchSeq) {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    }
  }

  private resolveLoadError(error: unknown): string {
    const msg = errorMessage(error, 'templates', this.transloco);
    if (msg && !msg.startsWith('settings.errors.') && !msg.startsWith('apiErrors.')) {
      return msg;
    }
    return this.transloco.translate('tplTools.image.loadFailed');
  }

  private async ensureBlob(assetId: string): Promise<void> {
    if (this.blobUrls()[assetId] || this.pendingBlobs.has(assetId)) return;
    this.pendingBlobs.add(assetId);
    try {
      const blob = await this.api.getAssetContent(assetId);
      if (this.destroyRef.destroyed) return;
      const url = URL.createObjectURL(blob);
      this.ownedUrls.push(url);
      this.blobUrls.update((map) => ({ ...map, [assetId]: url }));
    } catch {
      // Leave fallback photo icon when preview content cannot load.
    } finally {
      this.pendingBlobs.delete(assetId);
    }
  }
}
