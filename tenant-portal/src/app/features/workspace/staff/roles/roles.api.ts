import { Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError } from '../../../../core/api/api-errors';
import type { CorePage } from '../../../../core/api/core-page';
import { StaffHttp, type StaffWriteOptions, type StaffWriteMethod } from '../shared/staff-http';
import { StaffSession } from '../shared/staff-session';
import type {
  ListQuery,
  Permission,
  Role,
  RoleDetail,
  RoleBranchPermissions,
} from '../shared/staff.model';

const ROLES_PATH = '/api/tenant/core/v1/roles';
type CoreRoleDetail = RoleDetail & { holderCount: number };
type RoleQuery = Pick<ListQuery, 'page' | 'limit' | 'search' | 'sortBy' | 'sortDir'> & {
  isSystem?: boolean;
};
export type CreateRoleBody = { name: string; description?: string; permissionIds?: string[] };
export type UpdateRoleBody = { name?: string; description?: string | null };
export type BranchPermissionsBody = {
  expectedRevision: string;
  catalogueRevision: string;
  profiles: { branchId: string; permissionIds: string[] }[];
};

@Service()
export class RolesApi {
  private readonly http = inject(StaffHttp);
  private readonly session = inject(StaffSession);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, networkMode: 'always', retry: false } },
  });

  list(query: RoleQuery): Promise<CorePage<Role>> {
    return this.readPage(ROLES_PATH, this.session.can('roles.role.read'), query);
  }

  async get(id: string): Promise<CoreRoleDetail> {
    const result = await this.read<RoleDetail>(this.path(id), this.session.can('roles.role.read'));
    return this.roleDetail(result.data);
  }

  create(body: CreateRoleBody, key: string): Promise<RoleDetail> {
    return this.writeRole('POST', ROLES_PATH, body, 'roles.role.create', { key });
  }

  update(id: string, body: UpdateRoleBody, key: string): Promise<RoleDetail> {
    return this.writeRole('PATCH', this.path(id), body, 'roles.role.update', { key });
  }

  setPermissions(
    id: string,
    permissionIds: string[],
    key: string,
    options?: { confirmAddonCascade?: boolean },
  ): Promise<RoleDetail> {
    return this.writeRole(
      'PUT',
      `${this.path(id)}/permissions`,
      { permissionIds },
      'roles.role.update',
      { ...options, key },
    );
  }

  delete(id: string, key: string, options?: { confirmAddonCascade?: boolean }): Promise<void> {
    return this.write(
      'DELETE',
      this.path(id),
      undefined,
      this.session.isTenantWide('roles.role.delete'),
      { ...options, key },
    );
  }

  listPermissions(
    query: Pick<ListQuery, 'page' | 'limit' | 'sortBy' | 'sortDir'> = {},
  ): Promise<CorePage<Permission>> {
    return this.readPage(
      '/api/tenant/core/v1/permissions',
      this.session.can('roles.permission.read'),
      query,
    );
  }

  async getBranchPermissions(id: string): Promise<RoleBranchPermissions> {
    const result = await this.read<RoleBranchPermissions>(
      `${this.path(id)}/branch-permissions`,
      this.session.canReadBranchPermissions(),
    );
    return this.branchPermissions(result.data);
  }

  async setBranchPermissions(
    id: string,
    body: BranchPermissionsBody,
    options?: { confirmAddonCascade?: boolean },
  ): Promise<RoleBranchPermissions> {
    const result = await this.write<RoleBranchPermissions>(
      'PUT',
      `${this.path(id)}/branch-permissions`,
      body,
      this.session.canUpdateBranchPermissions(),
      { confirmAddonCascade: options?.confirmAddonCascade },
    );
    return this.branchPermissions(result);
  }

  private async readPage<T>(path: string, allowed: boolean, query: object): Promise<CorePage<T>> {
    const { data, meta } = await this.read<T[]>(path, allowed, query);
    if (
      !Array.isArray(data) ||
      !meta ||
      !Number.isSafeInteger(meta.total) ||
      meta.total < 0 ||
      !Number.isSafeInteger(meta.page) ||
      !Number.isSafeInteger(meta.limit) ||
      !Number.isSafeInteger(meta.totalPages) ||
      typeof meta.hasNext !== 'boolean' ||
      typeof meta.hasPrev !== 'boolean'
    ) {
      throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    }
    return { data, meta };
  }

  private async read<T>(path: string, allowed: boolean, query: object = {}) {
    const scope = this.authorize(allowed);
    return this.queries.fetchQuery({
      queryKey: ['staff-roles', scope, path, query],
      queryFn: async () => {
        const result = await this.http.read<T>(path, query);
        this.assertScope(scope);
        if (result.data == null) throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
        return result;
      },
    });
  }

  private async writeRole(
    method: StaffWriteMethod,
    path: string,
    body: unknown,
    permission: string,
    options: StaffWriteOptions,
  ): Promise<RoleDetail> {
    return this.roleDetail(
      await this.write<RoleDetail>(
        method,
        path,
        body,
        this.session.isTenantWide(permission),
        options,
      ),
    );
  }

  private async write<T>(
    method: StaffWriteMethod,
    path: string,
    body: unknown,
    allowed: boolean,
    options: StaffWriteOptions,
  ): Promise<T> {
    const scope = this.authorize(allowed);
    const result = await this.http.write<T>(method, path, body, options);
    this.assertScope(scope);
    await this.queries.cancelQueries({ queryKey: ['staff-roles', scope] });
    await this.queries.invalidateQueries({ queryKey: ['staff-roles', scope] });
    return result;
  }

  private authorize(allowed: boolean): string {
    const scope = this.session.scopeRevision();
    if (!scope || !allowed) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    return scope;
  }

  private assertScope(scope: string): void {
    if (scope !== this.session.scopeRevision()) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
  }

  private roleDetail(value: RoleDetail): CoreRoleDetail {
    const holderCount = value?.holderCount;
    if (
      !value ||
      typeof value.id !== 'string' ||
      !Array.isArray(value.permissionIds) ||
      typeof holderCount !== 'number' ||
      !Number.isSafeInteger(holderCount) ||
      holderCount < 0
    ) {
      throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    }
    return { ...value, holderCount };
  }

  private branchPermissions(value: RoleBranchPermissions): RoleBranchPermissions {
    if (
      !value ||
      typeof value.roleId !== 'string' ||
      typeof value.revision !== 'string' ||
      typeof value.catalogueRevision !== 'string' ||
      !Array.isArray(value.profiles) ||
      !Array.isArray(value.catalogue)
    ) {
      throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    }
    return value;
  }

  private path(id: string): string {
    return `${ROLES_PATH}/${encodeURIComponent(id)}`;
  }
}
