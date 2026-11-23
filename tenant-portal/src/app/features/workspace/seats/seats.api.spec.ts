import { DOCUMENT } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { bindSeatPreviewApi, freeUp, freeUpPreview, getMySeatStates, getSeatUsage,
  listSeatHolders, releaseSeats, SeatPreviewApi, swapSeat, switchToDerived } from './seats.api';
import { seatErrorMessage, seatShortfallDetails } from './seat-errors';
import type { SeatHolder, SeatPreview, SeatUsage } from './seats.model';

const root = '/api/tenant/core/v1';
const key = '019a7c20-0002-7000-8000-000000000099';
const usage: SeatUsage = { mode: 'DERIVED', revision: 7, modules: [{
  moduleKey: 'crm', kind: 'ROLE_DERIVED', nameI18n: { en: 'CRM', ar: 'إدارة العملاء' },
  capacity: 2, used: 2, overCapacity: 1, graceUntil: null, overCapacitySince: null, pendingCapacity: null,
}] };
const holder: SeatHolder = { userId: 'user-1', name: 'One', email: 'one@example.test', status: 'SUSPENDED',
  grantedAt: '2026-11-21T00:00:00.000Z', accessState: 'OVER_CAPACITY', cause: 'SEAT_SWAPPED',
  roles: [{ roleId: 'role-1', roleName: 'Sales', scope: { target: 'BRANCH', companyId: 'company-1', branchId: 'branch-1' } }] };
const meta = { page: 2, limit: 1, total: 3, totalPages: 3, hasNext: true, hasPrev: true };
const preview: SeatPreview = { mode: 'DERIVED', ok: true, modules: [] };

