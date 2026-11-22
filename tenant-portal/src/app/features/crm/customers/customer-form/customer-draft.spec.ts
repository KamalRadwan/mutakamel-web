import { describe, expect, it } from 'vitest';
import { ApiError } from '../../settings/shared/settings-api';
import {
  ContactDraft,
  CustomerDraft,
  CUSTOMER_TAGS_MAX,
  diffTags,
  draftFromDetail,
  draftsEqual,
  emptyDraft,
  formatLegacyAddress,
  mapServerErrors,
  validationErrorPath,
  newContact,
  toContactChangeBody,
  toCreateBody,
  toPatchBody,
  validateDraft,
} from './customer-draft';
import { CustomerCustomField, CustomerDetail } from '../customers.model';

function individual(overrides: Partial<CustomerDraft> = {}): CustomerDraft {
  return emptyDraft({
    branchId: 'b1',
    firstName: 'Mona',
    phones: ['+201001234567'],
    ...overrides,
  });
}

function contact(overrides: Partial<ContactDraft> = {}): ContactDraft {
  return {
    ...newContact(false),
    firstName: 'Sami',
    phones: ['+201002223334'],
    ...overrides,
  };
}

function corporate(overrides: Partial<CustomerDraft> = {}): CustomerDraft {
  return emptyDraft({
    profileType: 'CORPORATE',
    branchId: 'b1',
    companyName: 'Acme',
    companyPhones: ['+20221234567'],
    contacts: [contact({ isPrimary: true })],
    ...overrides,
  });
}

describe('emptyDraft', () => {
  it('starts with default Individual values and empty contacts', () => {
    const draft = emptyDraft();
    expect(draft.profileType).toBe('INDIVIDUAL');
    expect(draft.status).toBe('PROSPECT');
    expect(draft.phones).toEqual(['']);
    expect(draft.contacts).toEqual([]);
    expect(draft.address.countryId).toBeNull();
  });

  it('does not share arrays or nested objects with the preset', () => {
    const phones = ['+201001234567'];
    const tagIds = ['tag-1'];
    const customFields = { tags: ['a'] };
    const draft = emptyDraft({ phones, tagIds, customFields });

    draft.phones.push('+201009998887');
    draft.tagIds.push('tag-2');
    (draft.customFields['tags'] as string[]).push('b');

    expect(phones).toEqual(['+201001234567']);
    expect(tagIds).toEqual(['tag-1']);
    expect(customFields.tags).toEqual(['a']);
  });
});

describe('toCreateBody', () => {
  it('builds the create body for an Individual using primaryContact without company fields', () => {
    const draft = individual({
      honorificTitle: 'Ms.',
      firstName: '  Mona ',
      lastName: ' Adel ',
      email: ' mona@example.com ',
      phones: [' +201001234567 ', '  '],
      ownerUserId: 'u1',
      acquisitionSourceId: 'src-1',
      description: 'VIP shopper',
    });

    const body = toCreateBody(draft);

    expect(body).toEqual({
      branchId: 'b1',
      profileType: 'INDIVIDUAL',
      ownerUserId: 'u1',
      acquisitionSourceId: 'src-1',
      description: 'VIP shopper',
      primaryContact: {
        honorificTitle: 'Ms.',
        firstName: 'Mona',
        lastName: 'Adel',
        email: 'mona@example.com',
        phones: ['+201001234567'],
      },
    });
    expect(body.status).toBeUndefined();
    expect(body.companyName).toBeUndefined();
    expect(body.contacts).toBeUndefined();
  });

  it('sends status on create only when it is not PROSPECT', () => {
    expect(toCreateBody(individual({ status: 'PROSPECT' })).status).toBeUndefined();
    expect(toCreateBody(individual({ status: 'INACTIVE' })).status).toBe('INACTIVE');
    expect(toCreateBody(individual({ status: 'BLACKLISTED' })).status).toBe('BLACKLISTED');
  });

  it('builds the create body for a Company with two contacts (one primary) and no primaryContact', () => {
    const draft = corporate({
      legalName: 'Acme S.A.E.',
      taxNumber: '300-111',
      commercialRegistrationNumber: 'CR-900',
      companyEmail: 'info@acme.example.com',
      companyWebsite: 'https://acme.example.com',
      contacts: [
        contact({ isPrimary: true, firstName: 'Nadia', lastName: 'Fouad', jobTitle: 'CEO', email: 'n@acme.com' }),
        contact({ isPrimary: false, firstName: 'Tarek', phones: ['+201005556667'] }),
      ],
    });

    const body = toCreateBody(draft);

    expect(body).toEqual({
      branchId: 'b1',
      profileType: 'CORPORATE',
      companyName: 'Acme',
      legalName: 'Acme S.A.E.',
      taxNumber: '300-111',
      commercialRegistrationNumber: 'CR-900',
      companyPhones: ['+20221234567'],
      companyEmail: 'info@acme.example.com',
      companyWebsite: 'https://acme.example.com',
      contacts: [
        {
          isPrimary: true,
          firstName: 'Nadia',
          lastName: 'Fouad',
          jobTitle: 'CEO',
          email: 'n@acme.com',
          phones: ['+201002223334'],
        },
        {
          isPrimary: false,
          firstName: 'Tarek',
          phones: ['+201005556667'],
        },
      ],
    });
    expect(body.primaryContact).toBeUndefined();
  });

  it('omits empty legalName on Company create and sends rating, cardColor, tagIds and geo address in one request', () => {
    const draft = corporate({
      legalName: '   ',
      rating: 3,
      cardColor: 'BLUE',
      tagIds: ['tag-001', 'tag-004'],
      address: {
        ...emptyDraft().address,
        countryId: 'geo-eg',
        stateId: 'geo-eg-c',
        cityId: 'geo-city-maadi',
      },
    });

    const body = toCreateBody(draft);

    expect(body.legalName).toBeUndefined();
    expect(body.rating).toBe(3);
    expect(body.cardColor).toBe('BLUE');
    expect(body.tagIds).toEqual(['tag-001', 'tag-004']);
    expect(body.address).toEqual({
      countryId: 'geo-eg',
      stateId: 'geo-eg-c',
      cityId: 'geo-city-maadi',
    });
  });

  it('omits address on create when no geo id is set', () => {
    expect(toCreateBody(individual()).address).toBeUndefined();
  });
});

