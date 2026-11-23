import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arSettings from '../../../../../../public/i18n/settings/ar.json';
import enSettings from '../../../../../../public/i18n/settings/en.json';
import arTradeConfig from '../../../../../../public/i18n/trade-config/ar.json';
import enTradeConfig from '../../../../../../public/i18n/trade-config/en.json';
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
import { ConfigurationPage } from './configuration-page';
import type { ConfigDefinition } from './configuration.model';
import { DefinitionModal } from './definition-modal/definition-modal';
import { PublishDialog } from './publish-dialog/publish-dialog';

const DEF_ID = '01900000-0000-7000-8000-000000000010';
const VER_TESTED_ID = '01900000-0000-7000-8000-000000000021';
const VER_LIVE_ID = '01900000-0000-7000-8000-000000000020';

const TRANSLATIONS: Record<string, Translation> = {
  en: { ...en, settings: enSettings, tradeShared: enTradeShared, tradeConfig: enTradeConfig },
  ar: { ...ar, settings: arSettings, tradeShared: arTradeShared, tradeConfig: arTradeConfig },
  'settings/en': enSettings,
  'settings/ar': arSettings,
  'trade-shared/en': enTradeShared,
  'trade-shared/ar': arTradeShared,
  'trade-config/en': enTradeConfig,
  'trade-config/ar': arTradeConfig,
};

@Injectable()
class ConfigTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

