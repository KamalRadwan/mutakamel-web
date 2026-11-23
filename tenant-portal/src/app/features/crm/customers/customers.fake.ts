import { GEO_FAKE_DB } from '../../../core/geo/geo.fake';
import { FAKE_COMPANIES } from '../../../core/scope/scope.fake';
import { listLeadSources } from '../settings/lead-sources/lead-sources.api';
import { ApiError, fakeDelay, fakeId } from '../settings/shared/settings-api';
import { getCrmStaticData } from '../settings/static-data/static-data.api';
import { listTags as listSettingsTags } from '../settings/tags/tags.api';
import { fakeGetCrmModules } from '../shared/crm-modules/crm-modules.fake';
import { fakeCheckLeadDuplicates } from '../leads/leads.fake';
import { CUSTOMER_STATUS_ORDER, isManualStatus } from './customer-statuses';
import {
  ActivityBucket,
  AddressBody,
  BoardLane,
  BoardResponse,
  BranchOption,
  CARD_COLORS,
  CUSTOMER_BOARD_LIMIT,
  CUSTOMER_FILTERABLE_FIELDS,
  CUSTOMER_LIMITS,
  CUSTOMER_LIST_LIMIT,
  CardColor,
  ContactChangeBody,
  ContactPersonBody,
  CreateCustomerBody,
  CurrencyOption,
  CustomerAddress,
  CustomerBoardItem,
  CustomerCapabilities,
  CustomerContactView,
  CustomerCustomField,
  CustomerDetail,
  CustomerFilterItem,
  CustomerFilterNode,
  CustomerRow,
  CustomerSearchBody,
  CustomerStatus,
  CustomerStatusOption,
  DuplicateCheckProbe,
  DuplicateCheckResponse,
  DuplicateContactMethodHit,
  DuplicateLevel,
  DuplicateMatch,
  DuplicateMatchType,
  Named,
  OwnerOption,
  OwnerSummary,
  Page,
  PartySummary,
  PrimaryContactView,
  ProfileType,
  SearchResponse,
  SourceOption,
  SourceSummary,
  StatusCounts,
  TagSummary,
  TagView,
  UpdateCustomerBody,
} from './customers.model';

/** The session's first branch (core/scope FAKE_COMPANIES b1), shared by every CRM fake. */
export const DEFAULT_CUSTOMER_BRANCH_ID = 'b1';
export const ACME_CUSTOMER_ID = '0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa01';
export const FAKE_CURRENT_USER_ID = 'u1';

export let FAKE_CAN_MANAGE_STATUS = true;
export let FAKE_CAN_MANAGE_TAGS = true;
export let FAKE_CAN_EXPORT = true;
export let FAKE_LEADS_ENABLED_OVERRIDE: boolean | null = null;
export let FAKE_CONFLICT_NEXT_PATCH = false;

export function fakeCanManageStatus(): boolean {
  return FAKE_CAN_MANAGE_STATUS;
}

export function fakeCanManageTags(): boolean {
  return FAKE_CAN_MANAGE_TAGS;
}

export function fakeCanExport(): boolean {
  return FAKE_CAN_EXPORT;
}

