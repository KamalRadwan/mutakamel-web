import { describe, expect, it } from 'vitest';
import { mapOpportunityApiError } from './opportunity-form-errors';

describe('mapOpportunityApiError', () => {
  it.each([
    ['OPPORTUNITY_OWNER_INELIGIBLE', 'ownerUserId'],
    ['OPPORTUNITY_AMOUNT_CURRENCY_REQUIRED', 'currencyCode'],
    ['OPPORTUNITY_CONTACT_CUSTOMER_MISMATCH', 'contactPartyId'],
    ['OPPORTUNITY_CREATE_STAGE_TERMINAL', 'stageId'],
    ['PIPELINE_STAGE_NOT_FOUND', 'stageId'],
    ['CUSTOMER_PROFILE_NOT_FOUND', 'customerProfileId'],
    ['PARTY_NOT_FOUND', 'contactPartyId'],
  ])('maps %s to %s with the bare code', (code, field) => {
    expect(mapOpportunityApiError({ code, message: 'x' })).toEqual({ [field]: code });
  });

  it('maps a blacklisted customer to its i18n key', () => {
    expect(mapOpportunityApiError({ code: 'CUSTOMER_PROFILE_BLACKLISTED' })).toEqual({
      customerProfileId: 'oppForm.errors.customerBlacklisted',
    });
  });

  describe('custom fields', () => {
    it('uses details.path with the customFields. prefix', () => {
      expect(
        mapOpportunityApiError({ code: 'CUSTOM_FIELD_REQUIRED', details: { path: 'customFields.region' } }),
      ).toEqual({ 'customFields.region': 'oppForm.errors.required' });
    });

    it('uses details.field without prefix', () => {
      expect(mapOpportunityApiError({ code: 'CUSTOM_FIELD_VALUE_INVALID', details: { field: 'budget' } })).toEqual({
        'customFields.budget': 'oppForm.errors.cfInvalid',
      });
    });

    it('falls back to the key in the backend message', () => {
      expect(
        mapOpportunityApiError({ code: 'CUSTOM_FIELD_INACTIVE', message: "Custom field 'old_key' is inactive" }),
      ).toEqual({ 'customFields.old_key': 'oppForm.errors.cfUnavailable' });
    });

    it('maps to the customFields section when no key is known', () => {
      expect(mapOpportunityApiError({ code: 'CUSTOM_FIELD_INVALID', message: 'nope' })).toEqual({
        customFields: 'oppForm.errors.cfUnavailable',
      });
    });

    it('maps CUSTOM_FIELD_VALUE_REQUIRED to required', () => {
      expect(mapOpportunityApiError({ code: 'CUSTOM_FIELD_VALUE_REQUIRED', details: { path: 'k' } })).toEqual({
        'customFields.k': 'oppForm.errors.required',
      });
    });
  });

  describe('validation details', () => {
    it('maps detail keys that name draft fields or custom fields', () => {
      expect(
        mapOpportunityApiError({
          code: 'VALIDATION_FAILED',
          details: { title: 'too long', 'customFields.size': 'bad', unrelated: 'x' },
        }),
      ).toEqual({ title: 'oppForm.errors.invalid', 'customFields.size': 'oppForm.errors.invalid' });
    });

    it('maps details.path naming a draft field', () => {
      expect(mapOpportunityApiError({ code: 'VALIDATION_FAILED', details: { path: 'amount' } })).toEqual({
        amount: 'oppForm.errors.invalid',
      });
    });
  });

  describe('unknown errors return null (host shows a toast)', () => {
    it.each([
      ['unknown code without details', { code: 'SOMETHING_ELSE', message: 'x' }],
      ['unknown code with unrelated details', { code: 'SOMETHING_ELSE', details: { foo: 1 } }],
      ['no code', { message: 'x' }],
      ['null', null],
      ['string', 'OPPORTUNITY_OWNER_INELIGIBLE'],
      ['Error instance without code', new Error('network')],
    ])('%s', (_label, error) => {
      expect(mapOpportunityApiError(error)).toBeNull();
    });
  });
});
