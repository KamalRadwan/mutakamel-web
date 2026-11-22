import { formatMoneyDisplay } from '../../../shared/record/fields/money-field/money-format';
import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCopy,
  tablerEye,
  tablerFilter,
  tablerLayoutDashboard,
  tablerLayoutGrid,
  tablerPlus,
  tablerSearch,
  tablerShare,
  tablerStar,
  tablerTable,
  tablerTarget,
  tablerTemplate,
  tablerTrash,
  tablerUsers,
  tablerX,
} from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { DASH, formatDate } from '../../../../../shared/ui/chart/chart-format';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DataCell, DataColumn, DataSort, DataTable } from '../../../../../shared/ui/data-table/data-table';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { TabItem, Tabs, tabButtonId, tabPanelId } from '../../../../../shared/ui/tabs/tabs';
import { ViewOption, ViewSwitcher } from '../../../../../shared/ui/view-switcher/view-switcher';
import { ApiError, errorCodeOf, newIdempotencyKey } from '../../../../../shared/widgets/dashboard/analytics-api';
import { can, scopeLevels } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { FAKE_BRANCHES } from '../../../../../shared/widgets/dashboard/fake/fake-org';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { ShareApi, ShareModal } from '../../shared/share-modal/share-modal';
import { CreateDashboardModal } from '../create-dashboard-modal/create-dashboard-modal';
import {
  addDashboardShare,
  adoptBlueprint,
  deleteDashboard,
  duplicateDashboard,
  getDashboard,
  listBlueprints,
  listDashboardShares,
  listDashboards,
  previewDashboardShare,
  revokeDashboardShare,
  setDefaultDashboard,
  setFavoriteDashboard,
  updateDashboardShare,
} from '../dashboards.api';
import { listShareTargets } from '../../../../../shared/widgets/dashboard/analytics.api';
import type { BlueprintItem, DashboardDetail, DashboardSummary } from '../dashboards.model';
import { LayoutThumb } from '../layout-thumb/layout-thumb';
import { selectScopeTranslation } from '../../../../../shared/widgets/dashboard/scope-translation';

type LibraryTab = 'all' | 'mine' | 'shared' | 'templates';
type LibraryView = 'table' | 'cards';
type KindFilter = 'ALL' | 'DASHBOARD' | 'REPORT';

const PAGE_LIMIT = 20;

