import { describe, expect, it } from 'vitest';
import { ContactDraft, LeadDraft, LEAD_LIMITS, draftsEqual, emptyDraft, newContact, toCreateBody, toPatchBody, validateDraft } from './lead-draft';

function individual(overrides: Partial<LeadDraft> = {}): LeadDraft {
  return emptyDraft({ branchId: 'b1', firstName: 'Mona', phones: ['+201001234567'], ...overrides });
}

function contact(overrides: Partial<ContactDraft> = {}): ContactDraft {
  return { ...newContact(false), firstName: 'Sami', phones: ['+201002223334'], ...overrides };
}

function corporate(overrides: Partial<LeadDraft> = {}): LeadDraft {
  return emptyDraft({
    leadProfileType: 'CORPORATE',
    branchId: 'b1',
    companyName: 'Acme',
    contacts: [contact({ isPrimary: true })],
    ...overrides,
  });
}

describe('emptyDraft', () => {
  it('gives a corporate draft one primary contact and an individual draft none', () => {
    expect(emptyDraft({ leadProfileType: 'CORPORATE' }).contacts).toHaveLength(1);
    expect(emptyDraft({ leadProfileType: 'CORPORATE' }).contacts[0].isPrimary).toBe(true);
    expect(emptyDraft().contacts).toEqual([]);
  });

  it('does not share arrays with the preset', () => {
    const phones = ['+201001234567'];
    const draft = emptyDraft({ phones });

    draft.phones.push('x');

    expect(phones).toEqual(['+201001234567']);
  });
});

describe('validateDraft: individual', () => {
  it('accepts a minimal valid draft', () => {
    expect(validateDraft(individual(), 'create', [])).toEqual({});
  });

  it('requires a branch', () => {
    expect(validateDraft(individual({ branchId: null }), 'create', [])['branchId']).toBe('required');
  });

  it('requires a first name', () => {
    expect(validateDraft(individual({ firstName: '  ' }), 'create', [])['firstName']).toBe('required');
  });

  it('requires a phone or an email', () => {
    const errors = validateDraft(individual({ phones: [''], email: '' }), 'create', []);

    expect(errors['reach']).toBe('reachRequired');
  });

  it('accepts an email alone as reach', () => {
    expect(validateDraft(individual({ phones: [''], email: 'a@b.co' }), 'create', [])['reach']).toBeUndefined();
  });

  it('flags an invalid email', () => {
    expect(validateDraft(individual({ email: 'nope' }), 'create', [])['email']).toBe('emailInvalid');
  });

  it('flags a phone with fewer than five digits', () => {
    expect(validateDraft(individual({ phones: ['12-3'] }), 'create', [])['phones.0']).toBe('phoneInvalid');
  });

  it('flags phone characters outside the allowed set', () => {
    expect(validateDraft(individual({ phones: ['abc12345'] }), 'create', [])['phones.0']).toBe('phoneInvalid');
  });

  it('flags a duplicate phone in the same list after normalisation', () => {
    const errors = validateDraft(individual({ phones: ['+20 100 123 4567', '0020 100 123 4567'] }), 'create', []);

    expect(errors['phones.1']).toBeDefined();
  });
});

describe('validateDraft: expected value and currency', () => {
  it('requires a currency when a value is given', () => {
    const errors = validateDraft(individual({ expectedValue: '100', currencyCode: null }), 'create', []);

    expect(errors['currencyCode']).toBe('valueCurrencyRequired');
  });

  it('requires a value when a currency is given', () => {
    const errors = validateDraft(individual({ expectedValue: '', currencyCode: 'EGP' }), 'create', []);

    expect(errors['expectedValue']).toBe('currencyValueRequired');
  });

  it('accepts a zero value, as the backend does', () => {
    expect(validateDraft(individual({ expectedValue: '0.00', currencyCode: 'EGP' }), 'create', [])['expectedValue']).toBeUndefined();
  });

  it('rejects a non-numeric value', () => {
    expect(validateDraft(individual({ expectedValue: '12a', currencyCode: 'EGP' }), 'create', [])['expectedValue']).toBe(
      'valueInvalid',
    );
  });

  it('accepts an integer and a two-decimal value', () => {
    expect(validateDraft(individual({ expectedValue: '1500', currencyCode: 'EGP' }), 'create', [])).toEqual({});
    expect(validateDraft(individual({ expectedValue: '1500.25', currencyCode: 'EGP' }), 'create', [])).toEqual({});
  });

  it('exposes the numeric(24,8) input limits', () => {
    expect(LEAD_LIMITS.valueIntegerDigits).toBe(16);
    expect(LEAD_LIMITS.valueDecimals).toBe(8);
  });

  it.each(['9999999999999999.99999999', '0.00000001', '125000.000'])('keeps the full accepted value %s in create and patch bodies', (expectedValue) => {
    const draft = individual({ expectedValue, currencyCode: 'KWD' });
    expect(validateDraft(draft, 'create', [])).toEqual({});
    expect(toCreateBody(draft)).toMatchObject({ expectedValue, currencyCode: 'KWD' });
    expect(toPatchBody(individual(), draft, '2026-11-21T10:00:00.000Z')).toMatchObject({ expectedValue, currencyCode: 'KWD' });
  });

  it.each(['10000000000000000', '1.123456789', '-1', '1e3'])('rejects invalid 24/8 input %s', (expectedValue) => {
    expect(validateDraft(individual({ expectedValue, currencyCode: 'KWD' }), 'create', [])['expectedValue']).toBe('valueInvalid');
  });
});

