import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { ActivationApi } from '../activation.api';
import { ReasonModal } from './reason-modal';

describe('ReasonModal keyed actions', () => {
  let fixture: ComponentFixture<ReasonModal>;
  let modal: ReasonModal;
  let api: ActivationApi;
  let http: HttpTestingController;
  beforeEach(() => {
    document.cookie = 'mutakamel-http-tenant-csrf=csrf; path=/';
    TestBed.configureTestingModule({ imports: [ReasonModal, TranslocoTestingModule.forRoot({ langs: { en: {} },
      translocoConfig: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } } })],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: TenantScopeState,
        useValue: { me: signal({ id: 'actor' }), selection: signal(null) } }],
    });
    fixture = TestBed.createComponent(ReasonModal); modal = fixture.componentInstance;
    api = TestBed.inject(ActivationApi); http = TestBed.inject(HttpTestingController);
    modal['reason'].set('Owner request');
  });
  afterEach(() => { fixture.destroy(); http.verify(); document.cookie = 'mutakamel-http-tenant-csrf=; max-age=0; path=/'; });

  for (const action of ['application', 'addon', 'branch'] as const) {
    it.each([[0, 'NETWORK_ERROR'], [500, 'SERVER_ERROR'], [409, 'GW.IDEM.IN_FLIGHT'], [401, 'COMMON.GENERIC.UNAUTHORIZED']])(
      `${action} retains the exact body and UUID v7 key after %s %s, and changes the key with the body`, async (status, code) => {
        modal['submitHandler'] = async (reason, key) => {
          try {
            const body = { expectedActivationRevision: '1', enabled: false, reason };
            if (action === 'application') await api.setCompanyApplication('co', 'crm', body, key);
            if (action === 'addon') await api.setCompanyAddon('co', 'crm', 'crm.homes', { ...body, definitionVersionId: 'definition' }, key);
            if (action === 'branch') await api.setBranchOverride('br', 'crm', 'crm.homes', { expectedOverrideRevision: '1', mode: 'DISABLED', reason }, key);
          } catch (error) { modal.retainKeyFor(error); }
          return false;
        };
        const attempt = async () => {
          const pending = modal['onSubmit'](new Event('submit'));
          const req = http.expectOne((r) => r.method === 'PATCH');
          const sent = { body: req.request.body, key: req.request.headers.get('x-idempotency-key') };
          expect(sent.key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
          expect(req.request.headers.get('x-csrf-token')).toBe('csrf');
          if (status === 0) req.error(new ProgressEvent('error'));
          else req.flush({ errorCode: code }, { status, statusText: 'Failure' });
          await pending; return sent;
        };
        const first = await attempt(); const second = await attempt(); expect(second).toEqual(first);
        modal['reason'].set('Another reason'); const changed = await attempt(); expect(changed.key).not.toBe(first.key);
        expect(changed.body.reason).toBe('Another reason');
      });
  }
});
