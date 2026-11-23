/* Geography pickers use Core's authenticated transport and success envelope. */
import { inject } from '@angular/core';
import { runInCrm } from '../../features/crm/shared/crm-runtime';
import { ApiError } from '../api/api-errors';
import { CoreHttp } from '../api/core-http';
import type {
  CreateCityInput, CreateDistrictInput, GeoCity, GeoCityLookup, GeoCountry,
  GeoCursorPage, GeoDistrict, GeoDistrictQuery, GeoListQuery, GeoState,
} from './geo.model';

const BASE = '/api/tenant/core/v1/geo';
const PICKER_LIMIT = 200;
const MAX_PICKER_PAGES = 10;

// The existing application initializer binds this root injector for function callers.
function geoHttp(): CoreHttp {
  return runInCrm(() => inject(CoreHttp));
}

/** GET countries: only active countries, without paging. */
export async function listCountries(): Promise<GeoCountry[]> {
  return checkedItems(await geoHttp().read<unknown>(`${BASE}/countries`), isCountry);
}

/** Country hydration uses the real catalogue; there is no country detail route. */
export async function getCountry(id: string): Promise<GeoCountry | null> {
  return (await listCountries()).find((country) => country.id === id) ?? null;
}

export async function listStates(countryId: string): Promise<GeoState[]> {
  return checkedItems(
    await geoHttp().read<unknown>(`${BASE}/countries/${encodeURIComponent(countryId)}/states`),
    isState,
  );
}

/** Arbitrary-state hydration has no backend contract. Do not scan every country. */
export async function getState(_id: string): Promise<GeoState | null> {
  throw new ApiError(503, 'GEO_STATE_LOOKUP_UNAVAILABLE');
}

/** Query callers retain the opaque cursor; legacy array callers receive a bounded complete list. */
export function listCities(stateId: string, query: GeoListQuery): Promise<GeoCursorPage<GeoCity>>;
export function listCities(stateId: string, search?: string): Promise<GeoCity[]>;
export async function listCities(
  stateId: string, searchOrQuery?: string | GeoListQuery,
): Promise<GeoCity[] | GeoCursorPage<GeoCity>> {
  const path = `${BASE}/states/${encodeURIComponent(stateId)}/cities`;
  if (typeof searchOrQuery === 'object') {
    const page = await readPage(path, searchOrQuery, isCity);
    return { ...page, items: page.items.filter((city) => city.isActive) };
  }
  return (await readAll(path, { search: searchOrQuery }, isCity)).filter((city) => city.isActive);
}

/**
 * POST cities/lookup is read-like (CSRF, no idempotency key). Its picker projection lacks
 * zoneId/timestamps. Resolve the full existing GeoCity contract from the state's real list,
 * using the returned name to narrow the search, rather than inventing those fields.
 */
export async function getCity(id: string): Promise<GeoCity | null> {
  const { data } = await geoHttp().write<unknown>('POST', `${BASE}/cities/lookup`, { ids: [id] });
  const rows = checkedItems(data, isCityLookup);
  if (rows.length > 1 || rows.some((city) => city.id !== id)) throw malformed();
  const lookup = rows[0];
  if (lookup === undefined) return null;
  const cities = await readAll(
    `${BASE}/states/${encodeURIComponent(lookup.stateId)}/cities`,
    { search: lookup.nameEn }, isCity,
  );
  // Inactive cities can still hydrate an existing selection.
  return cities.find((city) => city.id === id) ?? null;
}

/** The caller owns the intent key and must reuse it after an ambiguous failure. No write retries. */
export async function createCity(input: CreateCityInput, idempotencyKey?: string): Promise<GeoCity> {
  const key = requiredKey(idempotencyKey);
  const { data } = await geoHttp().write<unknown>('POST', `${BASE}/cities`, input, { key });
  if (!isCity(data)) throw malformed();
  return data;
}

export function listDistricts(cityId: string, query: GeoDistrictQuery): Promise<GeoCursorPage<GeoDistrict>>;
export function listDistricts(cityId: string, search?: string): Promise<GeoDistrict[]>;
export async function listDistricts(
  cityId: string, searchOrQuery?: string | GeoDistrictQuery,
): Promise<GeoDistrict[] | GeoCursorPage<GeoDistrict>> {
  const path = `${BASE}/cities/${encodeURIComponent(cityId)}/districts`;
  if (typeof searchOrQuery === 'object') {
    const page = await readPage(path, searchOrQuery, isDistrict);
    return { ...page, items: page.items.filter((district) => district.isActive) };
  }
  return (await readAll(path, { search: searchOrQuery }, isDistrict)).filter((district) => district.isActive);
}

