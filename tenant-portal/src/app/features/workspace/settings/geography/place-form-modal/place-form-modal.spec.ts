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
import { PlaceFormModal } from './place-form-modal';

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

describe('PlaceFormModal', () => {
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
  let fixture: ComponentFixture<PlaceFormModal>;
  let page: PlaceFormModal;
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
    fixture = TestBed.createComponent(PlaceFormModal);
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
    page.openCreateCity({ stateId });
    page['nameEn'].set('City');
    page['nameAr'].set('مدينة');
    await render();
  }
  it('create city succeeds', async () => {
    await createForm();
    const saved = vi.fn();
    page.citySaved.subscribe(saved);
    await page['save']();
    expect(api.createCity).toHaveBeenCalledWith(
      { stateId, nameEn: 'City', nameAr: 'مدينة', isActive: true },
      expect.any(String),
    );
    expect(saved).toHaveBeenCalledWith({ city, isNew: true });
    expect(notify.success).toHaveBeenCalledWith('geoPlaces.created');
  });
  it('validation errors map to fields', async () => {
    await createForm();
    api.createCity.mockRejectedValue(
      new ApiError(400, 'CORE_VALIDATION_FAILED', {
        nameEn: ['English required'],
        nameAr: ['Arabic required'],
      }),
    );
    await page['save']();
    await render();
    expect(page['serverErrors']()).toEqual({ en: 'English required', ar: 'Arabic required' });
    expect(fixture.nativeElement.textContent).toContain('English required');
  });
  it('name taken is a field message', async () => {
    await createForm();
    api.createCity.mockRejectedValue(new ApiError(409, 'GEO_CITY_NAME_TAKEN'));
    await page['save']();
    expect(page['serverErrors']()).toEqual({
      en: 'geoPlaces.nameTaken',
      ar: 'geoPlaces.nameTaken',
    });
  });
  it('inactive parent message', async () => {
    await createForm();
    api.createCity.mockRejectedValue(new ApiError(422, 'GEO_PARENT_INACTIVE'));
    await page['save']();
    await render();
    expect(page['parentError']()).toBe('geoPlaces.errors.GEO_PARENT_INACTIVE message');
    expect(fixture.nativeElement.textContent).toContain(
      'geoPlaces.errors.GEO_PARENT_INACTIVE message',
    );
  });
  it('401 keeps the form', async () => {
    await createForm();
    api.createCity.mockRejectedValueOnce(new ApiError(401, 'COMMON.GENERIC.UNAUTHORIZED'));
    await page['save']();
    expect(notify.error).toHaveBeenCalledWith('geoPlaces.notSaved');
    expect(page['nameEn']()).toBe('City');
    expect(page['nameAr']()).toBe('مدينة');
    await page['save']();
    expect(api.createCity.mock.calls[1]).toEqual(api.createCity.mock.calls[0]);
  });
  it('idempotency codes use the core mapper', async () => {
    await createForm();
    for (const [code, message] of [
      ['GW.IDEM.IN_FLIGHT', 'settings.errors.idempotency message'],
      ['GW.IDEM.MISMATCH', 'settings.errors.idempotencyMismatch message'],
    ]) {
      api.createCity.mockRejectedValueOnce(new ApiError(409, code));
      await page['save']();
      expect(notify.error).toHaveBeenCalledWith(message);
    }
  });
  it('changing the create body starts a new key', async () => {
    await createForm();
    api.createCity.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR'));
    await page['save']();
    page['isActive'].set(false);
    await page['save']();
    expect(api.createCity.mock.calls[1][1]).not.toBe(api.createCity.mock.calls[0][1]);
  });
});
