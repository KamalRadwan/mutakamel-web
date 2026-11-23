import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { QueryClient, type QueryKey } from '@tanstack/angular-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/api-errors';
import { AuthSession } from '../auth/auth-session';
import type { SessionStatus, TenantMe } from '../auth/auth-session.model';
import { Notify } from '../notify/notify';
import { TenantScopeState } from '../scope/tenant-scope';
import { CrmEvents } from './crm-events';
import { RealtimeClient } from './realtime-client';
import { parseRealtimeEvent, type RealtimeConnectionState, type RealtimeEventData, type RealtimeEventName, type RealtimeRecovery } from './realtime-client.model';

const TENANT = '019aabbc-0000-7000-8000-000000000001';
const USER = '019aabbc-0000-7000-8000-000000000002';
const COMPANY = '019aabbc-0000-7000-8000-000000000003';
const BRANCH = '019aabbc-0000-7000-8000-000000000004';
const BRANCH2 = '019aabbc-0000-7000-8000-000000000005';
const LEAD = '019aabbc-0000-7000-8000-000000000006';
const OTHER = '019aabbc-0000-7000-8000-000000000007';
const AT = '2026-11-23T12:00:00.000Z';
const scope = { companyId: COMPANY, branchId: BRANCH };
const connected: RealtimeConnectionState = { status: 'connected', stale: false, failure: null, at: 1 };

class ControlledRealtime {
  readonly connection = signal(connected);
  readonly stale = () => this.connection().stale;
  readonly recoveries = signal<RealtimeRecovery[]>([]);
  readonly completeRecovery = vi.fn((id: string) => this.recoveries.update((items) => items.filter((item) => item.id !== id)));
  readonly retry = vi.fn();
  readonly handlers = new Map<RealtimeEventName, Set<(event: unknown) => void>>();
  readonly recoveryHandlers = new Set<(recovery: RealtimeRecovery) => void>();

  on<N extends RealtimeEventName>(name: N, handler: (event: RealtimeEventData<N>) => void): () => void {
    const handlers = this.handlers.get(name) ?? new Set();
    const listener = (event: unknown) => handler(parseRealtimeEvent(name, event));
    handlers.add(listener);
    this.handlers.set(name, handlers);
    return () => handlers.delete(listener);
  }

  onRecovery(handler: (recovery: RealtimeRecovery) => void): () => void {
    this.recoveryHandlers.add(handler);
    return () => this.recoveryHandlers.delete(handler);
  }

  change(overrides: Partial<RealtimeEventData<'crm.leads.changed.v1'>['payload']> = {}): void {
    const event = { contractVersion: 1, eventId: OTHER, correlationId: TENANT, occurredAt: AT,
      payload: { tenantId: TENANT, branchId: BRANCH, leadId: LEAD, revision: '1', changeKind: 'UPDATED', ...overrides } };
    for (const handler of this.handlers.get('crm.leads.changed.v1') ?? []) handler(event);
  }

  recover(id: string, scope: RealtimeRecovery['scope'] = 'CRM_LEADS', reason = 'SCOPE_CHANGED'): void {
    const recovery = { id, scope, reason, at: 1 };
    this.recoveries.update((items) => [...items, recovery]);
    for (const handler of this.recoveryHandlers) handler(recovery);
  }
}

function me(): TenantMe {
  return { id: USER, email: 'staff@example.test', firstName: 'Staff', lastName: 'User', hasAvatar: false,
    isTenantOwner: false, mfaEnabled: false, mfaUpdatedAt: null, status: 'ACTIVE',
    workspace: { timezone: 'Africa/Cairo', defaultLanguage: 'en' },
    accessibleCompanies: [COMPANY], accessibleBranches: [BRANCH, BRANCH2],
    accessibleBranchCompanies: [{ companyId: COMPANY, branchId: BRANCH }, { companyId: COMPANY, branchId: BRANCH2 }],
    permissions: ['crm.leads.read.all'], permissionScopes: {}, teamMemberships: [], seats: [],
    accessScope: { mode: 'FULL', branchesTruncated: false, companiesTruncated: false, teamMembershipsTruncated: false, teamMembershipsTotal: 0 },
    featureEntitlements: {} };
}

