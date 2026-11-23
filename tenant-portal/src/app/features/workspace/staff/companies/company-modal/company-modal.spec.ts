import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { vi } from 'vitest';
import staffEn from '../../../../../../../public/i18n/staff/en.json';
import companiesEn from '../../../../../../../public/i18n/staff-companies/en.json';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../../../core/auth/auth-session.fake';
import { Notify } from '../../../../../core/notify/notify';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { OrganizationReadApi } from '../../shared/organization-read.api';
import type { Company } from '../../shared/staff.model';
import { CompanyModal } from './company-modal';

class Loader {
  getTranslation(lang: string) {
    if (lang.startsWith('staff-companies/')) return of(companiesEn);
    if (lang.startsWith('staff/')) return of(staffEn);
    return of({ staff: staffEn, companies: companiesEn, apiErrors: { generic: 'Something went wrong. Try again.' } });
  }
}

const path = '/api/tenant/core/v1/organization/companies';
const dialog = HTMLDialogElement.prototype;
const { showModal, close } = dialog;
const company: Company = {
  id: '019f0000-0000-7000-8000-000000000010', code: 'C', name: 'Core company',
  legalName: null, taxNumber: null, countryCode: 'EG', currencyCode: 'EGP', status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};
const grant = { tenantWide: true, companyIds: [], branchIds: [] };
const cascadeDetails = {
  userIds: ['u1', 'u2'], userNames: ['Mona', 'Ali'],
  addonKeys: ['crm', 'trade'], addonNames: ['CRM', 'Trade'],
};
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Company modal Gateway writes', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<CompanyModal>;
  let modal: CompanyModal;
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const confirm = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    dialog.showModal = function () { this.setAttribute('open', ''); };
    dialog.close = function () { this.removeAttribute('open'); };
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      provideTransloco({
        config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: Loader,
      }),
      { provide: AuthSession, useValue: {
        me: signal({ ...FAKE_TENANT_ME, permissions: ['org.company.read', 'org.company.manage'],
          permissionScopes: { 'org.company.read': grant, 'org.company.manage': grant } }),
        status: signal('signed-in'), ensureLoaded: async () => 'signed-in',
        requestVersion: () => ({ generation: 1, revision: 0 }), reloadProfile: vi.fn().mockResolvedValue(undefined),
      } },
      { provide: Notify, useValue: notify },
      { provide: SeatCascadeConfirm, useValue: { confirm } },
    ] });
    const doc = TestBed.inject(DOCUMENT);
    const cookieName = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${cookieName}=test-csrf`);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CompanyModal);
    fixture.componentRef.setInput('canManage', true);
    fixture.componentRef.setInput('canCreate', true);
    fixture.componentRef.setInput('currencies', [{ code: 'EGP', name: 'Egyptian pound', status: 'ACTIVE', isDefault: true }]);
    fixture.detectChanges();
    modal = fixture.componentInstance;
    modal.openEdit(company);
    modal['name'].set('Renamed');
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
    dialog.showModal = showModal;
    dialog.close = close;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function request() {
    return http.expectOne({ method: 'PATCH', url: `${path}/${company.id}` });
  }

  async function settle() {
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  }

  function fail(status: number, code: string, details?: Record<string, unknown>) {
    const req = request();
    req.flush({ errorCode: code, details }, { status, statusText: 'Failed' });
    return req;
  }

  it('update retry after 5xx reuses key and body', async () => {
    const invalidated = vi.spyOn(TestBed.inject(OrganizationReadApi), 'invalidateScope');
    const saved = vi.fn();
    modal.saved.subscribe(saved);
    const first = modal['save']();
    const req = fail(503, 'COMMON.GENERIC.INTERNAL_ERROR');
    expect(req.request.headers.get('x-idempotency-key')).toMatch(uuidV7);
    expect(req.request.headers.get('x-csrf-token')).toBe('test-csrf');
    expect(req.request.withCredentials).toBe(true);
    await first;
    expect(modal['dirty']()).toBe(true);
    expect(notify.error).toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    const retry = modal['save']();
    const retried = request();
    expect(retried.request.body).toEqual(req.request.body);
    expect(retried.request.headers.get('x-idempotency-key')).toBe(req.request.headers.get('x-idempotency-key'));
    retried.flush({ success: true, data: { ...company, name: 'Renamed' } });
    await retry;
    expect(saved).toHaveBeenCalledWith({ company: { ...company, name: 'Renamed' }, isNew: false });
    expect(invalidated).toHaveBeenCalledOnce();
    expect(notify.success).toHaveBeenCalledWith(companiesEn.toast.saved);
  });

  it('update without CSRF cookie sends nothing', async () => {
    vi.spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get').mockReturnValue('');
    await modal['save']();
    http.expectNone((req) => req.method === 'PATCH');
    expect(notify.error).toHaveBeenCalled();
    expect(modal['dirty']()).toBe(true);
    expect(modal['saving']()).toBe(false);
  });

  it('update validation errors show under fields', async () => {
    const pending = modal['save']();
    fail(400, 'CORE_VALIDATION_FAILED', {
      name: ['Invalid name'], legalName: ['Invalid legal name'], taxNumber: ['Invalid tax'],
      currencyCode: ['Invalid currency'], _: ['Check these values'],
    });
    await pending;
    await settle();
    expect(modal['nameError']()).toBe('Invalid name');
    expect(modal['legalNameError']()).toBe('Invalid legal name');
    expect(modal['taxError']()).toBe('Invalid tax');
    expect(modal['currencyError']()).toBe('Invalid currency');
    for (const text of ['Invalid name', 'Invalid legal name', 'Invalid tax', 'Invalid currency']) {
      expect(fixture.nativeElement.textContent).toContain(text);
    }
    expect(notify.error).toHaveBeenCalledWith(staffEn.errors.CORE_VALIDATION_FAILED);
    modal['onNameInput']({ target: { value: 'Fixed' } } as unknown as Event);
    expect(modal['nameError']()).toBeNull();
  });

  it('update field-only validation does not show a second toast', async () => {
    const pending = modal['save']();
    fail(400, 'CORE_VALIDATION_FAILED', { name: ['Invalid name'] });
    await pending;
    expect(modal['nameError']()).toBe('Invalid name');
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('update idempotency bad value shows generic error', async () => {
    const pending = modal['save']();
    fail(400, 'GW.IDEM.BAD_VALUE');
    await pending;
    expect(notify.error).toHaveBeenCalledWith(staffEn.errors.generic);
  });

  it('update 401 keeps form and key without navigation', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate');
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl');
    const first = modal['save']();
    const req = fail(401, 'GW.AUTH.SESSION_REVOKED');
    await first;
    await settle();
    expect(notify.error).toHaveBeenCalledWith(staffEn.errors.notSaved);
    expect(modal['name']()).toBe('Renamed');
    expect(modal['dirty']()).toBe(true);
    expect(fixture.nativeElement.querySelector('dialog').open).toBe(true);
    expect(modal['saving']()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
    http.expectNone((request) => request.method === 'PATCH');
    const retry = modal['save']();
    const retried = request();
    expect(retried.request.headers.get('x-idempotency-key')).toBe(req.request.headers.get('x-idempotency-key'));
    expect(retried.request.body).toEqual(req.request.body);
    retried.flush({ success: true, data: { ...company, name: 'Renamed' } });
    await retry;
  });

  it('update without tenant-wide grant shows permission toast', async () => {
    const pending = modal['save']();
    fail(403, 'TENANT_WIDE_PERMISSION_REQUIRED');
    await pending;
    expect(notify.error).toHaveBeenCalledWith(staffEn.errors.TENANT_WIDE_PERMISSION_REQUIRED);
    expect(modal['dirty']()).toBe(true);
  });

  it('update in flight shows info and blocks resend', async () => {
    const pending = modal['save']();
    await modal['save']();
    const requests = http.match((req) => req.method === 'PATCH');
    expect(requests).toHaveLength(1);
    await settle();
    expect(fixture.nativeElement.querySelector('button[type=submit]').disabled).toBe(true);
    requests[0].flush({ code: 'GW.IDEM.IN_FLIGHT' }, { status: 409, statusText: 'Conflict' });
    await pending;
    expect(notify.info).toHaveBeenCalledWith(staffEn.errors.GW.IDEM.IN_FLIGHT);
    expect(modal['saving']()).toBe(false);
  });

  it('update idempotency mismatch shows warning', async () => {
    const pending = modal['save']();
    fail(422, 'GW.IDEM.MISMATCH');
    await pending;
    expect(notify.warning).toHaveBeenCalledWith(staffEn.errors.GW.IDEM.MISMATCH);
    expect(modal['dirty']()).toBe(true);
  });

  it.each(['update', 'create', 'activate'] as const)('%s disabled currency shows currency field error', async (mode) => {
    if (mode === 'create') {
      modal.openCreate();
      modal['code'].set('NEW');
      modal['name'].set('New company');
      modal['currencyCode'].set('EGP');
    } else if (mode === 'activate') {
      modal.openEdit({ ...company, status: 'INACTIVE' });
      modal['isActive'].set(true);
    }
    const pending = modal['save']();
    const req = http.expectOne({ method: mode === 'create' ? 'POST' : 'PATCH',
      url: mode === 'create' ? path : `${path}/${company.id}` });
    req.flush({ errorCode: 'CURRENCY_NOT_ENABLED' }, { status: 422, statusText: 'Unprocessable' });
    await pending;
    await settle();
    expect(modal['currencyError']()).toBe(staffEn.errors.CURRENCY_NOT_ENABLED);
    expect(fixture.nativeElement.textContent).toContain(staffEn.errors.CURRENCY_NOT_ENABLED);
    expect(notify.error).not.toHaveBeenCalled();
    expect(modal['dirty']()).toBe(true);
  });

  it('update offline keeps form and key', async () => {
    const first = modal['save']();
    const req = request();
    req.error(new ProgressEvent('error'));
    await first;
    await settle();
    expect(modal['name']()).toBe('Renamed');
    expect(modal['dirty']()).toBe(true);
    expect(fixture.nativeElement.querySelector('button[type=submit]').disabled).toBe(false);
    expect(notify.error).not.toHaveBeenCalled();
    const retry = modal['save']();
    const retried = request();
    expect(retried.request.headers.get('x-idempotency-key')).toBe(req.request.headers.get('x-idempotency-key'));
    expect(retried.request.body).toEqual(req.request.body);
    retried.flush({ success: true, data: { ...company, name: 'Renamed' } });
    await retry;
  });

  it('edit cannot clear the company currency', async () => {
    expect(modal['currencyOptions']().map((option) => option.value)).not.toContain('');
    modal['onCurrencyChange']('');
    expect(modal['currencyCode']()).toBe('EGP');
    modal['currencyCode'].set('');
    const pending = modal['save']();
    const req = request();
    expect(req.request.body).toEqual({ name: 'Renamed' });
    req.flush({ success: true, data: { ...company, name: 'Renamed' } });
    await pending;
    modal.openCreate();
    expect(modal['currencyOptions']().map((option) => option.value)).toContain('');
    modal.openEdit({ ...company, currencyCode: null });
    expect(modal['currencyOptions']().map((option) => option.value)).toContain('');
  });

  it('changed body and a completed action each get a new key', async () => {
    const first = modal['save']();
    const failed = fail(503, 'COMMON.GENERIC.INTERNAL_ERROR');
    await first;
    modal['name'].set('Another name');
    const second = modal['save']();
    const changed = request();
    expect(changed.request.headers.get('x-idempotency-key')).not.toBe(failed.request.headers.get('x-idempotency-key'));
    changed.flush({ success: true, data: { ...company, name: 'Another name' } });
    await second;
    modal.openEdit(company);
    modal['name'].set('Another name');
    const third = modal['save']();
    const next = request();
    expect(next.request.headers.get('x-idempotency-key')).not.toBe(changed.request.headers.get('x-idempotency-key'));
    next.flush({ success: true, data: { ...company, name: 'Another name' } });
    await third;
  });

  it('deactivate blocked restores Active and emits one blocker', async () => {
    const blocked = vi.fn();
    modal.deactivateBlocked.subscribe(blocked);
    modal['isActive'].set(false);
    const pending = modal['save']();
    fail(409, 'ORG_NODE_NOT_EMPTY', { blockers: ['company has active branches'] });
    await pending;
    expect(modal['isActive']()).toBe(true);
    expect(blocked).toHaveBeenCalledWith({ company, blockers: ['company has active branches'] });
    expect(modal['name']()).toBe('Renamed');
  });

  it('modal cascade confirm resends with a new key and keeps the confirmed key on retry', async () => {
    confirm.mockResolvedValue(true);
    modal['isActive'].set(false);
    const first = modal['save']();
    const initial = fail(409, 'SEAT_ADDON_CASCADE_REQUIRED', cascadeDetails);
    await settle();
    const confirmed = http.expectOne(`${path}/${company.id}?confirmAddonCascade=true`);
    expect(confirmed.request.headers.get('x-idempotency-key')).not.toBe(initial.request.headers.get('x-idempotency-key'));
    expect(confirmed.request.body).toEqual(initial.request.body);
    confirmed.flush({ errorCode: 'COMMON.GENERIC.INTERNAL_ERROR' }, { status: 503, statusText: 'Unavailable' });
    await first;
    expect(confirm).toHaveBeenCalledWith([
      { userId: 'u1', userName: 'Mona', addonKey: 'crm', addonName: 'CRM' },
      { userId: 'u2', userName: 'Ali', addonKey: 'trade', addonName: 'Trade' },
    ]);
    const retry = modal['save']();
    const repeated = fail(409, 'SEAT_ADDON_CASCADE_REQUIRED', cascadeDetails);
    expect(repeated.request.headers.get('x-idempotency-key')).toBe(initial.request.headers.get('x-idempotency-key'));
    await settle();
    const retried = http.expectOne(`${path}/${company.id}?confirmAddonCascade=true`);
    expect(retried.request.headers.get('x-idempotency-key')).toBe(confirmed.request.headers.get('x-idempotency-key'));
    retried.flush({ success: true, data: { ...company, name: 'Renamed', status: 'INACTIVE' } });
    await retry;
  });

  it('modal cascade cancel sends nothing and holds Save while confirmation is pending', async () => {
    let answer: (value: boolean) => void;
    confirm.mockImplementation(() => new Promise<boolean>((resolve) => { answer = resolve; }));
    modal['isActive'].set(false);
    const pending = modal['save']();
    fail(409, 'SEAT_ADDON_CASCADE_REQUIRED', cascadeDetails);
    await settle();
    expect(modal['saving']()).toBe(true);
    await modal['save']();
    http.expectNone((req) => req.method === 'PATCH');
    answer!(false);
    await pending;
    expect(modal['dirty']()).toBe(true);
    expect(modal['isActive']()).toBe(false);
    expect(modal['saving']()).toBe(false);
    http.expectNone((req) => req.method === 'PATCH');
  });
});
