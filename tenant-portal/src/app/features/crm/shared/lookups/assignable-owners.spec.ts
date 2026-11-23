import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { bindCrmHttpForTest } from '../crm-http';
import { CrmHttpStub } from '../testing/crm-http-testing';
import { listAssignableOwners } from './assignable-owners';

const companyId = '019f0000-0000-7000-8000-000000000010';
const branchId = '019f0000-0000-7000-8000-000000000011';
const cursor = '019f0000-0000-7000-8000-000000000012';
const owner = { id: cursor, displayName: 'Owner', avatarUrl: null };

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('%s / %s', (lang, theme) => {
  describe('assignableOwners', () => {
    const selection = signal<{ companyId: string; branchId: string | null } | null>(null);
    const branchCompanies = signal<ReadonlyMap<string, string>>(new Map());
    let stub: CrmHttpStub;
    let dispose: () => void;
    let htmlAttributes: (string | null)[];

    beforeEach(() => {
      htmlAttributes = ['lang', 'dir', 'data-theme'].map((name) => document.documentElement.getAttribute(name));
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.dataset['theme'] = theme;
      selection.set({ companyId, branchId });
      branchCompanies.set(new Map([[branchId, companyId]]));
      TestBed.configureTestingModule({ providers: [{ provide: TenantScopeState, useValue: { selection, branchCompanies } }] });
      stub = new CrmHttpStub({ '/assignable-owners': { items: [owner], nextCursor: cursor } });
      dispose = bindCrmHttpForTest(stub);
    });

    afterEach(() => {
      ['lang', 'dir', 'data-theme'].forEach((name, i) => htmlAttributes[i] === null
        ? document.documentElement.removeAttribute(name) : document.documentElement.setAttribute(name, htmlAttributes[i]!));
      dispose();
    });

    it('sends both scope headers', async () => {
      for (const resource of ['leads', 'customer_profiles', 'opportunities'] as const) {
        const page = await TestBed.runInInjectionContext(() => listAssignableOwners(branchId, resource, 'create'));
        expect(page.items).toEqual([owner]);
        const read = stub.recordedReads().at(-1)!;
        expect(read.scope).toEqual({ companyId, branchId });
        for (const value of Object.values(read.scope!)) expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        expect(read.query).toEqual({ branchId, resource, action: 'create', cursor: undefined, limit: 100 });
      }
    });

    it('pages by cursor', async () => {
      const first = await TestBed.runInInjectionContext(() => listAssignableOwners(branchId, 'leads', 'update', { limit: 500 }));
      await TestBed.runInInjectionContext(() => listAssignableOwners(branchId, 'leads', 'update', { cursor: first.nextCursor!, limit: 200 }));
      expect(stub.recordedReads().map((read) => read.query?.['cursor'])).toEqual([undefined, cursor]);
      expect(stub.recordedReads().every((read) => read.query?.['limit'] === 200)).toBe(true);
      expect(stub.recordedReads().every((read) => read.scope?.companyId === companyId && read.scope.branchId === branchId)).toBe(true);
    });

    it('makes no request without a usable session branch', async () => {
      for (const selected of [null, { companyId, branchId: null }, { companyId, branchId: cursor }]) {
        selection.set(selected);
        expect(await TestBed.runInInjectionContext(() => listAssignableOwners(branchId, 'leads', 'create'))).toEqual({ items: [], nextCursor: null });
      }
      selection.set({ companyId, branchId });
      branchCompanies.set(new Map());
      expect(await TestBed.runInInjectionContext(() => listAssignableOwners(branchId, 'leads', 'create'))).toEqual({ items: [], nextCursor: null });
      expect(stub.recordedReads()).toEqual([]);
    });

    it('filters search on the cursor page without sending a field absent from the DTO', async () => {
      const page = await TestBed.runInInjectionContext(() => listAssignableOwners(branchId, 'leads', 'create', { search: 'missing' }));
      expect(page).toEqual({ items: [], nextCursor: cursor });
      expect(stub.recordedReads()[0].query).not.toHaveProperty('search');
    });
  });
});
