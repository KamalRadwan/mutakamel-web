import { HttpClient, HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appIcon, FALLBACK_ICON } from './app-presentation';
import { getAppsOverview, listModules } from './modules.api';
import { AppsOverviewItem, groupWorkspaceApps } from './modules.model';

function item(moduleKey: string, group: AppsOverviewItem['group']): AppsOverviewItem {
  return {
    moduleKey,
    nameI18n: { en: moduleKey, ar: moduleKey },
    iconKey: null,
    group,
    isAddon: false,
    myAccessState: null,
    seats: null,
  };
}

describe('apps overview HTTP adapter', () => {
  const path = '/api/tenant/core/v1/apps/overview';
  let client: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('unwraps the Core envelope and preserves overview fields', async () => {
    const data = { items: [{ ...item('crm', 'SUBSCRIBED'), myAccessState: 'OVER_CAPACITY', seats: { used: 3, total: 2 } }] };
    const pending = getAppsOverview(client);
    const request = http.expectOne(path);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data });
    await expect(pending).resolves.toEqual(data);
  });

  it('projects server module keys and all groups in catalogue order', async () => {
    const pending = listModules(client);
    const request = http.expectOne(path);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data: { items: [
      item('custom-addon', 'FUTURE'), item('trade', 'SUBSCRIBED'), item('crm', 'AVAILABLE'),
    ] } });
    await expect(pending).resolves.toEqual([
      { id: 'custom-addon', group: 'future' },
      { id: 'trade', group: 'subscribed' },
      { id: 'crm', group: 'available' },
    ]);
  });

  it('returns an empty projection for an empty catalogue', async () => {
    const pending = listModules(client);
    http.expectOne(path).flush({ success: true, data: { items: [] } });
    await expect(pending).resolves.toEqual([]);
  });

  it('rejects malformed envelopes instead of returning fallback entitlements', async () => {
    for (const body of [{}, { success: false, data: { items: [] } }, { success: true, data: null }, { success: true, data: { items: {} } }]) {
      const pending = listModules(client);
      http.expectOne(path).flush(body);
      await expect(pending).rejects.toThrow('Invalid apps overview response');
    }
  });

  it.each([401, 403, 500])('preserves HTTP error codes for existing error handling (%s)', async (status) => {
    const error = { success: false, error: { code: 'INVALID_CREDENTIALS' } };
    const pending = listModules(client);
    http.expectOne(path).flush(error, { status, statusText: 'Request failed' });
    await expect(pending).rejects.toMatchObject({ status, error });
  });

  it('propagates network failures without a fixture fallback', async () => {
    const pending = listModules(client);
    http.expectOne(path).error(new ProgressEvent('error'));
    await expect(pending).rejects.toBeInstanceOf(HttpErrorResponse);
  });
});

describe('groupWorkspaceApps', () => {
  it('keeps Core catalogue order and only includes each live app once, preferring subscriptions', () => {
    const groups = groupWorkspaceApps([
      item('crm', 'AVAILABLE'),
      item('trade', 'SUBSCRIBED'),
      item('accounting', 'AVAILABLE'),
      item('crm', 'SUBSCRIBED'),
      item('accounting', 'AVAILABLE'),
      item('web-phone', 'AVAILABLE'),
      item('crm', 'SUBSCRIBED'),
      item('unpublished', 'FUTURE'),
      item('pos', 'AVAILABLE'),
      item('projects', 'SUBSCRIBED'),
      item('helpdesk', 'FUTURE'),
    ]);
    expect(groups.subscribed.map((app) => app.moduleKey)).toEqual(['trade', 'crm']);
    expect(groups.available.map((app) => app.moduleKey)).toEqual(['accounting', 'web-phone']);
  });
});

describe('appIcon', () => {
  it('maps icons by moduleKey, because iconKey is always null today', () => {
    expect(appIcon('crm')).toBe('tablerUsers');
  });

  it('falls back to the generic app icon for an unknown moduleKey', () => {
    expect(appIcon('somethingNew')).toBe(FALLBACK_ICON);
  });
});