function customerDelay(): Promise<void> {
  return fakeDelay(250 + Math.floor(Math.random() * 251));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

interface OwnerRecord {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  firstName: string;
  lastName: string;
}

const OWNER_RECORDS: Record<string, OwnerRecord> = {
  u1: { id: 'u1', firstName: 'Kamal', lastName: 'Radwan', displayName: 'Kamal Radwan', avatarUrl: null },
  u2: { id: 'u2', firstName: 'Mona', lastName: 'Adel', displayName: 'Mona Adel', avatarUrl: null },
  u3: { id: 'u3', firstName: 'Omar', lastName: 'Fathy', displayName: 'Omar Fathy', avatarUrl: null },
  u4: { id: 'u4', firstName: 'Salma', lastName: 'Nabil', displayName: 'Salma Nabil', avatarUrl: null },
};

/** The session's branches (core/scope FAKE_COMPANIES b1-b5), so every CRM fake shares one branch list. */
const BRANCHES: BranchOption[] = FAKE_COMPANIES.flatMap((company) =>
  company.branches.map((branch) => ({ id: branch.id, name: branch.nameEn, companyName: company.nameEn })),
);

const BRANCH_OWNER_IDS: Record<string, string[]> = {
  b1: ['u1', 'u2', 'u3', 'u4'],
  b2: ['u1', 'u2', 'u3'],
  b3: ['u1', 'u2', 'u4'],
  b4: ['u1'],
  b5: ['u1', 'u2'],
};

const ALL_ACTIONS: CustomerCapabilities['customerProfiles'] = {
  create: { scope: 'all', ownerUserIds: null },
  update: { scope: 'all', ownerUserIds: null },
  delete: { scope: 'all', ownerUserIds: null },
};

/** b4 is the own-scope branch without delete, as the Leads fake's restricted branch. */
const CAPABILITIES_BY_BRANCH: Record<string, CustomerCapabilities> = Object.fromEntries(
  BRANCHES.map((branch) => [
    branch.id,
    {
      branchId: branch.id,
      customerProfiles:
        branch.id === 'b4'
          ? { create: { scope: 'own', ownerUserIds: ['u1'] }, update: { scope: 'own', ownerUserIds: ['u1'] }, delete: null }
          : ALL_ACTIONS,
    },
  ]),
);

const FALLBACK_SOURCES: SourceOption[] = [
  { id: '00000000-0000-7000-8000-000000000001', nameEn: 'Website', nameAr: 'الموقع الإلكتروني', isActive: true, iconUrl: null },
  { id: '00000000-0000-7000-8000-000000000002', nameEn: 'Facebook', nameAr: 'فيسبوك', isActive: true, iconUrl: null },
  { id: '00000000-0000-7000-8000-000000000005', nameEn: 'WhatsApp', nameAr: 'واتساب', isActive: true, iconUrl: null },
  { id: '00000000-0000-7000-8000-000000000009', nameEn: 'Referral', nameAr: 'إحالة', isActive: true, iconUrl: null },
  { id: '00000000-0000-7000-8000-00000000000a', nameEn: 'Phone Call', nameAr: 'مكالمة هاتفية', isActive: true, iconUrl: null },
];

const FALLBACK_TAGS: TagSummary[] = [
  { id: 'tag-001', name: 'VIP', backgroundColor: '#FBBF24', textColor: '#451A03' },
  { id: 'tag-003', name: 'عميل مميز', backgroundColor: '#F3E8FF', textColor: '#6B21A8' },
  { id: 'tag-004', name: 'Follow up', backgroundColor: '#DBEAFE', textColor: '#1E40AF' },
  { id: 'tag-005', name: 'Partner', backgroundColor: '#CCFBF1', textColor: '#115E59' },
  { id: 'tag-006', name: 'Wholesale', backgroundColor: '#F1F5F9', textColor: '#334155' },
  { id: 'tag-007', name: 'Government', backgroundColor: '#4338CA', textColor: '#FFFFFF' },
];

const CURRENCIES: CurrencyOption[] = [
  { id: 'EGP', label: 'Egyptian pound', decimals: 2, isDefault: true },
  { id: 'SAR', label: 'Saudi riyal', decimals: 2, isDefault: false },
  { id: 'USD', label: 'US dollar', decimals: 2, isDefault: false },
  { id: 'KWD', label: 'Kuwaiti dinar', decimals: 3, isDefault: false },
];

const CUSTOMER_CUSTOM_FIELDS: CustomerCustomField[] = [
  {
    id: 'cf-cust-industry',
    fieldKey: 'industry_segment',
    nameEn: 'Industry segment',
    nameAr: 'قطاع النشاط',
    type: 'MULTI_SELECT',
    placeholderEn: 'Select one or more segments',
    placeholderAr: 'اختر قطاعًا واحدًا أو أكثر',
    options: [
      { key: 'retail', nameEn: 'Retail', nameAr: 'التجزئة' },
      { key: 'manufacturing', nameEn: 'Manufacturing', nameAr: 'التصنيع' },
      { key: 'healthcare', nameEn: 'Healthcare', nameAr: 'الرعاية الصحية' },
      { key: 'technology', nameEn: 'Technology', nameAr: 'التقنية' },
    ],
    requiredOnCreate: false,
    requiredOnUpdate: false,
    sortOrder: 1,
  },
  {
    id: 'cf-cust-tier',
    fieldKey: 'account_tier',
    nameEn: 'Account tier',
    nameAr: 'فئة الحساب',
    type: 'SELECT',
    placeholderEn: 'Select account tier',
    placeholderAr: 'اختر فئة الحساب',
    options: [
      { key: 'enterprise', nameEn: 'Enterprise', nameAr: 'مؤسسي' },
      { key: 'mid_market', nameEn: 'Mid-market', nameAr: 'متوسط' },
      { key: 'smb', nameEn: 'Small business', nameAr: 'صغير' },
    ],
    requiredOnCreate: false,
    requiredOnUpdate: false,
    sortOrder: 2,
  },
  {
    id: 'cf-cust-renewal',
    fieldKey: 'contract_renewal_date',
    nameEn: 'Contract renewal date',
    nameAr: 'تاريخ تجديد العقد',
    type: 'DATE',
    placeholderEn: null,
    placeholderAr: null,
    options: [],
    requiredOnCreate: false,
    requiredOnUpdate: false,
    sortOrder: 3,
  },
  {
    id: 'cf-cust-credit',
    fieldKey: 'credit_limit',
    nameEn: 'Credit limit',
    nameAr: 'الحد الائتماني',
    type: 'NUMBER',
    placeholderEn: 'e.g. 100000',
    placeholderAr: 'مثال: 100000',
    options: [],
    requiredOnCreate: false,
    requiredOnUpdate: false,
    sortOrder: 4,
  },
  {
    id: 'cf-cust-portal',
    fieldKey: 'account_portal_url',
    nameEn: 'Portal URL',
    nameAr: 'رابط بوابة العميل',
    type: 'URL',
    placeholderEn: 'https://portal.example.com',
    placeholderAr: 'https://portal.example.com',
    options: [],
    requiredOnCreate: false,
    requiredOnUpdate: false,
    sortOrder: 5,
  },
];

const FALLBACK_STATUS_OPTIONS: CustomerStatusOption[] = [
  { value: 'PROSPECT', label: { en: 'Prospect', ar: 'عميل محتمل' } },
  { value: 'ACTIVE_CUSTOMER', label: { en: 'Active customer', ar: 'عميل نشط' } },
  { value: 'INACTIVE', label: { en: 'Inactive', ar: 'غير نشط' } },
  { value: 'BLACKLISTED', label: { en: 'Blacklisted', ar: 'محظور' } },
];

const COLORS = Object.keys(CARD_COLORS) as CardColor[];
const DAY_MS = 24 * 60 * 60 * 1000;

const GEO_PRESETS: readonly {
  countryId: string;
  stateId: string;
  cityId: string | null;
  districtId: string | null;
  street: string;
}[] = [
  { countryId: 'geo-eg', stateId: 'geo-eg-c', cityId: 'geo-city-maadi', districtId: 'geo-dist-degla', street: '14 Road 231, Degla' },
  { countryId: 'geo-eg', stateId: 'geo-eg-c', cityId: 'geo-city-nasr', districtId: 'geo-dist-zone7', street: '28 Abbas El-Akkad St.' },
  { countryId: 'geo-eg', stateId: 'geo-eg-c', cityId: 'geo-city-heliopolis', districtId: 'geo-dist-korba', street: '9 Baghdad St.' },
  { countryId: 'geo-eg', stateId: 'geo-eg-gz', cityId: 'geo-city-dokki', districtId: null, street: '45 Tahrir St.' },
  { countryId: 'geo-eg', stateId: 'geo-eg-gz', cityId: 'geo-city-6oct', districtId: 'geo-dist-abuRawash', street: '112 Central Axis' },
  { countryId: 'geo-sa', stateId: 'geo-sa-ri', cityId: 'geo-city-olaya', districtId: null, street: '720 King Fahd Rd.' },
  { countryId: 'geo-sa', stateId: 'geo-sa-ri', cityId: 'geo-city-malqa', districtId: null, street: '310 Anas Bin Malik Rd.' },
];

const CORPORATE_COMPANIES: readonly { name: string; legalSuffix: string; saudi?: boolean }[] = [
  { name: 'Acme Retail', legalSuffix: 'S.A.E.' },
  { name: 'شركة النيل للتجارة', legalSuffix: 'ش.م.م' },
  { name: 'Delta Foods', legalSuffix: 'S.A.E.' },
  { name: 'مؤسسة الرياض للحلول الرقمية', legalSuffix: 'ذ.م.م', saudi: true },
  { name: 'Cairo Steel Industries', legalSuffix: 'S.A.E.' },
  { name: 'شركة البحر الأحمر اللوجستية', legalSuffix: 'ش.م.م' },
  { name: 'Pyramids Pharma', legalSuffix: 'S.A.E.' },
  { name: 'مجموعة المدار للتوريدات', legalSuffix: 'ذ.م.م', saudi: true },
  { name: 'Horus Software', legalSuffix: 'LLC' },
  { name: 'شركة الأفق للمقاولات', legalSuffix: 'ش.م.م' },
  { name: 'Al-Olaya Ventures', legalSuffix: 'Ltd.', saudi: true },
  { name: 'مؤسسة الدلتا الصناعية', legalSuffix: 'ش.م.م' },
  { name: 'Sinai Solar Energy', legalSuffix: 'S.A.E.' },
  { name: 'شركة القمة للتجهيزات الطبية', legalSuffix: 'ش.م.م' },
  { name: 'Zamalek Interiors', legalSuffix: 'LLC' },
  { name: 'شركة الواحة للاستثمار', legalSuffix: 'ذ.م.م', saudi: true },
  { name: 'Maadi International Schools', legalSuffix: 'S.A.E.' },
  { name: 'شركة النخيل للأغذية', legalSuffix: 'ذ.م.م', saudi: true },
  { name: 'Suez Marine Services', legalSuffix: 'S.A.E.' },
  { name: 'مؤسسة السرايات للتجزئة', legalSuffix: 'ش.م.م' },
  { name: 'Giza Auto Group', legalSuffix: 'S.A.E.' },
  { name: 'شركة المستقبل للاتصالات', legalSuffix: 'ذ.م.م', saudi: true },
  { name: 'Luxor Heritage Travel', legalSuffix: 'LLC' },
  { name: 'شركة الرواد للتعبئة والتغليف', legalSuffix: 'ش.م.م' },
  { name: 'Memphis Construction', legalSuffix: 'S.A.E.' },
  { name: 'شركة نجد للخدمات', legalSuffix: 'ذ.م.م', saudi: true },
  { name: 'Faiyum Agro Export', legalSuffix: 'S.A.E.' },
  { name: 'مؤسسة المعرفة للتدريب', legalSuffix: 'ش.م.م' },
  { name: 'Heliopolis Clinics', legalSuffix: 'LLC' },
  { name: 'شركة الميناء للشحن', legalSuffix: 'ش.م.م' },
  { name: 'Nasr Plastics', legalSuffix: 'S.A.E.' },
  { name: 'شركة الجزيرة للتقنية', legalSuffix: 'ذ.م.م', saudi: true },
  { name: 'Alexandria Textiles', legalSuffix: 'S.A.E.' },
];

const INDIVIDUAL_NAMES: readonly { firstName: string; lastName: string; honorificTitle: string | null; saudi?: boolean }[] = [
  { firstName: 'أحمد', lastName: 'سالم', honorificTitle: 'أ.' },
  { firstName: 'Sara', lastName: 'Mahmoud', honorificTitle: 'Ms.' },
  { firstName: 'محمد', lastName: 'العتيبي', honorificTitle: 'م.', saudi: true },
  { firstName: 'Karim', lastName: 'Saeed', honorificTitle: 'Mr.' },
  { firstName: 'سلمى', lastName: 'عبد العزيز', honorificTitle: null },
  { firstName: 'Youssef', lastName: 'Ali', honorificTitle: 'Dr.' },
  { firstName: 'خالد', lastName: 'الدوسري', honorificTitle: 'أ.', saudi: true },
  { firstName: 'Nadia', lastName: 'Fouad', honorificTitle: 'Ms.' },
  { firstName: 'طارق', lastName: 'منصور', honorificTitle: 'م.' },
  { firstName: 'Dina', lastName: 'Samir', honorificTitle: null },
  { firstName: 'فيصل', lastName: 'القحطاني', honorificTitle: 'أ.', saudi: true },
  { firstName: 'Hany', lastName: 'Nabil', honorificTitle: 'Mr.' },
  { firstName: 'مريم', lastName: 'الشريف', honorificTitle: null },
  { firstName: 'Omar', lastName: 'Hassan', honorificTitle: 'Eng.' },
  { firstName: 'نورة', lastName: 'الحربي', honorificTitle: 'أ.', saudi: true },
  { firstName: 'Laila', lastName: 'Mostafa', honorificTitle: 'Ms.' },
  { firstName: 'ياسر', lastName: 'الغامدي', honorificTitle: 'د.', saudi: true },
  { firstName: 'Rana', lastName: 'Youssef', honorificTitle: null },
  { firstName: 'حسام', lastName: 'الدين', honorificTitle: 'أ.' },
  { firstName: 'Sherif', lastName: 'El-Masry', honorificTitle: 'Mr.' },
  { firstName: 'ريم', lastName: 'السبيعي', honorificTitle: null, saudi: true },
  { firstName: 'Mostafa', lastName: 'Kamal', honorificTitle: 'Eng.' },
  { firstName: 'هند', lastName: 'الفقي', honorificTitle: 'د.' },
  { firstName: 'Tamer', lastName: 'Zaki', honorificTitle: 'Mr.' },
  { firstName: 'علي', lastName: 'الزهراني', honorificTitle: 'أ.', saudi: true },
  { firstName: 'Maha', lastName: 'Farid', honorificTitle: 'Ms.' },
  { firstName: 'إبراهيم', lastName: 'الشافعي', honorificTitle: 'أ.' },
];

const CONTACT_PEOPLE: readonly { firstName: string; lastName: string; honorificTitle: string | null; jobTitle: string | null }[] = [
  { firstName: 'Sherif', lastName: 'El-Masry', honorificTitle: 'Mr.', jobTitle: 'Chief Executive Officer' },
  { firstName: 'Nadia', lastName: 'Fouad', honorificTitle: 'Ms.', jobTitle: 'Procurement Director' },
  { firstName: 'Tarek', lastName: 'Adel', honorificTitle: 'Eng.', jobTitle: 'IT Manager' },
  { firstName: 'رامي', lastName: 'الشهاوي', honorificTitle: 'أ.', jobTitle: 'مدير المبيعات' },
  { firstName: 'فهد', lastName: 'الحربي', honorificTitle: 'م.', jobTitle: 'Operations Manager' },
  { firstName: 'سارة', lastName: 'نصر', honorificTitle: 'أ.', jobTitle: 'Finance Manager' },
  { firstName: 'Heba', lastName: 'Gamal', honorificTitle: 'Ms.', jobTitle: 'Supply Chain Lead' },
  { firstName: 'خالد', lastName: 'العمري', honorificTitle: 'أ.', jobTitle: 'General Manager' },
];

function namedOf(item: { id: string; nameEn: string; nameAr: string } | undefined): Named | null {
  return item ? { id: item.id, nameEn: item.nameEn, nameAr: item.nameAr } : null;
}

function buildAddressFromIds(
  countryId: string | null,
  stateId: string | null,
  cityId: string | null,
  districtId: string | null,
  street: string | null = null,
): CustomerAddress {
  const country = countryId ? GEO_FAKE_DB.countries.find((c) => c.id === countryId && c.isActive) : undefined;
  const state = stateId ? GEO_FAKE_DB.states.find((s) => s.id === stateId && s.isActive) : undefined;
  const city = cityId ? GEO_FAKE_DB.cities.find((c) => c.id === cityId && c.isActive) : undefined;
  const district = districtId ? GEO_FAKE_DB.districts.find((d) => d.id === districtId && d.isActive) : undefined;
  return {
    addressType: 'LEGAL',
    label: null,
    countryId,
    stateId,
    cityId,
    districtId,
    countryName: namedOf(country),
    stateName: namedOf(state),
    cityName: namedOf(city),
    districtName: namedOf(district),
    // party-address-geo resolveAddressGeography: legacy text = the place nameEn; state is stored as `area`.
    country: country?.nameEn ?? null,
    city: city?.nameEn ?? null,
    area: state?.nameEn ?? null,
    street,
    buildingNo: null,
    floor: null,
    apartment: null,
    landmark: null,
    postalCode: null,
  };
}

function uuidHex(prefix: string, index1Based: number): string {
  return `${prefix}${index1Based.toString(16).padStart(2, '0')}`;
}

function e164Phone(saudi: boolean, seed: number, landline = false): string {
  if (saudi) {
    if (landline) return `+96611${String(2000000 + seed * 3571).slice(0, 7)}`;
    return `+9665${seed % 2 === 0 ? '0' : '5'}${String(1000000 + seed * 7919).slice(0, 7)}`;
  }
  if (landline) return `+2022${String(10000000 + seed * 6151).slice(0, 8)}`;
  const prefix = ['10', '11', '12'][seed % 3];
  return `+20${prefix}${String(10000000 + seed * 79193).slice(0, 8)}`;
}

function slugAscii(raw: string, fallback: string): string {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return cleaned || fallback;
}

function buildSeedCustomers(): CustomerRecord[] {
  const now = Date.now();
  const buckets: (ActivityBucket | null)[] = ['TODAY', 'OVERDUE', 'FUTURE', null, 'FUTURE'];
  const ownerCycle: (string | null)[] = ['u1', 'u2', 'u3', 'u4', null];
  const statusesInBlock: CustomerStatus[] = [
    ...Array<CustomerStatus>(8).fill('PROSPECT'),
    ...Array<CustomerStatus>(7).fill('ACTIVE_CUSTOMER'),
    ...Array<CustomerStatus>(3).fill('INACTIVE'),
    ...Array<CustomerStatus>(2).fill('BLACKLISTED'),
  ];

  let corpIdx = 0;
  let indivIdx = 0;

  return Array.from({ length: 60 }, (_, index): CustomerRecord => {
    const isCorporate = index % 20 < 11; // 33 CORPORATE (55%), 27 INDIVIDUAL (45%); index 0 is CORPORATE
    const status = statusesInBlock[index % 20]; // 24 PROSPECT (40%), 21 ACTIVE_CUSTOMER (35%), 9 INACTIVE (15%), 6 BLACKLISTED (10%)
    const id = uuidHex('0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa', index + 1);
    const partyId = uuidHex('0192b7eb-7c4f-7a7d-9c9f-51c7f2b3bb', index + 1);
    const ownerId = index === 0 ? 'u1' : ownerCycle[index % ownerCycle.length];
    const ownerRec = ownerId ? OWNER_RECORDS[ownerId] : null;
    const owner: OwnerSummary | null = ownerRec
      ? { userId: ownerRec.id, firstName: ownerRec.firstName, lastName: ownerRec.lastName, avatarUrl: ownerRec.avatarUrl }
      : null;
    const source = FALLBACK_SOURCES[index % FALLBACK_SOURCES.length];
    const acquisitionSource: SourceSummary = {
      id: source.id,
      nameEn: source.nameEn,
      nameAr: source.nameAr,
      isActive: source.isActive,
    };
    const tags = FALLBACK_TAGS.filter((_, tIdx) => (index === 0 ? tIdx < 2 : (index + tIdx) % 4 === 0)).map((t) => ({ ...t }));
    const rating = index === 0 ? 3 : index % 4;
    const cardColor: CardColor | null = index === 0 ? 'BLUE' : index % 3 === 0 ? COLORS[(index / 3) % COLORS.length] : null;
    const bucket = index === 0 ? 'TODAY' : buckets[index % buckets.length];
    const nextActivity = bucket
      ? {
          activityAt: new Date(now + (bucket === 'OVERDUE' ? -2 : bucket === 'TODAY' ? 0 : 4) * DAY_MS).toISOString(),
          bucket,
        }
      : null;

    const hasGeo = index % 2 === 0;
    const geoPreset = GEO_PRESETS[Math.floor(index / 2) % GEO_PRESETS.length];
    const address = hasGeo
      ? buildAddressFromIds(
          geoPreset.countryId,
          geoPreset.stateId,
          geoPreset.cityId,
          geoPreset.districtId,
          geoPreset.street,
        )
      : null;

    const createdAt = new Date(now - (90 - index) * DAY_MS).toISOString();
    const updatedAt = new Date(now - Math.floor(index / 2) * DAY_MS).toISOString();

    if (isCorporate) {
      const corp = CORPORATE_COMPANIES[corpIdx % CORPORATE_COMPANIES.length];
      corpIdx += 1;
      const saudi = Boolean(corp.saudi);
      const slug = slugAscii(corp.name, `company-${index + 1}`);
      const contactCount = index === 0 ? 3 : (index % 3) + 1;
      const contacts: CustomerContactView[] = Array.from({ length: contactCount }, (__, cIdx) => {
        const person = CONTACT_PEOPLE[(index + cIdx) % CONTACT_PEOPLE.length];
        const displayName = `${person.firstName} ${person.lastName}`;
        return {
          partyId: uuidHex(`0192b7ec-7c4f-7a7d-9c9f-51c7f2${String(index + 1).padStart(2, '0')}c0`, cIdx + 1),
          relationshipId: uuidHex(`0192b7ed-7c4f-7a7d-9c9f-51c7f2${String(index + 1).padStart(2, '0')}d0`, cIdx + 1),
          displayName,
          firstName: person.firstName,
          lastName: person.lastName,
          honorificTitle: person.honorificTitle,
          jobTitle: person.jobTitle,
          isPrimary: cIdx === 0,
          email: `${slugAscii(person.firstName, 'contact')}.${index + 1}.${cIdx + 1}@${slug}.example.com`,
          phones: [e164Phone(saudi, index * 10 + cIdx + 1)],
        };
      });
      const primary = contacts[0];
      const companyPhone = e164Phone(saudi, index + 100, true);
      const companyEmail = `info@${slug}.example.com`;
      const primaryContact: PrimaryContactView = {
        partyId: primary.partyId,
        displayName: primary.displayName,
        jobTitle: primary.jobTitle,
        isPrimary: true,
        email: primary.email,
        phones: [...primary.phones],
      };

      return {
        id,
        branchId: DEFAULT_CUSTOMER_BRANCH_ID,
        partyId,
        profileType: 'CORPORATE',
        status,
        rating,
        cardColor,
        displayName: corp.name,
        companyName: corp.name,
        primaryContactName: primary.displayName,
        tags,
        ownerUserId: ownerId,
        owner,
        acquisitionSource,
        acquisitionSourceIconUrl: source.iconUrl,
        nextActivity,
        createdAt,
        updatedAt,
        sourceLeadId: index === 0 || index % 5 === 0 ? `lead-${String(index + 1).padStart(3, '0')}` : null,
        acquisitionSourceId: source.id,
        description: index === 0 ? 'Key retail account expanding POS across 12 locations.' : `Corporate profile for ${corp.name}.`,
        firstName: null,
        lastName: null,
        honorificTitle: null,
        primaryMobile: null,
        email: null,
        companyPhone,
        companyEmail,
        companyWebsite: index % 4 === 3 ? null : `https://www.${slug}.example.com`,
        phones: [companyPhone],
        address,
        cityId: address?.cityId ?? null,
        cityName: address?.cityName ?? null,
        primaryContact,
        contacts,
        customFields:
          index % 3 === 0
            ? {
                account_tier: ['enterprise', 'mid_market', 'smb'][Math.floor(index / 3) % 3],
                industry_segment: ['retail'],
              }
            : {},
        legalName: index === 0 || index % 4 !== 3 ? `${corp.name} ${corp.legalSuffix}` : null,
        taxNumber: index === 0 || index % 3 !== 2 ? `300-${String(418200 + index * 137)}-01` : null,
        commercialRegistrationNumber: index === 0 || index % 3 !== 1 ? `CR-${String(78400 + index * 91)}` : null,
      };
    }

    const person = INDIVIDUAL_NAMES[indivIdx % INDIVIDUAL_NAMES.length];
    indivIdx += 1;
    const saudi = Boolean(person.saudi);
    const displayName = `${person.firstName} ${person.lastName}`;
    const mobile = e164Phone(saudi, index + 300);
    const slug = slugAscii(`${person.firstName}.${person.lastName}`, `customer.${index + 1}`);
    const email = index % 6 === 5 ? null : `${slug}.${index + 1}@example.com`;

    return {
      id,
      branchId: DEFAULT_CUSTOMER_BRANCH_ID,
      partyId,
      profileType: 'INDIVIDUAL',
      status,
      rating,
      cardColor,
      displayName,
      companyName: null,
      primaryContactName: null,
      tags,
      ownerUserId: ownerId,
      owner,
      acquisitionSource,
      acquisitionSourceIconUrl: source.iconUrl,
      nextActivity,
      createdAt,
      updatedAt,
      sourceLeadId: index % 4 === 0 ? `lead-${String(index + 1).padStart(3, '0')}` : null,
      acquisitionSourceId: source.id,
      description: index % 4 === 0 ? `Direct individual customer account (${displayName}).` : null,
      firstName: person.firstName,
      lastName: person.lastName,
      honorificTitle: person.honorificTitle,
      primaryMobile: mobile,
      email,
      companyPhone: null,
      companyEmail: null,
      companyWebsite: null,
      phones: [mobile],
      address,
      cityId: address?.cityId ?? null,
      cityName: address?.cityName ?? null,
      primaryContact: null,
      contacts: [],
      customFields: index % 5 === 0 ? { account_tier: 'smb' } : {},
      legalName: null,
      taxNumber: null,
      commercialRegistrationNumber: null,
    };
  });
}

/**
 * toPartyBackedReadModel: every contact column is the party's own primary method of that type, so
 * `email` and `companyEmail` are the same value (the party primary EMAIL) for both profile types.
 */
type CustomerRecord = Omit<CustomerDetail, 'party'>;

function withPartyContactFields<T extends CustomerRecord>(c: T): T {
  const primaryEmail = c.profileType === 'CORPORATE' ? (c.companyEmail ?? c.email) : (c.email ?? c.companyEmail);
  return { ...c, email: primaryEmail, companyEmail: primaryEmail };
}

/** Re-derives the Party-backed columns and the `party` summary after every write. */
function finalizeCustomer(record: CustomerRecord): CustomerDetail {
  const synced = withPartyContactFields(record);
  return { ...synced, party: partyOf(synced) };
}

export const CUSTOMERS_FAKE_DB: CustomerDetail[] = buildSeedCustomers().map(finalizeCustomer);

const FAKE_OPEN_OPPORTUNITY_COUNT = new Map<string, number>([
  [ACME_CUSTOMER_ID, 1],
  ['0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa02', 2],
  ['0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa03', 3],
  ['0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa04', 1],
  ['0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa05', 2],
]);

const idempotencyStore = new Map<string, { bodyKey: string; result: CustomerDetail }>();

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

function toBoardItem(c: CustomerDetail): CustomerBoardItem {
  return {
    id: c.id,
    branchId: c.branchId,
    partyId: c.partyId,
    profileType: c.profileType,
    status: c.status,
    rating: c.rating,
    cardColor: c.cardColor,
    displayName: c.displayName,
    companyName: c.companyName,
    primaryContactName: c.primaryContactName,
    tags: c.tags.map((t) => ({ ...t })),
    ownerUserId: c.ownerUserId,
    owner: c.owner ? { ...c.owner } : null,
    acquisitionSource: c.acquisitionSource ? { ...c.acquisitionSource } : null,
    acquisitionSourceIconUrl: c.acquisitionSourceIconUrl,
    nextActivity: c.nextActivity ? { ...c.nextActivity } : null,
    address: c.address ? clone(c.address) : null,
    cityId: c.cityId,
    cityName: c.cityName ? { ...c.cityName } : null,
    updatedAt: c.updatedAt,
  };
}

/** partySummaryFromRaw: the CrmPartySummary every list/search/detail row carries as `party`. */
function partyOf(c: CustomerRecord): PartySummary {
  const corporate = c.profileType === 'CORPORATE';
  return {
    id: c.partyId,
    partyType: corporate ? 'ORGANIZATION' : 'PERSON',
    displayName: c.displayName,
    legalName: corporate ? c.legalName : null,
    firstName: c.firstName,
    lastName: c.lastName,
    honorificTitle: c.honorificTitle,
    organizationName: c.companyName,
    taxNumber: corporate ? c.taxNumber : null,
    commercialRegistrationNumber: corporate ? c.commercialRegistrationNumber : null,
    branchId: c.branchId,
    ownerUserId: c.ownerUserId,
    primaryMobile: c.primaryMobile,
    primaryEmail: c.email,
    primaryPhone: c.companyPhone,
    primaryWebsite: c.companyWebsite,
    phones: [...c.phones],
    imageUrl: null,
    imageKind: corporate ? 'LOGO' : 'PHOTO',
    imageRevision: null,
  };
}

function toRow(c: CustomerDetail): CustomerRow {
  return {
    ...toBoardItem(c),
    party: clone(c.party),
    createdAt: c.createdAt,
    sourceLeadId: c.sourceLeadId,
    acquisitionSourceId: c.acquisitionSourceId,
    description: c.description,
    firstName: c.firstName,
    lastName: c.lastName,
    honorificTitle: c.honorificTitle,
    primaryMobile: c.primaryMobile,
    email: c.email,
    companyPhone: c.companyPhone,
    companyEmail: c.companyEmail,
    companyWebsite: c.companyWebsite,
    phones: [...c.phones],
    address: c.address ? clone(c.address) : null,
    cityId: c.cityId,
    cityName: c.cityName ? { ...c.cityName } : null,
    primaryContact: c.primaryContact ? { ...c.primaryContact, phones: [...c.primaryContact.phones] } : null,
  };
}

/** party-read-model paginatedReadModels / emptyPage: totalPages 0 when empty, the page is echoed as sent. */
function pageOf<T>(all: T[], page: number, limit: number): Page<T> {
  const total = all.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    items: all.slice((page - 1) * limit, page * limit),
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1 && totalPages > 0,
  };
}

