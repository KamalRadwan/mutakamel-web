import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ApplicationInitStatus, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appConfig } from './app.config';
import { AuthSession } from './core/auth/auth-session';
import { LanguageState } from './core/i18n/language';
import { CrmEvents } from './core/realtime/crm-events';
import { NotificationsFeed } from './core/realtime/notifications-feed';
import { RealtimeClient } from './core/realtime/realtime-client';
import { REALTIME_SOCKET_FACTORY, type RealtimeSocketOptions } from './core/realtime/realtime-client.model';
import { TabLeader } from './core/tabs/tab-leader';
import { ThemeState } from './core/theme/theme';
import { ViewScale } from './core/view/view-scale';
import { crmQueries } from './features/crm/shared/crm-http';
import { BULK_JOB_MODULES } from './shared/bulk-jobs/bulk-job-modules';


describe('app infrastructure registration', () => {
  const started: string[] = [];
  const bindCrm = vi.fn();
  const connect = vi.fn(function (this: Socket) { return this; });


  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Socket.prototype, 'connect').mockImplementation(connect);
    started.length = 0;
    TestBed.configureTestingModule({
      providers: [
        ...appConfig.providers,
        provideHttpClientTesting(),
        { provide: AuthSession, useValue: { me: () => null } },
        { provide: LanguageState, useValue: {} },
        { provide: ThemeState, useValue: {} },
        { provide: ViewScale, useValue: {} },
        { provide: CrmEvents, useValue: { bind: bindCrm } },
        { provide: TabLeader, useValue: { start: () => started.push('leader') } },
        { provide: RealtimeClient, useFactory: () => {
          started.push('realtime');
          return {};
        } },
        { provide: NotificationsFeed, useFactory: () => {
          inject(RealtimeClient);
          started.push('notifications');
          return {};
        } },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.restoreAllMocks();
  });

  it('starts the shared leader and consumers once without eagerly opening a socket', async () => {
    const status = TestBed.inject(ApplicationInitStatus);
    await status.donePromise;
    expect(started).toEqual(['leader', 'realtime', 'notifications']);
    expect(bindCrm).toHaveBeenCalledExactlyOnceWith(crmQueries());
    TestBed.inject(RealtimeClient);
    TestBed.inject(NotificationsFeed);
    expect(started).toEqual(['leader', 'realtime', 'notifications']);
    expect(connect).not.toHaveBeenCalled();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it('provides a same-origin Socket.IO factory and preserves the transport contract', () => {
    const factory = TestBed.inject(REALTIME_SOCKET_FACTORY);
    expect(factory).toBeTypeOf('function');
    if (factory === null) throw new Error('Realtime socket factory is missing');
    const options: RealtimeSocketOptions = {
      path: '/realtime/socket.io',
      autoConnect: false,
      reconnection: false,
      forceNew: true,
      withCredentials: true,
      timeout: 10_000,
      auth: {
        contractVersion: 1,
        platform: 'web',
        appVersion: '0.0.0',
        deviceId: 'device-identifier-0001',
        clientInstanceId: 'instance-identifier-0001',
      },
    };
    const socket = factory(options);
    expect(socket).toBeInstanceOf(Socket);
    if (!(socket instanceof Socket)) throw new Error('Socket.IO factory returned an unexpected socket');
    expect(socket.auth).toEqual(options.auth);
    const { auth: _auth, ...managerOptions } = options;
    expect(socket.io.opts).toMatchObject(managerOptions);
    expect(connect).not.toHaveBeenCalled();
    socket.disconnect();
  });

  it('retains Core, CRM, Trade and automation descriptors without registering Accounting', () => {
    const descriptors = TestBed.inject(BULK_JOB_MODULES);
    expect(descriptors.map(({ module }) => module)).toEqual([
      'core.users',
      'crm.leads',
      'crm.opportunities',
      'crm.customer_profiles',
      'trading.items',
      'trading.commercial-accounts',
      'trading.catalog-import',
      'trading.control-tower-exceptions',
    ]);
    expect(descriptors.some(({ app }) => app === 'accounting')).toBe(false);
  });
});
