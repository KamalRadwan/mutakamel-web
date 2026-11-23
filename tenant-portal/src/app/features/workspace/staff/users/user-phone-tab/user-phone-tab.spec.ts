import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notify } from '../../../../../core/notify/notify';
import { PhoneState } from '../../../../../core/phone/phone';
import { StaffSession } from '../../shared/staff-session';
import type { StaffPhoneChainLink, StaffPhoneExtension } from '../../shared/staff-phone.model';
import type { TenantUser } from '../../shared/staff.model';
import { UserPhoneTab } from './user-phone-tab';

const path = '/api/tenant/webphone/v1';
const stamp = '2026-11-23T00:00:00.000Z';
const user: TenantUser = { id: 'target', firstName: 'Test', lastName: 'User', email: 'test@example.invalid',
  companyId: 'company', branchId: 'branch', departmentId: 'department', teamId: null, managerId: null,
  employeeCode: null, jobTitle: null, status: 'ACTIVE', isTenantOwner: false, seats: [], createdAt: stamp, updatedAt: stamp };
const extension: StaffPhoneExtension = { id: 'extension', tenantId: 'tenant', ownerId: 'target', ownerType: 'TENANT_USER',
  extension: '1023', sipUsername: 'user1001', displayName: null, outboundCallerId: null, enabled: true,
  passwordConfigured: true, accessState: 'ACTIVE', enabledAt: stamp, createdAt: stamp, updatedAt: stamp };
const servers = ['one', 'two'].map((id, index) => ({ id, name: id, priority: index + 1, enabled: true,
  sipDomain: 'sip.example.test', websocketUrl: 'wss://sip.example.test/ws' }));
const chain: StaffPhoneChainLink[] = [{ id: 'link-one', serverId: 'one', serverName: 'one', priority: 1,
  timeoutSeconds: 15, maxRetries: 0 }, { id: 'link-two', serverId: 'two', serverName: null, priority: 2,
  timeoutSeconds: null, maxRetries: null }];
const seats = { allowed: 2, occupied: 1, available: 1, overAllowance: false,
  graceUntil: null, overCapacity: 0, overCapacitySince: null };