const ALLOWED_FILTER_FIELDS = new Set<string>(CUSTOMER_FILTERABLE_FIELDS);
const DATE_FILTER_FIELDS = new Set<string>(['createdAt', 'updatedAt']);
const MAX_TREE_DEPTH = 5;
const MAX_TREE_LEAVES = 100;

function isGroupNode(node: CustomerFilterNode): node is { op: 'AND' | 'OR'; children: CustomerFilterNode[] } {
  return 'op' in node;
}

const FILTER_OPERATORS = new Set([
  'eq', 'neq', 'is', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'nin',
  'ilike', 'contains', 'startsWith', 'endsWith', 'ilikeAny', 'isNull', 'isNotNull',
]);

/**
 * DbErrors.invalidOperatorValue, projected by CrmExceptionsFilter to string arrays:
 * 400 INVALID_OPERATOR_VALUE { operator: [op], reason: [lowercase reason] }.
 */
function invalidOperatorValue(operator: string, reason: string): ApiError {
  return new ApiError(400, 'INVALID_OPERATOR_VALUE', { operator: [operator], reason: [reason.toLowerCase()] });
}

/**
 * SearchFilterDto (an unknown operator is a DTO failure, 400 CRM_VALIDATION_FAILED), then the
 * FilterTree/Operator compilers: a field outside CUSTOMER_PROFILE_FILTERABLE_FIELDS is
 * 400 INVALID_FIELD { field: [field] }, a bad value 400 INVALID_OPERATOR_VALUE { operator: [op], reason: [reason] }.
 */
function validateFilterItem(item: CustomerFilterItem, path: string): void {
  if (!FILTER_OPERATORS.has(item.operator)) throw validationFailed(`${path}.operator`);
  if (!ALLOWED_FILTER_FIELDS.has(item.field)) {
    throw new ApiError(400, 'INVALID_FIELD', { field: [item.field] });
  }
  switch (item.operator) {
    case 'isNull':
    case 'isNotNull':
      return;
    case 'between':
      if (!Array.isArray(item.value) || item.value.length !== 2) throw invalidOperatorValue(item.operator, 'expected 2-tuple');
      if (item.value.some((v) => v === null || v === undefined)) throw invalidOperatorValue(item.operator, 'tuple has null');
      return;
    case 'in':
    case 'nin':
    case 'ilikeAny':
      if (!Array.isArray(item.value) || item.value.length === 0) {
        throw invalidOperatorValue(item.operator, 'expected non-empty array');
      }
      return;
    default:
      if (item.value === undefined || item.value === null) throw invalidOperatorValue(item.operator, 'value is required');
  }
}

/** ValidateFilterTree: depth 5, 100 leaves, 100 children per group; any structural failure is a DTO 400. */
function validateFilterTree(node: CustomerFilterNode, depth = 0, counter = { leaves: 0 }): void {
  if (isGroupNode(node)) {
    const nextDepth = depth + 1;
    if (
      nextDepth > MAX_TREE_DEPTH ||
      (node.op !== 'AND' && node.op !== 'OR') ||
      !Array.isArray(node.children) ||
      node.children.length > MAX_TREE_LEAVES
    ) {
      throw validationFailed('filterTree');
    }
    for (const child of node.children) {
      validateFilterTree(child, nextDepth, counter);
    }
    return;
  }
  counter.leaves += 1;
  if (counter.leaves > MAX_TREE_LEAVES) throw validationFailed('filterTree');
  validateFilterItem({ field: node.field, operator: node.operator, value: node.value }, 'filterTree');
}

function readFilterField(c: CustomerDetail, field: string): string | number | null {
  switch (field) {
    case 'id':
      return c.id;
    case 'branchId':
      return c.branchId;
    case 'acquisitionSourceId':
      return c.acquisitionSourceId;
    case 'profileType':
      return c.profileType;
    case 'status':
      return c.status;
    case 'rating':
      return c.rating;
    case 'cardColor':
      return c.cardColor;
    case 'ownerUserId':
      return c.ownerUserId;
    case 'sourceLeadId':
      return c.sourceLeadId;
    case 'description':
      return c.description;
    case 'createdAt':
      return c.createdAt;
    case 'updatedAt':
      return c.updatedAt;
    default:
      return null;
  }
}

function toComparable(value: unknown, isDate: boolean): string | number | null {
  if (value === null || value === undefined) return null;
  if (isDate) {
    const ms = typeof value === 'number' ? value : Date.parse(String(value));
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === 'number' || typeof value === 'string') return value;
  return null;
}

function evaluateFilterLeaf(c: CustomerDetail, item: { field: string; operator: string; value?: unknown }): boolean {
  const actual = readFilterField(c, item.field);
  if (item.operator === 'isNull') return actual === null;
  if (item.operator === 'isNotNull') return actual !== null;
  if (actual === null) return false;

  const isDate = DATE_FILTER_FIELDS.has(item.field);
  const left = toComparable(actual, isDate);
  if (left === null) return false;

  switch (item.operator) {
    case 'eq':
    case 'is': {
      const right = toComparable(item.value, isDate);
      return right !== null && left === right;
    }
    case 'neq': {
      const right = toComparable(item.value, isDate);
      return right !== null && left !== right;
    }
    case 'in':
      return (item.value as unknown[]).some((v) => {
        const right = toComparable(v, isDate);
        return right !== null && left === right;
      });
    case 'nin':
      return (item.value as unknown[]).every((v) => {
        const right = toComparable(v, isDate);
        return right !== null && left !== right;
      });
    case 'gt': {
      const right = toComparable(item.value, isDate);
      return right !== null && left > right;
    }
    case 'gte': {
      const right = toComparable(item.value, isDate);
      return right !== null && left >= right;
    }
    case 'lt': {
      const right = toComparable(item.value, isDate);
      return right !== null && left < right;
    }
    case 'lte': {
      const right = toComparable(item.value, isDate);
      return right !== null && left <= right;
    }
    case 'between': {
      const [minRaw, maxRaw] = item.value as [unknown, unknown];
      const min = toComparable(minRaw, isDate);
      const max = toComparable(maxRaw, isDate);
      return min !== null && max !== null && left >= min && left <= max;
    }
    case 'ilike':
    case 'contains':
      return typeof actual === 'string' && actual.toLowerCase().includes(String(item.value).toLowerCase());
    case 'ilikeAny':
      return (
        typeof actual === 'string' &&
        (item.value as string[]).some((pattern) => actual.toLowerCase().includes(pattern.toLowerCase()))
      );
    case 'startsWith':
      return typeof actual === 'string' && actual.toLowerCase().startsWith(String(item.value).toLowerCase());
    case 'endsWith':
      return typeof actual === 'string' && actual.toLowerCase().endsWith(String(item.value).toLowerCase());
    default:
      return false;
  }
}

