import { Injectable, type WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoLoader, TranslocoService, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import arGlobal from '../../../../../../public/i18n/ar.json';
import enGlobal from '../../../../../../public/i18n/en.json';
import arGovernance from '../../../../../../public/i18n/trade-governance/ar.json';
import enGovernance from '../../../../../../public/i18n/trade-governance/en.json';
import arProfiles from '../../../../../../public/i18n/trade-gov-profiles/ar.json';
import enProfiles from '../../../../../../public/i18n/trade-gov-profiles/en.json';
import arShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enShared from '../../../../../../public/i18n/trade-shared/en.json';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { ApiError } from '../../shared/trade-api';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import type { DocumentProfile, ProfileCounts } from '../profiles.model';
import { PROFILE_REGISTRY_VERSION } from '../profiles.registry';
import { DocumentProfilesPage } from './document-profiles-page';

const TRANSLATIONS: Record<string, Translation> = {
  en: { ...enGlobal, governance: enGovernance, tradeShared: enShared, profiles: enProfiles },
  ar: { ...arGlobal, governance: arGovernance, tradeShared: arShared, profiles: arProfiles },
  'trade-governance/en': enGovernance,
  'trade-governance/ar': arGovernance,
  'trade-shared/en': enShared,
  'trade-shared/ar': arShared,
  'trade-gov-profiles/en': enProfiles,
  'trade-gov-profiles/ar': arProfiles,
};

@Injectable()
class ProfilesTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

function makeSeedProfiles(): DocumentProfile[] {
  const families = ['QUOTATION', 'SALES_ORDER', 'PURCHASE_ORDER'] as const;
  return families.map((documentType, idx) => ({
    id: `prof-${idx + 1}`,
    scopeTarget: 'COMPANY',
    companyId: 'c1',
    companyScopeKey: 'c1',
    code: 'DEFAULT',
    documentType,
    currentPublishedVersionId: `ver-${idx + 1}`,
    pointerVersion: 1,
    version: 1,
    createdBy: 'u1',
    updatedBy: 'u1',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    versions: [
      {
        id: `ver-${idx + 1}`,
        profileVersion: 1,
        schemaVersion: 'trade-document-profile.v1',
        registryVersion: PROFILE_REGISTRY_VERSION,
        runtimeVersion: 'trade-document-runtime.v1',
        checksum: `chk-${idx + 1}`,
        status: 'PUBLISHED',
        effectiveFrom: '2026-11-01T00:00:00.000Z',
        effectiveTo: null,
        supersededAt: null,
        supersededByVersionId: null,
        version: 1,
        authorUserId: 'u1',
        validatedBy: 'u1',
        publishedBy: 'u2',
      },
    ],
  }));
}

async function flush(harness: RouterTestingHarness): Promise<void> {
  harness.detectChanges();
  await Promise.resolve();
  await Promise.resolve();
  harness.detectChanges();
  await Promise.resolve();
  harness.detectChanges();
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`DocumentProfilesPage (${lang} ${theme})`, () => {
      let stub: TradeHttpStub;
      let dispose: () => void;
      let harness: RouterTestingHarness;
      let me: WritableSignal<TenantMe | null>;
      let notify: {
        success: ReturnType<typeof vi.fn>;
        error: ReturnType<typeof vi.fn>;
        warning: ReturnType<typeof vi.fn>;
        info: ReturnType<typeof vi.fn>;
      };
      let previousTheme: string | null;
      let previousDir: string;
      let previousLang: string;
      const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
      const originalDialog = {
        showModal: dialogProto['showModal'],
        close: dialogProto['close'],
      };

      function setGrants(keys: string[]): void {
        const permissionScopes: TenantMe['permissionScopes'] = {};
        for (const k of keys) {
          permissionScopes[k] = { tenantWide: true, companyIds: ['c1'], branchIds: ['b1'] };
        }
        me.set({
          ...FAKE_TENANT_ME,
          id: 'user-1',
          isTenantOwner: false,
          permissions: keys,
          permissionScopes,
          accessibleCompanies: ['c1'],
          accessibleBranches: ['b1'],
          accessibleBranchCompanies: [{ companyId: 'c1', branchId: 'b1' }],
        });
      }

      beforeEach(async () => {
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
        localStorage.clear();
        sessionStorage.clear();
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDir = document.documentElement.dir;
        previousLang = document.documentElement.lang;
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', theme);

        me = signal<TenantMe | null>(null);
        setGrants(['trade.document_profiles.read', 'trade.document_profiles.manage']);
        notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
        const counts: ProfileCounts = {
          total: 3,
          byDocumentType: { QUOTATION: 1, SALES_ORDER: 1, PURCHASE_ORDER: 1 },
        };
        stub = new TradeHttpStub({
          'GET /document-profiles': { items: makeSeedProfiles(), total: 3, page: 1, limit: 100 },
          'GET /document-profiles/counts': counts,
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [DocumentProfilesPage],
          providers: [
            provideRouter([
              { path: '', children: [] },
              { path: 'trade/governance/document-profiles', component: DocumentProfilesPage },
            ]),
            provideTransloco({
              config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true },
              loader: ProfilesTranslocoLoader,
            }),
            { provide: Notify, useValue: notify },
            { provide: TenantScopeState, useValue: { me, selection: signal({ companyId: 'c1', branchId: 'b1' }), branchesFor: () => ['b1'] } },
            { provide: LanguageState, useValue: { current: signal(lang) } },
          ],
        });
        TestBed.inject(TranslocoService).setTranslation(TRANSLATIONS[lang], lang);
        harness = await RouterTestingHarness.create();
      });

      afterEach(() => {
        harness?.fixture.destroy();
        dispose();
        vi.restoreAllMocks();
        TestBed.resetTestingModule();
        localStorage.clear();
        sessionStorage.clear();
        if (originalDialog.showModal) dialogProto['showModal'] = originalDialog.showModal;
        else Reflect.deleteProperty(dialogProto, 'showModal');
        if (originalDialog.close) dialogProto['close'] = originalDialog.close;
        else Reflect.deleteProperty(dialogProto, 'close');
        if (previousTheme) document.documentElement.setAttribute('data-theme', previousTheme);
        else document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = previousDir;
        document.documentElement.lang = previousLang;
      });

      it('loads the 3 seeded DEFAULT profiles, keeps hints without raw keys, and gates New profile on manage', async () => {
        await harness.navigateByUrl('/trade/governance/document-profiles', DocumentProfilesPage);
        await flush(harness);

        const host = harness.fixture.nativeElement as HTMLElement;
        const text = host.textContent ?? '';
        expect(text).toContain('DEFAULT');
        expect(text).toContain(TRANSLATIONS[lang]['profiles']['list']['newProfile']);
        expect(text).not.toContain('profiles.');
        expect(text).not.toContain('governance.');
        expect(host.querySelectorAll('[id$="-hint"]').length).toBeGreaterThan(0);

        setGrants(['trade.document_profiles.read']);
        await flush(harness);
        expect((harness.fixture.nativeElement as HTMLElement).textContent ?? '').not.toContain(
          TRANSLATIONS[lang]['profiles']['list']['newProfile'],
        );
      });

      it('renders forbidden state without HTTP calls when read key is missing, and on server 403 without toast', async () => {
        setGrants([]);
        await harness.navigateByUrl('/trade/governance/document-profiles', DocumentProfilesPage);
        await flush(harness);

        expect(stub.recordedReads()).toHaveLength(0);
        let fullState = harness.fixture.debugElement.query(By.directive(FullState));
        expect(fullState?.componentInstance.kind()).toBe('forbidden');

        stub.register('GET', '/document-profiles', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        setGrants(['trade.document_profiles.read']);
        await flush(harness);

        expect(notify.error).not.toHaveBeenCalled();
        fullState = harness.fixture.debugElement.query(By.directive(FullState));
        expect(fullState?.componentInstance.kind()).toBe('forbidden');
      });

      it('renders not-ready full state on 503 PUBLICATION_UNAVAILABLE without error toast', async () => {
        stub.register(
          'GET',
          '/document-profiles',
          new ApiError(503, 'TRADE.DOCUMENT_PROFILE.PUBLICATION_UNAVAILABLE'),
        );
        await harness.navigateByUrl('/trade/governance/document-profiles', DocumentProfilesPage);
        await flush(harness);

        expect(notify.error).not.toHaveBeenCalled();
        const fullState = harness.fixture.debugElement.query(By.directive(FullState));
        expect(fullState?.componentInstance.kind()).toBe('provisioning');
        expect(fullState?.componentInstance.title()).toBe(
          TRANSLATIONS[lang]['profiles']['errors']['publicationUnavailableTitle'],
        );
      });
    });
  }
}
