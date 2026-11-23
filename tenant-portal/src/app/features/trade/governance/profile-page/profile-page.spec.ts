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
import type { GovernedRow } from '../governance-shared/governed-versions-table/governed-versions-table';
import type { DocumentProfile, ProfilePublishResult, ProfileVersion } from '../profiles.model';
import { PROFILE_REGISTRY_VERSION, defaultProfileContent } from '../profiles.registry';
import { ProfilePage } from './profile-page';

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
class ProfileTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

function makeVersion(overrides: Partial<ProfileVersion> = {}): ProfileVersion {
  return {
    id: 'ver-1',
    profileVersion: 1,
    schemaVersion: 'trade-document-profile.v1',
    registryVersion: PROFILE_REGISTRY_VERSION,
    runtimeVersion: 'trade-document-runtime.v1',
    checksum: 'chk-1',
    status: 'PUBLISHED',
    effectiveFrom: '2026-10-01T00:00:00.000Z',
    effectiveTo: null,
    supersededAt: null,
    supersededByVersionId: null,
    version: 2,
    authorUserId: 'colleague-1',
    validatedBy: 'colleague-1',
    publishedBy: 'user-1',
    ...overrides,
  };
}

function makeProfile(overrides: Partial<DocumentProfile> = {}): DocumentProfile {
  return {
    id: 'prof-1',
    scopeTarget: 'COMPANY',
    companyId: 'c1',
    companyScopeKey: 'c1',
    code: 'DEFAULT',
    documentType: 'QUOTATION',
    currentPublishedVersionId: 'ver-1',
    pointerVersion: 2,
    version: 3,
    createdBy: 'colleague-1',
    updatedBy: 'user-1',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
    versions: [
      makeVersion({
        id: 'ver-2',
        profileVersion: 2,
        status: 'TESTED',
        effectiveFrom: '2026-11-01T00:00:00.000Z',
        version: 2,
        publishedBy: null,
      }),
      makeVersion({
        id: 'ver-1',
        profileVersion: 1,
        status: 'PUBLISHED',
        effectiveFrom: '2026-10-01T00:00:00.000Z',
        effectiveTo: null,
        version: 2,
      }),
    ],
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
    describe(`ProfilePage (${lang} ${theme})`, () => {
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
        stub = new TradeHttpStub({ 'GET /document-profiles/:id': makeProfile() });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [ProfilePage],
          providers: [
            provideRouter([
              { path: '', children: [] },
              { path: 'trade/governance/document-profiles/:id', component: ProfilePage },
            ]),
            provideTransloco({
              config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true },
              loader: ProfileTranslocoLoader,
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

      it('publishes with open-ended predecessor, shows supersededAt as end (no end-date hint), and preserves effectiveTo across a gap', async () => {
        const initial = makeProfile({
          versions: [
            makeVersion({
              id: 'ver-3',
              profileVersion: 3,
              status: 'TESTED',
              effectiveFrom: '2026-11-10T00:00:00.000Z',
              version: 2,
              publishedBy: null,
            }),
            makeVersion({
              id: 'ver-2',
              profileVersion: 2,
              status: 'PUBLISHED',
              effectiveFrom: '2026-11-01T00:00:00.000Z',
              effectiveTo: null,
            }),
            makeVersion({
              id: 'ver-1',
              profileVersion: 1,
              status: 'SUPERSEDED',
              effectiveFrom: '2026-09-01T00:00:00.000Z',
              effectiveTo: '2026-10-15T00:00:00.000Z',
              supersededAt: null,
              supersededByVersionId: null,
            }),
          ],
          currentPublishedVersionId: 'ver-2',
          pointerVersion: 2,
        });
        stub.register('GET', '/document-profiles/:id', initial);

        const page = (await harness.navigateByUrl(
          '/trade/governance/document-profiles/prof-1',
          ProfilePage,
        )) as unknown as {
          versionRows(): GovernedRow[];
          onVersionAction(e: { row: GovernedRow; key: string }): void;
          confirmPublish(): Promise<void>;
        };
        await flush(harness);

        // Predecessor across a gap shows effectiveTo and no Replaced-by chip
        const gapRow = page.versionRows().find((r) => r.id === 'ver-1')!;
        expect(gapRow.effectiveTo).toBe('2026-10-15T00:00:00.000Z');
        expect(gapRow.supersededByVersionNumber).toBeNull();

        const publishResult: ProfilePublishResult = {
          id: 'ver-3',
          profileId: 'prof-1',
          profileVersion: 3,
          schemaVersion: 'trade-document-profile.v1',
          registryVersion: PROFILE_REGISTRY_VERSION,
          runtimeVersion: 'trade-document-runtime.v1',
          checksum: 'chk-3',
          status: 'PUBLISHED',
          effectiveFrom: '2026-11-10T00:00:00.000Z',
          effectiveTo: null,
          supersededAt: null,
          supersededByVersionId: null,
          version: 3,
          authorUserId: 'colleague-1',
          validatedBy: 'colleague-1',
          publishedBy: 'user-1',
          content: defaultProfileContent('QUOTATION'),
          restoredFromVersionId: null,
          restorationReason: null,
          scheduledExpectedPointerVersion: null,
          activePointerVersion: 3,
          active: true,
        };
        stub.register('POST', '/document-profile-versions/:id/publish', publishResult);
        stub.register(
          'GET',
          '/document-profiles/:id',
          makeProfile({
            currentPublishedVersionId: 'ver-3',
            pointerVersion: 3,
            versions: [
              makeVersion({
                id: 'ver-3',
                profileVersion: 3,
                status: 'PUBLISHED',
                effectiveFrom: '2026-11-10T00:00:00.000Z',
                version: 3,
              }),
              makeVersion({
                id: 'ver-2',
                profileVersion: 2,
                status: 'SUPERSEDED',
                effectiveFrom: '2026-11-01T00:00:00.000Z',
                effectiveTo: null,
                supersededAt: '2026-11-23T12:00:00.000Z',
                supersededByVersionId: 'ver-3',
                version: 3,
              }),
              makeVersion({
                id: 'ver-1',
                profileVersion: 1,
                status: 'SUPERSEDED',
                effectiveFrom: '2026-09-01T00:00:00.000Z',
                effectiveTo: '2026-10-15T00:00:00.000Z',
                supersededAt: null,
                supersededByVersionId: null,
              }),
            ],
          }),
        );

        page.onVersionAction({ row: page.versionRows()[0], key: 'publish' });
        await page.confirmPublish();
        await flush(harness);

        expect(stub.recordedWrites()[0]).toMatchObject({
          method: 'POST',
          path: '/document-profile-versions/ver-3/publish',
          body: { expectedActivePointerVersion: 2 },
          ifMatch: '"2"',
        });
        const supersededRow = page.versionRows().find((r) => r.id === 'ver-2')!;
        expect(supersededRow.effectiveTo).toBe('2026-11-23T12:00:00.000Z');
        expect(supersededRow.supersededByVersionNumber).toBe(3);
      });

      it('does not reopen publishing with the old pointer when conflict refresh fails', async () => {
        const page = (await harness.navigateByUrl(
          '/trade/governance/document-profiles/prof-1', ProfilePage,
        )) as unknown as {
          versionRows(): GovernedRow[];
          onVersionAction(e: { row: GovernedRow; key: string }): void;
          confirmPublish(): Promise<void>;
          onConflictReload(): Promise<void>;
          openPublishModal(version: ProfileVersion): void;
        };
        await flush(harness);
        stub.register('POST', '/document-profile-versions/:id/publish',
          new ApiError(409, 'TRADE.DOCUMENT_PROFILE.ACTIVE_POINTER_STALE'));
        stub.register('GET', '/document-profiles/:id', new ApiError(500, 'SERVER_ERROR'));
        page.onVersionAction({ row: page.versionRows()[0], key: 'publish' });
        await page.confirmPublish();
        await flush(harness);
        const reopen = vi.spyOn(page, 'openPublishModal');
        await page.onConflictReload();
        await flush(harness);
        expect(reopen).not.toHaveBeenCalled();
        expect(stub.recordedWrites()).toHaveLength(1);
      });

      it('shows conflict, refetches, and waits for user confirmation on ACTIVE_POINTER_STALE without silent retry', async () => {
        const page = (await harness.navigateByUrl(
          '/trade/governance/document-profiles/prof-1',
          ProfilePage,
        )) as unknown as {
          versionRows(): GovernedRow[];
          onVersionAction(e: { row: GovernedRow; key: string }): void;
          confirmPublish(): Promise<void>;
          onConflictReload(): Promise<void>;
        };
        await flush(harness);

        stub.register(
          'POST',
          '/document-profile-versions/:id/publish',
          new ApiError(409, 'TRADE.DOCUMENT_PROFILE.ACTIVE_POINTER_STALE'),
        );
        stub.register('GET', '/document-profiles/:id', makeProfile({ pointerVersion: 5 }));

        page.onVersionAction({ row: page.versionRows()[0], key: 'publish' });
        await page.confirmPublish();
        await flush(harness);

        // Must NOT silently retry publishVersion
        expect(stub.recordedWrites()).toHaveLength(1);
        expect(stub.recordedReads().length).toBeGreaterThanOrEqual(2);
        const conflict = harness.fixture.debugElement.query(By.directive(ConflictDialog))
          ?.componentInstance as ConflictDialog;
        expect(conflict.title()).toBe(TRANSLATIONS[lang]['profiles']['errors']['activePointerStaleTitle']);

        const publishSuccess: ProfilePublishResult = {
          ...makeVersion({ id: 'ver-2', profileVersion: 2, status: 'PUBLISHED', version: 3 }),
          profileId: 'prof-1',
          content: defaultProfileContent('QUOTATION'),
          restoredFromVersionId: null,
          restorationReason: null,
          scheduledExpectedPointerVersion: null,
          activePointerVersion: 6,
          active: true,
        };
        stub.register('POST', '/document-profile-versions/:id/publish', publishSuccess);

        // User confirms reload & review -> re-opens publish modal -> user confirms publish with new pointerVersion 5
        await page.onConflictReload();
        await flush(harness);
        expect(stub.recordedWrites()).toHaveLength(1);

        await page.confirmPublish();
        await flush(harness);
        expect(stub.recordedWrites()).toHaveLength(2);
        expect(stub.recordedWrites()[1].body).toEqual({ expectedActivePointerVersion: 5 });
      });

      it('gates row actions on permissions and maps COMPATIBILITY_CHANGED, ACTIVATION_FAILED, 503, and 403', async () => {
        const profile = makeProfile({
          versions: [
            makeVersion({ id: 'ver-draft', profileVersion: 3, status: 'DRAFT' }),
            makeVersion({ id: 'ver-tested', profileVersion: 2, status: 'TESTED' }),
          ],
        });
        stub.register('GET', '/document-profiles/:id', profile);

        const page = (await harness.navigateByUrl(
          '/trade/governance/document-profiles/prof-1',
          ProfilePage,
        )) as unknown as {
          versionRows(): GovernedRow[];
          onVersionAction(e: { row: GovernedRow; key: string }): void;
          confirmPublish(): Promise<void>;
        };
        await flush(harness);

        setGrants(['trade.document_profiles.read']);
        await flush(harness);
        expect(page.versionRows()[0].actions?.map((a) => a.key)).toEqual(['open']);
        expect(page.versionRows()[1].actions?.map((a) => a.key)).toEqual(['open']);

        setGrants(['trade.document_profiles.read', 'trade.document_profiles.publish']);
        await flush(harness);
        stub.register(
          'POST',
          '/document-profile-versions/:id/publish',
          new ApiError(409, 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_CHANGED'),
        );
        page.onVersionAction({ row: page.versionRows()[1], key: 'publish' });
        await page.confirmPublish();
        await flush(harness);
        expect(notify.error).toHaveBeenCalledWith(
          TRANSLATIONS[lang]['profiles']['errors']['compatibilityChanged'],
        );

        stub.register(
          'POST',
          '/document-profile-versions/:id/publish',
          new ApiError(422, 'TRADE.DOCUMENT_PROFILE.ACTIVATION_FAILED'),
        );
        page.onVersionAction({ row: page.versionRows()[1], key: 'publish' });
        await page.confirmPublish();
        await flush(harness);
        expect(notify.error).toHaveBeenCalledWith(TRANSLATIONS[lang]['profiles']['errors']['generic']);

        stub.register(
          'POST',
          '/document-profile-versions/:id/publish',
          new ApiError(503, 'TRADE.DOCUMENT_PROFILE.PUBLICATION_UNAVAILABLE'),
        );
        page.onVersionAction({ row: page.versionRows()[1], key: 'publish' });
        await page.confirmPublish();
        await flush(harness);
        expect(harness.fixture.debugElement.query(By.directive(FullState))?.componentInstance.kind()).toBe(
          'provisioning',
        );
      });

      it('renders forbidden state without error toast on missing read grant or server 403', async () => {
        stub.register('GET', '/document-profiles/:id', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        await harness.navigateByUrl('/trade/governance/document-profiles/prof-1', ProfilePage);
        await flush(harness);

        expect(notify.error).not.toHaveBeenCalled();
        expect(harness.fixture.debugElement.query(By.directive(FullState))?.componentInstance.kind()).toBe(
          'forbidden',
        );
      });
    });
  }
}
