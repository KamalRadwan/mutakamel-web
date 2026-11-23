import { vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { bindCrmHttpForTest } from '../crm-http';
import { CrmHttpStub } from '../testing/crm-http-testing';
import { customerContacts, customerOptions } from './customer-pickers';

const row = { id: 'profile', partyId: 'party', displayName: 'Customer', profileType: 'INDIVIDUAL' };
const contact = { partyId: 'contact', displayName: 'Contact', isPrimary: true, email: 'contact@example.test', phones: ['+201000000001'], jobTitle: null };

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('%s / %s', (lang, theme) => {
  let stub: CrmHttpStub;
  let dispose: () => void;
  let htmlAttributes: (string | null)[];
  beforeEach(() => {
    htmlAttributes = ['lang', 'dir', 'data-theme'].map((name) => document.documentElement.getAttribute(name));
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    stub = new CrmHttpStub({
      '/customer-profiles': { items: [{ ...row, description: 'Not an option field' }], total: 1 },
      '/customer-profiles/individual': { ...row, email: 'customer@example.test', phones: ['+201000000000'], contacts: [contact] },
      '/customer-profiles/corporate': { ...row, profileType: 'CORPORATE', contacts: [contact] },
    });
    dispose = bindCrmHttpForTest(stub);
  });
  afterEach(() => {
    ['lang', 'dir', 'data-theme'].forEach((name, i) => htmlAttributes[i] === null
      ? document.documentElement.removeAttribute(name) : document.documentElement.setAttribute(name, htmlAttributes[i]!));
    vi.restoreAllMocks();
    dispose();
  });

  describe('customerOptions', () => {
    it('maps the list', async () => {
      expect(await customerOptions('branch', 'Customer', 20)).toEqual([row]);
      expect(stub.recordedReads()).toEqual([{ path: '/customer-profiles', query: {
        branchId: 'branch', search: 'Customer', searchField: 'customer', limit: 20,
      }, scope: undefined }]);
    });

    it('403 is a denial, not a crash', async () => {
      const error = new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED', undefined, { correlationId: 'denial' });
      vi.spyOn(stub, 'read').mockRejectedValueOnce(error);
      expect(await customerOptions('branch', '', 20)).toEqual({ kind: 'denied', error });
    });

    it('preserves load failures and does not request a company-only selection', async () => {
      expect(await customerOptions('', '', 20)).toEqual([]);
      expect(stub.recordedReads()).toEqual([]);
      const error = new ApiError(503, 'SERVICE_UNAVAILABLE');
      vi.spyOn(stub, 'read').mockRejectedValueOnce(error);
      await expect(customerOptions('branch', '', 20)).rejects.toBe(error);
    });
  });

  describe('customerContacts', () => {
    it('individual and corporate', async () => {
      expect(await customerContacts('individual')).toEqual([
        { partyId: 'party', displayName: 'Customer', isPrimary: true, email: 'customer@example.test',
          phones: ['+201000000000'], jobTitle: null, isCustomerParty: true },
        { ...contact, isCustomerParty: false },
      ]);
      expect(await customerContacts('corporate')).toEqual([{ ...contact, isCustomerParty: false }]);
      expect(stub.recordedReads().map(({ path, scope }) => ({ path, scope }))).toEqual([
        { path: '/customer-profiles/individual', scope: undefined },
        { path: '/customer-profiles/corporate', scope: undefined },
      ]);
    });
  });
});
