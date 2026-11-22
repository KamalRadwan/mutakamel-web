/*
 * In-memory stand-in for core-app tenant/geo (geo.controller.ts, geo.service.ts, geo.dto.ts).
 * Every handler returns the `data` part of Core's success envelope, and throws the same
 * error codes, statuses and details as GeoService.
 */
import { ApiError } from '../api/api-errors';
import { fakeDelay, fakeId } from '../fake/fake-utils';
import {
  CreateGeoCityBody,
  CreateGeoDistrictBody,
  CreateGeoZoneBody,
  GeoCity,
  GeoCountry,
  GeoCursorPage,
  GeoDistrict,
  GeoDistrictKind,
  GeoItems,
  GeoState,
  GeoZone,
  GeoDistrictQuery,
  GeoListQuery,
  GeoZoneDetail,
  UpdateGeoCityBody,
  UpdateGeoDistrictBody,
  UpdateGeoZoneBody,
} from './geo.model';

const SEED_TIMESTAMP = '2026-01-15T09:00:00.000Z';

/** geo.dto.ts limits. */
const NAME_MAX = 120;
const DESCRIPTION_MAX = 1000;
const ZONE_CITIES_MAX = 500;
const SEARCH_MAX = 120;
const PAGE_DEFAULT = 50;
const PAGE_MAX = 200;

/** Fake-only switch: when false, writes fail like a user without geo.places.manage / geo.zones.manage. */
export let GEO_FAKE_CAN_CREATE = true;

/* Stored rows carry the database columns the API does not send (is_active on countries and
   states, address usage, zone membership). Other features' fakes read GEO_FAKE_DB directly. */
export type GeoCountryRow = GeoCountry & { isActive: boolean };
export type GeoStateRow = GeoState & { isActive: boolean };
export type GeoCityRow = Omit<GeoCity, 'zoneId'> & { addressCount: number };
export type GeoDistrictRow = GeoDistrict & { addressCount: number };
export type GeoZoneRow = Omit<GeoZone, 'cityCount'> & { cityIds: string[] };

function country(id: string, iso2: string, iso3: string, nameEn: string, nameAr: string, dialCode: string, sortOrder: number): GeoCountryRow {
  return { id, iso2, iso3, nameEn, nameAr, dialCode, flagCode: iso2.toLowerCase(), sortOrder, isActive: true };
}

function state(id: string, countryId: string, code: string, nameEn: string, nameAr: string): GeoStateRow {
  return { id, countryId, code, nameEn, nameAr, sortOrder: 0, isActive: true };
}

function city(id: string, stateId: string, nameEn: string, nameAr: string, addressCount = 0): GeoCityRow {
  return { id, stateId, nameEn, nameAr, isActive: true, addressCount, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP };
}

function district(id: string, cityId: string, kind: GeoDistrictKind, nameEn: string, nameAr: string, addressCount = 0): GeoDistrictRow {
  return { id, cityId, kind, nameEn, nameAr, isActive: true, addressCount, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP };
}

