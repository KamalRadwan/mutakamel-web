import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arTradeAutoImports from '../../../../../../public/i18n/trade-auto-imports/ar.json';
import enTradeAutoImports from '../../../../../../public/i18n/trade-auto-imports/en.json';
import arTradeAutomation from '../../../../../../public/i18n/trade-automation/ar.json';
import enTradeAutomation from '../../../../../../public/i18n/trade-automation/en.json';
import arTradeShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enTradeShared from '../../../../../../public/i18n/trade-shared/en.json';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { bindTradeHttpForTest, tradeQueries } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { ImportRunsWatch } from '../automation-shared/import-runs-watch';
import type {
  ImportMapping,
  ImportMappingDetail,
  ImportRun,
  ImportRunCommandResult,
  ImportSource,
  PreviewImportResult,
  RowResult,
} from '../imports.model';
import { ImportWizard } from './import-wizard';

const COMPANY_ID = '018f0000-0000-7000-8000-000000000010';
const BRANCH_ID = '018f0000-0000-7000-8000-000000000001';
const MAPPING_ID = '0193b000-0000-7000-8000-000000000001';
const PRED_RUN_ID = '0193b000-0000-7000-8000-000000000099';

const TRANSLATIONS: Record<string, Translation> = {
  en: {
    ...en,
    tradeShared: enTradeShared,
    automation: enTradeAutomation,
    imports: enTradeAutoImports,
  },
  ar: {
    ...ar,
    tradeShared: arTradeShared,
    automation: arTradeAutomation,
    imports: arTradeAutoImports,
  },
};

@Injectable()
class WizardTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

