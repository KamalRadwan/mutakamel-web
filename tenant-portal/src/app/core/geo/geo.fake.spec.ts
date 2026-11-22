import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/api-errors';
import {
  GEO_FAKE_DB,
  fakeGeoCities,
  fakeGeoCountries,
  fakeGeoCreateCity,
  fakeGeoCreateDistrict,
  fakeGeoCreateZone,
  fakeGeoDeleteCity,
  fakeGeoDeleteDistrict,
  fakeGeoDistricts,
  fakeGeoStates,
  fakeGeoUpdateZone,
  fakeGeoZone,
  fakeGeoZones,
} from './geo.fake';
import { listCities, listCountries } from './geo.api';

async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

describe('core geo fake (mirrors core-app GeoService)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('lists countries and states as { items } without isActive, by sortOrder', async () => {
    const countries = await settle(fakeGeoCountries());
    expect(Object.keys(countries)).toEqual(['items']);
    expect(countries.items[0]).toEqual(expect.objectContaining({ iso2: 'EG', flagCode: 'eg', sortOrder: 0 }));
    expect(countries.items[0]).not.toHaveProperty('isActive');

    const states = await settle(fakeGeoStates('geo-eg'));
    expect(states.items.length).toBeGreaterThan(0);
    expect(states.items[0]).not.toHaveProperty('isActive');
    expect((await errorOf(fakeGeoStates('missing'))).code).toBe('GEO_COUNTRY_NOT_FOUND');
  });

  it('lists cities per state as a cursor page with zoneId and no counts', async () => {
    const first = await settle(fakeGeoCities('geo-eg-c', { limit: 2 }));
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(first.items[0]).not.toHaveProperty('districtCount');
    expect(first.items[0]).not.toHaveProperty('usageCount');
    expect(first.items[0]).toHaveProperty('zoneId');

    const second = await settle(fakeGeoCities('geo-eg-c', { limit: 2, cursor: first.nextCursor }));
    const ids = [...first.items, ...second.items].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);

    const bad = await errorOf(fakeGeoCities('geo-eg-c', { cursor: first.nextCursor, search: 'x' }));
    expect(bad.code).toBe('CORE_VALIDATION_FAILED');
    expect((await errorOf(fakeGeoCities('missing'))).code).toBe('GEO_STATE_NOT_FOUND');
  });

  it('includes inactive cities in the list', async () => {
    const created = await settle(fakeGeoCreateCity({ stateId: 'geo-eg-alx', nameEn: 'Inactive Town', nameAr: 'بلدة متوقفة', isActive: false }));
    const page = await settle(fakeGeoCities('geo-eg-alx'));
    expect(page.items.some((c) => c.id === created.id && !c.isActive)).toBe(true);
    // The picker api keeps active cities only.
    const picker = listCities('geo-eg-alx');
    expect((await settle(picker)).some((c) => c.id === created.id)).toBe(false);
  });

  it('keeps listCountries() callers on a plain array', async () => {
    const items = await settle(listCountries());
    expect(Array.isArray(items)).toBe(true);
  });

  it('creates districts with POST districts and its errors', async () => {
    const created = await settle(fakeGeoCreateDistrict({ cityId: 'geo-city-dokki', kind: 'VILLAGE', nameEn: 'Mit Oqba', nameAr: 'ميت عقبة' }));
    expect(created).toEqual(expect.objectContaining({ cityId: 'geo-city-dokki', kind: 'VILLAGE', isActive: true }));
    expect(created).not.toHaveProperty('usageCount');

    const taken = await errorOf(fakeGeoCreateDistrict({ cityId: 'geo-city-dokki', kind: 'DISTRICT', nameEn: 'mit oqba', nameAr: 'آخر' }));
    expect([taken.status, taken.code]).toEqual([409, 'GEO_DISTRICT_NAME_TAKEN']);

    expect((await errorOf(fakeGeoCreateDistrict({ cityId: 'missing', kind: 'DISTRICT', nameEn: 'A', nameAr: 'ب' }))).code).toBe('GEO_CITY_NOT_FOUND');
  });

  it('rejects a city under an inactive parent and a taken name', async () => {
    GEO_FAKE_DB.states.find((s) => s.id === 'geo-eg-shr')!.isActive = false;
    const inactive = await errorOf(fakeGeoCreateCity({ stateId: 'geo-eg-shr', nameEn: 'Zagazig', nameAr: 'الزقازيق' }));
    expect([inactive.status, inactive.code]).toEqual([422, 'GEO_PARENT_INACTIVE']);
    GEO_FAKE_DB.states.find((s) => s.id === 'geo-eg-shr')!.isActive = true;

    expect((await errorOf(fakeGeoCreateCity({ stateId: 'missing', nameEn: 'A', nameAr: 'ب' }))).code).toBe('GEO_STATE_NOT_FOUND');
    const taken = await errorOf(fakeGeoCreateCity({ stateId: 'geo-eg-c', nameEn: 'MAADI', nameAr: 'جديد' }));
    expect([taken.status, taken.code]).toEqual([409, 'GEO_CITY_NAME_TAKEN']);
  });

  it('sends CORE_VALIDATION_FAILED details as field -> messages', async () => {
    const error = await errorOf(fakeGeoCreateCity({ stateId: 'geo-eg-c', nameEn: ' ', nameAr: 'x'.repeat(121) }));
    expect(error.status).toBe(400);
    expect(error.details).toEqual({
      nameEn: ['nameEn should not be empty'],
      nameAr: ['nameAr must be shorter than or equal to 120 characters'],
    });
  });

  it('reports what uses a city or a district in details.usedBy', async () => {
    const city = await errorOf(fakeGeoDeleteCity('geo-city-maadi'));
    expect([city.status, city.code]).toEqual([409, 'GEO_CITY_IN_USE']);
    expect(city.details).toEqual({ usedBy: ['addresses', 'districts', 'zones'] });

    const district = await errorOf(fakeGeoDeleteDistrict('geo-dist-degla'));
    expect(district.details).toEqual({ usedBy: ['addresses'] });
  });

  it('pages zones with cityCount and isActive; the detail lists cities[]', async () => {
    const page = await settle(fakeGeoZones());
    const zone = page.items.find((z) => z.id === 'geo-zone-a')!;
    expect(zone).toEqual(expect.objectContaining({ cityCount: 3, isActive: true }));
    expect(zone).not.toHaveProperty('cityIds');
    expect(page).toHaveProperty('nextCursor', null);

    const detail = await settle(fakeGeoZone('geo-zone-a'));
    expect(detail.cities.map((c) => c.id).sort()).toEqual(['geo-city-heliopolis', 'geo-city-maadi', 'geo-city-nasr']);
    expect(detail.cities[0]).toEqual({ id: expect.any(String), stateId: 'geo-eg-c', nameEn: expect.any(String), nameAr: expect.any(String) });
  });

  it('rejects zone cities that are taken or unknown, and the DTO limits', async () => {
    const conflict = await errorOf(fakeGeoCreateZone({ nameEn: 'Zone B', nameAr: 'المنطقة ب', cityIds: ['geo-city-maadi', 'geo-city-dokki'] }));
    expect([conflict.status, conflict.code]).toEqual([409, 'GEO_ZONE_CITY_CONFLICT']);
    expect(conflict.details).toEqual({ cityIds: ['geo-city-maadi'], zoneIds: ['geo-zone-a'] });

    const invalid = await errorOf(fakeGeoCreateZone({ nameEn: 'Zone B', nameAr: 'المنطقة ب', cityIds: ['nope'] }));
    expect([invalid.status, invalid.code, invalid.details]).toEqual([422, 'GEO_ZONE_CITY_INVALID', { cityIds: ['nope'] }]);

    const limits = await errorOf(
      fakeGeoUpdateZone('geo-zone-a', { description: 'x'.repeat(1001), cityIds: Array.from({ length: 501 }, (_, i) => `c${i}`) }),
    );
    expect(limits.code).toBe('CORE_VALIDATION_FAILED');
    expect(Object.keys(limits.details ?? {}).sort()).toEqual(['cityIds', 'description']);
  });

  it('updates zone membership, description and isActive', async () => {
    const updated = await settle(fakeGeoUpdateZone('geo-zone-a', { isActive: false, description: null, cityIds: ['geo-city-maadi'] }));
    expect(updated).toEqual(expect.objectContaining({ isActive: false, description: null, cityCount: 1 }));
    const district = await settle(fakeGeoDistricts('geo-city-nasr'));
    expect(district.items.length).toBeGreaterThan(0);
  });
});
