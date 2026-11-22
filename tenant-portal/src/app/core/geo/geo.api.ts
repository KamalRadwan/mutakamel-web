/*
 * Geography reads and quick creates used by the address fields and the CRM forms.
 * Public path: /api/tenant/core/v1/geo/... (the gateway maps it to Core's /api/v1/tenant/geo/...).
 * Core wraps each body in { success, data }; these functions return `data` and, where callers
 * only need rows, unwrap the items.
 */
import {
  fakeGeoCities,
  fakeGeoCountries,
  fakeGeoCreateCity,
  fakeGeoCreateDistrict,
  fakeGeoDistricts,
  fakeGeoStates,
  fakeGetCity,
  fakeGetCountry,
  fakeGetDistrict,
  fakeGetState,
} from './geo.fake';
import { CreateCityInput, CreateDistrictInput, GeoCity, GeoCountry, GeoDistrict, GeoState } from './geo.model';

/** Page size for the pickers (GeoListQueryDto allows 1..200). */
const PICKER_LIMIT = 200;

/** GET /api/tenant/core/v1/geo/countries -> { items } */
export async function listCountries(): Promise<GeoCountry[]> {
  return (await fakeGeoCountries()).items;
}

/** No backend route: GET /api/tenant/core/v1/geo/countries/:id */
export function getCountry(id: string): Promise<GeoCountry | null> {
  return fakeGetCountry(id);
}

/** GET /api/tenant/core/v1/geo/countries/:countryId/states -> { items } */
export async function listStates(countryId: string): Promise<GeoState[]> {
  return (await fakeGeoStates(countryId)).items;
}

/** No backend route: GET /api/tenant/core/v1/geo/states/:id */
export function getState(id: string): Promise<GeoState | null> {
  return fakeGetState(id);
}

/** GET /api/tenant/core/v1/geo/states/:stateId/cities?search&limit -> first page, active cities only */
export async function listCities(stateId: string, search?: string): Promise<GeoCity[]> {
  const page = await fakeGeoCities(stateId, { search: search || undefined, limit: PICKER_LIMIT });
  return page.items.filter((city) => city.isActive);
}

/** No backend route: GET /api/tenant/core/v1/geo/cities/:id */
export function getCity(id: string): Promise<GeoCity | null> {
  return fakeGetCity(id);
}

/** POST /api/tenant/core/v1/geo/cities (header x-idempotency-key, replayed by the gateway) */
export function createCity(input: CreateCityInput, _idempotencyKey?: string): Promise<GeoCity> {
  return fakeGeoCreateCity(input);
}

/** GET /api/tenant/core/v1/geo/cities/:cityId/districts?search&limit -> first page, active ones only */
export async function listDistricts(cityId: string, search?: string): Promise<GeoDistrict[]> {
  const page = await fakeGeoDistricts(cityId, { search: search || undefined, limit: PICKER_LIMIT });
  return page.items.filter((district) => district.isActive);
}

/** No backend route: GET /api/tenant/core/v1/geo/districts/:id */
export function getDistrict(id: string): Promise<GeoDistrict | null> {
  return fakeGetDistrict(id);
}

/**
 * POST /api/tenant/core/v1/geo/districts (header x-idempotency-key, replayed by the gateway).
 * CreateGeoDistrictDto requires kind, so a quick create without one is a DISTRICT.
 */
export function createDistrict(input: CreateDistrictInput, _idempotencyKey?: string): Promise<GeoDistrict> {
  return fakeGeoCreateDistrict({ ...input, kind: input.kind ?? 'DISTRICT' });
}
