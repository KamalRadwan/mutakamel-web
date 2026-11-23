import { inject, Injector, Injectable, signal } from '@angular/core';
import { CoreHttp, type CoreQuery } from '../../../core/api/core-http';
import { crmHttp, crmQueries } from '../../../features/crm/shared/crm-http';
import { WorkspaceLookups } from '../workspace-lookups/workspace-lookups.api';
import type { WorkspaceUser } from '../workspace-lookups/workspace-lookups.model';
import { analyticsNow, ApiError, type CursorPage } from './analytics-api';
import { can } from './analytics-permissions';
import { listShareTargets } from './analytics.api';
import type { OrgBranch, OrgTeam, OrgUser, OwnerOption, PipelineOption } from './analytics.model';

export type { OrgBranch, OrgTeam, OrgUser } from './analytics.model';
export { listShareTargets } from './analytics.api';

// CRM directory lookups have no organization scope headers; the server filters eligible targets.
export function listOwnerOptions(
  search = '', cursor: string | null = null, limit = 25, access?: 'OWNED' | 'SHARED' | 'TEAM',
): Promise<CursorPage<OwnerOption>> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'owner-options', search, cursor, limit, access],
    queryFn: () => crmHttp().read('/widgets/owner-options', { search, cursor, limit, access }),
  });
}

export function listTransferTargets(
  id: string, search = '', cursor: string | null = null, limit = 25,
): Promise<CursorPage<OwnerOption>> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'transfer-targets', id, search, cursor, limit],
    queryFn: () => crmHttp().read(`/widgets/${encodeURIComponent(id)}/ownership-transfer/targets`,
      { search, cursor, limit }),
  });
}

export function listPipelineOptions(): Promise<PipelineOption[]> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'pipelines'],
    queryFn: () => crmHttp().read('/pipelines'),
  });
}

function orgUser(user: WorkspaceUser): OrgUser {
  const name = `${user.firstName} ${user.lastName}`.trim();
  return { id: user.id, name, nameAr: name, email: user.email, teamId: user.teamId ?? '', branchId: user.branchId };
}

/** On-demand directory reads; snapshots contain only rows loaded from the server. */
@Injectable({ providedIn: 'root' })
export class OrgApi {
  private readonly injector = inject(Injector);
  private readonly branchRows = signal<readonly OrgBranch[]>([]);
  private readonly teamRows = signal<readonly OrgTeam[]>([]);
  private readonly userRows = signal<readonly OrgUser[]>([]);

  get branches(): readonly OrgBranch[] { return can('org.branch.read') ? this.branchRows() : []; }
  get teams(): readonly OrgTeam[] { return this.teamRows(); }
  get users(): readonly OrgUser[] { return this.userRows(); }

  async listBranches(): Promise<readonly OrgBranch[]> {
    if (!can('org.branch.read')) {
      this.branchRows.set([]);
      return [];
    }
    const rows = await this.injector.get(WorkspaceLookups).allBranches({ status: 'ACTIVE' });
    const branches = rows.filter((row) => row.status === 'ACTIVE').map((row) => ({
      id: row.id, companyId: row.companyId, name: { en: row.name, ar: row.name },
    }));
    this.branchRows.set(branches);
    return this.branches;
  }

  /** Dashboard keys are tenant-level: do not narrow these branches by dashboard grants. */
  listGrantedBranches(): Promise<readonly OrgBranch[]> {
    return this.listBranches();
  }

  async listTeams(branchId?: string): Promise<readonly OrgTeam[]> {
    if (!can('org.team.read') || !can('org.department.read')) {
      this.teamRows.set([]);
      return [];
    }
    const [teams, departments] = await Promise.all([
      this.directoryPages<{ id: string; name: string; departmentId: string }>('teams', { branchId }),
      this.directoryPages<{ id: string; branchId: string }>('departments', { branchId }),
    ]);
    const branchByDepartment = new Map(departments.map((row) => [row.id, row.branchId]));
    const rows = teams.flatMap((team) => {
      const branch = branchByDepartment.get(team.departmentId);
      return branch ? [{ id: team.id, name: { en: team.name, ar: team.name }, branchId: branch }] : [];
    });
    this.teamRows.set([...this.teams.filter((team) => branchId && team.branchId !== branchId), ...rows]);
    return rows;
  }

  async listUsers(branchId?: string): Promise<readonly OrgUser[]> {
    const lookups = this.injector.get(WorkspaceLookups);
    const rows: OrgUser[] = [];
    for (let page = 1; ; page++) {
      const result = await lookups.users({ branchId, status: 'ACTIVE', page, limit: 100 });
      rows.push(...result.data.map(orgUser));
      if (!result.meta.hasNext) break;
    }
    this.userRows.set([...this.users.filter((user) => branchId && user.branchId !== branchId), ...rows]);
    return rows;
  }

  async getUser(id: string): Promise<OrgUser | null> {
    try {
      const user = orgUser(await this.injector.get(WorkspaceLookups).user(id));
      this.userRows.set([...this.users.filter((row) => row.id !== id), user]);
      return user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  readonly listShareTargets = listShareTargets;
  readonly listOwnerOptions = listOwnerOptions;
  readonly listTransferTargets = listTransferTargets;
  readonly listPipelineOptions = listPipelineOptions;

  now(): string { return analyticsNow(); }

  private async directoryPages<T>(resource: string, query: CoreQuery): Promise<T[]> {
    const http = this.injector.get(CoreHttp);
    const rows: T[] = [];
    for (let page = 1; ; page++) {
      const result = await crmQueries().fetchQuery({
        queryKey: ['crm-analytics', 'directory', resource, query, page],
        queryFn: () => http.readPage<T>(`/api/tenant/core/v1/organization/${resource}`,
          { ...query, status: 'ACTIVE', page, limit: 100 }),
      });
      rows.push(...result.data);
      if (!result.meta.hasNext) return rows;
    }
  }
}