export const GEO_FAKE_DB: {
  countries: GeoCountryRow[];
  states: GeoStateRow[];
  cities: GeoCityRow[];
  districts: GeoDistrictRow[];
  zones: GeoZoneRow[];
} = {
  countries: [
    country('geo-eg', 'EG', 'EGY', 'Egypt', 'مصر', '+20', 0),
    country('geo-sa', 'SA', 'SAU', 'Saudi Arabia', 'المملكة العربية السعودية', '+966', 1),
    country('geo-ae', 'AE', 'ARE', 'United Arab Emirates', 'الإمارات العربية المتحدة', '+971', 2),
    country('geo-kw', 'KW', 'KWT', 'Kuwait', 'الكويت', '+965', 3),
    country('geo-qa', 'QA', 'QAT', 'Qatar', 'قطر', '+974', 4),
    country('geo-bh', 'BH', 'BHR', 'Bahrain', 'البحرين', '+973', 5),
    country('geo-om', 'OM', 'OMN', 'Oman', 'عُمان', '+968', 6),
    country('geo-jo', 'JO', 'JOR', 'Jordan', 'الأردن', '+962', 7),
    country('geo-gb', 'GB', 'GBR', 'United Kingdom', 'المملكة المتحدة', '+44', 8),
    country('geo-us', 'US', 'USA', 'United States', 'الولايات المتحدة', '+1', 9),
  ],
  states: [
    state('geo-eg-c', 'geo-eg', 'C', 'Cairo', 'القاهرة'),
    state('geo-eg-gz', 'geo-eg', 'GZ', 'Giza', 'الجيزة'),
    state('geo-eg-alx', 'geo-eg', 'ALX', 'Alexandria', 'الإسكندرية'),
    state('geo-eg-qal', 'geo-eg', 'QAL', 'Qalyubia', 'القليوبية'),
    state('geo-eg-shr', 'geo-eg', 'SHR', 'Sharqia', 'الشرقية'),
    state('geo-sa-ri', 'geo-sa', 'RI', 'Riyadh', 'منطقة الرياض'),
    state('geo-sa-mk', 'geo-sa', 'MK', 'Makkah', 'منطقة مكة المكرمة'),
    state('geo-sa-ep', 'geo-sa', 'EP', 'Eastern Province', 'المنطقة الشرقية'),
    state('geo-ae-du', 'geo-ae', 'DU', 'Dubai', 'دبي'),
    state('geo-ae-az', 'geo-ae', 'AZ', 'Abu Dhabi', 'أبوظبي'),
    state('geo-ae-sh', 'geo-ae', 'SH', 'Sharjah', 'الشارقة'),
    state('geo-kw-ku', 'geo-kw', 'KU', 'Kuwait City', 'مدينة الكويت'),
    state('geo-qa-da', 'geo-qa', 'DA', 'Doha', 'الدوحة'),
    state('geo-bh-ma', 'geo-bh', 'MA', 'Manama', 'المنامة'),
    state('geo-om-mu', 'geo-om', 'MU', 'Muscat', 'مسقط'),
    state('geo-jo-am', 'geo-jo', 'AM', 'Amman', 'عمّان'),
    state('geo-gb-ln', 'geo-gb', 'LN', 'London', 'لندن'),
    state('geo-us-dc', 'geo-us', 'DC', 'Washington, D.C.', 'واشنطن'),
  ],
  cities: [
    city('geo-city-maadi', 'geo-eg-c', 'Maadi', 'المعادي', 6),
    city('geo-city-nasr', 'geo-eg-c', 'Nasr City', 'مدينة نصر', 4),
    city('geo-city-heliopolis', 'geo-eg-c', 'Heliopolis', 'مصر الجديدة'),
    city('geo-city-dokki', 'geo-eg-gz', 'Dokki', 'الدقي'),
    city('geo-city-6oct', 'geo-eg-gz', '6th of October', 'السادس من أكتوبر'),
    city('geo-city-smouha', 'geo-eg-alx', 'Smouha', 'سموحة'),
    city('geo-city-olaya', 'geo-sa-ri', 'Al Olaya', 'العليا', 2),
    city('geo-city-malqa', 'geo-sa-ri', 'Al Malqa', 'الملقا'),
    city('geo-city-jeddah', 'geo-sa-mk', 'Jeddah', 'جدة'),
    city('geo-city-bb', 'geo-ae-du', 'Business Bay', 'الخليج التجاري'),
  ],
  districts: [
    district('geo-dist-degla', 'geo-city-maadi', 'DISTRICT', 'Degla', 'دجلة', 3),
    district('geo-dist-sarayat', 'geo-city-maadi', 'DISTRICT', 'Sarayat', 'السرايات'),
    district('geo-dist-zone7', 'geo-city-nasr', 'DISTRICT', '7th District', 'الحي السابع'),
    district('geo-dist-korba', 'geo-city-heliopolis', 'DISTRICT', 'Korba', 'الكوربة'),
    district('geo-dist-abuRawash', 'geo-city-6oct', 'VILLAGE', 'Abu Rawash', 'أبو رواش'),
  ],
  zones: [
    {
      id: 'geo-zone-a',
      nameEn: 'Zone A',
      nameAr: 'المنطقة أ',
      description: 'Central Cairo',
      isActive: true,
      cityIds: ['geo-city-maadi', 'geo-city-nasr', 'geo-city-heliopolis'],
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
  ],
};

/* ---------- Helpers ---------- */

type FieldErrors = Record<string, string[]>;

/** CORE_VALIDATION_FAILED as AllExceptionsFilter sends it: details maps each field to its messages. */
function validationFailed(errors: FieldErrors): never {
  throw new ApiError(400, 'CORE_VALIDATION_FAILED', errors);
}

function checkName(errors: FieldErrors, field: string, raw: unknown, required: boolean): string | undefined {
  if (raw === undefined && !required) return undefined;
  if (typeof raw !== 'string') {
    errors[field] = [`${field} must be a string`];
    return undefined;
  }
  const value = raw.trim();
  if (!value) errors[field] = [`${field} should not be empty`];
  else if (value.length > NAME_MAX) errors[field] = [`${field} must be shorter than or equal to ${NAME_MAX} characters`];
  return value;
}

function checkDescription(errors: FieldErrors, raw: string | null | undefined): string | null | undefined {
  if (raw === undefined || raw === null) return raw;
  const value = raw.trim();
  if (value.length > DESCRIPTION_MAX) {
    errors['description'] = [`description must be shorter than or equal to ${DESCRIPTION_MAX} characters`];
  }
  return value;
}

function checkKind(errors: FieldErrors, raw: unknown, required: boolean): void {
  if (raw === undefined && !required) return;
  if (raw !== 'VILLAGE' && raw !== 'DISTRICT') errors['kind'] = ['kind must be one of the following values: VILLAGE, DISTRICT'];
}

function checkBoolean(errors: FieldErrors, raw: unknown): void {
  if (raw !== undefined && typeof raw !== 'boolean') errors['isActive'] = ['isActive must be a boolean value'];
}

function checkCityIds(errors: FieldErrors, raw: unknown, required: boolean): string[] | undefined {
  if (raw === undefined && !required) return undefined;
  if (!Array.isArray(raw)) {
    errors['cityIds'] = ['cityIds must be an array'];
    return undefined;
  }
  const messages: string[] = [];
  if (raw.length > ZONE_CITIES_MAX) messages.push(`cityIds must contain no more than ${ZONE_CITIES_MAX} elements`);
  const lower = raw.map((id) => String(id).toLowerCase());
  if (new Set(lower).size !== lower.length) messages.push("All cityIds's elements must be unique");
  if (messages.length) errors['cityIds'] = messages;
  return lower;
}

function throwIfInvalid(errors: FieldErrors): void {
  if (Object.keys(errors).length) validationFailed(errors);
}

function checkListQuery(query: GeoDistrictQuery): { search: string; limit: number } {
  const errors: FieldErrors = {};
  const search = (query.search ?? '').trim();
  if (search.length > SEARCH_MAX) errors['search'] = [`search must be shorter than or equal to ${SEARCH_MAX} characters`];
  const limit = query.limit ?? PAGE_DEFAULT;
  if (!Number.isInteger(limit) || limit < 1 || limit > PAGE_MAX) errors['limit'] = [`limit must not be greater than ${PAGE_MAX}`];
  if (query.cursor === '') errors['cursor'] = ['cursor should not be empty'];
  if (query.kind !== undefined) checkKind(errors, query.kind, false);
  throwIfInvalid(errors);
  return { search, limit };
}

function writeAllowed(): void {
  if (!GEO_FAKE_CAN_CREATE) throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
}

/** strpos(lower(name), lower(search)) > 0 on either name: a literal, case-insensitive substring. */
function containsSearch(item: { nameEn: string; nameAr: string }, search: string): boolean {
  if (!search) return true;
  const term = search.toLowerCase();
  return item.nameEn.toLowerCase().includes(term) || item.nameAr.toLowerCase().includes(term);
}

/** ORDER BY lower(name_en), id. */
function compareKey(a: { name: string; id: string }, b: { name: string; id: string }): number {
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function keyOf(item: { id: string; nameEn: string }): { name: string; id: string } {
  return { name: item.nameEn.toLowerCase(), id: item.id };
}

function encodeCursor(key: { name: string; id: string }, scope: string): string {
  return btoa(encodeURIComponent(JSON.stringify({ ...key, scope })));
}

function decodeCursor(cursor: string, scope: string): { name: string; id: string } {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(cursor))) as Record<string, unknown>;
    if (typeof parsed['name'] === 'string' && typeof parsed['id'] === 'string' && parsed['scope'] === scope) {
      return { name: parsed['name'], id: parsed['id'] };
    }
  } catch {
    // Falls through to the same error the service throws for a bad cursor.
  }
  throw new ApiError(400, 'CORE_VALIDATION_FAILED');
}

