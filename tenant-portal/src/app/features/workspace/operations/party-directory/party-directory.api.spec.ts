import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { PartyDirectoryApi, partyImageSrc } from './party-directory.api';
import type { ListPartiesQuery } from './party-directory.model';


const root = '/api/tenant/core/v1/directory';
const meta = { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false };

describe('PartyDirectoryApi', () => {
  let api: PartyDirectoryApi;
  let http: HttpTestingController;
  let cookie: string;
  const me = signal({ id: 'actor', isTenantOwner: true, permissions: [] as string[], permissionScopes: {} });
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: TenantScopeState, useValue: { me, selection: signal(null) } },
    ] });
    const doc = TestBed.inject(DOCUMENT);
    cookie = `${doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=proof`;
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);
    api = TestBed.inject(PartyDirectoryApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('listParties returns the Core page', async () => {
    const pending = api.listParties();
    const request = http.expectOne(`${root}/parties?limit=20`);
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data: [], meta });
    await expect(pending).resolves.toEqual({ data: [], meta });
  });
  it('listParties sends only declared filters', async () => {
    const q = { page: 2, limit: 50, sortBy: 'displayName', sortDir: 'ASC', search: 'Acme',
      partyType: 'ORGANIZATION', status: 'ACTIVE', roleType: 'CUSTOMER', branchId: 'branch',
      ownerUserId: 'owner', unknownFilter: true } as ListPartiesQuery;
    const pending = api.listParties(q);
    const request = http.expectOne((req) => req.url === `${root}/parties`);
    expect(request.request.params.keys().sort()).toEqual(['page','limit','sortBy','sortDir','search','partyType','status','roleType','branchId','ownerUserId'].sort());
    request.flush({ success: true, data: [], meta });
    await pending;
  });
  it('listParties never asks for more than 100', async () => {
    const pending = api.listParties({ limit: 500 });
    http.expectOne(`${root}/parties?limit=100`).flush({ success: true, data: [], meta: { ...meta, limit: 100 } });
    await pending;
  });
  it('rejects a malformed Core success envelope', async () => {
    const pending = api.getParty('p');
    http.expectOne(`${root}/parties/p`).flush({ data: { id: 'p' } });
    await expect(pending).rejects.toMatchObject({ code: 'COMMON.GENERIC.INTERNAL_ERROR', status: 502 });
  });
  it('partyImageSrc keeps the public path', () => {
    expect(partyImageSrc({ imageUrl: `${root}/parties/p/image?v=3` })).toBe(`${root}/parties/p/image?v=3`);
  });
  it('partyImageSrc maps the internal path', () => {
    expect(partyImageSrc({ imageUrl: '/api/v1/tenant/directory/parties/p/image?v=3' })).toBe(`${root}/parties/p/image?v=3`);
  });
  it('partyImageSrc keeps fake URLs and rejects others', () => {
    for (const imageUrl of ['data:image/png;base64,a', 'blob:https://example.test/a']) expect(partyImageSrc({ imageUrl })).toBe(imageUrl);
    for (const imageUrl of ['', 'https://untrusted.test/a', '/other']) expect(partyImageSrc({ imageUrl })).toBeNull();
    expect(partyImageSrc(null)).toBeNull();
  });
  function writes(api: PartyDirectoryApi) {
    return [
      { name: 'createParty', method: 'POST', path: '/parties', run: () => api.createParty({ partyType: 'PERSON', displayName: 'Test' }) },
      { name: 'updateParty', method: 'PATCH', path: '/parties/p', run: () => api.updateParty('p', { displayName: 'Updated' }) },
      { name: 'deleteParty', method: 'DELETE', path: '/parties/p', run: () => api.deleteParty('p') },
      { name: 'uploadPartyImage', method: 'POST', path: '/parties/p/image', run: () => api.uploadPartyImage('p', new File(['image'], 'a.png', { type: 'image/png' })) },
      { name: 'deletePartyImage', method: 'DELETE', path: '/parties/p/image', run: () => api.deletePartyImage('p') },
      { name: 'addContactMethod', method: 'POST', path: '/parties/p/contact-methods', run: () => api.addContactMethod('p', { methodType: 'PHONE', value: '+2011' }) },
      { name: 'updateContactMethod', method: 'PATCH', path: '/contact-methods/c', run: () => api.updateContactMethod('c', { value: '+2012' }) },
      { name: 'deleteContactMethod', method: 'DELETE', path: '/contact-methods/c', run: () => api.deleteContactMethod('c') },
      { name: 'addAddress', method: 'POST', path: '/parties/p/addresses', run: () => api.addAddress('p', { addressType: 'WORK' }) },
      { name: 'updateAddress', method: 'PATCH', path: '/addresses/a', run: () => api.updateAddress('a', { city: 'Cairo' }) },
      { name: 'deleteAddress', method: 'DELETE', path: '/addresses/a', run: () => api.deleteAddress('a') },
      { name: 'addRole', method: 'POST', path: '/parties/p/roles', run: () => api.addRole('p', { roleType: 'CUSTOMER' }) },
      { name: 'deleteRole', method: 'DELETE', path: '/party-roles/r', run: () => api.deleteRole('r') },
      { name: 'addRelationship', method: 'POST', path: '/relationships', run: () => api.addRelationship({ fromPartyId: 'p', toPartyId: 'q', relationshipType: 'CONTACT_PERSON' }) },
      { name: 'deleteRelationship', method: 'DELETE', path: '/relationships/r', run: () => api.deleteRelationship('r') },
    ];
  }
  it('party writes send CSRF and no idempotency key', async () => {
    for (const action of writes(api)) {
      const pending = action.run();
      const request = http.expectOne(root + action.path);
      expect(request.request.method, action.name).toBe(action.method);
      expect(request.request.withCredentials).toBe(true);
      expect(request.request.headers.get('x-csrf-token')).toBe('proof');
      expect(request.request.headers.has('x-idempotency-key')).toBe(false);
      expect(request.request.headers.has('If-Match')).toBe(false);
      if (action.name === 'uploadPartyImage') {
        expect(request.request.body).toBeInstanceOf(FormData);
        expect(request.request.body.get('file').name).toBe('a.png');
        expect(request.request.headers.has('Content-Type')).toBe(false);
      }
      const status = action.method === 'DELETE' ? 204 : action.method === 'POST' ? 201 : 200;
      request.flush(status === 204 ? null : { success: true, data: { id: 'saved' } }, { status, statusText: 'OK' });
      await pending;
    }
  });
  it('every write rejects a missing CSRF cookie without a request', async () => {
    cookie = '';
    for (const action of writes(api)) await expect(action.run()).rejects.toMatchObject({ status: 403, code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone((req) => req.url.startsWith(root));
  });
  it('listOrgContacts reads paging only', async () => {
    const pending = api.listOrgContacts('p', { page: 2, limit: 200, unknownFilter: true } as never);
    http.expectOne(`${root}/parties/p/contacts?page=2&limit=100`).flush({ success: true, data: [], meta });
    await pending;
  });
  it('a write invalidates data before the next detail read', async () => {
    const first = api.getParty('p');
    http.expectOne(`${root}/parties/p`).flush({ success: true, data: { id: 'p', displayName: 'Old' } });
    await first;
    const write = api.updateParty('p', { displayName: 'New' });
    http.expectOne(`${root}/parties/p`).flush({ success: true, data: { id: 'p', displayName: 'New' } });
    await write;
    const fresh = api.getParty('p');
    http.expectOne(`${root}/parties/p`).flush({ success: true, data: { id: 'p', displayName: 'New' } });
    await expect(fresh).resolves.toMatchObject({ displayName: 'New' });
  });
  it('partyImageSrc keeps the public path', () => {
    expect(partyImageSrc({ imageUrl: `${root}/parties/p/image?v=2` })).toBe(`${root}/parties/p/image?v=2`);
  });
  it('partyImageSrc maps the internal path', () => {
    expect(partyImageSrc({ imageUrl: '/api/v1/tenant/directory/parties/p/image?v=2' })).toBe(`${root}/parties/p/image?v=2`);
  });
  it('partyImageSrc keeps fake URLs and rejects others', () => {
    for (const imageUrl of ['data:image/png;base64,a', 'blob:fixture']) expect(partyImageSrc({ imageUrl })).toBe(imageUrl);
    for (const imageUrl of ['https://example.invalid/image.png','/other/path']) expect(partyImageSrc({ imageUrl })).toBeNull();
  });
  it('getPartyRules reads the party rules route', async () => {
    // The route is absent on Core main. The brief requires the marked fake until BE-DIR + BE-GW.
    await expect(api.getPartyRules()).resolves.toMatchObject({ version: 1, maxContactMethodsPerParty: expect.any(Number) });
    http.expectNone(`${root}/party-rules`);
  });

});