@Component({
  selector: 'app-dashboards-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Badge,
    Dropdown,
    ViewSwitcher,
    Tabs,
    DataTable,
    DataCell,
    ActionsMenu,
    ConfirmDialog,
    FullState,
    Modal,
    Field,
    LayoutThumb,
    CreateDashboardModal,
    ShareModal,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-dash-library', alias: 'dashLibrary' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({
      tablerPlus,
      tablerSearch,
      tablerX,
      tablerStar,
      tablerStarFill,
      tablerFilter,
      tablerLayoutGrid,
      tablerTable,
      tablerLayoutDashboard,
      tablerUsers,
      tablerTemplate,
      tablerTarget,
      tablerEye,
      tablerCopy,
      tablerShare,
      tablerTrash,
    }),
  ],
  templateUrl: './dashboards-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class DashboardsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly libraryScope = toSignal(selectScopeTranslation(this.transloco, 'crm-dash-library', 'dashLibrary'));
  private readonly queryParams = toSignal(this.route.queryParamMap);
  protected readonly language = inject(LanguageState).current;

  private readonly createModal = viewChild.required(CreateDashboardModal);
  private readonly shareModal = viewChild.required(ShareModal);
  private readonly confirmDeleteDialog = viewChild.required<ConfirmDialog>('deleteConfirm');
  private readonly targetsModal = viewChild.required<Modal>('targetsModal');

  protected readonly tabButtonId = tabButtonId;
  protected readonly tabPanelId = tabPanelId;
  protected readonly dash = DASH;
  protected readonly skeletonRows = [0, 1, 2, 3, 4, 5] as const;

  protected readonly canRead = can('crm.dashboards.read');
  protected readonly canCreate = can('crm.dashboards.create');
  protected readonly canShare = can('crm.dashboards.share');
  protected readonly canDelete = can('crm.dashboards.delete');

  private dashboardsLoadSeq = 0;
  private blueprintsLoadSeq = 0;
  private sharingDashboardId: string | null = null;
  private readonly detailRequested = new Set<string>();
  private readonly shareCountRequested = new Set<string>();

  protected readonly activeTab = linkedSignal<string | null, LibraryTab>({
    source: () => this.queryParams()?.get('tab') ?? null,
    computation: (param, prev) => {
      if (param === 'all' || param === 'mine' || param === 'shared' || param === 'templates') return param;
      return prev?.value ?? 'mine';
    },
  });

  protected readonly view = linkedSignal<string | null, LibraryView>({
    source: () => this.queryParams()?.get('view') ?? null,
    computation: (param, prev) => {
      if (param === 'table' || param === 'cards') return param;
      return prev?.value ?? 'table';
    },
  });

  protected readonly searchQuery = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly kindFilter = signal<KindFilter>('ALL');
  protected readonly favoritesOnly = signal(false);
  protected readonly tableSort = signal<DataSort | null>(null);

  protected readonly dashboards = signal<DashboardSummary[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loadingDashboards = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly dashboardsError = signal<'forbidden' | 'load-failure' | null>(null);

  protected readonly blueprints = signal<BlueprintItem[]>([]);
  protected readonly loadingBlueprints = signal(true);
  protected readonly blueprintsError = signal<'forbidden' | 'load-failure' | null>(null);

  protected readonly detailCache = signal<Record<string, DashboardDetail>>({});
  protected readonly shareCounts = signal<Record<string, number | 'unavailable'>>({});

  protected readonly deletingName = signal('');
  protected readonly adoptingKey = signal<string | null>(null);
  protected readonly pendingTemplate = signal<BlueprintItem | null>(null);
  protected readonly templateBranchId = signal<string>(FAKE_BRANCHES[0]?.id ?? '');

  protected readonly kindOptions = computed<DropdownOption<KindFilter>[]>(() => {
    this.i18n();
    this.libraryScope();
    return [
      { value: 'ALL', label: this.transloco.translate('dashLibrary.kind.all') },
      { value: 'DASHBOARD', label: this.transloco.translate('dashLibrary.kind.dashboards') },
      { value: 'REPORT', label: this.transloco.translate('dashLibrary.kind.reportTemplates') },
    ];
  });

  protected readonly viewOptions = computed<ViewOption[]>(() => {
    this.i18n();
    this.libraryScope();
    return [
      { id: 'table', icon: 'tablerTable', label: this.transloco.translate('dashLibrary.views.table') },
      { id: 'cards', icon: 'tablerLayoutGrid', label: this.transloco.translate('dashLibrary.views.cards') },
    ];
  });

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return FAKE_BRANCHES.map((branch) => ({
      value: branch.id,
      label: lang === 'ar' ? branch.name.ar : branch.name.en,
    }));
  });

  private readonly kindFilteredDashboards = computed<DashboardSummary[]>(() => {
    const kind = this.activeTab() === 'all' ? this.kindFilter() : 'ALL';
    const list = this.dashboards();
    return kind === 'ALL' ? list : list.filter((item) => item.kind === kind);
  });

  private readonly searchMatchedDashboards = computed<DashboardSummary[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.kindFilteredDashboards();
    if (!q) return list;
    return list.filter((item) => {
      const name = item.name.toLowerCase();
      const desc = (item.description ?? '').toLowerCase();
      const owner = (item.ownerName ?? '').toLowerCase();
      return name.includes(q) || desc.includes(q) || owner.includes(q);
    });
  });

  private readonly filteredDashboards = computed<DashboardSummary[]>(() => {
    const favOnly = this.favoritesOnly();
    const list = this.searchMatchedDashboards();
    return favOnly ? list.filter((item) => item.isFavorite) : list;
  });

  protected readonly mineDashboards = computed<DashboardSummary[]>(() =>
    this.filteredDashboards().filter(
      (item) => item.kind === 'DASHBOARD' && item.accessLevel === 'OWNER',
    ),
  );

  protected readonly sharedDashboards = computed<DashboardSummary[]>(() =>
    this.filteredDashboards().filter(
      (item) => item.kind === 'DASHBOARD' && item.accessLevel !== 'OWNER' && item.isShared,
    ),
  );

  protected readonly visibleBlueprints = computed<BlueprintItem[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.blueprints();
    if (!q) return list;
    return list.filter((bp) => {
      return (
        bp.name.toLowerCase().includes(q) ||
        (bp.nameAr ?? '').toLowerCase().includes(q) ||
        bp.description.toLowerCase().includes(q) ||
        (bp.descriptionAr ?? '').toLowerCase().includes(q)
      );
    });
  });

  protected readonly favouriteCount = computed<number>(() => {
    return this.searchMatchedDashboards().filter(
      (item) => (item.accessLevel === 'OWNER' || item.isShared) && item.isFavorite,
    ).length;
  });

  /** Tab counters come from the unfiltered list: search, kind and favourites filters never change them. */
  private readonly tabCounts = computed(() => {
    const list = this.dashboards();
    return {
      all: list.length,
      mine: list.filter((item) => item.kind === 'DASHBOARD' && item.accessLevel === 'OWNER').length,
      shared: list.filter((item) => item.kind === 'DASHBOARD' && item.accessLevel !== 'OWNER' && item.isShared).length,
      templates: this.blueprints().length,
    };
  });

  protected readonly tabs = computed<TabItem[]>(() => {
    this.i18n();
    this.libraryScope();
    const counts = this.tabCounts();
    return [
      {
        id: 'all',
        label: this.transloco.translate('dashLibrary.tabs.all'),
        icon: 'tablerLayoutDashboard',
        color: 'text-icon-violet',
        count: counts.all,
      },
      {
        id: 'mine',
        label: this.transloco.translate('dashLibrary.tabs.mine'),
        icon: 'tablerLayoutDashboard',
        color: 'text-icon-navy',
        count: counts.mine,
      },
      {
        id: 'shared',
        label: this.transloco.translate('dashLibrary.tabs.shared'),
        icon: 'tablerUsers',
        color: 'text-icon-blue',
        count: counts.shared,
      },
      {
        id: 'templates',
        label: this.transloco.translate('dashLibrary.tabs.templates'),
        icon: 'tablerTemplate',
        color: 'text-icon-teal',
        count: counts.templates,
      },
    ];
  });

  protected readonly visibleDashboards = computed<DashboardSummary[]>(() => {
    const tab = this.activeTab();
    if (tab === 'templates') return [];
    const base =
      tab === 'all' ? this.filteredDashboards() : tab === 'mine' ? this.mineDashboards() : this.sharedDashboards();
    const sort = this.tableSort();
    if (!sort) return base;

    const lang = this.language();
    const factor = sort.dir === 'desc' ? -1 : 1;
    return base.slice().sort((a, b) => {
      switch (sort.key) {
        case 'name':
          return a.name.localeCompare(b.name, lang) * factor;
        case 'owner':
          return (a.ownerName ?? '').localeCompare(b.ownerName ?? '', lang) * factor;
        case 'updated':
          return a.updatedAt.localeCompare(b.updatedAt) * factor;
        default:
          return 0;
      }
    });
  });

  protected readonly tableColumns = computed<DataColumn[]>(() => {
    this.i18n();
    this.libraryScope();
    return [
      { key: 'name', label: this.transloco.translate('dashLibrary.columns.name'), width: 2.2, sortable: true },
      { key: 'kind', label: this.transloco.translate('dashLibrary.columns.kind'), width: 1.1 },
      { key: 'owner', label: this.transloco.translate('dashLibrary.columns.owner'), width: 1.2, sortable: true },
      {
        key: 'sharedCount',
        label: this.transloco.translate('dashLibrary.columns.sharedCount'),
        width: 0.75,
        align: 'end',
      },
      {
        key: 'updated',
        label: this.transloco.translate('dashLibrary.columns.updated'),
        width: 1.05,
        sortable: true,
      },
      {
        key: 'default',
        label: this.transloco.translate('dashLibrary.columns.default'),
        width: 0.65,
        align: 'end',
      },
      {
        key: 'actions',
        label: this.transloco.translate('dashLibrary.columns.actions'),
        width: 0.45,
        align: 'end',
      },
    ];
  });

  protected readonly menuByItemId = computed<Record<string, ActionItem[]>>(() => {
    this.i18n();
    this.libraryScope();
    const map: Record<string, ActionItem[]> = {};
    for (const item of this.visibleDashboards()) {
      map[item.id] = this.buildActions(item);
    }
    return map;
  });

  protected readonly hasActiveFilters = computed(
    () =>
      this.searchQuery().trim().length > 0 ||
      (this.activeTab() === 'all' && this.kindFilter() !== 'ALL') ||
      this.favoritesOnly(),
  );

  protected readonly emptyConfig = computed<{ icon: string; tile: string; textKey: string }>(() => {
    const tab = this.activeTab();
    if (this.hasActiveFilters()) {
      return { icon: 'tablerSearch', tile: 'bg-icon-gray', textKey: 'dashLibrary.empty.filtered' };
    }
    if (tab === 'shared') {
      return { icon: 'tablerUsers', tile: 'bg-icon-blue', textKey: 'dashLibrary.empty.shared' };
    }
    if (tab === 'templates') {
      return { icon: 'tablerTemplate', tile: 'bg-icon-teal', textKey: 'dashLibrary.empty.templates' };
    }
    return { icon: 'tablerLayoutDashboard', tile: 'bg-icon-navy', textKey: 'dashLibrary.empty.mine' };
  });

  protected readonly rowKey = (row: DashboardSummary): string => row.id;

  constructor() {
    let destroyed = false;
    inject(DestroyRef).onDestroy(() => {
      destroyed = true;
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.dashboardsLoadSeq++;
      this.blueprintsLoadSeq++;
    });

    if (this.canRead) {
      void this.loadDashboards(true);
      void this.loadBlueprints();
    }

    effect(() => {
      const tab = this.activeTab();
      if (tab !== 'all' && untracked(() => this.kindFilter()) !== 'ALL') {
        untracked(() => {
          this.kindFilter.set('ALL');
          void this.loadDashboards(true);
        });
      }
    });

    effect(() => {
      if (!this.canRead || destroyed) return;
      if (this.activeTab() === 'templates' || this.view() !== 'cards') return;
      const items = this.visibleDashboards();
      const cache = untracked(() => this.detailCache());
      const missingIds = items
        .map((item) => item.id)
        .filter((id) => !cache[id] && !this.detailRequested.has(id));
      if (missingIds.length > 0) {
        untracked(() => this.fetchDetails(missingIds));
      }
    });

    effect(() => {
      if (!this.canRead || destroyed) return;
      if (this.activeTab() === 'templates') return;
      const items = this.visibleDashboards();
      const counts = untracked(() => this.shareCounts());
      const missingIds = items
        .filter((item) => item.isShared && counts[item.id] === undefined && !this.shareCountRequested.has(item.id))
        .map((item) => item.id);
      if (missingIds.length > 0) {
        untracked(() => this.fetchShareCounts(missingIds));
      }
    });
  }

  protected setTab(next: string): void {
    if (next !== 'all' && next !== 'mine' && next !== 'shared' && next !== 'templates') return;
    if (next === this.activeTab()) return;
    const shouldResetKind = next !== 'all' && this.kindFilter() !== 'ALL';
    if (shouldResetKind) {
      this.kindFilter.set('ALL');
    }
    this.activeTab.set(next);
    if (shouldResetKind) {
      void this.loadDashboards(true);
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: next === 'mine' ? null : next },
      queryParamsHandling: 'merge',
    });
  }

  protected setView(next: string): void {
    if (next !== 'table' && next !== 'cards') return;
    if (next === this.view()) return;
    this.view.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: next === 'table' ? null : next },
      queryParamsHandling: 'merge',
    });
  }

  protected onKindChange(next: KindFilter): void {
    if (this.activeTab() !== 'all' || next === this.kindFilter()) return;
    this.kindFilter.set(next);
    void this.loadDashboards(true);
  }

  protected toggleFavourites(): void {
    this.favoritesOnly.update((on) => !on);
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
    this.scheduleSearchReload(0);
  }

  protected onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.scheduleSearchReload(300);
  }

  private scheduleSearchReload(delay: number): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      void this.loadDashboards(false);
    }, delay);
  }

  protected async openCreate(): Promise<void> {
    if (!this.canCreate) return;
    const modal = this.createModal();
    const createdId = await modal.open();
    if (!createdId) return;
    const isBlank = modal.lastCreatedKind() === 'blank';
    await this.router.navigate(['/crm/dashboard/dashboards', createdId], {
      ...(isBlank ? { queryParams: { edit: '1' } } : {}),
    });
  }

  protected openDashboard(item: DashboardSummary): void {
    if (item.kind === 'REPORT' && item.blueprintKey) {
      void this.router.navigate(['/crm/reports/catalogue', item.blueprintKey, 'overview']);
      return;
    }
    void this.router.navigate(['/crm/dashboard/dashboards', item.id]);
  }

  protected openAdoptedBlueprint(bp: BlueprintItem): void {
    if (bp.adoption.state !== 'ADOPTED') return;
    void this.router.navigate(['/crm/dashboard/dashboards', bp.adoption.dashboardId]);
  }

  protected async useBlueprint(bp: BlueprintItem): Promise<void> {
    if (!this.canCreate || this.adoptingKey()) return;

    if (bp.targets.length > 0 || bp.branchSelectionRequired) {
      this.pendingTemplate.set(bp);
      this.templateBranchId.set(FAKE_BRANCHES[0]?.id ?? '');
      this.targetsModal().open();
      return;
    }

    await this.performAdopt(bp, undefined);
  }

  protected async confirmTemplateTargets(): Promise<void> {
    const bp = this.pendingTemplate();
    if (!bp || this.adoptingKey()) return;
    const branchId = bp.branchSelectionRequired ? this.templateBranchId() : undefined;
    const adopted = await this.performAdopt(bp, branchId);
    if (adopted) {
      this.pendingTemplate.set(null);
      this.targetsModal().close();
    }
  }

  protected cancelTemplateTargets(): void {
    if (this.adoptingKey()) return;
    this.pendingTemplate.set(null);
    this.targetsModal().close();
  }

  protected onTargetsModalClosed(): void {
    this.pendingTemplate.set(null);
  }

  protected onDefaultClick(item: DashboardSummary): void {
    if (item.isDefault) return;
    void this.setAsDefault(item);
  }

  protected async toggleFavorite(item: DashboardSummary): Promise<void> {
    const nextFav = !item.isFavorite;
    try {
      const updated = await setFavoriteDashboard(item.id, nextFav, newIdempotencyKey());
      this.patchDashboard(updated);
      this.notify.success(
        this.transloco.translate(
          updated.isFavorite ? 'dashLibrary.toast.favourited' : 'dashLibrary.toast.unfavourited',
        ),
      );
    } catch (error) {
      this.notify.error(this.translateError(errorCodeOf(error)));
    }
  }

  protected onAction(item: DashboardSummary, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
        this.openDashboard(item);
        break;
      case 'duplicate':
        void this.duplicateItem(item);
        break;
      case 'share':
        this.openShare(item);
        break;
      case 'default':
        if (!item.isDefault) void this.setAsDefault(item);
        break;
      case 'favourite':
        void this.toggleFavorite(item);
        break;
      case 'delete':
        void this.removeItem(item);
        break;
    }
  }

  protected async onSharesChanged(): Promise<void> {
    const id = this.sharingDashboardId;
    if (!id) return;
    try {
      const shares = await listDashboardShares(id);
      this.shareCounts.update((map) => ({ ...map, [id]: shares.length }));
      this.dashboards.update((list) =>
        list.map((row) => (row.id === id ? { ...row, isShared: shares.length > 0 } : row)),
      );
    } catch {
      this.shareCounts.update((map) => ({ ...map, [id]: 'unavailable' }));
    }
  }

  protected async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore() || this.loadingDashboards()) return;

    const seq = this.dashboardsLoadSeq;
    const kind = this.activeTab() === 'all' ? this.kindFilter() : 'ALL';
    this.loadingMore.set(true);
    try {
      const page = await listDashboards({
        ...(kind !== 'ALL' ? { kind } : {}),
        ...(this.searchQuery().trim() ? { search: this.searchQuery().trim() } : {}),
        cursor,
        limit: PAGE_LIMIT,
      });
      if (seq !== this.dashboardsLoadSeq) return;
      this.dashboards.update((existing) => {
        const seen = new Set(existing.map((row) => row.id));
        const additions = page.items.filter((row) => !seen.has(row.id));
        return [...existing, ...additions];
      });
      this.nextCursor.set(page.nextCursor);
    } catch (error) {
      if (seq !== this.dashboardsLoadSeq) return;
      this.notify.error(this.translateError(errorCodeOf(error)));
    } finally {
      if (seq === this.dashboardsLoadSeq) {
        this.loadingMore.set(false);
      }
    }
  }

  protected retryActive(): void {
    if (this.activeTab() === 'templates') {
      void this.loadBlueprints();
    } else {
      void this.loadDashboards(true);
    }
  }

  protected goHome(): void {
    void this.router.navigate(['/workspace/home']);
  }

  protected asDashboard(row: unknown): DashboardSummary {
    return row as DashboardSummary;
  }

  protected detailFor(id: string): DashboardDetail | null {
    return this.detailCache()[id] ?? null;
  }

  protected shareCountOf(id: string): number | 'unavailable' | null {
    return this.shareCounts()[id] ?? null;
  }

  protected actionsFor(id: string): ActionItem[] {
    return this.menuByItemId()[id] ?? [];
  }

  protected formatUpdated(iso: string): string {
    return formatDate(iso, this.language());
  }

  /** Blueprint targets are JSON numbers (`comparison.target`); shown with the money display rule. */
  protected formatTargetValue(value: number): string {
    return formatMoneyDisplay(String(value), this.language());
  }

  protected blueprintTitle(bp: BlueprintItem): string {
    return this.language() === 'ar' ? (bp.nameAr ?? bp.name) : bp.name;
  }

  protected blueprintDescription(bp: BlueprintItem): string {
    return this.language() === 'ar' ? (bp.descriptionAr ?? bp.description) : bp.description;
  }

  private async loadDashboards(reset: boolean): Promise<void> {
    const seq = ++this.dashboardsLoadSeq;
    const kind = this.activeTab() === 'all' ? this.kindFilter() : 'ALL';
    if (reset) {
      this.loadingDashboards.set(true);
      this.dashboardsError.set(null);
    }
    try {
      const page = await listDashboards({
        ...(kind !== 'ALL' ? { kind } : {}),
        ...(this.searchQuery().trim() ? { search: this.searchQuery().trim() } : {}),
        limit: PAGE_LIMIT,
      });
      if (seq !== this.dashboardsLoadSeq) return;
      this.dashboards.set(page.items);
      this.nextCursor.set(page.nextCursor);
    } catch (error) {
      if (seq !== this.dashboardsLoadSeq) return;
      this.dashboards.set([]);
      this.nextCursor.set(null);
      this.dashboardsError.set(error instanceof ApiError && error.status === 403 ? 'forbidden' : 'load-failure');
    } finally {
      if (seq === this.dashboardsLoadSeq) {
        this.loadingDashboards.set(false);
      }
    }
  }

  private async loadBlueprints(): Promise<void> {
    const seq = ++this.blueprintsLoadSeq;
    this.loadingBlueprints.set(true);
    this.blueprintsError.set(null);
    try {
      const res = await listBlueprints();
      if (seq !== this.blueprintsLoadSeq) return;
      this.blueprints.set(res.items);
    } catch (error) {
      if (seq !== this.blueprintsLoadSeq) return;
      this.blueprints.set([]);
      this.blueprintsError.set(error instanceof ApiError && error.status === 403 ? 'forbidden' : 'load-failure');
    } finally {
      if (seq === this.blueprintsLoadSeq) {
        this.loadingBlueprints.set(false);
      }
    }
  }

  private fetchDetails(ids: readonly string[]): void {
    for (const id of ids) {
      this.detailRequested.add(id);
      void getDashboard(id)
        .then((detail) => {
          this.detailCache.update((cache) => ({ ...cache, [id]: detail }));
        })
        .catch(() => {
          // Leave card thumbnail in placeholder state if lazy detail fetch fails.
        });
    }
  }

  private fetchShareCounts(ids: readonly string[]): void {
    for (const id of ids) {
      this.shareCountRequested.add(id);
      void listDashboardShares(id)
        .then((shares) => {
          this.shareCounts.update((cache) => ({ ...cache, [id]: shares.length }));
        })
        .catch(() => {
          this.shareCounts.update((cache) => ({ ...cache, [id]: 'unavailable' }));
        });
    }
  }

  private async duplicateItem(item: DashboardSummary): Promise<void> {
    if (!this.canCreate) return;
    try {
      const copy = await duplicateDashboard(item.id, null, newIdempotencyKey());
      this.notify.success(this.transloco.translate('dashLibrary.toast.duplicated'));
      await this.router.navigate(['/crm/dashboard/dashboards', copy.id]);
    } catch (error) {
      this.notify.error(this.translateError(errorCodeOf(error)));
    }
  }

  private openShare(item: DashboardSummary): void {
    if (item.accessLevel !== 'OWNER' || !this.canShare) return;
    this.sharingDashboardId = item.id;
    this.shareModal().open(this.shareApiFor(item.id), item.name, this.canShare && scopeLevels().includes('all'));
  }

  private shareApiFor(dashboardId: string): ShareApi {
    return {
      list: () => listDashboardShares(dashboardId),
      add: (body, key) => addDashboardShare(dashboardId, body, key),
      update: (shareId, body) => updateDashboardShare(dashboardId, shareId, body),
      revoke: (shareId, reason) => revokeDashboardShare(dashboardId, shareId, reason),
      targets: async (search) => (await listShareTargets('dashboards', search)).items,
      preview: (subjectType, subjectId) => previewDashboardShare(dashboardId, subjectType, subjectId),
    };
  }

  private async setAsDefault(item: DashboardSummary): Promise<void> {
    try {
      const updated = await setDefaultDashboard(item.id, newIdempotencyKey());
      this.dashboards.update((list) =>
        list.map((row) =>
          row.id === updated.id
            ? { ...row, ...this.summaryFromDetail(updated), isDefault: true }
            : { ...row, isDefault: false },
        ),
      );
      this.notify.success(this.transloco.translate('dashLibrary.toast.defaultSet'));
    } catch (error) {
      this.notify.error(this.translateError(errorCodeOf(error)));
    }
  }

  private async removeItem(item: DashboardSummary): Promise<void> {
    if (item.accessLevel !== 'OWNER' || !this.canDelete) return;
    this.deletingName.set(item.name);
    const confirmed = await this.confirmDeleteDialog().open();
    if (!confirmed) return;

    try {
      await deleteDashboard(item.id);
      this.dashboards.update((list) => list.filter((row) => row.id !== item.id));
      this.detailCache.update((cache) => {
        const copy = { ...cache };
        delete copy[item.id];
        return copy;
      });
      this.shareCounts.update((counts) => {
        const copy = { ...counts };
        delete copy[item.id];
        return copy;
      });
      this.notify.success(this.transloco.translate('dashLibrary.toast.deleted'));
    } catch (error) {
      this.notify.error(this.translateError(errorCodeOf(error)));
    }
  }

  private async performAdopt(bp: BlueprintItem, branchId: string | undefined): Promise<boolean> {
    this.adoptingKey.set(bp.key);
    try {
      const res = await adoptBlueprint(
        bp.key,
        {
          definitionRevision: bp.definitionRevision,
          ...(branchId ? { branchId } : {}),
          ...(bp.targets.length > 0 ? { confirmTargets: true as const } : {}),
        },
        newIdempotencyKey(),
      );
      this.notify.success(this.transloco.translate('dashLibrary.toast.adopted'));
      await this.router.navigate(['/crm/dashboard/dashboards', res.dashboardId]);
      return true;
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'CRM_DASHBOARD_BLUEPRINT_REVISION_CHANGED') {
        void this.loadBlueprints();
      }
      this.notify.error(this.translateError(code));
      return false;
    } finally {
      this.adoptingKey.set(null);
    }
  }

  private patchDashboard(detail: DashboardDetail): void {
    const patch = this.summaryFromDetail(detail);
    this.dashboards.update((list) => list.map((row) => (row.id === detail.id ? { ...row, ...patch } : row)));
    if (this.detailCache()[detail.id]) {
      this.detailCache.update((cache) => ({ ...cache, [detail.id]: detail }));
    }
  }

  private summaryFromDetail(detail: DashboardDetail): Omit<DashboardSummary, 'lastOpenedAt'> {
    return {
      id: detail.id,
      ownerUserId: detail.ownerUserId,
      ownerName: detail.ownerName,
      name: detail.name,
      description: detail.description,
      defaultFilters: detail.defaultFilters,
      sourceTemplateKey: detail.sourceTemplateKey,
      schemaVersion: detail.schemaVersion,
      revision: detail.revision,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
      accessLevel: detail.accessLevel,
      isShared: detail.isShared,
      isDefault: detail.isDefault,
      isFavorite: detail.isFavorite,
      kind: detail.kind,
      blueprintKey: detail.blueprintKey,
    };
  }

  private buildActions(item: DashboardSummary): ActionItem[] {
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('dashLibrary.menu.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];

    if (this.canCreate) {
      items.push({
        id: 'duplicate',
        title: this.transloco.translate('dashLibrary.menu.duplicate'),
        icon: 'tablerCopy',
        tile: 'bg-icon-gray',
      });
    }

    if (item.accessLevel === 'OWNER' && this.canShare) {
      items.push({
        id: 'share',
        title: this.transloco.translate('dashLibrary.menu.share'),
        icon: 'tablerShare',
        tile: 'bg-icon-violet',
      });
    }

    items.push({
      id: 'default',
      title: this.transloco.translate('dashLibrary.menu.setDefault'),
      icon: 'tablerStar',
      tile: 'bg-icon-orange',
      disabled: item.isDefault,
      reason: item.isDefault ? this.transloco.translate('dashLibrary.alreadyDefault') : undefined,
    });

    items.push({
      id: 'favourite',
      title: this.transloco.translate(
        item.isFavorite ? 'dashLibrary.menu.unfavourite' : 'dashLibrary.menu.favourite',
      ),
      icon: 'tablerStar',
      tile: 'bg-icon-orange',
    });

    if (item.accessLevel === 'OWNER' && this.canDelete) {
      items.push({
        id: 'delete',
        title: this.transloco.translate('dashLibrary.menu.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      });
    }

    return items;
  }

  private translateError(code: string | null): string {
    return this.transloco.translate(errorKey(code));
  }
}
