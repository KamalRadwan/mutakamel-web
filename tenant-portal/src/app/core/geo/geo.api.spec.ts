import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, errorMessage, fieldErrorsOf } from '../api/api-errors';
import {
  createCity, createDistrict, getCity, getCountry, getDistrict, getState,
  listCities, listCountries, listDistricts, listStates,
} from './geo.api';
import type { GeoCity, GeoCityLookup, GeoCountry, GeoDistrict, GeoState } from './geo.model';

const BASE = '/api/tenant/core/v1/geo';
const country: GeoCountry = {
  id: '01950000-0000-7000-8000-000000000001', iso2: 'EG', iso3: 'EGY',
  nameEn: 'Egypt', nameAr: 'مصر', dialCode: '20', flagCode: 'eg', sortOrder: 0,
};
const state: GeoState = {
  id: '01950000-0000-7000-8000-000000000002', countryId: country.id,
  code: 'C', nameEn: 'Cairo', nameAr: 'القاهرة', sortOrder: 0,
};
const city: GeoCity = {
  id: '01950000-0000-7000-8000-000000000003', stateId: state.id,
  nameEn: 'Maadi', nameAr: 'المعادي', isActive: true, zoneId: null,
  createdAt: '2026-11-21T10:00:00.000Z', updatedAt: '2026-11-22T10:00:00.000Z',
};
const district: GeoDistrict = {
  id: '01950000-0000-7000-8000-000000000004', cityId: city.id,
  nameEn: 'Sarayat', nameAr: 'السرايات', kind: 'DISTRICT', isActive: true,
  createdAt: city.createdAt, updatedAt: city.updatedAt,
};
const lookup: GeoCityLookup = {
  id: city.id, stateId: state.id, nameEn: city.nameEn, nameAr: city.nameAr,
  isActive: true, stateNameEn: state.nameEn, stateNameAr: state.nameAr,
  countryId: country.id, countryIso2: country.iso2,
};
const input = { stateId: state.id, nameEn: city.nameEn, nameAr: city.nameAr };
const key = '01950000-0000-7000-8000-000000000010';
const cityPath = `${BASE}/states/${state.id}/cities`;
const districtPath = `${BASE}/cities/${city.id}/districts`;

