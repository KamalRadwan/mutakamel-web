/*
 * Shapes follow core-app tenant/geo (geo.service.ts, geo.examples.ts). Core wraps every 2xx body in
 * { success, data, correlationId, timestamp }; these types describe `data`.
 */

/** GET countries item. Only active countries are listed, so there is no isActive field. */
export interface GeoCountry {
  id: string;
  iso2: string;
  iso3: string;
  nameEn: string;
  nameAr: string;
  dialCode: string;
  flagCode: string;
  sortOrder: number;
}

/** GET countries/:countryId/states item. Only active states are listed, so there is no isActive field. */
export interface GeoState {
  id: string;
  countryId: string;
  code: string;
  nameEn: string;
  nameAr: string;
  sortOrder: number;
}

export interface GeoCity {
  id: string;
  stateId: string;
  nameEn: string;
  nameAr: string;
  isActive: boolean;
  zoneId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type GeoDistrictKind = 'VILLAGE' | 'DISTRICT';

/** POST cities/lookup: picker metadata only; no zone membership or timestamps. */
export interface GeoCityLookup extends Pick<GeoCity, 'id' | 'stateId' | 'nameEn' | 'nameAr' | 'isActive'> {
  stateNameEn: string;
  stateNameAr: string;
  countryId: string;
  countryIso2: string;
}

export interface GeoDistrict {
  id: string;
  cityId: string;
  kind: GeoDistrictKind;
  nameEn: string;
  nameAr: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** GET zones item (list). */
export interface GeoZone {
  id: string;
  nameEn: string;
  nameAr: string;
  description: string | null;
  isActive: boolean;
  cityCount: number;
  createdAt: string;
  updatedAt: string;
}

/** City reference inside a zone detail. */
export interface GeoZoneCity {
  id: string;
  stateId: string;
  nameEn: string;
  nameAr: string;
}

/** GET zones/:id, and the POST / PATCH zones response. */
export interface GeoZoneDetail extends GeoZone {
  cities: GeoZoneCity[];
}

/** Countries and states: a plain list without paging. */
export interface GeoItems<T> {
  items: T[];
}

/** Cities, districts and zones: keyset pages ordered by lower(nameEn), id. */
export interface GeoCursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/* ---------- Requests (geo.dto.ts) ---------- */

/** GeoListQueryDto. */
export interface GeoListQuery {
  search?: string;
  cursor?: string | null;
  limit?: number;
}

/** GeoDistrictQueryDto. */
export interface GeoDistrictQuery extends GeoListQuery {
  kind?: GeoDistrictKind;
}

/** CreateGeoCityDto. */
export interface CreateGeoCityBody {
  stateId: string;
  nameEn: string;
  nameAr: string;
  isActive?: boolean;
}

/** UpdateGeoCityDto (stateId is immutable). */
export interface UpdateGeoCityBody {
  nameEn?: string;
  nameAr?: string;
  isActive?: boolean;
}

/** CreateGeoDistrictDto. */
export interface CreateGeoDistrictBody {
  cityId: string;
  kind: GeoDistrictKind;
  nameEn: string;
  nameAr: string;
  isActive?: boolean;
}

/** UpdateGeoDistrictDto (cityId is immutable). */
export interface UpdateGeoDistrictBody extends UpdateGeoCityBody {
  kind?: GeoDistrictKind;
}

/** CreateGeoZoneDto. */
export interface CreateGeoZoneBody {
  nameEn: string;
  nameAr: string;
  isActive?: boolean;
  description?: string | null;
  cityIds: string[];
}

/** UpdateGeoZoneDto: cityIds replaces the whole membership; description null clears it. */
export interface UpdateGeoZoneBody extends UpdateGeoCityBody {
  description?: string | null;
  cityIds?: string[];
}

export interface CreateCityInput {
  stateId: string;
  nameEn: string;
  nameAr: string;
}

export interface CreateDistrictInput {
  cityId: string;
  nameEn: string;
  nameAr: string;
  kind?: GeoDistrictKind;
}

export function geoNameIn(item: { nameEn: string; nameAr: string }, language: string): string {
  return language === 'ar' ? item.nameAr : item.nameEn;
}

export function geoFlagUrl(iso2: string): string {
  return `assets/flags/${iso2.toLowerCase()}.svg`;
}

export function normalizeGeoSearch(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

export function matchesGeoSearch(item: { nameEn: string; nameAr: string }, search?: string): boolean {
  const term = normalizeGeoSearch(search ?? '');
  if (!term) return true;
  return normalizeGeoSearch(item.nameEn).includes(term) || normalizeGeoSearch(item.nameAr).includes(term);
}