function page<T extends { id: string; nameEn: string; nameAr: string }>(
  rows: readonly T[],
  query: GeoDistrictQuery,
  scopeParts: unknown[],
): GeoCursorPage<T> {
  const { search, limit } = checkListQuery(query);
  const scope = JSON.stringify([...scopeParts, search, query.kind ?? null]);
  const after = query.cursor ? decodeCursor(query.cursor, scope) : null;
  const sorted = rows
    .filter((row) => containsSearch(row, search))
    .sort((a, b) => compareKey(keyOf(a), keyOf(b)))
    .filter((row) => !after || compareKey(keyOf(row), after) > 0);
  const items = sorted.slice(0, limit);
  const last = items.at(-1);
  return { items, nextCursor: sorted.length > limit && last ? encodeCursor(keyOf(last), scope) : null };
}

function liveZoneOf(cityId: string): GeoZoneRow | undefined {
  return GEO_FAKE_DB.zones.find((zone) => zone.cityIds.includes(cityId));
}

function toCity(row: GeoCityRow): GeoCity {
  const { addressCount: _addressCount, ...rest } = row;
  return { ...rest, zoneId: liveZoneOf(row.id)?.id ?? null };
}

function toDistrict(row: GeoDistrictRow): GeoDistrict {
  const { addressCount: _addressCount, ...rest } = row;
  return { ...rest };
}