describe('geography picker HTTP boundaries', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const doc = TestBed.inject(DOCUMENT);
    const cookie = doc.location.protocol === 'https:'
      ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${cookie}=csrf-proof`);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('unwraps real countries and states while preserving the array API', async () => {
    const countries = listCountries();
    const request = http.expectOne(`${BASE}/countries`);
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data: { items: [country] } });
    await expect(countries).resolves.toEqual([country]);

    const states = listStates(country.id);
    http.expectOne(`${BASE}/countries/${country.id}/states`)
      .flush({ success: true, data: { items: [state] } });
    await expect(states).resolves.toEqual([state]);
  });

  it.each([country.id, '01950000-0000-7000-8000-000000000099'])(
    'hydrates a country from its real catalogue: %s', async (id) => {
      const pending = getCountry(id);
      http.expectOne(`${BASE}/countries`).flush({ success: true, data: { items: [country] } });
      await expect(pending).resolves.toEqual(id === country.id ? country : null);
    },
  );

  it('does not simulate unsupported state or district hydration or issue invented requests', async () => {
    await expect(getState(state.id)).rejects.toMatchObject({ status: 503, code: 'GEO_STATE_LOOKUP_UNAVAILABLE' });
    await expect(getDistrict(district.id)).rejects.toMatchObject({ status: 503, code: 'GEO_DISTRICT_LOOKUP_UNAVAILABLE' });
    http.expectNone(() => true);
  });

  it('follows opaque city cursors before filtering inactive rows for existing array callers', async () => {
    const pending = listCities(state.id, 'Ma');
    const first = http.expectOne(`${cityPath}?search=Ma&limit=200`);
    first.flush({ success: true, data: { items: [{ ...city, isActive: false }], nextCursor: 'opaque+/=' } });
    await vi.waitFor(() => {
      const next = http.expectOne((request) => request.url === cityPath && request.params.has('cursor'));
      expect(next.request.params.get('cursor')).toBe('opaque+/=');
      expect(next.request.params.get('search')).toBe('Ma');
      next.flush({ success: true, data: { items: [{ ...city, id: district.id }], nextCursor: null } });
    });
    await expect(pending).resolves.toEqual([{ ...city, id: district.id }]);
  });

  it('retains the next city cursor even when a page has no active options', async () => {
    const pending = listCities(state.id, { search: 'M', cursor: 'previous', limit: 1 });
    const request = http.expectOne(`${cityPath}?search=M&cursor=previous&limit=1`);
    request.flush({ success: true, data: { items: [{ ...city, isActive: false }], nextCursor: 'next' } });
    await expect(pending).resolves.toEqual({ items: [], nextCursor: 'next' });
  });

  it('preserves district search, kind and cursor and filters inactive options', async () => {
    const pending = listDistricts(city.id, { search: 'Sar', kind: 'VILLAGE', cursor: 'old', limit: 20 });
    const request = http.expectOne((value) => value.url === districtPath);
    expect(request.request.params.get('kind')).toBe('VILLAGE');
    expect(request.request.params.get('cursor')).toBe('old');
    expect(request.request.params.get('search')).toBe('Sar');
    expect(request.request.params.get('limit')).toBe('20');
    request.flush({ success: true, data: { items: [{ ...district, isActive: false }], nextCursor: 'new' } });
    await expect(pending).resolves.toEqual({ items: [], nextCursor: 'new' });
  });

  it('follows district cursors for array callers, including an inactive-only first page', async () => {
    const pending = listDistricts(city.id);
    http.expectOne(`${districtPath}?limit=200`).flush({ success: true, data: {
      items: [{ ...district, isActive: false }], nextCursor: 'next',
    } });
    await vi.waitFor(() => http.expectOne(`${districtPath}?cursor=next&limit=200`)
      .flush({ success: true, data: { items: [district], nextCursor: null } }));
    await expect(pending).resolves.toEqual([district]);
  });

  it('keeps rejected cursors as validation errors instead of silently resetting the page', async () => {
    const pending = listCities(state.id, { cursor: 'rejected', search: 'changed' });
    const checked = expect(pending).rejects.toMatchObject({
      status: 400, code: 'CORE_VALIDATION_FAILED', details: { cursor: ['invalid scope'] },
    });
    http.expectOne((value) => value.url === cityPath).flush({
      errorCode: 'CORE_VALIDATION_FAILED', details: { cursor: ['invalid scope'] },
    }, { status: 400, statusText: 'Bad Request' });
    await checked;
    http.expectNone(() => true);
  });

  it('bounds legacy list requests and rejects incomplete results', async () => {
    const pending = listCities(state.id);
    const checked = expect(pending).rejects.toMatchObject({ status: 503, code: 'GEO_PICKER_LIMIT_REACHED' });
    for (let page = 0; page < 10; page++) {
      await vi.waitFor(() => http.expectOne((value) => value.url === cityPath).flush({
        success: true, data: { items: [], nextCursor: `page-${page}` },
      }));
    }
    await checked;
    http.expectNone(() => true);
  });

  it('rejects repeated cursors instead of looping or returning partial rows', async () => {
    const pending = listCities(state.id);
    const checked = expect(pending).rejects.toMatchObject({ status: 502 });
    http.expectOne(`${cityPath}?limit=200`).flush({ success: true, data: { items: [], nextCursor: 'same' } });
    await vi.waitFor(() => http.expectOne(`${cityPath}?cursor=same&limit=200`)
      .flush({ success: true, data: { items: [], nextCursor: 'same' } }));
    await checked;
  });

  it('hydrates city metadata from real rows without fabricating lookup timestamps or zone membership', async () => {
    const pending = getCity(city.id);
    const request = http.expectOne(`${BASE}/cities/lookup`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ ids: [city.id] });
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(request.request.headers.has('x-idempotency-key')).toBe(false);
    request.flush({ success: true, data: { items: [lookup] } });
    await vi.waitFor(() => {
      const detail = http.expectOne((value) => value.url === cityPath);
      expect(detail.request.params.get('search')).toBe(city.nameEn);
      detail.flush({ success: true, data: { items: [{ ...city, isActive: false }], nextCursor: null } });
    });
    await expect(pending).resolves.toEqual({ ...city, isActive: false });
  });

  it('returns null for a city omitted by the real lookup', async () => {
    const pending = getCity(city.id);
    http.expectOne(`${BASE}/cities/lookup`).flush({ success: true, data: { items: [] } });
    await expect(pending).resolves.toBeNull();
    http.expectNone(() => true);
  });

  it('rejects an unrelated lookup row', async () => {
    const pending = getCity(city.id);
    const checked = expect(pending).rejects.toMatchObject({ status: 502 });
    http.expectOne(`${BASE}/cities/lookup`).flush({ success: true, data: { items: [{ ...lookup, id: district.id }] } });
    await checked;
  });

  it('forwards the same intent key on an explicit retry after a lost create response', async () => {
    const pending = createCity(input, key);
    const checked = expect(pending).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    const first = http.expectOne(`${BASE}/cities`);
    expect(first.request.headers.get('x-idempotency-key')).toBe(key);
    expect(first.request.body).toEqual(input);
    first.error(new ProgressEvent('error'));
    await checked;
    http.expectNone(() => true);

    const retried = createCity(input, key);
    const replay = http.expectOne(`${BASE}/cities`);
    expect(replay.request.headers.get('x-idempotency-key')).toBe(key);
    expect(replay.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(replay.request.withCredentials).toBe(true);
    replay.flush({ success: true, data: city }, { status: 201, statusText: 'Created' });
    await expect(retried).resolves.toEqual(city);
  });

  it.each([undefined, ''])( 'rejects a missing or empty write key: %s', async (value) => {
    await expect(createCity(input, value)).rejects.toBeInstanceOf(ApiError);
    await expect(createDistrict({ cityId: city.id, nameEn: 'A', nameAr: 'أ' }, value)).rejects.toBeInstanceOf(ApiError);
    http.expectNone(() => true);
  });

  it.each([undefined, 'VILLAGE'] as const)('creates the required district kind: %s', async (kind) => {
    const body = { cityId: city.id, nameEn: district.nameEn, nameAr: district.nameAr, kind };
    const pending = createDistrict(body, key);
    const request = http.expectOne(`${BASE}/districts`);
    expect(request.request.body).toEqual({ ...body, kind: kind ?? 'DISTRICT' });
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    request.flush({ success: true, data: { ...district, kind: kind ?? 'DISTRICT' } });
    await expect(pending).resolves.toMatchObject({ kind: kind ?? 'DISTRICT' });
  });

  it('uses the shared CSRF error without sending an unprotected create', async () => {
    vi.spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get').mockReturnValue('');
    await expect(createCity(input, key)).rejects.toMatchObject({ status: 403, code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone(() => true);
  });

  it.each([
    [401, 'COMMON.GENERIC.UNAUTHORIZED'], [403, 'TENANT_WIDE_PERMISSION_REQUIRED'],
    [404, 'GEO_STATE_NOT_FOUND'], [409, 'GEO_CITY_NAME_TAKEN'],
    [422, 'GEO_PARENT_INACTIVE'], [429, 'GW.RATE.LIMIT_EXCEEDED'],
    [500, 'COMMON.GENERIC.INTERNAL_ERROR'], [503, 'ACCESS_POLICY_UNAVAILABLE'],
  ] as const)('preserves HTTP %s / %s without retries or fixture fallback', async (status, code) => {
    const pending = createCity(input, key);
    const checked = expect(pending).rejects.toMatchObject({ status, code, correlationId: 'request-1' });
    http.expectOne(`${BASE}/cities`).flush({ errorCode: code, correlationId: 'request-1' }, {
      status, statusText: 'Rejected', headers: { 'Retry-After': '9' },
    });
    await checked;
    http.expectNone(() => true);
  });

  it('preserves field validation details for the existing error handlers', async () => {
    const pending = createCity(input, key);
    const checked = pending.catch((error: unknown) => error);
    http.expectOne(`${BASE}/cities`).flush({
      errorCode: 'CORE_VALIDATION_FAILED', details: { nameEn: ['too long'] },
    }, { status: 400, statusText: 'Bad Request' });
    expect(fieldErrorsOf(await checked)).toEqual({ nameEn: ['too long'] });
    expect(errorMessage(await checked, 'geo', (value) => value === 'apiErrors.validation' ? 'validation' : value))
      .toBe('validation');
  });

  it('retains rate-limit delay and correlation data', async () => {
    const pending = listCountries();
    const checked = expect(pending).rejects.toMatchObject({
      status: 429, code: 'GW.RATE.LIMIT_EXCEEDED', correlationId: 'limited',
      details: { retryAfterSeconds: ['12'] },
    });
    http.expectOne(`${BASE}/countries`).flush({ code: 'GW.RATE.LIMIT_EXCEEDED', correlationId: 'limited' }, {
      status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '12' },
    });
    await checked;
  });

  it.each([null, {}, { items: [null] }, { items: [country, country] }, { items: [{ id: 'invalid' }] }])(
    'rejects malformed country lists rather than displaying false emptiness: %j', async (data) => {
      const pending = listCountries();
      const checked = expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
      http.expectOne(`${BASE}/countries`).flush({ success: true, data });
      await checked;
    },
  );

  it.each([undefined, '', 123])('rejects an invalid cursor response: %s', async (nextCursor) => {
    const pending = listCities(state.id, {});
    const checked = expect(pending).rejects.toMatchObject({ status: 502 });
    http.expectOne(`${cityPath}?limit=200`).flush({ success: true, data: { items: [city], nextCursor } });
    await checked;
  });

  it('does not accept an incomplete city projection as a successful create', async () => {
    const pending = createCity(input, key);
    const checked = expect(pending).rejects.toMatchObject({ status: 502 });
    http.expectOne(`${BASE}/cities`).flush({ success: true, data: lookup });
    await checked;
  });
});
