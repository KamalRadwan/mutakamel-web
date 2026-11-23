import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { StaffSession } from '../../../staff/shared/staff-session';
import { BillingApi } from '../../billing.api';
import { SeatsSection } from './seats-section';

const path = '/api/tenant/core/v1/seats/usage';
const usage = { mode: 'DERIVED', revision: 12, modules: [] };

describe('SeatsSection live usage', () => {
  let fixture: ComponentFixture<SeatsSection>;
  let section: SeatsSection;
  let http: HttpTestingController;
  const notify = { error: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: StaffSession, useValue: { isOwner: () => true } },
      { provide: LanguageState, useValue: { current: signal('en') } },
      { provide: TranslocoService, useValue: { translate: (key: string) => key } },
      { provide: Notify, useValue: notify },
      { provide: BillingApi, useValue: { getSubscription: async () => ({ baseItems: [{ applicationKey: 'crm', id: 'live-item' }] }) } },
    ] });
    TestBed.overrideComponent(SeatsSection, { set: { template: '', imports: [] } });
    fixture = TestBed.createComponent(SeatsSection);
    section = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { fixture.destroy(); http.verify(); });

  it('uses the real seat envelope and live subscription item in change links', async () => {
    http.expectOne(path).flush({ success: true, data: usage });
    await settle();
    expect(section['usage']()).toEqual(usage);
    expect(section['loading']()).toBe(false);
    expect(section['changeQueries']().get('crm')).toEqual({ add: 'seats:live-item' });
  });

  it('shows failure and retries the HTTP read', async () => {
    http.expectOne(path).flush({ errorCode: 'SEAT_CAPACITY_INSUFFICIENT' }, { status: 503, statusText: 'Unavailable' });
    await settle();
    expect(section['failed']()).toBe(true);
    expect(notify.error).toHaveBeenCalled();
    section.reload();
    http.expectOne(path).flush({ success: true, data: usage });
    await settle();
    expect(section['failed']()).toBe(false);
    expect(section['usage']()?.revision).toBe(12);
  });
});

async function settle(): Promise<void> { for (let i = 0; i < 20; i++) await Promise.resolve(); }
