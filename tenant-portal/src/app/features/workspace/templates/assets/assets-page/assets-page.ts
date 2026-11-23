import { Component, DestroyRef, computed, effect, inject, resource, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { ApiError, errorCodeOf, isRetryableWriteError } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Field } from '../../../../../shared/ui/field/field';
import { AssetsApi } from '../assets.api';
import { TemplatesApi } from '../../templates.api';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
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
  TemplateAssetDeliveryClass,
  TemplateAssetDto,
  TemplateAssetQueryScope,
  TemplateAssetSort,
  TemplateAssetStatus,
  TemplateAssetType,
  TemplateAssetsListQuery,
  TemplateListRow,
  TemplateListRequestDto,
} from '../../templates.model';
import { AssetDetailModal } from '../asset-detail-modal/asset-detail-modal';
import { AssetUploadModal } from '../asset-upload-modal/asset-upload-modal';
import {
  assetTypeTile,
  canManageAssetScope,
  formatAssetDate,
  formatByteSize,
  formatStoredMime,
  translateAssetError,
} from '../assets.service';

type AssetViewMode = 'cards' | 'table';
type TypeFilterValue = TemplateAssetType | 'ALL';
type DeliveryFilterValue = TemplateAssetDeliveryClass | 'ALL';
type StatusFilterValue = TemplateAssetStatus | 'ALL';

