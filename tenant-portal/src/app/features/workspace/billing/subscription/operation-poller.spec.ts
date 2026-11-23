import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationPoller } from './operation-poller';
import { BASE, operation, setupHttp, respond, fail, tick } from './subscription.spec-helpers';

let http: HttpTestingController;
let poller: OperationPoller;
beforeEach(() => {
  vi.useFakeTimers();
  TestBed.configureTestingModule({ providers: [OperationPoller] });
  http = setupHttp([provideHttpClient(), provideHttpClientTesting()]);
  poller = TestBed.inject(OperationPoller);
});
afterEach(() => {
  poller.stop();
  http.verify();
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
  vi.useRealTimers();
});
const path = `${BASE}/subscription/operations/op`;
describe('OperationPoller HTTP timing', () => {
  it('operation poll honours retry after', async () => {
    const promise = poller.poll('op', { initialDelayMs: 0 });
    respond(http.expectOne(path), { ...operation(), retryAfterSeconds: 20 });
    await tick(19_999);
    http.expectNone(path);
    await tick(1);
    respond(http.expectOne(path), operation('READY'));
    await tick();
    expect((await promise).kind).toBe('ready');
  });
  it('uses five seconds after thirty seconds and never polls below the shared delay', async () => {
    const promise = poller.poll('op', { initialDelayMs: 0 });
    for (let elapsed = 0; elapsed <= 30_000; elapsed += 2000) {
      respond(http.expectOne(path), { ...operation(), retryAfterSeconds: 1 });
      await tick(elapsed < 30_000 ? 2000 : 4999);
    }
    http.expectNone(path);
    await tick(1);
    respond(http.expectOne(path), operation('READY'));
    await tick();
    expect((await promise).kind).toBe('ready');
  });
  it.each(['BLOCKED', 'NEEDS_REVIEW', 'ABORTED'] as const)(
    'stops on terminal %s',
    async (state) => {
      const promise = poller.poll('op', { initialDelayMs: 0 });
      respond(http.expectOne(path), operation(state));
      await tick();
      expect((await promise).kind).toBe('terminal');
      await tick(20_000);
      http.expectNone(path);
    },
  );
  it('stops an active wait when destroyed', async () => {
    const promise = poller.poll('op');
    TestBed.resetTestingModule();
    await tick(2000);
    expect((await promise).kind).toBe('cancelled');
    http.expectNone(path);
  });
  it('returns the last operation on timeout', async () => {
    const promise = poller.poll('op', { initialDelayMs: 0, maxAttempts: 1 });
    respond(http.expectOne(path), operation());
    await tick();
    expect(await promise).toMatchObject({ kind: 'timeout', operation: { state: 'PREPARING' } });
  });
  it('returns read failures without resending', async () => {
    const promise = poller.poll('op', { initialDelayMs: 0 });
    fail(http.expectOne(path), 404, 'TENANT_OPERATION_NOT_FOUND');
    await tick();
    expect(await promise).toMatchObject({
      kind: 'error',
      error: { code: 'TENANT_OPERATION_NOT_FOUND' },
    });
  });
});
