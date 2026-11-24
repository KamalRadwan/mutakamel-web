import { fakeDelay, fakeId } from '../../../core/fake/fake-utils';
import { GEO_FAKE_DB } from '../../../core/geo/geo.fake';
import { FAKE_COMPANIES } from '../../../core/scope/scope.fake';
import { fakeCreate as fakeCreateActivity } from '../../../shared/widgets/activities/activities.fake';
import { ActivityDirection, ActivityError, ActivityPriority, ActivityType } from '../../../shared/widgets/activities/activities.model';
import { fakeListReasons } from '../settings/reasons/reasons.fake';
import { ApiError } from '../settings/shared/settings-api';
import { listTags } from '../settings/tags/tags.api';
import {
  DuplicateCheckPayload,
  DuplicateCheckResponse,
  DuplicateContactMethodHit,
  DuplicateLevel,
  DuplicateMatch,
  DuplicateMatchType,
} from '../shared/record/duplicate-strip/duplicate.model';
import { FALLBACK_PAGE_SIZES, SELECTION_LIMIT, SelectedRow } from './lead-bulk/lead-bulk.model';
import { CreateLeadBody, CreateLeadContactBody, LEAD_LIMITS, LeadAddressBody, UpdateLeadBody } from './lead-form/lead-draft';
import { LeadSearchBody } from './lead-search/lead-search.compile';
import { matchesLead } from './lead-search/lead-search.fake-eval';

type LeadListSearchBody = LeadSearchBody & {
  partyId?: string;
  excludeId?: string;
};

const ACME_CUSTOMER_PARTY_ID = '0192b7eb-7c4f-7a7d-9c9f-51c7f2b3bb01';
const SHARED_PARTY_COMPANY_INDICES = new Set([0, 1, 3, 4, 6, 7]);
import {
  BOARD_LIMIT,
  BoardLane,
  BranchOption,
  CARD_COLORS,
  CardColor,
  CompanyContactOption,
  CompanyOption,
  CurrencyOption,
  DueBucket,
  GeoPlaceView,
  LeadBoard,
  LeadContact,
  LeadCustomField,
  LeadDetail,
  LeadKpis,
  LeadMoveError,
  LeadPrimaryContact,
  LeadRow,
  LeadSearchOptions,
  LeadStage,
  LeadStatus,
  LeadTag,
  LeadsCapabilities,
  OwnerOption,
  Page,
  PartyAddressView,
  Scope,
  SourceOption,
  StageFlag,
} from './leads.model';

export const FAKE_CURRENT_USER_ID = 'u1';
export const FAKE_NO_SOURCE_PERMISSION = false;
export const FAKE_CAN_MANAGE_TAGS = true;
export const FAKE_NO_CUSTOM_FIELD_PERMISSION = false;
export let FAKE_CONFLICT_NEXT_PATCH = false;

export function fakeCanManageTags(): boolean {
  return FAKE_CAN_MANAGE_TAGS;
}

const STAGES: LeadStage[] = [
  { id: 'stage-new', nameEn: 'New', nameAr: 'جديد', flag: 'NEW', sortOrder: 1, isActive: true },
  { id: 'stage-contacted', nameEn: 'Contacted', nameAr: 'تم التواصل', flag: 'CONTACTED', sortOrder: 2, isActive: true },
  { id: 'stage-qualifying', nameEn: 'Qualifying', nameAr: 'قيد التأهيل', flag: 'QUALIFYING', sortOrder: 3, isActive: true },
  { id: 'stage-qualified', nameEn: 'Qualified', nameAr: 'مؤهل', flag: 'QUALIFIED', sortOrder: 4, isActive: true },
  { id: 'stage-disqualified', nameEn: 'Disqualified', nameAr: 'غير مؤهل', flag: 'DISQUALIFIED', sortOrder: 5, isActive: true },
  { id: 'stage-converted', nameEn: 'Converted', nameAr: 'تم التحويل', flag: 'CONVERTED', sortOrder: 6, isActive: true },
];

const SOURCES: SourceOption[] = [
  { id: 'src-web', nameEn: 'Website', nameAr: 'الموقع الإلكتروني', iconUrl: null },
  { id: 'src-ref', nameEn: 'Referral', nameAr: 'ترشيح', iconUrl: null },
  { id: 'src-expo', nameEn: 'Exhibition', nameAr: 'معرض', iconUrl: null },
  { id: 'src-social', nameEn: 'Social media', nameAr: 'وسائل التواصل', iconUrl: null },
  { id: 'src-call', nameEn: 'Cold call', nameAr: 'اتصال مباشر', iconUrl: null },
];

const TAGS: LeadTag[] = [
  { id: 'tag-001', name: 'VIP', backgroundColor: '#FBBF24', textColor: '#451A03' },
  { id: 'tag-004', name: 'Follow up', backgroundColor: '#DBEAFE', textColor: '#1E40AF' },
  { id: 'tag-007', name: 'Government', backgroundColor: '#4338CA', textColor: '#FFFFFF' },
  { id: 'tag-008', name: 'Trial', backgroundColor: '#ECFCCB', textColor: '#3F6212' },
];

/** The session's branches (core/scope FAKE_COMPANIES), so every CRM fake shares one branch list. */
const BRANCHES: BranchOption[] = FAKE_COMPANIES.flatMap((company) =>
  company.branches.map((branch) => ({ id: branch.id, name: branch.nameEn, companyName: company.nameEn })),
);
const MAIN_BRANCH_ID = BRANCHES[0].id;
const OTHER_BRANCH_IDS = BRANCHES.slice(1).map((branch) => branch.id);

const ALL_SCOPE: Scope = { scope: 'all', ownerUserIds: null };
const OWN_SCOPE: Scope = { scope: 'own', ownerUserIds: ['u1'] };

function capabilitiesFor(branchId: string, scope: Scope | null, canDelete: boolean): LeadsCapabilities {
  const deleteScope = canDelete ? scope : null;
  return {
    branchId,
    leads: { create: scope, update: scope, delete: deleteScope, convert: scope },
    activities: { create: scope },
    notes: { create: scope, delete: deleteScope },
    attachments: { create: scope, delete: deleteScope },
    opportunities: { create: scope },
  };
}

/** GET /leads/capabilities (LeadsCapabilitiesResponse) per branch. */
const CAPABILITIES_BY_BRANCH: Record<string, LeadsCapabilities> = {
  b1: capabilitiesFor('b1', ALL_SCOPE, true),
  b2: capabilitiesFor('b2', ALL_SCOPE, true),
  b3: capabilitiesFor('b3', ALL_SCOPE, true),
  b4: capabilitiesFor('b4', OWN_SCOPE, false),
  b5: capabilitiesFor('b5', ALL_SCOPE, true),
};

interface OwnerRecord extends OwnerOption {
  firstName: string;
  lastName: string;
}

const OWNER_RECORDS: Record<string, OwnerRecord> = {
  u1: { id: 'u1', firstName: 'Kamal', lastName: 'Radwan', displayName: 'Kamal Radwan', avatarUrl: null },
  u2: { id: 'u2', firstName: 'Mona', lastName: 'Adel', displayName: 'Mona Adel', avatarUrl: null },
  u3: { id: 'u3', firstName: 'Omar', lastName: 'Fathy', displayName: 'Omar Fathy', avatarUrl: null },
};

const BRANCH_OWNER_IDS: Record<string, string[]> = {
  b1: ['u1', 'u2', 'u3'],
  b2: ['u1', 'u2'],
  b3: ['u1', 'u2'],
  b4: ['u1'],
  b5: ['u1', 'u3'],
};

const CURRENCIES: CurrencyOption[] = [
  { code: 'EGP', name: 'Egyptian pound', decimalPlaces: 2, isDefault: true },
  { code: 'USD', name: 'US dollar', decimalPlaces: 2, isDefault: false },
  { code: 'SAR', name: 'Saudi riyal', decimalPlaces: 2, isDefault: false },
  { code: 'KWD', name: 'Kuwaiti dinar', decimalPlaces: 3, isDefault: false },
];

const CUSTOM_FIELDS: LeadCustomField[] = [
  {
    id: 'cf-budget-range',
    fieldKey: 'budget_range',
    nameEn: 'Budget range',
    nameAr: 'نطاق الميزانية',
    type: 'SELECT',
    placeholderEn: null,
    placeholderAr: null,
    options: [
      { key: 'low', nameEn: 'Low', nameAr: 'منخفضة' },
      { key: 'medium', nameEn: 'Medium', nameAr: 'متوسطة' },
      { key: 'high', nameEn: 'High', nameAr: 'مرتفعة' },
    ],
    requiredOnCreate: true,
    requiredOnUpdate: false,
    sortOrder: 1,
  },
  {
    id: 'cf-decision-date',
    fieldKey: 'decision_date',
    nameEn: 'Decision date',
    nameAr: 'تاريخ اتخاذ القرار',
    type: 'DATE',
    placeholderEn: null,
    placeholderAr: null,
    options: [],
    requiredOnCreate: false,
    requiredOnUpdate: false,
    sortOrder: 2,
  },
  {
    id: 'cf-branches-count',
    fieldKey: 'branches_count',
    nameEn: 'Number of branches',
    nameAr: 'عدد الفروع',
    type: 'NUMBER',
    placeholderEn: null,
    placeholderAr: null,
    options: [],
    requiredOnCreate: false,
    requiredOnUpdate: false,
    sortOrder: 3,
  },
  {
    id: 'cf-linkedin',
    fieldKey: 'linkedin',
    nameEn: 'LinkedIn page',
    nameAr: 'صفحة لينكدإن',
    type: 'URL',
    placeholderEn: null,
    placeholderAr: null,
    options: [],
    requiredOnCreate: false,
    requiredOnUpdate: false,
    sortOrder: 4,
  },
];

const EG = 'geo-eg';
const SA = 'geo-sa';
const AE = 'geo-ae';

const COMPANIES = [
  'Nile Logistics',
  'Delta Foods',
  'Cairo Steel',
  'Red Sea Resorts',
  'Pyramids Pharma',
  'Alexandria Textiles',
  'Sinai Solar',
  'Giza Motors',
  'Luxor Travel',
  'Aswan Granite',
  'Horus Software',
  'Memphis Builders',
  'Faiyum Farms',
  'Suez Marine',
  'Zamalek Interiors',
  'Heliopolis Clinics',
  'Maadi Schools',
  'Nasr Plastics',
];
const PEOPLE = ['Ahmed Hassan', 'Sara Mahmoud', 'Youssef Ali', 'Nour Ibrahim', 'Karim Saeed', 'Laila Mostafa', 'Hany Nabil', 'Dina Samir'];
const EXTRA_PEOPLE = ['Tarek Mansour', 'Salma Adel', 'Mostafa Kamal', 'Rana Youssef', 'Khaled Zaki', 'Maha Farid'];
const JOBS = ['Purchasing manager', 'CEO', 'Operations director', 'Finance manager', null];
const INTERESTS = ['ERP for 3 branches', 'Inventory and invoicing', 'CRM for the sales team', 'Accounting only', null];
const STAGE_SPREAD = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 5, 5, 5];
const DUE: (DueBucket | null)[] = ['OVERDUE', 'TODAY', 'FUTURE', null, 'FUTURE'];
const COLORS = Object.keys(CARD_COLORS) as CardColor[];
const DAY = 24 * 60 * 60 * 1000;

const GEO_PRESETS: readonly { countryId: string; stateId: string; cityId: string | null }[] = [
  { countryId: EG, stateId: 'geo-eg-c', cityId: 'geo-city-maadi' },
  { countryId: EG, stateId: 'geo-eg-alx', cityId: null },
  { countryId: SA, stateId: 'geo-sa-ri', cityId: 'geo-city-olaya' },
  { countryId: AE, stateId: 'geo-ae-du', cityId: null },
  { countryId: EG, stateId: 'geo-eg-gz', cityId: 'geo-city-dokki' },
  { countryId: EG, stateId: 'geo-eg-c', cityId: 'geo-city-nasr' },
];

function placeOf(item: { id: string; nameEn: string; nameAr: string } | undefined): GeoPlaceView | null {
  return item ? { id: item.id, nameEn: item.nameEn, nameAr: item.nameAr } : null;
}

interface AddressInput {
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
  districtId: string | null;
  street1: string | null;
  street2: string | null;
  buildingNo: string | null;
  floor: string | null;
  landmark: string | null;
  postalCode: string | null;
}

/**
 * party-address.dto + party-address-geo: what the backend stores for a written address and reads
 * back as PartyAddressView. street1 is stored as `street`, street2 as `apartment`; the legacy
 * `country` / `area` / `city` text is the English name of the chosen place.
 */
