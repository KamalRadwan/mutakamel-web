/*
 * Geography admin calls. Public path: /api/tenant/core/v1/geo/... (the api-gateway canonical form;
 * Core's controller path /api/v1/tenant/geo is only the gateway's upstream).
 * Core wraps each body in { success, data }; these functions return `data`.
 * Every write sends x-idempotency-key: the gateway requires it on these routes (idempotent: true in
 * the route contracts); Core geo itself does not check it. One key per user action, reused on retry.
 */
import {
  fakeAdminCreateCity,
  fakeAdminCreateDistrict,
  fakeAdminCreateZone,
  fakeAdminDeleteCity,
  fakeAdminDeleteDistrict,
  fakeAdminDeleteZone,
  fakeAdminGetCitiesByIds,
  fakeAdminGetZone,
  fakeAdminListCities,
  fakeAdminListCountries,
  fakeAdminListDistricts,
  fakeAdminListStates,
  fakeAdminListZones,
  fakeAdminUpdateCity,
  fakeAdminUpdateDistrict,
  fakeAdminUpdateZone,
} from './geo-admin.fake';
import {
  CityWithPath,
  CreateGeoCityBody,
  CreateGeoDistrictBody,
  CreateGeoZoneBody,
  GEO_LIMITS,
  GeoCity,
  GeoCountry,
  GeoCursorPage,
  GeoDistrict,
  GeoDistrictQuery,
  GeoItems,
  GeoListQuery,
  GeoState,
  GeoZone,
  GeoZoneDetail,
  UpdateGeoCityBody,
  UpdateGeoDistrictBody,
  UpdateGeoZoneBody,
} from './geo-admin.model';

export { FAKE_GEO_FAIL_NEXT, FAKE_GEO_READ_ONLY, setFakeGeoFailNext, setFakeGeoReadOnly } from './geo-admin.fake';
export * from './geo-admin.model';

/** GET /api/tenant/core/v1/geo/countries -> { items } (active only, no paging) */
export function listCountries(): Promise<GeoItems<GeoCountry>> {
  return fakeAdminListCountries();
}

/** GET /api/tenant/core/v1/geo/countries/:countryId/states -> { items } (active only, no paging) */
export function listStates(countryId: string): Promise<GeoItems<GeoState>> {
  return fakeAdminListStates(countryId);
}

/** GET /api/tenant/core/v1/geo/states/:stateId/cities?search&cursor&limit (inactive cities included) */
export function listCities(stateId: string, query: GeoListQuery = {}): Promise<GeoCursorPage<GeoCity>> {
  return fakeAdminListCities(stateId, query);
}

/** POST /api/tenant/core/v1/geo/cities (x-idempotency-key) -> 201 city */
export function createCity(body: CreateGeoCityBody, _key: string): Promise<GeoCity> {
  return fakeAdminCreateCity(body);
}

/** PATCH /api/tenant/core/v1/geo/cities/:id (x-idempotency-key) -> 200 city */
export function updateCity(id: string, patch: UpdateGeoCityBody, _key: string): Promise<GeoCity> {
  return fakeAdminUpdateCity(id, patch);
}

/** DELETE /api/tenant/core/v1/geo/cities/:id (x-idempotency-key) -> 204 */
export function deleteCity(id: string, _key: string): Promise<void> {
  return fakeAdminDeleteCity(id);
}

/** GET /api/tenant/core/v1/geo/cities/:cityId/districts?search&cursor&limit&kind (inactive included) */
export function listDistricts(cityId: string, query: GeoDistrictQuery = {}): Promise<GeoCursorPage<GeoDistrict>> {
  return fakeAdminListDistricts(cityId, query);
}

/** POST /api/tenant/core/v1/geo/districts (x-idempotency-key) -> 201 district */
export function createDistrict(body: CreateGeoDistrictBody, _key: string): Promise<GeoDistrict> {
  return fakeAdminCreateDistrict(body);
}

/** PATCH /api/tenant/core/v1/geo/districts/:id (x-idempotency-key) -> 200 district */
export function updateDistrict(id: string, patch: UpdateGeoDistrictBody, _key: string): Promise<GeoDistrict> {
  return fakeAdminUpdateDistrict(id, patch);
}

/** DELETE /api/tenant/core/v1/geo/districts/:id (x-idempotency-key) -> 204 */
export function deleteDistrict(id: string, _key: string): Promise<void> {
  return fakeAdminDeleteDistrict(id);
}

/** GET /api/tenant/core/v1/geo/zones?search&cursor&limit -> cursor page of zones with cityCount */
export function listZones(query: GeoListQuery = {}): Promise<GeoCursorPage<GeoZone>> {
  return fakeAdminListZones(query);
}

/** Every zone, page by page (zone names on city rows and in the city picker). */
export async function listAllZones(): Promise<GeoZone[]> {
  const zones: GeoZone[] = [];
  let cursor: string | null = null;
  do {
    const page: GeoCursorPage<GeoZone> = await listZones({ cursor, limit: GEO_LIMITS.pageMax });
    zones.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return zones;
}

/** GET /api/tenant/core/v1/geo/zones/:id -> zone with cities[] */
export function getZone(id: string): Promise<GeoZoneDetail> {
  return fakeAdminGetZone(id);
}

/** POST /api/tenant/core/v1/geo/zones (x-idempotency-key) -> 201 zone with cities[] */
export function createZone(body: CreateGeoZoneBody, _key: string): Promise<GeoZoneDetail> {
  return fakeAdminCreateZone(body);
}

/** PATCH /api/tenant/core/v1/geo/zones/:id (x-idempotency-key) -> 200 zone with cities[] */
export function updateZone(id: string, patch: UpdateGeoZoneBody, _key: string): Promise<GeoZoneDetail> {
  return fakeAdminUpdateZone(id, patch);
}

/** DELETE /api/tenant/core/v1/geo/zones/:id (x-idempotency-key) -> 204 */
export function deleteZone(id: string, _key: string): Promise<void> {
  return fakeAdminDeleteZone(id);
}

/** No backend route: GET /api/tenant/core/v1/geo/cities?ids=... (city chips with their state and country). */
export function getCitiesByIds(ids: string[]): Promise<CityWithPath[]> {
  return fakeAdminGetCitiesByIds(ids);
}
