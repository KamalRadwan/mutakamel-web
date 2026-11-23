import enGlobal from '../../../../../../public/i18n/en.json';
import enCustomers from '../../../../../../public/i18n/customers/en.json';
import enCustomerPage from '../../../../../../public/i18n/customer-page/en.json';
import enCustomerModal from '../../../../../../public/i18n/customer-modal/en.json';
import enCustomerForm from '../../../../../../public/i18n/customer-form/en.json';
import enRecordForm from '../../../../../../public/i18n/record-form/en.json';
import enRecordFields from '../../../../../../public/i18n/record-fields/en.json';
import enRecordDup from '../../../../../../public/i18n/record-dup/en.json';
import enRecordPage from '../../../../../../public/i18n/record-page/en.json';
import enRecordModal from '../../../../../../public/i18n/record-modal/en.json';
import enRecordRelated from '../../../../../../public/i18n/record-related/en.json';
import enRecordAttachments from '../../../../../../public/i18n/record-attachments/en.json';
import enRecordHistory from '../../../../../../public/i18n/record-history/en.json';
import enRecordActivitiesTab from '../../../../../../public/i18n/record-activities-tab/en.json';
import enUiPhone from '../../../../../../public/i18n/ui-phone/en.json';
import enUiTagPicker from '../../../../../../public/i18n/ui-tag-picker/en.json';
import enDateRange from '../../../../../../public/i18n/date-range/en.json';
import enGeo from '../../../../../../public/i18n/geo/en.json';
import enUiPagination from '../../../../../../public/i18n/ui-pagination/en.json';
import enActivities from '../../../../../../public/i18n/activities/en.json';
import enPartyCalls from '../../../../../../public/i18n/party-calls/en.json';
import enCallLog from '../../../../../../public/i18n/call-log/en.json';
import enCrmModules from '../../../../../../public/i18n/crm-modules/en.json';
import arGlobal from '../../../../../../public/i18n/ar.json';
import arCustomers from '../../../../../../public/i18n/customers/ar.json';
import arCustomerPage from '../../../../../../public/i18n/customer-page/ar.json';
import arCustomerModal from '../../../../../../public/i18n/customer-modal/ar.json';
import arCustomerForm from '../../../../../../public/i18n/customer-form/ar.json';
import arRecordForm from '../../../../../../public/i18n/record-form/ar.json';
import arRecordFields from '../../../../../../public/i18n/record-fields/ar.json';
import arRecordDup from '../../../../../../public/i18n/record-dup/ar.json';
import arRecordPage from '../../../../../../public/i18n/record-page/ar.json';
import arRecordModal from '../../../../../../public/i18n/record-modal/ar.json';
import arRecordRelated from '../../../../../../public/i18n/record-related/ar.json';
import arRecordAttachments from '../../../../../../public/i18n/record-attachments/ar.json';
import arRecordHistory from '../../../../../../public/i18n/record-history/ar.json';
import arRecordActivitiesTab from '../../../../../../public/i18n/record-activities-tab/ar.json';
import arUiPhone from '../../../../../../public/i18n/ui-phone/ar.json';
import arUiTagPicker from '../../../../../../public/i18n/ui-tag-picker/ar.json';
import arDateRange from '../../../../../../public/i18n/date-range/ar.json';
import arGeo from '../../../../../../public/i18n/geo/ar.json';
import arUiPagination from '../../../../../../public/i18n/ui-pagination/ar.json';
import arActivities from '../../../../../../public/i18n/activities/ar.json';
import arPartyCalls from '../../../../../../public/i18n/party-calls/ar.json';
import arCallLog from '../../../../../../public/i18n/call-log/ar.json';
import arCrmModules from '../../../../../../public/i18n/crm-modules/ar.json';

