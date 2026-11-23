/*
 * Legacy row fixtures retained only for CRM feature-fake readers of GEO_FAKE_DB.
 * No picker API, simulated write, permission switch, delay or ID generator lives here.
 * Remove this module when those feature owners retire their remaining imports.
 */
import type { GeoCity, GeoCountry, GeoDistrict, GeoDistrictKind, GeoState, GeoZone } from './geo.model';

const SEED_TIMESTAMP = '2026-01-15T09:00:00.000Z';
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
