import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../../core/api/api-errors';
import { Notify } from '../../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../../core/scope/tenant-scope';
import { WorkspaceLookups } from '../../../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { PartyDirectoryApi } from '../../party-directory.api';
import type { PartyDetail } from '../../party-directory.model';

const party: PartyDetail = {
  id: 'p', partyType: 'PERSON', displayName: 'Test party', legalName: null, firstName: 'Test', lastName: 'Party',
  honorificTitle: null, jobTitle: null, organizationName: null, taxNumber: null, commercialRegistrationNumber: null,
  branchId: 'branch-a', ownerUserId: null, status: 'ACTIVE', imageUrl: null, imageKind: 'PHOTO', imageRevision: null,
  createdAt: '2026-11-23T10:00:00Z', updatedAt: '2026-11-23T10:00:00Z', deletedAt: null,
  contactMethods: [], addresses: [], roles: [],
};
const meta = { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false };
const ruleLimits = { maxContactMethodsPerParty: 47, maxAddressesPerParty: 31 };
const nativeDialogShow = HTMLDialogElement.prototype.showModal;
const nativeDialogClose = HTMLDialogElement.prototype.close;
class EmptyLoader { getTranslation() { return of({}); } }
const keys: Record<string, string> = {
  'apiErrors.notSaved': 'Not saved. Try again.', 'apiErrors.generic': 'Could not save.',
  'apiErrors.rateLimitedIn': 'Too many requests, try again in {{seconds}} s',
  'apiErrors.validation': 'Check this field.', 'apiErrors.permission': 'Access denied.',
  'apiErrors.tooLarge': 'File or content too large',
  'wsPartyModal.contacts.duplicateNumber': 'This number is already used by another party',
  'wsPartyModal.contacts.duplicateEmail': 'This email is already used by another party',
  'wsPartyModal.errors.PARTY_NOT_FOUND': 'This party is no longer available.',
};
function translation(key: string, params?: Record<string, unknown>): string {
  return (keys[key] ?? key).replace(/{{(\w+)}}/g, (_, name: string) => String(params?.[name] ?? ''));
}

import { PartyRolesTab } from './party-roles-tab';

describe('PartyRolesTab', () => {
  const me = signal({ id: 'actor', isTenantOwner: true, permissions: [] as string[], permissionScopes: {} as Record<string, { tenantWide: boolean; companyIds: string[]; branchIds: string[] }> });
  const api = { getParty: vi.fn(), createParty: vi.fn(), updateParty: vi.fn(), deleteParty: vi.fn(), getPartyRules: vi.fn(),
    uploadPartyImage: vi.fn(), deletePartyImage: vi.fn(), addContactMethod: vi.fn(), updateContactMethod: vi.fn(), deleteContactMethod: vi.fn(),
    addAddress: vi.fn(), updateAddress: vi.fn(), deleteAddress: vi.fn(), addRole: vi.fn(), deleteRole: vi.fn(),
    listParties: vi.fn(), listOrgContacts: vi.fn(), addRelationship: vi.fn(), deleteRelationship: vi.fn() };
  const lookups = { allBranches: vi.fn(), users: vi.fn(), user: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    me.set({ id: 'actor', isTenantOwner: true, permissions: [], permissionScopes: {} });
    api.getParty.mockResolvedValue({ ...party }); api.getPartyRules.mockResolvedValue(ruleLimits);
    api.createParty.mockResolvedValue({ ...party }); api.updateParty.mockResolvedValue({ ...party });
    api.listParties.mockResolvedValue({ data: [], meta }); api.listOrgContacts.mockResolvedValue({ data: [], meta });
    lookups.allBranches.mockResolvedValue([]); lookups.users.mockResolvedValue({ data: [], meta }); lookups.user.mockRejectedValue(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: EmptyLoader }),
      { provide: PartyDirectoryApi, useValue: api }, { provide: WorkspaceLookups, useValue: lookups },
      { provide: TenantScopeState, useValue: { me, selection: signal(null) } }, { provide: Notify, useValue: notify },
      
    ] });
    vi.spyOn(TestBed.inject(TranslocoService), 'translate').mockImplementation(translation as never);
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); vi.restoreAllMocks(); HTMLDialogElement.prototype.showModal = nativeDialogShow; HTMLDialogElement.prototype.close = nativeDialogClose; });

  const role = { id: 'r', partyId: 'p', roleType: 'CUSTOMER', branchId: 'branch-a', status: 'ACTIVE', appSource: 'core-app', metadata: {}, createdAt: '', updatedAt: '' } as const;
  function create() {
    const f = TestBed.createComponent(PartyRolesTab); f.componentRef.setInput('party', { ...party, roles: [role] });
    f.componentRef.setInput('branches', [{ id: 'branch-a', name: 'A', status: 'ACTIVE' }, { id: 'branch-b', name: 'B', status: 'ACTIVE' }]); f.detectChanges(); return f;
  }
  it('a 403 shows a toast', async () => {
    const c = create().componentInstance; c['openAddForm'](); api.addRole.mockRejectedValue(new ApiError(403, 'BRANCH_PERMISSION_DENIED'));
    await c['saveAdd'](); expect(notify.error).toHaveBeenCalledOnce();
  });
  it('app-managed role shows a toast', async () => {
    const c = create().componentInstance; vi.spyOn(c['removeConfirm'](), 'open').mockResolvedValue(true); api.deleteRole.mockRejectedValue(new ApiError(409, 'PARTY_ROLE_MANAGED_BY_APP'));
    await c['removeRole'](role); expect(notify.error).toHaveBeenCalledOnce();
    expect(c['canRemove']({ ...role, appSource: 'crm-app' })).toBe(false);
  });
  it('needs role.manage on the party branch and the role branch', () => {
    const f = create(); const c = f.componentInstance;
    me.set({ id: 'actor', isTenantOwner: false, permissions: ['directory.role.manage'], permissionScopes: { 'directory.role.manage': { tenantWide: false, companyIds: [], branchIds: ['branch-b'] } } });
    f.detectChanges(); expect(c['branchOptions']()).toEqual([]); expect(c['canRemove']({ ...role, branchId: 'branch-b' })).toBe(false);
    me.set({ id: 'actor', isTenantOwner: false, permissions: ['directory.role.manage'], permissionScopes: { 'directory.role.manage': { tenantWide: false, companyIds: [], branchIds: ['branch-a'] } } });
    f.detectChanges(); expect(c['branchOptions']().map((o) => o.value)).toEqual(['branch-a']); expect(c['canRemove']({ ...role, branchId: 'branch-b' })).toBe(false); expect(c['canRemove']({ ...role, branchId: null })).toBe(false);
    expect(c['canRemove'](role)).toBe(true);
    f.componentRef.setInput('party', { ...party, branchId: null }); f.detectChanges(); expect(c['branchOptions']()).toEqual([]);
  });
  it('honours readonly', async () => {
    const f = create(); const c = f.componentInstance; f.componentRef.setInput('readonly', true); f.detectChanges();
    expect(c['canAddAnyRole']()).toBe(false); expect(c['canRemove'](role)).toBe(false);
    await c['saveAdd'](); await c['removeRole'](role); expect(api.addRole).not.toHaveBeenCalled(); expect(api.deleteRole).not.toHaveBeenCalled();
  });
});