const dictionaries: Record<string, Translation> = {
  'en': enGlobal,
  'customers/en': enCustomers,
  'customer-page/en': enCustomerPage,
  'customer-modal/en': enCustomerModal,
  'customer-form/en': enCustomerForm,
  'record-form/en': enRecordForm,
  'record-fields/en': enRecordFields,
  'record-dup/en': enRecordDup,
  'record-page/en': enRecordPage,
  'record-modal/en': enRecordModal,
  'record-related/en': enRecordRelated,
  'record-attachments/en': enRecordAttachments,
  'record-history/en': enRecordHistory,
  'record-activities-tab/en': enRecordActivitiesTab,
  'ui-phone/en': enUiPhone,
  'ui-tag-picker/en': enUiTagPicker,
  'date-range/en': enDateRange,
  'geo/en': enGeo,
  'ui-pagination/en': enUiPagination,
  'activities/en': enActivities,
  'party-calls/en': enPartyCalls,
  'call-log/en': enCallLog,
  'crm-modules/en': enCrmModules,
  'ar': arGlobal,
  'customers/ar': arCustomers,
  'customer-page/ar': arCustomerPage,
  'customer-modal/ar': arCustomerModal,
  'customer-form/ar': arCustomerForm,
  'record-form/ar': arRecordForm,
  'record-fields/ar': arRecordFields,
  'record-dup/ar': arRecordDup,
  'record-page/ar': arRecordPage,
  'record-modal/ar': arRecordModal,
  'record-related/ar': arRecordRelated,
  'record-attachments/ar': arRecordAttachments,
  'record-history/ar': arRecordHistory,
  'record-activities-tab/ar': arRecordActivitiesTab,
  'ui-phone/ar': arUiPhone,
  'ui-tag-picker/ar': arUiTagPicker,
  'date-range/ar': arDateRange,
  'geo/ar': arGeo,
  'ui-pagination/ar': arUiPagination,
  'activities/ar': arActivities,
  'party-calls/ar': arPartyCalls,
  'call-log/ar': arCallLog,
  'crm-modules/ar': arCrmModules,
};

import { Component, Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Translation, TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { defer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp, CoreQuery, CoreWriteMethod } from '../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { WorkspaceLookups } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { CrmReadOptions, CrmWriteOptions, bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { CustomerForm } from '../customer-form/customer-form';
import { CustomerDraft, emptyDraft, toCreateBody } from '../customer-form/customer-draft';
import { customerRecordError } from '../customer-form/customer-errors';
import { listFormOwners, listFormCurrencies } from '../customer-form/customer-lookups.api';
import { CustomerModal } from '../customer-modal/customer-modal';
import { CUSTOMERS_FAKE_DB } from '../customers.fake';
import { ContactChangeBody, CustomerDetail, CustomerCapabilities, CreateCustomerBody, UpdateCustomerBody } from '../customers.model';
import { attachCustomerTags, createCustomer, detachCustomerTag, getCustomerCapabilities, listCustomerTags, patchCustomer } from '../customers.api';
import { CustomerPage } from './customer-page';

const companyId = '0192b7ea-7c4f-7a7d-9c9f-51c7f2b30001';
const branchId = '0192b7ea-7c4f-7a7d-9c9f-51c7f2b30002';
const ownerId = '0192b7ea-7c4f-7a7d-9c9f-51c7f2b30003';
const permissions = signal(['crm.customer_profiles.read.all', 'crm.customer_profiles.status.manage', 'org.branch.read', 'org.company.read']);
const selection = signal<{ companyId: string; branchId: string | null } | null>({ companyId, branchId });
const sessionMe = signal({ isTenantOwner: false, permissions: [] as string[], permissionScopes: {} as Record<string, { tenantWide: boolean }> });
const originalDialog = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
};

class RecordTransport extends CrmHttpStub {
  readonly record: CustomerDetail = { ...structuredClone(CUSTOMERS_FAKE_DB[0]), branchId, ownerUserId: ownerId, status: 'PROSPECT' };
  readonly caps: CustomerCapabilities = { branchId, customerProfiles: { create: { scope: 'all', ownerUserIds: null }, update: { scope: 'all', ownerUserIds: null }, delete: { scope: 'all', ownerUserIds: null } } };
  readError: ApiError | null = null;
  writeError: ApiError | null = null;
  contactFailureAt = 0;
  contactWrites = 0;
  readonly catalogueErrors = new Map<string, ApiError>();

  constructor() { super({}); }