function makeDefinition(overrides: Partial<ConfigDefinition> = {}): ConfigDefinition {
  return {
    id: DEF_ID,
    key: 'trade.quotation.default_validity_days',
    valueSchema: { type: 'integer', minimum: 1, maximum: 365 },
    allowedScopes: ['TENANT', 'COMPANY', 'BRANCH'],
    mergeStrategy: 'MIN',
    riskClass: 'LOW',
    companyLockPolicy: { requireCompanyBaseline: true },
    version: 1,
    versions: [
      {
        id: VER_LIVE_ID,
        versionNumber: 1,
        version: 1,
        scopeTarget: 'COMPANY',
        companyId: 'c1',
        branchId: null,
        channelId: null,
        value: 30,
        status: 'PUBLISHED',
        effectiveState: 'LIVE',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: null,
        supersededAt: null,
        supersededByVersionId: null,
        contentHash: 'hash-1',
        createdBy: 'u2',
        createdByName: 'Sara Ali',
        testEvidence: {
          passed: true,
          diagnostics: [],
          testedAt: '2026-01-01T00:00:00.000Z',
          testedBy: 'u2',
        },
      },
      {
        id: VER_TESTED_ID,
        versionNumber: 2,
        version: 2,
        scopeTarget: 'COMPANY',
        companyId: 'c1',
        branchId: null,
        channelId: null,
        value: 21,
        status: 'TESTED',
        effectiveState: 'TESTED',
        effectiveFrom: '2027-01-01T00:00:00.000Z',
        effectiveTo: null,
        supersededAt: null,
        supersededByVersionId: null,
        contentHash: 'hash-2',
        createdBy: null,
        createdByName: null,
        testEvidence: {
          passed: true,
          diagnostics: [],
          testedAt: '2026-11-23T09:00:00.000Z',
          testedBy: 'u3',
        },
      },
    ],
    ...overrides,
  };
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`ConfigurationPage (${lang} ${theme})`, () => {
      let fixture: ComponentFixture<ConfigurationPage>;
      let page: ConfigurationPage;
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

      function configureTestBed(): void {
        TestBed.configureTestingModule({
          imports: [ConfigurationPage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: {
                availableLangs: ['en', 'ar'],
                defaultLang: lang,
                reRenderOnLangChange: true,
              },
              loader: ConfigTranslocoLoader,
            }),
            { provide: TenantScopeState, useValue: { me, selection: signal({ companyId: 'c1', branchId: 'b1' }), branchesFor: () => ['b1'] } },
            { provide: LanguageState, useValue: { current: signal(lang) } },
          ],
        });

        TestBed.inject(TranslocoService).setTranslation(
          {
            ...(lang === 'ar' ? ar : en),
            settings: lang === 'ar' ? arSettings : enSettings,
            tradeShared: lang === 'ar' ? arTradeShared : enTradeShared,
            tradeConfig: lang === 'ar' ? arTradeConfig : enTradeConfig,
          },
          lang,
        );
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
        localStorage.removeItem('scope');
        sessionStorage.removeItem('scope');
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDir = document.documentElement.dir;
        previousLang = document.documentElement.lang;
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', theme);

        const def = makeDefinition();
        stub = new TradeHttpStub({
          'GET /configuration/definitions': { items: [def], total: 1, page: 1, limit: 24 },
          'GET /configuration/definitions/:id': def,
        });
        dispose = bindTradeHttpForTest(stub);
        configureTestBed();
      });

      afterEach(() => {
        fixture?.destroy();
        tradeQueries().clear();
        dispose();
        vi.restoreAllMocks();
        TestBed.resetTestingModule();
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

      function setPermissions(options: {
        read?: boolean;
        manageTenantWide?: boolean;
        manageBranches?: string[];
        publishTenantWide?: boolean;
        publishBranches?: string[];
      } = {}): void {
        const {
          read = true,
          manageTenantWide = true,
          manageBranches = [],
          publishTenantWide = true,
          publishBranches = [],
        } = options;
        const permissions: string[] = [];
        const permissionScopes: TenantMe['permissionScopes'] = {};

        if (read) {
          permissions.push('trade.configuration.read');
          permissionScopes['trade.configuration.read'] = {
            tenantWide: true,
            companyIds: [],
            branchIds: [],
          };
        }
        if (manageTenantWide || manageBranches.length > 0) {
          permissions.push('trade.configuration.manage');
          permissionScopes['trade.configuration.manage'] = {
            tenantWide: manageTenantWide,
            companyIds: [],
            branchIds: manageBranches,
          };
        }
        if (publishTenantWide || publishBranches.length > 0) {
          permissions.push('trade.policy.publish');
          permissionScopes['trade.policy.publish'] = {
            tenantWide: publishTenantWide,
            companyIds: [],
            branchIds: publishBranches,
          };
        }

        me.set({
          ...FAKE_TENANT_ME,
          isTenantOwner: false,
          accessibleCompanies: ['c1', 'c2'],
          accessibleBranches: ['b1', 'b2', 'b3', 'b4', 'b5'],
          accessibleBranchCompanies: [
            { companyId: 'c1', branchId: 'b1' },
            { companyId: 'c1', branchId: 'b2' },
            { companyId: 'c1', branchId: 'b3' },
            { companyId: 'c2', branchId: 'b4' },
            { companyId: 'c2', branchId: 'b5' },
          ],
          permissions,
          permissionScopes,
        });
      }

      async function stable(): Promise<void> {
        await vi.waitFor(() => expect(page['initialLoading']()).toBe(false));
        await fixture.whenStable();
        fixture.detectChanges();
      }

      async function render(options: Parameters<typeof setPermissions>[0] = {}): Promise<void> {
        setPermissions(options);
        fixture = TestBed.createComponent(ConfigurationPage);
        page = fixture.componentInstance;
        fixture.detectChanges();
        await stable();
      }

      function fullState(): FullState | undefined {
        return fixture.debugElement.query(By.directive(FullState))?.componentInstance as FullState | undefined;
      }

      function definitionModal(): DefinitionModal {
        return fixture.debugElement.query(By.directive(DefinitionModal)).componentInstance as DefinitionModal;
      }

      function publishDialog(): PublishDialog {
        return fixture.debugElement.query(By.directive(PublishDialog)).componentInstance as PublishDialog;
      }

      it('loads definitions, preserves hint icons without raw translation keys, and switches scope headers between Tenant and Branch', async () => {
        await render();

        expect(stub.recordedReads()).toEqual([
          {
            path: '/configuration/definitions',
            query: { page: 1, limit: 24 },
            scope: { companyId: 'c1' },
          },
        ]);
        const host = fixture.nativeElement as HTMLElement;
        const text = host.textContent ?? '';
        expect(text).toContain('trade.quotation.default_validity_days');
        expect(text).not.toContain('tradeConfig.');
        expect(text).not.toContain('tradeShared.');

        const hints = host.querySelectorAll('[id$="-hint"]');
        expect(hints.length).toBeGreaterThanOrEqual(2);

        page['onScopeChange']('TENANT');
        fixture.detectChanges();
        await vi.waitFor(() => expect(stub.recordedReads()).toHaveLength(2));
        expect(stub.recordedReads()[1]).toEqual({
          path: '/configuration/definitions',
          query: { page: 1, limit: 24 },
          scope: {},
        });

        page['onScopeChange']('BRANCH');
        fixture.detectChanges();
        await vi.waitFor(() => expect(stub.recordedReads()).toHaveLength(3));
        expect(stub.recordedReads()[2]).toEqual({
          path: '/configuration/definitions',
          query: { page: 1, limit: 24 },
          scope: { companyId: 'c1', branchId: 'b1' },
        });
      });

      it('shows the empty state when no configuration definitions exist on the tenant', async () => {
        stub.register('GET', '/configuration/definitions', { items: [], total: 0, page: 1, limit: 24 });
        await render();

        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain(TRANSLATIONS[lang]['tradeConfig']['page']['empty']);
      });

      it('shows forbidden state without HTTP calls when trade.configuration.read is missing and on server 403 without error toast', async () => {
        await render({ read: false, manageTenantWide: false, publishTenantWide: false });

        expect(fullState()?.kind()).toBe('forbidden');
        expect(stub.recordedReads()).toHaveLength(0);

        fixture.destroy();
        TestBed.resetTestingModule();
        configureTestBed();
        const notify = TestBed.inject(Notify);
        const errorSpy = vi.spyOn(notify, 'error');
        stub.reset();
        stub.register('GET', '/configuration/definitions', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));

        await render({ read: true });
        expect(fullState()?.kind()).toBe('forbidden');
        expect(errorSpy).not.toHaveBeenCalled();
      });

      it('gates New definition (TENANT only), manage actions, and policy.publish controls (Publish/Retire)', async () => {
        // Branch-only manage, no publish: New definition hidden even on Tenant; Test/Cancel enabled only on Branch b1; Publish/Retire hidden.
        await render({
          read: true,
          manageTenantWide: false,
          manageBranches: ['b1'],
          publishTenantWide: false,
          publishBranches: [],
        });

        page['onScopeChange']('TENANT');
        fixture.detectChanges();
        await vi.waitFor(() => expect(stub.recordedReads()).toHaveLength(2));
        expect(page['canCreateDefinition']()).toBe(false);
        expect(page['canManageAtScope']()).toBe(false);

        page['onScopeChange']('BRANCH');
        fixture.detectChanges();
        await vi.waitFor(() => expect(stub.recordedReads()).toHaveLength(3));
        expect(page['canManageAtScope']()).toBe(true);
        expect(page['canPublishAtScope']()).toBe(false);

        const def = makeDefinition({
          versions: [
            {
              ...makeDefinition().versions[0],
              scopeTarget: 'BRANCH',
              branchId: 'b1',
            },
            {
              ...makeDefinition().versions[1],
              scopeTarget: 'BRANCH',
              branchId: 'b1',
            },
          ],
        });
        stub.register('GET', '/configuration/definitions/:id', def);
        page['openDefinition'](def);
        fixture.detectChanges();
        await vi.waitFor(() => expect(definitionModal()['detail']()).not.toBeNull());
        fixture.detectChanges();

        expect(definitionModal()['effectiveCanManage']()).toBe(true);
        expect(definitionModal()['effectiveCanPublish']()).toBe(false);
        expect(definitionModal()['showPublishRow'](def.versions[1])).toBe(false);
        expect(definitionModal()['rowMenuActions'](def.versions[0])).toEqual([]);
        expect(definitionModal()['rowMenuActions'](def.versions[1]).map((a) => a.id)).toEqual(['cancelDraft']);

        // Publish-only without manage: Publish + Retire visible, Test + Cancel draft hidden.
        fixture.destroy();
        TestBed.resetTestingModule();
        configureTestBed();
        stub.reset();
        stub.register('GET', '/configuration/definitions', { items: [def], total: 1, page: 1, limit: 24 });
        stub.register('GET', '/configuration/definitions/:id', def);
        await render({
          read: true,
          manageTenantWide: false,
          manageBranches: [],
          publishTenantWide: false,
          publishBranches: ['b1'],
        });
        page['onScopeChange']('BRANCH');
        fixture.detectChanges();
        await vi.waitFor(() => expect(stub.recordedReads()).toHaveLength(2));
        page['openDefinition'](def);
        fixture.detectChanges();
        await vi.waitFor(() => expect(definitionModal()['detail']()).not.toBeNull());
        expect(definitionModal()['effectiveCanManage']()).toBe(false);
        expect(definitionModal()['effectiveCanPublish']()).toBe(true);
        expect(definitionModal()['canTestRow'](def.versions[1])).toBe(false);
        expect(definitionModal()['showPublishRow'](def.versions[1])).toBe(true);
        expect(definitionModal()['rowMenuActions'](def.versions[0]).map((a) => a.id)).toEqual(['retire']);
        expect(definitionModal()['rowMenuActions'](def.versions[1])).toEqual([]);
      });

      it('renders dash for null createdByName (F-2), refetches detail on modal scope switch, handles raw publish response + refetch (F-5), and shows forbidden without toast on modal 403', async () => {
        const def = makeDefinition();
        stub.register('POST', '/configuration/versions/:id/publish', {
          id: VER_TESTED_ID,
          definitionId: DEF_ID,
          versionNumber: 2,
          version: 3,
          scopeTarget: 'COMPANY',
          companyId: 'c1',
          branchId: null,
          channelId: null,
          value: 21,
          status: 'SCHEDULED',
          effectiveFrom: '2027-01-01T00:00:00.000Z',
          effectiveTo: null,
          supersededAt: null,
          supersededByVersionId: null,
          contentHash: 'hash-2',
          createdBy: null,
          configurationEpoch: 4,
        });

        await render();
        const notify = TestBed.inject(Notify);
        const errorSpy = vi.spyOn(notify, 'error');
        const successSpy = vi.spyOn(notify, 'success');

        page['openDefinition'](def);
        fixture.detectChanges();
        await vi.waitFor(() => expect(definitionModal()['detail']()).not.toBeNull());
        fixture.detectChanges();

        expect(definitionModal()['createdByLabel'](def.versions[1])).toBe('—');
        expect(stub.recordedReads().at(-1)).toEqual({
          path: `/configuration/definitions/${DEF_ID}`,
          query: undefined,
          scope: { companyId: 'c1' },
        });

        definitionModal()['onModalScopeChange']('BRANCH');
        await vi.waitFor(() =>
          expect(stub.recordedReads().at(-1)).toEqual({
            path: `/configuration/definitions/${DEF_ID}`,
            query: undefined,
            scope: { companyId: 'c1', branchId: 'b1' },
          }),
        );

        definitionModal()['onModalScopeChange']('COMPANY');
        await vi.waitFor(() =>
          expect(stub.recordedReads().at(-1)).toEqual({
            path: `/configuration/definitions/${DEF_ID}`,
            query: undefined,
            scope: { companyId: 'c1' },
          }),
        );

        const readsBeforePublish = stub.recordedReads().length;
        definitionModal()['openPublish'](def.versions[1]);
        await publishDialog()['submit']();

        expect(stub.recordedWrites()).toHaveLength(1);
        expect(stub.recordedWrites()[0]).toMatchObject({
          method: 'POST',
          path: `/configuration/versions/${VER_TESTED_ID}/publish`,
          ifMatch: '"2"',
          scope: { companyId: 'c1' },
        });
        expect(successSpy).toHaveBeenCalledWith(
          TRANSLATIONS[lang]['tradeConfig']['toasts']['scheduled'].replace('{{n}}', '2'),
        );
        await vi.waitFor(() => expect(stub.recordedReads().length).toBeGreaterThanOrEqual(readsBeforePublish + 2));

        // 403 inside modal switches page to forbidden without an error toast.
        stub.register('POST', '/configuration/versions/:id/test', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        await definitionModal()['runTest'](def.versions[1]);
        fixture.detectChanges();
        expect(fullState()?.kind()).toBe('forbidden');
        expect(errorSpy).not.toHaveBeenCalled();
      });
    });
  }
}
