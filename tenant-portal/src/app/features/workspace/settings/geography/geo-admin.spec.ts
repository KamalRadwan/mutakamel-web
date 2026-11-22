import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { GEO_FAKE_DB } from '../../../../core/geo/geo.fake';
import {
  GEO_LIMITS,
  createCity,
  createDistrict,
  createZone,
  deleteCity,
  deleteDistrict,
  deleteZone,
  getCitiesByIds,
  getZone,
  listAllZones,
  listCities,
  listCountries,
  listDistricts,
  listStates,
  listZones,
  setFakeGeoFailNext,
  setFakeGeoReadOnly,
  updateCity,
  updateDistrict,
  updateZone,
} from './geo-admin.api';

/*
 * geo-admin.api.ts over geo-admin.fake.ts (which wraps core/geo/geo.fake.ts). Geo reads are not
 * Core PaginatedResults: catalogue lists are { items }, place lists are cursor pages
 * { items, nextCursor }, single records are bare. Validation errors are CORE_VALIDATION_FAILED
 * with details keyed by field. Core geo does not check x-idempotency-key (the gateway does),
 * so the fake has no IDEM_* codes.
 */

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

const SEED = structuredClone(GEO_FAKE_DB);

describe('geo admin api (fake)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    GEO_FAKE_DB.countries = structuredClone(SEED.countries);
    GEO_FAKE_DB.states = structuredClone(SEED.states);
    GEO_FAKE_DB.cities = structuredClone(SEED.cities);
    GEO_FAKE_DB.districts = structuredClone(SEED.districts);
    GEO_FAKE_DB.zones = structuredClone(SEED.zones);
  });
  afterEach(() => {
    setFakeGeoReadOnly(false);
    setFakeGeoFailNext(false);
    vi.useRealTimers();
  });

  describe('catalogue reads', () => {
    it('lists countries as { items } by sort order without isActive', async () => {
      const result = await settle(listCountries());
      expect(Object.keys(result)).toEqual(['items']);
      expect(result.items[0].iso2).toBe('EG');
      expect(result.items[0]).not.toHaveProperty('isActive');
    });

    it('lists states as { items } and answers 404 GEO_COUNTRY_NOT_FOUND', async () => {
      const result = await settle(listStates('geo-sa'));
      expect(result.items.map((row) => row.code).sort()).toEqual(['EP', 'MK', 'RI']);
      const error = await errorOf(listStates('missing'));
      expect([error.status, error.code]).toEqual([404, 'GEO_COUNTRY_NOT_FOUND']);
    });
  });

  describe('cities', () => {
    it('lists a cursor page { items, nextCursor } sorted by English name with zoneId', async () => {
      const result = await settle(listCities('geo-eg-c'));
      expect(Object.keys(result).sort()).toEqual(['items', 'nextCursor']);
      expect(result.nextCursor).toBeNull();
      expect(result.items.map((row) => row.nameEn)).toEqual(['Heliopolis', 'Maadi', 'Nasr City']);
      expect(result.items[0].zoneId).toBe('geo-zone-a');
      expect(result.items[0]).not.toHaveProperty('addressCount');
    });

    it('follows the cursor to the next page', async () => {
      const first = await settle(listCities('geo-eg-c', { limit: 2 }));
      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).toEqual(expect.any(String));
      const second = await settle(listCities('geo-eg-c', { limit: 2, cursor: first.nextCursor }));
      expect(second.items.map((row) => row.nameEn)).toEqual(['Nasr City']);
      expect(second.nextCursor).toBeNull();
    });

    it('answers CORE_VALIDATION_FAILED keyed by field for a bad query, and for a cursor from another search', async () => {
      const error = await errorOf(listCities('geo-eg-c', { limit: GEO_LIMITS.pageMax + 1, cursor: '' }));
      expect([error.status, error.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
      expect(error.details).toEqual({ limit: ['limit must not be greater than 200'], cursor: ['cursor should not be empty'] });

      const first = await settle(listCities('geo-eg-c', { limit: 1 }));
      const scoped = await errorOf(listCities('geo-eg-c', { limit: 1, search: 'a', cursor: first.nextCursor }));
      expect(scoped.code).toBe('CORE_VALIDATION_FAILED');
    });

    it('answers 404 GEO_STATE_NOT_FOUND for an unknown state', async () => {
      const error = await errorOf(listCities('missing'));
      expect([error.status, error.code]).toEqual([404, 'GEO_STATE_NOT_FOUND']);
    });

    it('creates, renames and deletes a city', async () => {
      const created = await settle(createCity({ stateId: 'geo-eg-c', nameEn: ' Zamalek ', nameAr: 'الزمالك' }, newIdempotencyKey()));
      expect(created).toMatchObject({ stateId: 'geo-eg-c', nameEn: 'Zamalek', isActive: true, zoneId: null });
      const renamed = await settle(updateCity(created.id, { nameEn: 'Zamalek Island' }, newIdempotencyKey()));
      expect(renamed.nameEn).toBe('Zamalek Island');
      await expect(settle(deleteCity(created.id, newIdempotencyKey()))).resolves.toBeUndefined();
      const after = await settle(listCities('geo-eg-c'));
      expect(after.items.some((row) => row.id === created.id)).toBe(false);
    });

    it('answers CORE_VALIDATION_FAILED with messages per field', async () => {
      const error = await errorOf(createCity({ stateId: 'geo-eg-c', nameEn: '', nameAr: 'x'.repeat(121) }, newIdempotencyKey()));
      expect(error.details).toEqual({
        nameEn: ['nameEn should not be empty'],
        nameAr: ['nameAr must be shorter than or equal to 120 characters'],
      });
    });

    it('answers the city business codes', async () => {
      const taken = await errorOf(createCity({ stateId: 'geo-eg-c', nameEn: 'maadi', nameAr: 'جديد' }, newIdempotencyKey()));
      expect([taken.status, taken.code]).toEqual([409, 'GEO_CITY_NAME_TAKEN']);

      const noState = await errorOf(createCity({ stateId: 'missing', nameEn: 'A', nameAr: 'ب' }, newIdempotencyKey()));
      expect([noState.status, noState.code]).toEqual([404, 'GEO_STATE_NOT_FOUND']);

      GEO_FAKE_DB.states.find((row) => row.id === 'geo-eg-gz')!.isActive = false;
      const inactive = await errorOf(createCity({ stateId: 'geo-eg-gz', nameEn: 'A', nameAr: 'ب' }, newIdempotencyKey()));
      expect([inactive.status, inactive.code]).toEqual([422, 'GEO_PARENT_INACTIVE']);

      const inUse = await errorOf(deleteCity('geo-city-maadi', newIdempotencyKey()));
      expect([inUse.status, inUse.code]).toEqual([409, 'GEO_CITY_IN_USE']);
      expect(inUse.details).toEqual({ usedBy: ['addresses', 'districts', 'zones'] });

      const missing = await errorOf(updateCity('missing', { nameEn: 'X' }, newIdempotencyKey()));
      expect([missing.status, missing.code]).toEqual([404, 'GEO_CITY_NOT_FOUND']);
    });
  });

  describe('districts', () => {
    it('lists districts filtered by kind as a cursor page', async () => {
      const all = await settle(listDistricts('geo-city-maadi'));
      expect(all.items.map((row) => row.nameEn)).toEqual(['Degla', 'Sarayat']);
      const villages = await settle(listDistricts('geo-city-6oct', { kind: 'VILLAGE' }));
      expect(villages.items.map((row) => row.kind)).toEqual(['VILLAGE']);
    });

    it('creates, updates and deletes a district; blocks one in use', async () => {
      const created = await settle(createDistrict({ cityId: 'geo-city-nasr', kind: 'DISTRICT', nameEn: '8th District', nameAr: 'الحي الثامن' }, newIdempotencyKey()));
      expect(created).not.toHaveProperty('addressCount');
      const updated = await settle(updateDistrict(created.id, { kind: 'VILLAGE' }, newIdempotencyKey()));
      expect(updated.kind).toBe('VILLAGE');
      await settle(deleteDistrict(created.id, newIdempotencyKey()));

      const inUse = await errorOf(deleteDistrict('geo-dist-degla', newIdempotencyKey()));
      expect([inUse.status, inUse.code]).toEqual([409, 'GEO_DISTRICT_IN_USE']);
      expect(inUse.details).toEqual({ usedBy: ['addresses'] });
    });

    it('answers CORE_VALIDATION_FAILED for a bad kind and 409 for a taken name', async () => {
      const kind = await errorOf(createDistrict({ cityId: 'geo-city-nasr', kind: 'TOWN' as never, nameEn: 'A', nameAr: 'ب' }, newIdempotencyKey()));
      expect(kind.details).toEqual({ kind: ['kind must be one of the following values: VILLAGE, DISTRICT'] });
      const taken = await errorOf(createDistrict({ cityId: 'geo-city-maadi', kind: 'DISTRICT', nameEn: 'DEGLA', nameAr: 'ب' }, newIdempotencyKey()));
      expect([taken.status, taken.code]).toEqual([409, 'GEO_DISTRICT_NAME_TAKEN']);
    });
  });

  describe('zones', () => {
    it('lists zones with cityCount and reads one with its cities', async () => {
      const page = await settle(listZones());
      expect(page).toEqual({ items: [expect.objectContaining({ id: 'geo-zone-a', cityCount: 3 })], nextCursor: null });
      expect(page.items[0]).not.toHaveProperty('cityIds');
      const zone = await settle(getZone('geo-zone-a'));
      expect(zone.cities.map((row) => row.nameEn)).toEqual(['Heliopolis', 'Maadi', 'Nasr City']);
      expect(Object.keys(zone.cities[0]).sort()).toEqual(['id', 'nameAr', 'nameEn', 'stateId']);
    });

    it('listAllZones walks every cursor page', async () => {
      const extra = GEO_LIMITS.pageMax + 5;
      for (let index = 0; index < extra; index++) {
        GEO_FAKE_DB.zones.push({
          id: `geo-zone-x${String(index).padStart(3, '0')}`,
          nameEn: `Zone X${String(index).padStart(3, '0')}`,
          nameAr: `منطقة ${index}`,
          description: null,
          isActive: true,
          cityIds: [],
          createdAt: '2026-01-15T09:00:00.000Z',
          updatedAt: '2026-01-15T09:00:00.000Z',
        });
      }
      const zones = await settle(listAllZones());
      expect(zones).toHaveLength(extra + 1);
      expect(new Set(zones.map((zone) => zone.id)).size).toBe(extra + 1);
    });

    it('creates, updates and deletes a zone', async () => {
      const created = await settle(createZone({ nameEn: 'Zone B', nameAr: 'المنطقة ب', cityIds: ['geo-city-dokki'] }, newIdempotencyKey()));
      expect(created).toMatchObject({ nameEn: 'Zone B', cityCount: 1, description: null });
      expect(created.cities.map((row) => row.id)).toEqual(['geo-city-dokki']);
      const updated = await settle(updateZone(created.id, { cityIds: ['geo-city-dokki', 'geo-city-6oct'], description: ' West ' }, newIdempotencyKey()));
      expect(updated).toMatchObject({ cityCount: 2, description: 'West' });
      await settle(deleteZone(created.id, newIdempotencyKey()));
      const missing = await errorOf(getZone(created.id));
      expect([missing.status, missing.code]).toEqual([404, 'GEO_ZONE_NOT_FOUND']);
    });

    it('answers the zone codes with string-array details', async () => {
      const invalid = await errorOf(createZone({ nameEn: 'Z1', nameAr: 'ز١', cityIds: ['nope'] }, newIdempotencyKey()));
      expect([invalid.status, invalid.code]).toEqual([422, 'GEO_ZONE_CITY_INVALID']);
      expect(invalid.details).toEqual({ cityIds: ['nope'] });

      const conflict = await errorOf(createZone({ nameEn: 'Z2', nameAr: 'ز٢', cityIds: ['geo-city-maadi'] }, newIdempotencyKey()));
      expect([conflict.status, conflict.code]).toEqual([409, 'GEO_ZONE_CITY_CONFLICT']);
      expect(conflict.details).toEqual({ cityIds: ['geo-city-maadi'], zoneIds: ['geo-zone-a'] });

      const taken = await errorOf(createZone({ nameEn: 'zone a', nameAr: 'جديد', cityIds: [] }, newIdempotencyKey()));
      expect([taken.status, taken.code]).toEqual([409, 'GEO_ZONE_NAME_TAKEN']);

      const dup = await errorOf(createZone({ nameEn: 'Z3', nameAr: 'ز٣', cityIds: ['geo-city-dokki', 'GEO-CITY-DOKKI'] }, newIdempotencyKey()));
      expect(dup.code).toBe('CORE_VALIDATION_FAILED');
      expect(dup.details).toEqual({ cityIds: ["All cityIds's elements must be unique"] });
    });
  });

  describe('fake switches', () => {
    it('FAKE_GEO_READ_ONLY makes writes answer 403 MISSING_REQUIRED_PERMISSIONS and keeps reads working', async () => {
      setFakeGeoReadOnly(true);
      const create = await errorOf(createCity({ stateId: 'geo-eg-c', nameEn: 'Zamalek', nameAr: 'الزمالك' }, newIdempotencyKey()));
      expect([create.status, create.code]).toEqual([403, 'MISSING_REQUIRED_PERMISSIONS']);
      const remove = await errorOf(deleteZone('geo-zone-a', newIdempotencyKey()));
      expect([remove.status, remove.code]).toEqual([403, 'MISSING_REQUIRED_PERMISSIONS']);
      expect((await settle(listCountries())).items.length).toBeGreaterThan(0);

      setFakeGeoReadOnly(false);
      const created = await settle(createCity({ stateId: 'geo-eg-c', nameEn: 'Zamalek', nameAr: 'الزمالك' }, newIdempotencyKey()));
      expect(created.nameEn).toBe('Zamalek');
    });

    it('FAKE_GEO_FAIL_NEXT fails the next call once with 503 COMMON.DATABASE.UNAVAILABLE', async () => {
      setFakeGeoFailNext(true);
      const error = await errorOf(listCountries());
      expect([error.status, error.code]).toEqual([503, 'COMMON.DATABASE.UNAVAILABLE']);
      await expect(settle(listCountries())).resolves.toMatchObject({ items: expect.any(Array) });
    });
  });

  describe('getCitiesByIds (FAKE-ONLY)', () => {
    it('returns live cities with their state name and country ISO2, dropping unknown ids', async () => {
      const cities = await settle(getCitiesByIds(['geo-city-jeddah', 'missing', 'geo-city-jeddah']));
      expect(cities).toHaveLength(1);
      expect(cities[0]).toMatchObject({ id: 'geo-city-jeddah', countryIso2: 'SA', stateName: { en: 'Makkah', ar: 'منطقة مكة المكرمة' } });
    });
  });
});
