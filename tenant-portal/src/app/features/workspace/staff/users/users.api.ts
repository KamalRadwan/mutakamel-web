import { inject, Service } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError } from '../../../../core/api/api-errors';
import type { CorePage } from '../../../../core/api/core-page';
import { StaffHttp, type StaffEnvelope, type StaffWriteMethod } from '../shared/staff-http';
import type { SeatUsage } from '../../seats/seats.model';
import type { ConfirmAddonCascadeOptions, ListQuery, TenantUser } from '../shared/staff.model';
import { StaffSession } from '../shared/staff-session';

const USERS_PATH = '/api/tenant/core/v1/users';
const USERS_QUERY_KEY = 'staff-users';

export interface UpdateUserBody {
  firstName?: string;
  lastName?: string;
  employeeCode?: string | null;
  companyId?: string;
  branchId?: string;
  departmentId?: string;
  teamId?: string | null;
  managerId?: string | null;
  jobTitle?: string | null;
}

export interface InviteUserBody {
  email: string;
  firstName: string;
  lastName: string;
  companyId: string;
  branchId: string;
  departmentId: string;
  teamId?: string;
  managerId?: string;
  employeeCode?: string;
  jobTitle?: string;
  roleAssignments?: { branchId: string; roleId: string }[];
}

export interface CreateImportBatchBody {
  rows: InviteUserBody[];
  mode: 'STRICT' | 'SKIP_ROLES_THAT_DONT_FIT';
}

export interface ImportBatchCreated {
  batchId: string;
  total: number;
  valid: number;
  invalid: number;
  expiresAt: string;
}

export type ImportBatchRowStatus = 'VALID' | 'INVALID' | 'IMPORTED' | 'FAILED';

export interface ImportBatchRow {
  id: string;
  rowNo: number;
  status: ImportBatchRowStatus;
  data: InviteUserBody;
  errors: Record<string, string[]>;
  resultCode: string | null;
}

