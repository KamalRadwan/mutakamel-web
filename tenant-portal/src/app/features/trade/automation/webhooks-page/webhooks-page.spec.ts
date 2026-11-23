import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arWebhooks from '../../../../../../public/i18n/trade-auto-webhooks/ar.json';
import enWebhooks from '../../../../../../public/i18n/trade-auto-webhooks/en.json';
import arAutomation from '../../../../../../public/i18n/trade-automation/ar.json';
import enAutomation from '../../../../../../public/i18n/trade-automation/en.json';
import arTradeShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enTradeShared from '../../../../../../public/i18n/trade-shared/en.json';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { CoreWriteMethod, CoreWriteOptions, CoreWriteResult } from '../../../../core/api/core-http';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { ApiError } from '../../shared/trade-api';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeCoreStub, TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { RevealSecretModal } from '../reveal-secret-modal/reveal-secret-modal';
import type { RevealSecretResult, WebhookDeliveryCounts, WebhookSubscription } from '../webhooks.model';
import { WebhooksPage } from './webhooks-page';

const TRANSLATIONS: Record<string, Translation> = {
  en: { ...en, webhooks: enWebhooks, automation: enAutomation, tradeShared: enTradeShared },
  ar: { ...ar, webhooks: arWebhooks, automation: arAutomation, tradeShared: arTradeShared },
  'trade-auto-webhooks/en': enWebhooks,
  'trade-auto-webhooks/ar': arWebhooks,
  'trade-automation/en': enAutomation,
  'trade-automation/ar': arAutomation,
  'trade-shared/en': enTradeShared,
  'trade-shared/ar': arTradeShared,
};

@Injectable()
class TestTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

class RevealAwareCoreStub extends TradeCoreStub {
  readonly revealCalls: Array<{ path: string; body: unknown; key: string | undefined }> = [];

  override async write<T>(
    method: CoreWriteMethod,
    path: string,
    body?: unknown,
    options?: Omit<CoreWriteOptions, 'bare' | 'noBody'>,
  ): Promise<CoreWriteResult<T>> {
    this.revealCalls.push({ path, body, key: options?.key });
    const shortPath = path.replace(/^\/api\/tenant\/trade\/v1/, '');
    const result = await super.write<T>(method, shortPath, body, {
      ...options,
      key: options?.key ?? 'core-write-without-idempotency-key',
    });
    return result;
  }
}

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

const SUB_ID = '019a0000-0000-7000-8000-000000000101';
const SECRET_REF_ID = '019a0000-0000-7000-8000-000000000201';

function makeSubscription(over: Partial<WebhookSubscription> = {}): WebhookSubscription {
  return {
    id: SUB_ID,
    code: 'ERP_SYNC',
    status: 'ACTIVE',
    version: 2,
    scopeTarget: 'COMPANY',
    companyId: 'c1',
    endpoint: { origin: 'https://erp.example.com', pathname: '/hooks/trade' },
    activeVersionNumber: 1,
    secret: {
      id: SECRET_REF_ID,
      status: 'ACTIVE',
      providerSecretVersion: '1',
      algorithmCode: 'HMAC_SHA256',
      signatureVersion: 1,
      activeFrom: '2026-11-20T00:00:00.000Z',
      overlapUntil: null,
      revokedAt: null,
    },
    updatedAt: '2026-11-23T00:00:00.000Z',
    ...over,
  };
}

function emptyCounts(): WebhookDeliveryCounts {
  return {
    total: 0,
    byStatus: {
      PENDING: 0,
      RETRY_PENDING: 0,
      DELIVERED: 0,
      FAILED: 0,
      EXHAUSTED: 0,
      DISABLED: 0,
    },
  };
}