@Component({
  selector: 'app-assets-page',
  imports: [
    TranslocoPipe,
    NgIcon,
    Button,
    Dropdown,
    ViewSwitcher,
    ActionsMenu,
    ConfirmDialog,
    AssetUploadModal,
    AssetDetailModal,
    ConflictDialog,
    FullState,
    Field,
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
    }),
  ],
  templateUrl: './assets-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class AssetsPage {
  private readonly api = inject(AssetsApi);
  private readonly templatesApi = inject(TemplatesApi);
  private readonly scope = inject(TenantScopeState);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly destroyRef = inject(DestroyRef);

  private readonly uploadModal = viewChild(AssetUploadModal);
  private readonly detailModal = viewChild(AssetDetailModal);
  private readonly retireConfirm = viewChild(ConfirmDialog);

  protected readonly canManage = computed(() => canManageAssetScope(this.scope, null) ||
    this.templatesList().some((item) => canManageAssetScope(this.scope, item.definitionScope)));
  protected readonly canUpload = computed(() => canManageAssetScope(this.scope, null) || this.manageableTemplates().length > 0);
  protected readonly manageableTemplates = computed(() => this.templatesList().filter((item) => canManageAssetScope(this.scope, item.definitionScope)));
  private readonly detailAsset = signal<TemplateAssetDto | null>(null);
  protected readonly detailCanManage = computed(() => {
    const asset = this.detailAsset();
    return asset !== null && this.canManageAsset(asset);
  });
  protected readonly conflictOpen = signal(false);
  private retireAttempt: { assetId: string; etag: string; key: string } | null = null;
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
  private readonly previousItems = signal<readonly TemplateAssetDto[]>([]);
  protected readonly retiringAsset = signal<TemplateAssetDto | null>(null);
  protected readonly blobUrls = signal<Readonly<Record<string, string>>>({});

  private readonly pendingBlobKeys = new Set<string>();
  private readonly ownedBlobUrls: string[] = [];
  private lastScopeRevision: string | null = null;

  protected readonly definitionSearch = signal('');
  protected readonly definitionsNeedSearch = signal(false);
  private readonly definitionScope = computed<TemplateListRequestDto | undefined>(() => {
    const me = this.scope.me();
    if (me?.isTenantOwner || (me?.permissions.includes('templates.read') && me.permissionScopes['templates.read']?.tenantWide)) {
      return { assignmentScopeType: 'TENANT' };
    }
    const selection = this.scope.selection();
    if (!selection) return undefined;
    return selection.branchId
      ? { assignmentScopeType: 'BRANCH', assignmentCompanyId: selection.companyId, assignmentBranchId: selection.branchId }
      : { assignmentScopeType: 'COMPANY', assignmentCompanyId: selection.companyId };
  });
  private readonly templatesResource = resource({
    params: () => {
      this.api.scopeRevision();
      const scope = this.definitionScope();
      return scope ? { ...scope, ...(this.definitionSearch().trim() ? { name: this.definitionSearch().trim() } : {}) } : undefined;
    },
    loader: ({ params }) => this.loadDefinitions(params),
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
    params: () => {
      const revision = this.api.scopeRevision();
      const query = this.queryParams();
      return query.scope === 'DEFINITION' && !query.definitionId ? undefined : { query, revision };
    },
    loader: ({ params }) => this.api.listAssets(params.query),
  });

  protected readonly loading = this.loaded.isLoading;
  protected readonly loadError = computed<ApiError | null>(() => {
    if (this.loading()) return null;
    const raw = this.loaded.error();
    if (!raw) return null;
    if (raw instanceof ApiError) return raw;
    if (typeof raw === 'object' && 'cause' in raw && (raw as { cause: unknown }).cause instanceof ApiError) {
      return (raw as { cause: ApiError }).cause;
    }
    return new ApiError(500, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE');
  });
  protected readonly isForbidden = computed(() => this.loadError()?.status === 403 &&
    !['TENANT_MAINTENANCE_ACTIVE', 'TENANT_MAINTENANCE_RELEASE_REQUIRED'].includes(this.loadError()?.code ?? ''));
  protected readonly isFeatureDisabled = computed(
    () => ['CORE.TEMPLATE.FEATURE.DISABLED', 'FEATURE.DISABLED'].includes(this.loadError()?.code ?? ''),
  );
  protected readonly loadFailed = computed(() => !this.loading() && !!this.loaded.error());
  protected readonly loadFailureText = computed(() => {
    this.i18n();
    const error = this.loadError();
    if (!error) return '';
    const message = translateAssetError(error, this.transloco);
    return error.correlationId ? `${message} · ${this.transloco.translate('templates.states.loadFailed.reference', { correlationId: error.correlationId })}` : message;
  });

  protected readonly items = computed<readonly TemplateAssetDto[]>(() =>
    this.loaded.hasValue() ? [...this.previousItems(), ...this.loaded.value().items] : this.previousItems(),
  );
  protected readonly hasNextPage = computed(() =>
    this.loaded.hasValue() ? this.loaded.value().pageInfo.hasNextPage : false,
  );
  protected readonly nextCursor = computed(() =>
    this.loaded.hasValue() ? this.loaded.value().pageInfo.nextCursor : null,
  );

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
      const revision = this.api.scopeRevision();
      if (this.lastScopeRevision !== null && this.lastScopeRevision !== revision) {
        this.resetPagination();
        this.detailAsset.set(null);
        for (const url of this.ownedBlobUrls) URL.revokeObjectURL(url);
        this.ownedBlobUrls.length = 0;
        this.blobUrls.set({});
        this.pendingBlobKeys.clear();
      }
      this.lastScopeRevision = revision;
    });
    effect(() => {
      if (['CORE.TEMPLATE.SCHEMA.INVALID', 'SCHEMA.INVALID'].includes(errorCodeOf(this.loadError()) ?? '')) this.resetDefinitionFilter();
    });
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
    this.resetPagination();
    this.loaded.reload();
    this.templatesResource.reload();
  }

  protected backHome(): void {
    void this.router.navigateByUrl('/workspace/home');
  }

  protected onDefinitionSearch(event: Event): void {
    this.definitionSearch.set((event.target as HTMLInputElement).value.slice(0, 100));
  }

  private resetDefinitionFilter(): void {
    this.resetPagination();
    this.scopeFilter.set('ALL_AUTHORIZED');
    this.definitionIdFilter.set('');
  }

  private async loadDefinitions(query: TemplateListRequestDto): Promise<TemplateListRow[]> {
    const items: TemplateListRow[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.templatesApi.listTemplates({ ...query, cursor, limit: 100 });
      items.push(...page.items);
      if (page.totalCount > 500 || (items.length >= 500 && page.pageInfo.hasNextPage)) {
        this.definitionsNeedSearch.set(true);
        return query.name ? items.slice(0, 500) : [];
      }
      cursor = page.pageInfo.hasNextPage ? page.pageInfo.nextCursor ?? undefined : undefined;
    } while (cursor);
    return items;
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

  protected goNextPage(): void {
    const next = this.nextCursor();
    if (!this.hasNextPage() || !next) return;
    this.previousItems.set(this.items());
    this.cursor.set(next);
  }

  protected openUpload(): void {
    if (!this.canUpload()) return;
    const scope = this.scopeFilter();
    const defId = this.definitionIdFilter();
    this.uploadModal()?.open(
      scope === 'DEFINITION' && defId ? { scope: 'DEFINITION', definitionId: defId }
        : canManageAssetScope(this.scope, null) ? { scope: 'REUSABLE' }
        : { scope: 'DEFINITION', definitionId: this.manageableTemplates()[0]?.templateId },
    );
  }

  protected openDetail(asset: TemplateAssetDto): void {
    this.detailAsset.set(asset);
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
    this.resetPagination();
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
    if (!this.canManageAsset(asset)) return [openItem];
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
    } else if (selection.id === 'retire' && this.canManageAsset(asset) && asset.status !== 'RETIRED') {
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
    await this.performRetire(asset);
  }

  protected canManageAsset(asset: TemplateAssetDto): boolean {
    if (!asset.definitionId) return canManageAssetScope(this.scope, null);
    const definition = this.templatesList().find((item) => item.templateId === asset.definitionId);
    return definition ? canManageAssetScope(this.scope, definition.definitionScope) : canManageAssetScope(this.scope, null);
  }

  private async performRetire(asset: TemplateAssetDto): Promise<void> {
    if (this.retireAttempt?.assetId !== asset.assetId || this.retireAttempt.etag !== asset.etag) {
      this.retireAttempt = { assetId: asset.assetId, etag: asset.etag, key: newIdempotencyKey() };
    }
    try {
      await this.api.retireAsset(asset.assetId, asset.etag, this.retireAttempt.key);
      this.retireAttempt = null;
      this.notify.success(this.transloco.translate('templatesAssets.toasts.retired'));
      this.resetPagination();
      this.loaded.reload();
    } catch (error) {
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) this.retireAttempt = null;
      if (error instanceof ApiError && error.status === 409 && !error.code.endsWith('ASSET.IN_USE') && !error.code.includes('IN_FLIGHT')) {
        this.conflictOpen.set(true);
      } else {
        this.notify.error(translateAssetError(error, this.transloco, true));
      }
    }
  }

  protected async resolveRetireConflict(keep: boolean): Promise<void> {
    this.conflictOpen.set(false);
    const asset = this.retiringAsset();
    if (!keep || !asset) { this.reload(); return; }
    try {
      const fresh = (await this.api.getAsset(asset.assetId)).asset;
      this.retiringAsset.set(fresh);
      await this.requestRetire(fresh);
    } catch (error) {
      this.notify.error(translateAssetError(error, this.transloco));
    }
  }

  private resetPagination(): void {
    this.cursor.set(null);
    this.previousItems.set([]);
  }

  private async loadAssetBlob(assetId: string): Promise<void> {
    this.pendingBlobKeys.add(assetId);
    try {
      const blob = await this.api.getAssetContent(assetId);
      if (this.destroyRef.destroyed) return;
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