function toZone(row: GeoZoneRow): GeoZone {
  const { cityIds, ...rest } = row;
  return { ...rest, cityCount: cityIds.length };
}

function toZoneDetail(row: GeoZoneRow): GeoZoneDetail {
  const cities = GEO_FAKE_DB.cities
    .filter((item) => row.cityIds.includes(item.id))
    .sort((a, b) => compareKey(keyOf(a), keyOf(b)))
    .map(({ id, stateId, nameEn, nameAr }) => ({ id, stateId, nameEn, nameAr }));
  return { ...toZone(row), cities };
}

function sortCatalogue<T extends { sortOrder: number; nameEn: string }>(rows: T[]): T[] {
  return rows.slice().sort((a, b) => a.sortOrder - b.sortOrder || (a.nameEn < b.nameEn ? -1 : a.nameEn > b.nameEn ? 1 : 0));
}

function nameTaken(
  siblings: readonly { id: string; nameEn: string; nameAr: string }[],
  nameEn: string | undefined,
  nameAr: string | undefined,
  excludeId?: string,
): boolean {
  return siblings.some(
    (item) =>
      item.id !== excludeId &&
      ((nameEn !== undefined && item.nameEn.toLowerCase() === nameEn.toLowerCase()) ||
        (nameAr !== undefined && item.nameAr.toLowerCase() === nameAr.toLowerCase())),
  );
}

function now(): string {
  return new Date().toISOString();
}

function cityRow(id: string): GeoCityRow {
  const row = GEO_FAKE_DB.cities.find((item) => item.id === id);
  if (!row) throw new ApiError(404, 'GEO_CITY_NOT_FOUND');
  return row;
}