describe('toPatchBody', () => {
  it('sends only expectedUpdatedAt when nothing changed', () => {
    const base = corporate();
    expect(toPatchBody(base, structuredClone(base), '2026-11-21T10:00:00.000Z')).toEqual({
      expectedUpdatedAt: '2026-11-21T10:00:00.000Z',
    });
  });

  it('sends displayName alongside companyName when company name changes and never sends profileType or contacts', () => {
    const base = corporate({ companyName: 'Acme' });
    const next = {
      ...structuredClone(base),
      companyName: 'Acme Holdings',
      contacts: [contact({ isPrimary: true, firstName: 'Edited' })],
      tagIds: ['tag-1'],
    };

    const body = toPatchBody(base, next, 'v1');

    expect(body).toEqual({
      expectedUpdatedAt: 'v1',
      companyName: 'Acme Holdings',
      displayName: 'Acme Holdings',
    });
    expect('profileType' in body).toBe(false);
    expect(body.contacts).toBeUndefined();
    expect('tagIds' in body).toBe(false);
  });

  it('composes displayName and sends primaryContact when an Individual identity changes', () => {
    const base = individual({ honorificTitle: 'Mr.', firstName: 'Karim', lastName: 'Saeed' });
    const next = { ...structuredClone(base), firstName: 'Kareem', lastName: 'Hassan' };

    const body = toPatchBody(base, next, 'v2');

    expect(body).toEqual({
      expectedUpdatedAt: 'v2',
      displayName: 'Mr. Kareem Hassan',
      primaryContact: {
        honorificTitle: 'Mr.',
        firstName: 'Kareem',
        lastName: 'Hassan',
        email: null,
        phones: ['+201001234567'],
      },
    });
  });

  it('sends all geo address ids as null when the address is cleared', () => {
    const base = individual({
      address: {
        ...emptyDraft().address,
        countryId: 'geo-eg',
        stateId: 'geo-eg-c',
        cityId: 'geo-city-maadi',
        districtId: 'geo-dist-degla',
      },
    });
    const cleared = { ...structuredClone(base), address: emptyDraft().address };

    const body = toPatchBody(base, cleared, 'v3');

    expect(body).toEqual({
      expectedUpdatedAt: 'v3',
      address: {
        countryId: null,
        stateId: null,
        cityId: null,
        districtId: null,
      },
    });
  });

  it('clears nullable corporate legal fields to null', () => {
    const base = corporate({
      legalName: 'Acme Legal',
      taxNumber: '300-1',
      commercialRegistrationNumber: 'CR-1',
    });
    const next = {
      ...structuredClone(base),
      legalName: '',
      taxNumber: '  ',
      commercialRegistrationNumber: '',
    };

    const body = toPatchBody(base, next, 'v4');

    expect(body).toEqual({
      expectedUpdatedAt: 'v4',
      legalName: null,
      taxNumber: null,
      commercialRegistrationNumber: null,
    });
  });
});