function toPartyAddressView(input: AddressInput): PartyAddressView {
  const country = input.countryId ? GEO_FAKE_DB.countries.find((c) => c.id === input.countryId) : undefined;
  const state = input.stateId ? GEO_FAKE_DB.states.find((s) => s.id === input.stateId) : undefined;
  const city = input.cityId ? GEO_FAKE_DB.cities.find((c) => c.id === input.cityId) : undefined;
  const district = input.districtId ? GEO_FAKE_DB.districts.find((d) => d.id === input.districtId) : undefined;
  return {
    addressType: 'PRIMARY',
    label: null,
    country: country?.nameEn ?? null,
    city: city?.nameEn ?? null,
    area: state?.nameEn ?? null,
    street: input.street1,
    buildingNo: input.buildingNo,
    floor: input.floor,
    apartment: input.street2,
    landmark: input.landmark,
    postalCode: input.postalCode,
    countryId: input.countryId,
    stateId: input.stateId,
    cityId: input.cityId,
    districtId: input.districtId,
    countryName: placeOf(country),
    stateName: placeOf(state),
    cityName: placeOf(city),
    districtName: placeOf(district),
  };
}

function buildSeedAddress(index: number): PartyAddressView {
  const preset = GEO_PRESETS[index % GEO_PRESETS.length];
  return toPartyAddressView({
    countryId: preset.countryId,
    stateId: preset.stateId,
    cityId: preset.cityId,
    districtId: null,
    street1: `${10 + (index % 80)} Nile Corniche St.`,
    street2: null,
    buildingNo: null,
    floor: null,
    landmark: null,
    postalCode: null,
  });
}

function primaryContactOf(contacts: readonly LeadContact[]): LeadPrimaryContact | null {
  const primary = contacts.find((c) => c.isPrimary) ?? contacts[0];
  return primary
    ? {
        partyId: primary.partyId,
        displayName: primary.displayName,
        jobTitle: primary.jobTitle,
        isPrimary: primary.isPrimary,
        email: primary.email,
        phones: [...primary.phones],
      }
    : null;
}

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? fullName,
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

function ownerForBranch(branchId: string, index: number): OwnerRecord | null {
  const allowedIds = BRANCH_OWNER_IDS[branchId] ?? [];
  const slots: (string | null)[] = [...allowedIds, null];
  const chosenId = slots[index % slots.length];
  return chosenId ? OWNER_RECORDS[chosenId] : null;
}

function buildSeedContacts(index: number, person: string, personEmail: string | null, mobile: string): LeadContact[] {
  const { firstName, lastName } = splitName(person);
  const contacts: LeadContact[] = [
    {
      partyId: `party-c-${index + 1}-1`,
      relationshipId: `rel-c-${index + 1}-1`,
      displayName: person,
      firstName,
      lastName,
      honorificTitle: null,
      jobTitle: JOBS[index % JOBS.length],
      isPrimary: true,
      email: personEmail,
      phones: [mobile],
    },
  ];
  const extraCount = index % 3 === 0 ? (index % 6 === 0 ? 2 : 1) : 0;
  for (let i = 1; i <= extraCount; i++) {
    const extraName = EXTRA_PEOPLE[(index + i) % EXTRA_PEOPLE.length];
    const extraParts = splitName(extraName);
    const extraSlug = extraName.toLowerCase().replace(/\s+/g, '.');
    contacts.push({
      partyId: `party-c-${index + 1}-${i + 1}`,
      relationshipId: `rel-c-${index + 1}-${i + 1}`,
      displayName: extraName,
      firstName: extraParts.firstName,
      lastName: extraParts.lastName,
      honorificTitle: null,
      jobTitle: JOBS[(index + i) % JOBS.length],
      isPrimary: false,
      email: `${extraSlug}.${index + 1}.${i + 1}@example.com`,
      phones: [`+2011${String(10000000 + index * 31337 + i * 7919).slice(0, 8)}`],
    });
  }
  return contacts;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function build(): LeadDetail[] {
  const now = Date.now();
  return Array.from({ length: 58 }, (_, index): LeadDetail => {
    const corporate = index % 3 !== 2;
    const person = PEOPLE[index % PEOPLE.length];
    const round = Math.floor(index / COMPANIES.length);
    const company = corporate ? COMPANIES[index % COMPANIES.length] + (round ? ' ' + (round + 1) : '') : null;
    const stage = STAGES[STAGE_SPREAD[index % STAGE_SPREAD.length]];
    const bucket = DUE[index % DUE.length];
    // Three in four leads sit in the main branch, so a single-branch list has more than one page.
    const branchId = index % 4 === 3 ? OTHER_BRANCH_IDS[(index >> 2) % OTHER_BRANCH_IDS.length] : MAIN_BRANCH_ID;
    const mobile = '+2010' + String(10000000 + index * 79193).slice(0, 8);
    const personEmail = index % 5 === 3 ? null : person.toLowerCase().replace(' ', '.') + (index + 1) + '@example.com';
    const companySlug = company ? slugify(company) : '';
    const companyPhone = corporate && index % 5 !== 4 ? '+2022' + String(10000000 + index * 61543).slice(0, 8) : null;
    const companyEmail = corporate && index % 5 !== 2 ? `info@${companySlug}.com` : null;
    const owner = ownerForBranch(branchId, index);
    const source = SOURCES[index % SOURCES.length];
    const contacts = corporate ? buildSeedContacts(index, person, personEmail, mobile) : [];
    const personParts = splitName(person);

    const companyIndex = index % COMPANIES.length;
    const partyId =
      index === 57
        ? ACME_CUSTOMER_PARTY_ID
        : corporate && round > 0 && SHARED_PARTY_COMPANY_INDICES.has(companyIndex)
          ? `party-${companyIndex + 1}`
          : `party-${index + 1}`;

    return {
      id: 'lead-' + String(index + 1).padStart(3, '0'),
      branchId,
      partyId,
      leadProfileType: corporate ? 'CORPORATE' : 'INDIVIDUAL',
      displayName: company ?? person,
      companyName: company,
      legalName: company,
      taxNumber: corporate && index % 2 === 0 ? `300-${String(100000 + index * 137)}-01` : null,
      commercialRegistrationNumber: corporate && index % 3 === 0 ? `CR-${String(40000 + index * 91)}` : null,
      companyPhone,
      companyPhones: companyPhone ? [companyPhone] : [],
      companyEmail,
      companyWebsite: corporate ? `https://www.${companySlug}.example.com` : null,
      existingCompany: false,
      firstName: corporate ? null : personParts.firstName,
      lastName: corporate ? null : personParts.lastName,
      honorificTitle: null,
      email: corporate ? null : personEmail,
      primaryMobile: corporate ? null : mobile,
      phones: corporate ? [] : [mobile],
      stageId: stage.id,
      stageFlag: stage.flag,
      status: statusOf(stage.flag),
      rating: index % 4,
      cardColor: index % 4 === 0 ? COLORS[(index / 4) % COLORS.length] : null,
      ownerUserId: owner?.id ?? null,
      owner: owner ? { userId: owner.id, firstName: owner.firstName, lastName: owner.lastName } : null,
      nextActivity: bucket && {
        activityAt: new Date(now + (bucket === 'OVERDUE' ? -2 : bucket === 'TODAY' ? 0 : 3) * DAY).toISOString(),
        bucket,
      },
      acquisitionSourceId: source.id,
      acquisitionSource: { id: source.id, nameEn: source.nameEn, nameAr: source.nameAr },
      address: buildSeedAddress(index),
      primaryContact: corporate ? primaryContactOf(contacts) : null,
      contacts,
      description: corporate ? `Inquiry from ${company}` : null,
      interestSummary: INTERESTS[index % INTERESTS.length],
      expectedNeed: null,
      expectedValue: index % 3 === 0 ? '125000.00000000' : null,
      currencyCode: index % 3 === 0 ? (index % 6 === 0 ? 'EGP' : 'SAR') : null,
      customFields: index % 7 === 0 ? { budget_range: ['low', 'medium', 'high'][index % 3] } : {},
      tags: TAGS.filter((_, tag) => (index + tag) % 4 === 0).map((t) => ({ ...t })),
      createdAt: new Date(now - (index + 5) * DAY).toISOString(),
      updatedAt: new Date(now - index * DAY).toISOString(),
    };
  });
}

let leads: LeadDetail[] = build();

/** parties.status: company-options lists ACTIVE organizations only, and a lead can use only an ACTIVE one. */
export type FakePartyStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

interface SeedCompanyRecord extends CompanyOption {
  status: FakePartyStatus;
  contacts: CompanyContactOption[];
}

/** An inactive organization: hidden from company-options, refused on create and on its contacts list. */
export const FAKE_INACTIVE_COMPANY_ID = 'party-co-delta-trading';

function buildSeedCompanies(): Map<string, SeedCompanyRecord> {
  const map = new Map<string, SeedCompanyRecord>();
  const seenNames = new Set<string>();

  for (const lead of leads) {
    if (lead.leadProfileType !== 'CORPORATE' || !lead.companyName) continue;
    const key = lead.companyName.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);

    const id = `party-co-${slugify(lead.companyName)}`;
    map.set(id, {
      id,
      displayName: lead.companyName,
      legalName: lead.legalName ?? lead.companyName,
      branchId: lead.branchId,
      status: 'ACTIVE',
      contacts: lead.contacts.slice(0, 3).map((c) => ({
        partyId: c.partyId,
        displayName: c.displayName,
        jobTitle: c.jobTitle,
        primaryEmail: c.email,
        phones: [...c.phones],
        isPrimary: c.isPrimary,
      })),
    });
  }

  map.set('party-co-horizon-holding', {
    id: 'party-co-horizon-holding',
    displayName: 'Horizon Holding',
    legalName: 'Horizon Holding S.A.E.',
    branchId: null,
    status: 'ACTIVE',
    contacts: [
      {
        partyId: 'party-c-horizon-1',
        displayName: 'Sherif El-Masry',
        jobTitle: 'Chief Executive Officer',
        primaryEmail: 'sherif@horizon-holding.example.com',
        phones: ['+201099887701'],
        isPrimary: true,
      },
      {
        partyId: 'party-c-horizon-2',
        displayName: 'Nadia Fouad',
        jobTitle: 'Procurement Director',
        primaryEmail: 'nadia@horizon-holding.example.com',
        phones: ['+201099887702'],
        isPrimary: false,
      },
    ],
  });

  map.set('party-co-atlas-group', {
    id: 'party-co-atlas-group',
    displayName: 'Atlas Group',
    legalName: 'Atlas Group Ltd.',
    branchId: null,
    status: 'ACTIVE',
    contacts: [
      {
        partyId: 'party-c-atlas-1',
        displayName: 'Faisal Al-Qahtani',
        jobTitle: 'Operations Director',
        primaryEmail: 'faisal@atlas-group.example.com',
        phones: ['+966501122331'],
        isPrimary: true,
      },
      {
        partyId: 'party-c-atlas-2',
        displayName: 'Reem Al-Harbi',
        jobTitle: 'Finance Manager',
        primaryEmail: 'reem@atlas-group.example.com',
        phones: ['+966501122332'],
        isPrimary: false,
      },
    ],
  });

  map.set(FAKE_INACTIVE_COMPANY_ID, {
    id: FAKE_INACTIVE_COMPANY_ID,
    displayName: 'Delta Trading',
    legalName: 'Delta Trading Co.',
    branchId: null,
    status: 'INACTIVE',
    contacts: [
      {
        partyId: 'party-c-delta-1',
        displayName: 'Hany Salem',
        jobTitle: 'General Manager',
        primaryEmail: 'hany@delta-trading.example.com',
        phones: ['+201011223301'],
        isPrimary: true,
      },
    ],
  });

  return map;
}

const COMPANY_DIRECTORY = buildSeedCompanies();

function isPersonParty(partyId: string): boolean {
  return leads.some(
    (lead) =>
      (lead.leadProfileType === 'INDIVIDUAL' && lead.partyId === partyId) ||
      lead.contacts.some((contact) => contact.partyId === partyId),
  );
}

/**
 * leads.service resolveExistingCorporateParty / listExistingCompanyContacts: an unknown party is
 * 404 PARTY_NOT_FOUND, a party that is not an organization or not ACTIVE 422 LEAD_EXISTING_COMPANY_INVALID, and
 * an organization of another branch 403 LEAD_EXISTING_COMPANY_OUTSIDE_BRANCH.
 */
function existingOrganization(partyId: string, branchId: string): SeedCompanyRecord {
  const company = COMPANY_DIRECTORY.get(partyId);
  if (!company) {
    if (isPersonParty(partyId)) throw new ApiError(422, 'LEAD_EXISTING_COMPANY_INVALID');
    throw new ApiError(404, 'PARTY_NOT_FOUND');
  }
  if (company.status !== 'ACTIVE') throw new ApiError(422, 'LEAD_EXISTING_COMPANY_INVALID');
  if (company.branchId !== null && company.branchId !== branchId) {
    throw new ApiError(403, 'LEAD_EXISTING_COMPANY_OUTSIDE_BRANCH');
  }
  return company;
}

const idempotencyStore = new Map<string, { bodyKey: string; result: LeadDetail }>();

