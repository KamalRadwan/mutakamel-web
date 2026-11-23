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
import type {
  ImportMappingDetail,
  ImportRun,
  ImportRunCommandResult,
  RowResult,
} from '../imports.model';
import { ImportRunPage } from './import-run-page';

const COMPANY_ID = '018f0000-0000-7000-8000-000000000010';
const BRANCH_ID = '018f0000-0000-7000-8000-000000000001';
const RUN_ID = '0193b000-0000-7000-8000-000000000003';
const MAPPING_ID = '0193b000-0000-7000-8000-000000000001';
const SOURCE_ID = '0193b000-0000-7000-8000-000000000002';

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
    sourceId: SOURCE_ID,
    fileName: 'items-run.csv',
    bulkJobId: null,
    cancelledCount: '0',
    failure: null,
    progress: { phase: null, processed: 0, total: null },
    mediaType: 'text/csv',
    fileSizeBytes: '1024',
    targetDtoCode: 'trade.catalog.company-profile.import-row',
    targetDtoVersion: 1,
    mode: 'PER_ROW',
    status: 'PREVIEWED',
    totalCount: '10',
    validCount: '10',
    invalidCount: '0',
    succeededCount: '0',
    failedCount: '0',
    version: 4,
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeMapping(): ImportMappingDetail {
  return {
    id: MAPPING_ID,
    code: 'ITEM_SETTINGS',
    targetCode: 'CATALOG_COMPANY_PROFILE',
    scopeTarget: 'COMPANY',
    companyId: COMPANY_ID,
    branchId: null,
    currentPublishedVersionId: 'ver-1',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    versions: [],
  };
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`ImportRunPage (${lang} ${theme})`, () => {
      let fixture: ComponentFixture<ImportRunPage>;
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
        const row: RowResult = {
          rowNumber: 1,
          stableRowKey: 'ITEM-1',
          status: 'VALID',
          errorCode: null,
          errorFieldCode: null,
          ownerAggregateType: null,
          ownerAggregateId: null,
          ownerAggregateVersion: null,
          completedAt: null,
        };
        stub = new TradeHttpStub({
          'GET /imports/:runId': makeRun(),
          'GET /import-mappings/:id': makeMapping(),
          'GET /imports/:runId/results': { items: [row], total: 1, page: 1, limit: 25 },
          'GET /imports/:runId/results.csv': new Blob(['row_number\r\n1\r\n'], { type: 'text/csv' }),
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [ImportRunPage],
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
        vi.useRealTimers();
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

      it('loads run and results with scope headers and translated results table columns', async () => {
        fixture = TestBed.createComponent(ImportRunPage);
        fixture.componentRef.setInput('runId', RUN_ID);
        await flushPage();

        const reads = stub.recordedReads();
        expect(reads.some((r) => r.path === `/imports/${RUN_ID}` && r.scope?.companyId === COMPANY_ID)).toBe(true);
        expect(reads.some((r) => r.path === `/imports/${RUN_ID}/results` && r.scope?.companyId === COMPANY_ID)).toBe(true);

        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        const colRow = (TRANSLATIONS[lang]['imports'] as Record<string, Record<string, string>>)['results']['colRow'];
        expect(text).toContain(colRow);
        expect(text).not.toContain('results.colRow');
      });

      it('renders forbidden full state without HTTP when trade.import.read is missing and on 403', async () => {
        setPermissions({ read: false, manage: false, execute: false });
        fixture = TestBed.createComponent(ImportRunPage);
        fixture.componentRef.setInput('runId', RUN_ID);
        await flushPage();

        expect(stub.recordedReads()).toEqual([]);
        expect((fixture.debugElement.query(By.directive(FullState)).componentInstance as FullState).kind()).toBe('forbidden');

        fixture.destroy();
        setPermissions({ read: true, manage: true, execute: true });
        stub.register('GET', '/imports/:runId', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        fixture = TestBed.createComponent(ImportRunPage);
        fixture.componentRef.setInput('runId', RUN_ID);
        await flushPage();

        expect((fixture.debugElement.query(By.directive(FullState)).componentInstance as FullState).kind()).toBe('forbidden');
      });

      it('gates Start import on trade.import.execute and calls execute + cancel with key and If-Match', async () => {
        setPermissions({ read: true, manage: true, execute: false });
        fixture = TestBed.createComponent(ImportRunPage);
        fixture.componentRef.setInput('runId', RUN_ID);
        await flushPage();

        const startLabel = (TRANSLATIONS[lang]['imports'] as Record<string, Record<string, string>>)['runPage']['startImport'];
        expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(startLabel);

        setPermissions({ read: true, manage: true, execute: true });
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).textContent).toContain(startLabel);

        const execRes: ImportRunCommandResult = { runId: RUN_ID, status: 'EXECUTING', jobId: 'job-1' };
        stub.register('POST', '/imports/:runId/execute', execRes);
        const page = fixture.componentInstance as unknown as { startImport: () => Promise<void> };
        await page.startImport();

        expect(stub.recordedWrites()[0]).toMatchObject({
          method: 'POST',
          path: `/imports/${RUN_ID}/execute`,
          ifMatch: '"4"',
          scope: { companyId: COMPANY_ID },
        });
        expect(stub.recordedWrites()[0].key).toBeTruthy();
      });

      it('downloads results.csv as a blob with scope headers and revokes object URL on destroy', async () => {
        const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv-download');
        const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        fixture = TestBed.createComponent(ImportRunPage);
        fixture.componentRef.setInput('runId', RUN_ID);
        await flushPage();

        const page = fixture.componentInstance as unknown as { downloadResults: () => Promise<void> };
        await page.downloadResults();

        expect(createSpy).toHaveBeenCalledTimes(1);
        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect(stub.recordedReads().some((r) => r.path === `/imports/${RUN_ID}/results.csv`)).toBe(true);

        fixture.destroy();
        expect(revokeSpy).toHaveBeenCalledWith('blob:csv-download');
      });

      it('raises a completion toast when a polled active run finishes (ق9)', async () => {
        vi.useFakeTimers();
        const notify = TestBed.inject(Notify);
        const successSpy = vi.spyOn(notify, 'success');

        stub.register('GET', '/imports/:runId', makeRun({
          status: 'EXECUTING',
          progress: { phase: 'EXECUTE', processed: 5, total: 10 },
        }));

        fixture = TestBed.createComponent(ImportRunPage);
        fixture.componentRef.setInput('runId', RUN_ID);
        fixture.detectChanges();
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);
        fixture.detectChanges();
        await Promise.resolve();
        fixture.detectChanges();

        stub.register('GET', '/imports/:runId', makeRun({
          status: 'COMPLETED',
          succeededCount: '10',
          progress: { phase: null, processed: 10, total: 10 },
        }));
        await vi.advanceTimersByTimeAsync(3100);
        await Promise.resolve();
        fixture.detectChanges();

        expect(successSpy).toHaveBeenCalled();
      });
    });
  }
}
