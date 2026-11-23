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
import type {
  ImportMappingDetail,
  PublishImportMappingResult,
  UpdateImportMappingResult,
} from '../imports.model';
import { IMPORT_TARGETS } from '../imports.registry';
import { MappingRows } from '../mapping-rows/mapping-rows';
import { ImportMappingPage } from './import-mapping-page';

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

function makeDetail(overrides: Partial<ImportMappingDetail> = {}): ImportMappingDetail {
  return {
    id: MAPPING_ID,
    code: 'ITEM_SETTINGS',
    targetCode: 'CATALOG_COMPANY_PROFILE',
    scopeTarget: 'COMPANY',
    companyId: COMPANY_ID,
    branchId: null,
    currentPublishedVersionId: null,
    status: 'DRAFT',
    version: 3,
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    versions: [
      {
        id: 'ver-1',
        versionNumber: 1,
        targetDtoCode: 'trade.catalog.company-profile.import-row',
        targetDtoVersion: 1,
        transformRegistryVersion: 1,
        mappingHash: 'hash',
        executionMode: 'PER_ROW',
        status: 'DRAFT',
        publishedAt: null,
        version: 1,
        createdAt: '2026-11-23T10:00:00.000Z',
        updatedAt: '2026-11-23T10:00:00.000Z',
        fields: [
          {
            sourceColumnCode: 'ItemCode',
            sourceOrdinal: 0,
            targetFieldCode: 'ITEM_CODE',
            transformCode: 'NORMALIZE_CODE',
            lookupCode: null,
            isRequired: true,
          },
          {
            sourceColumnCode: 'CanSell',
            sourceOrdinal: 1,
            targetFieldCode: 'CAN_SELL',
            transformCode: 'ENUM_MAP',
            lookupCode: 'BOOLEAN_V1',
            isRequired: true,
          },
          {
            sourceColumnCode: 'CanPurchase',
            sourceOrdinal: 2,
            targetFieldCode: 'CAN_PURCHASE',
            transformCode: 'ENUM_MAP',
            lookupCode: 'BOOLEAN_V1',
            isRequired: true,
          },
          {
            sourceColumnCode: 'TrackInventory',
            sourceOrdinal: 3,
            targetFieldCode: 'TRACK_INVENTORY',
            transformCode: 'ENUM_MAP',
            lookupCode: 'BOOLEAN_V1',
            isRequired: true,
          },
          {
            sourceColumnCode: 'TrackingMode',
            sourceOrdinal: 4,
            targetFieldCode: 'TRACKING_MODE',
            transformCode: 'ENUM_MAP',
            lookupCode: 'TRACKING_MODE_V1',
            isRequired: true,
          },
        ],
      },
    ],
    ...overrides,
  };
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`ImportMappingPage (${lang} ${theme})`, () => {
      let fixture: ComponentFixture<ImportMappingPage>;
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

        for (const [enabled, key] of [
          [read, 'trade.import.read'],
          [manage, 'trade.import.manage'],
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
          'GET /import-mappings/:id': makeDetail(),
          'GET /import-mappings/targets': {
            registryVersion: 1,
            targets: [...IMPORT_TARGETS],
            lookups: {},
          },
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [ImportMappingPage],
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

      it('loads mapping detail with scope headers and keeps "!" hints on row fields', async () => {
        fixture = TestBed.createComponent(ImportMappingPage);
        fixture.componentRef.setInput('id', MAPPING_ID);
        await flushPage();

        expect(stub.recordedReads().some((r) => r.path === `/import-mappings/${MAPPING_ID}`)).toBe(true);
        const rowsDe = fixture.debugElement.query(By.directive(MappingRows));
        expect(rowsDe).not.toBeNull();
        const fields = rowsDe.queryAll(By.css('ui-field'));
        expect(fields.length).toBeGreaterThan(0);
        for (const field of fields) {
          expect(field.query(By.css('[data-ui-hint]'))).not.toBeNull();
        }
      });

      it('renders forbidden state without calling HTTP when trade.import.read is missing', async () => {
        setPermissions({ read: false, manage: false });
        fixture = TestBed.createComponent(ImportMappingPage);
        fixture.componentRef.setInput('id', MAPPING_ID);
        await flushPage();

        expect(stub.recordedReads()).toEqual([]);
        const fullState = fixture.debugElement.query(By.directive(FullState));
        expect(fullState).not.toBeNull();
        expect((fullState.componentInstance as FullState).kind()).toBe('forbidden');
      });

      it('renders forbidden state without toast when server returns 403', async () => {
        const notify = TestBed.inject(Notify);
        const errorSpy = vi.spyOn(notify, 'error');
        stub.register('GET', '/import-mappings/:id', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));

        fixture = TestBed.createComponent(ImportMappingPage);
        fixture.componentRef.setInput('id', MAPPING_ID);
        await flushPage();

        const fullState = fixture.debugElement.query(By.directive(FullState));
        expect(fullState).not.toBeNull();
        expect((fullState.componentInstance as FullState).kind()).toBe('forbidden');
        expect(errorSpy).not.toHaveBeenCalled();
      });

      it('sets rows readonly and hides Publish without trade.import.manage', async () => {
        setPermissions({ read: true, manage: false });
        fixture = TestBed.createComponent(ImportMappingPage);
        fixture.componentRef.setInput('id', MAPPING_ID);
        await flushPage();

        const rows = fixture.debugElement.query(By.directive(MappingRows)).componentInstance as MappingRows;
        expect(rows.readonly()).toBe(true);
        const publishLabel = (TRANSLATIONS[lang]['imports'] as Record<string, Record<string, string>>)['mappingPage']['publish'];
        expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(publishLabel);
      });

      it('saves with key + If-Match and maps 422 MAPPING_INVALID lookupCode error to row field inline', async () => {
        const detail = makeDetail();
        const updated: UpdateImportMappingResult = {
          ...detail,
          version: 4,
          createdDraftVersion: false,
          draftVersion: { ...detail.versions[0], mappingId: MAPPING_ID, publishedBy: null },
          fields: detail.versions[0].fields,
        };
        const published: PublishImportMappingResult = {
          ...detail,
          status: 'ACTIVE',
          version: 5,
          currentPublishedVersionId: 'ver-1',
          publishedVersion: { ...updated.draftVersion, status: 'PUBLISHED', publishedAt: '2026-11-23T10:10:00.000Z' },
        };
        stub.register('PATCH', '/import-mappings/:id', updated);
        stub.register('POST', '/import-mappings/:id/publish', published);

        fixture = TestBed.createComponent(ImportMappingPage);
        fixture.componentRef.setInput('id', MAPPING_ID);
        await flushPage();

        const page = fixture.componentInstance as unknown as {
          draftFields: { update: (fn: (list: typeof detail.versions[0]['fields']) => typeof detail.versions[0]['fields']) => void };
          save: () => Promise<boolean>;
          publish: () => Promise<void>;
        };

        page.draftFields.update((list) =>
          list.map((f, idx) => (idx === 1 ? { ...f, sourceColumnCode: 'CanSellCol' } : f)),
        );
        fixture.detectChanges();
        expect(await page.save()).toBe(true);
        await flushPage();

        expect(stub.recordedWrites()[0]).toMatchObject({
          method: 'PATCH',
          path: `/import-mappings/${MAPPING_ID}`,
          ifMatch: '"3"',
          scope: { companyId: COMPANY_ID },
        });
        expect(stub.recordedWrites()[0].key).toBeTruthy();

        await page.publish();
        expect(stub.recordedWrites()[1]).toMatchObject({
          method: 'POST',
          path: `/import-mappings/${MAPPING_ID}/publish`,
          ifMatch: '"3"',
          scope: { companyId: COMPANY_ID },
        });
        await flushPage();

        const notify = TestBed.inject(Notify);
        const errorSpy = vi.spyOn(notify, 'error');
        stub.register(
          'PATCH',
          '/import-mappings/:id',
          new ApiError(422, 'TRADE.IMPORT.MAPPING_INVALID', { lookupCode: ['invalid_lookup'] }),
        );
        page.draftFields.update((list) =>
          list.map((f, idx) => (idx === 1 ? { ...f, lookupCode: 'BAD_LOOKUP' } : f)),
        );
        fixture.detectChanges();
        expect(await page.save()).toBe(false);
        fixture.detectChanges();

        const lookupInvalidMsg = (
          (TRANSLATIONS[lang]['imports'] as Record<string, Record<string, Record<string, string>>>)['mappingRows']['errors']['lookupInvalid']
        );
        expect((fixture.nativeElement as HTMLElement).textContent).toContain(lookupInvalidMsg);
        expect(errorSpy).not.toHaveBeenCalled();
      });
    });
  }
}
