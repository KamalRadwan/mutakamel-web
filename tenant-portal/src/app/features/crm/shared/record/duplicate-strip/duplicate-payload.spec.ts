/** Contract spec: the live duplicate probe against crm-app LeadDuplicateCheckDto. */
import { describe, expect, it } from 'vitest';
import { DUPLICATE_CHECK_LIMITS, buildPayload } from './duplicate-payload';
import { DuplicateProbe } from './duplicate.model';

const probe = (patch: Partial<DuplicateProbe> = {}): DuplicateProbe => ({
  branchId: 'b1',
  ownerUserId: null,
  name: '',
  phones: [],
  email: '',
  taxNumber: '',
  commercialRegistrationNumber: '',
  excludePartyId: null,
  corporate: false,
  ...patch,
});

describe('buildPayload', () => {
  it('sends nothing without a branch or without any meaningful probe (avoids 422 LEAD_DUPLICATE_CHECK_EMPTY)', () => {
    expect(buildPayload(probe({ branchId: null, name: 'Acme Trading' }))).toBeNull();
    expect(buildPayload(probe({ name: 'ab' }))).toBeNull();
  });

  it('sends only the DTO field names', () => {
    const payload = buildPayload(
      probe({
        ownerUserId: 'u1',
        name: ' Acme Trading ',
        phones: ['+201012345678', '12'],
        email: 'info@acme.com',
        taxNumber: '123456',
        commercialRegistrationNumber: '987654',
        excludePartyId: 'party-1',
      }),
    );
    expect(payload).toEqual({
      branchId: 'b1',
      ownerUserId: 'u1',
      name: 'Acme Trading',
      phones: ['+201012345678'],
      email: 'info@acme.com',
      taxNumber: '123456',
      commercialRegistrationNumber: '987654',
      excludePartyId: 'party-1',
    });
  });

  it('leaves out probes past the DTO limits instead of sending a 400 body', () => {
    const payload = buildPayload(
      probe({
        name: 'x'.repeat(DUPLICATE_CHECK_LIMITS.name + 1),
        phones: Array.from({ length: 12 }, (_, n) => `+2010123456${String(n).padStart(2, '0')}`),
        email: `${'a'.repeat(DUPLICATE_CHECK_LIMITS.email)}@acme.com`,
        taxNumber: '1'.repeat(DUPLICATE_CHECK_LIMITS.taxNumber + 1),
      }),
    );
    expect(payload).toEqual({ branchId: 'b1', phones: expect.any(Array) });
    expect(payload?.phones).toHaveLength(DUPLICATE_CHECK_LIMITS.phones);
  });
});
