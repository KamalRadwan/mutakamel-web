import { fakeDelay } from '../../../core/fake/fake-utils';
import type { Me } from '../staff/shared/staff.model';
import { buildActorMeSync } from '../staff/shared/staff.fake';
import { AppsOverviewItem, AppsOverviewResponse, COMING_SOON_APPS } from './modules.model';

// Fake for GET /api/tenant/core/v1/apps/overview, following the landed Core endpoint:
// - order is catalogue rank, then moduleKey;
// - iconKey is always null today (the client maps icons by moduleKey);
// - FUTURE = visible, unsubscribed, not sellable; it may be empty;
// - seats only for the owner or users.user.read callers, only on SUBSCRIBED, non-add-on
//   items that have a seat module. In the seed, `seats` is the seat module usage the
//   server knows (null = no seat module); the rule in fakeGetAppsOverview strips it.
export interface CatalogueEntry extends AppsOverviewItem {
  rank: number;
}

const CATALOGUE: readonly CatalogueEntry[] = [
  {
    rank: 10,
    moduleKey: 'crm',
    nameI18n: { en: 'CRM', ar: 'إدارة علاقات العملاء' },
    iconKey: null,
    group: 'SUBSCRIBED',
    isAddon: false,
    myAccessState: 'ACTIVE',
    seats: { used: 12, total: 20 },
  },
  {
    rank: 20,
    moduleKey: 'trade',
    nameI18n: { en: 'Trade', ar: 'التجارة' },
    iconKey: null,
    group: 'SUBSCRIBED',
    isAddon: false,
    myAccessState: 'ACTIVE',
    seats: { used: 8, total: 10 },
  },
  {
    rank: 30,
    moduleKey: 'accounting',
    nameI18n: { en: 'Accounting', ar: 'المحاسبة' },
    iconKey: null,
    group: 'SUBSCRIBED',
    isAddon: false,
    myAccessState: 'OVER_CAPACITY',
    seats: { used: 6, total: 5 },
  },
  ...COMING_SOON_APPS.map((app, index): CatalogueEntry => ({
    ...app,
    rank: 40 + index * 10,
    group: 'AVAILABLE',
  })),
  {
    rank: 70,
    moduleKey: 'hr',
    nameI18n: { en: 'HR and Payroll', ar: 'الموارد البشرية والرواتب' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: false,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 80,
    moduleKey: 'manufacturing',
    nameI18n: { en: 'Manufacturing', ar: 'التصنيع' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: false,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 90,
    moduleKey: 'fleet',
    nameI18n: { en: 'Fleet', ar: 'إدارة الأسطول' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: false,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 100,
    moduleKey: 'recruitment',
    nameI18n: { en: 'Recruitment', ar: 'التوظيف' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: false,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 110,
    moduleKey: 'procurement',
    nameI18n: { en: 'Procurement', ar: 'المشتريات والتوريد' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: false,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 120,
    moduleKey: 'warehouse',
    nameI18n: { en: 'Warehouse management', ar: 'إدارة المستودعات' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: false,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 130,
    moduleKey: 'quality',
    nameI18n: { en: 'Quality', ar: 'إدارة الجودة' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: false,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 140,
    moduleKey: 'maintenance',
    nameI18n: { en: 'Maintenance', ar: 'الصيانة' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: false,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 150,
    moduleKey: 'assets',
    nameI18n: { en: 'Asset management', ar: 'إدارة الأصول' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: false,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 160,
    moduleKey: 'documents',
    nameI18n: { en: 'Documents', ar: 'إدارة المستندات' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: false,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 170,
    moduleKey: 'ecommerce',
    nameI18n: { en: 'E-commerce', ar: 'المتجر الإلكتروني' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: false,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 180,
    moduleKey: 'marketing',
    nameI18n: { en: 'Marketing', ar: 'التسويق' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: false,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 190,
    moduleKey: 'field-service',
    nameI18n: { en: 'Field service', ar: 'الخدمات الميدانية' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: false,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 200,
    moduleKey: 'subscriptions',
    nameI18n: { en: 'Subscriptions', ar: 'الاشتراكات' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: false,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 210,
    moduleKey: 'budgeting',
    nameI18n: { en: 'Budgeting', ar: 'الموازنات' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: false,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 220,
    moduleKey: 'bi',
    nameI18n: { en: 'Business intelligence', ar: 'ذكاء الأعمال' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: false,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 230,
    moduleKey: 'real-estate',
    nameI18n: { en: 'Real estate', ar: 'العقارات' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: true,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 240,
    moduleKey: 'clinics',
    nameI18n: { en: 'Clinics', ar: 'العيادات' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: true,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 250,
    moduleKey: 'schools',
    nameI18n: { en: 'Schools', ar: 'المدارس' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: true,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 260,
    moduleKey: 'restaurants',
    nameI18n: { en: 'Restaurants', ar: 'المطاعم' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: true,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 270,
    moduleKey: 'hotels',
    nameI18n: { en: 'Hotels', ar: 'الفنادق' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: true,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 280,
    moduleKey: 'pharmacies',
    nameI18n: { en: 'Pharmacies', ar: 'الصيدليات' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: true,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 290,
    moduleKey: 'construction',
    nameI18n: { en: 'Construction', ar: 'المقاولات' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: true,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 300,
    moduleKey: 'gyms',
    nameI18n: { en: 'Gyms', ar: 'الأندية الرياضية' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: true,
    myAccessState: null,
    seats: null,
  },
  {
    rank: 310,
    moduleKey: 'car-rental',
    nameI18n: { en: 'Car rental', ar: 'تأجير السيارات' },
    iconKey: null,
    group: 'FUTURE',
    isAddon: true,
    myAccessState: null,
    seats: null,
  },
];

// Lets specs replace the catalogue (for example with no FUTURE items); null restores the seed.
let catalogueOverride: readonly CatalogueEntry[] | null = null;

export function setFakeCatalogue(entries: readonly CatalogueEntry[] | null): void {
  catalogueOverride = entries;
}

function canReadUsers(me: Me): boolean {
  return me.isTenantOwner || me.permissions.includes('users.user.read');
}

function byRankThenKey(a: CatalogueEntry, b: CatalogueEntry): number {
  return a.rank - b.rank || a.moduleKey.localeCompare(b.moduleKey);
}

export async function fakeGetAppsOverview(
  me: Me = buildActorMeSync(),
): Promise<AppsOverviewResponse> {
  await fakeDelay(300);
  const showSeats = canReadUsers(me);
  return {
    items: [...(catalogueOverride ?? CATALOGUE)].sort(byRankThenKey).map((entry) => ({
      moduleKey: entry.moduleKey,
      nameI18n: { ...entry.nameI18n },
      iconKey: entry.iconKey,
      group: entry.group,
      isAddon: entry.isAddon,
      myAccessState: entry.myAccessState,
      seats:
        showSeats && entry.group === 'SUBSCRIBED' && !entry.isAddon && entry.seats
          ? { ...entry.seats }
          : null,
    })),
  };
}