function statusOf(flag: StageFlag): LeadStatus {
  return flag === 'CONVERTED' || flag === 'DISQUALIFIED' || flag === 'ON_HOLD' ? flag : 'OPEN';
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function toLeadRow(detail: LeadDetail): LeadRow {
  return {
    id: detail.id,
    leadProfileType: detail.leadProfileType,
    displayName: detail.displayName,
    companyName: detail.companyName,
    companyPhone: detail.companyPhone,
    companyEmail: detail.companyEmail,
    email: detail.email,
    primaryMobile: detail.primaryMobile,
    phones: [...detail.phones],
    stageId: detail.stageId,
    stageFlag: detail.stageFlag,
    status: detail.status,
    rating: detail.rating,
    cardColor: detail.cardColor,
    owner: detail.owner ? { ...detail.owner } : null,
    nextActivity: detail.nextActivity ? { ...detail.nextActivity } : null,
    acquisitionSource: detail.acquisitionSource ? { ...detail.acquisitionSource } : null,
    address: detail.address ? clone(detail.address) : null,
    primaryContact: detail.primaryContact ? { ...detail.primaryContact, phones: [...detail.primaryContact.phones] } : null,
    interestSummary: detail.interestSummary,
    tags: detail.tags.map((t) => ({ ...t })),
    updatedAt: detail.updatedAt,
  };
}

function matchesParty(detail: LeadDetail, partyId: string): boolean {
  return detail.partyId === partyId || detail.contacts.some((contact) => contact.partyId === partyId);
}

function matching(body: LeadListSearchBody): LeadRow[] {
  const now = new Date();
  if (leads.length === 0) {
    matchesLead({} as LeadRow, body, { now });
    return [];
  }
  const branchId = body.branchId?.trim() || null;
  const partyId = body.partyId?.trim() || null;
  const excludeId = body.excludeId?.trim() || null;
  return leads
    .filter((detail) => {
      if (branchId && detail.branchId !== branchId) return false;
      if (excludeId && detail.id === excludeId) return false;
      if (partyId && !matchesParty(detail, partyId)) return false;
      return matchesLead({ ...detail, ...toLeadRow(detail) }, body, { now });
    })
    .map(toLeadRow);
}

/** party-read-model paginatedReadModels: an empty result has totalPages 0. */
function pageOf<T>(all: T[], page: number, limit: number): Page<T> {
  const totalPages = all.length === 0 ? 0 : Math.ceil(all.length / limit);
  return {
    items: all.slice((page - 1) * limit, page * limit),
    total: all.length,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1 && totalPages > 0,
  };
}

/** POST /leads/board: LeadBoardResponse. */
export async function fakeBoard(body: LeadListSearchBody): Promise<LeadBoard> {
  await fakeDelay();
  const found = matching(body);
  return {
    stages: STAGES.map((stage) => ({
      stage: { ...stage },
      ...pageOf(found.filter((lead) => lead.stageId === stage.id), 1, BOARD_LIMIT),
    })),
  };
}

/** POST /leads/board/stages/:stageId: LeadBoardLaneResponse. */
export async function fakeStagePage(stageId: string, body: LeadListSearchBody, page: number): Promise<BoardLane> {
  await fakeDelay();
  const stage = STAGES.find((item) => item.id === stageId);
  if (!stage) throw new ApiError(404, 'LEAD_STAGE_NOT_FOUND');
  return { stage: { ...stage }, ...pageOf(matching(body).filter((lead) => lead.stageId === stageId), page, BOARD_LIMIT) };
}

export async function fakeSearch(body: LeadListSearchBody, page: number, limit: number): Promise<Page<LeadRow>> {
  await fakeDelay();
  return pageOf(matching(body), page, limit);
}

function isToday(iso: string, now: Date): boolean {
  const date = new Date(iso);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

/** POST /leads/kpis: LeadKpisResponse (leads.repository countKpis). */
export async function fakeLeadKpis(body: LeadListSearchBody): Promise<LeadKpis> {
  await fakeDelay();
  const found = matching(body);
  const createdAt = new Map(leads.map((lead) => [lead.id, lead.createdAt]));
  const now = new Date();
  return {
    totalLeads: found.length,
    newStageLeads: found.filter((lead) => lead.stageFlag === 'NEW').length,
    newTodayLeads: found.filter((lead) => isToday(createdAt.get(lead.id) ?? '', now)).length,
    hotLeads: found.filter((lead) => lead.rating === 3).length,
    overdueActivityLeads: found.filter((lead) => lead.nextActivity?.bucket === 'OVERDUE').length,
    qualifiedLeads: found.filter((lead) => lead.stageFlag === 'QUALIFIED').length,
  };
}

export async function fakeSearchOptions(): Promise<LeadSearchOptions> {
  await fakeDelay();
  let tags = TAGS;
  try {
    const loaded = await listTags();
    tags = loaded.map((t) => ({
      id: t.id,
      name: t.name,
      backgroundColor: t.backgroundColor,
      textColor: t.textColor,
    }));
  } catch {
    tags = TAGS;
  }
  return clone({
    stages: STAGES,
    sources: SOURCES,
    tags,
  });
}

/** The governed DISQUALIFICATION reason each disqualified lead carries (crm_leads.disqualification_reason_id). */
const disqualificationReasonByLead = new Map<string, string>();

function assertLeadWriteScope(lead: LeadDetail): void {
  const scope = CAPABILITIES_BY_BRANCH[lead.branchId]?.leads.update ?? null;
  if (!scope || (scope.ownerUserIds && (!lead.ownerUserId || !scope.ownerUserIds.includes(lead.ownerUserId)))) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }
}

/** reason-enforcement transitionReason for a single lead move. */
async function moveReason(lead: LeadDetail, stage: LeadStage, reasonId: string | undefined): Promise<string | null> {
  if (stage.flag !== 'DISQUALIFIED') {
    if (reasonId) throw new LeadMoveError('CRM_REASON_KIND_MISMATCH');
    return null;
  }
  const current = disqualificationReasonByLead.get(lead.id) ?? null;
  if (reasonId) {
    if (reasonId !== current) {
      const active = await fakeListReasons('DISQUALIFICATION', true);
      if (!active.some((reason) => reason.id === reasonId)) throw new LeadMoveError('CRM_REASON_UNAVAILABLE');
    }
    return reasonId;
  }
  if (lead.status !== 'DISQUALIFIED') throw new LeadMoveError('CRM_REASON_REQUIRED');
  return current;
}

/** The branch of a fake lead (null when unknown), for other fakes that must keep to the request branch. */
export function fakeLeadBranchId(leadId: string): string | null {
  return leads.find((item) => item.id === leadId)?.branchId ?? null;
}

/** POST /leads/:id/stage { stageId, disqualificationReasonId? }: the lead detail after the move. */
export async function fakeMove(leadId: string, stageId: string, disqualificationReasonId?: string): Promise<LeadDetail> {
  await fakeDelay();
  const lead = leads.find((item) => item.id === leadId);
  if (!lead) throw new ApiError(404, 'LEAD_NOT_FOUND');
  assertLeadWriteScope(lead);
  if (lead.status === 'CONVERTED') throw new LeadMoveError('LEAD_ALREADY_CONVERTED');
  const stage = STAGES.find((item) => item.id === stageId && item.isActive);
  if (!stage) throw new LeadMoveError('LEAD_STAGE_INVALID');
  if (stage.flag === 'CONVERTED') throw new LeadMoveError('LEAD_CONVERSION_REQUIRED');
  if (lead.stageId === stage.id) return clone(lead);

  const reasonId = await moveReason(lead, stage, disqualificationReasonId);
  if (reasonId) disqualificationReasonByLead.set(leadId, reasonId);
  else disqualificationReasonByLead.delete(leadId);

  const moved: LeadDetail = {
    ...lead,
    stageId,
    stageFlag: stage.flag,
    status: statusOf(stage.flag),
    updatedAt: new Date().toISOString(),
  };
  leads = [moved, ...leads.filter((item) => item.id !== leadId)];
  return clone(moved);
}

/**
 * leads.service update order: 404, scoped access, LEAD_ALREADY_CONVERTED, then the optimistic
 * concurrency check only when the client sends expectedUpdatedAt.
 */
function patchableLead(id: string, expectedUpdatedAt: string | undefined): LeadDetail {
  const existing = leads.find((item) => item.id === id);
  if (!existing) throw new ApiError(404, 'LEAD_NOT_FOUND');
  assertLeadWriteScope(existing);
  if (existing.status === 'CONVERTED') throw new ApiError(409, 'LEAD_ALREADY_CONVERTED');
  if (FAKE_CONFLICT_NEXT_PATCH) {
    FAKE_CONFLICT_NEXT_PATCH = false;
    throw new ApiError(409, 'CRM.LEAD.CONCURRENT_UPDATE');
  }
  if (expectedUpdatedAt !== undefined && expectedUpdatedAt !== existing.updatedAt) {
    throw new ApiError(409, 'CRM.LEAD.CONCURRENT_UPDATE');
  }
  return existing;
}

/** PATCH /leads/:id { rating?, cardColor?, expectedUpdatedAt? } from a card or row: the lead detail. */
export async function fakeUpdateLead(
  id: string,
  changes: { rating?: number; cardColor?: CardColor | null },
  expectedUpdatedAt?: string,
): Promise<LeadDetail> {
  await fakeDelay();
  validateRatingAndColor(changes.rating, changes.cardColor);
  const lead = patchableLead(id, expectedUpdatedAt);
  const updated: LeadDetail = { ...lead, ...changes, updatedAt: new Date().toISOString() };
  leads = leads.map((item) => (item.id === id ? updated : item));
  return clone(updated);
}

export async function fakeDeleteLead(id: string): Promise<void> {
  await fakeDelay();
  if (!leads.some((item) => item.id === id)) throw new ApiError(404, 'LEAD_NOT_FOUND');
  leads = leads.filter((item) => item.id !== id);
  disqualificationReasonByLead.delete(id);
}

// --- New Lead Modal Fake API ---

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALUE_RE = /^\d{1,16}(\.\d{1,8})?$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const PHONE_CHARS_RE = /^[+\d\s().-]+$/;

const CREATE_ALLOWED_KEYS = new Set([
  'leadProfileType',
  'branchId',
  'stageId',
  'ownerUserId',
  'acquisitionSourceId',
  'tagIds',
  'rating',
  'cardColor',
  'honorificTitle',
  'firstName',
  'lastName',
  'phones',
  'email',
  'existingCompanyPartyId',
  'companyName',
  'legalName',
  'taxNumber',
  'commercialRegistrationNumber',
  'companyPhones',
  'companyEmail',
  'companyWebsite',
  'contacts',
  'address',
  'description',
  'interestSummary',
  'expectedNeed',
  'expectedValue',
  'currencyCode',
  'customFields',
]);

const PATCH_FORBIDDEN_KEYS = new Set(['leadProfileType', 'branchId', 'stageId']);

const PATCH_ALLOWED_KEYS = new Set([
  'expectedUpdatedAt',
  'ownerUserId',
  'acquisitionSourceId',
  'tagIds',
  'rating',
  'cardColor',
  'honorificTitle',
  'firstName',
  'lastName',
  'phones',
  'email',
  'companyName',
  'legalName',
  'taxNumber',
  'commercialRegistrationNumber',
  'companyPhones',
  'companyEmail',
  'companyWebsite',
  'contacts',
  'address',
  'description',
  'interestSummary',
  'expectedNeed',
  'expectedValue',
  'currencyCode',
  'customFields',
]);

const ADDRESS_ALLOWED_KEYS = new Set([
  'countryId',
  'stateId',
  'cityId',
  'districtId',
  'street1',
  'street2',
  'buildingNo',
  'floor',
  'landmark',
  'postalCode',
]);

const CONTACT_ALLOWED_KEYS = new Set([
  'contactPartyId',
  'honorificTitle',
  'firstName',
  'lastName',
  'jobTitle',
  'isPrimary',
  'phones',
  'email',
]);

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return '{' + keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',') + '}';
}

/**
 * main.ts ValidationPipe as the shared exceptions filter sends it: 400 CRM_VALIDATION_FAILED whose
 * details map each failing dotted property path (`contacts.0.firstName`) to its messages.
 */
function validationFailed(path: string): ApiError {
  return new ApiError(400, 'CRM_VALIDATION_FAILED', { [path]: [`${path} is invalid`] });
}

function assertAllowedKeys(obj: object, allowed: Set<string>, prefix = ''): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      throw validationFailed(prefix + key);
    }
  }
}

function normalizePhone(raw: string): string {
  const stripped = raw.replace(/[^\d+]/g, '');
  const withPlus = stripped.startsWith('00') ? '+' + stripped.slice(2) : stripped;
  return withPlus.startsWith('+') ? '+' + withPlus.slice(1).replace(/\+/g, '') : withPlus.replace(/\+/g, '');
}

function phoneDigitsCount(normalized: string): number {
  return normalized.replace(/\D/g, '').length;
}

function validateAndNormalizePhoneList(phones: unknown, path: string): string[] {
  if (!Array.isArray(phones)) throw validationFailed(path);
  if (phones.length > LEAD_LIMITS.phonesMax) throw validationFailed(path);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of phones) {
    if (typeof item !== 'string') throw validationFailed(path);
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed.length > LEAD_LIMITS.phoneMax) {
      throw validationFailed(path);
    }
    if (!PHONE_CHARS_RE.test(trimmed)) {
      throw new ApiError(422, 'LEAD_PHONE_INVALID');
    }
    const normalized = normalizePhone(trimmed);
    if (phoneDigitsCount(normalized) < 5) {
      throw new ApiError(422, 'LEAD_PHONE_INVALID');
    }
    if (seen.has(normalized)) {
      throw new ApiError(422, 'PARTY_DUPLICATE_CONTACT_METHOD');
    }
    seen.add(normalized);
    result.push(trimmed);
  }
  return result;
}

