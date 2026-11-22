import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT, Injector, inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-errors';
import { AuthSession } from '../../../../core/auth/auth-session';
import { readCsrfCookie } from '../../../../core/auth/auth-transport';
import { OrganizationReadApi } from './organization-read.api';
import type { Branch, Company, Department, Team } from './staff.model';
import { StaffSession } from './staff-session';

export type CreateCompanyBody = Pick<Company, 'code' | 'name'> & {
  legalName?: string;
  taxNumber?: string;
  currencyCode?: string;
};
export type CreateBranchBody = Pick<Branch, 'companyId' | 'code' | 'name'> & {
  phone?: string;
  address?: string;
  isHeadquarters?: boolean;
};
export type CreateDepartmentBody = Pick<Department, 'branchId' | 'code' | 'name'>;
export type CreateTeamBody = Pick<Team, 'departmentId' | 'code' | 'name'> & { leadUserId?: string };

@Service()
export class OrganizationCreateApi {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly session = inject(StaffSession);

  async createCompany(body: CreateCompanyBody, key: string): Promise<Company> {
    if (!this.session.isTenantWide('org.company.manage')) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    return this.createScope<Company>('companies', body, key);
  }

  async createBranch(body: CreateBranchBody, key: string): Promise<Branch> {
    if (!this.session.canCreateBranch(body.companyId) ||
        (body.isHeadquarters && !this.session.can('org.branch.manage', { companyId: body.companyId }))) {
      throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    }
    return this.createScope<Branch>('branches', body, key);
  }

  async createDepartment(body: CreateDepartmentBody, key: string): Promise<Department> {
    if (!this.session.can('org.department.manage', { branchId: body.branchId })) {
      throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    }
    return this.create('departments', body, key);
  }

  async createTeam(body: CreateTeamBody, key: string, branchId: string): Promise<Team> {
    if (!this.session.can('org.team.manage', { branchId })) {
      throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    }
    return this.create('teams', body, key);
  }

  private async createScope<T>(
    resource: 'companies' | 'branches',
    body: CreateCompanyBody | CreateBranchBody,
    key: string,
  ): Promise<T> {
    const scope = this.session.scopeRevision();
    if (!scope) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    const auth = this.injector.get(AuthSession);
    const version = auth.requestVersion();

    const created = await this.create<T>(resource, body, key);
    await this.injector.get(OrganizationReadApi).invalidateScope(scope);
    void auth.reloadProfile(version).catch(() => undefined);
    return created;
  }

  private async create<T>(
    resource: 'companies' | 'branches' | 'departments' | 'teams',
    body: CreateCompanyBody | CreateBranchBody | CreateDepartmentBody | CreateTeamBody,
    key: string,
  ): Promise<T> {
    const csrf = readCsrfCookie(this.document);
    if (!csrf) throw new ApiError(403, 'AUTH_CSRF_INVALID');

    try {
      const result = await firstValueFrom(this.http.post<{ success: true; data: T }>(
        `/api/tenant/core/v1/organization/${resource}`,
        body,
        { headers: { 'x-csrf-token': csrf, 'x-idempotency-key': key }, withCredentials: true },
      ));
      if (result?.success !== true || result.data == null) {
        throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
      }
      return result.data;
    } catch (error) {
      if (!(error instanceof HttpErrorResponse)) throw error;
      throw ApiError.fromResponse(error.status, error.error);
    }
  }
}