function districtRow(id: string): GeoDistrictRow {
  const row = GEO_FAKE_DB.districts.find((item) => item.id === id);
  if (!row) throw new ApiError(404, 'GEO_DISTRICT_NOT_FOUND');
  return row;
}

function zoneRow(id: string): GeoZoneRow {
  const row = GEO_FAKE_DB.zones.find((item) => item.id === id);
  if (!row) throw new ApiError(404, 'GEO_ZONE_NOT_FOUND');
  return row;
}

/** replaceCities: unknown ids first, then cities that live in another zone (cityIds[i] is in zoneIds[i]). */
function assertZoneCities(zoneId: string | null, cityIds: readonly string[]): void {
  const live = new Set(GEO_FAKE_DB.cities.map((item) => item.id.toLowerCase()));
  const missing = cityIds.filter((id) => !live.has(id));
  if (missing.length) throw new ApiError(422, 'GEO_ZONE_CITY_INVALID', { cityIds: missing });
  const conflicts = cityIds
    .map((cityId) => ({
      cityId,
      zone: GEO_FAKE_DB.zones.find((zone) => zone.id !== zoneId && zone.cityIds.some((id) => id.toLowerCase() === cityId)),
    }))
    .filter((item): item is { cityId: string; zone: GeoZoneRow } => item.zone !== undefined)
    .sort((a, b) => (a.cityId < b.cityId ? -1 : 1));
  if (conflicts.length) {
    throw new ApiError(409, 'GEO_ZONE_CITY_CONFLICT', {
      cityIds: conflicts.map((item) => item.cityId),
      zoneIds: conflicts.map((item) => item.zone.id),
    });
  }
}

function canonicalCityIds(cityIds: readonly string[]): string[] {
  return cityIds.flatMap((id) => GEO_FAKE_DB.cities.find((item) => item.id.toLowerCase() === id)?.id ?? []);
}

/* ---------- Reads ---------- */

/** GET countries: active countries by sortOrder, then nameEn. */
export async function fakeGeoCountries(): Promise<GeoItems<GeoCountry>> {
  await fakeDelay();
  const rows = sortCatalogue(GEO_FAKE_DB.countries.filter((row) => row.isActive));
  return { items: rows.map(({ isActive: _isActive, ...rest }) => ({ ...rest })) };
}

/** GET countries/:countryId/states. Missing or inactive country: GEO_COUNTRY_NOT_FOUND. */
export async function fakeGeoStates(countryId: string): Promise<GeoItems<GeoState>> {
  await fakeDelay();
  if (!GEO_FAKE_DB.countries.some((row) => row.id === countryId && row.isActive)) {
    throw new ApiError(404, 'GEO_COUNTRY_NOT_FOUND');
  }
  const rows = sortCatalogue(GEO_FAKE_DB.states.filter((row) => row.countryId === countryId && row.isActive));
  return { items: rows.map(({ isActive: _isActive, ...rest }) => ({ ...rest })) };
}

/** GET states/:stateId/cities, inactive cities included. Unknown state: GEO_STATE_NOT_FOUND. */
export async function fakeGeoCities(stateId: string, query: GeoListQuery = {}): Promise<GeoCursorPage<GeoCity>> {
  await fakeDelay();
  if (!GEO_FAKE_DB.states.some((row) => row.id === stateId)) throw new ApiError(404, 'GEO_STATE_NOT_FOUND');
  const result = page(GEO_FAKE_DB.cities.filter((row) => row.stateId === stateId), query, ['cities', stateId]);
  return { items: result.items.map(toCity), nextCursor: result.nextCursor };
}

/** GET cities/:cityId/districts, inactive ones included. Unknown city: GEO_CITY_NOT_FOUND. */
export async function fakeGeoDistricts(cityId: string, query: GeoDistrictQuery = {}): Promise<GeoCursorPage<GeoDistrict>> {
  await fakeDelay();
  cityRow(cityId);
  const rows = GEO_FAKE_DB.districts.filter((row) => row.cityId === cityId && (!query.kind || row.kind === query.kind));
  const result = page(rows, query, ['districts', cityId]);
  return { items: result.items.map(toDistrict), nextCursor: result.nextCursor };
}