function evaluateFilterTree(c: CustomerDetail, node: CustomerFilterNode): boolean {
  if (isGroupNode(node)) {
    return node.op === 'AND'
      ? node.children.every((child) => evaluateFilterTree(c, child))
      : node.children.some((child) => evaluateFilterTree(c, child));
  }
  return evaluateFilterLeaf(c, node);
}

function normalizeDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('00') ? digits.slice(2) : digits;
}

function hasText(haystack: string | null | undefined, needleLower: string): boolean {
  return !!haystack && haystack.toLowerCase().includes(needleLower);
}

function matchesSearch(c: CustomerDetail, search: string, searchField?: CustomerSearchBody['searchField']): boolean {
  const trimmed = search.trim();
  if (!trimmed) return true;
  const term = trimmed.toLowerCase();

  const matchesCustomer = () =>
    hasText(c.displayName, term) ||
    hasText(c.companyName, term) ||
    hasText(c.primaryContactName, term) ||
    hasText(c.primaryContact?.displayName, term) ||
    c.contacts.some((contact) => hasText(contact.displayName, term));

  const matchesEmail = () =>
    hasText(c.email, term) ||
    hasText(c.companyEmail, term) ||
    hasText(c.primaryContact?.email, term) ||
    c.contacts.some((contact) => hasText(contact.email, term));

  const matchesPhone = () => {
    const digits = normalizeDigits(trimmed);
    if (!digits) return false;
    const candidates: (string | null | undefined)[] = [
      c.primaryMobile,
      c.companyPhone,
      ...c.phones,
      ...(c.primaryContact?.phones ?? []),
      ...c.contacts.flatMap((contact) => contact.phones),
    ];
    return candidates.some((phone) => !!phone && normalizeDigits(phone).includes(digits));
  };

  switch (searchField) {
    case 'customer':
      return matchesCustomer();
    case 'email':
      return matchesEmail();
    case 'phone':
      return matchesPhone();
    default:
      return matchesCustomer() || matchesEmail() || matchesPhone();
  }
}

const CUSTOMER_STATUSES: readonly CustomerStatus[] = ['PROSPECT', 'ACTIVE_CUSTOMER', 'INACTIVE', 'BLACKLISTED'];
const SEARCH_FIELDS: readonly string[] = ['customer', 'email', 'phone'];
const SORT_FIELDS: readonly string[] = ['displayName', 'createdAt', 'updatedAt', 'rating', 'status'];
const MAX_SEARCH_TAG_IDS = 50;
const MAX_TAGS_PER_ATTACH = 50;

/**
 * CustomerProfileSearchDto / CustomerProfileBoardSearchDto, checked after the branch guard:
 * page 1..10000, limit 1..100 (the board accepts exactly 50), search <= 200, a known searchField,
 * a known status, and a non-empty unique tagIds list of at most 50.
 */
function validateSearchBody(body: CustomerSearchBody, board: boolean, maxLimit = 100): void {
  const page = body.page ?? 1;
  const limit = body.limit ?? (board ? CUSTOMER_BOARD_LIMIT : 20);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw validationFailed('page');
  if (board ? limit !== CUSTOMER_BOARD_LIMIT : !Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    throw validationFailed('limit');
  }
  if (body.search !== undefined && (typeof body.search !== 'string' || body.search.length > 200)) {
    throw validationFailed('search');
  }
  if (body.searchField !== undefined && !SEARCH_FIELDS.includes(body.searchField)) throw validationFailed('searchField');
  if (body.status !== undefined && !CUSTOMER_STATUSES.includes(body.status)) throw validationFailed('status');
  if (body.tagIds !== undefined) {
    if (
      !Array.isArray(body.tagIds) ||
      body.tagIds.length === 0 ||
      body.tagIds.length > MAX_SEARCH_TAG_IDS ||
      new Set(body.tagIds).size !== body.tagIds.length
    ) {
      throw validationFailed('tagIds');
    }
  }
  if (body.filter !== undefined) {
    if (!Array.isArray(body.filter) || body.filter.length > MAX_TREE_LEAVES) throw validationFailed('filter');
  }
  if (body.filterTree !== undefined) validateFilterTree(body.filterTree);
  if (body.filter) body.filter.forEach((item, index) => validateFilterItem(item, `filter.${index}`));
}

function filterCustomersWithoutStatus(body: CustomerSearchBody): CustomerDetail[] {
  return CUSTOMERS_FAKE_DB.filter((c) => {
    if (c.branchId !== body.branchId) return false;
    if (body.search !== undefined && !matchesSearch(c, body.search, body.searchField)) return false;
    if (body.tagIds && body.tagIds.length > 0 && !c.tags.some((t) => body.tagIds!.includes(t.id))) return false;
    if (body.filter && !body.filter.every((item) => evaluateFilterLeaf(c, item))) return false;
    if (body.filterTree && !evaluateFilterTree(c, body.filterTree)) return false;
    return true;
  });
}

/**
 * search-sort searchSort: only the first token counts, an unknown field is 400 INVALID_FIELD { field: [field] },
 * an omitted sort is createdAt ASC, and profile.id breaks ties in the same direction.
 */
function parseSort(sort: CustomerSearchBody['sort']): { field: string; dir: 'ASC' | 'DESC' } {
  if (!sort) return { field: 'createdAt', dir: 'ASC' };
  const [field, dir] = String(sort).split(':');
  if (!SORT_FIELDS.includes(field)) throw new ApiError(400, 'INVALID_FIELD', { field: [field] });
  return { field, dir: dir?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC' };
}

function sortCustomers(list: CustomerDetail[], sort: CustomerSearchBody['sort']): CustomerDetail[] {
  const { field, dir } = parseSort(sort);
  const factor = dir === 'ASC' ? 1 : -1;

  return [...list].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'displayName':
        cmp = a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
        break;
      case 'updatedAt':
        cmp = Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
        break;
      case 'rating':
        cmp = a.rating - b.rating;
        break;
      case 'status':
        cmp = CUSTOMER_STATUS_ORDER.indexOf(a.status) - CUSTOMER_STATUS_ORDER.indexOf(b.status);
        break;
      default:
        cmp = Date.parse(a.createdAt) - Date.parse(b.createdAt);
        break;
    }
    if (cmp === 0) cmp = a.id.localeCompare(b.id);
    return cmp * factor;
  });
}

function computeCounts(items: readonly CustomerDetail[]): StatusCounts {
  const counts: StatusCounts = {
    ALL: items.length,
    PROSPECT: 0,
    ACTIVE_CUSTOMER: 0,
    INACTIVE: 0,
    BLACKLISTED: 0,
  };
  for (const item of items) {
    counts[item.status] += 1;
  }
  return counts;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** PartyAddressDto IsUUID(); the fake geo catalogue uses readable ids (`geo-eg`), so they pass too. */
const GEO_ID_RE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|geo-[a-z0-9-]+)$/i;

/** IsUUID('7') in the backend; the session fake branches are `b1`-`b5`, so they pass too. */
const FAKE_BRANCH_ID_RE = /^b\d+$/;

/**
 * main.ts ValidationPipe -> AllExceptionsFilter.flattenValidation: 400 CRM_VALIDATION_FAILED whose
 * details map each failing dotted property path (`contacts.0.email`) to its message array.
 */
function validationFailed(path: string): ApiError {
  return new ApiError(400, 'CRM_VALIDATION_FAILED', { [path]: [`${path} is invalid`] });
}

/**
 * RequireBranchAccess guard (runs before the ValidationPipe): a missing branch is 403
 * BRANCH_CONTEXT_REQUIRED, a malformed one 400 CRM_VALIDATION_FAILED (message only, no details),
 * a branch outside the actor's grants 403 BRANCH_PERMISSION_DENIED / BRANCH_ACCESS_DENIED.
 */
function assertBranchContext(branchId: unknown, deniedCode = 'BRANCH_PERMISSION_DENIED'): string {
  if (typeof branchId !== 'string' || !branchId.trim()) throw new ApiError(403, 'BRANCH_CONTEXT_REQUIRED');
  if (!UUID_RE.test(branchId) && !FAKE_BRANCH_ID_RE.test(branchId)) throw new ApiError(400, 'CRM_VALIDATION_FAILED');
  if (!BRANCHES.some((b) => b.id === branchId)) throw new ApiError(403, deniedCode);
  return branchId;
}

/**
 * RequireRecordBranchAccess('CUSTOMER_PROFILE'), target behaviour (backend run queued): an unknown or
 * deleted id is remapped to 404 CUSTOMER_PROFILE_NOT_FOUND, as LEAD is; a foreign branch stays 403.
 */
function findCustomerIndexOrThrow(id: string): number {
  const index = CUSTOMERS_FAKE_DB.findIndex((c) => c.id === id);
  if (index === -1) throw new ApiError(404, 'CUSTOMER_PROFILE_NOT_FOUND');
  return index;
}

function assertMaxLen(value: string | null | undefined, max: number, field: string): void {
  if (value !== undefined && value !== null && value.length > max) {
    throw validationFailed(field);
  }
}

/** common/phone-normalization normalizePhoneValue. */
function normalizePhoneValue(value: string): string {
  const compact = value.replace(/[^\d+]/g, '').trim();
  const digits = compact.replace(/\D/g, '');
  if (compact.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  return digits;
}

/**
 * DTO: IsArray, ArrayMaxSize(10), IsString + MaxLength(32) each (400). Target behaviour (backend run
 * queued): the lead rule, fewer than 5 digits after canonicalisation, is 422 LEAD_PHONE_INVALID.
 * party-write.helper normalizedPhones: canonical values, empties dropped, a repeat is 422
 * PARTY_CONTACT_METHOD_REPEATED.
 */
function validateAndCleanPhones(phones: string[] | undefined, field: string): string[] {
  if (phones === undefined) return [];
  if (!Array.isArray(phones) || phones.length > CUSTOMER_LIMITS.phonesMax) throw validationFailed(field);
  for (const raw of phones) {
    if (typeof raw !== 'string' || raw.length > CUSTOMER_LIMITS.phoneMax) throw validationFailed(field);
  }
  for (const raw of phones) {
    if (raw.trim() && normalizePhoneValue(raw).replace(/\D/g, '').length < 5) {
      throw new ApiError(422, 'LEAD_PHONE_INVALID');
    }
  }
  const normalized = phones.map(normalizePhoneValue).filter(Boolean);
  if (new Set(normalized).size !== normalized.length) {
    throw new ApiError(422, 'PARTY_CONTACT_METHOD_REPEATED');
  }
  return normalized;
}

/** IsOptional + IsEmail + MaxLength(180): null/undefined skip (null clears), '' fails. */
function validateEmail(email: string | null | undefined, field: string): string | null {
  if (email === undefined || email === null) return null;
  if (typeof email !== 'string' || email.length > CUSTOMER_LIMITS.email || !EMAIL_RE.test(email)) {
    throw validationFailed(field);
  }
  return email;
}

/** Trimmed, then IsUrl(http/https, protocol required) + MaxLength(180); null clears. */
function validateWebsite(website: string | null | undefined, field: string): string | null {
  if (website === undefined || website === null) return null;
  const trimmed = typeof website === 'string' ? website.trim() : '';
  if (!trimmed || trimmed.length > CUSTOMER_LIMITS.website) throw validationFailed(field);
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw validationFailed(field);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw validationFailed(field);
  return trimmed;
}

function validateRatingAndColor(rating: unknown, cardColor: unknown): void {
  if (rating !== undefined) {
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 0 || rating > 3) {
      throw validationFailed('rating');
    }
  }
  if (cardColor !== undefined && cardColor !== null) {
    if (typeof cardColor !== 'string' || !(cardColor in CARD_COLORS)) {
      throw validationFailed('cardColor');
    }
  }
}

const ADDRESS_GEO_FIELDS = ['countryId', 'stateId', 'cityId', 'districtId'] as const;
type AddressGeoField = (typeof ADDRESS_GEO_FIELDS)[number];

function geoInvalid(field: AddressGeoField): ApiError {
  return new ApiError(422, 'LEAD_ADDRESS_GEO_INVALID', { field: [field] });
}

/**
 * party-address-geo resolveAddressGeography: an omitted level keeps the stored value, null clears it.
 * A child without its parent is 422 LEAD_ADDRESS_GEO_INCOMPLETE; an unknown place, a wrong parent or an
 * inactive country/state (or a newly chosen inactive city/district) is 422 LEAD_ADDRESS_GEO_INVALID.
 * Both carry details { field: ['<level>Id'] }.
 */
