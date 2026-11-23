import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideTransloco, TRANSLOCO_LOADER, TranslocoService } from '@jsverse/transloco';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { AuthSession } from '../../../../../core/auth/auth-session';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { GeoAdminApi } from '../geo-admin.api';
import type { GeoCity, GeoCountry, GeoDistrict, GeoState, GeoZoneDetail } from '../geo-admin.model';
import { CitiesTab } from './cities-tab';

const id = '01970000-0000-7000-8000-000000000001';
const stateId = '01970000-0000-7000-8000-000000000002';
const countryId = '01970000-0000-7000-8000-000000000003';
const country: GeoCountry = {
  id: countryId,
  iso2: 'EG',
  iso3: 'EGY',
  nameEn: 'Egypt',
  nameAr: 'مصر',
  dialCode: '+20',
  flagCode: 'EG',
  sortOrder: 0,
};
const state: GeoState = {
  id: stateId,
  countryId,
  nameEn: 'State',
  nameAr: 'محافظة',
  code: 'ST',
  sortOrder: 0,
};
const city: GeoCity = {
  id,
  stateId,
  nameEn: 'City',
  nameAr: 'مدينة',
  isActive: true,
  zoneId: null,
  createdAt: '2026-11-20',
  updatedAt: '2026-11-20',
};
const district: GeoDistrict = {
  id: '01970000-0000-7000-8000-000000000004',
  cityId: id,
  kind: 'DISTRICT',
  nameEn: 'District',
  nameAr: 'حي',
  isActive: true,
  createdAt: '',
  updatedAt: '',
};
const zone: GeoZoneDetail = {
  id,
  nameEn: 'Zone',
  nameAr: 'منطقة',
  isActive: true,
  description: null,
  cityCount: 1,
  cities: [{ id, stateId, nameEn: city.nameEn, nameAr: city.nameAr }],
  createdAt: '',
  updatedAt: '',
};
const owner = {
  id: 'owner',
  isTenantOwner: true,
  permissions: [],
  permissionScopes: {},
} as unknown as TenantMe;

