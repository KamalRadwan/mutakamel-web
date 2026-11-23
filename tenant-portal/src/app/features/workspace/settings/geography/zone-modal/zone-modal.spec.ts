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
import { ZoneModal } from './zone-modal';

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

describe('ZoneModal', () => {
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
  let fixture: ComponentFixture<ZoneModal>;
  let page: ZoneModal;
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
    fixture = TestBed.createComponent(ZoneModal);
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

  async function createForm() {
    await render();
    vi.spyOn(page['modal'](), 'open').mockImplementation(() => {});
    page.openCreate();
    page['nameEn'].set('Zone');
    page['nameAr'].set('منطقة');
    page['cityIds'].set([id]);
    await render();
  }
  it('create zone succeeds', async () => {
    await createForm();
    await page['save']();
    expect(api.createZone).toHaveBeenCalledWith(
      { nameEn: 'Zone', nameAr: 'منطقة', description: null, isActive: true, cityIds: [id] },
      expect.any(String),
    );
    expect(notify.success).toHaveBeenCalledWith('geoZones.created');
  });
  it('zone city conflict chips', async () => {
    await createForm();
    api.createZone.mockRejectedValue(
      new ApiError(409, 'GEO_ZONE_CITY_CONFLICT', { cityIds: [id], zoneIds: ['other-zone'] }),
    );
    await page['save']();
    expect(page['cityPicker']()['conflicts']().get(id)).toBe('other-zone');
    expect(notify.error).toHaveBeenCalled();
  });
  it('invalid zone cities', async () => {
    await createForm();
    api.createZone.mockRejectedValue(new ApiError(422, 'GEO_ZONE_CITY_INVALID', { cityIds: [id] }));
    await page['save']();
    expect(page['cityPicker']()['conflicts']().has(id)).toBe(true);
  });
  it('update sends the full city set', async () => {
    await render();
    vi.spyOn(page['modal'](), 'open').mockImplementation(() => {});
    await page.openEdit(zone);
    page['cityIds'].set([id, 'another-city']);
    await page['save']();
    expect(api.updateZone).toHaveBeenCalledWith(
      id,
      { cityIds: ['another-city', id].sort() },
      expect.any(String),
    );
  });
});
