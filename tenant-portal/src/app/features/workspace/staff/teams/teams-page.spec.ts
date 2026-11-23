import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import { AuthSession } from '../../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { Notify } from '../../../../core/notify/notify';
import { OrganizationReadApi } from '../shared/organization-read.api';
import type { Team } from '../shared/staff.model';
import { TeamsPage } from './teams-page';

class EmptyLoader { getTranslation() { return of({}); } }
const root = '/api/tenant/core/v1/organization';
const usersPath = '/api/tenant/core/v1/users';
const teamsPath = `${root}/teams`;
const date = '2026-01-01T00:00:00Z';
const company = { id: 'c1', code: 'C', name: 'Core company', status: 'ACTIVE' };
const branch = { id: 'b1', companyId: company.id, code: 'B', name: 'Core branch', status: 'ACTIVE' };
const department = { id: 'd1', branchId: branch.id, code: 'D', name: 'Core department', status: 'ACTIVE' };
const lead = { id: '019f0000-0000-7000-8000-000000000014', companyId: company.id, branchId: branch.id, status: 'ACTIVE',
  firstName: 'Core', lastName: 'Lead', jobTitle: null };
const team: Team = { id: '019f0000-0000-7000-8000-000000000015', departmentId: department.id,
  code: 'TEAM', name: 'Core team', leadUserId: lead.id, status: 'ACTIVE', createdAt: date, updatedAt: date };
const path = `${teamsPath}/${team.id}`;
const grant = { tenantWide: false, companyIds: [company.id], branchIds: [branch.id] };
const dialog = HTMLDialogElement.prototype;
const { showModal, close } = dialog;
function envelope(data: unknown[], total = data.length) {
  return { success: true, data, meta: { page: 1, limit: 20, total,
    totalPages: total ? 1 : 0, hasNext: false, hasPrev: false } };
}

