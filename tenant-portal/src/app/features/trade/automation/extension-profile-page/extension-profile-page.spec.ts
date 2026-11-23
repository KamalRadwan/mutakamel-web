import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arTradeAutoExtensions from '../../../../../../public/i18n/trade-auto-extensions/ar.json';
import enTradeAutoExtensions from '../../../../../../public/i18n/trade-auto-extensions/en.json';
import arTradeAutomation from '../../../../../../public/i18n/trade-automation/ar.json';
import enTradeAutomation from '../../../../../../public/i18n/trade-automation/en.json';
import arTradeShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enTradeShared from '../../../../../../public/i18n/trade-shared/en.json';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { ApiError } from '../../shared/trade-api';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { bindTradeHttpForTest, tradeQueries } from '../../shared/trade-http';
import { ConflictDialog } from '../automation-shared/conflict-dialog/conflict-dialog';
import type { ExtVersion, ExtensionProfile } from '../extensions.model';
import { ExtensionProfilePage } from './extension-profile-page';

const COMPANY_ID = '018f0000-0000-7000-8000-000000000010';
const BRANCH_ID = '018f0000-0000-7000-8000-000000000001';
const PROFILE_ID = '01900000-0000-7000-8000-000000000101';
const VERSION_ID = '01900000-0000-7000-8000-000000000201';

const TRANSLATIONS: Record<string, Translation> = {
  en: {
    ...en,
    tradeShared: enTradeShared,
    automation: enTradeAutomation,
    extensions: enTradeAutoExtensions,
  },
  ar: {
    ...ar,
    tradeShared: arTradeShared,
    automation: arTradeAutomation,
    extensions: arTradeAutoExtensions,
  },
  'trade-shared/en': enTradeShared,
  'trade-shared/ar': arTradeShared,
  'trade-automation/en': enTradeAutomation,
  'trade-automation/ar': arTradeAutomation,
  'trade-auto-extensions/en': enTradeAutoExtensions,
  'trade-auto-extensions/ar': arTradeAutoExtensions,
};

@Injectable()
class ExtensionDetailTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

function makeDraftVersion(overrides: Partial<ExtVersion> = {}): ExtVersion {
  return {
    id: VERSION_ID,
    profileId: PROFILE_ID,
    version: 1,
    versionNumber: 1,
    registryVersion: 1,
    targetSchemaCode: 'trade.catalog-item.extensions',
    targetSchemaVersion: 1,
    definitionHash: '0'.repeat(64),
    status: 'DRAFT',
    compatibilitySummary: {},
    publishedAt: null,
    publishedBy: null,
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    fields: [
      {
        id: 'f1',
        fieldKey: 'pkg.owner_code',
        valueKind: 'SCALAR',
        scalarType: 'STRING',
        schemaCode: null,
        schemaVersion: null,
        isRequired: false,
        isSearchable: false,
        visibilityCode: 'USER',
        maxLength: 40,
        maxItems: null,
        decimalScale: null,
        minimumDecimal: null,
        maximumDecimal: null,
        defaultStrategy: 'OWNER_DERIVED',
        defaultValue: null,
        constraintPayload: {},
        ordinal: 1,
      },
    ],
    ...overrides,
  };
}

