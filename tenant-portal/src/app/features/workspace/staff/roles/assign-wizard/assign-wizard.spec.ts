import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, input, output, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rolesEn from '../../../../../../../public/i18n/staff-roles/en.json';
import staffEn from '../../../../../../../public/i18n/staff/en.json';
import permEn from '../../../../../../../public/i18n/staff-permissions/en.json';
import settingsEn from '../../../../../../../public/i18n/settings/en.json';
import seatsEn from '../../../../../../../public/i18n/seats/en.json';
import { Notify } from '../../../../../core/notify/notify';
import { SeatImpact } from '../../../seats/seat-impact/seat-impact';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { StaffSession } from '../../shared/staff-session';
import type { RoleBranchPermissions } from '../../shared/staff.model';
import { AssignPermissionsWizard } from './assign-wizard';

// Isolate the Seats preview presentation while exercising the wizard's HTTP requests.
@Component({ selector: 'app-seat-impact', template: '' })
class SeatImpactStub {
  readonly changes = input<unknown>(null);
  readonly compact = input(false);
  readonly canBuySeats = input(false);
  readonly blocking = output<boolean>();
}

const dialog = HTMLDialogElement.prototype;
const originalShowModal = dialog.showModal;
const originalClose = dialog.close;
const base = '/api/tenant/core/v1/roles';
const org = '/api/tenant/core/v1/organization';
const id = '019f0000-0000-7000-8000-000000000010';
const permissionId = '019f0000-0000-7000-8000-000000000011';
const companyId = '019f0000-0000-7000-8000-000000000012';
const branchId = '019f0000-0000-7000-8000-000000000013';
const view: RoleBranchPermissions = {
  roleId: id,
  roleName: 'Reader',
  isSystem: false,
  permissionMode: 'BRANCH',
  revision: '1',
  catalogueRevision: 'c1',
  globalPermissionIds: [],
  profiles: [
    {
      branchId,
      companyId,
      branchName: 'Branch',
      companyName: 'Company',
      isActive: true,
      permissionIds: [],
    },
  ],
  catalogue: [
    {
      id: permissionId,
      key: 'crm.lead.create',
      nameI18n: { en: 'Create leads', ar: 'إضافة العملاء' },
      module: { id: 'crm', nameI18n: { en: 'CRM', ar: 'إدارة العملاء' } },
      groups: [
        { id: 'sales', nameI18n: { en: 'Sales', ar: 'المبيعات' } },
        { id: 'leads', nameI18n: { en: 'Leads', ar: 'العملاء' } },
      ],
      scope: 'BRANCH',
      recordScope: null,
    },
  ],
  limits: { branches: 100, permissionsPerBranch: 200 },
};
const root = { roles: rolesEn, staff: staffEn, perm: permEn, settings: settingsEn, seats: seatsEn };
class TestLoader {
  getTranslation(path: string) {
    const scopes: Record<string, unknown> = {
      'staff-roles': rolesEn,
      staff: staffEn,
      'staff-permissions': permEn,
      settings: settingsEn,
      seats: seatsEn,
    };
    return of(scopes[path.split('/')[0]] ?? root);
  }
}

