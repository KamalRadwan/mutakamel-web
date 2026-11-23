import { Component, computed, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { ApiError, errorCodeOf } from '../../../../core/api/api-errors';
import { LanguageState } from '../../../../core/i18n/language';
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
import { RouteError } from '../../../../shared/ui/route-error/route-error';
import { ViewOption, ViewSwitcher } from '../../../../shared/ui/view-switcher/view-switcher';
import { StaffSession } from '../shared/staff-session';
import { OrganizationReadApi } from '../shared/organization-read.api';
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
  imports: [NgIcon, TranslocoPipe, Button, Field, Switch, ViewSwitcher, TreeRows, TreeColumns, OrgChart, RouteError],
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
  private readonly language = inject(LanguageState).current;
  private readonly api = inject(OrganizationReadApi);
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
  protected readonly forbidden = signal(false);
  protected readonly tooLargeText = signal({ key: 'org.tooLarge', limit: '5000' });
  protected readonly search = signal('');
  protected readonly showInactive = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  private readonly baseExpandedIds = signal<ReadonlySet<string>>(new Set());
  private readonly searchExpandedOverrides = linkedSignal<string, Record<string, boolean>>({
    source: () => this.search().trim(),
    computation: () => ({}),
  });

  protected readonly canAddCompany = computed(() => this.session.isTenantWide('org.company.manage'));
  protected readonly isSearching = computed(() => this.search().trim().length > 0);

  protected readonly treeState = computed(() => {
    return buildOrgViewTree(this.rawTree(), {
      showInactive: this.showInactive(),
      search: this.search(),
      locale: this.language(),
      canReadCompany: (companyId) => this.session.can('org.company.read', { companyId }),
      canReadDepartments: (companyId, branchId) =>
        this.session.can('org.department.read', { companyId, branchId }),
      canReadTeams: (companyId, branchId) =>
        this.session.can('org.team.read', { companyId, branchId }),
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
    void this.session.load().catch(() => undefined);
    effect(() => {
      const scope = this.session.scopeRevision();
      const state = this.session.state();
      untracked(() => {
        this.rawTree.set([]);
        this.baseExpandedIds.set(new Set());
        this.forbidden.set(false);
        this.tooLarge.set(false);
        this.loadFailed.set(false);
        if (scope) {
          void this.load(scope);
        } else {
          this.loading.set(state === 'pending');
          this.loadFailed.set(state === 'failed');
        }
      });
    });
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
    if (!this.session.can('org.company.read')) return;
    void this.router.navigate(['/workspace/staff/companies']);
  }

  protected onNodeAction(event: OrgActionEvent): void {
    const { node, action } = event;
    const item = this.actionsForNode()(node).find(({ id }) => id === action);
    if (!item || item.disabled) return;
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

  private async load(scope = this.session.scopeRevision()): Promise<void> {
    if (!scope) return;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.tooLarge.set(false);
    this.forbidden.set(false);

    try {
      await this.session.load();
      if (scope !== this.session.scopeRevision()) return;
      const tree = await this.api.getTree();
      if (scope !== this.session.scopeRevision()) return;
      this.rawTree.set(tree);
      this.baseExpandedIds.set(new Set(tree.map((company) => company.id)));
    } catch (error) {
      if (scope !== this.session.scopeRevision()) return;
      if (error instanceof ApiError && error.status === 403) {
        this.rawTree.set([]);
        this.forbidden.set(true);
      } else if (errorCodeOf(error) === 'ORG_TREE_TOO_LARGE') {
        const details = error instanceof ApiError ? error.details : undefined;
        const kind = Array.isArray(details?.['nodeKind']) ? details['nodeKind'][0] : undefined;
        const limit = Array.isArray(details?.['limit']) ? details['limit'][0] : undefined;
        this.tooLargeText.set({
          key: ['companies', 'branches', 'departments', 'teams'].includes(kind)
            ? `org.tooLargeKind.${kind}` : 'org.tooLarge',
          limit: typeof limit === 'string' ? limit : '5000',
        });
        this.tooLarge.set(true);
      } else if (!(error instanceof ApiError && error.status === 0 && this.rawTree().length > 0)) {
        this.loadFailed.set(true);
      }
    } finally {
      if (scope === this.session.scopeRevision()) {
        this.loading.set(false);
      }
    }
  }
}