  override async read<T>(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<T> {
    // Super records the exact scope options, even though this fixture supplies dynamic bodies.
    await super.read(path, query, options).catch(() => undefined);
    if (this.catalogueErrors.has(path)) throw this.catalogueErrors.get(path);
    if (path === `/customer-profiles/${this.record.id}`) {
      if (this.readError) throw this.readError;
      return structuredClone(this.record) as T;
    }
    if (path.endsWith('/capabilities')) return structuredClone(this.caps) as T;
    if (path === '/assignable-owners') return { items: [{ id: ownerId, displayName: 'Record owner', avatarUrl: null }], nextCursor: null } as T;
    if (path.endsWith('/tags') || path === '/tags' || path === '/custom-fields' || path === '/acquisition-sources') return [] as T;
    if (path === '/static-data') return { enums: {}, enumOptions: { customerStatuses: ['PROSPECT', 'ACTIVE_CUSTOMER', 'INACTIVE', 'BLACKLISTED'].map((value) => ({ value, label: { en: value, ar: value } })) } } as T;
    throw new ApiError(404, 'CUSTOMER_PROFILE_NOT_FOUND');
  }

  override async write<T>(method: CoreWriteMethod, path: string, body: unknown, options: CrmWriteOptions) {
    // The badge's read-like POST is independent of the customer mutations asserted below.
    if (path === '/related-records/counts') {
      return { status: 200, data: { countsByRecordId: {} } as T, etag: null, location: null };
    }
    const result = await super.write<T>(method, path, body, options);
    if (this.writeError) throw this.writeError;
    if (path === '/leads/duplicate-check') return { ...result, data: { matches: [] } as T };
    if (path.endsWith('/tags')) return { ...result, data: [] as T };
    if (method === 'DELETE') return result;
    const change = (body as UpdateCustomerBody).contactChange;
    if (change) {
      if (++this.contactWrites === this.contactFailureAt) throw new ApiError(404, 'CRM_CONTACT_NOT_LINKED');
      if (change.op === 'REMOVE') this.record.contacts = this.record.contacts.filter((contact) => contact.partyId !== change.contactPartyId);
      if (change.op === 'UPDATE') Object.assign(this.record.contacts.find((contact) => contact.partyId === change.contactPartyId)!, change.contact);
    }
    Object.assign(this.record, body, { updatedAt: '2026-11-23T06:01:00.000Z' });
    return { ...result, data: structuredClone(this.record) as T };
  }
}

@Injectable()
class RecordTranslations implements TranslocoLoader {
  getTranslation(path: string) { return defer(() => Promise.resolve(dictionaries[path] ?? {})); }
}
@Component({ template: '' })
class EmptyPage {}

type PageState = {
  draft: ReturnType<typeof signal<CustomerDraft>>;
  base: ReturnType<typeof signal<CustomerDraft>>;
  updatedAt: ReturnType<typeof signal<string | null>>;
  detail(): CustomerDetail | null;
  loading(): boolean;
  showSkeleton(): boolean;
  loadFailed(): boolean;
  scopeDenied(): boolean;
  loadKind(): string;
  conflictOpen(): boolean;
  reloadRequired(): boolean;
  canEdit(): boolean;
  canLogActivity(): boolean;
  canUploadAttachments(): boolean;
  canDeleteAttachments(): boolean;
  save(options?: { navigateAfterCreate?: boolean }): Promise<boolean>;
  saveCreate(navigate: boolean): Promise<boolean>;
  onConflictChoice(choice: 'reload' | 'keep'): void;
  openDeleteDialog(): void;
  submitDelete(): Promise<void>;
  deleteConflictMessage(): string | null;
};

for (const lang of ['en', 'ar'] as const) for (const theme of ['light', 'dark'] as const) {
  describe(`Customer records ${lang} ${theme}`, { timeout: 20000 }, () => {
    let transport: RecordTransport;
    let dispose: () => void;
    let harness: RouterTestingHarness;
    let translator: TranslocoService;
    const dialogPrototype = HTMLDialogElement.prototype;

    beforeEach(() => {
      localStorage.setItem('lang', lang);
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.dataset['theme'] = theme;
      permissions.set(['crm.customer_profiles.read.all', 'crm.customer_profiles.status.manage', 'org.branch.read', 'org.company.read']);
      selection.set({ companyId, branchId });
      sessionMe.set({ isTenantOwner: false, permissions: [], permissionScopes: {} });
      bindAnalyticsPermissions(permissions);
      transport = new RecordTransport();
      dispose = bindCrmHttpForTest(transport);
      Object.defineProperty(dialogPrototype, 'showModal', { configurable: true, writable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
      Object.defineProperty(dialogPrototype, 'close', { configurable: true, writable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
      TestBed.configureTestingModule({ providers: [
        provideRouter([{ path: 'crm/customers/new', component: CustomerPage }, { path: 'crm/customers/:id', component: CustomerPage }, { path: 'crm/customers', component: EmptyPage }]),
        { provide: TenantScopeState, useValue: { me: sessionMe, selection, branchCompanies: () => new Map([[branchId, companyId]]) } },
        { provide: WorkspaceLookups, useValue: { allBranches: async () => [{ id: branchId, companyId, name: 'Session branch' }], allCompanies: async () => [{ id: companyId, name: 'Session company' }] } },
        { provide: CoreHttp, useValue: { read: () => Promise.reject(new ApiError(404, 'NOT_FOUND')), readPage: async () => ({ data: [{ code: 'EGP', status: 'ACTIVE' }], meta: { hasNext: false } }) } },
        provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true, missingHandler: { logMissingKey: false } }, loader: RecordTranslations }),
      ] });
      translator = TestBed.inject(TranslocoService);
      translator.setActiveLang(lang);
      translator.setTranslation(dictionaries[lang], lang);
      for (const [path, value] of Object.entries(dictionaries)) {
        if (path.endsWith('/' + lang)) translator.setTranslation(value, path);
      }
    });

    afterEach(() => {
      TestBed.resetTestingModule();
      dispose();
      crmQueries().clear();
      vi.restoreAllMocks();
      for (const name of ['showModal', 'close'] as const) {
        const descriptor = originalDialog[name];
        if (descriptor) Object.defineProperty(dialogPrototype, name, descriptor);
        else Reflect.deleteProperty(dialogPrototype, name);
      }
      bindAnalyticsPermissions(() => []);
      localStorage.removeItem('lang');
      document.documentElement.removeAttribute('data-theme');
    });

    async function until(test: () => boolean) {
      for (let attempt = 0; attempt < 100; attempt++) {
        harness.detectChanges();
        if (test()) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(test()).toBe(true);
    }

    async function open(id = transport.record.id): Promise<PageState> {
      harness = await RouterTestingHarness.create();
      const page = await harness.navigateByUrl(`/crm/customers/${id}`, CustomerPage) as unknown as PageState;
      await until(() => !page.loading() && !page.showSkeleton());
      await harness.fixture.whenStable();
      harness.detectChanges();
      return page;
    }

    it('CustomerPage › load states', async () => {
      const page = await open();
      expect(page.detail()?.id).toBe(transport.record.id);
      const read = transport.recordedReads().find((item) => item.path === `/customer-profiles/${transport.record.id}`)!;
      expect(read.scope).toBeUndefined();
      for (const status of [404, 403, 429, 503]) {
        transport.readError = new ApiError(status, status === 404 ? 'CUSTOMER_PROFILE_NOT_FOUND' : status === 403 ? 'CRM_SCOPED_PERMISSION_DENIED' : status === 429 ? 'RATE_LIMITED' : 'SERVER_ERROR', { retryAfterSeconds: ['7'] }, { correlationId: 'cu2-correlation' });
        await (page as unknown as { loadCustomer(id: string, draft: null): Promise<void> }).loadCustomer(transport.record.id, null);
        harness.detectChanges();
        expect(harness.routeNativeElement!.querySelector('ui-full-state')).not.toBeNull();
        if (status === 403) expect(page.scopeDenied()).toBe(true);
        else expect(page.loadKind()).toBe(status === 404 ? 'not-found' : 'load-failure');
        if (status === 503) expect(harness.routeNativeElement!.textContent).toContain('cu2-correlation');
        if (status === 429) expect(harness.routeNativeElement!.textContent).toContain('7');
      }
      const count = transport.recordedReads().length;
      selection.set({ companyId, branchId: null });
      await (page as unknown as { loadCustomer(id: string, draft: null): Promise<void> }).loadCustomer(transport.record.id, null);
      expect(transport.recordedReads()).toHaveLength(count);
    });

    it('CustomersApi › create body matches the image', async () => {
      const body = toCreateBody(emptyDraft({ branchId, profileType: 'CORPORATE', companyName: 'Image fields', companyEmail: 'company@example.com', legalName: 'Legal', taxNumber: 'VAT', companyPhones: ['+201001234567'], companyWebsite: 'https://example.com', description: 'Details', customFields: { reference: 'A' }, tagIds: ['tag'] }));
      await createCustomer(Object.assign(body, { contactChange: { op: 'REMOVE' }, includeStatusCounts: true }), newIdempotencyKey());
      const request = transport.recordedWrites()[0];
      expect(request.path).toBe('/customer-profiles');
      expect(request.body).toEqual(bodyWithoutExtras(body));
      expect(request.options.key).toMatch(/^[\da-f-]{14}7[\da-f-]+$/i);
      expect(request.options.scope).toBeUndefined();
    });

    it('CustomerForm › create keys', async () => {
      const page = await open('new');
      page.draft.set(emptyDraft({ branchId, firstName: 'Record', email: 'record@example.com' }));
      transport.writeError = new ApiError(503, 'SERVER_ERROR');
      await page.saveCreate(false);
      await page.saveCreate(false);
      const first = transport.recordedWrites().filter((item) => item.path === '/customer-profiles');
      expect(first).toHaveLength(2);
      expect(first[1].options.key).toBe(first[0].options.key);
      expect(first[1].body).toEqual(first[0].body);
      page.draft.update((draft) => ({ ...draft, firstName: 'Changed' }));
      await page.saveCreate(false);
      expect(transport.recordedWrites().at(-1)!.options.key).not.toBe(first[0].options.key);
      transport.writeError = new ApiError(422, 'CUSTOMER_PROFILE_REFERENCE_CONFLICT');
      await page.saveCreate(false);
      const rejectedKey = transport.recordedWrites().at(-1)!.options.key;
      await page.saveCreate(false);
      expect(transport.recordedWrites().at(-1)!.options.key).not.toBe(rejectedKey);
      transport.writeError = new ApiError(409, 'GW.IDEM.MISMATCH');
      await page.saveCreate(false);
      expect(page.reloadRequired()).toBe(true);
      const count = transport.recordedWrites().length;
      await page.save();
      expect(transport.recordedWrites()).toHaveLength(count);
      expect(page.draft().firstName).toBe('Changed');
    });

    it('CustomerForm › create errors', () => {
      for (const code of ['CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN','CUSTOMER_PROFILE_PRIMARY_CONTACT_FORBIDDEN','CUSTOMER_PROFILE_DISPLAY_NAME_REQUIRED','CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED','CUSTOMER_PROFILE_CONTACT_PRIMARY_INVALID','PARTY_CONTACT_METHOD_REPEATED','LEAD_PHONE_INVALID','LEAD_ADDRESS_GEO_INVALID','LEAD_ADDRESS_GEO_INCOMPLETE','CRM_ACQUISITION_SOURCE_INACTIVE','CRM_TAG_UNKNOWN','CUSTOM_FIELD_REQUIRED','CUSTOM_FIELD_VALUE_INVALID','PARTY_DUPLICATE_CONTACT_METHOD','PARTY_DUPLICATE_CONTACT','CUSTOMER_PROFILE_REFERENCE_CONFLICT','PARTY_CONTACT_INVALID','PARTY_CONTACT_LIMIT_EXCEEDED','CUSTOMER_PROFILE_STATUS_MANAGE_REQUIRED']) {
        const mapped = customerRecordError(new ApiError(422, code, { methodType: ['email'], fieldKey: ['reference'] }), translator, emptyDraft());
        expect(Object.keys(mapped.fields), code).not.toHaveLength(0);
      }
      const validation = customerRecordError(new ApiError(400, 'CRM_VALIDATION_FAILED', { 'primaryContact.email': ['invalid'], description: ['invalid'] }), translator);
      expect(customerRecordError(new ApiError(409, 'PARTY_DUPLICATE_CONTACT'), translator, emptyDraft()).message).toBe(translator.translate('customers.errors.PARTY_DUPLICATE_CONTACT'));
      expect(validation.fields).toHaveProperty('email');
      expect(validation.fields).toHaveProperty('description');
      expect(customerRecordError(new ApiError(401, 'UNAUTHORIZED'), translator).message).toBe(translator.translate('customerForm.server.notSaved'));
      for (const code of ['CRM_CUSTOMERS_DISABLED','CRM_SUBSCRIPTION_READ_ONLY','SEAT_OVER_CAPACITY_READ_ONLY']) expect(customerRecordError(new ApiError(403, code), translator).readOnly).toBe(true);
      expect(customerRecordError(new ApiError(429, 'RATE_LIMITED', { retryAfterSeconds: ['7'] }), translator).message).toContain('7');
    });

    it('CustomersApi › patch without contacts', async () => {
      await patchCustomer(transport.record.id, { expectedUpdatedAt: transport.record.updatedAt, description: 'Patch', contacts: [], contactChange: { op: 'REMOVE', contactPartyId: ownerId } });
      expect(transport.recordedWrites()[0].body).toEqual({ expectedUpdatedAt: expect.any(String), description: 'Patch' });
      expect(transport.recordedWrites()[0].options.scope).toBeUndefined();
      expect(transport.recordedWrites()[0].options.key).toBeTruthy();
      await expect(patchCustomer(transport.record.id, { description: 'Missing token' })).rejects.toMatchObject({ status: 409 });
      expect(transport.recordedWrites()).toHaveLength(1);
    });

    it('CustomerPage › patch errors', async () => {
      const page = await open();
      page.draft.update((draft) => ({ ...draft, description: 'Keep this edit' }));
      transport.writeError = new ApiError(409, 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE');
      const pending = page.save();
      await until(() => page.conflictOpen());
      expect(harness.routeNativeElement!.querySelector('ui-conflict-dialog dialog[open]')).not.toBeNull();
      transport.record.updatedAt = '2026-11-23T06:05:00.000Z';
      page.onConflictChoice('keep');
      await pending;
      expect(page.draft().description).toBe('Keep this edit');
      expect(page.updatedAt()).toBe(transport.record.updatedAt);
      expect(transport.recordedWrites().filter((item) => item.method === 'PATCH')).toHaveLength(1);
      transport.writeError = new ApiError(403, 'CUSTOMER_PROFILE_PARTY_MANAGE_REQUIRED');
      await page.save();
      expect(page.draft().description).toBe('Keep this edit');
      expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(translator.translate('customerForm.server.CUSTOMER_PROFILE_PARTY_MANAGE_REQUIRED'));
    });

    it('CustomerForm › contact actions enabled', async () => {
      transport.record.profileType = 'CORPORATE';
      const page = await open();
      const contacts = harness.routeNativeElement!.querySelector('app-record-contacts')!;
      expect(contacts.querySelector('button')).not.toBeNull();
      expect(harness.routeNativeElement!.textContent).not.toContain(translator.translate('customerForm.contactsWaveAHint'));
      expect(page.canEdit()).toBe(true);
    });

    function corporateContacts() {
      transport.record.profileType = 'CORPORATE';
      transport.record.companyName = 'Contact company';
      transport.record.phones = ['+20222222222'];
      transport.record.contacts = ['First', 'Second'].map((name, index) => ({
        partyId: name, relationshipId: null, displayName: name, firstName: name, lastName: '',
        honorificTitle: null, jobTitle: null, isPrimary: index === 0, email: null,
        phones: ['+20100123456' + index],
      }));
    }

    it('CustomerPage › contact-only save skips the main PATCH', async () => {
      corporateContacts();
      const page = await open();
      page.draft.update((draft) => ({ ...draft, contacts: draft.contacts.map((contact, index) => index === 1 ? { ...contact, firstName: 'Changed' } : contact) }));
      expect(await page.save()).toBe(true);
      const patches = transport.recordedWrites().filter(({ method }) => method === 'PATCH');
      expect(patches).toHaveLength(1);
      expect(patches[0].body).toMatchObject({ contactChange: { op: 'UPDATE', contactPartyId: 'Second' } });
      expect(patches[0].body).not.toHaveProperty('contacts');
    });

    it('CustomerPage › partial contact save lists saved contacts and keeps pending edits', async () => {
      corporateContacts();
      const page = await open();
      page.draft.update((draft) => ({ ...draft, contacts: [{ ...draft.contacts[1], firstName: 'Pending', isPrimary: true }] }));
      transport.contactFailureAt = 2;
      expect(await page.save()).toBe(false);
      const patches = transport.recordedWrites().filter(({ method }) => method === 'PATCH');
      expect(patches.map(({ body }) => (body as { contactChange: ContactChangeBody }).contactChange.op)).toEqual(['REMOVE', 'UPDATE']);
      expect(page.base().contacts.map((contact) => contact.contactPartyId)).toEqual(['Second']);
      expect(page.draft().contacts[0].firstName).toBe('Pending');
      expect(TestBed.inject(Notify).toasts().at(-1)?.text).toContain('First');
      expect(transport.recordedReads().filter(({ path }) => path === `/customer-profiles/${transport.record.id}`)).toHaveLength(2);
    });

    it('CustomerPage › tags', async () => {
      const page = await open();
      const invalidation = vi.spyOn(crmQueries(), 'invalidateQueries');
      await listCustomerTags(transport.record.id);
      for (const [status, code] of [[409,'CRM_RECORD_TAG_ALREADY_ATTACHED'],[404,'CRM_TAG_NOT_FOUND'],[404,'CRM_RECORD_TAG_NOT_FOUND'],[422,'CRM_TAG_LIMIT_EXCEEDED']] as const) {
        page.draft.update((draft) => ({ ...draft, tagIds: ['new-tag'] }));
        transport.writeError = new ApiError(status, code);
        await page.save();
        expect(TestBed.inject(Notify).toasts().at(-1)?.type).toBe('error');
      }
      expect(invalidation).toHaveBeenCalledWith({ queryKey: ['crm-customers'] });
      transport.writeError = null;
      await attachCustomerTags(transport.record.id, ['one']);
      await detachCustomerTag(transport.record.id, 'one');
      for (const request of transport.recordedWrites()) {
        expect(request.options.key).toBeTruthy();
        expect(request.options.scope).toBeUndefined();
      }
      expect(transport.recordedReads().filter((item) => item.path.endsWith('/tags')).every((item) => item.scope === undefined)).toBe(true);
    });

    it('CustomerPage › delete explains linked leads', async () => {
      transport.record.sourceLeadId = ownerId;
      const page = await open();
      page.openDeleteDialog();
      harness.detectChanges();
      expect(harness.routeNativeElement!.querySelector('dialog[open]')!.textContent).toContain(translator.translate('customerPage.delete.bodyReopensLead'));
      expect((dictionaries[`customer-page/${lang}`]['delete'] as Record<string, unknown>)['bodyReopensLead']).toBe((dictionaries[`customer-modal/${lang}`]['delete'] as Record<string, unknown>)['bodyReopensLead']);
    });

    it('CustomerPage › delete errors', async () => {
      const page = await open();
      page.openDeleteDialog();
      for (const code of ['CUSTOMER_PROFILE_HAS_ACTIVE_OPPORTUNITIES','CUSTOMER_PROFILE_BLACKLISTED','CUSTOMER_PROFILE_SOURCE_LEAD_CONFLICT','CUSTOMER_PROFILE_REOPEN_STAGE_UNAVAILABLE','CUSTOMER_PROFILE_DISQUALIFY_STAGE_UNAVAILABLE','CUSTOMER_PROFILE_LINKED_LEAD_LIMIT','CUSTOMER_PROFILE_LINKED_LEADS_CHANGED']) {
        transport.writeError = new ApiError(409, code, { leadName: ['Linked lead'] });
        await page.submitDelete();
        harness.detectChanges();
        expect(page.deleteConflictMessage(), code).toBeTruthy();
        expect(page.deleteConflictMessage(), code).toContain(translator.translate(`customerForm.server.${code}`));
        if (code === 'CUSTOMER_PROFILE_SOURCE_LEAD_CONFLICT') expect(page.deleteConflictMessage()).toContain('Linked lead');
        expect(harness.routeNativeElement!.querySelector('dialog[open]')).not.toBeNull();
      }
      expect(transport.recordedWrites().every((item) => item.method === 'DELETE' && !!item.options.key && item.options.scope === undefined)).toBe(true);
    });

    it('CustomerForm › duplicate strip degrades', async () => {
      transport.writeError = new ApiError(403, 'CRM_LEADS_DISABLED');
      const page = await open();
      page.draft.update((draft) => ({ ...draft, companyName: 'Probe company', companyPhones: ['+201001234567'] }));
      await until(() => transport.recordedWrites().some((item) => item.path === '/leads/duplicate-check'));
      await new Promise((resolve) => setTimeout(resolve, 30));
      harness.detectChanges();
      expect(harness.routeNativeElement!.querySelector('app-duplicate-strip')!.textContent?.trim()).toBe('');
      expect(page.canEdit()).toBe(true);
      const form = harness.fixture.debugElement.query(By.directive(CustomerForm)).componentInstance as CustomerForm;
      expect(form.duplicateBlocking()).toBe(false);
      expect(transport.recordedWrites().find((item) => item.path === '/leads/duplicate-check')!.options.key).toBeTruthy();
    });

    it('CustomerPage › status dialog', async () => {
      await open();
      expect(harness.routeNativeElement!.textContent).toContain(translator.translate('customerForm.server.CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON'));
      const caps = await getCustomerCapabilities(branchId);
      expect(caps.branchId).toBe(branchId);
      const owners = await listFormOwners(branchId, 'update');
      expect(owners[0].userId).toBe(ownerId);
      for (const request of transport.recordedReads().filter((item) => item.path === '/assignable-owners' || item.path.endsWith('/capabilities'))) expect(request.scope).toEqual({ companyId, branchId });
      expect(transport.recordedReads().find((item) => item.path === '/assignable-owners')!.query).toMatchObject({ resource: 'customer_profiles', action: 'update' });
      expect(await listFormCurrencies()).toEqual([]);
    });

    it('CustomerPage › tab gating', async () => {
      const page = await open();
      expect(page.canLogActivity()).toBe(false);
      expect(page.canUploadAttachments()).toBe(false);
      expect(page.canDeleteAttachments()).toBe(false);
      permissions.update((keys) => [...keys, 'activities.create', 'crm.attachments.create']);
      expect(page.canLogActivity()).toBe(true);
      expect(page.canUploadAttachments()).toBe(true);
      expect(page.canDeleteAttachments()).toBe(false);
      permissions.update((keys) => [...keys, 'crm.attachments.delete']);
      expect(page.canDeleteAttachments()).toBe(true);
    });

    it('CustomerForm › catalogues degrade and required fields block Save', async () => {
      for (const path of ['/custom-fields', '/tags', '/acquisition-sources']) transport.catalogueErrors.set(path, new ApiError(403, 'FORBIDDEN'));
      const page = await open();
      page.draft.update((draft) => ({ ...draft, description: 'Still editable' }));
      harness.detectChanges();
      expect(harness.routeNativeElement!.textContent).toContain(translator.translate('customerForm.catalogueDenied'));
      expect(harness.routeNativeElement!.querySelector('ui-field input[disabled]')).not.toBeNull();
      await page.save();
      expect(transport.recordedWrites().filter((request) => request.method === 'PATCH')).toHaveLength(0);
      expect(page.draft().description).toBe('Still editable');
      expect(harness.routeNativeElement!.textContent).toContain(translator.translate('customerForm.geoUnavailable'));
    });

    it('CustomerForm › currency lookup requires tenant-wide permission', async () => {
      const read = vi.spyOn(TestBed.inject(CoreHttp), 'readPage');
      expect(await listFormCurrencies()).toEqual([]);
      expect(read).not.toHaveBeenCalled();
      sessionMe.set({ isTenantOwner: false, permissions: ['currencies.currency.read'], permissionScopes: { 'currencies.currency.read': { tenantWide: true } } });
      expect(await listFormCurrencies()).toEqual([{ code: 'EGP', status: 'ACTIVE' }]);
      expect(read).toHaveBeenCalledWith('/api/tenant/core/v1/currencies', expect.objectContaining({ status: 'ACTIVE', limit: 100 }));
    });

    it('CustomersApi › retryable writes keep the key and body changes replace it', async () => {
      const body: UpdateCustomerBody = { expectedUpdatedAt: transport.record.updatedAt, description: 'Retry' };
      for (const error of [new ApiError(0, 'NETWORK'), new ApiError(401, 'UNAUTHORIZED'), new ApiError(503, 'SERVER_ERROR'), new ApiError(409, 'GW.IDEM.IN_FLIGHT')]) {
        transport.writeError = error;
        await expect(patchCustomer(transport.record.id, body)).rejects.toBe(error);
      }
      const requests = transport.recordedWrites();
      expect(new Set(requests.map((request) => request.options.key)).size).toBe(1);
      expect(requests.every((request) => JSON.stringify(request.body) === JSON.stringify(requests[0].body))).toBe(true);
      transport.writeError = new ApiError(409, 'CUSTOMER_IDEMPOTENCY_MISMATCH');
      const changed = { ...body, description: 'Changed retry' };
      await expect(patchCustomer(transport.record.id, changed)).rejects.toBe(transport.writeError);
      expect(transport.recordedWrites().at(-1)!.options.key).not.toBe(requests[0].options.key);
      const count = transport.recordedWrites().length;
      await expect(patchCustomer(transport.record.id, changed)).rejects.toMatchObject({ code: 'GW.IDEM.MISMATCH' });
      expect(transport.recordedWrites()).toHaveLength(count);
    });

    it('CustomerModal › shares record states and conflict behavior', async () => {
      const fixture = TestBed.createComponent(CustomerModal);
      fixture.detectChanges();
      const modal = fixture.componentInstance as unknown as {
        openCustomer(id: string, nav: null): void; loading(): boolean; detail(): CustomerDetail | null;
        draft: ReturnType<typeof signal<CustomerDraft>>; updatedAt(): string | null;
        save(addAnother: boolean): Promise<boolean>; conflictOpen(): boolean; onConflictChoice(choice: 'keep'): void;
      };
      modal.openCustomer(transport.record.id, null);
      for (let n = 0; n < 100 && (modal.loading() || !modal.detail()); n++) { fixture.detectChanges(); await new Promise((resolve) => setTimeout(resolve, 10)); }
      await fixture.whenStable();
      fixture.detectChanges();
      modal.draft.update((draft) => ({ ...draft, description: 'Modal edit' }));
      transport.writeError = new ApiError(409, 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE');
      const saving = modal.save(false);
      for (let n = 0; n < 100 && !modal.conflictOpen(); n++) { fixture.detectChanges(); await new Promise((resolve) => setTimeout(resolve, 10)); }
      expect(modal.conflictOpen()).toBe(true);
      transport.record.updatedAt = '2026-11-23T07:00:00.000Z';
      modal.onConflictChoice('keep');
      await saving;
      expect(modal.updatedAt()).toBe(transport.record.updatedAt);
      expect(modal.draft().description).toBe('Modal edit');
      expect(transport.recordedWrites().filter((item) => item.method === 'PATCH')).toHaveLength(1);
    });
  });
}

function bodyWithoutExtras(body: CreateCustomerBody): CreateCustomerBody {
  const copy = { ...body } as CreateCustomerBody & { contactChange?: unknown; includeStatusCounts?: unknown };
  delete copy.contactChange;
  delete copy.includeStatusCounts;
  return copy;
}
