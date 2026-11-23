import { inject, signal, resource } from '@angular/core';
import { settingsTimeZone } from '../../settings/shared/settings-time-zone';
import { runInCrm } from '../../shared/crm-runtime';
import { CurrentUser } from '../../../../core/auth/current-user';
import { FieldOption, rememberFieldOptions } from '../../../../shared/query-builder/query.model';
import { CUSTOMER_DEFAULT_SORT, CustomerSearchBody } from '../customers.model';
import { RecordSearchStore, createRecordSearchStore } from '../../shared/record/search/record-search-store';
import { defaultCustomerQuery, emptyCustomerQuery, facetsToQuery, queryToFacets } from './customer-search.chips';
import { compileCustomerQuery } from './customer-search.compile';
import { CustomerSearchFieldsContext, customerSearchFields } from './customer-search.fields';

export interface CustomerSearchInitContext
  extends Omit<CustomerSearchFieldsContext, 't' | 'language'> {
  branchId: string;
}

export type CustomerSearchStore = RecordSearchStore<CustomerSearchInitContext, CustomerSearchBody>;

/** Create a route-scoped search store for CRM Customers backed by URL persistence and the shared query engine. */
export function createCustomerSearchStore(): CustomerSearchStore {
  const currentUser = inject(CurrentUser, { optional: true });
  const loadedOwners = signal<FieldOption[]>([]);
  const branch = signal('');
  const timeZone = resource({ params: () => branch() || undefined,
    loader: () => runInCrm(() => settingsTimeZone()).catch(() => null) });
  let ownersLoadSeq = 0;

  const store = createRecordSearchStore<CustomerSearchInitContext, CustomerSearchBody>({
    fields: (ctx, { language, t }) =>
      customerSearchFields({
        sources: ctx.sources,
        tags: ctx.tags,
        owners: ctx.owners,
        ownerOptions: loadedOwners().length > 0 ? loadedOwners() : ctx.ownerOptions,
        language,
        t,
        statuses: ctx.statuses,
        unavailable: ctx.unavailable,
        dateHint: timeZone.value() ? undefined : t('customers.dates.utcHint'),
      }),
    compile: (query, ctx, { currentUserId, timeZone }) => {
      const compiled = compileCustomerQuery(query, {
        branchId: ctx.branchId,
        meUserId: currentUserId,
        timeZone,
      });
      // Explicit sort, most recently changed first; the table replaces it with its column sort.
      return { ...compiled, body: { ...compiled.body, sort: compiled.body.sort ?? CUSTOMER_DEFAULT_SORT } };
    },
    defaultQuery: () => defaultCustomerQuery(),
    emptyQuery: () => emptyCustomerQuery(),
    facetsToQuery: (facets, _ctx, { prev, fields }) => {
      const { query, rejected } = facetsToQuery(prev, facets, fields);
      return {
        query,
        rejected: rejected.map((item) => ({ field: item.field, reasonKey: item.code })),
      };
    },
    queryToFacets: (query, _ctx, { fields, t }) => queryToFacets(query, fields, t),
    rejectedKeyPrefix: 'customers.search.rejected.',
    currentUserId: () => currentUser?.userId() ?? '',
    timeZone: () => timeZone.value() ?? 'UTC',
    initialCtx: {
      branchId: '',
      sources: [],
      tags: [],
      owners: async () => [],
      ownerOptions: [],
    },
  });

  const baseInit = store.init.bind(store);
  const cacheOwners = (list: FieldOption[]) => {
    if (list.length === 0) return;
    rememberFieldOptions('ownerUserId', list);
    loadedOwners.update((prev) => {
      const merged = new Map(prev.map((item) => [item.value, item]));
      let changed = false;
      for (const item of list) {
        const existing = merged.get(item.value);
        if (!existing || existing.label !== item.label) {
          merged.set(item.value, item);
          changed = true;
        }
      }
      return changed ? Array.from(merged.values()) : prev;
    });
  };

  store.init = (ctx: CustomerSearchInitContext) => {
    if (branch() !== ctx.branchId) loadedOwners.set([]);
    branch.set(ctx.branchId);
    const seq = ++ownersLoadSeq;
    if (ctx.ownerOptions?.length) {
      cacheOwners(ctx.ownerOptions);
    }
    const wrappedOwners = async (term: string): Promise<FieldOption[]> => {
      const results = await ctx.owners(term);
      if (seq === ownersLoadSeq) cacheOwners(results);
      return results;
    };
    baseInit({ ...ctx, owners: wrappedOwners });
    if (!ctx.ownerOptions?.length) {
      void wrappedOwners('').catch(() => {});
    }
  };

  return store;
}
