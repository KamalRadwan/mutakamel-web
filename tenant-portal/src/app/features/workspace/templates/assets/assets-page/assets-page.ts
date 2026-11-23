import { Component, DestroyRef, computed, effect, inject, resource, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerChevronLeft,
  tablerChevronRight,
  tablerLayoutGrid,
  tablerLock,
  tablerPhoto,
  tablerRefresh,
  tablerSearch,
  tablerTable,
  tablerUpload,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { ViewOption, ViewSwitcher } from '../../../../../shared/ui/view-switcher/view-switcher';
import {
  TemplateApiError,
  TemplateAssetDeliveryClass,
  TemplateAssetDto,
  TemplateAssetQueryScope,
  TemplateAssetSort,
  TemplateAssetStatus,
  TemplateAssetType,
  TemplateAssetsListQuery,
  TemplateListRow,
  getAssetContent,
  listAssets,
  listTemplates,
  retireAsset,
} from '../../templates.api';
import { AssetDetailModal } from '../asset-detail-modal/asset-detail-modal';
import { AssetUploadModal } from '../asset-upload-modal/asset-upload-modal';
import {
  assetTypeTile,
  formatAssetDate,
  formatByteSize,
  formatStoredMime,
  translateAssetError,
} from '../assets.service';

const CAN_MANAGE = true; // later from the session permissions

type AssetViewMode = 'cards' | 'table';
type TypeFilterValue = TemplateAssetType | 'ALL';
type DeliveryFilterValue = TemplateAssetDeliveryClass | 'ALL';
type StatusFilterValue = TemplateAssetStatus | 'ALL';

@Component({
  selector: 'app-assets-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    NgIcon,
    Button,
    Dropdown,
    ViewSwitcher,
    ActionsMenu,
    ConfirmDialog,
    AssetUploadModal,
    AssetDetailModal,
  ],
  providers: [
    provideTranslocoScope('templates', { scope: 'templates-assets', alias: 'templatesAssets' }),
    provideIcons({
      tablerUpload,
      tablerSearch,
      tablerX,
      tablerLayoutGrid,
      tablerTable,
      tablerPhoto,
      tablerLock,
      tablerRefresh,
      tablerChevronLeft,
      tablerChevronRight,
    }),
  ],
  templateUrl: './assets-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class AssetsPage {
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly destroyRef = inject(DestroyRef);

  private readonly uploadModal = viewChild(AssetUploadModal);
  private readonly detailModal = viewChild(AssetDetailModal);
  private readonly retireConfirm = viewChild(ConfirmDialog);

  protected readonly canManage = CAN_MANAGE;
  protected readonly skeletonCards = [1, 2, 3, 4, 5, 6];
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  protected readonly viewMode = signal<AssetViewMode>('cards');
  protected readonly search = signal('');
  protected readonly typeFilter = signal<TypeFilterValue>('ALL');
  protected readonly deliveryFilter = signal<DeliveryFilterValue>('ALL');
  protected readonly statusFilter = signal<StatusFilterValue>('ALL');
  protected readonly scopeFilter = signal<TemplateAssetQueryScope>('ALL_AUTHORIZED');
  protected readonly definitionIdFilter = signal('');
  protected readonly sort = signal<TemplateAssetSort>('createdAt:desc');
  protected readonly cursor = signal<string | null>(null);
  protected readonly cursorStack = signal<(string | null)[]>([]);
  protected readonly retiringAsset = signal<TemplateAssetDto | null>(null);
  protected readonly blobUrls = signal<Readonly<Record<string, string>>>({});

  private readonly pendingBlobKeys = new Set<string>();
  private readonly ownedBlobUrls: string[] = [];

  private readonly templatesResource = resource({
    loader: () =>
      listTemplates({ assignmentScopeType: 'TENANT', limit: 100 })
        .then((res) => res.items)
        .catch(() => [] as TemplateListRow[]),
  });

  protected readonly templatesList = computed<readonly TemplateListRow[]>(() =>
    this.templatesResource.hasValue() ? this.templatesResource.value() : [],
  );

  protected readonly templateNameMap = computed<ReadonlyMap<string, string>>(
    () => new Map(this.templatesList().map((tpl) => [tpl.templateId, tpl.name])),
  );

  private readonly queryParams = computed<TemplateAssetsListQuery>(() => {
    const scope = this.scopeFilter();
    const defId = this.definitionIdFilter();
    const term = this.search().trim();
    const type = this.typeFilter();
    const delivery = this.deliveryFilter();
    const status = this.statusFilter();

    return {
      scope,
      ...(scope === 'DEFINITION' && defId ? { definitionId: defId } : {}),
      ...(type !== 'ALL' ? { assetType: type } : {}),
      ...(delivery !== 'ALL' ? { deliveryClass: delivery } : {}),
      ...(status !== 'ALL' ? { status } : {}),
      ...(term ? { search: term } : {}),
      sort: this.sort(),
      cursor: this.cursor(),
      limit: 25,
    };
  });

  private readonly loaded = resource({
    params: () => this.queryParams(),
    loader: ({ params }) => listAssets(params),
  });

  protected readonly loading = this.loaded.isLoading;
  protected readonly loadError = computed<TemplateApiError | null>(() => {
    if (this.loading()) return null;
    const raw = this.loaded.error();
    if (!raw) return null;
    if (raw instanceof TemplateApiError) return raw;
    if (typeof raw === 'object' && 'cause' in raw && (raw as { cause: unknown }).cause instanceof TemplateApiError) {
      return (raw as { cause: TemplateApiError }).cause;
    }
    return new TemplateApiError(500, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE');
  });
  protected readonly isForbidden = computed(() => this.loadError()?.status === 403);
  protected readonly isFeatureDisabled = computed(
    () => this.loadError()?.code === 'CORE.TEMPLATE.FEATURE.DISABLED',
  );
  protected readonly loadFailed = computed(() => !this.loading() && !!this.loaded.error());

  protected readonly items = computed<readonly TemplateAssetDto[]>(() =>
    this.loaded.hasValue() ? this.loaded.value().items : [],
  );
  protected readonly hasNextPage = computed(() =>
    this.loaded.hasValue() ? this.loaded.value().pageInfo.hasNextPage : false,
  );
  protected readonly nextCursor = computed(() =>
    this.loaded.hasValue() ? this.loaded.value().pageInfo.nextCursor : null,
  );
  protected readonly hasPrevPage = computed(() => this.cursorStack().length > 0);

  protected readonly hasActiveFilters = computed(
    () =>
      this.search().trim().length > 0 ||
      this.typeFilter() !== 'ALL' ||
      this.deliveryFilter() !== 'ALL' ||
      this.statusFilter() !== 'ALL' ||
      this.scopeFilter() !== 'ALL_AUTHORIZED',
  );

  protected readonly viewOptions = computed<ViewOption[]>(() => {
    this.i18n();
    return [
      { id: 'cards', icon: 'tablerLayoutGrid', label: this.transloco.translate('templatesAssets.toolbar.views.cards') },
      { id: 'table', icon: 'tablerTable', label: this.transloco.translate('templatesAssets.toolbar.views.table') },
    ];
  });

  protected readonly typeOptions = computed<DropdownOption<TypeFilterValue>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('templatesAssets.toolbar.filters.typeAll') },
      { value: 'IMAGE', label: this.transloco.translate('templatesAssets.types.IMAGE') },
      { value: 'LOGO', label: this.transloco.translate('templatesAssets.types.LOGO') },
      { value: 'BACKGROUND', label: this.transloco.translate('templatesAssets.types.BACKGROUND') },
    ];
  });

  protected readonly deliveryOptions = computed<DropdownOption<DeliveryFilterValue>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('templatesAssets.toolbar.filters.deliveryAll') },
      { value: 'PRIVATE_ONLY', label: this.transloco.translate('templatesAssets.delivery.PRIVATE_ONLY') },
      { value: 'EMAIL_PUBLIC', label: this.transloco.translate('templatesAssets.delivery.EMAIL_PUBLIC') },
    ];
  });

  protected readonly statusOptions = computed<DropdownOption<StatusFilterValue>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('templatesAssets.toolbar.filters.statusAll') },
      { value: 'ACTIVE', label: this.transloco.translate('templates.lifecycle.ACTIVE') },
      { value: 'RETIRED', label: this.transloco.translate('templates.lifecycle.RETIRED') },
    ];
  });

  protected readonly scopeOptions = computed<DropdownOption<TemplateAssetQueryScope>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL_AUTHORIZED', label: this.transloco.translate('templatesAssets.scopes.ALL_AUTHORIZED') },
      { value: 'REUSABLE', label: this.transloco.translate('templatesAssets.scopes.REUSABLE') },
      { value: 'DEFINITION', label: this.transloco.translate('templatesAssets.scopes.DEFINITION') },
    ];
  });

  protected readonly templateFilterOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const list = this.templatesList();
    if (!list.length) {
      return [
        {
          value: '',
          label: this.transloco.translate('templatesAssets.toolbar.filters.templateAll'),
          disabled: true,
        },
      ];
    }
    return list.map((tpl) => ({
      value: tpl.templateId,
      label: tpl.name,
    }));
  });

  protected readonly sortOptions = computed<DropdownOption<TemplateAssetSort>[]>(() => {
    this.i18n();
    return [
      { value: 'createdAt:desc', label: this.transloco.translate('templatesAssets.sort.createdAt:desc') },
      { value: 'createdAt:asc', label: this.transloco.translate('templatesAssets.sort.createdAt:asc') },
      { value: 'fileName:asc', label: this.transloco.translate('templatesAssets.sort.fileName:asc') },
      { value: 'fileName:desc', label: this.transloco.translate('templatesAssets.sort.fileName:desc') },
    ];
  });

  constructor() {
    effect(() => {
      const list = this.items();
      const existing = this.blobUrls();
      for (const asset of list) {
        if (asset.status !== 'ACTIVE') continue;
        if (existing[asset.assetId] || this.pendingBlobKeys.has(asset.assetId)) continue;
        void this.loadAssetBlob(asset.assetId);
      }
    });

    this.destroyRef.onDestroy(() => {
      for (const url of this.ownedBlobUrls) {
        URL.revokeObjectURL(url);
      }
      this.ownedBlobUrls.length = 0;
    });
  }

  protected reload(): void {
    this.loaded.reload();
  }

  protected setViewMode(mode: string): void {
    if (mode === 'cards' || mode === 'table') {
      this.viewMode.set(mode);
    }
  }

  protected onSearchInput(event: Event): void {
    this.resetPagination();
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.resetPagination();
    this.search.set('');
  }

  protected setTypeFilter(value: TypeFilterValue): void {
    this.resetPagination();
    this.typeFilter.set(value);
  }

  protected setDeliveryFilter(value: DeliveryFilterValue): void {
    this.resetPagination();
    this.deliveryFilter.set(value);
  }

  protected setStatusFilter(value: StatusFilterValue): void {
    this.resetPagination();
    this.statusFilter.set(value);
  }

  protected setScopeFilter(value: TemplateAssetQueryScope): void {
    this.resetPagination();
    this.scopeFilter.set(value);
    if (value !== 'DEFINITION') {
      this.definitionIdFilter.set('');
      return;
    }
    if (!this.definitionIdFilter()) {
      const firstId = this.templatesList()[0]?.templateId ?? '';
      if (firstId) {
        this.definitionIdFilter.set(firstId);
      }
    }
  }

  protected setDefinitionIdFilter(value: string): void {
    this.resetPagination();
    this.definitionIdFilter.set(value);
  }

  protected setSort(value: TemplateAssetSort): void {
    this.resetPagination();
    this.sort.set(value);
  }

  protected clearFilters(): void {
    this.resetPagination();
    this.search.set('');
    this.typeFilter.set('ALL');
    this.deliveryFilter.set('ALL');
    this.statusFilter.set('ALL');
    this.scopeFilter.set('ALL_AUTHORIZED');
    this.definitionIdFilter.set('');
  }

  protected goPrevPage(): void {
    const stack = this.cursorStack();
    if (!stack.length) return;
    const prev = stack[stack.length - 1];
    this.cursorStack.set(stack.slice(0, -1));
    this.cursor.set(prev);
  }

  protected goNextPage(): void {
    const next = this.nextCursor();
    if (!this.hasNextPage() || !next) return;
    this.cursorStack.update((stack) => [...stack, this.cursor()]);
    this.cursor.set(next);
  }

  protected openUpload(): void {
    if (!this.canManage) return;
    const scope = this.scopeFilter();
    const defId = this.definitionIdFilter();
    this.uploadModal()?.open(
      scope === 'DEFINITION' && defId ? { scope: 'DEFINITION', definitionId: defId } : { scope: 'REUSABLE' },
    );
  }

  protected openDetail(asset: TemplateAssetDto): void {
    const preview = this.previewUrlOf(asset);
    this.detailModal()?.openAsset(asset, preview);
  }

  protected onUploaded(asset: TemplateAssetDto): void {
    this.resetPagination();
    this.loaded.reload();
    if (asset.status === 'ACTIVE') {
      void this.loadAssetBlob(asset.assetId);
    }
  }

  protected onRetired(): void {
    this.loaded.reload();
  }

  protected actionsFor(asset: TemplateAssetDto): ActionItem[] {
    this.i18n();
    const openItem: ActionItem = {
      id: 'open',
      title: this.transloco.translate('templatesAssets.actions.open'),
      icon: 'tablerEye',
      tile: 'bg-icon-blue',
    };
    if (!this.canManage) return [openItem];
    const retired = asset.status === 'RETIRED';
    return [
      openItem,
      {
        id: 'retire',
        title: this.transloco.translate('templatesAssets.actions.retire'),
        icon: 'tablerArchive',
        tile: retired ? 'bg-icon-gray' : 'bg-icon-red',
        danger: true,
        disabled: retired,
        reason: retired ? this.transloco.translate('templatesAssets.actions.alreadyRetiredReason') : undefined,
      },
    ];
  }

  protected onAction(asset: TemplateAssetDto, selection: ActionSelection): void {
    if (selection.id === 'open') {
      this.openDetail(asset);
    } else if (selection.id === 'retire' && this.canManage && asset.status !== 'RETIRED') {
      void this.requestRetire(asset);
    }
  }

  protected previewUrlOf(asset: TemplateAssetDto): string | null {
    if (asset.status !== 'ACTIVE') return null;
    return this.blobUrls()[asset.assetId] ?? null;
  }

  protected scopeText(asset: TemplateAssetDto): string {
    this.i18n();
    if (!asset.definitionId) {
      return this.transloco.translate('templatesAssets.scopes.reusableBadge');
    }
    return this.templateNameMap().get(asset.definitionId) ?? this.transloco.translate('templatesAssets.scopes.DEFINITION');
  }

  protected tileClass(type: TemplateAssetType): string {
    return assetTypeTile(type);
  }

  protected formatMime(mime: string): string {
    return formatStoredMime(mime);
  }

  protected formatSize(bytes: number): string {
    return formatByteSize(bytes);
  }

  protected formatDate(iso: string): string {
    return formatAssetDate(iso, this.language());
  }

  private async requestRetire(asset: TemplateAssetDto): Promise<void> {
    const dialog = this.retireConfirm();
    if (!dialog) return;
    this.retiringAsset.set(asset);
    const confirmed = await dialog.open();
    if (!confirmed) return;

    try {
      await retireAsset(asset.assetId, asset.etag);
      this.notify.success(this.transloco.translate('templatesAssets.toasts.retired'));
      this.loaded.reload();
    } catch (error) {
      this.notify.error(translateAssetError(error, this.transloco));
    }
  }

  private resetPagination(): void {
    this.cursor.set(null);
    this.cursorStack.set([]);
  }

  private async loadAssetBlob(assetId: string): Promise<void> {
    this.pendingBlobKeys.add(assetId);
    try {
      const blob = await getAssetContent(assetId);
      const url = URL.createObjectURL(blob);
      this.ownedBlobUrls.push(url);
      this.blobUrls.update((current) => ({ ...current, [assetId]: url }));
    } catch {
      // Leave placeholder visible when image fetch fails.
    } finally {
      this.pendingBlobKeys.delete(assetId);
    }
  }
}
