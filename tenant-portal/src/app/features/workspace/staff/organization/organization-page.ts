import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBuildingSkyscraper,
  tablerBuildingStore,
  tablerChevronDown,
  tablerChevronRight,
  tablerEdit,
  tablerEye,
  tablerHierarchy,
  tablerHierarchy2,
  tablerLayoutColumns,
  tablerListTree,
  tablerLock,
  tablerPlus,
  tablerRefresh,
  tablerSearch,
  tablerSitemap,
  tablerUsers,
  tablerUsersGroup,
  tablerX,
} from '@ng-icons/tabler-icons';
import { ActionItem } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { Switch } from '../../../../shared/ui/switch/switch';
import { ViewOption, ViewSwitcher } from '../../../../shared/ui/view-switcher/view-switcher';
import { StaffSession } from '../shared/staff-session';
import { errorCodeOf, getOrgTree } from '../shared/staff.api';
import { OrgTreeNode } from '../shared/staff.model';
import { OrgChart } from './org-chart/org-chart';
import {
  ORG_LEVEL_META,
  ORG_VIEW_MODES,
  OrgActionEvent,
  OrgViewMode,
  OrgViewNode,
  buildNodeActions,
  buildOrgViewTree,
} from './organization.model';
import { TreeColumns } from './tree-columns/tree-columns';
import { TreeRows } from './tree-rows/tree-rows';

const VIEW_ICONS: Record<OrgViewMode, string> = {
  rows: 'tablerListTree',
  columns: 'tablerLayoutColumns',
  chart: 'tablerHierarchy',
};

