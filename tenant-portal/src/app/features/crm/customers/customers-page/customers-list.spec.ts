import enCustomerBulk from '../../../../../../public/i18n/customer-bulk/en.json';
import arCustomerBulk from '../../../../../../public/i18n/customer-bulk/ar.json';
import enRecordBulk from '../../../../../../public/i18n/record-bulk/en.json';
import arRecordBulk from '../../../../../../public/i18n/record-bulk/ar.json';
import enActivities from '../../../../../../public/i18n/activities/en.json';
import arActivities from '../../../../../../public/i18n/activities/ar.json';
import enCustomerForm from '../../../../../../public/i18n/customer-form/en.json';
import arCustomerForm from '../../../../../../public/i18n/customer-form/ar.json';
import enCustomerModal from '../../../../../../public/i18n/customer-modal/en.json';
import arCustomerModal from '../../../../../../public/i18n/customer-modal/ar.json';
import enRecordFields from '../../../../../../public/i18n/record-fields/en.json';
import arRecordFields from '../../../../../../public/i18n/record-fields/ar.json';
import enRecordModal from '../../../../../../public/i18n/record-modal/en.json';
import arRecordModal from '../../../../../../public/i18n/record-modal/ar.json';
import enRecordPage from '../../../../../../public/i18n/record-page/en.json';
import arRecordPage from '../../../../../../public/i18n/record-page/ar.json';
import { Injectable, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../public/i18n/en.json';
import ar from '../../../../../../public/i18n/ar.json';
import enCustomers from '../../../../../../public/i18n/customers/en.json';
import arCustomers from '../../../../../../public/i18n/customers/ar.json';
import enList from '../../../../../../public/i18n/record-list/en.json';
import arList from '../../../../../../public/i18n/record-list/ar.json';
import enPagination from '../../../../../../public/i18n/ui-pagination/en.json';
import arPagination from '../../../../../../public/i18n/ui-pagination/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreWriteMethod } from '../../../../core/api/core-http';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { Notify } from '../../../../core/notify/notify';
import { LanguageState } from '../../../../core/i18n/language';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { bindCrmHttpForTest } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { CRM_SETTINGS_FIXTURES } from '../../shared/testing/crm-settings-fixtures';
import { CrmWriteOptions } from '../../shared/crm-http';
import { CustomerBoard } from '../customer-board/customer-board';
import { CustomerCards } from '../customer-cards/customer-cards';
import { CustomerTable } from '../customer-table/customer-table';
import { canManageCustomerStatus, canUpdateCustomer, formatCustomerDate } from '../customer-card/customer-card';
import { CUSTOMER_STATUS_ORDER } from '../customer-statuses';
import { CUSTOMERS_FAKE_DB } from '../customers.fake';
import { CustomerCapabilities, CustomerDetail, CustomerSearchBody, CustomerStatus, BoardResponse } from '../customers.model';
import { loadBoard, loadStatusPage, searchCustomers, getCustomerCapabilities,
  setCustomerRating, setCustomerColor, setCustomerStatus, deleteCustomer } from '../customers.api';
import { CustomersPage } from './customers-page';

const companyId = '019f0000-0000-7000-8000-000000000010';
const branchId = '019f0000-0000-7000-8000-000000000011';
const otherBranch = '019f0000-0000-7000-8000-000000000012';
const capabilities: CustomerCapabilities = { branchId, customerProfiles: {
  create: { scope: 'all', ownerUserIds: null }, update: { scope: 'all', ownerUserIds: null },
  delete: { scope: 'all', ownerUserIds: null },
} };
const row: CustomerDetail = { ...structuredClone(CUSTOMERS_FAKE_DB[0]), branchId, status: 'PROSPECT',
  updatedAt: '2026-11-23T00:00:00.000Z', displayName: 'Customer from server' };
const body: CustomerSearchBody = { branchId, sort: 'updatedAt:DESC' };

const serverCounts = { ALL: 123, PROSPECT: 80, ACTIVE_CUSTOMER: 30, INACTIVE: 10, BLACKLISTED: 3 };

function page(items: CustomerDetail[] = [row], current = 1) {
  return { counts: { ...serverCounts }, items: structuredClone(items), page: current, limit: 50, total: items.length,
    totalPages: 1, hasNext: false, hasPrev: current > 1 };
}
function board(): BoardResponse {
  return { counts: { ...serverCounts }, statuses: CUSTOMER_STATUS_ORDER.map((status) => ({ status,
    ...page(status === 'PROSPECT' ? [row] : []), total: status === 'PROSPECT' ? 57 : 0,
    hasNext: status === 'PROSPECT',
  })) };
}

class ListTransport extends CrmHttpStub {
  error: ApiError | null = null;
  constructor() { super({ ...CRM_SETTINGS_FIXTURES, '/customer-profiles/capabilities': capabilities,
    '/assignable-owners': { items: [], nextCursor: null } }); }
  override async write<T>(method: CoreWriteMethod, path: string, input: unknown, options: CrmWriteOptions) {
    const recorded = await super.write<T>(method, path, input, options);
    if (this.error) throw this.error;
    const query = input as CustomerSearchBody;
    const data = path.endsWith('/board') ? board() : path.endsWith('/search') ? page([row], query.page)
      : path.includes('/board/statuses/') ? { status: path.split('/').at(-1), ...page([], query.page) }
      : method === 'DELETE' ? undefined : { ...row, ...input as object, updatedAt: '2026-11-23T01:00:00.000Z' };
    return { ...recorded, data: data as T };
  }
}

@Injectable()
class Loader implements TranslocoLoader {
  getTranslation(path: string) {
    const dictionaries: Record<string, object> = {
      'customer-bulk/en': enCustomerBulk,
      'customer-bulk/ar': arCustomerBulk,
      'record-bulk/en': enRecordBulk,
      'record-bulk/ar': arRecordBulk,
      'activities/en': enActivities,
      'activities/ar': arActivities,
      'customer-form/en': enCustomerForm,
      'customer-form/ar': arCustomerForm,
      'customer-modal/en': enCustomerModal,
      'customer-modal/ar': arCustomerModal,
      'record-fields/en': enRecordFields,
      'record-fields/ar': arRecordFields,
      'record-modal/en': enRecordModal,
      'record-modal/ar': arRecordModal,
      'record-page/en': enRecordPage,
      'record-page/ar': arRecordPage,
    };
    return of(dictionaries[path] ?? {});
  }
}

type BoardInternals = {
  lanes(): ReturnType<typeof board>['statuses'];
  counts(): Partial<Record<CustomerStatus | 'ALL', number>>;
  canDragItem(item: CustomerDetail): boolean;
  rate(item: CustomerDetail, value: number): Promise<void>;
  move(id: string, from: string, to: string, confirm: boolean): Promise<void>;
  loadMore(lane: ReturnType<typeof board>['statuses'][number]): Promise<void>;
  laneErrors(): Partial<Record<CustomerStatus, string>>;
  remove(item: CustomerDetail): Promise<void>;
  deleteDialog(): { open(): Promise<boolean> };
};

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('%s / %s', (lang, theme) => {
  const selection = signal<{ companyId: string; branchId: string | null }>({ companyId, branchId });
  const me = signal({ isTenantOwner: false, permissions: ['crm.customer_profiles.status.manage'],
    permissionScopes: { 'crm.customer_profiles.status.manage': { branchIds: [branchId], companyIds: [], tenantWide: false } },
    accessibleBranchCompanies: [{ branchId, companyId }], id: 'cu-1' });
  let transport: ListTransport;
  let dispose: () => void;
  let fixture: ComponentFixture<unknown> | undefined;
  let attributes: (string | null)[];

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    attributes = ['lang', 'dir', 'data-theme'].map((name) => document.documentElement.getAttribute(name));
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    selection.set({ companyId, branchId });
    me.set({ isTenantOwner: false, permissions: ['crm.customer_profiles.status.manage'],
      permissionScopes: { 'crm.customer_profiles.status.manage': { branchIds: [branchId], companyIds: [], tenantWide: false } },
      accessibleBranchCompanies: [{ branchId, companyId }], id: 'cu-1' });
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: lang, missingHandler: { logMissingKey: true } }, loader: Loader }),
      { provide: TenantScopeState, useValue: { selection, me, branchCompanies: () => new Map([[branchId, companyId]]) } },
      { provide: LanguageState, useValue: { current: signal(lang) } },
      { provide: BulkJobsTracker, useValue: { finished: signal(null), jobs: signal([]) } },
    ] });
    const t = TestBed.inject(TranslocoService);
    t.setTranslation({ ...(lang === 'ar' ? ar : en), customers: lang === 'ar' ? arCustomers : enCustomers,
      recordList: lang === 'ar' ? arList : enList, pagination: lang === 'ar' ? arPagination : enPagination }, lang);
    transport = new ListTransport();
    dispose = bindCrmHttpForTest(transport);
    bindAnalyticsPermissions(() => ['crm.customer_profiles.read.all']);
  });

  afterEach(() => {
    fixture?.destroy(); fixture = undefined;
    vi.unstubAllGlobals();
    dispose(); bindAnalyticsPermissions(() => []);
    TestBed.resetTestingModule();
    ['lang', 'dir', 'data-theme'].forEach((name, i) => attributes[i] === null
      ? document.documentElement.removeAttribute(name) : document.documentElement.setAttribute(name, attributes[i]!));
  });

  async function settle() {
    for (let n = 0; n < 5; n++) { fixture?.detectChanges(); await new Promise((resolve) => setTimeout(resolve, 0)); }
    fixture?.detectChanges();
  }
  async function renderBoard() {
    const result = TestBed.createComponent(CustomerBoard); fixture = result;
    result.componentRef.setInput('body', body);
    result.componentRef.setInput('capabilities', capabilities);
    await settle();
    return result.componentInstance as unknown as BoardInternals;
  }

  describe('CustomersApi', () => {
    it('search requests Wave B status counts', async () => {
      await Promise.resolve();
      await searchCustomers({ ...body, search: 'Test', searchField: 'customer', tagIds: ['tag'],
        filterTree: { field: 'rating', operator: 'gte', value: 1 }, includeStatusCounts: true,
        filter: [{ field: 'rating', operator: 'gte', value: 1 }] }, 2, 20);
      expect(transport.recordedWrites()[0].body).toEqual({ ...body, search: 'Test', searchField: 'customer',
        tagIds: ['tag'], filterTree: { field: 'rating', operator: 'gte', value: 1 }, page: 2, limit: 20, includeStatusCounts: true });
      expect(transport.recordedWrites()[0].options.scope).toBeUndefined();
      expect(transport.recordedWrites()[0].options.key).toMatch(/^[\da-f-]{14}7[\da-f-]+$/i);
      await searchCustomers({ ...body, filter: [{ field: 'rating', operator: 'gte', value: 1 }] });
      expect(transport.recordedWrites()[1].body).toMatchObject({ filterTree: {
        op: 'AND', children: [{ field: 'rating', operator: 'gte', value: 1 }],
      } });
      expect(transport.recordedWrites()[1].body).not.toHaveProperty('filter');
    });
    it('capabilities sends both scope headers', async () => {
      await Promise.resolve();
      expect(await getCustomerCapabilities(branchId)).toEqual(capabilities);
      expect(transport.recordedReads()).toEqual([{ path: '/customer-profiles/capabilities',
        query: { branchId }, scope: { companyId, branchId } }]);
      selection.set({ companyId, branchId: null });
      await expect(getCustomerCapabilities(branchId)).rejects.toMatchObject({ code: 'BRANCH_CONTEXT_REQUIRED' });
      expect(transport.recordedReads()).toHaveLength(1);
    });
    it('all list writes send keys, inline edits send loaded tokens, ordinary calls have no scope headers', async () => {
      await loadBoard(body);
      await loadStatusPage('PROSPECT', body, 2);
      await searchCustomers(body);
      await setCustomerRating(row.id, 3);
      await setCustomerColor(row.id, 'BLUE');
      await setCustomerStatus(row.id, 'INACTIVE', row.updatedAt);
      await deleteCustomer(row.id, 'Reason');
      const writes = transport.recordedWrites();
      expect(writes.map(({ method }) => method)).toEqual(['POST', 'POST', 'POST', 'PATCH', 'PATCH', 'PATCH', 'DELETE']);
      expect(writes.every(({ options }) => options.key && !options.scope)).toBe(true);
      expect(new Set(writes.map(({ options }) => options.key)).size).toBe(7);
      expect(writes[0].body).toMatchObject({ page: 1, limit: 50 });
      expect(writes[1].body).toMatchObject({ page: 2, limit: 50 });
      expect(writes[3].body).toEqual({ rating: 3, expectedUpdatedAt: row.updatedAt });
      expect(writes[4].body).toMatchObject({ expectedUpdatedAt: '2026-11-23T01:00:00.000Z' });
      expect(writes[5].body).toEqual({ status: 'INACTIVE', expectedUpdatedAt: row.updatedAt });
      expect(writes[6].body).toEqual({ reason: 'Reason' });
    });
    it('retries the same action with the same key and never resends a mismatch', async () => {
      await searchCustomers(body);
      for (const error of [new ApiError(0, 'NETWORK'), new ApiError(503, 'SERVER'), new ApiError(409, 'GW.IDEM.IN_FLIGHT'), new ApiError(401, 'UNAUTHORIZED')]) {
        transport.error = error;
        await expect(setCustomerRating(row.id, 2)).rejects.toBe(error);
      }
      const failed = transport.recordedWrites().slice(1);
      expect(new Set(failed.map(({ options }) => options.key)).size).toBe(1);
      transport.error = new ApiError(409, 'GW.IDEM.MISMATCH');
      await expect(setCustomerRating(row.id, 2)).rejects.toMatchObject({ code: 'GW.IDEM.MISMATCH' });
      const length = transport.recordedWrites().length;
      await expect(setCustomerRating(row.id, 2)).rejects.toMatchObject({ code: 'GW.IDEM.MISMATCH' });
      expect(transport.recordedWrites()).toHaveLength(length);
      transport.error = null;
      await setCustomerRating(row.id, 1);
      expect(transport.recordedWrites().at(-1)!.options.key).not.toBe(failed[0].options.key);
    });
  });

  describe('CustomerBoard', () => {
    it('CustomersPage › status counts from the board response', async () => {
      const c = await renderBoard();
      expect(c.counts()).toEqual(serverCounts);
      const lanes = c.lanes();
      delete (lanes[0] as unknown as { total?: number }).total;
      // A response without counts stays unknown; lane totals cannot replace it.
      vi.spyOn(transport, 'write').mockImplementationOnce(async <T>(method: CoreWriteMethod, path: string, input: unknown, options: CrmWriteOptions) => {
        const result = await CrmHttpStub.prototype.write.call(transport, method, path, input, options);
        return { ...result, data: { statuses: structuredClone(lanes) } as T };
      });
      (fixture!.componentInstance as CustomerBoard).refresh(); await settle();
      expect(c.counts().PROSPECT).toBeUndefined(); expect(c.counts().ALL).toBeUndefined();
      await c.move(row.id, 'PROSPECT', 'INACTIVE', false); await settle();
      expect(c.counts()).toEqual(serverCounts);
      expect(fixture!.nativeElement.textContent).not.toContain('NaN');
    });
    it('status errors', async () => {
      const c = await renderBoard();
      for (const error of [new ApiError(403, 'CUSTOMER_PROFILE_STATUS_MANAGE_REQUIRED'), new ApiError(422, 'CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON')]) {
        transport.error = error;
        await c.move(row.id, 'PROSPECT', 'INACTIVE', false); await settle();
        expect(c.lanes().find((lane) => lane.status === 'PROSPECT')!.items[0].status).toBe('PROSPECT');
        expect(TestBed.inject(Notify).toasts().at(-1)!.title).toBe(TestBed.inject(TranslocoService).translate(`customers.errors.${error.code}`));
      }
    });
    it('inline conflict', async () => {
      const c = await renderBoard(); const initial = transport.recordedWrites().length;
      transport.error = new ApiError(409, 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE');
      const pending = c.rate(row, 5); await pending;
      transport.error = null; await settle();
      expect(transport.recordedWrites().slice(initial).some(({ path }) => path.endsWith('/board'))).toBe(true);
      expect(c.lanes()[0].items[0].rating).toBe(row.rating);
    });
    it('lane failure retains cards and offers Retry', async () => {
      const c = await renderBoard();
      transport.error = new ApiError(503, 'SERVER');
      await c.loadMore(c.lanes()[0]); await settle();
      expect(c.lanes()[0].items).toHaveLength(1); expect(c.laneErrors().PROSPECT).toBeTruthy();
      expect(fixture!.nativeElement.textContent).toContain(TestBed.inject(TranslocoService).translate('customers.empty.retry'));
      transport.error = null; await c.loadMore(c.lanes()[0]); await settle();
      expect(c.laneErrors().PROSPECT).toBeUndefined();
    });
    it('delete refusal stays in the existing confirmation dialog', async () => {
      const c = await renderBoard();
      const open = vi.spyOn(c.deleteDialog(), 'open').mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      transport.error = new ApiError(409, 'CUSTOMER_PROFILE_HAS_ACTIVE_OPPORTUNITIES');
      await c.remove(row); await settle();
      expect(open).toHaveBeenCalledTimes(2);
      expect(c.lanes()[0].items).toHaveLength(1);
      expect(fixture!.nativeElement.textContent).toContain(TestBed.inject(TranslocoService).translate('customers.errors.CUSTOMER_PROFILE_HAS_ACTIVE_OPPORTUNITIES'));
    });
    it('read failure shows the shared state and correlation id', async () => {
      transport.error = new ApiError(503, 'SERVER', undefined, { correlationId: 'cu-1-correlation' });
      await renderBoard();
      expect(fixture!.nativeElement.querySelector('ui-full-state')).not.toBeNull();
      expect(fixture!.nativeElement.textContent).toContain('cu-1-correlation');
    });
    it('subscription refusal makes inline controls read-only', async () => {
      const c = await renderBoard();
      expect(c.canDragItem(row)).toBe(true);
      transport.error = new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY');
      await c.rate(row, 3); await settle();
      expect(c.canDragItem(row)).toBe(false);
    });
  });

  describe('CustomerCard', () => {
    it('status needs the branch grant', async () => {
      const c = await renderBoard();
      expect(canManageCustomerStatus(branchId)).toBe(true); expect(canManageCustomerStatus(otherBranch)).toBe(false);
      me.update((value) => ({ ...value, permissions: [] }));
      expect(c.canDragItem(row)).toBe(false);
      me.update((value) => ({ ...value, isTenantOwner: true }));
      expect(c.canDragItem(row)).toBe(true);
      expect(canUpdateCustomer({ branchId, customerProfiles: { ...capabilities.customerProfiles,
        update: { scope: 'own', ownerUserIds: [] } } }, row)).toBe(false);
    });
  });

  describe('CustomersPage', () => {
    it('no session branch', async () => {
      selection.set({ companyId, branchId: null });
      fixture = TestBed.createComponent(CustomersPage); await settle();
      expect(fixture.nativeElement.textContent).toContain(TestBed.inject(TranslocoService).translate('customers.states.chooseBranch'));
      expect(transport.recordedReads()).toEqual([]); expect(transport.recordedWrites()).toEqual([]);
    });
    it('counts stay unknown without a selected branch', async () => {
      selection.set({ companyId, branchId: null });
      const result = TestBed.createComponent(CustomersPage); fixture = result;
      const c = result.componentInstance as unknown as { statusSteps(): { count: number | null }[] };
      for (const view of ['cards', 'table']) {
        result.componentRef.setInput('view', view); await settle();
        expect(c.statusSteps().every(({ count }) => count === null)).toBe(true);
      }
    });
    it('CustomersPage › status counts', async () => {
      const result = TestBed.createComponent(CustomersPage); fixture = result;
      const c = result.componentInstance as unknown as { statusSteps(): { count: number | null }[] };
      for (const view of ['cards', 'table']) {
        result.componentRef.setInput('view', view);
        result.componentRef.setInput('status', 'PROSPECT');
        await settle();
        expect(c.statusSteps().map(({ count }) => count)).toEqual([123, 80, 30, 10, 3]);
        const searches = transport.recordedWrites().filter(({ path }) => path.endsWith('/search'));
        expect(searches.length).toBeGreaterThan(0);
        expect(searches.every(({ body, options }) => (body as CustomerSearchBody).includeStatusCounts === true && !options.scope && !!options.key)).toBe(true);
        expect(searches.at(-1)!.body).toMatchObject({ status: 'PROSPECT' });
      }
    });
    it('invalid search keeps the page', async () => {
      for (const component of [CustomerCards, CustomerTable]) {
        const result = TestBed.createComponent<CustomerCards | CustomerTable>(component); fixture = result;
        result.componentRef.setInput('body', body); await settle();
        expect(result.nativeElement.textContent).toContain(row.displayName);
        transport.error = new ApiError(400, 'INVALID_FIELD');
        result.componentRef.setInput('body', { ...body, search: 'invalid' }); await settle();
        expect(result.nativeElement.textContent).toContain(row.displayName);
        expect(TestBed.inject(Notify).toasts().at(-1)!.title).toBe(TestBed.inject(TranslocoService).translate('customers.search.invalid'));
        transport.error = null; result.destroy(); fixture = undefined;
      }
    });
    it('formats dates in the supplied workspace zone and defaults to UTC', () => {
      const instant = '2026-11-23T23:30:00.000Z';
      expect(formatCustomerDate(instant, lang)).toBe(formatCustomerDate(instant, lang, 'UTC'));
      expect(formatCustomerDate(instant, lang, 'Africa/Cairo')).not.toBe(formatCustomerDate(instant, lang, 'UTC'));
    });
  });
});