function assertMaxLen(value: string | null | undefined, max: number, field: string): void {
  if (value !== undefined && value !== null && value.trim().length > max) {
    throw validationFailed(field);
  }
}

function assertEmailFormat(value: string | null | undefined, field: string): void {
  const trimmed = value?.trim();
  if (!trimmed) return;
  if (trimmed.length > LEAD_LIMITS.email || !EMAIL_RE.test(trimmed)) {
    throw validationFailed(field);
  }
}

function assertWebsiteFormat(value: string | null | undefined, field: string): void {
  const trimmed = value?.trim();
  if (!trimmed) return;
  if (trimmed.length > LEAD_LIMITS.website || !isValidHttpUrl(trimmed)) {
    throw validationFailed(field);
  }
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

interface MoneyPair {
  expectedValue: string | null;
  currencyCode: string | null;
}

/** lead.dto: expectedValue is a nonnegative decimal (16.8), currencyCode three uppercase letters; else 400. */
function parseMoneyInput(input: { expectedValue?: string | null; currencyCode?: string | null }): {
  expectedValue?: string | null;
  currencyCode?: string | null;
} {
  const { expectedValue, currencyCode } = input;
  if (expectedValue !== undefined && expectedValue !== null && (typeof expectedValue !== 'string' || !VALUE_RE.test(expectedValue))) {
    throw validationFailed('expectedValue');
  }
  const currency = typeof currencyCode === 'string' ? currencyCode.trim().toUpperCase() : currencyCode;
  if (currency !== undefined && currency !== null && !CURRENCY_RE.test(currency)) {
    throw validationFailed('currencyCode');
  }
  return {
    ...(expectedValue !== undefined ? { expectedValue } : {}),
    ...(currency !== undefined ? { currencyCode: currency } : {}),
  };
}

/**
 * lead-expected-value.ts leadExpectedValuePair: the pair must end both set or both null (422
 * LEAD_EXPECTED_VALUE_CURRENCY_PAIR); a PATCH may not send one half when the stored other half is
 * null. Zero is allowed; the stored value is normalized to 8 decimals.
 */
function expectedValuePair(
  raw: { expectedValue?: string | null; currencyCode?: string | null },
  stored?: MoneyPair,
): MoneyPair {
  const input = parseMoneyInput(raw);
  const value = input.expectedValue !== undefined ? input.expectedValue : (stored?.expectedValue ?? null);
  const currency = input.currencyCode !== undefined ? input.currencyCode : (stored?.currencyCode ?? null);
  const loneHalf =
    stored !== undefined &&
    (input.expectedValue !== undefined) !== (input.currencyCode !== undefined) &&
    (input.expectedValue !== undefined ? stored.currencyCode == null : stored.expectedValue == null);
  if (loneHalf || (value == null) !== (currency == null)) {
    throw new ApiError(422, 'LEAD_EXPECTED_VALUE_CURRENCY_PAIR');
  }
  if (value == null) return { expectedValue: null, currencyCode: null };
  const [integer, fraction = ''] = value.split('.');
  return { expectedValue: `${integer.replace(/^0+(?=\d)/, '')}.${fraction.padEnd(8, '0')}`, currencyCode: currency };
}

function isValidIsoDate(raw: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isValidIsoDateTime(raw: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.test(raw)) return false;
  return !Number.isNaN(Date.parse(raw));
}

function isValidHttpUrl(raw: string): boolean {
  if (!/^https?:\/\//i.test(raw)) return false;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isCustomBlank(val: unknown, type: LeadCustomField['type']): boolean {
  if (val === null || val === undefined) return true;
  if (type === 'BOOLEAN') return false;
  if (type === 'MULTI_SELECT') return Array.isArray(val) && val.length === 0;
  return typeof val === 'string' && val.trim() === '';
}

function validateCustomFieldType(cf: LeadCustomField, val: unknown): void {
  switch (cf.type) {
    case 'TEXT':
    case 'TEXTAREA':
      if (typeof val !== 'string' || val.trim().length > LEAD_LIMITS.longText) {
        throw new ApiError(422, 'CUSTOM_FIELD_VALUE_INVALID', { fieldKey: cf.fieldKey });
      }
      return;
    case 'NUMBER': {
      const num = typeof val === 'number' ? val : typeof val === 'string' && val.trim() !== '' ? Number(val.trim()) : Number.NaN;
      if (!Number.isFinite(num)) throw new ApiError(422, 'CUSTOM_FIELD_VALUE_INVALID', { fieldKey: cf.fieldKey });
      return;
    }
    case 'DATE':
      if (typeof val !== 'string' || !isValidIsoDate(val.trim())) {
        throw new ApiError(422, 'CUSTOM_FIELD_VALUE_INVALID', { fieldKey: cf.fieldKey });
      }
      return;
    case 'DATETIME':
      if (typeof val !== 'string' || !isValidIsoDateTime(val.trim())) {
        throw new ApiError(422, 'CUSTOM_FIELD_VALUE_INVALID', { fieldKey: cf.fieldKey });
      }
      return;
    case 'BOOLEAN':
      if (typeof val !== 'boolean') {
        throw new ApiError(422, 'CUSTOM_FIELD_VALUE_INVALID', { fieldKey: cf.fieldKey });
      }
      return;
    case 'SELECT':
      if (typeof val !== 'string' || !cf.options.some((o) => o.key === val)) {
        throw new ApiError(422, 'CUSTOM_FIELD_VALUE_INVALID', { fieldKey: cf.fieldKey });
      }
      return;
    case 'MULTI_SELECT': {
      if (!Array.isArray(val)) throw new ApiError(422, 'CUSTOM_FIELD_VALUE_INVALID', { fieldKey: cf.fieldKey });
      const keys = new Set(cf.options.map((o) => o.key));
      if (!val.every((v) => typeof v === 'string' && keys.has(v))) {
        throw new ApiError(422, 'CUSTOM_FIELD_VALUE_INVALID', { fieldKey: cf.fieldKey });
      }
      return;
    }
    case 'URL':
      if (typeof val !== 'string' || !isValidHttpUrl(val.trim())) {
        throw new ApiError(422, 'CUSTOM_FIELD_VALUE_INVALID', { fieldKey: cf.fieldKey });
      }
      return;
    case 'EMAIL':
      if (typeof val !== 'string' || !EMAIL_RE.test(val.trim())) {
        throw new ApiError(422, 'CUSTOM_FIELD_VALUE_INVALID', { fieldKey: cf.fieldKey });
      }
      return;
    case 'PHONE':
      if (typeof val !== 'string' || !PHONE_CHARS_RE.test(val.trim()) || phoneDigitsCount(normalizePhone(val)) < 5) {
        throw new ApiError(422, 'CUSTOM_FIELD_VALUE_INVALID', { fieldKey: cf.fieldKey });
      }
      return;
  }
}

function validateCustomFields(customFields: Record<string, unknown>, operation: 'create' | 'update'): Record<string, unknown> {
  const byKey = new Map(CUSTOM_FIELDS.map((cf) => [cf.fieldKey, cf]));
  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(customFields)) {
    const def = byKey.get(key);
    if (!def) {
      throw new ApiError(422, 'CUSTOM_FIELD_VALUE_INVALID', { fieldKey: key });
    }
    if (!isCustomBlank(val, def.type)) {
      validateCustomFieldType(def, val);
      result[key] = typeof val === 'string' ? val.trim() : Array.isArray(val) ? [...val] : val;
    }
  }

  for (const def of CUSTOM_FIELDS) {
    const required = operation === 'create' ? def.requiredOnCreate : def.requiredOnUpdate;
    if (required && isCustomBlank(result[def.fieldKey], def.type)) {
      throw new ApiError(422, 'CUSTOM_FIELD_REQUIRED', { fieldKey: def.fieldKey });
    }
  }

  return result;
}

type GeoField = 'countryId' | 'stateId' | 'cityId' | 'districtId';
const GEO_FIELDS: readonly GeoField[] = ['countryId', 'stateId', 'cityId', 'districtId'];

/**
 * crm-app common/party-address-geo.ts: a level without its parent is 422 LEAD_ADDRESS_GEO_INCOMPLETE;
 * an unknown, inactive or wrong-lineage place is 422 LEAD_ADDRESS_GEO_INVALID; both with details.field.
 */
function assertAddressGeography(ids: Record<GeoField, string | null>): void {
  for (let level = 1; level < GEO_FIELDS.length; level++) {
    const field = GEO_FIELDS[level];
    if (ids[field] && !ids[GEO_FIELDS[level - 1]]) {
      throw new ApiError(422, 'LEAD_ADDRESS_GEO_INCOMPLETE', { field: [field] });
    }
  }
  const invalid = (field: GeoField): never => {
    throw new ApiError(422, 'LEAD_ADDRESS_GEO_INVALID', { field: [field] });
  };
  const { countryId, stateId, cityId, districtId } = ids;
  if (countryId && !GEO_FAKE_DB.countries.some((c) => c.id === countryId && c.isActive)) invalid('countryId');
  if (stateId && !GEO_FAKE_DB.states.some((s) => s.id === stateId && s.isActive && s.countryId === countryId)) invalid('stateId');
  if (cityId && !GEO_FAKE_DB.cities.some((c) => c.id === cityId && c.isActive && c.stateId === stateId)) invalid('cityId');
  if (districtId && !GEO_FAKE_DB.districts.some((d) => d.id === districtId && d.isActive && d.cityId === cityId)) {
    invalid('districtId');
  }
}

function validateAndBuildAddress(addr: LeadAddressBody | undefined): PartyAddressView | null {
  if (!addr) return null;
  assertAllowedKeys(addr, ADDRESS_ALLOWED_KEYS, 'address.');
  assertMaxLen(addr.street1, LEAD_LIMITS.street1, 'address.street1');
  assertMaxLen(addr.street2, LEAD_LIMITS.street2, 'address.street2');
  assertMaxLen(addr.buildingNo, LEAD_LIMITS.building, 'address.buildingNo');
  assertMaxLen(addr.floor, LEAD_LIMITS.floor, 'address.floor');
  assertMaxLen(addr.landmark, LEAD_LIMITS.landmark, 'address.landmark');
  assertMaxLen(addr.postalCode, LEAD_LIMITS.postal, 'address.postalCode');

  const countryId = addr.countryId?.trim() || null;
  const stateId = addr.stateId?.trim() || null;
  const cityId = addr.cityId?.trim() || null;
  const districtId = addr.districtId?.trim() || null;

  assertAddressGeography({ countryId, stateId, cityId, districtId });

  const cleanText = (v: string | null | undefined) => v?.trim() || null;
  return toPartyAddressView({
    countryId,
    stateId,
    cityId,
    districtId,
    street1: cleanText(addr.street1),
    street2: cleanText(addr.street2),
    buildingNo: cleanText(addr.buildingNo),
    floor: cleanText(addr.floor),
    landmark: cleanText(addr.landmark),
    postalCode: cleanText(addr.postalCode),
  });
}

async function resolveTags(tagIds: string[] | undefined): Promise<LeadTag[]> {
  if (!tagIds || tagIds.length === 0) return [];
  if (tagIds.length > LEAD_LIMITS.tagsMax) {
    throw validationFailed('tagIds');
  }
  let allTags: LeadTag[];
  try {
    allTags = await listTags();
  } catch {
    allTags = TAGS;
  }
  const byId = new Map(allTags.map((t) => [t.id, t]));
  const out: LeadTag[] = [];
  for (const id of tagIds) {
    const found = byId.get(id);
    if (!found) throw new ApiError(422, 'CRM_TAG_UNKNOWN', { tagId: id });
    out.push({ id: found.id, name: found.name, backgroundColor: found.backgroundColor, textColor: found.textColor });
  }
  return out;
}

function collectPartyMethods(lead: LeadDetail): { phones: Set<string>; emails: Set<string> } {
  const phones = new Set<string>();
  const emails = new Set<string>();

  for (const p of lead.phones) phones.add(normalizePhone(p));
  for (const p of lead.companyPhones) phones.add(normalizePhone(p));
  if (lead.email) emails.add(lead.email.trim().toLowerCase());
  if (lead.companyEmail) emails.add(lead.companyEmail.trim().toLowerCase());

  for (const c of lead.contacts) {
    for (const p of c.phones) phones.add(normalizePhone(p));
    if (c.email) emails.add(c.email.trim().toLowerCase());
  }
  return { phones, emails };
}

function assertNoIntraLeadDuplicateMethods(phones: string[], emails: string[]): void {
  const seenPhones = new Set<string>();
  for (const p of phones) {
    const np = normalizePhone(p);
    if (seenPhones.has(np)) {
      throw new ApiError(422, 'PARTY_DUPLICATE_CONTACT_METHOD');
    }
    seenPhones.add(np);
  }
  const seenEmails = new Set<string>();
  for (const e of emails) {
    const ne = e.trim().toLowerCase();
    if (!ne) continue;
    if (seenEmails.has(ne)) {
      throw new ApiError(422, 'PARTY_DUPLICATE_CONTACT_METHOD');
    }
    seenEmails.add(ne);
  }
}

function assertNoTenantDuplicateMethods(
  candidatePhones: string[],
  candidateEmails: string[],
  excludePartyId: string | null,
): void {
  const normPhones = candidatePhones.map((p) => normalizePhone(p));
  const normEmails = candidateEmails.map((e) => e.trim().toLowerCase());
  if (normPhones.length === 0 && normEmails.length === 0) return;

  assertNoIntraLeadDuplicateMethods(normPhones, normEmails);

  for (const other of leads) {
    if (excludePartyId && other.partyId === excludePartyId) continue;
    const existing = collectPartyMethods(other);
    // party-directory.adapter: 409 { methodType: [lowercase], level: [lowercase DuplicateLevel] }. The fake
    // checks tenant-wide, so it reports the widest level.
    for (const np of normPhones) {
      if (existing.phones.has(np)) {
        throw new ApiError(409, 'PARTY_DUPLICATE_CONTACT_METHOD', { methodType: ['phone'], level: ['company'] });
      }
    }
    for (const ne of normEmails) {
      if (existing.emails.has(ne)) {
        throw new ApiError(409, 'PARTY_DUPLICATE_CONTACT_METHOD', { methodType: ['email'], level: ['company'] });
      }
    }
  }
}

function validateAndBuildContacts(
  rawContacts: CreateLeadContactBody[],
  existingCompany: SeedCompanyRecord | null,
  existingLeadContacts: LeadContact[] = [],
): LeadContact[] {
  if (rawContacts.length === 0) {
    throw new ApiError(422, 'LEAD_CONTACT_REQUIRED');
  }
  if (rawContacts.length > LEAD_LIMITS.contactsMax) {
    throw new ApiError(409, 'PARTY_CONTACT_LIMIT_EXCEEDED');
  }
  const seenContactPartyIds = new Set<string>();
  for (const [index, c] of rawContacts.entries()) {
    assertAllowedKeys(c, CONTACT_ALLOWED_KEYS, `contacts.${index}.`);
    if (c.contactPartyId) {
      if (seenContactPartyIds.has(c.contactPartyId)) {
        throw new ApiError(409, 'PARTY_DUPLICATE_CONTACT', { contactPartyId: c.contactPartyId });
      }
      seenContactPartyIds.add(c.contactPartyId);
    }
  }
  const primaryCount = rawContacts.filter((c) => c.isPrimary === true).length;
  if (primaryCount !== 1) {
    throw new ApiError(422, 'LEAD_CONTACT_PRIMARY_INVALID');
  }

  const companyContactById = new Map((existingCompany?.contacts ?? []).map((c) => [c.partyId, c]));
  const existingLeadContactById = new Map(existingLeadContacts.map((c) => [c.partyId, c]));

  return rawContacts.map((c, index): LeadContact => {
    const at = `contacts.${index}`;
    assertMaxLen(c.honorificTitle, LEAD_LIMITS.honorific, `${at}.honorificTitle`);
    assertMaxLen(c.jobTitle, LEAD_LIMITS.jobTitle, `${at}.jobTitle`);

    if (c.contactPartyId) {
      const cc = companyContactById.get(c.contactPartyId);
      if (cc) {
        const parts = splitName(cc.displayName);
        return {
          partyId: cc.partyId,
          relationshipId: fakeId(),
          displayName: cc.displayName,
          firstName: parts.firstName,
          lastName: parts.lastName,
          honorificTitle: c.honorificTitle !== undefined ? c.honorificTitle?.trim() || null : null,
          jobTitle: c.jobTitle !== undefined ? c.jobTitle?.trim() || null : cc.jobTitle,
          isPrimary: c.isPrimary,
          email: c.email !== undefined ? c.email.trim() || null : cc.primaryEmail,
          phones: c.phones !== undefined ? validateAndNormalizePhoneList(c.phones, `${at}.phones`) : [...cc.phones],
        };
      }
      const prev = existingLeadContactById.get(c.contactPartyId);
      if (prev) {
        const firstName = c.firstName !== undefined ? c.firstName.trim() : prev.firstName;
        if (!firstName) {
          throw new ApiError(422, 'LEAD_CONTACT_NAME_REQUIRED');
        }
        assertMaxLen(firstName, LEAD_LIMITS.name, `${at}.firstName`);
        assertMaxLen(c.lastName, LEAD_LIMITS.name, `${at}.lastName`);
        assertEmailFormat(c.email, `${at}.email`);
        const lastName = c.lastName !== undefined ? c.lastName.trim() || null : prev.lastName;
        const displayName = [firstName, lastName].filter(Boolean).join(' ') || prev.displayName;
        return {
          partyId: prev.partyId,
          relationshipId: prev.relationshipId,
          displayName,
          firstName,
          lastName,
          honorificTitle: c.honorificTitle !== undefined ? c.honorificTitle?.trim() || null : prev.honorificTitle,
          jobTitle: c.jobTitle !== undefined ? c.jobTitle?.trim() || null : prev.jobTitle,
          isPrimary: c.isPrimary,
          email: c.email !== undefined ? c.email.trim() || null : prev.email,
          phones: c.phones !== undefined ? validateAndNormalizePhoneList(c.phones, `${at}.phones`) : [...prev.phones],
        };
      }
      throw new ApiError(404, 'PARTY_NOT_FOUND', { contactPartyId: c.contactPartyId });
    }

    const firstName = c.firstName?.trim() ?? '';
    if (!firstName) {
      throw new ApiError(422, 'LEAD_CONTACT_NAME_REQUIRED');
    }
    assertMaxLen(firstName, LEAD_LIMITS.name, `${at}.firstName`);
    assertMaxLen(c.lastName, LEAD_LIMITS.name, `${at}.lastName`);
    assertEmailFormat(c.email, `${at}.email`);
    const lastName = c.lastName?.trim() || null;
    const phones = c.phones !== undefined ? validateAndNormalizePhoneList(c.phones, `${at}.phones`) : [];
    const email = c.email?.trim() || null;
    return {
      partyId: fakeId(),
      relationshipId: fakeId(),
      displayName: [firstName, lastName].filter(Boolean).join(' '),
      firstName,
      lastName,
      honorificTitle: c.honorificTitle?.trim() || null,
      jobTitle: c.jobTitle?.trim() || null,
      isPrimary: c.isPrimary,
      email,
      phones,
    };
  });
}

function validateBranchAndOwner(
  branchId: string,
  ownerUserId: string | null,
  operation: 'create' | 'update',
): OwnerRecord | null {
  const scope = CAPABILITIES_BY_BRANCH[branchId]?.leads[operation] ?? null;
  if (!scope) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }
  if (!ownerUserId) return null;

  const allowedBranchOwners = BRANCH_OWNER_IDS[branchId] ?? [];
  if (!allowedBranchOwners.includes(ownerUserId)) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }
  if (scope.ownerUserIds && !scope.ownerUserIds.includes(ownerUserId)) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }
  const owner = OWNER_RECORDS[ownerUserId];
  if (!owner) throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  return owner;
}

