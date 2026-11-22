import { ActionItem } from '../../../../shared/ui/actions-menu/actions-menu';
import { StaffSession } from '../shared/staff-session';
import { OrgStatus, OrgTreeNode } from '../shared/staff.model';

export type OrgViewMode = 'rows' | 'columns' | 'chart';
export const ORG_VIEW_MODES: readonly OrgViewMode[] = ['rows', 'columns', 'chart'];

export type OrgLevel = 'company' | 'branch' | 'department' | 'team';

export interface OrgLevelMeta {
  icon: string;
  tile: string;
  band: string;
  typeKey: string;
  childrenKey: string | null;
  listRoute: string;
}

export const ORG_LEVEL_META: Readonly<Record<OrgLevel, OrgLevelMeta>> = {
  company: {
    icon: 'tablerBuildingSkyscraper',
    tile: 'bg-icon-navy',
    band: 'bg-icon-navy',
    typeKey: 'org.type.company',
    childrenKey: 'org.children.branches',
    listRoute: '/workspace/staff/companies',
  },
  branch: {
    icon: 'tablerBuildingStore',
    tile: 'bg-icon-teal',
    band: 'bg-icon-teal',
    typeKey: 'org.type.branch',
    childrenKey: 'org.children.departments',
    listRoute: '/workspace/staff/branches',
  },
  department: {
    icon: 'tablerSitemap',
    tile: 'bg-icon-orange',
    band: 'bg-icon-orange',
    typeKey: 'org.type.department',
    childrenKey: 'org.children.teams',
    listRoute: '/workspace/staff/departments',
  },
  team: {
    icon: 'tablerUsersGroup',
    tile: 'bg-icon-green',
    band: 'bg-icon-green',
    typeKey: 'org.type.team',
    childrenKey: null,
    listRoute: '/workspace/staff/teams',
  },
};

const LEVELS_BY_DEPTH: readonly OrgLevel[] = ['company', 'branch', 'department', 'team'];

export interface OrgViewNode {
  id: string;
  code: string;
  name: string;
  status: OrgStatus;
  level: OrgLevel;
  depth: 0 | 1 | 2 | 3;
  parentId: string | null;
  companyId: string;
  branchId: string | null;
  departmentId: string | null;
  teamId: string | null;
  isMatch: boolean;
  hasMatchingDescendant: boolean;
  hiddenByPermission: boolean;
  children: OrgViewNode[];
}

export interface OrgActionEvent {
  node: OrgViewNode;
  action: 'open' | 'edit' | 'addChild' | 'viewUsers';
}

export interface OrgTreeCounts {
  c: number;
  b: number;
  d: number;
  t: number;
}

export interface OrgViewTreeResult {
  tree: OrgViewNode[];
  matchCount: number;
  counts: OrgTreeCounts;
  expandableIds: string[];
  autoExpandIds: string[];
}

export interface BuildOrgTreeOptions {
  showInactive: boolean;
  search: string;
  canReadDepartments: (companyId: string, branchId: string) => boolean;
  canReadTeams: (companyId: string, branchId: string) => boolean;
}

