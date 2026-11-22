import { describe, expect, it } from 'vitest';
import { emptyDraft, isDirty, toPatchBody, validateDraft, type OpportunityDraft } from './opportunity-draft';

const AT = '2026-11-21T10:00:00Z';

function base(overrides: Partial<OpportunityDraft> = {}): OpportunityDraft {
  return {
    ...emptyDraft({ branchId: 'br-1', companyId: 'co-1', ownerUserId: 'u-1', pipeline: null, defaultCurrency: 'SAR' }),
    customerProfileId: 'cp-1',
    contactPartyId: 'p-1',
    pipelineId: 'pl-1',
    stageId: 'st-1',
    title: 'Deal',
    description: 'Some text',
    amount: '1000.50',
    currencyCode: 'SAR',
    expectedCloseDate: '2026-12-31',
    probabilityPercent: '40',
    tagIds: ['t1', 't2'],
    customFields: { region: 'east', sizes: ['s', 'm'] },
    ...overrides,
  };
}

describe('toPatchBody', () => {
  it('returns null when nothing changed', () => {
    expect(toPatchBody(base(), base(), AT)).toBeNull();
  });

  it('ignores whitespace-only differences', () => {
    expect(toPatchBody(base(), base({ title: '  Deal ', description: 'Some text  ' }), AT)).toBeNull();
  });

  it('sends nulls for cleared fields', () => {
    const body = toPatchBody(
      base(),
      base({ description: '  ', contactPartyId: null, expectedCloseDate: null, probabilityPercent: '' }),
      AT,
    );
    expect(body).toEqual({
      expectedUpdatedAt: AT,
      description: null,
      contactPartyId: null,
      expectedCloseDate: null,
      probabilityPercent: null,
    });
  });

  it('sends a cleared custom field as null and only changed custom keys', () => {
    const body = toPatchBody(base(), base({ customFields: { region: '', sizes: ['s', 'm'] } }), AT);
    expect(body).toEqual({ expectedUpdatedAt: AT, customFields: { region: null } });
  });

  it('clearing the amount sends amount and currencyCode null', () => {
    expect(toPatchBody(base(), base({ amount: '' }), AT)).toEqual({
      expectedUpdatedAt: AT,
      amount: null,
      currencyCode: null,
    });
  });

  it('clearing the amount sends currencyCode null even when the draft still holds a currency', () => {
    const body = toPatchBody(base(), base({ amount: '   ', currencyCode: 'USD' }), AT);
    expect(body?.amount).toBeNull();
    expect(body?.currencyCode).toBeNull();
  });

  it('sends amount and currency changes', () => {
    expect(toPatchBody(base(), base({ amount: '2000', currencyCode: 'USD' }), AT)).toEqual({
      expectedUpdatedAt: AT,
      amount: '2000',
      currencyCode: 'USD',
    });
  });

  it('parses probability to a number', () => {
    expect(toPatchBody(base(), base({ probabilityPercent: '75' }), AT)).toEqual({
      expectedUpdatedAt: AT,
      probabilityPercent: 75,
    });
  });

  it('never sends a null owner (owner cannot be cleared)', () => {
    expect(toPatchBody(base(), base({ ownerUserId: null }), AT)).toBeNull();
    expect(toPatchBody(base(), base({ ownerUserId: 'u-2' }), AT)).toEqual({ expectedUpdatedAt: AT, ownerUserId: 'u-2' });
  });

  it('does not carry tagIds; a tags-only edit returns null', () => {
    expect(toPatchBody(base(), base({ tagIds: ['t1', 't2', 't3'] }), AT)).toBeNull();
    expect(toPatchBody(base(), base({ title: 'New', tagIds: [] }), AT)).not.toHaveProperty('tagIds');
  });
});

describe('validateDraft amount regex (16 integer digits + 8 decimals)', () => {
  const amountError = (amount: string) => validateDraft(base({ amount }), 'edit', [])['amount'];

  it.each(['1', '0.5', '1234567890123456', '1234567890123456.12345678', '12.1'])('accepts %s', (amount) => {
    expect(amountError(amount)).toBeUndefined();
  });

  it.each(['12345678901234567', '1.123456789', '-1', '1.', '.5', '1,000', 'abc', '1e5'])('rejects %s', (amount) => {
    expect(amountError(amount)).toBe('oppForm.errors.amountInvalid');
  });

  it('requires a currency only when there is an amount', () => {
    expect(validateDraft(base({ currencyCode: null }), 'edit', [])['currencyCode']).toBe(
      'oppForm.errors.amountCurrencyRequired',
    );
    expect(validateDraft(base({ amount: '', currencyCode: null }), 'edit', [])['currencyCode']).toBeUndefined();
  });
});

describe('isDirty', () => {
  it('is false for an identical copy', () => {
    expect(isDirty(base(), base())).toBe(false);
  });

  it('treats tags as a set: reorder and duplicates are not dirty', () => {
    expect(isDirty(base(), base({ tagIds: ['t2', 't1'] }))).toBe(false);
    expect(isDirty(base(), base({ tagIds: ['t1', 't2', 't1'] }))).toBe(false);
  });

  it('is dirty when tags are added or removed', () => {
    expect(isDirty(base(), base({ tagIds: ['t1'] }))).toBe(true);
    expect(isDirty(base(), base({ tagIds: ['t1', 't2', 't3'] }))).toBe(true);
  });

  it('is dirty on a real field change but not on whitespace or empty custom values', () => {
    expect(isDirty(base(), base({ title: 'Other' }))).toBe(true);
    expect(isDirty(base(), base({ title: ' Deal ' }))).toBe(false);
    expect(isDirty(base({ customFields: {} }), base({ customFields: { x: '', y: [], z: null } }))).toBe(false);
  });

  it('seeding a draft does not dirty it', () => {
    const seeded = emptyDraft({
      branchId: 'br-1',
      companyId: 'co-1',
      ownerUserId: 'u-1',
      pipeline: null,
      stageId: 'st-1',
      defaultCurrency: 'SAR',
    });
    const copy: OpportunityDraft = { ...seeded, tagIds: [...seeded.tagIds], customFields: { ...seeded.customFields } };
    expect(isDirty(seeded, copy)).toBe(false);
    expect(toPatchBody(seeded, copy, AT)).toBeNull();
  });
});