/** GET /api/tenant/crm/v1/leads/:id */
export async function fakeGetLead(id: string): Promise<LeadDetail> {
  await fakeDelay();
  const found = leads.find((item) => item.id === id);
  if (!found) throw new ApiError(404, 'LEAD_NOT_FOUND');
  return clone(found);
}

/** POST /api/tenant/crm/v1/leads (header: x-idempotency-key) */
export async function fakeCreateLead(body: CreateLeadBody, idempotencyKey: string): Promise<LeadDetail> {
  await fakeDelay();

  if (!idempotencyKey || !UUID_RE.test(idempotencyKey)) {
    throw new ApiError(400, 'GW.IDEM.MISSING');
  }

  const bodyKey = canonicalJson(body);
  const previous = idempotencyStore.get(idempotencyKey);
  if (previous) {
    if (previous.bodyKey !== bodyKey) {
      throw new ApiError(422, 'GW.IDEM.MISMATCH');
    }
    return clone(previous.result);
  }

  assertAllowedKeys(body, CREATE_ALLOWED_KEYS);
  if (body.leadProfileType !== 'INDIVIDUAL' && body.leadProfileType !== 'CORPORATE') {
    throw validationFailed('leadProfileType');
  }

  const isCorporate = body.leadProfileType === 'CORPORATE';

  if (isCorporate && (body.email !== undefined || body.phones !== undefined)) {
    throw new ApiError(422, 'LEAD_INDIVIDUAL_FIELDS_FORBIDDEN');
  }
  if (
    !isCorporate &&
    (body.existingCompanyPartyId !== undefined ||
      body.companyName !== undefined ||
      body.legalName !== undefined ||
      body.taxNumber !== undefined ||
      body.commercialRegistrationNumber !== undefined ||
      body.companyPhones !== undefined ||
      body.companyEmail !== undefined ||
      body.companyWebsite !== undefined ||
      body.contacts !== undefined)
  ) {
    throw new ApiError(422, 'LEAD_CORPORATE_FIELDS_FORBIDDEN');
  }

  if (body.ownerUserId !== undefined && (body.ownerUserId === null || typeof body.ownerUserId !== 'string' || !body.ownerUserId.trim())) {
    throw validationFailed('ownerUserId');
  }

  if (isCorporate) {
    const hasExisting = !!body.existingCompanyPartyId?.trim();
    const hasName = !!body.companyName?.trim();
    if (!hasExisting && !hasName) {
      throw new ApiError(422, 'LEAD_COMPANY_NAME_REQUIRED');
    }
    if (!body.contacts || body.contacts.length === 0) {
      throw new ApiError(422, 'LEAD_CONTACT_REQUIRED');
    }
    if (
      hasExisting &&
      (body.companyName !== undefined ||
        body.legalName !== undefined ||
        body.taxNumber !== undefined ||
        body.commercialRegistrationNumber !== undefined ||
        body.companyPhones !== undefined ||
        body.companyEmail !== undefined ||
        body.companyWebsite !== undefined ||
        body.address !== undefined)
    ) {
      throw new ApiError(422, 'LEAD_EXISTING_COMPANY_FIELDS_FORBIDDEN');
    }
    if (!hasExisting) {
      assertMaxLen(body.companyName, LEAD_LIMITS.company, 'companyName');
      assertMaxLen(body.legalName, LEAD_LIMITS.company, 'legalName');
      assertMaxLen(body.taxNumber, LEAD_LIMITS.tax, 'taxNumber');
      assertMaxLen(body.commercialRegistrationNumber, LEAD_LIMITS.tax, 'commercialRegistrationNumber');
      assertEmailFormat(body.companyEmail, 'companyEmail');
      assertWebsiteFormat(body.companyWebsite, 'companyWebsite');
    }
  } else {
    if (!body.firstName?.trim()) {
      throw validationFailed('firstName');
    }
    assertMaxLen(body.firstName, LEAD_LIMITS.name, 'firstName');
    assertMaxLen(body.lastName, LEAD_LIMITS.name, 'lastName');
    assertMaxLen(body.honorificTitle, LEAD_LIMITS.honorific, 'honorificTitle');
    assertEmailFormat(body.email, 'email');
  }

  assertMaxLen(body.description, LEAD_LIMITS.description, 'description');
  assertMaxLen(body.interestSummary, LEAD_LIMITS.longText, 'interestSummary');
  assertMaxLen(body.expectedNeed, LEAD_LIMITS.longText, 'expectedNeed');

  const phones = !isCorporate && body.phones !== undefined ? validateAndNormalizePhoneList(body.phones, 'phones') : [];
  const companyPhones =
    isCorporate && body.companyPhones !== undefined ? validateAndNormalizePhoneList(body.companyPhones, 'companyPhones') : [];

  const branchId = body.branchId?.trim() ?? '';
  const owner = validateBranchAndOwner(branchId, body.ownerUserId?.trim() || FAKE_CURRENT_USER_ID, 'create');

  let source: SourceOption | null = null;
  if (body.acquisitionSourceId?.trim()) {
    source = SOURCES.find((s) => s.id === body.acquisitionSourceId!.trim()) ?? null;
    if (!source) throw new ApiError(404, 'CRM_ACQUISITION_SOURCE_NOT_FOUND');
  }

  const stageId = body.stageId?.trim() || 'stage-new';
  const stage = STAGES.find((s) => s.id === stageId && s.isActive);
  if (!stage) throw new ApiError(422, 'LEAD_STAGE_INVALID');
  if (stage.flag === 'DISQUALIFIED') throw new ApiError(422, 'LEAD_CREATE_DISQUALIFIED');
  if (stage.flag === 'CONVERTED') throw new ApiError(422, 'LEAD_CONVERSION_REQUIRED');

  let existingCompany: SeedCompanyRecord | null = null;
  if (isCorporate && body.existingCompanyPartyId?.trim()) {
    existingCompany = existingOrganization(body.existingCompanyPartyId.trim(), branchId);
    const openExists = leads.some(
      (l) =>
        l.branchId === branchId &&
        l.status === 'OPEN' &&
        (l.partyId === existingCompany!.id ||
          (l.leadProfileType === 'CORPORATE' &&
            l.companyName?.toLowerCase() === existingCompany!.displayName.toLowerCase())),
    );
    if (openExists) {
      throw new ApiError(409, 'LEAD_OPEN_EXISTS');
    }
  }

  const contacts = isCorporate ? validateAndBuildContacts(body.contacts ?? [], existingCompany) : [];
  const customFields = validateCustomFields(body.customFields ?? {}, 'create');
  const tags = await resolveTags(body.tagIds);

  const rating = body.rating ?? 0;
  const cardColor = body.cardColor ?? null;
  validateRatingAndColor(rating, cardColor);

  const { expectedValue, currencyCode } = expectedValuePair({ expectedValue: body.expectedValue, currencyCode: body.currencyCode });

  const address = isCorporate && existingCompany ? null : validateAndBuildAddress(body.address);

  const candidatePhones: string[] = [...phones, ...companyPhones];
  const candidateEmails: string[] = [];
  const email = !isCorporate ? body.email?.trim() || null : null;
  const companyEmail = isCorporate && !existingCompany ? body.companyEmail?.trim() || null : null;
  if (email) candidateEmails.push(email);
  if (companyEmail) candidateEmails.push(companyEmail);

  for (let i = 0; i < (body.contacts?.length ?? 0); i++) {
    const rawContact = body.contacts![i];
    if (!rawContact.contactPartyId) {
      const builtContact = contacts[i];
      candidatePhones.push(...builtContact.phones);
      if (builtContact.email) candidateEmails.push(builtContact.email);
    }
  }

  assertNoTenantDuplicateMethods(candidatePhones, candidateEmails, existingCompany?.id ?? null);
  assertNoIntraLeadDuplicateMethods(
    [...phones, ...companyPhones, ...contacts.flatMap((c) => c.phones)],
    [email, companyEmail, ...contacts.map((c) => c.email)].filter((e): e is string => !!e),
  );

  const now = new Date().toISOString();
  const firstName = !isCorporate ? body.firstName!.trim() : null;
  const lastName = !isCorporate ? body.lastName?.trim() || null : null;
  const companyName = isCorporate
    ? existingCompany
      ? existingCompany.displayName
      : body.companyName!.trim()
    : null;
  const displayName = isCorporate ? companyName! : [firstName, lastName].filter(Boolean).join(' ');
  const created: LeadDetail = {
    id: fakeId(),
    branchId,
    partyId: existingCompany ? existingCompany.id : fakeId(),
    leadProfileType: body.leadProfileType,
    displayName,
    companyName,
    legalName: isCorporate ? (existingCompany ? existingCompany.legalName : body.legalName?.trim() || null) : null,
    taxNumber: isCorporate && !existingCompany ? body.taxNumber?.trim() || null : null,
    commercialRegistrationNumber:
      isCorporate && !existingCompany ? body.commercialRegistrationNumber?.trim() || null : null,
    companyPhone: companyPhones[0] ?? null,
    companyPhones,
    companyEmail,
    companyWebsite: isCorporate && !existingCompany ? body.companyWebsite?.trim() || null : null,
    existingCompany: !!existingCompany,
    firstName,
    lastName,
    honorificTitle: !isCorporate ? body.honorificTitle?.trim() || null : null,
    email,
    primaryMobile: phones[0] ?? null,
    phones,
    stageId: stage.id,
    stageFlag: stage.flag,
    status: statusOf(stage.flag),
    rating,
    cardColor,
    ownerUserId: owner?.id ?? null,
    owner: owner ? { userId: owner.id, firstName: owner.firstName, lastName: owner.lastName } : null,
    nextActivity: null,
    acquisitionSourceId: source?.id ?? null,
    acquisitionSource: source ? { id: source.id, nameEn: source.nameEn, nameAr: source.nameAr } : null,
    address,
    primaryContact: primaryContactOf(contacts),
    contacts,
    description: body.description?.trim() || null,
    interestSummary: body.interestSummary?.trim() || null,
    expectedNeed: body.expectedNeed?.trim() || null,
    expectedValue,
    currencyCode,
    customFields,
    tags,
    createdAt: now,
    updatedAt: now,
  };

  leads = [created, ...leads];
  idempotencyStore.set(idempotencyKey, { bodyKey, result: clone(created) });
  return clone(created);
}

