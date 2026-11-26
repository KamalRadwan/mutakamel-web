import { Component, Injectable, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Translation, TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { defer } from 'rxjs';
import { ApiError } from '../../../../core/api/api-errors';
import { AuthSession } from '../../../../core/auth/auth-session';
import { LanguageState } from '../../../../core/i18n/language';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Field } from '../../../../shared/ui/field/field';
import { Notify } from '../../../../core/notify/notify';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { RecordAttachments } from '../../../../shared/widgets/record-attachments/record-attachments';
import { RecordActivitiesTab } from '../../shared/record/activities-tab/record-activities-tab';
import { RecordModalFrame } from '../../shared/record/modal/record-modal-frame';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { bindCrmHttpForTest, crmQueries, CrmReadOptions, CrmWriteOptions } from '../../shared/crm-http';
import { bindCrmInjectorForTest } from '../../shared/crm-runtime';
import { CoreHttp, CoreQuery, CoreWriteMethod } from '../../../../core/api/core-http';
import { LeadForm } from '../lead-form/lead-form';
import { LeadModal } from '../lead-modal/lead-modal';
import { getLead } from '../leads.api';
import { LeadDetail, LeadsCapabilities, LeadStage } from '../leads.model';
import { readLeadFieldValues } from './lead-record.api';
import { LeadPage } from './lead-page';
import enGlobal from '../../../../../../public/i18n/en.json';
import en_activities from '../../../../../../public/i18n/activities/en.json';
import en_call_log from '../../../../../../public/i18n/call-log/en.json';
import en_crm_modules from '../../../../../../public/i18n/crm-modules/en.json';
import en_date_range from '../../../../../../public/i18n/date-range/en.json';
import en_geo from '../../../../../../public/i18n/geo/en.json';
import en_leads from '../../../../../../public/i18n/leads/en.json';
import en_lead_page from '../../../../../../public/i18n/lead-page/en.json';
import en_lead_modal from '../../../../../../public/i18n/lead-modal/en.json';
import en_lead_form from '../../../../../../public/i18n/lead-form/en.json';
import en_lead_form_side from '../../../../../../public/i18n/lead-form-side/en.json';
import en_lead_dup from '../../../../../../public/i18n/lead-dup/en.json';
import en_party_calls from '../../../../../../public/i18n/party-calls/en.json';
import en_record_activities_tab from '../../../../../../public/i18n/record-activities-tab/en.json';
import en_record_attachments from '../../../../../../public/i18n/record-attachments/en.json';
import en_record_dup from '../../../../../../public/i18n/record-dup/en.json';
import en_record_fields from '../../../../../../public/i18n/record-fields/en.json';
import en_record_form from '../../../../../../public/i18n/record-form/en.json';
import en_record_history from '../../../../../../public/i18n/record-history/en.json';
import en_record_page from '../../../../../../public/i18n/record-page/en.json';
import en_record_modal from '../../../../../../public/i18n/record-modal/en.json';
import en_record_related from '../../../../../../public/i18n/record-related/en.json';
import en_ui_pagination from '../../../../../../public/i18n/ui-pagination/en.json';
import en_ui_phone from '../../../../../../public/i18n/ui-phone/en.json';
import en_ui_tag_picker from '../../../../../../public/i18n/ui-tag-picker/en.json';
import en_settings from '../../../../../../public/i18n/settings/en.json';
import arGlobal from '../../../../../../public/i18n/ar.json';
import ar_activities from '../../../../../../public/i18n/activities/ar.json';
import ar_call_log from '../../../../../../public/i18n/call-log/ar.json';
import ar_crm_modules from '../../../../../../public/i18n/crm-modules/ar.json';
import ar_date_range from '../../../../../../public/i18n/date-range/ar.json';
import ar_geo from '../../../../../../public/i18n/geo/ar.json';
import ar_leads from '../../../../../../public/i18n/leads/ar.json';
import ar_lead_page from '../../../../../../public/i18n/lead-page/ar.json';
import ar_lead_modal from '../../../../../../public/i18n/lead-modal/ar.json';
import ar_lead_form from '../../../../../../public/i18n/lead-form/ar.json';
import ar_lead_form_side from '../../../../../../public/i18n/lead-form-side/ar.json';
import ar_lead_dup from '../../../../../../public/i18n/lead-dup/ar.json';
import ar_party_calls from '../../../../../../public/i18n/party-calls/ar.json';
import ar_record_activities_tab from '../../../../../../public/i18n/record-activities-tab/ar.json';
import ar_record_attachments from '../../../../../../public/i18n/record-attachments/ar.json';
import ar_record_dup from '../../../../../../public/i18n/record-dup/ar.json';
import ar_record_fields from '../../../../../../public/i18n/record-fields/ar.json';
import ar_record_form from '../../../../../../public/i18n/record-form/ar.json';
import ar_record_history from '../../../../../../public/i18n/record-history/ar.json';
import ar_record_page from '../../../../../../public/i18n/record-page/ar.json';
import ar_record_modal from '../../../../../../public/i18n/record-modal/ar.json';
import ar_record_related from '../../../../../../public/i18n/record-related/ar.json';
import ar_ui_pagination from '../../../../../../public/i18n/ui-pagination/ar.json';
import ar_ui_phone from '../../../../../../public/i18n/ui-phone/ar.json';
import ar_ui_tag_picker from '../../../../../../public/i18n/ui-tag-picker/ar.json';
import ar_settings from '../../../../../../public/i18n/settings/ar.json';

