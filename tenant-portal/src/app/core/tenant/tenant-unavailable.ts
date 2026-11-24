import { HttpErrorResponse } from '@angular/common/http';

export const TENANT_UNAVAILABLE_PATH = '/workspace-unavailable';

/** Core answers every tenant API on a host with 404 TENANT_NOT_RESOLVABLE once the tenant is removed or destroyed. */
export function isTenantNotResolvable(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 404) return false;
  const body = error.error as { errorCode?: unknown; code?: unknown } | null;
  return body?.errorCode === 'TENANT_NOT_RESOLVABLE' || body?.code === 'TENANT_NOT_RESOLVABLE';
}