@Service()
export class StaffUsersApi {
  private readonly http = inject(StaffHttp);
  private readonly targets = new Map<string, TenantUser>();
  private readonly session = inject(StaffSession);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, networkMode: 'always', retry: false } },
  });

  async listUsers(query: ListQuery = {}): Promise<CorePage<TenantUser>> {
    const { data, meta } = await this.read<TenantUser[]>(USERS_PATH, query);
    if (!Array.isArray(data) || !meta || !Number.isSafeInteger(meta.total) || meta.total < 0 ||
        !Number.isSafeInteger(meta.totalPages) || meta.totalPages < 0 || typeof meta.hasNext !== 'boolean') {
      throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    }
    const users = data.map((user) => this.normalizeUser(user));
    for (const user of users) this.remember(user);
    return { data: users, meta };
  }

  async getUser(id: string): Promise<TenantUser> {
    const user = this.normalizeUser((await this.read<TenantUser>(`${USERS_PATH}/${encodeURIComponent(id)}`)).data);
    this.remember(user);
    return user;
  }

  async getSeatUsage(): Promise<SeatUsage> {
    const usage = (await this.read<SeatUsage>('/api/tenant/core/v1/seats/usage')).data;
    if (!usage || typeof usage.mode !== 'string' || !Array.isArray(usage.modules) || typeof usage.revision !== 'number') {
      throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    }
    return usage;
  }

  async inviteUser(body: InviteUserBody, key: string): Promise<TenantUser> {
    return this.write<TenantUser>('POST', USERS_PATH, body, key, 'users.user.invite', body, undefined, true);
  }

  async createImportBatch(body: CreateImportBatchBody, key: string): Promise<ImportBatchCreated> {
    const scope = this.importScope();
    const result = await this.http.write<ImportBatchCreated>('POST', `${USERS_PATH}/import-batches`, body, { key });
    if (scope !== this.session.scopeRevision()) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    return result;
  }

  async listImportBatchRows(id: string, query: { page?: number; limit?: number; status?: ImportBatchRowStatus } = {}): Promise<CorePage<ImportBatchRow>> {
    const scope = this.importScope();
    const { data, meta } = await this.http.read<ImportBatchRow[]>(`${USERS_PATH}/import-batches/${encodeURIComponent(id)}/rows`, query);
    if (scope !== this.session.scopeRevision()) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    if (!Array.isArray(data) || !meta || !Number.isSafeInteger(meta.total) || meta.total < 0 ||
        !Number.isSafeInteger(meta.totalPages) || meta.totalPages < 0 || typeof meta.hasNext !== 'boolean') {
      throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    }
    return { data, meta };
  }

  private importScope(): string {
    const scope = this.session.scopeRevision();
    // Batch reads use invite authority and creator ownership, rather than users.user.read.
    if (!scope || !this.session.me()?.permissions.includes('users.user.invite')) {
      throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    }
    return scope;
  }

  async updateUser(id: string, patch: UpdateUserBody, key: string): Promise<TenantUser> {
    const target = await this.targetFor(id);
    if (!this.session.can('users.user.update', {
      companyId: patch.companyId ?? target.companyId, branchId: patch.branchId ?? target.branchId,
    })) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    return this.write('PATCH', this.userPath(id), patch, key, 'users.user.update', target);
  }

  async suspendUser(id: string, key: string, opts?: ConfirmAddonCascadeOptions): Promise<TenantUser> {
    return this.write('POST', `${this.userPath(id)}/suspend`, undefined, key,
      'users.user.deactivate', await this.targetFor(id), opts);
  }

  async activateUser(id: string, key: string, opts?: ConfirmAddonCascadeOptions): Promise<TenantUser> {
    return this.write('POST', `${this.userPath(id)}/activate`, undefined, key,
      'users.user.deactivate', await this.targetFor(id), opts);
  }

  async revokeSessions(id: string, key: string): Promise<TenantUser> {
    return this.write('POST', `${this.userPath(id)}/sessions/revoke`, undefined, key,
      'users.user.deactivate', await this.targetFor(id));
  }

  async deleteUser(id: string, key: string, opts?: ConfirmAddonCascadeOptions): Promise<void> {
    await this.write('DELETE', this.userPath(id), undefined, key,
      'users.user.delete', await this.targetFor(id), opts);
    this.targets.delete(`${this.session.scopeRevision()}:${id}`);
  }

  async resendInvite(id: string, key: string): Promise<{ deliveryStatus: 'QUEUED' }> {
    return this.write('POST', `${this.userPath(id)}/resend-invite`, undefined, key,
      'users.user.invite', await this.targetFor(id));
  }

  private userPath(id: string): string {
    return `${USERS_PATH}/${encodeURIComponent(id)}`;
  }

  private normalizeUser(user: TenantUser): TenantUser {
    return { ...user, seats: Array.isArray(user.seats) ? user.seats : [] };
  }

  private remember(user: TenantUser): void {
    this.targets.set(`${this.session.scopeRevision()}:${user.id}`, this.normalizeUser(user));
  }

  private targetFor(id: string): Promise<TenantUser> {
    return Promise.resolve(this.targets.get(`${this.session.scopeRevision()}:${id}`) ?? this.getUser(id));
  }

  private async write<T extends TenantUser | { deliveryStatus: 'QUEUED' } | void>(method: StaffWriteMethod, path: string, body: unknown, key: string,
    permission: string, target: { companyId: string; branchId: string },
    opts?: ConfirmAddonCascadeOptions, invite = false): Promise<T> {
    const scope = this.session.scopeRevision();
    if (!scope || !this.session.can(permission, target)) {
      throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    }
    const result = await this.http.write<T>(method, path, body, { key, ...opts });
    if (invite && (!(result as TenantUser)?.id || (result as TenantUser).status !== 'INVITED')) {
      throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    }
    const filters = { queryKey: [USERS_QUERY_KEY, scope] };
    await this.queries.cancelQueries(filters);
    await this.queries.invalidateQueries({ ...filters, refetchType: 'none' });
    if (scope !== this.session.scopeRevision()) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    if (result && typeof result === 'object' && 'id' in result) this.remember(result);
    return result;
  }

  private async read<T>(path: string, query: ListQuery = {}): Promise<StaffEnvelope<T>> {
    const scope = this.session.scopeRevision();
    if (!scope || !this.session.can('users.user.read', query.branchId ? query : undefined)) {
      throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    }
    return this.queries.fetchQuery({
      queryKey: [USERS_QUERY_KEY, scope, path, query],
      queryFn: () => this.http.read<T>(path, query),
    });
  }
}
