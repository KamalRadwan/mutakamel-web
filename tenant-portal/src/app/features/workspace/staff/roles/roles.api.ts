import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { firstValueFrom, type Observable } from 'rxjs';
import { ApiError } from '../../../../core/api/api-errors';
import type { CorePage, CorePageMeta } from '../../../../core/api/core-page';
import { readCsrfCookie } from '../../../../core/auth/auth-transport';
import { StaffSession } from '../shared/staff-session';
import type { ListQuery, Role, RoleDetail } from '../shared/staff.model';

const ROLES_PATH = '/api/tenant/core/v1/roles';
type RoleQuery = Pick<ListQuery, 'page' | 'limit' | 'search' | 'sortBy' | 'sortDir'> & { isSystem?: boolean };
export type CreateRoleBody = { name: string; description?: string };

interface RoleEnvelope<T> {
  success: true;
  data: T;
  meta?: CorePageMeta;
}

@Service()
export class RolesApi {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly session = inject(StaffSession);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, networkMode: 'always', retry: false } },
  });

  async list(query: RoleQuery): Promise<CorePage<Role>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params = params.set(key, value);
    }
    const { data, meta } = await this.read<Role[]>(ROLES_PATH, params);
    if (!Array.isArray(data) || !meta || !Number.isSafeInteger(meta.total) || meta.total < 0) {
      throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    }
    return { data, meta };
  }

  async get(id: string): Promise<RoleDetail> {
    return (await this.read<RoleDetail>(`${ROLES_PATH}/${encodeURIComponent(id)}`)).data;
  }

  async create(body: CreateRoleBody, key: string): Promise<RoleDetail> {
    const scope = this.session.scopeRevision();
    if (!scope || !this.session.isTenantWide('roles.role.create')) {
      throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    }
    const csrf = readCsrfCookie(this.document);
    if (!csrf) throw new ApiError(403, 'GW.AUTH.CSRF_INVALID');

    const { data } = await this.response(this.http.post<RoleEnvelope<RoleDetail>>(ROLES_PATH, body, {
      withCredentials: true,
      headers: { 'x-csrf-token': csrf, 'x-idempotency-key': key },
    }), scope);
    if (typeof data.id !== 'string' || !Array.isArray(data.permissionIds)) {
      throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    }
    await this.queries.cancelQueries({ queryKey: ['staff-roles', scope] });
    return data;
  }

  private async read<T>(path: string, params = new HttpParams()): Promise<RoleEnvelope<T>> {
    const scope = this.session.scopeRevision();
    if (!scope || !this.session.can('roles.role.read')) {
      throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    }
    return this.queries.fetchQuery({
      queryKey: ['staff-roles', scope, path, params.toString()],
      queryFn: () => this.response(this.http.get<RoleEnvelope<T>>(path, { params, withCredentials: true }), scope),
    });
  }

  private async response<T>(request: Observable<RoleEnvelope<T>>, scope: string): Promise<RoleEnvelope<T>> {
    try {
      const envelope = await firstValueFrom(request);
      if (scope !== this.session.scopeRevision()) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
      if (envelope?.success !== true || envelope.data == null) {
        throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
      }
      return envelope;
    } catch (error) {
      if (error instanceof HttpErrorResponse) throw ApiError.fromResponse(error.status, error.error);
      throw error;
    }
  }
}