describe('toContactChangeBody', () => {
  it('maps ADD op with trimmed non-empty fields', () => {
    const body = toContactChangeBody({
      op: 'ADD',
      contact: contact({
        isPrimary: false,
        honorificTitle: ' Eng. ',
        firstName: ' Tarek ',
        lastName: '',
        jobTitle: ' CTO ',
        phones: ['+201005551111', ''],
        email: ' tarek@acme.com ',
      }),
    });

    expect(body).toEqual({
      op: 'ADD',
      contact: {
        isPrimary: false,
        honorificTitle: 'Eng.',
        firstName: 'Tarek',
        jobTitle: 'CTO',
        email: 'tarek@acme.com',
        phones: ['+201005551111'],
      },
    });
  });

  it('maps UPDATE op preserving empty strings and phone list to allow clearing', () => {
    const body = toContactChangeBody({
      op: 'UPDATE',
      contactPartyId: 'party-c1',
      contact: contact({
        contactPartyId: 'party-c1',
        isPrimary: true,
        firstName: 'Sami',
        lastName: '',
        honorificTitle: '',
        jobTitle: 'Director',
        phones: [''],
        email: 'sami@acme.com',
      }),
    });

    expect(body).toEqual({
      op: 'UPDATE',
      contactPartyId: 'party-c1',
      contact: {
        contactPartyId: 'party-c1',
        isPrimary: true,
        honorificTitle: '',
        firstName: 'Sami',
        lastName: '',
        jobTitle: 'Director',
        email: 'sami@acme.com',
        phones: [],
      },
    });
  });

  it('maps REMOVE and SET_PRIMARY ops', () => {
    expect(toContactChangeBody({ op: 'REMOVE', contactPartyId: 'party-c2' })).toEqual({
      op: 'REMOVE',
      contactPartyId: 'party-c2',
    });
    expect(toContactChangeBody({ op: 'SET_PRIMARY', contactPartyId: 'party-c3' })).toEqual({
      op: 'SET_PRIMARY',
      contactPartyId: 'party-c3',
    });
  });
});

describe('validateDraft', () => {
  it('requires at least one phone or email for an Individual', () => {
    const neither = validateDraft(individual({ phones: [''], email: '' }), 'create', []);
    expect(neither['reach']).toBe('reachRequired');

    const phoneOnly = validateDraft(individual({ phones: ['+201001234567'], email: '' }), 'create', []);
    expect(phoneOnly).toEqual({});

    const emailOnly = validateDraft(individual({ phones: [''], email: 'mona@example.com' }), 'create', []);
    expect(emailOnly).toEqual({});
  });

  it('requires phone or email on the company or primary contact for a Company (plan D13)', () => {
    const noReachAnywhere = validateDraft(
      corporate({
        companyPhones: [''],
        companyEmail: '',
        contacts: [
          contact({ isPrimary: true, phones: [''], email: '' }),
          contact({ isPrimary: false, firstName: 'Other', phones: ['+201009998887'], email: 'other@acme.com' }),
        ],
      }),
      'create',
      [],
    );
    expect(noReachAnywhere['reach']).toBe('reachRequired');

    const primaryContactReach = validateDraft(
      corporate({
        companyPhones: [''],
        companyEmail: '',
        contacts: [contact({ isPrimary: true, phones: ['+201002223334'], email: '' })],
      }),
      'create',
      [],
    );
    expect(primaryContactReach['reach']).toBeUndefined();

    const companyReachNoContacts = validateDraft(
      corporate({ companyPhones: ['+20221234567'], contacts: [] }),
      'create',
      [],
    );
    expect(companyReachNoContacts).toEqual({});
  });

  it('requires E.164 phone format and flags duplicates', () => {
    expect(validateDraft(individual({ phones: ['01001234567'] }), 'create', [])['phones.0']).toBe('phoneInvalid');
    expect(validateDraft(individual({ phones: ['+2012'] }), 'create', [])['phones.0']).toBe('phoneInvalid');
    expect(
      validateDraft(individual({ phones: ['+20 100 123 4567', '00201001234567'] }), 'create', [])['phones.1'],
    ).toBe('phoneDuplicate');
  });

  it('requires exactly one primary contact only when the Company has contacts', () => {
    const nonePrimary = validateDraft(
      corporate({ contacts: [contact({ isPrimary: false }), contact({ isPrimary: false, phones: ['+201007778889'] })] }),
      'create',
      [],
    );
    expect(nonePrimary['contacts']).toBe('primaryOne');

    const twoPrimary = validateDraft(
      corporate({ contacts: [contact({ isPrimary: true }), contact({ isPrimary: true, phones: ['+201007778889'] })] }),
      'create',
      [],
    );
    expect(twoPrimary['contacts']).toBe('primaryOne');
  });

  it('validates website, email, tag limit, and required custom fields', () => {
    const customField: CustomerCustomField = {
      id: 'cf-1',
      fieldKey: 'vat_id',
      nameEn: 'VAT ID',
      nameAr: 'الرقم الضريبي',
      type: 'TEXT',
      placeholderEn: null,
      placeholderAr: null,
      options: [],
      requiredOnCreate: true,
      requiredOnUpdate: false,
      sortOrder: 1,
    };

    const manyTags = Array.from({ length: CUSTOMER_TAGS_MAX + 1 }, (_, i) => `t-${i}`);
    const errs = validateDraft(
      corporate({
        companyEmail: 'invalid',
        companyWebsite: 'acme.com',
        tagIds: manyTags,
      }),
      'create',
      [customField],
    );

    expect(errs['companyEmail']).toBe('emailInvalid');
    expect(errs['companyWebsite']).toBe('websiteInvalid');
    expect(errs['tagIds']).toBe('tooLong');
    expect(errs['customFields.vat_id']).toBe('required');
  });
});

