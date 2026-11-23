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
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { ApiError } from '../../shared/trade-api';
import { bindTradeHttpForTest, tradeQueries } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import type { ImportRun, ImportRunCounts } from '../imports.model';
import { ImportRunsPage } from './import-runs-page';

const COMPANY_ID = '018f0000-0000-7000-8000-000000000010';
const BRANCH_ID = '018f0000-0000-7000-8000-000000000001';
const RUN_ID = '0193b000-0000-7000-8000-000000000003';
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

function makeRun(overrides: Partial<ImportRun> = {}): ImportRun {
  return {
    id: RUN_ID,
    mappingId: MAPPING_ID,
    mappingVersionId: 'ver-1',
    predecessorRunId: null,
    companyId: COMPANY_ID,
    branchId: null,
    sourceId: 'src-1',
    fileName: 'items-nov.csv',
    bulkJobId: null,
    cancelledCount: '0',
    failure: null,
    progress: { phase: null, processed: 0, total: null },
    mediaType: 'text/csv',
    fileSizeBytes: '2048',
    targetDtoCode: 'trade.catalog.company-profile.import-row',
    targetDtoVersion: 1,
    mode: 'PER_ROW',
    status: 'PREVIEWED',
    totalCount: '20',
    validCount: '20',
    invalidCount: '0',
    succeededCount: '0',
    failedCount: '0',
    version: 2,
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeCounts(total = 1): ImportRunCounts {
  return {
    total,
    byStatus: {
      PENDING: 0,
      PREVIEWING: 0,
      PREVIEWED: total,
      EXECUTING: 0,
      COMPLETED: 0,
      COMPLETED_WITH_ERRORS: 0,
      FAILED: 0,
      CANCELLED: 0,
    },
  };
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`ImportRunsPage (${lang} ${theme})`, () => {
      let fixture: ComponentFixture<ImportRunsPage>;
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

      function setPermissions(options: { read?: boolean; execute?: boolean } = {}): void {
        const { read = true, execute = true } = options;
        const permissions: string[] = [];
        const permissionScopes: TenantMe['permissionScopes'] = {};

        for (const [enabled, key] of [
          [read, 'trade.import.read'],
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
          'GET /import-mappings': { items: [], total: 0, page: 1, limit: 100 },
          'GET /imports/counts': makeCounts(1),
          'GET /imports': { items: [makeRun()], total: 1, page: 1, limit: 24 },
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [ImportRunsPage],
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
            { provide: BulkJobsTracker, useValue: { loadRecent: vi.fn().mockResolvedValue(undefined) } },
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

      it('loads counts and runs with scope headers and renders rows', async () => {
        fixture = TestBed.createComponent(ImportRunsPage);
        await flushPage();

        const paths = stub.recordedReads().map((r) => r.path);
        expect(paths).toContain('/imports/counts');
        expect(paths).toContain('/imports');
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('items-nov.csv');
      });

      it('hides New import without trade.import.execute and shows it when granted', async () => {
        setPermissions({ read: true, execute: false });
        fixture = TestBed.createComponent(ImportRunsPage);
        await flushPage();

        const newLabel = (TRANSLATIONS[lang]['imports'] as Record<string, Record<string, Record<string, string>>>)['runs']['toolbar']['new'];
        expect(Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
          .some((button) => button.textContent?.trim() === newLabel)).toBe(false);

        setPermissions({ read: true, execute: true });
        fixture.detectChanges();
        expect(Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
          .some((button) => button.textContent?.trim() === newLabel)).toBe(true);
      });

      it('renders forbidden full state without calling HTTP when trade.import.read is missing', async () => {
        setPermissions({ read: false, execute: false });
        fixture = TestBed.createComponent(ImportRunsPage);
        await flushPage();

        expect(stub.recordedReads()).toEqual([]);
        const fullState = fixture.debugElement.query(By.directive(FullState));
        expect(fullState).not.toBeNull();
        expect((fullState.componentInstance as FullState).kind()).toBe('forbidden');
      });

      it('shows forbidden full state without an error toast when the server returns 403', async () => {
        const notify = TestBed.inject(Notify);
        const errorSpy = vi.spyOn(notify, 'error');
        stub.register('GET', '/imports', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));

        fixture = TestBed.createComponent(ImportRunsPage);
        await flushPage();

        const fullState = fixture.debugElement.query(By.directive(FullState));
        expect(fullState).not.toBeNull();
        expect((fullState.componentInstance as FullState).kind()).toBe('forbidden');
        expect(errorSpy).not.toHaveBeenCalled();
      });

      it('maps TRADE.CONTROL_TOWER.QUERY_INVALID to an inline error under the filter field', async () => {
        fixture = TestBed.createComponent(ImportRunsPage);
        await flushPage();

        stub.register('GET', '/imports', new ApiError(400, 'TRADE.CONTROL_TOWER.QUERY_INVALID', { q: ['invalid'] }));
        const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
        input.value = 'bad-filter';
        input.dispatchEvent(new Event('input'));
        await flushPage();

        const errEl = fixture.debugElement.query(By.css('#import-runs-filter-error'));
        expect(errEl).not.toBeNull();
        const expectedMsg = (
          (TRANSLATIONS[lang]['imports'] as Record<string, Record<string, string>>)['errors']['TRADE_CONTROL_TOWER_QUERY_INVALID']
        );
        expect((errEl.nativeElement as HTMLElement).textContent).toContain(expectedMsg);
      });
    });
  }
}
