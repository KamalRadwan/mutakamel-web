import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arSettings from '../../../../../../public/i18n/settings/ar.json';
import enSettings from '../../../../../../public/i18n/settings/en.json';
import arTradeAutoImports from '../../../../../../public/i18n/trade-auto-imports/ar.json';
import enTradeAutoImports from '../../../../../../public/i18n/trade-auto-imports/en.json';
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
import { bindTradeHttpForTest, tradeQueries } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { ImportMappingModal } from '../import-mapping-modal/import-mapping-modal';
import type { CreateImportMappingResult, ImportMapping } from '../imports.model';
import { ImportMappingsPage } from './import-mappings-page';

const COMPANY_ID = '018f0000-0000-7000-8000-000000000010';
const BRANCH_ID = '018f0000-0000-7000-8000-000000000001';
const MAPPING_ID = '0193b000-0000-7000-8000-000000000001';

const TRANSLATIONS: Record<string, Translation> = {
  en: {
    ...en,
    settings: enSettings,
    tradeShared: enTradeShared,
    automation: enTradeAutomation,
    imports: enTradeAutoImports,
  },
  ar: {
    ...ar,
    settings: arSettings,
    tradeShared: arTradeShared,
    automation: arTradeAutomation,
    imports: arTradeAutoImports,
  },
  'settings/en': enSettings,
  'settings/ar': arSettings,
  'trade-shared/en': enTradeShared,
  'trade-shared/ar': arTradeShared,
  'trade-automation/en': enTradeAutomation,
  'trade-automation/ar': arTradeAutomation,
  'trade-auto-imports/en': enTradeAutoImports,
  'trade-auto-imports/ar': arTradeAutoImports,
};

@Injectable()
class ImportsTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