describe('Real branch permission wizard', () => {
  let fixture: ComponentFixture<AssignPermissionsWizard>;
  let component: AssignPermissionsWizard;
  let http: HttpTestingController;
  let notify: Notify;
  const owner = signal(true);
  const cascade = { confirm: vi.fn() };
  beforeEach(async () => {
    owner.set(true);
    cascade.confirm.mockReset().mockResolvedValue(true);
    dialog.showModal = function () {
      this.open = true;
    };
    dialog.close = function () {
      this.open = false;
      queueMicrotask(() => this.dispatchEvent(new Event('close')));
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTransloco({
          config: {
            availableLangs: ['en'],
            defaultLang: 'en',
            missingHandler: { logMissingKey: false },
          },
          loader: TestLoader,
        }),
        {
          provide: StaffSession,
          useValue: {
            scopeRevision: signal('scope'),
            can: () => true,
            isTenantWide: () => true,
            isOwner: owner,
            canReadBranchPermissions: owner,
            canUpdateBranchPermissions: owner,
          },
        },
        { provide: SeatCascadeConfirm, useValue: cascade },
      ],
    });
    TestBed.overrideComponent(AssignPermissionsWizard, {
      remove: { imports: [SeatImpact] },
      add: { imports: [SeatImpactStub] },
    });
    const doc = TestBed.inject(DOCUMENT);
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(
      `${doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=proof`,
    );
    http = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(Notify);
    fixture = TestBed.createComponent(AssignPermissionsWizard);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => {
    dialog.showModal = originalShowModal;
    dialog.close = originalClose;
    http?.verify();
    vi.restoreAllMocks();
  });
  function orgPage(path: string, items: unknown[], pageNumber = 1, hasNext = false) {
    const req = http.expectOne((r) => r.url === `${org}/${path}`);
    expect(req.request.params.get('limit')).toBe('100');
    expect(req.request.params.get('page')).toBe(String(pageNumber));
    req.flush({
      success: true,
      data: items,
      meta: {
        page: pageNumber,
        limit: 100,
        total: hasNext ? 101 : items.length,
        totalPages: hasNext ? 2 : pageNumber,
        hasNext,
        hasPrev: pageNumber > 1,
      },
    });
  }
  function roleDetail(holderCount = 7) {
    http.expectOne({ method: 'GET', url: `${base}/${id}` }).flush({
      success: true,
      data: { id, permissionIds: [], holderCount },
    });
  }
  function organization() {
    roleDetail();
    orgPage('companies', [{ id: companyId, name: 'Company', status: 'ACTIVE' }]);
    orgPage('branches', [{ id: branchId, companyId, name: 'Branch', status: 'ACTIVE' }]);
  }
  async function open(data = view) {
    component.open(id);
    fixture.detectChanges();
    http.expectOne(`${base}/${id}/branch-permissions`).flush({ success: true, data });
    organization();
    await vi.waitFor(() => expect(component['loading']()).toBe(false));
    fixture.detectChanges();
  }
  function edit() {
    component['draftPermissions'].set(new Map([[branchId, [permissionId]]]));
    component['step'].set('review');
    fixture.detectChanges();
  }
  function save() {
    const pending = component['save']();
    return {
      pending,
      req: http.expectOne({ method: 'PUT', url: `${base}/${id}/branch-permissions` }),
    };
  }

  it('loads the wizard from the real branch permissions', async () => {
    component.open(id);
    roleDetail(12);
    http.expectOne(`${base}/${id}/branch-permissions`).flush({ success: true, data: view });
    orgPage('companies', [{ id: companyId, name: 'Company', status: 'ACTIVE' }], 1, true);
    orgPage('branches', [{ id: branchId, companyId, name: 'Branch', status: 'ACTIVE' }], 1, true);
    await vi.waitFor(() => {
      orgPage('companies', [], 2);
      orgPage('branches', [], 2);
    });
    await vi.waitFor(() => expect(component['loading']()).toBe(false));
    expect(component['loaded']()?.revision).toBe('1');
    expect(component['holderCount']()).toBe(12);
    expect(component['selectedBranchIds']()).toEqual([branchId]);
  });
  it('hides the wizard entry for non-owners', () => {
    owner.set(false);
    component.open(id);
    http.expectNone(() => true);
    expect(component['isOpen']()).toBe(false);
  });
  it('accepts a real zero holder count', async () => {
    component.open(id);
    roleDetail(0);
    orgPage('companies', [{ id: companyId, name: 'Company', status: 'ACTIVE' }]);
    orgPage('branches', [{ id: branchId, companyId, name: 'Branch', status: 'ACTIVE' }]);
    http.expectOne(`${base}/${id}/branch-permissions`).flush({ success: true, data: view });
    await vi.waitFor(() => expect(component['loading']()).toBe(false));
    expect(component['loadFailed']()).toBe(false);
    expect(component['holderCount']()).toBe(0);
  });
  it.each([403, 404, 500, 0])('handles role detail failure without a zero fallback: %s', async (status) => {
    component.open(id);
    orgPage('companies', [{ id: companyId, name: 'Company', status: 'ACTIVE' }]);
    orgPage('branches', [{ id: branchId, companyId, name: 'Branch', status: 'ACTIVE' }]);
    http.expectOne(`${base}/${id}/branch-permissions`).flush({ success: true, data: view });
    const req = http.expectOne(`${base}/${id}`);
    if (status) req.flush({}, { status, statusText: 'Failure' });
    else req.error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(component['loaded']()).toBeNull();
    if (status === 403) {
      expect(component['isOpen']()).toBe(false);
      expect(notify.toasts().at(-1)?.type).toBe('error');
    } else {
      expect(component['loadFailed']()).toBe(true);
      component['retryLoad']();
      organization();
      http.expectOne(`${base}/${id}/branch-permissions`).flush({ success: true, data: view });
      await vi.waitFor(() => expect(component['loading']()).toBe(false));
      expect(component['loadFailed']()).toBe(false);
      expect(component['holderCount']()).toBe(7);
    }
  });
  it('closes the wizard on a 403 load', async () => {
    component.open(id);
    organization();
    http
      .expectOne(`${base}/${id}/branch-permissions`)
      .flush({ errorCode: 'ROLE_BRANCH_OWNER_REQUIRED' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    expect(component['isOpen']()).toBe(false);
    expect(notify.toasts().at(-1)?.type).toBe('error');
  });
  it.each([500, 0])('shows the wizard load failure with Retry: %s', async (status) => {
    component.open(id);
    organization();
    const req = http.expectOne(`${base}/${id}/branch-permissions`);
    if (status) req.flush({}, { status, statusText: 'Failure' });
    else req.error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(component['loadFailed']()).toBe(true);
    component['retryLoad']();
    organization();
    http.expectOne(`${base}/${id}/branch-permissions`).flush({ success: true, data: view });
    await vi.waitFor(() => expect(component['loading']()).toBe(false));
    expect(component['loadFailed']()).toBe(false);
  });
  it('saves branch permissions without an idempotency key', async () => {
    await open();
    edit();
    const saved = vi.fn();
    component.saved.subscribe(saved);
    const { req, pending } = save();
    expect(req.request.headers.has('x-idempotency-key')).toBe(false);
    expect(req.request.headers.get('x-csrf-token')).toBe('proof');
    expect(req.request.body).toEqual({
      expectedRevision: '1',
      catalogueRevision: 'c1',
      profiles: [{ branchId, permissionIds: [permissionId] }],
    });
    req.flush({ success: true, data: { ...view, revision: '2' } });
    await pending;
    expect(saved).toHaveBeenCalledOnce();
    expect(component['isOpen']()).toBe(false);
  });
  for (const code of ['ROLE_BRANCH_REVISION_CONFLICT', 'ROLE_BRANCH_CATALOGUE_CHANGED']) {
    it(`reloads on a revision conflict: ${code}`, async () => {
      await open();
      edit();
      const { req, pending } = save();
      req.flush({ errorCode: code }, { status: 409, statusText: 'Conflict' });
      await pending;
      expect(component['conflictOpen']()).toBe(true);
      const reload = component['reloadFromConflict']();
      organization();
      http
        .expectOne(`${base}/${id}/branch-permissions`)
        .flush({ success: true, data: { ...view, revision: '2', catalogueRevision: 'c2' } });
      await reload;
      expect(component['step']()).toBe('scope');
      expect(component['draftPermissions']().get(branchId)).toEqual([]);
      expect(component['loaded']()?.revision).toBe('2');
    });
    it(`keeps the drafts and sends the new revisions after Keep my changes: ${code}`, async () => {
      await open();
      edit();
      const { req, pending } = save();
      req.flush({ errorCode: code }, { status: 409, statusText: 'Conflict' });
      await pending;
      const drafts = component['draftPermissions']();
      const companies = component['selectedCompanyIds']();
      const keep = component['keepChangesFromConflict']();
      http.expectOne(`${base}/${id}/branch-permissions`).flush({
        success: true,
        data: { ...view, revision: '2', catalogueRevision: 'c2', profiles: [], catalogue: [] },
      });
      await keep;
      expect(component['draftPermissions']()).toBe(drafts);
      expect(component['selectedCompanyIds']()).toBe(companies);
      expect(component['selectedBranchIds']()).toEqual([branchId]);
      expect(component['step']()).toBe('review');
      expect(component['conflictOpen']()).toBe(false);
      expect(component['loaded']()?.catalogue).toEqual(view.catalogue);
      const retry = save();
      expect(retry.req.request.body).toEqual({
        expectedRevision: '2',
        catalogueRevision: 'c2',
        profiles: [{ branchId, permissionIds: [permissionId] }],
      });
      retry.req.flush({ success: true, data: view });
      await retry.pending;
    });
  }
  it.each([
    ['ROLE_BRANCH_LIMIT_EXCEEDED', 422, 'review'],
    ['ROLE_BRANCH_SCOPE_INVALID', 422, 'scope'],
    ['ROLE_BRANCH_PERMISSION_INVALID', 422, 'permissions'],
    ['ROLE_PERMISSION_AUTHORITY_EXCEEDED', 422, 'review'],
    ['CORE_VALIDATION_FAILED', 400, 'review'],
  ] as const)('maps the branch 422 codes to the right step: %s', async (code, status, step) => {
    await open();
    edit();
    const { req, pending } = save();
    req.flush(
      { errorCode: code, details: { branchIds: [branchId] } },
      { status, statusText: 'Invalid' },
    );
    await pending;
    expect(component['step']()).toBe(step);
    expect(component['draftPermissions']().get(branchId)).toEqual([permissionId]);
    if (code === 'ROLE_BRANCH_SCOPE_INVALID')
      expect(component['invalidBranchIds']().has(branchId)).toBe(true);
    expect(notify.toasts().at(-1)?.type).toBe('error');
  });
  it('confirms the seat cascade on the branch save', async () => {
    await open();
    edit();
    const { req, pending } = save();
    const body = req.request.body;
    req.flush(
      {
        errorCode: 'SEAT_ADDON_CASCADE_REQUIRED',
        details: { userIds: ['u'], userNames: ['User'], addonKeys: ['crm'], addonNames: ['CRM'] },
      },
      { status: 409, statusText: 'Conflict' },
    );
    await vi.waitFor(() => {
      const retry = http.expectOne(
        (r) => r.method === 'PUT' && r.params.get('confirmAddonCascade') === 'true',
      );
      expect(retry.request.headers.has('x-idempotency-key')).toBe(false);
      expect(retry.request.body).toEqual(body);
      retry.flush({ success: true, data: view });
    });
    await pending;
    expect(cascade.confirm).toHaveBeenCalledOnce();
  });
  it.each([401, 500, 0])('keeps the drafts and resends the same body after %s', async (status) => {
    await open();
    edit();
    const { req, pending } = save();
    const body = req.request.body;
    if (status)
      req.flush(
        {
          errorCode: status === 401 ? 'AUTH_AUTHORIZATION_STALE' : 'COMMON.GENERIC.INTERNAL_ERROR',
        },
        { status, statusText: 'Failure' },
      );
    else req.error(new ProgressEvent('error'));
    await pending;
    expect(component['dirty']()).toBe(true);
    expect(component['isOpen']()).toBe(true);
    if (status === 401) expect(notify.toasts().at(-1)?.title).toBe(staffEn.errors.notSaved);
    const retry = save();
    expect(retry.req.request.body).toEqual(body);
    expect(retry.req.request.headers.has('x-idempotency-key')).toBe(false);
    retry.req.flush({ success: true, data: view });
    await retry.pending;
  });
});
