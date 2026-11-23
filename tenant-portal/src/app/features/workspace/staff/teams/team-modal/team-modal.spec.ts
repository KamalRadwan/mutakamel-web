import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { Notify } from '../../../../../core/notify/notify';
import { OrganizationReadApi } from '../../shared/organization-read.api';
import type { Branch, Company, Department, Team, TenantUser } from '../../shared/staff.model';
import { TeamModal } from './team-modal';

class EmptyLoader { getTranslation() { return of({}); } }
const root = '/api/tenant/core/v1/organization';
const usersPath = '/api/tenant/core/v1/users';
const date = '2026-01-01T00:00:00Z';
const company: Company = { id: 'c1', code: 'C', name: 'Company', legalName: null, taxNumber: null,
  countryCode: 'EG', currencyCode: 'EGP', status: 'ACTIVE', createdAt: date, updatedAt: date };
const branch: Branch = { id: 'b1', companyId: company.id, code: 'B', name: 'Branch', address: null,
  phone: null, isHeadquarters: false, status: 'ACTIVE', createdAt: date, updatedAt: date };
const department: Department = { id: 'd1', branchId: branch.id, code: 'D', name: 'Department',
  status: 'ACTIVE', createdAt: date, updatedAt: date };
const lead: TenantUser = { id: '019f0000-0000-7000-8000-000000000014', email: 'lead@example.com',
  firstName: 'Current', lastName: 'Lead', employeeCode: null, companyId: company.id, branchId: branch.id,
  departmentId: department.id, teamId: null, managerId: null, jobTitle: null, status: 'ACTIVE',
  isTenantOwner: false, seats: [], createdAt: date, updatedAt: date };
const nextLead: TenantUser = { ...lead, id: '019f0000-0000-7000-8000-000000000016', firstName: 'New' };
const team: Team = { id: '019f0000-0000-7000-8000-000000000015', departmentId: department.id,
  code: 'TEAM', name: 'Core team', leadUserId: lead.id, status: 'ACTIVE', createdAt: date, updatedAt: date };
const path = `${root}/teams/${team.id}`;
const grant = { tenantWide: false, companyIds: [company.id], branchIds: [branch.id] };
const dialog = HTMLDialogElement.prototype;
const { showModal, close } = dialog;
const keyPattern = /^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/;
function envelope(data: unknown[]) {
  return { success: true, data, meta: { page: 1, limit: 20, total: data.length,
    totalPages: data.length ? 1 : 0, hasNext: false, hasPrev: false } };
}

