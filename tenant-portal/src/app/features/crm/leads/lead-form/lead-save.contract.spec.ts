import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp, CoreQuery, CoreWriteMethod } from '../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { bindCrmHttpForTest, crmQueries, CrmReadOptions, CrmWriteOptions } from '../../shared/crm-http';
import { bindCrmInjectorForTest } from '../../shared/crm-runtime';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { checkLeadDuplicates, createLead, getLead, listCompanyContacts, listCompanyOptions,
  listLeadCurrencies, patchLead, setLeadColor, setLeadRating } from '../leads.api';
import { LeadContact, LeadDetail } from '../leads.model';
import { draftFromDetail, newContact, toCreateBody, toPatchBody, UpdateLeadBody } from './lead-draft';
import { LeadContactSaveError, saveLeadChanges } from './lead-save';
import { leadServerError } from './lead-server-error';
import en from '../../../../../../public/i18n/lead-form/en.json';
import ar from '../../../../../../public/i18n/lead-form/ar.json';
import enSettings from '../../../../../../public/i18n/settings/en.json';
import arSettings from '../../../../../../public/i18n/settings/ar.json';

const branchId = '019f0000-0000-7000-8000-000000000011';
const companyId = '019f0000-0000-7000-8000-000000000010';
const leadId = '019f0000-0000-7000-8000-000000000012';
const person1 = '019f0000-0000-7000-8000-000000000021';
const person2 = '019f0000-0000-7000-8000-000000000022';
const person3 = '019f0000-0000-7000-8000-000000000023';

function contact(partyId: string, firstName: string, isPrimary = false): LeadContact {
  return { partyId, firstName, lastName: null, displayName: firstName, isPrimary, relationshipId: null,
    honorificTitle: null, jobTitle: null, email: null, phones: ['+201000000000'] };
}
function detail(): LeadDetail {
  return { id: leadId, branchId, partyId: companyId, leadProfileType: 'CORPORATE', displayName: 'Acme',
    companyName: 'Acme', companyPhone: null, companyEmail: null, companyPhones: [], companyWebsite: null,
    firstName: null, lastName: null, honorificTitle: null, phones: [], email: null, primaryMobile: null,
    legalName: null, taxNumber: null, commercialRegistrationNumber: null, existingCompany: false,
    stageId: 'new', stageFlag: 'NEW', status: 'OPEN', rating: 0, cardColor: null, owner: null, ownerUserId: null,
    acquisitionSourceId: null, acquisitionSource: null, address: null, primaryContact: null, nextActivity: null,
    description: null, interestSummary: null, expectedNeed: null, expectedValue: null, currencyCode: null,
    contacts: [contact(person1, 'Ali', true), contact(person2, 'Nora')], customFields: {}, tags: [],
    updatedAt: '2026-11-23T00:00:00.000Z', createdAt: '2026-11-23T00:00:00.000Z' };
}

