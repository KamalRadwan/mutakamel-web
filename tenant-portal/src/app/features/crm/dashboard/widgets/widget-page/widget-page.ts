import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Location } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustments,
  tablerArchive,
  tablerChartDots3,
  tablerCopy,
  tablerKey,
  tablerLayoutDashboard,
  tablerRestore,
  tablerShare,
  tablerTrash,
  tablerUserShare,
  tablerVersions,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { FullState, type FullStateKind } from '../../../../../shared/ui/full-state/full-state';
import { Tabs, type TabItem, tabButtonId, tabPanelId } from '../../../../../shared/ui/tabs/tabs';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ApiError, errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import { listShareTargets } from '../../../../../shared/widgets/dashboard/analytics.api';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { ShareModal, type ShareApi } from '../../shared/share-modal/share-modal';
import { WidgetBuilder } from '../builder/widget-builder';
import { ArchiveModal } from '../lifecycle-modals/archive-modal';
import { CloneModal } from '../lifecycle-modals/clone-modal';
import { TransferModal } from '../lifecycle-modals/transfer-modal';
import { addWidgetShare, deleteWidget, getWidget, listWidgetShares, previewWidgetShare, revokeWidgetShare, updateWidgetShare } from '../widgets.api';
import type { WidgetDetail } from '../widgets.model';
import { AccessTab } from './access-tab/access-tab';
import { UsageTab } from './usage-tab/usage-tab';
import { VersionsTab } from './versions-tab/versions-tab';

export type WidgetPageTab = 'builder' | 'usage' | 'access' | 'versions';

const VALID_TABS: readonly WidgetPageTab[] = ['builder', 'usage', 'access', 'versions'];

function parseWidgetTab(raw: string | null): WidgetPageTab | null {
  return raw && (VALID_TABS as readonly string[]).includes(raw) ? (raw as WidgetPageTab) : null;
}