function validateAddress(addr: AddressBody | undefined, stored: CustomerAddress | null = null): CustomerAddress | null {
  if (addr === undefined) return stored;
  for (const key of ADDRESS_GEO_FIELDS) {
    const value = addr[key];
    if (value !== undefined && value !== null && (typeof value !== 'string' || !GEO_ID_RE.test(value))) {
      throw validationFailed(`address.${key}`);
    }
  }
  const ids = Object.fromEntries(
    ADDRESS_GEO_FIELDS.map((key) => [key, (addr[key] !== undefined ? addr[key] : stored?.[key]) ?? null]),
  ) as Record<AddressGeoField, string | null>;
  for (let level = 1; level < ADDRESS_GEO_FIELDS.length; level++) {
    const field = ADDRESS_GEO_FIELDS[level];
    if (ids[field] && !ids[ADDRESS_GEO_FIELDS[level - 1]]) {
      throw new ApiError(422, 'LEAD_ADDRESS_GEO_INCOMPLETE', { field: [field] });
    }
  }
  const unchanged = (field: AddressGeoField) => (stored?.[field] ?? null) === ids[field];
  if (ids.countryId) {
    const country = GEO_FAKE_DB.countries.find((c) => c.id === ids.countryId);
    if (!country || !country.isActive) throw geoInvalid('countryId');
  }
  if (ids.stateId) {
    const state = GEO_FAKE_DB.states.find((x) => x.id === ids.stateId);
    if (!state || state.countryId !== ids.countryId || !state.isActive) throw geoInvalid('stateId');
  }
  if (ids.cityId) {
    const city = GEO_FAKE_DB.cities.find((c) => c.id === ids.cityId);
    if (!city || city.stateId !== ids.stateId || (!city.isActive && !unchanged('cityId'))) throw geoInvalid('cityId');
  }
  if (ids.districtId) {
    const district = GEO_FAKE_DB.districts.find((d) => d.id === ids.districtId);
    if (!district || district.cityId !== ids.cityId || (!district.isActive && !unchanged('districtId'))) {
      throw geoInvalid('districtId');
    }
  }
  const text = (value: string | undefined, current: string | null | undefined): string | null =>
    value !== undefined ? value.trim() || null : (current ?? null);
  const street = text(addr.street1, stored?.street);
  const apartment = text(addr.street2, stored?.apartment);
  const buildingNo = text(addr.buildingNo, stored?.buildingNo);
  const floor = text(addr.floor, stored?.floor);
  const landmark = text(addr.landmark, stored?.landmark);
  const postalCode = text(addr.postalCode, stored?.postalCode);
  if (!Object.values(ids).some(Boolean) && ![street, apartment, buildingNo, floor, landmark, postalCode].some(Boolean)) {
    return null;
  }
  const built = buildAddressFromIds(ids.countryId, ids.stateId, ids.cityId, ids.districtId, street);
  return {
    ...built,
    country: addr.country !== undefined ? addr.country.trim() : built.country,
    city: addr.city !== undefined ? addr.city.trim() : built.city,
    area: addr.state !== undefined ? addr.state.trim() : built.area,
    apartment,
    buildingNo,
    floor,
    landmark,
    postalCode,
  };
}

/** party-write.helper personName (customer): fullName wins, else honorific + first + last, max 180. */
function personName(body: Pick<ContactPersonBody, 'fullName' | 'honorificTitle' | 'firstName' | 'lastName'>): string | null {
  const explicit = body.fullName?.trim();
  if (explicit) return explicit;
  const composed = [body.honorificTitle?.trim(), body.firstName?.trim(), body.lastName?.trim()].filter(Boolean).join(' ');
  return composed ? composed.slice(0, 180) : null;
}

/** CustomerProfileContactPersonDto field rules, reported under `prefix` (`contacts.0`, `primaryContact`, ...). */
function validateContactPerson(body: ContactPersonBody, prefix: string): void {
  if (body.fullName !== undefined && (typeof body.fullName !== 'string' || !body.fullName.trim())) {
    throw validationFailed(`${prefix}.fullName`);
  }
  assertMaxLen(body.fullName, CUSTOMER_LIMITS.contactFullName, `${prefix}.fullName`);
  assertMaxLen(body.firstName, CUSTOMER_LIMITS.contactFirstName, `${prefix}.firstName`);
  assertMaxLen(body.lastName, CUSTOMER_LIMITS.contactLastName, `${prefix}.lastName`);
  assertMaxLen(body.honorificTitle, CUSTOMER_LIMITS.honorificTitle, `${prefix}.honorificTitle`);
  assertMaxLen(body.jobTitle, CUSTOMER_LIMITS.jobTitle, `${prefix}.jobTitle`);
  if (body.email !== undefined) validateEmail(body.email, `${prefix}.email`);
  if (body.phones !== undefined) {
    if (!Array.isArray(body.phones) || body.phones.length > CUSTOMER_LIMITS.phonesMax) throw validationFailed(`${prefix}.phones`);
    if (body.phones.some((p) => typeof p !== 'string' || p.length > CUSTOMER_LIMITS.phoneMax)) {
      throw validationFailed(`${prefix}.phones`);
    }
  }
  if (body.contactMethods !== undefined) {
    if (!Array.isArray(body.contactMethods) || body.contactMethods.length > 20) throw validationFailed(`${prefix}.contactMethods`);
    body.contactMethods.forEach((method, index) => {
      const path = `${prefix}.contactMethods.${index}`;
      if (!['PHONE', 'MOBILE', 'EMAIL', 'WHATSAPP', 'WEBSITE', 'OTHER'].includes(method.methodType)) {
        throw validationFailed(`${path}.methodType`);
      }
      const value = typeof method.value === 'string' ? method.value : '';
      const valid =
        value.length > 0 &&
        value.length <= 255 &&
        (method.methodType === 'EMAIL'
          ? EMAIL_RE.test(value)
          : method.methodType === 'WEBSITE'
            ? /^https?:\/\/\S+$/i.test(value.trim())
            : method.methodType === 'OTHER'
              ? value.trim().length > 0
              : normalizePhoneValue(value).replace(/\D/g, '').length >= 5);
      if (!valid) throw validationFailed(`${path}.value`);
      assertMaxLen(method.label, 80, `${path}.label`);
    });
  }
}

const PHONE_METHOD_TYPES: ReadonlySet<string> = new Set(['PHONE', 'MOBILE', 'WHATSAPP']);

/**
 * The adapter stores contact.contactMethods next to phones/email, so the read
 * model shows them: phone-type methods join phones, the first EMAIL fills email.
 */
function withContactMethods(body: ContactPersonBody): ContactPersonBody {
  const methods = (body.contactMethods ?? []).filter((m) => m.value?.trim());
  if (methods.length === 0) return body;
  const methodPhones = methods.filter((m) => PHONE_METHOD_TYPES.has(m.methodType)).map((m) => m.value.trim());
  const methodEmail = methods.find((m) => m.methodType === 'EMAIL')?.value.trim();
  return {
    ...body,
    ...(methodPhones.length > 0 ? { phones: [...(body.phones ?? []), ...methodPhones] } : {}),
    ...(methodEmail && !body.email?.trim() ? { email: methodEmail } : {}),
  };
}

function buildContactView(rawBody: ContactPersonBody, existing?: CustomerContactView): CustomerContactView {
  const body = withContactMethods(rawBody);
  const changesName =
    body.firstName !== undefined || body.lastName !== undefined || body.fullName !== undefined || body.honorificTitle !== undefined;
  const firstName = body.firstName !== undefined ? body.firstName.trim() || null : (existing?.firstName ?? null);
  const lastName = body.lastName !== undefined ? body.lastName.trim() || null : (existing?.lastName ?? null);
  const honorificTitle =
    body.honorificTitle !== undefined ? body.honorificTitle.trim() || null : (existing?.honorificTitle ?? null);
  const displayName = changesName || !existing
    ? (personName({
        fullName: body.fullName,
        honorificTitle: honorificTitle ?? undefined,
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
      }) ?? existing?.displayName ?? '')
    : existing.displayName;

  return {
    partyId: existing?.partyId ?? body.contactPartyId ?? fakeId(),
    relationshipId: existing?.relationshipId ?? fakeId(),
    displayName,
    firstName,
    lastName,
    honorificTitle,
    jobTitle: body.jobTitle !== undefined ? body.jobTitle.trim() || null : (existing?.jobTitle ?? null),
    isPrimary: body.isPrimary ?? existing?.isPrimary ?? false,
    email: body.email !== undefined ? body.email : existing ? existing.email : null,
    phones:
      body.phones !== undefined
        ? validateAndCleanPhones(body.phones, 'contacts.phones')
        : existing
          ? [...existing.phones]
          : [],
  };
}

/** Every contact ends up with one primary: the flagged one, else the first (corporate-contact-change). */
function ensureOnePrimary(contacts: CustomerContactView[]): CustomerContactView[] {
  if (contacts.length > 0 && !contacts.some((c) => c.isPrimary)) contacts[0] = { ...contacts[0], isPrimary: true };
  return contacts;
}

/**
 * party-write.helper saveCorporateContacts + ensureCorporateContactsBatch: more than one primary is
 * 422 CUSTOMER_PROFILE_CONTACT_PRIMARY_INVALID, a new contact without a name 422
 * CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED, a repeated selected contact 409 PARTY_DUPLICATE_CONTACT.
 */
function validateAndBuildContacts(
  raw: ContactPersonBody[],
  existingContacts: CustomerContactView[] = [],
): CustomerContactView[] {
  if (raw.length === 0) return [];
  if (raw.filter((c) => c.isPrimary === true).length > 1) {
    throw new ApiError(422, 'CUSTOMER_PROFILE_CONTACT_PRIMARY_INVALID');
  }
  for (const contact of raw) {
    if (!contact.contactPartyId && !personName(contact)) {
      throw new ApiError(422, 'CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED');
    }
  }
  const selected = raw.flatMap((c) => (c.contactPartyId ? [c.contactPartyId.toLowerCase()] : []));
  if (new Set(selected).size !== selected.length) throw new ApiError(409, 'PARTY_DUPLICATE_CONTACT');
  const existingById = new Map(existingContacts.map((c) => [c.partyId, c]));
  for (const id of selected) {
    if (!existingById.has(id) && !CUSTOMERS_FAKE_DB.some((c) => c.contacts.some((ct) => ct.partyId === id))) {
      throw new ApiError(404, 'PARTY_NOT_FOUND');
    }
  }
  const built = raw.map((item) =>
    buildContactView(item, item.contactPartyId ? existingById.get(item.contactPartyId.toLowerCase()) : undefined),
  );
  return ensureOnePrimary(built);
}

/** common/corporate-contact-change applyCorporateContactChange. */
function applyContactChange(
  existingContacts: CustomerContactView[],
  change: ContactChangeBody,
): CustomerContactView[] {
  const targetId = (change.op === 'ADD' ? change.contact.contactPartyId : change.contactPartyId)?.toLowerCase();
  const index = existingContacts.findIndex((c) => c.partyId === targetId);
  if (change.op !== 'ADD' && index === -1) throw new ApiError(404, 'CRM_CONTACT_NOT_LINKED');
  let contacts = existingContacts.map((c) => ({ ...c, phones: [...c.phones] }));
  switch (change.op) {
    case 'ADD': {
      if (index !== -1) throw new ApiError(409, 'PARTY_DUPLICATE_CONTACT');
      if (existingContacts.length >= CUSTOMER_LIMITS.contactsMax) throw new ApiError(409, 'PARTY_CONTACT_LIMIT_EXCEEDED');
      if (!change.contact.contactPartyId && !personName(change.contact)) {
        throw new ApiError(422, 'CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED');
      }
      const added = buildContactView({ ...change.contact, isPrimary: change.contact.isPrimary === true });
      if (added.isPrimary) contacts = contacts.map((c) => ({ ...c, isPrimary: false }));
      contacts.push(added);
      break;
    }
    case 'UPDATE': {
      if (change.contact.contactPartyId && change.contact.contactPartyId.toLowerCase() !== targetId) {
        throw new ApiError(409, 'PARTY_CONTACT_INVALID');
      }
      const updated = buildContactView(change.contact, contacts[index]);
      contacts[index] = updated;
      if (change.contact.isPrimary === true) {
        contacts = contacts.map((c, i) => ({ ...c, isPrimary: i === index }));
      }
      break;
    }
    case 'REMOVE':
      contacts.splice(index, 1);
      break;
    case 'SET_PRIMARY':
      contacts = contacts.map((c) => ({ ...c, isPrimary: c.partyId === targetId }));
      break;
  }
  return ensureOnePrimary(contacts);
}

function primaryContactFromList(contacts: readonly CustomerContactView[]): PrimaryContactView | null {
  if (contacts.length === 0) return null;
  const primary = contacts.find((c) => c.isPrimary) ?? contacts[0];
  return {
    partyId: primary.partyId,
    displayName: primary.displayName,
    jobTitle: primary.jobTitle,
    isPrimary: primary.isPrimary,
    email: primary.email,
    phones: [...primary.phones],
  };
}

/**
 * RequirePermissions + branch guard: no create/update/delete grant in the branch at all is
 * 403 BRANCH_PERMISSION_DENIED (before the body is validated).
 */
function assertBranchPermission(branchId: string, operation: 'create' | 'update' | 'delete'): void {
  if (!(CAPABILITIES_BY_BRANCH[branchId]?.customerProfiles[operation] ?? null)) {
    throw new ApiError(403, 'BRANCH_PERMISSION_DENIED');
  }
}

/** CrmScopedAccessService.assertOwnerAccess: a record outside the own/team owner set is 403 CRM_SCOPED_PERMISSION_DENIED. */
function assertOwnerAccess(branchId: string, operation: 'update' | 'delete', recordOwnerId: string | null): void {
  const cap = CAPABILITIES_BY_BRANCH[branchId]?.customerProfiles[operation] ?? null;
  if (!cap || (cap.ownerUserIds && (!recordOwnerId || !cap.ownerUserIds.includes(recordOwnerId)))) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }
}

/** resolveAssignableOwner: the owner must be assignable in the branch and inside the actor's scope (403). */
function resolveOwner(branchId: string, ownerUserId: string, operation: 'create' | 'update'): OwnerSummary {
  const allowedInBranch = BRANCH_OWNER_IDS[branchId] ?? [];
  if (!allowedInBranch.includes(ownerUserId)) throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  const cap = CAPABILITIES_BY_BRANCH[branchId]?.customerProfiles[operation] ?? null;
  if (!cap) throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  if (cap.ownerUserIds && !cap.ownerUserIds.includes(ownerUserId)) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }
  const owner = OWNER_RECORDS[ownerUserId];
  if (!owner) throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  return {
    userId: owner.id,
    firstName: owner.firstName,
    lastName: owner.lastName,
    avatarUrl: owner.avatarUrl,
  };
}