describe('validateDraft: corporate contacts', () => {
  it('accepts a minimal valid corporate draft', () => {
    expect(validateDraft(corporate(), 'create', [])).toEqual({});
  });

  it('requires a company name for a new company', () => {
    expect(validateDraft(corporate({ companyName: '' }), 'create', [])['companyName']).toBe('required');
  });

  it('requires at least one contact', () => {
    expect(validateDraft(corporate({ contacts: [] }), 'create', [])['contacts']).toBe('contactsMin');
  });

  it('requires exactly one primary contact', () => {
    expect(validateDraft(corporate({ contacts: [contact(), contact({ phones: ['+201009998887'] })] }), 'create', [])['contacts']).toBe(
      'primaryOne',
    );
    expect(
      validateDraft(
        corporate({ contacts: [contact({ isPrimary: true }), contact({ isPrimary: true, phones: ['+201009998887'] })] }),
        'create',
        [],
      )['contacts'],
    ).toBe('primaryOne');
  });

  it('caps contacts at twenty', () => {
    const many = Array.from({ length: 21 }, (_, i) =>
      contact({ isPrimary: i === 0, phones: [`+2010000${String(i).padStart(4, '0')}`] }),
    );

    expect(validateDraft(corporate({ contacts: many }), 'create', [])['contacts']).toBe('contactsMax');
  });

  it('requires a first name on a new contact only', () => {
    const errors = validateDraft(corporate({ contacts: [contact({ isPrimary: true, firstName: '' })] }), 'create', []);

    expect(errors['contacts.0.firstName']).toBe('required');
  });

  it('does not require a first name on a picked existing contact', () => {
    const picked = contact({ isPrimary: true, firstName: '', contactPartyId: 'party-9' });

    expect(validateDraft(corporate({ contacts: [picked] }), 'create', [])['contacts.0.firstName']).toBeUndefined();
  });

  it('flags the same existing contact picked twice', () => {
    const a = contact({ isPrimary: true, contactPartyId: 'party-9', phones: [''] });
    const b = contact({ contactPartyId: 'party-9', phones: [''] });

    expect(validateDraft(corporate({ contacts: [a, b] }), 'create', [])['contacts']).toContain('PARTY_DUPLICATE_CONTACT_METHOD');
  });

  it('flags a contact phone that repeats another contact phone', () => {
    const a = contact({ isPrimary: true, phones: ['+201002223334'] });
    const b = contact({ phones: ['+201002223334'] });

    expect(validateDraft(corporate({ contacts: [a, b] }), 'create', [])['contacts.1.phones.0']).toContain(
      'PARTY_DUPLICATE_CONTACT_METHOD',
    );
  });

  it('flags a contact email that repeats another contact email case-insensitively', () => {
    const a = contact({ isPrimary: true, email: 'x@acme.com' });
    const b = contact({ email: 'X@ACME.com', phones: ['+201009998887'] });

    expect(validateDraft(corporate({ contacts: [a, b] }), 'create', [])['contacts.1.email']).toContain(
      'PARTY_DUPLICATE_CONTACT_METHOD',
    );
  });

  it('needs some reach on the company or a contact', () => {
    const errors = validateDraft(
      corporate({ companyPhones: [''], companyEmail: '', contacts: [contact({ isPrimary: true, phones: [''], email: '' })] }),
      'create',
      [],
    );

    expect(errors['reach']).toBe('reachRequired');
  });
});

