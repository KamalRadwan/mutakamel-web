import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import staffEn from '../../../../../../public/i18n/staff/en.json';
import companiesEn from '../../../../../../public/i18n/staff-companies/en.json';
import { AuthSession } from '../../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { Notify } from '../../../../core/notify/notify';
import { SeatCascadeConfirm } from '../../seats/cascade-confirm/cascade-confirm';
import { OrganizationReadApi } from '../shared/organization-read.api';
import type { Company } from '../shared/staff.model';
import { CompaniesPage } from './companies-page';

class EmptyLoader {
  getTranslation(lang: string) {
    if (lang.startsWith('staff-companies/')) return of(companiesEn);
    if (lang.startsWith('staff/')) return of(staffEn);
    return of({ staff: staffEn, companies: companiesEn, apiErrors: { generic: 'Something went wrong. Try again.' } });
  }
}

const companiesPath = '/api/tenant/core/v1/organization/companies';
const dialog = HTMLDialogElement.prototype;
const { showModal, close } = dialog;
const company: Company = {
  id: '019f0000-0000-7000-8000-000000000010',
  code: 'C',
  name: 'Core company',
  legalName: null,
  taxNumber: null,
  countryCode: 'EG',
  currencyCode: 'EGP',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
const tenantGrant = { tenantWide: true, companyIds: [], branchIds: [] };
const emptyMeta = { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false };

describe('Companies with Gateway reads and writes', () => {
  const me = signal<TenantMe>(FAKE_TENANT_ME);
  let http: HttpTestingController;
  const params = new BehaviorSubject(convertToParamMap({}));
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const confirm = vi.fn();
  const reloadProfile = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    params.next(convertToParamMap({}));
    reloadProfile.mockResolvedValue(undefined);
    dialog.showModal = function () { this.setAttribute('open', ''); };
    dialog.close = function () { this.removeAttribute('open'); };
    me.set({
      ...FAKE_TENANT_ME,
      permissions: ['org.company.read', 'org.company.manage'],
      permissionScopes: { 'org.company.read': tenantGrant, 'org.company.manage': tenantGrant },
      accessibleCompanies: [],
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: {
          queryParamMap: params.asObservable(),
          snapshot: { get queryParamMap() { return params.value; } },
        } },
        { provide: Notify, useValue: notify },
        { provide: SeatCascadeConfirm, useValue: { confirm } },
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
          loader: EmptyLoader,
        }),
        {
          provide: AuthSession,
          useValue: {
            me, status: signal('signed-in'), ensureLoaded: async () => 'signed-in',
            requestVersion: () => ({ generation: 1, revision: 0 }), reloadProfile,
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const doc = TestBed.inject(DOCUMENT);
    const csrfName = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${csrfName}=test-csrf`);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    http.verify();
    dialog.showModal = showModal;
    dialog.close = close;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function render() {
    const fixture = TestBed.createComponent(CompaniesPage);
    fixture.detectChanges();
    return fixture;
  }

  async function finish(fixture: ComponentFixture<CompaniesPage>) {
    await vi.advanceTimersByTimeAsync(2_000);
    fixture.detectChanges();
  }

  it('list renders Core rows and totals and fetches details for the selected ID', async () => {
    const fixture = render();
    const page = fixture.componentInstance;
    const list = http.expectOne((req) => req.method === 'GET' && req.url === companiesPath);
    expect(list.request.params.get('page')).toBe('1');
    expect(list.request.params.get('limit')).toBe('20');
    list.flush({
      success: true, data: [company], meta: { ...emptyMeta, total: 21, totalPages: 2, hasNext: true },
    });
    await finish(fixture);
    expect(page['rows']()).toEqual([company]);
    expect(page['total']()).toBe(21);
    expect(page['actionsFor'](company).map((action) => action.id)).toEqual(['open', 'edit', 'toggleStatus', 'delete']);
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('app-staff-list > footer ui-pagination')).not.toBeNull();
    page['onPageSizeChange'](100);
    fixture.detectChanges();
    const paged = http.expectOne((req) => req.method === 'GET' && req.url === companiesPath);
    expect(paged.request.params.get('limit')).toBe('100');
    paged.flush({ success: true, data: [company], meta: { ...emptyMeta, limit: 100, total: 21, totalPages: 1 } });
    await finish(fixture);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { page: 1, size: 100 } }));
    page['onPageChange'](2);
    fixture.detectChanges();
    const secondPage = http.expectOne((req) => req.url === companiesPath);
    expect(secondPage.request.params.get('page')).toBe('2');
    expect(Number(secondPage.request.params.get('limit'))).toBeLessThanOrEqual(100);
    secondPage.flush({ success: true, data: [], meta: { ...emptyMeta, page: 2, limit: 100 } });
    await finish(fixture);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { page: 2, size: 100 } }));
    const modal = page['companyModal']();
    const open = vi.spyOn(modal, 'openEdit');
    page['openEdit'](company);
    const detail = { ...company, legalName: 'Current legal name' };
    http.expectOne({ method: 'GET', url: companiesPath + '/' + company.id })
      .flush({ success: true, data: detail });
    await finish(fixture);
    expect(open).toHaveBeenCalledWith(detail);
    expect(modal.canManage()).toBe(true);
  });

  it('shows an empty list separately from a denied list request', async () => {
    const fixture = render();
    const page = fixture.componentInstance;
    http.expectOne((req) => req.url === companiesPath).flush({ success: true, data: [], meta: emptyMeta });
    await finish(fixture);
    expect(page['rows']()).toEqual([]);
    expect(page['loadFailed']()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(companiesEn.empty);
    page['filterValues'].set({ status: 'ACTIVE' });
    fixture.detectChanges();
    http.expectOne((req) => req.url === companiesPath).flush({ success: true, data: [], meta: emptyMeta });
    await finish(fixture);
    expect(fixture.nativeElement.textContent).toContain(companiesEn.noResults);
    expect(fixture.nativeElement.textContent).toContain(staffEn.list.clearAll);
    page['reload']();
    http.expectOne((req) => req.url === companiesPath)
      .flush({ code: 'GW.AUTH.FORBIDDEN' }, { status: 403, statusText: 'Forbidden' });
    await finish(fixture);
    expect(page['total']()).toBe(0);
    expect(page['loadForbidden']()).toBe(true);
  });

  it('opens Add Company and retries the unchanged form with the same real write key', async () => {
    const doc = TestBed.inject(DOCUMENT);
    const csrfName = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${csrfName}=test-csrf`);
    const fixture = render();
    const page = fixture.componentInstance;
    http.expectOne((req) => req.method === 'GET' && req.url === companiesPath)
      .flush({ success: true, data: [], meta: emptyMeta });
    await finish(fixture);

    expect(page['canCreate']()).toBe(true);
    page['openCreate']();
    const modal = page['companyModal']();
    modal['code'].set(company.code);
    modal['name'].set(company.name);
    const first = modal['save']();
    const write = http.expectOne({ method: 'POST', url: companiesPath });
    expect(write.request.body).toEqual({ code: company.code, name: company.name });
    write.flush({ code: 'GW.UPSTREAM.UNAVAILABLE' }, { status: 503, statusText: 'Unavailable' });
    await first;

    const retry = modal['save']();
    const retriedWrite = http.expectOne({ method: 'POST', url: companiesPath });
    expect(retriedWrite.request.headers.get('x-idempotency-key')).toBe(write.request.headers.get('x-idempotency-key'));
    retriedWrite.flush({ success: true, data: company }, { status: 201, statusText: 'Created' });
    await retry;
    http.expectOne((req) => req.method === 'GET' && req.url === companiesPath)
      .flush({ success: true, data: [company], meta: { ...emptyMeta, total: 1, totalPages: 1 } });
    await finish(fixture);
    expect(page['rows']()).toEqual([company]);
  });

  function flushList(rows: Company[] = [company]) {
    http.expectOne((req) => req.method === 'GET' && req.url === companiesPath).flush({
      success: true, data: rows, meta: { ...emptyMeta, total: rows.length, totalPages: rows.length ? 1 : 0 },
    });
  }

  async function loaded() {
    const fixture = render();
    flushList();
    await finish(fixture);
    return { fixture, page: fixture.componentInstance };
  }

  async function settle(fixture: ComponentFixture<CompaniesPage>) {
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  }

  async function beginStatus(page: CompaniesPage, record = company) {
    const pending = page['requestToggleStatus'](record);
    page['settleStatusConfirm'](true);
    await Promise.resolve();
    return { pending };
  }

  async function beginDelete(page: CompaniesPage, record = company) {
    vi.spyOn(page['deleteConfirm'](), 'open').mockResolvedValue(true);
    const pending = page['requestDelete'](record);
    await Promise.resolve();
    return { pending };
  }

  function write(method: 'PATCH' | 'DELETE') {
    return http.expectOne({ method, url: `${companiesPath}/${company.id}` });
  }

  it('list 5xx shows load failure with retry', async () => {
    const fixture = render();
    http.expectOne((req) => req.url === companiesPath).flush({ errorCode: 'COMMON.GENERIC.INTERNAL_ERROR' },
      { status: 503, statusText: 'Unavailable' });
    await finish(fixture);
    expect(fixture.componentInstance['loadFailed']()).toBe(true);
    expect(fixture.componentInstance['loadForbidden']()).toBe(false);
    const retry = [...fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>]
      .find((button) => button.textContent?.trim() === companiesEn.retry);
    expect(retry).toBeDefined();
    retry!.click();
    flushList();
    await finish(fixture);
    expect(fixture.componentInstance['rows']()).toEqual([company]);
  });

  it('open out-of-scope company shows toast and no modal', async () => {
    const { fixture, page } = await loaded();
    const open = vi.spyOn(page['companyModal'](), 'openEdit');
    page['openEdit'](company);
    http.expectOne(`${companiesPath}/${company.id}`).flush({ errorCode: 'COMPANY_PERMISSION_DENIED' },
      { status: 403, statusText: 'Forbidden' });
    await finish(fixture);
    expect(open).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith(staffEn.errors.COMPANY_PERMISSION_DENIED);
  });

  it('deep link to a deleted company shows no-longer-available', async () => {
    params.next(convertToParamMap({ open: company.id }));
    const fixture = render();
    const page = fixture.componentInstance;
    const open = vi.spyOn(page['companyModal'](), 'openEdit');
    flushList();
    http.expectOne(`${companiesPath}/${company.id}`).flush({ errorCode: 'ORG_NODE_NOT_FOUND' },
      { status: 404, statusText: 'Not Found' });
    await finish(fixture);
    expect(notify.error).toHaveBeenCalledWith(staffEn.errors.ORG_NODE_NOT_FOUND);
    expect(open).not.toHaveBeenCalled();
    expect(page['rows']()).toEqual([company]);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { open: null, new: null }, replaceUrl: true,
    }));
  });

  it('list restores page and size from the URL and caps the allowed sizes', async () => {
    params.next(convertToParamMap({ page: '3', size: '50' }));
    const fixture = render();
    const req = http.expectOne((req) => req.url === companiesPath);
    expect(req.request.params.get('page')).toBe('3');
    expect(req.request.params.get('limit')).toBe('50');
    req.flush({ success: true, data: [], meta: { ...emptyMeta, page: 3, limit: 50 } });
    await finish(fixture);
    fixture.componentInstance['onPageSizeChange'](200);
    http.expectNone((req) => req.url === companiesPath);
    expect(fixture.componentInstance['pageSize']()).toBe(50);
  });

  it('update sends changed keys and refreshes', async () => {
    const { fixture, page } = await loaded();
    const invalidated = vi.spyOn(TestBed.inject(OrganizationReadApi), 'invalidateScope');
    const modal = page['companyModal']();
    modal.openEdit({ ...company, legalName: 'Old legal name', taxNumber: 'Old tax' });
    modal['name'].set('Renamed');
    modal['legalName'].set('');
    modal['taxNumber'].set('');
    modal['currencyCode'].set('USD');
    const close = vi.spyOn(modal, 'closeImmediate');
    const pending = modal['save']();
    const req = write('PATCH');
    expect(req.request.body).toEqual({ name: 'Renamed', legalName: null, taxNumber: null, currencyCode: 'USD' });
    const updated = { ...company, name: 'Renamed', currencyCode: 'USD' };
    req.flush({ success: true, data: updated });
    await pending;
    expect(notify.success).toHaveBeenCalledWith(companiesEn.toast.saved);
    expect(close).toHaveBeenCalledOnce();
    expect(invalidated).toHaveBeenCalledOnce();
    flushList([updated]);
    await finish(fixture);
    expect(page['rows']()).toEqual([updated]);
  });

  it('update of a deleted company closes and refreshes', async () => {
    const { fixture, page } = await loaded();
    const modal = page['companyModal']();
    modal.openEdit(company);
    modal['name'].set('Renamed');
    const close = vi.spyOn(modal, 'closeImmediate');
    const pending = modal['save']();
    write('PATCH').flush({ errorCode: 'ORG_NODE_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await pending;
    expect(close).toHaveBeenCalledOnce();
    expect(notify.error).toHaveBeenCalledWith(staffEn.errors.ORG_NODE_NOT_FOUND);
    flushList([]);
    await finish(fixture);
    expect(page['rows']()).toEqual([]);
  });

  it('toggle status updates and reloads profile', async () => {
    const { fixture, page } = await loaded();
    page['companyModal']().openEdit(company);
    const sync = vi.spyOn(page['companyModal'](), 'syncCompany');
    const { pending } = await beginStatus(page);
    const req = write('PATCH');
    expect(req.request.body).toEqual({ status: 'INACTIVE' });
    expect(req.request.headers.get('x-csrf-token')).toBe('test-csrf');
    expect(req.request.headers.get('x-idempotency-key')).toMatch(/^[0-9a-f-]{14}7[0-9a-f-]{21}$/);
    const updated: Company = { ...company, status: 'INACTIVE' };
    req.flush({ success: true, data: updated });
    await pending;
    expect(sync).toHaveBeenCalledWith(updated);
    expect(notify.success).toHaveBeenCalledWith(companiesEn.toast.saved);
    expect(reloadProfile).toHaveBeenCalledOnce();
    flushList([updated]);
    await finish(fixture);
    expect(page['rows']()).toEqual([updated]);
  });

  it('deactivate blocked shows one blocker with link', async () => {
    const { fixture, page } = await loaded();
    const { pending } = await beginStatus(page);
    write('PATCH').flush({ errorCode: 'ORG_NODE_NOT_EMPTY', details: { blockers: ['company has active branches'] } },
      { status: 409, statusText: 'Conflict' });
    await pending;
    await settle(fixture);
    const rows = page['blockersDialog']()['rows']();
    expect(rows).toHaveLength(1);
    expect(rows[0].link).toEqual({ label: companiesEn.actions.viewBranches,
      route: ['/workspace/staff/branches'], queryParams: { companyId: company.id } });
    expect(fixture.nativeElement.textContent).toContain(staffEn.blockers.introOne);
  });

  const cascadeDetails = {
    userIds: ['u1', 'u2'], userNames: ['Mona', 'Ali'],
    addonKeys: ['crm', 'trade'], addonNames: ['CRM', 'Trade'],
  };

  it.each(['status', 'delete'] as const)('%s cascade confirm resends with new key', async (action) => {
    const { fixture, page } = await loaded();
    confirm.mockResolvedValue(true);
    const { pending } = action === 'status' ? await beginStatus(page) : await beginDelete(page);
    const req = write(action === 'status' ? 'PATCH' : 'DELETE');
    req.flush({ errorCode: 'SEAT_ADDON_CASCADE_REQUIRED', details: cascadeDetails },
      { status: 409, statusText: 'Conflict' });
    await settle(fixture);
    expect(confirm).toHaveBeenCalledWith([
      { userId: 'u1', userName: 'Mona', addonKey: 'crm', addonName: 'CRM' },
      { userId: 'u2', userName: 'Ali', addonKey: 'trade', addonName: 'Trade' },
    ]);
    const confirmed = http.expectOne(`${companiesPath}/${company.id}?confirmAddonCascade=true`);
    expect(confirmed.request.headers.get('x-idempotency-key')).not.toBe(req.request.headers.get('x-idempotency-key'));
    expect(confirmed.request.body).toEqual(req.request.body);
    if (action === 'status') confirmed.flush({ success: true, data: { ...company, status: 'INACTIVE' } });
    else confirmed.flush(null, { status: 204, statusText: 'No Content' });
    await pending;
    flushList(action === 'delete' ? [] : [{ ...company, status: 'INACTIVE' }]);
    await finish(fixture);
    expect(page['busyIds']().size).toBe(0);
    expect(reloadProfile).toHaveBeenCalledOnce();
  });

  it('status cascade cancel sends nothing', async () => {
    const { fixture, page } = await loaded();
    confirm.mockResolvedValue(false);
    const { pending } = await beginStatus(page);
    write('PATCH').flush({ errorCode: 'SEAT_ADDON_CASCADE_REQUIRED', details: cascadeDetails },
      { status: 409, statusText: 'Conflict' });
    await pending;
    await settle(fixture);
    http.expectNone((req) => req.method === 'PATCH');
    expect(page['rows']()).toEqual([company]);
    expect(page['busyIds']().size).toBe(0);
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('activate with disabled currency shows currency toast', async () => {
    const { fixture, page } = await loaded();
    const { pending } = await beginStatus(page, { ...company, status: 'INACTIVE' });
    write('PATCH').flush({ errorCode: 'CURRENCY_NOT_ENABLED' }, { status: 422, statusText: 'Unprocessable' });
    await pending;
    await settle(fixture);
    expect(notify.error).toHaveBeenCalledWith(companiesEn.errors.currencyNotEnabledActivate);
  });

  it.each([401, 503])('status retry reuses the held key after %s', async (status) => {
    const { fixture, page } = await loaded();
    const first = await beginStatus(page);
    const req = write('PATCH');
    req.flush({ code: status === 401 ? 'GW.AUTH.SESSION_REVOKED' : 'COMMON.GENERIC.INTERNAL_ERROR' },
      { status, statusText: 'Failed' });
    await first.pending;
    expect(notify.error).toHaveBeenCalled();
    if (status === 401) expect(notify.error).toHaveBeenCalledWith(staffEn.errors.notSaved);
    const retry = await beginStatus(page);
    const retried = write('PATCH');
    expect(retried.request.headers.get('x-idempotency-key')).toBe(req.request.headers.get('x-idempotency-key'));
    expect(retried.request.body).toEqual(req.request.body);
    retried.flush({ success: true, data: { ...company, status: 'INACTIVE' } });
    await retry.pending;
    flushList();
    await finish(fixture);
  });

  it('delete removes company and reloads profile', async () => {
    const { fixture, page } = await loaded();
    page['companyModal']().openEdit(company);
    const close = vi.spyOn(page['companyModal'](), 'closeImmediate');
    const { pending } = await beginDelete(page);
    const req = write('DELETE');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('x-csrf-token')).toBe('test-csrf');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await pending;
    expect(close).toHaveBeenCalledOnce();
    expect(reloadProfile).toHaveBeenCalledOnce();
    expect(notify.success).toHaveBeenCalledWith(companiesEn.toast.deleted);
    flushList([]);
    await finish(fixture);
    expect(page['rows']()).toEqual([]);
  });

  it('delete blocked by taxes links to taxes', async () => {
    const { fixture, page } = await loaded();
    const { pending } = await beginDelete(page);
    write('DELETE').flush({ errorCode: 'ORG_NODE_NOT_EMPTY', details: { blockers: ['company has active taxes'] } },
      { status: 409, statusText: 'Conflict' });
    await pending;
    await settle(fixture);
    const blockers = page['blockersDialog']();
    const rows = blockers['rows']();
    expect(rows).toHaveLength(1);
    expect(rows[0].link).toEqual({ label: companiesEn.actions.viewTaxes, route: ['/workspace/settings/taxes'] });
    blockers['openLink'](rows[0].link!);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/workspace/settings/taxes'], {});
  });

  it.each([404, 403, 503])('delete errors show toast for %s', async (status) => {
    const { fixture, page } = await loaded();
    page['companyModal']().openEdit(company);
    const close = vi.spyOn(page['companyModal'](), 'closeImmediate');
    const { pending } = await beginDelete(page);
    write('DELETE').flush({ errorCode: status === 404 ? 'ORG_NODE_NOT_FOUND' :
      status === 403 ? 'TENANT_WIDE_PERMISSION_REQUIRED' : 'COMMON.GENERIC.INTERNAL_ERROR' },
    { status, statusText: 'Failed' });
    await pending;
    expect(notify.error).toHaveBeenCalled();
    if (status === 404) {
      expect(close).toHaveBeenCalledOnce();
      flushList([]);
    } else {
      expect(close).not.toHaveBeenCalled();
      http.expectNone((req) => req.url === companiesPath);
    }
    await finish(fixture);
    expect(page['busyIds']().size).toBe(0);
  });

  it('delete retry reuses its held key and success starts a new action', async () => {
    const { fixture, page } = await loaded();
    const first = await beginDelete(page);
    const failed = write('DELETE');
    failed.flush({ errorCode: 'COMMON.GENERIC.INTERNAL_ERROR' }, { status: 503, statusText: 'Unavailable' });
    await first.pending;
    const retry = await beginDelete(page);
    const retried = write('DELETE');
    expect(retried.request.headers.get('x-idempotency-key')).toBe(failed.request.headers.get('x-idempotency-key'));
    retried.flush(null, { status: 204, statusText: 'No Content' });
    await retry.pending;
    flushList();
    await finish(fixture);
    const next = await beginDelete(page);
    const req = write('DELETE');
    expect(req.request.headers.get('x-idempotency-key')).not.toBe(retried.request.headers.get('x-idempotency-key'));
    req.flush(null, { status: 204, statusText: 'No Content' });
    await next.pending;
    flushList([]);
    await finish(fixture);
  });

  it('company-scoped manager gets read-only view', async () => {
    me.update((value) => ({ ...value, permissions: [...value.permissions, 'users.user.read'],
      permissionScopes: { ...value.permissionScopes,
        'org.company.manage': { tenantWide: false, companyIds: [company.id], branchIds: [] },
        'users.user.read': tenantGrant }, accessibleCompanies: [company.id] }));
    const { fixture, page } = await loaded();
    expect(page['canManage']()).toBe(false);
    expect(page['canCreate']()).toBe(false);
    expect(page['actionsFor'](company).map((action) => action.id)).toEqual(['open', 'viewUsers']);
    page['openEdit'](company);
    http.expectOne(`${companiesPath}/${company.id}`).flush({ success: true, data: company });
    await finish(fixture);
    const modal = page['companyModal']();
    expect(modal.canManage()).toBe(false);
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('app-company-modal button[type=submit]')).toBeNull();
    expect([...element.querySelectorAll<HTMLInputElement>('app-company-modal input')].every((input) => input.readOnly)).toBe(true);
    await modal['save']();
    await page['requestDelete'](company);
    await page['requestToggleStatus'](company);
    http.expectNone((req) => req.method !== 'GET');
  });
});