/** GET zones with cityCount. */
export async function fakeGeoZones(query: GeoListQuery = {}): Promise<GeoCursorPage<GeoZone>> {
  await fakeDelay();
  const result = page(GEO_FAKE_DB.zones, query, ['zones', null]);
  return { items: result.items.map(toZone), nextCursor: result.nextCursor };
}

/** GET zones/:id with its city references. */
export async function fakeGeoZone(id: string): Promise<GeoZoneDetail> {
  await fakeDelay();
  return toZoneDetail(zoneRow(id));
}

/* ---------- Cities ---------- */

/** POST cities. Errors: GEO_STATE_NOT_FOUND, GEO_PARENT_INACTIVE, GEO_CITY_NAME_TAKEN. */
export async function fakeGeoCreateCity(body: CreateGeoCityBody): Promise<GeoCity> {
  await fakeDelay();
  writeAllowed();
  const errors: FieldErrors = {};
  const nameEn = checkName(errors, 'nameEn', body.nameEn, true) ?? '';
  const nameAr = checkName(errors, 'nameAr', body.nameAr, true) ?? '';
  checkBoolean(errors, body.isActive);
  throwIfInvalid(errors);

  const parent = GEO_FAKE_DB.states.find((row) => row.id === body.stateId);
  if (!parent) throw new ApiError(404, 'GEO_STATE_NOT_FOUND');
  const parentCountry = GEO_FAKE_DB.countries.find((row) => row.id === parent.countryId);
  if (!parent.isActive || !parentCountry?.isActive) throw new ApiError(422, 'GEO_PARENT_INACTIVE');
  if (nameTaken(GEO_FAKE_DB.cities.filter((row) => row.stateId === body.stateId), nameEn, nameAr)) {
    throw new ApiError(409, 'GEO_CITY_NAME_TAKEN');
  }

  const stamp = now();
  const row: GeoCityRow = {
    id: fakeId(),
    stateId: body.stateId,
    nameEn,
    nameAr,
    isActive: body.isActive ?? true,
    addressCount: 0,
    createdAt: stamp,
    updatedAt: stamp,
  };
  GEO_FAKE_DB.cities.push(row);
  return toCity(row);
}

/** PATCH cities/:id. Errors: GEO_CITY_NOT_FOUND, GEO_CITY_NAME_TAKEN. */
export async function fakeGeoUpdateCity(id: string, body: UpdateGeoCityBody): Promise<GeoCity> {
  await fakeDelay();
  writeAllowed();
  const errors: FieldErrors = {};
  const nameEn = checkName(errors, 'nameEn', body.nameEn, false);
  const nameAr = checkName(errors, 'nameAr', body.nameAr, false);
  checkBoolean(errors, body.isActive);
  throwIfInvalid(errors);

  const row = cityRow(id);
  if (nameTaken(GEO_FAKE_DB.cities.filter((item) => item.stateId === row.stateId), nameEn, nameAr, id)) {
    throw new ApiError(409, 'GEO_CITY_NAME_TAKEN');
  }
  if (nameEn !== undefined) row.nameEn = nameEn;
  if (nameAr !== undefined) row.nameAr = nameAr;
  if (body.isActive !== undefined) row.isActive = body.isActive;
  row.updatedAt = now();
  return toCity(row);
}

/** DELETE cities/:id (204). GEO_CITY_IN_USE details.usedBy lists addresses, districts and/or zones. */
export async function fakeGeoDeleteCity(id: string): Promise<void> {
  await fakeDelay();
  writeAllowed();
  const row = cityRow(id);
  const counts: Record<string, number> = {
    addresses: row.addressCount,
    districts: GEO_FAKE_DB.districts.filter((item) => item.cityId === id).length,
    zones: liveZoneOf(id) ? 1 : 0,
  };
  const usedBy = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([kind]) => kind);
  if (usedBy.length) throw new ApiError(409, 'GEO_CITY_IN_USE', { usedBy });
  GEO_FAKE_DB.cities.splice(GEO_FAKE_DB.cities.indexOf(row), 1);
}