export function buildOrgViewTree(raw: readonly OrgTreeNode[], options: BuildOrgTreeOptions): OrgViewTreeResult {
  const term = options.search.trim().toLowerCase();
  const counts: OrgTreeCounts = { c: 0, b: 0, d: 0, t: 0 };
  const expandableIds: string[] = [];
  const autoExpandIds: string[] = [];
  let matchCount = 0;

  const visit = (
    node: OrgTreeNode,
    depth: 0 | 1 | 2 | 3,
    parentId: string | null,
    companyId: string,
    branchId: string | null,
    departmentId: string | null,
    ancestorMatched: boolean,
  ): OrgViewNode | null => {
    if (!options.showInactive && node.status === 'INACTIVE') {
      return null;
    }

    const level = LEVELS_BY_DEPTH[depth] ?? 'team';
    const nextCompanyId = depth === 0 ? node.id : companyId;
    const nextBranchId = depth === 1 ? node.id : branchId;
    const nextDepartmentId = depth === 2 ? node.id : departmentId;
    const nextTeamId = depth === 3 ? node.id : null;

    const isMatch =
      term.length > 0 && (node.name.toLowerCase().includes(term) || node.code.toLowerCase().includes(term));

    const children: OrgViewNode[] = [];
    if (depth < 3) {
      const nextDepth = (depth + 1) as 0 | 1 | 2 | 3;
      for (const child of node.children) {
        const mapped = visit(
          child,
          nextDepth,
          node.id,
          nextCompanyId,
          nextBranchId,
          nextDepartmentId,
          ancestorMatched || isMatch,
        );
        if (mapped) {
          children.push(mapped);
        }
      }
    }

    const hasMatchingDescendant = children.some((child) => child.isMatch || child.hasMatchingDescendant);

    if (term.length > 0 && !isMatch && !hasMatchingDescendant && !ancestorMatched) {
      return null;
    }

    const hiddenByPermission =
      (level === 'branch' && node.children.length === 0 && !options.canReadDepartments(nextCompanyId, node.id)) ||
      (level === 'department' &&
        node.children.length === 0 &&
        nextBranchId !== null &&
        !options.canReadTeams(nextCompanyId, nextBranchId));

    if (isMatch) matchCount++;
    if (level === 'company') counts.c++;
    else if (level === 'branch') counts.b++;
    else if (level === 'department') counts.d++;
    else counts.t++;

    if (children.length > 0) {
      expandableIds.push(node.id);
    }
    if (hasMatchingDescendant) {
      autoExpandIds.push(node.id);
    }

    return {
      id: node.id,
      code: node.code,
      name: node.name,
      status: node.status,
      level,
      depth,
      parentId,
      companyId: nextCompanyId,
      branchId: nextBranchId,
      departmentId: nextDepartmentId,
      teamId: nextTeamId,
      isMatch,
      hasMatchingDescendant,
      hiddenByPermission,
      children,
    };
  };

  const tree: OrgViewNode[] = [];
  for (const company of raw) {
    const mapped = visit(company, 0, null, company.id, null, null, false);
    if (mapped) {
      tree.push(mapped);
    }
  }

  return { tree, matchCount, counts, expandableIds, autoExpandIds };
}

export function buildNodeActions(
  node: OrgViewNode,
  session: StaffSession,
  translate: (key: string) => string,
): ActionItem[] {
  const scopeReason = translate('staff.protected.scope');

  const canEdit =
    node.level === 'company'
      ? session.isTenantWide('org.company.manage')
      : node.level === 'branch'
        ? session.can('org.branch.manage', { companyId: node.companyId, branchId: node.id })
        : node.level === 'department'
          ? session.can('org.department.manage', {
              companyId: node.companyId,
              branchId: node.branchId ?? undefined,
            })
          : session.can('org.team.manage', {
              companyId: node.companyId,
              branchId: node.branchId ?? undefined,
            });

  const items: ActionItem[] = [
    {
      id: 'open',
      title: translate('org.actions.open'),
      icon: 'tablerEye',
      tile: 'bg-icon-blue',
    },
    {
      id: 'edit',
      title: translate('org.actions.edit'),
      icon: 'tablerEdit',
      tile: canEdit ? 'bg-icon-orange' : 'bg-icon-gray',
      disabled: !canEdit,
      reason: canEdit ? undefined : scopeReason,
    },
  ];

  if (node.level !== 'team') {
    const addTitleKey =
      node.level === 'company'
        ? 'org.actions.addBranch'
        : node.level === 'branch'
          ? 'org.actions.addDepartment'
          : 'org.actions.addTeam';

    const canAddChild =
      node.level === 'company'
        ? session.can('org.branch.manage', { companyId: node.id })
        : node.level === 'branch'
          ? session.can('org.department.manage', { companyId: node.companyId, branchId: node.id })
          : session.can('org.team.manage', {
              companyId: node.companyId,
              branchId: node.branchId ?? undefined,
            });

    items.push({
      id: 'addChild',
      title: translate(addTitleKey),
      icon: 'tablerPlus',
      tile: canAddChild ? 'bg-icon-green' : 'bg-icon-gray',
      disabled: !canAddChild,
      reason: canAddChild ? undefined : scopeReason,
    });
  }

  const canViewUsers = session.can('users.user.read', {
    companyId: node.companyId,
    branchId: node.branchId ?? undefined,
  });

  items.push({
    id: 'viewUsers',
    title: translate('org.actions.viewUsers'),
    icon: 'tablerUsers',
    tile: canViewUsers ? 'bg-icon-teal' : 'bg-icon-gray',
    disabled: !canViewUsers,
    reason: canViewUsers ? undefined : scopeReason,
  });

  return items;
}