function makeMe(
  keys: readonly string[],
  options: { tenantWide?: boolean; companyIds?: string[]; branchIds?: string[] } = {},
): TenantMe {
  const permissionScopes: TenantMe['permissionScopes'] = {};
  for (const key of keys) {
    permissionScopes[key] = {
      tenantWide: options.tenantWide ?? false,
      companyIds: options.companyIds ?? ['c1'],
      branchIds: options.branchIds ?? ['b1'],
    };
  }
  return {
    ...FAKE_TENANT_ME,
    isTenantOwner: false,
    accessibleCompanies: ['c1'],
    accessibleBranches: ['b1'],
    accessibleBranchCompanies: [{ companyId: 'c1', branchId: 'b1' }],
    permissions: [...keys],
    permissionScopes,
  };
}

function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const paths: string[] = [];
  for (const key of Object.keys(obj).sort()) {
    const next = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      paths.push(...keyPaths(val as Record<string, unknown>, next));
    } else {
      paths.push(next);
    }
  }
  return paths;
}

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && !Array.isArray(acc)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

describe('trade-auto-webhooks i18n parity', () => {
  it('keeps EN and AR keys identical including SECRET_QUERY_FORBIDDEN', () => {
    expect(keyPaths(enWebhooks as Record<string, unknown>)).toEqual(
      keyPaths(arWebhooks as Record<string, unknown>),
    );
    expect(getNested(enWebhooks as Record<string, unknown>, 'subscription.endpointProblems.SECRET_QUERY_FORBIDDEN')).toBeTruthy();
    expect(getNested(arWebhooks as Record<string, unknown>, 'subscription.endpointProblems.SECRET_QUERY_FORBIDDEN')).toBeTruthy();
  });
});

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`WebhooksPage (${lang} ${theme})`, () => {
      const me = signal<TenantMe | null>(null);
      let stub: TradeHttpStub;
      let coreStub: RevealAwareCoreStub;
      let restoreHttp: () => void;
      let previousTheme: string | null;
      let previousDir: string;
      let previousLang: string;

      beforeEach(() => {
        globalThis.ResizeObserver ??= class {
          observe() {}
          unobserve() {}
          disconnect() {}
        } as never;
        dialogProto['showModal'] = function (this: HTMLDialogElement) {
          this.setAttribute('open', '');
        };
        dialogProto['close'] = function (this: HTMLDialogElement) {
          if (!this.hasAttribute('open')) return;
          this.removeAttribute('open');
          this.dispatchEvent(new Event('close'));
        };
        localStorage.removeItem('scope');
        sessionStorage.removeItem('scope');
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDir = document.documentElement.dir;
        previousLang = document.documentElement.lang;
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;

        me.set(makeMe(['trade.webhooks.read', 'trade.webhooks.manage', 'trade.webhooks.replay']));
        stub = new TradeHttpStub({
          'GET /webhooks/events': { items: [] },
          'GET /webhooks/subscriptions': { items: [makeSubscription()], total: 1, page: 1, limit: 100 },
          'GET /webhooks/deliveries/counts': emptyCounts(),
          'GET /webhooks/deliveries': { items: [], total: 0, page: 1, limit: 24 },
          'POST /webhooks/subscriptions/:id/reveal-secret': {
            secretReferenceId: SECRET_REF_ID,
            secret: 'whsec_once_only_test_value',
            secretEncoding: 'base64',
            algorithmCode: 'HMAC_SHA256',
          } satisfies RevealSecretResult,
        });
        coreStub = new RevealAwareCoreStub({
          'POST /webhooks/subscriptions/:id/reveal-secret': {
            secretReferenceId: SECRET_REF_ID,
            secret: 'whsec_once_only_test_value',
            secretEncoding: 'base64',
            algorithmCode: 'HMAC_SHA256',
          } satisfies RevealSecretResult,
        });
        restoreHttp = bindTradeHttpForTest(stub, coreStub);
      });

      afterEach(() => {
        TestBed.resetTestingModule();
        restoreHttp();
        vi.restoreAllMocks();
        localStorage.removeItem('scope');
        sessionStorage.removeItem('scope');
        if (originalDialog.showModal) dialogProto['showModal'] = originalDialog.showModal;
        else Reflect.deleteProperty(dialogProto, 'showModal');
        if (originalDialog.close) dialogProto['close'] = originalDialog.close;
        else Reflect.deleteProperty(dialogProto, 'close');
        if (previousTheme) document.documentElement.setAttribute('data-theme', previousTheme);
        else document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = previousDir;
        document.documentElement.lang = previousLang;
      });

      function configureModule(): void {
        const company = { id: 'c1', name: 'Cairo Main', branches: [{ id: 'b1', name: 'Downtown' }] };
        TestBed.configureTestingModule({
          providers: [
            provideRouter([]),
            provideTransloco({
              config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true, prodMode: false },
              loader: TestTranslocoLoader,
            }),
            { provide: TenantScopeState, useValue: { me } },
            { provide: LanguageState, useValue: { current: signal(lang) } },
            {
              provide: ScopeState,
              useValue: {
                company: signal(company),
                branch: signal(company.branches[0]),
                companies: signal([company]),
                branches: signal(company.branches),
              },
            },
          ],
        });
        TestBed.inject(TranslocoService).setActiveLang(lang);
      }

      async function renderPage(inputs: Record<string, string> = {}): Promise<ComponentFixture<WebhooksPage>> {
        configureModule();
        const fixture = TestBed.createComponent(WebhooksPage);
        for (const [k, v] of Object.entries(inputs)) {
          fixture.componentRef.setInput(k, v);
        }
        fixture.detectChanges();
        await vi.waitFor(() => expect(fixture.componentInstance['subscriptionsLoading']()).toBe(false));
        fixture.detectChanges();
        return fixture;
      }

      it('shows forbidden empty-state and performs 0 reads without trade.webhooks.read', async () => {
        me.set(makeMe([]));
        const notifySpy = vi.spyOn(Notify.prototype, 'error');
        const fixture = await renderPage();

        expect(stub.recordedReads()).toHaveLength(0);
        expect(fixture.componentInstance['isForbidden']()).toBe(true);
        expect(fixture.nativeElement.querySelector('ui-full-state')).not.toBeNull();
        expect(notifySpy).not.toHaveBeenCalled();
      });

      it('shows subscriptions with read grant only and disables manage/create and replay without their keys', async () => {
        me.set(makeMe(['trade.webhooks.read']));
        const fixture = await renderPage();

        expect(fixture.componentInstance['isForbidden']()).toBe(false);
        expect(fixture.componentInstance['canRead']()).toBe(true);
        expect(fixture.componentInstance['canManage']()).toBe(false);
        expect(fixture.componentInstance['canReplay']()).toBe(false);
        expect(fixture.nativeElement.querySelector('ui-full-state')).toBeNull();
        expect(fixture.nativeElement.textContent).toContain('ERP_SYNC');
      });

      it('allows manage at COMPANY scope and enforces branch-scope restriction at ?scope=branch', async () => {
        me.set(makeMe(['trade.webhooks.read', 'trade.webhooks.manage', 'trade.webhooks.replay']));
        const companyFixture = await renderPage({ scope: 'company' });

        expect(companyFixture.componentInstance['canManage']()).toBe(true);
        expect(companyFixture.componentInstance['canReplay']()).toBe(true);

        TestBed.resetTestingModule();
        stub.reset();
        const branchFixture = await renderPage({ scope: 'branch' });
        expect(branchFixture.componentInstance['canManage']()).toBe(false);
        expect(branchFixture.componentInstance['canReplay']()).toBe(true);
      });

      it('renders forbidden state without error toast when server returns 403', async () => {
        stub.register('GET', '/webhooks/subscriptions', new ApiError(403, 'GW.AUTH.FORBIDDEN'));
        const notifySpy = vi.spyOn(Notify.prototype, 'error');
        const fixture = await renderPage();

        expect(fixture.componentInstance['isForbidden']()).toBe(true);
        expect(fixture.nativeElement.querySelector('ui-full-state')).not.toBeNull();
        expect(notifySpy).not.toHaveBeenCalled();
      });

      it('renders forbidden state without a toast when a subscription write returns 403', async () => {
        stub.register('PATCH', '/webhooks/subscriptions/:id', new ApiError(403, 'GW.AUTH.FORBIDDEN'));
        const notifySpy = vi.spyOn(Notify.prototype, 'error');
        const fixture = await renderPage();
        await fixture.componentInstance['onToggleStatusRow'](makeSubscription());
        fixture.detectChanges();
        expect(fixture.componentInstance['isForbidden']()).toBe(true);
        expect(fixture.nativeElement.querySelector('ui-full-state')).not.toBeNull();
        expect(notifySpy).not.toHaveBeenCalled();
      });

      it('loads deliveries view counts and list when ?view=deliveries is active', async () => {
        const fixture = await renderPage({ view: 'deliveries' });
        await vi.waitFor(() => expect(fixture.componentInstance['deliveriesLoading']()).toBe(false));

        const readPaths = stub.recordedReads().map((r) => r.path);
        expect(readPaths).toContain('/webhooks/deliveries/counts');
        expect(readPaths).toContain('/webhooks/deliveries');
      });

      it('RevealSecretModal calls reveal-secret once with no key, keeps close disabled until acknowledged, and wipes secret on close', async () => {
        configureModule();
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const fixture = TestBed.createComponent(RevealSecretModal);
        fixture.componentRef.setInput('subscriptionId', SUB_ID);
        fixture.componentRef.setInput('secretReferenceId', SECRET_REF_ID);
        fixture.componentRef.setInput('ctx', { companyId: 'c1' });
        fixture.detectChanges();

        await vi.waitFor(() => expect(fixture.componentInstance['loading']()).toBe(false));
        fixture.detectChanges();

        expect(coreStub.revealCalls).toHaveLength(1);
        expect(coreStub.revealCalls[0].key).toBeUndefined();
        expect(coreStub.revealCalls[0].body).toEqual({ secretReferenceId: SECRET_REF_ID });
        expect(fixture.componentInstance['secretValue']()).toBe('whsec_once_only_test_value');
        expect(fixture.componentInstance['canClose']()).toBe(false);
        expect(JSON.stringify(logSpy.mock.calls)).not.toContain('whsec_once_only_test_value');

        const closedSpy = vi.fn();
        fixture.componentInstance.closed.subscribe(closedSpy);
        fixture.componentInstance['attemptClose']();
        expect(closedSpy).not.toHaveBeenCalled();

        const checkbox = fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        expect(checkbox).not.toBeNull();
        checkbox!.click();
        fixture.detectChanges();
        expect(fixture.componentInstance['canClose']()).toBe(true);

        fixture.componentInstance['attemptClose']();
        fixture.detectChanges();

        expect(fixture.componentInstance['secretValue']()).toBe('');
        expect(closedSpy).toHaveBeenCalledWith(true);
      });

      it('RevealSecretModal emits forbidden without error toast on 403', async () => {
        coreStub.register('POST', '/webhooks/subscriptions/:id/reveal-secret', new ApiError(403, 'GW.AUTH.FORBIDDEN'));
        configureModule();
        const notifySpy = vi.spyOn(Notify.prototype, 'error');
        const fixture = TestBed.createComponent(RevealSecretModal);
        const forbiddenSpy = vi.fn();
        fixture.componentInstance.forbidden.subscribe(forbiddenSpy);
        fixture.componentRef.setInput('subscriptionId', SUB_ID);
        fixture.componentRef.setInput('secretReferenceId', SECRET_REF_ID);
        fixture.componentRef.setInput('ctx', { companyId: 'c1' });
        fixture.detectChanges();

        await vi.waitFor(() => expect(forbiddenSpy).toHaveBeenCalledTimes(1));
        expect(notifySpy).not.toHaveBeenCalled();
      });
    });
  }
}