async function loadAvailableSources(): Promise<SourceOption[]> {
  try {
    const loaded = await listLeadSources();
    return loaded.map((s) => ({
      id: s.id,
      nameEn: s.nameEn,
      nameAr: s.nameAr,
      isActive: s.isActive,
      iconUrl: s.iconUrl,
    }));
  } catch {
    return clone(FALLBACK_SOURCES);
  }
}

async function loadAvailableTags(): Promise<TagSummary[]> {
  try {
    const loaded = await listSettingsTags();
    return loaded.map((t) => ({
      id: t.id,
      name: t.name,
      backgroundColor: t.backgroundColor ?? null,
      textColor: t.textColor ?? null,
    }));
  } catch {
    return clone(FALLBACK_TAGS);
  }
}

/** tags.service resolveLiveTagsForAssignment: any unknown id is 422 CRM_TAG_UNKNOWN { tagIds: [unknown] }. */
async function resolveTagsByIds(tagIds: string[] | undefined): Promise<TagSummary[]> {
  if (!tagIds || tagIds.length === 0) return [];
  const available = await loadAvailableTags();
  const byId = new Map(available.map((t) => [t.id, t]));
  const unknown = tagIds.filter((id) => !byId.has(id));
  if (unknown.length > 0) throw new ApiError(422, 'CRM_TAG_UNKNOWN', { tagIds: unknown });
  return tagIds.map((id) => ({ ...byId.get(id)! }));
}

