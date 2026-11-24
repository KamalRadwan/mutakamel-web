import { HttpErrorResponse } from '@angular/common/http';
import { isTenantNotResolvable } from './tenant-unavailable';

describe('isTenantNotResolvable', () => {
  it('matches a 404 TENANT_NOT_RESOLVABLE body', () => {
    expect(isTenantNotResolvable(new HttpErrorResponse({ status: 404, error: { errorCode: 'TENANT_NOT_RESOLVABLE' } }))).toBe(true);
  });
  it('ignores other 404s and other statuses', () => {
    expect(isTenantNotResolvable(new HttpErrorResponse({ status: 404, error: { errorCode: 'COMMON.GENERIC.NOT_FOUND' } }))).toBe(false);
    expect(isTenantNotResolvable(new HttpErrorResponse({ status: 401, error: { errorCode: 'TENANT_NOT_RESOLVABLE' } }))).toBe(false);
    expect(isTenantNotResolvable(new Error('x'))).toBe(false);
  });
});
