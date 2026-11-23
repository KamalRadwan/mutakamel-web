import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco, TRANSLOCO_LOADER, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { PhoneServersApi } from '../phone-servers.api';
import type { PhoneServer, IceEntryDraft, IceEntry } from '../phone-servers.model';
import { ServerModal } from './server-modal';

const server: PhoneServer = {
  id: 'server-1', tenantId: 'tenant-1', createdAt: '', updatedAt: '', name: 'Cairo', priority: 1, enabled: false,
  sipDomain: 'pbx.example.com', websocketUrl: 'wss://pbx.example.com/ws', realm: null, fromDomain: null,
  registrarServer: null, outboundProxy: null, contactUri: null, defaultCallerId: null, registerExpires: 600,
  sessionTimers: true, defaultTimeoutSeconds: 20, defaultMaxRetries: 4, traceSip: false,
  allowInvalidTlsCertificate: false, iceEnabled: false, iceTransportPolicy: 'all', iceServers: [],
};
const ice: IceEntry = { id: 'ice-1', kind: 'STUN', urls: ['stun:pbx.example.com'], username: null, credentialConfigured: false, enabled: true, sortOrder: 0 };
const draft: IceEntryDraft = { uid: 'draft-1', id: null, kind: 'STUN', urlsText: 'stun:pbx.example.com', username: '', credentialConfigured: false, credentialAction: 'keep', credentialValue: '', enabled: true };

