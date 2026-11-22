import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { map, timer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { Notify } from '../../../../../core/notify/notify';
import { deletePhoneServer, listPhoneServers } from '../phone-servers.api';
import { resetPhoneServersFake } from '../phone-servers.fake';
import { PhoneServer } from '../phone-servers.model';
import { ServerModal } from './server-modal';

/*
 * ServerModal error mapping (handleSaveError / onIceEnabledToggle) on the real phone-servers fake.
 * Translations are empty, so every message is its key: resolveError() falls back to
 * 'wsPhone.errors.generic' and field messages show their 'wsPhone.validation.*' key.
 */

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return timer(0).pipe(map(() => ({})));
  }
}

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

// Protected and private members are reached through this view on purpose: the spec drives the modal state directly.
type Internals = Record<string, any>;

let fixture: ComponentFixture<ServerModal>;
let c: Internals;

async function flush(ms = 2000): Promise<void> {
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(ms);
  fixture.detectChanges();
}

async function drive<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(3000);
  const value = await promise;
  fixture.detectChanges();
  return value;
}

async function server(id: string): Promise<PhoneServer> {
  const list = await drive(listPhoneServers());
  return list.find((item) => item.id === id)!;
}

function errorToasts(): string[] {
  return TestBed.inject(Notify)
    .toasts()
    .filter((toast) => toast.type === 'error')
    .map((toast) => toast.title);
}

async function openOn(id: string): Promise<PhoneServer> {
  const base = await server(id);
  fixture.componentInstance.open(base);
  await flush();
  return base;
}

beforeEach(async () => {
  vi.useFakeTimers();
  resetPhoneServersFake();
  dialogProto['showModal'] = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dialogProto['close'] = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({
        config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      }),
    ],
  });
  fixture = TestBed.createComponent(ServerModal);
  c = fixture.componentInstance as unknown as Internals;
  await flush();
});

afterEach(() => {
  fixture.destroy();
  TestBed.resetTestingModule();
  dialogProto['showModal'] = originalDialog.showModal;
  dialogProto['close'] = originalDialog.close;
  vi.useRealTimers();
});