const translations: Record<string, Translation> = {
  'en': enGlobal,
  'activities/en': en_activities,
  'call-log/en': en_call_log,
  'crm-modules/en': en_crm_modules,
  'date-range/en': en_date_range,
  'geo/en': en_geo,
  'leads/en': en_leads,
  'lead-page/en': en_lead_page,
  'lead-modal/en': en_lead_modal,
  'lead-form/en': en_lead_form,
  'lead-form-side/en': en_lead_form_side,
  'lead-dup/en': en_lead_dup,
  'party-calls/en': en_party_calls,
  'record-activities-tab/en': en_record_activities_tab,
  'record-attachments/en': en_record_attachments,
  'record-dup/en': en_record_dup,
  'record-fields/en': en_record_fields,
  'record-form/en': en_record_form,
  'record-history/en': en_record_history,
  'record-page/en': en_record_page,
  'record-modal/en': en_record_modal,
  'record-related/en': en_record_related,
  'ui-pagination/en': en_ui_pagination,
  'ui-phone/en': en_ui_phone,
  'ui-tag-picker/en': en_ui_tag_picker,
  'settings/en': en_settings,
  'ar': arGlobal,
  'activities/ar': ar_activities,
  'call-log/ar': ar_call_log,
  'crm-modules/ar': ar_crm_modules,
  'date-range/ar': ar_date_range,
  'geo/ar': ar_geo,
  'leads/ar': ar_leads,
  'lead-page/ar': ar_lead_page,
  'lead-modal/ar': ar_lead_modal,
  'lead-form/ar': ar_lead_form,
  'lead-form-side/ar': ar_lead_form_side,
  'lead-dup/ar': ar_lead_dup,
  'party-calls/ar': ar_party_calls,
  'record-activities-tab/ar': ar_record_activities_tab,
  'record-attachments/ar': ar_record_attachments,
  'record-dup/ar': ar_record_dup,
  'record-fields/ar': ar_record_fields,
  'record-form/ar': ar_record_form,
  'record-history/ar': ar_record_history,
  'record-page/ar': ar_record_page,
  'record-modal/ar': ar_record_modal,
  'record-related/ar': ar_record_related,
  'ui-pagination/ar': ar_ui_pagination,
  'ui-phone/ar': ar_ui_phone,
  'ui-tag-picker/ar': ar_ui_tag_picker,
  'settings/ar': ar_settings,
};