@Component({
  selector: 'app-widget-page',
  imports: [
    TranslocoPipe,
    NgIcon,
    ActionsMenu,
    Badge,
    ConfirmDialog,
    FullState,
    Tabs,
    UnsavedDialog,
    WidgetBuilder,
    ArchiveModal,
    TransferModal,
    CloneModal,
    ShareModal,
    UsageTab,
    AccessTab,
    VersionsTab,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-widget-page', alias: 'widgetPage' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({
      tablerChartDots3,
      tablerAdjustments,
      tablerLayoutDashboard,
      tablerKey,
      tablerVersions,
      tablerCopy,
      tablerShare,
      tablerUserShare,
      tablerArchive,
      tablerRestore,
      tablerTrash,
    }),
  ],
  templateUrl: './widget-page.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col gap-8 p-12',
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class WidgetPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly builder = viewChild(WidgetBuilder);
  private readonly unsavedDialog = viewChild.required(UnsavedDialog);
  private readonly deleteDialog = viewChild.required<ConfirmDialog>('deleteDialog');
  private readonly archiveModal = viewChild.required(ArchiveModal);
  private readonly transferModal = viewChild.required(TransferModal);
  private readonly cloneModal = viewChild.required(CloneModal);
  private readonly shareModal = viewChild.required(ShareModal);
  private readonly shareHost = viewChild<ElementRef<HTMLElement>>('shareHost');

  protected readonly tabButtonId = tabButtonId;
  protected readonly tabPanelId = tabPanelId;

  protected readonly widgetId = signal<string | null>(null);
  protected readonly activeTab = signal<WidgetPageTab>('builder');
  protected readonly widget = signal<WidgetDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<FullStateKind | null>(null);
  protected readonly shareCount = signal<number | null>(null);
  protected readonly versionsCount = signal<number | null>(null);
  protected readonly accessRefresh = signal(0);
  private readonly builderRevision = signal(0);
  /** Identifies the mounted builder. It is not touched when a new widget gets its id from its first save. */
  private readonly builderSeed = signal('new');

  private loadSeq = 0;
  private confirmingLeave = false;
  private bypassGuard = false;

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect((onCleanup) => {
      const hostEl = this.shareHost()?.nativeElement;
      if (!hostEl) return;
      const onClose = () => {
        const id = this.widgetId();
        if (!id) return;
        this.accessRefresh.update((v) => v + 1);
        void this.loadWidget(id, { silent: true });
        void this.builder()?.refreshRevisions();
        if (this.canViewAccess()) {
          void listWidgetShares(id)
            .then((items) => {
              if (this.widgetId() === id) this.shareCount.set(items.length);
            })
            .catch(() => {});
        }
      };
      hostEl.addEventListener('close', onClose, { capture: true });
      onCleanup(() => hostEl.removeEventListener('close', onClose, { capture: true }));
    });

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      const rawTab = params.get('tab');

      if (!id) {
        this.loadSeq++;
        this.builderSeed.set('new');
        this.widgetId.set(null);
        this.activeTab.set('builder');
        this.widget.set(null);
        this.loading.set(false);
        this.loadError.set(null);
        this.shareCount.set(null);
        this.versionsCount.set(null);
        return;
      }

      const parsedTab = parseWidgetTab(rawTab);
      if (!parsedTab) {
        this.activeTab.set('builder');
        void this.router.navigate(['/crm/dashboard/widgets', id, 'builder'], { replaceUrl: true });
      } else {
        this.activeTab.set(parsedTab);
      }

      if (id !== this.widgetId()) {
        this.builderSeed.set(id);
        this.widgetId.set(id);
        this.widget.set(null);
        this.loadError.set(null);
        this.shareCount.set(null);
        this.versionsCount.set(null);
        void this.loadWidget(id);
      }
    });

    destroyRef.onDestroy(() => {
      this.loadSeq++;
    });
  }

  protected readonly isNew = computed(() => this.widgetId() === null);
  protected readonly isDirty = computed(() => this.builder()?.dirty() ?? false);
  protected readonly builderKey = computed(() => `${this.builderSeed()}:${this.builderRevision()}`);

  protected readonly pageTitle = computed(() => {
    this.i18n();
    const draftName = this.builder()?.draftName().trim();
    if (draftName) return draftName;
    const current = this.widget();
    if (current?.name) return current.name;
    return this.transloco.translate('widgetPage.newWidget');
  });

  protected readonly canViewAccess = computed(() => {
    const current = this.widget();
    if (!current) return false;
    return current.accessLevel === 'OWNER' || can('crm.widgets.share');
  });

  protected readonly tabs = computed<TabItem[]>(() => {
    this.i18n();
    this.language();
    const current = this.widget();
    if (!current) return [];

    const items: TabItem[] = [
      {
        id: 'builder',
        label: this.transloco.translate('widgetPage.tabs.builder'),
        icon: 'tablerAdjustments',
        color: 'text-icon-violet',
      },
      {
        id: 'usage',
        label: this.transloco.translate('widgetPage.tabs.usage'),
        icon: 'tablerLayoutDashboard',
        color: 'text-icon-blue',
        count: current.usage.dashboardCount,
      },
    ];

    if (this.canViewAccess()) {
      items.push({
        id: 'access',
        label: this.transloco.translate('widgetPage.tabs.access'),
        icon: 'tablerKey',
        color: 'text-icon-teal',
        count: this.shareCount() ?? current.usage.activeShareCount ?? null,
      });
    }

    items.push({
      id: 'versions',
      label: this.transloco.translate('widgetPage.tabs.versions'),
      icon: 'tablerVersions',
      color: 'text-icon-gray',
      count: this.versionsCount() ?? current.versionNumber ?? 0,
    });

    return items;
  });

  protected readonly actionItems = computed<ActionItem[]>(() => {
    this.i18n();
    this.language();
    const current = this.widget();
    if (!current) return [];

    const items: ActionItem[] = [];
    const canEdit = current.accessLevel === 'OWNER' || current.accessLevel === 'EDIT';

    if (can('crm.widgets.create')) {
      items.push({
        id: 'clone',
        title: this.transloco.translate('widgetPage.actions.clone'),
        icon: 'tablerCopy',
        tile: 'bg-icon-gray',
      });
    }

    if (canEdit && can('crm.widgets.share')) {
      items.push({
        id: 'share',
        title: this.transloco.translate('widgetPage.actions.share'),
        icon: 'tablerShare',
        tile: 'bg-icon-violet',
      });
    }

    // An admin action: the transfer permission alone (the backend does not require widget ownership).
    if (can('crm.widgets.transfer_ownership')) {
      items.push({
        id: 'transfer',
        title: this.transloco.translate('widgetPage.actions.transfer'),
        icon: 'tablerUserShare',
        tile: 'bg-icon-violet',
      });
    }

    // Archive/restore: widget OWNER plus `crm.widgets.delete` (dashboard-widget-lifecycle.service.ts authorize()).
    if (can('crm.widgets.delete') && current.accessLevel === 'OWNER') {
      if (current.status === 'PUBLISHED') {
        items.push({
          id: 'archive',
          title: this.transloco.translate('widgetPage.actions.archive'),
          icon: 'tablerArchive',
          tile: 'bg-icon-gray',
        });
      } else if (current.status === 'ARCHIVED') {
        items.push({
          id: 'restore',
          title: this.transloco.translate('widgetPage.actions.restore'),
          icon: 'tablerRestore',
          tile: 'bg-icon-gray',
        });
      }
    }

    const canDeleteWidget =
      can('crm.widgets.delete') &&
      current.accessLevel === 'OWNER' &&
      (current.status === 'DRAFT' || (current.status === 'ARCHIVED' && current.usage.placementCount === 0));

    if (canDeleteWidget) {
      items.push({
        id: 'delete',
        title: this.transloco.translate('widgetPage.actions.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      });
    }

    return items;
  });

  async canLeave(): Promise<boolean> {
    if (this.bypassGuard || this.loading() || this.loadError() !== null) {
      return true;
    }
    const currentBuilder = this.builder();
    if (!currentBuilder || !currentBuilder.dirty()) {
      return true;
    }
    if (this.confirmingLeave) {
      return false;
    }

    this.confirmingLeave = true;
    try {
      const choice = await this.unsavedDialog().open();
      if (choice === 'cancel') return false;
      if (choice === 'discard') return true;
      const saved = await currentBuilder.save();
      if (!saved && this.activeTab() !== 'builder' && this.widgetId()) {
        void this.router.navigate(['/crm/dashboard/widgets', this.widgetId(), 'builder']);
      }
      return saved;
    } finally {
      this.confirmingLeave = false;
    }
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty() && !this.bypassGuard) {
      event.preventDefault();
    }
  }

  protected onTabChange(nextTabId: string): void {
    const id = this.widgetId();
    const tab = parseWidgetTab(nextTabId);
    if (!id || !tab || tab === this.activeTab()) return;
    if (tab === 'access' && !this.canViewAccess()) return;
    void this.router.navigate(['/crm/dashboard/widgets', id, tab]);
  }

  protected onSaved(savedId: string): void {
    if (this.isNew()) {
      // Adopt the new id in place. A router navigation would rebuild the page and its builder,
      // which resets the step to 1 and destroys a publish modal that is still open.
      this.widgetId.set(savedId);
      this.activeTab.set('builder');
      this.location.replaceState(`/crm/dashboard/widgets/${savedId}/builder`);
      void this.loadWidget(savedId, { silent: true });
      return;
    }
    if (this.widgetId() === savedId) {
      void this.loadWidget(savedId, { silent: true });
    }
  }

  protected onPublished(): void {
    const id = this.widgetId();
    if (!id) return;
    this.versionsCount.set(null);
    void this.loadWidget(id, { silent: true });
  }

  protected onShareCountChange(count: number): void {
    this.shareCount.set(count);
  }

  protected onVersionsCountChange(count: number): void {
    this.versionsCount.set(count);
  }

  protected onVersionRestored(): void {
    const id = this.widgetId();
    if (!id) return;
    this.builderRevision.update((v) => v + 1);
    void this.loadWidget(id, { silent: true });
    void this.router.navigate(['/crm/dashboard/widgets', id, 'builder']);
  }

  protected retryLoad(): void {
    const id = this.widgetId();
    if (id) void this.loadWidget(id);
  }

  protected goToWidgets(): void {
    void this.router.navigate(['/crm/dashboard/widgets']);
  }

  protected async onActionSelected(selection: ActionSelection): Promise<void> {
    const current = this.widget();
    if (!current) return;

    switch (selection.id) {
      case 'clone': {
        const changed = await this.cloneModal().open(current);
        if (changed && this.widgetId() === current.id) {
          void this.loadWidget(current.id, { silent: true });
        }
        break;
      }
      case 'share': {
        const canAdmin = current.accessLevel !== 'OWNER' && can('crm.widgets.share');
        this.shareModal().open(this.createShareApi(current.id), current.name, canAdmin, 'widget');
        break;
      }
      case 'transfer': {
        const changed = await this.transferModal().open(current);
        if (changed && this.widgetId() === current.id) {
          void this.loadWidget(current.id, { silent: true });
          void this.builder()?.refreshRevisions();
        }
        break;
      }
      case 'archive':
      case 'restore': {
        const changed = await this.archiveModal().open(current);
        if (changed && this.widgetId() === current.id) {
          void this.loadWidget(current.id, { silent: true });
          void this.builder()?.refreshRevisions();
        }
        break;
      }
      case 'delete': {
        await this.confirmAndDelete(current);
        break;
      }
    }
  }

  private async confirmAndDelete(current: WidgetDetail): Promise<void> {
    const confirmed = await this.deleteDialog().open();
    if (!confirmed) return;

    try {
      await deleteWidget(current.id);
      this.notify.success(this.transloco.translate('widgetPage.delete.success'));
      this.bypassGuard = true;
      void this.router.navigate(['/crm/dashboard/widgets']).finally(() => {
        this.bypassGuard = false;
      });
    } catch (error) {
      this.notify.error(
        this.transloco.translate('widgetPage.delete.errorTitle'),
        this.transloco.translate(errorKey(errorCodeOf(error))),
      );
    }
  }

  private createShareApi(widgetId: string): ShareApi {
    return {
      list: () => listWidgetShares(widgetId),
      add: async (body, key) => {
        const created = await addWidgetShare(widgetId, body, key);
        this.accessRefresh.update((v) => v + 1);
        return created;
      },
      update: async (shareId, body) => {
        const updated = await updateWidgetShare(widgetId, shareId, body);
        this.accessRefresh.update((v) => v + 1);
        return updated;
      },
      revoke: async (shareId, reason) => {
        await revokeWidgetShare(widgetId, shareId, reason);
        this.accessRefresh.update((v) => v + 1);
      },
      targets: async (search) => (await listShareTargets('widgets', search)).items,
      preview: (subjectType, subjectId) => previewWidgetShare(widgetId, subjectType, subjectId),
    };
  }

  private async loadWidget(id: string, opts?: { silent?: boolean }): Promise<void> {
    const seq = ++this.loadSeq;
    if (!opts?.silent) {
      this.loading.set(true);
      this.loadError.set(null);
    }
    try {
      const detail = await getWidget(id);
      if (seq !== this.loadSeq || this.widgetId() !== id) return;
      this.widget.set(detail);
      this.loadError.set(null);
      if (this.activeTab() === 'access' && !this.canViewAccess()) {
        this.activeTab.set('builder');
        void this.router.navigate(['/crm/dashboard/widgets', id, 'builder'], { replaceUrl: true });
      }
    } catch (error) {
      if (seq !== this.loadSeq || this.widgetId() !== id) return;
      if (error instanceof ApiError && error.status === 404) {
        this.loadError.set('not-found');
        this.widget.set(null);
      } else if (error instanceof ApiError && error.status === 403) {
        this.loadError.set('forbidden');
        this.widget.set(null);
      } else if (!opts?.silent) {
        this.loadError.set('load-failure');
      }
    } finally {
      if (seq === this.loadSeq && !opts?.silent) {
        this.loading.set(false);
      }
    }
  }
}
