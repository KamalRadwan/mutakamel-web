import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { StaffPhoneApi, toCallLogTypeParam } from './staff-phone.api';
import type { StaffPhoneExtension, StaffPhoneChainLink, StaffPhoneServer, StaffUserCallLog } from './staff-phone.model';

const path = '/api/tenant/webphone/v1';
const key = '019f0000-0000-7000-8000-000000000001';
const extension: StaffPhoneExtension = {
  id: 'extension', tenantId: 'tenant', ownerId: 'owner', ownerType: 'TENANT_USER',
  extension: 'SQ_1023', sipUsername: 'user1001', displayName: null, outboundCallerId: null,
  enabled: false, passwordConfigured: true, accessState: 'ACTIVE', enabledAt: null,
  createdAt: '2026-11-23T08:00:00Z', updatedAt: '2026-11-23T08:00:00Z',
};
const chain: StaffPhoneChainLink[] = [{
  id: 'link', serverId: 'server', serverName: null, priority: 1, timeoutSeconds: 15, maxRetries: 0,
}];
const server: StaffPhoneServer = {
  id: 'server', tenantId: 'tenant', name: 'Primary', priority: 1, sipDomain: 'sip.example.test',
  websocketUrl: 'wss://sip.example.test/ws', enabled: true, realm: null, outboundProxy: null,
  fromDomain: null, registrarServer: null, contactUri: null, registerExpires: 600,
  defaultCallerId: null, iceTransportPolicy: 'all', iceEnabled: true, traceSip: false,
  sessionTimers: true, allowInvalidTlsCertificate: false, defaultTimeoutSeconds: 20, defaultMaxRetries: 2,
  iceServers: [{ id: 'ice', kind: 'TURN', urls: ['turn:example.test'], username: null,
    credentialConfigured: true, enabled: false, sortOrder: 1 }],
  createdAt: extension.createdAt, updatedAt: extension.updatedAt,
};
const seats = { allowed: 2, occupied: 3, available: 0, overAllowance: true,
  graceUntil: null, overCapacity: 1, overCapacitySince: extension.createdAt };
const log: StaffUserCallLog = {
  id: 'call', tenantId: 'tenant', extensionId: 'extension', ownerId: 'owner', ownerName: null,
  type: 'IN_NOANS', displayName: null, phoneNumber: '+201001234567', phoneDigits: '201001234567',
  startedAt: null, answeredAt: null, endedAt: null, durationSeconds: null, cause: 'Timeout',
  createdAt: extension.createdAt, sourceType: null, sourceId: null, sourceLabel: null,
  transferKind: 'ATTENDED', conferenceId: 'conference', extension: null,
};

