import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-errors';
import type { CorePage, CorePageMeta } from '../../../../core/api/core-page';
import { readCsrfCookie } from '../../../../core/auth/auth-transport';
import type { SeatUsage } from '../../seats/seats.model';
import type { ListQuery, TenantUser } from '../shared/staff.model';
import { StaffSession } from '../shared/staff-session';

const USERS_PATH = '/api/tenant/core/v1/users';
const USERS_QUERY_KEY = 'staff-users';

interface ReadEnvelope<T> {
  success: true;
  data: T;
  meta?: CorePageMeta;
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
}

@Service()
export class StaffUsersApi {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
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
    return { data, meta };
  }

  async getUser(id: string): Promise<TenantUser> {
    return (await this.read<TenantUser>(`${USERS_PATH}/${encodeURIComponent(id)}`)).data;
  }

  async getSeatUsage(): Promise<SeatUsage> {
    return (await this.read<SeatUsage>('/api/tenant/core/v1/seats/usage')).data;
  }

  async inviteUser(body: InviteUserBody, key: string): Promise<TenantUser> {
    const scope = this.session.scopeRevision();
    if (!scope || !this.session.can('users.user.invite', body)) {
      throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    }
    const csrf = readCsrfCookie(this.document);
    if (!csrf) throw new ApiError(403, 'GW.AUTH.CSRF_INVALID');

    try {
      const response = await firstValueFrom(this.http.post<ReadEnvelope<TenantUser>>(USERS_PATH, body, {
        observe: 'response',
        withCredentials: true,
        headers: { 'x-csrf-token': csrf, 'x-idempotency-key': key },
      }));
      if (response.status !== 201 || response.body?.success !== true ||
          response.body.data?.status !== 'INVITED' || !response.body.data.id) {
        throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
      }
      const filters = { queryKey: [USERS_QUERY_KEY, scope] };
      await this.queries.cancelQueries(filters);
      await this.queries.invalidateQueries({ ...filters, refetchType: 'none' });
      if (scope !== this.session.scopeRevision()) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
      return response.body.data;
    } catch (error) {
      if (error instanceof HttpErrorResponse) throw ApiError.fromResponse(error.status, error.error);
      throw error;
    }
  }

  private async read<T>(path: string, query: ListQuery = {}): Promise<ReadEnvelope<T>> {
    const scope = this.session.scopeRevision();
    if (!scope || !this.session.can('users.user.read', query.branchId ? query : undefined)) {
      throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    }
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params = params.set(key, value);
    }
    return this.queries.fetchQuery({
      queryKey: [USERS_QUERY_KEY, scope, path, query],
      queryFn: async () => {
        try {
          const envelope = await firstValueFrom(this.http.get<ReadEnvelope<T>>(path, { params, withCredentials: true }));
          if (envelope?.success !== true || envelope.data == null) {
            throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
          }
          return envelope;
        } catch (error) {
          if (error instanceof HttpErrorResponse) throw ApiError.fromResponse(error.status, error.error);
          throw error;
        }
      },
    });
  }
}
