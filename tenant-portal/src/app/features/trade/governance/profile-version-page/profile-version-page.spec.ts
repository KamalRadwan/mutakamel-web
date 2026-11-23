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
import { ConflictDialog } from '../governance-shared/conflict-dialog/conflict-dialog';
import { ProfileContentEditor } from '../profile-content-editor/profile-content-editor';
import type {
  DocumentProfile,
  ProfileContent,
  ProfilePublishResult,
  ProfileVersionCreated,
  ProfileVersionDetail,
} from '../profiles.model';
import { PROFILE_REGISTRY, PROFILE_REGISTRY_VERSION, defaultProfileContent } from '../profiles.registry';
import { ProfileVersionPage } from './profile-version-page';

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
class VersionTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

function makeProfile(docType: 'QUOTATION' | 'SALES_ORDER' = 'SALES_ORDER'): DocumentProfile {
  return {
    id: 'prof-1',
    scopeTarget: 'COMPANY',
    companyId: 'c1',
    companyScopeKey: 'c1',
    code: 'DEFAULT',
    documentType: docType,
    currentPublishedVersionId: null,
    pointerVersion: 2,
    version: 3,
    createdBy: 'colleague-1',
    updatedBy: 'colleague-1',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
    versions: [],
  };
}

function makeVersionDetail(overrides: Partial<ProfileVersionDetail> = {}): ProfileVersionDetail {
  return {
    id: 'ver-2',
    profileVersion: 2,
    schemaVersion: 'trade-document-profile.v1',
    registryVersion: PROFILE_REGISTRY_VERSION,
    runtimeVersion: 'trade-document-runtime.v1',
    checksum: 'chk-2',
    status: 'TESTED',
    effectiveFrom: '2026-11-01T00:00:00.000Z',
    effectiveTo: null,
    supersededAt: null,
    supersededByVersionId: null,
    version: 2,
    authorUserId: 'colleague-1',
    validatedBy: 'colleague-1',
    publishedBy: null,
    content: defaultProfileContent('SALES_ORDER'),
    requiredCases: [],
    latestValidationRun: null,
    profile: {
      id: 'prof-1',
      code: 'DEFAULT',
      documentType: 'SALES_ORDER',
      scopeTarget: 'COMPANY',
      pointerVersion: 2,
      currentPublishedVersionId: null,
    },
    ...overrides,
  };
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
    describe(`ProfileVersionPage (${lang} ${theme})`, () => {
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
        setGrants([
          'trade.document_profiles.read',
          'trade.document_profiles.manage',
          'trade.document_profiles.validate',
          'trade.document_profiles.publish',
        ]);
        notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
        stub = new TradeHttpStub({
          'GET /document-profiles/registry': PROFILE_REGISTRY,
          'GET /document-profiles/:id': makeProfile('SALES_ORDER'),
          'GET /document-profile-versions/:id': makeVersionDetail(),
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [ProfileVersionPage],
          providers: [
            provideRouter([
              { path: '', children: [] },
              {
                path: 'trade/governance/document-profiles/:id/versions/:versionId',
                component: ProfileVersionPage,
              },
            ]),
            provideTransloco({
              config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true },
              loader: VersionTranslocoLoader,
            }),
            { provide: Notify, useValue: notify },
            { provide: TenantScopeState, useValue: { me } },
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

      it('strips `include` from evidence[] in ProfileContentEditor and createVersion (G-9), and maps CONFIRMATION_MODE_UNSUPPORTED and EFFECTIVE_OVERLAP to fields', async () => {
        const page = (await harness.navigateByUrl(
          '/trade/governance/document-profiles/prof-1/versions/new',
          ProfileVersionPage,
        )) as unknown as {
          onTabChange(tab: string): void;
          submitCreateVersion(): Promise<void>;
          activeTab(): string;
          fromError(): string | null;
        };
        await flush(harness);

        page.onTabChange('evidence');
        await flush(harness);

        const editor = harness.fixture.debugElement.query(By.directive(ProfileContentEditor))
          .componentInstance as ProfileContentEditor & {
          setEvidenceInclude(def: { code: string; defaultInclude: boolean; defaultRequired: boolean }, on: boolean): void;
          setEvidenceRequired(def: { code: string; defaultInclude: boolean; defaultRequired: boolean }, on: boolean): void;
        };
        editor.setEvidenceInclude(
          { code: 'SUPPLIER_ACKNOWLEDGEMENT', defaultInclude: false, defaultRequired: false },
          true,
        );
        editor.setEvidenceInclude(
          { code: 'CUSTOMER_ACCEPTANCE', defaultInclude: true, defaultRequired: false },
          false,
        );
        editor.setEvidenceRequired(
          { code: 'PRICE_DECISION', defaultInclude: true, defaultRequired: false },
          true,
        );
        await flush(harness);

        // UI state keeps `include` stripped from the emitted content model
        const emittedEvidence = editor.content().evidence;
        expect(emittedEvidence.every((e) => !('include' in e))).toBe(true);
        expect(emittedEvidence.some((e) => e.code === 'SUPPLIER_ACKNOWLEDGEMENT')).toBe(true);
        expect(emittedEvidence.some((e) => e.code === 'CUSTOMER_ACCEPTANCE')).toBe(false);

        // 422 CONFIRMATION_MODE_UNSUPPORTED maps to the confirmationMode field on the behaviour tab
        stub.register(
          'POST',
          '/document-profiles/:id/versions',
          new ApiError(422, 'TRADE.DOCUMENT_PROFILE.CONFIRMATION_MODE_UNSUPPORTED'),
        );
        await page.submitCreateVersion();
        await flush(harness);
        expect(page.activeTab()).toBe('behaviour');
        expect((harness.fixture.nativeElement as HTMLElement).textContent ?? '').toContain(
          TRANSLATIONS[lang]['profiles']['errors']['confirmationModeUnsupported'],
        );

        // EFFECTIVE_OVERLAP maps to the effectiveFrom field
        stub.register(
          'POST',
          '/document-profiles/:id/versions',
          new ApiError(409, 'TRADE.DOCUMENT_PROFILE.EFFECTIVE_OVERLAP'),
        );
        await page.submitCreateVersion();
        await flush(harness);
        expect(page.fromError()).toBe(TRANSLATIONS[lang]['profiles']['errors']['effectiveOverlap']);

        // Successful create sends { code, required } only without `include`
        const created: ProfileVersionCreated = {
          ...makeVersionDetail({ status: 'DRAFT' }),
          profileId: 'prof-1',
          content: editor.content(),
          restoredFromVersionId: null,
          restorationReason: null,
          scheduledExpectedPointerVersion: null,
          requiredCaseCount: 4,
        };
        stub.register('POST', '/document-profiles/:id/versions', created);
        await page.submitCreateVersion();
        await flush(harness);

        const body = stub.recordedWrites().at(-1)?.body as { content: ProfileContent };
        expect(body.content.evidence.every((item) => !('include' in item))).toBe(true);
      });

      it('does not reopen publishing when the profile refresh fails despite a successful version read', async () => {
        const page = (await harness.navigateByUrl(
          '/trade/governance/document-profiles/prof-1/versions/ver-2', ProfileVersionPage,
        )) as unknown as {
          openPublishModal(): void;
          confirmPublish(): Promise<void>;
          onConflictReload(): Promise<void>;
        };
        await flush(harness);
        stub.register('POST', '/document-profile-versions/:id/publish',
          new ApiError(409, 'TRADE.DOCUMENT_PROFILE.ACTIVE_POINTER_STALE'));
        stub.register('GET', '/document-profiles/:id', new ApiError(500, 'SERVER_ERROR'));
        page.openPublishModal();
        await page.confirmPublish();
        await flush(harness);
        const reopen = vi.spyOn(page, 'openPublishModal');
        await page.onConflictReload();
        await flush(harness);
        expect(reopen).not.toHaveBeenCalled();
        expect(stub.recordedWrites()).toHaveLength(1);
      });

      it('handles ACTIVE_POINTER_STALE without silent retry and resends updated expectedActivePointerVersion only after confirmation', async () => {
        const page = (await harness.navigateByUrl(
          '/trade/governance/document-profiles/prof-1/versions/ver-2',
          ProfileVersionPage,
        )) as unknown as {
          openPublishModal(): void;
          confirmPublish(): Promise<void>;
          onConflictReload(): Promise<void>;
        };
        await flush(harness);

        stub.register(
          'POST',
          '/document-profile-versions/:id/publish',
          new ApiError(409, 'TRADE.DOCUMENT_PROFILE.ACTIVE_POINTER_STALE'),
        );
        stub.register('GET', '/document-profiles/:id', {
          ...makeProfile('SALES_ORDER'),
          pointerVersion: 9,
        });
        stub.register(
          'GET',
          '/document-profile-versions/:id',
          makeVersionDetail({
            profile: {
              id: 'prof-1',
              code: 'DEFAULT',
              documentType: 'SALES_ORDER',
              scopeTarget: 'COMPANY',
              pointerVersion: 9,
              currentPublishedVersionId: null,
            },
          }),
        );

        page.openPublishModal();
        await page.confirmPublish();
        await flush(harness);

        // Never retry silently
        expect(stub.recordedWrites()).toHaveLength(1);
        const conflict = harness.fixture.debugElement.query(By.directive(ConflictDialog))
          ?.componentInstance as ConflictDialog;
        expect(conflict.title()).toBe(TRANSLATIONS[lang]['profiles']['errors']['activePointerStaleTitle']);

        const pubRes: ProfilePublishResult = {
          ...makeVersionDetail({ status: 'PUBLISHED', version: 3 }),
          profileId: 'prof-1',
          content: defaultProfileContent('SALES_ORDER'),
          restoredFromVersionId: null,
          restorationReason: null,
          scheduledExpectedPointerVersion: null,
          activePointerVersion: 10,
          active: true,
        };
        stub.register('POST', '/document-profile-versions/:id/publish', pubRes);

        await page.onConflictReload();
        await flush(harness);
        expect(stub.recordedWrites()).toHaveLength(1);

        await page.confirmPublish();
        await flush(harness);
        expect(stub.recordedWrites()).toHaveLength(2);
        expect(stub.recordedWrites()[1].body).toEqual({ expectedActivePointerVersion: 9 });
      });

      it('renders contentHidden notice, 503 PUBLICATION_UNAVAILABLE not-ready state, and 403 forbidden without error toast', async () => {
        stub.register(
          'GET',
          '/document-profile-versions/:id',
          makeVersionDetail({ status: 'DRAFT', content: undefined, contentHidden: true }),
        );
        await harness.navigateByUrl(
          '/trade/governance/document-profiles/prof-1/versions/ver-2',
          ProfileVersionPage,
        );
        await flush(harness);
        expect((harness.fixture.nativeElement as HTMLElement).textContent ?? '').toContain(
          TRANSLATIONS[lang]['profiles']['version']['contentHidden'],
        );

        // 503 PUBLICATION_UNAVAILABLE -> provisioning state without toast
        notify.error.mockClear();
        stub.register(
          'GET',
          '/document-profile-versions/:id',
          new ApiError(503, 'TRADE.DOCUMENT_PROFILE.PUBLICATION_UNAVAILABLE'),
        );
        const page = (await harness.navigateByUrl(
          '/trade/governance/document-profiles/prof-1/versions/ver-2',
          ProfileVersionPage,
        )) as unknown as { reload(): void };
        page.reload();
        await flush(harness);
        expect(harness.fixture.debugElement.query(By.directive(FullState))?.componentInstance.kind()).toBe(
          'provisioning',
        );
        expect(notify.error).not.toHaveBeenCalled();

        // 403 -> forbidden state without toast
        stub.register('GET', '/document-profile-versions/:id', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        page.reload();
        await flush(harness);
        expect(harness.fixture.debugElement.query(By.directive(FullState))?.componentInstance.kind()).toBe(
          'forbidden',
        );
        expect(notify.error).not.toHaveBeenCalled();
      });
    });
  }
}