describe('CitiesTab', () => {
  const me = signal<TenantMe | null>(owner);
  const params = new BehaviorSubject(
    convertToParamMap({ country: countryId, state: stateId, city: id }),
  );
  const navigate = vi.fn().mockResolvedValue(true);
  const api = {
    listCountries: vi.fn(),
    listStates: vi.fn(),
    listCities: vi.fn(),
    listDistricts: vi.fn(),
    listZones: vi.fn(),
    listAllZones: vi.fn(),
    getCitiesByIds: vi.fn(),
    getZone: vi.fn(),
    createCity: vi.fn(),
    createDistrict: vi.fn(),
    createZone: vi.fn(),
    updateCity: vi.fn(),
    updateDistrict: vi.fn(),
    updateZone: vi.fn(),
    deleteCity: vi.fn(),
    deleteDistrict: vi.fn(),
    deleteZone: vi.fn(),
    placesDenied: signal(false),
    zonesDenied: signal(false),
  };
  const notify = {
    success: vi.fn(),
    error: vi.fn(),
    connectionLost: vi.fn(),
    connectionRestored: vi.fn(),
  };
  let fixture: ComponentFixture<CitiesTab>;
  let page: CitiesTab;
  beforeEach(() => {
    vi.clearAllMocks();
    me.set(owner);
    api.placesDenied.set(false);
    api.zonesDenied.set(false);
    params.next(convertToParamMap({ country: countryId, state: stateId, city: id }));
    api.listCountries.mockResolvedValue({ items: [country] });
    api.listStates.mockResolvedValue({ items: [state] });
    api.listCities.mockResolvedValue({ items: [city], nextCursor: null });
    api.listDistricts.mockResolvedValue({ items: [district], nextCursor: null });
    api.listZones.mockResolvedValue({ items: [zone], nextCursor: null });
    api.listAllZones.mockResolvedValue({ items: [zone], truncated: false });
    api.getCitiesByIds.mockResolvedValue([
      {
        id,
        stateId,
        countryId,
        nameEn: city.nameEn,
        nameAr: city.nameAr,
        isActive: true,
        stateName: { en: state.nameEn, ar: state.nameAr },
        countryIso2: 'EG',
      },
    ]);
    api.getZone.mockResolvedValue(zone);
    api.createCity.mockResolvedValue(city);
    api.createDistrict.mockResolvedValue(district);
    api.createZone.mockResolvedValue(zone);
    api.updateCity.mockResolvedValue({ ...city, isActive: false });
    api.updateDistrict.mockResolvedValue(district);
    api.updateZone.mockResolvedValue(zone);
    api.deleteCity.mockResolvedValue(undefined);
    api.deleteDistrict.mockResolvedValue(undefined);
    api.deleteZone.mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['en', 'ar'], defaultLang: 'en', prodMode: true },
        }),
        { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}) } },
        { provide: GeoAdminApi, useValue: api },
        { provide: AuthSession, useValue: { me } },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: params, snapshot: { queryParamMap: params.value } },
        },
        { provide: Router, useValue: { navigate } },
        { provide: LanguageState, useValue: { current: signal('en') } },
        { provide: Notify, useValue: notify },
      ],
    });
    vi.spyOn(TestBed.inject(TranslocoService), 'translate').mockImplementation((key, values) => {
      const text = String(key);
      if (text === 'settings.errors.rateLimitedIn')
        return `Retry in ${(values as Record<string, unknown>)['seconds']} s`;
      if (/^(geoPlaces|geoZones|wsGeo)\.errors\.(GEO_|TENANT_WIDE_)/.test(text))
        return text + ' message';
      if (text === 'settings.errors.idempotency' || text === 'settings.errors.idempotencyMismatch')
        return text + ' message';
      if (text === 'geoPlaces.districtsStayActive') return 'Its districts stay active.';
      return text;
    });
    fixture = TestBed.createComponent(CitiesTab);
    page = fixture.componentInstance;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  async function render() {
    for (let pass = 0; pass < 3; pass++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    fixture.detectChanges();
  }

  it('5xx and offline show load-failure', async () => {
    api.listCities.mockRejectedValue(new ApiError(503, 'COMMON.DATABASE.UNAVAILABLE'));
    await render();
    expect(page['loadFailed']()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('geoPlaces.retry');
    api.listCities.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR'));
    page['reload']();
    await render();
    expect(page['loadFailed']()).toBe(true);
    expect(notify.connectionLost).toHaveBeenCalledTimes(1);
    api.listCities.mockResolvedValue({ items: [city], nextCursor: null });
    page['reload']();
    await render();
    expect(notify.connectionRestored).toHaveBeenCalled();
  });
  it('no cities shows the empty state', async () => {
    api.listCities.mockResolvedValue({ items: [], nextCursor: null });
    await render();
    expect(fixture.nativeElement.textContent).toContain('geoPlaces.noResults');
  });
  it('filter change drops the cursor', async () => {
    await render();
    page['nextCursor'].set('old');
    page['debouncedSearch'].set('new');
    await render();
    expect(api.listCities.mock.lastCall?.[1]).toEqual({ search: 'new', cursor: null, limit: 50 });
    page['nextCursor'].set('old');
    params.next(convertToParamMap({ country: countryId, state: 'other-state' }));
    await render();
    expect(page['nextCursor']()).toBeNull();
  });
  it('scoped holder sees read-only cities', async () => {
    me.set({
      ...owner,
      isTenantOwner: false,
      permissions: ['geo.places.manage'],
      permissionScopes: {
        'geo.places.manage': { tenantWide: false, companyIds: ['company'], branchIds: [] },
      },
    });
    await render();
    expect(page['canManage']()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('wsGeo.needsTenantWide');
    expect(fixture.nativeElement.querySelector('ui-actions-menu')).toBeNull();
    const modal = page['placeModal']();
    expect(modal['isReadOnly']()).toBe(true);
    page['openCreate']();
    await page['toggleActive'](city);
    expect(api.updateCity).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('app-place-form-modal button[type="submit"]'),
    ).toBeNull();
  });
  it('deactivate city warns about districts', async () => {
    await render();
    const confirm = page['confirmDeactivate']();
    const open = vi.spyOn(confirm, 'open').mockResolvedValue(false);
    await page['toggleActive'](city);
    expect(open).toHaveBeenCalled();
    expect(confirm.text()).toBe('Its districts stay active.');
    expect(api.updateCity).not.toHaveBeenCalled();
  });
  it('toggle reuses its key', async () => {
    await render();
    vi.spyOn(page['confirmDeactivate'](), 'open').mockResolvedValue(true);
    api.updateCity.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
    await page['toggleActive'](city);
    await page['toggleActive'](city);
    expect(api.updateCity.mock.calls[1]).toEqual(api.updateCity.mock.calls[0]);
  });
  it('404 removes the row', async () => {
    await render();
    vi.spyOn(page['confirmDeactivate'](), 'open').mockResolvedValue(true);
    api.updateCity.mockRejectedValue(new ApiError(404, 'GEO_CITY_NOT_FOUND'));
    await page['toggleActive'](city);
    expect(page['cities']()).toEqual([]);
    expect(notify.error).toHaveBeenCalledWith('geoPlaces.errors.GEO_CITY_NOT_FOUND message');
  });
  it('city in use shows usedBy', async () => {
    await render();
    vi.spyOn(page['confirmDelete'](), 'open').mockResolvedValue(true);
    vi.spyOn(page['inUseModal'](), 'open').mockImplementation(() => {});
    api.deleteCity.mockRejectedValue(
      new ApiError(409, 'GEO_CITY_IN_USE', { usedBy: ['addresses', 'districts'] }),
    );
    await page['requestDelete'](city);
    expect(page['inUseState']()?.usedBy).toEqual(['addresses', 'districts']);
  });
  it('tenant-wide 403 turns the tab read-only', async () => {
    await render();
    vi.spyOn(page['confirmDeactivate'](), 'open').mockResolvedValue(true);
    api.updateCity.mockRejectedValue(new ApiError(403, 'TENANT_WIDE_PERMISSION_REQUIRED'));
    await page['toggleActive'](city);
    await render();
    expect(page['canManage']()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('wsGeo.needsTenantWide');
    expect(page['placeModal']()['isReadOnly']()).toBe(true);
  });
  it('429 shows the rate text', async () => {
    await render();
    vi.spyOn(page['confirmDeactivate'](), 'open').mockResolvedValue(true);
    api.updateCity.mockRejectedValue(
      new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['20'] }),
    );
    await page['toggleActive'](city);
    expect(notify.error).toHaveBeenCalledWith('Retry in 20 s');
  });
  it('load more appends and a recovered cursor replaces old rows', async () => {
    await render();
    page['nextCursor'].set('next');
    api.listCities.mockResolvedValue({
      items: [{ ...city, id: 'another-city' }],
      nextCursor: 'next-2',
    });
    page['loadMore']();
    await render();
    expect(page['cities']()).toHaveLength(2);
    expect(api.listCities.mock.lastCall?.[1].cursor).toBe('next');
    api.listCities.mockResolvedValue({ items: [city], nextCursor: null, cursorReset: true });
    page['loadMore']();
    await render();
    expect(page['cities']()).toEqual([city]);
  });
});