describe('seats HTTP through the application-bound service', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${name}=csrf-proof`);
    bindSeatPreviewApi(() => TestBed.inject(SeatPreviewApi));
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('unwraps live usage without caching subsequent reads', async () => {
    for (const revision of [7, 8]) {
      const pending = getSeatUsage();
      const req = http.expectOne(`${root}/seats/usage`);
      expect(req.request.withCredentials).toBe(true);
      req.flush({ success: true, data: { ...usage, revision } });
      await expect(pending).resolves.toEqual({ ...usage, revision });
    }
  });

  it('reads canonical holder pages, preserving role scope, cause and metadata', async () => {
    const pending = listSeatHolders('crm', { page: 2, limit: 1, search: 'One & Co' });
    const req = http.expectOne(r => r.url === `${root}/seats/usage/crm/holders`);
    expect(req.request.params.keys()).toEqual(['page', 'limit', 'search']);
    expect(req.request.params.get('search')).toBe('One & Co');
    req.flush({ success: true, data: [holder], meta });
    await expect(pending).resolves.toEqual({ data: [holder], meta });
  });

  it('adapts Webphone pages and reads the real user status separately from seat state', async () => {
    const pending = listSeatHolders('webphone', { page: 2, limit: 1 });
    http.expectOne(r => r.url === `${root}/seats/usage/webphone/holders`).flush({ success: true, data: {
      data: [{ userId: 'user-1', name: 'One', extension: '101', enabledAt: holder.grantedAt, accessState: 'ACTIVE' }],
      meta: { page: 2, limit: 1, total: 3 },
    } });
    await vi.waitFor(() => {
      http.expectOne(`${root}/users/user-1`).flush({ success: true, data: { email: holder.email, status: 'SUSPENDED' } });
    });
    await expect(pending).resolves.toEqual({ data: [{ ...holder, accessState: 'ACTIVE', cause: null, roles: [],
      extension: '101', enabledAt: holder.grantedAt }], meta });
  });

  it('projects only the authenticated profile seat fields', async () => {
    const pending = getMySeatStates();
    http.expectOne(`${root}/auth/me`).flush({ success: true, data: {
      id: 'actual-user', seats: [{ moduleKey: 'crm', accessState: 'OVER_CAPACITY', extra: 'ignored' }],
    } });
    await expect(pending).resolves.toEqual([{ moduleKey: 'crm', accessState: 'OVER_CAPACITY' }]);
  });

  it('does not synthesize missing profile seats', async () => {
    const pending = getMySeatStates();
    const rejection = expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    http.expectOne(`${root}/auth/me`).flush({ success: true, data: { id: 'actual-user' } });
    await rejection;
  });

  it.each([undefined, false, true])('releases seats with query confirmation %s and no body', async confirmAddonCascade => {
    const pending = releaseSeats('user/id', { confirmAddonCascade }, key);
    const req = http.expectOne(r => r.url === `${root}/users/user%2Fid/release-seats`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    expect(req.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(req.request.params.get('confirmAddonCascade')).toBe(confirmAddonCascade === undefined ? null : String(confirmAddonCascade));
    req.flush({ success: true, data: preview });
    await expect(pending).resolves.toEqual(preview);
  });

  it('previews free-up without an idempotency key', async () => {
    const body = { moduleKey: 'crm', targetSeats: 1, keepUserIds: ['user-1'] };
    const result = { fits: true, removals: [{ userId: 'user-2', name: 'Two',
      roleAssignments: [{ roleName: 'Sales', scope: 'TENANT' }],
      alsoLoses: [{ moduleKey: 'trade', nameI18n: { en: 'Trade', ar: 'التجارة' } }], addonsRemoved: ['Reports'] }] };
    const pending = freeUpPreview(body);
    const req = http.expectOne(`${root}/seats/free-up/preview`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    expect(req.request.headers.has('x-idempotency-key')).toBe(false);
    req.flush({ success: true, data: result });
    await expect(pending).resolves.toEqual(result);
  });

  it('sends numeric revision and cascade confirmation in the free-up body', async () => {
    const body = { moduleKey: 'crm', targetSeats: 1, keepUserIds: ['user-1'], expectedUsageRevision: 7, confirmAddonCascade: true };
    const pending = freeUp(body, key);
    const req = http.expectOne(`${root}/seats/free-up`);
    expect(req.request.body).toEqual(body);
    expect(req.request.params.keys()).toEqual([]);
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    req.flush({ success: true, data: usage });
    await expect(pending).resolves.toEqual(usage);
  });

  it('swaps selected users and encodes the module path', async () => {
    const body = { keepUserId: 'over-capacity', releaseUserId: 'active' };
    const pending = swapSeat('module/key', body, key);
    const req = http.expectOne(`${root}/seats/module%2Fkey/swap`);
    expect(req.request.body).toEqual(body);
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    req.flush({ success: true, data: usage });
    await expect(pending).resolves.toEqual(usage);
  });

  it('generates a UUIDv7 idempotency key when omitted', async () => {
    const pending = switchToDerived();
    const req = http.expectOne(`${root}/seats/switch-to-derived`);
    expect(req.request.headers.get('x-idempotency-key')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    req.flush({ success: true, data: usage });
    await expect(pending).resolves.toEqual(usage);
  });

  it.each(['SEAT_USAGE_STALE', 'SEAT_ADDON_CASCADE_REQUIRED', 'SEAT_MIGRATION_NOT_READY', 'SEAT_SWAP_INVALID'])('preserves %s and details without retry', async code => {
    const details = { moduleKey: ['crm'], needed: ['3'], free: ['1'], capacity: ['5'], used: ['4'], usedAfter: ['7'], shortfall: ['2'] };
    const pending = switchToDerived({ confirmAddonCascade: true }, key);
    const rejection = expect(pending).rejects.toMatchObject({ status: 409, code, details, correlationId: 'trace-1' });
    const req = http.expectOne(r => r.url === `${root}/seats/switch-to-derived`);
    expect(req.request.params.get('confirmAddonCascade')).toBe('true');
    expect(req.request.body).toBeNull();
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    req.flush({ errorCode: code, details, correlationId: 'trace-1' }, { status: 409, statusText: 'Conflict' });
    await rejection;
    http.expectNone(r => r.url === `${root}/seats/switch-to-derived`);
    expect(seatErrorMessage(k => k === `seats.errors.${code}` ? 'translated' : k, new ApiError(409, code, details))).toBe('translated');
    expect(seatShortfallDetails(new ApiError(409, code, details))).toEqual([
      { moduleKey: 'crm', needed: 3, free: 1, capacity: 5, used: 4, usedAfter: 7, shortfall: 2 },
    ]);
  });

  it.each([401, 403, 422, 500, 503])('propagates HTTP %s failures', async status => {
    const pending = getSeatUsage();
    const rejection = expect(pending).rejects.toBeInstanceOf(ApiError);
    http.expectOne(`${root}/seats/usage`).flush({}, { status, statusText: 'Failure' });
    await rejection;
  });

  it('rejects a write when CSRF is missing', async () => {
    vi.spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get').mockReturnValue('');
    await expect(releaseSeats('user-1', {}, key)).rejects.toMatchObject({ status: 403, code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone(r => r.url.includes('release-seats'));
  });
});
