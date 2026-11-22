import { Component, DestroyRef, computed, effect, inject, linkedSignal, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArchive,
  tablerChartBarOff,
  tablerChartDots3,
  tablerCopy,
  tablerEye,
  tablerLayoutGrid,
  tablerList,
  tablerNumber,
  tablerPlus,
  tablerRestore,
  tablerSearch,
  tablerShare,
  tablerTable,
  tablerTrash,
  tablerUser,
  tablerUserShare,
  tablerUsers,
  tablerWorld,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Badge, type BadgeTone } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { formatDate } from '../../../../../shared/ui/chart/chart-format';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DataCell, DataTable, type DataColumn } from '../../../../../shared/ui/data-table/data-table';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Tabs, type TabItem, tabButtonId, tabPanelId } from '../../../../../shared/ui/tabs/tabs';
import { ViewSwitcher, type ViewOption } from '../../../../../shared/ui/view-switcher/view-switcher';
import { listShareTargets } from '../../../../../shared/widgets/dashboard/analytics.api';
import { errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { ShareModal, type ShareApi } from '../../shared/share-modal/share-modal';
import { ArchiveModal } from '../lifecycle-modals/archive-modal';
import { CloneModal } from '../lifecycle-modals/clone-modal';
import { TransferModal } from '../lifecycle-modals/transfer-modal';
import {
  addWidgetShare,
  deleteWidget,
  getWidgetTabCounts,
  getWidgetUsageCounts,
  listOwnerOptions,
  listWidgetShares,
  listWidgets,
  previewWidgetShare,
  revokeWidgetShare,
  updateWidgetShare,
} from '../widgets.api';
import type {
  Visualization,
  WidgetAccessFilter,
  WidgetSourceResource,
  WidgetStatus,
  WidgetSummary,
  WidgetTabCounts,
} from '../widgets.model';

type LibraryTab = 'mine' | 'shared' | 'published';
type LibraryView = 'table' | 'cards';

const LIBRARY_TABS: readonly LibraryTab[] = ['mine', 'shared', 'published'];
const SOURCE_VALUES: readonly WidgetSourceResource[] = [
  'leads',
  'opportunities',
  'activities',
  'customer_profiles',
  'targets',
];
const STATUS_VALUES: readonly WidgetStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

const KPI_KINDS = new Set<Visualization>(['METRIC_CARD', 'MULTI_KPI', 'PROGRESS_CARD']);
const LIST_KINDS = new Set<Visualization>([
  'LEADERBOARD',
  'SCORECARD',
  'ALERT_LIST',
  'ACTIVITY_FEED',
  'TIMELINE',
  'CALENDAR',
]);

interface FamilyVisual {
  icon: string;
  tile: string;
}

const SKELETON_CARDS = [0, 1, 2, 3, 4, 5] as const;

@Component({
  selector: 'app-widgets-page',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Badge,
    Button,
    ConfirmDialog,
    DataCell,
    DataTable,
    Dropdown,
    Field,
    FullState,
    Tabs,
    ViewSwitcher,
    ShareModal,
    ArchiveModal,
    TransferModal,
    CloneModal,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-widgets', alias: 'widgets' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({
      tablerPlus,
      tablerSearch,
      tablerLayoutGrid,
      tablerTable,
      tablerChartDots3,
      tablerNumber,
      tablerList,
      tablerUserShare,
      tablerArchive,
      tablerRestore,
      tablerCopy,
      tablerShare,
      tablerEye,
      tablerTrash,
      tablerChartBarOff,
      tablerUser,
      tablerUsers,
      tablerWorld,
    }),
  ],
  templateUrl: './widgets-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class WidgetsPage {
  private static nextId = 0;
  protected readonly uid = `widgets-lib-${++WidgetsPage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly shareModal = viewChild.required(ShareModal);
  private readonly archiveModal = viewChild.required(ArchiveModal);
  private readonly transferModal = viewChild.required(TransferModal);
  private readonly cloneModal = viewChild.required(CloneModal);
  private readonly confirmDialog = viewChild.required(ConfirmDialog);

  protected readonly skeletonCards = SKELETON_CARDS;
  protected readonly tabButtonId = tabButtonId;
  protected readonly tabPanelId = tabPanelId;
  protected readonly canCreate = computed(() => can('crm.widgets.create'));

  protected readonly search = signal('');
  protected readonly sourceFilter = signal<'' | WidgetSourceResource>('');
  protected readonly ownerFilter = signal('');
  protected readonly statusFilter = signal<'' | WidgetStatus>('');
  protected readonly activeTab = signal<LibraryTab>('mine');

  protected readonly viewMode = linkedSignal<string | null, LibraryView>({
    source: () => this.queryParams()?.get('view') ?? null,
    computation: (param, previous) => {
      if (param === 'cards' || param === 'table') return param;
      return previous?.value ?? 'table';
    },
  });

  protected readonly ownerOptionsRaw = signal<{ id: string; name: string }[]>([]);
  protected readonly items = signal<WidgetSummary[]>([]);
  protected readonly usageCounts = signal<Record<string, number>>({});
  protected readonly tabCounts = signal<WidgetTabCounts | null>(null);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly failed = signal(false);
  protected readonly deletingName = signal('');

  private loadSeq = 0;
  private ownersSeq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly effectiveStatusFilter = computed<'' | WidgetStatus>(() =>
    this.activeTab() === 'published' ? 'PUBLISHED' : this.statusFilter(),
  );

  protected readonly hasActiveFilters = computed<boolean>(
    () =>
      Boolean(this.search().trim()) ||
      Boolean(this.sourceFilter()) ||
      Boolean(this.ownerFilter()) ||
      (this.activeTab() !== 'published' && Boolean(this.statusFilter())),
  );

  protected readonly viewOptions = computed<ViewOption[]>(() => {
    this.i18n();
    return [
      { id: 'table', icon: 'tablerTable', label: this.transloco.translate('widgets.views.table') },
      { id: 'cards', icon: 'tablerLayoutGrid', label: this.transloco.translate('widgets.views.cards') },
    ];
  });

  protected readonly sourceOptions = computed<DropdownOption<'' | WidgetSourceResource>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('widgets.allSources') },
      ...SOURCE_VALUES.map((value) => ({
        value,
        label: this.transloco.translate(`widgets.sources.${value}`),
      })),
    ];
  });

  protected readonly ownerOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('widgets.allOwners') },
      ...this.ownerOptionsRaw().map((owner) => ({
        value: owner.id,
        label: owner.name,
      })),
    ];
  });

  protected readonly statusOptions = computed<DropdownOption<'' | WidgetStatus>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('widgets.allStatuses') },
      ...STATUS_VALUES.map((value) => ({
        value,
        label: this.transloco.translate(`widgets.statusValue.${value}`),
      })),
    ];
  });

  protected readonly tabs = computed<TabItem[]>(() => {
    this.i18n();
    const counts = this.tabCounts();
    return [
      {
        id: 'mine',
        label: this.transloco.translate('widgets.tabs.mine'),
        icon: 'tablerUser',
        count: counts ? counts.mine : null,
      },
      {
        id: 'shared',
        label: this.transloco.translate('widgets.tabs.shared'),
        icon: 'tablerUsers',
        count: counts ? counts.shared : null,
      },
      {
        id: 'published',
        label: this.transloco.translate('widgets.tabs.published'),
        icon: 'tablerWorld',
        count: counts ? counts.published : null,
      },
    ];
  });

  protected readonly columns = computed<DataColumn[]>(() => {
    this.i18n();
    return [
      { key: 'name', label: this.transloco.translate('widgets.name'), width: 2.2 },
      { key: 'kind', label: this.transloco.translate('widgets.kind'), width: 1.3 },
      { key: 'status', label: this.transloco.translate('widgets.status'), width: 1.5 },
      { key: 'owner', label: this.transloco.translate('widgets.owner'), width: 1.2 },
      {
        key: 'usedOn',
        label: this.transloco.translate('widgets.usedOn'),
        width: 0.8,
        align: 'end',
        numeric: true,
      },
      { key: 'updated', label: this.transloco.translate('widgets.updated'), width: 1 },
      { key: 'actions', label: '', width: 0.4, align: 'end' },
    ];
  });

  protected readonly emptyMessageKey = computed<string>(() => {
    if (this.hasActiveFilters()) return 'widgets.empty.filtered';
    return `widgets.empty.${this.activeTab()}`;
  });

  protected readonly rowKey = (row: WidgetSummary): string => row.id;

  constructor() {
    effect(() => {
      this.language();
      untracked(() => {
        void this.loadOwners();
        void this.reloadAll();
      });
    });

    inject(DestroyRef).onDestroy(() => {
      this.clearSearchTimer();
      this.loadSeq++;
      this.ownersSeq++;
    });
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => {
      void this.reloadAll();
    }, 180);
  }

  protected onSourceChange(value: '' | WidgetSourceResource): void {
    this.sourceFilter.set(value);
    void this.reloadAll();
  }

  protected onOwnerChange(value: string): void {
    this.ownerFilter.set(value);
    void this.reloadAll();
  }

  protected onStatusChange(value: '' | WidgetStatus): void {
    this.statusFilter.set(value);
    if (this.activeTab() === 'published' && value !== 'PUBLISHED') {
      this.activeTab.set('mine');
    }
    void this.reloadAll();
  }

  protected onTabChange(tabId: string): void {
    if (!(LIBRARY_TABS as readonly string[]).includes(tabId)) return;
    const next = tabId as LibraryTab;
    if (next === this.activeTab()) return;
    this.activeTab.set(next);
    if (next === 'published') {
      this.statusFilter.set('');
    }
    void this.reloadListOnly();
  }

  protected onViewChange(view: string): void {
    if (view !== 'table' && view !== 'cards') return;
    this.viewMode.set(view);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view === 'table' ? null : view },
      queryParamsHandling: 'merge',
    });
  }

  protected clearFilters(): void {
    this.clearSearchTimer();
    this.search.set('');
    this.sourceFilter.set('');
    this.ownerFilter.set('');
    this.statusFilter.set('');
    void this.reloadAll();
  }

  protected reload(): void {
    void this.reloadAll();
  }

  protected loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore() || this.loading()) return;
    void this.fetchPage(cursor, true);
  }

  protected openWidget(widget: WidgetSummary): void {
    void this.router.navigate(['/crm/dashboard/widgets', widget.id, 'builder']);
  }

  protected onCardKeydown(event: KeyboardEvent, widget: WidgetSummary): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openWidget(widget);
    }
  }

  protected familyVisual(viz: Visualization | null): FamilyVisual {
    if (viz && KPI_KINDS.has(viz)) {
      return { icon: 'tablerNumber', tile: 'bg-icon-navy' };
    }
    if (viz === 'TABLE') {
      return { icon: 'tablerTable', tile: 'bg-icon-teal' };
    }
    if (viz && LIST_KINDS.has(viz)) {
      return { icon: 'tablerList', tile: 'bg-icon-orange' };
    }
    return { icon: 'tablerChartDots3', tile: 'bg-icon-violet' };
  }

  protected statusBadgeTone(status: WidgetStatus): BadgeTone {
    switch (status) {
      case 'PUBLISHED':
        return 'brand';
      case 'DRAFT':
        return 'tag';
      case 'ARCHIVED':
        return 'tag';
    }
  }

  protected usageCount(widgetId: string): number {
    return this.usageCounts()[widgetId] ?? 0;
  }

  protected formattedDate(iso: string): string {
    return formatDate(iso, this.language());
  }

  protected actionsFor(widget: WidgetSummary): ActionItem[] {
    this.i18n();
    const canWrite = widget.accessLevel === 'OWNER' || widget.accessLevel === 'EDIT';
    const isOwner = widget.accessLevel === 'OWNER';

    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('widgets.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];

    if (can('crm.widgets.create')) {
      items.push({
        id: 'clone',
        title: this.transloco.translate('widgets.actions.clone'),
        icon: 'tablerCopy',
        tile: 'bg-icon-gray',
      });
    }

    if (can('crm.widgets.share') && canWrite) {
      items.push({
        id: 'share',
        title: this.transloco.translate('widgets.actions.share'),
        icon: 'tablerShare',
        tile: 'bg-icon-violet',
      });
    }

    // An admin action: the transfer permission alone (the backend does not require widget ownership).
    if (can('crm.widgets.transfer_ownership')) {
      items.push({
        id: 'transfer',
        title: this.transloco.translate('widgets.actions.transfer'),
        icon: 'tablerUserShare',
        tile: 'bg-icon-violet',
      });
    }

    // Archive/restore: widget OWNER plus `crm.widgets.delete` (dashboard-widget-lifecycle.service.ts authorize()).
    if (widget.status === 'PUBLISHED' && can('crm.widgets.delete') && isOwner) {
      items.push({
        id: 'archive',
        title: this.transloco.translate('widgets.actions.archive'),
        icon: 'tablerArchive',
        tile: 'bg-icon-gray',
      });
    } else if (widget.status === 'ARCHIVED' && can('crm.widgets.delete') && isOwner) {
      items.push({
        id: 'restore',
        title: this.transloco.translate('widgets.actions.restore'),
        icon: 'tablerRestore',
        tile: 'bg-icon-gray',
      });
    }

    if (
      (widget.status === 'DRAFT' || widget.status === 'ARCHIVED') &&
      can('crm.widgets.delete') &&
      isOwner
    ) {
      items.push({
        id: 'delete',
        title: this.transloco.translate('widgets.actions.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      });
    }

    return items;
  }

  protected async onAction(widget: WidgetSummary, selection: ActionSelection): Promise<void> {
    switch (selection.id) {
      case 'open':
        this.openWidget(widget);
        break;
      case 'clone':
        await this.cloneModal().open(widget);
        break;
      case 'share':
        this.openShare(widget);
        break;
      case 'transfer':
        if (await this.transferModal().open(widget)) {
          await this.reloadAll();
        }
        break;
      case 'archive':
      case 'restore':
        if (await this.archiveModal().open(widget)) {
          await this.reloadAll();
        }
        break;
      case 'delete':
        await this.confirmAndDelete(widget);
        break;
    }
  }

  private openShare(widget: WidgetSummary): void {
    const api: ShareApi = {
      list: () => listWidgetShares(widget.id),
      add: (body, key) => addWidgetShare(widget.id, body, key),
      update: (shareId, body) => updateWidgetShare(widget.id, shareId, body),
      revoke: (shareId, reason) => revokeWidgetShare(widget.id, shareId, reason),
      preview: (subjectType, subjectId) => previewWidgetShare(widget.id, subjectType, subjectId),
      targets: async (search) => (await listShareTargets('widgets', search)).items,
    };
    this.shareModal().open(api, widget.name, widget.accessLevel === 'OWNER', 'widget');
  }

  private async confirmAndDelete(widget: WidgetSummary): Promise<void> {
    this.deletingName.set(widget.name);
    const confirmed = await this.confirmDialog().open();
    if (!confirmed) return;

    try {
      await deleteWidget(widget.id);
      this.notify.success(this.transloco.translate('widgets.deleteConfirm.deletedToast'));
      await this.reloadAll();
    } catch (error) {
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    }
  }

  private async loadOwners(): Promise<void> {
    const seq = ++this.ownersSeq;
    try {
      const page = await listOwnerOptions();
      if (seq !== this.ownersSeq) return;
      this.ownerOptionsRaw.set(page.items);
    } catch {
      // ignore non-blocking owner options failure; main list handles failure state
    }
  }

  private async reloadAll(): Promise<void> {
    await Promise.all([this.fetchPage(null, false), this.fetchTabCounts()]);
  }

  private async reloadListOnly(): Promise<void> {
    await this.fetchPage(null, false);
  }

  private buildListParams(): {
    search?: string;
    access?: WidgetAccessFilter;
    status?: WidgetStatus;
    source?: string;
    ownerUserId?: string;
  } {
    const tab = this.activeTab();
    const search = this.search().trim();
    const source = this.sourceFilter();
    const ownerUserId = this.ownerFilter();
    const status = this.statusFilter();

    return {
      ...(search ? { search } : {}),
      ...(tab === 'mine' ? { access: 'OWNED' as const } : tab === 'shared' ? { access: 'SHARED' as const } : {}),
      ...(tab === 'published'
        ? { status: 'PUBLISHED' as const }
        : status
          ? { status }
          : {}),
      ...(source ? { source } : {}),
      ...(ownerUserId ? { ownerUserId } : {}),
    };
  }

  private async fetchPage(cursor: string | null, append: boolean): Promise<void> {
    const seq = ++this.loadSeq;
    if (append) {
      this.loadingMore.set(true);
    } else {
      this.loading.set(true);
      this.failed.set(false);
    }

    try {
      const page = await listWidgets({ ...this.buildListParams(), cursor, limit: 20 });
      if (seq !== this.loadSeq) return;

      const counts = await getWidgetUsageCounts(page.items.map((item) => item.id));
      if (seq !== this.loadSeq) return;

      if (append) {
        this.items.update((prev) => [...prev, ...page.items]);
        this.usageCounts.update((prev) => ({ ...prev, ...counts }));
      } else {
        this.items.set(page.items);
        this.usageCounts.set(counts);
      }
      this.nextCursor.set(page.nextCursor);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (append) {
        this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
      } else {
        this.failed.set(true);
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    }
  }

  private async fetchTabCounts(): Promise<void> {
    const seq = this.loadSeq;
    try {
      const search = this.search().trim();
      const source = this.sourceFilter();
      const ownerUserId = this.ownerFilter();
      const status = this.statusFilter();
      const counts = await getWidgetTabCounts({
        ...(search ? { search } : {}),
        ...(source ? { source } : {}),
        ...(ownerUserId ? { ownerUserId } : {}),
        ...(status ? { status } : {}),
      });
      if (seq !== this.loadSeq) return;
      this.tabCounts.set(counts);
    } catch {
      // tab counters remain optional when main list fails
    }
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }
}
