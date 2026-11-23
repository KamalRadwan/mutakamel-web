import { CoreHttp } from '../../../../core/api/core-http';
import { GeoHttpStub } from '../../../../core/geo/testing/geo-http-testing';
import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Notify } from '../../../../core/notify/notify';
import { SeatCascadeConfirm } from '../../seats/cascade-confirm/cascade-confirm';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthSession } from '../../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import type { Branch } from '../shared/staff.model';
import { BranchesPage } from './branches-page';

class EmptyLoader {
  getTranslation() {
    return of({});
  }
}

const organization = '/api/tenant/core/v1/organization';
const dialog = HTMLDialogElement.prototype;
const { showModal, close } = dialog;
const companyId = '019f0000-0000-7000-8000-000000000010';
const firstBranch: Branch = {
  id: '019f0000-0000-7000-8000-000000000011',
  companyId,
  code: 'EAST',
  name: 'East branch',
  address: null,
  phone: null,
  isHeadquarters: false,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
const secondBranch: Branch = {
  ...firstBranch,
  id: '019f0000-0000-7000-8000-000000000012',
  code: 'WEST',
  name: 'West branch',
};
const branchGrant = { tenantWide: false, companyIds: [], branchIds: [firstBranch.id, secondBranch.id] };
const tenantGrant = { tenantWide: true, companyIds: [], branchIds: [] };

function branchPage(data: Branch[], total = data.length, page = 1) {
  return { success: true, data, meta: {
    page, limit: 1, total, totalPages: total, hasNext: page < total, hasPrev: page > 1,
  } };
}

describe('Branches with Gateway reads and writes', () => {
  const me = signal<TenantMe>(FAKE_TENANT_ME);
  let http: HttpTestingController;
  const reloadProfile = vi.fn(async () => undefined);
  const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  const confirmCascade = vi.fn(async () => true);

  beforeEach(() => {
    vi.useFakeTimers();
    reloadProfile.mockClear();
    Object.values(notify).forEach((spy) => spy.mockClear());
    confirmCascade.mockReset().mockResolvedValue(true);
    dialog.showModal = function () { this.setAttribute('open', ''); };
    dialog.close = function () { this.removeAttribute('open'); };
    me.set({
      ...FAKE_TENANT_ME,
      isTenantOwner: false,
      permissions: ['org.branch.read', 'org.branch.manage'],
      permissionScopes: { 'org.branch.read': branchGrant, 'org.branch.manage': tenantGrant },
      accessibleBranches: [firstBranch.id],
      accessibleCompanies: [companyId],
      accessibleBranchCompanies: [{ companyId, branchId: firstBranch.id }],
      accessScope: { ...FAKE_TENANT_ME.accessScope, branchesTruncated: true },
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: CoreHttp, useClass: GeoHttpStub },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Notify, useValue: notify },
        { provide: SeatCascadeConfirm, useValue: { confirm: confirmCascade } },
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
    vi.spyOn(TestBed.inject(TranslocoService), 'translate').mockImplementation((key) => String(key).startsWith('staff.errors.') ? `message:${key}` : String(key));
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
      dialog.showModal = showModal;
      dialog.close = close;
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });

  function render() {
    const fixture = TestBed.createComponent(BranchesPage);
    fixture.componentInstance['pageSize'].set(1);
    fixture.detectChanges();
    return fixture;
  }

  async function finish(fixture: ComponentFixture<BranchesPage>) {
    await vi.advanceTimersByTimeAsync(2_000);
    fixture.detectChanges();
  }

  function expectPage(page: number) {
    return http.expectOne((req) => req.method === 'GET' &&
      req.url === organization + '/branches' && req.params.get('page') === String(page));
  }

  it('uses server pagination even for a permitted row absent from the navigation projection', async () => {
    const fixture = render();
    const page = fixture.componentInstance;
    const initial = expectPage(1);
    expect(Number(initial.request.params.get('limit'))).toBeLessThanOrEqual(100);
    initial.flush(branchPage([firstBranch], 2));
    await finish(fixture);
    expect(page['rows']()).toEqual([firstBranch]);
    expect(page['total']()).toBe(2);

    page['page'].set(2);
    fixture.detectChanges();
    expectPage(2).flush(branchPage([secondBranch], 2, 2));
    await finish(fixture);
    expect(page['rows']()).toEqual([secondBranch]);
    expect(page['total']()).toBe(2);

    me.update((actor) => ({ ...actor, permissions: [], permissionScopes: {} }));
    expect(page['rows']()).toEqual([]);
    expect(page['total']()).toBe(0);
    fixture.detectChanges();
    await finish(fixture);
    expect(page['loadForbidden']()).toBe(true);
    http.expectNone((req) => req.url === organization + '/branches');
  });

  it('loads the company filter from Core and passes the selected ID back to Core', async () => {
    me.update((actor) => ({
      ...actor,
      permissions: [...actor.permissions, 'org.company.read'],
      permissionScopes: { ...actor.permissionScopes, 'org.company.read': tenantGrant },
    }));
    const fixture = render();
    const page = fixture.componentInstance;
    const company = { id: companyId, name: 'Real company' };
    const directory = http.expectOne((req) => req.method === 'GET' && req.url === organization + '/companies');
    directory.flush({ ...branchPage([], 1), data: [company] });
    expectPage(1).flush(branchPage([firstBranch]));
    await finish(fixture);
    expect(page['filters']().find((filter) => filter.id === 'companyId')?.options)
      .toContainEqual({ value: companyId, label: company.name });

    page['filterValues'].set({ companyId });
    fixture.detectChanges();
    const filtered = expectPage(1);
    expect(filtered.request.params.get('companyId')).toBe(companyId);
    filtered.flush(branchPage([firstBranch]));
    await finish(fixture);
    expect(page['total']()).toBe(1);
  });

  it('loads record details and enables real writes with the manage grant', async () => {
    const fixture = render();
    const page = fixture.componentInstance;
    expectPage(1).flush(branchPage([firstBranch]));
    await finish(fixture);
    expect(page['actionsFor'](firstBranch).map((action) => action.id)).toContain('edit');
    expect(page['canAddBranch']()).toBe(false);
    const modal = page['branchModal']();
    const open = vi.spyOn(modal, 'openEdit');
    page['openEdit'](firstBranch);
    const detail = { ...firstBranch, name: 'Current branch name' };
    http.expectOne({ method: 'GET', url: organization + '/branches/' + firstBranch.id })
      .flush({ success: true, data: detail });
    await finish(fixture);
    expect(open).toHaveBeenCalledWith(detail);
    expect(modal.canManage()).toBe(true);
  });

  it('creates an ordinary branch under a real permitted company without enabling headquarters', async () => {
    me.update((actor) => ({
      ...actor,
      permissions: [...actor.permissions, 'org.company.read'],
      permissionScopes: {
        ...actor.permissionScopes,
        'org.company.read': tenantGrant,
        'org.branch.manage': { ...branchGrant, companyIds: [companyId] },
      },
    }));
    const fixture = render();
    const page = fixture.componentInstance;
    const company = { id: companyId, name: 'Real company', status: 'ACTIVE' };
    const directory = { ...branchPage([], 1), data: [company] };
    const expectDirectory = () => http.expectOne((req) =>
      req.method === 'GET' && req.url === organization + '/companies',
    );
    expectDirectory().flush(directory);
    expectPage(1).flush(branchPage([firstBranch]));
    await finish(fixture);

    expect(page['canAddBranch']()).toBe(true);
    expect(page['actionsFor'](firstBranch).map((action) => action.id)).toContain('edit');
    page['openCreate']();
    const modal = page['branchModal']();
    expect(modal['selectedCompanyId']()).toBe(companyId);
    expect(modal['hqSwitchDisabled']()).toBe(true);
    modal['code'].set(secondBranch.code);
    modal['name'].set(secondBranch.name);
    const saved = modal['save']();
    const write = http.expectOne({ method: 'POST', url: organization + '/branches' });
    expect(write.request.body).toEqual({
      companyId, code: secondBranch.code, name: secondBranch.name, isHeadquarters: false,
    });
    write.flush({ success: true, data: secondBranch }, { status: 201, statusText: 'Created' });
    await saved;
    expectDirectory().flush(directory);
    expectPage(1).flush(branchPage([secondBranch], 2));
    await finish(fixture);
    expect(page['rows']()).toEqual([secondBranch]);
    expect(page['total']()).toBe(2);
  });

  it.each([200, 403])('keeps the 200-empty and forbidden views distinct for HTTP %i', async (status) => {
    const fixture = render();
    const page = fixture.componentInstance;
    const request = expectPage(1);
    if (status === 200) request.flush(branchPage([]));
    else request.flush({ code: 'GW.AUTH.FORBIDDEN' }, { status, statusText: 'Forbidden' });
    await finish(fixture);
    expect(page['rows']()).toEqual([]);
    expect(page['total']()).toBe(0);
    expect(page['loadFailed']()).toBe(status === 403);
    expect(page['loadForbidden']()).toBe(status === 403);
    expect(fixture.nativeElement.querySelector('ui-pagination')).toBeNull();
  });
  async function ready(branch = firstBranch) {
    const fixture = render();
    expectPage(1).flush(branchPage([branch]));
    await finish(fixture);
    return fixture;
  }

  function edit(fixture: ComponentFixture<BranchesPage>) {
    const modal = fixture.componentInstance['branchModal']();
    modal.openEdit(firstBranch);
    modal['name'].set('Changed name');
    return modal;
  }

  function write(method = 'PATCH', branch = firstBranch) {
    return http.expectOne((req) => req.method === method && req.url === organization + '/branches/' + branch.id);
  }

  function fail(request: ReturnType<typeof write>, status: number, errorCode: string, details?: object) {
    request.flush({ errorCode, details }, { status, statusText: 'Failure' });
  }

  async function refresh(fixture: ComponentFixture<BranchesPage>, rows = [firstBranch]) {
    expectPage(1).flush(branchPage(rows));
    await finish(fixture);
  }

  it('list 5xx shows load failure with retry', async () => {
    const fixture = render();
    fail(expectPage(1), 503, 'COMMON.GENERIC.INTERNAL_ERROR');
    await finish(fixture);
    expect(fixture.componentInstance['loadFailed']()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('branches.retry');
    fixture.componentInstance['reload']();
    await refresh(fixture);
    expect(fixture.componentInstance['loadFailed']()).toBe(false);
  });

  it('deep link to a deleted branch shows no-longer-available', async () => {
    await TestBed.inject(Router).navigate([], { queryParams: { open: firstBranch.id } });
    const fixture = render();
    expectPage(1).flush(branchPage([firstBranch]));
    await vi.advanceTimersByTimeAsync(0);
    const modal = fixture.componentInstance['branchModal']();
    const open = vi.spyOn(modal, 'openEdit');
    fail(http.expectOne(organization + '/branches/' + firstBranch.id), 404, 'ORG_NODE_NOT_FOUND');
    await finish(fixture);
    expect(open).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('message:staff.errors.ORG_NODE_NOT_FOUND');
  });

  it('update sends changed keys and refreshes', async () => {
    const fixture = await ready();
    const modal = edit(fixture);
    const close = vi.spyOn(modal, 'closeImmediate');
    const saving = modal['save']();
    const request = write();
    expect(request.request.body).toEqual({ name: 'Changed name' });
    expect(request.request.headers.get('x-csrf-token')).toBe('test-csrf');
    expect(request.request.headers.get('x-idempotency-key')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    request.flush({ success: true, data: { ...firstBranch, name: 'Changed name' } });
    await saving;
    expect(close).toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledWith('branches.toast.saved');
    await refresh(fixture);
  });

  it.each([
    ['update retry reuses key', 503, 'COMMON.GENERIC.INTERNAL_ERROR', 'error'],
    ['update 401 keeps form and key without navigation', 401, 'COMMON.GENERIC.UNAUTHORIZED', 'error'],
    ['update denied shows permission toast', 403, 'BRANCH_PERMISSION_DENIED', 'error'],
    ['update idempotency missing shows generic error', 400, 'GW.IDEM.MISSING', 'error'],
    ['update in flight shows info and blocks resend', 409, 'GW.IDEM.IN_FLIGHT', 'info'],
    ['update idempotency mismatch shows warning', 422, 'GW.IDEM.MISMATCH', 'warning'],
    ['update offline keeps form and key', 0, 'NETWORK_ERROR', 'error'],
  ] as const)('%s', async (_name, status, code, tone) => {
    const fixture = await ready();
    const modal = edit(fixture);
    const close = vi.spyOn(modal, 'closeImmediate');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    const saving = modal['save']();
    const request = write();
    const key = request.request.headers.get('x-idempotency-key');
    await modal['save']();
    http.expectNone((req) => req.method === 'PATCH');
    if (status === 0) request.error(new ProgressEvent('error'));
    else fail(request, status, code);
    await saving;
    expect(notify[tone]).toHaveBeenCalledWith(code === 'GW.IDEM.MISSING' ? 'message:staff.errors.generic' :
      status === 401 ? 'message:staff.errors.notSaved' : 'message:staff.errors.' + code);
    expect(close).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(modal['name']()).toBe('Changed name');
    expect(modal['dirty']()).toBe(true);
    expect(modal['saving']()).toBe(false);
    const retry = modal['save']();
    const retried = write();
    expect(retried.request.headers.get('x-idempotency-key')).toBe(key);
    expect(retried.request.body).toEqual(request.request.body);
    retried.flush({ success: true, data: { ...firstBranch, name: 'Changed name' } });
    await retry;
    await refresh(fixture);
  });

  it('update without CSRF cookie sends nothing', async () => {
    const fixture = await ready();
    const modal = edit(fixture);
    vi.spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get').mockReturnValue('');
    await modal['save']();
    http.expectNone((req) => req.method === 'PATCH');
    expect(modal['dirty']()).toBe(true);
    expect(notify.error).toHaveBeenCalledWith('message:staff.errors.GW.AUTH.CSRF_INVALID');
  });

  it('update validation errors show under fields', async () => {
    const fixture = await ready();
    const modal = edit(fixture);
    const saving = modal['save']();
    fail(write(), 400, 'CORE_VALIDATION_FAILED', { name: ['Bad name'], phone: ['Bad phone'], address: ['Bad address'], _: ['Invalid'] });
    await saving;
    fixture.detectChanges();
    expect(modal['nameError']()).toBe('Bad name');
    expect(modal['phoneError']()).toBe('Bad phone');
    expect(modal['addressError']()).toBe('Bad address');
    expect(fixture.nativeElement.textContent).toContain('Bad name');
    expect(fixture.nativeElement.textContent).toContain('Bad phone');
    expect(fixture.nativeElement.textContent).toContain('Bad address');
    expect(notify.error).toHaveBeenCalledWith('message:staff.errors.CORE_VALIDATION_FAILED');
    modal['onNameInput']({ target: { value: 'Corrected' } } as unknown as Event);
    expect(modal['nameError']()).toBeNull();
  });

  it('update of a deleted branch closes and refreshes', async () => {
    const fixture = await ready();
    const modal = edit(fixture);
    const close = vi.spyOn(modal, 'closeImmediate');
    const saving = modal['save']();
    fail(write(), 404, 'ORG_NODE_NOT_FOUND');
    await saving;
    expect(close).toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('message:staff.errors.ORG_NODE_NOT_FOUND');
    await refresh(fixture, []);
  });

  it.each([
    ['stale reload re-reads the branch from Core', false],
    ['scope stale reload discards edits', false],
    ['scope stale keep changes retries with new key', true],
  ] as const)('%s', async (_name, keep) => {
    const fixture = await ready();
    const modal = edit(fixture);
    const saving = modal['save']();
    const request = write();
    const key = request.request.headers.get('x-idempotency-key');
    fail(request, 409, 'ORG_BRANCH_SCOPE_STALE');
    await saving;
    fixture.detectChanges();
    expect(modal['conflictOpen']()).toBe(true);
    const conflict = fixture.nativeElement.querySelector('ui-conflict-dialog');
    expect(conflict.textContent).toContain(firstBranch.name);
    const reread = modal['resolveConflict'](keep);
    const fresh = { ...firstBranch, name: 'Server name' };
    http.expectOne({ method: 'GET', url: organization + '/branches/' + firstBranch.id }).flush({ success: true, data: fresh });
    await reread;
    await refresh(fixture);
    expect(modal['baseBranch']()).toEqual(fresh);
    expect(modal['name']()).toBe(keep ? 'Changed name' : 'Server name');
    expect(modal['dirty']()).toBe(keep);
    expect(modal['saving']()).toBe(false);
    if (keep) {
      const retry = modal['save']();
      const retried = write();
      expect(retried.request.headers.get('x-idempotency-key')).not.toBe(key);
      retried.flush({ success: true, data: { ...fresh, name: 'Changed name' } });
      await retry;
      await refresh(fixture);
    }
  });

  it('failed stale re-read closes and refreshes', async () => {
    const fixture = await ready();
    const modal = edit(fixture);
    const close = vi.spyOn(modal, 'closeImmediate');
    const reread = modal['resolveConflict'](true);
    fail(http.expectOne(organization + '/branches/' + firstBranch.id), 404, 'ORG_NODE_NOT_FOUND');
    await reread;
    expect(close).toHaveBeenCalled();
    await refresh(fixture, []);
  });

  it('deactivate blocked shows one blocker', async () => {
    const fixture = await ready();
    const page = fixture.componentInstance;
    const saving = page['performDeactivate'](firstBranch);
    fail(write(), 409, 'ORG_NODE_NOT_EMPTY', { blockers: ['branch has active departments'] });
    await saving;
    const blockers = page['blockersDialog']()['state']();
    expect(blockers?.blockers).toEqual(['branch has active departments']);
    expect(blockers?.links?.['branch has active departments']).toMatchObject({ queryParams: { branchId: firstBranch.id } });
  });

  it('activate under inactive company shows toast', async () => {
    const fixture = await ready();
    const saving = fixture.componentInstance['performActivate']({ ...firstBranch, status: 'INACTIVE' });
    fail(write(), 409, 'ORG_PARENT_INACTIVE');
    await saving;
    expect(notify.error).toHaveBeenCalledWith('message:staff.errors.ORG_PARENT_INACTIVE');
  });

  it.each([true, false])('status cascade %s resends only on confirm with new key', async (confirmed) => {
    const fixture = await ready();
    confirmCascade.mockResolvedValue(confirmed);
    const saving = fixture.componentInstance['performDeactivate'](firstBranch);
    const request = write();
    const key = request.request.headers.get('x-idempotency-key');
    fail(request, 409, 'SEAT_ADDON_CASCADE_REQUIRED', { userIds: ['u1'], addonKeys: ['crm'] });
    await vi.advanceTimersByTimeAsync(0);
    expect(confirmCascade).toHaveBeenCalledWith([expect.objectContaining({ userId: 'u1', addonKey: 'crm' })]);
    if (confirmed) {
      const resend = write();
      expect(resend.request.params.get('confirmAddonCascade')).toBe('true');
      expect(resend.request.headers.get('x-idempotency-key')).not.toBe(key);
      resend.flush({ success: true, data: { ...firstBranch, status: 'INACTIVE' } });
      await saving;
      await refresh(fixture);
    } else {
      await saving;
      http.expectNone((req) => req.method === 'PATCH');
    }
  });

  it('toggle status updates and reloads profile', async () => {
    const fixture = await ready();
    const saving = fixture.componentInstance['performDeactivate'](firstBranch);
    const request = write();
    expect(request.request.body).toEqual({ status: 'INACTIVE' });
    request.flush({ success: true, data: { ...firstBranch, status: 'INACTIVE' } });
    await saving;
    expect(reloadProfile).toHaveBeenCalledOnce();
    expect(notify.success).toHaveBeenCalledWith('branches.toast.saved');
    await refresh(fixture);
  });

  it.each(['deactivate', 'delete'] as const)('%s HQ opens transfer modal', async (action) => {
    const hq = { ...firstBranch, isHeadquarters: true };
    const fixture = await ready(hq);
    const page = fixture.componentInstance;
    const open = vi.spyOn(page['hqTransferModal'](), 'open');
    const saving = action === 'delete' ? page['performDelete'](hq) : page['performDeactivate'](hq);
    fail(write(action === 'delete' ? 'DELETE' : 'PATCH'), 409, 'ORG_HQ_TRANSFER_REQUIRED');
    await vi.advanceTimersByTimeAsync(0);
    const candidates = expectPage(1);
    expect(candidates.request.params.get('status')).toBe('ACTIVE');
    expect(candidates.request.params.get('companyId')).toBe(companyId);
    expect(Number(candidates.request.params.get('limit'))).toBeLessThanOrEqual(100);
    // Only candidates within the current authorization projection can be transferred to.
    candidates.flush({ ...branchPage([hq]), meta: { ...branchPage([hq]).meta, limit: 100, totalPages: 1, hasNext: false } });
    await saving;
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ branch: hq, candidateBranches: [] }));
  });

  it.each([
    'branch has references; deactivate the branch instead',
    'branch reference checks are unavailable; deactivate the branch instead',
  ])('delete with references offers deactivate instead: %s', async (phrase) => {
    const fixture = await ready();
    const page = fixture.componentInstance;
    const saving = page['performDelete'](firstBranch);
    fail(write('DELETE'), 409, 'ORG_NODE_NOT_EMPTY', { blockers: [phrase] });
    await saving;
    const action = page['blockersDialog']()['state']()?.primaryAction;
    expect(action?.label).toBe('branches.blockers.deactivateInstead');
    const deactivating = action!.run();
    const request = write();
    expect(request.request.body).toEqual({ status: 'INACTIVE' });
    request.flush({ success: true, data: { ...firstBranch, status: 'INACTIVE' } });
    await deactivating;
    await refresh(fixture);
  });

  it('unrecognized blocker does not offer deactivate instead', async () => {
    const fixture = await ready();
    const page = fixture.componentInstance;
    page['openBranchBlockers'](firstBranch, ['other references']);
    expect(page['blockersDialog']()['state']()?.primaryAction).toBeUndefined();
  });

  it('delete removes branch and reloads profile', async () => {
    const fixture = await ready();
    const modal = edit(fixture);
    const close = vi.spyOn(modal, 'closeImmediate');
    const saving = fixture.componentInstance['performDelete'](firstBranch);
    write('DELETE').flush(null, { status: 204, statusText: 'No Content' });
    await saving;
    expect(reloadProfile).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledWith('branches.toast.deleted');
    await refresh(fixture, []);
  });

  it('delete cascade confirm resends with new key', async () => {
    const fixture = await ready();
    const page = fixture.componentInstance;
    const saving = page['performDelete'](firstBranch);
    const request = write('DELETE');
    const key = request.request.headers.get('x-idempotency-key');
    fail(request, 409, 'SEAT_ADDON_CASCADE_REQUIRED');
    await vi.advanceTimersByTimeAsync(0);
    const resend = write('DELETE');
    expect(resend.request.params.get('confirmAddonCascade')).toBe('true');
    expect(resend.request.headers.get('x-idempotency-key')).not.toBe(key);
    resend.flush(null, { status: 204, statusText: 'No Content' });
    await saving;
    await refresh(fixture, []);
  });

  it.each([404, 403, 503])('delete errors show toast for %i', async (status) => {
    const fixture = await ready();
    const saving = fixture.componentInstance['performDelete'](firstBranch);
    fail(write('DELETE'), status, status === 404 ? 'ORG_NODE_NOT_FOUND' : 'COMMON.GENERIC.FORBIDDEN');
    await saving;
    expect(notify.error).toHaveBeenCalled();
    if (status === 404) await refresh(fixture, []);
  });

  it('branch manager without company grant cannot change HQ', async () => {
    me.update((actor) => ({ ...actor, permissionScopes: { ...actor.permissionScopes, 'org.branch.manage': branchGrant } }));
    const fixture = await ready();
    const page = fixture.componentInstance;
    expect(page['actionsFor'](firstBranch).map(({ id }) => id)).toEqual(['open', 'edit', 'toggleStatus', 'delete']);
    expect(page['canChangeHeadquarters'](firstBranch)).toBe(false);
    const hq = { ...firstBranch, isHeadquarters: true };
    expect(page['canChangeLifecycle'](hq)).toBe(false);
    await page['requestMakeHq'](firstBranch);
    http.expectNone((req) => req.method === 'PATCH');
  });

  it('add department action follows department manage grant', async () => {
    me.update((actor) => ({ ...actor, permissions: [...actor.permissions, 'org.department.manage'],
      permissionScopes: { ...actor.permissionScopes, 'org.department.manage': branchGrant } }));
    const fixture = await ready();
    const page = fixture.componentInstance;
    expect(page['actionsFor'](firstBranch).map(({ id }) => id)).toContain('addDepartment');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    page['onAction'](firstBranch, { id: 'addDepartment' });
    expect(navigate).toHaveBeenCalledWith(['/workspace/staff/departments'], { queryParams: { new: 1, branchId: firstBranch.id } });
  });

  function allowSecondBranch() {
    me.update((actor) => ({ ...actor,
      accessibleBranches: [firstBranch.id, secondBranch.id],
      accessibleBranchCompanies: [{ companyId, branchId: firstBranch.id }, { companyId, branchId: secondBranch.id }],
    }));
  }

  it.each(['delete', 'deactivate'] as const)('hq transfer sends one patch then retries %s action', async (action) => {
    allowSecondBranch();
    const hq = { ...firstBranch, isHeadquarters: true };
    const fixture = await ready(hq);
    const page = fixture.componentInstance;
    const blocked = action === 'delete' ? page['performDelete'](hq) : page['performDeactivate'](hq);
    fail(write(action === 'delete' ? 'DELETE' : 'PATCH'), 409, 'ORG_HQ_TRANSFER_REQUIRED');
    await vi.advanceTimersByTimeAsync(0);
    const candidates = [hq, secondBranch, { ...secondBranch, status: 'INACTIVE' as const }, { ...secondBranch, companyId: 'other' }];
    expectPage(1).flush({ ...branchPage(candidates), meta: { ...branchPage(candidates).meta, limit: 100, totalPages: 1, hasNext: false } });
    await blocked;
    const transfer = page['hqTransferModal']();
    expect(transfer['candidates']()).toEqual([secondBranch]);
    const saving = transfer['confirmTransfer']();
    const request = write('PATCH', secondBranch);
    expect(request.request.body).toEqual({ isHeadquarters: true });
    request.flush({ success: true, data: { ...secondBranch, isHeadquarters: true } });
    await vi.advanceTimersByTimeAsync(0);
    expectPage(1).flush(branchPage([firstBranch]));
    const retried = write(action === 'delete' ? 'DELETE' : 'PATCH');
    if (action === 'delete') retried.flush(null, { status: 204, statusText: 'No Content' });
    else {
      expect(retried.request.body).toEqual({ status: 'INACTIVE' });
      retried.flush({ success: true, data: { ...firstBranch, status: 'INACTIVE' } });
    }
    await saving;
    expect(reloadProfile).toHaveBeenCalledTimes(2);
    await refresh(fixture);
  });

  it('hq transfer error keeps modal and retry key', async () => {
    allowSecondBranch();
    const fixture = await ready();
    const transfer = fixture.componentInstance['hqTransferModal']();
    const retryAction = vi.fn(async () => undefined);
    transfer.open({ branch: { ...firstBranch, isHeadquarters: true }, companyName: 'Company', candidateBranches: [secondBranch], retryAction });
    const close = vi.spyOn(transfer['modal'](), 'close');
    const saving = transfer['confirmTransfer']();
    const request = write('PATCH', secondBranch);
    const key = request.request.headers.get('x-idempotency-key');
    fail(request, 503, 'COMMON.GENERIC.INTERNAL_ERROR');
    await saving;
    expect(notify.error).toHaveBeenCalledWith('message:staff.errors.COMMON.GENERIC.INTERNAL_ERROR');
    expect(close).not.toHaveBeenCalled();
    expect(retryAction).not.toHaveBeenCalled();
    const retry = transfer['confirmTransfer']();
    const retried = write('PATCH', secondBranch);
    expect(retried.request.headers.get('x-idempotency-key')).toBe(key);
    retried.flush({ success: true, data: { ...secondBranch, isHeadquarters: true } });
    await retry;
    expect(close).toHaveBeenCalled();
    expect(retryAction).toHaveBeenCalledOnce();
    await refresh(fixture);
  });

  it('modal status cascade resend and its retry hold a separate key', async () => {
    const fixture = await ready();
    const modal = edit(fixture);
    modal['isActive'].set(false);
    const saving = modal['save']();
    const request = write();
    const initialKey = request.request.headers.get('x-idempotency-key');
    fail(request, 409, 'SEAT_ADDON_CASCADE_REQUIRED');
    await vi.advanceTimersByTimeAsync(0);
    const resend = write();
    const confirmedKey = resend.request.headers.get('x-idempotency-key');
    expect(confirmedKey).not.toBe(initialKey);
    expect(resend.request.params.get('confirmAddonCascade')).toBe('true');
    fail(resend, 503, 'COMMON.GENERIC.INTERNAL_ERROR');
    await saving;
    const retry = modal['save']();
    const retried = write();
    expect(retried.request.headers.get('x-idempotency-key')).toBe(confirmedKey);
    expect(retried.request.params.get('confirmAddonCascade')).toBe('true');
    retried.flush({ success: true, data: { ...firstBranch, name: 'Changed name', status: 'INACTIVE' } });
    await retry;
    expect(confirmCascade).toHaveBeenCalledOnce();
    await refresh(fixture);
  });

  it.each(['activate', 'deactivate', 'delete', 'hq'] as const)('page %s retries hold a key until success', async (action) => {
    const fixture = await ready();
    const page = fixture.componentInstance;
    vi.spyOn(page['hqConfirm'](), 'open').mockResolvedValue(true);
    const run = () => action === 'activate' ? page['performActivate']({ ...firstBranch, status: 'INACTIVE' }) :
      action === 'deactivate' ? page['performDeactivate'](firstBranch) :
      action === 'delete' ? page['performDelete'](firstBranch) : page['requestMakeHq'](firstBranch);
    const saving = run();
    await vi.advanceTimersByTimeAsync(0);
    const request = write(action === 'delete' ? 'DELETE' : 'PATCH');
    const key = request.request.headers.get('x-idempotency-key');
    fail(request, 503, 'COMMON.GENERIC.INTERNAL_ERROR');
    await saving;
    const retry = run();
    await vi.advanceTimersByTimeAsync(0);
    const retried = write(action === 'delete' ? 'DELETE' : 'PATCH');
    expect(retried.request.headers.get('x-idempotency-key')).toBe(key);
    if (action === 'delete') retried.flush(null, { status: 204, statusText: 'No Content' });
    else retried.flush({ success: true, data: firstBranch });
    await retry;
    await refresh(fixture);
    const nextAction = run();
    await vi.advanceTimersByTimeAsync(0);
    const next = write(action === 'delete' ? 'DELETE' : 'PATCH');
    expect(next.request.headers.get('x-idempotency-key')).not.toBe(key);
    fail(next, 503, 'COMMON.GENERIC.INTERNAL_ERROR');
    await nextAction;
  });

  it('modal activate under inactive company shows toast without a company field error', async () => {
    const fixture = await ready();
    const modal = fixture.componentInstance['branchModal']();
    modal.openEdit({ ...firstBranch, status: 'INACTIVE' });
    modal['isActive'].set(true);
    const saving = modal['save']();
    fail(write(), 409, 'ORG_PARENT_INACTIVE');
    await saving;
    expect(notify.error).toHaveBeenCalledWith('branches.parentInactive');
    expect(modal['companyError']()).toBeNull();
  });

  it.each(['ORG_HQ_TRANSFER_REQUIRED', 'ORG_NODE_NOT_EMPTY'])('modal deactivation handles %s', async (code) => {
    const fixture = await ready();
    const page = fixture.componentInstance;
    const modal = edit(fixture);
    modal['isActive'].set(false);
    const transfer = vi.spyOn(page, 'onHqTransferRequired').mockImplementation(() => undefined);
    const blocked = vi.spyOn(page, 'onDeactivateBlocked').mockImplementation(() => undefined);
    const saving = modal['save']();
    fail(write(), 409, code, { blockers: ['branch has active departments'] });
    await saving;
    expect(modal['isActive']()).toBe(true);
    if (code === 'ORG_HQ_TRANSFER_REQUIRED') expect(transfer).toHaveBeenCalledWith({ branch: firstBranch, action: 'deactivate' });
    else expect(blocked).toHaveBeenCalledWith({ branch: firstBranch, blockers: ['branch has active departments'] });
  });

  it.each(['delete', 'deactivate'] as const)('page %s confirmed cascade retry reuses its key', async (action) => {
    const fixture = await ready();
    const page = fixture.componentInstance;
    const run = () => action === 'delete' ? page['performDelete'](firstBranch) : page['performDeactivate'](firstBranch);
    const method = action === 'delete' ? 'DELETE' : 'PATCH';
    const saving = run();
    const initial = write(method);
    fail(initial, 409, 'SEAT_ADDON_CASCADE_REQUIRED');
    await vi.advanceTimersByTimeAsync(0);
    const confirmed = write(method);
    const key = confirmed.request.headers.get('x-idempotency-key');
    expect(key).not.toBe(initial.request.headers.get('x-idempotency-key'));
    fail(confirmed, 503, 'COMMON.GENERIC.INTERNAL_ERROR');
    await saving;
    const retry = run();
    const retried = write(method);
    expect(retried.request.headers.get('x-idempotency-key')).toBe(key);
    expect(retried.request.params.get('confirmAddonCascade')).toBe('true');
    if (action === 'delete') retried.flush(null, { status: 204, statusText: 'No Content' });
    else retried.flush({ success: true, data: { ...firstBranch, status: 'INACTIVE' } });
    await retry;
    expect(confirmCascade).toHaveBeenCalledOnce();
    await refresh(fixture);
  });

  it('changed update body gets a new key', async () => {
    const fixture = await ready();
    const modal = edit(fixture);
    const saving = modal['save']();
    const initial = write();
    const key = initial.request.headers.get('x-idempotency-key');
    fail(initial, 503, 'COMMON.GENERIC.INTERNAL_ERROR');
    await saving;
    modal['name'].set('Different edit');
    const retry = modal['save']();
    const changed = write();
    expect(changed.request.headers.get('x-idempotency-key')).not.toBe(key);
    expect(changed.request.body).toEqual({ name: 'Different edit' });
    fail(changed, 503, 'COMMON.GENERIC.INTERNAL_ERROR');
    await retry;
  });

});