function makeProfile(overrides: Partial<ExtensionProfile> = {}): ExtensionProfile {
  return {
    id: PROFILE_ID,
    version: 2,
    code: 'ITEM_EXTRA',
    targetCode: 'CATALOG_ITEM',
    scopeTarget: 'COMPANY',
    companyId: COMPANY_ID,
    status: 'DRAFT',
    currentPublishedVersionId: null,
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    currentPublishedVersion: null,
    editableDraftVersion: makeDraftVersion(),
    ...overrides,
  };
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`ExtensionProfilePage (${lang} ${theme})`, () => {
      let fixture: ComponentFixture<ExtensionProfilePage>;
      let stub: TradeHttpStub;
      let dispose: () => void;
      let previousTheme: string | null;
      let previousDir: string;
      let previousLang: string;
      const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
      const originalDialog = {
        showModal: dialogProto['showModal'],
        close: dialogProto['close'],
      };
      const me = signal<TenantMe | null>(FAKE_TENANT_ME);
      const selection = signal<{ companyId: string; branchId: string | null } | null>({
        companyId: COMPANY_ID,
        branchId: null,
      });

      function setPermissions(options: {
        read?: boolean;
        manage?: boolean;
        publish?: boolean;
      } = {}): void {
        const { read = true, manage = true, publish = true } = options;
        const permissions: string[] = [];
        const permissionScopes: TenantMe['permissionScopes'] = {};

        if (read) {
          permissions.push('trade.extensions.read');
          permissionScopes['trade.extensions.read'] = {
            tenantWide: true,
            companyIds: [COMPANY_ID],
            branchIds: [BRANCH_ID],
          };
        }
        if (manage) {
          permissions.push('trade.extensions.manage');
          permissionScopes['trade.extensions.manage'] = {
            tenantWide: true,
            companyIds: [COMPANY_ID],
            branchIds: [BRANCH_ID],
          };
        }
        if (publish) {
          permissions.push('trade.extensions.publish');
          permissionScopes['trade.extensions.publish'] = {
            tenantWide: true,
            companyIds: [COMPANY_ID],
            branchIds: [BRANCH_ID],
          };
        }

        me.set({
          ...FAKE_TENANT_ME,
          isTenantOwner: false,
          permissions,
          permissionScopes,
        });
      }

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
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDir = document.documentElement.dir;
        previousLang = document.documentElement.lang;
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', theme);

        setPermissions();
        const draft = makeDraftVersion();
        stub = new TradeHttpStub({
          'GET /extensions/profiles/:id': makeProfile({ editableDraftVersion: draft }),
          'GET /extensions/profiles/:id/versions': { items: [draft], total: 1, page: 1, limit: 100 },
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [ExtensionProfilePage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: {
                availableLangs: ['en', 'ar'],
                defaultLang: lang,
                reRenderOnLangChange: true,
              },
              loader: ExtensionDetailTranslocoLoader,
            }),
            {
              provide: TenantScopeState,
              useValue: {
                me,
                selection,
                showScopeSwitcher: signal(false),
                branchesFor: () => [BRANCH_ID],
                selectCompany: () => {},
                selectBranch: () => {},
              },
            },
            { provide: LanguageState, useValue: { current: signal(lang) } },
          ],
        });

        TestBed.inject(TranslocoService).setTranslation(
          {
            ...(lang === 'ar' ? ar : en),
            tradeShared: lang === 'ar' ? arTradeShared : enTradeShared,
            automation: lang === 'ar' ? arTradeAutomation : enTradeAutomation,
            extensions: lang === 'ar' ? arTradeAutoExtensions : enTradeAutoExtensions,
          },
          lang,
        );
      });

      afterEach(() => {
        fixture?.destroy();
        tradeQueries().clear();
        dispose();
        vi.restoreAllMocks();
        TestBed.resetTestingModule();
        if (originalDialog.showModal) dialogProto['showModal'] = originalDialog.showModal;
        else Reflect.deleteProperty(dialogProto, 'showModal');
        if (originalDialog.close) dialogProto['close'] = originalDialog.close;
        else Reflect.deleteProperty(dialogProto, 'close');
        if (previousTheme) document.documentElement.setAttribute('data-theme', previousTheme);
        else document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = previousDir;
        document.documentElement.lang = previousLang;
      });

      async function createPage(id = PROFILE_ID): Promise<void> {
        fixture = TestBed.createComponent(ExtensionProfilePage);
        fixture.componentRef.setInput('id', id);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        await Promise.resolve();
        fixture.detectChanges();
      }

      it('renders profile fields including the OWNER_DERIVED default strategy label', async () => {
        await createPage();

        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain('ITEM_EXTRA');
        expect(text).toContain('pkg.owner_code');
        expect(text).toContain(TRANSLATIONS[lang]['extensions']['defaultStrategy']['OWNER_DERIVED']);
      });

      it('gates Validate and Publish buttons using trade.extensions.manage and trade.extensions.publish', async () => {
        const validateLabel = TRANSLATIONS[lang]['extensions']['profile']['validate'];
        const publishLabel = TRANSLATIONS[lang]['extensions']['profile']['publish'];
        const hasAction = (label: string) =>
          Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('header button'))
            .some((button) => button.textContent?.trim() === label);

        setPermissions({ read: true, manage: false, publish: false });
        await createPage();
        expect(hasAction(validateLabel)).toBe(false);
        expect(hasAction(publishLabel)).toBe(false);

        setPermissions({ read: true, manage: true, publish: false });
        fixture.detectChanges();
        expect(hasAction(validateLabel)).toBe(true);
        expect(hasAction(publishLabel)).toBe(false);

        setPermissions({ read: true, manage: true, publish: true });
        fixture.detectChanges();
        expect(hasAction(validateLabel)).toBe(true);
        expect(hasAction(publishLabel)).toBe(true);
      });

      it('renders the forbidden state without calling HTTP when trade.extensions.read is missing', async () => {
        setPermissions({ read: false, manage: false, publish: false });
        await createPage();

        expect(stub.recordedReads()).toEqual([]);
        const fullState = fixture.debugElement.query(By.directive(FullState));
        expect(fullState).not.toBeNull();
        expect((fullState.componentInstance as FullState).kind()).toBe('forbidden');
      });

      it('shows the forbidden state without an error toast when GET returns 403', async () => {
        const notify = TestBed.inject(Notify);
        const errorSpy = vi.spyOn(notify, 'error');
        stub.register('GET', '/extensions/profiles/:id', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));

        await createPage();

        const fullState = fixture.debugElement.query(By.directive(FullState));
        expect(fullState).not.toBeNull();
        expect((fullState.componentInstance as FullState).kind()).toBe('forbidden');
        expect(errorSpy).not.toHaveBeenCalled();
      });

      it('shows the not-found state on TRADE.EXTENSION.DEFINITION_NOT_FOUND', async () => {
        stub.register('GET', '/extensions/profiles/:id', new ApiError(404, 'TRADE.EXTENSION.DEFINITION_NOT_FOUND'));

        await createPage();

        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain(TRANSLATIONS[lang]['extensions']['profile']['notFound']['title']);
      });

      it('opens the conflict dialog on TRADE.EXTENSION.PROFILE_CONFLICT during validate', async () => {
        stub.register('POST', '/extensions/profiles/:id/validate', new ApiError(409, 'TRADE.EXTENSION.PROFILE_CONFLICT'));

        await createPage();

        const conflictDe = fixture.debugElement.query(By.directive(ConflictDialog));
        const openSpy = vi.spyOn(conflictDe.componentInstance as ConflictDialog, 'open');

        const validateBtn = Array.from(
          (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
        ).find((btn) => btn.textContent?.includes(TRANSLATIONS[lang]['extensions']['profile']['validate']));
        expect(validateBtn).toBeDefined();
        validateBtn?.click();

        await fixture.whenStable();
        fixture.detectChanges();
        expect(openSpy).toHaveBeenCalledTimes(1);
      });
    });
  }
}
