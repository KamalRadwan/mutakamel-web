import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { WorkspaceLookups } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { PartyDirectoryApi } from '../party-directory.api';
import type { PartyDetail } from '../party-directory.model';

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

import { PartyModal } from './party-modal';

describe('PartyModal', () => {
  const me = signal({ id: 'actor', isTenantOwner: true, permissions: [] as string[], permissionScopes: {} as Record<string, { tenantWide: boolean; companyIds: string[]; branchIds: string[] }> });
  const api = { getParty: vi.fn(), createParty: vi.fn(), updateParty: vi.fn(), deleteParty: vi.fn(), getPartyRules: vi.fn(),
    uploadPartyImage: vi.fn(), deletePartyImage: vi.fn(), addContactMethod: vi.fn(), updateContactMethod: vi.fn(), deleteContactMethod: vi.fn(),
    addAddress: vi.fn(), updateAddress: vi.fn(), deleteAddress: vi.fn(), addRole: vi.fn(), deleteRole: vi.fn(),
    listParties: vi.fn(), listOrgContacts: vi.fn(), addRelationship: vi.fn(), deleteRelationship: vi.fn() };
  const lookups = { allBranches: vi.fn(), users: vi.fn(), user: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  beforeEach(() => {
    api.getParty.mockReset().mockResolvedValue(party); api.getPartyRules.mockReset().mockResolvedValue(ruleLimits); notify.error.mockClear();
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

  function create() { const f = TestBed.createComponent(PartyModal); f.detectChanges(); return f; }
  it('opens with the party detail', async () => {
    const f = create(); const c = f.componentInstance; c.openParty('p'); await f.whenStable();
    expect(c['party']()).toEqual(party); expect((f.nativeElement as HTMLElement).querySelector('dialog')?.open).toBe(true);
  });
  it('a 403 on open closes with a toast', async () => {
    const f = create(); api.getParty.mockRejectedValue(new ApiError(403, 'BRANCH_PERMISSION_DENIED'));
    f.componentInstance.openParty('p'); await f.whenStable(); expect((f.nativeElement as HTMLElement).querySelector('dialog')?.open).toBe(false); expect(notify.error).toHaveBeenCalledWith('wsPartyModal.noAccess');
  });
  it('a 404 closes and refreshes the list', async () => {
    const f = create(); api.getParty.mockRejectedValue(new ApiError(404, 'PARTY_NOT_FOUND')); const changed = vi.fn(); f.componentInstance.changed.subscribe(changed);
    f.componentInstance.openParty('p'); await f.whenStable(); expect(changed).toHaveBeenCalledWith({ id: 'p', deleted: true }); expect((f.nativeElement as HTMLElement).querySelector('dialog')?.open).toBe(false);
  });
  it('a 5xx shows the modal load failure', async () => {
    const f = create(); api.getParty.mockRejectedValue(new ApiError(503, 'INTERNAL_ERROR'));
    f.componentInstance.openParty('p'); await f.whenStable(); f.detectChanges(); expect(f.componentInstance['loadFailed']()).toBe(true); expect((f.nativeElement as HTMLElement).querySelector('ui-full-state')).not.toBeNull();
    api.getParty.mockResolvedValue(party); f.componentInstance['retryLoad'](); await f.whenStable(); expect(f.componentInstance['party']()).toEqual(party);
  });
  it('uses the party rules limits', async () => {
    const f = create(); await f.componentInstance['loadLookups'](); expect(f.componentInstance['limits']()).toEqual(ruleLimits);
    expect(api.getPartyRules).toHaveBeenCalled();
  });
  it('party rules failure falls back to the server', async () => {
    const f = create();
    for (const status of [403, 503, 0]) { api.getPartyRules.mockRejectedValue(new ApiError(status, 'INTERNAL_ERROR')); await f.componentInstance['loadLookups'](); expect(f.componentInstance['limits']()).toEqual({ maxContactMethodsPerParty: null, maxAddressesPerParty: null }); }
    expect(notify.error).not.toHaveBeenCalled();
  });
});