const companyId = '019f0000-0000-7000-8000-000000000010';
const branchId = '019f0000-0000-7000-8000-000000000011';
const leadId = '019f0000-0000-7000-8000-000000000012';
const ownerId = '019f0000-0000-7000-8000-000000000013';
const stages: LeadStage[] = [
  { id: 'new', flag: 'NEW', nameEn: 'New', nameAr: 'جديد', sortOrder: 1, isActive: true },
  { id: 'qualified', flag: 'QUALIFIED', nameEn: 'Qualified', nameAr: 'مؤهل', sortOrder: 2, isActive: true },
];
function wireLead() {
  return {
    id: leadId, branchId, partyId: 'party', leadProfileType: 'CORPORATE', displayName: 'Acme', companyName: 'Acme',
    party: { legalName: 'Acme LLC', taxNumber: '123', commercialRegistrationNumber: '456' },
    ownerUserId: ownerId, owner: { userId: ownerId, firstName: 'Ali', lastName: 'Saleh' }, acquisitionSourceId: null,
    acquisitionSource: null, stageId: 'new', stageFlag: 'NEW', status: 'OPEN', rating: 1, cardColor: null,
    companyPhone: '+201000000000', companyEmail: 'office@example.com', companyWebsite: null,
    firstName: null, lastName: null, honorificTitle: null, phones: ['+201000000000'], email: null,
    primaryMobile: '+201000000000', primaryContact: null, contacts: [{ partyId: 'person', firstName: 'Ali', lastName: null, displayName: 'Ali', honorificTitle: null, jobTitle: null, isPrimary: true, phones: ['+201111111111'], email: null, relationshipId: null }], tags: [], nextActivity: null, address: null,
    description: null, interestSummary: null, expectedNeed: null, expectedValue: '100', currencyCode: 'EGP',
    customFields: { industry: 'Manufacturing', score: 0, subscribed: false, notes: null },
    createdAt: '2026-11-23T00:00:00.000Z', updatedAt: '2026-11-23T01:00:00.000Z',
  };
}
function capabilities(): LeadsCapabilities {
  const all = { scope: 'all' as const, ownerUserIds: null };
  return { branchId, leads: { create: all, update: all, delete: all, convert: all }, activities: { create: all },
    attachments: { create: all, delete: all }, notes: { create: null, delete: null }, opportunities: { create: null } };
}
class RecordHttp extends CrmHttpStub {
  lead = wireLead();
  caps = capabilities();
  failures = new Map<string, ApiError>();
  writeFailure: ApiError | undefined;
  constructor() {
    super({ '/lead-stages': stages, '/acquisition-sources': [], '/tags': [],
      '/assignable-owners': { items: [], nextCursor: null },
      '/custom-fields': [{ id: 'field', ownerType: 'LEAD', fieldKey: 'industry', type: 'TEXT', nameEn: 'Industry',
        nameAr: 'القطاع', placeholderEn: 'Industry', placeholderAr: 'القطاع', options: [], requirements: [], isActive: true, sortOrder: 0 }],
      '/leads/capabilities': {}, [`/leads/${leadId}`]: {},
    });
  }
  override async read<T>(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<T> {
    const value = await super.read<T>(path, query, options);
    const failure = this.failures.get(path);
    if (failure) throw failure;
    if (path === `/leads/${leadId}`) return structuredClone(this.lead) as T;
    if (path === '/leads/capabilities') return structuredClone(this.caps) as T;
    return value;
  }
  override async write<T>(method: CoreWriteMethod, path: string, body: unknown, options: CrmWriteOptions) {
    const result = await super.write<T>(method, path, body, options);
    if (this.writeFailure) throw this.writeFailure;
    if (path === '/related-records/counts') {
      return { ...result, data: { countsByRecordId: {} } as T };
    }
    if (path === `/leads/${leadId}/convert`) {
      this.lead = { ...this.lead, status: 'CONVERTED' };
      return { ...result, data: { lead: structuredClone(this.lead) } as T };
    }
    this.lead = { ...this.lead, ...body as object, updatedAt: '2026-11-23T02:00:00.000Z' };
    return { ...result, data: structuredClone(this.lead) as T };
  }
}
@Injectable()
class Loader implements TranslocoLoader {
  getTranslation(path: string) { return defer(() => Promise.resolve(translations[path] ?? {})); }
}
@Component({ template: '' })
class EmptyPage {}

type PageState = {
  detail(): LeadDetail | null; loading(): boolean; showSkeleton(): boolean; draft(): { customFields: Record<string, unknown> };
  canEdit(): boolean; canUpdateRecord(): boolean; canCreateActivity(): boolean; canUploadAttachments(): boolean;
  canDeleteAttachments(): boolean; canDelete(): boolean; loadFailed(): boolean;
  onRate(value: number): Promise<void>; onRecolor(value: 'GREEN' | null): Promise<void>; onMoveStage(id: string): Promise<void>;
  selectTab(tab: string): void; confirmDelete(): Promise<void>; onConflictChoice(choice: 'keep' | 'reload'): void;
  writes: { conflictOpen(): boolean }; updatedAt(): string; save(): Promise<boolean>; conflictOpen(): boolean;
};

describe.each([['en','light'], ['en','dark'], ['ar','light'], ['ar','dark']])('LeadPage %s / %s', (lang, theme) => {
  let http: RecordHttp;
  let dispose: () => void;
  let restoreRuntime: () => void;
  let harness: RouterTestingHarness;
  let permissions: string[];
  let attributes: (string | null)[];
  let storedLanguage: string | null;
  let selection: ReturnType<typeof signal<{ companyId: string; branchId: string | null }>>;
  const originalShowModal = HTMLDialogElement.prototype.showModal;
  const originalClose = HTMLDialogElement.prototype.close;

  beforeEach(() => {
    attributes = ['lang','dir','data-theme'].map((name) => document.documentElement.getAttribute(name));
    storedLanguage = localStorage.getItem('lang');
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    selection = signal({ companyId, branchId } as { companyId: string; branchId: string | null });
    permissions = ['crm.leads.read.all', 'crm.custom_fields.read'];
    bindAnalyticsPermissions(() => permissions);
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); queueMicrotask(() => this.dispatchEvent(new Event('close'))); };
    TestBed.configureTestingModule({ providers: [
      { provide: CoreHttp, useValue: { read: async () => [{ code: 'EGP', nameEn: 'Pound', nameAr: 'جنيه', isDefault: true, decimals: 2 }] } },
      { provide: AuthSession, useValue: { status: () => 'signed-out', me: () => null } },
      { provide: TenantScopeState, useValue: { selection, branchesFor: () => [branchId], branchCompanies: () => new Map([[branchId,companyId]]), me: () => null } },
      provideRouter([{ path: 'crm/leads/new', component: LeadPage }, { path: 'crm/leads/:id', component: LeadPage }, { path: 'crm/leads', component: EmptyPage }]),
      provideTransloco({ config: { availableLangs: ['en','ar'], defaultLang: lang, reRenderOnLangChange: true,
        missingHandler: { logMissingKey: false } }, loader: Loader }),
    ] });
    TestBed.inject(LanguageState).current.set(lang as 'en' | 'ar');
    TestBed.inject(TranslocoService).setActiveLang(lang);
    TestBed.inject(TranslocoService).setTranslation({ activities: lang === 'ar' ? ar_activities : en_activities }, lang, { merge: true });
    restoreRuntime = bindCrmInjectorForTest(() => TestBed.inject(Injector));
    http = new RecordHttp();
    dispose = bindCrmHttpForTest(http);
    crmQueries().clear();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    crmQueries().clear();
    dispose(); restoreRuntime(); bindAnalyticsPermissions(() => []);
    HTMLDialogElement.prototype.showModal = originalShowModal;
    HTMLDialogElement.prototype.close = originalClose;
    ['lang','dir','data-theme'].forEach((name,i) => attributes[i] === null
      ? document.documentElement.removeAttribute(name) : document.documentElement.setAttribute(name, attributes[i]!));
    vi.restoreAllMocks();
    if (storedLanguage === null) localStorage.removeItem('lang');
    else localStorage.setItem('lang', storedLanguage);
  });
  async function open(): Promise<PageState> {
    harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(`/crm/leads/${leadId}`, LeadPage);
    const page = component as unknown as PageState;
    await vi.waitFor(() => { harness.detectChanges(); expect(page.loading()).toBe(false); expect(page.showSkeleton()).toBe(false); });
    return page;
  }
  function node() { return harness.routeNativeElement!; }
  async function tab(page: PageState, name: string) {
    page.selectTab(name);
    await vi.waitFor(() => { harness.detectChanges(); expect(node().querySelector(`[role=tabpanel][id$="-${name}"]`)).not.toBeNull(); });
  }
  it('LeadPage › maps party fields by lead type', async () => {
    const corporate = await getLead(leadId); // A plain async call, without an injection-context wrapper.
    expect(corporate).toMatchObject({ legalName: 'Acme LLC', taxNumber: '123', commercialRegistrationNumber: '456', companyPhones: ['+201000000000'] });
    expect(corporate).not.toHaveProperty('existingCompany');
    expect(http.recordedReads()[0]).toEqual({ path: `/leads/${leadId}`, query: undefined, scope: undefined });
    http.lead.leadProfileType = 'INDIVIDUAL';
    expect((await getLead(leadId)).companyPhones).toEqual([]);
    const page = await open();
    expect(page.detail()?.id).toBe(leadId);
    expect(page.draft().customFields).toEqual(http.lead.customFields);
    expect(http.recordedReads().find((call) => call.path === '/leads/capabilities')).toMatchObject({ scope: { companyId, branchId }, query: { branchId } });
    expect(http.recordedReads().some((call) => call.path === '/custom-fields/values')).toBe(false);
  });
  it('LeadPage › custom fields from detail', async () => {
    permissions = ['crm.leads.read.all'];
    const page = await open();
    expect(page.detail()?.customFields).toEqual(http.lead.customFields);
    expect(page.draft().customFields).toEqual(http.lead.customFields);
    expect(http.recordedReads().filter((call) => call.path === `/leads/${leadId}`)).toEqual([
      { path: `/leads/${leadId}`, query: undefined, scope: undefined },
    ]);
    expect(http.recordedReads().some((call) => call.path === '/custom-fields/values')).toBe(false);
  });
  it('LeadForm › custom field highlight', async () => {
    const page = await open();
    const form = harness.fixture.debugElement.query(By.directive(LeadForm)).componentInstance as LeadForm;
    form.draft.update((draft) => ({ ...draft, description: 'Changed' }));
    await vi.waitFor(() => { harness.detectChanges(); expect(form.lookups.saveBlocked()).toBe(false); });
    for (const code of ['CUSTOM_FIELD_REQUIRED', 'CUSTOM_FIELD_VALUE_INVALID', 'CUSTOM_FIELD_INVALID']) {
      http.writeFailure = new ApiError(422, code, { fieldKey: ['industry'] });
      expect(await page.save()).toBe(false);
      harness.detectChanges();
      const input = node().querySelector<HTMLInputElement>('input[id$="-industry"]');
      expect(input?.getAttribute('aria-invalid')).toBe('true');
      expect(input?.getAttribute('aria-describedby')?.split(' ')).toEqual(expect.arrayContaining([
        `${input?.id}-hint`, `${input?.id}-error`,
      ]));
      const message = code === 'CUSTOM_FIELD_REQUIRED'
        ? (lang === 'ar' ? ar_record_fields : en_record_fields).errors.required
        : TestBed.inject(TranslocoService).translate(`leadForm.server.${code}`, { field: lang === 'ar' ? 'القطاع' : 'Industry' });
      expect(node().querySelector(`[id="${input?.id}-error"]`)?.textContent?.trim()).toBe(message);
      const field = harness.fixture.debugElement.queryAll(By.directive(Field))
        .find((entry) => entry.componentInstance.for().endsWith('-industry'));
      expect(field?.componentInstance.hint()).toBeTruthy();
      expect(form.draft().description).toBe('Changed');
    }
  });
  it('LeadPage › load states', async () => {
    http.failures.set(`/leads/${leadId}`, new ApiError(404, 'LEAD_NOT_FOUND'));
    await open();
    expect(harness.fixture.debugElement.query(By.directive(FullState)).componentInstance.kind()).toBe('not-found');
    http.failures.set(`/leads/${leadId}`, new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED'));
    const page = harness.routeDebugElement!.componentInstance as unknown as { retryLoad(): void; loading(): boolean };
    page.retryLoad();
    await vi.waitFor(() => { harness.detectChanges(); expect(page.loading()).toBe(false); });
    expect(harness.fixture.debugElement.query(By.directive(FullState)).componentInstance.kind()).toBe('forbidden');
    http.failures.set(`/leads/${leadId}`, new ApiError(503, 'UNAVAILABLE', undefined, { correlationId: 'crm-reference' }));
    page.retryLoad();
    await vi.waitFor(() => { harness.detectChanges(); expect(page.loading()).toBe(false); });
    expect(harness.fixture.debugElement.query(By.directive(FullState)).componentInstance.kind()).toBe('load-failure');
    expect(node().textContent).toContain('crm-reference');
  });
  it('LeadPage › edits in Wave B', async () => {
    const page = await open();
    expect(page.canEdit()).toBe(true);
    const form = harness.fixture.debugElement.query(By.directive(LeadForm)).componentInstance as LeadForm;
    expect(form.readonly()).toBe(false);
    form.draft.update((draft) => ({ ...draft, description: 'Changed' }));
    await vi.waitFor(() => { harness.detectChanges(); expect(node().textContent).toContain((lang === 'ar' ? ar_record_page : en_record_page).save); });
    const labels = [...node().querySelectorAll('app-record-page-header button')].map((button) => button.textContent?.trim());
    const dict = lang === 'ar' ? ar_record_page : en_record_page;
    expect(labels).toContain(dict.save);
    expect(form.readonly()).toBe(false);
    expect(http.recordedWrites().filter((call) => !['/related-records/counts', '/leads/duplicate-check'].includes(call.path))).toHaveLength(0);
    for (const field of harness.fixture.debugElement.queryAll(By.directive(Field))) {
      expect(field.componentInstance.hint(), field.componentInstance.label()).toBeTruthy();
    }
  });
  it('LeadModal › opens a real editable lead', async () => {
    const fixture = TestBed.createComponent(LeadModal);
    fixture.componentInstance.openLead(leadId, null);
    fixture.detectChanges();
    await vi.waitFor(() => { fixture.detectChanges(); expect(fixture.debugElement.query(By.directive(LeadForm))).not.toBeNull(); });
    const form = fixture.debugElement.query(By.directive(LeadForm)).componentInstance as LeadForm;
    expect(form.readonly()).toBe(false);
    expect(form.draft().companyName).toBe('Acme');
    expect(form.draft().customFields).toEqual(http.lead.customFields);
    await vi.waitFor(() => { fixture.detectChanges(); expect(fixture.debugElement.query(By.directive(RecordModalFrame)).componentInstance.canSave()).toBe(true); });
    expect(fixture.nativeElement.querySelector('app-record-modal-header app-lead-convert > button')?.disabled).toBe(false);
    expect(http.recordedReads().some((call) => call.path === `/leads/${leadId}`)).toBe(true);
    expect(http.recordedReads().filter((call) => call.path === `/leads/${leadId}`)).toHaveLength(1);
    expect(http.recordedReads().some((call) => call.path === '/custom-fields/values')).toBe(false);
    fixture.destroy();
  });
  it('projects Convert in the lead header and hides it after conversion', async () => {
    http.lead = { ...http.lead, stageId: 'qualified', stageFlag: 'QUALIFIED' };
    await open();
    const convertButton = () => node().querySelector<HTMLButtonElement>(
      'app-record-page-header app-lead-convert > button',
    );
    expect(convertButton()?.disabled).toBe(false);
    convertButton()!.click();
    harness.detectChanges();
    const confirm = node().querySelector<HTMLButtonElement>('app-lead-convert dialog[open] footer button');
    expect(confirm).not.toBeNull();
    confirm!.click();
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(http.recordedWrites()).toContainEqual(expect.objectContaining({
        method: 'POST',
        path: `/leads/${leadId}/convert`,
        body: { profileType: 'CORPORATE', keepLead: true },
      }));
      expect(convertButton()).toBeNull();
    });
  });
  it('LeadPage › list actions on the page', async () => {
    const page = await open();
    const token = page.updatedAt();
    await page.onRate(3);
    await page.onRecolor('GREEN');
    await page.onMoveStage('qualified');
    const pendingDelete = page.confirmDelete();
    harness.detectChanges();
    const confirm = [...node().querySelectorAll<HTMLButtonElement>('ui-confirm-dialog dialog[open] button')].find((button) => button.textContent?.trim() === (lang === 'ar' ? ar_record_page : en_record_page).deleteLabel);
    expect(confirm).toBeDefined(); confirm!.click();
    await pendingDelete;
    const calls = http.recordedWrites().filter((call) => !['/related-records/counts', '/leads/duplicate-check'].includes(call.path));
    expect(calls.map((call) => call.method)).toEqual(['PATCH','PATCH','POST','DELETE']);
    expect(calls[0].body).toEqual({ rating: 3, expectedUpdatedAt: token });
    expect(calls[1].body).toEqual({ cardColor: 'GREEN', expectedUpdatedAt: '2026-11-23T02:00:00.000Z' });
    expect(calls[2].body).toEqual({ stageId: 'qualified' });
    expect(calls.every((call) => !!call.options.key && call.options.scope === undefined)).toBe(true);
    expect(new Set(calls.map((call) => call.options.key)).size).toBe(4);
  });
  it('LeadPage › custom fields without access', async () => {
    http.failures.set('/custom-fields', new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED'));
    await open();
    await vi.waitFor(() => { harness.detectChanges(); expect(node().querySelector('#lf-custom input:disabled')).not.toBeNull(); });
    expect(http.recordedReads().some((call) => call.path === '/custom-fields/values')).toBe(false);
    const input = node().querySelector<HTMLInputElement>('#lf-custom input');
    expect(input?.disabled).toBe(true);
    expect(input?.value).toBe((lang === 'ar' ? ar_lead_page : en_lead_page).customFieldsDenied);
  });
  it('LeadPage › attachments tab uses the shared widget', async () => {
    const page = await open();
    await tab(page, 'attachments');
    const widget = harness.fixture.debugElement.query(By.directive(RecordAttachments)).componentInstance as RecordAttachments;
    expect(widget.sourceType()).toBe('LEAD'); expect(widget.sourceId()).toBe(leadId); expect(widget.branchId()).toBe(branchId);
    expect(widget.canUpload()).toBe(true); expect(widget.canDelete()).toBe(true);
  });
  it('LeadPage › converted is locked', async () => {
    http.lead.status = 'CONVERTED';
    const page = await open();
    expect(page.canEdit()).toBe(false); expect(page.canUpdateRecord()).toBe(false); expect(page.canDelete()).toBe(false);
    expect(page.canCreateActivity()).toBe(false); expect(page.canUploadAttachments()).toBe(false); expect(page.canDeleteAttachments()).toBe(false);
    await page.onRate(2); await page.onMoveStage('qualified');
    expect(http.recordedWrites().filter((call) => !['/related-records/counts', '/leads/duplicate-check'].includes(call.path))).toHaveLength(0);
    await tab(page,'activities');
    const activities = harness.fixture.debugElement.query(By.directive(RecordActivitiesTab)).componentInstance;
    expect(activities.canEdit()).toBe(false);
    expect(activities.targetType()).toBe('LEAD'); expect(activities.targetId()).toBe(leadId);
    await vi.waitFor(() => { harness.detectChanges(); expect(activities.loading()).toBe(false); });
  });
  it('gates own/team actions by the record owner', async () => {
    const restricted = { scope: 'team' as const, ownerUserIds: ['other'] };
    http.caps.leads.update = restricted; http.caps.leads.delete = restricted;
    http.caps.activities.create = restricted; http.caps.attachments.create = restricted;
    const page = await open();
    expect(page.canUpdateRecord()).toBe(false); expect(page.canDelete()).toBe(false);
    expect(page.canCreateActivity()).toBe(false); expect(page.canUploadAttachments()).toBe(false);
  });
  it('keeps the record visible without capabilities', async () => {
    http.failures.set('/leads/capabilities', new ApiError(503,'UNAVAILABLE'));
    const page = await open();
    expect(page.detail()?.id).toBe(leadId); expect(page.canUpdateRecord()).toBe(false);
    expect(page.canCreateActivity()).toBe(false); expect(page.canUploadAttachments()).toBe(false);
  });
  it('does not read a record without a session branch or module permission', async () => {
    selection.set({ companyId, branchId: null });
    await expect(getLead(leadId)).rejects.toMatchObject({ code: 'BRANCH_REQUIRED' });
    selection.set({ companyId, branchId }); permissions = [];
    await expect(getLead(leadId)).rejects.toMatchObject({ code: 'CRM_SCOPED_PERMISSION_DENIED' });
    expect(http.recordedReads()).toEqual([]);
  });
  it('a custom-field 403 does not turn the record into forbidden', async () => {
    http.failures.set('/custom-fields', new ApiError(403,'CRM_SCOPED_PERMISSION_DENIED'));
    const page = await open();
    expect(page.detail()?.id).toBe(leadId);
    expect(page.draft().customFields).toEqual(http.lead.customFields);
    expect(harness.fixture.debugElement.query(By.directive(FullState))).toBeNull();
  });
  it('does not resend a mismatch and reloads the record', async () => {
    const page = await open(); http.writeFailure = new ApiError(422,'GW.IDEM.MISMATCH');
    await page.onRate(3);
    expect(http.recordedWrites().filter((call) => !['/related-records/counts', '/leads/duplicate-check'].includes(call.path))).toHaveLength(1);
    await vi.waitFor(() => { harness.detectChanges(); expect(page.loading()).toBe(false); });
    expect(page.detail()?.rating).toBe(1);
  });
  it('a stale inline action opens conflict and keep reads a fresh token', async () => {
    const page = await open(); http.writeFailure = new ApiError(409,'CRM.LEAD.CONCURRENT_UPDATE');
    await page.onRate(3);
    expect(page.writes.conflictOpen()).toBe(true);
    http.lead.updatedAt = '2026-11-23T03:00:00.000Z';
    page.onConflictChoice('keep');
    await vi.waitFor(() => expect(page.writes.conflictOpen()).toBe(false));
    expect(page.detail()?.rating).toBe(3); expect(page.updatedAt()).toBe('2026-11-23T03:00:00.000Z');
    expect(http.recordedWrites().filter((call) => !['/related-records/counts', '/leads/duplicate-check'].includes(call.path))).toHaveLength(1);
  });
  it('keeps the modal helper backed by detail without scope headers', async () => {
    expect(await readLeadFieldValues(branchId,leadId)).toEqual(http.lead.customFields);
    expect(http.recordedReads().map((call) => call.path)).toEqual([`/leads/${leadId}`]);
    expect(http.recordedReads().every((call) => call.scope === undefined)).toBe(true);
  });
  it('enables creation from the page and quick modal in Wave B', async () => {
    harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/crm/leads/new', LeadPage);
    const page = component as unknown as PageState;
    await vi.waitFor(() => { harness.detectChanges(); expect(page.showSkeleton()).toBe(false); expect(page.canEdit()).toBe(true); });
    expect(node().querySelector('app-record-page-header')).not.toBeNull();
    const fixture = TestBed.createComponent(LeadModal);
    fixture.componentInstance.openCreate(); fixture.detectChanges();
    await vi.waitFor(() => { fixture.detectChanges(); expect(fixture.debugElement.query(By.directive(RecordModalFrame)).componentInstance.canSave()).toBe(true); });
    expect(fixture.debugElement.query(By.directive(RecordModalFrame)).componentInstance.open()).toBe(true);
    expect(fixture.debugElement.query(By.directive(LeadForm)).componentInstance.draft().branchId).toBe(branchId);
    fixture.destroy();
  });
  it('LeadPage › conflict', async () => {
    const page = await open();
    const form = harness.fixture.debugElement.query(By.directive(LeadForm)).componentInstance as LeadForm;
    form.draft.update((draft) => ({ ...draft, description: 'My edit' }));
    harness.detectChanges();
    http.writeFailure = new ApiError(409, 'CRM.LEAD.CONCURRENT_UPDATE');
    const pending = page.save();
    await vi.waitFor(() => { harness.detectChanges(); expect(page.conflictOpen()).toBe(true); });
    expect(node().querySelector('ui-conflict-dialog dialog[open]')).not.toBeNull();
    http.lead.updatedAt = '2026-11-23T03:00:00.000Z';
    http.writeFailure = undefined; page.onConflictChoice('keep');
    expect(await pending).toBe(false);
    harness.detectChanges();
    expect(form.draft().description).toBe('My edit'); expect(page.updatedAt()).toBe(http.lead.updatedAt);
    expect(http.recordedWrites().filter((call) => !['/related-records/counts', '/leads/duplicate-check'].includes(call.path)).filter((call) => call.method === 'PATCH')).toHaveLength(1);
  });
  it('reloads custom fields from fresh detail after a conflict', async () => {
    const page = await open();
    const form = harness.fixture.debugElement.query(By.directive(LeadForm)).componentInstance as LeadForm;
    form.draft.update((draft) => ({ ...draft, description: 'My edit' })); harness.detectChanges();
    http.writeFailure = new ApiError(409, 'CRM.LEAD.CONCURRENT_UPDATE');
    const pending = page.save();
    await vi.waitFor(() => { harness.detectChanges(); expect(page.conflictOpen()).toBe(true); });
    http.lead.customFields.industry = 'Updated on server';
    http.lead.updatedAt = '2026-11-23T03:00:00.000Z';
    http.writeFailure = undefined; page.onConflictChoice('reload');
    expect(await pending).toBe(false);
    expect(page.draft().customFields['industry']).toBe('Updated on server');
    expect(http.recordedReads().some((call) => call.path === '/custom-fields/values')).toBe(false);
  });
  it('keeps a create key for retry, changes it with the body, and blocks mismatch', async () => {
    harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/crm/leads/new', LeadPage);
    const page = component as unknown as PageState;
    await vi.waitFor(() => { harness.detectChanges(); expect(page.canEdit()).toBe(true); });
    const form = harness.fixture.debugElement.query(By.directive(LeadForm)).componentInstance as LeadForm;
    form.draft.update((draft) => ({ ...draft, firstName: 'Omar', phones: ['+201111111111'] }));
    await vi.waitFor(() => { harness.detectChanges(); expect(form.lookups.saveBlocked()).toBe(false); });
    http.writeFailure = new ApiError(503, 'UNAVAILABLE');
    expect(await page.save()).toBe(false); expect(await page.save()).toBe(false);
    const creates = () => http.recordedWrites().filter((call) => call.path === '/leads');
    expect(creates()).toHaveLength(2); expect(creates()[0].options.key).toBe(creates()[1].options.key);
    form.draft.update((draft) => ({ ...draft, firstName: 'Nora' })); harness.detectChanges();
    expect(await page.save()).toBe(false);
    expect(creates()[2].options.key).not.toBe(creates()[0].options.key);
    http.writeFailure = new ApiError(422, 'GW.IDEM.MISMATCH');
    expect(await page.save()).toBe(false); expect(page.canEdit()).toBe(false);
    const count = creates().length; expect(await page.save()).toBe(false); expect(creates()).toHaveLength(count);
    expect(form.draft().firstName).toBe('Nora');
  });
  it('reacts to losing and choosing the session branch', async () => {
    const page = await open();
    http.reset(); selection.set({ companyId, branchId: null });
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(node().querySelector('ui-full-state')?.textContent).toContain((lang === 'ar' ? ar_lead_page : en_lead_page).chooseBranch);
    });
    expect(http.recordedReads().filter((call) => call.path === `/leads/${leadId}`)).toHaveLength(0);
    selection.set({ companyId, branchId });
    await vi.waitFor(() => { harness.detectChanges(); expect(page.detail()?.id).toBe(leadId); expect(page.loading()).toBe(false); });
  });
  it('the modal keeps a real lead visible when capabilities fail', async () => {
    http.failures.set('/leads/capabilities', new ApiError(503,'UNAVAILABLE'));
    const fixture = TestBed.createComponent(LeadModal);
    fixture.componentInstance.openLead(leadId,null); fixture.detectChanges();
    await vi.waitFor(() => { fixture.detectChanges(); expect(fixture.debugElement.query(By.directive(LeadForm))).not.toBeNull(); });
    const form = fixture.debugElement.query(By.directive(LeadForm)).componentInstance as LeadForm;
    expect(form.draft().companyName).toBe('Acme'); expect(form.canUpdateRecord()).toBe(false);
    expect(fixture.debugElement.query(By.directive(RecordModalFrame)).componentInstance.canDelete()).toBe(false);
    fixture.destroy();
  });
  it('checks own scope against ownerUserId without an owner summary', async () => {
    http.lead.owner = null as unknown as typeof http.lead.owner;
    http.caps.leads.update = { scope: 'own', ownerUserIds: [ownerId] };
    http.caps.leads.delete = { scope: 'own', ownerUserIds: [ownerId] };
    const page = await open();
    expect(page.canUpdateRecord()).toBe(true); expect(page.canDelete()).toBe(true);
  });
});