/** Arbitrary-district hydration has no backend contract. */
export async function getDistrict(_id: string): Promise<GeoDistrict | null> {
  throw new ApiError(503, 'GEO_DISTRICT_LOOKUP_UNAVAILABLE');
}

export async function createDistrict(
  input: CreateDistrictInput, idempotencyKey?: string,
): Promise<GeoDistrict> {
  const key = requiredKey(idempotencyKey);
  const { data } = await geoHttp().write<unknown>(
    'POST', `${BASE}/districts`, { ...input, kind: input.kind ?? 'DISTRICT' }, { key },
  );
  if (!isDistrict(data)) throw malformed();
  return data;
}

function requiredKey(key: string | undefined): string {
  if (key === undefined) throw new ApiError(400, 'GW.IDEM.MISSING');
  if (key.trim().length === 0) throw new ApiError(400, 'GW.IDEM.BAD_VALUE');
  return key;
}

async function readPage<T>(
  path: string, query: GeoDistrictQuery, isRow: (row: unknown) => row is T,
): Promise<GeoCursorPage<T>> {
  const data = await geoHttp().read<unknown>(path, { ...query, limit: query.limit ?? PICKER_LIMIT });
  const items = checkedItems(data, isRow);
  if (!isRecord(data) || !(data['nextCursor'] === null ||
      (typeof data['nextCursor'] === 'string' && data['nextCursor'].length > 0))) throw malformed();
  return { items, nextCursor: data['nextCursor'] };
}

async function readAll<T>(
  path: string, query: GeoListQuery, isRow: (row: unknown) => row is T,
): Promise<T[]> {
  const items: T[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (let count = 0; count < MAX_PICKER_PAGES; count++) {
    const page: GeoCursorPage<T> = await readPage(path, { ...query, cursor, limit: PICKER_LIMIT }, isRow);
    items.push(...page.items);
    cursor = page.nextCursor;
    if (cursor === null) return items;
    if (seen.has(cursor)) throw malformed();
    seen.add(cursor);
  }
  // Never present a truncated array as a complete list. Query callers can page explicitly.
  throw new ApiError(503, 'GEO_PICKER_LIMIT_REACHED');
}

function malformed(): ApiError {
  return new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
}

function checkedItems<T>(data: unknown, isRow: (row: unknown) => row is T): T[] {
  if (!isRecord(data) || !Array.isArray(data['items']) || !data['items'].every(isRow)) throw malformed();
  const items: T[] = data['items'];
  const ids = data['items'].map((row: unknown) => isRecord(row) ? row['id'] : undefined);
  if (new Set(ids).size !== ids.length) throw malformed();
  return items;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function strings(row: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => typeof row[key] === 'string');
}

function isNamed(row: unknown): row is Record<string, unknown> {
  return isRecord(row) && strings(row, ['id', 'nameEn', 'nameAr']) &&
    typeof row['id'] === 'string' && row['id'].length > 0;
}

function isCountry(row: unknown): row is GeoCountry {
  return isNamed(row) && strings(row, ['iso2', 'iso3', 'dialCode', 'flagCode']) &&
    typeof row['sortOrder'] === 'number' && Number.isFinite(row['sortOrder']);
}

function isState(row: unknown): row is GeoState {
  return isNamed(row) && strings(row, ['countryId', 'code']) &&
    typeof row['sortOrder'] === 'number' && Number.isFinite(row['sortOrder']);
}

function isCityLookup(row: unknown): row is GeoCityLookup {
  return isNamed(row) && typeof row['isActive'] === 'boolean' &&
    strings(row, ['stateId', 'stateNameEn', 'stateNameAr', 'countryId', 'countryIso2']);
}

function isCity(row: unknown): row is GeoCity {
  return isNamed(row) && typeof row['isActive'] === 'boolean' &&
    strings(row, ['stateId', 'createdAt', 'updatedAt']) &&
    (row['zoneId'] === null || typeof row['zoneId'] === 'string');
}

function isDistrict(row: unknown): row is GeoDistrict {
  return isNamed(row) && typeof row['isActive'] === 'boolean' &&
    strings(row, ['cityId', 'createdAt', 'updatedAt']) &&
    (row['kind'] === 'VILLAGE' || row['kind'] === 'DISTRICT');
}
