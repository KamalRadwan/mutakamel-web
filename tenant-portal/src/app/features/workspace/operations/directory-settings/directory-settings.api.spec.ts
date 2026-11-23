import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreHttp } from '../../../../core/api/core-http';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { DirectorySettingsApi } from './directory-settings.api';
import * as fake from './directory-settings.fake';

const path = '/api/tenant/core/v1/directory/settings';

describe('DirectorySettingsApi', () => {
  let api: DirectorySettingsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: TenantScopeState, useValue: { me: signal({ id: 'owner' }) } },
    ] });
    api = TestBed.inject(DirectorySettingsApi);
    http = TestBed.inject(HttpTestingController);
    fake.resetDirectorySettingsFake();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('get returns the settings and etag', async () => {
    const result = await api.getDirectorySettings();
    expect(result).toEqual({ settings: fake.peekDirectorySettings(), etag: '"1"' });
    http.expectNone(path);
  });

  it('passes the current etag to the fake until BE-DIR is merged', async () => {
    const updated = await api.updateDirectorySettings({ maxAddressesPerParty: 4 }, '"1"');
    expect(updated).toMatchObject({ settings: { version: 2, maxAddressesPerParty: 4 }, etag: '"2"' });
    await expect(api.updateDirectorySettings({ maxAddressesPerParty: 6 }, '"1"'))
      .rejects.toMatchObject({ status: 409, code: 'DIRECTORY_SETTINGS_VERSION_CONFLICT' });
    http.expectNone(path);
  });

  // This verifies the shared transport contract, not live feature wiring: BE-DIR is still absent.
  it('update sends If-Match and CSRF without a key', async () => {
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${name}=csrf-proof`);
    const pending = TestBed.inject(CoreHttp).write('PATCH', path, { maxAddressesPerParty: 4 }, { ifMatch: '"1"' });
    const request = http.expectOne(path);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('If-Match')).toBe('"1"');
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(request.request.headers.has('x-idempotency-key')).toBe(false);
    const settings = { ...fake.peekDirectorySettings(), version: 2 };
    request.flush({ success: true, data: settings }, { headers: { ETag: '"2"' } });
    await expect(pending).resolves.toMatchObject({ data: settings, etag: '"2"' });
  });

  it('the transport rejects a missing CSRF cookie without a request', async () => {
    vi.spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get').mockReturnValue('');
    await expect(TestBed.inject(CoreHttp).write('PATCH', path, {}, { ifMatch: '"1"' }))
      .rejects.toMatchObject({ status: 403, code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone(path);
  });

  it('the transport unwraps Core data and rejects malformed success bodies', async () => {
    const transport = TestBed.inject(CoreHttp);
    const pending = transport.readWithEtag(path);
    http.expectOne(path).flush({ success: true, data: fake.peekDirectorySettings() }, { headers: { ETag: '"1"' } });
    await expect(pending).resolves.toEqual({ data: fake.peekDirectorySettings(), etag: '"1"' });
    const malformed = transport.readWithEtag(path);
    http.expectOne(path).flush({ success: true });
    await expect(malformed).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
  });
});
