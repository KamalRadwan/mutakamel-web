import { fakeChangeCustomerContact as changeCustomerContact } from './customers.fake';
/**
 * Contract spec: the customers fake against the crm-app backend contract
 * (crm/customer-profiles, crm/leads duplicate-check, crm/related-records,
 * common/party-directory.adapter.ts and common/i18n/crm-error-catalog.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../settings/shared/settings-api';
import {
  CUSTOMER_ERROR_KEYS,
} from './customers.api';
import { fakeGetCustomer as getCustomer, fakeCreateCustomer as createCustomer, fakePatchCustomer as patchCustomer, fakeAttachCustomerTags as attachCustomerTags, fakeDetachCustomerTag as detachCustomerTag, fakeListCustomerTags as listCustomerTags, fakeCheckDuplicates as checkDuplicates } from './customers.fake';
// These suites verify the retained fake's contract; live list transport has separate specs.
import { fakeLoadBoard as loadBoard, fakeLoadStatusPage as loadStatusPage, fakeSearchCustomerProfiles as searchCustomers, fakeGetCustomerCapabilities as getCustomerCapabilities, fakeSetCustomerStatus as setCustomerStatus, fakeDeleteCustomer as deleteCustomer } from './customers.fake';
import { CUSTOMER_STATUS_ORDER, MANUAL_STATUSES, isManualStatus } from './customer-statuses';
import { DEFAULT_CUSTOMER_BRANCH_ID, fakeListTags } from './customers.fake';
import {
  ContactPersonBody,
  CreateCustomerBody,
  CustomerAddress,
  CustomerDetail,
  CustomerRow,
  DuplicateCheckResponse,
} from './customers.model';
import { fakeRelatedCounts } from '../shared/record/related/related-records.fake';
import { RelatedRecordType } from '../shared/record/related/related-records.model';

async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function settleError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected the call to reject');
}

let keyCounter = 0;
const nextKey = () => `0190a1b2-c3d4-7e5f-8b9b-${String(++keyCounter).padStart(12, '0')}`;

function create(body: Omit<CreateCustomerBody, 'branchId'>): Promise<CustomerDetail> {
  return createCustomer({ branchId: DEFAULT_CUSTOMER_BRANCH_ID, ...body }, nextKey());
}

/** A seeded customer in the default branch that has a phone and an owner. */
async function seededWithPhone(): Promise<CustomerRow & { phone: string }> {
  const page = await settle(searchCustomers({ branchId: DEFAULT_CUSTOMER_BRANCH_ID }, 1, 100));
  const row = page.items.find((item) => item.branchId === DEFAULT_CUSTOMER_BRANCH_ID && item.phones.length > 0 && item.ownerUserId);
  if (!row) throw new Error('seed has no customer with a phone in the default branch');
  return { ...row, phone: row.phones[0] };
}