function sortTagsByName<T extends TagSummary>(tags: T[]): T[] {
  return [...tags].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

const FAKE_TAG_TIMESTAMP = '2026-01-01T00:00:00.000Z';

/** tags.service toView: the tag endpoints return TagView (with timestamps), ordered by name. */
async function toTagViews(tags: TagSummary[]): Promise<TagView[]> {
  let catalogue: { id: string; createdAt?: string; updatedAt?: string }[] = [];
  try {
    catalogue = await listSettingsTags();
  } catch {
    catalogue = [];
  }
  const byId = new Map(catalogue.map((t) => [t.id, t]));
  return sortTagsByName(tags).map((t) => ({
    ...t,
    createdAt: byId.get(t.id)?.createdAt ?? FAKE_TAG_TIMESTAMP,
    updatedAt: byId.get(t.id)?.updatedAt ?? FAKE_TAG_TIMESTAMP,
  }));
}

function hasCorporateFields(body: {
  companyName?: string;
  legalName?: string | null;
  taxNumber?: string | null;
  commercialRegistrationNumber?: string | null;
  companyPhones?: string[];
  companyEmail?: string | null;
  companyWebsite?: string | null;
}): boolean {
  return (
    body.companyName !== undefined ||
    body.legalName !== undefined ||
    body.taxNumber !== undefined ||
    body.commercialRegistrationNumber !== undefined ||
    body.companyPhones !== undefined ||
    body.companyEmail !== undefined ||
    body.companyWebsite !== undefined
  );
}

function nextUpdatedTimestamp(prevIso?: string): string {
  const prevMs = prevIso ? Date.parse(prevIso) : 0;
  const nextMs = Math.max(Date.now(), (Number.isNaN(prevMs) ? 0 : prevMs) + 1);
  return new Date(nextMs).toISOString();
}

/**
 * DTO: status must be a CustomerStatusEnum value. Target behaviour (backend run queued): ACTIVE_CUSTOMER
 * passes the DTO and the service answers it with 422 CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON.
 */
function assertStatusShape(status: unknown): void {
  if (status !== undefined && (typeof status !== 'string' || !CUSTOMER_STATUSES.includes(status as CustomerStatus))) {
    throw validationFailed('status');
  }
}

/**
 * assertManualStatusChange: ACTIVE_CUSTOMER is 422 CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON; a real change
 * needs crm.customer_profiles.status.manage (403).
 */
function assertStatusChangeAllowed(nextStatus: CustomerStatus | undefined, currentStatus: CustomerStatus): void {
  if (nextStatus === 'ACTIVE_CUSTOMER') throw new ApiError(422, 'CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON');
  if (nextStatus === undefined || nextStatus === currentStatus) return;
  if (!fakeCanManageStatus()) throw new ApiError(403, 'CUSTOMER_PROFILE_STATUS_MANAGE_REQUIRED');
}

/** POST /api/tenant/crm/v1/customer-profiles/board */
export async function fakeLoadBoard(body: CustomerSearchBody): Promise<BoardResponse & { counts: StatusCounts }> {
  await customerDelay();
  assertBranchContext(body.branchId);
  validateSearchBody(body, true);
  const filtered = sortCustomers(filterCustomersWithoutStatus(body), body.sort);
  const statuses: BoardLane[] = CUSTOMER_STATUS_ORDER.map((status) => ({
    status,
    ...pageOf(filtered.filter((c) => c.status === status).map(toBoardItem), 1, CUSTOMER_BOARD_LIMIT),
  }));
  return { counts: computeCounts(filtered), statuses };
}

/** POST /api/tenant/crm/v1/customer-profiles/board/statuses/:status */
export async function fakeLoadStatusPage(
  status: CustomerStatus,
  body: CustomerSearchBody,
  page: number,
): Promise<BoardLane> {
  await customerDelay();
  assertBranchContext(body.branchId);
  if (!CUSTOMER_STATUSES.includes(status)) throw validationFailed('status');
  const request = { ...body, page };
  validateSearchBody(request, true);
  const filtered = sortCustomers(filterCustomersWithoutStatus(request), request.sort);
  return {
    status,
    ...pageOf(filtered.filter((c) => c.status === status).map(toBoardItem), page, CUSTOMER_BOARD_LIMIT),
  };
}

/** POST /api/tenant/crm/v1/customer-profiles/search (SearchManyDto: limit 1..100). */
export function fakeSearchCustomerProfiles(
  body: CustomerSearchBody,
  page = body.page ?? 1,
  limit = body.limit ?? CUSTOMER_LIST_LIMIT,
): Promise<SearchResponse> {
  return searchCustomerRows(body, page, limit, 100);
}

/**
 * The same scoped query for other server-side fakes (the bulk selection preview reads up to
 * 10,000 rows through it, as POST /customer-profiles/selection does). The UI goes through
 * fakeSearchCustomerProfiles.
 */
export function fakeSearchCustomers(
  body: CustomerSearchBody,
  page = body.page ?? 1,
  limit = body.limit ?? CUSTOMER_LIST_LIMIT,
): Promise<SearchResponse> {
  return searchCustomerRows(body, page, limit, 10_000);
}

async function searchCustomerRows(
  body: CustomerSearchBody,
  page: number,
  limit: number,
  maxLimit: number,
): Promise<SearchResponse> {
  await customerDelay();
  assertBranchContext(body.branchId);
  const request = { ...body, page, limit };
  validateSearchBody(request, false, maxLimit);
  const filteredNoStatus = sortCustomers(filterCustomersWithoutStatus(request), request.sort);
  const matched = request.status ? filteredNoStatus.filter((c) => c.status === request.status) : filteredNoStatus;
  const paged = pageOf(matched.map(toRow), page, limit);
  return request.includeStatusCounts ? { ...paged, counts: computeCounts(filteredNoStatus) } : paged;
}

/** GET /api/tenant/crm/v1/customer-profiles/:id */
export async function fakeGetCustomer(id: string): Promise<CustomerDetail> {
  await customerDelay();
  return clone(CUSTOMERS_FAKE_DB[findCustomerIndexOrThrow(id)]);
}

const EXPECTED_UPDATED_AT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function assertOptionalText(value: unknown, max: number, field: string, { notEmpty = false, nullable = false } = {}): void {
  if (value === undefined || (nullable && value === null)) return;
  if (typeof value !== 'string' || (notEmpty && value === '') || value.length > max) throw validationFailed(field);
}

function assertOptionalId(value: unknown, field: string, nullable: boolean): void {
  if (value === undefined || (nullable && value === null)) return;
  if (typeof value !== 'string' || !value.trim()) throw validationFailed(field);
}

function validateContactsShape(contacts: unknown, field: string): void {
  if (contacts === undefined) return;
  if (!Array.isArray(contacts) || contacts.length > CUSTOMER_LIMITS.contactsMax) throw validationFailed(field);
  contacts.forEach((contact: ContactPersonBody, index) => validateContactPerson(contact, `${field}.${index}`));
}

function validateTagIdsShape(tagIds: unknown, field: string, requireNonEmpty: boolean): void {
  if (tagIds === undefined) return;
  if (
    !Array.isArray(tagIds) ||
    (requireNonEmpty && tagIds.length === 0) ||
    tagIds.length > MAX_TAGS_PER_ATTACH ||
    new Set(tagIds).size !== tagIds.length ||
    tagIds.some((id) => typeof id !== 'string' || !id)
  ) {
    throw validationFailed(field);
  }
}

/** Fields CreateCustomerProfileDto and UpdateCustomerProfileDto validate the same way. */
function validateCommonShape(body: CreateCustomerBody | UpdateCustomerBody, nullable: boolean): void {
  assertStatusShape(body.status);
  assertOptionalText(body.displayName, CUSTOMER_LIMITS.displayName, 'displayName', { notEmpty: true });
  assertOptionalText(body.legalName, CUSTOMER_LIMITS.legalName, 'legalName', { nullable });
  assertOptionalText(body.companyName, CUSTOMER_LIMITS.companyName, 'companyName', { notEmpty: true });
  assertOptionalText(body.taxNumber, CUSTOMER_LIMITS.taxNumber, 'taxNumber', { nullable });
  assertOptionalText(body.commercialRegistrationNumber, CUSTOMER_LIMITS.commercialRegistrationNumber, 'commercialRegistrationNumber', { nullable });
  assertOptionalText(body.description, CUSTOMER_LIMITS.description, 'description');
  assertOptionalId(body.ownerUserId, 'ownerUserId', false);
  assertOptionalId(body.acquisitionSourceId, 'acquisitionSourceId', true);
  validateRatingAndColor(body.rating, body.cardColor);
  if (body.companyPhones !== undefined) {
    if (!Array.isArray(body.companyPhones) || body.companyPhones.length > CUSTOMER_LIMITS.phonesMax) throw validationFailed('companyPhones');
    if (body.companyPhones.some((p) => typeof p !== 'string' || p.length > CUSTOMER_LIMITS.phoneMax)) throw validationFailed('companyPhones');
  }
  if (body.companyEmail !== undefined && body.companyEmail !== null) validateEmail(body.companyEmail, 'companyEmail');
  if (body.companyWebsite !== undefined && body.companyWebsite !== null) validateWebsite(body.companyWebsite, 'companyWebsite');
  if (body.primaryContact !== undefined) validateContactPerson(body.primaryContact, 'primaryContact');
  validateContactsShape(body.contacts, 'contacts');
  if (body.address !== undefined && (typeof body.address !== 'object' || body.address === null)) throw validationFailed('address');
  if (body.customFields !== undefined && (typeof body.customFields !== 'object' || body.customFields === null)) {
    throw validationFailed('customFields');
  }
}

function validateContactChangeShape(change: ContactChangeBody | undefined): void {
  if (change === undefined) return;
  if (typeof change !== 'object' || change === null) throw validationFailed('contactChange');
  const raw = change as { op?: string; contactPartyId?: string; contact?: ContactPersonBody };
  if (!['ADD', 'UPDATE', 'REMOVE', 'SET_PRIMARY'].includes(raw.op ?? '')) throw validationFailed('contactChange.op');
  const shapeOk =
    (raw.op !== 'ADD' || raw.contactPartyId === undefined) &&
    (!['REMOVE', 'SET_PRIMARY'].includes(raw.op!) || raw.contact === undefined) &&
    (raw.op !== 'UPDATE' ||
      !raw.contact?.contactPartyId ||
      raw.contact.contactPartyId.toLowerCase() === raw.contactPartyId?.toLowerCase());
  if (!shapeOk) throw validationFailed('contactChange.op');
  if (raw.op !== 'ADD' && (typeof raw.contactPartyId !== 'string' || !raw.contactPartyId)) {
    throw validationFailed('contactChange.contactPartyId');
  }
  if (raw.op === 'ADD' || raw.op === 'UPDATE') {
    if (typeof raw.contact !== 'object' || raw.contact === null) throw validationFailed('contactChange.contact');
    validateContactPerson(raw.contact, 'contactChange.contact');
  }
}

/** acquisitionSources.assertAssignable: unknown 404, retired 422 CRM_ACQUISITION_SOURCE_INACTIVE. */
async function resolveSource(sourceId: string): Promise<{ source: SourceSummary; iconUrl: string | null }> {
  const sources = await loadAvailableSources();
  const found = sources.find((s) => s.id === sourceId);
  if (!found) throw new ApiError(404, 'CRM_ACQUISITION_SOURCE_NOT_FOUND');
  if (!found.isActive) throw new ApiError(422, 'CRM_ACQUISITION_SOURCE_INACTIVE');
  return {
    source: { id: found.id, nameEn: found.nameEn, nameAr: found.nameAr, isActive: found.isActive },
    iconUrl: found.iconUrl,
  };
}

function trimOrNull(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

/**
 * POST /api/tenant/crm/v1/customer-profiles. Check order follows the controller and
 * CustomerProfilesService.create: branch guard, permission guard, DTO validation, corporate-only
 * fields, assignable owner, display name, status governance, source, Party (geo, email/website
 * duplicates), tags, phones, corporate contacts.
 */
export async function fakeCreateCustomer(
  body: CreateCustomerBody,
  idempotencyKey: string,
): Promise<CustomerDetail> {
  await customerDelay();

  if (!idempotencyKey || !UUID_RE.test(idempotencyKey)) {
    throw new ApiError(400, 'GW.IDEM.MISSING');
  }
  const bodyKey = canonicalJson(body);
  const cached = idempotencyStore.get(idempotencyKey);
  if (cached) {
    if (cached.bodyKey !== bodyKey) {
      throw new ApiError(422, 'GW.IDEM.MISMATCH');
    }
    return clone(cached.result);
  }

  const branchId = assertBranchContext(body.branchId);
  assertBranchPermission(branchId, 'create');

  if (body.profileType !== 'INDIVIDUAL' && body.profileType !== 'CORPORATE') {
    throw validationFailed('profileType');
  }
  validateCommonShape(body, false);
  validateTagIdsShape(body.tagIds, 'tagIds', false);

  const isCorporate = body.profileType === 'CORPORATE';
  if (!isCorporate && (hasCorporateFields(body) || body.contacts !== undefined)) {
    throw new ApiError(422, 'CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN');
  }
  if (isCorporate && body.primaryContact !== undefined && body.contacts !== undefined) {
    throw new ApiError(422, 'CUSTOMER_PROFILE_PRIMARY_CONTACT_FORBIDDEN');
  }

  const owner = resolveOwner(branchId, body.ownerUserId ?? FAKE_CURRENT_USER_ID, 'create');

  const displayName =
    body.displayName?.trim() ||
    (isCorporate ? body.companyName?.trim() || null : personName(body.primaryContact ?? {}));
  if (!displayName) throw new ApiError(422, 'CUSTOMER_PROFILE_DISPLAY_NAME_REQUIRED');

  const status: CustomerStatus = body.status ?? 'PROSPECT';
  assertStatusChangeAllowed(status, 'PROSPECT');

  const resolvedSource = body.acquisitionSourceId ? await resolveSource(body.acquisitionSourceId) : null;

  const address = validateAddress(body.address);
  const person = !isCorporate && body.primaryContact ? withContactMethods(body.primaryContact) : undefined;
  const email = isCorporate ? (body.companyEmail ?? null) : (person?.email ?? null);
  assertContactMethodsAllowed(branchId, owner.userId, { phones: [], emails: [email] });

  const tags = await resolveTagsByIds(body.tagIds);

  const phones = isCorporate
    ? validateAndCleanPhones(body.companyPhones, 'companyPhones')
    : validateAndCleanPhones(person?.phones, 'primaryContact.phones');
  assertContactMethodsAllowed(branchId, owner.userId, { phones, emails: [] });

  let contacts: CustomerContactView[] = [];
  if (isCorporate) {
    const input = body.contacts ?? (body.primaryContact ? [{ ...body.primaryContact, isPrimary: true }] : []);
    contacts = validateAndBuildContacts(input);
    assertContactMethodsAllowed(branchId, owner.userId, {
      phones: contacts.flatMap((c) => c.phones),
      emails: contacts.map((c) => c.email),
    });
  }
  const primaryContact = isCorporate ? primaryContactFromList(contacts) : null;
  const companyName = isCorporate ? body.companyName ?? displayName : null;
  const now = nextUpdatedTimestamp();

  const created = finalizeCustomer({
    id: fakeId(),
    branchId,
    partyId: fakeId(),
    profileType: body.profileType,
    status,
    rating: body.rating ?? 0,
    cardColor: body.cardColor ?? null,
    displayName,
    companyName,
    primaryContactName: primaryContact?.displayName ?? null,
    tags: sortTagsByName(tags),
    ownerUserId: owner.userId,
    owner,
    acquisitionSource: resolvedSource?.source ?? null,
    acquisitionSourceIconUrl: resolvedSource?.iconUrl ?? null,
    nextActivity: null,
    createdAt: now,
    updatedAt: now,
    sourceLeadId: null,
    acquisitionSourceId: resolvedSource?.source.id ?? null,
    description: body.description ?? null,
    firstName: isCorporate ? null : trimOrNull(person?.firstName),
    lastName: isCorporate ? null : trimOrNull(person?.lastName),
    honorificTitle: isCorporate ? null : trimOrNull(person?.honorificTitle),
    primaryMobile: isCorporate ? null : (phones[0] ?? null),
    email,
    companyPhone: isCorporate ? (phones[0] ?? null) : null,
    companyEmail: email,
    companyWebsite: isCorporate ? validateWebsite(body.companyWebsite, 'companyWebsite') : null,
    phones,
    address,
    cityId: address?.cityId ?? null,
    cityName: address?.cityName ?? null,
    primaryContact,
    contacts,
    customFields: body.customFields ? clone(body.customFields) : {},
    legalName: isCorporate ? (body.legalName ?? companyName) : null,
    taxNumber: isCorporate ? trimOrNull(body.taxNumber) : null,
    commercialRegistrationNumber: isCorporate ? trimOrNull(body.commercialRegistrationNumber) : null,
  });

  CUSTOMERS_FAKE_DB.unshift(created);
  idempotencyStore.set(idempotencyKey, { bodyKey, result: clone(created) });
  return clone(created);
}

/**
 * PATCH /api/tenant/crm/v1/customer-profiles/:id. Check order follows CustomerProfilesService.update:
 * record branch guard, permission guard, DTO validation, contactChange/contacts exclusivity (400),
 * owner scope (403), corporate-only fields (422), status governance (403), assignable owner (403),
 * then the expectedUpdatedAt fence (409), source, Party, phones, contacts and custom fields.
 */
export async function fakePatchCustomer(id: string, body: UpdateCustomerBody): Promise<CustomerDetail> {
  await customerDelay();

  const index = findCustomerIndexOrThrow(id);
  const existing = CUSTOMERS_FAKE_DB[index];
  assertBranchPermission(existing.branchId, 'update');

  if (body.expectedUpdatedAt !== undefined && (typeof body.expectedUpdatedAt !== 'string' || !EXPECTED_UPDATED_AT_RE.test(body.expectedUpdatedAt))) {
    throw validationFailed('expectedUpdatedAt');
  }
  validateCommonShape(body, true);
  validateContactChangeShape(body.contactChange);

  if (body.contactChange !== undefined && body.contacts !== undefined) {
    throw new ApiError(400, 'CRM_CONTACT_CHANGE_CONFLICT');
  }
  assertOwnerAccess(existing.branchId, 'update', existing.ownerUserId);

  const isCorporate = existing.profileType === 'CORPORATE';
  if (!isCorporate && (hasCorporateFields(body) || body.contacts !== undefined || body.contactChange !== undefined)) {
    throw new ApiError(422, 'CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN');
  }
  if (isCorporate && body.primaryContact !== undefined) {
    throw new ApiError(422, 'CUSTOMER_PROFILE_PRIMARY_CONTACT_FORBIDDEN');
  }

  assertStatusChangeAllowed(body.status, existing.status);
  const nextOwner = body.ownerUserId !== undefined ? resolveOwner(existing.branchId, body.ownerUserId, 'update') : existing.owner;

  if (FAKE_CONFLICT_NEXT_PATCH) {
    FAKE_CONFLICT_NEXT_PATCH = false;
    throw new ApiError(409, 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE');
  }
  if (body.expectedUpdatedAt !== undefined && Date.parse(body.expectedUpdatedAt) !== Date.parse(existing.updatedAt)) {
    throw new ApiError(409, 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE');
  }

  let nextSource = existing.acquisitionSource;
  let nextSourceIconUrl = existing.acquisitionSourceIconUrl;
  let nextSourceId = existing.acquisitionSourceId;
  if (body.acquisitionSourceId !== undefined) {
    nextSourceId = body.acquisitionSourceId;
    if (body.acquisitionSourceId && body.acquisitionSourceId !== existing.acquisitionSourceId) {
      const resolved = await resolveSource(body.acquisitionSourceId);
      nextSource = resolved.source;
      nextSourceIconUrl = resolved.iconUrl;
    } else if (!body.acquisitionSourceId) {
      nextSource = null;
      nextSourceIconUrl = null;
    }
  }

  const next: CustomerDetail = {
    ...existing,
    contacts: existing.contacts.map((c) => ({ ...c, phones: [...c.phones] })),
    phones: [...existing.phones],
  };
  // ensureParty keeps the Party display name unless displayName is sent (companyName/person name do not rename it).
  if (body.displayName !== undefined) next.displayName = body.displayName.trim() || existing.displayName;
  next.address = validateAddress(body.address, existing.address);

  if (isCorporate) {
    if (body.companyName !== undefined) next.companyName = body.companyName;
    if (body.legalName !== undefined) next.legalName = body.legalName;
    if (body.taxNumber !== undefined) next.taxNumber = trimOrNull(body.taxNumber);
    if (body.commercialRegistrationNumber !== undefined) next.commercialRegistrationNumber = trimOrNull(body.commercialRegistrationNumber);
    if (body.companyEmail !== undefined) next.companyEmail = body.companyEmail;
    if (body.companyWebsite !== undefined) next.companyWebsite = validateWebsite(body.companyWebsite, 'companyWebsite');
    if (body.companyPhones !== undefined) {
      next.phones = validateAndCleanPhones(body.companyPhones, 'companyPhones');
      next.companyPhone = next.phones[0] ?? null;
    }
    if (body.contactChange !== undefined) {
      next.contacts = applyContactChange(next.contacts, body.contactChange);
    } else if (body.contacts !== undefined) {
      next.contacts = validateAndBuildContacts(body.contacts, existing.contacts);
    }
  } else if (body.primaryContact !== undefined) {
    const person = withContactMethods(body.primaryContact);
    if (person.firstName !== undefined) next.firstName = trimOrNull(person.firstName);
    if (person.lastName !== undefined) next.lastName = trimOrNull(person.lastName);
    if (person.honorificTitle !== undefined) next.honorificTitle = trimOrNull(person.honorificTitle);
    if (person.email !== undefined) next.email = person.email;
    if (person.phones !== undefined) {
      next.phones = validateAndCleanPhones(person.phones, 'primaryContact.phones');
      next.primaryMobile = next.phones[0] ?? null;
    }
  }
  if (isCorporate) next.email = next.companyEmail;
  else next.companyEmail = next.email;

  const knownPhones = new Set([...existing.phones, ...existing.contacts.flatMap((c) => c.phones)].map(normalizeDigits));
  const knownEmails = new Set(
    [existing.email, existing.companyEmail, ...existing.contacts.map((c) => c.email)]
      .filter((e): e is string => !!e)
      .map((e) => e.trim().toLowerCase()),
  );
  assertContactMethodsAllowed(
    existing.branchId,
    nextOwner?.userId ?? null,
    {
      phones: [...next.phones, ...next.contacts.flatMap((c) => c.phones)].filter((p) => !knownPhones.has(normalizeDigits(p))),
      emails: [next.email, ...next.contacts.map((c) => c.email)].filter(
        (e) => !!e && !knownEmails.has(e.trim().toLowerCase()),
      ),
    },
    existing.partyId,
  );

  const nextCustomFields: Record<string, unknown> = { ...existing.customFields };
  if (body.customFields !== undefined) {
    for (const [k, v] of Object.entries(body.customFields)) {
      if (v === null || v === undefined) delete nextCustomFields[k];
      else nextCustomFields[k] = v;
    }
  }

  const nextPrimaryContact = isCorporate ? primaryContactFromList(next.contacts) : null;
  const updated = finalizeCustomer({
    ...next,
    status: body.status ?? existing.status,
    rating: body.rating ?? existing.rating,
    cardColor: body.cardColor !== undefined ? body.cardColor : existing.cardColor,
    ownerUserId: nextOwner?.userId ?? null,
    owner: nextOwner,
    acquisitionSourceId: nextSourceId,
    acquisitionSource: nextSource,
    acquisitionSourceIconUrl: nextSourceIconUrl,
    description: body.description !== undefined ? body.description : existing.description,
    cityId: next.address?.cityId ?? null,
    cityName: next.address?.cityName ? { ...next.address.cityName } : null,
    primaryContact: nextPrimaryContact,
    primaryContactName: nextPrimaryContact?.displayName ?? null,
    customFields: nextCustomFields,
    updatedAt: nextUpdatedTimestamp(existing.updatedAt),
  });

  CUSTOMERS_FAKE_DB[index] = updated;
  return clone(updated);
}

/** PATCH /api/tenant/crm/v1/customer-profiles/:id { rating } (the same route and checks as any PATCH). */
export async function fakeSetCustomerRating(id: string, rating: number): Promise<CustomerDetail> {
  return fakePatchCustomer(id, { rating });
}

/** PATCH /api/tenant/crm/v1/customer-profiles/:id { cardColor } (the same route and checks as any PATCH). */
export async function fakeSetCustomerColor(id: string, cardColor: CardColor | null): Promise<CustomerDetail> {
  return fakePatchCustomer(id, { cardColor });
}

/** PATCH /api/tenant/crm/v1/customer-profiles/:id { status, expectedUpdatedAt } */
export async function fakeSetCustomerStatus(
  id: string,
  status: CustomerStatus,
  expectedUpdatedAt?: string,
): Promise<CustomerDetail> {
  return fakePatchCustomer(id, {
    status: status as UpdateCustomerBody['status'],
    ...(expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}),
  });
}

/** PATCH /api/tenant/crm/v1/customer-profiles/:id { contactChange, expectedUpdatedAt } */
export async function fakeChangeCustomerContact(
  id: string,
  contactChange: ContactChangeBody,
  expectedUpdatedAt?: string,
): Promise<CustomerDetail> {
  return fakePatchCustomer(id, {
    contactChange,
    ...(expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}),
  });
}

/**
 * DELETE /api/tenant/crm/v1/customer-profiles/:id (204). Record guard, permission guard,
 * DeleteRecordDto (reason <= 1000), owner scope, then 409 BLACKLISTED / HAS_ACTIVE_OPPORTUNITIES.
 */
export async function fakeDeleteCustomer(id: string, reason?: string): Promise<void> {
  await customerDelay();
  const index = findCustomerIndexOrThrow(id);
  const existing = CUSTOMERS_FAKE_DB[index];
  assertBranchPermission(existing.branchId, 'delete');
  if (reason !== undefined && (typeof reason !== 'string' || reason.trim().length > 1000)) throw validationFailed('reason');
  assertOwnerAccess(existing.branchId, 'delete', existing.ownerUserId);

  if (existing.status === 'BLACKLISTED') {
    throw new ApiError(409, 'CUSTOMER_PROFILE_BLACKLISTED');
  }
  if ((FAKE_OPEN_OPPORTUNITY_COUNT.get(id) ?? 0) > 0) {
    throw new ApiError(409, 'CUSTOMER_PROFILE_HAS_ACTIVE_OPPORTUNITIES');
  }
  CUSTOMERS_FAKE_DB.splice(index, 1);
}

/** GET /api/tenant/crm/v1/customer-profiles/:id/tags -> TagView[] ordered by name. */
export async function fakeListCustomerTags(id: string): Promise<TagView[]> {
  await customerDelay();
  return toTagViews(CUSTOMERS_FAKE_DB[findCustomerIndexOrThrow(id)].tags);
}

/**
 * POST /api/tenant/crm/v1/customer-profiles/:id/tags (201) -> every tag on the record, by name.
 * Unknown ids 422 CRM_TAG_UNKNOWN { tagIds }, then already attached 409 CRM_RECORD_TAG_ALREADY_ATTACHED { tagIds }.
 */
export async function fakeAttachCustomerTags(id: string, tagIds: string[]): Promise<TagView[]> {
  await customerDelay();
  const index = findCustomerIndexOrThrow(id);
  const existing = CUSTOMERS_FAKE_DB[index];
  assertBranchPermission(existing.branchId, 'update');
  validateTagIdsShape(tagIds, 'tagIds', true);
  if (tagIds === undefined) throw validationFailed('tagIds');
  assertOwnerAccess(existing.branchId, 'update', existing.ownerUserId);

  const added = await resolveTagsByIds(tagIds);
  const attachedIds = new Set(existing.tags.map((t) => t.id));
  const duplicates = tagIds.filter((tagId) => attachedIds.has(tagId));
  if (duplicates.length > 0) throw new ApiError(409, 'CRM_RECORD_TAG_ALREADY_ATTACHED', { tagIds: duplicates });

  const nextTags = sortTagsByName([...existing.tags, ...added]);
  CUSTOMERS_FAKE_DB[index] = { ...existing, tags: nextTags };
  return toTagViews(nextTags);
}

/** DELETE /api/tenant/crm/v1/customer-profiles/:id/tags/:tagId (204); not attached 404 CRM_RECORD_TAG_NOT_FOUND. */
export async function fakeDetachCustomerTag(id: string, tagId: string): Promise<void> {
  await customerDelay();
  const index = findCustomerIndexOrThrow(id);
  const existing = CUSTOMERS_FAKE_DB[index];
  assertBranchPermission(existing.branchId, 'update');
  assertOwnerAccess(existing.branchId, 'update', existing.ownerUserId);

  if (!existing.tags.some((t) => t.id === tagId)) {
    throw new ApiError(404, 'CRM_RECORD_TAG_NOT_FOUND');
  }
  CUSTOMERS_FAKE_DB[index] = { ...existing, tags: existing.tags.filter((t) => t.id !== tagId) };
}

/**
 * GET /api/tenant/crm/v1/customer-profiles/capabilities?branchId= (AuthenticatedOnly + branch guard):
 * a branch the user holds no grant in is 403 BRANCH_ACCESS_DENIED; null actions are unavailable.
 */
export async function fakeGetCustomerCapabilities(branchId: string): Promise<CustomerCapabilities> {
  await customerDelay();
  assertBranchContext(branchId, 'BRANCH_ACCESS_DENIED');
  const found = CAPABILITIES_BY_BRANCH[branchId];
  if (!found) {
    return {
      branchId,
      customerProfiles: { create: null, update: null, delete: null },
    };
  }
  return clone(found);
}

/** GET /api/tenant/crm/v1/custom-fields?ownerType=CUSTOMER_PROFILE */
export async function fakeListCustomerCustomFields(): Promise<CustomerCustomField[]> {
  await customerDelay();
  return clone([...CUSTOMER_CUSTOM_FIELDS].sort((a, b) => a.sortOrder - b.sortOrder));
}

/** GET /api/tenant/crm/v1/static-data -> enumOptions.customerStatuses */
export async function fakeListCustomerStatusOptions(): Promise<CustomerStatusOption[]> {
  try {
    const staticData = await getCrmStaticData();
    const raw = staticData.enumOptions['customerStatuses'] ?? [];
    const valid = new Set<string>(CUSTOMER_STATUS_ORDER);
    const mapped = raw
      .filter((opt) => valid.has(opt.value))
      .map((opt) => ({ value: opt.value as CustomerStatus, label: { ...opt.label } }));
    return mapped.length > 0 ? mapped : clone(FALLBACK_STATUS_OPTIONS);
  } catch {
    await customerDelay();
    return clone(FALLBACK_STATUS_OPTIONS);
  }
}

/**
 * party-directory.adapter assertBatchContactMethodsAllowed: a save is refused
 * with 409 PARTY_DUPLICATE_CONTACT_METHOD { methodType, level } exactly when
 * fakeCheckDuplicates would report the method with wouldBlock (same branch).
 */
function assertContactMethodsAllowed(
  branchId: string,
  ownerUserId: string | null,
  methods: { phones: readonly string[]; emails: readonly (string | null | undefined)[] },
  excludePartyId?: string,
): void {
  const phones = new Set(methods.phones.map(normalizeDigits).filter((p) => p.length >= 5));
  const emails = new Set(
    methods.emails.filter((e): e is string => !!e?.trim()).map((e) => e.trim().toLowerCase()),
  );
  if (phones.size === 0 && emails.size === 0) return;
  for (const c of CUSTOMERS_FAKE_DB) {
    if (c.branchId !== branchId) continue;
    if (excludePartyId && c.partyId === excludePartyId) continue;
    const partyPhones = [c.primaryMobile, c.companyPhone, ...c.phones, ...c.contacts.flatMap((ct) => ct.phones)];
    // Details are lowercase string arrays; level is the evaluator's DuplicateLevel lowercased
    // (company | branch | user | same_owner). Same branch here, so it is user or same_owner.
    const level = (c.ownerUserId ?? null) === ownerUserId ? 'same_owner' : 'user';
    if (partyPhones.some((p) => !!p && phones.has(normalizeDigits(p)))) {
      throw new ApiError(409, 'PARTY_DUPLICATE_CONTACT_METHOD', { methodType: ['phone'], level: [level] });
    }
    const partyEmails = [c.email, c.companyEmail, ...c.contacts.map((ct) => ct.email)];
    if (partyEmails.some((e) => !!e && emails.has(e.trim().toLowerCase()))) {
      throw new ApiError(409, 'PARTY_DUPLICATE_CONTACT_METHOD', { methodType: ['email'], level: [level] });
    }
  }
}

/** POST /api/tenant/crm/v1/leads/duplicate-check */
export async function fakeCheckDuplicates(probe: DuplicateCheckProbe): Promise<DuplicateCheckResponse> {
  await customerDelay();
  assertBranchContext(probe.branchId);

  let leadsEnabled = FAKE_LEADS_ENABLED_OVERRIDE;
  if (leadsEnabled === null) {
    try {
      const modules = await fakeGetCrmModules();
      leadsEnabled = modules.defaults.leadsEnabled;
    } catch {
      leadsEnabled = true;
    }
  }
  if (!leadsEnabled) {
    // crm-module-switch disabled(): the tenant default is off, so there is no company context.
    throw new ApiError(403, 'CRM_LEADS_DISABLED', { companyId: [] });
  }

  const name = probe.name?.trim().toLowerCase() ?? '';
  const email = probe.email?.trim().toLowerCase() ?? '';
  const tax = probe.taxNumber?.trim().toLowerCase() ?? '';
  const cr = probe.commercialRegistrationNumber?.trim().toLowerCase() ?? '';
  const phones = (probe.phones ?? [])
    .map((p) => normalizeDigits(p))
    .filter((p) => p.length >= 5);

  if (!name && !email && !tax && !cr && phones.length === 0) {
    throw new ApiError(422, 'LEAD_DUPLICATE_CHECK_EMPTY');
  }

  // lead-insights.service checkDuplicates: every matched party carries its live leads in the probe
  // branch (newest first, at most 5); `restricted` is set when some of its leads are withheld.
  const leadMatches = new Map<string, DuplicateMatch>();
  try {
    for (const match of (await fakeCheckLeadDuplicates(probe)).matches) leadMatches.set(match.partyId, match);
  } catch {
    // The probe was already accepted above; a failure in the leads fake leaves the leads empty.
  }

  const matches: DuplicateMatch[] = [];
  for (const c of CUSTOMERS_FAKE_DB) {
    if (probe.excludePartyId && c.partyId === probe.excludePartyId) continue;

    const hitTypes: DuplicateMatchType[] = [];
    const partyPhones = new Set(
      [c.primaryMobile, c.companyPhone, ...c.phones, ...c.contacts.flatMap((ct) => ct.phones)]
        .filter((p): p is string => !!p)
        .map(normalizeDigits),
    );
    const partyEmails = new Set(
      [c.email, c.companyEmail, ...c.contacts.map((ct) => ct.email)]
        .filter((e): e is string => !!e)
        .map((e) => e.trim().toLowerCase()),
    );

    if (tax && c.taxNumber?.trim().toLowerCase() === tax) hitTypes.push('TAX_NUMBER');
    if (cr && c.commercialRegistrationNumber?.trim().toLowerCase() === cr) hitTypes.push('COMMERCIAL_REGISTRATION');
    const phoneHit = phones.some((p) => partyPhones.has(p));
    const emailHit = Boolean(email && partyEmails.has(email));
    if (phoneHit) hitTypes.push('PHONE');
    if (emailHit) hitTypes.push('EMAIL');
    if (name && (c.displayName.trim().toLowerCase() === name || c.companyName?.trim().toLowerCase() === name)) {
      hitTypes.push('NAME');
    }

    if (hitTypes.length === 0) continue;

    const sameBranch = c.branchId === probe.branchId;
    // Fake policy: a repeated contact method blocks inside the same branch;
    // the owner decides whether the level reads SAME_OWNER or BRANCH.
    const level: DuplicateLevel = !sameBranch
      ? 'COMPANY'
      : probe.ownerUserId && c.ownerUserId === probe.ownerUserId
        ? 'SAME_OWNER'
        : 'BRANCH';
    const contactMethods: DuplicateContactMethodHit[] = [
      ...(phoneHit ? [{ methodType: 'PHONE', wouldBlock: sameBranch, level }] : []),
      ...(emailHit ? [{ methodType: 'EMAIL', wouldBlock: sameBranch, level }] : []),
    ];
    const wouldBlock = contactMethods.some((method) => method.wouldBlock);
    matches.push({
      contactMethods,
      wouldBlock,
      level: contactMethods.length > 0 ? level : null,
      partyId: c.partyId,
      displayName: sameBranch ? c.displayName : null,
      partyType: c.profileType === 'CORPORATE' ? 'ORGANIZATION' : 'PERSON',
      matchTypes: hitTypes,
      leads: leadMatches.get(c.partyId)?.leads ?? [],
      restricted: !sameBranch || leadMatches.get(c.partyId)?.restricted === true,
    });
    if (matches.length >= 20) break;
  }
  // Parties known only through leads are matched by the same Party search.
  for (const [partyId, match] of leadMatches) {
    if (matches.length >= 20) break;
    if (!matches.some((m) => m.partyId === partyId)) matches.push(match);
  }

  return { matches };
}

/** GET /api/tenant/core/v1/branches */
export async function fakeListBranches(): Promise<BranchOption[]> {
  await customerDelay();
  return clone(BRANCHES);
}

/** GET /api/tenant/crm/v1/assignable-owners?resource=customer_profiles&branchId=:branchId */
export async function fakeListBranchOwners(branchId: string): Promise<OwnerOption[]> {
  await customerDelay();
  const ids = BRANCH_OWNER_IDS[branchId] ?? BRANCH_OWNER_IDS[DEFAULT_CUSTOMER_BRANCH_ID] ?? [];
  return ids
    .map((id) => OWNER_RECORDS[id])
    .filter((o): o is OwnerRecord => !!o)
    .map((o): OwnerOption => ({ userId: o.id, name: o.displayName, avatarUrl: o.avatarUrl }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** GET /api/tenant/crm/v1/acquisition-sources */
export async function fakeListSources(): Promise<SourceOption[]> {
  return loadAvailableSources();
}

/** GET /api/tenant/crm/v1/tags */
export async function fakeListTags(): Promise<TagSummary[]> {
  return loadAvailableTags();
}

/** GET /api/tenant/core/v1/currencies */
export async function fakeListCurrencies(): Promise<CurrencyOption[]> {
  await customerDelay();
  return clone(CURRENCIES);
}