/** PATCH /api/tenant/crm/v1/leads/:id */
export async function fakePatchLead(id: string, body: UpdateLeadBody): Promise<LeadDetail> {
  await fakeDelay();

  for (const key of Object.keys(body)) {
    if (PATCH_FORBIDDEN_KEYS.has(key) || !PATCH_ALLOWED_KEYS.has(key)) {
      throw validationFailed(key);
    }
  }

  if (body.ownerUserId !== undefined && (body.ownerUserId === null || typeof body.ownerUserId !== 'string' || !body.ownerUserId.trim())) {
    throw validationFailed('ownerUserId');
  }

  const existing = patchableLead(id, body.expectedUpdatedAt);

  const isCorporate = existing.leadProfileType === 'CORPORATE';
  if (isCorporate && (body.email !== undefined || body.phones !== undefined)) {
    throw new ApiError(422, 'LEAD_INDIVIDUAL_FIELDS_FORBIDDEN');
  }
  if (
    !isCorporate &&
    (body.companyName !== undefined ||
      body.legalName !== undefined ||
      body.taxNumber !== undefined ||
      body.commercialRegistrationNumber !== undefined ||
      body.companyPhones !== undefined ||
      body.companyEmail !== undefined ||
      body.companyWebsite !== undefined ||
      body.contacts !== undefined)
  ) {
    throw new ApiError(422, 'LEAD_CORPORATE_FIELDS_FORBIDDEN');
  }

  if (isCorporate && existing.existingCompany) {
    if (
      body.companyName !== undefined ||
      body.legalName !== undefined ||
      body.taxNumber !== undefined ||
      body.commercialRegistrationNumber !== undefined ||
      body.companyPhones !== undefined ||
      body.companyEmail !== undefined ||
      body.companyWebsite !== undefined ||
      body.address !== undefined
    ) {
      throw new ApiError(422, 'LEAD_EXISTING_COMPANY_FIELDS_FORBIDDEN');
    }
  }

  const nextOwnerId = body.ownerUserId !== undefined ? body.ownerUserId.trim() : existing.ownerUserId;
  const owner = validateBranchAndOwner(existing.branchId, nextOwnerId, 'update');

  if (!isCorporate) {
    if (body.firstName !== undefined) assertMaxLen(body.firstName, LEAD_LIMITS.name, 'firstName');
    if (body.lastName !== undefined) assertMaxLen(body.lastName, LEAD_LIMITS.name, 'lastName');
    if (body.honorificTitle !== undefined) assertMaxLen(body.honorificTitle, LEAD_LIMITS.honorific, 'honorificTitle');
    if (body.email !== undefined) assertEmailFormat(body.email, 'email');
  } else if (!existing.existingCompany) {
    if (body.companyName !== undefined) assertMaxLen(body.companyName, LEAD_LIMITS.company, 'companyName');
    if (body.legalName !== undefined) assertMaxLen(body.legalName, LEAD_LIMITS.company, 'legalName');
    if (body.taxNumber !== undefined) assertMaxLen(body.taxNumber, LEAD_LIMITS.tax, 'taxNumber');
    if (body.commercialRegistrationNumber !== undefined) {
      assertMaxLen(body.commercialRegistrationNumber, LEAD_LIMITS.tax, 'commercialRegistrationNumber');
    }
    if (body.companyEmail !== undefined) assertEmailFormat(body.companyEmail, 'companyEmail');
    if (body.companyWebsite !== undefined) assertWebsiteFormat(body.companyWebsite, 'companyWebsite');
  }
  if (body.description !== undefined) assertMaxLen(body.description, LEAD_LIMITS.description, 'description');
  if (body.interestSummary !== undefined) assertMaxLen(body.interestSummary, LEAD_LIMITS.longText, 'interestSummary');
  if (body.expectedNeed !== undefined) assertMaxLen(body.expectedNeed, LEAD_LIMITS.longText, 'expectedNeed');

  let nextSource = existing.acquisitionSource;
  let nextSourceId = existing.acquisitionSourceId;
  if (body.acquisitionSourceId !== undefined) {
    nextSourceId = body.acquisitionSourceId?.trim() || null;
    if (nextSourceId) {
      const found = SOURCES.find((s) => s.id === nextSourceId);
      if (!found) throw new ApiError(404, 'CRM_ACQUISITION_SOURCE_NOT_FOUND');
      nextSource = { id: found.id, nameEn: found.nameEn, nameAr: found.nameAr };
    } else {
      nextSource = null;
    }
  }

  const nextTags = body.tagIds !== undefined ? await resolveTags(body.tagIds) : existing.tags;
  const nextRating = body.rating !== undefined ? body.rating : existing.rating;
  const nextCardColor = body.cardColor !== undefined ? body.cardColor : existing.cardColor;
  validateRatingAndColor(nextRating, nextCardColor);

  const nextPhones =
    !isCorporate && body.phones !== undefined ? validateAndNormalizePhoneList(body.phones, 'phones') : existing.phones;
  const nextCompanyPhones =
    isCorporate && body.companyPhones !== undefined
      ? validateAndNormalizePhoneList(body.companyPhones, 'companyPhones')
      : existing.companyPhones;

  const nextFirstName = !isCorporate
    ? body.firstName !== undefined
      ? body.firstName.trim()
      : existing.firstName
    : null;
  if (!isCorporate && !nextFirstName) {
    throw validationFailed('firstName');
  }
  const nextLastName = !isCorporate
    ? body.lastName !== undefined
      ? body.lastName?.trim() || null
      : existing.lastName
    : null;
  const nextHonorific = !isCorporate
    ? body.honorificTitle !== undefined
      ? body.honorificTitle?.trim() || null
      : existing.honorificTitle
    : null;
  const nextEmail = !isCorporate ? (body.email !== undefined ? body.email?.trim() || null : existing.email) : null;

  const nextCompanyName = isCorporate
    ? body.companyName !== undefined
      ? body.companyName.trim()
      : existing.companyName
    : null;
  if (isCorporate && !existing.existingCompany && !nextCompanyName) {
    throw new ApiError(422, 'LEAD_COMPANY_NAME_REQUIRED');
  }

  const nextLegalName = isCorporate
    ? body.legalName !== undefined
      ? body.legalName?.trim() || null
      : existing.legalName
    : null;
  const nextTax = isCorporate
    ? body.taxNumber !== undefined
      ? body.taxNumber?.trim() || null
      : existing.taxNumber
    : null;
  const nextCr = isCorporate
    ? body.commercialRegistrationNumber !== undefined
      ? body.commercialRegistrationNumber?.trim() || null
      : existing.commercialRegistrationNumber
    : null;
  const nextCompanyEmail = isCorporate
    ? body.companyEmail !== undefined
      ? body.companyEmail?.trim() || null
      : existing.companyEmail
    : null;
  const nextWebsite = isCorporate
    ? body.companyWebsite !== undefined
      ? body.companyWebsite?.trim() || null
      : existing.companyWebsite
    : null;

  const existingCompany = existing.existingCompany ? COMPANY_DIRECTORY.get(existing.partyId) ?? null : null;
  const nextContacts =
    isCorporate && body.contacts !== undefined
      ? validateAndBuildContacts(body.contacts, existingCompany, existing.contacts)
      : existing.contacts;

  const mergedCustomRaw: Record<string, unknown> = { ...existing.customFields };
  if (body.customFields !== undefined) {
    for (const [k, v] of Object.entries(body.customFields)) {
      if (v === null || v === undefined) {
        delete mergedCustomRaw[k];
      } else {
        mergedCustomRaw[k] = v;
      }
    }
  }
  const nextCustomFields =
    body.customFields !== undefined ? validateCustomFields(mergedCustomRaw, 'update') : existing.customFields;

  const money =
    body.expectedValue !== undefined || body.currencyCode !== undefined
      ? expectedValuePair({ expectedValue: body.expectedValue, currencyCode: body.currencyCode }, existing)
      : { expectedValue: existing.expectedValue, currencyCode: existing.currencyCode };

  const nextAddress = body.address !== undefined ? validateAndBuildAddress(body.address) : existing.address;

  const candidatePhones: string[] = [];
  const candidateEmails: string[] = [];
  if (body.phones !== undefined) candidatePhones.push(...nextPhones);
  if (body.companyPhones !== undefined) candidatePhones.push(...nextCompanyPhones);
  if (body.email !== undefined && nextEmail) candidateEmails.push(nextEmail);
  if (body.companyEmail !== undefined && nextCompanyEmail) candidateEmails.push(nextCompanyEmail);
  if (body.contacts !== undefined) {
    for (let i = 0; i < body.contacts.length; i++) {
      if (!body.contacts[i].contactPartyId) {
        candidatePhones.push(...nextContacts[i].phones);
        if (nextContacts[i].email) candidateEmails.push(nextContacts[i].email!);
      }
    }
  }
  assertNoTenantDuplicateMethods(candidatePhones, candidateEmails, existing.partyId);
  if (
    body.phones !== undefined ||
    body.companyPhones !== undefined ||
    body.email !== undefined ||
    body.companyEmail !== undefined ||
    body.contacts !== undefined
  ) {
    assertNoIntraLeadDuplicateMethods(
      [...nextPhones, ...nextCompanyPhones, ...nextContacts.flatMap((c) => c.phones)],
      [nextEmail, nextCompanyEmail, ...nextContacts.map((c) => c.email)].filter((e): e is string => !!e),
    );
  }

  const displayName = isCorporate
    ? nextCompanyName ?? existing.displayName
    : [nextFirstName, nextLastName].filter(Boolean).join(' ');

  const updated: LeadDetail = {
    ...existing,
    displayName,
    companyName: nextCompanyName,
    legalName: nextLegalName,
    taxNumber: nextTax,
    commercialRegistrationNumber: nextCr,
    companyPhone: nextCompanyPhones[0] ?? null,
    companyPhones: nextCompanyPhones,
    companyEmail: nextCompanyEmail,
    companyWebsite: nextWebsite,
    firstName: nextFirstName,
    lastName: nextLastName,
    honorificTitle: nextHonorific,
    email: nextEmail,
    primaryMobile: nextPhones[0] ?? null,
    phones: nextPhones,
    rating: nextRating,
    cardColor: nextCardColor,
    ownerUserId: owner?.id ?? null,
    owner: owner ? { userId: owner.id, firstName: owner.firstName, lastName: owner.lastName } : null,
    acquisitionSourceId: nextSourceId,
    acquisitionSource: nextSource,
    address: nextAddress,
    primaryContact: primaryContactOf(nextContacts),
    contacts: nextContacts,
    description: body.description !== undefined ? body.description?.trim() || null : existing.description,
    interestSummary:
      body.interestSummary !== undefined ? body.interestSummary?.trim() || null : existing.interestSummary,
    expectedNeed: body.expectedNeed !== undefined ? body.expectedNeed?.trim() || null : existing.expectedNeed,
    expectedValue: money.expectedValue,
    currencyCode: money.currencyCode,
    customFields: nextCustomFields,
    tags: nextTags,
    updatedAt: new Date().toISOString(),
  };

  leads = leads.map((item) => (item.id === id ? updated : item));
  return clone(updated);
}

