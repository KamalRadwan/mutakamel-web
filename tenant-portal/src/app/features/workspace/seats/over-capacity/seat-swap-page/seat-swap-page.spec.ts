import { DOCUMENT, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { StaffSession } from '../../../staff/shared/staff-session';
import { OverCapacityNotice } from '../over-capacity-notice.service';
import { SeatSwapPage } from './seat-swap-page';

const base = '/api/tenant/core/v1';
const usage = { mode: 'DERIVED', revision: 3, modules: [{ moduleKey: 'crm', kind: 'ROLE_DERIVED',
  nameI18n: { en: 'CRM', ar: 'CRM' }, capacity: 1, used: 1, overCapacity: 1,
  overCapacitySince: '2026-11-22T00:00:00Z', graceUntil: null, pendingCapacity: null }] };
const holder = { userId: 'release', name: 'Active user', email: 'active@example.invalid', status: 'ACTIVE',
  grantedAt: '2026-11-22T00:00:00Z', accessState: 'ACTIVE', cause: null, roles: [] };
const meta = { page: 1, limit: 100, total: 2, totalPages: 2, hasNext: true, hasPrev: false };

describe('SeatSwapPage HTTP flow', () => {
  let fixture: ComponentFixture<SeatSwapPage>;
  let page: SeatSwapPage;
  let http: HttpTestingController;
  const notify = { success: vi.fn(), error: vi.fn() };
  const refresh = vi.fn(async () => undefined);
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: StaffSession, useValue: { isOwner: () => true, scopeRevision: () => 'scope', can: () => true } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: LanguageState, useValue: { current: signal('en') } },
      { provide: Notify, useValue: notify },
      { provide: OverCapacityNotice, useValue: { refresh } },
      { provide: TranslocoService, useValue: { events$: new Subject(), selectTranslation: () => of({}), translate: (key: string) => key } },
    ] });
    TestBed.overrideComponent(SeatSwapPage, { set: { template: '', imports: [] } });
    const document = TestBed.inject(DOCUMENT);
    vi.spyOn(document, 'cookie', 'get').mockReturnValue(`${document.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=csrf`);
    fixture = TestBed.createComponent(SeatSwapPage); page = fixture.componentInstance;
    Object.defineProperty(page, 'confirmDialog', { value: () => ({ open: async () => true }) });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { fixture.destroy(); http.verify(); vi.restoreAllMocks(); });

  async function loaded(): Promise<void> {
    http.expectOne(`${base}/seats/usage`).flush({ success: true, data: usage });
    await settle(); fixture.detectChanges(); await settle();
    for (const path of ['companies', 'branches']) http.expectOne((req) => req.url === `${base}/organization/${path}`).flush({ success: true, data: [], meta: { ...meta, total: 0, totalPages: 0, hasNext: false } });
    const first = http.expectOne((req) => req.url.endsWith('/holders'));
    expect(first.request.params.get('limit')).toBe('100');
    first.flush({ success: true, data: [holder], meta });
    await settle();
    const second = http.expectOne((req) => req.url.endsWith('/holders'));
    expect(second.request.params.get('page')).toBe('2');
    second.flush({ success: true, data: [{ ...holder, userId: 'keep', name: 'Read-only user', accessState: 'OVER_CAPACITY' }], meta: { ...meta, page: 2, hasNext: false, hasPrev: true } });
    await settle();
  }

  it('loads every holder page and sends the capacity-neutral swap with a UUIDv7 key', async () => {
    await loaded();
    expect(page['holders']()).toHaveLength(2);
    page['selectedKeepId'].set('keep'); page['selectedReleaseId'].set('release');
    const pending = page['requestSwap'](); await settle();
    const request = http.expectOne(`${base}/seats/crm/swap`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ keepUserId: 'keep', releaseUserId: 'release' });
    expect(request.request.headers.get('x-idempotency-key')).toMatch(/^[0-9a-f-]{14}7[0-9a-f-]{21}$/);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf');
    request.flush({ success: true, data: { ...usage, revision: 4 } });
    await pending;
    expect(page['usage']()?.revision).toBe(4);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('maps a rejected swap and preserves the current holders', async () => {
    await loaded();
    page['selectedKeepId'].set('keep'); page['selectedReleaseId'].set('release');
    const pending = page['requestSwap'](); await settle();
    http.expectOne(`${base}/seats/crm/swap`).flush({ errorCode: 'SEAT_SWAP_INVALID' }, { status: 422, statusText: 'Invalid' });
    await pending;
    expect(notify.error).toHaveBeenCalledWith('SEAT_SWAP_INVALID');
    expect(page['usage']()?.revision).toBe(3);
    expect(page['swapping']()).toBe(false);
  });
});

async function settle(): Promise<void> { for (let i = 0; i < 30; i++) await Promise.resolve(); }