/* ---------- Districts ---------- */

/** POST districts. Errors: GEO_CITY_NOT_FOUND, GEO_PARENT_INACTIVE, GEO_DISTRICT_NAME_TAKEN. */
export async function fakeGeoCreateDistrict(body: CreateGeoDistrictBody): Promise<GeoDistrict> {
  await fakeDelay();
  writeAllowed();
  const errors: FieldErrors = {};
  checkKind(errors, body.kind, true);
  const nameEn = checkName(errors, 'nameEn', body.nameEn, true) ?? '';
  const nameAr = checkName(errors, 'nameAr', body.nameAr, true) ?? '';
  checkBoolean(errors, body.isActive);
  throwIfInvalid(errors);

  const parent = cityRow(body.cityId);
  if (!parent.isActive) throw new ApiError(422, 'GEO_PARENT_INACTIVE');
  if (nameTaken(GEO_FAKE_DB.districts.filter((row) => row.cityId === body.cityId), nameEn, nameAr)) {
    throw new ApiError(409, 'GEO_DISTRICT_NAME_TAKEN');
  }

  const stamp = now();
  const row: GeoDistrictRow = {
    id: fakeId(),
    cityId: body.cityId,
    kind: body.kind,
    nameEn,
    nameAr,
    isActive: body.isActive ?? true,
    addressCount: 0,
    createdAt: stamp,
    updatedAt: stamp,
  };
  GEO_FAKE_DB.districts.push(row);
  return toDistrict(row);
}

/** PATCH districts/:id. Errors: GEO_DISTRICT_NOT_FOUND, GEO_DISTRICT_NAME_TAKEN. */
export async function fakeGeoUpdateDistrict(id: string, body: UpdateGeoDistrictBody): Promise<GeoDistrict> {
  await fakeDelay();
  writeAllowed();
  const errors: FieldErrors = {};
  checkKind(errors, body.kind, false);
  const nameEn = checkName(errors, 'nameEn', body.nameEn, false);
  const nameAr = checkName(errors, 'nameAr', body.nameAr, false);
  checkBoolean(errors, body.isActive);
  throwIfInvalid(errors);

  const row = districtRow(id);
  if (nameTaken(GEO_FAKE_DB.districts.filter((item) => item.cityId === row.cityId), nameEn, nameAr, id)) {
    throw new ApiError(409, 'GEO_DISTRICT_NAME_TAKEN');
  }
  if (body.kind !== undefined) row.kind = body.kind;
  if (nameEn !== undefined) row.nameEn = nameEn;
  if (nameAr !== undefined) row.nameAr = nameAr;
  if (body.isActive !== undefined) row.isActive = body.isActive;
  row.updatedAt = now();
  return toDistrict(row);
}

/** DELETE districts/:id (204). GEO_DISTRICT_IN_USE details.usedBy is ["addresses"]. */
export async function fakeGeoDeleteDistrict(id: string): Promise<void> {
  await fakeDelay();
  writeAllowed();
  const row = districtRow(id);
  if (row.addressCount > 0) throw new ApiError(409, 'GEO_DISTRICT_IN_USE', { usedBy: ['addresses'] });
  GEO_FAKE_DB.districts.splice(GEO_FAKE_DB.districts.indexOf(row), 1);
}

/* ---------- Zones ---------- */

/** POST zones. Errors: GEO_ZONE_NAME_TAKEN, GEO_ZONE_CITY_INVALID, GEO_ZONE_CITY_CONFLICT. */
export async function fakeGeoCreateZone(body: CreateGeoZoneBody): Promise<GeoZoneDetail> {
  await fakeDelay();
  writeAllowed();
  const errors: FieldErrors = {};
  const nameEn = checkName(errors, 'nameEn', body.nameEn, true) ?? '';
  const nameAr = checkName(errors, 'nameAr', body.nameAr, true) ?? '';
  checkBoolean(errors, body.isActive);
  const description = checkDescription(errors, body.description);
  const cityIds = checkCityIds(errors, body.cityIds, true) ?? [];
  throwIfInvalid(errors);

  if (nameTaken(GEO_FAKE_DB.zones, nameEn, nameAr)) throw new ApiError(409, 'GEO_ZONE_NAME_TAKEN');
  assertZoneCities(null, cityIds);

  const stamp = now();
  const row: GeoZoneRow = {
    id: fakeId(),
    nameEn,
    nameAr,
    description: description ?? null,
    isActive: body.isActive ?? true,
    cityIds: canonicalCityIds(cityIds),
    createdAt: stamp,
    updatedAt: stamp,
  };
  GEO_FAKE_DB.zones.push(row);
  return toZoneDetail(row);
}

