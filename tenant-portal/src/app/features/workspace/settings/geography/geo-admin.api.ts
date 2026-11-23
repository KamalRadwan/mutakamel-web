import { Service, inject, signal } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp, type CoreWriteMethod } from '../../../../core/api/core-http';
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
  isRejectedGeoCursor,
} from './geo-admin.model';

export * from './geo-admin.model';
const BASE = '/api/tenant/core/v1/geo';
type CursorResult<T> = GeoCursorPage<T> & { cursorReset?: boolean };
type LookupRow = Omit<CityWithPath, 'stateName'> & { stateNameEn: string; stateNameAr: string };

@Service()
export class GeoAdminApi {
  private readonly http = inject(CoreHttp);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, networkMode: 'always', gcTime: 0 } },
  });
  readonly placesDenied = signal(false);
  readonly zonesDenied = signal(false);

  listCountries(): Promise<GeoItems<GeoCountry>> {
    return this.items('countries', '/countries');
  }
  listStates(countryId: string): Promise<GeoItems<GeoState>> {
    return this.items('states', `/countries/${encodeURIComponent(countryId)}/states`, countryId);
  }
  listCities(stateId: string, query: GeoListQuery = {}): Promise<CursorResult<GeoCity>> {
    return this.page('cities', `/states/${encodeURIComponent(stateId)}/cities`, stateId, query);
  }
  listDistricts(cityId: string, query: GeoDistrictQuery = {}): Promise<CursorResult<GeoDistrict>> {
    return this.page('districts', `/cities/${encodeURIComponent(cityId)}/districts`, cityId, query);
  }
  listZones(query: GeoListQuery = {}): Promise<CursorResult<GeoZone>> {
    return this.page('zones', '/zones', '', query);
  }

  async listAllZones(): Promise<{ items: GeoZone[]; truncated: boolean }> {
    const items: GeoZone[] = [];
    let cursor: string | null = null;
    for (let count = 0; count < 5; count++) {
      const page = await this.listZones({ cursor, limit: GEO_LIMITS.pageMax });
      if (page.cursorReset) return { items: page.items, truncated: true };
      items.push(...page.items);
      cursor = page.nextCursor;
      if (!cursor) return { items, truncated: false };
    }
    return { items, truncated: true };
  }

  getZone(id: string): Promise<GeoZoneDetail> {
    return this.queries.fetchQuery({
      queryKey: ['ws-geo', 'zones', id],
      queryFn: () => this.http.read<GeoZoneDetail>(`${BASE}/zones/${encodeURIComponent(id)}`),
    });
  }

  async getCitiesByIds(ids: string[]): Promise<CityWithPath[]> {
    const unique = [...new Set(ids)];
    if (!unique.length) return [];
    if (unique.length > GEO_LIMITS.zoneCities) throw new ApiError(400, 'CORE_VALIDATION_FAILED');
    return this.queries.fetchQuery({
      queryKey: ['ws-geo', 'city-lookup', [...unique].sort()],
      queryFn: async () => {
        // Read-like POST: CSRF is required; the gateway route accepts no idempotency key.
        const { data } = await this.http.write<GeoItems<LookupRow>>(
          'POST',
          `${BASE}/cities/lookup`,
          { ids: unique },
        );
        checkedItems(data);
        if (
          data.items.some(
            (row) =>
              typeof row.stateNameEn !== 'string' ||
              typeof row.stateNameAr !== 'string' ||
              typeof row.countryId !== 'string' ||
              typeof row.countryIso2 !== 'string',
          )
        )
          throw malformed();
        return data.items.map(({ stateNameEn, stateNameAr, ...city }) => ({
          ...city,
          stateName: { en: stateNameEn, ar: stateNameAr },
        }));
      },
    });
  }

  createCity(body: CreateGeoCityBody, key: string): Promise<GeoCity> {
    return this.write('POST', 'cities', '', body, key);
  }
  updateCity(id: string, body: UpdateGeoCityBody, key: string): Promise<GeoCity> {
    return this.write('PATCH', 'cities', id, body, key);
  }
  deleteCity(id: string, key: string): Promise<void> {
    return this.write('DELETE', 'cities', id, undefined, key);
  }

  createDistrict(body: CreateGeoDistrictBody, key: string): Promise<GeoDistrict> {
    return this.write('POST', 'districts', '', body, key);
  }
  updateDistrict(id: string, body: UpdateGeoDistrictBody, key: string): Promise<GeoDistrict> {
    return this.write('PATCH', 'districts', id, body, key);
  }
  deleteDistrict(id: string, key: string): Promise<void> {
    return this.write('DELETE', 'districts', id, undefined, key);
  }

  createZone(body: CreateGeoZoneBody, key: string): Promise<GeoZoneDetail> {
    return this.write('POST', 'zones', '', body, key);
  }
  updateZone(id: string, body: UpdateGeoZoneBody, key: string): Promise<GeoZoneDetail> {
    return this.write('PATCH', 'zones', id, body, key);
  }
  deleteZone(id: string, key: string): Promise<void> {
    return this.write('DELETE', 'zones', id, undefined, key);
  }

  private items<T>(resource: string, path: string, parent = ''): Promise<GeoItems<T>> {
    return this.queries.fetchQuery({
      queryKey: ['ws-geo', resource, parent],
      queryFn: async () => {
        const data = await this.http.read<GeoItems<T>>(BASE + path);
        checkedItems(data);
        return data;
      },
    });
  }

  private async page<T>(
    resource: string,
    path: string,
    parent: string,
    query: GeoDistrictQuery,
  ): Promise<CursorResult<T>> {
    try {
      return await this.queries.fetchQuery({
        queryKey: ['ws-geo', resource, parent, query],
        queryFn: async () => {
          const data = await this.http.read<GeoCursorPage<T>>(BASE + path, { ...query });
          checkedItems(data);
          if (!(data.nextCursor === null || typeof data.nextCursor === 'string')) throw malformed();
          return data;
        },
      });
    } catch (error) {
      if (!isRejectedGeoCursor(error, query.cursor)) throw error;
      return {
        ...(await this.page<T>(resource, path, parent, { ...query, cursor: null })),
        cursorReset: true,
      };
    }
  }

  private async write<T>(
    method: CoreWriteMethod,
    resource: 'cities' | 'districts' | 'zones',
    id: string,
    body: unknown,
    key: string,
  ): Promise<T> {
    try {
      const result = await this.http.write<T>(
        method,
        `${BASE}/${resource}${id ? '/' + encodeURIComponent(id) : ''}`,
        body,
        { key },
      );
      // City names and zone membership also appear in zone details and selected-city metadata.
      const resources =
        resource === 'districts' ? ['districts'] : ['cities', 'zones', 'city-lookup'];
      for (const affected of resources) {
        const filters = { queryKey: ['ws-geo', affected] };
        await this.queries.cancelQueries(filters);
        await this.queries.invalidateQueries(filters);
      }
      return result.data;
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 403 &&
        error.code === 'TENANT_WIDE_PERMISSION_REQUIRED'
      ) {
        (resource === 'zones' ? this.zonesDenied : this.placesDenied).set(true);
      }
      throw error;
    }
  }
}

function malformed(): ApiError {
  return new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
}
function checkedItems(data: unknown): void {
  if (
    !data ||
    typeof data !== 'object' ||
    !('items' in data) ||
    !Array.isArray(data.items) ||
    data.items.some(
      (row: unknown) =>
        !row ||
        typeof row !== 'object' ||
        !('id' in row) ||
        typeof row.id !== 'string' ||
        !('nameEn' in row) ||
        typeof row.nameEn !== 'string' ||
        !('nameAr' in row) ||
        typeof row.nameAr !== 'string',
    )
  )
    throw malformed();
}
