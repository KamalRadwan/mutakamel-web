import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { DOCUMENT, Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-errors';
import type { CorePageMeta } from '../../../../core/api/core-page';
import { readCsrfCookie } from '../../../../core/auth/auth-transport';

export type StaffWriteMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export interface StaffWriteOptions {
  /** Omit only for PUT /roles/:id/branch-permissions (gateway mode NONE). */
  key?: string;
  /** The confirmed resend is a different request: the caller supplies a new key. */
  confirmAddonCascade?: boolean;
}
export interface StaffEnvelope<T> { data: T; meta?: CorePageMeta; }

@Service()
export class StaffHttp {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  async read<T>(path: string, query?: object): Promise<StaffEnvelope<T>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    try {
      const body = await firstValueFrom(this.http.get<unknown>(path, { params, withCredentials: true }));
      return this.unwrap<T>(body);
    } catch (error) {
      if (error instanceof HttpErrorResponse) throw ApiError.fromResponse(error.status, error.error);
      throw error;
    }
  }

  async write<T>(method: StaffWriteMethod, path: string, body?: unknown, options?: StaffWriteOptions): Promise<T> {
    const csrf = readCsrfCookie(this.document);
    if (!csrf) throw new ApiError(403, 'GW.AUTH.CSRF_INVALID');
    const headers: Record<string, string> = { 'x-csrf-token': csrf };
    if (options?.key !== undefined) headers['x-idempotency-key'] = options.key;
    let params = new HttpParams();
    if (options?.confirmAddonCascade) params = params.set('confirmAddonCascade', 'true');
    try {
      const response = await firstValueFrom(this.http.request<unknown>(method, path, {
        body, headers, params, withCredentials: true, observe: 'response',
      }));
      return response.status === 204 ? undefined as T : this.unwrap<T>(response.body).data;
    } catch (error) {
      if (error instanceof HttpErrorResponse) throw ApiError.fromResponse(error.status, error.error);
      throw error;
    }
  }

  private unwrap<T>(body: unknown): StaffEnvelope<T> {
    if (typeof body !== 'object' || body === null ||
        !('success' in body) || body.success !== true || !('data' in body)) {
      throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    }
    return {
      data: body.data as T,
      ...('meta' in body ? { meta: body.meta as CorePageMeta } : {}),
    };
  }
}