/** PATCH zones/:id. Errors: GEO_ZONE_NOT_FOUND, GEO_ZONE_NAME_TAKEN, GEO_ZONE_CITY_INVALID, GEO_ZONE_CITY_CONFLICT. */
export async function fakeGeoUpdateZone(id: string, body: UpdateGeoZoneBody): Promise<GeoZoneDetail> {
  await fakeDelay();
  writeAllowed();
  const errors: FieldErrors = {};
  const nameEn = checkName(errors, 'nameEn', body.nameEn, false);
  const nameAr = checkName(errors, 'nameAr', body.nameAr, false);
  checkBoolean(errors, body.isActive);
  const description = checkDescription(errors, body.description);
  const cityIds = checkCityIds(errors, body.cityIds, false);
  throwIfInvalid(errors);

  const row = zoneRow(id);
  if (nameTaken(GEO_FAKE_DB.zones, nameEn, nameAr, id)) throw new ApiError(409, 'GEO_ZONE_NAME_TAKEN');
  if (cityIds !== undefined) assertZoneCities(id, cityIds);

  if (nameEn !== undefined) row.nameEn = nameEn;
  if (nameAr !== undefined) row.nameAr = nameAr;
  if (body.isActive !== undefined) row.isActive = body.isActive;
  if (description !== undefined) row.description = description;
  if (cityIds !== undefined) row.cityIds = canonicalCityIds(cityIds);
  row.updatedAt = now();
  return toZoneDetail(row);
}

/** DELETE zones/:id (204): the zone and its membership links go together. */
export async function fakeGeoDeleteZone(id: string): Promise<void> {
  await fakeDelay();
  writeAllowed();
  const row = zoneRow(id);
  GEO_FAKE_DB.zones.splice(GEO_FAKE_DB.zones.indexOf(row), 1);
}

/* ---------- No backend route: kept as fakes until Core adds them ---------- */

/** No backend route: GET countries/:id. */
export async function fakeGetCountry(id: string): Promise<GeoCountry | null> {
  const { items } = await fakeGeoCountries();
  return items.find((item) => item.id === id) ?? null;
}

/** No backend route: GET states/:id. */
export async function fakeGetState(id: string): Promise<GeoState | null> {
  await fakeDelay();
  const row = GEO_FAKE_DB.states.find((item) => item.id === id && item.isActive);
  if (!row) return null;
  const { isActive: _isActive, ...rest } = row;
  return { ...rest };
}

/** No backend route: GET cities/:id. */
export async function fakeGetCity(id: string): Promise<GeoCity | null> {
  await fakeDelay();
  const row = GEO_FAKE_DB.cities.find((item) => item.id === id);
  return row ? toCity(row) : null;
}

/** No backend route: GET districts/:id. */
export async function fakeGetDistrict(id: string): Promise<GeoDistrict | null> {
  await fakeDelay();
  const row = GEO_FAKE_DB.districts.find((item) => item.id === id);
  return row ? toDistrict(row) : null;
}

/** No backend route: GET cities?ids=. Returns the live cities among the ids, in request order. */
export async function fakeGetCitiesByIds(ids: readonly string[]): Promise<GeoCity[]> {
  await fakeDelay();
  return [...new Set(ids)].flatMap((id) => {
    const row = GEO_FAKE_DB.cities.find((item) => item.id === id);
    return row ? [toCity(row)] : [];
  });
}