function makeMapping(overrides: Partial<ImportMapping> = {}): ImportMapping {
  return {
    id: MAPPING_ID,
    code: 'ITEM_SETTINGS',
    targetCode: 'CATALOG_COMPANY_PROFILE',
    scopeTarget: 'COMPANY',
    companyId: COMPANY_ID,
    branchId: null,
    currentPublishedVersionId: 'ver-1',
    status: 'ACTIVE',
    version: 2,
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    ...overrides,
  };
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`ImportMappingsPage (${lang} ${theme})`, () => {
      let fixture: ComponentFixture<ImportMappingsPage>;
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

      function setPermissions(options: { read?: boolean; manage?: boolean; execute?: boolean } = {}): void {
        const { read = true, manage = true, execute = true } = options;
        const permissions: string[] = [];
        const permissionScopes: TenantMe['permissionScopes'] = {};

        for (const [enabled, key] of [
          [read, 'trade.import.read'],
          [manage, 'trade.import.manage'],
          [execute, 'trade.import.execute'],
        ] as const) {
          if (!enabled) continue;
          permissions.push(key);
          permissionScopes[key] = {
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
          'GET /import-mappings': { items: [makeMapping()], total: 1, page: 1, limit: 100 },
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [ImportMappingsPage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: {
                availableLangs: ['en', 'ar'],
                defaultLang: lang,
                reRenderOnLangChange: true,
              },
              loader: ImportsTranslocoLoader,
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

        TestBed.inject(TranslocoService).setTranslation(TRANSLATIONS[lang], lang);
        vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
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

      it('loads mappings with scope headers and renders translated content', async () => {
        fixture = TestBed.createComponent(ImportMappingsPage);
        await flushPage();

        expect(stub.recordedReads()).toEqual([
          { path: '/import-mappings', query: { limit: 100 }, scope: { companyId: COMPANY_ID } },
        ]);
        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain('ITEM_SETTINGS');
        expect(text).not.toContain('imports.mappings.');
      });

      it('hides New mapping without trade.import.manage and shows it when granted', async () => {
        setPermissions({ read: true, manage: false });
        fixture = TestBed.createComponent(ImportMappingsPage);
        await flushPage();

        const newLabel = (TRANSLATIONS[lang]['imports'] as Record<string, Record<string, Record<string, string>>>)['mappings']['toolbar']['new'];
        expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(newLabel);

        setPermissions({ read: true, manage: true });
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).textContent).toContain(newLabel);
      });

      it('renders forbidden full state without calling HTTP when trade.import.read is missing', async () => {
        setPermissions({ read: false, manage: false, execute: false });
        fixture = TestBed.createComponent(ImportMappingsPage);
        await flushPage();

        expect(stub.recordedReads()).toEqual([]);
        const fullState = fixture.debugElement.query(By.directive(FullState));
        expect(fullState).not.toBeNull();
        expect((fullState.componentInstance as FullState).kind()).toBe('forbidden');
      });

      it('shows forbidden full state without an error toast when the server returns 403', async () => {
        const notify = TestBed.inject(Notify);
        const errorSpy = vi.spyOn(notify, 'error');
        stub.register('GET', '/import-mappings', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));

        fixture = TestBed.createComponent(ImportMappingsPage);
        await flushPage();

        const fullState = fixture.debugElement.query(By.directive(FullState));
        expect(fullState).not.toBeNull();
        expect((fullState.componentInstance as FullState).kind()).toBe('forbidden');
        expect(errorSpy).not.toHaveBeenCalled();
      });

      it('creates a mapping from the modal with "!" hints and maps 422 code conflict inline', async () => {
        const created: CreateImportMappingResult = {
          ...makeMapping({ status: 'DRAFT', currentPublishedVersionId: null }),
          draftVersion: {
            id: 'ver-1',
            mappingId: MAPPING_ID,
            versionNumber: 1,
            targetDtoCode: 'trade.catalog.company-profile.import-row',
            targetDtoVersion: 1,
            transformRegistryVersion: 1,
            mappingHash: 'hash',
            executionMode: 'PER_ROW',
            status: 'DRAFT',
            publishedAt: null,
            publishedBy: null,
            version: 1,
            createdAt: '2026-11-23T10:00:00.000Z',
            updatedAt: '2026-11-23T10:00:00.000Z',
          },
          fields: [],
        };
        stub.register('POST', '/import-mappings', created);

        fixture = TestBed.createComponent(ImportMappingsPage);
        await flushPage();

        const modalDe = fixture.debugElement.query(By.directive(ImportMappingModal));
        const modal = modalDe.componentInstance as ImportMappingModal;
        modal.open();
        fixture.detectChanges();

        const fields = modalDe.queryAll(By.css('ui-field'));
        expect(fields.length).toBeGreaterThan(0);
        for (const field of fields) {
          expect(field.query(By.css('[data-ui-hint]'))).not.toBeNull();
        }

        const codeInput = modalDe.query(By.css('input')).nativeElement as HTMLInputElement;
        codeInput.value = 'NEW_CODE';
        codeInput.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        await (modal as unknown as { submit: () => Promise<void> }).submit();
        fixture.detectChanges();
        expect(stub.recordedWrites()).toHaveLength(1);
        expect(stub.recordedWrites()[0]).toMatchObject({
          method: 'POST',
          path: '/import-mappings',
          scope: { companyId: COMPANY_ID },
        });
        expect(stub.recordedWrites()[0].key).toBeTruthy();
        expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([
          '/trade/automation/import-mappings', MAPPING_ID,
        ]);

        stub.register('POST', '/import-mappings', new ApiError(422, 'TRADE.IMPORT.MAPPING_INVALID'));
        modal.open();
        fixture.detectChanges();
        const codeInput2 = modalDe.query(By.css('input')).nativeElement as HTMLInputElement;
        codeInput2.value = 'DUP_CODE';
        codeInput2.dispatchEvent(new Event('input'));
        await (modal as unknown as { submit: () => Promise<void> }).submit();
        fixture.detectChanges();

        const conflictMsg = (TRANSLATIONS[lang]['imports'] as Record<string, Record<string, string>>)['mappingModal']['codeConflict'];
        expect((modalDe.nativeElement as HTMLElement).textContent).toContain(conflictMsg);
      });
    });
  }
}
