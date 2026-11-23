import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, TRANSLOCO_LOADER, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { AuthSession } from '../../../../../core/auth/auth-session';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { PhoneServersApi } from '../phone-servers.api';
import type { PhoneServer } from '../phone-servers.model';
import { PhoneSettingsPage } from './phone-settings-page';

const server: PhoneServer = {
  id: 'server-1', tenantId: 'tenant-1', createdAt: '', updatedAt: '', name: 'Cairo', priority: 1, enabled: false,
  sipDomain: 'pbx.example.com', websocketUrl: 'wss://pbx.example.com/ws', realm: null, fromDomain: null,
  registrarServer: null, outboundProxy: null, contactUri: null, defaultCallerId: null, registerExpires: 600,
  sessionTimers: true, defaultTimeoutSeconds: 10, defaultMaxRetries: 2, traceSip: false,
  allowInvalidTlsCertificate: false, iceEnabled: false, iceTransportPolicy: 'all', iceServers: [],
};
const owner = {
  id: 'user-1', isTenantOwner: true, permissions: ['webphone.settings.read', 'webphone.settings.update'], permissionScopes: {},
} as TenantMe;

describe('PhoneSettingsPage', () => {
  const api = { getPhoneConfig: vi.fn(), getPhoneSeats: vi.fn(), listPhoneServers: vi.fn(), createPhoneServer: vi.fn(), updatePhoneServer: vi.fn(),
    reorderPhoneServers: vi.fn(), deletePhoneServer: vi.fn() };
  const notify = { error: vi.fn(), success: vi.fn(), connectionLost: vi.fn(), connectionRestored: vi.fn() };
  const me = signal<TenantMe>(owner);
  const language = signal('en');
  let fixture: ComponentFixture<PhoneSettingsPage>;
  let c: PhoneSettingsPage;
  beforeEach(async () => {
    vi.resetAllMocks(); me.set(owner); language.set('en');
    api.getPhoneConfig.mockResolvedValue({ tenantId: 'tenant-1', enabled: true });
    api.getPhoneSeats.mockResolvedValue({ allowed: 10, occupied: 4, available: 6, overAllowance: false, overCapacity: false, graceUntil: null, overCapacitySince: null });
    api.listPhoneServers.mockResolvedValue([server]);
    api.updatePhoneServer.mockResolvedValue({ ...server, enabled: true });
    api.reorderPhoneServers.mockResolvedValue([server]); api.deletePhoneServer.mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: 'en', prodMode: true, missingHandler: { logMissingKey: false } } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}) } },
      { provide: PhoneServersApi, useValue: api }, { provide: Notify, useValue: notify },
      { provide: AuthSession, useValue: { me } }, { provide: LanguageState, useValue: { current: language } },
    ] });
    vi.spyOn(TestBed.inject(TranslocoService), 'translate').mockImplementation((key, params) => {
      const text = String(key);
      const values = params as Record<string, unknown> | undefined;
      if (text === 'wsPhone.limitReached') return `Up to ${values?.['limit']} servers`;
      if (text === 'wsPhone.overCapacitySince') return `Over capacity since ${values?.['date']}`;
      if (text === 'wsPhone.graceUntil') return `Grace period until ${values?.['date']}`;
      return text;
    });
    fixture = TestBed.createComponent(PhoneSettingsPage); c = fixture.componentInstance;
    await render();
  });
  afterEach(() => { fixture.destroy(); vi.restoreAllMocks(); });
  async function render() { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); }
  function text(): string { return fixture.nativeElement.textContent; }

  it('config card shows the enabled state', () => {
    expect(text()).toContain('wsPhone.summary.enabled');
    expect(c['config']()?.enabled).toBe(true);
  });

  it('seat card shows grace and over capacity', async () => {
    api.getPhoneSeats.mockResolvedValue({ allowed: 1, occupied: 2, available: 0, overAllowance: true, overCapacity: true,
      overCapacitySince: '2026-03-15T00:00:00Z', graceUntil: '2026-03-22T00:00:00Z' });
    await c['loadCard']('seats'); await render();
    expect(text()).toContain('Over capacity since 15 Mar 2026'); expect(text()).toContain('Grace period until 22 Mar 2026');
    language.set('ar'); await render();
    expect(text()).toContain('15 \u0645\u0627\u0631\u0633 2026'); expect(text()).not.toMatch(/[\u0660-\u0669]/);
  });

  it('no servers shows the empty list', async () => {
    api.listPhoneServers.mockResolvedValue([]); await c['loadCard']('servers'); await render();
    expect(text()).toContain('wsPhone.states.emptyTitle'); expect(text()).toContain('wsPhone.toolbar.add');
  });

  it('cards load independently', async () => {
    api.listPhoneServers.mockRejectedValue(new ApiError(503, 'GW.UPSTREAM.UNAVAILABLE'));
    await c['load'](); await render();
    expect(text()).toContain('wsPhone.summary.enabled');
    expect(fixture.nativeElement.querySelector('[data-card="seats"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-card="servers"] button')).not.toBeNull();
    expect(c['fullState']()).toBeNull();
    api.listPhoneServers.mockResolvedValue([server]);
    const configs = api.getPhoneConfig.mock.calls.length;
    (fixture.nativeElement.querySelector('[data-card="servers"] button') as HTMLButtonElement).click();
    await render();
    expect(c['cardErrors']().servers).toBeNull(); expect(api.getPhoneConfig).toHaveBeenCalledTimes(configs);
  });

  it('offline shows the card retry', async () => {
    api.listPhoneServers.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR'));
    await c['loadCard']('servers'); await render();
    expect(notify.connectionLost).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-card="servers"] button')).not.toBeNull();
  });

  it('module states replace the page', async () => {
    for (const [status, code, state] of [[403, 'WEBPHONE_MODULE_NOT_PURCHASED', 'notPurchased'], [409, 'WEBPHONE_PROVISIONING_PENDING', 'provisioning']] as const) {
      api.getPhoneConfig.mockRejectedValue(new ApiError(status, code));
      await c['load'](); await render();
      expect(c['fullState']()).toBe(state); expect(fixture.nativeElement.querySelector('[role="table"]')).toBeNull();
    }
  });

  it('403 shows forbidden', async () => {
    api.listPhoneServers.mockRejectedValue(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'));
    await c['load'](); await render();
    expect(fixture.nativeElement.querySelector('app-route-error')).not.toBeNull();
    expect(c['fullState']()).toBe('forbidden');
  });

  it('scoped holder sees read-only', async () => {
    for (const scope of [{ companyIds: ['c1'], branchIds: [] }, { companyIds: [], branchIds: ['b1'] }]) {
      me.set({ ...owner, isTenantOwner: false, permissionScopes: { 'webphone.settings.update': { ...scope, tenantWide: false } } });
      await render();
      expect(c['canManage']()).toBe(false); expect(text()).toContain('wsPhone.needsTenantWide');
      await c['toggleEnabled'](server, true);
      expect(api.updatePhoneServer).not.toHaveBeenCalled();
      expect((fixture.nativeElement.querySelector('button[role="switch"]') as HTMLButtonElement).disabled).toBe(true);
    }
    me.set({ ...owner, isTenantOwner: false, permissionScopes: { 'webphone.settings.update': { tenantWide: true, companyIds: [], branchIds: [] } } });
    expect(c['canManage']()).toBe(true);
  });

  it('limit reached shows the cap from details', async () => {
    api.createPhoneServer.mockRejectedValue(new ApiError(409, 'WEBPHONE_SERVER_LIMIT_REACHED', { limit: ['50'] }));
    const modal = c['serverModal']();
    vi.spyOn(modal['modal'](), 'open').mockImplementation(() => {});
    c['addServer']();
    modal['nameDraft'].set(server.name);
    modal['sipDomainDraft'].set(server.sipDomain);
    modal['websocketUrlDraft'].set(server.websocketUrl);
    await modal['save']();
    expect(api.createPhoneServer).toHaveBeenCalledTimes(1);
    expect(notify.error).toHaveBeenCalledWith('Up to 50 servers', '');
  });

  it('add disabled at 50', async () => {
    c['servers'].set(Array.from({ length: 50 }, (_, index) => ({ ...server, id: `server-${index}` })));
    await render();
    const add = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(button => button.textContent?.trim() === 'wsPhone.toolbar.add');
    expect(add?.disabled).toBe(true);
    const modal = vi.spyOn(c['serverModal'](), 'open');
    c['addServer'](); expect(modal).not.toHaveBeenCalled();
  });

  it('module inactive disables writes', async () => {
    api.updatePhoneServer.mockRejectedValue(new ApiError(403, 'WEBPHONE_MODULE_INACTIVE'));
    await c['toggleEnabled'](server, true); await render();
    expect(c['canManage']()).toBe(false); expect(text()).toContain('wsPhone.moduleInactiveNotice');
    expect(notify.error).toHaveBeenCalledTimes(1);
    c['handleActionError'](new ApiError(403, 'WEBPHONE_MODULE_INACTIVE'));
    await c['load']();
    expect(c['canManage']()).toBe(false); expect(notify.error).toHaveBeenCalledTimes(1);
  });

  it('tenant-wide 403 turns the page read-only', async () => {
    api.updatePhoneServer.mockRejectedValue(new ApiError(403, 'TENANT_WIDE_PERMISSION_REQUIRED'));
    await c['toggleEnabled'](server, true); await render();
    expect(c['canManage']()).toBe(false); expect(text()).toContain('wsPhone.needsTenantWide');
  });

  it('enable switch reuses its key', async () => {
    api.updatePhoneServer.mockRejectedValueOnce(new ApiError(503, 'WEBPHONE_INTERNAL_ERROR'));
    await c['toggleEnabled'](server, true); await c['toggleEnabled'](server, true);
    expect(api.updatePhoneServer.mock.calls[1]).toEqual(api.updatePhoneServer.mock.calls[0]);
    expect(api.updatePhoneServer.mock.calls[0].slice(0, 2)).toEqual([server.id, { enabled: true }]);
  });

  it('bad order reloads', async () => {
    const rows = [server, { ...server, id: 'server-2', priority: 2 }]; c['servers'].set(rows);
    api.reorderPhoneServers.mockRejectedValue(new ApiError(422, 'WEBPHONE_SERVER_ORDER_INVALID'));
    c['onRowDrop']({ sourceId: server.id, targetId: 'server-2', edge: 'after' });
    await render();
    expect(api.reorderPhoneServers.mock.calls[0][0]).toEqual(['server-2', server.id]);
    expect(api.listPhoneServers.mock.calls.length).toBeGreaterThan(1); expect(notify.error).toHaveBeenCalled();
  });

  it('delete confirms, accepts 204 and refreshes the list', async () => {
    vi.spyOn(c['deleteDialog'](), 'open').mockResolvedValue(true);
    await c['requestDelete'](server);
    expect(api.deletePhoneServer).toHaveBeenCalledWith(server.id, expect.any(String)); expect(notify.success).toHaveBeenCalled();
    expect(api.listPhoneServers.mock.calls.length).toBeGreaterThan(1);
  });

  it('modal deletion refreshes the list', async () => {
    c['onServerDeletedRemotely'](); await render();
    expect(api.listPhoneServers.mock.calls.length).toBeGreaterThan(1);
  });
});
