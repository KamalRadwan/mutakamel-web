import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { GeoAdminApi } from './geo-admin.api';

const base = '/api/tenant/core/v1/geo';
const id = '01970000-0000-7000-8000-000000000001';
const row = {
  id,
  nameEn: 'City',
  nameAr: 'مدينة',
  stateId: id,
  isActive: true,
  zoneId: null,
  createdAt: '',
  updatedAt: '',
};
const body = { stateId: id, nameEn: row.nameEn, nameAr: row.nameAr, isActive: true };

describe('GeoAdminApi', () => {
  let api: GeoAdminApi;
  let http: HttpTestingController;
  let csrf = '';
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(GeoAdminApi);
    http = TestBed.inject(HttpTestingController);
    csrf = 'csrf-token';
    vi.spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get').mockImplementation(() =>
      csrf ? `mutakamel-http-tenant-csrf=${csrf}; __Host-mutakamel-tenant-csrf=${csrf}` : '',
    );
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('country and state lists unwrap items', async () => {
    for (const [pending, path] of [
      [api.listCountries(), '/countries'],
      [api.listStates(id), `/countries/${id}/states`],
    ] as const) {
      const req = http.expectOne(base + path);
      expect(req.request.withCredentials).toBe(true);
      req.flush({ success: true, data: { items: [row] } });
      expect(await pending).toEqual({ items: [row] });
    }
  });

  it.each([
    {},
    { items: {} },
    { items: [null] },
    { items: [{ nameEn: 'Missing id' }] },
    { items: [] },
  ])('malformed list → COMMON.GENERIC.INTERNAL_ERROR (%j)', async (data) => {
    const pending = api.listCities(id);
    const assertion = expect(pending).rejects.toMatchObject({
      status: 502,
      code: 'COMMON.GENERIC.INTERNAL_ERROR',
    });
    http.expectOne(base + `/states/${id}/cities`).flush({ success: true, data });
    await assertion;
  });

  it('load more sends the cursor', async () => {
    const pending = api.listCities(id, { search: 'city', cursor: 'next-page', limit: 50 });
    const req = http.expectOne((request) => request.url === base + `/states/${id}/cities`);
    expect(req.request.params.get('cursor')).toBe('next-page');
    expect(req.request.params.get('search')).toBe('city');
    req.flush({ success: true, data: { items: [row], nextCursor: null } });
    expect((await pending).items).toEqual([row]);
  });

  it('rejected cursor resets once', async () => {
    const pending = api.listCities(id, { search: 'a', cursor: 'stale' });
    http
      .expectOne((request) => request.params.get('cursor') === 'stale')
      .flush({ errorCode: 'CORE_VALIDATION_FAILED' }, { status: 400, statusText: 'Bad Request' });
    await vi.waitFor(() => {
      const req = http.expectOne((request) => request.url === base + `/states/${id}/cities`);
      expect(req.request.params.has('cursor')).toBe(false);
      req.flush({ success: true, data: { items: [row], nextCursor: null } });
    });
    expect(await pending).toEqual({ items: [row], nextCursor: null, cursorReset: true });
  });

  it('cursor recovery returns a replacement page and cannot loop', async () => {
    const pending = api.listDistricts(id, { cursor: 'stale', kind: 'VILLAGE' });
    http
      .expectOne((request) => request.params.get('cursor') === 'stale')
      .flush({ errorCode: 'CORE_VALIDATION_FAILED' }, { status: 400, statusText: 'Bad Request' });
    await vi.waitFor(() => {
      const req = http.expectOne((request) => request.url === base + `/cities/${id}/districts`);
      expect(req.request.params.has('cursor')).toBe(false);
      expect(req.request.params.get('kind')).toBe('VILLAGE');
      req.flush({ success: true, data: { items: [row], nextCursor: null } });
    });
    expect(await pending).toEqual({ items: [row], nextCursor: null, cursorReset: true });
    const failed = api.listZones({ cursor: 'stale' });
    const assertion = expect(failed).rejects.toMatchObject({ code: 'CORE_VALIDATION_FAILED' });
    http
      .expectOne((req) => req.params.get('cursor') === 'stale')
      .flush({ errorCode: 'CORE_VALIDATION_FAILED' }, { status: 400, statusText: 'Bad Request' });
    await vi.waitFor(() =>
      http
        .expectOne(base + '/zones')
        .flush({ errorCode: 'CORE_VALIDATION_FAILED' }, { status: 400, statusText: 'Bad Request' }),
    );
    await assertion;
  });

  it('write key reuse on retry', async () => {
    const key = newIdempotencyKey();
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const first = api.createCity(body, key);
    const assertion = expect(first).rejects.toMatchObject({ status: 503 });
    const req = http.expectOne(base + '/cities');
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    expect(req.request.headers.get('x-csrf-token')).toBe(csrf);
    expect(req.request.body).toEqual(body);
    req.flush(
      { errorCode: 'COMMON.DATABASE.UNAVAILABLE' },
      { status: 503, statusText: 'Unavailable' },
    );
    await assertion;
    const retry = api.createCity(body, key);
    const repeated = http.expectOne(base + '/cities');
    expect(repeated.request.headers.get('x-idempotency-key')).toBe(key);
    expect(repeated.request.body).toEqual(req.request.body);
    repeated.flush({ success: true, data: row }, { status: 201, statusText: 'Created' });
    expect(await retry).toEqual(row);
  });

  it('write without CSRF sends nothing', async () => {
    csrf = '';
    await expect(api.createCity(body, newIdempotencyKey())).rejects.toMatchObject({
      code: 'GW.AUTH.CSRF_INVALID',
    });
    http.expectNone(() => true);
  });

  it('delete returns void on 204', async () => {
    const pending = api.deleteCity(id, newIdempotencyKey());
    const req = http.expectOne(base + '/cities/' + id);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(await pending).toBeUndefined();
  });

  it('listAllZones stops at 1000', async () => {
    const pending = api.listAllZones();
    for (let page = 0; page < 5; page++) {
      await vi.waitFor(() => {
        const req = http.expectOne((request) => request.url === base + '/zones');
        expect(req.request.params.get('limit')).toBe('200');
        expect(req.request.params.get('cursor')).toBe(page ? String(page) : null);
        req.flush({
          success: true,
          data: {
            items: Array.from({ length: 200 }, (_, n) => ({ ...row, id: `${page}-${n}` })),
            nextCursor: String(page + 1),
          },
        });
      });
    }
    const result = await pending;
    expect(result.items).toHaveLength(1000);
    expect(result.truncated).toBe(true);
    http.expectNone(() => true);
  });

  it('cities by ids builds CityWithPath', async () => {
    const pending = api.getCitiesByIds([id]);
    http
      .expectOne(base + '/cities/lookup')
      .flush({
        success: true,
        data: {
          items: [
            {
              id,
              nameEn: 'City',
              nameAr: 'مدينة',
              isActive: true,
              stateId: id,
              stateNameEn: 'State',
              stateNameAr: 'محافظة',
              countryId: id,
              countryIso2: 'EG',
            },
          ],
        },
      });
    expect(await pending).toEqual([
      {
        id,
        nameEn: 'City',
        nameAr: 'مدينة',
        isActive: true,
        stateId: id,
        stateName: { en: 'State', ar: 'محافظة' },
        countryId: id,
        countryIso2: 'EG',
      },
    ]);
  });

  it('cities lookup posts the ids in the body without a key', async () => {
    const pending = api.getCitiesByIds([id, id]);
    const req = http.expectOne(base + '/cities/lookup');
    expect(req.request.method).toBe('POST');
    expect(req.request.params.keys()).toEqual([]);
    expect(req.request.body).toEqual({ ids: [id] });
    expect(req.request.headers.has('x-idempotency-key')).toBe(false);
    expect(req.request.headers.get('x-csrf-token')).toBe(csrf);
    req.flush({ success: true, data: { items: [] } });
    expect(await pending).toEqual([]);
    expect(await api.getCitiesByIds([])).toEqual([]);
    await expect(
      api.getCitiesByIds(Array.from({ length: 501 }, (_, n) => String(n))),
    ).rejects.toMatchObject({ code: 'CORE_VALIDATION_FAILED' });
  });

  it.each(['cities', 'districts', 'zones'] as const)(
    'write denial switches the %s gate',
    async (resource) => {
      const pending =
        resource === 'cities'
          ? api.updateCity(id, { isActive: false }, newIdempotencyKey())
          : resource === 'districts'
            ? api.updateDistrict(id, { isActive: false }, newIdempotencyKey())
            : api.updateZone(id, { isActive: false }, newIdempotencyKey());
      const assertion = expect(pending).rejects.toMatchObject({
        code: 'TENANT_WIDE_PERMISSION_REQUIRED',
      });
      http
        .expectOne(base + '/' + resource + '/' + id)
        .flush(
          { errorCode: 'TENANT_WIDE_PERMISSION_REQUIRED' },
          { status: 403, statusText: 'Forbidden' },
        );
      await assertion;
      expect(resource === 'zones' ? api.zonesDenied() : api.placesDenied()).toBe(true);
    },
  );
  it('district and zone writes use their contract methods and bodies', async () => {
    const districtBody = {
      cityId: id,
      kind: 'VILLAGE' as const,
      nameEn: 'Village',
      nameAr: 'قرية',
      isActive: true,
    };
    const zoneBody = {
      nameEn: 'Zone',
      nameAr: 'منطقة',
      isActive: true,
      description: null,
      cityIds: [id],
    };
    const key = newIdempotencyKey();
    const cases = [
      {
        call: () => api.createDistrict(districtBody, key),
        path: '/districts',
        method: 'POST',
        body: districtBody,
        status: 201,
      },
      {
        call: () => api.updateDistrict(id, { kind: 'DISTRICT' }, key),
        path: '/districts/' + id,
        method: 'PATCH',
        body: { kind: 'DISTRICT' },
        status: 200,
      },
      {
        call: () => api.deleteDistrict(id, key),
        path: '/districts/' + id,
        method: 'DELETE',
        body: undefined,
        status: 204,
      },
      {
        call: () => api.createZone(zoneBody, key),
        path: '/zones',
        method: 'POST',
        body: zoneBody,
        status: 201,
      },
      {
        call: () => api.updateZone(id, { cityIds: [] }, key),
        path: '/zones/' + id,
        method: 'PATCH',
        body: { cityIds: [] },
        status: 200,
      },
      {
        call: () => api.deleteZone(id, key),
        path: '/zones/' + id,
        method: 'DELETE',
        body: undefined,
        status: 204,
      },
    ];
    for (const item of cases) {
      const pending = item.call();
      const req = http.expectOne(base + item.path);
      expect(req.request.method).toBe(item.method);
      expect(req.request.body).toEqual(item.body ?? null);
      expect(req.request.headers.get('x-idempotency-key')).toBe(key);
      req.flush(item.status === 204 ? null : { success: true, data: row }, {
        status: item.status,
        statusText: 'OK',
      });
      await pending;
    }
  });

  it('writes cancel and invalidate dependent picker queries', async () => {
    const cancel = vi.spyOn(api['queries'], 'cancelQueries');
    const invalidate = vi.spyOn(api['queries'], 'invalidateQueries');
    const pending = api.updateCity(id, { nameEn: 'Renamed' }, newIdempotencyKey());
    http
      .expectOne(base + '/cities/' + id)
      .flush({ success: true, data: { ...row, nameEn: 'Renamed' } });
    await pending;
    for (const resource of ['cities', 'zones', 'city-lookup']) {
      expect(cancel).toHaveBeenCalledWith({ queryKey: ['ws-geo', resource] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ws-geo', resource] });
    }
  });

  it('rate limit preserves Retry-After for the core message', async () => {
    const pending = api.updateCity(id, { isActive: false }, newIdempotencyKey());
    const assertion = expect(pending).rejects.toMatchObject({
      status: 429,
      code: 'GW.RATE.LIMIT_EXCEEDED',
      details: { retryAfterSeconds: ['15'] },
    });
    http
      .expectOne(base + '/cities/' + id)
      .flush(
        { code: 'GW.RATE.LIMIT_EXCEEDED' },
        { status: 429, statusText: 'Rate limited', headers: { 'Retry-After': '15' } },
      );
    await assertion;
  });

  it('lookup accepts all 500 cities in a single request', async () => {
    const ids = Array.from(
      { length: 500 },
      (_, n) => `01970000-0000-7000-8000-${String(n).padStart(12, '0')}`,
    );
    const pending = api.getCitiesByIds(ids);
    const req = http.expectOne(base + '/cities/lookup');
    expect(req.request.body).toEqual({ ids });
    req.flush({ success: true, data: { items: [] } });
    await pending;
  });
});
