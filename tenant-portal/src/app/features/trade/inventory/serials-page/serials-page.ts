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
import { tablerAlertTriangle, tablerBarcode } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import {
  type ActionItem,
  type ActionSelection,
  ActionsMenu,
} from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { StepFilter, type StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { TradeItemPicker } from '../../shared/pickers/item-picker/item-picker';
import { branchGrants } from '../../shared/trade-access';
import { tradeContext } from '../../shared/trade-api';
import { searchItemSummaries } from '../../shared/trade-foundation.api';
import type { ItemKind } from '../../shared/trade-foundation.model';
import { listSerials } from '../inventory.api';
import {
  INVENTORY_LIMITS,
  type SerialState,
  type SerialUnit,
} from '../inventory.model';
import { errorKey, formatDateTime, hasCompanyGrant, isForbiddenError, itemName } from '../inventory.service';
import { InventoryBadge } from '../inventory-shared/inventory-badge/inventory-badge';
import { SerialModal } from '../serial-modal/serial-modal';

type StateFilter = '' | SerialState;

interface SerialCounts {
  all: number | null;
  ON_HAND: number | null;
  RESERVED: number | null;
  DELIVERED: number | null;
  VOIDED: number | null;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = INVENTORY_LIMITS.pageSize;
const PAGE_SIZES: number[] = [20, 50, 100];
const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;
const SERIAL_STATES: readonly SerialState[] = ['ON_HAND', 'RESERVED', 'DELIVERED', 'VOIDED'];
const PRODUCT_KINDS: readonly ItemKind[] = ['PRODUCT'];
const GRID_COLS =
  'grid-cols-trade-inv-serial-row-actions';

const EMPTY_COUNTS: SerialCounts = {
  all: null,
  ON_HAND: null,
  RESERVED: null,
  DELIVERED: null,
  VOIDED: null,
};

function parseStateFilter(raw: string | null): StateFilter {
  if (raw === 'ON_HAND' || raw === 'RESERVED' || raw === 'DELIVERED' || raw === 'VOIDED') {
    return raw;
  }
  return '';
}

function parsePage(raw: string | null): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_PAGE;
}

function parsePageSize(raw: string | null): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE_SIZE;
  const parsed = Number(raw);
  return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

@Component({
  selector: 'app-serials-page',
  imports: [
    TranslocoPipe,
    NgIcon,
    SettingsFrame,
    Field,
    FullState,
    StepFilter,
    Pagination,
    ActionsMenu,
    Button,
    TradeItemPicker,
    InventoryBadge,
    SerialModal,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-inventory', alias: 'tradeInventory' }, { scope: 'trade-inventory-evidence', alias: 'invEvidence' }),
    provideIcons({ tablerBarcode, tablerAlertTriangle }),
  ],
  templateUrl: './serials-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class SerialsPage {
  private static nextId = 0;
  protected readonly uid = `serials-page-${++SerialsPage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly scope = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly paramMap = toSignal(this.route.paramMap);
  private readonly queryParamMap = toSignal(this.route.queryParamMap);
  private readonly serialModal = viewChild(SerialModal);

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly productKinds = PRODUCT_KINDS;
  protected readonly gridCols = GRID_COLS;

  protected readonly routeId = computed(() => this.paramMap()?.get('id')?.trim() || null);
  protected readonly itemId = computed(() => this.queryParamMap()?.get('item')?.trim() || '');
  protected readonly serialFilter = computed(() => this.queryParamMap()?.get('serial')?.trim() || '');
  protected readonly stateFilter = computed<StateFilter>(() =>
    parseStateFilter(this.queryParamMap()?.get('state') ?? null),
  );
  protected readonly page = computed(() => parsePage(this.queryParamMap()?.get('page') ?? null));
  protected readonly pageSize = computed(() =>
    parsePageSize(this.queryParamMap()?.get('size') ?? null),
  );

  protected readonly companyContext = computed(() => tradeContext(this.scope, 'COMPANY'));

  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() => {
    const grants = runInInjectionContext(this.injector, () => branchGrants('trade.inventory.read'));
    const company = this.scope.company();
    const companyBranchIds = company?.branches.map((b) => b.id) ?? [];
    return hasCompanyGrant(grants, this.scope.branch()?.id ?? null, companyBranchIds);
  });
  protected readonly showForbidden = computed(() => !this.canRead() || this.forbidden());

  protected readonly searchDraft = signal('');
  protected readonly rows = signal<SerialUnit[]>([]);
  protected readonly total = signal(0);
  protected readonly counts = signal<SerialCounts>(EMPTY_COUNTS);
  protected readonly nonSerialItemIds = signal<readonly string[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly errorMessageKey = signal('tradeInventory.errors.generic');

  protected readonly hasActiveFilters = computed(
    () => Boolean(this.itemId() || this.serialFilter() || this.stateFilter()),
  );

  protected readonly steps = computed<StepOption[]>(() => {
    this.i18n();
    const c = this.counts();
    return [
      {
        id: '',
        label: this.transloco.translate('invEvidence.serials.steps.all'),
        count: c.all,
      },
      ...SERIAL_STATES.map((state) => ({
        id: state,
        label: this.transloco.translate(`tradeInventory.badge.serial.${state}`),
        count: c[state],
      })),
    ];
  });

  private listSeq = 0;
  private countsSeq = 0;
  private itemsSeq = 0;
  private lastCountsKey: string | null = null;
  private lastCompanyId: string | null = null;
  private openedModalId: string | null = null;
  private pendingScanAutoOpen = false;
  private destroyed = false;

  constructor() {
    effect(() => {
      const serial = this.serialFilter();
      untracked(() => {
        if (this.searchDraft() !== serial) {
          this.searchDraft.set(serial);
        }
      });
    });

    effect(() => {
      const ctx = this.companyContext();
      const companyId = ctx.companyId ?? '';
      const allowed = this.canRead();
      if (this.lastCompanyId !== companyId) {
        this.lastCompanyId = companyId;
        this.forbidden.set(false);
      }
      if (!allowed) {
        untracked(() => this.nonSerialItemIds.set([]));
        return;
      }
      untracked(() => void this.loadNonSerialItemIds(ctx.companyId));
    });

    effect(() => {
      const itemId = this.itemId();
      const serialKey = this.serialFilter();
      const state = this.stateFilter();
      const page = this.page();
      const limit = this.pageSize();
      const allowed = this.canRead();
      this.scope.company();

      if (!allowed) {
        untracked(() => {
          this.rows.set([]);
          this.total.set(0);
          this.counts.set(EMPTY_COUNTS);
          this.loading.set(false);
          this.loadFailed.set(false);
        });
        return;
      }

      untracked(() => {
        void this.loadSerials({ itemId, serialKey, state, page, limit });
        const countsKey = `${this.lastCompanyId ?? ''}|${itemId}|${serialKey}`;
        if (countsKey !== this.lastCountsKey) {
          this.lastCountsKey = countsKey;
          void this.loadCounts(itemId, serialKey);
        }
      });
    });

    effect(() => {
      if (this.showForbidden()) return;
      const id = this.routeId();
      const modal = this.serialModal();
      if (!modal) return;
      if (id) {
        if (this.openedModalId !== id) {
          this.openedModalId = id;
          untracked(() => modal.open(id));
        }
      } else if (this.openedModalId !== null) {
        this.openedModalId = null;
        untracked(() => modal.closeSilently());
      }
    });

    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.listSeq += 1;
      this.countsSeq += 1;
      this.itemsSeq += 1;
    });
  }

  protected reload(): void {
    if (!this.canRead()) return;
    this.forbidden.set(false);
    this.pendingScanAutoOpen = false;
    const itemId = this.itemId();
    const serialKey = this.serialFilter();
    void this.loadSerials({
      itemId,
      serialKey,
      state: this.stateFilter(),
      page: this.page(),
      limit: this.pageSize(),
    });
    void this.loadCounts(itemId, serialKey);
  }

  protected goHome(): void {
    void this.router.navigate(['/']);
  }

  protected onForbidden(): void {
    this.forbidden.set(true);
  }

  protected onFrameEnter(event: Event): void {
    if (!this.isFrameSearchInput(event.target)) return;
    event.preventDefault();
    this.commitSerialSearch(true);
  }

  protected onFrameEscape(event: Event): void {
    if (!this.isFrameSearchInput(event.target)) return;
    this.searchDraft.set('');
    this.commitSerialSearch(false);
  }

  protected onFrameFocusout(event: FocusEvent): void {
    const target = event.target;
    if (!this.isFrameSearchInput(target)) return;
    const related = event.relatedTarget as Node | null;
    if (related && (target as HTMLElement).parentElement?.contains(related)) {
      return;
    }
    this.commitSerialSearch(false);
  }

  protected onFrameClick(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target || target.closest('[data-serial-notices]') || target.closest('[data-serial-body]')) {
      return;
    }
    const btn = target.closest('button');
    if (!btn) return;
    const clearLabel = this.transloco.translate('settings.common.clearSearch');
    if (btn.getAttribute('aria-label') === clearLabel) {
      this.searchDraft.set('');
      this.commitSerialSearch(false);
    }
  }

  protected onItemChange(nextItemId: string | null): void {
    const clean = nextItemId?.trim() || null;
    if ((clean ?? '') === this.itemId()) return;
    this.pendingScanAutoOpen = false;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { item: clean, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onStateChange(nextState: string): void {
    const parsed = parseStateFilter(nextState);
    if (parsed === this.stateFilter()) return;
    this.pendingScanAutoOpen = false;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { state: parsed || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onPageChange(nextPage: number): void {
    const clean = Math.max(DEFAULT_PAGE, nextPage);
    if (clean === this.page()) return;
    this.pendingScanAutoOpen = false;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: clean === DEFAULT_PAGE ? null : clean },
      queryParamsHandling: 'merge',
    });
  }

  protected onPageSizeChange(nextSize: number): void {
    if (!PAGE_SIZES.includes(nextSize) || nextSize === this.pageSize()) return;
    this.pendingScanAutoOpen = false;
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
    this.pendingScanAutoOpen = false;
    this.searchDraft.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { item: null, serial: null, state: null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected openSerial(row: SerialUnit): void {
    void this.router.navigate(['/trade/inventory/serials', row.id], {
      queryParamsHandling: 'preserve',
    });
  }

  protected onRowKeydown(event: KeyboardEvent, row: SerialUnit): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openSerial(row);
    }
  }

  protected onModalClosed(): void {
    this.openedModalId = null;
    if (this.routeId()) {
      void this.router.navigate(['/trade/inventory/serials'], {
        queryParamsHandling: 'preserve',
      });
    }
  }

  protected itemLabel(row: SerialUnit): string {
    return itemName(row.itemNames, this.language());
  }

  protected formatDateTime(iso: string): string {
    return formatDateTime(iso);
  }

  protected rowActions(_row: SerialUnit): ActionItem[] {
    this.i18n();
    return [
      {
        id: 'open',
        title: this.transloco.translate('invEvidence.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'copySerial',
        title: this.transloco.translate('invEvidence.serials.actions.copySerial'),
        icon: 'tablerCopy',
        tile: 'bg-icon-gray',
      },
    ];
  }

  protected onRowAction(row: SerialUnit, selection: ActionSelection): void {
    if (selection.id === 'open') {
      this.openSerial(row);
      return;
    }
    if (selection.id === 'copySerial') {
      void this.copySerial(row.serialKey);
    }
  }

  private commitSerialSearch(fromScanEnter: boolean): void {
    const trimmed = this.searchDraft().trim();
    if (this.searchDraft() !== trimmed) {
      this.searchDraft.set(trimmed);
    }
    this.pendingScanAutoOpen = fromScanEnter && trimmed.length > 0;

    if (trimmed === this.serialFilter()) {
      if (this.pendingScanAutoOpen) {
        this.reloadWithCurrentScan();
      }
      return;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        serial: trimmed || null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  private reloadWithCurrentScan(): void {
    const itemId = this.itemId();
    const serialKey = this.serialFilter();
    void this.loadSerials({
      itemId,
      serialKey,
      state: this.stateFilter(),
      page: this.page(),
      limit: this.pageSize(),
    });
  }

  private isFrameSearchInput(target: EventTarget | null): target is HTMLInputElement {
    return (
      target instanceof HTMLInputElement &&
      !target.closest('[data-serial-notices]') &&
      !target.closest('[data-serial-body]')
    );
  }

  private async loadSerials(params: {
    itemId: string;
    serialKey: string;
    state: StateFilter;
    page: number;
    limit: number;
  }): Promise<void> {
    if (!this.canRead()) {
      this.loading.set(false);
      return;
    }
    const seq = ++this.listSeq;
    this.loading.set(true);
    this.loadFailed.set(false);

    try {
      const res = await listSerials(
        {
          itemId: params.itemId || undefined,
          serialKey: params.serialKey || undefined,
          state: params.state || undefined,
          page: params.page,
          limit: params.limit,
        },
        this.companyContext(),
      );
      if (this.destroyed || seq !== this.listSeq) return;

      this.rows.set(res.items);
      this.total.set(res.total);
      this.loading.set(false);

      const shouldAutoOpen = this.pendingScanAutoOpen;
      this.pendingScanAutoOpen = false;
      if (shouldAutoOpen && params.serialKey && res.items.length === 1 && !this.routeId()) {
        this.openSerial(res.items[0]);
      }
    } catch (error) {
      if (this.destroyed || seq !== this.listSeq) return;
      this.pendingScanAutoOpen = false;
      this.rows.set([]);
      this.total.set(0);
      this.loading.set(false);
      if (isForbiddenError(error)) {
        this.loadFailed.set(false);
        this.forbidden.set(true);
        return;
      }
      this.loadFailed.set(true);
      this.errorMessageKey.set(errorKey(error));
    }
  }

  private async loadCounts(itemId: string, serialKey: string): Promise<void> {
    if (!this.canRead()) return;
    const seq = ++this.countsSeq;
    const ctx = this.companyContext();
    const base = {
      itemId: itemId || undefined,
      serialKey: serialKey || undefined,
      page: 1,
      limit: 1,
    };

    try {
      const [all, onHand, reserved, delivered, voided] = await Promise.all([
        listSerials(base, ctx),
        listSerials({ ...base, state: 'ON_HAND' }, ctx),
        listSerials({ ...base, state: 'RESERVED' }, ctx),
        listSerials({ ...base, state: 'DELIVERED' }, ctx),
        listSerials({ ...base, state: 'VOIDED' }, ctx),
      ]);
      if (this.destroyed || seq !== this.countsSeq) return;
      this.counts.set({
        all: all.total,
        ON_HAND: onHand.total,
        RESERVED: reserved.total,
        DELIVERED: delivered.total,
        VOIDED: voided.total,
      });
    } catch (error) {
      if (this.destroyed || seq !== this.countsSeq) return;
      this.counts.set(EMPTY_COUNTS);
      if (isForbiddenError(error)) {
        this.loadFailed.set(false);
        this.forbidden.set(true);
      }
    }
  }

  private async loadNonSerialItemIds(companyId: string | undefined): Promise<void> {
    const seq = ++this.itemsSeq;
    if (!companyId) {
      this.nonSerialItemIds.set([]);
      return;
    }

    try {
      const page = await searchItemSummaries(
        { companyId },
        { itemKind: 'PRODUCT', limit: 100 },
      );
      if (this.destroyed || seq !== this.itemsSeq) return;
      const excluded = page.items
        .filter((item) => !item.companyProfile?.trackInventory || item.trackingMode !== 'SERIAL')
        .map((item) => item.id);
      this.nonSerialItemIds.set(excluded);
    } catch {
      if (this.destroyed || seq !== this.itemsSeq) return;
      this.nonSerialItemIds.set([]);
    }
  }

  private async copySerial(serialKey: string): Promise<void> {
    const clean = serialKey.trim();
    if (!clean) return;
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(clean);
      this.notify.success(this.transloco.translate('tradeInventory.common.copied'));
    } catch {
      this.notify.error(this.transloco.translate('tradeInventory.errors.generic'));
    }
  }
}