/** PATCH /api/tenant/crm/v1/leads/:id { rating } */
export async function fakeSetLeadRating(id: string, rating: number): Promise<LeadDetail> {
  await fakeDelay();
  validateRatingAndColor(rating, undefined);
  const existing = patchableLead(id, undefined);

  const updated: LeadDetail = { ...existing, rating, updatedAt: new Date().toISOString() };
  leads = leads.map((item) => (item.id === id ? updated : item));
  return clone(updated);
}

/** PATCH /api/tenant/crm/v1/leads/:id { cardColor } */
export async function fakeSetLeadColor(id: string, cardColor: CardColor | null): Promise<LeadDetail> {
  await fakeDelay();
  validateRatingAndColor(undefined, cardColor);
  const existing = patchableLead(id, undefined);

  const updated: LeadDetail = { ...existing, cardColor, updatedAt: new Date().toISOString() };
  leads = leads.map((item) => (item.id === id ? updated : item));
  return clone(updated);
}

/**
 * POST /leads/duplicate-check (lead-insights.service checkDuplicates): { matches }. Fake duplicate
 * policy: a repeated phone or email blocks inside the request branch, at SAME_OWNER when the
 * probe's owner (or the current user) already owns a lead on the party, else BRANCH.
 */
export async function fakeCheckLeadDuplicates(probe: DuplicateCheckPayload): Promise<DuplicateCheckResponse> {
  await fakeDelay();

  const name = probe.name?.trim().toLowerCase() ?? '';
  const email = probe.email?.trim().toLowerCase() ?? '';
  const tax = probe.taxNumber?.trim().toLowerCase() ?? '';
  const cr = probe.commercialRegistrationNumber?.trim().toLowerCase() ?? '';
  const phones = (probe.phones ?? [])
    .map((p) => normalizePhone(p))
    .filter((p) => phoneDigitsCount(p) >= 5);

  if (!name && !email && !tax && !cr && phones.length === 0) {
    throw new ApiError(422, 'LEAD_DUPLICATE_CHECK_EMPTY');
  }

  const ownerUserId = probe.ownerUserId ?? FAKE_CURRENT_USER_ID;
  const parties = new Map<string, { matchTypes: Set<DuplicateMatchType>; methodTypes: Set<string>; leads: LeadDetail[] }>();

  for (const lead of leads) {
    if (probe.excludePartyId && lead.partyId === probe.excludePartyId) continue;
    const methods = collectPartyMethods(lead);
    const hits: DuplicateMatchType[] = [];
    if (tax && lead.taxNumber?.trim().toLowerCase() === tax) hits.push('TAX_NUMBER');
    if (cr && lead.commercialRegistrationNumber?.trim().toLowerCase() === cr) hits.push('COMMERCIAL_REGISTRATION');
    if (phones.some((p) => methods.phones.has(p))) hits.push('PHONE');
    if (email && methods.emails.has(email)) hits.push('EMAIL');
    if (name && (lead.displayName.trim().toLowerCase() === name || lead.companyName?.trim().toLowerCase() === name)) {
      hits.push('NAME');
    }
    if (hits.length === 0) continue;

    let party = parties.get(lead.partyId);
    if (!party) {
      if (parties.size >= 20) continue;
      party = { matchTypes: new Set(), methodTypes: new Set(), leads: [] };
      parties.set(lead.partyId, party);
    }
    for (const hit of hits) {
      party.matchTypes.add(hit);
      if (hit === 'PHONE' || hit === 'EMAIL') party.methodTypes.add(hit);
    }
    party.leads.push(lead);
  }

  const matches = Array.from(parties.entries()).map(([partyId, party]): DuplicateMatch => {
    const first = party.leads[0];
    const partyVisible = first.branchId === probe.branchId;
    const visibleLeads = party.leads
      .filter((lead) => lead.branchId === probe.branchId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const level: DuplicateLevel = visibleLeads.some((lead) => lead.ownerUserId === ownerUserId) ? 'SAME_OWNER' : 'BRANCH';
    const contactMethods: DuplicateContactMethodHit[] = Array.from(party.methodTypes).map((methodType) => ({
      methodType,
      wouldBlock: partyVisible,
      level,
    }));
    const wouldBlock = contactMethods.some((method) => method.wouldBlock);
    return {
      contactMethods,
      wouldBlock,
      level: wouldBlock ? level : null,
      partyId,
      displayName: partyVisible ? first.displayName : null,
      partyType: first.leadProfileType === 'CORPORATE' ? 'ORGANIZATION' : 'PERSON',
      matchTypes: Array.from(party.matchTypes),
      leads: visibleLeads.slice(0, 5).map((lead) => ({
        id: lead.id,
        stageId: lead.stageId,
        stageFlag: lead.stageFlag,
        status: lead.status,
        ownerUserId: lead.ownerUserId,
      })),
      restricted: !partyVisible || visibleLeads.length < party.leads.length,
    };
  });
  return { matches };
}

/** GET /api/tenant/crm/v1/leads/capabilities?branchId=:branchId */
export async function fakeGetLeadCapabilities(branchId: string): Promise<LeadsCapabilities> {
  await fakeDelay();
  return clone(CAPABILITIES_BY_BRANCH[branchId] ?? capabilitiesFor(branchId, null, false));
}

/** GET /api/tenant/crm/v1/leads/company-options */
export async function fakeListCompanyOptions(branchId: string, search: string): Promise<CompanyOption[]> {
  await fakeDelay();
  const term = search.trim().toLowerCase();
  const out: CompanyOption[] = [];
  for (const company of COMPANY_DIRECTORY.values()) {
    if (company.status !== 'ACTIVE') continue;
    if (branchId && company.branchId !== null && company.branchId !== branchId) continue;
    if (
      term &&
      !company.displayName.toLowerCase().includes(term) &&
      !(company.legalName?.toLowerCase().includes(term) ?? false)
    ) {
      continue;
    }
    out.push({
      id: company.id,
      displayName: company.displayName,
      legalName: company.legalName,
      branchId: company.branchId,
    });
    if (out.length >= 50) break;
  }
  return out;
}

/** GET /api/tenant/crm/v1/leads/company-options/:companyPartyId/contacts?branchId=:branchId */
export async function fakeListCompanyContacts(
  branchId: string,
  companyPartyId: string,
): Promise<CompanyContactOption[]> {
  await fakeDelay();
  return clone(existingOrganization(companyPartyId, branchId).contacts);
}

/** GET /api/tenant/core/v1/branches */
export async function fakeListLeadBranches(): Promise<BranchOption[]> {
  await fakeDelay();
  return clone(BRANCHES);
}

/** GET /api/tenant/crm/v1/assignable-owners?branchId=&resource=leads&action=: AssignableOwnersPageDto. */
export async function fakeListBranchOwners(
  branchId: string,
  action: 'create' | 'update',
): Promise<{ items: OwnerOption[]; nextCursor: string | null }> {
  await fakeDelay();
  const scope = CAPABILITIES_BY_BRANCH[branchId]?.leads[action] ?? null;
  if (!scope) throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  const items = (BRANCH_OWNER_IDS[branchId] ?? [])
    .filter((id) => !scope.ownerUserIds || scope.ownerUserIds.includes(id))
    .map((id) => OWNER_RECORDS[id])
    .filter((o): o is OwnerRecord => !!o)
    .map((o) => ({ id: o.id, displayName: o.displayName, avatarUrl: o.avatarUrl }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  return { items, nextCursor: null };
}

/** GET /api/tenant/crm/v1/lead-sources */
export async function fakeListLeadSources(): Promise<SourceOption[]> {
  await fakeDelay();
  if (FAKE_NO_SOURCE_PERMISSION) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }
  return clone(SOURCES);
}

/** GET /api/tenant/crm/v1/lead-stages */
export async function fakeListLeadStages(): Promise<LeadStage[]> {
  await fakeDelay();
  return clone(STAGES);
}

/** GET /api/tenant/core/v1/currencies */
export async function fakeListLeadCurrencies(): Promise<CurrencyOption[]> {
  await fakeDelay();
  return clone(CURRENCIES);
}

/** GET /api/tenant/crm/v1/custom-fields?ownerType=LEAD */
export async function fakeListLeadCustomFields(): Promise<LeadCustomField[]> {
  await fakeDelay();
  if (FAKE_NO_CUSTOM_FIELD_PERMISSION) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }
  return clone([...CUSTOM_FIELDS].sort((a, b) => a.sortOrder - b.sortOrder));
}

// --- Lead Bulk Fake API ---

export let FAKE_SELECTION_TOTAL_OVERRIDE = 0;
export let FAKE_BULK_FAIL_CHUNK = -1;

const BULK_MAX_IDS = 100;

interface BulkIdemEntry {
  bodyKey: string;
  results: unknown;
}

const bulkIdempotencyStore = new Map<string, BulkIdemEntry>();
const failedChunkKeys = new Set<string>();
let currentBulkChunkIndex: number | null = null;
let fallbackChunkCounter = 0;

export function setCurrentBulkChunkIndex(index: number | null): void {
  currentBulkChunkIndex = index;
  if (index === null) {
    fallbackChunkCounter = 0;
  }
}

function maybeFailSimulatedChunk(idempotencyKey: string): void {
  const chunkIdx = currentBulkChunkIndex ?? fallbackChunkCounter++;
  if (FAKE_BULK_FAIL_CHUNK >= 0 && chunkIdx === FAKE_BULK_FAIL_CHUNK && !failedChunkKeys.has(idempotencyKey)) {
    failedChunkKeys.add(idempotencyKey);
    FAKE_BULK_FAIL_CHUNK = -1;
    throw new ApiError(503, 'SERVER_ERROR');
  }
}

function checkBulkIdempotency<T>(idempotencyKey: string, bodyKey: string): T | null {
  if (!idempotencyKey || !UUID_RE.test(idempotencyKey)) {
    throw new ApiError(400, 'GW.IDEM.MISSING');
  }
  const existing = bulkIdempotencyStore.get(idempotencyKey);
  if (!existing) return null;
  if (existing.bodyKey !== bodyKey) {
    throw new ApiError(422, 'GW.IDEM.MISMATCH');
  }
  return clone(existing.results as T);
}

function validateBulkLeadIds(leadIds: string[]): void {
  if (!Array.isArray(leadIds) || leadIds.length === 0 || leadIds.length > BULK_MAX_IDS) {
    throw validationFailed('leadIds');
  }
  const seen = new Set<string>();
  for (const id of leadIds) {
    if (typeof id !== 'string' || !id.trim() || seen.has(id)) {
      throw validationFailed('leadIds');
    }
    seen.add(id);
  }
}

function isEvery37thLeadId(leadId: string, index: number): boolean {
  const match = /^lead-(\d+)$/i.exec(leadId);
  if (match) {
    const num = Number(match[1]);
    return num > 0 && num % 37 === 0;
  }
  return (index + 1) % 37 === 0;
}

export type BulkItemStatus = 'UPDATED' | 'UNCHANGED' | 'DELETED' | 'CREATED' | 'FAILED' | 'SKIPPED';

export interface BulkItemResult {
  leadId: string;
  status: BulkItemStatus;
  code?: string;
  skipReason?: 'CONVERTED' | 'NO_OWNER' | 'NOT_ALLOWED';
}

export interface BatchActivityCommon {
  type: ActivityType;
  subject: string;
  description?: string | null;
  direction?: ActivityDirection | null;
  priority?: ActivityPriority;
  reminderOffsetMinutes?: number | null;
  location?: string | null;
  meetingUrl?: string | null;
}

export interface BatchActivityItem {
  target: { app: 'CRM'; type: 'LEAD'; id: string };
  dueAt: string;
  endsAt?: string | null;
  assigneeUserId?: string;
}

function toSelectedRowFromDetail(detail: LeadDetail): SelectedRow {
  return {
    id: detail.id,
    displayName: detail.displayName,
    ownerUserId: detail.ownerUserId,
    stageId: detail.stageId,
    stageFlag: detail.stageFlag,
    status: detail.status,
    updatedAt: detail.updatedAt,
  };
}

/** POST /api/tenant/crm/v1/leads/selection */
export async function fakeSelectLeads(
  body: LeadListSearchBody,
  limit = SELECTION_LIMIT,
): Promise<{ items: SelectedRow[]; total: number; truncated: boolean }> {
  await fakeDelay();
  const detailById = new Map(leads.map((detail) => [detail.id, detail]));
  const matched = matching(body)
    .map((row) => detailById.get(row.id))
    .filter((detail): detail is LeadDetail => !!detail)
    .map(toSelectedRowFromDetail);
  const total = FAKE_SELECTION_TOTAL_OVERRIDE > 0 ? FAKE_SELECTION_TOTAL_OVERRIDE : matched.length;
  const truncated = total > limit;
  return {
    items: clone(matched.slice(0, limit)),
    total,
    truncated,
  };
}

/** POST /api/tenant/crm/v1/leads/bulk-update */
export async function fakeBulkUpdate(
  leadIds: string[],
  ownerUserId: string,
  idempotencyKey: string,
): Promise<BulkItemResult[]> {
  await fakeDelay();
  maybeFailSimulatedChunk(idempotencyKey);

  const bodyKey = canonicalJson({ op: 'bulk-update', leadIds, ownerUserId });
  const replayed = checkBulkIdempotency<BulkItemResult[]>(idempotencyKey, bodyKey);
  if (replayed) return replayed;

  validateBulkLeadIds(leadIds);
  if (ownerUserId === undefined) {
    throw new ApiError(422, 'LEAD_BULK_UPDATE_EMPTY');
  }
  if (typeof ownerUserId !== 'string' || !ownerUserId.trim()) {
    throw validationFailed('ownerUserId');
  }
  const owner = OWNER_RECORDS[ownerUserId.trim()];
  if (!owner) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }

  const nowIso = new Date().toISOString();
  const updatedById = new Map<string, LeadDetail>();
  const results: BulkItemResult[] = [];

  for (const leadId of leadIds) {
    const existing = leads.find((item) => item.id === leadId);
    if (!existing) {
      results.push({ leadId, status: 'FAILED', code: 'LEAD_NOT_FOUND' });
      continue;
    }
    if (existing.status === 'CONVERTED') {
      results.push({ leadId, status: 'FAILED', code: 'LEAD_ALREADY_CONVERTED' });
      continue;
    }
    const allowedInBranch = BRANCH_OWNER_IDS[existing.branchId] ?? [];
    if (!allowedInBranch.includes(owner.id)) {
      throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
    }
    if (existing.ownerUserId === owner.id) {
      results.push({ leadId, status: 'UNCHANGED' });
      continue;
    }
    updatedById.set(leadId, {
      ...existing,
      ownerUserId: owner.id,
      owner: { userId: owner.id, firstName: owner.firstName, lastName: owner.lastName },
      updatedAt: nowIso,
    });
    results.push({ leadId, status: 'UPDATED' });
  }

  if (updatedById.size > 0) {
    leads = leads.map((item) => updatedById.get(item.id) ?? item);
  }

  bulkIdempotencyStore.set(idempotencyKey, { bodyKey, results: clone(results) });
  return clone(results);
}