describe('ServerModal', () => {
  const api = { createPhoneServer: vi.fn(), updatePhoneServer: vi.fn(), listPhoneServers: vi.fn(),
    createIceServer: vi.fn(), updateIceServer: vi.fn(), deleteIceServer: vi.fn() };
  const notify = { error: vi.fn(), success: vi.fn() };
  let fixture: ComponentFixture<ServerModal>;
  let c: ServerModal;
  let close: ReturnType<typeof vi.spyOn>;
  beforeEach(async () => {
    vi.resetAllMocks();
    api.createPhoneServer.mockResolvedValue(server);
    api.updatePhoneServer.mockImplementation(async (_id, patch) => ({ ...server, ...patch }));
    api.listPhoneServers.mockResolvedValue([server]);
    api.createIceServer.mockResolvedValue(ice);
    api.updateIceServer.mockResolvedValue(ice);
    api.deleteIceServer.mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: 'en', prodMode: true, missingHandler: { logMissingKey: false } } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}) } },
      { provide: PhoneServersApi, useValue: api }, { provide: Notify, useValue: notify },
      { provide: LanguageState, useValue: { current: signal('en') } },
    ] });
    const messages: Record<string, string> = { 'apiErrors.idempotencyMismatch': 'Request body changed', 'wsPhone.errors.notSaved': 'Not saved. Try again', 'wsPhone.errors.stillProcessing': 'Still processing' };
    vi.spyOn(TestBed.inject(TranslocoService), 'translate').mockImplementation(key => messages[String(key)] ?? String(key));
    fixture = TestBed.createComponent(ServerModal);
    c = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    vi.spyOn(c['modal'](), 'open').mockImplementation(() => {});
    close = vi.spyOn(c['modal'](), 'close').mockImplementation(() => {});
    c.open(structuredClone(server));
  });
  afterEach(() => { fixture.destroy(); vi.restoreAllMocks(); });
  function change() { c['nameDraft'].set('Alexandria'); }

  it('add opens an empty modal', () => {
    c.open();
    expect(c.editingId()).toBeNull();
    expect(c['nameDraft']()).toBe('');
    expect(c['sipDomainDraft']()).toBe('');
    expect(c['websocketUrlDraft']()).toBe('');
    c['requestClose']();
    expect(close).toHaveBeenCalled();
    expect(api.createPhoneServer).not.toHaveBeenCalled();
  });

  function create() {
    c.open();
    c['nameDraft'].set('Cairo'); c['sipDomainDraft'].set(server.sipDomain); c['websocketUrlDraft'].set(server.websocketUrl);
    c['iceEntries'].set([structuredClone(draft)]);
  }

  it('create posts the server then its ICE rows', async () => {
    create();
    await c['save']();
    expect(api.createPhoneServer).toHaveBeenCalledTimes(1);
    expect(api.createIceServer).toHaveBeenCalledWith(server.id, expect.objectContaining({ kind: 'STUN', urls: ice.urls }), expect.any(String));
    expect(api.createPhoneServer.mock.invocationCallOrder[0]).toBeLessThan(api.createIceServer.mock.invocationCallOrder[0]);
    expect(close).toHaveBeenCalled();
  });

  it('ICE failure after create keeps the modal', async () => {
    create();
    api.createIceServer.mockRejectedValueOnce(new ApiError(503, 'WEBPHONE_INTERNAL_ERROR'));
    await c['save']();
    expect(c.editingId()).toBe(server.id);
    expect(close).not.toHaveBeenCalled();
    const first = api.createIceServer.mock.calls[0];
    await c['save']();
    expect(api.createPhoneServer).toHaveBeenCalledTimes(1);
    expect(api.createIceServer.mock.calls[1]).toEqual(first);
  });

  it('empty timeout and retries send defaults', async () => {
    c['defaultTimeoutDraft'].set(''); c['defaultMaxRetriesDraft'].set('');
    await c['save']();
    expect(api.updatePhoneServer).toHaveBeenCalledWith(server.id, { defaultTimeoutSeconds: 10, defaultMaxRetries: 2 }, expect.any(String));
  });

  it('not-null fields are never null', async () => {
    create();
    c['defaultTimeoutDraft'].set(''); c['defaultMaxRetriesDraft'].set('');
    await c['save']();
    const body = api.createPhoneServer.mock.calls[0][0];
    for (const field of ['registerExpires', 'defaultTimeoutSeconds', 'defaultMaxRetries', 'enabled', 'iceEnabled', 'iceTransportPolicy', 'sessionTimers', 'traceSip', 'allowInvalidTlsCertificate']) {
      expect(body[field]).not.toBeNull(); expect(body[field]).not.toBeUndefined();
    }
    api.updatePhoneServer.mockClear();
    c.open(server); c['registerExpiresDraft'].set('');
    await c['save']();
    expect(c['registerExpiresError']()).toBeTruthy();
    expect(api.updatePhoneServer).not.toHaveBeenCalled();
  });

  it('sips is refused by the client', async () => {
    for (const field of ['registrarServerDraft', 'outboundProxyDraft', 'contactUriDraft'] as const) {
      c.open(server); c[field].set('sips:pbx.example.com');
      await c['save']();
      expect(c['activeTab']()).toBe('advanced');
    }
    expect(api.updatePhoneServer).not.toHaveBeenCalled();
  });

  it('validation errors map to fields', async () => {
    change();
    api.updatePhoneServer.mockRejectedValue(new ApiError(400, 'CORE_VALIDATION_FAILED', { name: ['Name rejected'], websocketUrl: ['URL rejected'] }));
    await c['save']();
    expect(c['nameError']()).toBe('Name rejected'); expect(c['websocketUrlError']()).toBe('URL rejected');
    expect(c['activeTab']()).toBe('connection');
    expect(close).not.toHaveBeenCalled();
  });

  it('advanced validation errors remain beside their fields', async () => {
    c['realmDraft'].set('rejected-realm');
    api.updatePhoneServer.mockRejectedValue(new ApiError(400, 'CORE_VALIDATION_FAILED', { realm: ['Realm rejected'], fromDomain: ['Domain rejected'] }));
    await c['save'](); fixture.detectChanges();
    expect(c['activeTab']()).toBe('advanced');
    expect(fixture.nativeElement.textContent).toContain('Realm rejected');
    expect(fixture.nativeElement.textContent).toContain('Domain rejected');
  });

  it('relay without TURN', async () => {
    change(); api.updatePhoneServer.mockRejectedValue(new ApiError(422, 'WEBPHONE_RELAY_WITHOUT_TURN'));
    await c['save']();
    expect(c['activeTab']()).toBe('ice'); expect(c['iceTransportError']()).toBeTruthy();
  });

  it('in-flight is not a conflict', async () => {
    change(); api.updatePhoneServer.mockRejectedValue(new ApiError(409, 'GW.IDEM.IN_FLIGHT'));
    await c['save'](); fixture.detectChanges();
    expect(notify.error).toHaveBeenCalledWith('Still processing', '');
    expect(fixture.nativeElement.querySelectorAll('ui-modal').length).toBe(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('mismatch uses the core mapper', async () => {
    change(); api.updatePhoneServer.mockRejectedValue(new ApiError(422, 'GW.IDEM.MISMATCH'));
    await c['save']();
    expect(notify.error).toHaveBeenCalledWith('Request body changed', '');
  });

  it('404 closes the modal', async () => {
    const removed = vi.fn(); c.deletedRemotely.subscribe(removed);
    change(); api.updatePhoneServer.mockRejectedValue(new ApiError(404, 'WEBPHONE_SERVER_NOT_FOUND'));
    await c['save']();
    expect(removed).toHaveBeenCalledWith(server.id); expect(close).toHaveBeenCalled(); expect(notify.error).toHaveBeenCalled();
  });

  it('401 keeps the form', async () => {
    change(); api.updatePhoneServer.mockRejectedValueOnce(new ApiError(401, 'GW.AUTH.EXPIRED'));
    await c['save']();
    expect(c['nameDraft']()).toBe('Alexandria'); expect(close).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('Not saved. Try again', '');
    await c['save']();
    expect(api.updatePhoneServer.mock.calls[1]).toEqual(api.updatePhoneServer.mock.calls[0]);
  });

  it('STUN sends null credentials', async () => {
    c['iceEntries'].set([structuredClone(draft)]);
    await c['save']();
    expect(api.createIceServer.mock.calls[0][1]).toMatchObject({ username: null, credential: null });
  });

  it('STUN updates also clear both credentials', async () => {
    c.open({ ...server, iceServers: [ice] });
    c['iceEntries'].update(rows => rows.map(row => ({ ...row, urlsText: 'stun:new.example.com' })));
    await c['save']();
    expect(api.updateIceServer.mock.calls[0][2]).toMatchObject({ username: null, credential: null });
  });

  it('ICE credential keep and clear', async () => {
    const turn: IceEntry = { ...ice, kind: 'TURN', username: 'user', credentialConfigured: true };
    c.open({ ...server, iceServers: [turn] });
    c['iceEntries'].update(rows => rows.map(row => ({ ...row, urlsText: 'turn:new.example.com' })));
    api.updateIceServer.mockResolvedValue({ ...turn, urls: ['turn:new.example.com'] });
    await c['save']();
    expect(api.updateIceServer.mock.calls[0][2]).not.toHaveProperty('credential');
    c.open({ ...server, iceServers: [turn] });
    c['iceEntries'].update(rows => rows.map(row => ({ ...row, username: '', credentialAction: 'clear' })));
    await c['save']();
    expect(api.updateIceServer.mock.calls[1][2]).toMatchObject({ username: null, credential: null });
  });

  it('ICE pairing error on the row', async () => {
    c['iceEntries'].set([structuredClone(draft)]);
    api.createIceServer.mockRejectedValue(new ApiError(400, 'WEBPHONE_ICE_CREDENTIALS_INVALID'));
    await c['save']();
    expect(c['iceRowErrorsMap']()[draft.uid].entry).toBeTruthy(); expect(c['activeTab']()).toBe('ice');
    expect(close).not.toHaveBeenCalled();
  });

  it('no test-' + 'connection control exists', () => {
    fixture.detectChanges();
    const labels = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('button')).map(button => button.textContent?.trim());
    expect(labels.some(label => /test.*connection/i.test(label ?? ''))).toBe(false);
    expect(Object.keys(api).some(key => /^test/i.test(key))).toBe(false);
  });

  it('read-only fields retain hints and have no Save action', () => {
    fixture.componentRef.setInput('canManage', false);
    for (const tab of ['connection', 'advanced', 'ice'] as const) {
      c['activeTab'].set(tab); fixture.detectChanges();
      for (const field of Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('ui-field'))) {
        expect(field.querySelector('[role="tooltip"]')).not.toBeNull();
      }
    }
    expect(fixture.nativeElement.querySelector('button[type="submit"]')).toBeNull();
    expect(api.updatePhoneServer).not.toHaveBeenCalled();
  });
});