describe('toCreateBody', () => {
  it('omits empty optional fields for an individual', () => {
    expect(toCreateBody(individual())).toEqual({
      leadProfileType: 'INDIVIDUAL',
      rating: 0,
      branchId: 'b1',
      firstName: 'Mona',
      phones: ['+201001234567'],
    });
  });

  it('trims text and drops blank phones', () => {
    const body = toCreateBody(individual({ firstName: '  Mona ', phones: [' +201001234567 ', '  '] }));

    expect(body.firstName).toBe('Mona');
    expect(body.phones).toEqual(['+201001234567']);
  });

  it('sends the value only together with its currency', () => {
    expect(toCreateBody(individual({ expectedValue: '100', currencyCode: null })).expectedValue).toBeUndefined();
    expect(toCreateBody(individual({ expectedValue: '100', currencyCode: 'EGP' }))).toMatchObject({
      expectedValue: '100',
      currencyCode: 'EGP',
    });
  });

  it('sends only the id and flags for a picked existing contact', () => {
    const picked = contact({ isPrimary: true, contactPartyId: 'party-9', jobTitle: 'CTO' });
    const body = toCreateBody(corporate({ contacts: [picked] }));

    expect(body.contacts).toEqual([{ contactPartyId: 'party-9', isPrimary: true, jobTitle: 'CTO' }]);
  });

  it('sends the person fields for a new contact', () => {
    const body = toCreateBody(corporate({ contacts: [contact({ isPrimary: true, lastName: ' Ali ', email: ' s@acme.com ' })] }));

    expect(body.contacts?.[0]).toEqual({
      firstName: 'Sami',
      lastName: 'Ali',
      isPrimary: true,
      phones: ['+201002223334'],
      email: 's@acme.com',
    });
  });

  it('omits company fields when linking an existing company', () => {
    const body = toCreateBody(corporate({ existingCompanyPartyId: 'party-1', companyName: 'Ignored' }));

    expect(body.existingCompanyPartyId).toBe('party-1');
    expect(body.companyName).toBeUndefined();
  });

  it('omits an empty address and drops blank custom fields', () => {
    const body = toCreateBody(individual({ customFields: { a: '', b: [], c: 'x' } }));

    expect(body.address).toBeUndefined();
    expect(body.customFields).toEqual({ c: 'x' });
  });
});

describe('toPatchBody', () => {
  const base = individual();

  it('always carries expectedUpdatedAt and nothing else when nothing changed', () => {
    expect(toPatchBody(base, structuredClone(base), '2026-11-21T10:00:00.000Z')).toEqual({
      expectedUpdatedAt: '2026-11-21T10:00:00.000Z',
    });
  });

  it('sends only the changed fields', () => {
    const body = toPatchBody(base, { ...base, firstName: 'Nora', rating: 3 }, 'v1');

    expect(body).toEqual({ expectedUpdatedAt: 'v1', firstName: 'Nora', rating: 3 });
  });

  it('sends null to clear a nullable field', () => {
    const body = toPatchBody({ ...base, description: 'old' }, { ...base, description: '' }, 'v1');

    expect(body.description).toBeNull();
  });

  it('never sends an empty owner change', () => {
    const body = toPatchBody({ ...base, ownerUserId: 'u1' }, { ...base, ownerUserId: null }, 'v1');

    expect(body.ownerUserId).toBeUndefined();
  });

  it('leaves contact changes to the contactChange sequence', () => {
    const corp = corporate();
    const edited = { ...corp, contacts: [{ ...corp.contacts[0], jobTitle: 'CFO' }] };

    const body = toPatchBody(corp, edited, 'v1');

    expect(body).toEqual({ expectedUpdatedAt: 'v1' });
  });

  it('does not send contacts when they are unchanged', () => {
    const corp = corporate();

    expect(toPatchBody(corp, structuredClone(corp), 'v1').contacts).toBeUndefined();
  });
});

describe('draftsEqual', () => {
  it('ignores surrounding whitespace and blank phone rows', () => {
    const a = individual();
    const b = { ...structuredClone(a), firstName: ' Mona ', phones: ['+201001234567', ' '] };

    expect(draftsEqual(a, b)).toBe(true);
  });

  it('detects a changed field', () => {
    const a = individual();

    expect(draftsEqual(a, { ...a, rating: 2 })).toBe(false);
    expect(draftsEqual(a, { ...a, customFields: { x: 'y' } })).toBe(false);
  });

  it('detects a changed contact', () => {
    const a = corporate();
    const b = { ...structuredClone(a), contacts: [{ ...a.contacts[0], firstName: 'Other' }] };

    expect(draftsEqual(a, b)).toBe(false);
  });
});