describe('UserPhoneTab live API', () => {
  let fixture: ComponentFixture<UserPhoneTab>;
  let tab: UserPhoneTab;
  let http: HttpTestingController;
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const canManage = signal(true);

  beforeEach(() => {
    vi.clearAllMocks(); canManage.set(true);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: StaffSession, useValue: { me: signal({ id: 'actor' }), isOwner: () => true,
        isTenantWide: () => canManage() } },
      { provide: Notify, useValue: notify },
      { provide: PhoneState, useValue: { reload: vi.fn() } },
      { provide: TranslocoService, useValue: { events$: new Subject(), translate: (key: string) => key } },
    ] });
    TestBed.overrideComponent(UserPhoneTab, { set: { template: '', imports: [] } });
    const doc = TestBed.inject(DOCUMENT);
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=csrf`);
    fixture = TestBed.createComponent(UserPhoneTab); tab = fixture.componentInstance;
    fixture.componentRef.setInput('user', user);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  async function settle() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
  function flush(url: string, data: unknown) { http.expectOne(`${path}/${url}`).flush({ success: true, data }); }
  async function start(existing = true) {
    fixture.detectChanges();
    flush('servers', servers); flush('seats', seats);
    const req = http.expectOne(`${path}/extensions/by-owner/target`);
    if (existing) req.flush({ success: true, data: extension });
    else req.flush({ errorCode: 'WEBPHONE_EXTENSION_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await settle();
    if (existing) flush('extensions/extension/servers', chain);
    await settle();
  }
  async function refresh(data = extension, links = chain) {
    await settle(); flush('extensions/by-owner/target', data); flush('seats', seats);
    await settle(); flush('extensions/extension/servers', links); await settle();
  }

  it('loads the real extension, ordered chain and seats', async () => {
    await start();
    expect(tab['loading']()).toBe(false); expect(tab['fullState']()).toBeNull();
    expect(tab['extension']()).toEqual(extension); expect(tab['chainDraft']()).toEqual(['one', 'two']);
    expect(tab['seats']()).toEqual(seats); expect(tab.dirty()).toBe(false);
  });

  it('preserves timeout/retry overrides when replacing a reordered chain', async () => {
    await start(); tab['moveServerDown'](0);
    const pending = tab.save();
    const req = http.expectOne({ method: 'PUT', url: `${path}/extensions/extension/servers` });
    expect(req.request.body).toEqual({ servers: [
      { serverId: 'two', timeoutSeconds: null, maxRetries: null },
      { serverId: 'one', timeoutSeconds: 15, maxRetries: 0 },
    ] });
    const reordered = [{ ...chain[1], priority: 1 }, { ...chain[0], priority: 2 }];
    req.flush({ success: true, data: reordered }); await refresh(extension, reordered);
    await expect(pending).resolves.toBe(true); expect(tab.dirty()).toBe(false);
    expect(notify.success).toHaveBeenCalledWith('userPhone.toast.saved');
  });

  it('keeps a failed chain write retryable after a successful create, without creating twice', async () => {
    await start(false);
    tab['extensionDraft'].set('1023'); tab['sipUsernameDraft'].set('user1001'); tab['chainDraft'].set(['two']);
    const pending = tab.save();
    const create = http.expectOne({ method: 'POST', url: `${path}/extensions` });
    const created = { ...extension, enabled: false, enabledAt: null };
    create.flush({ success: true, data: created }, { status: 201, statusText: 'Created' }); await settle();
    const firstPut = http.expectOne({ method: 'PUT', url: `${path}/extensions/extension/servers` });
    const firstKey = firstPut.request.headers.get('x-idempotency-key');
    firstPut.flush({ errorCode: 'COMMON.GENERIC.INTERNAL_ERROR' }, { status: 500, statusText: 'Error' });
    await expect(pending).resolves.toBe(false); expect(tab.dirty()).toBe(true);
    const retry = tab.save();
    http.expectNone((req) => req.method === 'POST' || req.method === 'PATCH');
    const secondPut = http.expectOne({ method: 'PUT', url: `${path}/extensions/extension/servers` });
    expect(secondPut.request.headers.get('x-idempotency-key')).toBe(firstKey);
    secondPut.flush({ success: true, data: [chain[1]] }); await refresh(created, [chain[1]]);
    await expect(retry).resolves.toBe(true); expect(tab.dirty()).toBe(false);
  });

  it('retains the same idempotency key on an unchanged failed extension write', async () => {
    await start(); tab['displayNameDraft'].set('Changed');
    const first = tab.save();
    const req = http.expectOne({ method: 'PATCH', url: `${path}/extensions/extension` });
    expect(req.request.body).toEqual({ displayName: 'Changed' });
    const key = req.request.headers.get('x-idempotency-key');
    req.flush({ errorCode: 'COMMON.GENERIC.INTERNAL_ERROR' }, { status: 500, statusText: 'Error' });
    await expect(first).resolves.toBe(false);
    const second = tab.save(); const retry = http.expectOne(`${path}/extensions/extension`);
    expect(retry.request.headers.get('x-idempotency-key')).toBe(key);
    const updated = { ...extension, displayName: 'Changed' };
    retry.flush({ success: true, data: updated }); await refresh(updated);
    await expect(second).resolves.toBe(true);
  });

  it.each([
    ['WEBPHONE_EXTENSION_TAKEN', 'extensionError', 'userPhone.validation.extensionTaken'],
    ['WEBPHONE_SIP_USERNAME_TAKEN', 'sipUsernameError', 'userPhone.validation.sipUsernameTaken'],
    ['WEBPHONE_CONFIG_INCOMPLETE', 'passwordError', 'userPhone.validation.passwordRequiredToEnable'],
  ] as const)('maps %s to existing translated field feedback', async (code, field, message) => {
    await start(); tab['displayNameDraft'].set('Changed');
    const pending = tab.save();
    http.expectOne(`${path}/extensions/extension`).flush({ errorCode: code }, { status: 422, statusText: 'Rejected' });
    await expect(pending).resolves.toBe(false);
    expect(tab[field]()).toBe(message); expect(notify.success).not.toHaveBeenCalled();
  });

  it.each([
    ['WEBPHONE_MODULE_NOT_PURCHASED', 'notPurchased'],
    ['WEBPHONE_PROVISIONING_PENDING', 'provisioning'],
    ['COMMON.GENERIC.FORBIDDEN', 'loadFailed'],
  ])('uses the existing full state for %s and never enables saving', async (code, state) => {
    fixture.detectChanges(); flush('servers', servers); flush('seats', seats);
    http.expectOne(`${path}/extensions/by-owner/target`).flush({ errorCode: code }, { status: 403, statusText: 'Forbidden' });
    await settle(); expect(tab['fullState']()).toBe(state); await expect(tab.save()).resolves.toBe(false);
    http.expectNone((req) => req.method !== 'GET');
  });

  it('uses the existing no-server empty state without creating placeholder servers', async () => {
    fixture.detectChanges(); flush('servers', []); flush('seats', seats); flush('extensions/by-owner/target', extension);
    await settle(); expect(tab['fullState']()).toBe('noServers'); expect(tab['scopeServers']()).toEqual([]);
    await expect(tab.save()).resolves.toBe(false);
  });

  it('ignores stale load results when the selected user changes', async () => {
    fixture.detectChanges();
    const old = http.match((req) => req.method === 'GET');
    fixture.componentRef.setInput('user', { ...user, id: 'next' }); fixture.detectChanges();
    flush('servers', servers); flush('seats', seats); flush('extensions/by-owner/next', { ...extension, id: 'next-extension', ownerId: 'next' });
    await settle(); flush('extensions/next-extension/servers', []); await settle();
    for (const req of old) req.flush({ success: true, data: req.request.url.endsWith('/servers') ? [] : extension });
    await settle(); expect(tab['extension']()?.ownerId).toBe('next'); expect(tab['chainDraft']()).toEqual([]);
  });

  it('blocks writes for a read-only user', async () => {
    await start(); canManage.set(false); tab['displayNameDraft'].set('Changed');
    await expect(tab.save()).resolves.toBe(false); http.expectNone((req) => req.method !== 'GET');
  });
});