describe('draftFromDetail, draftsEqual, diffTags, mapServerErrors', () => {
  it('maps legal fields, geo address, and legacy address text appropriately', () => {
    const detail: CustomerDetail = {
      id: 'c1',
      branchId: 'b1',
      partyId: 'p1',
      party: {
        id: 'p1',
        partyType: 'ORGANIZATION',
        displayName: 'Acme',
        legalName: 'Acme S.A.E.',
        firstName: null,
        lastName: null,
        honorificTitle: null,
        organizationName: 'Acme',
        taxNumber: '300-1',
        commercialRegistrationNumber: 'CR-1',
        branchId: 'b1',
        ownerUserId: 'u1',
        primaryMobile: null,
        primaryEmail: 'info@acme.com',
        primaryPhone: '+20221234567',
        primaryWebsite: 'https://acme.com',
        phones: ['+20221234567'],
        imageUrl: null,
        imageKind: 'LOGO',
        imageRevision: null,
      },
      profileType: 'CORPORATE',
      status: 'ACTIVE_CUSTOMER',
      rating: 2,
      cardColor: 'TEAL',
      displayName: 'Acme',
      companyName: 'Acme',
      legalName: 'Acme S.A.E.',
      taxNumber: '300-1',
      commercialRegistrationNumber: 'CR-1',
      primaryContactName: 'Nadia',
      tags: [{ id: 'tag-1', name: 'VIP', backgroundColor: null, textColor: null }],
      ownerUserId: 'u1',
      owner: null,
      acquisitionSource: null,
      acquisitionSourceIconUrl: null,
      nextActivity: null,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
      sourceLeadId: null,
      acquisitionSourceId: null,
      description: 'Notes',
      firstName: null,
      lastName: null,
      honorificTitle: null,
      primaryMobile: null,
      email: null,
      companyPhone: '+20221234567',
      companyEmail: 'info@acme.com',
      companyWebsite: 'https://acme.com',
      phones: ['+20221234567'],
      address: {
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
        country: 'Egypt',
        city: 'Cairo',
        area: 'Maadi',
        street: '14 Road 231',
        buildingNo: null,
        floor: null,
        apartment: null,
        landmark: null,
        postalCode: null,
      },
      cityId: null,
      cityName: null,
      primaryContact: null,
      contacts: [],
      customFields: {},
    };

    const draft = draftFromDetail(detail, 'comp-1');
    expect(draft.companyId).toBe('comp-1');
    expect(draft.legalName).toBe('Acme S.A.E.');
    expect(draft.taxNumber).toBe('300-1');
    expect(draft.commercialRegistrationNumber).toBe('CR-1');
    expect(draft.legacyAddress).toBe('14 Road 231, Maadi, Cairo, Egypt');
    expect(formatLegacyAddress({ ...detail.address!, countryId: 'geo-eg' })).toBe('');
  });

  it('compares drafts ignoring whitespace and computes tag diffs', () => {
    const a = individual();
    const b = { ...structuredClone(a), firstName: ' Mona ', phones: ['+201001234567', ' '] };
    expect(draftsEqual(a, b)).toBe(true);
    expect(diffTags(['t1', 't2'], ['t2', 't3'])).toEqual({ added: ['t3'], removed: ['t1'] });
  });

  it('maps backend error codes to section and form errors', () => {
    const contactErr = mapServerErrors(
      new ApiError(422, 'CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED'),
      corporate({ contacts: [contact({ isPrimary: true, firstName: '' })] }),
    );
    expect(contactErr['contacts']).toBe('customerForm.server.CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED');
    expect(contactErr['contacts.0.firstName']).toBe('required');

    const partyErr = mapServerErrors(new ApiError(403, 'CUSTOMER_PROFILE_PARTY_MANAGE_REQUIRED'));
    expect(partyErr['form']).toBe('customerForm.server.CUSTOMER_PROFILE_PARTY_MANAGE_REQUIRED');
  });

  it('reads CRM_VALIDATION_FAILED details as property paths with message arrays', () => {
    const email = mapServerErrors(
      new ApiError(400, 'CRM_VALIDATION_FAILED', { companyEmail: ['companyEmail must be an email'] }),
      corporate(),
    );
    expect(email['companyEmail']).toBe('emailInvalid');
    const contactEmail = mapServerErrors(
      new ApiError(400, 'CRM_VALIDATION_FAILED', { 'contacts.0.email': ['contacts.0.email must be an email'] }),
      corporate(),
    );
    expect(contactEmail['contacts']).toBe('customerForm.server.CRM_VALIDATION_FAILED');
    expect(validationErrorPath({ 'contactChange.contact.phones': ['x'] })).toBe('contacts.phones');
    expect(validationErrorPath({ 'companyPhones.2': ['x'] })).toBe('companyPhones');
  });

  it('places a PARTY_DUPLICATE_CONTACT_METHOD clash on its field from the lowercase methodType', () => {
    const phone = mapServerErrors(
      new ApiError(409, 'PARTY_DUPLICATE_CONTACT_METHOD', { methodType: ['phone'], level: ['company'] }),
      corporate(),
    );
    expect(phone['companyPhones']).toBe('customerForm.server.PARTY_DUPLICATE_CONTACT_METHOD');
    const email = mapServerErrors(
      new ApiError(409, 'PARTY_DUPLICATE_CONTACT_METHOD', { methodType: ['email'], level: ['branch'] }),
      individual(),
    );
    expect(email['email']).toBe('customerForm.server.PARTY_DUPLICATE_CONTACT_METHOD');
    const whatsapp = mapServerErrors(
      new ApiError(409, 'PARTY_DUPLICATE_CONTACT_METHOD', { methodType: ['whatsapp'], level: ['user'] }),
      individual(),
    );
    expect(whatsapp['phones']).toBe('customerForm.server.PARTY_DUPLICATE_CONTACT_METHOD');
  });

  it('places LEAD_PHONE_INVALID on the first phone field', () => {
    const error = new ApiError(422, 'LEAD_PHONE_INVALID');
    expect(mapServerErrors(error, individual())['phones.0']).toBe('phoneInvalid');
    expect(mapServerErrors(error, corporate())['companyPhones.0']).toBe('phoneInvalid');
  });

  it('places geo, tag and branch errors on their fields', () => {
    const geo = mapServerErrors(new ApiError(422, 'LEAD_ADDRESS_GEO_INVALID', { field: ['cityId'] }));
    expect(geo['address.cityId']).toBe('customerForm.server.LEAD_ADDRESS_GEO_INVALID');
    const incomplete = mapServerErrors(new ApiError(422, 'LEAD_ADDRESS_GEO_INCOMPLETE', { field: ['stateId'] }));
    expect(incomplete['address.stateId']).toBe('customerForm.server.LEAD_ADDRESS_GEO_INCOMPLETE');
    expect(mapServerErrors(new ApiError(422, 'CRM_TAG_UNKNOWN', { tagIds: ['t9'] }))['tagIds']).toBe(
      'customerForm.server.CRM_TAG_UNKNOWN',
    );
    expect(mapServerErrors(new ApiError(404, 'CRM_RECORD_TAG_NOT_FOUND'))['tagIds']).toBe('customerForm.server.CRM_TAG_NOT_FOUND');
    expect(mapServerErrors(new ApiError(403, 'BRANCH_CONTEXT_REQUIRED'))['branchId']).toBe('required');
  });
});