describe('CrmEvents', () => {
  let client: QueryClient;
  let realtime: ControlledRealtime;
  let adapter: CrmEvents;
  let notify: Notify;
  let status: ReturnType<typeof signal<SessionStatus>>;
  let identity: ReturnType<typeof signal<TenantMe | null>>;
  const detail = ['crm-leads', 'detail', BRANCH, LEAD];
  const list = ['crm-leads', '/leads/search', { branchId: BRANCH, page: 1 }];

  async function flush(): Promise<void> {
    for (let i = 0; i < 30; i++) await Promise.resolve();
    TestBed.tick();
    for (let i = 0; i < 30; i++) await Promise.resolve();
  }

  async function cache(key: QueryKey, value: unknown = ['cached']) {
    const read = vi.fn().mockResolvedValue(value);
    await client.fetchQuery({ queryKey: key, queryFn: read });
    read.mockClear();
    return read;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    status = signal<SessionStatus>('signed-in');
    identity = signal<TenantMe | null>(me());
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, networkMode: 'always' } } });
    realtime = new ControlledRealtime();
    TestBed.configureTestingModule({ providers: [
      { provide: AuthSession, useValue: { status, me: identity } },
      { provide: TenantScopeState, useValue: { selection: signal(scope), branchCompanies: signal(new Map([[BRANCH, COMPANY], [BRANCH2, COMPANY]])) } },
      { provide: RealtimeClient, useValue: realtime },
      { provide: TranslocoService, useValue: { translate: (key: string) => ({
        'session.connectionLost.title': 'Cannot reach server', 'session.connectionLost.text': 'Retrying automatically',
        'session.loadFailed.text': 'Check your connection and try again.', 'apiErrors.network': 'Network unavailable',
        'apiErrors.permission': 'Permission denied', 'apiErrors.generic': 'Request failed',
      }[key] ?? key) } },
    ] });
    adapter = TestBed.inject(CrmEvents);
    notify = TestBed.inject(Notify);
    adapter.bind(client);
    TestBed.tick();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    client.clear();
    vi.useRealTimers();
  });

  it('invalidates the changed lead and its branch lists without touching other records, branches or modules', async () => {
    const affected = await Promise.all([detail, list,
      ['crm-leads', '/leads/board', { branchId: BRANCH }],
      ['crm-leads', '/leads/board/stages/stage', { branchId: BRANCH }],
      ['crm-leads', '/leads/kpis', { branchId: BRANCH }],
      ['crm-leads', 'selection', scope, { branchId: BRANCH }],
      ['crm-leads', 'duplicates', { branchId: BRANCH }],
      ['crm-related-records', 'crm', 'related-counts', 'LEAD', LEAD, scope],
    ].map((key) => cache(key)));
    const untouched = await Promise.all([
      ['crm-leads', 'detail', BRANCH, OTHER], ['crm-leads', '/leads/search', { branchId: BRANCH2 }],
      ['crm-leads', 'companies', BRANCH], ['crm-settings', 'tags'], ['trade-items'],
      ['crm-related-records', 'crm', 'related-counts', 'CUSTOMER_PROFILE', LEAD, scope],
    ].map((key) => cache(key)));
    realtime.change();
    await flush();
    for (const read of affected) expect(read).toHaveBeenCalledTimes(1);
    for (const read of untouched) expect(read).not.toHaveBeenCalled();
    expect(adapter.error()).toBeNull();
  });

  it('ignores inaccessible branches and duplicate or older bigint revisions', async () => {
    const read = await cache(list);
    realtime.change({ branchId: OTHER });
    await flush();
    expect(read).not.toHaveBeenCalled();
    realtime.change({ revision: '9007199254740993' });
    await flush();
    realtime.change({ revision: '9007199254740992' });
    realtime.change({ revision: '9007199254740993' });
    await flush();
    expect(read).toHaveBeenCalledTimes(1);
    realtime.change({ revision: '9007199254740994' });
    await flush();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('removes deleted detail data and refreshes the branch list without requesting the deleted record', async () => {
    const readDetail = await cache(detail);
    const readList = await cache(list);
    realtime.change({ changeKind: 'DELETED' });
    await flush();
    expect(client.getQueryData(detail)).toBeUndefined();
    expect(readDetail).not.toHaveBeenCalled();
    expect(readList).toHaveBeenCalledTimes(1);
  });

  it('discards scope data and acknowledges recovery only after authoritative HTTP completes', async () => {
    const read = await cache(detail);
    let finish: (value: string[]) => void = () => undefined;
    read.mockImplementation(() => new Promise<string[]>((resolve) => { finish = resolve; }));
    realtime.recover('scope-1');
    await flush();
    expect(client.getQueryData(detail)).toBeUndefined();
    expect(adapter.stale()).toBe(true);
    expect(realtime.completeRecovery).not.toHaveBeenCalled();
    finish(['authorized']);
    await flush();
    expect(client.getQueryData(detail)).toEqual(['authorized']);
    expect(realtime.completeRecovery).toHaveBeenCalledExactlyOnceWith('scope-1');
  });

  it('ignores notification and presence recovery while honoring CRM recovery retained for a late tab', async () => {
    const read = await cache(list);
    realtime.recover('notification', 'NOTIFICATIONS');
    realtime.recover('presence', 'PRESENCE');
    await flush();
    expect(read).not.toHaveBeenCalled();
    realtime.recoveries.set([{ id: 'late', scope: 'CRM_LEADS', reason: 'RECOVERY_INCOMPLETE', at: 1 }]);
    await flush();
    expect(read).toHaveBeenCalledTimes(1);
    expect(realtime.completeRecovery).toHaveBeenCalledExactlyOnceWith('late');
  });

  it('does not poll CRM for an unrelated notification-only recovery', async () => {
    const read = await cache(list);
    realtime.connection.set({ status: 'stale', stale: true, failure: null, at: 2 });
    realtime.recover('notifications-only', 'NOTIFICATIONS');
    await flush();
    await vi.advanceTimersByTimeAsync(600_000);
    await flush();
    expect(read).not.toHaveBeenCalled();
  });

  it('refreshes ALL recovery data without claiming the other domains are recovered', async () => {
    const read = await cache(list);
    realtime.recover('all-domains', 'ALL', 'RECOVERY_INCOMPLETE');
    await flush();
    expect(read).toHaveBeenCalledTimes(1);
    expect(realtime.completeRecovery).not.toHaveBeenCalled();
  });

  it('surfaces HTTP failures, leaves recovery pending and retries at most six times', async () => {
    const read = await cache(list);
    read.mockRejectedValue(new ApiError(503, 'SERVER_UNAVAILABLE'));
    realtime.recover('failed');
    await flush();
    expect(adapter.error()).toMatchObject({ status: 503 });
    expect(notify.toasts().some((toast) => toast.pinned && toast.text === 'Request failed')).toBe(true);
    expect(realtime.completeRecovery).not.toHaveBeenCalled();
    for (let i = 0; i < 8; i++) { await vi.advanceTimersByTimeAsync(60_000); await flush(); }
    expect(read).toHaveBeenCalledTimes(7);
    read.mockResolvedValue(['fresh']);
    adapter.retry();
    await flush();
    expect(realtime.retry).toHaveBeenCalledTimes(1);
    expect(realtime.completeRecovery).toHaveBeenCalledExactlyOnceWith('failed');
    expect(adapter.error()).toBeNull();
    expect(notify.toasts().some((toast) => toast.pinned)).toBe(false);
  });

  it('honors HTTP Retry-After and never automatically retries authorization failures', async () => {
    const read = await cache(list);
    read.mockRejectedValue(new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['120'] }));
    realtime.recover('limited');
    await flush();
    await vi.advanceTimersByTimeAsync(60_000);
    await flush();
    expect(read).toHaveBeenCalledTimes(1);
    read.mockRejectedValue(new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED'));
    await vi.advanceTimersByTimeAsync(60_000);
    await flush();
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(600_000);
    await flush();
    expect(read).toHaveBeenCalledTimes(2);
    expect(realtime.completeRecovery).not.toHaveBeenCalled();
    expect(notify.toasts().some((toast) => toast.pinned && toast.text === 'Permission denied')).toBe(true);
  });

  it('uses bounded HTTP fallback while disconnected and keeps the connection visibly stale', async () => {
    const read = await cache(list);
    realtime.connection.set({ status: 'unavailable', stale: true,
      failure: { code: 'REALTIME.CLIENT.UNAVAILABLE', status: 503, retryable: false, retryAfterMs: null, correlationId: null }, at: 2 });
    await flush();
    for (let i = 0; i < 8; i++) { await vi.advanceTimersByTimeAsync(60_000); await flush(); }
    expect(read).toHaveBeenCalledTimes(6);
    expect(adapter.stale()).toBe(true);
    expect(notify.toasts().some((toast) => toast.pinned)).toBe(true);
    realtime.connection.set(connected);
    await flush();
    expect(notify.toasts().some((toast) => toast.pinned)).toBe(false);
  });

  it('cancels an already scheduled fallback after an HTTP authorization rejection', async () => {
    const read = await cache(list);
    realtime.connection.set({ status: 'stale', stale: true, failure: null, at: 2 });
    await flush();
    read.mockRejectedValue(new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED'));
    realtime.change();
    await flush();
    await vi.advanceTimersByTimeAsync(600_000);
    await flush();
    expect(read).toHaveBeenCalledTimes(1);
    expect(adapter.error()).toMatchObject({ status: 403 });
  });

  it('queues a newer change during an in-flight refresh and waits for a second authoritative read', async () => {
    const read = await cache(list);
    let finish: (value: string[]) => void = () => undefined;
    read.mockImplementationOnce(() => new Promise<string[]>((resolve) => { finish = resolve; }));
    realtime.change();
    await flush();
    realtime.change({ revision: '2' });
    await flush();
    expect(read).toHaveBeenCalledTimes(1);
    finish(['first']);
    await flush();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('clears authorization-scoped caches when permission is revoked', async () => {
    const read = await cache(list);
    identity.update((value) => value ? { ...value, permissions: [] } : null);
    await flush();
    realtime.change();
    realtime.recover('revoked');
    await vi.advanceTimersByTimeAsync(600_000);
    await flush();
    expect(client.getQueryData(list)).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
    expect(realtime.completeRecovery).not.toHaveBeenCalled();
  });

  it('cancels old identity requests, clears lead caches and stops work after logout', async () => {
    const read = await cache(detail);
    let finish: (value: string[]) => void = () => undefined;
    read.mockImplementation(() => new Promise<string[]>((resolve) => { finish = resolve; }));
    realtime.recover('logout');
    await flush();
    status.set('signed-out');
    identity.set(null);
    await flush();
    finish(['old-user-data']);
    await flush();
    await vi.advanceTimersByTimeAsync(600_000);
    realtime.change({ revision: '2' });
    await flush();
    expect(client.getQueryData(detail)).toBeUndefined();
    expect(realtime.completeRecovery).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe to a second socket and unregisters its shared feed listeners on destroy', () => {
    expect(realtime.handlers.get('crm.leads.changed.v1')?.size).toBe(1);
    expect(realtime.recoveryHandlers.size).toBe(1);
    TestBed.resetTestingModule();
    expect(realtime.handlers.get('crm.leads.changed.v1')?.size).toBe(0);
    expect(realtime.recoveryHandlers.size).toBe(0);
  });
});
