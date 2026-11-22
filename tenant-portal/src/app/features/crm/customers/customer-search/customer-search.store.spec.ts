import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import { CurrentUser } from '../../../../core/auth/current-user';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { CUSTOMER_DEFAULT_SORT } from '../customers.model';
import { createCustomerSearchStore } from './customer-search.store';

function initStore() {
  const store = TestBed.runInInjectionContext(() => createCustomerSearchStore());
  store.init({ branchId: 'b1', sources: [], tags: [], owners: async () => [], ownerOptions: [] });
  return store;
}

describe('customer search store: sent sort', () => {
  beforeEach(() => {
    // The store injects these optionally; the root versions need the full i18n setup.
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslocoService, useValue: null },
        { provide: LanguageState, useValue: null },
        { provide: Notify, useValue: null },
        { provide: CurrentUser, useValue: null },
      ],
    });
  });

  it('sends updatedAt:DESC on every Board/Cards/Table body (the backend fallback is createdAt ASC)', () => {
    const body = initStore().body();
    expect(CUSTOMER_DEFAULT_SORT).toBe('updatedAt:DESC');
    expect(body).toMatchObject({ branchId: 'b1', sort: 'updatedAt:DESC' });
  });

  it('lets a column sort replace the default when spread after the store body (customer-table)', () => {
    const body = { ...initStore().body(), sort: 'rating:DESC' as const };
    expect(body.sort).toBe('rating:DESC');
  });
});
