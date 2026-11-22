import type { GeoCity } from '../../../../core/geo/geo.model';

export type {
  CreateGeoCityBody,
  CreateGeoDistrictBody,
  CreateGeoZoneBody,
  GeoCity,
  GeoCountry,
  GeoCursorPage,
  GeoDistrict,
  GeoDistrictKind,
  GeoDistrictQuery,
  GeoItems,
  GeoListQuery,
  GeoState,
  GeoZone,
  GeoZoneCity,
  GeoZoneDetail,
  UpdateGeoCityBody,
  UpdateGeoDistrictBody,
  UpdateGeoZoneBody,
} from '../../../../core/geo/geo.model';
export { geoFlagUrl, geoNameIn, matchesGeoSearch, normalizeGeoSearch } from '../../../../core/geo/geo.model';

/** geo.dto.ts limits: names 120, description 1000, 0..500 zone cities, page size 50 by default (max 200). */
export const GEO_LIMITS = {
  name: 120,
  description: 1000,
  zoneCities: 500,
  pageSize: 50,
  pageMax: 200,
} as const;

/** City enriched with its state names and country ISO2 code for zone chips (built on the client). */
export interface CityWithPath extends GeoCity {
  stateName: { en: string; ar: string };
  countryIso2: string;
}

/** What GEO_CITY_IN_USE / GEO_DISTRICT_IN_USE list in details.usedBy. */
export type GeoUsedBy = 'addresses' | 'districts' | 'zones';

/** Reads details.usedBy of an *_IN_USE error (Core's filter keeps only string-array details). */
export function usedByOf(details: Record<string, unknown> | undefined): GeoUsedBy[] {
  const raw = details?.['usedBy'];
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is GeoUsedBy => item === 'addresses' || item === 'districts' || item === 'zones');
}

/** Reads GEO_ZONE_CITY_CONFLICT details: cityIds[i] already belongs to zoneIds[i]. */
export function zoneConflictsOf(details: Record<string, unknown> | undefined): { cityId: string; zoneId: string | null }[] {
  const cityIds = details?.['cityIds'];
  const zoneIds = details?.['zoneIds'];
  if (!Array.isArray(cityIds)) return [];
  return cityIds.flatMap((cityId, i) => {
    if (typeof cityId !== 'string') return [];
    const zoneId = Array.isArray(zoneIds) && typeof zoneIds[i] === 'string' ? (zoneIds[i] as string) : null;
    return [{ cityId, zoneId }];
  });
}

/** Reads GEO_ZONE_CITY_INVALID details.cityIds. */
export function invalidCityIdsOf(details: Record<string, unknown> | undefined): string[] {
  const raw = details?.['cityIds'];
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
}
