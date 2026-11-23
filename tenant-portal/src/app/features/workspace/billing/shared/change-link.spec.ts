import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SUBSCRIPTION } from '../subscription/subscription.spec-helpers';
import { CHANGE_PLAN_PATH, ChangePrefill, changeLink, loadSeatsChangeQueries, parseChangePrefill } from './change-link';

describe('changeLink', () => {
  it('builds the app query', () => {
    expect(changeLink({ kind: 'app', applicationId: 'a1', tierId: 't1' })).toEqual({
      path: CHANGE_PLAN_PATH,
      queryParams: { add: 'app:a1:t1' },
    });
  });

  it('builds the seats query', () => {
    expect(changeLink({ kind: 'seats', itemId: 'i1' }).queryParams.add).toBe('seats:i1');
  });
});

describe('loadSeatsChangeQueries with BillingApi', () => {
  let http: HttpTestingController;
  const path = '/api/tenant/core/v1/subscription';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('maps the real subscription projection to seat links in the existing constructor call context', async () => {
    const result = TestBed.runInInjectionContext(() => loadSeatsChangeQueries());
    const request = http.expectOne(path);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.has('x-company-id')).toBe(false);
    expect(request.request.headers.has('x-branch-id')).toBe(false);
    request.flush({ success: true, data: SUBSCRIPTION });

    expect(await result).toEqual(new Map([['crm', { add: 'seats:item' }]]));
  });

  it.each([401, 403, 404, 409, 503])('leaves seat links unavailable on HTTP %s', async (status) => {
    const result = TestBed.runInInjectionContext(() => loadSeatsChangeQueries());
    http.expectOne(path).flush({ errorCode: 'SUBSCRIPTION_READ_UNAVAILABLE' }, { status, statusText: 'Failed' });
    expect(await result).toEqual(new Map());
  });

  it('leaves seat links unavailable while offline', async () => {
    const result = TestBed.runInInjectionContext(() => loadSeatsChangeQueries());
    http.expectOne(path).error(new ProgressEvent('error'));
    expect(await result).toEqual(new Map());
  });

  it('does not manufacture seat links from an invalid response envelope', async () => {
    const result = TestBed.runInInjectionContext(() => loadSeatsChangeQueries());
    http.expectOne(path).flush(SUBSCRIPTION);
    expect(await result).toEqual(new Map());
  });

  it('rejects the items-only projection instead of treating it as the full subscription', async () => {
    const result = TestBed.runInInjectionContext(() => loadSeatsChangeQueries());
    http.expectOne(path).flush({ success: true, data: {
      subscriptionId: SUBSCRIPTION.subscription.id,
      subscriptionRevision: SUBSCRIPTION.subscriptionRevision,
      baseItems: SUBSCRIPTION.baseItems,
      addonSelections: SUBSCRIPTION.addonSelections,
    } });
    expect(await result).toEqual(new Map());
  });
});

describe('parseChangePrefill', () => {
  it('round-trips every prefill kind through changeLink', () => {
    const prefills: ChangePrefill[] = [
      { kind: 'app', applicationId: 'a1', tierId: 't1' },
      { kind: 'tier', itemId: 'i1', tierId: 't2' },
      { kind: 'addon', addonId: 'ad', definitionVersionId: 'dv', parentItemId: 'pi' },
      { kind: 'seats', itemId: 'i9' },
    ];
    for (const p of prefills) {
      expect(parseChangePrefill(changeLink(p).queryParams.add)).toEqual(p);
    }
  });

  it('returns null for null or empty input', () => {
    expect(parseChangePrefill(null)).toBeNull();
    expect(parseChangePrefill('')).toBeNull();
  });

  it('returns null for an unknown kind', () => {
    expect(parseChangePrefill('plan:a:b')).toBeNull();
  });

  it('returns null when the app segment count is wrong', () => {
    expect(parseChangePrefill('app:a1')).toBeNull();
    expect(parseChangePrefill('app:a1:t1:x')).toBeNull();
    expect(parseChangePrefill('app::t1')).toBeNull();
  });

  it('allows a tier prefill without a tier id', () => {
    expect(parseChangePrefill('tier:i1')).toEqual({ kind: 'tier', itemId: 'i1', tierId: '' });
  });

  it('rejects a tier prefill without an item id', () => {
    expect(parseChangePrefill('tier:')).toBeNull();
  });

  it('rejects an addon prefill with missing parts', () => {
    expect(parseChangePrefill('addon:a:b')).toBeNull();
    expect(parseChangePrefill('addon:a::c')).toBeNull();
  });

  it('rejects a seats prefill with extra or empty parts', () => {
    expect(parseChangePrefill('seats:')).toBeNull();
    expect(parseChangePrefill('seats:a:b')).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(parseChangePrefill('  seats:i1  ')).toEqual({ kind: 'seats', itemId: 'i1' });
  });
});