describe('StaffPhoneApi HTTP contracts', () => {
  let api: StaffPhoneApi;
  let http: HttpTestingController;
  let cookie: string;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    cookie = `${name}=csrf-proof`;
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);
    api = TestBed.inject(StaffPhoneApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('reads an owner extension without narrowing server string enums or dropping nullable fields', async () => {
    const data = { ...extension, ownerType: 'ADDITIVE_OWNER', accessState: 'ADDITIVE_STATE' };
    const pending = api.getExtensionByOwner('owner/id');
    const request = http.expectOne(`${path}/extensions/by-owner/owner%2Fid`);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data });
    await expect(pending).resolves.toEqual(data);
  });

  it('reads the complete ordered chain, including additive ids, names and nullable overrides', async () => {
    const pending = api.getExtensionServers('extension/id');
    http.expectOne(`${path}/extensions/extension%2Fid/servers`).flush({ success: true, data: chain });
    await expect(pending).resolves.toEqual(chain);
  });

  it('retains server management fields and disabled ICE rows without exposing invented credentials', async () => {
    const pending = api.listPhoneServers();
    const request = http.expectOne(`${path}/servers`);
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data: [server] });
    await expect(pending).resolves.toEqual([server]);
  });

  it('preserves over-allowance and paused-seat accounting', async () => {
    const pending = api.getPhoneSeats();
    http.expectOne(`${path}/seats`).flush({ success: true, data: seats });
    await expect(pending).resolves.toEqual(seats);
  });

  it('creates an extension with nullable write-only password through credentialed CSRF/idempotent transport', async () => {
    const body = { ownerId: 'owner', extension: 'SQ_1023', sipUsername: 'user1001', sipPassword: null, enabled: false };
    const pending = api.createExtension(body, key);
    const request = http.expectOne({ method: 'POST', url: `${path}/extensions` });
    expect(request.request.body).toEqual(body);
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    request.flush({ success: true, data: extension }, { status: 201, statusText: 'Created' });
    await expect(pending).resolves.toEqual(extension);
  });

  it('patches only changed fields, retaining explicit nulls and false', async () => {
    const patch = { displayName: null, outboundCallerId: null, sipPassword: null, enabled: false };
    const pending = api.updateExtension('extension/id', patch, key);
    const request = http.expectOne({ method: 'PATCH', url: `${path}/extensions/extension%2Fid` });
    expect(request.request.body).toEqual(patch);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    request.flush({ success: true, data: extension });
    await expect(pending).resolves.toEqual(extension);
  });

  it('replaces the whole chain in order, preserving overrides and accepting an empty chain', async () => {
    for (const servers of [[{ serverId: 'server', timeoutSeconds: 15, maxRetries: 0 }], []]) {
      const body = { servers };
      const pending = api.putExtensionServers('extension', body, key);
      const request = http.expectOne({ method: 'PUT', url: `${path}/extensions/extension/servers` });
      expect(request.request.body).toEqual(body);
      expect(request.request.withCredentials).toBe(true);
      expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
      expect(request.request.headers.get('x-idempotency-key')).toBe(key);
      const data = servers.length ? chain : [];
      request.flush({ success: true, data });
      await expect(pending).resolves.toEqual(data);
    }
  });

  it('adapts the nested Webphone page without requiring CorePage metadata and sends only supported filters', async () => {
    const type = toCallLogTypeParam(['IN_NOANS', 'OUT_BUSY']);
    expect(type).toBe('IN_NOANS,OUT_BUSY');
    const filters = { page: 2, limit: 10, type, from: extension.createdAt, to: extension.updatedAt, q: '+20' };
    const pending = api.listUserCallLogs('owner/id', filters);
    const request = http.expectOne((req) => req.url === `${path}/users/owner%2Fid/call-logs`);
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.params.keys().sort()).toEqual(Object.keys(filters).sort());
    for (const [name, value] of Object.entries(filters)) expect(request.request.params.get(name)).toBe(String(value));
    const page = { data: [log], meta: { page: 2, limit: 10, total: 11 } };
    request.flush({ success: true, data: page });
    await expect(pending).resolves.toEqual(page);
  });

  it('defaults call logs to page one and omits blank filters', async () => {
    const pending = api.listUserCallLogs('owner', { q: '', type: '' });
    const request = http.expectOne(`${path}/users/owner/call-logs?page=1`);
    request.flush({ success: true, data: { data: [], meta: { page: 1, limit: 20, total: 0 } } });
    await expect(pending).resolves.toEqual({ data: [], meta: { page: 1, limit: 20, total: 0 } });
  });

  it.each([null, [], { data: [] }, { data: [], meta: { page: 1, limit: 20, total: -1 } },
    { data: [], meta: { page: 0, limit: 20, total: 0 } }])('rejects a malformed Webphone page: %j', async (data) => {
    const pending = api.listUserCallLogs('owner');
    const assertion = expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    http.expectOne(`${path}/users/owner/call-logs?page=1`).flush({ success: true, data });
    await assertion;
  });

  it.each([
    [401, 'COMMON.GENERIC.UNAUTHORIZED'], [403, 'COMMON.GENERIC.FORBIDDEN'],
    [404, 'WEBPHONE_EXTENSION_NOT_FOUND'], [409, 'WEBPHONE_EXTENSION_TAKEN'],
    [422, 'WEBPHONE_SEAT_LIMIT_REACHED'], [429, 'GW.RATE.LIMIT_EXCEEDED'], [500, 'COMMON.GENERIC.INTERNAL_ERROR'],
  ])('propagates HTTP %s as ApiError without synthetic data or retries', async (status, code) => {
    const pending = api.updateExtension('extension', { enabled: true }, key);
    const assertion = expect(pending).rejects.toMatchObject({ status, code, details: { allowed: 2, occupied: 2 }, correlationId: 'trace' });
    http.expectOne(`${path}/extensions/extension`).flush({ errorCode: code, details: { allowed: 2, occupied: 2 }, correlationId: 'trace' },
      { status, statusText: 'Error' });
    await assertion;
  });

  it('propagates network failures through CoreHttp', async () => {
    const pending = api.getPhoneSeats();
    const assertion = expect(pending).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    http.expectOne(`${path}/seats`).error(new ProgressEvent('error'));
    await assertion;
  });

  it('refuses writes without CSRF before sending a request', async () => {
    cookie = '';
    await expect(api.updateExtension('extension', { enabled: true }, key)).rejects.toEqual(new ApiError(403, 'GW.AUTH.CSRF_INVALID'));
    http.expectNone(`${path}/extensions/extension`);
  });
});