/** Backend codes (crm-error-catalog.ts) with the HTTP status the backend sends. */
const BACKEND_STATUS: Record<string, number> = {
  CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN: 422,
  CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON: 422,
  PARTY_DUPLICATE_CONTACT_METHOD: 409,
  CRM_RECORD_TAG_ALREADY_ATTACHED: 409,
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('customers contract: duplicate check (LeadDuplicateCheckDto -> LeadDuplicateCheckResponse)', () => {
  it('returns a { matches } envelope whose entries carry wouldBlock, level and contactMethods', async () => {
    const seed = await seededWithPhone();
    const response: DuplicateCheckResponse = await settle(
      checkDuplicates({ branchId: DEFAULT_CUSTOMER_BRANCH_ID, phones: [seed.phone] }),
    );
    expect(Object.keys(response)).toEqual(['matches']);
    const match = response.matches.find((m) => m.partyId === seed.partyId);
    expect(match).toBeDefined();
    expect(typeof match!.wouldBlock).toBe('boolean');
    expect(['COMPANY', 'BRANCH', 'USER', 'SAME_OWNER', null]).toContain(match!.level);
    expect(match!.matchTypes).toContain('PHONE');
    expect(['PERSON', 'ORGANIZATION']).toContain(match!.partyType);
    expect(Array.isArray(match!.leads)).toBe(true);
    expect(typeof match!.restricted).toBe('boolean');
    const phoneHit = match!.contactMethods!.find((c) => c.methodType === 'PHONE');
    expect(phoneHit).toBeDefined();
    expect(typeof phoneHit!.wouldBlock).toBe('boolean');
    expect(['COMPANY', 'BRANCH', 'USER', 'SAME_OWNER']).toContain(phoneHit!.level);
    expect(match!.wouldBlock).toBe(match!.contactMethods!.some((c) => c.wouldBlock));
  });

  it('takes ownerUserId and reports SAME_OWNER when the match belongs to that owner', async () => {
    const seed = await seededWithPhone();
    const own = await settle(
      checkDuplicates({ branchId: DEFAULT_CUSTOMER_BRANCH_ID, ownerUserId: seed.ownerUserId!, phones: [seed.phone] }),
    );
    expect(own.matches.find((m) => m.partyId === seed.partyId)?.level).toBe('SAME_OWNER');
    const other = await settle(
      checkDuplicates({ branchId: DEFAULT_CUSTOMER_BRANCH_ID, ownerUserId: 'someone-else', phones: [seed.phone] }),
    );
    expect(other.matches.find((m) => m.partyId === seed.partyId)?.level).not.toBe('SAME_OWNER');
  });

  it('never reports the party being edited (excludePartyId)', async () => {
    const seed = await seededWithPhone();
    const response = await settle(
      checkDuplicates({ branchId: DEFAULT_CUSTOMER_BRANCH_ID, phones: [seed.phone], excludePartyId: seed.partyId }),
    );
    expect(response.matches.some((m) => m.partyId === seed.partyId)).toBe(false);
  });

  it('rejects an empty probe with LEAD_DUPLICATE_CHECK_EMPTY', async () => {
    const error = await settleError(checkDuplicates({ branchId: DEFAULT_CUSTOMER_BRANCH_ID }));
    expect(error.code).toBe('LEAD_DUPLICATE_CHECK_EMPTY');
  });
});

describe('customers contract: blocked save (party-directory.adapter assertBatchContactMethodsAllowed)', () => {
  it('rejects 409 PARTY_DUPLICATE_CONTACT_METHOD { methodType: [lowercase], level: [lowercase DuplicateLevel] } when the check said wouldBlock', async () => {
    const seed = await seededWithPhone();
    const check = await settle(checkDuplicates({ branchId: DEFAULT_CUSTOMER_BRANCH_ID, phones: [seed.phone] }));
    const blocking = check.matches.find((m) => m.partyId === seed.partyId);
    expect(blocking?.wouldBlock).toBe(true);

    const error = await settleError(
      create({ profileType: 'CORPORATE', companyName: 'Dup Phone Co', companyPhones: [seed.phone] }),
    );
    expect(error.status).toBe(BACKEND_STATUS['PARTY_DUPLICATE_CONTACT_METHOD']);
    expect(error.code).toBe('PARTY_DUPLICATE_CONTACT_METHOD');
    expect(error.details).toEqual({ methodType: ['phone'], level: [expect.stringMatching(/^(user|same_owner)$/)] });
  });
});

describe('customers contract: corporate-only fields (assertCorporateOnlyFields)', () => {
  it.each<[string, Partial<CreateCustomerBody>]>([
    ['companyName', { companyName: 'X' }],
    ['legalName', { legalName: 'X LLC' }],
    ['taxNumber', { taxNumber: '123' }],
    ['commercialRegistrationNumber', { commercialRegistrationNumber: 'CR-1' }],
    ['companyPhones', { companyPhones: ['+201001234567'] }],
    ['companyEmail', { companyEmail: 'a@b.co' }],
    ['companyWebsite', { companyWebsite: 'https://b.co' }],
    ['contacts', { contacts: [] }],
  ])('rejects %s on an INDIVIDUAL create with 422 CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN', async (_name, extra) => {
    const error = await settleError(create({ profileType: 'INDIVIDUAL', displayName: 'Solo Person', ...extra }));
    expect(error.status).toBe(BACKEND_STATUS['CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN']);
    expect(error.code).toBe('CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN');
  });

  it('rejects legalName and contactChange on an INDIVIDUAL patch', async () => {
    const person = await settle(create({ profileType: 'INDIVIDUAL', displayName: 'Patch Person' }));
    const legal = await settleError(patchCustomer(person.id, { legalName: 'Nope' }));
    expect(legal.code).toBe('CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN');
    const change = await settleError(patchCustomer(person.id, { contactChange: { op: 'REMOVE', contactPartyId: 'x' } }));
    expect(change.code).toBe('CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN');
  });

  it('accepts primaryContact alone on a CORPORATE create (create-only shorthand)', async () => {
    const corp = await settle(
      create({ profileType: 'CORPORATE', companyName: 'Shorthand Co', primaryContact: { firstName: 'Mona', lastName: 'Adel' } }),
    );
    expect(corp.contacts.length).toBe(1);
  });

  it('rejects primaryContact together with contacts on a CORPORATE create', async () => {
    const error = await settleError(
      create({
        profileType: 'CORPORATE',
        companyName: 'Both Co',
        primaryContact: { firstName: 'A' },
        contacts: [{ firstName: 'B' }],
      }),
    );
    expect(error.code).toBe('CUSTOMER_PROFILE_PRIMARY_CONTACT_FORBIDDEN');
  });
});

describe('customers contract: status rules', () => {
  it('keeps ACTIVE_CUSTOMER out of the manual statuses a drop or form can set', () => {
    expect(MANUAL_STATUSES).not.toContain('ACTIVE_CUSTOMER');
    expect(isManualStatus('ACTIVE_CUSTOMER')).toBe(false);
    expect(CUSTOMER_STATUS_ORDER.filter(isManualStatus)).toEqual([...MANUAL_STATUSES]);
  });

  it('passes ACTIVE_CUSTOMER through the DTO and answers 422 CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON', async () => {
    const person = await settle(create({ profileType: 'INDIVIDUAL', displayName: 'Active Try' }));
    const error = await settleError(setCustomerStatus(person.id, 'ACTIVE_CUSTOMER', person.updatedAt));
    expect(error.code).toBe('CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON');
    expect(error.status).toBe(BACKEND_STATUS['CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON']);
    const created = await settleError(create({ profileType: 'INDIVIDUAL', displayName: 'Active Create', status: 'ACTIVE_CUSTOMER' as never }));
    expect([created.status, created.code]).toEqual([422, 'CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON']);
  });

  it('lets BLACKLISTED be set (the board confirms first; the server takes it)', async () => {
    const person = await settle(create({ profileType: 'INDIVIDUAL', displayName: 'Blacklist Me' }));
    const saved = await settle(setCustomerStatus(person.id, 'BLACKLISTED', person.updatedAt));
    expect(saved.status).toBe('BLACKLISTED');
  });
});

describe('customers contract: related counts (RelatedRecordCountsDto)', () => {
  it.each<RelatedRecordType>(['LEAD', 'CUSTOMER_PROFILE'])('accepts recordType %s', async (recordType) => {
    const response = await settle(
      fakeRelatedCounts({ branchId: DEFAULT_CUSTOMER_BRANCH_ID, recordType, recordIds: ['0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa01'] }),
    );
    expect(response).toHaveProperty('countsByRecordId');
  });

  it('rejects any other recordType like the backend IsIn(LEAD, CUSTOMER_PROFILE)', async () => {
    await expect(
      settle(
        fakeRelatedCounts({
          branchId: DEFAULT_CUSTOMER_BRANCH_ID,
          recordType: 'OPPORTUNITY' as unknown as RelatedRecordType,
          recordIds: ['0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa01'],
        }),
      ),
    ).rejects.toBeDefined();
  });
});

describe('customers contract: body shapes', () => {
  it('accepts CreateCustomerBody.legalName and stores it', async () => {
    const corp = await settle(create({ profileType: 'CORPORATE', companyName: 'Legal Co', legalName: 'Legal Co Holdings LLC' }));
    expect(corp.legalName).toBe('Legal Co Holdings LLC');
  });

  it('accepts ContactPersonBody.contactMethods', async () => {
    const contact: ContactPersonBody = {
      firstName: 'Sara',
      lastName: 'Nabil',
      isPrimary: true,
      contactMethods: [{ methodType: 'EMAIL', value: 'sara.contract@example.com', label: 'Work' }],
    };
    const corp = await settle(create({ profileType: 'CORPORATE', companyName: 'Methods Co', contacts: [contact] }));
    expect(corp.contacts).toHaveLength(1);
  });

  it('keeps the contactMethods email on the saved contact (adapter merges contact.contactMethods)', async () => {
    const corp = await settle(
      create({
        profileType: 'CORPORATE',
        companyName: 'Methods Kept Co',
        contacts: [{ firstName: 'Omar', contactMethods: [{ methodType: 'EMAIL', value: 'omar.contract@example.com' }] }],
      }),
    );
    expect(corp.contacts[0].email).toBe('omar.contract@example.com');
  });

  it('types CustomerAddress as the full PartyAddressView (every part present, nullable)', () => {
    const minimal: CustomerAddress = {
      addressType: 'LEGAL',
      label: null,
      countryId: null,
      stateId: null,
      cityId: null,
      districtId: null,
      countryName: null,
      stateName: null,
      cityName: null,
      districtName: null,
      country: null,
      city: null,
      area: null,
      street: null,
      buildingNo: null,
      floor: null,
      apartment: null,
      landmark: null,
      postalCode: null,
    };
    expect(Object.keys(minimal)).toHaveLength(19);
  });
});

describe('customers contract: error codes', () => {
  it('maps every code to customers.errors.<code>', () => {
    for (const [code, key] of Object.entries(CUSTOMER_ERROR_KEYS)) expect(key).toBe(`customers.errors.${code}`);
  });

  it('uses the backend catalog names', () => {
    for (const code of [
      'CRM_RECORD_TAG_ALREADY_ATTACHED',
      'PARTY_DUPLICATE_CONTACT_METHOD',
      'CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN',
      'CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON',
      'CUSTOMER_PROFILE_PRIMARY_CONTACT_FORBIDDEN',
      'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE',
      'CRM_TAG_NOT_FOUND',
      'CRM_CONTACT_NOT_LINKED',
      'LEAD_DUPLICATE_CHECK_EMPTY',
    ]) {
      expect(CUSTOMER_ERROR_KEYS[code]).toBeDefined();
    }
  });

  it('rejects a second attach of the same tag with 409 CRM_RECORD_TAG_ALREADY_ATTACHED', async () => {
    const tags = await settle(fakeListTags());
    const person = await settle(create({ profileType: 'INDIVIDUAL', displayName: 'Tag Twice' }));
    await settle(attachCustomerTags(person.id, [tags[0].id]));
    const error = await settleError(attachCustomerTags(person.id, [tags[0].id]));
    expect(error.status).toBe(BACKEND_STATUS['CRM_RECORD_TAG_ALREADY_ATTACHED']);
    expect(error.code).toBe('CRM_RECORD_TAG_ALREADY_ATTACHED');
  });
});

describe('customers contract: branch guard (RequireBranchAccess / RequireRecordBranchAccess)', () => {
  it('answers a missing branchId with 403 BRANCH_CONTEXT_REQUIRED and a malformed one with 400', async () => {
    expect((await settleError(searchCustomers({ branchId: '' }))).code).toBe('BRANCH_CONTEXT_REQUIRED');
    expect((await settleError(searchCustomers({ branchId: '' }))).status).toBe(403);
    const malformed = await settleError(loadBoard({ branchId: 'not a uuid' }));
    expect([malformed.status, malformed.code]).toEqual([400, 'CRM_VALIDATION_FAILED']);
    const create403 = await settleError(createCustomer({ branchId: '', profileType: 'INDIVIDUAL', displayName: 'No Branch' }, nextKey()));
    expect([create403.status, create403.code]).toEqual([403, 'BRANCH_CONTEXT_REQUIRED']);
  });

  it('answers an unknown customer id with 404 CUSTOMER_PROFILE_NOT_FOUND (record guard remap, as for leads)', async () => {
    const missing = '0192b7ea-7c4f-7a7d-9c9f-000000000000';
    const calls = [
      () => getCustomer(missing),
      () => patchCustomer(missing, { rating: 1 }),
      () => deleteCustomer(missing),
      () => listCustomerTags(missing),
    ];
    for (const call of calls) {
      const error = await settleError(call());
      expect([error.status, error.code]).toEqual([404, 'CUSTOMER_PROFILE_NOT_FOUND']);
    }
  });

  it('answers capabilities for a branch outside the session with 403 BRANCH_ACCESS_DENIED', async () => {
    const error = await settleError(getCustomerCapabilities('b99'));
    expect([error.status, error.code]).toEqual([403, 'BRANCH_ACCESS_DENIED']);
  });
});

describe('customers contract: list shapes', () => {
  it('returns list rows with the Party summary and one primary email column', async () => {
    const page = await settle(searchCustomers({ branchId: DEFAULT_CUSTOMER_BRANCH_ID }, 1, 5));
    for (const row of page.items) {
      expect(row.party.id).toBe(row.partyId);
      expect(row.party.partyType).toBe(row.profileType === 'CORPORATE' ? 'ORGANIZATION' : 'PERSON');
      expect(row.email).toBe(row.companyEmail);
      expect(row.party.primaryEmail).toBe(row.email);
      for (const tag of row.tags) expect(Object.keys(tag).sort()).toEqual(['backgroundColor', 'id', 'name', 'textColor']);
    }
  });

  it('pages like paginatedReadModels: totalPages 0 and hasPrev false when empty, the page echoed', async () => {
    const empty = await settle(searchCustomers({ branchId: DEFAULT_CUSTOMER_BRANCH_ID, search: 'zz-no-such-customer-zz' }, 3, 20));
    expect(empty).toMatchObject({ items: [], total: 0, page: 3, limit: 20, totalPages: 0, hasNext: false, hasPrev: false });
  });

  it('sorts by createdAt ASC when sort is omitted and rejects an unknown sort field with 400 INVALID_FIELD', async () => {
    const page = await settle(searchCustomers({ branchId: DEFAULT_CUSTOMER_BRANCH_ID }, 1, 10));
    const times = page.items.map((item) => Date.parse(item.createdAt));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    const error = await settleError(searchCustomers({ branchId: DEFAULT_CUSTOMER_BRANCH_ID, sort: 'phone:ASC' as never }));
    expect(error.code).toBe('INVALID_FIELD');
    expect(error.details).toEqual({ field: ['phone'] });
  });

  it('validates the search body: limit <= 100, non-empty tagIds, filter fields', async () => {
    expect((await settleError(searchCustomers({ branchId: DEFAULT_CUSTOMER_BRANCH_ID }, 1, 101))).details).toHaveProperty('limit');
    expect((await settleError(searchCustomers({ branchId: DEFAULT_CUSTOMER_BRANCH_ID, tagIds: [] }))).details).toHaveProperty('tagIds');
    const field = await settleError(
      searchCustomers({ branchId: DEFAULT_CUSTOMER_BRANCH_ID, filter: [{ field: 'displayName', operator: 'eq', value: 'x' }] }),
    );
    expect([field.code, field.details]).toEqual(['INVALID_FIELD', { field: ['displayName'] }]);
    const value = await settleError(
      searchCustomers({ branchId: DEFAULT_CUSTOMER_BRANCH_ID, filter: [{ field: 'status', operator: 'in', value: [] }] }),
    );
    expect(value.code).toBe('INVALID_OPERATOR_VALUE');
    expect(value.details).toEqual({ operator: ['in'], reason: ['expected non-empty array'] });
  });

  it('returns board lanes of 50 with counts, and only accepts limit 50', async () => {
    const board = await settle(loadBoard({ branchId: DEFAULT_CUSTOMER_BRANCH_ID }));
    expect(Object.keys(board)).toEqual(['counts', 'statuses']);
    expect(board.statuses.map((lane) => lane.status)).toEqual(['PROSPECT', 'ACTIVE_CUSTOMER', 'INACTIVE', 'BLACKLISTED']);
    for (const lane of board.statuses) {
      expect(lane.limit).toBe(50);
      expect(lane.items[0]).not.toHaveProperty('party');
    }
    const error = await settleError(loadBoard({ branchId: DEFAULT_CUSTOMER_BRANCH_ID, limit: 20 }));
    expect(error.details).toHaveProperty('limit');
    const lane = await settle(loadStatusPage('PROSPECT', { branchId: DEFAULT_CUSTOMER_BRANCH_ID }, 2));
    expect([lane.status, lane.page, lane.limit]).toEqual(['PROSPECT', 2, 50]);
  });
});

describe('customers contract: validation errors (ValidationPipe -> details arrays)', () => {
  it('reports each failing property path with a message array', async () => {
    const email = await settleError(create({ profileType: 'CORPORATE', companyName: 'Bad Mail Co', companyEmail: 'nope' }));
    expect(email.code).toBe('CRM_VALIDATION_FAILED');
    expect(email.details).toEqual({ companyEmail: [expect.any(String)] });
    const contact = await settleError(
      create({ profileType: 'CORPORATE', companyName: 'Bad Contact Co', contacts: [{ firstName: 'A', email: 'x' }] }),
    );
    expect(Object.keys(contact.details ?? {})).toEqual(['contacts.0.email']);
    const name = await settleError(create({ profileType: 'INDIVIDUAL', displayName: '' }));
    expect(name.details).toHaveProperty('displayName');
  });

  it('needs a name for an individual: 422 CUSTOMER_PROFILE_DISPLAY_NAME_REQUIRED', async () => {
    const error = await settleError(create({ profileType: 'INDIVIDUAL', primaryContact: { email: 'x@y.co' } }));
    expect([error.status, error.code]).toEqual([422, 'CUSTOMER_PROFILE_DISPLAY_NAME_REQUIRED']);
  });

  it('composes an individual display name with the honorific (customer personName)', async () => {
    const person = await settle(
      create({ profileType: 'INDIVIDUAL', primaryContact: { honorificTitle: 'Dr.', firstName: 'Hala', lastName: 'Fouad' } }),
    );
    expect(person.displayName).toBe('Dr. Hala Fouad');
  });

  it('rejects a phone under 5 digits with 422 LEAD_PHONE_INVALID (the lead rule)', async () => {
    const error = await settleError(
      create({ profileType: 'INDIVIDUAL', displayName: 'Short Phone', primaryContact: { phones: ['12-34'] } }),
    );
    expect([error.status, error.code]).toEqual([422, 'LEAD_PHONE_INVALID']);
  });

  it('stores canonical phones and rejects a repeat with 422 PARTY_CONTACT_METHOD_REPEATED', async () => {
    const person = await settle(
      create({ profileType: 'INDIVIDUAL', displayName: 'Phone Shape', primaryContact: { phones: ['00 20 155 000 1234'] } }),
    );
    expect(person.phones).toEqual(['+201550001234']);
    const error = await settleError(
      create({ profileType: 'INDIVIDUAL', displayName: 'Phone Twice', primaryContact: { phones: ['+201550009999', '00201550009999'] } }),
    );
    expect([error.status, error.code]).toEqual([422, 'PARTY_CONTACT_METHOD_REPEATED']);
  });

  it('answers a broken address hierarchy with LEAD_ADDRESS_GEO_* and details { field: [level] }', async () => {
    const incomplete = await settleError(create({ profileType: 'INDIVIDUAL', displayName: 'Geo A', address: { stateId: 'geo-x' } }));
    expect([incomplete.status, incomplete.code, incomplete.details]).toEqual([422, 'LEAD_ADDRESS_GEO_INCOMPLETE', { field: ['stateId'] }]);
    const invalid = await settleError(create({ profileType: 'INDIVIDUAL', displayName: 'Geo B', address: { countryId: 'geo-nowhere' } }));
    expect([invalid.code, invalid.details]).toEqual(['LEAD_ADDRESS_GEO_INVALID', { field: ['countryId'] }]);
  });
});

describe('customers contract: PATCH check order (CustomerProfilesService.update)', () => {
  it('rejects contactChange with contacts before anything else (400 CRM_CONTACT_CHANGE_CONFLICT)', async () => {
    const corp = await settle(create({ profileType: 'CORPORATE', companyName: 'Order Co' }));
    const error = await settleError(
      patchCustomer(corp.id, { expectedUpdatedAt: '2000-01-01T00:00:00.000Z', contacts: [], contactChange: { op: 'REMOVE', contactPartyId: 'x' } }),
    );
    expect([error.status, error.code]).toEqual([400, 'CRM_CONTACT_CHANGE_CONFLICT']);
  });

  it('checks corporate-only fields before the expectedUpdatedAt fence', async () => {
    const person = await settle(create({ profileType: 'INDIVIDUAL', displayName: 'Fence Person' }));
    const error = await settleError(
      patchCustomer(person.id, { expectedUpdatedAt: '2000-01-01T00:00:00.000Z', companyName: 'Nope' }),
    );
    expect(error.code).toBe('CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN');
  });

  it('then answers a stale expectedUpdatedAt with 409 CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE', async () => {
    const person = await settle(create({ profileType: 'INDIVIDUAL', displayName: 'Stale Person' }));
    const error = await settleError(patchCustomer(person.id, { expectedUpdatedAt: '2000-01-01T00:00:00.000Z', rating: 2 }));
    expect([error.status, error.code]).toEqual([409, 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE']);
  });

  it('keeps the display name when only the company name changes (ensureParty keeps it)', async () => {
    const corp = await settle(create({ profileType: 'CORPORATE', companyName: 'Keep Name Co' }));
    const saved = await settle(patchCustomer(corp.id, { companyName: 'Renamed Co' }));
    expect([saved.companyName, saved.displayName]).toEqual(['Renamed Co', 'Keep Name Co']);
  });

  it('clears an individual email with null and refuses an empty string', async () => {
    const person = await settle(create({ profileType: 'INDIVIDUAL', displayName: 'Mail Clear', primaryContact: { email: 'clear.me@example.com' } }));
    const empty = await settleError(patchCustomer(person.id, { primaryContact: { email: '' } }));
    expect(empty.details).toHaveProperty(['primaryContact.email']);
    const cleared = await settle(patchCustomer(person.id, { primaryContact: { email: null } }));
    expect([cleared.email, cleared.companyEmail]).toEqual([null, null]);
  });
});

describe('customers contract: contact changes (applyCorporateContactChange)', () => {
  it('reports an unknown contact with 404 CRM_CONTACT_NOT_LINKED and no details', async () => {
    const corp = await settle(create({ profileType: 'CORPORATE', companyName: 'Link Co', contacts: [{ firstName: 'Lina' }] }));
    const error = await settleError(changeCustomerContact(corp.id, { op: 'SET_PRIMARY', contactPartyId: 'missing' }));
    expect([error.status, error.code, error.details]).toEqual([404, 'CRM_CONTACT_NOT_LINKED', undefined]);
  });

  it('lets an update demote the primary; the first contact becomes primary again', async () => {
    const corp = await settle(
      create({ profileType: 'CORPORATE', companyName: 'Demote Co', contacts: [{ firstName: 'A', isPrimary: true }, { firstName: 'B' }] }),
    );
    const first = corp.contacts[0];
    const saved = await settle(
      changeCustomerContact(corp.id, { op: 'UPDATE', contactPartyId: first.partyId, contact: { isPrimary: false } }),
    );
    expect(saved.contacts.filter((c) => c.isPrimary)).toHaveLength(1);
    expect(saved.contacts[0].isPrimary).toBe(true);
  });
});

describe('customers contract: tags (RecordTagsService)', () => {
  it('returns TagView rows ordered by name, with timestamps', async () => {
    const tags = await settle(fakeListTags());
    const person = await settle(create({ profileType: 'INDIVIDUAL', displayName: 'Tag Views' }));
    const views = await settle(attachCustomerTags(person.id, tags.slice(0, 3).map((t) => t.id)));
    expect(views.map((v) => v.name)).toEqual([...views.map((v) => v.name)].sort((a, b) => a.localeCompare(b)));
    expect(typeof views[0].createdAt).toBe('string');
    expect(views[0]).toHaveProperty('backgroundColor');
  });

  it('answers unknown tags with 422 CRM_TAG_UNKNOWN { tagIds } and a missing link with 404 CRM_RECORD_TAG_NOT_FOUND', async () => {
    const person = await settle(create({ profileType: 'INDIVIDUAL', displayName: 'Tag Errors' }));
    const unknown = await settleError(attachCustomerTags(person.id, ['tag-nope']));
    expect([unknown.status, unknown.code, unknown.details]).toEqual([422, 'CRM_TAG_UNKNOWN', { tagIds: ['tag-nope'] }]);
    const empty = await settleError(attachCustomerTags(person.id, []));
    expect(empty.code).toBe('CRM_VALIDATION_FAILED');
    const detach = await settleError(detachCustomerTag(person.id, 'tag-001'));
    expect([detach.status, detach.code]).toEqual([404, 'CRM_RECORD_TAG_NOT_FOUND']);
  });

  it('puts the duplicated ids in CRM_RECORD_TAG_ALREADY_ATTACHED details', async () => {
    const tags = await settle(fakeListTags());
    const person = await settle(create({ profileType: 'INDIVIDUAL', displayName: 'Tag Dup Details' }));
    await settle(attachCustomerTags(person.id, [tags[0].id]));
    const error = await settleError(attachCustomerTags(person.id, [tags[0].id, tags[1].id]));
    expect(error.details).toEqual({ tagIds: [tags[0].id] });
  });
});
