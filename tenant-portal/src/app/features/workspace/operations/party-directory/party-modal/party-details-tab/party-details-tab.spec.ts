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
import { PartyDetailsTab } from './party-details-tab';

describe('PartyDetailsTab', () => {
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
  function create(mode: 'create' | 'edit' = 'edit') {
    const fixture = TestBed.createComponent(PartyDetailsTab);
    fixture.componentRef.setInput('mode', mode); fixture.componentRef.setInput('partyType', 'PERSON');
    fixture.componentRef.setInput('party', mode === 'edit' ? { ...party } : null);
    fixture.componentRef.setInput('limits', ruleLimits); fixture.detectChanges();
    return fixture;
  }
  it('save shows a toast and refreshes', async () => {
    const f = create(); const c = f.componentInstance; const saved = vi.fn(); c.saved.subscribe(saved);
    c['textDraft'].update((d) => ({ ...d, displayName: 'Changed' }));
    expect(await c.save()).toBe(true); expect(api.updateParty).toHaveBeenCalledWith('p', { displayName: 'Changed' });
    expect(saved).toHaveBeenCalledWith(party); expect(notify.success).toHaveBeenCalled();
  });
  it('validation errors land on the fields', async () => {
    const c = create().componentInstance;
    c['handleSaveError'](new ApiError(400, 'CORE_VALIDATION_FAILED', { firstName: ['max_length'], ownerUserId: ['is_uuid'] }));
    expect(c['fieldError']('firstName', c['detailsForm'].firstName(), 120)).toBe('Check this field.');
    expect(c['ownerError']()).toBe('Check this field.'); expect(notify.error).not.toHaveBeenCalled();
  });
  it('a 401 on save keeps the form', async () => {
    const c = create().componentInstance; c['textDraft'].update((d) => ({ ...d, displayName: 'Unsaved' }));
    api.updateParty.mockRejectedValue(new ApiError(401, 'AUTH_ACCESS_EXPIRED'));
    expect(await c.save()).toBe(false); expect(c['textDraft']().displayName).toBe('Unsaved');
    expect(c.dirty()).toBe(true); expect(notify.error).toHaveBeenCalledWith('Not saved. Try again.');
  });
  it('a 403 on save shows a toast', async () => {
    const c = create().componentInstance;
    for (const code of ['TENANT_WIDE_PERMISSION_REQUIRED', 'BRANCH_PERMISSION_DENIED']) c['handleSaveError'](new ApiError(403, code));
    expect(notify.error).toHaveBeenCalledTimes(2);
  });
  it('a 404 on save closes the modal', async () => {
    const c = create().componentInstance; const deleted = vi.fn(); c.deletedRemotely.subscribe(deleted);
    c['textDraft'].update((d) => ({ ...d, displayName: 'Changed' })); api.updateParty.mockRejectedValue(new ApiError(404, 'PARTY_NOT_FOUND'));
    expect(await c.save()).toBe(false); expect(deleted).toHaveBeenCalledOnce();
  });
  it('duplicate phone or mobile message', () => {
    const c = create('create').componentInstance;
    for (const methodType of ['PHONE', 'MOBILE'] as const) {
      c['contactRows'].set([{ id: 1, methodType, value: '+2011', label: '' }]);
      c['handleSaveError'](new ApiError(409, 'PARTY_DUPLICATE_CONTACT_METHOD'));
      expect(c['contactValidationMap']()[1].value).toBe('This number is already used by another party');
    }
  });
  it('duplicate role on create is a field message', () => {
    const c = create('create').componentInstance; c['handleSaveError'](new ApiError(409, 'PARTY_ROLE_ALREADY_EXISTS'));
    expect(c['roleError']()).toBeTruthy(); expect(notify.error).not.toHaveBeenCalled();
  });
  it('422 field codes land on their fields', () => {
    const c = create().componentInstance;
    for (const code of ['PARTY_FIELDS_INVALID', 'PARTY_BRANCH_INVALID', 'PARTY_OWNER_INVALID']) c['handleSaveError'](new ApiError(422, code));
    expect(c['displayNameError']()).toBeTruthy(); expect(c['branchError']()).toBeTruthy(); expect(c['ownerError']()).toBeTruthy();
  });
  it('limit and batch codes show a toast', () => {
    const c = create('create').componentInstance;
    for (const code of ['PARTY_CONTACT_METHOD_LIMIT_EXCEEDED', 'PARTY_ROLE_LIMIT_EXCEEDED', 'PARTY_CHILD_BATCH_INVALID']) c['handleSaveError'](new ApiError(422, code));
    expect(notify.error).toHaveBeenCalledTimes(3);
  });
  it('a 5xx keeps the form', async () => {
    const c = create().componentInstance; c['textDraft'].update((d) => ({ ...d, displayName: 'Unsaved' }));
    for (const status of [500, 0]) {
      api.updateParty.mockRejectedValue(new ApiError(status, 'INTERNAL_ERROR'));
      expect(await c.save()).toBe(false); expect(c['textDraft']().displayName).toBe('Unsaved');
    }
    expect(notify.error).toHaveBeenCalledTimes(2);
  });
  it('image upload shows the new image', async () => {
    const f = create(); const c = f.componentInstance; const image = { ...party, imageUrl: '/api/tenant/core/v1/directory/parties/p/image?v=2' };
    api.uploadPartyImage.mockResolvedValue(image); c.imageChanged.subscribe((value) => f.componentRef.setInput('party', value));
    await c['onImagePicked'](new File(['image'], 'image.png', { type: 'image/png' })); f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('img')?.getAttribute('src')).toBe(image.imageUrl);
  });
  it('missing image file is a field message', async () => {
    const c = create().componentInstance; api.uploadPartyImage.mockRejectedValue(new ApiError(400, 'PARTY_IMAGE_REQUIRED'));
    await c['onImagePicked'](new File([], 'image.png')); expect(c['imageError']()).toBeTruthy(); expect(notify.error).not.toHaveBeenCalled();
  });
  it('too large or invalid image is a field message', async () => {
    const c = create().componentInstance;
    for (const [status, code] of [[413,'PARTY_IMAGE_TOO_LARGE'],[413,'GW.BODY.TOO_LARGE'],[415,'PARTY_IMAGE_INVALID']] as const) {
      api.uploadPartyImage.mockRejectedValue(new ApiError(status, code)); await c['onImagePicked'](new File([], 'image.png'));
      expect(c['imageError']()).toBeTruthy();
    }
    expect(notify.error).not.toHaveBeenCalled();
  });
  it('image 403 shows a toast', async () => {
    const f = create(); const c = f.componentInstance; api.uploadPartyImage.mockRejectedValue(new ApiError(403, 'BRANCH_PERMISSION_DENIED'));
    await c['onImagePicked'](new File([], 'image.png')); expect(notify.error).toHaveBeenCalledOnce();
  });
  it('image storage unavailable toast', async () => {
    const c = create().componentInstance; api.uploadPartyImage.mockRejectedValue(new ApiError(503, 'PARTY_IMAGE_STORAGE_UNAVAILABLE'));
    await c['onImagePicked'](new File([], 'image.png')); expect(notify.error).toHaveBeenCalledOnce();
  });
  it('missing image shows the placeholder', async () => {
    const f = create(); const c = f.componentInstance; f.componentRef.setInput('party', { ...party, imageUrl: '/api/tenant/core/v1/directory/parties/p/image?v=1' }); f.detectChanges();
    api.deletePartyImage.mockRejectedValue(new ApiError(404, 'PARTY_IMAGE_NOT_FOUND'));
    c.imageChanged.subscribe((value) => f.componentRef.setInput('party', value)); await c['removeImage'](); f.detectChanges();
    expect(c['imageSrc']()).toBeNull(); expect((f.nativeElement as HTMLElement).querySelector('img')).toBeNull();
    f.componentRef.setInput('party', { ...party, imageUrl: '/api/tenant/core/v1/directory/parties/p/image?v=2' }); f.detectChanges();
    (f.nativeElement as HTMLElement).querySelector('img')?.dispatchEvent(new Event('error')); f.detectChanges(); expect(c['imageSrc']()).toBeNull();
  });
  it('a 429 shows the rate-limit message', () => {
    const c = create().componentInstance; c['handleSaveError'](new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['7'] }));
    expect(notify.error).toHaveBeenCalledWith('Too many requests, try again in 7 s');
  });
});
