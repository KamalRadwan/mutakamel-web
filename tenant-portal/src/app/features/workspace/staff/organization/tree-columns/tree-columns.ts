import { Component, computed, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBuildingSkyscraper,
  tablerBuildingStore,
  tablerEdit,
  tablerEye,
  tablerLock,
  tablerPlus,
  tablerSitemap,
  tablerUsers,
  tablerUsersGroup,
} from '@ng-icons/tabler-icons';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import { ORG_LEVEL_META, OrgActionEvent, OrgLevel, OrgLevelMeta, OrgViewNode } from '../organization.model';

interface OrgColumnView {
  level: OrgLevel;
  titleKey: string;
  items: OrgViewNode[];
  selectedId: string | null;
  emptyKey: string;
  emptyParams?: Record<string, unknown>;
  locked: boolean;
}

@Component({
  selector: 'app-org-tree-columns',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, StatusBadge],
  providers: [
    provideIcons({
      tablerBuildingSkyscraper,
      tablerBuildingStore,
      tablerSitemap,
      tablerUsersGroup,
      tablerUsers,
      tablerEye,
      tablerEdit,
      tablerPlus,
      tablerLock,
    }),
  ],
  templateUrl: './tree-columns.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class TreeColumns {
  readonly tree = input.required<OrgViewNode[]>();
  readonly actionsFor = input.required<(node: OrgViewNode) => ActionItem[]>();
  readonly action = output<OrgActionEvent>();

  protected readonly selectedCompanyId = signal<string | null>(null);
  protected readonly selectedBranchId = signal<string | null>(null);
  protected readonly selectedDepartmentId = signal<string | null>(null);
  protected readonly selectedTeamId = signal<string | null>(null);

  protected readonly companies = computed(() => this.tree());
  protected readonly selectedCompany = computed(
    () => this.companies().find((company) => company.id === this.selectedCompanyId()) ?? null,
  );
  protected readonly branches = computed(() => this.selectedCompany()?.children ?? []);
  protected readonly selectedBranch = computed(
    () => this.branches().find((branch) => branch.id === this.selectedBranchId()) ?? null,
  );
  protected readonly departments = computed(() => this.selectedBranch()?.children ?? []);
  protected readonly selectedDepartment = computed(
    () => this.departments().find((department) => department.id === this.selectedDepartmentId()) ?? null,
  );
  protected readonly teams = computed(() => this.selectedDepartment()?.children ?? []);
  protected readonly selectedTeam = computed(
    () => this.teams().find((team) => team.id === this.selectedTeamId()) ?? null,
  );

  protected readonly columns = computed<OrgColumnView[]>(() => {
    const company = this.selectedCompany();
    const branch = this.selectedBranch();
    const department = this.selectedDepartment();

    return [
      {
        level: 'company',
        titleKey: 'org.columns.companies',
        items: this.companies(),
        selectedId: company?.id ?? null,
        emptyKey: 'org.empty',
        locked: false,
      },
      {
        level: 'branch',
        titleKey: 'org.columns.branches',
        items: this.branches(),
        selectedId: branch?.id ?? null,
        emptyKey: company ? 'org.children.branches' : 'org.columns.chooseCompany',
        emptyParams: company ? { n: 0 } : undefined,
        locked: false,
      },
      {
        level: 'department',
        titleKey: 'org.columns.departments',
        items: this.departments(),
        selectedId: department?.id ?? null,
        emptyKey: branch ? 'org.children.departments' : 'org.columns.chooseBranch',
        emptyParams: branch ? { n: 0 } : undefined,
        locked: !!branch?.hiddenByPermission,
      },
      {
        level: 'team',
        titleKey: 'org.columns.teams',
        items: this.teams(),
        selectedId: this.selectedTeam()?.id ?? null,
        emptyKey: department ? 'org.children.teams' : 'org.columns.chooseDepartment',
        emptyParams: department ? { n: 0 } : undefined,
        locked: !!department?.hiddenByPermission,
      },
    ];
  });

  protected meta(level: OrgLevel): OrgLevelMeta {
    return ORG_LEVEL_META[level];
  }

  protected selectNode(node: OrgViewNode): void {
    if (node.level === 'company') {
      this.selectedCompanyId.set(node.id);
      this.selectedBranchId.set(null);
      this.selectedDepartmentId.set(null);
      this.selectedTeamId.set(null);
    } else if (node.level === 'branch') {
      this.selectedBranchId.set(node.id);
      this.selectedDepartmentId.set(null);
      this.selectedTeamId.set(null);
    } else if (node.level === 'department') {
      this.selectedDepartmentId.set(node.id);
      this.selectedTeamId.set(null);
    } else {
      this.selectedTeamId.set(node.id);
    }
  }

  protected onActionSelected(node: OrgViewNode, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
        this.action.emit({ node, action: 'open' });
        break;
      case 'edit':
        this.action.emit({ node, action: 'edit' });
        break;
      case 'addChild':
        this.action.emit({ node, action: 'addChild' });
        break;
      case 'viewUsers':
        this.action.emit({ node, action: 'viewUsers' });
        break;
    }
  }
}