class WriteHttp extends CrmHttpStub {
  lead = detail();
  failure?: ApiError;
  failAt = 0;
  loseAddResponse = false;
  private revision = 0;
  constructor() { super({ [`/leads/${leadId}`]: {}, '/leads/company-options': [],
    [`/leads/company-options/${companyId}/contacts`]: [] }); }
  override async read<T>(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<T> {
    const value = await super.read<T>(path, query, options);
    return path === `/leads/${leadId}` ? structuredClone(this.lead) as T : value;
  }
  override async write<T>(method: CoreWriteMethod, path: string, body: unknown, options: CrmWriteOptions) {
    const result = await super.write<T>(method, path, body, options);
    if (this.failure && (!this.failAt || this.recordedWrites().length === this.failAt)) throw this.failure;
    const patch = body as UpdateLeadBody;
    if (path === '/leads/duplicate-check') return { ...result, data: { matches: [] } as T };
    if (method === 'PATCH') {
      if (patch.expectedUpdatedAt !== this.lead.updatedAt) throw new ApiError(409, 'CRM.LEAD.CONCURRENT_UPDATE');
      const change = patch.contactChange;
      if (!change) this.lead = { ...this.lead, ...patch, contacts: this.lead.contacts, address: this.lead.address };
      else if (change.op === 'REMOVE') this.lead.contacts = this.lead.contacts.filter((row) => row.partyId !== change.contactPartyId);
      else if (change.op === 'UPDATE') this.lead.contacts = this.lead.contacts.map((row) => row.partyId === change.contactPartyId
        ? { ...row, ...change.contact } as LeadContact : row);
      else if (change.op === 'ADD') this.lead.contacts.push({ ...contact(change.contact.contactPartyId ?? person3,
        change.contact.firstName ?? 'New'), ...change.contact } as LeadContact);
      else this.lead.contacts = this.lead.contacts.map((row) => ({ ...row, isPrimary: row.partyId === change.contactPartyId }));
      this.lead.updatedAt = `2026-11-23T00:00:00.${String(++this.revision).padStart(3, '0')}Z`;
      if (change?.op === 'ADD' && this.loseAddResponse) throw new ApiError(0, 'NETWORK_ERROR');
    }
    if (path === `/leads/${leadId}/tags`) for (const id of (body as { tagIds: string[] }).tagIds) {
      this.lead.tags.push({ id, name: id, backgroundColor: null, textColor: null });
    }
    if (method === 'DELETE') this.lead.tags = this.lead.tags.filter((tag) => !path.endsWith(`/${tag.id}`));
    return { ...result, data: structuredClone(this.lead) as T };
  }
}

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('Lead writes %s / %s', (lang, theme) => {
  let http: WriteHttp;
  let dispose: () => void;
  let restoreRuntime: () => void;
  let t: TranslocoService;
  let attributes: (string | null)[];
  const selection = signal<{ companyId: string; branchId: string | null }>({ companyId, branchId });
  const coreRead = vi.fn(async () => [{ code: 'EGP', nameEn: 'Pound', nameAr: 'جنيه', decimals: 2, isDefault: true }]);
  beforeEach(() => {
    attributes = ['lang', 'dir', 'data-theme'].map((key) => document.documentElement.getAttribute(key));
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    selection.set({ companyId, branchId });
    TestBed.configureTestingModule({ providers: [
      { provide: TenantScopeState, useValue: { selection, branchCompanies: () => new Map([[branchId, companyId]]) } },
      { provide: CoreHttp, useValue: { read: coreRead } },
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: lang } }),
    ] });
    t = TestBed.inject(TranslocoService); t.setActiveLang(lang);
    t.setTranslation({ leadForm: lang === 'ar' ? ar : en, settings: lang === 'ar' ? arSettings : enSettings }, lang);
    restoreRuntime = bindCrmInjectorForTest(() => TestBed.inject(Injector));
    bindAnalyticsPermissions(() => ['crm.leads.read.all']);
    http = new WriteHttp(); dispose = bindCrmHttpForTest(http); crmQueries().clear(); coreRead.mockClear();
  });
  afterEach(() => {
    for (const call of http.recordedWrites()) {
      expect(call.options.key).toMatch(/^[0-9a-f-]{14}7[0-9a-f-]{21}$/i);
      expect(call.options.scope).toBeUndefined();
      if (call.method === 'PATCH') {
        expect(call.body).toHaveProperty('expectedUpdatedAt');
        expect(call.body).not.toHaveProperty('contacts'); expect(call.body).not.toHaveProperty('tagIds');
      }
    }
    dispose(); restoreRuntime(); crmQueries().clear(); bindAnalyticsPermissions(() => []);
    ['lang', 'dir', 'data-theme'].forEach((key, index) => attributes[index] === null
      ? document.documentElement.removeAttribute(key) : document.documentElement.setAttribute(key, attributes[index]!));
  });

  it('LeadForm › create keys', async () => {
    const body = toCreateBody(draftFromDetail(http.lead)); const key = newIdempotencyKey();
    http.failure = new ApiError(503, 'UNAVAILABLE');
    await expect(createLead(body, key)).rejects.toMatchObject({ status: 503 });
    http.failure = undefined; await createLead(body, key);
    expect(http.recordedWrites().map((call) => call.options.key)).toEqual([key, key]);
    const mismatchKey = newIdempotencyKey(); http.failure = new ApiError(422, 'GW.IDEM.MISMATCH');
    await expect(createLead(body, mismatchKey)).rejects.toMatchObject({ code: 'GW.IDEM.MISMATCH' });
    await expect(createLead(body, mismatchKey)).rejects.toMatchObject({ code: 'GW.IDEM.MISMATCH' });
    expect(http.recordedWrites()).toHaveLength(3);
    expect(leadServerError(t, http.failure, draftFromDetail(http.lead))).toMatchObject({ mismatch: true, readOnly: true });
  });

  it('LeadForm › create errors', () => {
    const draft = draftFromDetail(http.lead);
    for (const [code, field] of [
      ['LEAD_COMPANY_NAME_REQUIRED', 'companyName'], ['LEAD_PRIMARY_CONTACT_REQUIRED', 'contacts'],
      ['LEAD_PRIMARY_PHONE_CONFLICT', 'companyPhones.0'], ['LEAD_EXISTING_COMPANY_INVALID', 'existingCompanyPartyId'],
      ['LEAD_STAGE_INVALID', 'stageId'], ['LEAD_EXPECTED_VALUE_INVALID', 'expectedValue'],
    ]) expect(leadServerError(t, new ApiError(422, code), draft).errors[field]).toBe(`leadForm.server.${code}`);
    expect(leadServerError(t, new ApiError(422, 'LEAD_ADDRESS_GEO_INVALID', { field: ['cityId'] }), draft).errors)
      .toHaveProperty('address.cityId');
    expect(leadServerError(t, new ApiError(400, 'CRM_VALIDATION_FAILED', { 'contacts.0.firstName': ['required'] }), draft).errors)
      .toEqual({ 'contacts.0.firstName': 'required' });
    expect(leadServerError(t, new ApiError(422, 'CUSTOM_FIELD_REQUIRED', { fieldKey: ['industry'] }), draft).errors)
      .toEqual({ 'customFields.industry': 'required' });
    expect(leadServerError(t, new ApiError(422, 'CUSTOM_FIELD_REQUIRED'), draft).errors).toEqual({});
  });

  it('LeadForm › contacts-only save skips main patch', async () => {
    const base = draftFromDetail(http.lead); const draft = structuredClone(base); draft.contacts[0].jobTitle = 'Manager';
    await saveLeadChanges(http.lead, base, draft);
    expect(http.recordedWrites()).toHaveLength(1);
    expect(http.recordedWrites()[0].body).toMatchObject({ contactChange: { op: 'UPDATE', contactPartyId: person1 } });
  });
  it('highlights every custom field named by the server', () => {
    const draft = draftFromDetail(http.lead);
    for (const code of ['CUSTOM_FIELD_REQUIRED', 'CUSTOM_FIELD_VALUE_INVALID', 'CUSTOM_FIELD_INVALID']) {
      const result = leadServerError(t, new ApiError(422, code, { fieldKey: ['industry', 'region'] }), draft);
      const message = code === 'CUSTOM_FIELD_REQUIRED' ? 'required' : `leadForm.server.${code}`;
      expect(result.errors).toEqual({ 'customFields.industry': message, 'customFields.region': message });
    }
  });
  it('keeps custom fields returned in the saved detail', async () => {
    const current = await getLead(leadId);
    const base = draftFromDetail(current); const draft = structuredClone(base);
    draft.contacts[0].jobTitle = 'Manager';
    http.lead.customFields = { industry: 'Server value', score: 0, subscribed: false };
    const result = await saveLeadChanges(current, base, draft);
    expect(result.lead.customFields).toEqual(http.lead.customFields);
  });

  it('LeadForm › contact operations in order', async () => {
    const base = draftFromDetail(http.lead); const draft = structuredClone(base);
    draft.description = 'Changed'; draft.contacts = [{ ...draft.contacts[0], jobTitle: 'Manager', isPrimary: false },
      newContact(true)]; draft.contacts[1].firstName = 'Mona';
    await saveLeadChanges(http.lead, base, draft);
    const calls = http.recordedWrites().map((call) => call.body as UpdateLeadBody);
    expect(calls.map((body) => body.contactChange?.op ?? 'MAIN')).toEqual(['MAIN', 'REMOVE', 'UPDATE', 'ADD', 'SET_PRIMARY']);
    expect(calls.map((body) => body.expectedUpdatedAt)).toEqual([0, 1, 2, 3, 4].map((n) => `2026-11-23T00:00:00.00${n}Z`));
  });

  it('LeadForm › primary uses the new contact id', async () => {
    const base = draftFromDetail(http.lead); const draft = structuredClone(base);
    draft.contacts.forEach((row) => row.isPrimary = false);
    const added = newContact(true); added.firstName = 'Mona'; draft.contacts.push(added);
    await saveLeadChanges(http.lead, base, draft);
    expect(http.recordedWrites().at(-1)?.body).toMatchObject({ contactChange: { op: 'SET_PRIMARY', contactPartyId: person3 } });
    expect(http.recordedWrites().at(-1)?.body).not.toHaveProperty('contactChange.contactPartyId', added.key);
  });

  it('LeadForm › partial contact save', async () => {
    const base = draftFromDetail(http.lead); const draft = structuredClone(base);
    draft.contacts = [{ ...draft.contacts[0], jobTitle: 'Manager' }, { ...newContact(false), firstName: 'Mona' }];
    http.failAt = 2; http.failure = new ApiError(409, 'CRM.LEAD.CONCURRENT_UPDATE');
    const error = await saveLeadChanges(http.lead, base, draft).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(LeadContactSaveError);
    const partial = error as LeadContactSaveError;
    expect(partial.saved).toEqual([{ op: 'REMOVE', name: 'Nora' }]);
    expect(partial.remaining.contacts).toHaveLength(2); expect(partial.remaining.contacts[0].jobTitle).toBe('Manager');
    expect(partial.fresh?.contacts).toHaveLength(1); expect(http.recordedWrites()).toHaveLength(2);
    expect(http.recordedReads().at(-1)?.path).toBe(`/leads/${leadId}`);
    http.failure = undefined;
    await saveLeadChanges(partial.fresh!, draftFromDetail(partial.fresh!), partial.remaining);
    expect(http.recordedWrites().slice(2).map((call) => (call.body as UpdateLeadBody).contactChange?.op)).toEqual(['UPDATE', 'ADD']);
  });

  it('LeadPage › tag diff', async () => {
    http.lead.tags = [{ id: 'old', name: 'Old', backgroundColor: null, textColor: null }];
    const base = draftFromDetail(http.lead); const draft = { ...base, description: 'Saved', tagIds: ['new'] };
    const result = await saveLeadChanges(http.lead, base, draft);
    expect(http.recordedWrites().map((call) => [call.method, call.path])).toEqual([
      ['PATCH', `/leads/${leadId}`], ['POST', `/leads/${leadId}/tags`], ['DELETE', `/leads/${leadId}/tags/old`],
    ]);
    expect(result.lead.tags.map((tag) => tag.id)).toEqual(['new']);
  });

  it('LeadForm › duplicate codes', () => {
    const draft = { ...draftFromDetail(http.lead), leadProfileType: 'INDIVIDUAL' as const, email: 'name@example.com', phones: ['+201000000000'] };
    expect(leadServerError(t, new ApiError(409, 'PARTY_DUPLICATE_CONTACT_METHOD', { methodType: ['email'], level: ['branch'] }), draft).errors)
      .toEqual({ email: 'leadForm.write.duplicate.BRANCH' });
    expect(leadServerError(t, new ApiError(409, 'PARTY_DUPLICATE_CONTACT_METHOD', { methodType: ['phone'] }), draft).errors)
      .toEqual({ 'phones.0': 'leadForm.server.PARTY_DUPLICATE_CONTACT_METHOD' });
    const open = leadServerError(t, new ApiError(409, 'LEAD_OPEN_EXISTS'), draft);
    expect(open.errors).toEqual({}); expect(open.message).toBe((lang === 'ar' ? ar : en).server.LEAD_OPEN_EXISTS);
  });

  it('LeadForm › shared company', async () => {
    const base = draftFromDetail(http.lead); const draft = { ...base, companyName: 'Changed' };
    http.failure = new ApiError(403, 'LEAD_PARTY_MANAGE_REQUIRED');
    await expect(saveLeadChanges(http.lead, base, draft)).rejects.toMatchObject({ code: 'LEAD_PARTY_MANAGE_REQUIRED' });
    expect(draft.companyName).toBe('Changed');
    expect(leadServerError(t, http.failure, draft).message).toBe((lang === 'ar' ? ar : en).server.LEAD_PARTY_MANAGE_REQUIRED);
  });

  it('uses each lookup route scope contract', async () => {
    await listCompanyOptions(branchId, 'Acme'); await listCompanyContacts(branchId, companyId);
    await checkLeadDuplicates({ branchId, name: 'Acme' }); await listLeadCurrencies();
    expect(http.recordedReads()[0]).toMatchObject({ path: '/leads/company-options', scope: undefined });
    expect(http.recordedReads()[1]).toMatchObject({ path: `/leads/company-options/${companyId}/contacts`, scope: { branchId, companyId } });
    expect(coreRead).toHaveBeenCalledWith('/api/tenant/core/v1/currencies/options');
    http.reset(); selection.set({ companyId, branchId: null });
    await expect(listCompanyContacts(branchId, companyId)).rejects.toMatchObject({ code: 'BRANCH_REQUIRED' });
    await expect(listCompanyOptions(branchId, '')).rejects.toMatchObject({ code: 'BRANCH_REQUIRED' });
    await expect(checkLeadDuplicates({ branchId, name: 'Acme' })).rejects.toMatchObject({ code: 'BRANCH_REQUIRED' });
    expect(http.recordedReads()).toEqual([]); expect(http.recordedWrites()).toEqual([]);
  });

  it('keeps decimal precision and sends money and currency together', () => {
    const base = draftFromDetail(http.lead); base.expectedValue = '100'; base.currencyCode = 'EGP';
    const draft = { ...base, expectedValue: '9999999999999999.12345678' };
    expect(toPatchBody(base, draft, http.lead.updatedAt)).toMatchObject({ expectedValue: draft.expectedValue, currencyCode: 'EGP' });
  });

  it('retains retry keys for uncertain PATCH results and 401', async () => {
    const body = { expectedUpdatedAt: http.lead.updatedAt, description: 'Changed' };
    for (const status of [0, 503, 401]) {
      http.failure = new ApiError(status, 'UNAVAILABLE');
      await expect(patchLead(leadId, body)).rejects.toBe(http.failure);
    }
    http.failure = undefined; await patchLead(leadId, body);
    expect(new Set(http.recordedWrites().map((call) => call.options.key)).size).toBe(1);
    await getLead(leadId); await setLeadRating(leadId, 2); await setLeadColor(leadId, 'GREEN');
    expect(http.recordedWrites().at(-1)?.body).toMatchObject({ cardColor: 'GREEN', expectedUpdatedAt: '2026-11-23T00:00:00.002Z' });
  });

  it('reports tag failure after a saved patch and refreshes tags', async () => {
    const base = draftFromDetail(http.lead); const draft = { ...base, description: 'Saved', tagIds: ['new'] };
    http.failAt = 2; http.failure = new ApiError(503, 'UNAVAILABLE');
    const result = await saveLeadChanges(http.lead, base, draft);
    expect(result.tagError).toBe(http.failure); expect(result.lead.description).toBe('Saved');
    expect(http.recordedReads().at(-1)?.path).toBe(`/leads/${leadId}`);
  });

  it('does not add a contact twice when the ADD response is lost', async () => {
    const base = draftFromDetail(http.lead); const draft = structuredClone(base);
    draft.contacts.forEach((row) => row.isPrimary = false);
    draft.contacts.push({ ...newContact(true), firstName: 'Mona', phones: ['+202222222222'] });
    http.loseAddResponse = true;
    const error = await saveLeadChanges(http.lead, base, draft).catch((failure: unknown) => failure) as LeadContactSaveError;
    expect(error.saved).toEqual([{ op: 'ADD', name: 'Mona' }]);
    expect(error.remaining.contacts.at(-1)?.contactPartyId).toBe(person3);
    http.loseAddResponse = false;
    await saveLeadChanges(error.fresh!, draftFromDetail(error.fresh!), error.remaining);
    expect(http.recordedWrites().map((call) => (call.body as UpdateLeadBody).contactChange?.op)).toEqual(['ADD', 'SET_PRIMARY']);
  });

  it('maps write status cases without dropping edits', () => {
    const draft = draftFromDetail(http.lead); draft.description = 'Unsaved';
    for (const code of ['CRM_LEADS_DISABLED', 'CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY']) {
      expect(leadServerError(t, new ApiError(403, code), draft).readOnly).toBe(true);
    }
    expect(leadServerError(t, new ApiError(409, 'LEAD_ALREADY_CONVERTED'), draft).readOnly).toBe(true);
    expect(leadServerError(t, new ApiError(404, 'LEAD_NOT_FOUND'), draft).notFound).toBe(true);
    expect(leadServerError(t, new ApiError(401, 'UNAUTHORIZED'), draft).message).toBe((lang === 'ar' ? ar : en).write.notSaved);
    expect(leadServerError(t, new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['12'] }), draft).message).toContain('12');
    expect(draft.description).toBe('Unsaved');
  });
});
