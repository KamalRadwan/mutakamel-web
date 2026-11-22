import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { ActionKeys, coreFieldErrors, coreValidationDetails, fieldMessages, hasOtherFields } from './core-response.model';
import { invalidCityIdsOf, usedByOf, zoneConflictsOf } from './geography/geo-admin.model';

describe('CORE_VALIDATION_FAILED reading', () => {
  const error = new ApiError(400, 'CORE_VALIDATION_FAILED', {
    nameEn: ['nameEn should not be empty'],
    cityIds: ['cityIds must contain no more than 500 elements', "All cityIds's elements must be unique"],
    ignored: 'not a list',
  });

  it('returns the field messages only for CORE_VALIDATION_FAILED', () => {
    expect(coreFieldErrors(error)).toEqual({
      nameEn: ['nameEn should not be empty'],
      cityIds: ['cityIds must contain no more than 500 elements', "All cityIds's elements must be unique"],
    });
    expect(coreFieldErrors(new ApiError(409, 'GEO_ZONE_NAME_TAKEN'))).toBeNull();
    expect(coreFieldErrors('CORE_VALIDATION_FAILED')).toBeNull();
  });

  it('picks the first message per form field and spots other fields', () => {
    const fields = coreFieldErrors(error)!;
    expect(fieldMessages(fields, ['nameEn', 'nameAr'] as const)).toEqual({ nameEn: 'nameEn should not be empty' });
    expect(hasOtherFields(fields, ['nameEn'])).toBe(true);
    expect(hasOtherFields(fields, ['nameEn', 'cityIds'])).toBe(false);
  });

  it('builds the fake details in the same shape', () => {
    expect(coreValidationDetails({ code: 'immutable', rate: 'invalid' })).toEqual({
      code: ['property code should not exist'],
      rate: ['rate is not valid'],
    });
  });
});

describe('ActionKeys', () => {
  it('reuses a key for the same action until it succeeds', () => {
    let n = 0;
    const keys = new ActionKeys(() => `k${++n}`);
    expect(keys.keyFor('delete:a')).toBe('k1');
    expect(keys.keyFor('delete:a')).toBe('k1');
    expect(keys.keyFor('delete:b')).toBe('k2');
    keys.done('delete:a');
    expect(keys.keyFor('delete:a')).toBe('k3');
  });
});

describe('geo error details', () => {
  it('reads usedBy, zone conflicts and invalid city ids', () => {
    expect(usedByOf({ usedBy: ['addresses', 'zones', 'other'] })).toEqual(['addresses', 'zones']);
    expect(usedByOf(undefined)).toEqual([]);
    expect(zoneConflictsOf({ cityIds: ['c1', 'c2'], zoneIds: ['z1', 'z2'] })).toEqual([
      { cityId: 'c1', zoneId: 'z1' },
      { cityId: 'c2', zoneId: 'z2' },
    ]);
    expect(invalidCityIdsOf({ cityIds: ['c9'] })).toEqual(['c9']);
  });
});