@Component({
  selector: 'app-organization-page',
  imports: [NgIcon, TranslocoPipe, Button, Field, Switch, ViewSwitcher, TreeRows, TreeColumns, OrgChart],
  providers: [
    provideTranslocoScope('settings', 'staff', { scope: 'staff-organization', alias: 'org' }),
    provideIcons({
      tablerBuildingSkyscraper,
      tablerBuildingStore,
      tablerSitemap,
      tablerUsersGroup,
      tablerUsers,
      tablerEye,
      tablerEdit,
      tablerPlus,
      tablerListTree,
      tablerLayoutColumns,
      tablerHierarchy,
      tablerHierarchy2,
      tablerSearch,
      tablerX,
      tablerRefresh,
      tablerChevronRight,
      tablerChevronDown,
      tablerLock,
    }),
  ],
  templateUrl: './organization-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class OrganizationPage {
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly session = inject(StaffSession);

  /** Bound from the `?view=` query parameter. */
  readonly view = input<string>();

  protected readonly currentView = linkedSignal<string | undefined, OrgViewMode>({
    source: () => this.view(),
    computation: (param) => (ORG_VIEW_MODES.includes(param as OrgViewMode) ? (param as OrgViewMode) : 'rows'),
  });

  protected readonly rawTree = signal<OrgTreeNode[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly tooLarge = signal(false);
  protected readonly search = signal('');
  protected readonly showInactive = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  private readonly baseExpandedIds = signal<ReadonlySet<string>>(new Set());
  private readonly searchExpandedOverrides = linkedSignal<string, Record<string, boolean>>({
    source: () => this.search().trim(),
    computation: () => ({}),
  });

  private loadSeq = 0;

  protected readonly canAddCompany = computed(() => this.session.isTenantWide('org.company.manage'));
  protected readonly isSearching = computed(() => this.search().trim().length > 0);

  protected readonly treeState = computed(() => {
    const meLoaded = this.session.me() !== null;
    return buildOrgViewTree(this.rawTree(), {
      showInactive: this.showInactive(),
      search: this.search(),
      canReadDepartments: (companyId, branchId) =>
        !meLoaded || this.session.can('org.department.read', { companyId, branchId }),
      canReadTeams: (companyId, branchId) =>
        !meLoaded || this.session.can('org.team.read', { companyId, branchId }),
    });
  });

  protected readonly effectiveExpandedIds = computed<ReadonlySet<string>>(() => {
    const base = this.baseExpandedIds();
    if (!this.isSearching()) return base;

    const next = new Set(base);
    for (const id of this.treeState().autoExpandIds) {
      next.add(id);
    }
    for (const [id, expanded] of Object.entries(this.searchExpandedOverrides())) {
      if (expanded) next.add(id);
      else next.delete(id);
    }
    return next;
  });

  protected readonly viewOptions = computed<ViewOption[]>(() => {
    this.i18n();
    return ORG_VIEW_MODES.map((id) => ({
      id,
      icon: VIEW_ICONS[id],
      label: this.transloco.translate(`org.views.${id}`),
    }));
  });

  protected readonly actionsForNode = computed<(node: OrgViewNode) => ActionItem[]>(() => {
    this.i18n();
    this.session.me();
    return (node: OrgViewNode) => buildNodeActions(node, this.session, (key) => this.transloco.translate(key));
  });

  constructor() {
    void this.load();
  }

  protected reload(): void {
    void this.load();
  }

  protected setView(next: string): void {
    const mode: OrgViewMode = ORG_VIEW_MODES.includes(next as OrgViewMode) ? (next as OrgViewMode) : 'rows';
    this.currentView.set(mode);
    void this.router.navigate([], {
      queryParams: { view: mode === 'rows' ? null : mode },
      queryParamsHandling: 'merge',
    });
  }

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.search.set('');
  }

  protected toggleExpand(id: string): void {
    if (this.isSearching()) {
      const nextValue = !this.effectiveExpandedIds().has(id);
      this.searchExpandedOverrides.update((map) => ({ ...map, [id]: nextValue }));
      return;
    }
    this.baseExpandedIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected expandAll(): void {
    const allIds = this.treeState().expandableIds;
    if (this.isSearching()) {
      const overrides: Record<string, boolean> = {};
      for (const id of allIds) overrides[id] = true;
      this.searchExpandedOverrides.set(overrides);
      return;
    }
    this.baseExpandedIds.set(new Set(allIds));
  }

  protected collapseAll(): void {
    if (this.isSearching()) {
      const overrides: Record<string, boolean> = {};
      for (const id of this.treeState().expandableIds) overrides[id] = false;
      this.searchExpandedOverrides.set(overrides);
      return;
    }
    this.baseExpandedIds.set(new Set());
  }

  protected openAddCompany(): void {
    if (!this.canAddCompany()) return;
    void this.router.navigate(['/workspace/staff/companies'], { queryParams: { new: 1 } });
  }

  protected openCompanies(): void {
    void this.router.navigate(['/workspace/staff/companies']);
  }

  protected onNodeAction(event: OrgActionEvent): void {
    const { node, action } = event;
    if (action === 'open' || action === 'edit') {
      void this.router.navigate([ORG_LEVEL_META[node.level].listRoute], {
        queryParams: { open: node.id },
      });
      return;
    }

    if (action === 'addChild') {
      if (node.level === 'company') {
        void this.router.navigate(['/workspace/staff/branches'], {
          queryParams: { new: 1, companyId: node.id },
        });
      } else if (node.level === 'branch') {
        void this.router.navigate(['/workspace/staff/departments'], {
          queryParams: { new: 1, branchId: node.id },
        });
      } else if (node.level === 'department') {
        void this.router.navigate(['/workspace/staff/teams'], {
          queryParams: { new: 1, departmentId: node.id },
        });
      }
      return;
    }

    if (action === 'viewUsers') {
      const paramKey =
        node.level === 'company'
          ? 'companyId'
          : node.level === 'branch'
            ? 'branchId'
            : node.level === 'department'
              ? 'departmentId'
              : 'teamId';
      void this.router.navigate(['/workspace/staff/users'], {
        queryParams: { [paramKey]: node.id },
      });
    }
  }

  private async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.tooLarge.set(false);

    try {
      const [, tree] = await Promise.all([this.session.load().catch(() => undefined), getOrgTree()]);
      if (seq !== this.loadSeq) return;
      this.rawTree.set(tree);
      this.baseExpandedIds.set(new Set(tree.map((company) => company.id)));
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (errorCodeOf(error) === 'ORG_TREE_TOO_LARGE') {
        this.tooLarge.set(true);
      } else {
        this.loadFailed.set(true);
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