describe('Team modal through real Staff APIs', () => {
  const me = signal<TenantMe>(FAKE_TENANT_ME);
  const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  let http: HttpTestingController;
  let fixture: ComponentFixture<TeamModal>;
  let modal: TeamModal;
  let csrf: boolean;
  let navigate: ReturnType<typeof vi.spyOn>;

  function permissions(manage = true, readUsers = true) {
    const keys = ['org.team.read', 'org.company.read', 'org.branch.read', 'org.department.read',
      ...(manage ? ['org.team.manage'] : []), ...(readUsers ? ['users.user.read'] : [])];
    me.set({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: keys,
      permissionScopes: Object.fromEntries(keys.map((key) => [key, grant])),
      accessibleCompanies: [company.id], accessibleBranches: [branch.id],
      accessibleBranchCompanies: [{ companyId: company.id, branchId: branch.id }] });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    dialog.showModal = function () { this.setAttribute('open', ''); };
    dialog.close = function () { this.removeAttribute('open'); };
    permissions();
    csrf = true;
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en',
        missingHandler: { logMissingKey: false } }, loader: EmptyLoader }),
      { provide: Notify, useValue: notify },
      { provide: AuthSession, useValue: { me, status: signal('signed-in'),
        ensureLoaded: async () => 'signed-in', requestVersion: () => ({ generation: 1, revision: 0 }),
        reloadProfile: vi.fn() } },
    ] });
    const doc = TestBed.inject(DOCUMENT);
    const cookieName = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => csrf ? `${cookieName}=test-csrf` : '');
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(TranslocoService).setTranslation({ staff: { errors: {
      notSaved: 'Not saved. Try again', generic: 'Generic error',
      ORG_NODE_NOT_FOUND: 'No longer available', ORG_LEAD_USER_NOT_FOUND: 'Lead not found',
      ORG_LEAD_BRANCH_REQUIRED: 'Lead outside branch',
      'GW.IDEM.IN_FLIGHT': 'Still saving', 'GW.IDEM.MISMATCH': 'Body changed',
    } } }, 'en');
    fixture = TestBed.createComponent(TeamModal);
    modal = fixture.componentInstance;
    fixture.componentRef.setInput('companies', [company]);
    fixture.componentRef.setInput('branches', [branch]);
    fixture.componentRef.setInput('departments', [department]);
    fixture.componentRef.setInput('createDepartments', [department]);
    fixture.componentRef.setInput('knownUsers', [lead]);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
    dialog.showModal = showModal;
    dialog.close = close;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function settle() {
    await vi.advanceTimersByTimeAsync(1);
    fixture.detectChanges();
  }
  async function edit(record = team) {
    modal.openEdit(record, { companyId: company.id, branchId: branch.id });
    if (me().permissions.includes('users.user.read')) {
      http.expectOne((req) => req.url === usersPath && req.params.get('teamId') === team.id).flush(envelope([]));
    }
    await settle();
  }
  function write(method = 'PATCH') { return http.expectOne({ method, url: path }); }
  function fail(status: number, code: string, details?: Record<string, unknown>) {
    const pending = modal['save']();
    const request = write();
    request.flush({ errorCode: code, details }, { status, statusText: 'Error' });
    return { pending, request };
  }
  function isOpen() { return fixture.nativeElement.querySelector('ui-modal dialog').hasAttribute('open'); }
  async function rename() { await edit(); modal['name'].set('Renamed team'); }

  it('parent lookup denied falls back silently', async () => {
    modal.openEdit(team);
    http.expectOne({ method: 'GET', url: `${root}/departments/${department.id}` })
      .flush({ errorCode: 'MISSING_REQUIRED_PERMISSIONS' }, { status: 403, statusText: 'Forbidden' });
    await settle();
    expect(isOpen()).toBe(true);
    expect(modal['name']()).toBe(team.name);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('lead picker lists only active users placed in the branch', async () => {
    await edit();
    fixture.componentRef.setInput('createDepartments', []);
    fixture.detectChanges();
    modal['toggleLeadMenu']();
    const req = http.expectOne((r) => r.url === usersPath && r.params.get('status') === 'ACTIVE');
    expect(req.request.params.get('branchId')).toBe(branch.id);
    expect(req.request.params.get('limit')).toBe('20');
    req.flush(envelope([nextLead, { ...lead, status: 'SUSPENDED' }, { ...lead, branchId: 'other' }]));
    await settle();
    expect(modal['leadOptions']()).toEqual([nextLead]);
    expect(modal['canSelectLead']()).toBe(true);
  });

  it('lead picker hidden without user read', async () => {
    permissions(true, false);
    await edit();
    expect(modal['canSelectLead']()).toBe(false);
    expect(fixture.nativeElement.querySelector('[aria-haspopup="listbox"]')).toBeNull();
    modal['toggleLeadMenu']();
    http.expectNone((req) => req.url.startsWith(usersPath));
  });

  it('lead change sends new lead id', async () => {
    await edit();
    modal['selectLead'](nextLead);
    const saved = vi.fn(); modal.saved.subscribe(saved);
    const pending = modal['save'](); const req = write();
    expect(req.request.body).toEqual({ leadUserId: nextLead.id });
    req.flush({ success: true, data: { ...team, leadUserId: nextLead.id } });
    await pending;
    expect(saved).toHaveBeenCalledWith({ ...team, leadUserId: nextLead.id });
    expect(isOpen()).toBe(false);
  });

  it('lead clear sends null', async () => {
    await edit(); modal['selectLead'](null);
    const pending = modal['save'](); const req = write();
    expect(req.request.body).toEqual({ leadUserId: null });
    req.flush({ success: true, data: { ...team, leadUserId: null } }); await pending;
  });

  it('rename keeps the lead out of the patch', async () => {
    fixture.componentRef.setInput('knownUsers', [{ ...lead, status: 'SUSPENDED' }]);
    await rename();
    const pending = modal['save'](); const req = write();
    expect(req.request.body).toEqual({ name: 'Renamed team' });
    req.flush({ success: true, data: { ...team, name: 'Renamed team' } }); await pending;
  });

  it('viewer gets read-only modal', async () => {
    permissions(false); fixture.componentRef.setInput('canManage', false);
    await edit();
    const footer = fixture.nativeElement.querySelector('[modal-footer]');
    expect(footer.querySelectorAll('button')).toHaveLength(1);
    expect(footer.textContent).toContain('teams.close');
    expect(fixture.nativeElement.querySelector('ui-switch')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-haspopup="listbox"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[id$="-name"]').readOnly).toBe(true);
    await modal['save'](); http.expectNone({ method: 'PATCH', url: path });
  });

  it('update retry reuses key', async () => {
    await rename();
    const { pending, request } = fail(503, 'COMMON.GENERIC.INTERNAL_ERROR'); await pending;
    const key = request.request.headers.get('x-idempotency-key');
    expect(key).toMatch(keyPattern);
    expect(request.request.headers.get('x-csrf-token')).toBe('test-csrf');
    expect(request.request.withCredentials).toBe(true);
    const retry = modal['save'](); const req = write();
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    expect(req.request.body).toEqual(request.request.body);
    req.flush({ success: true, data: { ...team, name: 'Renamed team' } }); await retry;
  });

  it('update without CSRF cookie sends nothing', async () => {
    await rename(); csrf = false;
    await modal['save']();
    http.expectNone({ method: 'PATCH', url: path });
    expect(modal['dirty']()).toBe(true); expect(isOpen()).toBe(true);
    expect(notify.error).toHaveBeenCalled();
  });

  it('update validation errors show under fields', async () => {
    await rename();
    const { pending } = fail(400, 'CORE_VALIDATION_FAILED', { name: ['Name rejected'], leadUserId: ['Lead rejected'], _: ['Invalid'] });
    await pending; fixture.detectChanges();
    expect(modal['nameError']()).toBe('Name rejected');
    expect(modal['leadError']()).toBe('Lead rejected');
    expect(fixture.nativeElement.textContent).toContain('Name rejected');
    expect(fixture.nativeElement.textContent).toContain('Lead rejected');
    expect(notify.error).toHaveBeenCalled(); expect(isOpen()).toBe(true);
  });

  it('update idempotency missing shows generic error', async () => {
    await rename(); const { pending } = fail(400, 'GW.IDEM.MISSING'); await pending;
    expect(notify.error).toHaveBeenCalledWith('Generic error');
  });

  it('update 401 keeps form and key without navigation', async () => {
    await rename(); const { pending, request } = fail(401, 'COMMON.GENERIC.UNAUTHORIZED'); await pending;
    expect(notify.error).toHaveBeenCalledWith('Not saved. Try again');
    expect(isOpen()).toBe(true); expect(modal['dirty']()).toBe(true);
    expect(modal['name']()).toBe('Renamed team'); expect(navigate).not.toHaveBeenCalled();
    const retry = modal['save'](); const req = write();
    expect(req.request.headers.get('x-idempotency-key')).toBe(request.request.headers.get('x-idempotency-key'));
    req.flush({ success: true, data: { ...team, name: 'Renamed team' } }); await retry;
  });

  it('update denied shows permission toast', async () => {
    await rename(); const { pending } = fail(403, 'MISSING_REQUIRED_PERMISSIONS'); await pending;
    expect(notify.error).toHaveBeenCalled(); expect(isOpen()).toBe(true);
  });

  it('update of a deleted team closes and refreshes', async () => {
    await rename(); const refreshed = vi.fn(); modal.staleScopeDetected.subscribe(refreshed);
    const { pending } = fail(404, 'ORG_NODE_NOT_FOUND'); await pending;
    expect(notify.error).toHaveBeenCalledWith('No longer available');
    expect(isOpen()).toBe(false); expect(refreshed).toHaveBeenCalledOnce();
  });

  it.each([
    ['lead not found shows lead field error', 404, 'ORG_LEAD_USER_NOT_FOUND', 'Lead not found'],
    ['lead outside branch shows lead field error', 422, 'ORG_LEAD_BRANCH_REQUIRED', 'Lead outside branch'],
  ])('%s', async (_name, status, code, text) => {
    await edit(); modal['selectLead'](nextLead);
    const { pending } = fail(Number(status), String(code)); await pending;
    expect(modal['leadError']()).toBe(text); expect(isOpen()).toBe(true);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('lead conflict reload discards edits', async () => {
    await rename(); const { pending } = fail(409, 'ORG_LEAD_CHANGE_CONFLICT'); await pending;
    fixture.detectChanges(); expect(modal['conflictOpen']()).toBe(true);
    expect(fixture.nativeElement.querySelector('ui-conflict-dialog dialog').open).toBe(true);
    const refreshed = vi.fn(); modal.staleScopeDetected.subscribe(refreshed);
    const reload = modal['reloadConflict']();
    http.expectOne({ method: 'GET', url: path }).flush({ success: true, data: { ...team, name: 'Fresh team', leadUserId: nextLead.id } });
    await reload;
    http.expectOne({ method: 'GET', url: `${usersPath}/${nextLead.id}` }).flush({ success: true, data: nextLead });
    await settle();
    expect(modal['name']()).toBe('Fresh team'); expect(modal['dirty']()).toBe(false);
    expect(modal['selectedLead']()).toEqual(nextLead); expect(refreshed).toHaveBeenCalledOnce();
  });

  it('lead conflict keep changes retries with new key', async () => {
    await rename(); modal['selectLead'](nextLead);
    const { pending, request } = fail(409, 'ORG_LEAD_CHANGE_CONFLICT'); await pending;
    const keep = modal['keepConflictChanges']();
    http.expectOne({ method: 'GET', url: path }).flush({ success: true, data: { ...team, name: 'Server name' } });
    await keep; fixture.detectChanges();
    expect(modal['name']()).toBe('Renamed team'); expect(modal['selectedLead']()).toEqual(nextLead);
    expect(modal['baseTeam']()?.name).toBe('Server name'); expect(modal['dirty']()).toBe(true);
    const retry = modal['save'](); const req = write();
    expect(req.request.headers.get('x-idempotency-key')).not.toBe(request.request.headers.get('x-idempotency-key'));
    expect(req.request.body).toEqual({ name: 'Renamed team', leadUserId: nextLead.id });
    req.flush({ success: true, data: { ...team, name: 'Renamed team', leadUserId: nextLead.id } }); await retry;
  });

  it('scope stale opens conflict modal', async () => {
    await rename(); const { pending } = fail(409, 'ORG_NODE_SCOPE_STALE'); await pending;
    expect(modal['conflictOpen']()).toBe(true); expect(isOpen()).toBe(true);
  });

  it('branch scope stale opens conflict modal', async () => {
    await rename(); const { pending } = fail(409, 'ORG_BRANCH_SCOPE_STALE'); await pending;
    expect(modal['conflictOpen']()).toBe(true);
  });

  it('conflict failed reread closes and reports the error', async () => {
    await rename(); const { pending } = fail(409, 'ORG_NODE_SCOPE_STALE'); await pending;
    const reload = modal['reloadConflict']();
    http.expectOne({ method: 'GET', url: path }).flush({ errorCode: 'ORG_NODE_NOT_FOUND' }, { status: 404, statusText: 'Missing' });
    await reload; expect(isOpen()).toBe(false); expect(notify.error).toHaveBeenCalledWith('No longer available');
  });

  it('update in flight shows info and blocks resend', async () => {
    await rename(); const pending = modal['save'](); const req = write();
    await modal['save'](); http.expectNone({ method: 'PATCH', url: path });
    fixture.detectChanges(); expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    req.flush({ code: 'GW.IDEM.IN_FLIGHT' }, { status: 409, statusText: 'Conflict' }); await pending;
    expect(notify.info).toHaveBeenCalledWith('Still saving'); expect(modal['saving']()).toBe(false);
  });

  it('update idempotency mismatch shows warning', async () => {
    await rename(); const { pending } = fail(422, 'GW.IDEM.MISMATCH'); await pending;
    expect(notify.warning).toHaveBeenCalledWith('Body changed');
  });

  it('update offline keeps form and key', async () => {
    await rename(); const pending = modal['save'](); const req = write();
    req.error(new ProgressEvent('error')); await pending;
    expect(modal['dirty']()).toBe(true); expect(modal['saving']()).toBe(false); expect(isOpen()).toBe(true);
    const retry = modal['save'](); const next = write();
    expect(next.request.headers.get('x-idempotency-key')).toBe(req.request.headers.get('x-idempotency-key'));
    next.flush({ success: true, data: { ...team, name: 'Renamed team' } }); await retry;
  });

  it('create lead and parent errors show field messages', async () => {
    modal.openCreate({ companyId: company.id, branchId: branch.id, departmentId: department.id });
    modal['code'].set('NEW'); modal['name'].set('New team'); modal['selectLead'](lead);
    for (const [status, code] of [[404, 'ORG_LEAD_USER_NOT_FOUND'], [422, 'ORG_LEAD_BRANCH_REQUIRED'], [409, 'ORG_PARENT_INACTIVE']] as const) {
      const pending = modal['save']();
      http.expectOne({ method: 'POST', url: `${root}/teams` }).flush({ errorCode: code }, { status, statusText: 'Error' });
      await pending;
      if (code === 'ORG_PARENT_INACTIVE') expect(modal['cascadeErrors']().department).toBe('teams.parentInactive');
      else expect(modal['leadError']()).toBeTruthy();
      expect(isOpen()).toBe(true);
    }
  });

  it('modal deactivation blockers restore active and emit one blocker', async () => {
    await edit(); modal['isActive'].set(false);
    const blocked = vi.fn(); modal.deactivateBlocked.subscribe(blocked);
    const { pending } = fail(409, 'ORG_NODE_NOT_EMPTY', { blockers: ['team has placed users'] }); await pending;
    expect(modal['isActive']()).toBe(true);
    expect(blocked).toHaveBeenCalledWith({ team, blockers: ['team has placed users'] });
    expect(isOpen()).toBe(true);
  });

  it('undo restores name lead and status and disables Save', async () => {
    await rename(); modal['selectLead'](null); modal['isActive'].set(false);
    modal['undo'](); fixture.detectChanges();
    expect(modal['name']()).toBe(team.name); expect(modal['selectedLead']()).toEqual(lead);
    expect(modal['isActive']()).toBe(true); expect(modal['dirty']()).toBe(false);
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
  });

  it('body change replaces the retry key and successful writes invalidate reads', async () => {
    await rename(); const invalidate = vi.spyOn(TestBed.inject(OrganizationReadApi), 'invalidateScope');
    const { pending, request } = fail(503, 'COMMON.GENERIC.INTERNAL_ERROR'); await pending;
    modal['name'].set('Another name'); const retry = modal['save'](); const req = write();
    expect(req.request.headers.get('x-idempotency-key')).not.toBe(request.request.headers.get('x-idempotency-key'));
    req.flush({ success: true, data: { ...team, name: 'Another name' } }); await retry;
    expect(invalidate).toHaveBeenCalledOnce();
  });
});