describe('Teams page through real Staff APIs', () => {
  const me = signal<TenantMe>(FAKE_TENANT_ME);
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  let http: HttpTestingController;
  let fixture: ComponentFixture<TeamsPage>;
  let page: TeamsPage;
  let navigate: ReturnType<typeof vi.spyOn>;
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    dialog.showModal = function () { this.setAttribute('open', ''); };
    dialog.close = function () { this.removeAttribute('open'); };
    const permissions = ['org.company.read', 'org.branch.read', 'org.department.read', 'org.team.read',
      'org.team.manage', 'users.user.read'];
    me.set({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions,
      permissionScopes: Object.fromEntries(permissions.map((key) => [key, grant])),
      accessibleCompanies: [company.id], accessibleBranches: [branch.id],
      accessibleBranchCompanies: [{ companyId: company.id, branchId: branch.id }] });
    queryParams = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: EmptyLoader }),
      { provide: Notify, useValue: notify },
      { provide: ActivatedRoute, useValue: { queryParamMap: queryParams, snapshot: { queryParamMap: convertToParamMap({}) } } },
      { provide: AuthSession, useValue: { me, status: signal('signed-in'), ensureLoaded: async () => 'signed-in',
        requestVersion: () => ({ generation: 1, revision: 0 }), reloadProfile: vi.fn() } },
    ] });
    const doc = TestBed.inject(DOCUMENT);
    const cookie = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${cookie}=test-csrf`);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.inject(TranslocoService).setTranslation({ staff: { errors: {
      ORG_NODE_NOT_FOUND: 'No longer available', notSaved: 'Not saved. Try again',
    } } }, 'en');
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TeamsPage); page = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify(); fixture.destroy();
    dialog.showModal = showModal; dialog.close = close;
    vi.restoreAllMocks(); vi.useRealTimers();
  });

  async function settle() { await vi.advanceTimersByTimeAsync(10); fixture.detectChanges(); }
  function list() { return http.expectOne((r) => r.method === 'GET' && r.url === teamsPath); }
  function lookups() {
    for (const [resource, data] of [['companies', [company]], ['branches', [branch]], ['departments', [department]]] as const) {
      http.expectOne((r) => r.url === `${root}/${resource}` && r.params.get('limit') === '100').flush(envelope([...data]));
    }
  }
  async function initial(rows = [team]) {
    lookups(); list().flush(envelope(rows)); await settle();
    flushUserReads(); await settle();
  }
  function flushUserReads() {
    for (const req of http.match((r) => r.method === 'GET' && r.url.startsWith(usersPath))) {
      req.flush(req.request.url === usersPath ? envelope([], 3) : { success: true, data: lead });
    }
  }
  async function refreshed(rows = [team]) {
    lookups(); list().flush(envelope(rows)); await settle(); flushUserReads(); await settle();
  }
  async function open() {
    page['openDetails'](team);
    http.expectOne({ method: 'GET', url: path }).flush({ success: true, data: team });
    await settle(); flushUserReads(); await settle();
  }
  async function confirmStatus(record = team) {
    const pending = page['requestToggleStatus'](record);
    fixture.detectChanges(); page['statusDialog']()['close'](true);
    await Promise.resolve();
    return { pending, request: http.expectOne({ method: 'PATCH', url: path }) };
  }
  async function confirmDelete() {
    const pending = page['requestDelete'](team);
    fixture.detectChanges(); page['deleteConfirm']()['close'](true);
    await Promise.resolve();
    return { pending, request: http.expectOne({ method: 'DELETE', url: path }) };
  }

  it('list renders Core rows with members', async () => {
    await initial();
    expect(page['rows']()).toEqual([team]); expect(page['total']()).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Core department');
    expect(fixture.nativeElement.textContent).toContain('Core Lead');
    expect(page['memberCountText'](team.id)).toBe('3');
    expect(page['actionsFor'](team).map((a) => a.id)).toEqual(['open', 'edit', 'viewMembers', 'toggleStatus', 'delete']);
  });

  it('list shows empty and no-results', async () => {
    await initial([]); expect(fixture.nativeElement.textContent).toContain('teams.empty');
    page['search'].set('missing'); page['filterValues'].set({ status: 'INACTIVE' }); fixture.detectChanges();
    list().flush(envelope([])); await settle();
    expect(fixture.nativeElement.textContent).toContain('teams.noResults');
    const clear = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('staff.list.clearAll')) as HTMLButtonElement | undefined;
    expect(page['hasActiveFiltersOrSearch']()).toBe(true);
    expect(clear).toBeDefined();
    clear!.click(); fixture.detectChanges();
    list().flush(envelope([])); await settle();
    expect(page['filterValues']()['status']).toBeNull();
  });

  it('list denied and failed states', async () => {
    lookups(); list().flush({ errorCode: 'MISSING_REQUIRED_PERMISSIONS' }, { status: 403, statusText: 'Forbidden' });
    await settle(); expect(page['loadForbidden']()).toBe(true);
    page['reload'](); lookups(); list().flush({}, { status: 503, statusText: 'Unavailable' });
    await settle(); expect(page['loadForbidden']()).toBe(false); expect(page['loadFailed']()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('teams.retry');
  });

  it('deep link to a missing team shows no-longer-available', async () => {
    await initial(); queryParams.next(convertToParamMap({ open: team.id })); fixture.detectChanges();
    http.expectOne({ method: 'GET', url: path }).flush({ errorCode: 'ORG_NODE_NOT_FOUND' }, { status: 404, statusText: 'Missing' });
    await settle();
    expect(notify.error).toHaveBeenCalledWith('No longer available');
    expect(page['teamModal']().editingId()).toBeNull();
    await refreshed();
  });

  it('rename sends name only and refreshes', async () => {
    await initial(); await open(); const modal = page['teamModal']();
    modal['name'].set('Renamed'); const pending = modal['save']();
    const req = http.expectOne({ method: 'PATCH', url: path });
    expect(req.request.body).toEqual({ name: 'Renamed' });
    const invalidate = vi.spyOn(TestBed.inject(OrganizationReadApi), 'invalidateScope');
    req.flush({ success: true, data: { ...team, name: 'Renamed' } }); await pending;
    expect(notify.success).toHaveBeenCalledWith('teams.toast.saved');
    expect(fixture.nativeElement.querySelector('app-team-modal ui-modal dialog').open).toBe(false);
    await refreshed([{ ...team, name: 'Renamed' }]);
    expect(page['rows']()[0].name).toBe('Renamed'); expect(invalidate).toHaveBeenCalledOnce();
  });

  it('deactivate from the row menu', async () => {
    await initial();
    page['onAction'](team, { id: 'toggleStatus' }); fixture.detectChanges();
    expect(page['pendingStatusChange']()?.nextStatus).toBe('INACTIVE');
    expect(fixture.nativeElement.textContent).toContain('teams.confirm.deactivateTitle');
    page['statusDialog']()['close'](true); await Promise.resolve();
    const req = http.expectOne({ method: 'PATCH', url: path });
    expect(req.request.body).toEqual({ status: 'INACTIVE' });
    expect(page['actionsFor'](team).find((a) => a.id === 'toggleStatus')?.disabled).toBe(true);
    req.flush({ success: true, data: { ...team, status: 'INACTIVE' } }); await settle();
    expect(notify.success).toHaveBeenCalledWith('teams.toast.deactivated');
    await refreshed([{ ...team, status: 'INACTIVE' }]);
  });

  it('deactivate blocked shows one blocker with link', async () => {
    await initial(); const { pending, request } = await confirmStatus();
    request.flush({ errorCode: 'ORG_NODE_NOT_EMPTY', details: { blockers: ['team has placed users'] } }, { status: 409, statusText: 'Conflict' });
    await pending; fixture.detectChanges();
    const rows = page['blockersDialog']()['rows']();
    expect(rows).toHaveLength(1); expect(rows[0].phrase).toBe('team has placed users');
    expect(rows[0].link).toEqual({ label: 'teams.blockers.viewUsers', route: ['/workspace/staff/users'], queryParams: { teamId: team.id } });
    page['blockersDialog']()['openLink'](rows[0].link!);
    expect(navigate).toHaveBeenCalledWith(['/workspace/staff/users'], { queryParams: { teamId: team.id } });
  });

  it('activate under inactive department shows toast', async () => {
    await initial(); const { pending, request } = await confirmStatus({ ...team, status: 'INACTIVE' });
    expect(request.request.body).toEqual({ status: 'ACTIVE' });
    request.flush({ errorCode: 'ORG_PARENT_INACTIVE' }, { status: 409, statusText: 'Conflict' }); await pending;
    expect(notify.error).toHaveBeenCalledWith('teams.parentInactive');
  });

  it('status retry reuses the held key', async () => {
    await initial(); let heldKey: string | null = null;
    for (const status of [401, 503, 200]) {
      const { pending, request } = await confirmStatus();
      const key = request.request.headers.get('x-idempotency-key');
      expect(key).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
      if (heldKey) expect(key).toBe(heldKey); else heldKey = key;
      if (status === 200) request.flush({ success: true, data: { ...team, status: 'INACTIVE' } });
      else request.flush({ errorCode: status === 401 ? 'COMMON.GENERIC.UNAUTHORIZED' : 'COMMON.GENERIC.INTERNAL_ERROR' }, { status, statusText: 'Error' });
      await pending;
      if (status === 401) expect(notify.error).toHaveBeenCalledWith('Not saved. Try again');
    }
    expect(navigate).not.toHaveBeenCalled(); await refreshed();
  });

  it('delete removes team', async () => {
    await initial(); await open(); const { pending, request } = await confirmDelete();
    expect(request.request.params.has('confirmAddonCascade')).toBe(false);
    request.flush(null, { status: 204, statusText: 'No Content' }); await pending;
    expect(notify.success).toHaveBeenCalledWith('teams.toast.deleted');
    expect(fixture.nativeElement.querySelector('app-team-modal ui-modal dialog').open).toBe(false);
    await refreshed([]); expect(page['rows']()).toEqual([]);
  });

  it('delete blocked by memberships links to users', async () => {
    await initial(); const { pending, request } = await confirmDelete();
    request.flush({ errorCode: 'ORG_NODE_NOT_EMPTY', details: { blockers: ['team has memberships'] } }, { status: 409, statusText: 'Conflict' });
    await pending; const rows = page['blockersDialog']()['rows']();
    expect(rows).toHaveLength(1); expect(rows[0].phrase).toBe('team has memberships');
    expect(rows[0].link?.queryParams).toEqual({ teamId: team.id });
  });

  it('delete errors show toast', async () => {
    await initial(); let key: string | null = null;
    for (const status of [403, 503, 404]) {
      const { pending, request } = await confirmDelete();
      if (key) expect(request.request.headers.get('x-idempotency-key')).toBe(key);
      key = request.request.headers.get('x-idempotency-key');
      request.flush({ errorCode: status === 404 ? 'ORG_NODE_NOT_FOUND' : 'COMMON.GENERIC.FORBIDDEN' }, { status, statusText: 'Error' });
      await pending; expect(notify.error).toHaveBeenCalledTimes(status === 403 ? 1 : status === 503 ? 2 : 3);
    }
    await refreshed();
  });

  it('delete cancel sends nothing', async () => {
    await initial(); const pending = page['requestDelete'](team);
    page['deleteConfirm']()['close'](false); await pending;
    http.expectNone({ method: 'DELETE', url: path });
    expect(page['pendingDeleteTeam']()).toBeNull();
  });

  it('manage permission follows the team branch and modal outputs reach page flows', async () => {
    await initial(); expect(page['canManageTeam'](team)).toBe(true);
    expect(page['canManageTeam']({ ...team, departmentId: 'unknown' })).toBe(false);
    await open(); const modal = page['teamModal']();
    expect(modal['canManage']()).toBe(true);
    modal.deactivateBlocked.emit({ team, blockers: ['team has memberships'] });
    expect(page['blockersDialog']()['rows']()[0].phrase).toBe('team has memberships');
    modal['requestDelete'](); expect(page['pendingDeleteTeam']()).toEqual(team);
    page['deleteConfirm']()['close'](false); await settle();
    me.update((current) => ({ ...current, permissions: current.permissions.filter((p) => p !== 'org.team.manage') }));
    fixture.detectChanges();
    expect(modal['canManage']()).toBe(false);
    expect(page['actionsFor'](team).map((a) => a.id)).toEqual(['open']);
    await page['requestDelete'](team); http.expectNone({ method: 'DELETE', url: path });
    // Scope revision changes trigger fresh reads, never writes.
    lookups(); list().flush(envelope([])); await settle();
    expect(page['actionsFor'](team).map((a) => a.id)).toEqual(['open', 'viewMembers']);
  });
});