/** POST /api/tenant/crm/v1/leads/bulk-stage */
export async function fakeBulkStage(
  leadIds: string[],
  stageId: string,
  reasonId: string | null,
  idempotencyKey: string,
): Promise<BulkItemResult[]> {
  await fakeDelay();
  maybeFailSimulatedChunk(idempotencyKey);

  const bodyKey = canonicalJson({ op: 'bulk-stage', leadIds, stageId, reasonId });
  const replayed = checkBulkIdempotency<BulkItemResult[]>(idempotencyKey, bodyKey);
  if (replayed) return replayed;

  validateBulkLeadIds(leadIds);

  const stage = STAGES.find((item) => item.id === stageId && item.isActive);
  if (!stage) {
    throw new ApiError(422, 'LEAD_STAGE_INVALID');
  }
  if (stage.flag === 'CONVERTED') {
    throw new ApiError(422, 'LEAD_CONVERSION_REQUIRED');
  }
  if (stage.flag === 'DISQUALIFIED') {
    if (!reasonId || !reasonId.trim()) {
      throw new ApiError(422, 'CRM_REASON_REQUIRED');
    }
    const activeReasons = await fakeListReasons('DISQUALIFICATION', true);
    if (!activeReasons.some((r) => r.id === reasonId.trim())) {
      throw new ApiError(422, 'CRM_REASON_REQUIRED');
    }
  }

  const nextStatus = statusOf(stage.flag);
  const nowIso = new Date().toISOString();
  const updatedById = new Map<string, LeadDetail>();
  const results: BulkItemResult[] = [];

  for (let index = 0; index < leadIds.length; index++) {
    const leadId = leadIds[index];
    const existing = leads.find((item) => item.id === leadId);
    if (!existing) {
      results.push({ leadId, status: 'FAILED', code: 'LEAD_NOT_FOUND' });
      continue;
    }
    if (existing.status === 'CONVERTED') {
      results.push({ leadId, status: 'FAILED', code: 'LEAD_ALREADY_CONVERTED' });
      continue;
    }
    if (nextStatus === 'OPEN' && isEvery37thLeadId(leadId, index)) {
      results.push({ leadId, status: 'FAILED', code: 'LEAD_OPEN_EXISTS' });
      continue;
    }
    if (existing.stageId === stage.id) {
      results.push({ leadId, status: 'UNCHANGED' });
      continue;
    }
    updatedById.set(leadId, {
      ...existing,
      stageId: stage.id,
      stageFlag: stage.flag,
      status: nextStatus,
      updatedAt: nowIso,
      ...( { stageEnteredAt: nowIso } as Partial<LeadDetail> ),
    });
    results.push({ leadId, status: 'UPDATED' });
  }

  if (updatedById.size > 0) {
    leads = leads.map((item) => updatedById.get(item.id) ?? item);
  }

  bulkIdempotencyStore.set(idempotencyKey, { bodyKey, results: clone(results) });
  return clone(results);
}

/** POST /api/tenant/crm/v1/leads/bulk-delete */
export async function fakeBulkDelete(
  leadIds: string[],
  reason: string | null,
  idempotencyKey: string,
): Promise<BulkItemResult[]> {
  await fakeDelay();
  maybeFailSimulatedChunk(idempotencyKey);

  const bodyKey = canonicalJson({ op: 'bulk-delete', leadIds, reason });
  const replayed = checkBulkIdempotency<BulkItemResult[]>(idempotencyKey, bodyKey);
  if (replayed) return replayed;

  validateBulkLeadIds(leadIds);

  const deletedIds = new Set<string>();
  const results: BulkItemResult[] = [];

  for (const leadId of leadIds) {
    const existing = leads.find((item) => item.id === leadId);
    if (!existing) {
      results.push({ leadId, status: 'FAILED', code: 'LEAD_NOT_FOUND' });
      continue;
    }
    deletedIds.add(leadId);
    results.push({ leadId, status: 'DELETED' });
  }

  if (deletedIds.size > 0) {
    leads = leads.filter((item) => !deletedIds.has(item.id));
  }

  bulkIdempotencyStore.set(idempotencyKey, { bodyKey, results: clone(results) });
  return clone(results);
}

/** POST /api/tenant/core/v1/activities/batch */
export async function fakeActivitiesBatch(
  common: BatchActivityCommon,
  items: BatchActivityItem[],
  idempotencyKey?: string,
): Promise<{ results: { index: number; status: 'CREATED' | 'FAILED'; activityId?: string; code?: string; field?: string }[] }> {
  if (idempotencyKey !== undefined) {
    maybeFailSimulatedChunk(idempotencyKey);
    const bodyKey = canonicalJson({ op: 'activities-batch', common, items });
    const replayed = checkBulkIdempotency<{
      results: { index: number; status: 'CREATED' | 'FAILED'; activityId?: string; code?: string; field?: string }[];
    }>(idempotencyKey, bodyKey);
    if (replayed) return replayed;
  }

  if (!Array.isArray(items) || items.length === 0 || items.length > BULK_MAX_IDS) {
    throw validationFailed('items');
  }

  const results = await Promise.all(
    items.map(async (item, index) => {
      try {
        const created = await fakeCreateActivity({
          ...common,
          target: item.target,
          dueAt: item.dueAt,
          endsAt: item.endsAt,
          assigneeUserId: item.assigneeUserId,
          status: 'PLANNED',
        });
        return { index, status: 'CREATED' as const, activityId: created.id };
      } catch (error) {
        if (error instanceof ActivityError) {
          return {
            index,
            status: 'FAILED' as const,
            code: error.code,
            ...(error.field ? { field: error.field } : {}),
          };
        }
        return { index, status: 'FAILED' as const, code: 'INTERNAL_ERROR' };
      }
    }),
  );

  const response = { results };
  if (idempotencyKey !== undefined) {
    const bodyKey = canonicalJson({ op: 'activities-batch', common, items });
    bulkIdempotencyStore.set(idempotencyKey, { bodyKey, results: clone(response) });
  }
  return response;
}

/** GET /api/tenant/crm/v1/assignable-owners?resource=leads&action=update */
export async function fakeListAssignableOwners(branchId: string): Promise<OwnerOption[]> {
  await fakeDelay();
  const ids = BRANCH_OWNER_IDS[branchId] ?? BRANCH_OWNER_IDS[MAIN_BRANCH_ID] ?? [];
  return ids
    .map((id) => OWNER_RECORDS[id])
    .filter((o): o is OwnerRecord => !!o)
    .map((o) => ({ id: o.id, displayName: o.displayName, avatarUrl: o.avatarUrl }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** GET /api/tenant/crm/v1/settings/reasons?kind=DISQUALIFICATION&active=true */
export async function fakeListDisqualificationReasons(): Promise<{ id: string; code: string; nameEn: string; nameAr: string }[]> {
  const reasons = await fakeListReasons('DISQUALIFICATION', true);
  return reasons.map((r) => ({ id: r.id, code: r.code, nameEn: r.nameEn, nameAr: r.nameAr }));
}

/** GET /api/tenant/crm/v1/settings/static-data (pagination) */
export async function fakeListPageSizes(): Promise<{ pageSizes: number[]; defaultPageSize: number }> {
  await fakeDelay();
  return {
    pageSizes: [...FALLBACK_PAGE_SIZES],
    defaultPageSize: 20,
  };
}

export function fakeGetOwnerDisplayName(ownerUserId: string): string | null {
  return OWNER_RECORDS[ownerUserId]?.displayName ?? null;
}

export function fakeOwnerNameMap(): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const owner of Object.values(OWNER_RECORDS)) {
    map.set(owner.id, owner.displayName);
  }
  return map;
}

export function fakeGetStageForBulk(stageId: string): LeadStage | null {
  return STAGES.find((stage) => stage.id === stageId) ?? null;
}

export function fakeIsAssignableOwnerInBranch(branchId: string | undefined, ownerUserId: string): boolean {
  const clean = ownerUserId.trim();
  if (!clean || !OWNER_RECORDS[clean]) return false;
  if (!branchId) return true;
  const allowed = BRANCH_OWNER_IDS[branchId] ?? [];
  return allowed.includes(clean);
}

export function fakeProjectCurrentLeads(
  entityIds: readonly string[],
): Map<string, Record<string, string | number | null>> {
  const idSet = new Set(entityIds);
  const map = new Map<string, Record<string, string | number | null>>();
  for (const lead of leads) {
    if (!idSet.has(lead.id)) continue;
    map.set(lead.id, {
      ownerUserId: lead.ownerUserId,
      stageId: lead.stageId,
      stageFlag: lead.stageFlag,
      status: lead.status,
      updatedAt: lead.updatedAt,
    });
  }
  return map;
}

export function fakeLeadPartyId(leadId: string): string | null {
  return leads.find((item) => item.id === leadId)?.partyId ?? null;
}

export function fakeCountLeadsForParty(partyId: string, excludeId?: string): number {
  const cleanParty = partyId.trim();
  if (!cleanParty) return 0;
  const cleanExclude = excludeId?.trim() || null;
  let count = 0;
  for (const detail of leads) {
    if (cleanExclude && detail.id === cleanExclude) continue;
    if (matchesParty(detail, cleanParty)) count++;
  }
  return count;
}