describe('ServerModal handleSaveError', () => {
  it('WEBPHONE_RELAY_WITHOUT_TURN flags the relay error on the ICE tab without a toast', async () => {
    await openOn('srv-cairo-1');
    c['handleSaveError'](new ApiError(422, 'WEBPHONE_RELAY_WITHOUT_TURN'), 'srv-cairo-1');
    expect(c['relayServerError']()).toBe(true);
    expect(c['activeTab']()).toBe('ice');
    expect(errorToasts()).toEqual([]);
  });

  it('WEBPHONE_SERVER_NOT_FOUND toasts, emits deletedRemotely and closes', async () => {
    await openOn('srv-cairo-1');
    const deleted = vi.fn();
    fixture.componentInstance.deletedRemotely.subscribe(deleted);
    c['handleSaveError'](new ApiError(404, 'WEBPHONE_SERVER_NOT_FOUND'), 'srv-cairo-1');
    await flush();
    expect(deleted).toHaveBeenCalledWith('srv-cairo-1');
    expect(errorToasts()).toEqual(['wsPhone.errors.generic']);
    expect(fixture.componentInstance.editingId()).toBeNull();
  });

  it('a 409 idempotency mismatch opens the conflict dialog', async () => {
    await openOn('srv-cairo-1');
    const openConflict = vi.spyOn(c['conflictModal'](), 'open');
    c['handleSaveError'](new ApiError(409, 'GW.IDEM.MISMATCH'), 'srv-cairo-1');
    expect(openConflict).toHaveBeenCalledTimes(1);
    expect(errorToasts()).toEqual([]);
  });

  it('a 409 in flight (GW.IDEM.IN_FLIGHT, IDEM_IN_FLIGHT) is a "still processing" toast, not a conflict', async () => {
    await openOn('srv-cairo-1');
    const openConflict = vi.spyOn(c['conflictModal'](), 'open');
    c['handleSaveError'](new ApiError(409, 'GW.IDEM.IN_FLIGHT'), 'srv-cairo-1');
    c['handleSaveError'](new ApiError(409, 'IDEM_IN_FLIGHT'), 'srv-cairo-1');
    expect(openConflict).not.toHaveBeenCalled();
    // Notify collapses the identical second toast into the first.
    expect(errorToasts()).toEqual(['wsPhone.errors.stillProcessing']);
  });

  it('409 WEBPHONE_SERVER_LIMIT_REACHED is a toast, not a conflict', async () => {
    await openOn('srv-cairo-1');
    const openConflict = vi.spyOn(c['conflictModal'](), 'open');
    c['handleSaveError'](new ApiError(409, 'WEBPHONE_SERVER_LIMIT_REACHED'), 'srv-cairo-1');
    expect(openConflict).not.toHaveBeenCalled();
    expect(errorToasts()).toEqual(['wsPhone.errors.generic']);
  });

  it('409 WEBPHONE_PROVISIONING_PENDING is a toast, not a conflict', async () => {
    await openOn('srv-cairo-1');
    const openConflict = vi.spyOn(c['conflictModal'](), 'open');
    c['handleSaveError'](new ApiError(409, 'WEBPHONE_PROVISIONING_PENDING'), 'srv-cairo-1');
    expect(openConflict).not.toHaveBeenCalled();
    expect(errorToasts()).toEqual(['wsPhone.errors.generic']);
  });

  it('CORE_VALIDATION_FAILED on a connection field sets the field message and the connection tab', async () => {
    await openOn('srv-cairo-1');
    c['activeTab'].set('ice');
    c['handleSaveError'](new ApiError(400, 'CORE_VALIDATION_FAILED', { sipDomain: ['sipDomain is not valid'] }), 'srv-cairo-1');
    expect(c['serverFieldErrors']()).toEqual({ sipDomain: 'wsPhone.validation.sipDomainPattern' });
    expect(c['activeTab']()).toBe('connection');
    expect(errorToasts()).toEqual([]);
  });

  it('CORE_VALIDATION_FAILED on an advanced field sets the field message and the advanced tab', async () => {
    await openOn('srv-cairo-1');
    c['handleSaveError'](
      new ApiError(400, 'CORE_VALIDATION_FAILED', { registerExpires: ['registerExpires is not valid'] }),
      'srv-cairo-1',
    );
    expect(c['serverFieldErrors']()).toEqual({ registerExpires: 'wsPhone.validation.registerExpiresRange' });
    expect(c['activeTab']()).toBe('advanced');
  });

  it('CORE_VALIDATION_FAILED on urls, username or credential lands on the ICE row being saved', async () => {
    await openOn('srv-cairo-1');
    const uid = c['iceEntries']()[0].uid as string;
    c['savingIceUid'] = uid;
    c['handleSaveError'](
      new ApiError(400, 'CORE_VALIDATION_FAILED', { urls: ['bad'], username: ['bad'], credential: ['bad'] }),
      'srv-cairo-1',
    );
    expect(c['iceServerErrors']()[uid]).toEqual({
      urls: 'wsPhone.validation.iceUrlsPattern',
      username: 'wsPhone.validation.turnUsernameRequired',
      credential: 'wsPhone.validation.turnCredentialRequired',
    });
    expect(c['iceRowErrorsMap']()[uid]).toMatchObject({ urls: 'wsPhone.validation.iceUrlsPattern' });
    expect(c['activeTab']()).toBe('ice');
    expect(errorToasts()).toEqual([]);
  });

  it('CORE_VALIDATION_FAILED on a field the form does not map, or ICE fields with no row, falls back to a toast', async () => {
    await openOn('srv-cairo-1');
    c['handleSaveError'](new ApiError(400, 'CORE_VALIDATION_FAILED', { urls: ['bad'] }), 'srv-cairo-1');
    c['handleSaveError'](new ApiError(400, 'CORE_VALIDATION_FAILED', { other: ['bad'] }), 'srv-cairo-1');
    expect(c['serverFieldErrors']()).toEqual({});
    expect(c['iceServerErrors']()).toEqual({});
    expect(errorToasts()).toEqual(['wsPhone.errors.generic']);
  });

  it('any other error is a toast through resolveError', async () => {
    await openOn('srv-cairo-1');
    c['handleSaveError'](new ApiError(500, 'INTERNAL_ERROR'), 'srv-cairo-1');
    c['handleSaveError'](new Error('boom'), 'srv-cairo-1');
    expect(errorToasts()).toEqual(['wsPhone.errors.generic']);
  });
});

describe('ServerModal save and ICE toggle on the fake', () => {
  it('saves a renamed server and emits saved with the fresh record', async () => {
    await openOn('srv-cairo-1');
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    c['nameDraft'].set('Cairo main');
    await drive(c['save']() as Promise<void>);
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ id: 'srv-cairo-1', name: 'Cairo main' }));
    expect((await server('srv-cairo-1')).name).toBe('Cairo main');
  });

  it('a server deleted elsewhere maps the save to deletedRemotely', async () => {
    await openOn('srv-cairo-1');
    const deleted = vi.fn();
    fixture.componentInstance.deletedRemotely.subscribe(deleted);
    await drive(deletePhoneServer('srv-cairo-1', newIdempotencyKey()));
    c['nameDraft'].set('Renamed');
    await drive(c['save']() as Promise<void>);
    expect(deleted).toHaveBeenCalledWith('srv-cairo-1');
  });

  it('turning ICE off on a relay server reverts the switch and shows the relay error', async () => {
    await openOn('srv-cairo-2');
    await drive(c['onIceEnabledToggle'](false) as Promise<void>);
    expect(c['relayServerError']()).toBe(true);
    expect(c['iceEnabledDraft']()).toBe(true);
    expect((await server('srv-cairo-2')).iceEnabled).toBe(true);
  });

  it('turning ICE off on a normal server patches it and emits serverPatched', async () => {
    await openOn('srv-cairo-1');
    const patched = vi.fn();
    fixture.componentInstance.serverPatched.subscribe(patched);
    await drive(c['onIceEnabledToggle'](false) as Promise<void>);
    expect(c['iceEnabledDraft']()).toBe(false);
    expect(patched).toHaveBeenCalledWith(expect.objectContaining({ id: 'srv-cairo-1', iceEnabled: false }));
  });
});
