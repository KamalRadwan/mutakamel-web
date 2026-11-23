import {
  Component,
  DestroyRef,
  Injector,
  computed,
  effect,
  inject,
  runInInjectionContext,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowsExchange,
  tablerBox,
  tablerLoader2,
  tablerPlus,
  tablerRefresh,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { type ActionItem, type ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { SettingsNotice } from '../../../../shared/ui/settings-notice/settings-notice';
import { StepFilter, type StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { branchGrants } from '../../shared/trade-access';
import { ApiError, type TradeContext, errorCodeOf, newIdempotencyKey, tradeContext } from '../../shared/trade-api';
import { getItem, searchItems } from '../../shared/trade-foundation.api';
import type { ItemRow } from '../../shared/trade-foundation.model';
import { listUomConversions, publishUomConversion, retireUomConversion } from '../inventory.api';
import {
  INVENTORY_LIMITS,
  type InventoryReasonKind,
  type UomConversionRevision,
  type UomConversionStatus,
} from '../inventory.model';
import {
  errorKey,
  errorReason,
  factorText,
  formatDateTime,
  formatQuantity,
  hasCompanyGrant,
  isForbiddenError,
  itemName,
} from '../inventory.service';
import { InventoryBadge } from '../inventory-shared/inventory-badge/inventory-badge';
import { InventoryConflict } from '../inventory-shared/inventory-conflict/inventory-conflict';
import { InventoryReasonDialog } from '../inventory-shared/inventory-reason-dialog/inventory-reason-dialog';
import { UomConversionModal } from '../uom-conversion-modal/uom-conversion-modal';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = INVENTORY_LIMITS.pageSize;
const PAGE_SIZES: readonly number[] = [20, 50, 100];
const SEARCH_DEBOUNCE_MS = 250;
const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;

const TRANSITION_ALERT_REASONS: ReadonlySet<string> = new Set([
  'transition_not_allowed',
  'future_replacement_unsupported',
  'effective_from_not_after_predecessor',
  'published_revision_exists',
  'content_hash_mismatch',
]);

type StatusFilter = 'ALL' | UomConversionStatus;

interface StatusCountSummary {
  all: number;
  DRAFT: number;
  PUBLISHED: number;
  RETIRED: number;
}

interface SelectedItemFilter {
  param: string;
  companyId: string;
  itemId: string;
  companyProfileId: string;
  code: string;
  localizedNames: Record<string, string>;
}

interface PendingReasonAction {
  kind: InventoryReasonKind;
  mode: 'publish' | 'retire';
  row: UomConversionRevision;
  predecessorRevision: number | null;
}

function parseStatus(raw: string | null | undefined): StatusFilter {
  const normalized = raw?.trim().toUpperCase();
  if (normalized === 'DRAFT' || normalized === 'PUBLISHED' || normalized === 'RETIRED') {
    return normalized;
  }
  return 'ALL';
}

function parsePage(raw: string | null | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_PAGE;
}

function parsePageSize(raw: string | null | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE_SIZE;
  const parsed = Number(raw);
  return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

function formatItemLabel(
  code: string | null | undefined,
  localizedNames: Record<string, string> | null | undefined,
  lang: string,
): string {
  const cleanCode = code?.trim() ?? '';
  const name = itemName(localizedNames, lang);
  if (!name && !cleanCode) return '—';
  if (!cleanCode) return name;
  if (!name || name === cleanCode) return cleanCode;
  return `\u2066${cleanCode}\u2069 — ${name}`;
}

@Component({
  selector: 'app-uom-conversions-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    FullState,
    Modal,
    Pagination,
    SettingsFrame,
    SettingsNotice,
    StepFilter,
    InventoryBadge,
    InventoryConflict,
    InventoryReasonDialog,
    UomConversionModal,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-inventory', alias: 'tradeInventory' }, { scope: 'trade-inventory-uom', alias: 'invUom' }),
    provideIcons({
      tablerAlertTriangle,
      tablerArrowsExchange,
      tablerBox,
      tablerLoader2,
      tablerPlus,
      tablerRefresh,
      tablerX,
    }),
  ],
  templateUrl: './uom-conversions-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class UomConversionsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly scope = inject(ScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly paramMap = toSignal(this.route.paramMap);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly conversionModal = viewChild.required(UomConversionModal);
  private readonly reasonDialog = viewChild.required(InventoryReasonDialog);
  private readonly conflictDialog = viewChild.required(InventoryConflict);
  private readonly transitionAlertModal = viewChild.required<Modal>('transitionAlertModal');

  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() => this.hasGrant('trade.inventory.read'));
  protected readonly showForbidden = computed(() => !this.canRead() || this.forbidden());
  protected readonly canGovern = computed(
    () => !this.forbidden() && this.hasGrant('trade.inventory.governance.manage'),
  );
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly pageSizes = [...PAGE_SIZES];
  protected readonly gridColumns =
    'grid-cols-trade-inv-uom-conversion-row-actions';

  private readonly companyCtx = computed<TradeContext>(() => tradeContext(this.scope, 'COMPANY'));

  protected readonly routeId = computed(() => this.paramMap()?.get('id')?.trim() || null);
  protected readonly statusFilter = computed<StatusFilter>(() => parseStatus(this.queryParams()?.get('status')));
  protected readonly itemParam = computed(() => this.queryParams()?.get('item')?.trim() || '');
  protected readonly page = computed(() => parsePage(this.queryParams()?.get('page')));
  protected readonly pageSize = computed(() => parsePageSize(this.queryParams()?.get('size')));

  protected readonly search = signal('');
  private readonly selectedItem = signal<SelectedItemFilter | null>(null);
  private readonly resolvedItemKey = signal<string>('');
  protected readonly itemSuggestionsOpen = signal(false);
  protected readonly itemSuggestions = signal<ItemRow[]>([]);
  protected readonly searchingItems = signal(false);
  protected readonly itemSearchFailed = signal(false);

  protected readonly rows = signal<UomConversionRevision[]>([]);
  protected readonly total = signal(0);
  protected readonly counts = signal<StatusCountSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly hasLoaded = signal(false);
  protected readonly loadFailed = signal(false);

  private readonly reloadTick = signal(0);
  protected readonly transitionPending = signal(false);
  private readonly reasonAction = signal<PendingReasonAction | null>(null);
  protected readonly transitionAlertKey = signal<string | null>(null);

  private appliedSearchLabel = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private itemResolveSeq = 0;
  private itemSearchSeq = 0;
  private listSeq = 0;
  private countsSeq = 0;
  private countsTargetProfileKey: string | null = null;
  private lastCountsReloadTick = -1;
  private routeResolveSeq = 0;
  private lastOpenedRouteId: string | null = null;
  private pendingModalSeed: UomConversionRevision | null = null;
  private conflictRecordId: string | null = null;
  private transitionKeySig = '';
  private transitionKey = '';
  private destroyed = false;

  private readonly itemFilterReady = computed(() => {
    const param = this.itemParam();
    const companyId = this.companyCtx().companyId ?? '';
    return this.resolvedItemKey() === `${companyId}:${param}`;
  });
  private readonly activeItemProfileId = computed(() => {
    const param = this.itemParam();
    if (!param) return undefined;
    const companyId = this.companyCtx().companyId ?? '';
    const selected = this.selectedItem();
    return selected && selected.param === param && selected.companyId === companyId
      ? selected.companyProfileId
      : undefined;
  });

  protected readonly isFiltered = computed(
    () => this.statusFilter() !== 'ALL' || Boolean(this.itemParam()),
  );

  protected readonly statusSteps = computed<StepOption[]>(() => {
    this.i18n();
    const c = this.counts();
    return [
      { id: 'ALL', label: this.transloco.translate('invUom.filter.all'), count: c ? c.all : null },
      {
        id: 'DRAFT',
        label: this.transloco.translate('tradeInventory.badge.uom.DRAFT'),
        count: c ? c.DRAFT : null,
      },
      {
        id: 'PUBLISHED',
        label: this.transloco.translate('tradeInventory.badge.uom.PUBLISHED'),
        count: c ? c.PUBLISHED : null,
        tone: 'success',
      },
      {
        id: 'RETIRED',
        label: this.transloco.translate('tradeInventory.badge.uom.RETIRED'),
        count: c ? c.RETIRED : null,
      },
    ];
  });

  protected readonly reasonDialogKind = computed<InventoryReasonKind>(
    () => this.reasonAction()?.kind ?? 'INVENTORY_UOM_PUBLISH',
  );

  protected readonly reasonDialogTitle = computed(() => {
    this.i18n();
    const action = this.reasonAction();
    if (!action) return '';
    return this.transloco.translate(
      action.mode === 'publish' ? 'invUom.publish.title' : 'invUom.retire.title',
      { n: action.row.revisionNumber },
    );
  });

  protected readonly reasonDialogSubtitle = computed(() => {
    const action = this.reasonAction();
    if (!action) return '';
    const { row } = action;
    return `${formatItemLabel(row.itemCode, row.itemNames, this.language())} · ${row.fromUomCode || '—'} → ${row.toUomCode || '—'}`;
  });

  protected readonly reasonDialogMessage = computed(() => {
    this.i18n();
    const action = this.reasonAction();
    if (!action) return '';
    if (action.mode === 'retire') {
      return this.transloco.translate('invUom.retire.message');
    }
    if (action.predecessorRevision !== null) {
      return this.transloco.translate('invUom.publish.retiresMessage', {
        n: action.predecessorRevision,
      });
    }
    return this.transloco.translate('invUom.publish.firstMessage');
  });

  protected readonly reasonDialogConfirmLabel = computed(() => {
    this.i18n();
    const action = this.reasonAction();
    if (!action) return '';
    return this.transloco.translate(
      action.mode === 'publish' ? 'invUom.publish.confirm' : 'invUom.retire.confirm',
    );
  });

  protected readonly reasonDialogTone = computed<'danger' | 'primary'>(() =>
    this.reasonAction()?.mode === 'retire' ? 'danger' : 'primary',
  );

  constructor() {
    // Sync URL ?item= param -> selected item profile & search box text.
    effect(() => {
      const param = this.itemParam();
      const ctx = this.companyCtx();
      const allowed = this.canRead();
      untracked(() => {
        this.forbidden.set(false);
        if (!allowed) {
          this.resolvedItemKey.set(`${ctx.companyId ?? ''}:${param}`);
          return;
        }
        void this.syncItemFromUrl(param, ctx);
      });
    });

    // Keep selected item display label localized when language switches.
    effect(() => {
      const lang = this.language();
      const selected = this.selectedItem();
      if (!selected) return;
      untracked(() => {
        if (this.search() === this.appliedSearchLabel) {
          const nextLabel = formatItemLabel(selected.code, selected.localizedNames, lang);
          this.appliedSearchLabel = nextLabel;
          this.search.set(nextLabel);
        }
      });
    });

    // React to search box edits -> clear item filter when emptied, or search products for picking.
    effect(() => {
      const text = this.search();
      untracked(() => this.handleSearchInput(text));
    });

    // Load paged rows whenever URL filters/page/size or reloadTick change.
    effect(() => {
      if (!this.itemFilterReady()) return;
      const profileId = this.activeItemProfileId();
      const status = this.statusFilter();
      const page = this.page();
      const limit = this.pageSize();
      const tick = this.reloadTick();
      const allowed = this.canRead();

      untracked(() => {
        if (!allowed) {
          this.rows.set([]);
          this.total.set(0);
          this.counts.set(null);
          this.loading.set(false);
          this.loadFailed.set(false);
          return;
        }
        void this.loadList(profileId, status, page, limit);
        const profileKey = profileId ?? '';
        if (profileKey !== this.countsTargetProfileKey || tick !== this.lastCountsReloadTick) {
          this.countsTargetProfileKey = profileKey;
          this.lastCountsReloadTick = tick;
          void this.loadCounts(profileId);
        }
      });
    });

    // Open or close record modal when route :id changes.
    effect(() => {
      if (this.showForbidden()) return;
      const id = this.routeId();
      untracked(() => {
        if (!id) {
          this.routeResolveSeq++;
          if (this.lastOpenedRouteId !== null) {
            this.lastOpenedRouteId = null;
            this.conversionModal().close();
          }
          return;
        }
        if (id === this.lastOpenedRouteId) return;
        void this.openRouteConversion(id);
      });
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.clearSearchTimer();
    });
  }

  protected openCreate(prefill?: UomConversionRevision): void {
    if (!this.canGovern()) return;
    this.conversionModal().openCreate(prefill);
  }

  protected reload(): void {
    if (!this.canRead()) return;
    this.forbidden.set(false);
    this.reloadTick.update((n) => n + 1);
  }

  protected goHome(): void {
    void this.router.navigate(['/']);
  }

  protected onForbidden(): void {
    this.forbidden.set(true);
  }

  protected onStatusChange(next: string): void {
    const parsed = parseStatus(next);
    if (parsed === this.statusFilter()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: parsed === 'ALL' ? null : parsed,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected onPageChange(nextPage: number): void {
    const clamped = Math.max(DEFAULT_PAGE, nextPage);
    if (clamped === this.page()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: clamped === DEFAULT_PAGE ? null : clamped },
      queryParamsHandling: 'merge',
    });
  }

  protected onPageSizeChange(nextSize: number): void {
    if (!PAGE_SIZES.includes(nextSize) || nextSize === this.pageSize()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        size: nextSize === DEFAULT_PAGE_SIZE ? null : nextSize,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected clearFilters(): void {
    this.clearSearchTimer();
    this.itemSuggestionsOpen.set(false);
    this.selectedItem.set(null);
    this.resolvedItemKey.set(`${this.companyCtx().companyId ?? ''}:`);
    this.appliedSearchLabel = '';
    this.search.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { item: null, status: null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected retryItemSearch(): void {
    const term = this.search().trim();
    if (term) {
      void this.runItemSearch(term);
    }
  }

  protected closeSuggestions(): void {
    this.itemSuggestionsOpen.set(false);
  }

  protected async pickItemFilter(row: ItemRow): Promise<void> {
    this.clearSearchTimer();
    this.itemSuggestionsOpen.set(false);

    let profileId = row.eligibility?.companyProfileId;
    if (!profileId) {
      try {
        const detail = await getItem(this.companyCtx(), row.id);
        if (this.destroyed) return;
        profileId = detail.companyProfile?.id;
      } catch (error) {
        this.notify.error(this.transloco.translate(errorKey(error)));
        return;
      }
    }
    if (!profileId) {
      this.notify.error(this.transloco.translate('tradeShared.errors.TRADE_CATALOG_COMPANY_PROFILE_NOT_FOUND'));
      return;
    }

    const companyId = this.companyCtx().companyId ?? '';
    const label = formatItemLabel(row.canonicalCode, row.localizedNames, this.language());
    this.appliedSearchLabel = label;
    this.search.set(label);
    this.selectedItem.set({
      param: row.id,
      companyId,
      itemId: row.id,
      companyProfileId: profileId,
      code: row.canonicalCode,
      localizedNames: row.localizedNames,
    });
    this.resolvedItemKey.set(`${companyId}:${row.id}`);

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { item: row.id, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onRowClick(row: UomConversionRevision, event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, [data-row-action]')) return;
    this.openView(row);
  }

  protected onRowKeydown(event: KeyboardEvent, row: UomConversionRevision): void {
    if ((event.key !== 'Enter' && event.key !== ' ') || event.target !== event.currentTarget) return;
    event.preventDefault();
    this.openView(row);
  }

  protected openView(row: UomConversionRevision): void {
    this.pendingModalSeed = row;
    void this.router.navigate(['/trade/inventory/uom-conversions', row.id], {
      queryParamsHandling: 'preserve',
    });
  }

  protected rowActions(row: UomConversionRevision): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);
    const items: ActionItem[] = [
      {
        id: 'open',
        title: t('invUom.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];
    if (!this.canGovern()) return items;

    items.push({
      id: 'newRevision',
      title: t('invUom.actions.newRevision'),
      icon: 'tablerCopy',
      tile: 'bg-icon-navy',
    });

    if (row.status === 'DRAFT') {
      items.push({
        id: 'publish',
        title: t('invUom.actions.publish'),
        icon: 'tablerCheck',
        tile: 'bg-icon-green',
      });
    } else if (row.status === 'PUBLISHED') {
      items.push({
        id: 'retire',
        title: t('invUom.actions.retire'),
        icon: 'tablerArchive',
        tile: 'bg-icon-red',
        danger: true,
      });
    }
    return items;
  }

  protected onRowAction(row: UomConversionRevision, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
        this.openView(row);
        break;
      case 'newRevision':
        this.openCreate(row);
        break;
      case 'publish':
        void this.requestPublish(row);
        break;
      case 'retire':
        this.requestRetire(row);
        break;
    }
  }

  protected onConversionCreated(): void {
    this.reload();
  }

  protected onModalClosed(): void {
    this.lastOpenedRouteId = null;
    if (this.routeId()) {
      void this.router.navigate(['/trade/inventory/uom-conversions'], {
        queryParamsHandling: 'preserve',
      });
    }
  }

  protected async requestPublish(row: UomConversionRevision): Promise<void> {
    if (!this.canGovern() || row.status !== 'DRAFT' || this.transitionPending()) return;

    let predecessor =
      this.rows().find(
        (candidate) =>
          candidate.id !== row.id &&
          candidate.itemCompanyProfileId === row.itemCompanyProfileId &&
          candidate.fromUomId === row.fromUomId &&
          candidate.toUomId === row.toUomId &&
          candidate.status === 'PUBLISHED',
      ) ?? null;

    if (!predecessor) {
      try {
        const res = await listUomConversions(
          {
            itemCompanyProfileId: row.itemCompanyProfileId,
            fromUomId: row.fromUomId,
            toUomId: row.toUomId,
            status: 'PUBLISHED',
            page: 1,
            limit: 1,
          },
          this.companyCtx(),
        );
        if (this.destroyed) return;
        predecessor = res.items.find((candidate) => candidate.id !== row.id) ?? null;
      } catch (error) {
        if (isForbiddenError(error)) {
          this.forbidden.set(true);
          return;
        }
        // Proceed even if predecessor check fails; backend remains authoritative.
      }
    }

    this.transitionKeySig = '';
    this.transitionKey = '';
    this.reasonAction.set({
      kind: 'INVENTORY_UOM_PUBLISH',
      mode: 'publish',
      row,
      predecessorRevision: predecessor?.revisionNumber ?? null,
    });
    this.reasonDialog().open();
  }

  protected requestRetire(row: UomConversionRevision): void {
    if (!this.canGovern() || row.status !== 'PUBLISHED' || this.transitionPending()) return;
    this.transitionKeySig = '';
    this.transitionKey = '';
    this.reasonAction.set({
      kind: 'INVENTORY_UOM_RETIRE',
      mode: 'retire',
      row,
      predecessorRevision: null,
    });
    this.reasonDialog().open();
  }

  protected async onReasonConfirmed(reasonCode: string): Promise<void> {
    const action = this.reasonAction();
    if (!action || this.transitionPending()) return;

    const { mode, row } = action;
    const sig = `${mode}:${row.id}:${row.version}:${reasonCode}`;
    if (sig !== this.transitionKeySig || !this.transitionKey) {
      this.transitionKeySig = sig;
      this.transitionKey = newIdempotencyKey();
    }

    const ctx = this.companyCtx();
    this.transitionPending.set(true);
    try {
      const updated =
        mode === 'publish'
          ? await publishUomConversion(row.id, row.version, reasonCode, this.transitionKey, ctx)
          : await retireUomConversion(row.id, row.version, reasonCode, this.transitionKey, ctx);

      if (this.destroyed) return;
      this.transitionPending.set(false);
      this.transitionKeySig = '';
      this.transitionKey = '';
      this.reasonDialog().close();
      this.reasonAction.set(null);

      this.notify.success(
        this.transloco.translate(mode === 'publish' ? 'invUom.publish.done' : 'invUom.retire.done', {
          n: updated.revisionNumber,
        }),
      );
      this.conversionModal().updateViewing(updated);
      this.reload();
    } catch (error) {
      if (this.destroyed) return;
      this.transitionPending.set(false);
      this.handleTransitionError(error, row);
    }
  }

  protected onReasonCancelled(): void {
    this.transitionKeySig = '';
    this.transitionKey = '';
    this.reasonAction.set(null);
  }

  protected async onConflictReload(): Promise<void> {
    const targetId = this.conflictRecordId;
    this.conflictRecordId = null;
    this.reload();
    if (targetId && this.routeId() === targetId) {
      const fresh = await this.findConversionById(targetId);
      if (this.destroyed) return;
      if (fresh) {
        this.conversionModal().updateViewing(fresh);
      } else {
        this.conversionModal().close();
      }
    }
  }

  protected closeTransitionAlert(): void {
    this.transitionAlertModal().close();
  }

  protected itemDisplayName(row: UomConversionRevision): string {
    return itemName(row.itemNames, this.language());
  }

  protected suggestionName(row: ItemRow): string {
    return itemName(row.localizedNames, this.language());
  }

  protected factorOf(row: UomConversionRevision): string {
    const raw = factorText(row.factorNumerator, row.factorDenominator);
    return raw.includes('/') ? raw : formatQuantity(raw, this.language());
  }

  protected formatDateTime(iso: string | null): string {
    return formatDateTime(iso);
  }

  private async syncItemFromUrl(param: string, ctx: TradeContext): Promise<void> {
    const seq = ++this.itemResolveSeq;
    const companyId = ctx.companyId ?? '';
    const key = `${companyId}:${param}`;
    if (!param) {
      this.selectedItem.set(null);
      this.resolvedItemKey.set(key);
      if (this.appliedSearchLabel) {
        this.appliedSearchLabel = '';
        this.search.set('');
      }
      return;
    }

    const current = this.selectedItem();
    if (current && current.param === param && current.companyId === companyId) {
      this.resolvedItemKey.set(key);
      return;
    }

    try {
      const detail = await getItem(ctx, param);
      if (seq !== this.itemResolveSeq || this.destroyed) return;
      if (detail.companyProfile) {
        const label = formatItemLabel(detail.canonicalCode, detail.localizedNames, this.language());
        this.selectedItem.set({
          param,
          companyId,
          itemId: detail.id,
          companyProfileId: detail.companyProfile.id,
          code: detail.canonicalCode,
          localizedNames: detail.localizedNames,
        });
        this.appliedSearchLabel = label;
        this.search.set(label);
        this.resolvedItemKey.set(key);
        return;
      }
    } catch {
      if (seq !== this.itemResolveSeq || this.destroyed) return;
    }

    // Fallback when URL carries a raw itemCompanyProfileId.
    try {
      const probe = await listUomConversions(
        { itemCompanyProfileId: param, page: 1, limit: 1 },
        ctx,
      );
      if (seq !== this.itemResolveSeq || this.destroyed) return;
      const first = probe.items[0];
      const code = first?.itemCode ?? param;
      const names = first?.itemNames ?? {};
      const label = formatItemLabel(code, names, this.language());
      this.selectedItem.set({
        param,
        companyId,
        itemId: first?.itemId ?? param,
        companyProfileId: param,
        code,
        localizedNames: names,
      });
      this.appliedSearchLabel = label;
      this.search.set(label);
    } catch (error) {
      if (seq !== this.itemResolveSeq || this.destroyed) return;
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      this.selectedItem.set({
        param,
        companyId,
        itemId: param,
        companyProfileId: param,
        code: param,
        localizedNames: {},
      });
      this.appliedSearchLabel = param;
      this.search.set(param);
    } finally {
      if (seq === this.itemResolveSeq && !this.destroyed) {
        this.resolvedItemKey.set(key);
      }
    }
  }

  private handleSearchInput(text: string): void {
    if (text === this.appliedSearchLabel) return;

    const trimmed = text.trim();
    this.clearSearchTimer();

    if (!trimmed) {
      this.itemSuggestionsOpen.set(false);
      this.itemSuggestions.set([]);
      if (this.selectedItem() || this.itemParam()) {
        this.selectedItem.set(null);
        this.resolvedItemKey.set(`${this.companyCtx().companyId ?? ''}:`);
        this.appliedSearchLabel = '';
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { item: null, page: null },
          queryParamsHandling: 'merge',
        });
      }
      return;
    }

    this.itemSuggestionsOpen.set(true);
    this.searchingItems.set(true);
    this.itemSearchFailed.set(false);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      void this.runItemSearch(trimmed);
    }, SEARCH_DEBOUNCE_MS);
  }

  private async runItemSearch(term: string): Promise<void> {
    const seq = ++this.itemSearchSeq;
    this.searchingItems.set(true);
    this.itemSearchFailed.set(false);
    try {
      const page = await searchItems(this.companyCtx(), {
        search: term,
        itemKind: 'PRODUCT',
        limit: 10,
      });
      if (seq !== this.itemSearchSeq || this.destroyed) return;
      this.itemSuggestions.set(page.items);
    } catch {
      if (seq !== this.itemSearchSeq || this.destroyed) return;
      this.itemSuggestions.set([]);
      this.itemSearchFailed.set(true);
    } finally {
      if (seq === this.itemSearchSeq && !this.destroyed) {
        this.searchingItems.set(false);
      }
    }
  }

  private async loadList(
    itemCompanyProfileId: string | undefined,
    status: StatusFilter,
    page: number,
    limit: number,
  ): Promise<void> {
    if (!this.canRead()) {
      this.loading.set(false);
      return;
    }
    const seq = ++this.listSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const res = await listUomConversions(
        {
          itemCompanyProfileId,
          status: status === 'ALL' ? undefined : status,
          page,
          limit,
        },
        this.companyCtx(),
      );
      if (seq !== this.listSeq || this.destroyed) return;
      this.rows.set(res.items);
      this.total.set(res.total);
      this.hasLoaded.set(true);
    } catch (error) {
      if (seq !== this.listSeq || this.destroyed) return;
      this.rows.set([]);
      this.total.set(0);
      if (isForbiddenError(error)) {
        this.loadFailed.set(false);
        this.forbidden.set(true);
        return;
      }
      this.loadFailed.set(true);
    } finally {
      if (seq === this.listSeq && !this.destroyed) {
        this.loading.set(false);
      }
    }
  }

  private async loadCounts(itemCompanyProfileId: string | undefined): Promise<void> {
    if (!this.canRead()) return;
    const seq = ++this.countsSeq;
    const ctx = this.companyCtx();
    const base = itemCompanyProfileId ? { itemCompanyProfileId } : {};
    try {
      const [allPage, draftPage, pubPage, retPage] = await Promise.all([
        listUomConversions({ ...base, page: 1, limit: 1 }, ctx),
        listUomConversions({ ...base, status: 'DRAFT', page: 1, limit: 1 }, ctx),
        listUomConversions({ ...base, status: 'PUBLISHED', page: 1, limit: 1 }, ctx),
        listUomConversions({ ...base, status: 'RETIRED', page: 1, limit: 1 }, ctx),
      ]);
      if (seq !== this.countsSeq || this.destroyed) return;
      this.counts.set({
        all: allPage.total,
        DRAFT: draftPage.total,
        PUBLISHED: pubPage.total,
        RETIRED: retPage.total,
      });
    } catch (error) {
      if (isForbiddenError(error) && !this.destroyed && seq === this.countsSeq) {
        this.forbidden.set(true);
      }
      // Non-blocking count refresh; previous counts stay visible.
    }
  }

  private async openRouteConversion(id: string): Promise<void> {
    const seq = ++this.routeResolveSeq;
    const seed =
      (this.pendingModalSeed?.id === id ? this.pendingModalSeed : null) ??
      this.rows().find((row) => row.id === id) ??
      null;
    this.pendingModalSeed = null;

    if (seed) {
      this.lastOpenedRouteId = id;
      this.conversionModal().openView(seed);
      return;
    }

    try {
      const found = await this.findConversionById(id);
      if (seq !== this.routeResolveSeq || this.destroyed) return;
      if (found) {
        this.lastOpenedRouteId = id;
        this.conversionModal().openView(found);
        return;
      }
      this.notify.error(
        this.transloco.translate('tradeInventory.errors.TRADE_INVENTORY_SCOPE_NOT_FOUND'),
      );
    } catch (error) {
      if (seq !== this.routeResolveSeq || this.destroyed) return;
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(error)));
    }

    void this.router.navigate(['/trade/inventory/uom-conversions'], {
      queryParamsHandling: 'preserve',
      replaceUrl: true,
    });
  }

  private async findConversionById(id: string): Promise<UomConversionRevision | null> {
    const ctx = this.companyCtx();
    let page = 1;
    const limit = 100;
    try {
      while (true) {
        const res = await listUomConversions({ page, limit }, ctx);
        const matched = res.items.find((item) => item.id === id);
        if (matched) return matched;
        if (page * limit >= res.total || res.items.length === 0) {
          return null;
        }
        page += 1;
      }
    } catch (error) {
      if (isForbiddenError(error)) {
        throw error;
      }
      return null;
    }
  }

  private hasGrant(key: string): boolean {
    const grants = runInInjectionContext(this.injector, () => branchGrants(key));
    const company = this.scope.company();
    const companyBranchIds = company?.branches.map((b) => b.id) ?? [];
    return hasCompanyGrant(grants, this.scope.branch()?.id ?? null, companyBranchIds);
  }

  private handleTransitionError(error: unknown, row: UomConversionRevision): void {
    if (isForbiddenError(error)) {
      this.transitionKeySig = '';
      this.transitionKey = '';
      this.reasonDialog().close();
      this.reasonAction.set(null);
      this.forbidden.set(true);
      return;
    }

    const code = errorCodeOf(error);
    const reason = errorReason(error);

    if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
      this.transitionKeySig = '';
      this.transitionKey = '';
      this.reasonDialog().close();
      this.reasonAction.set(null);
      this.conflictRecordId = row.id;
      this.conflictDialog().open();
      return;
    }

    const isInvalidOrUnavailable =
      code === 'TRADE.INVENTORY.UOM_CONVERSION_INVALID' ||
      code === 'TRADE.INVENTORY.UOM_CONVERSION_UNAVAILABLE';
    if (isInvalidOrUnavailable && reason && TRANSITION_ALERT_REASONS.has(reason)) {
      this.transitionKeySig = '';
      this.transitionKey = '';
      this.reasonDialog().close();
      this.reasonAction.set(null);
      if (reason === 'published_revision_exists') {
        this.reload();
        if (this.routeId() === row.id) {
          void this.findConversionById(row.id)
            .then((fresh) => {
              if (fresh && !this.destroyed) {
                this.conversionModal().updateViewing(fresh);
              }
            })
            .catch(() => {
              // Ignored: list reload handles errors.
            });
        }
      }
      this.transitionAlertKey.set(`invUom.transitionAlert.${reason.toUpperCase()}`);
      this.transitionAlertModal().open();
      return;
    }

    this.notify.error(this.transloco.translate(errorKey(error)));
    if (
      (error instanceof ApiError && error.status === 404 && code === 'TRADE.INVENTORY.SCOPE_NOT_FOUND') ||
      code === 'TRADE.INVENTORY.UOM_CONVERSION_UNAVAILABLE'
    ) {
      this.transitionKeySig = '';
      this.transitionKey = '';
      this.reasonDialog().close();
      this.reasonAction.set(null);
      if (this.routeId() === row.id) {
        this.conversionModal().close();
      }
      this.reload();
    }
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }
}
