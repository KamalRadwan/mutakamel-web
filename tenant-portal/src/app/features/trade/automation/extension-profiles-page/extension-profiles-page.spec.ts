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
import { ExtensionProfileModal } from '../extension-profile-modal/extension-profile-modal';
import type { ExtensionProfile, ExtensionProfileCounts } from '../extensions.model';
import { ExtensionProfilesPage } from './extension-profiles-page';

const COMPANY_ID = '018f0000-0000-7000-8000-000000000010';
const BRANCH_ID = '018f0000-0000-7000-8000-000000000001';
const PROFILE_ID = '01900000-0000-7000-8000-000000000101';

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
class ExtensionsTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

function makeProfile(overrides: Partial<ExtensionProfile> = {}): ExtensionProfile {
  return {
    id: PROFILE_ID,
    version: 2,
    code: 'ITEM_EXTRA',
    targetCode: 'CATALOG_ITEM',
    scopeTarget: 'COMPANY',
    companyId: COMPANY_ID,
    status: 'ACTIVE',
    currentPublishedVersionId: 'ver-1',
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    fieldCount: 2,
    currentPublishedVersion: {
      id: 'ver-1',
      profileId: PROFILE_ID,
      version: 1,
      versionNumber: 1,
      registryVersion: 1,
      targetSchemaCode: 'trade.catalog-item.extensions',
      targetSchemaVersion: 1,
      definitionHash: '0'.repeat(64),
      status: 'PUBLISHED',
      compatibilitySummary: {},
      publishedAt: '2026-11-23T10:00:00.000Z',
      publishedBy: 'u1',
      createdAt: '2026-11-23T10:00:00.000Z',
      updatedAt: '2026-11-23T10:00:00.000Z',
    },
    editableDraftVersion: null,
    ...overrides,
  };
}

function makeCounts(total = 1): ExtensionProfileCounts {
  return {
    total,
    byTarget: { CATALOG_ITEM: total, QUOTATION: 0, SALES_ORDER: 0, PURCHASE_ORDER: 0 },
    byStatus: { DRAFT: 0, ACTIVE: total, RETIRED: 0 },
  };
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`ExtensionProfilesPage (${lang} ${theme})`, () => {
      let fixture: ComponentFixture<ExtensionProfilesPage>;
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

      function setPermissions(options: { read?: boolean; manage?: boolean } = {}): void {
        const { read = true, manage = true } = options;
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
        stub = new TradeHttpStub({
          'GET /extensions/profiles/counts': makeCounts(1),
          'GET /extensions/profiles': { items: [makeProfile()], total: 1, page: 1, limit: 24 },
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [ExtensionProfilesPage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: {
                availableLangs: ['en', 'ar'],
                defaultLang: lang,
                reRenderOnLangChange: true,
              },
              loader: ExtensionsTranslocoLoader,
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

      async function flushPage(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        await Promise.resolve();
        fixture.detectChanges();
      }

      it('loads counts in one request and lists extension profiles', async () => {
        fixture = TestBed.createComponent(ExtensionProfilesPage);
        await flushPage();

        const reads = stub.recordedReads();
        expect(reads.filter((r) => r.path === '/extensions/profiles/counts')).toHaveLength(1);
        expect(reads.filter((r) => r.path === '/extensions/profiles')).toHaveLength(1);
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('ITEM_EXTRA');
      });

      it('shows the empty state when no profiles exist on the tenant', async () => {
        stub.register('GET', '/extensions/profiles/counts', makeCounts(0));
        stub.register('GET', '/extensions/profiles', { items: [], total: 0, page: 1, limit: 24 });

        fixture = TestBed.createComponent(ExtensionProfilesPage);
        await flushPage();

        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain(TRANSLATIONS[lang]['extensions']['list']['empty']['title']);
      });

      it('hides New profile when trade.extensions.manage is missing and shows it when granted', async () => {
        setPermissions({ read: true, manage: false });
        fixture = TestBed.createComponent(ExtensionProfilesPage);
        await flushPage();

        const newLabel = TRANSLATIONS[lang]['extensions']['list']['newProfile'];
        expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(newLabel);

        setPermissions({ read: true, manage: true });
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).textContent).toContain(newLabel);
      });

      it('renders the forbidden state without calling HTTP when trade.extensions.read is missing', async () => {
        setPermissions({ read: false, manage: false });
        fixture = TestBed.createComponent(ExtensionProfilesPage);
        await flushPage();

        expect(stub.recordedReads()).toEqual([]);
        const fullState = fixture.debugElement.query(By.directive(FullState));
        expect(fullState).not.toBeNull();
        expect((fullState.componentInstance as FullState).kind()).toBe('forbidden');
      });

      it('shows the forbidden state without an error toast when the server returns 403', async () => {
        const notify = TestBed.inject(Notify);
        const errorSpy = vi.spyOn(notify, 'error');
        stub.register('GET', '/extensions/profiles', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));

        fixture = TestBed.createComponent(ExtensionProfilesPage);
        await flushPage();

        const fullState = fixture.debugElement.query(By.directive(FullState));
        expect(fullState).not.toBeNull();
        expect((fullState.componentInstance as FullState).kind()).toBe('forbidden');
        expect(errorSpy).not.toHaveBeenCalled();
      });

      it('keeps the "!" hint button on every field inside the create modal', async () => {
        fixture = TestBed.createComponent(ExtensionProfilesPage);
        await flushPage();

        const modalDe = fixture.debugElement.query(By.directive(ExtensionProfileModal));
        (modalDe.componentInstance as ExtensionProfileModal).open();
        fixture.detectChanges();

        const fields = modalDe.queryAll(By.css('ui-field'));
        expect(fields.length).toBeGreaterThan(0);
        for (const field of fields) {
          expect(field.query(By.css('[data-ui-hint]'))).not.toBeNull();
        }
      });
    });
  }
}
