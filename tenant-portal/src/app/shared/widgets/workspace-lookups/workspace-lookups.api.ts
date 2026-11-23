import { inject, Service } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError } from '../../../core/api/api-errors';
import { CoreHttp, type CoreQuery } from '../../../core/api/core-http';
import type { CorePage } from '../../../core/api/core-page';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import type {
  WorkspaceAllBranchesQuery, WorkspaceAllCompaniesQuery, WorkspaceApp, WorkspaceBranch,
  WorkspaceBranchQuery, WorkspaceCompany, WorkspaceCompanyQuery, WorkspaceUser, WorkspaceUserQuery,
} from './workspace-lookups.model';

const CORE_PATH = '/api/tenant/core/v1';
const LOOKUPS_QUERY_KEY = 'workspace-lookups';
const PAGE_LIMIT = 100;
const MAX_PAGES = 50;

@Service()
export class WorkspaceLookups {
  private readonly http = inject(CoreHttp);
  private readonly scope = inject(TenantScopeState);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });

  companies(query: WorkspaceCompanyQuery = {}): Promise<CorePage<WorkspaceCompany>> {
    return this.readPage('companies', `${CORE_PATH}/organization/companies`, { ...query });
  }

  allCompanies(query: WorkspaceAllCompaniesQuery = {}): Promise<WorkspaceCompany[]> {
    return this.read('allCompanies', { ...query }, () =>
      this.allPages((page) => this.companies({ ...query, page, limit: PAGE_LIMIT })));
  }

  branches(query: WorkspaceBranchQuery = {}): Promise<CorePage<WorkspaceBranch>> {
    return this.readPage('branches', `${CORE_PATH}/organization/branches`, { ...query });
  }

  allBranches(query: WorkspaceAllBranchesQuery = {}): Promise<WorkspaceBranch[]> {
    return this.read('allBranches', { ...query }, () =>
      this.allPages((page) => this.branches({ ...query, page, limit: PAGE_LIMIT })));
  }

  users(query: WorkspaceUserQuery = {}): Promise<CorePage<WorkspaceUser>> {
    return this.readPage('users', `${CORE_PATH}/users`, { ...query });
  }

  user(id: string): Promise<WorkspaceUser> {
    return this.read('user', { id }, () => this.http.read(`${CORE_PATH}/users/${encodeURIComponent(id)}`));
  }

  appsOverview(): Promise<WorkspaceApp[]> {
    return this.read('appsOverview', {}, async () => {
      const data = await this.http.read<{ items?: WorkspaceApp[] } | null>(`${CORE_PATH}/apps/overview`);
      if (!Array.isArray(data?.items)) throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
      return data.items;
    });
  }

  private readPage<T>(method: string, path: string, query: CoreQuery): Promise<CorePage<T>> {
    if (typeof query['limit'] === 'number') query['limit'] = Math.min(query['limit'], PAGE_LIMIT);
    return this.read(method, query, async () => {
      const result = await this.http.readPage<T>(path, query);
      if (!Number.isSafeInteger(result.meta.total) || result.meta.total < 0 ||
          !Number.isSafeInteger(result.meta.totalPages) || result.meta.totalPages < 0) {
        throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
      }
      return result;
    });
  }

  private read<T>(method: string, query: CoreQuery, queryFn: () => Promise<T>): Promise<T> {
    const me = this.scope.me();
    // TenantScopeState exposes scope data, but no revision counter.
    const scopeRevision = [me?.id, me?.isTenantOwner, me?.permissions, me?.permissionScopes,
      me?.accessibleCompanies, me?.accessibleBranches, this.scope.selection()];
    return this.queries.fetchQuery({
      queryKey: [LOOKUPS_QUERY_KEY, method, query, scopeRevision],
      queryFn,
    });
  }

  private async allPages<T>(fetchPage: (page: number) => Promise<CorePage<T>>): Promise<T[]> {
    const rows: T[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await fetchPage(page);
      rows.push(...result.data);
      if (!result.meta.hasNext) return rows;
    }
    throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
  }
}
