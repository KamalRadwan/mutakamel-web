import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageState } from '../../../../../core/i18n/language';
import { StaffSession } from '../../../staff/shared/staff-session';
import { HoldersModal } from './holders-modal';

const base = '/api/tenant/core/v1';
const holder = { userId: 'user', name: 'Server holder', email: 'holder@example.invalid', status: 'ACTIVE',
  accessState: 'ACTIVE', grantedAt: '2026-11-23T00:00:00Z', cause: null,
  roles: [{ roleId: 'role', roleName: 'Sales', scope: { target: 'BRANCH' as const, companyId: 'company', branchId: 'branch' } }] };
const meta = { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false };

describe('HoldersModal live holders and organization', () => {
  let fixture: ComponentFixture<HoldersModal>;
  let modal: HoldersModal;
  let http: HttpTestingController;
  const dialog = { open: vi.fn(), close: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: StaffSession, useValue: { scopeRevision: () => 'scope', can: () => true } },
      { provide: LanguageState, useValue: { current: signal('en') } },
      { provide: TranslocoService, useValue: { selectTranslation: () => of({}), translate: (key: string) => key } },
    ] });
    TestBed.overrideComponent(HoldersModal, { set: { template: '', imports: [] } });
    fixture = TestBed.createComponent(HoldersModal); modal = fixture.componentInstance;
    Object.defineProperty(modal, 'modal', { value: () => dialog });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { fixture.destroy(); http.verify(); });

  async function lookups(): Promise<void> {
    await settle();
    http.expectOne((req) => req.url === `${base}/organization/companies`).flush({ success: true, data: [{ id: 'company', name: 'Live company' }], meta });
    http.expectOne((req) => req.url === `${base}/organization/branches`).flush({ success: true, data: [{ id: 'branch', name: 'Live branch' }], meta });
    await settle();
  }

  it('reads Core pages, resolves scope names, and sends search and pagination', async () => {
    modal.open('crm');
    const request = http.expectOne((req) => req.url === `${base}/seats/usage/crm/holders`);
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('limit')).toBe('20');
    request.flush({ success: true, data: [holder], meta });
    await lookups();
    expect(modal['holders']()).toEqual([holder]);
    expect(modal['total']()).toBe(1);
    expect(modal['roleLabel'](holder.roles[0])).toContain('Live branch');
    modal['search'].set('  server  ');
    modal['onPageChange'](2);
    const next = http.expectOne((req) => req.url === `${base}/seats/usage/crm/holders`);
    expect(next.request.params.get('page')).toBe('2');
    expect(next.request.params.get('search')).toBe('server');
    next.flush({ success: true, data: [], meta: { ...meta, page: 2 } });
    await settle();
    expect(modal['holders']()).toEqual([]);
  });

  it('shows failure for malformed holder pages and recovers on retry', async () => {
    modal.open('crm');
    http.expectOne((req) => req.url.endsWith('/holders')).flush({ success: true, data: [holder] });
    await lookups();
    expect(modal['failed']()).toBe(true);
    const retry = modal['load']();
    http.expectOne((req) => req.url.endsWith('/holders')).flush({ success: true, data: [holder], meta });
    await retry;
    expect(modal['failed']()).toBe(false);
  });

  it('ignores an earlier search response and a response after close', async () => {
    modal.open('crm');
    const older = http.expectOne((req) => req.url.endsWith('/holders'));
    await lookups();
    const newest = modal['load']();
    http.expectOne((req) => req.url.endsWith('/holders')).flush({ success: true, data: [holder], meta });
    await newest;
    older.flush({ success: true, data: [], meta });
    await settle();
    expect(modal['holders']()).toEqual([holder]);
    const pending = modal['load'](); modal.close();
    http.expectOne((req) => req.url.endsWith('/holders')).flush({ success: true, data: [], meta });
    await pending;
    expect(modal['holders']()).toEqual([holder]);
  });

  it('adapts webphone nested pages with real user status and email', async () => {
    modal.open('webphone');
    http.expectOne((req) => req.url.endsWith('/holders')).flush({ success: true, data: {
      data: [{ userId: 'user', name: 'Phone user', extension: '101', enabledAt: null, accessState: 'OVER_CAPACITY' }],
      meta: { page: 1, limit: 20, total: 1 },
    } });
    await lookups();
    http.expectOne(`${base}/users/user`).flush({ success: true, data: { email: 'phone@example.invalid', status: 'SUSPENDED' } });
    await settle();
    expect(modal['holders']()[0]).toMatchObject({ email: 'phone@example.invalid', status: 'SUSPENDED', accessState: 'OVER_CAPACITY', extension: '101' });
    expect(modal['total']()).toBe(1);
  });
});

async function settle(): Promise<void> { for (let i = 0; i < 30; i++) await Promise.resolve(); }
