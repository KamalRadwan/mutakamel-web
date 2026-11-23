import { Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError } from '../../../../core/api/api-errors';
import type { CorePage } from '../../../../core/api/core-page';
import type { Branch, Company, Currency, Department, ListQuery, OrgTreeNode, Team } from './staff.model';
import { StaffSession } from './staff-session';
import { StaffHttp, type StaffEnvelope } from './staff-http';

const ORGANIZATION_PATH = '/api/tenant/core/v1/organization';
type CompanyQuery = Pick<ListQuery, 'page' | 'limit' | 'search' | 'sortBy' | 'sortDir' | 'status'>;
type BranchQuery = CompanyQuery & Pick<ListQuery, 'companyId'>;
type DepartmentQuery = BranchQuery & Pick<ListQuery, 'branchId'>;
type TeamQuery = DepartmentQuery & Pick<ListQuery, 'departmentId'>;
type ReadPermission =
  | 'org.company.read'
  | 'org.branch.read'
  | 'org.department.read'
  | 'org.team.read'
  | 'currencies.currency.read';

@Service()
export class OrganizationReadApi {
  private readonly http = inject(StaffHttp);
  private readonly session = inject(StaffSession);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, networkMode: 'always', retry: false } },
  });

  listCompanies(query: CompanyQuery = {}): Promise<CorePage<Company>> {
    return this.readPage(`${ORGANIZATION_PATH}/companies`, 'org.company.read', query);
  }

  listBranches(query: BranchQuery = {}): Promise<CorePage<Branch>> {
    return this.readPage(`${ORGANIZATION_PATH}/branches`, 'org.branch.read', query);
  }

  listDepartments(query: DepartmentQuery = {}): Promise<CorePage<Department>> {
    return this.readPage(`${ORGANIZATION_PATH}/departments`, 'org.department.read', query);
  }

  listTeams(query: TeamQuery = {}): Promise<CorePage<Team>> {
    return this.readPage(`${ORGANIZATION_PATH}/teams`, 'org.team.read', query);
  }

  listCurrencies(query: Pick<ListQuery, 'page' | 'limit' | 'status'> = {}): Promise<CorePage<Currency>> {
    return this.readPage('/api/tenant/core/v1/currencies', 'currencies.currency.read', query);
  }

  async getCompany(id: string): Promise<Company> {
    const result = await this.read<Company>(`${ORGANIZATION_PATH}/companies/${encodeURIComponent(id)}`, 'org.company.read');
    return result.data;
  }

  async getBranch(id: string): Promise<Branch> {
    const result = await this.read<Branch>(`${ORGANIZATION_PATH}/branches/${encodeURIComponent(id)}`, 'org.branch.read');
    return result.data;
  }

  async getDepartment(id: string): Promise<Department> {
    const result = await this.read<Department>(`${ORGANIZATION_PATH}/departments/${encodeURIComponent(id)}`, 'org.department.read');
    return result.data;
  }

  async getTeam(id: string): Promise<Team> {
    const result = await this.read<Team>(`${ORGANIZATION_PATH}/teams/${encodeURIComponent(id)}`, 'org.team.read');
    return result.data;
  }

  async getTree(): Promise<OrgTreeNode[]> {
    const scope = this.session.scopeRevision();
    if (!scope || !this.session.can('org.company.read')) {
      throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    }
    return this.queries.fetchQuery({
      queryKey: ['staff-organization', scope, 'tree'],
      queryFn: async () => {
        const { data } = await this.http.read<OrgTreeNode[]>(`${ORGANIZATION_PATH}/tree`);
        if (!Array.isArray(data)) throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
        return data;
      },
    });
  }

  async invalidateScope(scope: string): Promise<void> {
    const filters = { queryKey: ['staff-organization', scope] };
    await this.queries.cancelQueries(filters);
    await this.queries.invalidateQueries({ ...filters, refetchType: 'none' });
  }

  private async readPage<T>(path: string, permission: ReadPermission, query: TeamQuery): Promise<CorePage<T>> {
    const { data, meta } = await this.read<T[]>(path, permission, query);
    if (!Array.isArray(data) || !meta ||
      !Number.isSafeInteger(meta.page) || meta.page < 1 ||
      !Number.isSafeInteger(meta.limit) || meta.limit < 1 ||
      !Number.isSafeInteger(meta.total) || meta.total < 0 ||
      !Number.isSafeInteger(meta.totalPages) || meta.totalPages < 0 ||
      typeof meta.hasNext !== 'boolean' || typeof meta.hasPrev !== 'boolean') {
      throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    }
    return { data, meta };
  }

  private async read<T>(path: string, permission: ReadPermission, query: TeamQuery = {}): Promise<StaffEnvelope<T>> {
    const scope = this.session.scopeRevision();
    if (!scope || !this.session.can(permission)) {
      throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    }
    return this.queries.fetchQuery({
      queryKey: ['staff-organization', scope, path, query],
      queryFn: () => this.http.read<T>(path, query),
    });
  }
}
