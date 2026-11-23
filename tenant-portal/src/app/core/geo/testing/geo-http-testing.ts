import type { CoreQuery } from '../../api/core-http';
import { GEO_FAKE_DB } from '../geo.fake';

/** Unit-test HTTP payloads; the picker still runs through the real geo API adapter. */
export class GeoHttpStub {
  async read(path: string, query?: CoreQuery): Promise<unknown> {
    if (path.endsWith('/countries')) return { items: GEO_FAKE_DB.countries.filter((row) => row.isActive) };
    const id = decodeURIComponent(path.split('/').at(-2) ?? '');
    if (path.endsWith('/states')) return { items: GEO_FAKE_DB.states.filter((row) => row.countryId === id && row.isActive) };
    const search = String(query?.['search'] ?? '').toLowerCase();
    const rows = path.endsWith('/cities')
      ? GEO_FAKE_DB.cities.filter((row) => row.stateId === id).map((row) => ({ ...row, zoneId: null }))
      : path.endsWith('/districts') ? GEO_FAKE_DB.districts.filter((row) => row.cityId === id) : [];
    return { items: rows.filter((row) => row.nameEn.toLowerCase().includes(search) || row.nameAr.includes(search))
      .sort((a, b) => a.nameEn.localeCompare(b.nameEn)), nextCursor: null };
  }

  async write(_method: string, path: string, body: { ids?: string[] }): Promise<unknown> {
    if (!path.endsWith('/cities/lookup')) throw new Error(`Unexpected geo test write: ${path}`);
    const items = GEO_FAKE_DB.cities.filter((row) => body.ids?.includes(row.id)).map((row) => {
      const state = GEO_FAKE_DB.states.find((item) => item.id === row.stateId);
      const country = GEO_FAKE_DB.countries.find((item) => item.id === state?.countryId);
      return { ...row, stateNameEn: state?.nameEn ?? '', stateNameAr: state?.nameAr ?? '',
        countryId: country?.id ?? '', countryIso2: country?.iso2 ?? '' };
    });
    return { data: { items } };
  }
}
