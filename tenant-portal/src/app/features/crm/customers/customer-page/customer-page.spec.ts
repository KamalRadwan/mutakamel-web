import { Component, Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { type Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { defer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enGlobal from '../../../../../../public/i18n/en.json';
import enActivities from '../../../../../../public/i18n/activities/en.json';
import enCallLog from '../../../../../../public/i18n/call-log/en.json';
import enCrmModules from '../../../../../../public/i18n/crm-modules/en.json';
import enCustomerForm from '../../../../../../public/i18n/customer-form/en.json';
import enCustomerModal from '../../../../../../public/i18n/customer-modal/en.json';
import enCustomerPage from '../../../../../../public/i18n/customer-page/en.json';
import enCustomers from '../../../../../../public/i18n/customers/en.json';
import enDateRange from '../../../../../../public/i18n/date-range/en.json';
import enGeo from '../../../../../../public/i18n/geo/en.json';
import enPartyCalls from '../../../../../../public/i18n/party-calls/en.json';
import enRecordActivitiesTab from '../../../../../../public/i18n/record-activities-tab/en.json';
import enRecordAttachments from '../../../../../../public/i18n/record-attachments/en.json';
import enRecordDup from '../../../../../../public/i18n/record-dup/en.json';
import enRecordFields from '../../../../../../public/i18n/record-fields/en.json';
import enRecordForm from '../../../../../../public/i18n/record-form/en.json';
import enRecordHistory from '../../../../../../public/i18n/record-history/en.json';
import enRecordPage from '../../../../../../public/i18n/record-page/en.json';
import enRecordRelated from '../../../../../../public/i18n/record-related/en.json';
import enUiPagination from '../../../../../../public/i18n/ui-pagination/en.json';
import enUiPhone from '../../../../../../public/i18n/ui-phone/en.json';
import enUiTagPicker from '../../../../../../public/i18n/ui-tag-picker/en.json';
import { FAKE_COMPANIES } from '../../../../core/scope/scope.fake';
import { listActivities } from '../../../../shared/widgets/activities/activities.api';
import { fakeCreate, resetActivitiesFake, setFakeActivitiesDelay } from '../../../../shared/widgets/activities/activities.fake';
import type { CustomerDraft } from '../customer-form/customer-draft';
import { CustomerForm } from '../customer-form/customer-form';
import { ACME_CUSTOMER_ID, fakeGetCustomer, fakePatchCustomer, fakeGetCustomerCapabilities } from '../customers.fake';
import type { CustomerDetail, CustomerCapabilities } from '../customers.model';
import { CustomerPage } from './customer-page';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';


import * as customerFake from '../customers.fake';
import { CoreHttp, CoreQuery, CoreWriteMethod } from '../../../../core/api/core-http';
import { WorkspaceLookups } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { bindCrmHttpForTest, CrmReadOptions, CrmWriteOptions } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { RecordHistoryApi } from '../../../../shared/widgets/record-history/record-history.api';
import type { HistoryPage } from '../../../../shared/widgets/record-history/record-history.model';

const TEST_COMPANY_ID = '0192b7ea-7c4f-7a7d-9c9f-51c7f2b30001';
const TEST_BRANCH_ID = '0192b7ea-7c4f-7a7d-9c9f-51c7f2b30002';

/** Retained seeded-record UI fixtures run through the real feature API boundary. */
class SeededCustomerTransport extends CrmHttpStub {
  override async read<T>(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<T> {
    await super.read(path, query, options).catch(() => undefined);
    if (path === '/customer-profiles/capabilities') return { ...await customerFake.fakeGetCustomerCapabilities('b1'), branchId: TEST_BRANCH_ID } as T;
    if (path === '/assignable-owners') {
      const owners = await customerFake.fakeListBranchOwners('b1');
      return { items: owners.map((owner) => ({ id: owner.userId, displayName: owner.name, avatarUrl: owner.avatarUrl })), nextCursor: null } as T;
    }
    if (path === '/custom-fields') return (await customerFake.fakeListCustomerCustomFields()).map((field) => ({ ...field, ownerType: 'CUSTOMER_PROFILE', isActive: true,
      options: field.options.map((option) => ({ ...option, isActive: true })), requirements: [
        { operation: 'CREATE', entityScope: null, isRequired: field.requiredOnCreate },
        { operation: 'UPDATE', entityScope: null, isRequired: field.requiredOnUpdate },
      ] })) as T;
    if (path === '/tags') return await customerFake.fakeListTags() as T;
    if (path === '/acquisition-sources') return await customerFake.fakeListSources() as T;
    if (path === '/static-data') return { enums: {}, enumOptions: { customerStatuses: (['PROSPECT', 'ACTIVE_CUSTOMER', 'INACTIVE', 'BLACKLISTED'] as const).map((value) => ({ value, label: { en: enCustomers.statuses[value], ar: value } })) } } as T;
    if (path.startsWith('/customer-profiles/')) return { ...await customerFake.fakeGetCustomer(path.split('/')[2]), branchId: TEST_BRANCH_ID } as T;
    return super.read(path, query, options);
  }
  override async write<T>(method: CoreWriteMethod, path: string, body: unknown, options: CrmWriteOptions) {
    const response = await super.write<T>(method, path, body, options);
    if (method === 'PATCH') return { ...response, data: { ...await customerFake.fakePatchCustomer(path.split('/')[2], body as import('../customers.model').UpdateCustomerBody), branchId: TEST_BRANCH_ID } as T };
    if (path === '/leads/duplicate-check') return { ...response, data: { matches: [] } as T };
    return response;
  }
}

/** Acme Retail: seeded corporate customer on branch b1 (Cairo HQ, company c1) with seeded audit history. */
const MISSING_ID = '0192b7ea-7c4f-7a7d-9c9f-51c7f2b3ffff';
const CUSTOMER_HISTORY: HistoryPage = {
  items: ['CUSTOMER_CREATED', 'CUSTOMER_STATUS_CHANGED', 'CUSTOMER_UPDATED'].map((action, index) => ({
    id: `customer-history-${index}`, action, subjectKind: 'customer', subjectId: ACME_CUSTOMER_ID,
    referenceLabel: 'Acme Retail', createdAt: '2026-11-23T06:00:00Z', actorLabel: 'Owner',
    actorType: 'USER', outcome: 'SUCCESS', reason: null, diff: [],
  })),
  nextCursor: null,
};

const TRANSLATIONS: Record<string, Translation> = {
  en: enGlobal,
  'activities/en': enActivities,
  'call-log/en': enCallLog,
  'crm-modules/en': enCrmModules,
  'customers/en': enCustomers,
  'customer-page/en': enCustomerPage,
  'customer-form/en': enCustomerForm,
  'customer-modal/en': enCustomerModal,
  'date-range/en': enDateRange,
  'geo/en': enGeo,
  'party-calls/en': enPartyCalls,
  'record-activities-tab/en': enRecordActivitiesTab,
  'record-attachments/en': enRecordAttachments,
  'record-dup/en': enRecordDup,
  'record-fields/en': enRecordFields,
  'record-form/en': enRecordForm,
  'record-history/en': enRecordHistory,
  'record-page/en': enRecordPage,
  'record-related/en': enRecordRelated,
  'ui-pagination/en': enUiPagination,
  'ui-phone/en': enUiPhone,
  'ui-tag-picker/en': enUiTagPicker,
};

/** Answers on a microtask, never synchronously (a synchronous loader triggers NG0600). */
@Injectable()
class AsyncTestLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return defer(() => Promise.resolve(TRANSLATIONS[path] ?? {}));
  }
}

@Component({ template: '' })
class StubPage {}

/** Read-only access to the page's protected state (no source change). */
interface PageInternals {
  capabilities: { set(value: CustomerCapabilities | null): void };
  draft(): CustomerDraft;
  detail(): CustomerDetail | null;
  updatedAt: { (): string | null; set(value: string | null): void };
  activityCount(): number;
  dirty(): boolean;
  saving(): boolean;
  loading(): boolean;
  showSkeleton(): boolean;
  conflictOpen(): boolean;
  activeTab(): string;
}

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

/** Advances fake timers until the promise settles (fake APIs wait a few hundred ms). */
async function settle<T>(promise: Promise<T>, maxMs = 20_000): Promise<T> {
  let done = false;
  const guarded = promise.then(
    (value) => {
      done = true;
      return { ok: true as const, value };
    },
    (error: unknown) => {
      done = true;
      return { ok: false as const, error };
    },
  );
  for (let elapsed = 0; !done && elapsed < maxMs; elapsed += 100) {
    await vi.advanceTimersByTimeAsync(100);
  }
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

// The seeded transport uses deterministic fake delays and drains its timers between tests.
describe('CustomerPage', { timeout: 60_000 }, () => {
  let harness: RouterTestingHarness;
  let disposeTransport: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    localStorage.removeItem('lang');
    document.documentElement.lang = 'en';
    setFakeActivitiesDelay(0);
    dialogProto['showModal'] = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    dialogProto['close'] = function (this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      // Browsers fire `close` as a queued task, after the caller's synchronous code.
      setTimeout(() => this.dispatchEvent(new Event('close')));
    };
    bindAnalyticsPermissions(() => ['crm.customer_profiles.read.all', 'crm.customer_profiles.status.manage', 'activities.create', 'crm.attachments.create', 'crm.attachments.delete', 'org.branch.read', 'org.company.read']);
    disposeTransport = bindCrmHttpForTest(new SeededCustomerTransport());
    TestBed.configureTestingModule({
      providers: [
        { provide: RecordHistoryApi, useValue: { listRecordHistory: async () => structuredClone(CUSTOMER_HISTORY) } },
        { provide: TenantScopeState, useValue: { me: () => null, selection: () => ({ companyId: TEST_COMPANY_ID, branchId: TEST_BRANCH_ID }), branchCompanies: () => new Map([[TEST_BRANCH_ID, TEST_COMPANY_ID]]) } },
        { provide: WorkspaceLookups, useValue: { allBranches: async () => [{ id: TEST_BRANCH_ID, companyId: TEST_COMPANY_ID, name: FAKE_COMPANIES[0].branches[0].nameEn }], allCompanies: async () => [{ id: TEST_COMPANY_ID, name: FAKE_COMPANIES[0].nameEn }] } },
        { provide: CoreHttp, useValue: { read: async () => ({ items: [] }) } },
        provideRouter([
          { path: 'crm/customers/:id', component: CustomerPage },
          { path: 'crm/customers', component: StubPage },
          { path: 'crm/off/customers', component: StubPage },
          { path: 'not-found', component: StubPage },
        ]),
        provideTransloco({
          config: {
            availableLangs: ['ar', 'en'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
            missingHandler: { logMissingKey: false },
          },
          loader: AsyncTestLoader,
        }),
      ],
    });
  });

  afterEach(async () => {
    disposeTransport();
    TestBed.resetTestingModule();
    await vi.advanceTimersByTimeAsync(5_000);
    resetActivitiesFake();
    setFakeActivitiesDelay(300);
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.removeItem('lang');
    bindAnalyticsPermissions(() => []);
    dialogProto['showModal'] = originalDialog.showModal;
    dialogProto['close'] = originalDialog.close;
  });

  function host(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  /** Runs change detection and timers until the condition holds. */
  async function waitFor(condition: () => boolean, maxMs = 20_000, describeState?: () => unknown): Promise<void> {
    for (let elapsed = 0; elapsed < maxMs; elapsed += 100) {
      harness.detectChanges();
      if (condition()) return;
      await vi.advanceTimersByTimeAsync(100);
    }
    harness.detectChanges();
    const state = describeState ? JSON.stringify(describeState()) : '';
    expect(condition(), `condition not met in time ${state}`).toBe(true);
  }

  async function openReady(id: string): Promise<PageInternals> {
    harness = await settle(RouterTestingHarness.create());
    const component = await settle(harness.navigateByUrl(`/crm/customers/${id}`, CustomerPage));
    const page = component as unknown as PageInternals;
    await waitFor(() => page.detail()?.id === id && !page.loading() && !page.showSkeleton(), 20_000, () => {
      const state = component as unknown as { scopesReady(): boolean; lookupsSettled(): boolean; loadFailed(): boolean; scopeDenied(): boolean; lookups(): { loading(): boolean } | null };
      return { id: page.detail()?.id, loading: page.loading(), skeleton: page.showSkeleton(), scopes: state.scopesReady(), settled: state.lookupsSettled(), failed: state.loadFailed(), denied: state.scopeDenied(), lookups: state.lookups()?.loading() };
    });
    // Let tab counts, lookups and capabilities settle.
    for (let i = 0; i < 20; i++) {
      await vi.advanceTimersByTimeAsync(100);
      harness.detectChanges();
    }
    page.capabilities.set(await settle(fakeGetCustomerCapabilities('b1')));
    harness.detectChanges();
    return page;
  }

  function form(): CustomerForm {
    return harness.fixture.debugElement.query(By.directive(CustomerForm)).componentInstance as CustomerForm;
  }

  function editDraft(patch: Partial<CustomerDraft>): void {
    const f = form();
    f.draft.set({ ...f.draft(), ...patch });
    harness.detectChanges();
  }

  function headerSaveButton(): HTMLButtonElement | null {
    const header = host().querySelector('app-record-page-header');
    if (!header) return null;
    return (
      Array.from(header.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === enRecordPage.save,
      ) ?? null
    );
  }

  /** Text of the company or branch field: a read-only input when locked, the dropdown trigger otherwise. */
  function scopeFieldText(field: 'company' | 'branch'): string {
    const scope = host().querySelector('app-scope-fields');
    expect(scope, 'scope fields').not.toBeNull();
    const control = scope!.querySelector<HTMLElement>(`[id$="-${field}"]`);
    expect(control, `${field} control`).not.toBeNull();
    return (control instanceof HTMLInputElement ? control.value : (control!.textContent ?? '')).trim();
  }

  function tabButton(tab: string): HTMLButtonElement {
    const button = host().querySelector<HTMLButtonElement>(`[role="tab"][id$="-tab-${tab}"]`);
    expect(button, `tab ${tab}`).not.toBeNull();
    return button!;
  }

  function panel(tab: string): HTMLElement | null {
    return host().querySelector<HTMLElement>(`[role="tabpanel"][id$="-panel-${tab}"]`);
  }

  function conflictDialog(): HTMLDialogElement | undefined {
    return Array.from(host().querySelectorAll<HTMLDialogElement>('dialog')).find((item) =>
      item.textContent?.includes(enRecordPage.conflict.title),
    );
  }

  function dialogButton(dialog: HTMLDialogElement, label: string): HTMLButtonElement {
    const button = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(
      (item) => item.textContent?.trim() === label,
    );
    expect(button, `dialog button ${label}`).toBeDefined();
    return button!;
  }

  async function clickSave(page: PageInternals): Promise<void> {
    const button = headerSaveButton();
    expect(button, 'header save button').not.toBeNull();
    button!.click();
    harness.detectChanges();
    await waitFor(() => !page.saving());
  }

  describe('load by id', () => {
    it('loads Acme Retail and renders its name in the header', async () => {
      const page = await openReady(ACME_CUSTOMER_ID);
      const row = page.detail()!;

      expect(row.displayName).toBe('Acme Retail');
      expect(host().querySelector('app-record-page-header')!.textContent).toContain('Acme Retail');
      expect(page.dirty()).toBe(false);
    });

    it('shows the record not-found state for an unknown id (404 CUSTOMER_PROFILE_NOT_FOUND)', async () => {
      harness = await settle(RouterTestingHarness.create());
      await settle(harness.navigateByUrl(`/crm/customers/${MISSING_ID}`));
      await waitFor(() => host().querySelector('ui-full-state')?.textContent?.includes(enCustomerPage.notFound) === true);
      expect(host().querySelector('app-customer-form')?.closest('.hidden')).not.toBeNull();
    });
  });

  describe('draft from the record', () => {
    it('fills branch from the record and shows its company and branch', async () => {
      const page = await openReady(ACME_CUSTOMER_ID);
      const draft = page.draft();

      expect(draft.branchId).toBe(TEST_BRANCH_ID);
      expect(draft.profileType).toBe('CORPORATE');
      expect(draft.companyName).toBe('Acme Retail');
      expect(scopeFieldText('company')).toBe(FAKE_COMPANIES[0].nameEn);
      expect(scopeFieldText('branch')).toBe(FAKE_COMPANIES[0].branches[0].nameEn);
      expect(page.dirty()).toBe(false);
    });
  });

  describe('save', () => {
    it('sends only the changed fields in the PATCH body', async () => {
      const page = await openReady(ACME_CUSTOMER_ID);
      const loaded = page.detail()!;

      // Another writer changes the legal name; the page keeps its stale legal name in base/draft but is given the new
      // version token, so a full-body PATCH would write the stale legal name back over the other writer.
      const other = await settle(
        fakePatchCustomer(ACME_CUSTOMER_ID, {
          legalName: 'Acme Retail Holdings',
          expectedUpdatedAt: loaded.updatedAt,
        }),
      );
      page.updatedAt.set(other.updatedAt);
      expect(page.draft().legalName).not.toBe('Acme Retail Holdings');

      editDraft({ description: 'Edited in the page spec' });
      expect(page.dirty()).toBe(true);
      await clickSave(page);

      const stored = await settle(fakeGetCustomer(ACME_CUSTOMER_ID));
      expect(stored.description).toBe('Edited in the page spec');
      expect(stored.legalName).toBe('Acme Retail Holdings');
      expect(stored.displayName).toBe(loaded.displayName);
      expect(stored.status).toBe(loaded.status);
      expect(stored.ownerUserId).toBe(loaded.ownerUserId);
      expect(page.dirty()).toBe(false);
      expect(page.updatedAt()).toBe(stored.updatedAt);
    });

    it('opens the conflict dialog on 409 and, on keep, refreshes the token without resending edits', async () => {
      const page = await openReady(ACME_CUSTOMER_ID);
      const loaded = page.detail()!;
      await settle(
        fakePatchCustomer(ACME_CUSTOMER_ID, { legalName: 'Concurrent Legal', expectedUpdatedAt: loaded.updatedAt }),
      );

      editDraft({ description: 'Kept description' });
      headerSaveButton()!.click();
      harness.detectChanges();
      await waitFor(() => page.conflictOpen() && conflictDialog()?.hasAttribute('open') === true);

      dialogButton(conflictDialog()!, enRecordPage.conflict.keepEditing).click();
      await waitFor(() => !page.conflictOpen() && !page.saving() && page.updatedAt() !== loaded.updatedAt);
      expect(page.dirty()).toBe(true);
      expect(page.draft().description).toBe('Kept description');
      await clickSave(page);

      const stored = await settle(fakeGetCustomer(ACME_CUSTOMER_ID));
      expect(stored.description).toBe('Kept description');
      expect(stored.legalName).toBe('Concurrent Legal');
      expect(page.detail()!.description).toBe('Kept description');
      expect(page.updatedAt()).toBe(stored.updatedAt);
    });

    it('reloads the fresh record and drops the edit when the user picks reload on 409', async () => {
      const page = await openReady(ACME_CUSTOMER_ID);
      const loaded = page.detail()!;
      await settle(
        fakePatchCustomer(ACME_CUSTOMER_ID, { legalName: 'Reloaded Legal', expectedUpdatedAt: loaded.updatedAt }),
      );

      editDraft({ description: 'Discarded description' });
      headerSaveButton()!.click();
      harness.detectChanges();
      await waitFor(() => page.conflictOpen() && conflictDialog()?.hasAttribute('open') === true);

      dialogButton(conflictDialog()!, enRecordPage.conflict.reload).click();
      await waitFor(() => page.detail()?.legalName === 'Reloaded Legal' && !page.dirty());

      expect(page.draft().description).toBe((loaded.description ?? '').trim());
      const stored = await settle(fakeGetCustomer(ACME_CUSTOMER_ID));
      expect(stored.description).toBe(loaded.description);
      expect(page.updatedAt()).toBe(stored.updatedAt);
    });
  });

  describe('tabs', () => {
    it('switches tabs and renders each panel', async () => {
      const page = await openReady(ACME_CUSTOMER_ID);
      const router = TestBed.inject(Router);

      for (const tab of ['activities', 'attachments', 'history'] as const) {
        tabButton(tab).click();
        await waitFor(() => page.activeTab() === tab && panel(tab) !== null);
        expect(panel(tab)!.className).not.toContain('hidden');
        expect(panel('overview')!.className).toContain('hidden');
        expect(tabButton(tab).getAttribute('aria-selected')).toBe('true');
        await waitFor(() => router.url.includes(`tab=${tab}`));
      }
      expect(panel('activities')!.querySelector('app-record-activities-tab')).not.toBeNull();
      expect(panel('attachments')!.querySelector('app-record-attachments')).not.toBeNull();
      expect(panel('history')!.querySelector('app-record-history')).not.toBeNull();

      tabButton('overview').click();
      await waitFor(() => page.activeTab() === 'overview');
      expect(panel('overview')!.className).not.toContain('hidden');
      await waitFor(() => !router.url.includes('tab='));
    });
  });

  describe('activities count', () => {
    it('reads the open count from CorePage meta.total, not from the page length', async () => {
      const dueAt = new Date(Date.now() + 2 * 24 * 3600_000).toISOString();
      for (const subject of ['Call one', 'Call two', 'Call three']) {
        await settle(
          fakeCreate({
            target: { app: 'CRM', type: 'CUSTOMER_PROFILE', id: ACME_CUSTOMER_ID },
            type: 'CALL',
            subject,
            dueAt,
          }),
        );
      }
      const query = await settle(
        listActivities({
          targetApp: 'CRM',
          targetType: 'CUSTOMER_PROFILE',
          targetId: ACME_CUSTOMER_ID,
          statuses: ['PLANNED', 'IN_PROGRESS'],
          page: 1,
          limit: 1,
        }),
      );
      expect(query.meta.total).toBe(3);
      expect(query.data.length).toBe(1);

      const page = await openReady(ACME_CUSTOMER_ID);
      await waitFor(() => page.activityCount() === 3);
      expect(tabButton('activities').textContent).toContain('3');
    });
  });

  describe('history tab', () => {
    it('shows the seeded audit events of Acme Retail', async () => {
      const page = await openReady(ACME_CUSTOMER_ID);
      tabButton('history').click();
      const items = () => panel('history')?.querySelectorAll('[role="listitem"]') ?? [];
      await waitFor(
        () => page.activeTab() === 'history' && items().length >= 3,
        20_000,
        () => ({ tab: page.activeTab(), n: items().length, text: panel('history')?.textContent?.slice(0, 300) }),
      );

      const text = panel('history')!.textContent ?? '';
      expect(text).toContain('created the customer');
      expect(text).toContain('changed the customer status');
      expect(text).toContain('updated the customer');
    });
  });
});
