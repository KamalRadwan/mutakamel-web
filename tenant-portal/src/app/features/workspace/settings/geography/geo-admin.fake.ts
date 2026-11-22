/*
 * Admin fake: the core geo fake (which mirrors GeoService) plus two test switches
 * and the city-path lookup that has no backend route.
 */
import { ApiError } from '../../../../core/api/api-errors';
import {
  GEO_FAKE_DB,
  fakeGeoCities,
  fakeGeoCountries,
  fakeGeoCreateCity,
  fakeGeoCreateDistrict,
  fakeGeoCreateZone,
  fakeGeoDeleteCity,
  fakeGeoDeleteDistrict,
  fakeGeoDeleteZone,
  fakeGeoDistricts,
  fakeGeoStates,
  fakeGeoUpdateCity,
  fakeGeoUpdateDistrict,
  fakeGeoUpdateZone,
  fakeGeoZone,
  fakeGeoZones,
  fakeGetCitiesByIds,
} from '../../../../core/geo/geo.fake';
import type {
  CityWithPath,
  CreateGeoCityBody,
  CreateGeoDistrictBody,
  CreateGeoZoneBody,
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

/** When true, writes fail like a user without geo.places.manage / geo.zones.manage (403). */
export let FAKE_GEO_READ_ONLY = false;

/** When true, the next call resets this flag and fails like Core with its database down (503). */
export let FAKE_GEO_FAIL_NEXT = false;

/** ES module bindings are read-only for importers, so tests and dev tools flip the flags through these. */
export function setFakeGeoReadOnly(readOnly: boolean): void {
  FAKE_GEO_READ_ONLY = readOnly;
}

export function setFakeGeoFailNext(fail: boolean): void {
  FAKE_GEO_FAIL_NEXT = fail;
}

async function guard(isWrite: boolean): Promise<void> {
  if (FAKE_GEO_FAIL_NEXT) {
    FAKE_GEO_FAIL_NEXT = false;
    throw new ApiError(503, 'COMMON.DATABASE.UNAVAILABLE');
  }
  if (isWrite && FAKE_GEO_READ_ONLY) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
  }
}

export async function fakeAdminListCountries(): Promise<GeoItems<GeoCountry>> {
  await guard(false);
  return fakeGeoCountries();
}

export async function fakeAdminListStates(countryId: string): Promise<GeoItems<GeoState>> {
  await guard(false);
  return fakeGeoStates(countryId);
}

export async function fakeAdminListCities(stateId: string, query: GeoListQuery): Promise<GeoCursorPage<GeoCity>> {
  await guard(false);
  return fakeGeoCities(stateId, query);
}

export async function fakeAdminCreateCity(body: CreateGeoCityBody): Promise<GeoCity> {
  await guard(true);
  return fakeGeoCreateCity(body);
}

export async function fakeAdminUpdateCity(id: string, patch: UpdateGeoCityBody): Promise<GeoCity> {
  await guard(true);
  return fakeGeoUpdateCity(id, patch);
}

export async function fakeAdminDeleteCity(id: string): Promise<void> {
  await guard(true);
  return fakeGeoDeleteCity(id);
}

export async function fakeAdminListDistricts(cityId: string, query: GeoDistrictQuery): Promise<GeoCursorPage<GeoDistrict>> {
  await guard(false);
  return fakeGeoDistricts(cityId, query);
}

export async function fakeAdminCreateDistrict(body: CreateGeoDistrictBody): Promise<GeoDistrict> {
  await guard(true);
  return fakeGeoCreateDistrict(body);
}

export async function fakeAdminUpdateDistrict(id: string, patch: UpdateGeoDistrictBody): Promise<GeoDistrict> {
  await guard(true);
  return fakeGeoUpdateDistrict(id, patch);
}

export async function fakeAdminDeleteDistrict(id: string): Promise<void> {
  await guard(true);
  return fakeGeoDeleteDistrict(id);
}

export async function fakeAdminListZones(query: GeoListQuery): Promise<GeoCursorPage<GeoZone>> {
  await guard(false);
  return fakeGeoZones(query);
}

export async function fakeAdminGetZone(id: string): Promise<GeoZoneDetail> {
  await guard(false);
  return fakeGeoZone(id);
}

export async function fakeAdminCreateZone(body: CreateGeoZoneBody): Promise<GeoZoneDetail> {
  await guard(true);
  return fakeGeoCreateZone(body);
}

export async function fakeAdminUpdateZone(id: string, patch: UpdateGeoZoneBody): Promise<GeoZoneDetail> {
  await guard(true);
  return fakeGeoUpdateZone(id, patch);
}

export async function fakeAdminDeleteZone(id: string): Promise<void> {
  await guard(true);
  return fakeGeoDeleteZone(id);
}

/** No backend route: city chips with their state names and country ISO2 code. */
export async function fakeAdminGetCitiesByIds(ids: string[]): Promise<CityWithPath[]> {
  await guard(false);
  const cities = await fakeGetCitiesByIds(ids);
  return cities.flatMap((city) => {
    const state = GEO_FAKE_DB.states.find((item) => item.id === city.stateId);
    const country = state ? GEO_FAKE_DB.countries.find((item) => item.id === state.countryId) : undefined;
    if (!state || !country) return [];
    return [{ ...city, stateName: { en: state.nameEn, ar: state.nameAr }, countryIso2: country.iso2 }];
  });
}
