import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerBuildingWarehouse,
  tablerCheck,
  tablerCircleOff,
  tablerEye,
  tablerPencil,
  tablerPlus,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import {
  ActionsMenu,
  type ActionItem,
  type ActionSelection,
} from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { SettingsNotice } from '../../../../shared/ui/settings-notice/settings-notice';
import { StepFilter, type StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { ApiError, newIdempotencyKey } from '../../shared/trade-api';
import { INVENTORY_API_LIVE, listCompanyNodes, updateNode } from '../inventory.api';
import {
  INVENTORY_LIMITS,
  type CompanyNode,
  type NodeStatus,
} from '../inventory.model';
import { errorKey } from '../inventory.service';
import { InventoryBadge } from '../inventory-shared/inventory-badge/inventory-badge';
import { InventoryConflict } from '../inventory-shared/inventory-conflict/inventory-conflict';
import { NodeModal } from '../node-modal/node-modal';

const CAN_MANAGE_NODES = true; // later from the session permissions
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = INVENTORY_LIMITS.pageSize;
const PAGE_SIZES: number[] = [25, 50, 100];
const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;

type NodeStatusFilter = '' | NodeStatus;

interface NodeCounts {
  all: number;
  active: number;
  inactive: number;
}

function parseStatusParam(raw: string | undefined): NodeStatusFilter {
  const norm = raw?.trim().toUpperCase();
  if (norm === 'ACTIVE' || norm === 'INACTIVE') return norm;
  return '';
}

function parsePageParam(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 ? n : DEFAULT_PAGE;
}

function parseSizeParam(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE_SIZE;
  const n = Number(raw);
  return PAGE_SIZES.includes(n) ? n : DEFAULT_PAGE_SIZE;
}

@Component({
  selector: 'app-nodes-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    Modal,
    Pagination,
    SettingsFrame,
    SettingsNotice,
    StepFilter,
    InventoryBadge,
    InventoryConflict,
    NodeModal,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-inventory', alias: 'tradeInventory' }, { scope: 'trade-inventory-setup', alias: 'invSetup' }),
    provideIcons({
      tablerBuildingWarehouse,
      tablerEye,
      tablerPencil,
      tablerCircleOff,
      tablerCheck,
      tablerAlertTriangle,
      tablerPlus,
    }),
  ],
  templateUrl: './nodes-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class NodesPage {
  private static nextId = 0;
  protected readonly uid = `nodes-page-${++NodesPage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly scope = inject(ScopeState);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly nodeModal = viewChild.required(NodeModal);
  private readonly confirmToggle = viewChild.required<ConfirmDialog>('confirmToggle');
  private readonly conflictDialog = viewChild.required<InventoryConflict>('conflictDialog');
  private readonly inUseAlert = viewChild.required<Modal>('inUseAlert');

  /** Bound from route param `:id`. */
  readonly id = input<string | undefined>(undefined);
  /** Bound from `?status=`. */
  readonly statusParam = input<string | undefined>(undefined, { alias: 'status' });
  /** Bound from `?branch=`. */
  readonly branchParam = input<string | undefined>(undefined, { alias: 'branch' });
  /** Bound from `?q=`. */
  readonly qParam = input<string | undefined>(undefined, { alias: 'q' });
  /** Bound from `?page=`. */
  readonly pageParam = input<string | undefined>(undefined, { alias: 'page' });
  /** Bound from `?size=`. */
  readonly sizeParam = input<string | undefined>(undefined, { alias: 'size' });

  protected readonly canManage = CAN_MANAGE_NODES;
  protected readonly companyNodesLive = INVENTORY_API_LIVE.companyNodes;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly gridColumns =
    'grid-cols-trade-inv-node-row-actions';

  protected readonly searchInput = signal('');
  protected readonly rows = signal<readonly CompanyNode[]>([]);
  protected readonly total = signal(0);
  protected readonly counts = signal<NodeCounts | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly busyIds = signal<ReadonlySet<string>>(new Set());
  protected readonly pendingToggle = signal<{ node: CompanyNode; nextStatus: NodeStatus } | null>(null);

  private lastSyncedUrlQ = '';
  private lastOpenedRouteId: string | null = null;
  private lastCompanyId: string | null = null;
  private loadSeq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  protected readonly statusFilter = computed<NodeStatusFilter>(() =>
    parseStatusParam(this.statusParam()),
  );
  protected readonly branchFilter = computed(() => this.branchParam()?.trim() ?? '');
  protected readonly searchQuery = computed(() => this.qParam()?.trim() ?? '');
  protected readonly page = computed(() => parsePageParam(this.pageParam()));
  protected readonly pageSize = computed(() => parseSizeParam(this.sizeParam()));

  protected readonly hasActiveFilters = computed(
    () =>
      this.statusFilter() !== '' ||
      this.branchFilter() !== '' ||
      this.searchQuery() !== '',
  );

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    return [
      { value: '', label: this.transloco.translate('invSetup.nodes.filters.allBranches') },
      ...this.scope.branches().map((branch) => ({
        value: branch.id,
        label: lang === 'ar' ? branch.nameAr : branch.nameEn,
      })),
    ];
  });

  protected readonly branchNameById = computed(() => {
    const lang = this.language();
    const map = new Map<string, string>();
    for (const company of this.scope.companies()) {
      for (const branch of company.branches) {
        map.set(branch.id, lang === 'ar' ? branch.nameAr : branch.nameEn);
      }
    }
    for (const branch of this.scope.branches()) {
      map.set(branch.id, lang === 'ar' ? branch.nameAr : branch.nameEn);
    }
    return map;
  });

  protected readonly statusSteps = computed<StepOption[]>(() => {
    this.i18n();
    const counts = this.counts();
    return [
      {
        id: '',
        label: this.transloco.translate('invSetup.nodes.steps.all'),
        count: counts?.all ?? null,
      },
      {
        id: 'ACTIVE',
        label: this.transloco.translate('invSetup.nodes.steps.active'),
        count: counts?.active ?? null,
      },
      {
        id: 'INACTIVE',
        label: this.transloco.translate('invSetup.nodes.steps.inactive'),
        count: counts?.inactive ?? null,
      },
    ];
  });

  protected readonly totalNodesLabel = computed(() => {
    this.i18n();
    const count = this.total();
    const form = new Intl.PluralRules(this.language()).select(count);
    return this.transloco.translate(`invSetup.nodes.footerCount.${form}`, { count });
  });

  protected readonly toggleTitle = computed(() => {
    this.i18n();
    const pending = this.pendingToggle();
    if (!pending) return '';
    const key =
      pending.nextStatus === 'INACTIVE'
        ? 'invSetup.nodes.confirm.deactivateTitle'
        : 'invSetup.nodes.confirm.activateTitle';
    return this.transloco.translate(key, { code: pending.node.code });
  });

  protected readonly toggleText = computed(() => {
    this.i18n();
    const pending = this.pendingToggle();
    if (!pending) return '';
    return this.transloco.translate(
      pending.nextStatus === 'INACTIVE'
        ? 'invSetup.nodes.confirm.deactivateText'
        : 'invSetup.nodes.confirm.activateText',
    );
  });

  protected readonly toggleConfirmLabel = computed(() => {
    this.i18n();
    const pending = this.pendingToggle();
    if (!pending) return '';
    return this.transloco.translate(
      pending.nextStatus === 'INACTIVE'
        ? 'invSetup.nodes.actions.makeInactive'
        : 'invSetup.nodes.actions.makeActive',
    );
  });

  constructor() {
    effect(() => {
      const urlQ = this.searchQuery();
      if (urlQ === this.lastSyncedUrlQ) return;
      this.lastSyncedUrlQ = urlQ;
      untracked(() => {
        this.clearSearchTimer();
        this.searchInput.set(urlQ);
      });
    });

    effect(() => {
      const term = this.searchInput().trim();
      const currentQ = untracked(() => this.searchQuery());
      this.clearSearchTimer();
      if (term === currentQ) return;
      this.searchTimer = setTimeout(() => {
        this.searchTimer = null;
        this.lastSyncedUrlQ = term;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { q: term || null, page: null },
          queryParamsHandling: 'merge',
        });
      }, SEARCH_DEBOUNCE_MS);
    });

    effect(() => {
      const companyId = this.scope.company().id;
      const branches = this.scope.branches();
      const selectedBranch = this.branchFilter();
      if (this.lastCompanyId === null) {
        this.lastCompanyId = companyId;
        return;
      }
      if (this.lastCompanyId !== companyId) {
        this.lastCompanyId = companyId;
        if (selectedBranch && !branches.some((b) => b.id === selectedBranch)) {
          untracked(() => {
            void this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { branch: null, page: null },
              queryParamsHandling: 'merge',
              replaceUrl: true,
            });
          });
        }
      }
    });

    effect(() => {
      const status = this.statusFilter();
      const branch = this.branchFilter();
      const q = this.searchQuery();
      const page = this.page();
      const size = this.pageSize();
      this.scope.company();
      untracked(() => {
        void this.loadNodes(status, branch, q, page, size);
      });
    });

    effect(() => {
      const routeId = this.id()?.trim() ?? '';
      if (!routeId) {
        this.lastOpenedRouteId = null;
        return;
      }
      if (routeId === this.lastOpenedRouteId) return;
      this.lastOpenedRouteId = routeId;
      untracked(() => {
        this.nodeModal().openNode(routeId);
      });
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.clearSearchTimer();
    });
  }

  protected reload(): void {
    this.clearSearchTimer();
    const term = this.searchInput().trim();
    if (term !== this.searchQuery()) {
      this.lastSyncedUrlQ = term;
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { q: term || null, page: null },
        queryParamsHandling: 'merge',
      });
      return;
    }
    void this.loadNodes(
      this.statusFilter(),
      this.branchFilter(),
      this.searchQuery(),
      this.page(),
      this.pageSize(),
    );
  }

  protected openCreate(): void {
    if (!this.canManage) return;
    this.nodeModal().openCreate();
  }

  protected openNode(node: CompanyNode): void {
    void this.router.navigate(['/trade/inventory/fulfilment-nodes', node.id], {
      queryParamsHandling: 'preserve',
    });
  }

  protected onRowKeydown(event: KeyboardEvent, node: CompanyNode): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openNode(node);
    }
  }

  protected onBranchChange(branch: string): void {
    if (branch === this.branchFilter()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { branch: branch || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onStatusChange(next: string): void {
    const status = parseStatusParam(next);
    if (status === this.statusFilter()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: status || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onPageChange(nextPage: number): void {
    const safe = Math.max(DEFAULT_PAGE, nextPage);
    if (safe === this.page()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: safe === DEFAULT_PAGE ? null : safe },
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
    this.lastSyncedUrlQ = '';
    this.searchInput.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: null, branch: null, q: null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected activeBranchNames(node: CompanyNode): string[] {
    const map = this.branchNameById();
    return node.branches
      .filter((b) => b.isActive)
      .map((b) => map.get(b.branchId) ?? b.branchId);
  }

  protected visibleBranchNames(node: CompanyNode): string[] {
    return this.activeBranchNames(node).slice(0, 2);
  }

  protected extraBranchCount(node: CompanyNode): number {
    return Math.max(0, this.activeBranchNames(node).length - 2);
  }

  protected extraBranchNamesTitle(node: CompanyNode): string {
    return this.activeBranchNames(node).slice(2).join(', ');
  }

  protected rowActions(node: CompanyNode): ActionItem[] {
    this.i18n();
    const busy = this.busyIds().has(node.id);
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('invSetup.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];

    if (this.canManage) {
      items.push({
        id: 'edit',
        title: this.transloco.translate('invSetup.actions.edit'),
        icon: 'tablerPencil',
        tile: 'bg-icon-navy',
      });

      if (node.status === 'ACTIVE') {
        items.push({
          id: 'toggle',
          title: this.transloco.translate('invSetup.nodes.actions.makeInactive'),
          icon: 'tablerCircleOff',
          tile: busy ? 'bg-icon-gray' : 'bg-icon-red',
          danger: true,
          disabled: busy,
        });
      } else {
        items.push({
          id: 'toggle',
          title: this.transloco.translate('invSetup.nodes.actions.makeActive'),
          icon: 'tablerCheck',
          tile: busy ? 'bg-icon-gray' : 'bg-icon-green',
          disabled: busy,
        });
      }
    }

    return items;
  }

  protected onRowAction(node: CompanyNode, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.openNode(node);
        break;
      case 'toggle':
        void this.requestToggleStatus(node);
        break;
    }
  }

  protected onModalSaved(): void {
    this.reload();
  }

  protected onModalClosed(): void {
    this.lastOpenedRouteId = null;
    if (this.id()) {
      void this.router.navigate(['/trade/inventory/fulfilment-nodes'], {
        queryParamsHandling: 'preserve',
      });
    }
  }

  protected closeInUseAlert(): void {
    this.inUseAlert().close();
  }

  private async requestToggleStatus(node: CompanyNode): Promise<void> {
    if (!this.canManage || this.busyIds().has(node.id)) return;
    const nextStatus: NodeStatus = node.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.pendingToggle.set({ node, nextStatus });
    const confirmed = await this.confirmToggle().open();
    this.pendingToggle.set(null);
    if (!confirmed || this.destroyed) return;

    const key = newIdempotencyKey();
    this.setBusy(node.id, true);
    try {
      await updateNode(node.id, node.version, { status: nextStatus }, key);
      if (this.destroyed) return;
      const toastKey =
        nextStatus === 'ACTIVE'
          ? 'invSetup.nodes.toast.activated'
          : 'invSetup.nodes.toast.deactivated';
      this.notify.success(this.transloco.translate(toastKey, { code: node.code }));
      this.reload();
    } catch (error) {
      if (this.destroyed) return;
      if (error instanceof ApiError) {
        if (error.code === 'TRADE.INVENTORY.NODE_IN_USE') {
          this.inUseAlert().open();
          return;
        }
        if (error.code === 'TRADE.CONCURRENCY.STALE_VERSION') {
          this.conflictDialog().open();
          return;
        }
      }
      this.notify.error(this.transloco.translate(errorKey(error)));
    } finally {
      this.setBusy(node.id, false);
    }
  }

  private async loadNodes(
    status: NodeStatusFilter,
    branchId: string,
    search: string,
    page: number,
    limit: number,
  ): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);

    const commonFilter = {
      branchId: branchId || undefined,
      search: search || undefined,
    };

    try {
      const [listPage, allCountPage, activeCountPage, inactiveCountPage] = await Promise.all([
        listCompanyNodes({
          ...commonFilter,
          status: status || undefined,
          page,
          limit,
        }),
        listCompanyNodes({ ...commonFilter, page: 1, limit: 1 }),
        listCompanyNodes({ ...commonFilter, status: 'ACTIVE', page: 1, limit: 1 }),
        listCompanyNodes({ ...commonFilter, status: 'INACTIVE', page: 1, limit: 1 }),
      ]);
      if (seq !== this.loadSeq) return;
      this.rows.set(listPage.items);
      this.total.set(listPage.total);
      this.counts.set({
        all: allCountPage.total,
        active: activeCountPage.total,
        inactive: inactiveCountPage.total,
      });
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.rows.set([]);
      this.total.set(0);
      this.loadFailed.set(true);
      this.notify.error(this.transloco.translate(errorKey(error)));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private setBusy(id: string, busy: boolean): void {
    this.busyIds.update((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }
}
