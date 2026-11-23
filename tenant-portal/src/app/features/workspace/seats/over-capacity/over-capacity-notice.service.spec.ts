import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StaffSession } from '../../staff/shared/staff-session';
import { OverCapacityNotice } from './over-capacity-notice.service';

const base = '/api/tenant/core/v1';
const usage = { mode: 'DERIVED', revision: 8, modules: [] };
const seats = [{ moduleKey: 'crm', accessState: 'OVER_CAPACITY' }];

describe('OverCapacityNotice HTTP reads', () => {
  let notice: OverCapacityNotice;
  let http: HttpTestingController;
  const canRead = signal(true);
  beforeEach(() => {
    canRead.set(true);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: StaffSession, useValue: { me: signal({ id: 'actor' }), isOwner: () => true, can: () => canRead() } },
    ] });
    notice = TestBed.inject(OverCapacityNotice);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); });

  it('unwraps tenant usage and projects the authenticated profile seats', async () => {
    const pending = notice.refresh();
    http.expectOne(`${base}/seats/usage`).flush({ success: true, data: usage });
    http.expectOne(`${base}/auth/me`).flush({ success: true, data: { id: 'actor', seats, permissions: [] } });
    await pending;
    expect(notice.usage()).toEqual(usage);
    expect(notice.myStates()).toEqual(seats);
  });

  it('keeps self-service seat states when tenant usage is forbidden', async () => {
    const pending = notice.refresh();
    http.expectOne(`${base}/seats/usage`).flush({ errorCode: 'MISSING_REQUIRED_PERMISSIONS' }, { status: 403, statusText: 'Forbidden' });
    http.expectOne(`${base}/auth/me`).flush({ success: true, data: { seats } });
    await pending;
    expect(notice.usage()).toBeNull();
    expect(notice.myStates()).toEqual(seats);
    expect(notice.myReadOnlyModules().map((row) => row.moduleKey)).toEqual(['crm']);
  });

  it('does not request tenant usage without user-read permission', async () => {
    canRead.set(false);
    const pending = notice.refresh();
    http.expectNone(`${base}/seats/usage`);
    http.expectOne(`${base}/auth/me`).flush({ success: true, data: { seats } });
    await pending;
    expect(notice.myStates()).toEqual(seats);
  });

  it('clears stale states when a subsequent profile is malformed', async () => {
    notice.myStates.set([{ moduleKey: 'crm', accessState: 'OVER_CAPACITY' }]);
    const pending = notice.refresh();
    http.expectOne(`${base}/seats/usage`).flush({ success: true, data: usage });
    http.expectOne(`${base}/auth/me`).flush({ success: true, data: { id: 'actor' } });
    await pending;
    expect(notice.myStates()).toEqual([]);
    expect(notice.usage()).toEqual(usage);
  });

  it('ignores a slower previous refresh', async () => {
    const first = notice.refresh();
    const oldUsage = http.expectOne(`${base}/seats/usage`);
    const oldProfile = http.expectOne(`${base}/auth/me`);
    const second = notice.refresh();
    http.expectOne(`${base}/seats/usage`).flush({ success: true, data: { ...usage, revision: 9 } });
    http.expectOne(`${base}/auth/me`).flush({ success: true, data: { seats: [] } });
    await second;
    oldUsage.flush({ success: true, data: usage });
    oldProfile.flush({ success: true, data: { seats } });
    await first;
    expect(notice.usage()?.revision).toBe(9);
    expect(notice.myStates()).toEqual([]);
  });
});
