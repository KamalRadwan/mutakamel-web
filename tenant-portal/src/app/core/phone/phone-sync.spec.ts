import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TabBus } from '../tabs/tab-bus';
import { TabLeader } from '../tabs/tab-leader';
import { TabRole } from '../tabs/tab-leader.model';
import { CreateCallLogInput, PhoneLostPayload, PhoneSyncedState } from './phone.model';
import { PhoneSync, PhoneSyncHooks } from './phone-sync';

const path = '/api/tenant/webphone/v1/me/call-logs';
const lostPayload: PhoneLostPayload = { lossId: 'leg-one', name: null, number: '+201005550199', durationSeconds: 5 };
const callLog: CreateCallLogInput = {
  type: 'OUT_ANS', displayName: null, phoneNumber: lostPayload.number,
  startedAt: '2026-11-23T10:00:00Z', answeredAt: '2026-11-23T10:00:05Z',
  endedAt: '2026-11-23T10:00:10Z', durationSeconds: 5, cause: 'callFailed: tabClosed',
  sourceType: null, sourceId: null, sourceLabel: null,
};

describe('PhoneSync call-log persistence', () => {
  const isLeader = signal(true);
  const role = signal<TabRole>('leader');
  const snapshot = signal<PhoneSyncedState | null>(null);
  let sync: PhoneSync;
  let http: HttpTestingController;
  let hooks: PhoneSyncHooks;
  const broadcast = vi.fn();

  beforeEach(() => {
    isLeader.set(true);
    role.set('leader');
    snapshot.set(null);
    broadcast.mockClear();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: TabLeader, useValue: { isLeader, role, registerGuard: () => () => {},
        registerStandDown: () => () => {}, guardsChanged: vi.fn(), requestLeadership: vi.fn() } },
      { provide: TabBus, useValue: { state: () => snapshot, on: () => () => {}, broadcast,
        publish: vi.fn(), send: vi.fn() } },
    ] });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${name}=csrf-proof`);
    hooks = {
      isBusy: () => true, onStandDown: async () => {}, onLeadershipStop: vi.fn(),
      onBecomeLeader: vi.fn(), onBecomeFollower: vi.fn(), onCommand: vi.fn(), onLostCall: vi.fn(),
      onPrefsStorageChange: vi.fn(), onBeforeUnloadCheck: () => false,
      onPageHideCapture: vi.fn(() => ({ lostPayload, callLog })),
    };
    http = TestBed.inject(HttpTestingController);
    sync = TestBed.inject(PhoneSync);
    sync.init(hooks);
    TestBed.flushEffects();
  });

  afterEach(() => { sync.dispose(); http.verify(); vi.restoreAllMocks(); });

  it('appends the captured call once through authenticated CoreHttp on repeated pagehide', async () => {
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('pagehide'));
    const request = http.expectOne(path);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(callLog);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(request.request.headers.has('x-idempotency-key')).toBe(false);
    expect(broadcast).toHaveBeenCalledExactlyOnceWith('phone.lost', lostPayload);
    request.flush({ success: true, data: null }, { status: 201, statusText: 'Created' });
    await Promise.resolve();
    window.dispatchEvent(new Event('pagehide'));
    http.expectNone(path);
  });

  it('drops a failed append without retrying after another pagehide or leadership change', async () => {
    window.dispatchEvent(new Event('pagehide'));
    http.expectOne(path).flush({ errorCode: 'WEBPHONE_INTERNAL_ERROR' }, { status: 500, statusText: 'Failed' });
    await Promise.resolve();
    await Promise.resolve();
    isLeader.set(false); role.set('follower'); TestBed.flushEffects();
    isLeader.set(true); role.set('leader'); TestBed.flushEffects();
    window.dispatchEvent(new Event('pagehide'));
    http.expectNone(path);
  });

  it('does not append from a follower tab', () => {
    isLeader.set(false); role.set('follower'); TestBed.flushEffects();
    window.dispatchEvent(new Event('pagehide'));
    expect(hooks.onPageHideCapture).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();
    http.expectNone(path);
  });

  it('does not append when no live call was captured', () => {
    vi.mocked(hooks.onPageHideCapture).mockReturnValue(null);
    window.dispatchEvent(new Event('pagehide'));
    expect(broadcast).not.toHaveBeenCalled();
    http.expectNone(path);
  });

  it('removes pagehide listeners on disposal', () => {
    sync.dispose();
    window.dispatchEvent(new Event('pagehide'));
    expect(hooks.onPageHideCapture).not.toHaveBeenCalled();
    http.expectNone(path);
  });
});
