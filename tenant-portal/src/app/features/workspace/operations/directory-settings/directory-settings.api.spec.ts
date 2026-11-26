import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { DirectorySettingsApi } from './directory-settings.api';
import { DirectorySettings } from './directory-settings.model';

const path = '/api/tenant/core/v1/directory/settings';
const settings: DirectorySettings = {
  id: 'settings', version: 7, duplicateScope: 'BRANCH',
  preventDuplicateEmail: false, preventDuplicatePhone: true, preventDuplicateWhatsapp: false,
  maxContactMethodsPerParty: 30, maxAddressesPerParty: 12,
  createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-23T00:00:00.000Z',
};

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
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${name}=csrf-proof`);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('GET unwraps all settings fields and preserves the header ETag', async () => {
    const pending = api.getDirectorySettings();
    const request = http.expectOne(path);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data: settings }, { headers: { ETag: '"7"' } });
    await expect(pending).resolves.toEqual({ settings, etag: '"7"' });
  });

  it('PATCH sends only the patch with If-Match and CSRF, without an idempotency key', async () => {
    const pending = api.updateDirectorySettings({ maxAddressesPerParty: 4 }, '"7"');
    const request = http.expectOne(path);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ maxAddressesPerParty: 4 });
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('If-Match')).toBe('"7"');
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(request.request.headers.has('x-idempotency-key')).toBe(false);
    const updated = { ...settings, version: 8, maxAddressesPerParty: 4 };
    request.flush({ success: true, data: updated }, { headers: { ETag: '"8"' } });
    await expect(pending).resolves.toEqual({ settings: updated, etag: '"8"' });
    const reload = api.getDirectorySettings();
    http.expectOne(path).flush({ success: true, data: updated }, { headers: { ETag: '"8"' } });
    await expect(reload).resolves.toEqual({ settings: updated, etag: '"8"' });
  });

  it.each([
    [409, 'DIRECTORY_SETTINGS_VERSION_CONFLICT'],
    [428, 'DIRECTORY_SETTINGS_VERSION_REQUIRED'],
    [403, 'MISSING_REQUIRED_PERMISSIONS'],
    [422, 'VALIDATION_ERROR'],
    [429, 'GW.RATE.LIMIT_EXCEEDED'],
    [503, 'COMMON.GENERIC.INTERNAL_ERROR'],
  ])('preserves PATCH error %s and its code for page error handling', async (status, code) => {
    const pending = api.updateDirectorySettings({ maxAddressesPerParty: 4 }, '"7"');
    http.expectOne(path).flush({ success: false, errorCode: code }, { status, statusText: 'Rejected' });
    await expect(pending).rejects.toMatchObject({ status, code });
  });

  it('rejects missing CSRF without sending a PATCH', async () => {
    vi.spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get').mockReturnValue('');
    await expect(api.updateDirectorySettings({}, '"7"'))
      .rejects.toMatchObject({ status: 403, code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone(path);
  });

  it('propagates a failed GET and allows a fresh read', async () => {
    const pending = api.getDirectorySettings();
    http.expectOne(path).flush({}, { status: 503, statusText: 'Unavailable' });
    await expect(pending).rejects.toMatchObject({ status: 503 });
    const retry = api.getDirectorySettings();
    http.expectOne(path).flush({ success: true, data: settings }, { headers: { ETag: '"7"' } });
    await expect(retry).resolves.toEqual({ settings, etag: '"7"' });
  });

  it('rejects malformed success envelopes', async () => {
    const pending = api.getDirectorySettings();
    http.expectOne(path).flush({ success: true }, { headers: { ETag: '"7"' } });
    await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
  });

  it.each([null, 'W/"7"', '*', '7'])('uses the settings version when the proxy sends %s', async (etag) => {
    const headers: Record<string, string> = etag === null ? {} : { ETag: etag };
    const read = api.getDirectorySettings();
    http.expectOne(path).flush({ success: true, data: settings }, { headers });
    await expect(read).resolves.toEqual({ settings, etag: '"7"' });
  });

  it('rejects a strong settings ETag that disagrees with the response version', async () => {
    const read = api.getDirectorySettings();
    http.expectOne(path).flush({ success: true, data: settings }, { headers: { ETag: '"8"' } });
    await expect(read).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
  });
});
