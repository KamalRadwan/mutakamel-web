import { Injector, inject, Service } from '@angular/core';
import { ApiError } from '../../../../core/api/api-errors';
import { AuthSession } from '../../../../core/auth/auth-session';
import { OrganizationReadApi } from './organization-read.api';
import type { Branch, Company, ConfirmAddonCascadeOptions, Department, OrgStatus, Team } from './staff.model';
import { StaffSession } from './staff-session';
import { StaffHttp, type StaffWriteMethod } from './staff-http';

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

export type UpdateCompanyBody = Partial<{
  name: string; legalName: string | null; taxNumber: string | null; currencyCode: string; status: OrgStatus;
}>;
export type UpdateBranchBody = Partial<{
  name: string; address: string | null; phone: string | null; isHeadquarters: boolean; status: OrgStatus;
}>;
export type UpdateDepartmentBody = Partial<{ name: string; status: OrgStatus }>;
export type UpdateTeamBody = Partial<{ name: string; leadUserId: string | null; status: OrgStatus }>;

type OrganizationResource = 'companies' | 'branches' | 'departments' | 'teams';

@Service()
export class OrganizationWriteApi {
  private readonly http = inject(StaffHttp);
  private readonly injector = inject(Injector);
  private readonly session = inject(StaffSession);

  async createCompany(body: CreateCompanyBody, key: string): Promise<Company> {
    this.requireCompanyManage();
    return this.write('POST', 'companies', undefined, body, key, true);
  }

  async createBranch(body: CreateBranchBody, key: string): Promise<Branch> {
    if (!this.session.canCreateBranch(body.companyId) ||
        (body.isHeadquarters && !this.session.can('org.branch.manage', { companyId: body.companyId }))) {
      throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    }
    return this.write('POST', 'branches', undefined, body, key, true);
  }

  async createDepartment(body: CreateDepartmentBody, key: string): Promise<Department> {
    if (!this.session.can('org.department.manage', { branchId: body.branchId })) {
      throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    }
    return this.write('POST', 'departments', undefined, body, key, false);
  }

  async createTeam(body: CreateTeamBody, key: string, branchId: string): Promise<Team> {
    if (!this.session.can('org.team.manage', { branchId })) {
      throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    }
    return this.write('POST', 'teams', undefined, body, key, false);
  }

  async updateCompany(id: string, patch: UpdateCompanyBody, key: string, opts?: ConfirmAddonCascadeOptions): Promise<Company> {
    this.requireCompanyManage();
    return this.write('PATCH', 'companies', id, patch, key, 'status' in patch, opts);
  }

  async deleteCompany(id: string, key: string, opts?: ConfirmAddonCascadeOptions): Promise<void> {
    this.requireCompanyManage();
    return this.write('DELETE', 'companies', id, undefined, key, true, opts);
  }

  async updateBranch(id: string, patch: UpdateBranchBody, key: string, opts?: ConfirmAddonCascadeOptions): Promise<Branch> {
    return this.write('PATCH', 'branches', id, patch, key, 'status' in patch || 'isHeadquarters' in patch, opts);
  }

  async deleteBranch(id: string, key: string, opts?: ConfirmAddonCascadeOptions): Promise<void> {
    return this.write('DELETE', 'branches', id, undefined, key, true, opts);
  }

  async updateDepartment(id: string, patch: UpdateDepartmentBody, key: string): Promise<Department> {
    return this.write('PATCH', 'departments', id, patch, key, false);
  }

  async deleteDepartment(id: string, key: string): Promise<void> {
    return this.write('DELETE', 'departments', id, undefined, key, false);
  }

  async updateTeam(id: string, patch: UpdateTeamBody, key: string): Promise<Team> {
    return this.write('PATCH', 'teams', id, patch, key, false);
  }

  async deleteTeam(id: string, key: string): Promise<void> {
    return this.write('DELETE', 'teams', id, undefined, key, false);
  }

  private requireCompanyManage(): void {
    if (!this.session.isTenantWide('org.company.manage')) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
  }

  private async write<T>(
    method: StaffWriteMethod,
    resource: OrganizationResource,
    id: string | undefined,
    body: unknown,
    key: string,
    reloadProfile: boolean,
    opts?: ConfirmAddonCascadeOptions,
  ): Promise<T> {
    const scope = this.session.scopeRevision();
    if (!scope) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    const auth = this.injector.get(AuthSession);
    const version = auth.requestVersion();
    const path = `/api/tenant/core/v1/organization/${resource}${id === undefined ? '' : `/${encodeURIComponent(id)}`}`;
    const result = await this.http.write<T>(method, path, body, { key, ...opts });
    await this.injector.get(OrganizationReadApi).invalidateScope(scope);
    if (reloadProfile) void auth.reloadProfile(version).catch(() => undefined);
    return result;
  }
}
