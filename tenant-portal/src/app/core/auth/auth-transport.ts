import { HttpClient, HttpErrorResponse, type HttpHeaders, type HttpResponse } from '@angular/common/http';
import { DOCUMENT, Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../api/api-errors';

const AUTH_PATH = '/api/tenant/core/v1/auth';
const PUBLIC_BRANDING_PATH = '/api/tenant/core/v1/branding/public';

type DataRoute = 'login' | 'mfa/verify' | 'mfa/resend' | 'me' | 'refresh';
type EmptyRoute = 'logout' | 'activity';
type AuthRoute = DataRoute | EmptyRoute;

interface CoreAuthEnvelope<T> {
  success: true;
  data: T;
}

export class TenantProvisioningError extends ApiError {}

@Service()
export class AuthTransport {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  hasCsrfCookie(): boolean {
    return Boolean(readCsrfCookie(this.document));
  }

  async checkTenantReadiness(): Promise<void> {
    try {
      await firstValueFrom(this.http.get(PUBLIC_BRANDING_PATH, { cache: 'no-store' }));
    } catch (error) {
      if (!(error instanceof HttpErrorResponse)) throw error;
      throw authError(error.status, error.error, error.headers);
    }
  }

  async requestData<T>(route: DataRoute, body: unknown = null, remember = false): Promise<T> {
    const response = await this.request(route, body, remember);
    const envelope = response.body as CoreAuthEnvelope<T> | null;
    if (envelope?.success !== true || envelope.data == null) {
      throw authError(response.status, response.body, response.headers);
    }
    return envelope.data;
  }

  async requestNoContent(route: EmptyRoute): Promise<void> {
    const response = await this.request(route, null, false);
    if (response.status !== 204) {
      throw authError(response.status, response.body, response.headers);
    }
  }

  private async request(route: AuthRoute, body: unknown, remember: boolean): Promise<HttpResponse<unknown>> {
    const headers: Record<string, string> = {};
    if (route === 'login' && remember) headers['x-auth-remember'] = '1';
    if (route === 'refresh' || route === 'logout' || route === 'activity') {
      const csrf = readCsrfCookie(this.document);
      if (csrf) headers['x-csrf-token'] = csrf;
    }

    try {
      return await firstValueFrom(this.http.request<unknown>(route === 'me' ? 'GET' : 'POST', `${AUTH_PATH}/${route}`, {
        body,
        headers,
        observe: 'response',
        withCredentials: true,
      }));
    } catch (error) {
      if (!(error instanceof HttpErrorResponse)) throw error;
      throw authError(error.status, error.error, error.headers);
    }
  }
}

export function readCsrfCookie(document: Document): string | undefined {
  const protocol = document.location?.protocol;
  if (protocol !== 'http:' && protocol !== 'https:') return undefined;

  const name = protocol === 'https:' ? '__Host-mutakamel-tenant-csrf=' : 'mutakamel-http-tenant-csrf=';
  const entry = document.cookie.split(';').map((cookie) => cookie.trimStart())
    .find((cookie) => cookie.startsWith(name));
  if (entry === undefined) return undefined;

  try {
    return decodeURIComponent(entry.slice(name.length));
  } catch {
    return undefined;
  }
}

function authError(status: number, body: unknown, headers: HttpHeaders): ApiError {
  const error = ApiError.fromResponse(status, body);
  const correlationId = error.correlationId ?? headers.get('x-correlation-id') ?? undefined;
  const details = error.details;
  if (
    status === 503 && typeof body === 'object' && body !== null &&
    'errorCode' in body && body.errorCode === 'TENANT_INACTIVE' &&
    headers.get('X-Tenant-Lifecycle') === 'PROVISIONING'
  ) {
    return new TenantProvisioningError(status, error.code, details, { correlationId });
  }
  const retryAfter = headers.get('Retry-After')?.trim();
  if (status === 429 && retryAfter && !hasRetryDelay(details?.['retryAfterSeconds'])) {
    const seconds = /^\d+$/.test(retryAfter)
      ? Number(retryAfter)
      : Math.ceil((Date.parse(retryAfter) - Date.now()) / 1000);
    if (Number.isSafeInteger(seconds) && seconds > 0) {
      return new ApiError(status, error.code, { ...details, retryAfterSeconds: [String(seconds)] }, { correlationId });
    }
  }
  return correlationId === error.correlationId ? error : new ApiError(status, error.code, details, { correlationId });
}

function hasRetryDelay(value: unknown): boolean {
  const seconds = Number(Array.isArray(value) && typeof value[0] === 'string' ? value[0] : NaN);
  return Number.isFinite(seconds) && seconds > 0;
}