for (const [lang, theme] of [['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']] as const) {
  describe(`ImportWizard (${lang} ${theme})`, () => {
    let fixture: ComponentFixture<ImportWizard>;
    let stub: TradeHttpStub;
    let dispose: () => void;
    let previousDir: string;
    let previousLang: string;
    let previousTheme: string | null;
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
      previousDir = document.documentElement.dir;
      previousLang = document.documentElement.lang;
      previousTheme = document.documentElement.getAttribute('data-theme');
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

      const activeMapping: ImportMapping = {
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
      };
      const mappingDetail: ImportMappingDetail = {
        ...activeMapping,
        versions: [
          {
            id: 'ver-1',
            versionNumber: 1,
            targetDtoCode: 'trade.catalog.company-profile.import-row',
            targetDtoVersion: 1,
            transformRegistryVersion: 1,
            mappingHash: 'hash',
            executionMode: 'PER_ROW',
            status: 'PUBLISHED',
            publishedAt: '2026-11-23T10:00:00.000Z',
            version: 1,
            createdAt: '2026-11-23T10:00:00.000Z',
            updatedAt: '2026-11-23T10:00:00.000Z',
            fields: [],
          },
        ],
      };
      const predRun: ImportRun = {
        id: PRED_RUN_ID,
        mappingId: MAPPING_ID,
        mappingVersionId: 'ver-1',
        predecessorRunId: null,
        companyId: COMPANY_ID,
        branchId: null,
        sourceId: 'src-old',
        fileName: 'prev.csv',
        bulkJobId: null,
        cancelledCount: '0',
        failure: null,
        progress: { phase: null, processed: 5, total: 5 },
        mediaType: 'text/csv',
        fileSizeBytes: '500',
        targetDtoCode: 'trade.catalog.company-profile.import-row',
        targetDtoVersion: 1,
        mode: 'PER_ROW',
        status: 'COMPLETED_WITH_ERRORS',
        totalCount: '6',
        validCount: '5',
        invalidCount: '0',
        succeededCount: '5',
        failedCount: '1',
        version: 2,
        createdAt: '2026-11-22T10:00:00.000Z',
        updatedAt: '2026-11-22T10:05:00.000Z',
      };

      stub = new TradeHttpStub({
        'GET /import-mappings': { items: [activeMapping], total: 1, page: 1, limit: 100 },
        'GET /import-mappings/:id': mappingDetail,
        'GET /imports': { items: [predRun], total: 1, page: 1, limit: 50 },
      });
      dispose = bindTradeHttpForTest(stub);

      TestBed.configureTestingModule({
        imports: [ImportWizard],
        providers: [
          provideRouter([]),
          provideTransloco({
            config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true },
            loader: WizardTranslocoLoader,
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
          { provide: ImportRunsWatch, useValue: { watch: vi.fn() } },
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
      document.documentElement.dir = previousDir;
      document.documentElement.lang = previousLang;
      if (previousTheme === null) document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', previousTheme);
    });

    it('shows invalid rows on screen and continues predecessor run on re-upload (ق8)', async () => {
      const badSource: ImportSource = {
        fileId: 'src-bad',
        fileName: 'bad.csv',
        sourceObjectRef: 'obj://bad',
        sha256: 'a'.repeat(64),
        mediaType: 'text/csv',
        storedSize: 100,
      };
      const badPreview: PreviewImportResult = {
        runId: 'run-bad',
        status: 'PENDING',
        dispatchStatus: 'QUEUED',
        sourceId: 'src-bad',
        mappingVersionId: 'ver-1',
        message: 'Queued',
      };
      const badRun: ImportRun = {
        id: 'run-bad',
        mappingId: MAPPING_ID,
        mappingVersionId: 'ver-1',
        predecessorRunId: PRED_RUN_ID,
        companyId: COMPANY_ID,
        branchId: null,
        sourceId: 'src-bad',
        fileName: 'bad.csv',
        bulkJobId: null,
        cancelledCount: '0',
        failure: null,
        progress: { phase: null, processed: 0, total: null },
        mediaType: 'text/csv',
        fileSizeBytes: '100',
        targetDtoCode: 'trade.catalog.company-profile.import-row',
        targetDtoVersion: 1,
        mode: 'PER_ROW',
        status: 'PREVIEWED',
        totalCount: '2',
        validCount: '1',
        invalidCount: '1',
        succeededCount: '0',
        failedCount: '0',
        version: 1,
        createdAt: '2026-11-23T10:00:00.000Z',
        updatedAt: '2026-11-23T10:00:00.000Z',
      };
      const invalidRow: RowResult = {
        rowNumber: 2,
        stableRowKey: 'ROW-2',
        status: 'INVALID',
        errorCode: 'TRADE.IMPORT.VALUE_INVALID',
        errorFieldCode: 'CAN_SELL',
        ownerAggregateType: null,
        ownerAggregateId: null,
        ownerAggregateVersion: null,
        completedAt: null,
      };

      stub.register('POST', '/imports/sources', badSource);
      stub.register('POST', '/imports/preview', badPreview);
      stub.register('GET', '/imports/:runId', badRun);
      stub.register('GET', '/imports/:runId/results', { items: [invalidRow], total: 1, page: 1, limit: 10 });

      fixture = TestBed.createComponent(ImportWizard);
      const wizard = fixture.componentInstance;
      const internals = wizard as unknown as {
        onFilePicked: (f: File) => Promise<void>;
        goNext: () => Promise<void>;
        uploadFixedFile: () => void;
        startImport: () => Promise<void>;
        canAdvance: () => boolean;
        selectedPredecessorId: () => string;
      };

      wizard.open({ mappingId: MAPPING_ID, predecessorRunId: PRED_RUN_ID });
      await fixture.whenStable();
      fixture.detectChanges();

      await internals.onFilePicked(new File(['ItemCode\nA1\n'], 'bad.csv', { type: 'text/csv' }));
      await internals.goNext(); // -> mapping
      await internals.goNext(); // -> check (preview + loadInvalidRows)
      await fixture.whenStable();
      fixture.detectChanges();

      expect(internals.canAdvance()).toBe(false);
      const fieldLabel = (TRANSLATIONS[lang]['imports'] as Record<string, Record<string, string>>)['fields']['CAN_SELL'];
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(fieldLabel);

      // Re-upload a fixed file while retaining the predecessor run.
      internals.uploadFixedFile();
      fixture.detectChanges();
      expect(internals.selectedPredecessorId()).toBe(PRED_RUN_ID);

      const goodSource: ImportSource = { ...badSource, fileId: 'src-good', fileName: 'good.csv' };
      const goodPreview: PreviewImportResult = { ...badPreview, runId: 'run-good', sourceId: 'src-good' };
      const goodRun: ImportRun = {
        ...badRun,
        id: 'run-good',
        sourceId: 'src-good',
        fileName: 'good.csv',
        validCount: '2',
        invalidCount: '0',
        version: 2,
      };
      const execRes: ImportRunCommandResult = { runId: 'run-good', status: 'EXECUTING', jobId: 'job-2' };

      stub.register('POST', '/imports/sources', goodSource);
      stub.register('POST', '/imports/preview', goodPreview);
      stub.register('GET', '/imports/:runId', goodRun);
      stub.register('POST', '/imports/:runId/execute', execRes);

      await internals.onFilePicked(new File(['ItemCode\nA1\n'], 'good.csv', { type: 'text/csv' }));
      await internals.goNext(); // -> mapping
      await internals.goNext(); // -> check
      expect(internals.canAdvance()).toBe(true);
      await internals.goNext(); // -> import
      await internals.startImport();

      const previewWrites = stub.recordedWrites().filter((w) => w.path === '/imports/preview');
      expect(previewWrites).toHaveLength(2);
      expect(previewWrites[1].body).toEqual({
        mappingId: MAPPING_ID,
        sourceId: 'src-good',
        predecessorRunId: PRED_RUN_ID,
      });

      const execWrite = stub.recordedWrites().find((w) => w.path === '/imports/run-good/execute');
      expect(execWrite).toMatchObject({
        method: 'POST',
        ifMatch: '"2"',
        scope: { companyId: COMPANY_ID },
      });
      expect(execWrite?.key).toBeTruthy();
      expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([
        '/trade/automation/import-runs', 'run-good',
      ]);
    });
  });
}
