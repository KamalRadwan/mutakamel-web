import { HttpClient, HttpErrorResponse, HttpParams, type HttpResponse } from '@angular/common/http';
import { DOCUMENT, Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { readCsrfCookie } from '../auth/auth-transport';
import { ApiError } from './api-errors';
import type { CorePage, CorePageMeta } from './core-page';

export type CoreWriteMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type CoreQuery = Record<string, string | number | boolean | readonly (string | number)[] | null | undefined>;
export interface CoreReadOptions { bare?: boolean; }
export interface CoreWriteOptions {
  key?: string;
  ifMatch?: string;
  query?: CoreQuery;
  bare?: boolean;
  noBody?: boolean;
  scope?: { companyId?: string; branchId?: string };
}
export interface CoreWriteResult<T> { status: number; data: T; etag: string | null; location: string | null; }

@Service()
export class CoreHttp {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  async read<T>(path: string, query?: CoreQuery, options?: CoreReadOptions): Promise<T> {
    const response = await this.readResponse(path, query);
    return options?.bare ? response.body as T : this.unwrap<T>(response.body).data;
  }

  async readPage<T>(path: string, query?: CoreQuery): Promise<CorePage<T>> {
    const { data, meta } = this.unwrap<T[]>((await this.readResponse(path, query)).body);
    if (!Array.isArray(data) || !meta ||
        ![meta.page, meta.limit, meta.total, meta.totalPages].every((value) => typeof value === 'number' && Number.isFinite(value)) ||
        typeof meta.hasNext !== 'boolean' || typeof meta.hasPrev !== 'boolean') {
      throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    }
    return { data, meta };
  }

  async readWithEtag<T>(path: string, query?: CoreQuery): Promise<{ data: T; etag: string | null }> {
    const response = await this.readResponse(path, query);
    const { data } = this.unwrap<T>(response.body);
    const bodyEtag = typeof data === 'object' && data !== null && 'etag' in data && typeof data.etag === 'string'
      ? data.etag : null;
    return { data, etag: response.headers.get('ETag') ?? bodyEtag };
  }

  async readBlob(path: string, query?: CoreQuery): Promise<Blob> {
    try {
      return await firstValueFrom(this.http.get(path, {
        params: queryParams(query), responseType: 'blob', withCredentials: true,
      }));
    } catch (error) {
      if (error instanceof HttpErrorResponse) throw await this.toApiError(error);
      throw error;
    }
  }

  async write<T>(method: CoreWriteMethod, path: string, body?: unknown, options?: CoreWriteOptions): Promise<CoreWriteResult<T>> {
    const csrf = readCsrfCookie(this.document);
    if (!csrf) throw new ApiError(403, 'GW.AUTH.CSRF_INVALID');
    const headers: Record<string, string> = { 'x-csrf-token': csrf };
    if (options?.key !== undefined) headers['x-idempotency-key'] = options.key;
    if (options?.ifMatch !== undefined) headers['If-Match'] = options.ifMatch;
    if (options?.scope?.companyId !== undefined) headers['x-mutakamel-company-id'] = options.scope.companyId;
    if (options?.scope?.branchId !== undefined) headers['x-mutakamel-branch-id'] = options.scope.branchId;
    try {
      const response = await firstValueFrom(this.http.request<unknown>(method, path, {
        body: options?.noBody ? undefined : body,
        headers, params: queryParams(options?.query), withCredentials: true, observe: 'response',
      }));
      return {
        status: response.status,
        data: response.status === 204 ? undefined as T
          : options?.bare ? response.body as T : this.unwrap<T>(response.body).data,
        etag: response.headers.get('ETag'),
        location: response.headers.get('Location'),
      };
    } catch (error) {
      if (error instanceof HttpErrorResponse) throw await this.toApiError(error);
      throw error;
    }
  }

  writeMultipart<T>(path: string, form: FormData, options: { key: string }): Promise<CoreWriteResult<T>> {
    return this.write<T>('POST', path, form, options);
  }

  private async readResponse(path: string, query?: CoreQuery): Promise<HttpResponse<unknown>> {
    try {
      return await firstValueFrom(this.http.get<unknown>(path, {
        params: queryParams(query), observe: 'response', withCredentials: true,
      }));
    } catch (error) {
      if (error instanceof HttpErrorResponse) throw await this.toApiError(error);
      throw error;
    }
  }

  private unwrap<T>(body: unknown): { data: T; meta?: CorePageMeta } {
    if (typeof body !== 'object' || body === null ||
        !('success' in body) || body.success !== true || !('data' in body)) {
      throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    }
    return { data: body.data as T, ...('meta' in body ? { meta: body.meta as CorePageMeta } : {}) };
  }

  private async toApiError(response: HttpErrorResponse): Promise<ApiError> {
    if (response.status === 0) return new ApiError(0, 'NETWORK_ERROR');
    let body: unknown = response.error;
    try {
      if (body instanceof Blob) body = await body.text();
      if (typeof body === 'string') body = JSON.parse(body);
    } catch {
      // Non-JSON error bodies still use the shared status fallback.
    }
    const error = ApiError.fromResponse(response.status, body);
    const retryAfter = response.headers.get('Retry-After')?.trim();
    const delay = error.details?.['retryAfterSeconds'];
    const existingSeconds = Number(Array.isArray(delay) ? delay[0] : NaN);
    if (response.status === 429 && retryAfter && !(Number.isFinite(existingSeconds) && existingSeconds > 0)) {
      const seconds = /^\d+$/.test(retryAfter)
        ? Number(retryAfter) : Math.ceil((Date.parse(retryAfter) - Date.now()) / 1000);
      if (Number.isSafeInteger(seconds) && seconds > 0) {
        return new ApiError(error.status, error.code, { ...error.details, retryAfterSeconds: [String(seconds)] },
          { correlationId: error.correlationId });
      }
    }
    return error;
  }
}

function queryParams(query?: CoreQuery): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== '') params = params.append(key, String(item));
    }
  }
  return params;
}
